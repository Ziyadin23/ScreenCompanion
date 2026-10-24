import { resolve } from 'node:path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: { plugins: [externalizeDepsPlugin()], build: { rollupOptions: { input: resolve('src/main/index.ts') } } },
  preload: { plugins: [externalizeDepsPlugin()], build: { rollupOptions: { input: resolve('src/preload/index.ts'), output: { format: 'cjs', entryFileNames: 'index.cjs' } } } },
  renderer: { root: resolve('src/renderer'), plugins: [react()], build: { rollupOptions: { input: resolve('src/renderer/index.html') } } }
});
