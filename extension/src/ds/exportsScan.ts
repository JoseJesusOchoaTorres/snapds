import * as path from 'node:path';
import * as ts from 'typescript';

/**
 * Enumerates all capitalized *value* exports from a package entry `.d.ts` using
 * the TypeScript Compiler API. Type-only exports (interfaces, type aliases such
 * as `TextProps`) are skipped. This catches polymorphic components declared as
 * generic call signatures that `react-docgen-typescript` fails to detect.
 * Returns an empty list on any failure.
 */
export function enumerateComponentExports(
  entry: string | undefined,
  tsconfigPath?: string,
): Array<{ name: string; description?: string }> {
  if (!entry) return [];
  try {
    const program = ts.createProgram([entry], buildCompilerOptions(tsconfigPath));
    const checker = program.getTypeChecker();
    const source = program.getSourceFile(entry);
    if (!source) return [];
    const moduleSymbol = checker.getSymbolAtLocation(source);
    if (!moduleSymbol) return [];

    const out: Array<{ name: string; description?: string }> = [];
    for (const exp of checker.getExportsOfModule(moduleSymbol)) {
      const name = exp.getName();
      if (!/^[A-Z]/.test(name) || name === '__type') continue;
      let sym = exp;
      if (sym.flags & ts.SymbolFlags.Alias) {
        try {
          sym = checker.getAliasedSymbol(sym);
        } catch {
          // keep the alias symbol
        }
      }
      // Skip type-only exports; only keep things that exist as runtime values.
      if (!(sym.flags & ts.SymbolFlags.Value)) continue;
      const doc = ts.displayPartsToString(sym.getDocumentationComment(checker)).trim();
      out.push({ name, description: doc || undefined });
    }
    return out;
  } catch {
    return [];
  }
}

export function buildCompilerOptions(tsconfigPath?: string): ts.CompilerOptions {
  if (tsconfigPath) {
    try {
      const read = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
      if (!read.error && read.config) {
        const parsed = ts.parseJsonConfigFileContent(
          read.config,
          ts.sys,
          path.dirname(tsconfigPath),
        );
        return { ...parsed.options, noEmit: true, skipLibCheck: true };
      }
    } catch {
      // fall through to defaults
    }
  }
  return {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    jsx: ts.JsxEmit.ReactJSX,
    skipLibCheck: true,
    noEmit: true,
    allowJs: true,
  };
}
