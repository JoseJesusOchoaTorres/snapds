import type { ImportSpec } from '../util/messaging';

/**
 * Auto-detects the imports a captured selection depends on.
 *
 * Parses the whole file's import statements, then keeps only the bindings whose
 * local name is actually referenced in `selectionText`. The result is the
 * pre-filled list shown in the save modal for the user to confirm or edit — so
 * over-inclusion (a name that coincidentally matches) is a cheap, correctable
 * miss, not a failure. Heuristic (regex, not a full parser): good enough for the
 * React TS/JS files snippets are captured from, and always user-confirmed.
 */
export function analyzeSelectionImports(fileText: string, selectionText: string): ImportSpec[] {
  const used = usedIdentifiers(selectionText);
  const specs: ImportSpec[] = [];

  for (const parsed of parseImports(fileText)) {
    const namedUsed = parsed.named.filter((b) => used.has(b.local));
    if (namedUsed.length > 0) {
      specs.push({
        kind: 'named',
        specifier: parsed.specifier,
        names: namedUsed.map((b) => b.text),
      });
    }
    if (parsed.default && used.has(parsed.default)) {
      specs.push({ kind: 'default', specifier: parsed.specifier, local: parsed.default });
    }
    if (parsed.namespace && used.has(parsed.namespace)) {
      specs.push({ kind: 'namespace', specifier: parsed.specifier, local: parsed.namespace });
    }
  }

  return specs;
}

/**
 * Parses raw import statement text (e.g. the modal's confirmed `importLines`)
 * back into `ImportSpec[]` for storage. One statement can yield several specs —
 * `import React, { useState } from 'react'` gives a default + a named spec.
 */
export function parseImportsToSpecs(text: string): ImportSpec[] {
  const specs: ImportSpec[] = [];
  for (const p of parseImports(text)) {
    if (p.named.length > 0) {
      specs.push({ kind: 'named', specifier: p.specifier, names: p.named.map((b) => b.text) });
    }
    if (p.default) specs.push({ kind: 'default', specifier: p.specifier, local: p.default });
    if (p.namespace) specs.push({ kind: 'namespace', specifier: p.specifier, local: p.namespace });
  }
  return specs;
}

/** Every JS identifier token that appears in `text`, as a fast lookup set. */
export function usedIdentifiers(text: string): Set<string> {
  const set = new Set<string>();
  for (const m of text.matchAll(/[A-Za-z_$][\w$]*/g)) set.add(m[0]);
  return set;
}

interface NamedBinding {
  /** Local name to match against usage (the alias when `X as Y`, else the name). */
  local: string;
  /** Text to re-emit inside the braces (`X` or `X as Y`). */
  text: string;
}

interface ParsedImport {
  specifier: string;
  default?: string;
  namespace?: string;
  named: NamedBinding[];
}

/** Extracts structured import statements from source. Side-effect imports are ignored. */
export function parseImports(fileText: string): ParsedImport[] {
  const result: ParsedImport[] = [];
  // `import <clause> from '<specifier>'`. The clause is captured lazily so the
  // first following `from '...'` terminates it (handles multi-line clauses).
  const re = /import\s+(?:type\s+)?([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g;
  for (const m of fileText.matchAll(re)) {
    const clause = m[1].trim();
    const specifier = m[2];
    const parsed: ParsedImport = { specifier, named: [] };

    const namespaceMatch = clause.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/);
    if (namespaceMatch) parsed.namespace = namespaceMatch[1];

    const bracesMatch = clause.match(/\{([\s\S]*)\}/);
    if (bracesMatch) {
      for (const raw of bracesMatch[1].split(',')) {
        const binding = raw.trim().replace(/^type\s+/, '');
        if (!binding) continue;
        const asMatch = binding.match(/^([A-Za-z_$][\w$]*)\s+as\s+([A-Za-z_$][\w$]*)$/);
        if (asMatch) parsed.named.push({ local: asMatch[2], text: binding });
        else if (/^[A-Za-z_$][\w$]*$/.test(binding)) {
          parsed.named.push({ local: binding, text: binding });
        }
      }
    }

    // A default binding is a bare identifier in the clause, before any `{` or `*`.
    const beforeBrace = clause.split('{')[0].split('*')[0];
    const defaultMatch = beforeBrace.match(/^\s*([A-Za-z_$][\w$]*)\s*,?\s*$/);
    if (defaultMatch) parsed.default = defaultMatch[1];

    result.push(parsed);
  }
  return result;
}
