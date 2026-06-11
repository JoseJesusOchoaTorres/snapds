import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as docgen from 'react-docgen-typescript';
import type { DsPackage } from './dsRegistry';
import type { ComponentMeta, PropMeta } from '../util/messaging';

interface SnapdsConfig {
  packages?: {
    [pkgName: string]: {
      ignore?: string[];
      overrides?: {
        [compName: string]: {
          snippet?: string;
          props?: {
            [propName: string]: {
              defaultValue?: unknown;
              description?: string;
              hidden?: boolean;
            }
          }
        }
      }
    }
  }
}

export class DsIntrospector {
  constructor(private ctx: vscode.ExtensionContext) {}

  private getCacheKey(p: DsPackage): string {
    let key = `ds.cache.${p.name}@${p.version}`;
    const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (folder) {
      for (const file of ['snapds.config.json', '.snapds.json']) {
        const configPath = path.join(folder, file);
        if (fs.existsSync(configPath)) {
          try {
            const stat = fs.statSync(configPath);
            key += `@${stat.mtimeMs}`;
            break;
          } catch {}
        }
      }
    }
    return key;
  }

  async introspect(p: DsPackage, opts: { force?: boolean } = {}): Promise<ComponentMeta[]> {
    const cacheKey = this.getCacheKey(p);
    if (!opts.force) {
      const cached = this.ctx.globalState.get<ComponentMeta[]>(cacheKey);
      if (cached) return cached;
    }

    const pkgDir = await this.resolvePackageDir(p);
    const entry = this.resolveTypingsEntry(pkgDir);

    const parser = p.tsconfigPath
      ? docgen.withCustomConfig(p.tsconfigPath, this.parserOptions())
      : docgen.withDefaultConfig(this.parserOptions());

    const files = entry ? [entry] : this.collectComponentFiles(pkgDir);
    const parsed = parser.parse(files);

    const config = this.readSnapdsConfig();
    const pkgConfig = config?.packages?.[p.name];

    const components: ComponentMeta[] = parsed
      .filter((c) => c.displayName && c.displayName !== '__type' && /^[A-Z]/.test(c.displayName))
      .filter((c) => {
        // Level 3: Local Override (Blacklist in Workspace Settings)
        if (p.blacklist && p.blacklist.includes(c.displayName)) {
          return false;
        }
        // Level 2: Repository Config (Ignore list)
        if (pkgConfig?.ignore && pkgConfig.ignore.includes(c.displayName)) {
          return false;
        }
        // Level 1: Automatic Filtering (@internal)
        if (c.tags && c.tags.internal !== undefined) {
          return false;
        }
        if (c.description && c.description.includes('@internal')) {
          return false;
        }
        return true;
      })
      .map((c) => {
        const compOverride = pkgConfig?.overrides?.[c.displayName];
        let props = Object.values(c.props).map((prop) => normalizeProp(prop));

        if (compOverride?.props) {
          props = props
            .filter((prop) => {
              const propOverride = compOverride.props?.[prop.name];
              if (propOverride?.hidden) return false;
              return true;
            })
            .map((prop) => {
              const propOverride = compOverride.props?.[prop.name];
              if (!propOverride) return prop;
              return {
                ...prop,
                defaultValue: propOverride.defaultValue !== undefined ? propOverride.defaultValue : prop.defaultValue,
                description: propOverride.description !== undefined ? propOverride.description : prop.description,
              };
            });
        }

        return {
          id: `${p.name}#${c.displayName}`,
          name: c.displayName,
          description: c.description || undefined,
          props,
          snippet: compOverride?.snippet,
        };
      });

    await this.ctx.globalState.update(cacheKey, components);
    return components;
  }

  async invalidate(p: DsPackage): Promise<void> {
    await this.ctx.globalState.update(this.getCacheKey(p), undefined);
  }

  private readSnapdsConfig(): SnapdsConfig | undefined {
    const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!folder) return undefined;
    for (const file of ['snapds.config.json', '.snapds.json']) {
      const configPath = path.join(folder, file);
      if (fs.existsSync(configPath)) {
        try {
          return JSON.parse(fs.readFileSync(configPath, 'utf8'));
        } catch {
          return undefined;
        }
      }
    }
    return undefined;
  }

  private parserOptions(): docgen.ParserOptions {
    return {
      savePropValueAsString: false,
      shouldExtractLiteralValuesFromEnum: true,
      shouldRemoveUndefinedFromOptional: true,
      propFilter: (prop) =>
        !prop.parent || !/node_modules\/@types\/react/.test(prop.parent.fileName),
    };
  }

  private async resolvePackageDir(p: DsPackage): Promise<string> {
    const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!folder) throw new Error('No workspace folder open.');
    let dir = folder;
    while (true) {
      const candidate = path.join(dir, 'node_modules', p.name);
      if (fs.existsSync(candidate)) return candidate;
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }

    try {
      const packageJsonPath = require.resolve(`${p.name}/package.json`, { paths: [folder] });
      if (fs.existsSync(packageJsonPath)) return path.dirname(packageJsonPath);
    } catch {
      // Ignored
    }

    // Monorepo deep search
    try {
      const uris = await vscode.workspace.findFiles(`**/node_modules/${p.name}/package.json`, null, 1);
      if (uris.length > 0) return path.dirname(uris[0].fsPath);
    } catch {
      // Ignored
    }

    // Workspace local packages search
    try {
      const uris = await vscode.workspace.findFiles(`**/package.json`, '**/node_modules/**');
      for (const uri of uris) {
        try {
          const content = fs.readFileSync(uri.fsPath, 'utf8');
          const json = JSON.parse(content);
          if (json.name === p.name) return path.dirname(uri.fsPath);
        } catch {
          // Ignored
        }
      }
    } catch {
      // Ignored
    }

    throw new Error(`Package directory not found for ${p.name}`);
  }

  private resolveTypingsEntry(pkgDir: string): string | undefined {
    const pkgJson = JSON.parse(
      fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'),
    ) as { types?: string; typings?: string; main?: string };
    const typesField = pkgJson.types ?? pkgJson.typings;
    if (typesField) {
      const abs = path.join(pkgDir, typesField);
      if (fs.existsSync(abs)) return abs;
    }
    if (pkgJson.main) {
      const guess = path.join(pkgDir, pkgJson.main.replace(/\.[cm]?jsx?$/, '.d.ts'));
      if (fs.existsSync(guess)) return guess;
    }
    return undefined;
  }

  private collectComponentFiles(pkgDir: string): string[] {
    const out: string[] = [];
    const walk = (d: string) => {
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(d, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        if (e.isDirectory()) walk(path.join(d, e.name));
        else if (/\.(d\.ts|tsx)$/.test(e.name)) out.push(path.join(d, e.name));
      }
    };
    walk(pkgDir);
    return out;
  }
}

function normalizeProp(prop: docgen.PropItem): PropMeta {
  const raw = prop.type.name;
  let type: PropMeta['type'] = raw;
  let enumValues: string[] | undefined;

  if (prop.type.name === 'enum' && Array.isArray((prop.type as { value?: unknown }).value)) {
    const values = (prop.type as { value: Array<{ value: string }> }).value;
    enumValues = values
      .map((v) => String(v.value).replace(/^"|"$/g, ''))
      .filter(Boolean);
    type = 'enum';
  } else if (raw === 'boolean') type = 'boolean';
  else if (raw === 'number') type = 'number';
  else if (raw === 'string') type = 'string';
  else if (/=>/.test(raw)) type = 'function';
  else if (/ReactNode|ReactElement|JSX\.Element/.test(raw)) type = 'ReactNode';

  return {
    name: prop.name,
    type,
    raw,
    required: prop.required,
    defaultValue: prop.defaultValue ? prop.defaultValue.value : undefined,
    description: prop.description || undefined,
    enumValues,
  };
}
