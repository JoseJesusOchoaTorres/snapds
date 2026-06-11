import { cp, rm, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '..');

const pairs = [
  ['webview-gallery/dist',  'extension/media/gallery'],
  ['webview-props/dist',    'extension/media/props'],
  ['webview-settings/dist', 'extension/media/settings'],
];

for (const [src, dst] of pairs) {
  const srcAbs = resolve(root, src);
  const dstAbs = resolve(root, dst);
  if (!existsSync(srcAbs)) {
    console.warn(`skip: ${src} does not exist yet`);
    continue;
  }
  await rm(dstAbs, { recursive: true, force: true });
  await mkdir(dstAbs, { recursive: true });
  await cp(srcAbs, dstAbs, { recursive: true });
  console.log(`copied ${src} -> ${dst}`);
}
