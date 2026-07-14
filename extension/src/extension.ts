import * as vscode from 'vscode';
import { DsIntrospector } from './ds/dsIntrospector';
import { applyWhitelist, type DsPackage, DsRegistry } from './ds/dsRegistry';
import {
  generateSkillsToConfig,
  getSkillsConfig,
  listComponentSkillFiles,
  listSkillFiles,
  runGenerateSkills,
  setSkillsConfig,
} from './ds/skillWriter';
import { registerDropProvider } from './providers/dropProvider';
import { Store } from './state/store';
import { UserOverridesStore } from './state/userOverrides';
import type { ComponentMeta, PackageMeta } from './util/messaging';
import { GalleryViewProvider } from './views/galleryViewProvider';
import { PropsPanelProvider } from './views/propsPanelProvider';
import { SettingsPanelProvider } from './views/settingsPanelProvider';

const GENERATED_IDS_KEY = 'snapds.skills.generatedIds';

export function activate(ctx: vscode.ExtensionContext): void {
  const registry = new DsRegistry(ctx);
  const userOverrides = new UserOverridesStore(ctx);
  const introspector = new DsIntrospector(ctx, userOverrides);
  const store = new Store(ctx);

  const propsPanel = new PropsPanelProvider(ctx, {
    onReady: () => {
      const sel = store.getSelected();
      if (sel) {
        propsPanel.postComponentSchema(sel, store.getConfiguredProps(sel.id));
      }
    },
    onPropsUpdated: (componentId, props) => {
      store.setConfiguredProps(componentId, props);
    },
  });

  const gallery = new GalleryViewProvider(ctx, {
    onReady: async () => {
      gallery.postComponentList(store.listComponents());
    },
    onSearch: (_query) => {
      // Filtering happens in the webview; reserved for future server-side filtering.
    },
    onSelect: async (componentId) => {
      const meta = store.getComponent(componentId);
      if (!meta) return;
      store.select(componentId);
      propsPanel.postComponentSchema(meta, store.getConfiguredProps(componentId));
    },
  });

  ctx.subscriptions.push(
    vscode.window.registerWebviewViewProvider(GalleryViewProvider.viewId, gallery, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
  );

  registerDropProvider(ctx, store);

  const onGenerateSkills = async () => {
    try {
      const components = await collectComponents();
      await runGenerateSkills(components);
      await ctx.globalState.update(
        GENERATED_IDS_KEY,
        components.map((c) => c.id),
      );
      settingsPanel.postSkillsGenerated(true);
    } catch (e) {
      vscode.window.showErrorMessage(`Snapds: failed to generate skills: ${(e as Error).message}`);
      settingsPanel.postSkillsGenerated(false);
    }
  };

  const settingsPanel = new SettingsPanelProvider(ctx, {
    onGenerateSkills,
    onReady: async () => {
      settingsPanel.postPackageList(await buildPackageList());
      settingsPanel.postSkillsConfig(getSkillsConfig());
    },
    onRequestComponents: async (pkgName) => {
      const existing = registry.list().find((p) => p.name === pkgName);
      const descriptor = existing ?? (await registry.resolveDescriptor(pkgName));
      if (!descriptor) {
        vscode.window.showWarningMessage(`Snapds: could not locate "${pkgName}" in node_modules.`);
        // Always answer so the UI leaves its "loading" state.
        settingsPanel.postComponentNames(pkgName, []);
        return;
      }
      // Stale-while-revalidate: surface the cached list instantly (if any) so the
      // UI never blocks on the parser, then force a fresh scan and post again.
      const cached = introspector.getCached(descriptor);
      if (cached) {
        settingsPanel.postComponentNames(
          pkgName,
          cached.map((c) => c.name),
        );
      }
      try {
        const all = await introspector.introspect(descriptor, { force: true });
        settingsPanel.postComponentNames(
          pkgName,
          all.map((c) => c.name),
        );
      } catch (e) {
        if (!cached) {
          vscode.window.showErrorMessage(
            `Failed to introspect ${pkgName}: ${(e as Error).message}`,
          );
          settingsPanel.postComponentNames(pkgName, []);
        }
      }
    },
    onPickCustomPath: async () => {
      const picked = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectFiles: false,
        canSelectMany: false,
        openLabel: 'Select skills destination folder',
      });
      if (picked && picked.length) {
        settingsPanel.postCustomPathPicked(picked[0].fsPath);
      }
    },
    onSaveSkillsConfig: async (config) => {
      await setSkillsConfig(config);
      settingsPanel.postSkillsConfig(getSkillsConfig());
    },
    onListSkills: () => {
      settingsPanel.postSkillsList(listSkillFiles(getSkillsConfig()));
    },
    onOpenSkill: async (skillPath) => {
      await vscode.window.showTextDocument(vscode.Uri.file(skillPath));
    },
    onRegenerateAllSkills: async () => {
      await regenerateAll();
      // Refresh the directory listing so newly written files appear immediately.
      settingsPanel.postSkillsList(listSkillFiles(getSkillsConfig()));
    },
    onRequestComponentDetail: async ({ pkg, component }) => {
      const existing = registry.list().find((p) => p.name === pkg);
      const descriptor = existing ?? (await registry.resolveDescriptor(pkg));
      if (!descriptor) {
        settingsPanel.postComponentDetail({ pkg, component, props: [], skillFiles: [] });
        return;
      }
      const all = await introspector.introspect(descriptor);
      const meta = all.find((c) => c.name === component);
      const files = listComponentSkillFiles(all, meta, getSkillsConfig());
      settingsPanel.postComponentDetail({
        pkg,
        component,
        description: meta?.description,
        props: meta?.props ?? [],
        snippet: meta?.snippet,
        companyOverride: introspector.getCompanyOverride(pkg, component),
        userOverride: userOverrides.get(pkg, component),
        skillFiles: files,
      });
    },
    onRequestUserOverrides: () => {
      settingsPanel.postUserOverrides(userOverrides.all());
    },
    onSaveUserOverride: async ({ pkg, component, override }) => {
      await userOverrides.set(pkg, component, override);
      await reintrospectAndBroadcast(pkg);
    },
    onResetUserOverride: async ({ pkg, component }) => {
      await userOverrides.reset(pkg, component);
      await reintrospectAndBroadcast(pkg);
    },
    onSavePackages: async (packages) => {
      settingsPanel.postSaving();

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Updating Snapds Packages...',
          cancellable: false,
        },
        async (progress) => {
          const oldList = registry.list();
          const currentNames = oldList.map((p) => p.name);
          const incomingNames = packages.map((p) => p.name);

          const toDisable = currentNames.filter((name) => !incomingNames.includes(name));

          // Derive persisted selection: excluded = detected \ selected; manual = selected \ detected.
          // When `components` is absent the package UI was never expanded, so keep the
          // existing persisted selection instead of clobbering it.
          for (const pkg of packages) {
            if (pkg.components === undefined) {
              const existing = oldList.find((p) => p.name === pkg.name);
              await registry.updatePackage(pkg.name, true, existing?.excluded, existing?.manual);
              continue;
            }
            const selected = pkg.selected ?? [];
            const excluded = pkg.components.filter((c) => !selected.includes(c));
            const manual = selected.filter((c) => !pkg.components!.includes(c));
            await registry.updatePackage(pkg.name, true, excluded, manual);
          }

          for (const name of toDisable) {
            await registry.updatePackage(name, false);
          }

          const activePackages = registry.list();
          let allComponents: ComponentMeta[] = [];

          for (const pkg of activePackages) {
            const isNew = !oldList.find((p) => p.name === pkg.name);

            progress.report({ message: `Introspecting ${pkg.name}...` });
            try {
              const detected = await introspector.introspect(pkg, { force: isNew });
              allComponents = allComponents.concat(applyWhitelist(detected, pkg));
            } catch (e) {
              vscode.window.showErrorMessage(
                `Failed to introspect ${pkg.name}: ${(e as Error).message}`,
              );
            }
          }

          store.setComponents(allComponents);
          gallery.postComponentList(allComponents);
          await autoGenerateForNew(allComponents);
        },
      );

      settingsPanel.postSaved();
      settingsPanel.postPackageList(await buildPackageList());
    },
  });

  ctx.subscriptions.push(
    vscode.commands.registerCommand('snapds.openSettings', () => {
      settingsPanel.show();
    }),

    vscode.commands.registerCommand('snapds.openPropsPanel', () => {
      propsPanel.show();
    }),

    vscode.commands.registerCommand('snapds.generateSkills', onGenerateSkills),

    vscode.commands.registerCommand('snapds.regenerateSkills', regenerateAll),
  );

  void (async () => {
    const list = registry.list();
    if (list.length > 0) {
      // Refresh all configured packages in the workspace concurrently
      await Promise.all(list.map((pkg) => refreshActiveComponents(pkg)));
      // Cache is warm now — refresh the settings counts if the panel is open.
      settingsPanel.postPackageList(await buildPackageList());
    }
  })();

  async function buildPackageList(): Promise<PackageMeta[]> {
    const allPkgs = await registry.discoverAllPackagesInWorkspace();
    const currentList = registry.list();
    return allPkgs.map((name) => {
      const pkg = currentList.find((p) => p.name === name);
      const cached = pkg ? introspector.getCached(pkg) : undefined;
      return {
        name,
        enabled: !!pkg,
        components: cached?.map((c) => c.name),
        excluded: pkg?.excluded ?? [],
        manual: pkg?.manual ?? [],
      };
    });
  }

  async function collectWhitelistedComponents(): Promise<ComponentMeta[]> {
    const out: ComponentMeta[] = [];
    for (const pkg of registry.list()) {
      try {
        const detected = await introspector.introspect(pkg);
        out.push(...applyWhitelist(detected, pkg));
      } catch (e) {
        vscode.window.showErrorMessage(`Failed to introspect ${pkg.name}: ${(e as Error).message}`);
      }
    }
    return out;
  }

  async function collectComponents(): Promise<ComponentMeta[]> {
    const existing = store.listComponents();
    if (existing.length) return existing;
    return collectWhitelistedComponents();
  }

  /** Incrementally generates skills for components not yet generated (auto path). */
  async function autoGenerateForNew(all: ComponentMeta[]): Promise<void> {
    const cfg = getSkillsConfig();
    if (!cfg.enabled || !cfg.autoGenerate) return;
    const prev = new Set(ctx.globalState.get<string[]>(GENERATED_IDS_KEY) ?? []);
    const changedIds = new Set(all.filter((c) => !prev.has(c.id)).map((c) => c.id));
    if (!changedIds.size) return;
    await generateSkillsToConfig(all, cfg, { mode: 'incremental', changedIds });
    await ctx.globalState.update(
      GENERATED_IDS_KEY,
      all.map((c) => c.id),
    );
  }

  async function regenerateAll(): Promise<void> {
    const cfg = getSkillsConfig();
    const all = await collectWhitelistedComponents();
    const n = await generateSkillsToConfig(all, cfg, { mode: 'full' });
    await ctx.globalState.update(
      GENERATED_IDS_KEY,
      all.map((c) => c.id),
    );
    vscode.window.showInformationMessage(
      `Snapds: regenerated ${n} skill file${n === 1 ? '' : 's'}.`,
    );
  }

  /**
   * Re-emits merged component metadata for `pkgName` after a USER override change.
   * The parse cache is untouched (overrides apply post-cache), so this only rebuilds
   * the store + gallery and, when relevant, refreshes the live props preview.
   */
  async function reintrospectAndBroadcast(pkgName: string): Promise<void> {
    const existing = registry.list().find((p) => p.name === pkgName);
    const descriptor = existing ?? (await registry.resolveDescriptor(pkgName));
    if (!descriptor) return;
    await refreshActiveComponents(descriptor);
    const sel = store.getSelected();
    if (sel && sel.id.startsWith(`${pkgName}#`) && propsPanel.isOpen()) {
      propsPanel.postComponentSchema(sel, store.getConfiguredProps(sel.id));
    }
  }

  async function refreshActiveComponents(pkg: DsPackage): Promise<void> {
    try {
      const detected = await introspector.introspect(pkg);
      const whitelisted = applyWhitelist(detected, pkg);
      // Append these components to our store instead of overwriting the previous ones
      const existing = store.listComponents();
      // Remove any that might belong to the same package if it's being updated
      const filtered = existing.filter((c) => !c.id.startsWith(`${pkg.name}#`));

      const combined = [...filtered, ...whitelisted];

      store.setComponents(combined);
      gallery.postComponentList(combined);
    } catch (e) {
      vscode.window.showErrorMessage(`Failed to introspect ${pkg.name}: ${(e as Error).message}`);
    }
  }
}

export function deactivate(): void {
  // no-op
}
