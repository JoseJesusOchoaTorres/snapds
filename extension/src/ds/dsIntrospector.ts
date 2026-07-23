import * as fs from 'node:fs';
import * as path from 'node:path';
import * as docgen from 'react-docgen-typescript';
import * as ts from 'typescript';
import * as vscode from 'vscode';
import { getConfigMtime, normalizePackage, resolveConfig } from '../config/configResolver';
import type { ConfigComponentOverride, SnapdsConfigPackage } from '../config/configSchema';
import type { UserOverridesStore } from '../state/userOverrides';
import type { ComponentMeta, PropMeta, UserOverride } from '../util/messaging';
import type { DsPackage } from './dsRegistry';
import { buildCompilerOptions, enumerateComponentExports } from './exportsScan';

/**
 * Schema/code version of the introspection cache. Bump this whenever the
 * introspection logic changes in a way that would invalidate previously cached
 * results (e.g. new prop extraction). This is part of the cache key, so bumping
 * it forces a fresh parse for everyone without clearing unrelated globalState.
 */
const CACHE_SCHEMA_VERSION = 3;

export class DsIntrospector {
  /** Deduplicates concurrent introspect() calls for the same package. */
  private inFlight = new Map<string, Promise<ComponentMeta[]>>();

  /**
   * In-process memo for resolveConfig(). During a single startup or save
   * operation the config file doesn't change, so there's no reason to read and
   * parse it from disk on every getCacheKey() / doIntrospect() call. We check
   * the owning file's mtime on each access — one statSync instead of a full
   * JSON read+parse — and re-resolve only when the file actually changed.
   */
  private configMemo: {
    folder: string;
    owningPath: string | null;
    mtime: number | undefined;
    result: ReturnType<typeof resolveConfig>;
  } | null = null;

  constructor(
    private ctx: vscode.ExtensionContext,
    private userOverrides: UserOverridesStore,
  ) {}

  private resolveConfigCached(folder: string): ReturnType<typeof resolveConfig> {
    if (this.configMemo?.folder !== folder) {
      this.configMemo = null;
    }

    if (this.configMemo) {
      const currentMtime = this.configMemo.owningPath
        ? getConfigMtime(this.configMemo.owningPath)
        : undefined;
      if (currentMtime === this.configMemo.mtime) return this.configMemo.result;
    }

    const result = resolveConfig(folder);
    const owningPath = result?.owningPath ?? null;
    const mtime = owningPath ? getConfigMtime(owningPath) : undefined;
    this.configMemo = { folder, owningPath, mtime, result };
    return result;
  }

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
    const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!folder) return undefined;
    const resolved = this.resolveConfigCached(folder);
    const pkgConfig = resolved?.config.packages?.find((p) => p.name === pkg);
    return pkgConfig?.overrides?.[comp];
  }

  /**
   * Reads the installed version of a package directly from node_modules.
   * Uses a synchronous upward walk — covers standard layouts and most monorepos.
   * Falls back to `p.version` (the registry-stored value) if the package isn't
   * found via the sync walk (e.g. deep pnpm virtual store paths).
   */
  private resolveInstalledVersion(p: DsPackage): string {
    const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!folder) return p.version;
    let dir = folder;
    while (true) {
      const pkgJsonPath = path.join(dir, 'node_modules', p.name, 'package.json');
      if (fs.existsSync(pkgJsonPath)) {
        try {
          return (
            (JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8')) as { version?: string }).version ??
            p.version
          );
        } catch {
          return p.version;
        }
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    return p.version;
  }

  private getCacheKey(p: DsPackage, versionOverride?: string): string {
    const installedVersion = versionOverride ?? this.resolveInstalledVersion(p);
    let key = `ds.cache.v${CACHE_SCHEMA_VERSION}.${p.name}@${installedVersion}`;
    const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (folder) {
      const resolved = this.resolveConfigCached(folder);
      if (resolved) {
        const mtime = getConfigMtime(resolved.owningPath);
        // Include both the path and mtime so different sub-app configs never
        // collide in the global cache even if their versions match.
        key += `@${resolved.owningPath}@${mtime ?? 0}`;
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

  /**
   * Introspects a package and returns its components. When `opts.dir` and
   * `opts.version` are provided the introspector uses that specific installation
   * directory instead of auto-resolving, enabling per-app version switching.
   */
  async introspect(
    p: DsPackage,
    opts: { force?: boolean; dir?: string; version?: string } = {},
  ): Promise<ComponentMeta[]> {
    const cacheKey = this.getCacheKey(p, opts.version);
    if (!opts.force) {
      const cached = this.ctx.globalState.get<ComponentMeta[]>(cacheKey);
      if (cached) return this.applyUserOverrides(p, cached);

      // If the same package is already being parsed (e.g. startup warm-up races
      // with a requestComponents message), await the in-flight promise instead of
      // starting a redundant parse.
      const inflight = this.inFlight.get(cacheKey);
      if (inflight) return inflight.then((raw) => this.applyUserOverrides(p, raw));
    }

    const promise = this.doIntrospect(p, opts);
    this.inFlight.set(cacheKey, promise);
    promise.finally(() => this.inFlight.delete(cacheKey));
    const raw = await promise;
    return this.applyUserOverrides(p, raw);
  }

  private async doIntrospect(
    p: DsPackage,
    opts: { dir?: string; version?: string } = {},
  ): Promise<ComponentMeta[]> {
    const cacheKey = this.getCacheKey(p, opts.version);

    const pkgDir = opts.dir ?? (await this.resolvePackageDir(p));
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

    const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    const resolved = folder ? this.resolveConfigCached(folder) : undefined;
    const pkgConfig: SnapdsConfigPackage | undefined = resolved?.config.packages
      ?.map(normalizePackage)
      .find((pkg) => pkg.name === p.name);

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

    // Create one TS program for the whole package — reused by extractInterfaceProps
    // so we don't pay the ts.createProgram cost once per component.
    const tsProgram = entry
      ? ts.createProgram([entry], buildCompilerOptions(p.tsconfigPath))
      : undefined;

    const components: ComponentMeta[] = parsed
      .filter((c) => c.displayName && c.displayName !== '__type' && /^[A-Z]/.test(c.displayName))
      .filter((c) => {
        // react-docgen-typescript surfaces re-exported *type* declarations
        // (e.g. `DatePickerProps`, `Theme`) as empty "components". Gate the
        // parsed surface by the real value exports so those type-only names
        // never reach the gallery. Keep static sub-components (`Foo.Bar`) and
        // skip gating entirely if the export scan yielded nothing.
        if (
          exportedNames.size > 0 &&
          !exportedNames.has(c.displayName) &&
          !c.displayName.includes('.')
        ) {
          return false;
        }
        return true;
      })
      .filter((c) => {
        // Repository Config (Ignore list)
        if (pkgConfig?.excluded?.includes(c.displayName)) {
          return false;
        }
        // Automatic Filtering (@internal)
        if (c.tags && c.tags.internal !== undefined) {
          return false;
        }
        if (c.description?.includes('@internal')) {
          return false;
        }
        return true;
      })
      .map((c) => {
        const compOverride = pkgConfig?.overrides?.[c.displayName];
        let props = Object.values(c.props).map((prop) => normalizeProp(prop));
        // Backfill props docgen dropped for barrel-re-exported components.
        if (props.length === 0) {
          const fromSibling =
            siblingProps.get(c.displayName) ?? siblingProps.get(`${c.displayName}Props`);
          if (fromSibling && fromSibling.length > 0) {
            props = fromSibling;
          } else if (tsProgram && entry) {
            // Last resort: react-docgen-typescript can't expand Omit<T,K> on
            // ForwardRefExoticComponent, so we use the TS compiler API to read
            // the ${Name}Props interface directly from the package types.
            props = extractInterfaceProps(tsProgram, entry, `${c.displayName}Props`, pkgDir);
          }
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
      if (pkgConfig?.excluded?.includes(exp.name)) continue;
      if (exp.description?.includes('@internal')) continue;
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
    return components;
  }

  async invalidate(p: DsPackage): Promise<void> {
    await this.ctx.globalState.update(this.getCacheKey(p), undefined);
  }

  /**
   * Removes every introspection cache entry from globalState, across all schema
   * versions, forcing a fresh parse on the next introspect. USER overrides and
   * package selections live elsewhere and are left untouched. Returns the number
   * of entries cleared.
   */
  async clearCache(): Promise<number> {
    // Drop in-flight dedup entries so the subsequent re-index starts fresh parses
    // instead of joining the already-running startup warm-up promises.
    this.inFlight.clear();
    this.configMemo = null;
    const keys = this.ctx.globalState.keys().filter((k) => k.startsWith('ds.cache.'));
    for (const k of keys) {
      await this.ctx.globalState.update(k, undefined);
    }
    return keys.length;
  }

  /** Applies company (`snapds.config.json`) prop overrides: hide + default/description. */
  private applyCompanyPropOverrides(
    props: PropMeta[],
    compOverride?: ConfigComponentOverride,
  ): PropMeta[] {
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

  private parserOptions(domOnly?: Set<string>): docgen.ParserOptions {
    return {
      savePropValueAsString: false,
      shouldExtractLiteralValuesFromEnum: true,
      shouldRemoveUndefinedFromOptional: true,
      propFilter: (prop, component) => {
        const fromReact = !!prop.parent && /node_modules\/@types\/react/.test(prop.parent.fileName);
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

/**
 * Uses the TypeScript Compiler API to extract props from a `${Name}Props`
 * interface exported by the package. This handles the case where
 * react-docgen-typescript returns 0 props because the component type is
 * wrapped in `Omit<T, K>` (e.g. `ForwardRefExoticComponent<Omit<ButtonProps, "ref">>`).
 * Only includes props declared within the package directory itself, skipping
 * anything inherited from @types/react or other node_modules.
 *
 * Accepts an already-created program to avoid the expensive `ts.createProgram`
 * call on every component — callers should create one program per package and
 * reuse it across all extractInterfaceProps calls.
 */
function extractInterfaceProps(
  program: ts.Program,
  entry: string,
  interfaceName: string,
  pkgDir: string,
): PropMeta[] {
  try {
    const checker = program.getTypeChecker();
    const source = program.getSourceFile(entry);
    if (!source) return [];
    const moduleSymbol = checker.getSymbolAtLocation(source);
    if (!moduleSymbol) return [];

    let targetSym: ts.Symbol | undefined;
    for (const exp of checker.getExportsOfModule(moduleSymbol)) {
      if (exp.getName() === interfaceName) {
        targetSym = exp;
        break;
      }
    }
    if (!targetSym) return [];

    if (targetSym.flags & ts.SymbolFlags.Alias) {
      try {
        targetSym = checker.getAliasedSymbol(targetSym);
      } catch {}
    }

    const ifaceType = checker.getDeclaredTypeOfSymbol(targetSym);
    const props = checker.getPropertiesOfType(ifaceType);
    const result: PropMeta[] = [];

    for (const prop of props) {
      const declarations = prop.getDeclarations();
      if (!declarations || declarations.length === 0) continue;
      // Skip props inherited from outside the package (DOM props, @types/react, etc.)
      const fromPkg = declarations.some((d) => d.getSourceFile().fileName.startsWith(pkgDir));
      if (!fromPkg) continue;

      const propType = checker.getTypeOfSymbol(prop);
      const raw = checker.typeToString(propType);
      const required = !(prop.flags & ts.SymbolFlags.Optional);
      const doc = ts.displayPartsToString(prop.getDocumentationComment(checker)).trim();

      let type: PropMeta['type'] = raw;
      let enumValues: string[] | undefined;

      if (propType.flags & ts.TypeFlags.String) {
        type = 'string';
      } else if (propType.flags & (ts.TypeFlags.Boolean | ts.TypeFlags.BooleanLiteral)) {
        type = 'boolean';
      } else if (propType.flags & ts.TypeFlags.Number) {
        type = 'number';
      } else if (propType.isUnion()) {
        const nonUndef = propType.types.filter((t) => !(t.flags & ts.TypeFlags.Undefined));
        if (nonUndef.length > 0 && nonUndef.every((t) => t.flags & ts.TypeFlags.BooleanLiteral)) {
          type = 'boolean';
        } else if (nonUndef.length > 0 && nonUndef.every((t) => t.isStringLiteral())) {
          type = 'enum';
          enumValues = nonUndef.map((t) => (t as ts.StringLiteralType).value);
        } else if (/=>/.test(raw)) {
          type = 'function';
        } else if (/ReactNode|ReactElement|JSX\.Element/.test(raw)) {
          type = 'ReactNode';
        }
      } else if (/=>/.test(raw)) {
        type = 'function';
      } else if (/ReactNode|ReactElement|JSX\.Element/.test(raw)) {
        type = 'ReactNode';
      }

      result.push({
        name: prop.getName(),
        type,
        raw,
        required,
        description: doc || undefined,
        enumValues,
      });
    }

    return result;
  } catch {
    return [];
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

  let defaultValue: unknown = prop.defaultValue ? prop.defaultValue.value : undefined;
  if (defaultValue !== undefined) {
    if (type === 'boolean') defaultValue = defaultValue === 'true';
    else if (type === 'number') defaultValue = Number(defaultValue);
  }

  return {
    name: prop.name,
    type,
    raw,
    required: prop.required,
    defaultValue,
    description: prop.description || undefined,
    enumValues,
  };
}
