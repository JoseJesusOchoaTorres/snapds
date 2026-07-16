import * as fs from 'node:fs';
import * as path from 'node:path';
import * as docgen from 'react-docgen-typescript';
import * as vscode from 'vscode';
import type { UserOverridesStore } from '../state/userOverrides';
import type { ComponentMeta, PropMeta, UserOverride } from '../util/messaging';
import type { DsPackage } from './dsRegistry';
import { enumerateComponentExports } from './exportsScan';

interface CompOverride {
  snippet?: string;
  props?: {
    [propName: string]: {
      defaultValue?: unknown;
      description?: string;
      hidden?: boolean;
    };
  };
}

interface SnapdsConfig {
  packages?: {
    [pkgName: string]: {
      ignore?: string[];
      overrides?: {
        [compName: string]: CompOverride;
      };
    };
  };
}

export class DsIntrospector {
  constructor(
    private ctx: vscode.ExtensionContext,
    private userOverrides: UserOverridesStore,
  ) {}

  /**
   * Applies USER overrides (auto < company < user) as a post-cache transform so
   * editing them never requires invalidating the parsed introspection cache.
   */
  private applyUserOverrides(p: DsPackage, comps: ComponentMeta[]): ComponentMeta[] {
    return comps.map((c) => {
      const ov = this.userOverrides.get(p.name, c.name);
      if (!ov) return c;
      const props = c.props
        .filter((pr) => !ov.props?.[pr.name]?.hidden)
        .map((pr) => {
          const po = ov.props?.[pr.name];
          if (!po) return pr;
          return {
            ...pr,
            defaultValue: po.defaultValue !== undefined ? po.defaultValue : pr.defaultValue,
            description: po.description !== undefined ? po.description : pr.description,
          };
        });
      for (const ap of ov.addedProps ?? []) {
        if (props.some((pr) => pr.name === ap.name)) continue;
        props.push({
          name: ap.name,
          type: ap.type,
          raw: ap.type,
          required: false,
          description: ap.description,
        });
      }
      return { ...c, props, snippet: ov.snippet !== undefined ? ov.snippet : c.snippet };
    });
  }

  /**
   * Returns the raw company override for a component from `snapds.config.json`, so
   * the settings UI can render the inherited (auto < company) baseline read-only.
   */
  getCompanyOverride(pkg: string, comp: string): UserOverride | undefined {
    const config = this.readSnapdsConfig();
    return config?.packages?.[pkg]?.overrides?.[comp];
  }

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

  /**
   * Returns the previously introspected components for `p` if they are still in
   * cache, without parsing anything. Lets callers show counts instantly on load.
   */
  getCached(p: DsPackage): ComponentMeta[] | undefined {
    const c = this.ctx.globalState.get<ComponentMeta[]>(this.getCacheKey(p));
    return c && this.applyUserOverrides(p, c);
  }

  async introspect(p: DsPackage, opts: { force?: boolean } = {}): Promise<ComponentMeta[]> {
    const cacheKey = this.getCacheKey(p);
    if (!opts.force) {
      const cached = this.ctx.globalState.get<ComponentMeta[]>(cacheKey);
      if (cached) return this.applyUserOverrides(p, cached);
    }

    const pkgDir = await this.resolvePackageDir(p);
    const entry = this.resolveTypingsEntry(pkgDir);

    // Component names whose only props were standard DOM/SVG attributes from
    // `@types/react` (all stripped by the prop filter). Populated as a side
    // effect of parsing so we can label them instead of showing "no props".
    const domOnly = new Set<string>();
    const parser = p.tsconfigPath
      ? docgen.withCustomConfig(p.tsconfigPath, this.parserOptions(domOnly))
      : docgen.withDefaultConfig(this.parserOptions(domOnly));

    const entryFiles = entry ? [entry] : this.collectComponentFiles(pkgDir);
    const parsed = parser.parse(entryFiles);

    const config = this.readSnapdsConfig();
    const pkgConfig = config?.packages?.[p.name];

    // Public component surface. When the entry is a barrel that re-exports from
    // sub-files, this resolves the real (re-)exported value names via the TS
    // Compiler API — used below to merge in components docgen skips entirely.
    const exportedComponents = enumerateComponentExports(entry, p.tsconfigPath);
    const exportedNames = new Set(exportedComponents.map((e) => e.name));

    // react-docgen-typescript only follows a barrel's re-exports shallowly and
    // returns empty props for many re-exported components. When the entry left
    // any exported component without props, parse the concrete sibling source
    // files and index their props by component name to backfill them.
    const parsedNames = new Set(parsed.map((c) => c.displayName).filter(Boolean));
    const someEmpty = parsed.some(
      (c) => c.displayName && /^[A-Z]/.test(c.displayName) && Object.keys(c.props).length === 0,
    );
    const missingExports = [...exportedNames].some((n) => !parsedNames.has(n));
    const siblingProps = new Map<string, PropMeta[]>();
    if (entry && (someEmpty || missingExports)) {
      const siblings = this.collectComponentFiles(path.dirname(entry)).filter((f) => f !== entry);
      if (siblings.length > 0) {
        for (const c of parser.parse(siblings)) {
          if (!c.displayName || !/^[A-Z]/.test(c.displayName)) continue;
          const ps = Object.values(c.props).map((prop) => normalizeProp(prop));
          const prev = siblingProps.get(c.displayName);
          if (!prev || ps.length > prev.length) siblingProps.set(c.displayName, ps);
        }
      }
    }

    const components: ComponentMeta[] = parsed
      .filter((c) => c.displayName && c.displayName !== '__type' && /^[A-Z]/.test(c.displayName))
      .filter((c) => {
        // react-docgen-typescript surfaces re-exported *type* declarations
        // (e.g. `DatePickerProps`, `Theme`) as empty "components". Gate the
        // parsed surface by the real value exports so those type-only names
        // never reach the gallery. Keep static sub-components (`Foo.Bar`) and
        // skip gating entirely if the export scan yielded nothing.
        if (exportedNames.size > 0 && !exportedNames.has(c.displayName) && !c.displayName.includes('.')) {
          return false;
        }
        return true;
      })
      .filter((c) => {
        // Repository Config (Ignore list)
        if (pkgConfig?.ignore && pkgConfig.ignore.includes(c.displayName)) {
          return false;
        }
        // Automatic Filtering (@internal)
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
        // Backfill props docgen dropped for barrel-re-exported components.
        if (props.length === 0) {
          const enriched = siblingProps.get(c.displayName);
          if (enriched && enriched.length > 0) props = enriched;
        }
        props = this.applyCompanyPropOverrides(props, compOverride);

        return {
          id: `${p.name}#${c.displayName}`,
          name: c.displayName,
          description: c.description || undefined,
          props,
          snippet: compOverride?.snippet,
          // Icon/wrapper components typed only with `React.SVGProps`/DOM attrs
          // end up with zero props after filtering; flag them so the UI shows a
          // clear label instead of the generic "no documented props" message.
          standardPropsOnly: props.length === 0 && domOnly.has(c.displayName),
        };
      });

    // A1: react-docgen-typescript misses components declared as generic call
    // signatures (polymorphic `as`-style components). Merge in whatever docgen
    // skipped entirely, backfilling props from the sibling scan when available.
    const detectedNames = new Set(components.map((c) => c.name));
    for (const exp of exportedComponents) {
      if (detectedNames.has(exp.name)) continue;
      if (pkgConfig?.ignore && pkgConfig.ignore.includes(exp.name)) continue;
      if (exp.description && exp.description.includes('@internal')) continue;
      const compOverride = pkgConfig?.overrides?.[exp.name];
      const props = this.applyCompanyPropOverrides(siblingProps.get(exp.name) ?? [], compOverride);
      components.push({
        id: `${p.name}#${exp.name}`,
        name: exp.name,
        description: exp.description || undefined,
        props,
        snippet: compOverride?.snippet,
      });
      detectedNames.add(exp.name);
    }

    // Only cache non-empty results so a transient empty scan can never "stick"
    // and leave the settings UI perpetually showing "Loading components…".
    if (components.length > 0) {
      await this.ctx.globalState.update(cacheKey, components);
    }
    return this.applyUserOverrides(p, components);
  }

  async invalidate(p: DsPackage): Promise<void> {
    await this.ctx.globalState.update(this.getCacheKey(p), undefined);
  }

  /** Applies company (`snapds.config.json`) prop overrides: hide + default/description. */
  private applyCompanyPropOverrides(props: PropMeta[], compOverride?: CompOverride): PropMeta[] {
    if (!compOverride?.props) return props;
    return props
      .filter((prop) => !compOverride.props?.[prop.name]?.hidden)
      .map((prop) => {
        const propOverride = compOverride.props?.[prop.name];
        if (!propOverride) return prop;
        return {
          ...prop,
          defaultValue:
            propOverride.defaultValue !== undefined ? propOverride.defaultValue : prop.defaultValue,
          description:
            propOverride.description !== undefined ? propOverride.description : prop.description,
        };
      });
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

  private parserOptions(domOnly?: Set<string>): docgen.ParserOptions {
    return {
      savePropValueAsString: false,
      shouldExtractLiteralValuesFromEnum: true,
      shouldRemoveUndefinedFromOptional: true,
      propFilter: (prop, component) => {
        const fromReact =
          !!prop.parent && /node_modules\/@types\/react/.test(prop.parent.fileName);
        if (fromReact) {
          // Remember which components had a prop stripped purely because it is
          // a standard React DOM/SVG attribute — used to label DOM-only comps.
          if (domOnly && component?.name) domOnly.add(component.name);
          return false;
        }
        return true;
      },
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
      const uris = await vscode.workspace.findFiles(
        `**/node_modules/${p.name}/package.json`,
        null,
        1,
      );
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
    const pkgJson = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8')) as {
      types?: string;
      typings?: string;
      main?: string;
    };
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
        if (e.isDirectory()) {
          if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
          walk(path.join(d, e.name));
        } else if (/\.(d\.ts|tsx)$/.test(e.name)) out.push(path.join(d, e.name));
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
    enumValues = values.map((v) => String(v.value).replace(/^"|"$/g, '')).filter(Boolean);
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
