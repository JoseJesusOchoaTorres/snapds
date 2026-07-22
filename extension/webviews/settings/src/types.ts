import type {
  AddedProp,
  ComponentDetail,
  ComponentMeta,
  ConfigExportMode,
  ConfigImportPreviewPayload,
  ConfigStatusPayload,
  PackageMeta,
  PropMeta,
  PropOverride,
  SkillFileEntry,
  SkillFormat,
  SkillsConfig,
  UserOverride,
} from '@snapds/webview-shared';

export type {
  AddedProp,
  ComponentDetail,
  ComponentMeta,
  ConfigExportMode,
  ConfigImportPreviewPayload,
  ConfigStatusPayload,
  PackageMeta,
  PropMeta,
  PropOverride,
  SkillFileEntry,
  SkillFormat,
  SkillsConfig,
  UserOverride,
};

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
  | { type: 'confirmImportConfig'; applyOverrides: boolean }
  | { type: 'reloadPackage'; pkg: string };

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
