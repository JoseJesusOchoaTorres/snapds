import { globSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';

// The sources use extensionless ESM imports, which Node's test runner cannot
// resolve directly. Bundle each *.test.ts into a self-contained CommonJS file
// so `node --test` can run them as-is. `vscode` is not a real npm module (the
// Extension Host injects it), so we alias it to a minimal test stub; typescript
// and react-docgen-typescript stay external (real packages in node_modules).
const entryPoints = globSync('src/**/*.test.ts');

if (!entryPoints.length) {
  console.log('No test files found (src/**/*.test.ts).');
  process.exit(0);
}

const here = path.dirname(fileURLToPath(import.meta.url));
const vscodeStub = path.resolve(here, 'src/test-utils/vscode.ts');

await esbuild.build({
  entryPoints,
  outdir: 'dist-test',
  outbase: 'src',
  outExtension: { '.js': '.cjs' },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  sourcemap: 'inline',
  alias: { vscode: vscodeStub },
  external: ['react-docgen-typescript', 'typescript'],
  logLevel: 'error',
});
