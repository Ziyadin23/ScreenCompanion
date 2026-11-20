import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  root: resolve('preview'), plugins: [react()],
  server: { host: '127.0.0.1', port: 43155, strictPort: true },
  build: { outDir: resolve('out/preview'), emptyOutDir: true }
});
