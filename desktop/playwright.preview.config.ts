import { defineConfig } from '@playwright/test';

const port = 43290;
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests/preview',
  testMatch: '**/tests/preview/setup.spec.ts',
  workers: 1,
  use: { baseURL, browserName: 'chromium', reducedMotion: 'reduce' },
  webServer: { command: `npm run preview:astryx -- --port ${port}`, url: baseURL, reuseExistingServer: false },
});
