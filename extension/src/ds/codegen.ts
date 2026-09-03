import type { ComponentMeta, ImportSpec, PropMeta } from '../util/messaging';

/**
 * Splits a component id into package and name. The id must be in the form `pkg#Name`.
 */
export function splitComponentId(id: string): { pkg: string; name: string } {
  const idx = id.lastIndexOf('#');
  if (idx < 0) return { pkg: '', name: id };
  return { pkg: id.slice(0, idx), name: id.slice(idx + 1) };
}

/**
 * Generates a named import statement for the component. The specifier is the
 * component's explicit `importSpecifier` (e.g. a local design system's path
 * alias) when set, otherwise the package prefix of its `pkg#Name` id.
 */
export function generateImport(meta: ComponentMeta): string {
  const { pkg, name } = splitComponentId(meta.id);
  return `import { ${name} } from '${meta.importSpecifier ?? pkg}';`;
}

export type ImportEdit =
  | { kind: 'none' }
  | { kind: 'replace'; start: number; end: number; text: string }
  | { kind: 'insert'; offset: number; text: string };

/**
 * Escapes a string for use in a regular expression.
 */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Computes how to add `name` from `pkg` to a source file, as character offsets
 * so the caller can map them to editor positions. Either merges the name into an
 * existing import from the same package, or inserts a new import after the last
 * existing import statement — correctly skipping past multi-line imports.
 */
export function computeImportEdit(text: string, pkg: string, name: string): ImportEdit {
  if (!pkg) return { kind: 'none' };

  const mergeRegex = new RegExp(
    `(import\\s+(?:[\\w\\s,]*?)?\\{)([^}]*)(\\}\\s+from\\s+['"]${escapeRegex(pkg)}['"];?)`,
  );
  const m = text.match(mergeRegex);
  if (m && m.index !== undefined) {
    const [full, prefix, inner, suffix] = m;
    const names = inner
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (names.includes(name)) return { kind: 'none' };
    names.push(name);
    const newInner = inner.includes('\n')
      ? `\n  ${names.join(',\n  ')}\n`
      : ` ${names.join(', ')} `;
    return {
      kind: 'replace',
      start: m.index,
      end: m.index + full.length,
      text: `${prefix}${newInner}${suffix}`,
    };
  }

  // Match complete import statements (single- or multi-line). `[^'";]*` spans
  // newlines, so the closing `} from '...'` of a multi-line import is included.
  const stmtRegex = /^[ \t]*import\s+[^'";]*['"][^'"]+['"];?/gm;
  let lastEnd = -1;
  for (const match of text.matchAll(stmtRegex)) {
    lastEnd = (match.index ?? 0) + match[0].length;
  }

  const importLine = `import { ${name} } from '${pkg}';`;
  if (lastEnd >= 0) return { kind: 'insert', offset: lastEnd, text: `\n${importLine}` };
  return { kind: 'insert', offset: 0, text: `${importLine}\n` };
}

/** Character offset just past the last import statement, or -1 when there are none. */
function findLastImportEnd(text: string): number {
  const stmtRegex = /^[ \t]*import\s+[^'";]*['"][^'"]+['"];?/gm;
  let lastEnd = -1;
  for (const match of text.matchAll(stmtRegex)) {
    lastEnd = (match.index ?? 0) + match[0].length;
  }
  return lastEnd;
}

/** Renders an ImportSpec as a single import statement. */
export function emitImport(spec: ImportSpec): string {
  switch (spec.kind) {
    case 'named':
      // Declaration-level type import: `import type { Foo, Bar }`.
      // Inline type modifiers (`import { type Foo, Bar }`) are preserved as-is
      // in the names strings, so no special handling is needed for that form.
      if (spec.typeOnly) {
        return `import type { ${spec.names.join(', ')} } from '${spec.specifier}';`;
      }
      return `import { ${spec.names.join(', ')} } from '${spec.specifier}';`;
    case 'default':
      return spec.typeOnly
        ? `import type ${spec.local} from '${spec.specifier}';`
        : `import ${spec.local} from '${spec.specifier}';`;
    case 'namespace':
      return spec.typeOnly
        ? `import type * as ${spec.local} from '${spec.specifier}';`
        : `import * as ${spec.local} from '${spec.specifier}';`;
  }
}

/** Merges named symbols into an existing same-specifier import, or signals a new line. */
function mergeNamed(
  text: string,
  specifier: string,
  names: string[],
): { replace?: ImportEdit; newLine?: string } {
  const mergeRegex = new RegExp(
    `(import\\s+(?:[\\w\\s,]*?)?\\{)([^}]*)(\\}\\s+from\\s+['"]${escapeRegex(specifier)}['"];?)`,
  );
  const m = text.match(mergeRegex);
  if (m && m.index !== undefined) {
    const [full, prefix, inner, suffix] = m;
    const existing = inner
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const toAdd = names.filter((n) => !existing.includes(n));
    if (toAdd.length === 0) return {};
    const all = [...existing, ...toAdd];
    const newInner = inner.includes('\n') ? `\n  ${all.join(',\n  ')}\n` : ` ${all.join(', ')} `;
    return {
      replace: {
        kind: 'replace',
        start: m.index,
        end: m.index + full.length,
        text: `${prefix}${newInner}${suffix}`,
      },
    };
  }
  return { newLine: `import { ${names.join(', ')} } from '${specifier}';` };
}

/** True when a default import (including `import type Foo`) from `specifier` already exists. */
function hasDefaultImport(text: string, specifier: string): boolean {
  return new RegExp(
    `import\\s+(?:type\\s+)?[A-Za-z_$][\\w$]*\\s*(?:,\\s*(?:\\{[^}]*\\}|\\*\\s+as\\s+[A-Za-z_$][\\w$]*))?\\s+from\\s+['"]${escapeRegex(specifier)}['"]`,
  ).test(text);
}

/** True when a namespace import (`* as X`) from `specifier` already exists. */
function hasNamespaceImport(text: string, specifier: string): boolean {
  return new RegExp(
    `import\\s+\\*\\s+as\\s+[A-Za-z_$][\\w$]*\\s+from\\s+['"]${escapeRegex(specifier)}['"]`,
  ).test(text);
}

/**
 * Plans the set of edits needed to add every import a snippet requires to a file.
 *
 * Unlike `computeImportEdit` (one named symbol, one module), this handles the
 * many-imports case a captured snippet needs: named symbols merge into existing
 * same-module lines, default/namespace forms are added when absent, and all
 * brand-new lines are batched into a single insert after the last import.
 *
 * Returns offset-based edits against the ORIGINAL `text`; they are non-overlapping
 * and safe to apply together in one `WorkspaceEdit` (VS Code) or in descending
 * offset order (plain string).
 */
export function planImports(text: string, specs: ImportSpec[]): ImportEdit[] {
  const edits: ImportEdit[] = [];
  const newLines: string[] = [];

  // Collapse named specs by specifier so two `named` entries for the same module
  // never produce two competing edits.
  const namedBySpecifier = new Map<string, Set<string>>();
  const others: ImportSpec[] = [];
  for (const spec of specs) {
    if (spec.kind === 'named') {
      const set = namedBySpecifier.get(spec.specifier) ?? new Set<string>();
      for (const n of spec.names) set.add(n);
      namedBySpecifier.set(spec.specifier, set);
    } else {
      others.push(spec);
    }
  }

  for (const [specifier, nameSet] of namedBySpecifier) {
    const r = mergeNamed(text, specifier, [...nameSet]);
    if (r.replace) edits.push(r.replace);
    else if (r.newLine) newLines.push(r.newLine);
  }

  for (const spec of others) {
    if (spec.kind === 'default' && !hasDefaultImport(text, spec.specifier)) {
      newLines.push(emitImport(spec));
    } else if (spec.kind === 'namespace' && !hasNamespaceImport(text, spec.specifier)) {
      newLines.push(emitImport(spec));
    }
  }

  if (newLines.length > 0) {
    const lastEnd = findLastImportEnd(text);
    if (lastEnd >= 0)
      edits.push({ kind: 'insert', offset: lastEnd, text: `\n${newLines.join('\n')}` });
    else edits.push({ kind: 'insert', offset: 0, text: `${newLines.join('\n')}\n` });
  }

  return edits;
}

/**
 * Produces a SnippetString-compatible JSX literal. Snippet tab stops are
 * placed at each non-default value so the user can quickly tweak after drop.
 */
export function generateJSX(meta: ComponentMeta, configured: Record<string, unknown>): string {
  if (meta.snippet) {
    return meta.snippet;
  }

  const { name } = splitComponentId(meta.id);
  const lines: string[] = [];
  let tab = 1;

  const attrParts: string[] = [];
  let childrenValue: unknown;

  for (const p of meta.props) {
    if (p.name === 'children') {
      if (configured.children !== undefined) childrenValue = configured.children;
      continue;
    }
    const v = configured[p.name];
    if (v === undefined || v === '') continue;
    if (p.defaultValue !== undefined && String(v) === String(p.defaultValue)) continue;

    attrParts.push(renderAttr(p, v, () => tab++));
  }

  const attrs = attrParts.length ? ` ${attrParts.join(' ')}` : '';

  if (childrenValue !== undefined && String(childrenValue).length > 0) {
    lines.push(`<${name}${attrs}>`);
    lines.push(`  \${${tab++}:${escapeSnippet(String(childrenValue))}}`);
    lines.push(`</${name}>`);
  } else if (acceptsChildren(meta)) {
    lines.push(`<${name}${attrs}>\${${tab++}:children}</${name}>`);
  } else {
    lines.push(`<${name}${attrs} />`);
  }

  return lines.join('\n');
}

/**
 * Renders a prop value as a snippet tab stop with appropriate syntax for the prop type.
 */
function renderAttr(p: PropMeta, v: unknown, nextTab: () => number): string {
  switch (p.type) {
    case 'string':
      return `${p.name}="\${${nextTab()}:${escapeSnippet(String(v))}}"`;
    case 'boolean':
      return v ? p.name : `${p.name}={${String(v)}}`;
    case 'number':
      return `${p.name}={${String(v)}}`;
    case 'enum':
      return `${p.name}="\${${nextTab()}:${escapeSnippet(String(v))}}"`;
    case 'function':
      return `${p.name}={\${${nextTab()}:() => {}}}`;
    case 'ReactNode':
      return `${p.name}={\${${nextTab()}:${escapeSnippet(String(v))}}}`;
    default:
      return `${p.name}={\${${nextTab()}:${JSON.stringify(v)}}}`;
  }
}

function acceptsChildren(meta: ComponentMeta): boolean {
  return meta.props.some((p) => p.name === 'children');
}

/**
 * Renders a clean, static JSX example with no snippet tab-stop syntax, safe for
 * embedding in Markdown. Only required props are rendered as attributes; props
 * with a defaultValue are omitted since the default already applies.
 */
export function generateExampleJSX(meta: ComponentMeta): string {
  const { name } = splitComponentId(meta.id);
  const attrs: string[] = [];
  let children: string | null = null;

  for (const p of meta.props) {
    if (!p.required) continue;
    if (p.defaultValue !== undefined) continue;
    if (p.name === 'children' || p.type === 'ReactNode') {
      children = '...';
      continue;
    }
    switch (p.type) {
      case 'enum':
        attrs.push(`${p.name}="${p.enumValues?.[0] ?? '...'}"`);
        break;
      case 'boolean':
        attrs.push(p.name);
        break;
      case 'string':
        attrs.push(`${p.name}="..."`);
        break;
      case 'number':
        attrs.push(`${p.name}={0}`);
        break;
      case 'function':
        attrs.push(`${p.name}={() => {}}`);
        break;
      default:
        if (p.type.startsWith('(') || p.type.includes('=>')) {
          attrs.push(`${p.name}={() => {}}`);
        } else {
          attrs.push(`${p.name}={/* ${p.raw} */}`);
        }
        break;
    }
  }

  const attrStr = attrs.length ? ` ${attrs.join(' ')}` : '';
  return children === null ? `<${name}${attrStr} />` : `<${name}${attrStr}>${children}</${name}>`;
}

/**
 * Escapes snippet tab-stop syntax so it's safe to embed in a snippet.
 *
 * Exported for the custom-snippet inject path: captured source is arbitrary and
 * routinely contains `$`, `{`, `}`, and `\` that a `SnippetString` would read as
 * tab-stop syntax and mangle. Backslashes MUST be escaped first (js/incomplete-
 * sanitization), otherwise an escaped `}` re-opens the placeholder.
 */
export function escapeSnippet(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\$/g, '\\$').replace(/\}/g, '\\}');
}
