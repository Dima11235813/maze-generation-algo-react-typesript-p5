# 12 - Quality Engineering

> Status: Proposed | Last updated: 2026-09-27
> Decisions referenced: D-01, D-02, D-03, D-15, D-17 (see [README.md](./README.md))

Quality is enforced by tooling, not by memory. This document lists the coding standards, the
testing pyramid with the concrete tools per layer, the gates a change must pass, and the
mechanical checks that keep the DRY/SOLID structure of
[03-target-architecture.md](./03-target-architecture.md) intact over time.

---

## 1. Current state

| Area | Observation | Consequence |
|------|-------------|-------------|
| Test count | 3 test files: `src/App.test.tsx`, `src/stores/__tests__/UiPreferencesStore.test.tsx`, `src/uiComponents/MazeOptionsUiExpansionPanel/__tests__/CellSizeSlider.test.tsx` | Effectively no coverage of the algorithm, renderer or stores |
| `App.test.tsx` | Renders `<App />` without `ApolloProvider`, the p5/maze contexts or MobX `Provider` that `AppWrapper` supplies | Almost certainly fails or passes vacuously; never run in CI so nobody knows |
| `UiPreferencesStore.test.tsx` | "sets dark mode to default" asserts on `inverseColorMode`; `toggleInverseColorMode(...)` and `updateDarkModeEnabled(...)` are zero-arg actions called with an argument | Wrong assertion and TypeScript errors that only pass because CRA's Jest runs Babel without type-checking |
| `CellSizeSlider.test.tsx` | Single Enzyme shallow snapshot | Enzyme has no official adapter past React 16; snapshot asserts markup, not behaviour |
| Lint | CRA default `react-app` ESLint config only; no Prettier; no import rules | Inconsistent formatting, unused imports (`cpus` from `os`, `Color` from `p5` in `storageUtils.ts`), 27 `TODO` comments with no tracking |
| `tsconfig.json` | `typeRoots` and `paths` point at `../../DefinitelyTyped/types`, which does not exist in this repo; `global.d.ts` re-exports p5 to paper over typings | Type resolution depends on a sibling checkout on one machine |
| Type safety | `strict: true` but `any` on `column`, `row`, `cam`, `img`, `windowHeight`, `windowWidth`, event handlers | Strict mode is nominal |
| Build reproducibility | `postbuild` depends on undeclared `fs-extra`; `yarn.lock` from 2020 | See [07](./07-security.md) F-08, F-10 |
| Quality gates | None: no CI, no coverage, no review requirements | Regressions reach production undetected |

Everything above is frozen with the legacy app (D-19) and replaced by the standards below.

## 2. Coding standards

### 2.1 Lint, format, commit

| Tool | Configuration | Runs |
|------|---------------|------|
| **ESLint 9 flat config** in `@maze/config/eslint` | `typescript-eslint` `strict-type-checked` + `stylistic-type-checked`; `eslint-plugin-import-x` with `no-restricted-paths` encoding the package graph; `eslint-plugin-jsx-a11y` (strict); `eslint-plugin-react-hooks`; `eslint-plugin-react` (`no-danger`, `jsx-no-target-blank`); `eslint-plugin-security`; `eslint-plugin-unicorn` (selected rules); `eslint-plugin-vitest` in tests | pre-commit (staged), CI |
| **Prettier 3** | `printWidth 100`, `singleQuote`, `trailingComma all`; `prettier-plugin-tailwindcss` for class ordering | pre-commit, CI `--check` |
| **commitlint** | `@commitlint/config-conventional`; scopes limited to workspace names (`core`, `contracts`, `web`, `api`, ...) and `infra`, `docs`, `deps` | commit-msg hook, CI on PR title |
| **lefthook** | `pre-commit`: lint-staged (eslint --fix, prettier), `gitleaks protect --staged`; `pre-push`: `turbo typecheck --filter=...[origin/main]` | local |
| **Changesets** | Every PR touching `packages/*` adds a changeset or the `no-changeset` label with justification | CI check |

#### Implemented 2026-10-02 (branch `feat/tooling-lint-e2e`)

- **ESLint 10 flat config**: root `eslint.config.js` composes `packages/config/eslint/index.js`
  (type-aware `strictTypeChecked` + `stylisticTypeChecked`, `import-x` with the TS resolver,
  `jsx-a11y`, `react-hooks`, `react-refresh`). Dependency boundaries are **errors** and pass:
  `packages/**` never imports `apps/**`; `@maze/core` imports no workspace package and may not
  reference `window`/`document`/`navigator`/`localStorage`/`requestAnimationFrame` or
  `Math.random`. The lint toolchain lives in `@maze/config` with its own TypeScript 6 because
  typescript-eslint cannot load the TS 7 native compiler; `tsc` stays on TS 7. `pnpm lint`
  exits 0 with 0 errors.
- **Lint debt** (rules set to `warn`, 198 warnings at the time of writing, by rule):
  `restrict-template-expressions` 72, `no-confusing-void-expression` 66, `unbound-method` 27
  (React callback props declared as methods), `dot-notation` 11, `no-unnecessary-condition` 4,
  `no-unnecessary-type-assertion` 3, `react-refresh/only-export-components` 3, and one or two
  each of `prefer-optional-chain`, `no-unnecessary-type-parameters`, `no-non-null-assertion`,
  `restrict-plus-operands`, `jsx-a11y/no-autofocus`, `consistent-type-exports`,
  `prefer-nullish-coalescing`, `prefer-for-of`, `no-unnecessary-type-conversion`,
  `jsx-a11y/heading-has-content`. By area: `apps/web` 125, `packages/core` 39,
  `packages/ui` 17, `packages/renderer` 15, `packages/player` 3. Promote to `error` as the
  follow-up wave clears each rule. `non-nullable-type-assertion-style` is off by house style
  (`xs[i] as T` under `noUncheckedIndexedAccess`).
- **lefthook + commitlint**: `lefthook.yml` (pre-commit eslint --fix + prettier --check on
  staged files, commit-msg commitlint, pre-push typecheck + test), `commitlint.config.js`
  (conventional, 120-char header/body, trailers allowed, `merge: ...` ignored); installed by
  the root `prepare` script; `LEFTHOOK=0` skips.
- **knip**: `knip.json`; advisory in CI. Findings at the time of writing: unused deps `clsx`,
  `three` (apps/web, imported only through `@maze/renderer`), `@maze/core` (player, types
  only), `@radix-ui/react-dropdown-menu`, `react-popover`, `react-toggle` (ui); unused
  devDeps `@types/three`, `tailwindcss`, `vite-plugin-pwa` (apps/web), `@vitest/coverage-v8`,
  `fast-check`, `vitest` (root, duplicated per package); 14 unused exports (mostly constants
  and `StubPage`, `createFakeRenderer`, `wrapAngle`), 4 unused exported types, and the
  deliberate `Panel`/`Card` duplicate exports in `@maze/ui`.
- **Playwright E2E** (`apps/web/e2e`, `pnpm e2e`): production build served by `vite preview`
  on port 4174; fixture seeds `maze-lab:prefs` with reduced motion and maximum speed; software
  WebGL flags; axe (`@axe-core/playwright`) gates serious/critical violations on `/`, `/play`,
  `/play` + options sheet, `/learn`. Specs: landing, generation, view modes, solve,
  first-person, options persistence, save/library. **Known a11y debt** excluded from the axe
  gate until fixed: landing "coming soon" cards use `opacity-80`, pushing muted text and the
  badge below 4.5:1 (`color-contrast`, serious). Advisory: `/play` has no `<h1>`
  (`page-has-heading-one`, moderate).
- **CI**: `lint` and `knip` (advisory) steps in the verify job; separate `e2e` job with the
  Playwright report uploaded on failure.

Not yet implemented from the table above: `eslint-plugin-react`, `-security`, `-unicorn`,
`-vitest`, `prettier-plugin-tailwindcss`, commitlint scope enum, `gitleaks protect` in the
pre-commit hook, Changesets check, dependency-cruiser/madge/syncpack.

Custom ESLint rules worth writing early (as `@maze/config/eslint/rules/*`):

- `no-process-env-outside-env-module`: `process.env` / `import.meta.env` only in `env.ts`.
- `core-no-runtime-imports`: any non-type import in `packages/core/src` fails.
- `registry-entry-has-docs`: every generator/solver exported from a registry has `meta.docsSlug`
  and a matching file under `apps/web/src/content/learn/`.

### 2.2 TypeScript settings (`@maze/config/tsconfig.base.json`)

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noPropertyAccessFromIndexSignature": true,
    "useUnknownInCatchVariables": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "isolatedDeclarations": true,        // packages/* only; apps opt out
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "allowJs": false
  }
}
```

- `any` is banned by lint (`no-explicit-any: error`); `unknown` + narrowing or zod parsing
  instead. Legacy-style `column: any` cannot recur.
- `const enum` is allowed only in `@maze/core` where `isolatedDeclarations` keeps it safe;
  elsewhere string-literal unions.
- Public package APIs are declared in `exports` maps with `types` conditions; `publint` and
  `@arethetypeswrong/cli` run in CI for every package build.

## 3. Testing pyramid (D-15)

```
                     +-------------------+
                     |  E2E (Playwright) |   ~30 journeys, axe, visual snapshots
                   +-----------------------+
                   | Contract & integration |   ts-rest vs server, Prisma vs Postgres (Testcontainers)
                 +---------------------------+
                 |  Component (RTL, Storybook) |   every @maze/ui component, web feature components
             +-----------------------------------+
             |  Unit + property-based (Vitest, fast-check) |   @maze/core, @maze/contracts, @maze/player
             +---------------------------------------------+
```

### 3.1 Unit and property-based tests (`@maze/core`, `@maze/contracts`, `@maze/player`)

Runner: **Vitest** with `pool: 'threads'`, coverage via `@vitest/coverage-v8`.

Property tests with **fast-check** enumerate every registry entry so a new algorithm is tested
the moment it is registered (Liskov by test):

```ts
import { fc, test } from '@fast-check/vitest';
import { generators, solvers, isSpanningTree, wallsSymmetric, encode, decode, hash, createRng } from '@maze/core';

const gridArb = fc.record({ width: fc.integer({ min: 1, max: 60 }), height: fc.integer({ min: 1, max: 60 }) });
const seedArb = fc.string({ minLength: 1, maxLength: 32 });

describe.each(generators.all)('generator %s', (gen) => {
  test.prop([gridArb, seedArb])('produces a perfect maze', (grid, seed) => {
    const maze = run(gen.run({ ...grid, topology: 'orthogonal' }, createRng(seed), gen.meta.params.parse({})));
    expect(isSpanningTree(maze)).toBe(true);          // connected and passages === cells - 1
    expect(wallsSymmetric(maze)).toBe(true);
  });
  test.prop([gridArb, seedArb])('is deterministic from seed', (grid, seed) => {
    const a = run(gen.run(g(grid), createRng(seed), {}));
    const b = run(gen.run(g(grid), createRng(seed), {}));
    expect(a.walls).toEqual(b.walls);
  });
});

describe.each(solvers.all.filter(s => s.meta.tags.includes('complete')))('solver %s', (solver) => {
  test.prop([mazeArb])('finds a path when one exists', (maze) => {
    const result = run(solver.run(maze, {}));
    expect(result.path.at(0)).toBe(maze.start);
    expect(result.path.at(-1)).toBe(maze.goal);
    expect(isValidWalk(maze, result.path)).toBe(true);
  });
});

describe.each(solvers.all.filter(s => s.meta.tags.includes('optimal')))('optimal solver %s', (solver) => {
  test.prop([mazeArb])('matches BFS shortest path length', (maze) => {
    expect(run(solver.run(maze, {})).path.length).toBe(run(bfs.run(maze, {})).path.length);
  });
});

test.prop([mazeArb])('MazeDocument round-trips and hashes stably', (maze) => {
  const doc = encode(maze);
  expect(decode(doc)).toEqual(maze);
  expect(hash(decode(doc))).toBe(hash(maze));
});
```

Additional unit-level suites:

- **Golden seeds**: for each generator, five fixed seeds with committed `walls` hex dumps in
  `__fixtures__/`; a change to output is a deliberate, reviewed fixture update.
- **Hash stability across platforms**: the same fixtures are hashed in Node and in a
  Playwright browser context; values must match (guards against `TextEncoder`/endianness
  slips).
- **Step stream properties**: every generator emits exactly one `done`; every `carve` is
  between neighbours; `SolveStep.path` cells form a valid walk.
- **Editing operations**: `toggleWall` keeps symmetry; `resize` preserves the overlapping
  region; each op returns a patch that, applied to the previous state, yields the new state.
- **Metrics**: `deadEnds`, `diameter`, `solutionLength` cross-checked against brute-force
  implementations on small grids.
- **Contracts**: zod schemas reject oversize grids, mismatched `walls` length, invalid
  visibility transitions; CASL matrix (role x action x resource state) is exhaustive via
  `it.each`.
- **Player**: `StepPlayer` play/pause/seek semantics with fake timers; Worker bridge tested
  with a Node `worker_threads` shim.

Benchmarks (`vitest bench`, run on `main` and in a weekly job, results committed to
`proj-mgmt/metrics/bench.md`): recursive backtracker 500x500 generation, BFS 500x500 solve,
encode/decode 500x500. Thresholds from 03 section 12 (>= 1M steps/s BFS) fail the weekly job
and open an issue on regression > 15%.

### 3.2 Component tests (`@maze/ui`, `apps/web`)

- **React Testing Library** + `@testing-library/user-event` under Vitest with `jsdom` (or
  `happy-dom`); queries by role/label only (no test ids except for canvas hosts).
- **Storybook 8** for every `@maze/ui` component: default, all variants, dark mode,
  high-contrast, reduced-motion, RTL text direction. `@storybook/addon-a11y` runs axe per
  story; `@storybook/test-runner` executes interaction tests in CI (`play` functions).
- Feature components in `apps/web` (editor toolbar, step controls, race panel) are tested
  with a real `@maze/core` maze from a fixed seed and a fake `Renderer` implementing the port
  from 03 section 5, asserting on the calls received (`setMaze`, `applyStep`, `setOverlay`).
- The `dom` a11y renderer is tested with RTL directly: the hidden grid exposes
  `role="grid"`, row/col counts, wall state via `aria-label`, and live-region narration of
  steps.

### 3.3 Contract and integration tests (`apps/api`)

| Test type | Tooling | What it proves |
|-----------|---------|----------------|
| Contract conformance | `@ts-rest/core` contract + Nest app booted in-process, requests via `light-my-request` (Fastify inject) | Every route implements its contract; responses parse with the response schema; Problem Details on all error paths |
| Repository tests | **Testcontainers** (`postgres:16`) with Prisma migrations applied; one container per worker | Queries, constraints, soft-delete, visibility filters, fork lineage |
| Cache tests | Testcontainers `redis:7` | Cache-aside TTLs, rate limiter windows, leaderboard ordering |
| Auth tests | Local JWKS server issuing test tokens with the pinned issuer/audience | Expired, wrong-audience, revoked, role-mismatch paths all rejected |
| Solve validation | Fixtures from `@maze/core` seeds | Legal move lists accepted, illegal or non-terminating lists rejected with the correct error code |
| OpenAPI | Generated spec snapshot diffed in CI | Public API changes are visible in review |

Integration tests run in the `e2e` CI job's service containers (see
[08](./08-ci-cd-deployment-observability.md) section 3.1) and locally against
`docker compose`.

### 3.4 End-to-end tests (`apps/web`, Playwright)

Critical journeys, each tagged `@smoke` (runs on every PR) or `@full` (runs on `main` and
nightly):

| Journey | Steps | Assertions |
|---------|-------|------------|
| Generate `@smoke` | open `/build`, pick algorithm, set seed `e2e-1`, generate | canvas visual snapshot matches; DOM grid has `width*height` cells; no console errors |
| Watch solve `@smoke` | open `/watch`, choose BFS, play, pause, step x3, seek to end | step counter increments; narration live region updates; path overlay present |
| Race `@full` | open `/race`, pick A* vs DFS, same seed, run | result panel shows both agents, winner announced, metrics table populated |
| Build/edit/save `@smoke` | toggle walls, set start/goal, save as guest, reload | maze persists in IndexedDB; after sign-in it syncs and appears in `/account` |
| Login `@smoke` | sign in with test IdP user (emulator in CI) | refresh cookie set with expected flags; access token not in `localStorage` |
| Learn lesson `@full` | open `/learn/recursive-backtracker`, advance pseudo-code steps, answer quiz | progress saved; pseudo-code highlight follows steps |
| Share link `@full` | make maze public, open `/m/:shareId` in a fresh context | renders without auth; unlisted id not enumerable via `/explore` |
| Security headers `@smoke` | GET `/`, `/api/health/live`, `/assets/*.map` | headers per 07 section 4.1; `.map` returns 404; zero CSP violations captured |

Cross-cutting E2E rules:

- **axe-core** (`@axe-core/playwright`) runs on every page state reached in `@smoke`
  journeys with WCAG 2.2 AA tags; any violation fails (D-17).
- **Visual regression**: canvas screenshots taken with a fixed seed, fixed viewport, animations
  disabled (`prefers-reduced-motion` emulated), fonts preloaded; threshold `maxDiffPixelRatio
  0.001`; baselines per browser stored in the repo under `apps/web/e2e/__screenshots__/`.
- Browsers: Chromium on PR; Chromium + Firefox + WebKit nightly (WebKit doubles as a proxy
  for the Tauri iOS WKWebView).
- Test IdP: Firebase Auth emulator in CI; a `test-users.json` seed provides `user`,
  `educator`, `admin`.

### 3.5 Performance budgets

| Budget | Tool | Threshold | Gate |
|--------|------|-----------|------|
| Initial route JS (gzip) | `size-limit` | 250 kB excluding lazy three.js chunk | PR |
| three.js chunk | `size-limit` | 600 kB gzip, loaded only on 3D routes | PR |
| Lighthouse perf / a11y / best-practices | `@lhci/cli` against preview channel, 3 runs median | 90 / 100 / 100 | PR (warn) / main (fail) |
| First frame 100x100 | Playwright `performance.measure('first-frame')` | < 200 ms on CI runner class | nightly |
| Step engine throughput | `vitest bench` | >= 1M steps/s BFS 500x500 | weekly |
| API p95 | k6 script against staging, 100 rps for 5 min | < 150 ms read, < 400 ms write | weekly |

### 3.6 Mutation testing (optional, nightly)

**Stryker** with the Vitest runner on `packages/core` only; target mutation score >= 80%.
Surviving mutants in generators/solvers are triaged weekly; the report is uploaded as a CI
artifact. Not a merge gate because of runtime, but a declining score blocks the phase gate.

## 4. Flakiness policy

- A test that fails then passes on retry is flaky; Playwright `retries: 1` on CI only, and any
  retry is reported by a custom reporter as a warning annotation.
- Flaky tests are quarantined within one working day by tagging `@quarantine` (excluded from
  required checks) and an issue is opened with the failure trace; quarantine longer than two
  weeks requires deleting or rewriting the test.
- Root causes that are not allowed as fixes: increased timeouts without justification,
  `waitForTimeout`, disabling the assertion.
- Determinism aids: seeded RNG everywhere (D-03), fake timers for the player, network mocked
  at the ts-rest client boundary in component tests, real services in E2E.

## 5. Coverage gates

| Scope | Lines | Branches | Enforced by |
|-------|-------|----------|-------------|
| `@maze/core` | >= 90% | >= 85% | Vitest `coverage.thresholds` per package |
| `@maze/contracts`, `@maze/player` | >= 85% | >= 80% | same |
| `apps/api` | >= 80% | >= 75% | same |
| `apps/web`, `@maze/ui`, `@maze/renderer` | >= 70% | >= 60% | same, plus Storybook story coverage = 100% of exported components |
| Repository total | >= 75% | - | Codecov status check with `patch` target 80% on changed lines |

Coverage excludes generated files (`*.gen.ts`, Prisma client), Storybook stories and E2E
specs. Thresholds only ratchet upward; lowering one requires an ADR note.

## 6. Code review rules

- `CODEOWNERS`: `packages/core` and `packages/contracts` require the owner's review; other
  paths require one reviewer (a second maintainer or, until one exists, a documented
  self-review checklist with an agent-assisted review pass).
- Required status checks: `ci/verify`, `ci/e2e`, `security/*`, `size-limit`, `changeset`,
  `commitlint`. Branch protection disallows force-push and requires linear history.
- PR size guideline: <= 400 changed lines excluding fixtures and lockfile; larger PRs are
  split or labelled `large` with a reviewing plan in the description.
- Any PR that changes a package's public `exports`, a zod schema in `@maze/contracts`, a
  Prisma migration or the dependency graph requires a linked ADR (new or amended).
- Review checklist in the PR template covers: behaviour tested at the right layer, a11y
  impact, security gate (07 section 11), telemetry added for new user-facing actions, docs.

## 7. Definition of Ready / Definition of Done

**Definition of Ready** (a story may enter a sprint when):

- [ ] User story and acceptance criteria written in the [backlog](./15-backlog.md) format.
- [ ] Affected packages/apps identified; any new cross-package dependency approved against
      the graph in 03 section 1.
- [ ] Design or wireframe linked for UI work; a11y considerations noted.
- [ ] Data/contract changes sketched as zod schema diffs.
- [ ] Feature flag decided (name, default per environment).
- [ ] Estimate agreed.

**Definition of Done** (a story is done when):

- [ ] Code merged to `main` with all required checks green.
- [ ] Unit/property tests for core logic; component tests for UI; contract tests for API;
      E2E journey updated if user-visible.
- [ ] Coverage thresholds met; no quarantined tests introduced.
- [ ] Accessibility: axe clean, keyboard path verified, reduced-motion respected, DOM
      equivalent updated for canvas changes (D-17).
- [ ] Security gate checklist (07 section 11) completed in the PR.
- [ ] Telemetry: new user actions emit a span/metric; errors carry a Problem Details code.
- [ ] Docs: TSDoc on new public API, Storybook story for new components, Learn content for
      new algorithms, ADR if a decision changed, runbook if operational behaviour changed.
- [ ] Feature flag wired and default state verified in staging.
- [ ] Demoed on the staging URL.

## 8. Documentation standards

- **TSDoc** on every exported symbol in `packages/*`; `eslint-plugin-tsdoc` validates syntax;
  API reference generated with TypeDoc into `apps/web/public/docs/api` for the Learn mode
  "under the hood" links.
- **Storybook** is the component catalogue and the visual contract; a component without a
  story does not exist.
- **ADRs** in `proj-mgmt/adr/` using the template `ADR-000-template.md`; one decision per
  file; status transitions recorded, never edited away.
- **Runbooks** in `infra/runbooks/` for deploy, rollback, incident, key rotation, restore.
- **Algorithm docs** in `apps/web/src/content/learn/<slug>.mdx`: intuition, pseudo-code with
  step anchors, complexity, history, references; validated by the `registry-entry-has-docs`
  lint rule.
- `README.md` per workspace: purpose, public API summary, how to run tests, owner.

## 9. Mechanical enforcement of DRY and SOLID

| Concern | Tool | Rule |
|---------|------|------|
| Package dependency direction | **dependency-cruiser** (`.dependency-cruiser.cjs`) run in CI | Encodes 03 section 1: `core` imports nothing at runtime; `contracts` imports only `core` types; `renderer`/`player`/`ui` import `core`/`contracts`; `apps/*` never imported by `packages/*`; no circular dependencies anywhere |
| Import boundaries inside a package | `eslint-plugin-import-x` `no-restricted-paths` | `generators/*` may not import `solvers/*`; `renderer/canvas2d` may not import `renderer/three`; Nest modules import each other only through exported ports |
| Cycles | **madge** `--circular` on each package `src/` | Zero cycles; build fails otherwise |
| Dead code | **knip** | No unused exports, files or dependencies; runs in CI with a small allowlist for public API entry points |
| Duplication | **jscpd** (threshold 3% per package, min 30 tokens) | Reports in CI; failures on `core` and `contracts` only, warnings elsewhere |
| Single source of truth for types | `zod` + `z.infer`, `ts-rest`, Prisma-generated types | Lint rule forbids hand-written interfaces that mirror a schema (`no-duplicate-schema-type` custom rule matching `interface X` when `schemas/X` exists) |
| Open/closed registries | Test `registry.all.length` equals number of files in `generators/` and `solvers/` | Adding a file without registering it fails the test; registering without a file cannot compile |
| Size and cohesion | ESLint `max-lines` 400 per file, `max-lines-per-function` 80, `complexity` 15, `max-params` 5 | Legacy `Cell.ts` (391 lines, 9-param constructor) would fail; new code cannot regress there |
| Config drift across workspaces | **syncpack** | Same version of a dependency everywhere; mismatched versions fail CI |
| Package hygiene | **publint**, **arethetypeswrong** | Valid `exports`, types resolve under `NodeNext` and bundlers |

These checks run in the `verify` CI job via a `turbo run check` pipeline that aggregates
`lint`, `depcruise`, `knip`, `madge`, `syncpack` and `publint`.

## 10. AI-assisted development guardrails

Coding agents (Claude Code, Codex, Antigravity per the workspace `AGENTS.md`) are first-class
contributors and are held to the same bar:

- Agents run `pnpm check && pnpm test` locally before proposing a PR; a PR description states
  which gates ran.
- No generated code is merged without tests written at the appropriate layer; a PR whose
  diff adds source lines but no test lines is flagged by a CI check unless labelled
  `docs-only` or `refactor-covered` with the covering test path named.
- Agents may not disable lint rules, lower coverage thresholds, add `@ts-ignore`/`eslint-
  disable` or quarantine tests without a human-approved issue link in the same PR.
- Agents propose ADRs for cross-package or dependency changes rather than making them
  silently; the ADR template has an "authored by" field distinguishing human and agent.
- Repository `CLAUDE.md` / `AGENTS.md` (to be added at the monorepo root) point agents at this
  document, the decision register and the DoD so every session starts from the same rules.
- Human review remains required for `packages/core`, `packages/contracts`, migrations, auth,
  infra and anything touching the security gate.

## 11. Phase alignment

| Roadmap phase | Quality deliverables |
|---------------|----------------------|
| Phase 1 (monorepo + core) | ESLint/Prettier/TS config package; Vitest + fast-check suites for core invariants; dependency-cruiser, knip, madge, syncpack in CI; coverage gates on core |
| Phase 2 (web parity) | Storybook + a11y addon; RTL component tests; Playwright `@smoke` journeys with axe and visual snapshots; size-limit and Lighthouse CI |
| Phase 3 (solvers, race) | Solver optimality properties; race determinism tests; step-engine benchmarks |
| Phase 4 (backend, auth) | Contract tests, Testcontainers, auth matrix, solve validation fixtures, k6 baseline |
| Phase 5 (learn) | Content lint rule, lesson E2E journeys |
| Phase 6 (desktop/mobile) | WebKit nightly run, Tauri smoke tests on built artifacts |
| Phase 7 (hardening) | Stryker baseline, full a11y audit, flakiness review, coverage ratchet |
