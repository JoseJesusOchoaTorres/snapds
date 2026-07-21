import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';
import type { DsPackage } from '../ds/dsRegistry';
import { getSkillsConfig } from '../ds/skillWriter';
import type { UserOverrides } from '../state/userOverrides';
import { resolveConfig } from './configResolver';
import type { SnapdsConfig, SnapdsConfigPackage } from './configSchema';

const SCOPE_FILTERS_KEY = 'snapds.scopeFilters';

export interface SerializeOptions {
  /** When true, user overrides are promoted into `packages[].overrides`. */
  includeUserOverrides: boolean;
  /**
   * - 'replace': produce a full config representing all current state.
   * - 'merge': produce only the fields that differ from the config file on disk.
   * - 'full': alias for 'replace'.
   */
  mode: 'replace' | 'merge' | 'full';
  /**
   * Current webview selection per package. When present, excluded/manual are
   * computed from detected−selected (reflects unsaved UI state accurately).
   */
  packageSelections?: { name: string; detected: string[]; selected: string[] }[];
}

/**
 * Builds a SnapdsConfig from the current extension state.
 *
 * In 'replace'/'full' mode, serializes everything.
 * In 'merge' mode, only includes fields that differ from the on-disk config so
 * the output can be shallow-merged without clobbering untouched sections.
 */
export function serializeCurrentState(
  packages: DsPackage[],
  userOverrides: UserOverrides,
  ctx: vscode.ExtensionContext,
  opts: SerializeOptions,
): SnapdsConfig {
  const skillsConfig = getSkillsConfig();
  const scopeFilters = ctx.workspaceState.get<string[]>(SCOPE_FILTERS_KEY) ?? [];

  const serializedPackages: SnapdsConfigPackage[] = packages.map((p) => {
    const pkg: SnapdsConfigPackage = {
      name: p.name,
      importPath: p.importPath,
    };

    // Prefer webview's live selection state when available — it reflects unsaved
    // toggles and gives an accurate excluded list without needing a save first.
    const sel = opts.packageSelections?.find((s) => s.name === p.name);
    if (sel) {
      const excluded = sel.detected.filter((c) => !sel.selected.includes(c));
      const manual = sel.selected.filter((c) => !sel.detected.includes(c));
      // `components` is the explicit selection snapshot — always written so the
      // file shows what is active, not just what was removed.
      if (sel.selected.length > 0) pkg.components = [...sel.selected].sort();
      if (excluded.length > 0) pkg.excluded = excluded;
      if (manual.length > 0) pkg.manual = manual;
    } else {
      if (p.excluded && p.excluded.length > 0) pkg.excluded = p.excluded;
      if (p.manual && p.manual.length > 0) pkg.manual = p.manual;
    }

    if (opts.includeUserOverrides) {
      const pkgOverrides = userOverrides[p.name];
      if (pkgOverrides && Object.keys(pkgOverrides).length > 0) {
        pkg.overrides = pkgOverrides;
      }
    }
    return pkg;
  });

  const full: SnapdsConfig = {
    version: '1',
    packages: serializedPackages,
    skills: skillsConfig,
    scopeFilters: scopeFilters.length > 0 ? scopeFilters : undefined,
  };

  if (opts.mode === 'replace' || opts.mode === 'full') {
    return full;
  }

  // 'merge' mode: diff against the existing on-disk config.
  const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!folder) return full;
  const existing = resolveConfig(folder);
  if (!existing) return full;

  return diffConfigs(existing.config, full);
}

/**
 * Returns a SnapdsConfig containing only the fields in `next` that differ from
 * `current`. Used for the 'merge' export mode.
 */
function diffConfigs(current: SnapdsConfig, next: SnapdsConfig): SnapdsConfig {
  const diff: SnapdsConfig = { version: '1' };

  // Packages: include any package whose excluded/manual/overrides changed.
  const currentPkgMap = new Map((current.packages ?? []).map((p) => [p.name, p]));
  const changedPkgs = (next.packages ?? []).filter((np) => {
    const cp = currentPkgMap.get(np.name);
    if (!cp) return true; // new package
    return (
      JSON.stringify(np.excluded) !== JSON.stringify(cp.excluded) ||
      JSON.stringify(np.manual) !== JSON.stringify(cp.manual) ||
      JSON.stringify(np.overrides) !== JSON.stringify(cp.overrides)
    );
  });
  if (changedPkgs.length > 0) diff.packages = changedPkgs;

  // Skills: include if any field differs.
  if (JSON.stringify(next.skills) !== JSON.stringify(current.skills)) {
    diff.skills = next.skills;
  }

  // Scope filters: include if changed.
  if (JSON.stringify(next.scopeFilters) !== JSON.stringify(current.scopeFilters)) {
    diff.scopeFilters = next.scopeFilters;
  }

  return diff;
}

/**
 * Writes a SnapdsConfig to disk.
 *
 * In 'replace'/'full' mode: overwrites the file entirely.
 * In 'merge' mode: reads the existing file first and deep-merges the new values on top.
 *
 * Returns the absolute path of the written file.
 */
export async function writeConfigFile(
  config: SnapdsConfig,
  filePath: string,
  mode: SerializeOptions['mode'],
): Promise<void> {
  let toWrite = config;

  if (mode === 'merge' && fs.existsSync(filePath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(filePath, 'utf8')) as SnapdsConfig;
      toWrite = mergeForWrite(existing, config);
    } catch {
      // If we can't parse the existing file, fall back to replace.
    }
  }

  // Remove undefined keys for clean output.
  const cleaned = JSON.parse(JSON.stringify(toWrite)) as SnapdsConfig;
  await vscode.workspace.fs.writeFile(
    vscode.Uri.file(filePath),
    Buffer.from(JSON.stringify(cleaned, null, 2) + '\n', 'utf8'),
  );
}

/** Merges `incoming` on top of `base` for the write path — incoming wins on conflicts. */
function mergeForWrite(base: SnapdsConfig, incoming: SnapdsConfig): SnapdsConfig {
  const result: SnapdsConfig = { ...base, ...incoming, version: '1' };

  if (base.packages || incoming.packages) {
    const baseMap = new Map((base.packages ?? []).map((p) => [p.name, p]));
    for (const pkg of incoming.packages ?? []) {
      const existing = baseMap.get(pkg.name);
      baseMap.set(pkg.name, existing ? { ...existing, ...pkg } : pkg);
    }
    result.packages = [...baseMap.values()];
  }

  if (base.skills || incoming.skills) {
    result.skills = {
      ...(base.skills ?? {}),
      ...(incoming.skills ?? {}),
    } as SnapdsConfig['skills'];
  }

  return result;
}

/** Returns the default export path: snapds.config.json at the workspace root. */
export function defaultConfigPath(): string | undefined {
  const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!folder) return undefined;
  return path.join(folder, 'snapds.config.json');
}
