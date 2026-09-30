// @ts-check
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Architecture rules live here as lint rules, so both humans and AI agents get
 * immediate feedback when they cross a layer boundary. See docs/architecture.md.
 */
const layer = (files, message, patterns) => ({
  files,
  rules: {
    'no-restricted-imports': ['error', { patterns: patterns.map((group) => ({ group, message })) }],
  },
});

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'playwright-report', 'test-results', 'coverage'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  layer(
    ['src/core/**/*.ts'],
    'core is pure game logic: no Three.js, no DOM, no ports or adapters.',
    [['three', 'three/*', '**/ports/**', '**/ports', '**/adapters/**', '**/app/**']],
  ),
  layer(['src/ports/**/*.ts'], 'ports only describe interfaces and may only depend on core.', [
    ['three', 'three/*', '**/adapters/**', '**/app/**'],
  ]),
  layer(
    ['src/adapters/**/*.ts'],
    'adapters depend on core and ports only. Import the core through its index.',
    [['**/app/**', '**/core/*', '!**/core/index']],
  ),
);
