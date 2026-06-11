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

  const attrs = attrParts.length ? ' ' + attrParts.join(' ') : '';

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

function escapeSnippet(s: string): string {
  return s.replace(/\$/g, '\\$').replace(/\}/g, '\\}');
}
