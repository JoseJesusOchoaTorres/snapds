import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { registerQuickSearch } from './commands/quickSearch';
import { detectImportLines, isSnippetLanguage, resultToSnippet } from './commands/saveSnippet';
import { applyConfig, detectConfigConflict, previewImport } from './config/configImporter';
import { resolveConfig } from './config/configResolver';
import type { SnapdsConfig } from './config/configSchema';
import {
  defaultConfigPath,
  serializeCurrentState,
  writeConfigFile,
} from './config/configSerializer';
import {
  mergeSnippets,
  readSharedSnippets,
  removeSharedSnippet,
  upsertSharedSnippet,
} from './config/sharedSnippets';
import { emitImport } from './ds/codegen';
import { DsIntrospector } from './ds/dsIntrospector';
import { applyWhitelist, type DsPackage, DsRegistry } from './ds/dsRegistry';
import {
  buildLocalSourceFromFolder,
  detectLocalSources,
  mergeLocalSources,
} from './ds/localSources';
import {
  generateSkillsToConfig,
  getSkillsConfig,
  listComponentSkillFiles,
  listSkillFiles,
  runGenerateSkills,
  setSkillsConfig,
} from './ds/skillWriter';
import { extractSvgMarkup } from './ds/svgPreview';
import {
  discoverInstallations,
  findNearestPackageJson,
  latestInstallation,
  type PackageInstallation,
  resolveForFile,
} from './ds/versionResolver';
import { registerDropProvider } from './providers/dropProvider';
import { categoryOf, normalizeCategory, SnippetStore, UNCATEGORIZED } from './state/snippetStore';
import { Store } from './state/store';
import { UserOverridesStore } from './state/userOverrides';
import type {
  ComponentMeta,
  CustomSnippet,
  PackageMeta,
  SnippetDraft,
  SnippetSaveResult,
} from './util/messaging';
import { GalleryViewProvider } from './views/galleryViewProvider';
import { PropsPanelProvider } from './views/propsPanelProvider';
import { SettingsPanelProvider } from './views/settingsPanelProvider';
import { SnippetEditorProvider } from './views/snippetEditorProvider';

const GENERATED_IDS_KEY = 'snapds.skills.generatedIds';
const CONFIG_HASH_PREFIX = 'snapds.configHash.';

// ─── Shared activation context ────────────────────────────────────────────────

interface ActivationCtx {
  vsctx: vscode.ExtensionContext;
  registry: DsRegistry;
  userOverrides: UserOverridesStore;
  introspector: DsIntrospector;
  store: Store;
  /** User-local custom snippets (workspaceState); shared ones live in config. */
  snippetStore: SnippetStore;
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
  snippetEditor: SnippetEditorProvider;
}

// ─── activate() ───────────────────────────────────────────────────────────────

export function activate(ctx: vscode.ExtensionContext): void {
  const registry = new DsRegistry();
  const userOverrides = new UserOverridesStore(ctx);
  const introspector = new DsIntrospector(ctx, userOverrides);
  const store = new Store();
  const snippetStore = new SnippetStore(ctx);

  const ac = {
    vsctx: ctx,
    registry,
    userOverrides,
    introspector,
    store,
    snippetStore,
    installationsMap: new Map<string, PackageInstallation[]>(),
    workspaceRoot: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
    lastKnownFilePath: undefined,
    pendingImport: undefined,
  } as unknown as ActivationCtx;

  ac.propsPanel = setupPropsPanel(ctx, ac);
  ac.gallery = setupGallery(ctx, ac);
  ac.settingsPanel = setupSettingsPanel(ctx, ac);
  ac.snippetEditor = setupSnippetEditor(ctx, ac);

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

  registerDropProvider(ctx, store, (id) => getSnippet(ac, id));
  registerQuickSearch(ctx, store, {
    list: () => listSnippets(ac),
    get: (id) => getSnippet(ac, id),
  });
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
        ac.propsPanel.postComponentSchema(
          sel,
          ac.store.getConfiguredProps(sel.id),
          computeSvgPreview(sel),
        );
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
          ac.propsPanel.postComponentSchema(
            updated,
            ac.store.getConfiguredProps(selected.id),
            computeSvgPreview(updated),
          );
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
      ac.gallery.postSnippetList(listSnippets(ac));
    },
    onSearch: (_query) => {
      // Filtering happens in the webview; reserved for future server-side filtering.
    },
    onSelect: async (componentId) => {
      const meta = ac.store.getComponent(componentId);
      if (!meta) return;
      ac.store.select(componentId);
      ac.propsPanel.postComponentSchema(
        meta,
        ac.store.getConfiguredProps(componentId),
        computeSvgPreview(meta),
      );
      notifyVersions(vscode.window.activeTextEditor?.document.uri.fsPath, ac);
    },
    onSnippetSelect: () => {
      // Selection is a client-side highlight; snippets have no props panel.
    },
    onEditSnippet: (snippetId) => openSnippetEditorForEdit(ac, snippetId),
    onDeleteSnippet: (snippetId) => deleteSnippet(ac, snippetId),
  });
}

// ─── setupSnippetEditor ───────────────────────────────────────────────────────

function setupSnippetEditor(
  ctx: vscode.ExtensionContext,
  ac: ActivationCtx,
): SnippetEditorProvider {
  return new SnippetEditorProvider(ctx, {
    onSave: (result) => persistSnippetResult(ac, result),
  });
}

// ─── Custom snippets: read/list/persist ───────────────────────────────────────

/** Shared snippets currently on disk (resolved config), tagged `scope:'shared'`. */
function sharedSnippets(ac: ActivationCtx): CustomSnippet[] {
  const config = ac.workspaceRoot ? resolveConfig(ac.workspaceRoot)?.config : undefined;
  return readSharedSnippets(config);
}

/** The merged local + shared snippet list the gallery and quick search render. */
function listSnippets(ac: ActivationCtx): CustomSnippet[] {
  return mergeSnippets(ac.snippetStore.all(), sharedSnippets(ac));
}

function getSnippet(ac: ActivationCtx, id: string): CustomSnippet | undefined {
  return listSnippets(ac).find((s) => s.id === id);
}

/** Re-pushes the current snippet list to the gallery AND settings after a change. */
function refreshSnippets(ac: ActivationCtx): void {
  const list = listSnippets(ac);
  ac.gallery.postSnippetList(list);
  ac.settingsPanel.postSnippetList(list);
}

/** Absolute path of the config file shared snippets are written to. */
function sharedConfigPath(ac: ActivationCtx): string | undefined {
  return ac.workspaceRoot
    ? (resolveConfig(ac.workspaceRoot)?.owningPath ?? defaultConfigPath())
    : undefined;
}

/**
 * Parses the owning config file directly (no `extends` resolution) for shared
 * snippet WRITES — so we edit only that file's own snippets and never copy
 * extends-inherited ones down into it. Reads/listing still use the resolved config.
 *
 * Returns `{}` only when the file does not exist (ENOENT). Any other I/O error
 * or a JSON parse failure is re-thrown so the caller aborts instead of
 * silently overwriting the file with an empty config.
 */
function readRawConfig(filePath: string): SnapdsConfig {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw err;
  }
  // Separate from the read so a SyntaxError propagates to the caller
  // rather than silently returning {}, which would overwrite the file.
  return JSON.parse(raw) as SnapdsConfig;
}

/**
 * Persists a snippet from the capture/edit modal. Routes it to the right store
 * based on `scope`, moving it between tiers when the scope changed on edit.
 */
async function persistSnippetResult(ac: ActivationCtx, result: SnippetSaveResult): Promise<void> {
  const previous = result.id ? getSnippet(ac, result.id) : undefined;
  const snippet = resultToSnippet(result, {
    languageId: previous?.languageId ?? activeLanguageId() ?? 'typescriptreact',
    createdAt: previous?.createdAt ?? new Date().toISOString(),
  });

  // Remove any prior copy from the tier it used to live in (handles scope flips).
  if (previous) await removeSnippetFromStores(ac, previous);

  if (snippet.scope === 'shared') {
    const ok = await writeSharedSnippet(ac, snippet);
    if (!ok) {
      // No workspace/config to share into — fall back to local so work isn't lost.
      await ac.snippetStore.save(snippet);
      vscode.window.showWarningMessage(
        'Snapds: No workspace config found — saved the snippet privately instead.',
      );
    }
  } else {
    await ac.snippetStore.save(snippet);
  }

  refreshSnippets(ac);
}

/** Writes/updates a shared snippet in snapds.config.json. Returns false if none exists. */
async function writeSharedSnippet(ac: ActivationCtx, snippet: CustomSnippet): Promise<boolean> {
  const filePath = sharedConfigPath(ac);
  if (!filePath) return false;
  let raw: SnapdsConfig;
  try {
    raw = readRawConfig(filePath);
  } catch {
    vscode.window.showErrorMessage(
      'Snapds: snapds.config.json contains invalid JSON — fix it before saving snippets.',
    );
    return false;
  }
  const next = upsertSharedSnippet(raw, snippet);
  // 'replace': `next` is the full owning file with customSnippets set exactly, so
  // this writes the authoritative list (a merge can't express a removal-to-empty).
  await writeConfigFile(next, filePath, 'replace');
  return true;
}

/** Removes a snippet from whichever tier holds it. */
async function removeSnippetFromStores(ac: ActivationCtx, snippet: CustomSnippet): Promise<void> {
  if (ac.snippetStore.get(snippet.id)) await ac.snippetStore.remove(snippet.id);
  const filePath = sharedConfigPath(ac);
  if (!filePath) return;
  let raw: SnapdsConfig;
  try {
    raw = readRawConfig(filePath);
  } catch {
    vscode.window.showErrorMessage(
      'Snapds: snapds.config.json contains invalid JSON — fix it to remove shared snippets.',
    );
    return;
  }
  if (raw.customSnippets?.some((s) => s.id === snippet.id)) {
    await writeConfigFile(removeSharedSnippet(raw, snippet.id), filePath, 'replace');
  }
}

async function deleteSnippet(ac: ActivationCtx, snippetId: string): Promise<void> {
  const snippet = getSnippet(ac, snippetId);
  if (!snippet) return;
  const choice = await vscode.window.showWarningMessage(
    `Delete snippet "${snippet.name}"?`,
    { modal: true },
    'Delete',
  );
  if (choice !== 'Delete') return;
  await removeSnippetFromStores(ac, snippet);
  refreshSnippets(ac);
}

/** Moves a snippet between the private (workspaceState) and shared (config) tiers. */
async function setSnippetScope(
  ac: ActivationCtx,
  snippetId: string,
  scope: 'local' | 'shared',
): Promise<void> {
  const snippet = getSnippet(ac, snippetId);
  if (!snippet || snippet.scope === scope) return;
  await removeSnippetFromStores(ac, snippet);
  const moved = { ...snippet, scope };
  if (scope === 'shared') {
    const ok = await writeSharedSnippet(ac, moved);
    if (!ok) {
      await ac.snippetStore.save(moved);
      vscode.window.showWarningMessage(
        'Snapds: No workspace config found — kept the snippet private.',
      );
    }
  } else {
    await ac.snippetStore.save(moved);
  }
  refreshSnippets(ac);
}

/**
 * Renames (or merges) a category across BOTH tiers. Passing an empty/uncategorized
 * `to` moves the category's snippets to the reserved Uncategorized bucket.
 */
async function renameSnippetCategory(ac: ActivationCtx, from: string, to: string): Promise<void> {
  const next = normalizeCategory(to);
  await ac.snippetStore.renameCategory(from, next);

  const filePath = sharedConfigPath(ac);
  if (filePath) {
    let raw: SnapdsConfig;
    try {
      raw = readRawConfig(filePath);
    } catch {
      vscode.window.showErrorMessage(
        'Snapds: snapds.config.json contains invalid JSON — fix it to rename categories.',
      );
      return;
    }
    if (raw.customSnippets?.length) {
      const fromKey = normalizeCategory(from) ?? UNCATEGORIZED;
      const updated = raw.customSnippets.map((s) =>
        (normalizeCategory(s.category) ?? UNCATEGORIZED) === fromKey ? { ...s, category: next } : s,
      );
      await writeConfigFile({ ...raw, customSnippets: updated }, filePath, 'replace');
    }
  }
  refreshSnippets(ac);
}

/** Moves a single snippet to a different category, in whichever tier it lives. */
async function recategorizeSnippet(
  ac: ActivationCtx,
  snippetId: string,
  category: string,
): Promise<void> {
  const snippet = getSnippet(ac, snippetId);
  if (!snippet) return;
  const cat = normalizeCategory(category);
  if (categoryOf(snippet) === (cat ?? UNCATEGORIZED)) return;

  if (snippet.scope === 'shared') {
    const filePath = sharedConfigPath(ac);
    if (filePath) {
      let raw: SnapdsConfig;
      try {
        raw = readRawConfig(filePath);
      } catch {
        vscode.window.showErrorMessage(
          'Snapds: snapds.config.json contains invalid JSON — fix it to move snippets.',
        );
        return;
      }
      const updated = (raw.customSnippets ?? []).map((s) =>
        s.id === snippetId ? { ...s, category: cat } : s,
      );
      await writeConfigFile({ ...raw, customSnippets: updated }, filePath, 'replace');
    }
  } else {
    await ac.snippetStore.recategorize(snippetId, cat);
  }
  refreshSnippets(ac);
}

/** Opens the modal to edit an existing snippet, re-deriving its import lines. */
function openSnippetEditorForEdit(ac: ActivationCtx, snippetId: string): void {
  const snippet = getSnippet(ac, snippetId);
  if (!snippet) return;
  const draft: SnippetDraft = {
    id: snippet.id,
    name: snippet.name,
    description: snippet.description ?? '',
    category: snippet.category ?? '',
    code: snippet.code,
    languageId: snippet.languageId,
    scope: snippet.scope,
    importLines: snippet.imports.map(emitImport),
    existingCategories: snippetCategories(ac),
    mode: 'edit',
    canShare: sharedConfigPath(ac) !== undefined,
  };
  ac.snippetEditor.open(draft);
}

/** Distinct categories across all snippets, for the modal's pick-or-create list. */
function snippetCategories(ac: ActivationCtx): string[] {
  const set = new Set<string>();
  for (const s of listSnippets(ac)) {
    const c = s.category?.trim();
    if (c) set.add(c);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

function activeLanguageId(): string | undefined {
  return vscode.window.activeTextEditor?.document.languageId;
}

/** Command: capture the current editor selection as a new snippet. */
async function captureSelectionAsSnippet(ac: ActivationCtx): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage(
      'Snapds: Open a React file and select code to save a snippet.',
    );
    return;
  }
  if (!isSnippetLanguage(editor.document.languageId)) {
    vscode.window.showWarningMessage(
      'Snapds: Snippets can only be captured from React (.jsx/.tsx) files.',
    );
    return;
  }
  const code = editor.document.getText(editor.selection);
  if (!code.trim()) {
    vscode.window.showWarningMessage('Snapds: Select the code you want to save as a snippet.');
    return;
  }

  const draft: SnippetDraft = {
    name: '',
    description: '',
    category: '',
    code,
    languageId: editor.document.languageId,
    scope: 'local',
    importLines: detectImportLines(editor.document.getText(), code),
    existingCategories: snippetCategories(ac),
    mode: 'create',
    canShare: sharedConfigPath(ac) !== undefined,
  };
  ac.snippetEditor.open(draft);
}

// ─── setupSettingsPanel ───────────────────────────────────────────────────────

function setupSettingsPanel(
  ctx: vscode.ExtensionContext,
  ac: ActivationCtx,
): SettingsPanelProvider {
  const onGenerateSkills = async () => {
    try {
      const components = await collectComponents(ac);
      await runGenerateSkills(components, listSnippets(ac));
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
      ac.settingsPanel.postHiddenPackages(
        ctx.workspaceState.get<string[]>('snapds.hiddenPackages') ?? [],
      );
      ac.settingsPanel.postConfigStatus(detectConfigConflict(ac.registry, ctx));
      ac.settingsPanel.postSnippetList(listSnippets(ac));
      // Populate Active card counts without waiting for a per-card click. Runs
      // after the package list is posted so the webview has each package's
      // excluded/manual context before the component names arrive.
      void pushActiveComponentNames(ac);
    },
    onRequestComponents: async (pkgName) => {
      const descriptor = await resolvePackageByName(pkgName, ac);
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
    onAddLocalSource: async () => {
      const root = ac.workspaceRoot;
      if (!root) {
        vscode.window.showWarningMessage('Snapds: open a workspace folder first.');
        return;
      }
      const picked = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectFiles: false,
        canSelectMany: false,
        openLabel: 'Select component source folder',
        defaultUri: vscode.Uri.file(root),
      });
      if (!picked?.length) return;
      const folder = picked[0].fsPath;
      const rel = path.relative(root, folder);
      // Empty `rel` means the picked folder IS the workspace root — reject it too,
      // alongside anything outside the workspace.
      if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
        vscode.window.showWarningMessage(
          'Snapds: pick a folder inside the workspace (not the workspace root).',
        );
        return;
      }
      const src = buildLocalSourceFromFolder(folder, root);
      if (!src.importAlias) {
        const alias = await vscode.window.showInputBox({
          title: 'Import alias for this component folder',
          prompt: 'The specifier used in generated imports, e.g. @/components/ui',
          placeHolder: '@/components/ui',
          ignoreFocusOut: true,
        });
        if (!alias?.trim()) return;
        src.importAlias = alias.trim();
        src.importPath = alias.trim();
      }
      const list = ac.registry.list();
      if (list.some((p) => p.name === src.name)) {
        vscode.window.showInformationMessage(`Snapds: "${src.name}" is already registered.`);
      } else {
        await ac.registry.saveAll([...list, { ...src, excluded: [], manual: [] }]);
      }
      const registered = ac.registry.list().find((p) => p.name === src.name);
      if (registered) await refreshActiveComponents(registered, ac);
      ac.settingsPanel.postPackageList(await buildPackageList(ac));
      setupLocalWatchers(ac);
    },
    onEnableLocalSource: async (name) => {
      // Register a source that was auto-detected (components.json) but not yet
      // enabled — the banner's one-click "Add".
      const src = await resolvePackageByName(name, ac);
      if (src?.kind !== 'local') return;
      const list = ac.registry.list();
      if (!list.some((p) => p.name === name)) {
        await ac.registry.saveAll([...list, { ...src, excluded: [], manual: [] }]);
      }
      const registered = ac.registry.list().find((p) => p.name === name);
      if (registered) await refreshActiveComponents(registered, ac);
      ac.settingsPanel.postPackageList(await buildPackageList(ac));
      setupLocalWatchers(ac);
    },
    onReloadPackage: async (pkgName) => {
      const descriptor = await resolvePackageByName(pkgName, ac);
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
      const descriptor = await resolvePackageByName(pkg, ac);
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
    onSetHiddenPackages: async (names) => {
      // Personal, workspace-local declutter of the Available list — never
      // committed, never affects teammates (mirrors scopeFilters persistence).
      await ctx.workspaceState.update(
        'snapds.hiddenPackages',
        names.length > 0 ? names : undefined,
      );
    },
    onRemoveLocalSource: async (name) => {
      // Only manually-registered folders can be truly removed; a components.json
      // source would just re-appear on the next scan (the UI hides those instead).
      const list = ac.registry.list();
      const target = list.find((p) => p.name === name && p.kind === 'local');
      if (!target) return;
      await ac.introspector.invalidate(target);
      await ac.registry.saveAll(list.filter((p) => p.name !== name));
      // Drop its components from the gallery/store so it disappears everywhere.
      const remaining = ac.store.listComponents().filter((c) => !c.id.startsWith(`${name}#`));
      ac.store.setComponents(remaining);
      ac.gallery.postComponentList(remaining);
      setupLocalWatchers(ac);
      ac.settingsPanel.postPackageList(await buildPackageList(ac));
    },
    onRequestSnippets: () => {
      ac.settingsPanel.postSnippetList(listSnippets(ac));
    },
    onEditSnippet: (id) => openSnippetEditorForEdit(ac, id),
    onDeleteSnippet: (id) => deleteSnippet(ac, id),
    onSetSnippetScope: (id, scope) => setSnippetScope(ac, id, scope),
    onRecategorizeSnippet: (id, category) => recategorizeSnippet(ac, id, category),
    onRenameSnippetCategory: (from, to) => renameSnippetCategory(ac, from, to),
    onDeleteSnippetCategory: (category) => renameSnippetCategory(ac, category, ''),
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
        pruneStoreToRegistry(ac);
        await indexPackagesWithProgress(list, ac);
        ac.settingsPanel.postPackageList(await buildPackageList(ac));
        ac.settingsPanel.postSkillsConfig(getSkillsConfig());
        ac.settingsPanel.postScopeFilters(
          ctx.workspaceState.get<string[]>('snapds.scopeFilters') ?? [],
        );
        ac.settingsPanel.postConfigStatus(detectConfigConflict(ac.registry, ctx));
        ac.settingsPanel.postSaved();
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
                const descriptor = existing ?? (await resolvePackageByName(pkg.name, ac));
                const version = descriptor?.version ?? 'unknown';
                const importPath = descriptor?.importPath ?? pkg.name;
                const tsconfigPath = descriptor?.tsconfigPath;
                // Preserve local-source identity so a registered shadcn folder
                // round-trips — kind/rootDir/importAlias drive introspection + imports.
                const localFields =
                  descriptor?.kind === 'local'
                    ? {
                        kind: 'local' as const,
                        rootDir: descriptor.rootDir,
                        importAlias: descriptor.importAlias,
                      }
                    : {};

                if (pkg.components === undefined) {
                  return {
                    name: pkg.name,
                    version,
                    importPath,
                    tsconfigPath,
                    ...localFields,
                    excluded: existing?.excluded ?? [],
                    manual: existing?.manual ?? [],
                  };
                }

                const selected = pkg.selected ?? [];
                const excluded = pkg.components.filter((c) => !selected.includes(c));
                const manual = selected.filter((c) => !pkg.components?.includes(c));
                return {
                  name: pkg.name,
                  version,
                  importPath,
                  tsconfigPath,
                  ...localFields,
                  excluded,
                  manual,
                };
              }),
            );

            const finalList = resolved.filter((p) => enabledNames.has(p.name));
            await ac.registry.saveAll(finalList);

            const activePackages = ac.registry.list();
            pruneStoreToRegistry(ac);
            await indexPackagesWithProgress(activePackages, ac, progress);

            const allComponents = ac.store.listComponents();
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
      await runGenerateSkills(components, listSnippets(ac));
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

    vscode.commands.registerCommand('snapds.saveSelectionAsSnippet', () =>
      captureSelectionAsSnippet(ac),
    ),

    // Open gallery with the Components tab active (⌃⌥⌘C / Ctrl+Shift+Alt+C).
    // Reveals + focuses the view from any context, then tells the webview which
    // tab to switch to and to focus the search bar.
    vscode.commands.registerCommand('snapds.openGalleryComponents', () => {
      void vscode.commands.executeCommand('snapds.gallery.focus').then(() => {
        ac.gallery.postSwitchTab('components');
        ac.gallery.postFocusSearch();
      });
    }),

    // Open gallery with the Snippets tab active (⌃⌥⌘S / Ctrl+Shift+Alt+S when
    // NOT in a React file with a selection — that context saves a snippet instead).
    vscode.commands.registerCommand('snapds.openGallerySnippets', () => {
      void vscode.commands.executeCommand('snapds.gallery.focus').then(() => {
        ac.gallery.postSwitchTab('snippets');
        ac.gallery.postFocusSearch();
      });
    }),

    // Focus the gallery search bar without switching tabs (⌃⌥⌘F / Ctrl+Shift+Alt+F).
    // Opens the gallery first if it isn't already visible.
    vscode.commands.registerCommand('snapds.focusGallerySearch', () => {
      void vscode.commands.executeCommand('snapds.gallery.focus').then(() => {
        ac.gallery.postFocusSearch();
      });
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

function computeConfigHash(filePath: string): string | undefined {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return crypto.createHash('sha256').update(content).digest('hex');
  } catch {
    return undefined;
  }
}

function runStartupFlow(ctx: vscode.ExtensionContext, ac: ActivationCtx): void {
  // Show a notification whenever the config file content has changed since last seen.
  void (async () => {
    const conflict = detectConfigConflict(ac.registry, ctx);
    if (!conflict.detected || !conflict.hasConflicts || !conflict.configPath) return;
    const hashKey = `${CONFIG_HASH_PREFIX}${ac.workspaceRoot ?? 'default'}`;
    const currentHash = computeConfigHash(conflict.configPath);
    const storedHash = ctx.globalState.get<string>(hashKey);
    if (!currentHash || currentHash === storedHash) return;
    const action = await vscode.window.showInformationMessage(
      'Snapds: a config file was found that differs from your current settings.',
      'Open Settings',
      'Dismiss',
    );
    // Update stored hash after the user acknowledges, so a missed notification
    // (e.g. VS Code closed while the popup was open) will reappear next launch.
    await ctx.globalState.update(hashKey, currentHash);
    if (action === 'Open Settings') {
      ac.settingsPanel.show();
    }
  })();

  void (async () => {
    const list = ac.registry.list();
    if (list.length === 0) return;

    const cold = list.filter((p) => !ac.introspector.getCached(p));
    if (cold.length === 0) {
      // Warm cache: no indexing bar needed, but still serialize so a concurrent
      // save/reindex can't interleave store writes with this warm-up.
      await serializeIndexing(() =>
        Promise.all(list.map((pkg) => refreshActiveComponents(pkg, ac))),
      );
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
        await indexPackagesWithProgress(list, ac, progress);
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

/**
 * Reads a LOCAL-source icon component's own source file and statically extracts
 * a sanitized inline `<svg>` for the props-panel preview. Returns undefined for
 * npm components (no `sourceFile`) or files with no renderable inline SVG.
 */
function computeSvgPreview(meta: ComponentMeta): string | undefined {
  if (!meta.sourceFile) return undefined;
  try {
    return extractSvgMarkup(fs.readFileSync(meta.sourceFile, 'utf8'), meta.name);
  } catch {
    return undefined;
  }
}

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
          .then(
            () => {},
            () => {},
          ),
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
  setupLocalWatchers(ac);
}

/**
 * Resolves a package name to its descriptor: a registered package (npm or
 * local) first, then a shadcn local source detected on disk, then an npm
 * package resolved from node_modules. Local sources carry kind/rootDir/alias.
 */
async function resolvePackageByName(
  name: string,
  ac: ActivationCtx,
): Promise<DsPackage | undefined> {
  const registered = ac.registry.list().find((p) => p.name === name);
  // npm sources need no workspace scan — return the registered descriptor as-is.
  if (registered && registered.kind !== 'local') return registered;
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const detectedLocal = root ? detectLocalSources(root).find((s) => s.name === name) : undefined;
  if (registered) {
    // Registered local source: keep the user's excluded/manual, but refresh
    // rootDir/alias/tsconfig from detection so a later `components.json` edit
    // isn't masked by the descriptor snapshotted at registration time.
    return detectedLocal
      ? {
          ...registered,
          rootDir: detectedLocal.rootDir,
          importPath: detectedLocal.importPath,
          importAlias: detectedLocal.importAlias,
          tsconfigPath: detectedLocal.tsconfigPath,
          version: detectedLocal.version,
        }
      : registered;
  }
  if (detectedLocal) return detectedLocal;
  return ac.registry.resolveDescriptor(name);
}

async function buildPackageList(ac: ActivationCtx): Promise<PackageMeta[]> {
  const allPkgs = await ac.registry.discoverAllPackagesInWorkspace();
  const currentList = ac.registry.list();
  const npm: PackageMeta[] = allPkgs.map((name) => {
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

  // Local component sources (shadcn / in-repo design systems): auto-detected from
  // components.json AND any registered manually via "+ Local folder" (which have
  // no components.json). A source is "enabled" once registered.
  const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  const detected = root ? detectLocalSources(root) : [];
  const detectedNames = new Set(detected.map((s) => s.name));
  const registeredLocal = currentList.filter((p) => p.kind === 'local');
  const local: PackageMeta[] = mergeLocalSources(detected, registeredLocal).map((src) => {
    const registered = currentList.find((p) => p.name === src.name && p.kind === 'local');
    const cached = ac.introspector.getCached(registered ?? src);
    return {
      name: src.name,
      kind: 'local',
      rootDir: src.rootDir,
      importAlias: src.importAlias,
      // Manual folders exist only in the registry; detected ones come from a
      // components.json and re-appear on scan, so only manual ones are removable.
      autoDetected: detectedNames.has(src.name),
      enabled: !!registered,
      components: cached?.map((c) => c.name),
      excluded: registered?.excluded ?? [],
      manual: registered?.manual ?? [],
    };
  });

  return [...npm, ...local];
}

/**
 * Streams component names for every registered package to the settings panel so
 * the Active cards show their real counts on open — instead of a stale 0/0 until
 * the user clicks each card. Uses the warm cache when present (instant); a cold
 * package is introspected in the background, joining any startup warm-up already
 * in flight (introspect() dedupes), and its names posted as soon as they resolve.
 */
async function pushActiveComponentNames(ac: ActivationCtx): Promise<void> {
  // Sequential on purpose: a cold panel-open must not fan out N concurrent
  // ts.createProgram parses — the same peak-memory pattern indexPackagesWithProgress
  // avoids. Warm packages resolve instantly (getCached); a cold one joins any
  // in-flight startup parse via the introspector's dedup, so at most one parse
  // runs here at a time.
  for (const pkg of ac.registry.list()) {
    try {
      const cached = ac.introspector.getCached(pkg);
      const all = cached ?? (await ac.introspector.introspect(pkg));
      ac.settingsPanel.postComponentNames(
        pkg.name,
        all.map((c) => c.name),
      );
    } catch {
      // Leave the card at its seeded state; a manual click can retry.
    }
  }
}

let localWatchers: vscode.Disposable[] = [];
let watcherLifecycleRegistered = false;

/**
 * (Re)registers a file watcher per registered local source folder so editing a
 * component re-introspects and refreshes the gallery live. Local cache keys are
 * content-signature (mtime) based, so a changed file naturally busts the cache;
 * the watcher just triggers the re-scan + broadcast.
 */
function setupLocalWatchers(ac: ActivationCtx): void {
  for (const d of localWatchers) d.dispose();
  localWatchers = [];
  // Register the teardown exactly once: a stable disposable that disposes
  // whatever watchers exist at deactivation. Pushing each rebuilt batch into
  // ctx.subscriptions (drained only on deactivate) would leak dead references.
  if (!watcherLifecycleRegistered) {
    watcherLifecycleRegistered = true;
    ac.vsctx.subscriptions.push({
      dispose: () => {
        for (const d of localWatchers) d.dispose();
      },
    });
  }
  for (const p of ac.registry.list()) {
    if (p.kind !== 'local' || !p.rootDir) continue;
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(p.rootDir, '**/*.{ts,tsx}'),
    );
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onChange = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void reintrospectAndBroadcast(p.name, ac), 300);
    };
    watcher.onDidChange(onChange);
    watcher.onDidCreate(onChange);
    watcher.onDidDelete(onChange);
    localWatchers.push(watcher);
  }
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
  await generateSkillsToConfig(all, cfg, { mode: 'incremental', changedIds }, listSnippets(ac));
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
      await indexPackagesWithProgress(list, ac, progress);
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
      await indexPackagesWithProgress(list, ac, progress);
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
  const n = await generateSkillsToConfig(all, cfg, { mode: 'full' }, listSnippets(ac));
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
  const descriptor = await resolvePackageByName(pkgName, ac);
  if (!descriptor) return;
  await refreshActiveComponents(descriptor, ac);
  const sel = ac.store.getSelected();
  if (sel?.id.startsWith(`${pkgName}#`) && ac.propsPanel.isOpen()) {
    ac.propsPanel.postComponentSchema(
      sel,
      ac.store.getConfiguredProps(sel.id),
      computeSvgPreview(sel),
    );
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

/**
 * Indexes packages ONE AT A TIME, driving the gallery indexing bar and (when
 * supplied) the notification toast from a single loop. Because both progress
 * surfaces read the same `done`/`total`/`pkg` on every step, their package name
 * and counter can never diverge (the toast/gallery desync bug). Sequential
 * introspection also keeps a single TypeScript program alive at a time instead
 * of N concurrent ones — parsing is CPU-bound and sync, so `Promise.all` bought
 * no parallelism, only peak memory.
 */
// Serializes indexing runs so concurrent triggers (startup warm-up, a save, a
// reindex, a cache clear) never interleave their gallery/store/progress updates.
// A rejected run can't wedge the chain: each link runs regardless of the prior
// outcome, and the tracked tail always resolves.
let indexingChain: Promise<unknown> = Promise.resolve();
function serializeIndexing<T>(run: () => Promise<T>): Promise<T> {
  const next = indexingChain.then(run, run);
  indexingChain = next.then(
    () => {},
    () => {},
  );
  return next;
}

/**
 * Drops store components whose package is no longer in the registry (e.g. one the
 * user just deactivated, or removed by an imported config), so the gallery stops
 * showing orphaned components without waiting for a full reload.
 */
function pruneStoreToRegistry(ac: ActivationCtx): void {
  const valid = new Set(ac.registry.list().map((p) => p.name));
  const current = ac.store.listComponents();
  const kept = current.filter((c) => valid.has(c.id.split('#')[0]));
  if (kept.length !== current.length) {
    ac.store.setComponents(kept);
    ac.gallery.postComponentList(kept);
  }
}

async function indexPackagesWithProgress(
  packages: DsPackage[],
  ac: ActivationCtx,
  progress?: vscode.Progress<{ message?: string; increment?: number }>,
): Promise<void> {
  await serializeIndexing(async () => {
    const total = packages.length;
    ac.gallery.postIndexing(packages.map((p) => p.name));
    progress?.report({ message: `0 / ${total}`, increment: 0 });
    let done = 0;
    for (const pkg of packages) {
      await refreshActiveComponents(pkg, ac);
      done++;
      ac.gallery.postIndexingProgress(done, total, pkg.name);
      progress?.report({
        message: `${done} / ${total} — ${pkg.name}`,
        increment: total > 0 ? (1 / total) * 100 : 100,
      });
    }
    ac.gallery.postIndexing([]);
    ac.gallery.postComponentList(ac.store.listComponents());
  });
}
