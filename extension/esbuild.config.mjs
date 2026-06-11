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
  external: ['vscode', 'react-docgen-typescript', 'typescript'],
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
