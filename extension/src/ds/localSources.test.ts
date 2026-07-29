import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { test } from 'node:test';
import {
  buildLocalSource,
  buildLocalSourceFromFolder,
  detectLocalSources,
  mergeLocalSources,
} from './localSources';

const localPkg = (name: string, extra = {}) => ({
  name,
  version: '0.0.0-local',
  importPath: `@/${name}`,
  importAlias: `@/${name}`,
  rootDir: `/r/${name}`,
  kind: 'local' as const,
  ...extra,
});

/** Builds a throwaway shadcn-style project: components.json + tsconfig + ui folder. */
function makeProject(opts: { withJsxTsconfig?: boolean; uiAlias?: string } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'snapds-localsrc-'));
  const write = (rel: string, body: string) => {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body);
  };
  write('components.json', JSON.stringify({ aliases: { ui: opts.uiAlias ?? '@/components/ui' } }));
  write('tsconfig.json', JSON.stringify({ compilerOptions: { paths: { '@/*': ['./src/*'] } } }));
  if (opts.withJsxTsconfig) {
    write(
      'tsconfig.app.json',
      JSON.stringify({ compilerOptions: { jsx: 'react-jsx', paths: { '@/*': ['./src/*'] } } }),
    );
  }
  fs.mkdirSync(path.join(root, 'src/components/ui'), { recursive: true });
  return root;
}

test('detectLocalSources finds a shadcn components.json and builds a local DsPackage', () => {
  const root = makeProject();
  try {
    const sources = detectLocalSources(root);
    assert.equal(sources.length, 1);
    const s = sources[0];
    assert.equal(s.kind, 'local');
    assert.equal(s.name, 'src/components/ui'); // workspace-relative folder
    assert.equal(s.importAlias, '@/components/ui');
    assert.equal(s.importPath, '@/components/ui');
    assert.equal(s.rootDir, path.join(root, 'src/components/ui'));
    assert.ok(s.tsconfigPath);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('buildLocalSource prefers a tsconfig that sets jsx', () => {
  const root = makeProject({ withJsxTsconfig: true });
  try {
    const s = buildLocalSource(path.join(root, 'components.json'), root);
    assert.ok(s);
    assert.equal(s.tsconfigPath, path.join(root, 'tsconfig.app.json'));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('mergeLocalSources surfaces manually-registered sources missing from detection', () => {
  const detected = [localPkg('src/components/ui')];
  const registered = [
    localPkg('src/components/ui', { excluded: ['Card'] }), // also detected
    localPkg('src/components/ui-v2'), // manual only — no components.json
  ];
  const merged = mergeLocalSources(detected, registered);
  assert.deepEqual(merged.map((s) => s.name).sort(), ['src/components/ui', 'src/components/ui-v2']);
  // Registered wins for the overlapping name (carries the persisted selection).
  assert.deepEqual(merged.find((s) => s.name === 'src/components/ui')?.excluded, ['Card']);
});

test('detectLocalSources handles a monorepo: multiple components.json, same alias, distinct apps', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'snapds-monorepo-'));
  const write = (rel: string, body: string) => {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body);
  };
  try {
    for (const app of ['apps/web', 'apps/docs']) {
      write(`${app}/components.json`, JSON.stringify({ aliases: { ui: '@/components/ui' } }));
      write(
        `${app}/tsconfig.json`,
        JSON.stringify({ compilerOptions: { jsx: 'react-jsx', paths: { '@/*': ['./src/*'] } } }),
      );
      fs.mkdirSync(path.join(root, app, 'src/components/ui'), { recursive: true });
    }
    const sources = detectLocalSources(root).sort((a, b) => a.name.localeCompare(b.name));
    assert.equal(sources.length, 2);
    // Same alias resolves to a DIFFERENT folder per app; names stay unique.
    assert.deepEqual(
      sources.map((s) => s.name),
      ['apps/docs/src/components/ui', 'apps/web/src/components/ui'],
    );
    assert.ok(sources.every((s) => s.importAlias === '@/components/ui'));
    assert.equal(sources[0].rootDir, path.join(root, 'apps/docs/src/components/ui'));
    assert.equal(sources[1].rootDir, path.join(root, 'apps/web/src/components/ui'));
    assert.notEqual(sources[0].tsconfigPath, sources[1].tsconfigPath);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('detectLocalSources skips components.json inside build-output dirs', () => {
  const root = makeProject(); // valid source at src/components/ui
  try {
    // A stray components.json in a build output must not be picked up.
    fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
    fs.writeFileSync(
      path.join(root, 'dist/components.json'),
      JSON.stringify({ aliases: { ui: '@/components/ui' } }),
    );
    const sources = detectLocalSources(root);
    assert.equal(sources.length, 1);
    assert.equal(sources[0].name, 'src/components/ui');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('buildLocalSourceFromFolder derives the alias from tsconfig paths', () => {
  const root = makeProject();
  try {
    const src = buildLocalSourceFromFolder(path.join(root, 'src/components/ui'), root);
    assert.equal(src.kind, 'local');
    assert.equal(src.name, 'src/components/ui');
    assert.equal(src.importAlias, '@/components/ui');
    assert.equal(src.rootDir, path.join(root, 'src/components/ui'));
    assert.ok(src.tsconfigPath);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('buildLocalSourceFromFolder leaves importAlias empty for an unaliased folder', () => {
  const root = makeProject();
  try {
    fs.mkdirSync(path.join(root, 'packages/ds'), { recursive: true });
    const src = buildLocalSourceFromFolder(path.join(root, 'packages/ds'), root);
    assert.equal(src.importAlias, ''); // not under @/* -> caller must prompt
    assert.equal(src.name, 'packages/ds');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('buildLocalSource returns undefined when the alias folder does not exist', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'snapds-localsrc-'));
  try {
    fs.writeFileSync(
      path.join(root, 'components.json'),
      JSON.stringify({ aliases: { ui: '@/nope' } }),
    );
    fs.writeFileSync(
      path.join(root, 'tsconfig.json'),
      JSON.stringify({ compilerOptions: { paths: { '@/*': ['./src/*'] } } }),
    );
    assert.equal(buildLocalSource(path.join(root, 'components.json'), root), undefined);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
