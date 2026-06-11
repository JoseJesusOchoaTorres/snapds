import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';

export interface DsPackage {
  name: string;
  version: string;
  importPath: string;
  tsconfigPath?: string;
  blacklist?: string[];
}

export class DsRegistry {
  constructor(private ctx: vscode.ExtensionContext) {}

  list(): DsPackage[] {
    return vscode.workspace.getConfiguration('snapds').get<DsPackage[]>('packages') ?? [];
  }

  getActive(): DsPackage | undefined {
    const name = vscode.workspace.getConfiguration('snapds').get<string>('activePackage');
    if (!name) return undefined;
    return this.list().find((p) => p.name === name);
  }

  async setActive(name: string): Promise<void> {
    await vscode.workspace
      .getConfiguration('snapds')
      .update('activePackage', name, vscode.ConfigurationTarget.Workspace);
  }

  async importInstalledPackage(name: string): Promise<DsPackage> {
    const root = this.firstWorkspaceFolder();
    const pkgJsonPath = this.findInNodeModules(root, name, 'package.json');
    if (!pkgJsonPath) {
      throw new Error(`Package "${name}" not found in node_modules of the active workspace.`);
    }
    const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8')) as { version: string };

    const tsconfigPath = this.walkUpFor('tsconfig.json', path.dirname(pkgJsonPath), root);

    const entry: DsPackage = {
      name,
      version: pkgJson.version,
      importPath: name,
      tsconfigPath,
    };

    const cfg = vscode.workspace.getConfiguration('snapds');
    const list = (cfg.get<DsPackage[]>('packages') ?? []).filter((p) => p.name !== name);
    list.push(entry);
    await cfg.update('packages', list, vscode.ConfigurationTarget.Workspace);
    await this.setActive(name);
    return entry;
  }

  async discoverAllPackagesInWorkspace(): Promise<string[]> {
    const packageJsonUris = await vscode.workspace.findFiles(
      '**/package.json',
      '**/node_modules/**'
    );

    const foundPackages = new Set<string>();

    for (const uri of packageJsonUris) {
      try {
        const content = fs.readFileSync(uri.fsPath, 'utf8');
        const json = JSON.parse(content);

        if (json.dependencies) {
          Object.keys(json.dependencies).forEach(pkg => foundPackages.add(pkg));
        }
        if (json.devDependencies) {
          Object.keys(json.devDependencies).forEach(pkg => foundPackages.add(pkg));
        }
      } catch (e) {
        // Ignored
      }
    }

    return Array.from(foundPackages).sort();
  }

  async updatePackage(name: string, enabled: boolean, blacklist?: string[]): Promise<void> {
    const cfg = vscode.workspace.getConfiguration('snapds');
    let list = this.list();

    if (enabled) {
      // Add it if it's not there, or update blacklist if it is
      const existing = list.find(p => p.name === name);
      if (!existing) {
        const root = this.firstWorkspaceFolder();
        const pkgJsonPath = await this.findInNodeModules(root, name, 'package.json');
        let version = 'unknown';
        let tsconfigPath: string | undefined;

        if (pkgJsonPath) {
          try {
            const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
            version = pkgJson.version || 'unknown';
            tsconfigPath = this.walkUpFor('tsconfig.json', path.dirname(pkgJsonPath), root);
          } catch {}
        }

        list.push({
          name,
          version,
          importPath: name,
          tsconfigPath,
          blacklist: blacklist || []
        });
      } else {
        existing.blacklist = blacklist || [];
      }
    } else {
      // Remove it
      list = list.filter(p => p.name !== name);
    }

    await cfg.update('packages', list, vscode.ConfigurationTarget.Workspace);
  }

  private firstWorkspaceFolder(): string {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) throw new Error('Open a workspace folder first.');
    return folder.uri.fsPath;
  }

  private async findInNodeModules(root: string, pkg: string, file: string): Promise<string | undefined> {
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
      const packageJsonPath = require.resolve(`${pkg}/${file}`, { paths: [root] });
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
