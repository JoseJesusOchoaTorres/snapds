import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CustomSnippet } from '../util/messaging';
import {
  categoryOf,
  newSnippetId,
  normalizeCategory,
  SnippetStore,
  UNCATEGORIZED,
} from './snippetStore';

type Ctx = ConstructorParameters<typeof SnippetStore>[0];

/** Minimal in-memory stand-in for `ctx` backed by a plain object `workspaceState`. */
function fakeCtx(): Ctx {
  const data: Record<string, unknown> = {};
  const workspaceState = {
    get: <T>(key: string): T | undefined => data[key] as T | undefined,
    update: async (key: string, value: unknown): Promise<void> => {
      if (value === undefined) delete data[key];
      else data[key] = value;
    },
    keys: () => Object.keys(data),
  };
  return { workspaceState } as unknown as Ctx;
}

const snippet = (over: Partial<CustomSnippet> & { id: string }): CustomSnippet => ({
  name: 'Snippet',
  code: '<Button />',
  imports: [],
  languageId: 'typescriptreact',
  scope: 'local',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

test('newSnippetId uses the reserved snippet namespace', () => {
  const id = newSnippetId();
  assert.ok(id.startsWith('snippet:'), id);
  assert.ok(!id.includes('#'), 'must not use the pkg#Name space');
});

test('normalizeCategory trims and treats empty / the reserved label as none', () => {
  assert.equal(normalizeCategory('  Forms '), 'Forms');
  assert.equal(normalizeCategory(''), undefined);
  assert.equal(normalizeCategory('   '), undefined);
  assert.equal(normalizeCategory(undefined), undefined);
  assert.equal(normalizeCategory('uncategorized'), undefined);
});

test('categoryOf falls back to the reserved bucket', () => {
  assert.equal(categoryOf(snippet({ id: 'a', category: 'Forms' })), 'Forms');
  assert.equal(categoryOf(snippet({ id: 'b' })), UNCATEGORIZED);
  assert.equal(categoryOf(snippet({ id: 'c', category: '  ' })), UNCATEGORIZED);
});

test('save/get round-trips a snippet and forces local scope', async () => {
  const store = new SnippetStore(fakeCtx());
  await store.save(snippet({ id: 'snippet:1', scope: 'shared' }));
  const got = store.get('snippet:1');
  assert.equal(got?.id, 'snippet:1');
  assert.equal(got?.scope, 'local');
  assert.equal(store.get('snippet:missing'), undefined);
});

test('save replaces an existing snippet with the same id', async () => {
  const store = new SnippetStore(fakeCtx());
  await store.save(snippet({ id: 'snippet:1', name: 'First' }));
  await store.save(snippet({ id: 'snippet:1', name: 'Second' }));
  assert.equal(store.all().length, 1);
  assert.equal(store.get('snippet:1')?.name, 'Second');
});

test('all() returns newest first by createdAt', async () => {
  const store = new SnippetStore(fakeCtx());
  await store.save(snippet({ id: 'old', createdAt: '2026-01-01T00:00:00.000Z' }));
  await store.save(snippet({ id: 'new', createdAt: '2026-06-01T00:00:00.000Z' }));
  assert.deepEqual(
    store.all().map((s) => s.id),
    ['new', 'old'],
  );
});

test('remove deletes only the targeted snippet', async () => {
  const store = new SnippetStore(fakeCtx());
  await store.save(snippet({ id: 'a' }));
  await store.save(snippet({ id: 'b' }));
  await store.remove('a');
  assert.equal(store.get('a'), undefined);
  assert.equal(store.get('b')?.id, 'b');
});

test('all() is empty (a real zero, not "not loaded") before anything is stored', () => {
  assert.deepEqual(new SnippetStore(fakeCtx()).all(), []);
});

test('recategorize sets and clears a category', async () => {
  const store = new SnippetStore(fakeCtx());
  await store.save(snippet({ id: 'a', category: 'Forms' }));
  await store.recategorize('a', 'Layout');
  assert.equal(store.get('a')?.category, 'Layout');
  await store.recategorize('a', '  ');
  assert.equal(store.get('a')?.category, undefined);
});

test('renameCategory moves every snippet in that bucket', async () => {
  const store = new SnippetStore(fakeCtx());
  await store.save(snippet({ id: 'a', category: 'Forms' }));
  await store.save(snippet({ id: 'b', category: 'Forms' }));
  await store.save(snippet({ id: 'c', category: 'Layout' }));
  await store.renameCategory('Forms', 'Inputs');
  assert.equal(store.get('a')?.category, 'Inputs');
  assert.equal(store.get('b')?.category, 'Inputs');
  assert.equal(store.get('c')?.category, 'Layout');
});

test('deleteCategory moves its snippets to uncategorized', async () => {
  const store = new SnippetStore(fakeCtx());
  await store.save(snippet({ id: 'a', category: 'Forms' }));
  await store.deleteCategory('Forms');
  const moved = store.get('a');
  assert.ok(moved);
  assert.equal(moved.category, undefined);
  assert.equal(categoryOf(moved), UNCATEGORIZED);
});

test('categories lists distinct real categories alphabetically', async () => {
  const store = new SnippetStore(fakeCtx());
  await store.save(snippet({ id: 'a', category: 'Layout' }));
  await store.save(snippet({ id: 'b', category: 'Forms' }));
  await store.save(snippet({ id: 'c' }));
  assert.deepEqual(store.categories(), ['Forms', 'Layout']);
});
