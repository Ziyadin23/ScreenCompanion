import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  outputDir: '../../test-results/preview',
  use: { baseURL: `http://127.0.0.1:${process.env.SC_PREVIEW_PORT ?? '43155'}` }
});
