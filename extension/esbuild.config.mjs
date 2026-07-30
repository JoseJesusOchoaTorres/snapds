import fs from 'node:fs';
import path from 'node:path';
import esbuild from 'esbuild';

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/**
 * `typescript` is bundled into dist/extension.js (below), and at runtime
 * `ts.createProgram` resolves its default library files (`lib.*.d.ts`) relative
 * to the executing bundle's directory (dist/). Without them the type checker has
 * no lib, so generic-heavy prop types — e.g. shadcn/cva's
 * `VariantProps<typeof buttonVariants>` — fail to resolve and components appear
 * to have no documented props. Copy the libs next to the bundle so they resolve.
 */
function copyTypescriptLibs() {
  const libDir = path.join('node_modules', 'typescript', 'lib');
  fs.mkdirSync('dist', { recursive: true });
  let n = 0;
  for (const f of fs.readdirSync(libDir)) {
    if (/^lib\..*\.d\.ts$/.test(f)) {
      fs.copyFileSync(path.join(libDir, f), path.join('dist', f));
      n++;
    }
  }
  console.log(`[snapds] copied ${n} typescript lib files into dist/`);
}

const opts = {
  entryPoints: ['src/extension.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  outfile: 'dist/extension.js',
  // Only `vscode` is provided by the host at runtime. Everything else
  // (including `typescript` and `react-docgen-typescript`, which are used at
  // runtime by the introspector) must be bundled so the packaged .vsix is
  // self-contained under `vsce package --no-dependencies`.
  external: ['vscode'],
  sourcemap: !production,
  minify: production,
  logLevel: 'info',
};

if (watch) {
  const ctx = await esbuild.context(opts);
  await ctx.watch();
  copyTypescriptLibs();
} else {
  await esbuild.build(opts);
  copyTypescriptLibs();
}
