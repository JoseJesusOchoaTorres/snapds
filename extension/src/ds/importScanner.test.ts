import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  analyzeSelectionImports,
  parseImports,
  parseImportsToSpecs,
  usedIdentifiers,
} from './importScanner';

test('usedIdentifiers collects every identifier token', () => {
  const set = usedIdentifiers('<Button onClick={fn}>Hi</Button>');
  assert.ok(set.has('Button'));
  assert.ok(set.has('onClick'));
  assert.ok(set.has('fn'));
  assert.ok(!set.has('Missing'));
});

test('analyzeSelectionImports keeps only imports the selection references', () => {
  const file = [
    "import { Button, Card } from '@acme/ui';",
    "import { Label } from '@acme/forms';",
    "import { Unused } from '@acme/dead';",
    '',
    'export function X() {}',
  ].join('\n');
  const selection = '<Label><Button>Save</Button><Button>Cancel</Button></Label>';

  assert.deepEqual(analyzeSelectionImports(file, selection), [
    { kind: 'named', specifier: '@acme/ui', names: ['Button'] },
    { kind: 'named', specifier: '@acme/forms', names: ['Label'] },
  ]);
});

test('analyzeSelectionImports drops unused names from an otherwise-used module', () => {
  const file = "import { Button, Card, Icon } from '@acme/ui';";
  const out = analyzeSelectionImports(file, '<Button><Icon /></Button>');
  assert.deepEqual(out, [{ kind: 'named', specifier: '@acme/ui', names: ['Button', 'Icon'] }]);
});

test('analyzeSelectionImports detects a default import', () => {
  const file = "import React from 'react';";
  assert.deepEqual(analyzeSelectionImports(file, 'React.useMemo(() => 1, [])'), [
    { kind: 'default', specifier: 'react', local: 'React' },
  ]);
});

test('analyzeSelectionImports detects a namespace import', () => {
  const file = "import * as styles from './x.module.css';";
  assert.deepEqual(analyzeSelectionImports(file, '<div className={styles.root} />'), [
    { kind: 'namespace', specifier: './x.module.css', local: 'styles' },
  ]);
});

test('analyzeSelectionImports matches an aliased binding on its local name', () => {
  const file = "import { Button as Btn } from '@acme/ui';";
  assert.deepEqual(analyzeSelectionImports(file, '<Btn>Go</Btn>'), [
    { kind: 'named', specifier: '@acme/ui', names: ['Button as Btn'] },
  ]);
});

test('analyzeSelectionImports handles a mixed default + named clause', () => {
  const file = "import React, { useState } from 'react';";
  const out = analyzeSelectionImports(file, 'const [v, set] = useState(0); React.memo(x);');
  assert.deepEqual(out, [
    { kind: 'named', specifier: 'react', names: ['useState'] },
    { kind: 'default', specifier: 'react', local: 'React' },
  ]);
});

test('analyzeSelectionImports ignores a side-effect import', () => {
  const file = "import './global.css';\nimport { Button } from '@acme/ui';";
  assert.deepEqual(analyzeSelectionImports(file, '<Button />'), [
    { kind: 'named', specifier: '@acme/ui', names: ['Button'] },
  ]);
});

test('parseImports reads a multi-line named clause', () => {
  const file = "import {\n  Button,\n  Label,\n} from '@acme/ui';";
  const parsed = parseImports(file);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].specifier, '@acme/ui');
  assert.deepEqual(
    parsed[0].named.map((b) => b.local),
    ['Button', 'Label'],
  );
});

test('parseImports preserves a per-binding type modifier in text for round-tripping', () => {
  const file = "import { type Props, Button } from '@acme/ui';";
  const parsed = parseImports(file);
  // `text` keeps `type Props` verbatim so emitImport can reproduce it;
  // `local` strips the modifier so usage matching still works.
  assert.deepEqual(
    parsed[0].named.map((b) => b.text),
    ['type Props', 'Button'],
  );
  assert.deepEqual(
    parsed[0].named.map((b) => b.local),
    ['Props', 'Button'],
  );
});

test('parseImportsToSpecs converts confirmed import lines back into specs', () => {
  const text = [
    "import { Button, Label } from '@acme/ui';",
    "import React, { useState } from 'react';",
    "import * as styles from './x.css';",
  ].join('\n');
  assert.deepEqual(parseImportsToSpecs(text), [
    { kind: 'named', specifier: '@acme/ui', names: ['Button', 'Label'], typeOnly: false },
    { kind: 'named', specifier: 'react', names: ['useState'], typeOnly: false },
    { kind: 'default', specifier: 'react', local: 'React', typeOnly: false },
    { kind: 'namespace', specifier: './x.css', local: 'styles', typeOnly: false },
  ]);
});

test('parseImportsToSpecs round-trips through emitImport-style lines', () => {
  const specs = parseImportsToSpecs("import { Button as Btn } from '@acme/ui';");
  assert.deepEqual(specs, [
    { kind: 'named', specifier: '@acme/ui', names: ['Button as Btn'], typeOnly: false },
  ]);
});
