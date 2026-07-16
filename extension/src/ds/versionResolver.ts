import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';

export interface PackageInstallation {
  version: string;
  /** Absolute path to the package directory inside node_modules */
  dir: string;
  /** The directory that owns the node_modules folder — effectively the "app root" */
  appRoot: string;
}

/**
 * Finds every installation of pkgName across the workspace.
 *
 * Strategy: search for all package.json files outside node_modules (these are
 * "app roots"), then synchronously probe each one for a local installation of
 * pkgName. This is O(N small reads) and avoids the multi-second scan that
 * findFiles('** /node_modules/...') triggers when node_modules exclusions are
 * overridden. Results are deduplicated by version and sorted highest-semver-first.
 */
export async function discoverInstallations(pkgName: string): Promise<PackageInstallation[]> {
  // findFiles respects files.exclude by default when no exclude is passed.
  // Passing null removes ALL exclusions; we want the opposite — use default
  // exclusions so node_modules folders are skipped automatically.
  const appRootUris = await vscode.workspace.findFiles('**/package.json', '**/node_modules/**');

  const byVersion = new Map<string, PackageInstallation>();

  for (const uri of appRootUris) {
    const appRoot = path.dirname(uri.fsPath);
    const pkgDir = path.join(appRoot, 'node_modules', pkgName);
    const pkgJsonPath = path.join(pkgDir, 'package.json');

    if (!fs.existsSync(pkgJsonPath)) continue;

    try {
      const json = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8')) as { version?: string };
      const version = json.version ?? 'unknown';
      const existing = byVersion.get(version);
      // Keep the entry with the shortest path (prefer direct symlinks)
      if (!existing || pkgDir.length < existing.dir.length) {
        byVersion.set(version, { version, dir: pkgDir, appRoot });
      }
    } catch {
      // unreadable — skip
    }
  }

  return [...byVersion.values()].sort(bySemverDesc);
}

/**
 * Walks up from filePath looking for the nearest node_modules/{pkgName} directory
 * that matches one of the known installations. Returns undefined when none is found
 * along the path — the caller should fall back to latestInstallation().
 */
export function resolveForFile(
  filePath: string,
  pkgName: string,
  installations: PackageInstallation[],
): PackageInstallation | undefined {
  if (installations.length === 0) return undefined;
  const dirSet = new Map(installations.map((i) => [i.dir, i]));
  let dir = path.dirname(filePath);
  while (true) {
    const candidate = path.join(dir, 'node_modules', pkgName);
    const found = dirSet.get(candidate);
    if (found) return found;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

/**
 * Walks up from filePath to find the nearest package.json that is not inside
 * a node_modules directory. Stops at workspaceRoot to avoid false positives
 * from parent directories outside the project.
 */
export function findNearestPackageJson(
  filePath: string,
  workspaceRoot?: string,
): string | undefined {
  const stop = workspaceRoot ? path.dirname(workspaceRoot) : undefined;
  let dir = path.dirname(filePath);
  while (true) {
    if (dir.split(path.sep).includes('node_modules')) break;
    const candidate = path.join(dir, 'package.json');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    if (stop && dir === stop) break;
    dir = parent;
  }
  return undefined;
}

/** Returns the highest-semver installation (first after sort). */
export function latestInstallation(
  installations: PackageInstallation[],
): PackageInstallation | undefined {
  return installations[0];
}

function appRootFromDir(pkgDir: string): string {
  const idx = pkgDir.lastIndexOf(`${path.sep}node_modules${path.sep}`);
  return idx === -1 ? pkgDir : pkgDir.substring(0, idx);
}

function parseSemver(v: string): number[] {
  return v
    .replace(/^[^0-9]*/, '')
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
}

function bySemverDesc(a: PackageInstallation, b: PackageInstallation): number {
  const av = parseSemver(a.version);
  const bv = parseSemver(b.version);
  for (let i = 0; i < 3; i++) {
    const diff = (bv[i] ?? 0) - (av[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
