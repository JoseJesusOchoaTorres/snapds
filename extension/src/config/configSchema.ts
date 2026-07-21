import type { SkillsConfig, UserOverride } from '../util/messaging';

/**
 * Per-component overrides stored in snapds.config.json.
 * Matches UserOverride (snippet + props + addedProps) so user overrides can be
 * promoted to team-shared company config on export.
 */
export type ConfigComponentOverride = UserOverride;

export interface SnapdsConfigPackage {
  name: string;
  importPath: string;
  /** Component names excluded from the gallery. Takes precedence over the legacy `ignore` field. */
  excluded?: string[];
  /** @deprecated Use `excluded`. Accepted on read for backward compatibility. */
  ignore?: string[];
  /** Component names added manually that introspection did not detect. */
  manual?: string[];
  /**
   * Snapshot of the selected component names at export time.
   * Written by "Export config" so the file shows what is active, not just what
   * was removed. On import, if `excluded` is absent this is used to derive it:
   * `excluded = detected − components`.
   */
  components?: string[];
  /** Company-level overrides applied before user overrides (auto < company < user). */
  overrides?: Record<string, ConfigComponentOverride>;
}

export interface SnapdsConfig {
  /** Schema version. Currently "1". Used for future migrations. */
  version?: string;
  /**
   * Relative path (from this file) to a parent config to inherit from.
   * Child values override parent values on deep merge.
   */
  extends?: string;
  packages?: SnapdsConfigPackage[];
  skills?: SkillsConfig;
  scopeFilters?: string[];
}

/** Summary of what an import will change — shown in the ImportPreviewModal. */
export interface ImportChangeSummary {
  packagesAdded: string[];
  packagesRemoved: string[];
  packagesUpdated: string[];
  overridesCount: number;
  skillsChanged: boolean;
  scopeFiltersChanged: boolean;
}
