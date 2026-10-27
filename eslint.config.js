// @ts-check
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '.output/**',
      '.wxt/**',
      'node_modules/**',
      'coverage/**',
      'test-results/**',
      'playwright-report/**',
      'web-ext-artifacts/**',
      'tests/fixtures/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: { ...globals.browser },
    },
    rules: {
      // Privacy (SPEC §9): no logging of page text, keys or URLs. Only fixed console.error messages.
      'no-console': ['error', { allow: ['error'] }],
      // Network policy (SPEC §9, ADR §7): only src/features/plain-line/byo-key.ts may make requests.
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'Catchline makes no network requests (SPEC §9).' },
        { name: 'XMLHttpRequest', message: 'Catchline makes no network requests (SPEC §9).' },
        { name: 'WebSocket', message: 'Catchline makes no network requests (SPEC §9).' },
        { name: 'EventSource', message: 'Catchline makes no network requests (SPEC §9).' },
      ],
      'no-restricted-properties': [
        'error',
        { object: 'navigator', property: 'sendBeacon', message: 'No network requests (SPEC §9).' },
        { object: 'window', property: 'fetch', message: 'No network requests (SPEC §9).' },
      ],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // The engine is shared with the web app (site/): no extension APIs, no WXT, no globals.
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['wxt', 'wxt/*', '@wxt-dev/*'], message: 'src/core must not depend on WXT.' },
            {
              group: ['@webext-core/*', 'webextension-polyfill'],
              message: 'src/core is browser-API free.',
            },
            { group: ['react', 'react-dom', 'react/*'], message: 'src/core is UI-free.' },
            {
              group: [
                '../adapters/*',
                '../storage/*',
                '../messaging/*',
                '../entrypoints/*',
                '../dom/*',
              ],
              message: 'src/core imports nothing outside src/core.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'chrome', message: 'src/core is browser-API free; use an adapter.' },
        { name: 'browser', message: 'src/core is browser-API free; use an adapter.' },
        { name: 'window', message: 'Pass the window in (see createComputedStyleOracle).' },
        { name: 'document', message: 'Take a Document or Element parameter instead.' },
        { name: 'location', message: 'Take a URL parameter instead.' },
        { name: 'localStorage', message: 'Storage lives in src/storage.' },
        { name: 'fetch', message: 'Catchline makes no network requests (SPEC §9).' },
        { name: 'XMLHttpRequest', message: 'Catchline makes no network requests (SPEC §9).' },
        { name: 'WebSocket', message: 'Catchline makes no network requests (SPEC §9).' },
        { name: 'EventSource', message: 'Catchline makes no network requests (SPEC §9).' },
      ],
    },
  },
  {
    files: ['src/**/*.tsx', 'tests/**/*.tsx'],
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    files: ['tests/**/*.ts', 'tests/**/*.tsx'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },
  {
    files: ['**/*.js', '**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'no-console': 'off' },
  },
  prettier,
);
