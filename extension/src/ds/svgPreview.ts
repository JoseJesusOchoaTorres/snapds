import * as ts from 'typescript';

/**
 * Extracts a renderable, sanitized `<svg>` string from a LOCAL component's
 * source file (shadcn / in-repo design-system icon). Purely static — parses the
 * TSX with the TypeScript AST and never executes the component. Returns
 * `undefined` when the file has no inline `<svg>` JSX (e.g. it wraps a lucide
 * icon, or builds its markup dynamically), so callers fall back to the props UI.
 *
 * Security: only a whitelist of drawing/structure SVG tags and static attribute
 * values survive. `<script>`, `href`/`xlink:href`, `style`, `on*` handlers (any
 * case), spreads (`{...props}`) and any dynamic `attr={expr}` are dropped — the
 * preview can neither fetch nor execute anything. The source is the user's own
 * repo file, and the props webview CSP (`default-src 'none'`, nonce'd
 * `script-src`) is a second line of defense, not the only one.
 */

// Drawing + structural SVG elements we serialize. Deliberately excludes `a`,
// `foreignObject`, `script`, `style`, `image` — anything that could embed HTML,
// script, or an external resource.
const SVG_TAGS = new Set([
  'svg',
  'g',
  'path',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'rect',
  'defs',
  'linearGradient',
  'radialGradient',
  'stop',
  'clipPath',
  'mask',
  'pattern',
  'use',
  'symbol',
  'title',
  'desc',
  'text',
  'tspan',
]);

// JSX prop name -> SVG attribute name, ONLY for the camelCase presentation attrs
// that actually differ. Attributes already spelled the same in JSX and SVG
// (viewBox, preserveAspectRatio, gradientUnits, gradientTransform, patternUnits,
// transform, fill, stroke, d, cx, cy, r, x, y, width, height, opacity, id, …)
// pass through unchanged — never blindly kebab-case (would corrupt `viewBox`).
const ATTR_RENAME: Record<string, string> = {
  className: 'class',
  strokeWidth: 'stroke-width',
  strokeLinecap: 'stroke-linecap',
  strokeLinejoin: 'stroke-linejoin',
  strokeDasharray: 'stroke-dasharray',
  strokeDashoffset: 'stroke-dashoffset',
  strokeMiterlimit: 'stroke-miterlimit',
  strokeOpacity: 'stroke-opacity',
  fillRule: 'fill-rule',
  fillOpacity: 'fill-opacity',
  clipRule: 'clip-rule',
  clipPath: 'clip-path',
  stopColor: 'stop-color',
  stopOpacity: 'stop-opacity',
};

// Never emitted — external/navigational references, inline CSS (can carry
// url() fetches / UI-redressing), and namespaced attrs.
const DROP_ATTRS = new Set(['href', 'xmlnsXlink', 'style']);

const MAX_OUTPUT = 100_000;

function escapeAttr(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function escapeText(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function attrValue(init: ts.JsxAttribute['initializer']): string | undefined {
  if (!init) return undefined; // valueless attr — skip (not meaningful for preview)
  if (ts.isStringLiteral(init)) return init.text;
  if (ts.isJsxExpression(init) && init.expression) {
    const expr = init.expression;
    if (ts.isNumericLiteral(expr) || ts.isStringLiteral(expr)) return expr.text;
    // Dynamic ({color}, {size}, ternaries, …) — drop; static attrs still render.
  }
  return undefined;
}

function serializeAttrs(attributes: ts.JsxAttributes): string {
  let out = '';
  for (const prop of attributes.properties) {
    if (!ts.isJsxAttribute(prop)) continue; // drop {...spread}
    if (!ts.isIdentifier(prop.name)) continue; // drop namespaced (xlink:href, …)
    const name = prop.name.text;
    if (DROP_ATTRS.has(name)) continue;
    // Event handlers in ANY case: JSX camelCase (onLoad) AND the raw lowercase
    // spelling (onload=, onclick=) that TSX also accepts and that the browser
    // would treat as an inline handler.
    if (/^on/i.test(name)) continue;
    // xlink:* references (JSX spells `xlink:href` as `xlinkHref`, an Identifier
    // that slips past the namespaced-name guard) — external/navigational refs.
    if (/^xlink/i.test(name)) continue;
    const value = attrValue(prop.initializer);
    if (value === undefined) continue;
    const mapped = ATTR_RENAME[name] ?? name;
    out += ` ${mapped}="${escapeAttr(value)}"`;
  }
  return out;
}

function serializeElement(node: ts.JsxElement | ts.JsxSelfClosingElement): string {
  const opening = ts.isJsxElement(node) ? node.openingElement : node;
  if (!ts.isIdentifier(opening.tagName)) return '';
  const tag = opening.tagName.text;
  if (!SVG_TAGS.has(tag)) return '';
  const attrs = serializeAttrs(opening.attributes);
  if (ts.isJsxSelfClosingElement(node)) return `<${tag}${attrs}/>`;
  let children = '';
  for (const child of node.children) {
    if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child)) {
      children += serializeElement(child);
    } else if (ts.isJsxText(child)) {
      const t = child.text.trim();
      if (t) children += escapeText(t);
    } else if (ts.isJsxFragment(child)) {
      for (const c of child.children) {
        if (ts.isJsxElement(c) || ts.isJsxSelfClosingElement(c)) children += serializeElement(c);
      }
    }
    // JsxExpression ({children}, {title && …}) — skipped (dynamic).
  }
  return `<${tag}${attrs}>${children}</${tag}>`;
}

type SvgEl = ts.JsxElement | ts.JsxSelfClosingElement;

function isSvgTag(node: ts.Node): node is SvgEl {
  if (ts.isJsxElement(node)) {
    return (
      ts.isIdentifier(node.openingElement.tagName) && node.openingElement.tagName.text === 'svg'
    );
  }
  if (ts.isJsxSelfClosingElement(node)) {
    return ts.isIdentifier(node.tagName) && node.tagName.text === 'svg';
  }
  return false;
}

/** Collects every top-level `<svg>` element in the file, in source order. */
function collectSvgs(node: ts.Node, out: SvgEl[]): void {
  if (isSvgTag(node)) out.push(node);
  ts.forEachChild(node, (child) => collectSvgs(child, out));
}

/** Name of the nearest enclosing function/variable/class declaration, if any. */
function enclosingName(node: ts.Node): string | undefined {
  for (let n: ts.Node | undefined = node.parent; n; n = n.parent) {
    if (ts.isFunctionDeclaration(n) && n.name) return n.name.text;
    if (ts.isClassDeclaration(n) && n.name) return n.name.text;
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name)) return n.name.text;
  }
  return undefined;
}

/**
 * `componentName` scopes selection to the `<svg>` inside the declaration of that
 * component, so a file exporting several icons previews the right one. Falls back
 * to the first `<svg>` in the file when the name can't be matched.
 */
export function extractSvgMarkup(source: string, componentName?: string): string | undefined {
  try {
    const sf = ts.createSourceFile(
      'icon.tsx',
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    // Reject syntactically broken sources: createSourceFile parses tolerantly and
    // recovers a partial AST (e.g. a valid <svg> followed by `const x = (`), which
    // could yield garbled markup. `parseDiagnostics` isn't on the public
    // SourceFile type, hence the narrow cast; it holds syntax errors only, so
    // well-formed icon files (regardless of tsconfig/types) are never rejected.
    const parseDiagnostics = (sf as unknown as { parseDiagnostics?: readonly ts.Diagnostic[] })
      .parseDiagnostics;
    if (parseDiagnostics && parseDiagnostics.length > 0) return undefined;
    const svgs: SvgEl[] = [];
    collectSvgs(sf, svgs);
    if (svgs.length === 0) return undefined;
    let svg = svgs[0];
    if (componentName) {
      const match = svgs.find((s) => enclosingName(s) === componentName);
      if (match) svg = match;
    }
    let markup = serializeElement(svg);
    if (!markup.startsWith('<svg') || markup.length > MAX_OUTPUT) return undefined;
    // Ensure the namespace so the SVG renders standalone (as an <img> data URI).
    if (!/\sxmlns=/.test(markup)) {
      markup = markup.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    // Require at least one drawable child so we don't preview an empty <svg/>.
    if (!/<(path|circle|ellipse|line|polyline|polygon|rect|use|text|g)\b/.test(markup)) {
      return undefined;
    }
    return markup;
  } catch {
    return undefined;
  }
}
