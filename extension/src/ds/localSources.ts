import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';
import { aliasToDir, parseAliasMappings } from './aliasResolver';
import type { DsPackage } from './dsRegistry';

/** Recursively finds every `components.json` under `root`, skipping node_modules/dot dirs. */
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
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
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
