export interface PropMeta {
  name: string;
  type: 'string' | 'boolean' | 'number' | 'enum' | 'function' | 'ReactNode' | string;
  raw: string;
  required: boolean;
  defaultValue?: unknown;
  description?: string;
  enumValues?: string[];
}

export interface ComponentMeta {
  id: string;
  name: string;
  description?: string;
  props: PropMeta[];
  snippet?: string;
  /**
   * Import specifier to emit when injecting this component — e.g. a local design
   * system's path alias `@/components/ui/button`. When absent, injection falls
   * back to the component id's package prefix (the npm-package behavior).
   */
  importSpecifier?: string;
  /**
   * Absolute path of the source file this component was introspected from. Set
   * for local sources; used to derive `importSpecifier` and to scope the
   * file-watcher. Host-only (webviews don't consume it).
   */
  sourceFile?: string;
  /**
   * True when the component exposes no custom props and only accepts standard
   * DOM/SVG attributes (e.g. an icon typed `React.SVGProps<SVGSVGElement>`).
   * Lets the UI show an explanatory label instead of "no documented props".
   */
  standardPropsOnly?: boolean;
}

/**
 * A single import statement a custom snippet needs when injected.
 * Captured (and confirmed) at save time, then re-emitted at inject time so a
 * snippet carries every module it depends on — unlike a component, whose one
 * import is derived from its `pkg#Name` id.
 */
export type ImportSpec =
  | {
      kind: 'named';
      specifier: string;
      names: string[];
      /**
       * True when the original import used a declaration-level `type` modifier
       * (`import type { Foo }`). When false, individual names may still carry
       * inline `type` prefixes (`import { type Foo, Bar }`) — those are preserved
       * verbatim in the `names` strings and round-trip through `emitImport`.
       */
      typeOnly?: boolean;
    }
  | {
      kind: 'default';
      specifier: string;
      local: string;
      /** True for `import type Foo from '…'` (declaration-level type modifier). */
      typeOnly?: boolean;
    }
  | {
      kind: 'namespace';
      specifier: string;
      local: string;
      /** True for `import type * as Foo from '…'` (declaration-level type modifier). */
      typeOnly?: boolean;
    };

/**
 * A user-captured code snippet. Flows through the SAME gallery render, drag,
 * and inject pipeline as a `ComponentMeta`, but carries a raw `code` body
 * (escaped at inject time) and its own `imports` instead of props.
 *
 * `id` uses the reserved `snippet:<uuid>` namespace so it never collides with
 * the `pkg#Name` component id-space (which `pruneStoreToRegistry` would drop).
 */
export interface CustomSnippet {
  id: string;
  name: string;
  description?: string;
  /** Undefined groups the snippet under the reserved "Uncategorized" bucket. */
  category?: string;
  /** Raw captured source. Escaped via `escapeSnippet` before insertion. */
  code: string;
  imports: ImportSpec[];
  /** Editor language the snippet was captured from, e.g. `typescriptreact`. */
  languageId: string;
  /** `local` = workspaceState only; `shared` = promoted to snapds.config.json. */
  scope: 'local' | 'shared';
  /** ISO timestamp; used only for stable ordering. */
  createdAt: string;
}

/**
 * The payload the capture/edit modal opens with. Imports are pre-rendered to
 * human-readable statement lines (via `emitImport`) so the webview never has to
 * emit or parse import syntax — the host re-parses `importLines` on save.
 */
export interface SnippetDraft {
  /** Present when editing an existing snippet; absent when capturing a new one. */
  id?: string;
  name: string;
  description: string;
  category: string;
  code: string;
  languageId: string;
  scope: 'local' | 'shared';
  /** Pre-rendered, pre-checked `import … from '…'` lines detected in the selection. */
  importLines: string[];
  /** Categories already in use, offered in the picker for pick-or-create. */
  existingCategories: string[];
  mode: 'create' | 'edit';
  /** False when there is no workspace/config to promote a shared snippet into. */
  canShare: boolean;
}

/** What the modal sends back on save. The host parses `importLines` into `ImportSpec[]`. */
export interface SnippetSaveResult {
  id?: string;
  name: string;
  description: string;
  category: string;
  code: string;
  scope: 'local' | 'shared';
  importLines: string[];
}

export type FromSnippetEditor =
  | { type: 'ready' }
  | { type: 'save'; result: SnippetSaveResult }
  | { type: 'cancel' };

export type ToSnippetEditor = { type: 'draft'; draft: SnippetDraft };

export interface PropOverride {
  hidden?: boolean;
  description?: string;
  defaultValue?: unknown;
}

export interface AddedProp {
  name: string;
  type: string;
  description?: string;
}

export interface UserOverride {
  snippet?: string;
  props?: Record<string, PropOverride>;
  addedProps?: AddedProp[];
}

export type FromGallery =
  | { type: 'ready' }
  | { type: 'componentSelected'; componentId: string }
  | { type: 'search'; query: string }
  | { type: 'snippetSelected'; snippetId: string }
  | { type: 'editSnippet'; snippetId: string }
  | { type: 'deleteSnippet'; snippetId: string };

export type FromProps =
  | { type: 'ready' }
  | { type: 'propsUpdated'; componentId: string; props: Record<string, unknown> }
  | { type: 'switchVersion'; pkg: string; version: string }
  | { type: 'addToPackageJson'; pkg: string; version: string };

export type SkillFormat =
  | 'augment'
  | 'generic'
  | 'claude'
  | 'cursor'
  | 'copilot'
  | 'windsurf'
  | 'cline';

export interface SkillsConfig {
  enabled: boolean;
  formats: SkillFormat[];
  /** `workspace` = repo root; `subfolder` = repo-relative `subPath`; `custom` = absolute `customPath`. */
  destination: 'workspace' | 'subfolder' | 'custom';
  customPath?: string;
  /** Workspace-relative folder used when `destination` is `subfolder`. */
  subPath?: string;
  /** When true, consolidated agents (Copilot/Cline) omit prop tables from their catalog. */
  compactConsolidated?: boolean;
  autoGenerate: boolean;
  /** Free-text guidance per component id (pkg#Name), injected verbatim. */
  instructions?: Record<string, string>;
  /** Package names whose components are kept in the gallery but excluded from skill generation. */
  excludedPackages?: string[];
  /**
   * Ids of custom snippets (local AND shared) to append to generated skill files
   * as a "Custom Snippets" section. Opt-in: empty/undefined means no snippets are
   * included. Note: including local snippets writes their code into (usually
   * committed) skill files.
   */
  skillSnippetIds?: string[];
}

/** A generated skill file discovered on disk in the configured destination. */
export interface SkillFileEntry {
  /** Absolute path to the file. */
  path: string;
  /** Display label (skill folder name or file name). */
  label: string;
  format: SkillFormat;
  /** Title parsed from the skill's frontmatter/heading, if available. */
  title?: string;
  /** Description parsed from the skill's frontmatter/first line, if available. */
  description?: string;
  /** True for the agent's main dictionary/router file (rendered first + distinct). */
  isRouter?: boolean;
}

/** Merged detail for a single component, used by the settings EYE/GEAR modals. */
export interface ComponentDetail {
  pkg: string;
  component: string;
  description?: string;
  props: PropMeta[];
  snippet?: string;
  /** Inherited baseline (auto < company), read-only in the UI. */
  companyOverride?: UserOverride;
  userOverride?: UserOverride;
  skillFiles: { path: string; label: string; format: SkillFormat }[];
}

export type ConfigExportMode = 'replace' | 'merge' | 'full';

export type FromSettings =
  | { type: 'ready' }
  | {
      type: 'savePackages';
      packages: { name: string; components?: string[]; selected?: string[] }[];
    }
  | { type: 'requestComponents'; pkg: string }
  | { type: 'saveSkillsConfig'; config: SkillsConfig }
  | { type: 'regenerateAllSkills' }
  | { type: 'generateSkills' }
  | { type: 'pickCustomPath' }
  | { type: 'listSkills' }
  | { type: 'openSkill'; path: string }
  | { type: 'requestComponentDetail'; pkg: string; component: string }
  | { type: 'saveUserOverride'; pkg: string; component: string; override: UserOverride }
  | { type: 'resetUserOverride'; pkg: string; component: string }
  | { type: 'requestUserOverrides' }
  | { type: 'setScopeFilters'; filters: string[] }
  | {
      type: 'exportConfig';
      includeOverrides: boolean;
      mode: ConfigExportMode;
      outputPath?: string;
      /** Current webview selection state — used to compute excluded from detected−selected. */
      packageSelections?: { name: string; detected: string[]; selected: string[] }[];
    }
  | { type: 'importConfig'; filePath?: string }
  | { type: 'requestConfigStatus' }
  | { type: 'confirmImportConfig'; applyOverrides: boolean }
  | { type: 'reloadPackage'; pkg: string }
  | { type: 'addLocalSource' }
  | { type: 'enableLocalSource'; name: string }
  | { type: 'setHiddenPackages'; names: string[] }
  | { type: 'removeLocalSource'; name: string }
  | { type: 'requestSnippets' }
  | { type: 'editSnippet'; snippetId: string }
  | { type: 'deleteSnippet'; snippetId: string }
  | { type: 'setSnippetScope'; snippetId: string; scope: 'local' | 'shared' }
  | { type: 'recategorizeSnippet'; snippetId: string; category: string }
  | { type: 'renameSnippetCategory'; from: string; to: string }
  | { type: 'deleteSnippetCategory'; category: string };

export type ToGallery =
  | { type: 'componentList'; components: ComponentMeta[] }
  | { type: 'snippetList'; snippets: CustomSnippet[] }
  | { type: 'indexing'; packages: string[] }
  /**
   * Per-package progress emitted from the SAME host loop that drives the
   * notification toast, so the gallery bar's package name and `done/total`
   * never diverge from the toast. `done`/`total`/`pkg` mirror the toast exactly.
   */
  | { type: 'indexingProgress'; done: number; total: number; pkg: string }
  /** Activate a specific gallery tab from a host command (e.g. ⌃⌥⌘C / ⌃⌥⌘S). */
  | { type: 'switchTab'; tab: 'components' | 'snippets' }
  /** Focus the gallery search bar from a host command (⌃⌥⌘F). */
  | { type: 'focusSearch' };

export type ToProps =
  | {
      type: 'componentSchema';
      component: ComponentMeta;
      /**
       * Sanitized inline `<svg>` markup for a LOCAL-source icon component,
       * extracted statically from its source file. Present only when the
       * component's source contains renderable inline SVG; the panel shows it as
       * a live preview. Never set for npm packages (no source to read).
       */
      svgPreview?: string;
    }
  | { type: 'restoreProps'; props: Record<string, unknown> }
  | {
      type: 'versionsAvailable';
      pkg: string;
      versions: string[];
      activeVersion: string;
      isAutoResolved: boolean;
      inPackageJson: boolean;
      /** False when no source file is open — selector should render as disabled. */
      hasFileContext: boolean;
      /**
       * Workspace-relative path of the app whose node_modules contains the
       * auto-detected version (e.g. "apps/web"). Undefined when manually
       * selected or when no file context is available.
       */
      resolvedFrom?: string;
    };

export interface PackageMeta {
  name: string;
  enabled: boolean;
  /** All detected component names (populated once introspected). */
  components?: string[];
  /** Component names the user de-selected. */
  excluded?: string[];
  /** Component names added manually. */
  manual?: string[];
  /** `'local'` = an in-repo component source (shadcn / design system folder). */
  kind?: 'npm' | 'local';
  /** Local only: absolute source folder. */
  rootDir?: string;
  /** Local only: import-specifier base, e.g. `@/components/ui`. */
  importAlias?: string;
  /**
   * Local only: `true` when auto-detected from a `components.json`, `false` when
   * the user registered the folder manually via "+ Local folder". Only manual
   * sources are truly removable (detected ones re-appear on the next scan).
   */
  autoDetected?: boolean;
}

export interface ConfigStatusPayload {
  detected: boolean;
  hasConflicts: boolean;
  configPath?: string;
}

export interface ConfigImportPreviewPayload {
  packagesAdded: string[];
  packagesRemoved: string[];
  packagesUpdated: string[];
  overridesCount: number;
  skillsChanged: boolean;
  scopeFiltersChanged: boolean;
  /** Absolute path to the config file that will be imported. */
  configPath: string;
}

export type ToSettings =
  | { type: 'packageList'; packages: PackageMeta[] }
  | { type: 'componentNames'; pkg: string; components: string[] }
  | { type: 'skillsConfig'; config: SkillsConfig }
  | { type: 'saving' }
  | { type: 'saved' }
  | { type: 'skillsGenerated'; ok: boolean }
  | { type: 'customPathPicked'; path: string }
  | { type: 'skillsList'; files: SkillFileEntry[] }
  | { type: 'componentDetail'; detail: ComponentDetail }
  | { type: 'userOverrides'; overrides: Record<string, Record<string, UserOverride>> }
  | { type: 'scopeFilters'; filters: string[] }
  | { type: 'hiddenPackages'; names: string[] }
  | { type: 'configStatus'; payload: ConfigStatusPayload }
  | { type: 'configImportPreview'; payload: ConfigImportPreviewPayload }
  | { type: 'configExported'; outputPath: string }
  | { type: 'snippetList'; snippets: CustomSnippet[] };

export const DRAG_MIME = 'application/vnd.code.tree.snapds.component';
