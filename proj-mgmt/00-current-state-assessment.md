# 00 - Current-State Assessment

> Status: Final (describes the repo as of commit `59ce2ca`, assessed 2026-09-27)
> Related: [09-modernization-migration.md](./09-modernization-migration.md),
> [07-security.md](./07-security.md), [12-quality-engineering.md](./12-quality-engineering.md)

---

## 1. Snapshot

| Fact | Value |
|------|-------|
| Repo | `maze-generation-algo-react-typesript-p5` (package name `maze-generator` 0.1.0) |
| History | 99 commits, single author, 2019-09-28 -> 2020-04-20; dormant for ~6.5 years |
| Origin | Follow-along of Daniel Shiffman's "Coding Challenge #10: Maze Generator" (p5.js, recursive backtracker), rebuilt in Create React App + TypeScript |
| Stack | React 16.10, TypeScript 3.6.3, react-scripts 3.1.2, p5 0.9 (WEBGL), MobX 5 (decorators) + mobx-react 6 + mobx-react-router, react-router 5, Material-UI v4, Apollo Boost / react-apollo, node-sass 4, Enzyme + RTL |
| Source size | ~4,400 lines TS/TSX/SCSS in `src/` across 83 files |
| Largest files | `Cell.ts` 391, `MazeGenerator.ts` 308, `MazeViewStore.ts` 215, `ExpandSidebar.tsx` 192, `Header.tsx` 161 |
| Tests | 3 test files, 6 assertions, 1 snapshot; at least one test cannot pass (see 5.5) |
| Backend | None in repo. `gcpServer/` holds only `package.json`; `server.js` is gitignored (`/gcpServer/*`) and therefore lost |
| Deployment | Manual: `yarn build` -> `postBuild.js` copies `build/` into `gcpServer/` -> `gcloud app deploy` (App Engine Standard, `nodejs12`, EOL) |
| CI/CD | None |
| Docs | Tutorial-link README; ~27 `TODO` comments; `next.md` holds the brief for this plan |

## 2. What the app does today (feature inventory)

Route `/newMaze` mounts a full-window p5 sketch. Everything below is user-visible and is the
**behavioural contract** the rewrite must preserve or consciously drop (the verdicts are in
[09-modernization-migration.md](./09-modernization-migration.md), parity checklist).

| Area | Behaviour | Where |
|------|-----------|-------|
| Generation | Recursive backtracker (iterative DFS with explicit stack), one algorithm step per animation frame, grid sized to the window from `cellSize` | `MazeGenerator.ts:183-272`, `Cell.getRandomNeightborToVisit` |
| 2D view | Cells drawn as rects + wall lines; colour of a cell derives from visit count and stack depth | `Cell.show` |
| 3D view | WEBGL canvas, extruded wall boxes, cube "projection" of the generator's stack depth with optional mirror below, depth culling by `maxPixelDepthToRenderProjection` | `Cell.show`, `DrawDepthAnimation.ts`, `MazeRenderer.ts` |
| Camera | `Change View` cycles rotation; click toggles follow-mouse; wheel zooms | `MazeRenderer.applyContentManipulations`, `MazeOptions` ctor |
| Run Maze | First-person mode: arrow keys move/turn in quarter turns, `P` peeks (raises camera), header hides other controls | `MazeViewStore.ts`, `MazeRenderer.applyMazeRunnerRotations` |
| Solve Maze | Header toggle only; `MazeSolver.ts` is a 21-line stub holding an `{x,y,z}` | `deps/MazeSolver.ts` |
| Save | Header button with no handler | `Header.tsx:262` |
| Options drawer | Sliders: frame rate, cell size, cell wall size; colour pickers: cell, wall, background; toggles: 3D, inverse colours, cube projection, mirror | `uiComponents/*`, `views/AppBarItems/*` |
| Persistence | Options saved to `localStorage` under seven keys; restored on load | `utils/storageUtils.ts` |
| Resize | Window resize re-creates the whole sketch | `MazeContainer.attachEventHandlers` |
| Exit hint | Last row/column cells textured with `exit.jpg` | `Cell.show` |
| Metrics | Console logging of frame rate, estimated run time, visits/cells ratio | `MazeGenerator.logMetrics` |
| Errors | `ErrorBoundary` -> `errorReporter` POSTs to `/reportError`; Stackdriver browser SDK | `components/ErrorBoundary.tsx`, `utils/errorReporting.ts`, `errorHandler.js` |
| Auth/GraphQL | Apollo client to `localhost:4000/graphql`, `LoginView` with a login mutation (not routed), generated `schemaTypes.ts` containing subscription/credit-card types from another project | `AppWrapper.tsx`, `views/Login/*`, `schemaTypes.ts` |

## 3. Architecture as built

```
index.tsx -> AppWrapper (ErrorBoundary, ApolloProvider, 2 React contexts, MobX Provider)
          -> App (Router synced to MobX RouterStore) -> Header + Routes
Routes: "/" Home(stub)   "/newMaze" MazeContainer   "/login" ComponentThatThrows(!)   "/account" Home

MazeContainer (React) --creates--> new p5(sketch) --constructs--> MazeGenerator
   MazeGenerator.p.setup : builds Cell[] grid, camera, MazeRenderer
   MazeGenerator.p.draw  : renderer.setCamera/lights/rotations -> every Cell.show() -> ONE algorithm step
   Cell.show             : reads stores.uiPreferencesStore + stores.mazeViewStore directly,
                           computes colours, draws rect/lines/boxes with p5, allocates Points per frame
   MazeOptions           : colours/sizes/frame rate + derived grid dims + zoom state + window 'wheel' listener
                           + localStorage IO (via storageUtils) ; mutated by MazeOptionsSetter from UI
Stores (MobX singletons): UiPreferencesStore, MazeViewStore (also owns keyboard listeners), BrowserInfoStore,
                          UserStore(stub), RouterStore
```

Two parallel state systems exist: MobX stores (injected into components and *also* imported as a
global singleton `stores` from inside non-React classes) and two React contexts carrying
`MazeOptions`/`MazeOptionsSetter`/`p5_MazeFuncs`. UI components sometimes use both.

## 4. Strengths worth preserving

- **Working, visually distinctive generator.** The 3D extrusion, stack-depth cube projection and
  mirror are unusual and demo well; they become three.js scene features.
- **Reasonable domain vocabulary.** Cell/wall/grid, `walls[Top,Right,Bottom,Left]`,
  index math in `gridUtils.getPointValsAtIndex` map cleanly onto the new `Grid`/`Dir` model.
- **First-person "Run Maze" interaction design** (quarter-turn rotation, forward/back, peek) is a
  good embodied-learning idea and is kept.
- **Options-driven rendering** with persisted preferences is the right instinct; it becomes a typed
  preferences schema.
- **Author intent is well documented in TODOs** (builder for options, extract colour utils, move
  logic out of `Cell`, decide on WebGL vs 2D canvas), and the plan addresses each.
- **Good defaults**: colour palette, `cellSize` 40, padding 30 %, frame rate 40.

## 5. Problems

### 5.1 Architecture and coupling (root cause of most other issues)

| # | Problem | Evidence | Consequence |
|---|---------|----------|-------------|
| A1 | Algorithm advances **one step per rendered frame** | `MazeGenerator.ts:183-272` inside `p.draw` | Speed tied to fps; cannot run headless, in a Worker, or be unit-tested; "solve" cannot be added without a second draw loop |
| A2 | `Cell` mixes graph state, colour math, 3D animation, store reads and p5 drawing | `Cell.ts` (391 lines), imports `stores`, `p5.Image`, projection utils | Second algorithm or second renderer requires editing this class |
| A3 | Core classes import the **global MobX singleton** and React context values | `MazeGenerator.ts:9`, `Cell.ts:14`, `mazeOptions.ts:7`, `projectionUtils.ts:1-5` | No dependency inversion; impossible to reuse core outside this app |
| A4 | Randomness comes from `p.random` | `Cell.ts:723` | No seed; mazes cannot be reproduced, shared or replayed |
| A5 | Non-idiomatic React lifecycle | `MazeContainer.tsx:57-70` `useEffect` with **no dependency array** creates/destroys the sketch on every render; `window.onresize` assignment | Wasted work, event-handler clobbering, flicker |
| A6 | Listener leaks | `mazeOptions.ts:46` adds a window `wheel` listener per instance, never removed; `MazeViewStore` binds key handlers in the constructor "TODO Remove after dev" | Memory/CPU leak over navigation |
| A7 | Duplicate state systems (MobX + Context) and duplicated colour-inversion logic in three places | `Cell.show`, `MazeGenerator.p.draw`, `DrawDepthAnimation.drawWall` | DRY violations, divergent behaviour |
| A8 | Solver, Save, Login, Home are stubs or test artefacts on production routes | `deps/MazeSolver.ts`, `Header.tsx:262`, `AppRoutes.tsx:31-38` | Product promises not met; `/login` throws on purpose |

### 5.2 Correctness bugs (minor, but indicative)

- `MazeGenerator.logMetrics`: `estimatedSeconds = Math.floor(numberOfEstimatedSeconds * 100)`
  should be `% 60`; run-time formatting is wrong (`MazeGenerator.ts:154`).
- `Cell.show` draws rects `cellWidth + 1` / `cellHeight + 1` as a "temp hack" for a 1-px gap
  (`Cell.ts:551-555`).
- `mazeOptions.ts:48` reads the non-standard `event.wheelDelta`; zoom direction logic inverted
  when `zValue >= 0`.
- `storageUtils.ts:4-5` imports `cpus` from `os` and `Color` from `p5` (unused; the `os` import
  drags a Node polyfill into the browser bundle).
- `LoginForm.tsx:339-365` `onChange` handlers return objects instead of calling setters; the
  form never updates state.
- `App.test.tsx` renders `<App />` without `ApolloProvider`/contexts; cannot pass.
- `UiPreferencesStore.test.tsx:15` "sets dark mode to default" asserts on `inverseColorMode`;
  actions are called with arguments they do not accept (type errors hidden because CRA's Jest
  transpiles with Babel and skips type-checking).

### 5.3 Security and privacy (details and remediation in [07-security.md](./07-security.md))

- A Google API key is committed in `src/.env` (`REACT_APP_ERROR_HANDLER_API_KEY`) and again in
  `src/errorHandler.js`, with the GCP project id. **Rotate and restrict immediately** (Phase 0).
- `errorReporting.ts:59-64` hard-codes a fake user (`Some User`, `Suser@gmail.com`,
  `isAdmin: "true"`) into every error report.
- `GENERATE_SOURCEMAP=true` ships source maps publicly; no CSP; `credentials: "include"` to a
  localhost GraphQL endpoint.
- `nodejs12` App Engine runtime and 2019-2020 dependency set carry unpatched CVEs; no audit step.
- `.gcloudignore`/`.gitignore` name a service-account JSON key file; the deployment path relied
  on a long-lived key.

### 5.4 Tooling and dependencies (details in [09-modernization-migration.md](./09-modernization-migration.md))

Every major dependency is end-of-life or superseded: Create React App (sunset), React 16,
TypeScript 3.6 (no optional chaining, no `satisfies`, no template literal types), MobX 5 legacy
decorators requiring `experimentalDecorators` + `emitDecoratorMetadata`, node-sass (native
build, deprecated), Enzyme (no React 17+ adapter), Apollo Boost (deprecated), MUI v4 (EOL),
p5 0.9 (v2 is current and p5 is unsuited to a React app anyway), react-router 5. `tsconfig.json`
has `typeRoots`/`paths` pointing at a non-existent `../../DefinitelyTyped`, `postBuild.js` requires
`fs-extra` which is not declared, and a directory is literally named `mazeRenderer.ts/`.
A clean `yarn install` on a current Node is unlikely to succeed (node-sass native build).

### 5.5 Testing

Three test files, one broken by construction (`App.test.tsx`), one with a wrong assertion and
type errors, one Enzyme shallow snapshot of a slider. No tests touch the algorithm. Coverage of
`src/mazeGenComp/**` is 0 %.

### 5.6 Accessibility (details in [10-accessibility.md](./10-accessibility.md))

Canvas-only content with no text alternative; `user-scalable=no` in `public/index.html`;
state encoded by colour alone; keyboard handling on `document` using deprecated `keyCode`;
default page title "React App"; heavy motion with no `prefers-reduced-motion` handling.

### 5.7 Hygiene

Placeholder `manifest.json` ("Create React App Sample"), `debug.log` and screenshots committed,
`tempData/` with failed YAML attempts, `sampleReq.json` (27 kB) of unknown provenance, PDFs of
generated mazes in `misc/`. None of this is harmful; it should move under `apps/legacy/` or
`docs/archive/` rather than be deleted (workspace rule: non-destructive).

## 6. Salvage plan

| Verdict | Item | How |
|---------|------|-----|
| **Port with characterisation tests** | Recursive backtracker semantics, wall order `[N,E,S,W]`, neighbour index math | Reimplement as a generator function in `@maze/core`; a test replays the legacy algorithm with a fixed RNG sequence and asserts identical walls |
| **Port as design** | First-person Run Maze controls; 3D extrusion; stack-depth cube projection + mirror; colour inversion; option defaults | three.js scene features and theme tokens; behaviours listed in the parity checklist |
| **Port as schema** | The seven `localStorage` option keys | One-time migration into the typed preferences schema on first load |
| **Keep as reference** | Whole current app | Moves to `apps/legacy`, build-only, read-only (D-19) |
| **Drop** | p5, MobX, MUI, Apollo/GraphQL, Enzyme, node-sass, Stackdriver SDK, `gcpServer`, `postBuild`, App Engine YAML | Replaced per decision register |
| **Delete from history / rotate** | API key, project id | Phase 0 |

## 7. Risks the current state poses to the next phase

1. **Hidden behaviour.** Because the algorithm is entangled with rendering, some visual
   behaviours (colour drift with visit count, stack-depth extrusion) are only defined by the
   code. Mitigation: record reference videos/screenshots of the legacy app before freezing it
   and encode them in the parity checklist.
2. **Legacy app may not build.** node-sass and CRA 3 on current Node. Mitigation: build
   `apps/legacy` in a pinned Node 14 Docker image, or accept it as source-only reference.
3. **Key exposure.** The committed API key may already be abused. Mitigation: rotate first,
   plan second (Phase 0, day 1).
4. **Scope gravity.** The product vision is large; the current code is small. Mitigation: the
   roadmap gates every phase on a deployable slice and the parity checklist stops feature
   creep during the port.
