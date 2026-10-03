// Shared ESLint building blocks for the Maze Lab monorepo (flat config, ESLint >= 9).
//
// The root `eslint.config.js` composes these. Keeping them here lets a future per-package
// `lint` task reuse the same rules (proj-mgmt/12 sections 2 and 9).
import js from '@eslint/js';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import importX from 'eslint-plugin-import-x';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Paths never linted: the frozen legacy app, build output, caches and generated files. */
export const ignores = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/coverage/**',
  '**/.turbo/**',
  '**/playwright-report/**',
  '**/test-results/**',
  'apps/legacy/**',
  '.claude/**',
  '**/*.d.ts',
  '**/*.snap',
  'pnpm-lock.yaml',
];

/** Source files that belong to a tsconfig project and get type-aware linting. */
export const typeAwareFiles = [
  'packages/*/src/**/*.{ts,tsx}',
  'packages/*/test/**/*.{ts,tsx}',
  'apps/web/src/**/*.{ts,tsx}',
  'apps/web/e2e/**/*.ts',
];

/** Config and script files linted without type information (not part of any tsconfig). */
export const plainFiles = [
  '*.{js,mjs,cjs,ts}',
  'packages/config/**/*.{js,mjs,ts}',
  '**/vite.config.ts',
  '**/vitest.config.ts',
  '**/playwright.config.ts',
  '**/commitlint.config.{js,mjs}',
  '**/eslint.config.{js,mjs}',
];

/** Files that render React components (hooks + a11y rules). */
export const reactFiles = ['apps/web/src/**/*.{ts,tsx}', 'packages/ui/src/**/*.{ts,tsx}'];

/** Test files get a relaxed subset of the strict type-aware rules. */
export const testFiles = [
  '**/*.test.{ts,tsx}',
  '**/test/**/*.{ts,tsx}',
  '**/__tests__/**/*.{ts,tsx}',
  'apps/web/e2e/**/*.ts',
];

const tsResolver = createTypeScriptImportResolver({
  alwaysTryTypes: true,
  noWarnOnMultipleProjects: true,
  project: [
    'packages/core/tsconfig.json',
    'packages/player/tsconfig.json',
    'packages/renderer/tsconfig.json',
    'packages/ui/tsconfig.json',
    'apps/web/tsconfig.json',
    'apps/web/e2e/tsconfig.json',
  ],
});

/** Base JavaScript + TypeScript rules shared by every file. */
export const base = tseslint.config(
  js.configs.recommended,
  importX.flatConfigs.recommended,
  importX.flatConfigs.typescript,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2023 },
    },
    settings: {
      'import-x/resolver-next': [tsResolver],
      'import-x/internal-regex': '^@maze/',
    },
    rules: {
      'no-console': 'error',
      'no-debugger': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'prefer-const': 'error',
      'no-var': 'error',
      'object-shorthand': 'warn',
      'import-x/no-cycle': 'warn',
      'import-x/no-duplicates': 'warn',
      'import-x/no-self-import': 'error',
      'import-x/no-useless-path-segments': 'warn',
      'import-x/first': 'warn',
      'import-x/newline-after-import': 'warn',
      // TypeScript resolves these; the TS resolver handles `exports` maps, but keep it
      // advisory so a resolver hiccup never blocks a commit.
      'import-x/no-unresolved': 'warn',
      'import-x/named': 'off',
      'import-x/namespace': 'off',
      'import-x/default': 'off',
      'import-x/no-named-as-default-member': 'off',
      // False positives for CommonJS packages that attach their name to `module.exports`.
      'import-x/no-named-as-default': 'off',
    },
  },
);

/**
 * Strict, type-aware TypeScript rules for project sources. Rules that currently fire in code
 * owned by other workstreams are `warn` (see the "Lint debt" note in proj-mgmt/12); they are
 * promoted to `error` as the follow-up wave lands.
 */
export const typeAware = tseslint.config(
  {
    files: typeAwareFiles,
    extends: [...tseslint.configs.strictTypeChecked, ...tseslint.configs.stylisticTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname.replace(/[\\/]packages[\\/]config[\\/]eslint$/, ''),
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-import-type-side-effects': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      '@typescript-eslint/switch-exhaustiveness-check': [
        'error',
        { considerDefaultExhaustiveForUnions: true },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      // House style: `xs[i] as T` is preferred over `xs[i]!` under noUncheckedIndexedAccess
      // (the `!` form is itself flagged by no-non-null-assertion), so the inverse rule is off.
      '@typescript-eslint/non-nullable-type-assertion-style': 'off',
      // React callback props are declared as method signatures; passing them is intended.
      '@typescript-eslint/unbound-method': 'warn',
      // Lint debt (warn until the follow-up wave): these fire in existing sources.
      '@typescript-eslint/consistent-type-exports': 'warn',
      '@typescript-eslint/no-unnecessary-type-conversion': 'warn',
      '@typescript-eslint/no-unnecessary-condition': 'warn',
      '@typescript-eslint/no-confusing-void-expression': 'warn',
      '@typescript-eslint/restrict-template-expressions': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/prefer-nullish-coalescing': 'warn',
      '@typescript-eslint/no-unnecessary-type-parameters': 'warn',
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-misused-promises': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/no-deprecated': 'warn',
      '@typescript-eslint/prefer-readonly': 'off',
      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/no-inferrable-types': 'off',
      '@typescript-eslint/unified-signatures': 'warn',
      '@typescript-eslint/no-extraneous-class': 'warn',
      '@typescript-eslint/prefer-for-of': 'warn',
      '@typescript-eslint/class-literal-property-style': 'warn',
      '@typescript-eslint/no-unnecessary-type-arguments': 'warn',
      '@typescript-eslint/no-dynamic-delete': 'warn',
      '@typescript-eslint/no-invalid-void-type': 'warn',
      '@typescript-eslint/restrict-plus-operands': 'warn',
      '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
      '@typescript-eslint/no-redundant-type-constituents': 'warn',
      '@typescript-eslint/dot-notation': 'warn',
      '@typescript-eslint/prefer-optional-chain': 'warn',
      '@typescript-eslint/no-empty-function': 'warn',
      '@typescript-eslint/require-await': 'warn',
      '@typescript-eslint/no-base-to-string': 'warn',
      '@typescript-eslint/use-unknown-in-catch-callback-variable': 'warn',
      '@typescript-eslint/no-unnecessary-boolean-literal-compare': 'warn',
    },
  },
  {
    files: testFiles,
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/no-confusing-void-expression': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',
    },
  },
);

/** Non-type-aware TypeScript rules for config files outside any tsconfig project. */
export const plain = tseslint.config({
  files: plainFiles,
  extends: [...tseslint.configs.recommended, tseslint.configs.disableTypeChecked],
  languageOptions: {
    globals: { ...globals.node, ...globals.es2023 },
  },
  rules: {
    'no-console': 'off',
    'import-x/no-unresolved': 'off',
  },
});

/** React hooks, Fast Refresh and jsx-a11y rules for component code. */
export const react = tseslint.config({
  files: reactFiles,
  plugins: {
    'react-hooks': reactHooks,
    'react-refresh': reactRefresh,
    'jsx-a11y': jsxA11y,
  },
  languageOptions: {
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
  settings: {
    'jsx-a11y': {
      components: {
        Button: 'button',
        IconButton: 'button',
        Label: 'label',
        NumberField: 'input',
        ColorField: 'input',
      },
    },
  },
  rules: {
    ...jsxA11y.flatConfigs.recommended.rules,
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true, allowExportNames: ['routeTree', 'createAppRouter'] },
    ],
    'jsx-a11y/no-autofocus': 'warn',
    'jsx-a11y/no-noninteractive-tabindex': ['warn', { roles: ['img'], tags: [] }],
    // `<ul role="list">` is deliberate: Safari/VoiceOver drops list semantics when
    // `list-style: none` is applied, and the explicit role restores them.
    'jsx-a11y/no-redundant-roles': ['error', { ul: ['list'], ol: ['list'] }],
    // Headings whose content arrives through `{...props}` (design-system wrappers) are
    // false positives; the Storybook a11y addon covers rendered output.
    'jsx-a11y/heading-has-content': 'warn',
  },
});

/**
 * Dependency boundaries (proj-mgmt/03 section 1). These are errors and must pass today:
 *   core  <-  player, renderer, ui  <-  apps/*
 * Nothing in packages/ imports from apps/; @maze/core imports nothing at runtime.
 */
export const boundaries = tseslint.config(
  {
    files: ['packages/**/*.{ts,tsx}'],
    rules: {
      'import-x/no-restricted-paths': [
        'error',
        {
          basePath: import.meta.dirname.replace(/[\\/]packages[\\/]config[\\/]eslint$/, ''),
          zones: [
            {
              target: './packages',
              from: './apps',
              message: 'packages/* must not import from apps/* (proj-mgmt/03 section 1).',
            },
            {
              target: './packages/core',
              from: './packages',
              except: ['./core'],
              message: '@maze/core is dependency-free: it must not import other workspace packages.',
            },
          ],
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@maze/web', '@maze/web/*', '**/apps/*', '**/apps/**'],
              message: 'packages/* must not import from apps/*.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/core/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@maze/*', '**/apps/**', '**/packages/*/src/**'],
              message: '@maze/core has zero runtime dependencies (ADR-003).',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        ...['window', 'document', 'navigator', 'localStorage', 'sessionStorage'].map((name) => ({
          name,
          message: `@maze/core runs in Workers and Node: do not touch the DOM global '${name}'.`,
        })),
        ...['requestAnimationFrame', 'cancelAnimationFrame'].map((name) => ({
          name,
          message: `@maze/core is frame-rate independent: '${name}' belongs in @maze/player.`,
        })),
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Use the injected seeded Rng; Math.random breaks reproducibility (ADR-003).',
        },
      ],
    },
  },
);

/** Logging policy: packages never log; the web app logs only through src/lib/log.ts. */
export const logging = tseslint.config(
  {
    files: ['apps/**/*.{ts,tsx}'],
    rules: { 'no-console': 'warn' },
  },
  {
    files: ['apps/web/src/lib/log.ts', 'apps/web/e2e/**/*.ts', '**/*.test.{ts,tsx}'],
    rules: { 'no-console': 'off' },
  },
);
