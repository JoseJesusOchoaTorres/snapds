import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AGENT_ORDER, AGENTS } from './skillAgents';

test('every agent in the order map has a registry entry', () => {
  for (const id of AGENT_ORDER) assert.ok(AGENTS[id], `missing descriptor for ${id}`);
  assert.equal(AGENT_ORDER.length, Object.keys(AGENTS).length);
});

test('owns() scopes listing to snapds files per agent', () => {
  // augment/claude folder layout
  assert.ok(AGENTS.augment.owns('snapds/SKILL.md'));
  assert.ok(AGENTS.augment.owns('snapds-button/SKILL.md'));
  assert.ok(!AGENTS.augment.owns('other-skill/SKILL.md'));
  // cursor flat .mdc
  assert.ok(AGENTS.cursor.owns('snapds-index.mdc'));
  assert.ok(AGENTS.cursor.owns('snapds-button.mdc'));
  assert.ok(!AGENTS.cursor.owns('my-own-rule.mdc'));
  // copilot only its consolidated instructions file
  assert.ok(AGENTS.copilot.owns('instructions/snapds.instructions.md'));
  assert.ok(!AGENTS.copilot.owns('copilot-instructions.md'));
  assert.ok(!AGENTS.copilot.owns('workflows/ci.md'));
  // generic
  assert.ok(AGENTS.generic.owns('AGENTS.md'));
  assert.ok(AGENTS.generic.owns('snapds-skills/button.md'));
  assert.ok(!AGENTS.generic.owns('README.md'));
});

test('the router path is always owned by its agent', () => {
  for (const id of AGENT_ORDER) {
    const a = AGENTS[id];
    assert.ok(a.owns(a.routerRelPath), `${id} does not own its own router ${a.routerRelPath}`);
  }
});

test('consolidated agents expose no per-component path', () => {
  assert.equal(AGENTS.copilot.componentRelPath, undefined);
  assert.equal(AGENTS.cline.componentRelPath, undefined);
  assert.ok(AGENTS.claude.componentRelPath);
});
