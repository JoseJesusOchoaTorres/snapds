import * as fs from 'node:fs';
import * as path from 'node:path';
import type { SnapdsConfig, SnapdsConfigPackage } from './configSchema';

const CONFIG_FILENAMES = ['snapds.config.json', '.snapds.json'];

/** Result of resolving a config — includes the path of the owning file for cache keying. */
export interface ResolvedConfig {
  config: SnapdsConfig;
  /** Absolute path to the file that "owns" this resolved config (deepest in the chain). */
  owningPath: string;
}

/**
 * Finds the first snapds config file in `dir`, trying each known filename in order.
 * Returns the absolute path if found, otherwise undefined.
 */
function findConfigInDir(dir: string): string | undefined {
  for (const name of CONFIG_FILENAMES) {
    const candidate = path.join(dir, name);
    if (fs.existsSync(candidate)) return candidate;
  }
  return undefined;
}

/**
 * Reads and parses a config file. Returns undefined on parse error.
 */
function readConfigFile(filePath: string): SnapdsConfig | undefined {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as SnapdsConfig;
  } catch {
    return undefined;
  }
}

/**
 * Deep-merges two SnapdsConfig objects. `child` wins on all conflicts.
 * Arrays (excluded, manual, scopeFilters) are replaced, not concatenated.
 * Package overrides are merged per-package.
 */
function mergeConfigs(parent: SnapdsConfig, child: SnapdsConfig): SnapdsConfig {
  const merged: SnapdsConfig = { ...parent, ...child };

  if (parent.packages || child.packages) {
    const parentPkgs = new Map((parent.packages ?? []).map((p) => [p.name, p]));
    const childPkgs = new Map((child.packages ?? []).map((p) => [p.name, p]));

    const names = new Set([...parentPkgs.keys(), ...childPkgs.keys()]);
    merged.packages = [...names].map((name) => {
      const p = parentPkgs.get(name);
      const c = childPkgs.get(name);
      // biome-ignore lint/style/noNonNullAssertion: names is union of both maps' keys, so if !p then c is guaranteed present
      if (!p) return c!;
      if (!c) return p;
      return {
        ...p,
        ...c,
        overrides: { ...(p.overrides ?? {}), ...(c.overrides ?? {}) },
      };
    });
  }

  if (parent.skills || child.skills) {
    merged.skills = { ...(parent.skills ?? {}), ...(child.skills ?? {}) } as SnapdsConfig['skills'];
  }

  // Strip the `extends` from the merged result — it's a directive, not data.
  delete merged.extends;

  return merged;
}

/**
 * Loads a config file and resolves its `extends` chain recursively, returning the
 * fully-merged config. Cycles (A extends B extends A) are broken by tracking visited paths.
 * When `wsRoot` is provided, `extends` targets that resolve outside it are silently ignored.
 */
function loadWithExtends(
  filePath: string,
  visited: Set<string> = new Set(),
  wsRoot?: string,
): SnapdsConfig | undefined {
  const resolved = path.resolve(filePath);
  if (visited.has(resolved)) return undefined; // cycle guard
  visited.add(resolved);

  const config = readConfigFile(resolved);
  if (!config) return undefined;

  if (!config.extends) return config;

  const parentPath = path.resolve(path.dirname(resolved), config.extends);

  // Reject extends targets that escape the workspace root to prevent path traversal.
  if (wsRoot) {
    const normalizedRoot = path.resolve(wsRoot);
    if (!parentPath.startsWith(normalizedRoot + path.sep)) {
      return config;
    }
  }

  const parent = loadWithExtends(parentPath, visited, wsRoot);
  if (!parent) return config;

  return mergeConfigs(parent, config);
}

/**
 * Resolves the effective snapds config for a given starting directory, walking up
 * to the workspace root. Follows `extends` chains and deep-merges parent configs.
 *
 * If `startDir` is undefined, searches from `workspaceRoot` directly.
 * Returns undefined when no config file is found anywhere in the path.
 */
export function resolveConfig(
  workspaceRoot: string,
  startDir?: string,
): ResolvedConfig | undefined {
  const searchFrom = startDir ?? workspaceRoot;
  const normalizedRoot = path.resolve(workspaceRoot);

  let dir = path.resolve(searchFrom);

  while (true) {
    const configPath = findConfigInDir(dir);
    if (configPath) {
      const config = loadWithExtends(configPath, new Set(), normalizedRoot);
      if (config) return { config, owningPath: configPath };
    }

    // Stop after checking the workspace root.
    if (dir === normalizedRoot) break;

    const parent = path.dirname(dir);
    // Stop if we've hit the filesystem root (safety guard).
    if (parent === dir) break;
    dir = parent;
  }

  return undefined;
}

/**
 * Normalizes a parsed SnapdsConfigPackage, resolving the legacy `ignore` field
 * to `excluded` so the rest of the codebase only needs to handle one field.
 */
export function normalizePackage(pkg: SnapdsConfigPackage): SnapdsConfigPackage {
  if (pkg.ignore && !pkg.excluded) {
    const { ignore, ...rest } = pkg;
    return { ...rest, excluded: ignore };
  }
  return pkg;
}

/**
 * Returns the mtime of the owning config file, used as part of the introspection
 * cache key so edits automatically invalidate cached component data.
 */
export function getConfigMtime(owningPath: string): number | undefined {
  try {
    return fs.statSync(owningPath).mtimeMs;
  } catch {
    return undefined;
  }
}
