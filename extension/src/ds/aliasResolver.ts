import * as path from 'node:path';

/**
 * A resolved tsconfig path-alias mapping. For `"@/*": ["./src/*"]` this is
 * `{ prefix: '@/', targetDir: '<base>/src' }`.
 */
export interface AliasMapping {
  /** Alias prefix including its trailing slash, e.g. `@/`. */
  prefix: string;
  /** Absolute directory the prefix maps to, e.g. `/repo/src`. */
  targetDir: string;
}

// Source-file extensions stripped when turning a file path into a specifier.
const STRIP_EXT = /\.(d\.ts|[cm]?tsx?|[cm]?jsx?)$/;

/**
 * Turns a tsconfig `compilerOptions.paths` object into resolved alias mappings.
 * Only wildcard directory globs (`"@/*": ["./src/*"]` — the shape shadcn and
 * most Vite/TS apps use) are handled; exact/non-glob aliases are ignored for
 * now. `basePath` is the tsconfig's `baseUrl` (or the tsconfig's own directory
 * when `baseUrl` is absent, as in acme).
 */
export function parseAliasMappings(
  paths: Record<string, string[]> | undefined,
  basePath: string,
): AliasMapping[] {
  const out: AliasMapping[] = [];
  if (!paths) return out;
  for (const [pattern, targets] of Object.entries(paths)) {
    if (!pattern.endsWith('/*')) continue;
    const target = targets.find((t) => t.endsWith('/*'));
    if (!target) continue;
    out.push({
      prefix: pattern.slice(0, -1), // '@/*' -> '@/'
      targetDir: path.resolve(basePath, target.slice(0, -2)), // './src/*' -> '<base>/src'
    });
  }
  return out;
}

/**
 * Direction 1: resolve an alias specifier (e.g. `@/components/ui`) to an
 * absolute directory (e.g. `/repo/src/components/ui`). Longest matching alias
 * prefix wins. Returns null when no alias matches. The caller should `stat` the
 * result — a match does not guarantee the target exists or is a directory.
 */
export function aliasToDir(specifier: string, mappings: AliasMapping[]): string | null {
  const match = mappings
    .filter((m) => specifier.startsWith(m.prefix))
    .sort((a, b) => b.prefix.length - a.prefix.length)[0];
  return match ? path.join(match.targetDir, specifier.slice(match.prefix.length)) : null;
}

/**
 * Import specifier for a file under a known local source, given the source's
 * root directory and its alias base. Specialization of `fileToSpecifier` for the
 * single (rootDir -> importAlias) pair a registered local source carries, so
 * introspection needn't re-resolve tsconfig per file. E.g.
 * `(/repo/src/components/ui, '@/components/ui', /repo/src/components/ui/button.tsx)`
 * -> `@/components/ui/button`.
 */
export function specifierForFile(rootDir: string, importAlias: string, absFile: string): string {
  const rel = path.relative(rootDir, absFile).split(path.sep).join('/');
  return `${importAlias}/${rel}`.replace(STRIP_EXT, '').replace(/\/index$/, '');
}

/**
 * Direction 2: resolve an absolute source file to its import specifier
 * (e.g. `/repo/src/components/ui/button.tsx` -> `@/components/ui/button`).
 * The alias whose target directory is the longest prefix of the file wins; the
 * extension and a trailing `/index` are stripped. Returns null when the file
 * lives under no alias target.
 */
export function fileToSpecifier(absFile: string, mappings: AliasMapping[]): string | null {
  const match = mappings
    .map((m) => ({ m, rel: path.relative(m.targetDir, absFile) }))
    .filter(({ rel }) => rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel))
    .sort((a, b) => b.m.targetDir.length - a.m.targetDir.length)[0];
  if (!match) return null;
  const spec = `${match.m.prefix}${match.rel.split(path.sep).join('/')}`;
  return spec.replace(STRIP_EXT, '').replace(/\/index$/, '');
}
