import assert from 'node:assert/strict';
import { test } from 'node:test';
import { UserOverridesStore } from './userOverrides';

type Ctx = ConstructorParameters<typeof UserOverridesStore>[0];

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

test('set/get round-trips a user override', async () => {
  const store = new UserOverridesStore(fakeCtx());
  await store.set('@acme/ui', 'Button', { snippet: '<Button />' });
  assert.deepEqual(store.get('@acme/ui', 'Button'), { snippet: '<Button />' });
  assert.equal(store.get('@acme/ui', 'Card'), undefined);
});

test('reset removes only the targeted component', async () => {
  const store = new UserOverridesStore(fakeCtx());
  await store.set('@acme/ui', 'Button', { snippet: 'a' });
  await store.set('@acme/ui', 'Card', { snippet: 'b' });
  await store.reset('@acme/ui', 'Button');
  assert.equal(store.get('@acme/ui', 'Button'), undefined);
  assert.deepEqual(store.get('@acme/ui', 'Card'), { snippet: 'b' });
});

test('reset removes the empty package bucket', async () => {
  const store = new UserOverridesStore(fakeCtx());
  await store.set('@acme/ui', 'Button', { snippet: 'a' });
  await store.reset('@acme/ui', 'Button');
  assert.deepEqual(store.all(), {});
});

test('all() returns an empty object before anything is stored', () => {
  const store = new UserOverridesStore(fakeCtx());
  assert.deepEqual(store.all(), {});
});
