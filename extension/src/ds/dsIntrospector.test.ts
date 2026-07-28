// @ts-nocheck
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { UserOverridesStore } from '../state/userOverrides';
import { DsIntrospector } from './dsIntrospector';

// ---------------------------------------------------------------------------
// Fake contexts
// ---------------------------------------------------------------------------

function makeGlobalState() {
  const data = {};
  return {
    get: (key) => data[key],
    update: async (key, value) => {
      if (value === undefined) delete data[key];
      else data[key] = value;
    },
    keys: () => Object.keys(data),
  };
}

function fakeCtx() {
  return { globalState: makeGlobalState() };
}

function fakeOverrides() {
  const data = {};
  const ctx = {
    workspaceState: {
      get: (key) => data[key],
      update: async (key, value) => {
        if (value === undefined) delete data[key];
        else data[key] = value;
      },
      keys: () => Object.keys(data),
    },
  };
  return new UserOverridesStore(ctx);
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const PKG = { name: '@acme/ui', version: '1.0.0', importPath: '@acme/ui' };
// CACHE_SCHEMA_VERSION = 3 (from dsIntrospector.ts)
const CACHE_KEY = 'ds.cache.v3.@acme/ui@1.0.0';

const mkProp = (overrides) => ({ type: 'string', raw: 'string', required: false, ...overrides });

const mkComp = (name, props = []) => ({ id: `@acme/ui#${name}`, name, props });

// ---------------------------------------------------------------------------
// clearCache
// ---------------------------------------------------------------------------

test('clearCache on an empty store returns 0', async () => {
  const ctx = fakeCtx();
  const introspector = new DsIntrospector(ctx, fakeOverrides());
  assert.equal(await introspector.clearCache(), 0);
});

test('clearCache removes all ds.cache.* entries', async () => {
  const ctx = fakeCtx();
  await ctx.globalState.update(CACHE_KEY, [mkComp('Button')]);
  await ctx.globalState.update('ds.cache.v2.legacy@0.9.0', [mkComp('Old')]);
  const introspector = new DsIntrospector(ctx, fakeOverrides());
  const count = await introspector.clearCache();
  assert.equal(count, 2);
  assert.equal(ctx.globalState.get(CACHE_KEY), undefined);
  assert.equal(ctx.globalState.get('ds.cache.v2.legacy@0.9.0'), undefined);
});

test('clearCache leaves non-cache keys untouched', async () => {
  const ctx = fakeCtx();
  await ctx.globalState.update(CACHE_KEY, [mkComp('Button')]);
  await ctx.globalState.update('snapds.userOverrides', { '@acme/ui': {} });
  const introspector = new DsIntrospector(ctx, fakeOverrides());
  await introspector.clearCache();
  assert.deepEqual(ctx.globalState.get('snapds.userOverrides'), { '@acme/ui': {} });
});

// ---------------------------------------------------------------------------
// invalidate
// ---------------------------------------------------------------------------

test('invalidate removes the specific cache entry', async () => {
  const ctx = fakeCtx();
  await ctx.globalState.update(CACHE_KEY, [mkComp('Button')]);
  const introspector = new DsIntrospector(ctx, fakeOverrides());
  await introspector.invalidate(PKG);
  assert.equal(ctx.globalState.get(CACHE_KEY), undefined);
});

test('invalidate leaves other cache entries untouched', async () => {
  const ctx = fakeCtx();
  const otherKey = 'ds.cache.v3.@other/lib@2.0.0';
  await ctx.globalState.update(CACHE_KEY, [mkComp('Button')]);
  await ctx.globalState.update(otherKey, [mkComp('Card')]);
  const introspector = new DsIntrospector(ctx, fakeOverrides());
  await introspector.invalidate(PKG);
  assert.deepEqual(ctx.globalState.get(otherKey), [mkComp('Card')]);
});

// ---------------------------------------------------------------------------
// getCached
// ---------------------------------------------------------------------------

test('getCached returns undefined when no entry is cached', () => {
  const introspector = new DsIntrospector(fakeCtx(), fakeOverrides());
  assert.equal(introspector.getCached(PKG), undefined);
});

test('getCached returns the cached components', async () => {
  const ctx = fakeCtx();
  const comps = [mkComp('Button', [mkProp({ name: 'label' })])];
  await ctx.globalState.update(CACHE_KEY, comps);
  const introspector = new DsIntrospector(ctx, fakeOverrides());
  assert.deepEqual(introspector.getCached(PKG), comps);
});

test('getCached applies user override: hides a prop', async () => {
  const overrides = fakeOverrides();
  await overrides.set('@acme/ui', 'Button', { props: { variant: { hidden: true } } });

  const ctx = fakeCtx();
  await ctx.globalState.update(CACHE_KEY, [
    mkComp('Button', [mkProp({ name: 'label' }), mkProp({ name: 'variant' })]),
  ]);
  const introspector = new DsIntrospector(ctx, overrides);
  const result = introspector.getCached(PKG);
  assert.equal(result[0].props.length, 1);
  assert.equal(result[0].props[0].name, 'label');
});

test('getCached applies user override: overrides defaultValue and description', async () => {
  const overrides = fakeOverrides();
  await overrides.set('@acme/ui', 'Button', {
    props: { size: { defaultValue: 'lg', description: 'Overridden description' } },
  });

  const ctx = fakeCtx();
  await ctx.globalState.update(CACHE_KEY, [
    mkComp('Button', [mkProp({ name: 'size', defaultValue: 'md', description: 'Original' })]),
  ]);
  const introspector = new DsIntrospector(ctx, overrides);
  const result = introspector.getCached(PKG);
  const sizeProp = result[0].props[0];
  assert.equal(sizeProp.defaultValue, 'lg');
  assert.equal(sizeProp.description, 'Overridden description');
});

test('getCached applies user override: preserves original defaultValue when override is absent', async () => {
  const overrides = fakeOverrides();
  await overrides.set('@acme/ui', 'Button', {
    props: { size: { description: 'New desc' } },
  });

  const ctx = fakeCtx();
  await ctx.globalState.update(CACHE_KEY, [
    mkComp('Button', [mkProp({ name: 'size', defaultValue: 'md' })]),
  ]);
  const introspector = new DsIntrospector(ctx, overrides);
  const result = introspector.getCached(PKG);
  assert.equal(result[0].props[0].defaultValue, 'md');
});

test('getCached applies user override: addedProps injects a new prop', async () => {
  const overrides = fakeOverrides();
  await overrides.set('@acme/ui', 'Button', {
    addedProps: [{ name: 'customProp', type: 'string', description: 'Custom' }],
  });

  const ctx = fakeCtx();
  await ctx.globalState.update(CACHE_KEY, [mkComp('Button', [mkProp({ name: 'label' })])]);
  const introspector = new DsIntrospector(ctx, overrides);
  const result = introspector.getCached(PKG);
  assert.equal(result[0].props.length, 2);
  const added = result[0].props.find((p) => p.name === 'customProp');
  assert.equal(added.type, 'string');
  assert.equal(added.description, 'Custom');
  assert.equal(added.required, false);
});

test('getCached applies user override: addedProps skips duplicate names', async () => {
  const overrides = fakeOverrides();
  await overrides.set('@acme/ui', 'Button', {
    addedProps: [{ name: 'label', type: 'boolean' }],
  });

  const ctx = fakeCtx();
  await ctx.globalState.update(CACHE_KEY, [mkComp('Button', [mkProp({ name: 'label' })])]);
  const introspector = new DsIntrospector(ctx, overrides);
  const result = introspector.getCached(PKG);
  assert.equal(result[0].props.length, 1);
  assert.equal(result[0].props[0].type, 'string'); // original, not replaced
});

test('getCached applies user override: overrides snippet', async () => {
  const overrides = fakeOverrides();
  await overrides.set('@acme/ui', 'Button', { snippet: '<Button custom />' });

  const ctx = fakeCtx();
  await ctx.globalState.update(CACHE_KEY, [mkComp('Button')]);
  const introspector = new DsIntrospector(ctx, overrides);
  const result = introspector.getCached(PKG);
  assert.equal(result[0].snippet, '<Button custom />');
});

test('getCached does not modify components when no user override is set', async () => {
  const ctx = fakeCtx();
  const comps = [mkComp('Button', [mkProp({ name: 'label' })])];
  await ctx.globalState.update(CACHE_KEY, comps);
  const introspector = new DsIntrospector(ctx, fakeOverrides());
  assert.deepEqual(introspector.getCached(PKG), comps);
});

// ---------------------------------------------------------------------------
// introspect (cache-hit path)
// ---------------------------------------------------------------------------

test('introspect returns cached data without re-parsing', async () => {
  const ctx = fakeCtx();
  const comps = [mkComp('Button')];
  await ctx.globalState.update(CACHE_KEY, comps);
  const introspector = new DsIntrospector(ctx, fakeOverrides());
  assert.deepEqual(await introspector.introspect(PKG), comps);
});

test('introspect with a version override resolves from the versioned cache key', async () => {
  const ctx = fakeCtx();
  const comps = [mkComp('Avatar')];
  const versionedKey = 'ds.cache.v3.@acme/ui@2.0.0';
  await ctx.globalState.update(versionedKey, comps);
  const introspector = new DsIntrospector(ctx, fakeOverrides());
  assert.deepEqual(await introspector.introspect(PKG, { version: '2.0.0' }), comps);
});

test('introspect applies user overrides on top of the cached data', async () => {
  const overrides = fakeOverrides();
  await overrides.set('@acme/ui', 'Button', { snippet: '<Button cached-override />' });

  const ctx = fakeCtx();
  await ctx.globalState.update(CACHE_KEY, [mkComp('Button')]);
  const introspector = new DsIntrospector(ctx, overrides);
  const result = await introspector.introspect(PKG);
  assert.equal(result[0].snippet, '<Button cached-override />');
});

// ---------------------------------------------------------------------------
// getCompanyOverride
// ---------------------------------------------------------------------------

test('getCompanyOverride returns undefined when no workspace folder is open', () => {
  // vscode.workspace.workspaceFolders is undefined in the test stub (see test-utils/vscode.ts)
  const introspector = new DsIntrospector(fakeCtx(), fakeOverrides());
  assert.equal(introspector.getCompanyOverride('@acme/ui', 'Button'), undefined);
});
