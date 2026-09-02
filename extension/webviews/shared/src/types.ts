/**
 * Component metadata shared by every webview. These mirror the extension's
 * messaging shapes for the fields the UIs consume; per-webview message-protocol
 * unions live in each webview's own `types.ts`.
 */
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
   * Import specifier for this component (e.g. a local design system's path alias
   * `@/components/ui/button`). Mirrors the host field; UIs may use it to badge a
   * local source. Injection itself happens host-side.
   */
  importSpecifier?: string;
  /**
   * True when the component exposes no custom props and only accepts standard
   * DOM/SVG attributes (e.g. an icon typed `React.SVGProps<SVGSVGElement>`).
   * Lets the UI show an explanatory label instead of "no documented props".
   */
  standardPropsOnly?: boolean;
}

// ─── Custom snippets ─────────────────────────────────────────────────────────

/** Mirror of the host `ImportSpec` (see src/util/messaging.ts). */
export type ImportSpec =
  | { kind: 'named'; specifier: string; names: string[] }
  | { kind: 'default'; specifier: string; local: string }
  | { kind: 'namespace'; specifier: string; local: string };

/** Mirror of the host `CustomSnippet` — what the gallery renders in its 2nd tab. */
export interface CustomSnippet {
  id: string;
  name: string;
  description?: string;
  category?: string;
  code: string;
  imports: ImportSpec[];
  languageId: string;
  scope: 'local' | 'shared';
  createdAt: string;
}

/** Mirror of the host `SnippetDraft` — the capture/edit modal's opening payload. */
export interface SnippetDraft {
  id?: string;
  name: string;
  description: string;
  category: string;
  code: string;
  languageId: string;
  scope: 'local' | 'shared';
  importLines: string[];
  existingCategories: string[];
  mode: 'create' | 'edit';
  canShare: boolean;
}

/** Mirror of the host `SnippetSaveResult` — what the modal posts back on save. */
export interface SnippetSaveResult {
  id?: string;
  name: string;
  description: string;
  category: string;
  code: string;
  scope: 'local' | 'shared';
  importLines: string[];
}

// ─── User overrides ──────────────────────────────────────────────────────────

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

// ─── Skills ──────────────────────────────────────────────────────────────────

/**
 * Coding agent a skill can be generated for. Historically named "format" and
 * persisted under `snapds.skills.formats`; the key is kept for backward
 * compatibility while the UI presents these as selectable agents.
 */
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
  /**
   * Where skills are written:
   * - `workspace`  — the repository root.
   * - `subfolder`  — a path relative to the repo root (`subPath`), e.g. a
   *                  monorepo app/package.
   * - `custom`     — any absolute folder (`customPath`), e.g. `~` for personal
   *                  agent skills shared across projects.
   */
  destination: 'workspace' | 'subfolder' | 'custom';
  /** Absolute folder used when `destination` is `custom`. */
  customPath?: string;
  /** Workspace-relative folder used when `destination` is `subfolder`. */
  subPath?: string;
  /**
   * When true, consolidated agents (Copilot, Cline) omit per-component prop tables
   * from their single catalog file, keeping it small for the always-loaded case.
   * Default (false) inlines the full props contract, like every other agent.
   */
  compactConsolidated?: boolean;
  autoGenerate: boolean;
  /** Free-text guidance per component id (pkg#Name), injected verbatim. */
  instructions?: Record<string, string>;
  /** Package names kept in the gallery but excluded from skill generation. */
  excludedPackages?: string[];
  /** Ids of custom snippets to append to generated skills (local + shared); opt-in. */
  skillSnippetIds?: string[];
}

export interface SkillFileEntry {
  path: string;
  label: string;
  format: SkillFormat;
  title?: string;
  description?: string;
  /** True for the agent's main dictionary/router file (rendered first + distinct). */
  isRouter?: boolean;
}

// ─── Component detail (settings modals) ─────────────────────────────────────

export interface ComponentDetail {
  pkg: string;
  component: string;
  description?: string;
  props: PropMeta[];
  snippet?: string;
  companyOverride?: UserOverride;
  userOverride?: UserOverride;
  skillFiles: { path: string; label: string; format: SkillFormat }[];
}

// ─── Config ──────────────────────────────────────────────────────────────────

export type ConfigExportMode = 'replace' | 'merge' | 'full';

export interface PackageMeta {
  name: string;
  enabled: boolean;
  components?: string[];
  excluded?: string[];
  manual?: string[];
  /** `'local'` = an in-repo component source (shadcn / design system folder). */
  kind?: 'npm' | 'local';
  /** Local only: absolute source folder. */
  rootDir?: string;
  /** Local only: import-specifier base, e.g. `@/components/ui`. */
  importAlias?: string;
  /**
   * Local only: `true` when auto-detected from a `components.json`, `false` when
   * registered manually via "+ Local folder". Only manual sources are removable.
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
  configPath: string;
}
