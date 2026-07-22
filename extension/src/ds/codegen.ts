import type { ComponentMeta, PropMeta } from '../util/messaging';

export function splitComponentId(id: string): { pkg: string; name: string } {
  const idx = id.lastIndexOf('#');
  if (idx < 0) return { pkg: '', name: id };
  return { pkg: id.slice(0, idx), name: id.slice(idx + 1) };
}

export function generateImport(meta: ComponentMeta): string {
  const { pkg, name } = splitComponentId(meta.id);
  return `import { ${name} } from '${pkg}';`;
}

export type ImportEdit =
  | { kind: 'none' }
  | { kind: 'replace'; start: number; end: number; text: string }
  | { kind: 'insert'; offset: number; text: string };

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

function escapeSnippet(s: string): string {
  return s.replace(/\$/g, '\\$').replace(/\}/g, '\\}');
}
