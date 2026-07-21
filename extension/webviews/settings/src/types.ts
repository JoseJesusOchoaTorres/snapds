import type { ComponentMeta, PropMeta } from '@snapds/webview-shared';

export type { ComponentMeta, PropMeta };

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

export interface SkillFileEntry {
  path: string;
  label: string;
  format: SkillFormat;
  title?: string;
  description?: string;
}

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
      packageSelections?: { name: string; detected: string[]; selected: string[] }[];
    }
  | { type: 'importConfig'; filePath?: string }
  | { type: 'requestConfigStatus' }
  | { type: 'confirmImportConfig'; applyOverrides: boolean };

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
