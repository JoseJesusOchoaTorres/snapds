import { existsSync } from 'node:fs';
import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = resolve(__dirname, '..');

const pairs = [
  ['extension/webviews/gallery/dist', 'extension/media/gallery'],
  ['extension/webviews/props/dist', 'extension/media/props'],
  ['extension/webviews/settings/dist', 'extension/media/settings'],
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
