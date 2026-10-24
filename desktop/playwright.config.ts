import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/ui', fullyParallel: false, workers: 1, timeout: 30000,
  use: { trace: 'off', screenshot: 'off', video: 'off' }, reporter: 'list'
});
