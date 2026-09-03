import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CustomSnippet } from '../util/messaging';
import type { SnapdsConfig } from './configSchema';
import {
  diffSharedSnippets,
  mergeSnippets,
  readSharedSnippets,
  removeSharedSnippet,
  upsertSharedSnippet,
} from './sharedSnippets';

const snippet = (over: Partial<CustomSnippet> & { id: string }): CustomSnippet => ({
  name: 'Snippet',
  code: '<Button />',
  imports: [],
  languageId: 'typescriptreact',
  scope: 'local',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

test('readSharedSnippets tags each snippet as shared', () => {
  const config: SnapdsConfig = { customSnippets: [snippet({ id: 'a', scope: 'local' })] };
  assert.equal(readSharedSnippets(config)[0].scope, 'shared');
  assert.deepEqual(readSharedSnippets(undefined), []);
  assert.deepEqual(readSharedSnippets({}), []);
});

test('upsertSharedSnippet adds a snippet and forces shared scope', () => {
  const out = upsertSharedSnippet({}, snippet({ id: 'a', scope: 'local' }));
  assert.equal(out.customSnippets?.length, 1);
  assert.equal(out.customSnippets?.[0].scope, 'shared');
});

test('upsertSharedSnippet replaces an existing snippet with the same id', () => {
  let config: SnapdsConfig = {};
  config = upsertSharedSnippet(config, snippet({ id: 'a', name: 'First' }));
  config = upsertSharedSnippet(config, snippet({ id: 'a', name: 'Second' }));
  assert.equal(config.customSnippets?.length, 1);
  assert.equal(config.customSnippets?.[0].name, 'Second');
});

test('removeSharedSnippet drops the id and clears the key when empty', () => {
  const config: SnapdsConfig = { customSnippets: [snippet({ id: 'a' })] };
  const out = removeSharedSnippet(config, 'a');
  assert.ok(!('customSnippets' in out), 'empty key should be removed for clean output');
});

test('removeSharedSnippet keeps other snippets', () => {
  const config: SnapdsConfig = { customSnippets: [snippet({ id: 'a' }), snippet({ id: 'b' })] };
  const out = removeSharedSnippet(config, 'a');
  assert.deepEqual(
    out.customSnippets?.map((s) => s.id),
    ['b'],
  );
});

test('mergeSnippets unions both tiers and shared wins an id clash', () => {
  const merged = mergeSnippets(
    [snippet({ id: 'x', name: 'local-x' }), snippet({ id: 'clash', name: 'local' })],
    [snippet({ id: 'y', name: 'shared-y' }), snippet({ id: 'clash', name: 'shared' })],
  );
  const byId = new Map(merged.map((s) => [s.id, s]));
  assert.equal(byId.get('x')?.scope, 'local');
  assert.equal(byId.get('y')?.scope, 'shared');
  assert.equal(byId.get('clash')?.name, 'shared');
  assert.equal(byId.get('clash')?.scope, 'shared');
});

test('diffSharedSnippets counts added, removed, and changed', () => {
  const current = [snippet({ id: 'keep' }), snippet({ id: 'change', name: 'old' })];
  const incoming = [
    snippet({ id: 'keep' }),
    snippet({ id: 'change', name: 'new' }),
    snippet({ id: 'added' }),
  ];
  assert.equal(diffSharedSnippets(current, incoming), 2); // 1 changed + 1 added
  assert.equal(diffSharedSnippets(current, current), 0);
  assert.equal(diffSharedSnippets(current, []), 2); // both removed
});
