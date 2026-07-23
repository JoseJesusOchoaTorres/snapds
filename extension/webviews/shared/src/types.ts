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

export type SkillFormat = 'augment' | 'generic';

export interface SkillsConfig {
  enabled: boolean;
  formats: SkillFormat[];
  destination: 'workspace' | 'custom';
  customPath?: string;
  autoGenerate: boolean;
  instructions?: Record<string, string>;
}

export interface SkillFileEntry {
  path: string;
  label: string;
  format: SkillFormat;
  title?: string;
  description?: string;
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
