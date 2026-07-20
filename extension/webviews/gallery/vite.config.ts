/// <reference types="vitest/config" />

import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  root: __dirname,
  base: './',
  resolve: {
    alias: {
      '@snapds/webview-shared': resolve(__dirname, '../shared/src/index.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
  build: {
    outDir: resolve(__dirname, 'dist'),
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
