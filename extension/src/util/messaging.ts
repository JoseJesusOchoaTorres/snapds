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
  | { type: 'search'; query: string };

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
  | { type: 'reloadPackage'; pkg: string };

export type ToGallery =
  | { type: 'componentList'; components: ComponentMeta[] }
  | { type: 'indexing'; packages: string[] };

export type ToProps =
  | { type: 'componentSchema'; component: ComponentMeta }
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
  | { type: 'configStatus'; payload: ConfigStatusPayload }
  | { type: 'configImportPreview'; payload: ConfigImportPreviewPayload }
  | { type: 'configExported'; outputPath: string };

export const DRAG_MIME = 'application/vnd.code.tree.snapds.component';
