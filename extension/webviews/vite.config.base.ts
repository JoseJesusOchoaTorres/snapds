/// <reference types="vitest/config" />

import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export function createWebviewConfig(dir: string) {
  return defineConfig({
    plugins: [react()],
    root: dir,
    base: './',
    resolve: {
      alias: {
        '@snapds/webview-shared': resolve(dir, '../shared/src/index.ts'),
      },
    },
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}'],
    },
    build: {
      outDir: resolve(dir, 'dist'),
      emptyOutDir: true,
      assetsInlineLimit: 100_000,
      target: 'es2022',
      cssCodeSplit: false,
      rollupOptions: {
        output: {
          entryFileNames: 'assets/index.js',
          chunkFileNames: 'assets/[name].js',
          assetFileNames: 'assets/[name][extname]',
        },
      },
    },
  });
}
