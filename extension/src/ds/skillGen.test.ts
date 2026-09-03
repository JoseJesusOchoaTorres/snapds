import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ComponentMeta, CustomSnippet } from '../util/messaging';
import {
  buildArtifacts,
  buildComponentSkillMarkdown,
  buildMainSkillMarkdown,
  buildSnippetDetailMarkdown,
  buildSnippetsRouterMarkdown,
  buildSnippetsSkillMarkdown,
  expectedSkillRelPath,
  kebab,
  resolveGuidance,
} from './skillGen';

const comp = (name: string): ComponentMeta => ({ id: `@acme/ui#${name}`, name, props: [] });

const snip = (over: Partial<CustomSnippet> & { id: string; name: string }): CustomSnippet => ({
  description: '',
  category: undefined,
  code: '<Button />',
  imports: [],
  languageId: 'typescriptreact',
  scope: 'local',
  createdAt: 'T',
  ...over,
});
const paths = (a: { relativePath: string }[]) => a.map((x) => x.relativePath);

const testSnip = snip({
  id: 'snippet:1',
  name: 'Labeled pair',
  category: 'Forms',
  description: 'Two buttons in a label',
  code: '<Label><Button /></Label>',
  imports: [{ kind: 'named', specifier: '@acme/ui', names: ['Button', 'Label'] }],
});

// ── Router snippet behaviour ──────────────────────────────────────────────────

test('buildMainSkillMarkdown adds a router link (not inline content) for non-consolidated agents', () => {
  // Augment has a snippetsRouterRelPath — the router must link to the file, not inline the catalog.
  const md = buildMainSkillMarkdown(
    [comp('Button')],
    'augment',
    new Map([['@acme/ui#Button', 'button']]),
    undefined,
    false,
    [testSnip],
  );
  assert.ok(md.includes('## Custom Snippets'), 'has the snippets heading');
  assert.ok(md.includes('snapds-snippets'), 'links to the snippets router skill');
  // The full catalog content must NOT be inlined into the component router.
  assert.ok(!md.includes('#### Labeled pair'), 'snippet details are not inlined in the router');
  assert.ok(!md.includes('### Forms'), 'category not inlined in the router');
});

test('buildMainSkillMarkdown inlines snippets for consolidated agents', () => {
  // Copilot has no snippetsRouterRelPath — snippets must be inlined into the catalog file.
  const md = buildMainSkillMarkdown(
    [comp('Button')],
    'copilot',
    new Map([['@acme/ui#Button', 'button']]),
    undefined,
    false,
    [testSnip],
  );
  assert.ok(md.includes('## Custom Snippets'), 'has the snippets section');
  assert.ok(md.includes('### Forms'), 'groups by category inline');
  assert.ok(md.includes('#### Labeled pair'), 'lists the snippet name inline');
  assert.ok(md.includes("import { Button, Label } from '@acme/ui';"), 'renders imports inline');
  assert.ok(md.includes('<Label><Button /></Label>'), 'renders the code inline');
});

test('buildMainSkillMarkdown omits the snippets section when none are given', () => {
  const md = buildMainSkillMarkdown(
    [comp('Button')],
    'augment',
    new Map([['@acme/ui#Button', 'button']]),
  );
  assert.ok(!md.includes('## Custom Snippets'));
});

// ── buildSnippetsRouterMarkdown ───────────────────────────────────────────────

test('buildSnippetsRouterMarkdown produces a router that links to per-snippet detail files', () => {
  const slugs = new Map([['snippet:1', 'labeled-pair']]);
  const md = buildSnippetsRouterMarkdown([testSnip], slugs, 'augment');
  assert.ok(md.includes('name: snapds-snippets'), 'carries augment router frontmatter');
  assert.ok(md.includes('# Custom Snippets'), 'has the top-level heading');
  assert.ok(md.includes('## Forms'), 'groups by category');
  assert.ok(md.includes('Labeled pair'), 'lists the snippet name');
  // Router links to detail file, not inline code
  assert.ok(md.includes('snapds-snippet-labeled-pair'), 'links to the per-snippet detail file');
  assert.ok(!md.includes('import { Button'), 'does NOT inline the snippet code');
});

test('buildSnippetsRouterMarkdown for cursor lists skill names (flat-lazy)', () => {
  const slugs = new Map([['snippet:1', 'labeled-pair']]);
  const md = buildSnippetsRouterMarkdown([testSnip], slugs, 'cursor');
  assert.ok(md.includes('snapds-snippet-labeled-pair'), 'lists the snippet rule name');
  assert.ok(!md.includes('import {'), 'does NOT inline snippet code');
});

test('buildSnippetsRouterMarkdown for windsurf carries trigger: model_decision', () => {
  const slugs = new Map([['snippet:1', 'labeled-pair']]);
  const md = buildSnippetsRouterMarkdown([testSnip], slugs, 'windsurf');
  assert.ok(md.includes('trigger: model_decision'));
});

// ── buildSnippetDetailMarkdown ────────────────────────────────────────────────

test('buildSnippetDetailMarkdown produces a per-snippet detail file with code and frontmatter', () => {
  const md = buildSnippetDetailMarkdown(testSnip, 'labeled-pair', 'augment');
  assert.ok(md.includes('name: snapds-snippet-labeled-pair'), 'carries per-snippet frontmatter');
  assert.ok(md.includes('# Labeled pair'), 'has the snippet name as heading');
  assert.ok(md.includes('**Category:** Forms'), 'includes the category');
  assert.ok(md.includes('Two buttons in a label'), 'includes the description');
  assert.ok(md.includes("import { Button, Label } from '@acme/ui';"), 'renders imports');
  assert.ok(md.includes('<Label><Button /></Label>'), 'renders the code');
});

// ── buildSnippetsSkillMarkdown (compat wrapper) ───────────────────────────────

test('buildSnippetsSkillMarkdown (compat) delegates to buildSnippetsRouterMarkdown', () => {
  const md = buildSnippetsSkillMarkdown([testSnip], 'augment');
  // Should produce a router (links to detail files) not inline code
  assert.ok(md.includes('name: snapds-snippets'), 'carries augment frontmatter');
  assert.ok(md.includes('# Custom Snippets'), 'has the top-level heading');
  assert.ok(md.includes('snapds-snippet-labeled-pair'), 'links to per-snippet detail files');
});

// ── buildArtifacts — snippets files ──────────────────────────────────────────

test('buildArtifacts emits a snippets router + per-snippet detail for augment when snippets are given', () => {
  const artifacts = buildArtifacts([comp('Button')], 'augment', undefined, undefined, false, [
    testSnip,
  ]);
  const relPaths = paths(artifacts);
  assert.ok(relPaths.includes('snapds-snippets/SKILL.md'), 'snippets router present');
  assert.ok(
    relPaths.includes('snapds-snippet-labeled-pair/SKILL.md'),
    'per-snippet detail present',
  );
  assert.ok(relPaths.includes('snapds/SKILL.md'), 'component router still present');
});

test('buildArtifacts emits a snippets router + per-snippet detail for cursor when snippets are given', () => {
  const artifacts = buildArtifacts([comp('Button')], 'cursor', undefined, undefined, false, [
    testSnip,
  ]);
  const relPaths = paths(artifacts);
  assert.ok(relPaths.includes('snapds-snippets.mdc'), 'snippets router present');
  assert.ok(relPaths.includes('snapds-snippet-labeled-pair.mdc'), 'per-snippet detail present');
});

test('buildArtifacts does NOT emit snippets files for consolidated agents', () => {
  const copilot = buildArtifacts([comp('Button')], 'copilot', undefined, undefined, false, [
    testSnip,
  ]);
  assert.deepEqual(paths(copilot), ['instructions/snapds.instructions.md']);
  const cline = buildArtifacts([comp('Button')], 'cline', undefined, undefined, false, [testSnip]);
  assert.deepEqual(paths(cline), ['snapds.md']);
});

test('buildArtifacts does NOT emit snippets files when no snippets are given', () => {
  const artifacts = buildArtifacts([comp('Button')], 'augment');
  assert.ok(!paths(artifacts).includes('snapds-snippets/SKILL.md'));
  assert.ok(!paths(artifacts).some((p) => p.includes('snippet-')));
});

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
  const md = buildComponentSkillMarkdown(
    comp('Button'),
    'augment',
    'button',
    'Use inside FormField.',
  );
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
  // The flat-lazy router lists each component by its loadable rule name
  // (`snapds-<slug>`) for on-demand discovery — not the display name.
  assert.ok(index.contents.includes('snapds-button'));
  assert.ok(index.contents.includes('snapds-card'));
  assert.ok(!index.contents.includes('| Prop |'));
  // Name-only means the loadable rule names, never the display names.
  assert.ok(!index.contents.includes('Button'));
  assert.ok(!index.contents.includes('Card'));
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

test('props table escapes backslashes so a prop value cannot break the markdown table', () => {
  const meta: ComponentMeta = {
    id: '@acme/ui#Input',
    name: 'Input',
    // description holds a\|b — a backslash before a pipe. Without escaping the
    // backslash first (js/incomplete-sanitization) it becomes a\\|b, whose '|'
    // opens a new table column. Escaping backslash first yields a\\\|b: literal
    // backslash + literal pipe, keeping the value inside its cell.
    props: [{ name: 'value', type: 'string', raw: 'string', required: true, description: 'a\\|b' }],
  };
  const md = buildComponentSkillMarkdown(meta, 'augment', 'input');
  assert.ok(md.includes('a\\\\\\|b'), `backslash not escaped first: ${md}`);
});
