// Root ESLint flat config. Building blocks live in packages/config/eslint/index.js so a
// per-package `lint` task can reuse them later. Run with `pnpm lint` (or `pnpm lint:fix`).
import { defineConfig, globalIgnores } from 'eslint/config';
import {
  base,
  boundaries,
  ignores,
  logging,
  plain,
  react,
  typeAware,
} from './packages/config/eslint/index.js';

export default defineConfig([
  globalIgnores(ignores),
  ...base,
  ...typeAware,
  ...plain,
  ...react,
  ...boundaries,
  ...logging,
  // Node build/maintenance scripts (icon generation, bundle-size gate): plain Node globals, console allowed.
  {
    files: ['**/scripts/**/*.{mjs,js,cjs}'],
    languageOptions: {
      globals: {
        process: 'readonly',
        Buffer: 'readonly',
        console: 'readonly',
        URL: 'readonly',
        __dirname: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
      },
    },
    rules: { 'no-console': 'off' },
  },
  // Benchmarks print their results table on purpose.
  { files: ['**/bench/**/*.ts'], rules: { 'no-console': 'off' } },
]);
