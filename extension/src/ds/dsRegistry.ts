import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';

export { applyWhitelist } from './whitelist';

export interface DsPackage {
  name: string;
  version: string;
  importPath: string;
  tsconfigPath?: string;
  /** Component names the user explicitly de-selected. Anything not listed is auto-included. */
  excluded?: string[];
  /** Component names the user added manually that introspection did not detect. */
  manual?: string[];
}

export class DsRegistry {
  list(): DsPackage[] {
    const raw = vscode.workspace.getConfiguration('snapds').get<DsPackage[]>('packages') ?? [];
    // Backward-compat: migrate the old `blacklist` field to `excluded` in memory.
    return raw.map((p) => {
      const legacy = (p as DsPackage & { blacklist?: string[] }).blacklist;
      if (legacy && !p.excluded) {
        return { ...p, excluded: legacy };
      }
      return p;
    });
  }

  /**
   * Returns the active package descriptor, or undefined if none is set.
   */
  getActive(): DsPackage | undefined {
    const name = vscode.workspace.getConfiguration('snapds').get<string>('activePackage');
    if (!name) return undefined;
    return this.list().find((p) => p.name === name);
  }

  /**
   * Sets the active package in workspace settings.
   * This is the package whose components are shown in the props panel.
   */
  async setActive(name: string): Promise<void> {
    await vscode.workspace
      .getConfiguration('snapds')
      .update('activePackage', name, vscode.ConfigurationTarget.Workspace);
  }

  /**
   * Discovers all packages in the workspace by scanning package.json files.
   * Returns a sorted array of unique package names.
   */
  async discoverAllPackagesInWorkspace(): Promise<string[]> {
    const packageJsonUris = await vscode.workspace.findFiles(
      '**/package.json',
      '**/node_modules/**',
    );

    const foundPackages = new Set<string>();

    for (const uri of packageJsonUris) {
      try {
        const content = fs.readFileSync(uri.fsPath, 'utf8');
        const json = JSON.parse(content);

        if (json.dependencies) {
          for (const pkg of Object.keys(json.dependencies)) foundPackages.add(pkg);
        }
        if (json.devDependencies) {
          for (const pkg of Object.keys(json.devDependencies)) foundPackages.add(pkg);
        }
      } catch {
        // Ignored: skip unreadable/invalid package.json files.
      }
    }

    return Array.from(foundPackages).sort();
  }

  /** Writes the entire package list in a single settings.json update. */
  async saveAll(list: DsPackage[]): Promise<void> {
    await vscode.workspace
      .getConfiguration('snapds')
      .update('packages', list, vscode.ConfigurationTarget.Workspace);
  }

  /**
   * Resolves a package descriptor (version + tsconfig) WITHOUT persisting it to
   * settings. Used to introspect a package for the settings UI before the user
   * commits their selection. Returns undefined if the package cannot be located.
   */
  async resolveDescriptor(name: string): Promise<DsPackage | undefined> {
    const root = this.firstWorkspaceFolder();
    const pkgJsonPath = await this.findInNodeModules(root, name, 'package.json');
    if (!pkgJsonPath) return undefined;
    let version = 'unknown';
    try {
      version = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8')).version || 'unknown';
    } catch {
      // keep 'unknown'
    }
    const tsconfigPath = this.walkUpFor('tsconfig.json', path.dirname(pkgJsonPath), root);
    return { name, version, importPath: name, tsconfigPath };
  }

  private firstWorkspaceFolder(): string {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) throw new Error('Open a workspace folder first.');
    return folder.uri.fsPath;
  }

  /**
   * Tries to resolve a file inside a package's node_modules using standard Node resolution logic.
   * Falls back to a workspace-wide search if not found.
   */
  private async findInNodeModules(
    root: string,
    pkg: string,
    file: string,
  ): Promise<string | undefined> {
    // Standard upward resolution like Node does
    let dir = root;
    while (true) {
      const candidate = path.join(dir, 'node_modules', pkg, file);
      if (fs.existsSync(candidate)) return candidate;
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }

    try {
      const packageJsonPath = require.resolve(`${pkg}/${file}`, {
        paths: [root],
      });
      if (fs.existsSync(packageJsonPath)) return packageJsonPath;
    } catch {
      // Ignored
    }

    // Monorepo deep search: look inside all node_modules in the workspace
    // This handles cases where a package is only installed in a nested app (e.g. apps/my-app/node_modules)
    try {
      const uris = await vscode.workspace.findFiles(`**/node_modules/${pkg}/${file}`, null, 1);
      if (uris.length > 0) {
        return uris[0].fsPath;
      }
    } catch {
      // Ignored
    }

    // What if the package is a local workspace package itself? (e.g. apps/my-local-pkg)
    // We can search for its package.json without node_modules
    try {
      const uris = await vscode.workspace.findFiles(`**/package.json`, '**/node_modules/**');
      for (const uri of uris) {
        try {
          const content = fs.readFileSync(uri.fsPath, 'utf8');
          const json = JSON.parse(content);
          if (json.name === pkg) return uri.fsPath;
        } catch {
          // Ignored
        }
      }
    } catch {
      // Ignored
    }

    return undefined;
  }

  /**
   * Walks up from `startDir` looking for `filename`, stopping at `stopAt` (exclusive).
   * Returns undefined if the file is not found in the path.
   */
  private walkUpFor(filename: string, startDir: string, stopAt: string): string | undefined {
    let dir = startDir;
    while (true) {
      const candidate = path.join(dir, filename);
      if (fs.existsSync(candidate)) return candidate;
      if (dir === stopAt) return undefined;
      const parent = path.dirname(dir);
      if (parent === dir) return undefined;
      dir = parent;
    }
  }
}
