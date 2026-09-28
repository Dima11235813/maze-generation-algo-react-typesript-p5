# 03 - Target Architecture

> Status: Proposed | Last updated: 2026-09-27
> Decisions referenced: D-01 .. D-19 in [README.md](./README.md)

This document describes the shape of the system we are building: the monorepo, the package
boundaries, how data and control flow between them, and how SOLID/DRY are enforced
structurally rather than by convention.

---

## 1. Architecture at a glance

```
                          +----------------------------------------------------+
                          |                     apps/                          |
                          |  web (Vite/React PWA)  desktop (Tauri 2)  mobile   |
                          |  api (NestJS/Fastify)  legacy (frozen CRA)         |
                          +------------------+---------------------------------+
                                             | imports only from packages/
   +-----------------------------------------v----------------------------------------+
   |                                    packages/                                     |
   |                                                                                  |
   |  @maze/core          pure TS: grid, graph, RNG, generators, solvers, step engine, |
   |                      serialization, metrics.   ZERO runtime deps.                |
   |  @maze/contracts     zod schemas + inferred types, ts-rest API contract, CASL     |
   |                      abilities, MazeDocument schema.  Depends on core types only. |
   |  @maze/renderer      Renderer port + adapters (canvas2d, three). Depends on core. |
   |  @maze/ui            React design system (shadcn/Radix/Tailwind), a11y primitives.|
   |  @maze/player        React bindings: StepPlayer hooks, Worker bridge, stores.     |
   |  @maze/config        shared tsconfig / eslint / prettier / tailwind presets.      |
   +----------------------------------------------------------------------------------+
```

Dependency rule (enforced by ESLint `import/no-restricted-paths` + Turborepo `dependsOn`):

```
core  <-  contracts  <-  renderer, player, ui  <-  apps/*
core  <-  api (apps/api imports core + contracts only)
```

Nothing in `packages/` may import from `apps/`. `@maze/core` may import nothing at runtime.

## 2. Monorepo layout (D-01, D-02)

```
maze-lab/
  apps/
    web/                 Vite + React 19 PWA. Routes: /play /watch /race /build /learn /explore /account
    api/                 NestJS (Fastify). Modules: auth, users, mazes, solves, races, lessons, health
    desktop/             Tauri 2 shell wrapping apps/web build (Win/macOS/Linux)
    mobile/              Tauri 2 mobile targets (iOS/Android) wrapping apps/web build
    legacy/              The current CRA app, moved verbatim, build-only, read-only (D-19).
                         Excluded from pnpm-workspace.yaml; keeps its own Yarn lockfile.
  packages/
    core/                @maze/core
    contracts/           @maze/contracts
    renderer/            @maze/renderer  (sub-paths: /canvas2d, /three)
    player/              @maze/player
    ui/                  @maze/ui (+ Storybook)
    config/              @maze/config (tsconfig.base.json, eslint preset, prettier, tailwind preset)
  infra/
    terraform/           GCP project, Cloud Run, Cloud SQL, Memorystore, Secret Manager, Firebase Hosting
    docker/              api Dockerfile, local docker-compose (postgres, redis, otel-collector)
    runbooks/            deploy, rollback, rotate-secrets, restore-db (see 08)
  proj-mgmt/             this folder
  .github/workflows/     ci.yml, security.yml, deploy-web.yml, deploy-api.yml, release.yml,
                         desktop-mobile.yml, infra.yml (Terraform plan/apply)
  turbo.json  pnpm-workspace.yaml  package.json  .changeset/  .nvmrc  README.md  SECURITY.md  CODEOWNERS
```

Tooling conventions:

- **pnpm** with `workspace:*` protocol; single lockfile; `pnpm -r` scripts.
- **Turborepo** pipelines: `build`, `typecheck`, `lint`, `test`, `test:e2e`, `storybook:build`.
  Remote cache in CI (Vercel remote cache or self-hosted on GCS).
- **Changesets** for semver of `packages/*`; apps are versioned by git tag + build SHA.
- **Syncpack** to keep dependency versions aligned across workspaces.
- Node version pinned in `.nvmrc` / `engines`; Corepack pins pnpm.

## 3. `@maze/core` - the heart (D-03, D-18)

### 3.1 Module map

```
core/src/
  grid/        Grid, CellId, Direction, Wall bitmask helpers, topology (orthogonal now; hex/polar later)
  graph/       Graph<N> interface, adjacency helpers, BFS/DFS utilities, spanning-tree checks
  rng/         Rng interface, PCG32 & mulberry32 implementations, seed parsing (string|number)
  steps/       Step type unions (GenStep, SolveStep), StepStream helpers, replay/record
  generators/  one file per algorithm + registry
  solvers/     one file per algorithm + registry
  agents/      Agent = Solver + budget; Race scheduler (lockstep)
  metrics/     deadEnds, solutionLength, diameter (double BFS), branching, twistiness, riverness
  document/    MazeDocument v1 encode/decode, content hash, migration hooks
  editing/     pure edit operations (toggleWall, setStart, setGoal, resize) returning new state + patch
  describe/    describeCell / describeStep: plain-language sentences for the a11y narrator and step log
  index.ts
```

### 3.2 Key types (sketch)

This is an orientation sketch. The **authoritative, complete type model** (all `Step`
variants, `Rng.shuffle/fork`, the optional `rng` argument on solvers, `AlgorithmMeta.since`,
Agent/Race types) lives in [02-domain-model-and-algorithms.md](./02-domain-model-and-algorithms.md).
Where the two differ, 02 wins.

```ts
export type CellId = number;                      // row * width + col
export const enum Dir { N = 0, E = 1, S = 2, W = 3 } // same order as legacy walls[0..3] (Top,Right,Bottom,Left)

export interface Grid { readonly width: number; readonly height: number; readonly topology: 'orthogonal' }

/** Walls stored as one nibble per cell: bit set = wall present. Uint8Array for cache locality. */
export interface MazeState {
  readonly grid: Grid;
  readonly walls: Uint8Array;                     // length = width*height, low 4 bits used
  readonly start: CellId;
  readonly goal: CellId;
}

export interface Rng { next(): number; int(maxExclusive: number): number; pick<T>(xs: readonly T[]): T; readonly seed: string }

export type GenStep =
  | { t: 'visit';     cell: CellId }
  | { t: 'carve';     from: CellId; to: CellId }
  | { t: 'backtrack'; from: CellId; to: CellId }
  | { t: 'frontier';  add?: CellId[]; remove?: CellId[] }        // Prim / Growing Tree
  | { t: 'union';     a: CellId; b: CellId }                     // Kruskal
  | { t: 'done' };

export type SolveStep =
  | { t: 'expand';   cell: CellId; g?: number; f?: number }
  | { t: 'discover'; cell: CellId; from: CellId }
  | { t: 'deadend';  cell: CellId }
  | { t: 'path';     cells: CellId[] }
  | { t: 'fail' }
  | { t: 'done';     stats: SolveStats };

export interface AlgorithmMeta {
  id: string; name: string; family: 'generator' | 'solver';
  complexity: { time: string; space: string };  // e.g. "O(V)" / "O(V log V)"
  tags: string[];                               // 'randomized', 'graph-search', 'heuristic', ...
  params: ParamDescriptor[];                    // plain data (core has no deps); @maze/contracts
                                                // turns it into a zod schema for forms and the API
  docsSlug: string;                             // links into Learn mode
}

export interface MazeGenerator<P = unknown> {
  readonly meta: AlgorithmMeta;
  run(grid: Grid, rng: Rng, params: P): Generator<GenStep, MazeState>;
}

export interface MazeSolver<P = unknown> {
  readonly meta: AlgorithmMeta;
  run(maze: MazeState, params: P, rng?: Rng): Generator<SolveStep, SolveResult>; // rng for randomised solvers
}
```

Why **ES generators**: they make every algorithm pausable, steppable, recordable and testable
with a plain `for..of`, and they cost nothing when run to completion in a Worker. The current
codebase advances the algorithm once per p5 `draw()` frame, which couples algorithm speed to
frame rate and makes headless testing impossible.

### 3.3 Registries (Open/Closed)

```ts
export const generators = createRegistry<MazeGenerator>([recursiveBacktracker, prims, kruskals, ...]);
export const solvers    = createRegistry<MazeSolver>([bfs, dfs, dijkstra, aStar, ...]);
```

Adding an algorithm = adding one file and one registry entry. UI menus, Learn mode index,
API validation enums (`z.enum(generators.ids)`) and tests (`describe.each(generators.all)`)
derive from the registry.

### 3.4 Invariants (drive property-based tests)

- Every generator output is a **spanning tree**: connected and `passages === cells - 1`.
- Walls are symmetric: `hasWall(a, E) === hasWall(b, W)` for neighbours.
- Same `(algorithm, seed, params, grid)` -> byte-identical `walls`.
- Every complete solver finds a path when one exists; BFS/Dijkstra/A* (admissible h) paths
  are shortest.
- `decode(encode(m)) deep-equals m`, and `hash(m)` is stable across platforms.

## 4. `@maze/contracts` - one source of truth for the wire (D-08, D-11, D-18)

```
contracts/src/
  schemas/      zod: MazeDocumentV1, UserPublic, SolveRecord, RaceConfig, RaceResult, LessonProgress
  api/          ts-rest contract: routers for auth, mazes, solves, races, lessons, health
  abilities/    CASL ability builder: defineAbilitiesFor(user) used by API guards and UI
  errors/       ProblemDetails (RFC 9457) schema + error code enum
  index.ts
```

- Types are **inferred from zod** (`z.infer`), never hand-duplicated.
- `@maze/contracts` owns the one adapter that converts core's dependency-free
  `ParamDescriptor[]` into zod schemas (`paramsToZod`), so algorithm parameters are validated
  identically in UI forms and API requests without core depending on zod.
- The API server implements the ts-rest contract; the web app consumes the generated
  React-Query client. A change to a schema is a compile error on both sides.
- OpenAPI 3.1 is generated from the contract in CI and published with the API.

## 5. `@maze/renderer` - rendering port and adapters (D-04)

```ts
export interface Renderer {
  mount(host: HTMLElement, opts: RendererOptions): void;
  setMaze(maze: MazeState): void;                     // full redraw, cached geometry
  applyStep(step: GenStep | SolveStep): void;         // incremental overlay updates
  setOverlay(overlay: Overlay): void;                 // frontier, visited, path, agents
  setTheme(theme: RenderTheme): void;                 // tokens from @maze/ui, colour-blind safe
  setCamera?(cam: CameraState): void;                 // 3D only
  resize(w: number, h: number): void;
  destroy(): void;
}
```

Adapters:

| Adapter | Use | Notes |
|---------|-----|-------|
| `canvas2d` | Default 2D top-down, printing/export to PNG/SVG/PDF | Dirty-rect redraw; OffscreenCanvas in a Worker when available |
| `three` | 3D view, first-person "Run Maze" mode, the legacy cube/mirror animation | react-three-fiber in web; same three.js scene graph works in Tauri |
| `dom` (a11y) | Hidden DOM grid mirroring the maze for screen readers; also used in tests | Always mounted alongside a visual renderer (D-17) |

The p5.js dependency is retired: it forces a global draw loop, mixes 2D/WEBGL modes, and its
typings required hacks (`global.d.ts`, bogus `typeRoots`). All visual behaviours the current
app has (3D walls, cube projection, mirror, follow-mouse, view rotation, first-person run
with arrow keys and peek) are re-implemented as three.js scene features driven by the same
`MazeState`.

## 6. `@maze/player` - time, workers and React bindings

- `StepPlayer`: consumes a `Generator<Step>`; `play/pause/step/seek/speed`; emits steps to
  N subscribers (renderer, narrator, metrics, pseudo-code highlighter). Uses
  `requestAnimationFrame` batching but is not coupled to frame rate.
- `Narrator`: subscribes to steps, uses `@maze/core/describe` to produce sentences at a chosen
  verbosity, and writes them to an ARIA live region and the textual step log (see 10).
- `WorkerBridge`: runs `@maze/core` in a Web Worker (via Comlink) for large mazes; steps are
  transferred in chunks; falls back to main thread when Workers are unavailable.
- React hooks: `useStepPlayer`, `useMaze`, `useRace`. Zustand stores for UI state; TanStack
  Query for server state.

## 7. `apps/web` - application shell (D-05, D-06, D-12)

- **Routing** (TanStack Router, file-based): `/`, `/play/:mazeId?`, `/watch`, `/race`, `/build`,
  `/learn/:lessonSlug?`, `/explore`, `/m/:shareId` (public maze), `/account`.
- **State**: Zustand slices (`uiPrefs`, `playerControls`, `editor`). **Preferences only** are
  persisted to `localStorage` for guests and synced to the API for signed-in users; auth tokens
  are never persisted in web storage (see 06).
- **Data**: TanStack Query with the ts-rest client; optimistic updates for saves; IndexedDB
  (Dexie) queue for offline saves in PWA/Tauri.
- **Design system**: `@maze/ui` (shadcn/ui components, Radix primitives, Tailwind v4 tokens).
  Theme tokens cover light/dark/high-contrast and colour-blind-safe palettes.
- **PWA**: Workbox via `vite-plugin-pwa`; offline play of locally saved mazes.
- **Platform bridge**: a tiny `platform` port (`fs`, `share`, `notifications`, `deepLink`,
  `secureStore`, `haptics`) living in `apps/web/src/platform/`, with `web` and `tauri`
  adapters chosen at build time via `VITE_PLATFORM` (see 11).

## 8. `apps/api` - backend shape (D-07, D-08, D-09)

Hexagonal / clean layout per module; detailed in [04-backend-rewrite.md](./04-backend-rewrite.md).

```
api/src/
  main.ts                  Fastify adapter, helmet, CORS, rate limit, OTel, pino
  app.module.ts
  modules/
    auth/                  OIDC token verification (Identity Platform), session refresh, AuthProvider port
    users/                 profile, preferences
    mazes/                 CRUD, versions, forks, visibility, share links; MazeDocument validation via @maze/contracts
    solves/                record user solves; anti-cheat replay validation with @maze/core
    races/                 create race configs, run/replay races server-side for leaderboards
    lessons/               curriculum metadata, progress
    health/                liveness/readiness, build info
  shared/
    persistence/           Prisma client, repositories (ports + Prisma adapters), outbox
    cache/                 Redis adapter, cache-aside helpers, rate limiter
    authz/                 CASL guard using @maze/contracts abilities
    errors/                ProblemDetails filter
```

The server can **re-run any maze or race from provenance** using `@maze/core`, which enables
server-side validation of submitted solves (replay the recorded moves, check they reach the
goal) and dedupes generated mazes by content hash.

## 9. Cross-cutting concerns

| Concern | Mechanism |
|---------|-----------|
| Configuration | Typed env parsing with zod (`@maze/contracts/env`), no `process.env` reads outside one module per app |
| Errors | RFC 9457 Problem Details on the API; typed `Result` in core; Sentry in both apps |
| Logging | pino (API) / structured console (web) with request/trace ids; no PII |
| Telemetry | OpenTelemetry SDK in API; web vitals + custom spans in web |
| Feature flags | Simple remote JSON flags via API `/config`, cached client-side; no vendor lock-in yet |
| i18n | `@lingui` or `i18next` scaffolded from day one; English only at launch |
| Time | All timestamps UTC ISO-8601; durations in ms integers |

## 10. SOLID and DRY - how the structure enforces them

| Principle | Where it shows up | Legacy violation it fixes |
|-----------|-------------------|---------------------------|
| **S**ingle responsibility | `Cell` becomes a `CellId` + wall nibble; drawing lives in renderer adapters; algorithm in generators | Legacy `Cell.ts` (391 lines) mixes graph state, colour math, 3D animation, MobX reads and p5 calls |
| **O**pen/closed | Algorithm registries; renderer adapters; auth/persistence ports | Adding a second generator today means editing `MazeGenerator.ts` and `Cell.ts` |
| **L**iskov | All generators/solvers satisfy the same generator-function contract and pass the same invariant tests | n/a (only one algorithm exists) |
| **I**nterface segregation | `Renderer` split into `setMaze`/`applyStep`/`setOverlay`; `Rng` is 3 methods; `platform` port is per-capability | `MazeOptions` carries colours, sizes, zoom state, window listeners and storage IO |
| **D**ependency inversion | Core knows nothing about DOM/React/p5/Prisma; apps inject adapters | `MazeGenerator` imports `stores`, `p5`, an image asset and the solver singleton directly |
| **DRY** | zod schema -> TS type -> API validation -> OpenAPI -> UI form; registry -> menus/tests/enums; CASL abilities shared UI/API | Colour inversion logic duplicated 3x; localStorage keys and defaults duplicated across `storageUtils`, `mazeOptionsSetter`, `mazeDefaults` |

## 11. Runtime topology (production)

```
 Browser / Tauri shell
   |  HTTPS (Firebase Hosting CDN -> static web bundle)
   |  HTTPS /api/*  -> Cloud Run (apps/api, min 1 instance, autoscale)
   |                    |-- Cloud SQL (PostgreSQL 16, private IP)
   |                    |-- Memorystore (Redis)
   |                    |-- Secret Manager (runtime secrets)
   |                    |-- Cloud Logging / Trace  (OTel)
   |                    `-- Sentry
   `-- Identity Platform (OIDC)  <- token issued to client, verified by API
```

## 12. Non-functional targets

| Metric | Target |
|--------|--------|
| Generate + render 100x100 maze on mid-range laptop | < 200 ms to first frame, 60 fps playback |
| Step engine throughput (Worker) | >= 1M steps/s for BFS on 500x500 |
| API p95 latency (read) | < 150 ms at 100 rps |
| Web bundle (initial route, gzip) | < 250 kB excluding three.js chunk (lazy) |
| Lighthouse (perf/a11y/best-practices) | >= 90 / 100 / 100 |
| Availability | 99.9 % monthly for API |
| Test coverage | >= 90 % lines on `@maze/core`, >= 75 % overall |

## 13. Open questions (to be closed by ADR before Phase 2)

1. Should Race mode and large-maze generation also run server-side (Cloud Run Jobs) for
   shareable deterministic leaderboards, or client-only with signed result submission?
   Leaning: client-first, server replay-validates.
2. Do we need hex/polar/weave topologies in v1 of `Grid`? Leaning: keep `topology` field,
   implement orthogonal only, design neighbour lookup behind an interface.
3. Expo vs Tauri mobile is decided (Tauri, D-12) but must be validated by a 2-day spike on
   WebGL performance in the iOS WKWebView before Phase 6.
