import assert from 'node:assert/strict';
import * as path from 'node:path';
import { test } from 'node:test';
import { aliasToDir, fileToSpecifier, parseAliasMappings, specifierForFile } from './aliasResolver';

// Mirrors acme's real config: tsconfig `paths: { "@/*": ["./src/*"] }`, no
// baseUrl (base = the tsconfig's own dir), components.json `aliases.ui` =
// "@/components/ui", and App.tsx importing `@/components/ui/button`.
//
// Directory fixtures are built with node:path so they stay platform-neutral
// (the resolver returns OS-native paths). The resolved *specifiers* (`@/…`) are
// import strings and are always forward-slash, so those stay literal.
const ROOT = path.resolve('/repo');
const srcDir = path.join(ROOT, 'src');
const uiDir = path.join(ROOT, 'src', 'components', 'ui');
const mappings = parseAliasMappings({ '@/*': ['./src/*'] }, ROOT);

test('parseAliasMappings resolves a wildcard glob to an absolute target dir', () => {
  assert.deepEqual(mappings, [{ prefix: '@/', targetDir: srcDir }]);
});

test('parseAliasMappings ignores non-glob and empty inputs', () => {
  assert.deepEqual(parseAliasMappings({ '@': ['./src'] }, ROOT), []);
  assert.deepEqual(parseAliasMappings(undefined, ROOT), []);
});

test('aliasToDir resolves the shadcn ui alias to its folder', () => {
  assert.equal(aliasToDir('@/components/ui', mappings), uiDir);
});

test('aliasToDir returns null for an unaliased specifier', () => {
  assert.equal(aliasToDir('react', mappings), null);
});

test('fileToSpecifier reproduces the real per-file import (button.tsx)', () => {
  assert.equal(fileToSpecifier(path.join(uiDir, 'button.tsx'), mappings), '@/components/ui/button');
});

test('fileToSpecifier handles nested folders', () => {
  assert.equal(
    fileToSpecifier(path.join(uiDir, 'forms', 'input.tsx'), mappings),
    '@/components/ui/forms/input',
  );
});

test('fileToSpecifier strips a trailing /index', () => {
  assert.equal(fileToSpecifier(path.join(uiDir, 'index.ts'), mappings), '@/components/ui');
});

test('fileToSpecifier returns null for a file outside any alias target', () => {
  assert.equal(fileToSpecifier(path.join(ROOT, 'other', 'x.tsx'), mappings), null);
});

test('specifierForFile derives the per-file specifier from rootDir + alias base', () => {
  assert.equal(
    specifierForFile(uiDir, '@/components/ui', path.join(uiDir, 'button.tsx')),
    '@/components/ui/button',
  );
  assert.equal(
    specifierForFile(uiDir, '@/components/ui', path.join(uiDir, 'forms', 'input.tsx')),
    '@/components/ui/forms/input',
  );
  assert.equal(
    specifierForFile(uiDir, '@/components/ui', path.join(uiDir, 'index.ts')),
    '@/components/ui',
  );
});

test('longest target dir wins when alias targets nest', () => {
  const m = parseAliasMappings({ '@/*': ['./src/*'], '@ui/*': ['./src/components/ui/*'] }, ROOT);
  // A file under src/components/ui should resolve via the more specific @ui alias.
  assert.equal(fileToSpecifier(path.join(uiDir, 'button.tsx'), m), '@ui/button');
});
