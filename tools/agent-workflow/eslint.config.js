import js from '@eslint/js';
import ts from 'typescript-eslint';

export default ts.config(
  { ignores: ['dist/**', 'node_modules/**'] },
  js.configs.recommended,
  ...ts.configs.recommended,
  { files: ['**/*.ts'], languageOptions: { globals: {
    process: 'readonly', Buffer: 'readonly', console: 'readonly', URL: 'readonly',
    setTimeout: 'readonly', clearTimeout: 'readonly', AbortController: 'readonly',
    AbortSignal: 'readonly', structuredClone: 'readonly'
  } }, rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'no-empty': ['error', { allowEmptyCatch: true }]
  } }
);
