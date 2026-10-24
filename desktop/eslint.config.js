import js from '@eslint/js';
import ts from 'typescript-eslint';

export default ts.config(
  { ignores: ['out/**', 'dist/**', 'node_modules/**', 'native/build/**', 'test-results/**', 'playwright-report/**'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  { files: ['**/*.{js,mjs,ts,tsx}'], languageOptions: { globals: { process: 'readonly', Buffer: 'readonly', console: 'readonly', URL: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly', structuredClone: 'readonly', AbortController: 'readonly', AbortSignal: 'readonly' } },
    rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }], 'no-control-regex': 'off', 'no-empty': ['error', { allowEmptyCatch: true }] } },
  // Renderer-facing errors deliberately omit causes to avoid leaking credential/content details.
  { files: ['src/main/index.ts'], rules: { 'preserve-caught-error': 'off' } }
);
