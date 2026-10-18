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
  // Build output folders only: `**/build/**` also hid apps/web/src/routes/build (the editor).
  'build/**',
  'apps/*/build/**',
  'packages/*/build/**',
  '**/coverage/**',
  '**/.turbo/**',
  '**/playwright-report/**',
  '**/test-results/**',
  'apps/legacy/**',
  '.claude/**',
  // Local scratch (git-ignored or excluded): interaction scripts and temp probes (L-44).
  '**/.local/**',
  '**/*.tmp.*',
  '**/*.d.ts',
  '**/*.snap',
  'pnpm-lock.yaml',
];

/** Source files that belong to a tsconfig project and get type-aware linting. */
export const typeAwareFiles = [
  'packages/*/src/**/*.{ts,tsx}',
  'packages/*/test/**/*.{ts,tsx}',
  'packages/*/bench/**/*.ts',
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
      'object-shorthand': 'error',
      'import-x/no-cycle': 'error',
      'import-x/no-duplicates': 'error',
      'import-x/no-self-import': 'error',
      'import-x/no-useless-path-segments': 'error',
      'import-x/first': 'error',
      'import-x/newline-after-import': 'error',
      // TypeScript resolves these; the TS resolver handles `exports` maps, but keep it
      // advisory so a resolver hiccup never blocks a commit. `virtual:` modules come from Vite
      // plugins (vite-plugin-pwa) and exist only at build time.
      'import-x/no-unresolved': ['warn', { ignore: ['^virtual:'] }],
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
 * Strict, type-aware TypeScript rules for project sources. Everything is an `error`: the lint
 * debt that was parked at `warn` was paid off in WI-05 (2026-10-11), so a warning never piles
 * up again. Relax a rule here with a reason rather than adding inline disables.
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
      // Callback props and store actions are function-typed properties (`onX: () => void`).
      '@typescript-eslint/unbound-method': 'error',
      '@typescript-eslint/consistent-type-exports': 'error',
      '@typescript-eslint/no-unnecessary-type-conversion': 'error',
      '@typescript-eslint/no-unnecessary-condition': 'error',
      '@typescript-eslint/no-confusing-void-expression': 'error',
      // Numbers format predictably in templates (`${n} cells`); objects, nullish and unions
      // still need an explicit conversion.
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/no-unnecessary-type-parameters': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-deprecated': 'error',
      '@typescript-eslint/prefer-readonly': 'off',
      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/no-inferrable-types': 'off',
      '@typescript-eslint/unified-signatures': 'error',
      '@typescript-eslint/no-extraneous-class': 'error',
      '@typescript-eslint/prefer-for-of': 'error',
      '@typescript-eslint/class-literal-property-style': 'error',
      '@typescript-eslint/no-unnecessary-type-arguments': 'error',
      '@typescript-eslint/no-dynamic-delete': 'error',
      '@typescript-eslint/no-invalid-void-type': 'error',
      '@typescript-eslint/restrict-plus-operands': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/no-redundant-type-constituents': 'error',
      '@typescript-eslint/dot-notation': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/no-empty-function': 'error',
      '@typescript-eslint/require-await': 'error',
      '@typescript-eslint/no-base-to-string': 'error',
      '@typescript-eslint/use-unknown-in-catch-callback-variable': 'error',
      '@typescript-eslint/no-unnecessary-boolean-literal-compare': 'error',
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
    'react-hooks/exhaustive-deps': 'error',
    'react-refresh/only-export-components': [
      'error',
      { allowConstantExport: true, allowExportNames: ['routeTree', 'createAppRouter'] },
    ],
    'jsx-a11y/no-autofocus': 'error',
    'jsx-a11y/no-noninteractive-tabindex': ['error', { roles: ['img'], tags: [] }],
    // `<ul role="list">` is deliberate: Safari/VoiceOver drops list semantics when
    // `list-style: none` is applied, and the explicit role restores them.
    'jsx-a11y/no-redundant-roles': ['error', { ul: ['list'], ol: ['list'] }],
    // Headings whose content arrives through `{...props}` (design-system wrappers) are
    // false positives; the Storybook a11y addon covers rendered output.
    'jsx-a11y/heading-has-content': 'error',
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
              message:
                '@maze/core is dependency-free: it must not import other workspace packages.',
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
    rules: { 'no-console': 'error' },
  },
  {
    files: ['apps/web/src/lib/log.ts', 'apps/web/e2e/**/*.ts', '**/*.test.{ts,tsx}'],
    rules: { 'no-console': 'off' },
  },
);
