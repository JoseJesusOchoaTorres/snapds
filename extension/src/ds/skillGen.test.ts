import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ComponentMeta } from '../util/messaging';
import {
  buildArtifacts,
  buildComponentSkillMarkdown,
  expectedSkillRelPath,
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
  const md = buildComponentSkillMarkdown(comp('Button'), 'augment', 'button');
  assert.ok(md.startsWith('---'));
  assert.ok(md.includes('name: snapds-button'));
  assert.ok(md.includes('## Import'));
  assert.ok(md.includes('## Usage'));
  assert.ok(md.includes('## Props'));
});

test('generic component markdown has no YAML frontmatter', () => {
  const md = buildComponentSkillMarkdown(comp('Button'), 'generic', 'button');
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
  const md = buildComponentSkillMarkdown(comp('Button'), 'augment', 'button', 'Use inside FormField.');
  assert.ok(md.includes('## Additional guidance'));
  assert.ok(md.includes('Use inside FormField.'));
});

test('expectedSkillRelPath returns the root-relative path per agent', () => {
  const set = [comp('Button'), comp('Card')];
  assert.equal(
    expectedSkillRelPath(set, '@acme/ui#Button', 'augment'),
    '.augment/skills/snapds-button/SKILL.md',
  );
  assert.equal(
    expectedSkillRelPath(set, '@acme/ui#Button', 'claude'),
    '.claude/skills/snapds-button/SKILL.md',
  );
  assert.equal(
    expectedSkillRelPath(set, '@acme/ui#Button', 'cursor'),
    '.cursor/rules/snapds-button.mdc',
  );
  assert.equal(expectedSkillRelPath(set, '@acme/ui#Button', 'generic'), 'snapds-skills/button.md');
});

test('expectedSkillRelPath is undefined for consolidated agents', () => {
  const set = [comp('Button')];
  assert.equal(expectedSkillRelPath(set, '@acme/ui#Button', 'copilot'), undefined);
  assert.equal(expectedSkillRelPath(set, '@acme/ui#Button', 'cline'), undefined);
});

test('expectedSkillRelPath uses the deduped slug over the full component set', () => {
  const rel = expectedSkillRelPath([comp('Nav'), comp('NAV')], '@acme/ui#NAV', 'augment');
  assert.equal(rel, '.augment/skills/snapds-nav-2/SKILL.md');
});

test('claude full build emits a folder router plus one detail file per component', () => {
  const artifacts = buildArtifacts([comp('Button'), comp('Card')], 'claude');
  assert.deepEqual(paths(artifacts), [
    'snapds/SKILL.md',
    'snapds-button/SKILL.md',
    'snapds-card/SKILL.md',
  ]);
});

test('cursor build emits an index rule plus one .mdc per component', () => {
  const artifacts = buildArtifacts([comp('Button'), comp('Card')], 'cursor');
  assert.deepEqual(paths(artifacts), ['snapds-index.mdc', 'snapds-button.mdc', 'snapds-card.mdc']);
});

test('windsurf build emits an index rule plus one .md per component', () => {
  const artifacts = buildArtifacts([comp('Button'), comp('Card')], 'windsurf');
  assert.deepEqual(paths(artifacts), ['snapds-index.md', 'snapds-button.md', 'snapds-card.md']);
});

test('copilot build emits a single consolidated catalog file', () => {
  const artifacts = buildArtifacts([comp('Button'), comp('Card')], 'copilot');
  assert.deepEqual(paths(artifacts), ['instructions/snapds.instructions.md']);
  // Consolidated catalog lists every component inline.
  assert.ok(artifacts[0].contents.includes('### Button'));
  assert.ok(artifacts[0].contents.includes('### Card'));
});

test('cline build emits a single consolidated file', () => {
  const artifacts = buildArtifacts([comp('Button')], 'cline');
  assert.deepEqual(paths(artifacts), ['snapds.md']);
});

test('cursor component rule carries description frontmatter, not a name', () => {
  const md = buildComponentSkillMarkdown(comp('Button'), 'cursor', 'button');
  assert.ok(md.startsWith('---'));
  assert.ok(md.includes('description:'));
  assert.ok(md.includes('alwaysApply: false'));
  assert.ok(!md.includes('name: snapds-button'));
});

test('windsurf component rule carries a model_decision trigger', () => {
  const md = buildComponentSkillMarkdown(comp('Button'), 'windsurf', 'button');
  assert.ok(md.includes('trigger: model_decision'));
});

test('cursor index router is always-on and stays name-only (no props table)', () => {
  const [index] = buildArtifacts([comp('Button'), comp('Card')], 'cursor');
  assert.ok(index.contents.includes('alwaysApply: true'));
  assert.ok(index.contents.includes('Button'));
  assert.ok(!index.contents.includes('| Prop |'));
});

test('copilot consolidated file carries applyTo and the full props table', () => {
  const withProps: ComponentMeta = {
    id: '@acme/ui#Button',
    name: 'Button',
    props: [{ name: 'variant', type: 'string', raw: 'string', required: true }],
  };
  const [file] = buildArtifacts([withProps], 'copilot');
  assert.ok(file.contents.includes("applyTo: '**/*.{tsx,jsx}'"));
  // The consolidated catalog inlines each component's props contract.
  assert.ok(file.contents.includes('| Prop |'));
  assert.ok(file.contents.includes('variant'));
});

test('compact flag drops the props table from consolidated catalogs', () => {
  const withProps: ComponentMeta = {
    id: '@acme/ui#Button',
    name: 'Button',
    props: [{ name: 'variant', type: 'string', raw: 'string', required: true }],
  };
  const [file] = buildArtifacts([withProps], 'copilot', undefined, undefined, true);
  // Still lists the component with import + usage, just without the props table.
  assert.ok(file.contents.includes('### Button'));
  assert.ok(!file.contents.includes('| Prop |'));
});

test('compact flag does not affect per-component agents (they keep props)', () => {
  const withProps: ComponentMeta = {
    id: '@acme/ui#Button',
    name: 'Button',
    props: [{ name: 'variant', type: 'string', raw: 'string', required: true }],
  };
  // A cursor detail file always carries the full table regardless of compact.
  const md = buildComponentSkillMarkdown(withProps, 'cursor', 'button');
  assert.ok(md.includes('| Prop |'));
});
