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
  | { type: 'propsUpdated'; componentId: string; props: Record<string, unknown> };

export type SkillFormat = 'augment' | 'generic';

export interface SkillsConfig {
  enabled: boolean;
  formats: SkillFormat[];
  destination: 'workspace' | 'custom';
  customPath?: string;
  autoGenerate: boolean;
  /** Free-text guidance per component id (pkg#Name), injected verbatim. */
  instructions?: Record<string, string>;
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
  | { type: 'requestUserOverrides' };

export type ToGallery = { type: 'componentList'; components: ComponentMeta[] };

export type ToProps =
  | { type: 'componentSchema'; component: ComponentMeta }
  | { type: 'restoreProps'; props: Record<string, unknown> };

export interface PackageMeta {
  name: string;
  enabled: boolean;
  /** All detected component names (populated once introspected). */
  components?: string[];
  /** Component names the user de-selected. */
  excluded?: string[];
  /** Component names added manually. */
  manual?: string[];
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
  | { type: 'userOverrides'; overrides: Record<string, Record<string, UserOverride>> };

export const DRAG_MIME = 'application/vnd.code.tree.snapds.component';
