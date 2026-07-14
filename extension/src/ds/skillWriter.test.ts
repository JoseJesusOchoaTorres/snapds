import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { test } from 'node:test';
import { parseSkillMeta, resolveWithinBase } from './skillWriter';

const BASE = path.resolve(os.tmpdir(), 'snapds-skills-base');

test('resolveWithinBase resolves a simple relative path under the base', () => {
  const full = resolveWithinBase(BASE, 'Button/SKILL.md');
  assert.equal(full, path.join(BASE, 'Button', 'SKILL.md'));
});

test('resolveWithinBase allows deeply nested paths', () => {
  const full = resolveWithinBase(BASE, 'a/b/c/skill.md');
  assert.equal(full, path.join(BASE, 'a', 'b', 'c', 'skill.md'));
});

test('resolveWithinBase rejects parent-directory traversal', () => {
  assert.equal(resolveWithinBase(BASE, '../evil.md'), undefined);
  assert.equal(resolveWithinBase(BASE, 'sub/../../evil.md'), undefined);
});

test('resolveWithinBase rejects absolute paths that escape the base', () => {
  assert.equal(resolveWithinBase(BASE, path.resolve(os.tmpdir(), 'elsewhere.md')), undefined);
});

test('resolveWithinBase rejects a path that equals the base itself', () => {
  assert.equal(resolveWithinBase(BASE, ''), undefined);
  assert.equal(resolveWithinBase(BASE, '.'), undefined);
});

/** Creates a temp file with the given contents and returns its absolute path. */
function tmpFile(name: string, contents: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'snapds-meta-'));
  const full = path.join(dir, name);
  fs.writeFileSync(full, contents, 'utf8');
  return full;
}

test('parseSkillMeta reads name/description from YAML frontmatter', () => {
  const full = tmpFile(
    'SKILL.md',
    '---\nname: Button\ndescription: A clickable button\n---\n\n# Button\n\nBody text.\n',
  );
  assert.deepEqual(parseSkillMeta(full), {
    title: 'Button',
    description: 'A clickable button',
  });
});

test('parseSkillMeta falls back to the first heading and body line', () => {
  const full = tmpFile('doc.md', '# Card\n\nA surface container.\n');
  assert.deepEqual(parseSkillMeta(full), {
    title: 'Card',
    description: 'A surface container.',
  });
});

test('parseSkillMeta skips comments when choosing the description', () => {
  const full = tmpFile('doc.md', '# Modal\n\n<!-- generated -->\nOverlay dialog.\n');
  assert.deepEqual(parseSkillMeta(full), {
    title: 'Modal',
    description: 'Overlay dialog.',
  });
});

test('parseSkillMeta returns an empty object for a missing file', () => {
  assert.deepEqual(parseSkillMeta(path.join(os.tmpdir(), 'does-not-exist-xyz.md')), {});
});
