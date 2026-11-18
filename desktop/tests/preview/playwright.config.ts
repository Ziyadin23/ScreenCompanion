import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: '**/setup-font-scaling.spec.ts',
  outputDir: '../../test-results/preview',
  use: { baseURL: `http://127.0.0.1:${process.env.SC_PREVIEW_PORT ?? '43155'}` }
});
