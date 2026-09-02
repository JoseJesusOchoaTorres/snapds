import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { SnippetSaveResult } from '../util/messaging';
import { detectImportLines, isSnippetLanguage, resultToSnippet } from './saveSnippet';

test('isSnippetLanguage accepts React TS/JS only', () => {
  assert.ok(isSnippetLanguage('typescriptreact'));
  assert.ok(isSnippetLanguage('javascriptreact'));
  assert.ok(!isSnippetLanguage('typescript'));
  assert.ok(!isSnippetLanguage('python'));
});

test('detectImportLines renders the imports a selection uses', () => {
  const file = [
    "import { Button } from '@acme/ui';",
    "import { Label } from '@acme/forms';",
    "import { Unused } from '@acme/dead';",
  ].join('\n');
  const lines = detectImportLines(file, '<Label><Button /></Label>');
  assert.deepEqual(lines, [
    "import { Button } from '@acme/ui';",
    "import { Label } from '@acme/forms';",
  ]);
});

const result = (over: Partial<SnippetSaveResult> = {}): SnippetSaveResult => ({
  name: 'Labeled buttons',
  description: 'Two buttons in a label',
  category: 'Forms',
  code: '<Label><Button /></Label>',
  scope: 'local',
  importLines: ["import { Button } from '@acme/ui';", "import { Label } from '@acme/forms';"],
  ...over,
});

test('resultToSnippet mints an id when capturing and parses import lines to specs', () => {
  const snip = resultToSnippet(result(), { languageId: 'typescriptreact', createdAt: 'T' });
  assert.ok(snip.id.startsWith('snippet:'));
  assert.equal(snip.name, 'Labeled buttons');
  assert.equal(snip.category, 'Forms');
  assert.equal(snip.languageId, 'typescriptreact');
  assert.equal(snip.createdAt, 'T');
  assert.deepEqual(snip.imports, [
    { kind: 'named', specifier: '@acme/ui', names: ['Button'] },
    { kind: 'named', specifier: '@acme/forms', names: ['Label'] },
  ]);
});

test('resultToSnippet preserves an id and blank category becomes undefined on edit', () => {
  const snip = resultToSnippet(result({ id: 'snippet:existing', category: '  ' }), {
    languageId: 'javascriptreact',
    createdAt: 'orig',
  });
  assert.equal(snip.id, 'snippet:existing');
  assert.equal(snip.category, undefined);
  assert.equal(snip.createdAt, 'orig');
});

test('resultToSnippet drops an empty description', () => {
  const snip = resultToSnippet(result({ description: '   ' }), {
    languageId: 'typescriptreact',
    createdAt: 'T',
  });
  assert.equal(snip.description, undefined);
});
