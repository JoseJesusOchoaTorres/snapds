import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { registerQuickSearch } from './commands/quickSearch';
import { applyConfig, detectConfigConflict, previewImport } from './config/configImporter';
import { resolveConfig } from './config/configResolver';
import type { SnapdsConfig } from './config/configSchema';
import {
  defaultConfigPath,
  serializeCurrentState,
  writeConfigFile,
} from './config/configSerializer';
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
import {
  discoverInstallations,
  findNearestPackageJson,
  latestInstallation,
  type PackageInstallation,
  resolveForFile,
} from './ds/versionResolver';
import { registerDropProvider } from './providers/dropProvider';
import { Store } from './state/store';
import { UserOverridesStore } from './state/userOverrides';
import type { ComponentMeta, PackageMeta } from './util/messaging';
import { GalleryViewProvider } from './views/galleryViewProvider';
import { PropsPanelProvider } from './views/propsPanelProvider';
import { SettingsPanelProvider } from './views/settingsPanelProvider';

const GENERATED_IDS_KEY = 'snapds.skills.generatedIds';
const CONFIG_NOTIFIED_PREFIX = 'snapds.configNotified.';

// ─── Shared activation context ────────────────────────────────────────────────

interface ActivationCtx {
  vsctx: vscode.ExtensionContext;
  registry: DsRegistry;
  userOverrides: UserOverridesStore;
  introspector: DsIntrospector;
  store: Store;
  installationsMap: Map<string, PackageInstallation[]>;
  workspaceRoot: string | undefined;
  /** Tracks the last focused text editor; stable when focus moves to a webview. */
  lastKnownFilePath: string | undefined;
  /** Holds a resolved config while the user confirms an import preview. */
  pendingImport: { config: SnapdsConfig; configPath: string } | undefined;
  // Set by the setup functions immediately after provider construction.
  // Safe to assert non-null inside callbacks (all callbacks are event-driven
  // and fire after activate() finishes setting up the three providers).
  gallery: GalleryViewProvider;
  propsPanel: PropsPanelProvider;
  settingsPanel: SettingsPanelProvider;
}

// ─── activate() ───────────────────────────────────────────────────────────────

export function activate(ctx: vscode.ExtensionContext): void {
  const registry = new DsRegistry();
  const userOverrides = new UserOverridesStore(ctx);
  const introspector = new DsIntrospector(ctx, userOverrides);
  const store = new Store(ctx);

  const ac = {
    vsctx: ctx,
    registry,
    userOverrides,
    introspector,
    store,
    installationsMap: new Map<string, PackageInstallation[]>(),
    workspaceRoot: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
    lastKnownFilePath: undefined,
    pendingImport: undefined,
  } as unknown as ActivationCtx;

  ac.propsPanel = setupPropsPanel(ctx, ac);
  ac.gallery = setupGallery(ctx, ac);
  ac.settingsPanel = setupSettingsPanel(ctx, ac);

  ctx.subscriptions.push(
    vscode.window.registerWebviewViewProvider(GalleryViewProvider.viewId, ac.gallery, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (!editor) return;
      ac.lastKnownFilePath = editor.document.uri.fsPath;
      notifyVersions(ac.lastKnownFilePath, ac);
    }),
    vscode.workspace.onDidCloseTextDocument((doc) => {
      if (doc.uri.fsPath !== ac.lastKnownFilePath) return;
      ac.lastKnownFilePath = vscode.window.activeTextEditor?.document.uri.fsPath;
      notifyVersions(ac.lastKnownFilePath, ac);
    }),
  );

  registerDropProvider(ctx, store);
  registerQuickSearch(ctx, store);
  setupCommands(ctx, ac);

  runStartupFlow(ctx, ac);
}

export function deactivate(): void {
  // no-op
}

// ─── setupPropsPanel ──────────────────────────────────────────────────────────

function setupPropsPanel(ctx: vscode.ExtensionContext, ac: ActivationCtx): PropsPanelProvider {
  return new PropsPanelProvider(ctx, {
    onReady: () => {
      const sel = ac.store.getSelected();
      if (sel) {
        ac.propsPanel.postComponentSchema(sel, ac.store.getConfiguredProps(sel.id));
        notifyVersions(vscode.window.activeTextEditor?.document.uri.fsPath, ac);
      }
    },
    onPropsUpdated: (componentId, props) => {
      ac.store.setConfiguredProps(componentId, props);
    },
    onSwitchVersion: async (pkg, version) => {
      const installations = ac.installationsMap.get(pkg);
      const installation = installations?.find((i) => i.version === version);
      if (!installation) return;
      const descriptor = ac.registry.list().find((p) => p.name === pkg);
      if (!descriptor) return;

      const all = await ac.introspector.introspect(descriptor, {
        dir: installation.dir,
        version: installation.version,
      });
      const whitelisted = applyWhitelist(all, descriptor);

      const selected = ac.store.getSelected();
      if (selected?.id.startsWith(`${pkg}#`)) {
        const updated = whitelisted.find((c) => c.id === selected.id);
        if (updated) {
          ac.propsPanel.postComponentSchema(updated, ac.store.getConfiguredProps(selected.id));
        }
      }

      const resolvedFilePath =
        vscode.window.activeTextEditor?.document.uri.fsPath ?? ac.lastKnownFilePath;
      const hasFileContext = !!resolvedFilePath;
      let inPackageJson = false;
      if (resolvedFilePath) {
        const nearestPkg = findNearestPackageJson(resolvedFilePath, ac.workspaceRoot);
        if (nearestPkg) {
          try {
            const json = JSON.parse(fs.readFileSync(nearestPkg, 'utf8')) as {
              dependencies?: Record<string, string>;
              devDependencies?: Record<string, string>;
            };
            inPackageJson = !!(json.dependencies?.[pkg] ?? json.devDependencies?.[pkg]);
          } catch {}
        }
      }
      ac.propsPanel.postVersionsAvailable(
        pkg,
        (installations ?? []).map((i) => i.version),
        version,
        false,
        inPackageJson,
        hasFileContext,
      );
    },
    onAddToPackageJson: async (pkg, version) => {
      const resolvedFilePath =
        vscode.window.activeTextEditor?.document.uri.fsPath ?? ac.lastKnownFilePath;
      if (!resolvedFilePath) {
        vscode.window.showWarningMessage('Snapds: No active editor to determine app location.');
        return;
      }
      const pkgJsonPath = findNearestPackageJson(resolvedFilePath, ac.workspaceRoot);
      if (!pkgJsonPath) {
        vscode.window.showWarningMessage(
          'Snapds: Could not find a package.json near the current file.',
        );
        return;
      }
      try {
        const content = fs.readFileSync(pkgJsonPath, 'utf8');
        const json = JSON.parse(content) as Record<string, unknown> & {
          dependencies?: Record<string, string>;
        };
        if (!json.dependencies) json.dependencies = {};
        json.dependencies[pkg] = `^${version}`;

        const indentMatch = content.match(/^([ \t]+)/m);
        const indent = indentMatch ? indentMatch[1] : '  ';
        fs.writeFileSync(pkgJsonPath, `${JSON.stringify(json, null, indent)}\n`, 'utf8');

        const relPath = ac.workspaceRoot
          ? path.relative(ac.workspaceRoot, pkgJsonPath)
          : path.basename(pkgJsonPath);
        vscode.window.showInformationMessage(
          `Snapds: Added ${pkg}@^${version} to ${relPath}. Run \`pnpm install\` to finish.`,
        );

        const installations = ac.installationsMap.get(pkg) ?? [];
        const resolved = resolveForFile(resolvedFilePath, pkg, installations);
        const active = resolved ?? latestInstallation(installations);
        if (active) {
          ac.propsPanel.postVersionsAvailable(
            pkg,
            installations.map((i) => i.version),
            active.version,
            !resolved,
            true,
            true,
          );
        }
      } catch (e) {
        vscode.window.showErrorMessage(
          `Snapds: Failed to update package.json: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    },
  });
}

// ─── setupGallery ─────────────────────────────────────────────────────────────

function setupGallery(ctx: vscode.ExtensionContext, ac: ActivationCtx): GalleryViewProvider {
  return new GalleryViewProvider(ctx, {
    onReady: async () => {
      ac.gallery.postComponentList(ac.store.listComponents());
    },
    onSearch: (_query) => {
      // Filtering happens in the webview; reserved for future server-side filtering.
    },
    onSelect: async (componentId) => {
      const meta = ac.store.getComponent(componentId);
      if (!meta) return;
      ac.store.select(componentId);
      ac.propsPanel.postComponentSchema(meta, ac.store.getConfiguredProps(componentId));
      notifyVersions(vscode.window.activeTextEditor?.document.uri.fsPath, ac);
    },
  });
}

// ─── setupSettingsPanel ───────────────────────────────────────────────────────

function setupSettingsPanel(
  ctx: vscode.ExtensionContext,
  ac: ActivationCtx,
): SettingsPanelProvider {
  const onGenerateSkills = async () => {
    try {
      const components = await collectComponents(ac);
      await runGenerateSkills(components);
      await ctx.globalState.update(
        GENERATED_IDS_KEY,
        components.map((c) => c.id),
      );
      ac.settingsPanel.postSkillsGenerated(true);
    } catch (e) {
      vscode.window.showErrorMessage(
        `Snapds: failed to generate skills: ${e instanceof Error ? e.message : String(e)}`,
      );
      ac.settingsPanel.postSkillsGenerated(false);
    }
  };

  return new SettingsPanelProvider(ctx, {
    onGenerateSkills,
    onReady: async () => {
      ac.settingsPanel.postPackageList(await buildPackageList(ac));
      ac.settingsPanel.postSkillsConfig(getSkillsConfig());
      ac.settingsPanel.postScopeFilters(
        ctx.workspaceState.get<string[]>('snapds.scopeFilters') ?? [],
      );
      ac.settingsPanel.postConfigStatus(detectConfigConflict(ac.registry, ctx));
    },
    onRequestComponents: async (pkgName) => {
      const existing = ac.registry.list().find((p) => p.name === pkgName);
      const descriptor = existing ?? (await ac.registry.resolveDescriptor(pkgName));
      if (!descriptor) {
        vscode.window.showWarningMessage(`Snapds: could not locate "${pkgName}" in node_modules.`);
        ac.settingsPanel.postComponentNames(pkgName, []);
        return;
      }
      const cached = ac.introspector.getCached(descriptor);
      if (cached) {
        ac.settingsPanel.postComponentNames(
          pkgName,
          cached.map((c) => c.name),
        );
        return;
      }
      try {
        let all: ComponentMeta[] = [];
        await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Window, title: 'Snapds', cancellable: false },
          async (progress) => {
            progress.report({ message: `Indexing ${pkgName}…` });
            all = await ac.introspector.introspect(descriptor);
          },
        );
        ac.settingsPanel.postComponentNames(
          pkgName,
          all.map((c) => c.name),
        );
      } catch (e) {
        vscode.window.showErrorMessage(
          `Failed to introspect ${pkgName}: ${e instanceof Error ? e.message : String(e)}`,
        );
        ac.settingsPanel.postComponentNames(pkgName, []);
      }
    },
    onReloadPackage: async (pkgName) => {
      const existing = ac.registry.list().find((p) => p.name === pkgName);
      const descriptor = existing ?? (await ac.registry.resolveDescriptor(pkgName));
      if (!descriptor) {
        ac.settingsPanel.postComponentNames(pkgName, []);
        return;
      }
      await ac.introspector.invalidate(descriptor);
      try {
        let all: ComponentMeta[] = [];
        await vscode.window.withProgress(
          { location: vscode.ProgressLocation.Window, title: 'Snapds', cancellable: false },
          async (progress) => {
            progress.report({ message: `Reloading ${pkgName}…` });
            all = await ac.introspector.introspect(descriptor);
          },
        );
        ac.settingsPanel.postComponentNames(
          pkgName,
          all.map((c) => c.name),
        );
      } catch (e) {
        vscode.window.showErrorMessage(
          `Snapds: failed to reload "${pkgName}": ${e instanceof Error ? e.message : String(e)}`,
        );
        ac.settingsPanel.postComponentNames(pkgName, []);
      }
    },
    onPickCustomPath: async () => {
      const picked = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectFiles: false,
        canSelectMany: false,
        openLabel: 'Select skills destination folder',
      });
      if (picked?.length) {
        ac.settingsPanel.postCustomPathPicked(picked[0].fsPath);
      }
    },
    onSaveSkillsConfig: async (config) => {
      await setSkillsConfig(config);
      ac.settingsPanel.postSkillsConfig(getSkillsConfig());
    },
    onListSkills: () => {
      ac.settingsPanel.postSkillsList(listSkillFiles(getSkillsConfig()));
    },
    onOpenSkill: async (skillPath) => {
      await vscode.window.showTextDocument(vscode.Uri.file(skillPath));
    },
    onRegenerateAllSkills: async () => {
      try {
        await regenerateAll(ac);
        ac.settingsPanel.postSkillsList(listSkillFiles(getSkillsConfig()));
      } finally {
        ac.settingsPanel.postSaved();
      }
    },
    onRequestComponentDetail: async ({ pkg, component }) => {
      const existing = ac.registry.list().find((p) => p.name === pkg);
      const descriptor = existing ?? (await ac.registry.resolveDescriptor(pkg));
      if (!descriptor) {
        ac.settingsPanel.postComponentDetail({ pkg, component, props: [], skillFiles: [] });
        return;
      }
      const all = await ac.introspector.introspect(descriptor);
      const meta = all.find((c) => c.name === component);
      const files = listComponentSkillFiles(all, meta, getSkillsConfig());
      ac.settingsPanel.postComponentDetail({
        pkg,
        component,
        description: meta?.description,
        props: meta?.props ?? [],
        snippet: meta?.snippet,
        companyOverride: ac.introspector.getCompanyOverride(pkg, component),
        userOverride: ac.userOverrides.get(pkg, component),
        skillFiles: files,
      });
    },
    onRequestUserOverrides: () => {
      ac.settingsPanel.postUserOverrides(ac.userOverrides.all());
    },
    onSetScopeFilters: async (filters) => {
      await ctx.workspaceState.update(
        'snapds.scopeFilters',
        filters.length > 0 ? filters : undefined,
      );
    },
    onSaveUserOverride: async ({ pkg, component, override }) => {
      await ac.userOverrides.set(pkg, component, override);
      await reintrospectAndBroadcast(pkg, ac);
    },
    onResetUserOverride: async ({ pkg, component }) => {
      await ac.userOverrides.reset(pkg, component);
      await reintrospectAndBroadcast(pkg, ac);
    },
    onRequestConfigStatus: () => {
      ac.settingsPanel.postConfigStatus(detectConfigConflict(ac.registry, ctx));
    },
    onExportConfig: async ({ includeOverrides, mode, outputPath, packageSelections }) => {
      const filePath = outputPath ?? defaultConfigPath();
      if (!filePath) {
        vscode.window.showWarningMessage('Snapds: No workspace folder open.');
        return;
      }
      if (ac.workspaceRoot && outputPath) {
        const normalizedRoot = path.resolve(ac.workspaceRoot);
        const normalizedOut = path.resolve(outputPath);
        if (!normalizedOut.startsWith(normalizedRoot + path.sep)) {
          vscode.window.showErrorMessage(
            'Snapds: Export path must be within the workspace folder.',
          );
          return;
        }
      }
      const config = serializeCurrentState(ac.registry.list(), ac.userOverrides.all(), ctx, {
        includeUserOverrides: includeOverrides,
        mode,
        packageSelections,
      });
      try {
        await writeConfigFile(config, filePath, mode);
        ac.settingsPanel.postConfigExported(filePath);
        const rel = ac.workspaceRoot ? path.relative(ac.workspaceRoot, filePath) : filePath;
        const action = await vscode.window.showInformationMessage(
          `Snapds: config exported to ${rel}.`,
          'Open file',
        );
        if (action === 'Open file') {
          await vscode.window.showTextDocument(vscode.Uri.file(filePath));
        }
      } catch (e) {
        vscode.window.showErrorMessage(
          `Snapds: failed to write config: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    },
    onImportConfig: async (filePath) => {
      let resolved: Awaited<ReturnType<typeof resolveConfig>>;

      if (filePath) {
        const fs_ = await import('node:fs');
        if (!fs_.existsSync(filePath)) {
          const picked = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: { 'JSON config': ['json'] },
            openLabel: 'Select snapds.config.json',
          });
          if (!picked?.length) return;
          filePath = picked[0].fsPath;
        }
        const configImporter = await import('./config/configResolver');
        const raw = configImporter.resolveConfig(path.dirname(filePath), path.dirname(filePath));
        resolved = raw;
      } else {
        resolved = resolveConfig(ac.workspaceRoot ?? '');
      }

      if (!resolved) {
        vscode.window.showWarningMessage('Snapds: No config file found.');
        return;
      }

      ac.pendingImport = { config: resolved.config, configPath: resolved.owningPath };
      const summary = previewImport(resolved.config, ac.registry, ctx);
      ac.settingsPanel.postConfigImportPreview({
        ...summary,
        configPath: resolved.owningPath,
      });
    },
    onConfirmImportConfig: async (applyOverrides) => {
      if (!ac.pendingImport) return;
      try {
        await applyConfig(ac.pendingImport.config, ac.registry, ac.userOverrides, ctx, {
          applyOverrides,
        });
        ac.pendingImport = undefined;

        const list = ac.registry.list();
        await Promise.all(list.map((pkg) => refreshActiveComponents(pkg, ac)));
        ac.settingsPanel.postPackageList(await buildPackageList(ac));
        ac.settingsPanel.postSkillsConfig(getSkillsConfig());
        ac.settingsPanel.postScopeFilters(
          ctx.workspaceState.get<string[]>('snapds.scopeFilters') ?? [],
        );
        ac.settingsPanel.postConfigStatus(detectConfigConflict(ac.registry, ctx));
        vscode.window.showInformationMessage('Snapds: config loaded successfully.');
      } catch (e) {
        vscode.window.showErrorMessage(
          `Snapds: failed to apply config: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    },
    onSavePackages: async (packages) => {
      ac.settingsPanel.postSaving();

      try {
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Updating Snapds Packages...',
            cancellable: false,
          },
          async (progress) => {
            const oldList = ac.registry.list();
            const oldByName = new Map(oldList.map((p) => [p.name, p]));
            const enabledNames = new Set(packages.map((p) => p.name));

            progress.report({ message: 'Saving…' });

            const resolved = await Promise.all(
              packages.map(async (pkg) => {
                const existing = oldByName.get(pkg.name);
                let version = existing?.version ?? 'unknown';
                const importPath = existing?.importPath ?? pkg.name;
                let tsconfigPath = existing?.tsconfigPath;

                if (!existing) {
                  const descriptor = await ac.registry.resolveDescriptor(pkg.name);
                  if (descriptor) {
                    version = descriptor.version;
                    tsconfigPath = descriptor.tsconfigPath;
                  }
                }

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
                const manual = selected.filter((c) => !pkg.components?.includes(c));
                return { name: pkg.name, version, importPath, tsconfigPath, excluded, manual };
              }),
            );

            const finalList = resolved.filter((p) => enabledNames.has(p.name));
            await ac.registry.saveAll(finalList);

            const activePackages = ac.registry.list();

            progress.report({
              message: `Loading ${activePackages.length} package${activePackages.length > 1 ? 's' : ''}…`,
            });

            const results = await Promise.all(
              activePackages.map(async (pkg) => {
                try {
                  const detected = await ac.introspector.introspect(pkg);
                  return applyWhitelist(detected, pkg);
                } catch (e) {
                  vscode.window.showErrorMessage(
                    `Failed to introspect ${pkg.name}: ${e instanceof Error ? e.message : String(e)}`,
                  );
                  return [] as ComponentMeta[];
                }
              }),
            );
            const allComponents = results.flat();

            ac.store.setComponents(allComponents);
            ac.gallery.postComponentList(allComponents);
            await autoGenerateForNew(allComponents, ac);
          },
        );

        ac.settingsPanel.postPackageList(await buildPackageList(ac));
        void afterDiscovery(ac);
      } finally {
        ac.settingsPanel.postSaved();
      }
    },
  });
}

// ─── setupCommands ────────────────────────────────────────────────────────────

function setupCommands(ctx: vscode.ExtensionContext, ac: ActivationCtx): void {
  const onGenerateSkills = async () => {
    try {
      const components = await collectComponents(ac);
      await runGenerateSkills(components);
      await ctx.globalState.update(
        GENERATED_IDS_KEY,
        components.map((c) => c.id),
      );
      ac.settingsPanel.postSkillsGenerated(true);
    } catch (e) {
      vscode.window.showErrorMessage(
        `Snapds: failed to generate skills: ${e instanceof Error ? e.message : String(e)}`,
      );
      ac.settingsPanel.postSkillsGenerated(false);
    }
  };

  ctx.subscriptions.push(
    vscode.commands.registerCommand('snapds.openSettings', () => {
      ac.settingsPanel.show();
    }),

    vscode.commands.registerCommand('snapds.openPropsPanel', () => {
      ac.propsPanel.show();
    }),

    vscode.commands.registerCommand('snapds.generateSkills', onGenerateSkills),

    vscode.commands.registerCommand('snapds.regenerateSkills', () => regenerateAll(ac)),

    vscode.commands.registerCommand('snapds.clearCache', () => clearIntrospectionCache(ac)),

    vscode.commands.registerCommand('snapds.reindex', () => reindexInBackground(ac)),

    vscode.commands.registerCommand('snapds.diagnostics', async () => {
      const overrides = ac.userOverrides.all();
      const out = vscode.window.createOutputChannel('Snapds Diagnostics');
      out.clear();
      out.appendLine('=== User Overrides (workspaceState) ===');
      out.appendLine(JSON.stringify(overrides, null, 2));
      out.appendLine('');
      out.appendLine('=== Registered packages ===');
      for (const pkg of ac.registry.list()) {
        const cached = ac.introspector.getCached(pkg);
        out.appendLine(
          `${pkg.name}@${pkg.version}: ${cached ? `${cached.length} components cached` : 'not cached'}`,
        );
        if (cached) {
          for (const c of cached) {
            out.appendLine(
              `  ${c.name}: ${c.props.length} props${c.standardPropsOnly ? ' (DOM only)' : ''}`,
            );
          }
        }
      }
      out.appendLine('');
      out.appendLine('=== Raw parse (no propFilter) for @starlight/buttons ===');
      try {
        const docgen = await import('react-docgen-typescript');
        const fs = await import('node:fs');
        const path = await import('node:path');
        const pkg = ac.registry.list().find((p) => p.name === '@starlight/buttons');
        if (pkg) {
          const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? '';
          let pkgDir = '';
          let dir = folder;
          while (true) {
            const candidate = path.join(dir, 'node_modules', pkg.name);
            if (fs.existsSync(candidate)) {
              pkgDir = candidate;
              break;
            }
            const parent = path.dirname(dir);
            if (parent === dir) break;
            dir = parent;
          }
          if (!pkgDir) {
            try {
              const uris = await vscode.workspace.findFiles(
                `**/node_modules/${pkg.name}/package.json`,
                null,
                1,
              );
              if (uris.length > 0) pkgDir = path.dirname(uris[0].fsPath);
            } catch {}
          }
          if (pkgDir) {
            const parser = docgen.withDefaultConfig({
              savePropValueAsString: false,
              shouldExtractLiteralValuesFromEnum: true,
              shouldRemoveUndefinedFromOptional: true,
              propFilter: (prop) => {
                out.appendLine(
                  `  prop: ${prop.name} | parent: ${prop.parent?.fileName ?? '(none)'}`,
                );
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
}

// ─── Startup flow ─────────────────────────────────────────────────────────────

function runStartupFlow(ctx: vscode.ExtensionContext, ac: ActivationCtx): void {
  // Show a one-time notification when a config file differs from current settings.
  void (async () => {
    const conflict = detectConfigConflict(ac.registry, ctx);
    if (!conflict.detected || !conflict.hasConflicts) return;
    const notifKey = `${CONFIG_NOTIFIED_PREFIX}${ac.workspaceRoot ?? 'default'}`;
    const alreadyShown = ctx.globalState.get<boolean>(notifKey) ?? false;
    if (alreadyShown) return;
    await ctx.globalState.update(notifKey, true);
    const action = await vscode.window.showInformationMessage(
      'Snapds: a config file was found that differs from your current settings.',
      'Open Settings',
      'Dismiss',
    );
    if (action === 'Open Settings') {
      ac.settingsPanel.show();
    }
  })();

  void (async () => {
    const list = ac.registry.list();
    if (list.length === 0) return;

    const cold = list.filter((p) => !ac.introspector.getCached(p));
    if (cold.length === 0) {
      await Promise.all(list.map((pkg) => refreshActiveComponents(pkg, ac)));
      ac.settingsPanel.postPackageList(await buildPackageList(ac));
      void afterDiscovery(ac);
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
            await refreshActiveComponents(pkg, ac);
            done++;
            progress.report({
              message: `${done} / ${list.length} — ${pkg.name}`,
              increment: (1 / list.length) * 100,
            });
          }),
        );
        ac.settingsPanel.postPackageList(await buildPackageList(ac));
        totalComponents = ac.store.listComponents().length;
      },
    );
    vscode.window.showInformationMessage(
      `Snapds: indexed ${list.length} package${list.length > 1 ? 's' : ''} — ${totalComponents} component${totalComponents !== 1 ? 's' : ''} ready.`,
    );
    void afterDiscovery(ac);
  })();
}

// ─── Helper utilities ────────────────────────────────────────────────────────

/** Looks up the right installation for the focused file and notifies the props panel. */
function notifyVersions(filePath: string | undefined, ac: ActivationCtx): void {
  if (!ac.propsPanel.isOpen()) return;
  const selected = ac.store.getSelected();
  if (!selected) return;
  const pkgName = selected.id.split('#')[0];
  const installations = ac.installationsMap.get(pkgName) ?? [];

  const resolvedFilePath = filePath || ac.lastKnownFilePath;
  const hasFileContext = !!resolvedFilePath;

  if (installations.length === 0) {
    ac.propsPanel.postVersionsAvailable(pkgName, [], '', false, false, hasFileContext);
    return;
  }

  const resolved = resolvedFilePath
    ? resolveForFile(resolvedFilePath, pkgName, installations)
    : undefined;
  // biome-ignore lint/style/noNonNullAssertion: installations.length === 0 is guarded above
  const active = resolved ?? latestInstallation(installations)!;
  const isAutoResolved = !resolved;

  const resolvedFrom =
    resolved && ac.workspaceRoot
      ? path.relative(ac.workspaceRoot, resolved.appRoot) || '.'
      : undefined;

  let inPackageJson = false;
  if (resolvedFilePath) {
    const nearestPkg = findNearestPackageJson(resolvedFilePath, ac.workspaceRoot);
    if (nearestPkg) {
      try {
        const json = JSON.parse(fs.readFileSync(nearestPkg, 'utf8')) as {
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
          peerDependencies?: Record<string, string>;
        };
        inPackageJson = !!(
          json.dependencies?.[pkgName] ??
          json.devDependencies?.[pkgName] ??
          json.peerDependencies?.[pkgName]
        );
      } catch {}
    }
  }

  ac.propsPanel.postVersionsAvailable(
    pkgName,
    installations.map((i) => i.version),
    active.version,
    isAutoResolved,
    inPackageJson,
    hasFileContext,
    resolvedFrom,
  );
}

async function discoverAllInstallations(ac: ActivationCtx): Promise<void> {
  await Promise.all(
    ac.registry.list().map(async (pkg) => {
      const found = await discoverInstallations(pkg.name);
      if (found.length > 0) ac.installationsMap.set(pkg.name, found);
    }),
  );
}

/**
 * Pre-introspects every discovered installation of every registered package
 * so switching versions in the props panel hits a warm cache.
 */
async function preIndexAllVersions(ac: ActivationCtx): Promise<void> {
  const tasks: Promise<void>[] = [];
  for (const [pkgName, installations] of ac.installationsMap) {
    const descriptor = ac.registry.list().find((p) => p.name === pkgName);
    if (!descriptor) continue;
    for (const installation of installations) {
      tasks.push(
        ac.introspector
          .introspect(descriptor, { dir: installation.dir, version: installation.version })
          .catch(() => {}),
      );
    }
  }
  await Promise.all(tasks);
}

/**
 * Discovers all installations, notifies the props panel immediately, then
 * pre-indexes alternate versions in the background (fire-and-forget).
 */
async function afterDiscovery(ac: ActivationCtx): Promise<void> {
  await discoverAllInstallations(ac);
  notifyVersions(vscode.window.activeTextEditor?.document.uri.fsPath, ac);
  void preIndexAllVersions(ac);
}

async function buildPackageList(ac: ActivationCtx): Promise<PackageMeta[]> {
  const allPkgs = await ac.registry.discoverAllPackagesInWorkspace();
  const currentList = ac.registry.list();
  return allPkgs.map((name) => {
    const pkg = currentList.find((p) => p.name === name);
    const cached = pkg ? ac.introspector.getCached(pkg) : undefined;
    return {
      name,
      enabled: !!pkg,
      components: cached?.map((c) => c.name),
      excluded: pkg?.excluded ?? [],
      manual: pkg?.manual ?? [],
    };
  });
}

async function collectWhitelistedComponents(ac: ActivationCtx): Promise<ComponentMeta[]> {
  const out: ComponentMeta[] = [];
  for (const pkg of ac.registry.list()) {
    try {
      const detected = await ac.introspector.introspect(pkg);
      out.push(...applyWhitelist(detected, pkg));
    } catch (e) {
      vscode.window.showErrorMessage(
        `Failed to introspect ${pkg.name}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
  return out;
}

async function collectComponents(ac: ActivationCtx): Promise<ComponentMeta[]> {
  const existing = ac.store.listComponents();
  if (existing.length) return existing;
  return collectWhitelistedComponents(ac);
}

/** Generates skills incrementally for components not yet generated. */
async function autoGenerateForNew(all: ComponentMeta[], ac: ActivationCtx): Promise<void> {
  const cfg = getSkillsConfig();
  if (!cfg.enabled || !cfg.autoGenerate) return;
  const prev = new Set(ac.vsctx.globalState.get<string[]>(GENERATED_IDS_KEY) ?? []);
  const changedIds = new Set(all.filter((c) => !prev.has(c.id)).map((c) => c.id));
  if (!changedIds.size) return;
  await generateSkillsToConfig(all, cfg, { mode: 'incremental', changedIds });
  await ac.vsctx.globalState.update(
    GENERATED_IDS_KEY,
    all.map((c) => c.id),
  );
}

async function reindexInBackground(ac: ActivationCtx): Promise<void> {
  const list = ac.registry.list();
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
          await refreshActiveComponents(pkg, ac);
          done++;
          progress.report({
            message: `${done} / ${list.length} — ${pkg.name}`,
            increment: (1 / list.length) * 100,
          });
        }),
      );
      ac.settingsPanel.postPackageList(await buildPackageList(ac));
    },
  );
  vscode.window.showInformationMessage('Snapds: Packages re-indexed.');
}

async function clearIntrospectionCache(ac: ActivationCtx): Promise<void> {
  const cleared = await ac.introspector.clearCache();
  const list = ac.registry.list();
  await vscode.window.withProgress(
    { location: vscode.ProgressLocation.Window, title: 'Snapds' },
    async (progress) => {
      let done = 0;
      progress.report({
        message: `Re-indexing ${list.length} package${list.length > 1 ? 's' : ''}…`,
      });
      await Promise.all(
        list.map(async (pkg) => {
          await refreshActiveComponents(pkg, ac);
          done++;
          progress.report({ message: `${pkg.name} (${done}/${list.length})` });
        }),
      );
      ac.settingsPanel.postPackageList(await buildPackageList(ac));
    },
  );
  vscode.window.showInformationMessage(
    `Snapds: cleared ${cleared} cached introspection entr${cleared === 1 ? 'y' : 'ies'} and refreshed.`,
  );
}

async function regenerateAll(ac: ActivationCtx): Promise<void> {
  const cfg = getSkillsConfig();
  const all = await collectWhitelistedComponents(ac);
  const n = await generateSkillsToConfig(all, cfg, { mode: 'full' });
  await ac.vsctx.globalState.update(
    GENERATED_IDS_KEY,
    all.map((c) => c.id),
  );
  vscode.window.showInformationMessage(`Snapds: regenerated ${n} skill file${n === 1 ? '' : 's'}.`);
}

/**
 * Re-emits merged component metadata after a user override change.
 * The parse cache is untouched; this only rebuilds the store + gallery
 * and refreshes the live props preview when relevant.
 */
async function reintrospectAndBroadcast(pkgName: string, ac: ActivationCtx): Promise<void> {
  const existing = ac.registry.list().find((p) => p.name === pkgName);
  const descriptor = existing ?? (await ac.registry.resolveDescriptor(pkgName));
  if (!descriptor) return;
  await refreshActiveComponents(descriptor, ac);
  const sel = ac.store.getSelected();
  if (sel?.id.startsWith(`${pkgName}#`) && ac.propsPanel.isOpen()) {
    ac.propsPanel.postComponentSchema(sel, ac.store.getConfiguredProps(sel.id));
  }
}

async function refreshActiveComponents(pkg: DsPackage, ac: ActivationCtx): Promise<void> {
  try {
    const detected = await ac.introspector.introspect(pkg);
    const whitelisted = applyWhitelist(detected, pkg);
    const existing = ac.store.listComponents();
    const filtered = existing.filter((c) => !c.id.startsWith(`${pkg.name}#`));
    const combined = [...filtered, ...whitelisted];
    ac.store.setComponents(combined);
    ac.gallery.postComponentList(combined);
  } catch (e) {
    vscode.window.showErrorMessage(
      `Failed to introspect ${pkg.name}: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}
