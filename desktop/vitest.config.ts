import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'], exclude: ['tests/ui/**', 'tests/windows/**'], environment: 'node', testTimeout: 10000 } });
