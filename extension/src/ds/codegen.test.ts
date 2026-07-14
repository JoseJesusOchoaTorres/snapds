import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ComponentMeta, PropMeta } from '../util/messaging';
import { computeImportEdit, generateExampleJSX, generateImport, splitComponentId } from './codegen';

/** Applies an ImportEdit to `text` so assertions can compare final source. */
function applyEdit(text: string, pkg: string, name: string): string {
  const e = computeImportEdit(text, pkg, name);
  if (e.kind === 'replace') return text.slice(0, e.start) + e.text + text.slice(e.end);
  if (e.kind === 'insert') return text.slice(0, e.offset) + e.text + text.slice(e.offset);
  return text;
}

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
  assert.ok(!out.includes('${'), 'must not contain ${ } snippet placeholders');
});
