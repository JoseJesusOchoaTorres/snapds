import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { test } from 'node:test';
import { enumerateComponentExports } from './exportsScan';

// Resolved relative to the extension package root (the cwd used by `npm test`).
const FIXTURE = path.resolve('src/ds/__fixtures__/exports-sample.d.ts');

test('fixture file exists', () => {
  assert.ok(fs.existsSync(FIXTURE), `missing fixture at ${FIXTURE}`);
});

test('returns an empty list when no entry is provided', () => {
  assert.deepEqual(enumerateComponentExports(undefined), []);
});

test('detects capitalized value exports, including polymorphic call signatures', () => {
  const names = enumerateComponentExports(FIXTURE)
    .map((e) => e.name)
    .sort();
  // Keyboard is a plain value; Text is a polymorphic generic signature docgen misses.
  assert.deepEqual(names, ['Keyboard', 'Text']);
});

test('skips type-only exports and lowercase (non-component) values', () => {
  const names = enumerateComponentExports(FIXTURE).map((e) => e.name);
  assert.ok(!names.includes('TextProps'), 'interface must be skipped');
  assert.ok(!names.includes('Variant'), 'type alias must be skipped');
  assert.ok(!names.includes('helper'), 'lowercase value must be skipped');
});
