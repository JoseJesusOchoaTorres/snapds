import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ComponentMeta } from '../util/messaging';
import { applyWhitelist } from './whitelist';

const meta = (name: string): ComponentMeta => ({ id: `@acme/ui#${name}`, name, props: [] });
const all = [meta('Button'), meta('Card'), meta('Link')];
const names = (c: ComponentMeta[]) => c.map((x) => x.name);

test('auto-includes every detected component when nothing is excluded', () => {
  const result = applyWhitelist(all, { name: '@acme/ui' });
  assert.deepEqual(names(result), ['Button', 'Card', 'Link']);
});

test('a newly-added upstream component is auto-included by default', () => {
  const withNew = [...all, meta('Badge')];
  const result = applyWhitelist(withNew, { name: '@acme/ui', excluded: ['Card'] });
  assert.deepEqual(names(result), ['Button', 'Link', 'Badge']);
});

test('excluded components are removed', () => {
  const result = applyWhitelist(all, { name: '@acme/ui', excluded: ['Card'] });
  assert.deepEqual(names(result), ['Button', 'Link']);
});

test('manual names are appended as empty-prop placeholders with a namespaced id', () => {
  const result = applyWhitelist(all, { name: '@acme/ui', manual: ['Text'] });
  assert.deepEqual(names(result), ['Button', 'Card', 'Link', 'Text']);
  const added = result.find((c) => c.name === 'Text')!;
  assert.equal(added.id, '@acme/ui#Text');
  assert.deepEqual(added.props, []);
});

test('a manual name already detected is not duplicated', () => {
  const result = applyWhitelist(all, { name: '@acme/ui', manual: ['Button'] });
  assert.deepEqual(names(result), ['Button', 'Card', 'Link']);
});

test('a manual name that is also excluded is not added', () => {
  const result = applyWhitelist(all, {
    name: '@acme/ui',
    excluded: ['Text'],
    manual: ['Text'],
  });
  assert.deepEqual(names(result), ['Button', 'Card', 'Link']);
});
