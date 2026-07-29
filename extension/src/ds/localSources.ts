import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';
import { aliasToDir, fileToSpecifier, parseAliasMappings } from './aliasResolver';
import type { DsPackage } from './dsRegistry';

// Directories never worth walking for a components.json — dependencies, build
// outputs, and dot-dirs. Keeps the monorepo scan fast and avoids stray matches
// inside compiled output.
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'out', 'coverage']);

/** Recursively finds every `components.json` under `root`, skipping deps/build/dot dirs. */
function findComponentsJson(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (SKIP_DIRS.has(e.name) || e.name.startsWith('.')) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name === 'components.json') out.push(full);
    }
  };
  walk(root);
  return out;
}

/** Lists `tsconfig*.json` files directly inside `dir`. */
function tsconfigsIn(dir: string): string[] {
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => /^tsconfig.*\.json$/.test(f))
      .map((f) => path.join(dir, f));
  } catch {
    return [];
  }
}

/**
 * Builds a local-source `DsPackage` from a single shadcn `components.json`.
 * Resolves `aliases.ui` to a folder through the project's tsconfig `paths`,
 * preferring a tsconfig that also sets `jsx` (better prop extraction). Returns
 * undefined when the alias can't be resolved to an existing directory.
 */
export function buildLocalSource(
  componentsJsonPath: string,
  workspaceRoot: string,
): DsPackage | undefined {
  let importAlias: string | undefined;
  try {
    const cj = JSON.parse(fs.readFileSync(componentsJsonPath, 'utf8')) as {
      aliases?: { ui?: string };
    };
    importAlias = cj.aliases?.ui;
  } catch {
    return undefined;
  }
  if (!importAlias) return undefined;

  const dir = path.dirname(componentsJsonPath);
  let best: { rootDir: string; tsconfigPath: string; hasJsx: boolean } | undefined;
  for (const tsconfigPath of tsconfigsIn(dir)) {
    const read = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
    if (read.error || !read.config) continue;
    const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, dir);
    // `pathsBasePath` resolves via CompilerOptions' index signature (a broad
    // union), so narrow to string before use.
    const base =
      typeof parsed.options.pathsBasePath === 'string' ? parsed.options.pathsBasePath : dir;
    const mappings = parseAliasMappings(parsed.options.paths, base);
    const rootDir = aliasToDir(importAlias, mappings);
    if (!rootDir) continue;
    try {
      if (!fs.statSync(rootDir).isDirectory()) continue;
    } catch {
      continue;
    }
    const hasJsx = parsed.options.jsx !== undefined;
    // Prefer a tsconfig that sets jsx (e.g. tsconfig.app.json) over a bare one.
    if (!best || (hasJsx && !best.hasJsx)) best = { rootDir, tsconfigPath, hasJsx };
  }
  if (!best) return undefined;

  return {
    // Identity/label = workspace-relative folder (unique per source, `#`-free).
    name: path.relative(workspaceRoot, best.rootDir).split(path.sep).join('/'),
    version: '0.0.0-local',
    importPath: importAlias,
    importAlias,
    rootDir: best.rootDir,
    kind: 'local',
    tsconfigPath: best.tsconfigPath,
  };
}

/**
 * Builds a local-source `DsPackage` for an arbitrary folder the user picked
 * manually (a design system with no `components.json`). Walks up from the folder
 * to the nearest `tsconfig*.json` (preferring one that both resolves the folder
 * to an alias and sets `jsx`) to derive `importAlias` + `tsconfigPath`. When no
 * alias can be derived, `importAlias`/`importPath` are left empty for the caller
 * to fill (e.g. by prompting the user).
 */
export function buildLocalSourceFromFolder(folderPath: string, workspaceRoot: string): DsPackage {
  let dir = folderPath;
  const ancestors: string[] = [];
  while (true) {
    ancestors.push(dir);
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  let derived:
    | { importAlias?: string; tsconfigPath: string; hasJsx: boolean; hasAlias: boolean }
    | undefined;
  for (const d of ancestors) {
    for (const tsconfigPath of tsconfigsIn(d)) {
      const read = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
      if (read.error || !read.config) continue;
      const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, d);
      const base =
        typeof parsed.options.pathsBasePath === 'string' ? parsed.options.pathsBasePath : d;
      const mappings = parseAliasMappings(parsed.options.paths, base);
      const importAlias = fileToSpecifier(folderPath, mappings) ?? undefined;
      const hasJsx = parsed.options.jsx !== undefined;
      const hasAlias = !!importAlias;
      // Prefer a tsconfig that resolves an alias AND sets jsx; else keep the best so far.
      const better =
        !derived ||
        (hasAlias && !derived.hasAlias) ||
        (hasAlias === derived.hasAlias && hasJsx && !derived.hasJsx);
      if (better) derived = { importAlias, tsconfigPath, hasJsx, hasAlias };
    }
    // Stop at the nearest ancestor that yields an alias.
    if (derived?.hasAlias) break;
  }

  const importAlias = derived?.importAlias ?? '';
  return {
    name:
      path.relative(workspaceRoot, folderPath).split(path.sep).join('/') ||
      path.basename(folderPath),
    version: '0.0.0-local',
    importPath: importAlias,
    importAlias,
    rootDir: folderPath,
    kind: 'local',
    tsconfigPath: derived?.tsconfigPath,
  };
}

/**
 * Unions auto-detected local sources (`components.json`) with ones the user
 * registered manually (kind:'local' in settings), deduped by name. Registered
 * entries win — they carry the persisted excluded/manual selection. This is what
 * lets a manually-added folder (no components.json) still appear in the package
 * list alongside detected shadcn sources.
 */
export function mergeLocalSources(detected: DsPackage[], registered: DsPackage[]): DsPackage[] {
  const byName = new Map<string, DsPackage>();
  for (const s of detected) byName.set(s.name, s);
  for (const r of registered) byName.set(r.name, r);
  return [...byName.values()];
}

/**
 * Detects shadcn-style local component sources under `workspaceRoot` by scanning
 * for `components.json`. Each becomes a local `DsPackage` pointing at its
 * `aliases.ui` folder. Deduped by resolved rootDir.
 */
export function detectLocalSources(workspaceRoot: string): DsPackage[] {
  const seen = new Set<string>();
  const out: DsPackage[] = [];
  for (const configPath of findComponentsJson(workspaceRoot)) {
    const src = buildLocalSource(configPath, workspaceRoot);
    if (src?.rootDir && !seen.has(src.rootDir)) {
      seen.add(src.rootDir);
      out.push(src);
    }
  }
  return out;
}
