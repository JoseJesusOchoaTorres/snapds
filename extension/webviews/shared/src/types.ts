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
