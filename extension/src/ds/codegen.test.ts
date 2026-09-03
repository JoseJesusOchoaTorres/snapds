import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ComponentMeta, ImportSpec, PropMeta } from '../util/messaging';
import {
  computeImportEdit,
  emitImport,
  escapeSnippet,
  generateExampleJSX,
  generateImport,
  generateJSX,
  type ImportEdit,
  planImports,
  splitComponentId,
} from './codegen';

/** Applies an ImportEdit to `text` so assertions can compare final source. */
function applyEdit(text: string, pkg: string, name: string): string {
  const e = computeImportEdit(text, pkg, name);
  if (e.kind === 'replace') return text.slice(0, e.start) + e.text + text.slice(e.end);
  if (e.kind === 'insert') return text.slice(0, e.offset) + e.text + text.slice(e.offset);
  return text;
}

/**
 * Applies a set of offset-based edits to `text` in descending offset order so
 * earlier edits never invalidate the offsets of later ones — the string analogue
 * of how VS Code applies a multi-edit WorkspaceEdit.
 */
function applyEdits(text: string, edits: ImportEdit[]): string {
  const offsetOf = (e: ImportEdit) =>
    e.kind === 'insert' ? e.offset : e.kind === 'replace' ? e.start : 0;
  const sorted = [...edits].sort((a, b) => offsetOf(b) - offsetOf(a));
  let out = text;
  for (const e of sorted) {
    if (e.kind === 'replace') out = out.slice(0, e.start) + e.text + out.slice(e.end);
    else if (e.kind === 'insert') out = out.slice(0, e.offset) + e.text + out.slice(e.offset);
  }
  return out;
}

const planned = (text: string, specs: ImportSpec[]): string =>
  applyEdits(text, planImports(text, specs));

const prop = (p: Partial<PropMeta> & { name: string }): PropMeta => ({
  type: 'string',
  raw: 'string',
  required: false,
  ...p,
});

const comp = (name: string, props: PropMeta[] = []): ComponentMeta => ({
  id: `@acme/ui#${name}`,
  name,
  props,
});

test('splitComponentId separates package and name on the last #', () => {
  assert.deepEqual(splitComponentId('@acme/ui#Button'), { pkg: '@acme/ui', name: 'Button' });
});

test('splitComponentId with no # yields an empty package', () => {
  assert.deepEqual(splitComponentId('Button'), { pkg: '', name: 'Button' });
});

test('generateImport builds a named import from the package', () => {
  assert.equal(generateImport(comp('Button')), "import { Button } from '@acme/ui';");
});

test('generateImport uses an explicit importSpecifier (local source alias)', () => {
  const meta: ComponentMeta = {
    id: 'src/components/ui#Button',
    name: 'Button',
    props: [],
    importSpecifier: '@/components/ui/button',
  };
  assert.equal(generateImport(meta), "import { Button } from '@/components/ui/button';");
});

test('computeImportEdit inserts after a trailing multi-line import (no mid-block split)', () => {
  const src = `import {
  AuditLogContainer,
  AuditLogInfoText,
} from '../common/AuditLog.styles.ts'
`;
  assert.equal(
    applyEdit(src, '@starlight/badges', 'Badge'),
    `import {
  AuditLogContainer,
  AuditLogInfoText,
} from '../common/AuditLog.styles.ts'
import { Badge } from '@starlight/badges';
`,
  );
});

test('computeImportEdit inserts after the last import when several exist', () => {
  const src = "import { A } from 'a';\nimport { B } from 'b';\nconst x = 1;\n";
  assert.equal(
    applyEdit(src, 'c', 'C'),
    "import { A } from 'a';\nimport { B } from 'b';\nimport { C } from 'c';\nconst x = 1;\n",
  );
});

test('computeImportEdit merges a name into an existing single-line import', () => {
  assert.equal(
    applyEdit("import { Badge } from '@starlight/badges';\n", '@starlight/badges', 'Avatar'),
    "import { Badge, Avatar } from '@starlight/badges';\n",
  );
});

test('computeImportEdit merges a name into an existing multi-line import', () => {
  const src = "import {\n  Badge,\n} from '@starlight/badges';\n";
  assert.equal(
    applyEdit(src, '@starlight/badges', 'Avatar'),
    "import {\n  Badge,\n  Avatar\n} from '@starlight/badges';\n",
  );
});

test('computeImportEdit is a no-op when the name is already imported', () => {
  const src = "import { Badge } from '@starlight/badges';\n";
  assert.equal(applyEdit(src, '@starlight/badges', 'Badge'), src);
});

test('computeImportEdit inserts at the top when the file has no imports', () => {
  assert.equal(applyEdit('const x = 1;\n', 'a', 'A'), "import { A } from 'a';\nconst x = 1;\n");
});

test('computeImportEdit merges components that share a local file specifier', () => {
  // shadcn's dialog.tsx exports Dialog + DialogTrigger — both import from the same alias.
  const src = "import { Dialog } from '@/components/ui/dialog';\n";
  assert.equal(
    applyEdit(src, '@/components/ui/dialog', 'DialogTrigger'),
    "import { Dialog, DialogTrigger } from '@/components/ui/dialog';\n",
  );
});

test('computeImportEdit does not merge across different local file specifiers', () => {
  const src = "import { Dialog } from '@/components/ui/dialog';\n";
  assert.equal(
    applyEdit(src, '@/components/ui/button', 'Button'),
    "import { Dialog } from '@/components/ui/dialog';\nimport { Button } from '@/components/ui/button';\n",
  );
});

test('generateExampleJSX renders only required props without defaults', () => {
  const meta = comp('Button', [
    prop({ name: 'variant', type: 'enum', required: true, enumValues: ['primary', 'ghost'] }),
    prop({ name: 'disabled', type: 'boolean', required: true }),
    prop({ name: 'label', type: 'string', required: false }),
    prop({ name: 'size', type: 'string', required: true, defaultValue: 'md' }),
  ]);
  assert.equal(generateExampleJSX(meta), '<Button variant="primary" disabled />');
});

test('generateExampleJSX renders children for ReactNode props', () => {
  const meta = comp('Card', [prop({ name: 'children', type: 'ReactNode', required: true })]);
  assert.equal(generateExampleJSX(meta), '<Card>...</Card>');
});

test('generateExampleJSX produces a self-closing tag when there are no required props', () => {
  assert.equal(generateExampleJSX(comp('Divider')), '<Divider />');
});

test('generateExampleJSX output contains no snippet tab-stop artifacts', () => {
  const meta = comp('Field', [prop({ name: 'name', type: 'string', required: true })]);
  const out = generateExampleJSX(meta);
  // biome-ignore lint/suspicious/noTemplateCurlyInString: intentionally testing absence of snippet syntax
  assert.ok(!out.includes('${'), 'must not contain ${ } snippet placeholders');
});

test('generateJSX escapes backslashes so prop values cannot break out of the snippet placeholder', () => {
  const meta = comp('Input', [prop({ name: 'value', type: 'string', required: true })]);
  // Input contains a\}b — a backslash before a brace. If the backslash is not
  // escaped first (js/incomplete-sanitization), it becomes a\\}b and the '}' closes
  // the ${..} placeholder early, injecting snippet syntax. Escaping backslash first
  // yields a\\\}b, keeping the brace literal inside the placeholder.
  const out = generateJSX(meta, { value: 'a\\}b' });
  assert.ok(out.includes('a\\\\\\}b'), `backslash not escaped first: ${out}`);
});

// ---------------------------------------------------------------------------
// Custom-snippet injection core: emitImport / planImports / escapeSnippet
// ---------------------------------------------------------------------------

test('emitImport renders named, default, and namespace forms', () => {
  assert.equal(
    emitImport({ kind: 'named', specifier: '@acme/ui', names: ['Button', 'Label'] }),
    "import { Button, Label } from '@acme/ui';",
  );
  assert.equal(
    emitImport({ kind: 'default', specifier: 'react', local: 'React' }),
    "import React from 'react';",
  );
  assert.equal(
    emitImport({ kind: 'namespace', specifier: 'react', local: 'React' }),
    "import * as React from 'react';",
  );
});

test('planImports adds several named imports from different modules when the file has none', () => {
  const out = planned('const x = 1;\n', [
    { kind: 'named', specifier: '@acme/ui', names: ['Button'] },
    { kind: 'named', specifier: '@acme/forms', names: ['Label'] },
  ]);
  assert.equal(
    out,
    "import { Button } from '@acme/ui';\nimport { Label } from '@acme/forms';\nconst x = 1;\n",
  );
});

test('planImports merges into an existing same-module line and adds a new line for another', () => {
  const src = "import { Button } from '@acme/ui';\nconst x = 1;\n";
  const out = planned(src, [
    { kind: 'named', specifier: '@acme/ui', names: ['Label'] },
    { kind: 'named', specifier: '@acme/forms', names: ['Field'] },
  ]);
  assert.equal(
    out,
    "import { Button, Label } from '@acme/ui';\nimport { Field } from '@acme/forms';\nconst x = 1;\n",
  );
});

test('planImports collapses two named specs for the same specifier', () => {
  const out = planned('const x = 1;\n', [
    { kind: 'named', specifier: '@acme/ui', names: ['Button'] },
    { kind: 'named', specifier: '@acme/ui', names: ['Label'] },
  ]);
  assert.equal(out, "import { Button, Label } from '@acme/ui';\nconst x = 1;\n");
});

test('planImports adds a default import after the last import when absent', () => {
  const src = "import { Button } from '@acme/ui';\n";
  const out = planned(src, [{ kind: 'default', specifier: 'react', local: 'React' }]);
  assert.equal(out, "import { Button } from '@acme/ui';\nimport React from 'react';\n");
});

test('planImports adds a namespace import when absent', () => {
  const out = planned('const x = 1;\n', [
    { kind: 'namespace', specifier: 'react', local: 'React' },
  ]);
  assert.equal(out, "import * as React from 'react';\nconst x = 1;\n");
});

test('planImports is a no-op when a default import is already present', () => {
  const src = "import React from 'react';\nconst x = 1;\n";
  assert.equal(planned(src, [{ kind: 'default', specifier: 'react', local: 'React' }]), src);
});

test('planImports does not duplicate a default sitting beside named imports', () => {
  const src = "import React, { useState } from 'react';\n";
  assert.equal(planned(src, [{ kind: 'default', specifier: 'react', local: 'React' }]), src);
});

test('planImports is a no-op when every named symbol is already imported', () => {
  const src = "import { Button, Label } from '@acme/ui';\n";
  assert.equal(
    planned(src, [{ kind: 'named', specifier: '@acme/ui', names: ['Button', 'Label'] }]),
    src,
  );
});

test('planImports handles a mixed set (named merge + new named + default) in one pass', () => {
  const src = "import { Button } from '@acme/ui';\nconst x = 1;\n";
  const out = planned(src, [
    { kind: 'named', specifier: '@acme/ui', names: ['Label'] },
    { kind: 'named', specifier: '@acme/forms', names: ['Field'] },
    { kind: 'default', specifier: 'react', local: 'React' },
  ]);
  assert.equal(
    out,
    "import { Button, Label } from '@acme/ui';\nimport { Field } from '@acme/forms';\nimport React from 'react';\nconst x = 1;\n",
  );
});

test('planImports merges into a multi-line existing import', () => {
  const src = "import {\n  Button,\n} from '@acme/ui';\n";
  const out = planned(src, [{ kind: 'named', specifier: '@acme/ui', names: ['Label'] }]);
  assert.equal(out, "import {\n  Button,\n  Label\n} from '@acme/ui';\n");
});

test('escapeSnippet is exported and neutralizes SnippetString metacharacters', () => {
  // A captured template literal — the interpolation would be read as a tab-stop.
  // biome-ignore lint/suspicious/noTemplateCurlyInString: fixture that intentionally embeds interpolation syntax
  const out = escapeSnippet('<Label>{`Total: ${total}`}</Label>');
  // biome-ignore lint/suspicious/noTemplateCurlyInString: asserting the raw interpolation did not survive escaping
  assert.ok(!out.includes('${total}'), `unescaped interpolation survived: ${out}`);
  assert.ok(out.includes('\\$'), 'dollar sign must be escaped');
  assert.ok(out.includes('\\}'), 'closing brace must be escaped');
});

test('escapeSnippet escapes backslashes first so an escaped brace stays literal', () => {
  // Input a\}b: escaping the brace before the backslash would yield a\\}b and the
  // brace would still close a placeholder. Backslash-first yields a\\\}b.
  assert.equal(escapeSnippet('a\\}b'), 'a\\\\\\}b');
});
