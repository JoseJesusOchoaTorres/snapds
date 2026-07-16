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
      settingsPanel.postScopeFilters(ctx.workspaceState.get<string[]>('snapds.scopeFilters') ?? []);
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
      // The parse cache is keyed by package version + config mtime, so a cached
      // result is already authoritative: serve it immediately and skip the costly
      // react-docgen-typescript re-parse that previously ran on every modal open.
      const cached = introspector.getCached(descriptor);
      if (cached) {
        settingsPanel.postComponentNames(
          pkgName,
          cached.map((c) => c.name),
        );
        return;
      }
      // Cold package (never scanned): parse once, cache it, then post the names.
      // Show progress in the status bar so the user knows the extension is working.
      try {
        let all: ComponentMeta[] = [];
        await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Window, title: 'Snapds', cancellable: false },
          async (progress) => {
            progress.report({ message: `Indexing ${pkgName}…` });
            all = await introspector.introspect(descriptor);
          },
        );
        settingsPanel.postComponentNames(
          pkgName,
          all.map((c) => c.name),
        );
      } catch (e) {
        vscode.window.showErrorMessage(
          `Failed to introspect ${pkgName}: ${(e as Error).message}`,
        );
        settingsPanel.postComponentNames(pkgName, []);
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
    onSetScopeFilters: async (filters) => {
      await ctx.workspaceState.update('snapds.scopeFilters', filters.length > 0 ? filters : undefined);
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
          const oldByName = new Map(oldList.map((p) => [p.name, p]));
          const enabledNames = new Set(packages.map((p) => p.name));

          progress.report({ message: 'Saving…' });

          // Build the new list in memory, resolving descriptors for brand-new
          // packages in parallel. Then write once — instead of one settings.json
          // write per package (the previous N-serial-writes pattern).
          const resolved = await Promise.all(
            packages.map(async (pkg) => {
              const existing = oldByName.get(pkg.name);
              let version = existing?.version ?? 'unknown';
              let importPath = existing?.importPath ?? pkg.name;
              let tsconfigPath = existing?.tsconfigPath;

              if (!existing) {
                const descriptor = await registry.resolveDescriptor(pkg.name);
                if (descriptor) {
                  version = descriptor.version;
                  tsconfigPath = descriptor.tsconfigPath;
                }
              }

              // When `components` is absent the package was never expanded in the
              // UI — keep the existing persisted selection.
              if (pkg.components === undefined) {
                return {
                  name: pkg.name,
                  version,
                  importPath,
                  tsconfigPath,
                  excluded: existing?.excluded ?? [],
                  manual: existing?.manual ?? [],
                };
              }

              const selected = pkg.selected ?? [];
              const excluded = pkg.components.filter((c) => !selected.includes(c));
              const manual = selected.filter((c) => !pkg.components!.includes(c));
              return { name: pkg.name, version, importPath, tsconfigPath, excluded, manual };
            }),
          );

          // Drop packages the user removed. Single write.
          const finalList = resolved.filter((p) => enabledNames.has(p.name));
          await registry.saveAll(finalList);

          const activePackages = registry.list();

          progress.report({ message: `Loading ${activePackages.length} package${activePackages.length > 1 ? 's' : ''}…` });

          // Introspect all packages concurrently. Each call either hits the in-memory
          // cache (instant for packages already opened in the modal) or starts a fresh
          // parse. No force: isNew — onRequestComponents already cached new packages.
          const results = await Promise.all(
            activePackages.map(async (pkg) => {
              try {
                const detected = await introspector.introspect(pkg);
                return applyWhitelist(detected, pkg);
              } catch (e) {
                vscode.window.showErrorMessage(
                  `Failed to introspect ${pkg.name}: ${(e as Error).message}`,
                );
                return [] as ComponentMeta[];
              }
            }),
          );
          const allComponents = results.flat();

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

    vscode.commands.registerCommand('snapds.clearCache', clearIntrospectionCache),

    vscode.commands.registerCommand('snapds.reindex', reindexInBackground),

    vscode.commands.registerCommand('snapds.diagnostics', async () => {
      const overrides = userOverrides.all();
      const out = vscode.window.createOutputChannel('Snapds Diagnostics');
      out.clear();
      out.appendLine('=== User Overrides (workspaceState) ===');
      out.appendLine(JSON.stringify(overrides, null, 2));
      out.appendLine('');
      out.appendLine('=== Registered packages ===');
      for (const pkg of registry.list()) {
        const cached = introspector.getCached(pkg);
        out.appendLine(`${pkg.name}@${pkg.version}: ${cached ? cached.length + ' components cached' : 'not cached'}`);
        if (cached) {
          for (const c of cached) {
            out.appendLine(`  ${c.name}: ${c.props.length} props${c.standardPropsOnly ? ' (DOM only)' : ''}`);
          }
        }
      }
      out.appendLine('');
      out.appendLine('=== Raw parse (no propFilter) for @starlight/buttons ===');
      try {
        const docgen = await import('react-docgen-typescript');
        const fs = await import('node:fs');
        const path = await import('node:path');
        const pkg = registry.list().find((p) => p.name === '@starlight/buttons');
        if (pkg) {
          const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
          let pkgDir = '';
          // Walk up node_modules
          let dir = folder;
          while (true) {
            const candidate = path.join(dir, 'node_modules', pkg.name);
            if (fs.existsSync(candidate)) { pkgDir = candidate; break; }
            const parent = path.dirname(dir);
            if (parent === dir) break;
            dir = parent;
          }
          // pnpm / monorepo fallback
          if (!pkgDir) {
            try {
              const uris = await vscode.workspace.findFiles(`**/node_modules/${pkg.name}/package.json`, null, 1);
              if (uris.length > 0) pkgDir = path.dirname(uris[0].fsPath);
            } catch {}
          }
          if (pkgDir) {
            const parser = docgen.withDefaultConfig({
              savePropValueAsString: false,
              shouldExtractLiteralValuesFromEnum: true,
              shouldRemoveUndefinedFromOptional: true,
              propFilter: (prop) => {
                out.appendLine(`  prop: ${prop.name} | parent: ${prop.parent?.fileName ?? '(none)'}`);
                return true;
              },
            });
            const entry = path.join(pkgDir, 'build', 'index.d.ts');
            out.appendLine(`Parsing: ${entry}`);
            const parsed = parser.parse([entry]);
            for (const c of parsed) {
              out.appendLine(`Component: ${c.displayName} — ${Object.keys(c.props).length} props`);
            }
          } else {
            out.appendLine('Package dir not found');
          }
        } else {
          out.appendLine('@starlight/buttons not registered');
        }
      } catch (e) {
        out.appendLine(`Error: ${String(e)}`);
      }
      out.show();
    }),
  );

  void (async () => {
    const list = registry.list();
    if (list.length === 0) return;

    // Packages already in cache resolve instantly — no need to show a notification.
    // Only show visible progress when at least one package requires a real parse.
    const cold = list.filter((p) => !introspector.getCached(p));
    if (cold.length === 0) {
      // All cached: warm up silently so the gallery populates without disturbing the user.
      await Promise.all(list.map((pkg) => refreshActiveComponents(pkg)));
      settingsPanel.postPackageList(await buildPackageList());
      return;
    }

    let totalComponents = 0;
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Snapds: Indexing packages',
        cancellable: false,
      },
      async (progress) => {
        let done = 0;
        progress.report({ message: `0 / ${list.length}`, increment: 0 });
        await Promise.all(
          list.map(async (pkg) => {
            await refreshActiveComponents(pkg);
            done++;
            progress.report({
              message: `${done} / ${list.length} — ${pkg.name}`,
              increment: (1 / list.length) * 100,
            });
          }),
        );
        settingsPanel.postPackageList(await buildPackageList());
        totalComponents = store.listComponents().length;
      },
    );
    vscode.window.showInformationMessage(
      `Snapds: indexed ${list.length} package${list.length > 1 ? 's' : ''} — ${totalComponents} component${totalComponents !== 1 ? 's' : ''} ready.`,
    );
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

  async function reindexInBackground(): Promise<void> {
    const list = registry.list();
    if (list.length === 0) {
      vscode.window.showInformationMessage('Snapds: No packages registered.');
      return;
    }
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Snapds: Indexing packages',
        cancellable: false,
      },
      async (progress) => {
        let done = 0;
        progress.report({ message: `0 / ${list.length}`, increment: 0 });
        await Promise.all(
          list.map(async (pkg) => {
            await refreshActiveComponents(pkg);
            done++;
            progress.report({
              message: `${done} / ${list.length} — ${pkg.name}`,
              increment: (1 / list.length) * 100,
            });
          }),
        );
        settingsPanel.postPackageList(await buildPackageList());
      },
    );
    vscode.window.showInformationMessage('Snapds: Packages re-indexed.');
  }

  async function clearIntrospectionCache(): Promise<void> {
    const cleared = await introspector.clearCache();
    const list = registry.list();
    await vscode.window.withProgress(
      { location: vscode.ProgressLocation.Window, title: 'Snapds' },
      async (progress) => {
        let done = 0;
        progress.report({ message: `Re-indexing ${list.length} package${list.length > 1 ? 's' : ''}…` });
        await Promise.all(
          list.map(async (pkg) => {
            await refreshActiveComponents(pkg);
            done++;
            progress.report({ message: `${pkg.name} (${done}/${list.length})` });
          }),
        );
        settingsPanel.postPackageList(await buildPackageList());
      },
    );
    vscode.window.showInformationMessage(
      `Snapds: cleared ${cleared} cached introspection entr${cleared === 1 ? 'y' : 'ies'} and refreshed.`,
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
