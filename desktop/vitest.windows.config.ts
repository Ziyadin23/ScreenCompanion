import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['tests/windows/**/*.test.ts'], environment: 'node', fileParallelism: false,
    testTimeout: 90000, hookTimeout: 180000 }
});
