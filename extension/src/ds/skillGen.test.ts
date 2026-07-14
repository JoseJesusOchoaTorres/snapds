import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ComponentMeta } from '../util/messaging';
import {
  buildArtifacts,
  buildComponentSkillMarkdown,
  expectedSkillRelPaths,
  kebab,
  resolveGuidance,
} from './skillGen';

const comp = (name: string): ComponentMeta => ({ id: `@acme/ui#${name}`, name, props: [] });
const paths = (a: { relativePath: string }[]) => a.map((x) => x.relativePath);

test('kebab converts PascalCase and separators to kebab-case', () => {
  assert.equal(kebab('ButtonGroup'), 'button-group');
  assert.equal(kebab('Text_Field'), 'text-field');
  assert.equal(kebab('Nav'), 'nav');
});

test('augment full build emits a router index plus one detail file per component', () => {
  const artifacts = buildArtifacts([comp('Button'), comp('Card')], 'augment');
  assert.deepEqual(paths(artifacts), [
    'snapds/SKILL.md',
    'snapds-button/SKILL.md',
    'snapds-card/SKILL.md',
  ]);
});

test('generic full build emits AGENTS.md plus per-component detail files', () => {
  const artifacts = buildArtifacts([comp('Button'), comp('Card')], 'generic');
  assert.deepEqual(paths(artifacts), [
    'AGENTS.md',
    'snapds-skills/button.md',
    'snapds-skills/card.md',
  ]);
});

test('incremental build rewrites the index but only changed detail files', () => {
  const changed = new Set(['@acme/ui#Card']);
  const artifacts = buildArtifacts([comp('Button'), comp('Card')], 'augment', changed);
  assert.deepEqual(paths(artifacts), ['snapds/SKILL.md', 'snapds-card/SKILL.md']);
});

test('the index always lists every component even in incremental mode', () => {
  const changed = new Set(['@acme/ui#Card']);
  const [index] = buildArtifacts([comp('Button'), comp('Card')], 'augment', changed);
  assert.ok(index.contents.includes('Button'));
  assert.ok(index.contents.includes('Card'));
});

test('colliding slugs are deduped with a numeric suffix', () => {
  const artifacts = buildArtifacts([comp('Nav'), comp('NAV')], 'generic');
  assert.deepEqual(paths(artifacts), [
    'AGENTS.md',
    'snapds-skills/nav.md',
    'snapds-skills/nav-2.md',
  ]);
});

test('augment component markdown carries YAML frontmatter and sections', () => {
  const md = buildComponentSkillMarkdown(comp('Button'), 'augment');
  assert.ok(md.startsWith('---'));
  assert.ok(md.includes('name: snapds-button'));
  assert.ok(md.includes('## Import'));
  assert.ok(md.includes('## Usage'));
  assert.ok(md.includes('## Props'));
});

test('generic component markdown has no YAML frontmatter', () => {
  const md = buildComponentSkillMarkdown(comp('Button'), 'generic');
  assert.ok(!md.startsWith('---'));
  assert.ok(md.includes('**Import**'));
});

test('resolveGuidance keeps the trimmed free-text note per component', () => {
  const g = resolveGuidance(
    { instructions: { '@acme/ui#Button': '  Prefer variant=primary.  ' } },
    ['@acme/ui#Button'],
  );
  assert.equal(g.perComponent['@acme/ui#Button'], 'Prefer variant=primary.');
});

test('resolveGuidance omits components without any guidance', () => {
  const g = resolveGuidance({ instructions: {} }, ['@acme/ui#Button']);
  assert.equal(g.perComponent['@acme/ui#Button'], undefined);
});

test('component markdown appends an Additional guidance section when provided', () => {
  const md = buildComponentSkillMarkdown(comp('Button'), 'augment', 'Use inside FormField.');
  assert.ok(md.includes('## Additional guidance'));
  assert.ok(md.includes('Use inside FormField.'));
});

test('expectedSkillRelPaths returns augment + generic paths for a component', () => {
  const rel = expectedSkillRelPaths([comp('Button'), comp('Card')], '@acme/ui#Button');
  assert.deepEqual(rel, {
    augment: '.augment/skills/snapds-button/SKILL.md',
    generic: 'snapds-skills/button.md',
  });
});

test('expectedSkillRelPaths uses the deduped slug over the full component set', () => {
  const rel = expectedSkillRelPaths([comp('Nav'), comp('NAV')], '@acme/ui#NAV');
  assert.deepEqual(rel, {
    augment: '.augment/skills/snapds-nav-2/SKILL.md',
    generic: 'snapds-skills/nav-2.md',
  });
});
