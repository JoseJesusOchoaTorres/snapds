import esbuild from 'esbuild';

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

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
} else {
  await esbuild.build(opts);
}
