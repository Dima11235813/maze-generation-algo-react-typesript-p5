# 09 - Modernization & Migration

> Status: Proposed | Last updated: 2026-09-27
> Decisions referenced: D-02, D-03, D-04, D-05, D-06, D-13, D-15, D-16, D-19
> ADRs: [ADR-004](./adr/ADR-004-rendering-abstraction.md), [ADR-005](./adr/ADR-005-web-app-stack.md),
> [ADR-006](./adr/ADR-006-ui-kit.md), [ADR-019](./adr/ADR-019-migration-strategy.md)

This document is the dependency-by-dependency and behaviour-by-behaviour plan for moving from
the 2019-2020 Create-React-App prototype to the target architecture in
[03-target-architecture.md](./03-target-architecture.md). It does not re-argue the stack
choices; it explains how we get there without losing anything users can see today.

---

## 1. Why a migration rather than an upgrade

The legacy app was last touched on 2020-04-20. Every layer of its stack has since reached
end-of-life or been superseded: CRA is sunset, `node-sass` no longer builds on current Node,
Enzyme has no React 17+ adapter, MUI v4 and MobX 5 decorators are legacy, and the App Engine
`nodejs12` runtime is decommissioned. Upgrading in place would mean fighting six years of
breaking changes inside a codebase whose core coupling (algorithm advanced once per p5 draw
frame) is the very thing we want to remove. D-19 therefore selects the strangler-fig approach:
freeze the old app, build the new one beside it, and switch when a parity checklist passes.

## 2. Dependency inventory and replacement map

Versions are taken from `package.json` / `yarn.lock` of the legacy app.

### 2.1 Runtime dependencies

| Legacy package | Version | Status (2026) | Replacement | Notes |
|----------------|---------|---------------|-------------|-------|
| `react`, `react-dom` | 16.10 | 3 majors behind | React 19 | Concurrent features, `use`, ref-as-prop; no more `React.SFC` (removed in 18 types) |
| `typescript` | 3.6.3 | Very old | TypeScript 5.x `strict` (D-02) | `satisfies`, `const` type params, decorators are now standard (we do not use them) |
| `react-scripts` (CRA) | 3.1.2 | Sunset | Vite (D-05) | ESM dev server, Rollup build, `vite-plugin-pwa`, Vitest shares config |
| `p5` + `@types/p5` | 0.9.0 | p5 is on 2.x; our usage is retired | `@maze/renderer` canvas2d + three.js (D-04) | p5 forced a global draw loop and 2D/WEBGL mode mixing; typings needed `global.d.ts` hacks |
| `mobx` | 5.15 | v6 current; v5 uses legacy decorators | Zustand (UI state) + TanStack Query (server state) | Removes `experimentalDecorators` and `emitDecoratorMetadata` |
| `mobx-react` | 6.1 | Superseded | (none; React hooks) | `inject()`/`observer()` HOCs removed |
| `mobx-react-router` | 4.1 | Unmaintained | TanStack Router | Type-safe file-based routes, search-param schemas |
| `react-router`, `react-router-dom` | 5.1 | v7 current | TanStack Router (D-05) | Loader-based data fetching pairs with TanStack Query |
| `history` | 4.10 | Transitive to RR5 | (none) | Router owns history |
| `@material-ui/core`, `@material-ui/icons` | 4.9 | EOL | shadcn/ui + Radix + Tailwind v4 (D-06) | No runtime CSS-in-JS; headless a11y primitives |
| `@types/material-ui` | 0.21 | Wrong package (v0 types) | (none) | Was never used correctly |
| `node-sass` | 4.13 | Deprecated; native build fails on Node >= 16 | Tailwind v4 (+ CSS modules where needed) | Two `.module.scss` files to port |
| `apollo-boost`, `react-apollo`, `apollo`, `graphql`, `@types/graphql` | 0.4 / 3.1 / 2.23 / 14.6 | apollo-boost deprecated; no backend exists | Removed; REST via ts-rest client (D-08) | `schemaTypes.ts` (login/subscription/credit-card types) is unrelated scaffolding and is dropped |
| `enzyme`, `@types/enzyme`, `enzyme-to-json` | 3.11 | Dead (no React 17+ adapter) | React Testing Library + Vitest (D-15) | One snapshot test to rewrite |
| `@testing-library/react`, `jest-dom`, `user-event` | 9.x / 4.x / 7.x | Old majors | Current majors | Keep the library, bump versions |
| `stackdriver-errors-js` | 0.8 | Experimental, abandoned | Sentry browser SDK (D-16) | Also removes the hard-coded API key in `errorHandler.js` |
| `@google-cloud/error-reporting` | 1.1 | Superseded; wrong tier (client bundle) | Sentry + OpenTelemetry on API (D-16) | Was listed in the *frontend* `package.json` |
| `stacktrace-js` | 2.0 | Fine but redundant | (Sentry does source-map symbolication) | |
| `react-color` | 2.17 | Unmaintained | Radix-based colour picker (`react-colorful` or shadcn community picker) | Must be keyboard operable (see 10-accessibility) |
| `rc-slider`, `@types/rc-slider`, `react-simple-range` | 8.7 / 1.6 | Old / unmaintained | Radix Slider via shadcn `Slider` | One component for cell size, wall size, speed |
| `react-select` | 3.0 | Old major | shadcn `Select` / `Combobox` | Only referenced by types |
| `react-responsive` types | 8.0 | Unused | CSS container queries + a `useMediaQuery` hook | |
| `@fortawesome/*` | 1.2 / 5.12 / 0.1 | Old majors | `lucide-react` | Tree-shakeable, consistent with shadcn |
| `classnames` types | 2.2 | Unused | `clsx` + `tailwind-merge` (`cn()` helper) | |
| `@types/node` | 12.7 | Node 12 EOL | `@types/node` 22 | |

### 2.2 Server / deployment

| Legacy | Status | Replacement | Notes |
|--------|--------|-------------|-------|
| `gcpServer/` Express static server (`express`, `helmet` 3, `serve`, `nocache`, `morgan`, `body-parser`) | `server.js` is **not in the repo** (`/gcpServer/*` is gitignored); deployment is not reproducible | Firebase Hosting for static web; NestJS on Cloud Run for API (D-07, D-13) | Nothing to migrate; the folder is archived with `apps/legacy` |
| App Engine Standard `runtime: nodejs12`, `instance_class: B2`, `manual_scaling` | Runtime decommissioned | Cloud Run (Node 22 container) | `postBuild/postBuild.js` + `app.yaml` copy step disappears |
| `postBuild/postBuild.js` requires `fs-extra` | `fs-extra` is not a declared dependency; `yarn build` fails on clean install | Turborepo pipeline | |
| Stackdriver Error Reporting via browser key | Key committed to git | Sentry DSN from env; key rotation tracked in 07-security | |

### 2.3 Repository oddities to drop (not port)

| Item | Problem | Action |
|------|---------|--------|
| `src/global.d.ts` | Re-exports `p5` as a global namespace with `import module = require('p5')` to make instance-mode typing work | Delete with p5 |
| `tsconfig.json` `typeRoots: ["../../DefinitelyTyped/types"]` and `paths: {"*": ["../../DefinitelyTyped/types/*"]}` | Points outside the repo to a sibling checkout that does not exist; `paths` without `baseUrl` is invalid | Replace with `@maze/config/tsconfig.base.json` |
| `src/mazeGenComp/mazeRenderer.ts/mazeRenderer.ts` | Directory named with a `.ts` extension; confuses tooling and humans | Renderer lives in `@maze/renderer` |
| `src/utils/storageUtils.ts` imports `cpus` from `"os"` and `Color` from `"p5"` | Both unused; the `os` import pulls a Node polyfill into the browser bundle | Storage layer is rewritten (section 6) |
| `emitDecoratorMetadata`, `experimentalDecorators` | Only for MobX 5 decorators | Off in the new tsconfig |
| `src/errorHandler.js` | Plain JS with a hard-coded API key and project id | Delete; Sentry init in `apps/web/src/telemetry.ts` |
| `src/ComponentThatThrows.tsx` wired to the `/login` route | Test artefact shipped to production routing | Not ported; Sentry has its own test-event flow |
| `src/schemaTypes.ts`, `src/graphql/**`, `src/api/**`, `src/views/Login/**`, `UserStore`, `sharedData.ts` (MSAL strings) | Copied from a different project template; no backend exists | Not ported; auth is designed fresh in 06-authn-authz |
| `debug.log`, `tempData/`, `pics/`, `misc/mazesCreated/*.pdf` | Working files committed to root | Kept inside `apps/legacy` only; new repo root stays clean |
| `src/.env` with `REACT_APP_ERROR_HANDLER_API_KEY` | Secret in git | See 07-security P0 |

## 3. Strangler-fig plan (D-19)

The old app keeps running (and stays deployable from its frozen folder) until the new app
can do everything it does. Concrete steps:

### 3.1 Phase 1 - freeze and extract

| Step | Detail | Done when |
|------|--------|-----------|
| 1.1 | `git mv` the whole current tree (except `proj-mgmt/`, `.git`, root `README.md`) to `apps/legacy/`. Keep its `yarn.lock`; mark `"private": true`; add `apps/legacy/README.md` explaining it is frozen | `apps/legacy` builds locally with `yarn` on Node 16 |
| 1.2 | Exclude `apps/legacy` from the pnpm workspace (`pnpm-workspace.yaml` `!apps/legacy`) so its Yarn lockfile and old deps never mix with the monorepo | `pnpm install` at root ignores it |
| 1.3 | CI: a separate, `continue-on-error` job builds `apps/legacy` inside `node:16-bullseye` (needed for `node-sass` 4 prebuilt binaries). Marked build-optional; failures do not block merges | Job green once, then advisory |
| 1.4 | Write **characterization tests** against the legacy algorithm before touching it: given a mocked `p5.random` sequence, `MazeGenerator.removeWalls` and `Cell.getRandomNeightborToVisit` produce a known wall matrix. Record 5 seeds of 5x5, 10x8 and 20x20 fixtures as JSON | Fixtures committed under `packages/core/test/fixtures/legacy/` |
| 1.5 | Implement `recursiveBacktracker` in `@maze/core` preserving the legacy neighbour order **N, E, S, W** (`walls[0..3]` = Top, Right, Bottom, Left) and the "pick uniformly at random among unvisited neighbours" rule. With an `Rng` adapter that replays the recorded `p5.random` sequence, output must equal the fixtures byte-for-byte | Characterization tests pass against `@maze/core` |
| 1.6 | Add the property tests from 03 section 3.4 (spanning tree, symmetric walls, determinism) | `pnpm test --filter @maze/core` green, >= 90 % coverage |

### 3.2 Phase 2 - parity in the new app

| Step | Detail | Done when |
|------|--------|-----------|
| 2.1 | Scaffold `apps/web` (Vite, React 19, TanStack Router/Query, Zustand, Tailwind v4, shadcn/ui) from `@maze/config` presets | `pnpm dev` serves a shell with the route skeleton |
| 2.2 | `@maze/renderer/canvas2d` renders `MazeState` + overlays; `@maze/player` drives generation steps | 2D generation animates at user-chosen speed |
| 2.3 | `@maze/renderer/three` reproduces 3D walls, cube projection, mirror, follow-mouse, view rotation, first-person run with peek | Side-by-side visual check against `apps/legacy` |
| 2.4 | Options panel (sliders, colour pickers, toggles) backed by Zustand `uiPrefs` slice with persistence | Every row in the parity table (section 4) is ticked |
| 2.5 | Preference migration from legacy `localStorage` keys (section 6) | Returning users keep their colours and sizes |
| 2.6 | Lighthouse/axe gates from 10-accessibility pass on `/play` and `/build` | CI green |

### 3.3 Switch-over and archive

| Step | Detail |
|------|--------|
| 3.1 | Point Firebase Hosting production channel at `apps/web`. Legacy stays reachable under `/legacy/*` for one minor release |
| 3.2 | After one release with no P1 parity bug, remove the `/legacy` hosting rewrite, mark `apps/legacy` `archived: true` in its README, and drop its CI job. The folder itself is **not deleted** (workspace rule: non-destructive changes only) |
| 3.3 | Record the switch-over in `ADR-019` (status `Accepted`) with the date and the parity checklist snapshot |

## 4. Feature parity checklist

Every user-visible behaviour of `apps/legacy` and what happens to it. Verdicts: **Keep**
(same behaviour, new implementation), **Redesign** (same intent, better UX), **Drop**
(deliberately not carried forward, with reason).

| # | Legacy behaviour | Where it lives today | Target implementation | Verdict |
|---|------------------|----------------------|-----------------------|---------|
| P-01 | Recursive-backtracker generation animated one step per frame | `MazeGenerator.ts` `p.draw` | `generators/recursiveBacktracker` yields `GenStep`s; `StepPlayer` controls speed independent of frame rate | Keep |
| P-02 | 2D top-down view of cells and walls | `Cell.show` `rect`/`line` calls | `@maze/renderer/canvas2d`; dirty-rect redraw | Keep |
| P-03 | 3D mode with extruded walls (`DrawDepthAnimation` boxes) | `Cell.ts`, `DrawDepthAnimation.ts` | `@maze/renderer/three`: instanced `BoxGeometry` per wall, one draw call | Keep |
| P-04 | Cube projection of generator stack depth, rising/falling as the stack grows/shrinks | `Cell.show` (`zTranslate`, `numberOfIncreasesInStack`) | Overlay derived from `GenStep` `carve`/`backtrack` depth; instanced cubes with height = depth | Keep |
| P-05 | "Mirror" option drawing the projection below the plane too | `animateMirror` in `UiPreferencesStore` | Scene toggle mirroring the instanced mesh (negative Z) | Keep |
| P-06 | Max-depth culling of projection (`maxPixelDepthToRenderProjection`) | `MazeOptions.updateDynamicValues` | Renderer option `maxProjectionDepth`, exposed as a slider | Keep |
| P-07 | Inverse colours toggle | `inverseColorMode`, inversion maths duplicated in 3 files | Theme-level `invert` transform applied once in `RenderTheme` | Keep (de-duplicated) |
| P-08 | Cell size slider (min 3, max = width / 9) | `CellSizeSlider.tsx` | shadcn `Slider` bound to `uiPrefs.cellSize`; bounds come from `@maze/core` grid helpers | Keep |
| P-09 | Cell wall size slider | `CellWallSizeSlider.tsx` | Same component, `wallWidth` pref | Keep |
| P-10 | Frame-rate slider | `FrameRateSlider.tsx` | **Redesign** as playback speed (steps per second, 1x-64x) on the Step Player; frame rate is no longer a user concept | Redesign |
| P-11 | Cell / wall / background colour pickers | `react-color` `SketchPicker` wrappers | Accessible colour picker component writing to theme tokens; presets incl. colour-blind-safe palettes | Keep |
| P-12 | Options persisted to `localStorage` | `storageUtils.ts`, `MazeOptionsSetter` | Zustand `persist` middleware with versioned schema (section 6) | Keep |
| P-13 | Regenerate maze on window resize | `window.onresize` in `MazeContainer` | `ResizeObserver` on the canvas host; **Redesign**: resize re-fits the *view*, does not throw away the maze unless the user asks | Redesign |
| P-14 | Wheel zoom in 3D (`zValue`) | `MazeOptions` constructor adds a `wheel` listener (never removed) | Camera controls on the three adapter (OrbitControls-style with limits); listener bound to canvas, cleaned up on unmount | Keep |
| P-15 | Click canvas to toggle "follow mouse" tilt | `p.mouseClicked`, `followMouse` | Camera mode toggle in the view toolbar; pointer-move parallax while enabled | Keep |
| P-16 | "Change View" cycles rotation presets | `MazeViewStore.changeView` (`sin(mazeView % 6 * 30) * PI`) | Named camera presets (top, isometric, low angle, ...) in a `Select`; keyboard `V` cycles | Redesign |
| P-17 | "Run Maze" first-person mode: arrow keys forward/back/turn, `P` to peek over walls | `MazeViewStore` keydown/keyup with `keyCode`, camera at `(0,0,0)` | First-person camera in three adapter; movement is **cell-snapped** (legacy moves 10 px freely and can clip walls); `KeyboardEvent.key`; WASD + arrows; peek retained | Redesign |
| P-18 | "Solve Maze" toggle | `solveMazeMode` flag; `MazeSolver.ts` is a 21-line stub | Real solvers from `@maze/core` in Watch mode (see 02 and 13) | Redesign |
| P-19 | "Save" button | No handler | Save to local library (guest) or account (signed in) as `MazeDocument` (D-18) | Redesign |
| P-20 | Exit texture image on cells in the last row/column | `p.texture(this._img)` when `column+1 === numberOfColumns \|\| row+1 === numberOfRows` | Explicit `start`/`goal` cells in `MazeState`; goal marker is a themed mesh/icon, not a JPEG on every edge cell | Redesign |
| P-21 | Light rig (two point lights, blue directional, mouse-following point light) | `MazeRenderer.draw3dLight` | Equivalent three.js lights as a `LightRig` preset; mouse-following light only when `prefers-reduced-motion` is off | Keep |
| P-22 | Metrics logged to console (frame rate, est. run time, visits/cells ratio, run time) | `MazeGenerator.logMetrics` | Metrics panel in the UI fed by `@maze/core/metrics` and Step Player stats; no console spam | Redesign |
| P-23 | Header nav: LOGIN, NEWMAZE, Change View, Run Maze, Solve Maze, Save, options drawer | `Header.tsx`, `ExpandSidebar.tsx` | App shell with routes `/play /watch /race /build /learn /explore /account`; options in a side panel | Redesign |
| P-24 | Options drawer with placeholder Material lists ("Inbox", "Starred", ...) and "Left"/"Right" buttons | `ExpandSidebar.tsx` | Not carried forward | Drop (template leftovers) |
| P-25 | `/login` renders a component that throws on mount | `AppRoutes.tsx` | Not carried forward | Drop (test artefact) |
| P-26 | Home route renders the text "Home" | `Home.tsx` | Landing page with mode cards | Redesign |
| P-27 | Estimated-run-time logging with `Math.floor(seconds * 100)` bug | `logMetrics` | Correct `mm:ss` formatting in the metrics panel | Fixed by redesign |

Switch-over gate: every **Keep** and **Redesign** row demonstrated in `apps/web`, signed off in
the PR that flips hosting (step 3.1).

### 4.1 Parity status (2026-09-27, first implementation pass)

Verified in the browser against the new `apps/web` on the monorepo foundation (Node 22, pnpm 10,
Vite 8, React 19, three.js 0.186). "Done" means the behaviour works end to end; "Partial" means
it works but needs polish; "Later" means deliberately deferred to a named story.

| Rows | Status | Notes |
|------|--------|-------|
| P-01 generation via Step Player | Done | `recursiveBacktracker` generator + `StepPlayer`; play/pause/step/run-to-end/speed |
| P-02 2D view | Done | `@maze/renderer/canvas2d`; visit-count shading reproduces legacy colours |
| P-03 3D extruded walls | Done | instanced boxes, `wallHeight` option |
| P-04 cube projection | Done | height = abs(current depth - depth at first visit), `GenerationTracker.projectionHeight` |
| P-05 mirror | Done | options sheet toggle, visible below the floor |
| P-06 max-depth culling | Done | auto (0.6 x rows) or manual slider |
| P-07 inverse colours | Done | single `resolve()` in the renderer colour module |
| P-08 / P-09 cell size, wall width | Done | sliders in the options sheet; cell size regenerates with the same seed |
| P-10 frame rate -> playback speed | Done (redesign) | log-scale speed slider, 1 to 100k steps/s |
| P-11 colour pickers | Done | native colour inputs + hex, reset button |
| P-12 persistence + legacy import | Done | Zustand persist v1; legacy keys imported once, wall colour inverted |
| P-13 resize re-fits, no regeneration | Done (redesign) | banner offers "Regenerate to refit" |
| P-14 wheel zoom | Done | both adapters, clamped 0.25 to 8, reported back to app state |
| P-15 follow pointer | Done | toolbar switch and `F`; disabled under reduced motion |
| P-16 view rotation -> presets | Done (redesign) | top / tilt / isometric / low / front, `V` cycles, corner-projection fit |
| P-17 first-person Run Maze | Done (redesign) | cell-snapped moves, WASD/arrows, P peek, Esc, HUD, goal detection |
| P-18 Solve | Done (redesign) | BFS and DFS from the registry, animated overlay + path, metrics |
| P-19 Save | Done (redesign) | local library of `MazeDocument`s with thumbnails, load/delete |
| P-20 exit texture -> start/goal markers | Done | disc + cone/diamond markers, toggle |
| P-21 light rig | Done | `LIGHT_PRESET` in `packages/renderer/src/three/lights.ts`: decay-0 scene lights (ambient 0.35, hemisphere 0.55, key 1.35, below 0.45, blue rim 0.7) plus inverse-square pointer pool and first-person headlamp scaled by cell size |
| P-22 / P-27 metrics panel | Done | live strip incl. dead ends, solution, diameter, `mm:ss` |
| P-23 app shell | Done | header nav, routes, options/library sheets, live region |
| P-24 / P-25 template leftovers, throwing route | Dropped | as planned |
| P-26 landing page | Done | six pillar cards, Play active |

Known follow-ups from this pass: a11y `dom` renderer adapter
(S3.4), Playwright E2E + axe (S4.8), PWA manifest/offline shell (S4.1), bundle split of the
main chunk (currently ~525 kB minified before gzip).

## 5. React 19 / TypeScript 5 adoption notes

Patterns in the legacy code that must not be copied into the new app:

| Legacy pattern | Problem | New pattern |
|----------------|---------|-------------|
| `React.SFC` | Removed from `@types/react` 18+ | Plain function components with explicit prop types |
| `useEffect(() => { ...createMazeSketch(); return clearMaze }, )` with **no dependency array** in `MazeContainer.tsx` | Effect runs after every render, destroying and recreating the whole p5 sketch each time | `useEffect` with `[]` or, better, renderer lifecycle in a custom hook `useRenderer(host, adapter)` with proper cleanup |
| `window.onresize = fn` | Overwrites any other handler; no cleanup; regenerates the maze | `ResizeObserver` on the host element inside the hook; resize only re-fits the view (P-13) |
| `document.addEventListener('keydown', ...)` in a store constructor with `keyCode` | Global listener created at store construction (`//TODO Remove after dev`), never removed, deprecated `keyCode` | Keyboard handling scoped to the focused canvas region; `event.key`; registered/unregistered by the mode component |
| `window.addEventListener('wheel', ...)` in the `MazeOptions` constructor | Leaks one listener per `MazeOptions` instance; uses non-standard `event.wheelDelta` | `deltaY` on the canvas element inside the camera controls; cleanup on unmount |
| MobX `@observable` / `@action` decorators + `inject("store")(observer(C))` | Requires legacy decorator flags; HOCs hide data flow | Zustand slices with selectors: `const cellSize = useUiPrefs(s => s.cellSize)` |
| Module-level singletons (`stores`, `mazeSolver`, `P5_MazeContextInitialValue`) imported by algorithm code | Untestable, order-dependent | Dependency injection: hooks provide stores; core receives `Rng`, params and state as arguments |
| `let mazeSketch: p5` declared inside the component body | Reset on every render; `clearMaze` can reference an undefined sketch | `useRef` for imperative handles |
| `grid.map(cell => cell.show(...))` used for side effects | Allocates a throw-away array every frame | Renderer iterates typed arrays; no per-frame allocation |
| `new Point(...)`, `new DrawDepthAnimation(...)` per cell per frame | GC pressure at 60 fps | Pre-computed geometry, instanced meshes, typed arrays |
| `any` on `column`, `row`, `cam`, `img`, `windowHeight` | Defeats `strict` | Real types from `@maze/core`; `noImplicitAny` + `noUncheckedIndexedAccess` |
| Tests that call `toggleInverseColorMode(!DEFAULT)` on a zero-argument action, and a "dark mode" test asserting on `inverseColorMode` | Type errors hidden because CRA Jest does not type-check; wrong assertion | Vitest runs `tsc --noEmit` in CI; tests assert on the right state |
| `App.test.tsx` renders `<App/>` without providers | Fails (no Apollo/context providers) | RTL `renderWithProviders` helper in `@maze/ui/test-utils` |

TypeScript configuration for the monorepo (`@maze/config/tsconfig.base.json`):

```jsonc
{
  "compilerOptions": {
    "target": "ES2022", "module": "ESNext", "moduleResolution": "Bundler",
    "strict": true, "noUncheckedIndexedAccess": true, "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true, "verbatimModuleSyntax": true, "isolatedModules": true,
    "skipLibCheck": true, "resolveJsonModule": true, "jsx": "react-jsx"
  }
}
```

## 6. Data migration for existing users

The only user data the legacy app holds is in `localStorage`. Returning users should not lose
their customisations.

### 6.1 Legacy keys

| Key | Format | Example |
|-----|--------|---------|
| `backgroundColorKey` | `r:g:b:a` (a may be empty) | `113:173:245:1` |
| `cellColorKey` | `r:g:b:a` | `65:117:5:1` |
| `cellWallColorKey` | `r:g:b:a` | `255:255:255:100` |
| `cellSizeKey` | integer string | `40` |
| `cellWallSizeKey` | integer string | `1` |
| `cellWallStrokeCapStyleKey` | `ROUND` / `SQUARE` / `PROJECT` | `ROUND` |
| `frameRateKey` | integer string | `40` |

Note the alpha channel is inconsistent (`1` vs `100`) and is ignored by the legacy renderer
(`//TODO FIGURE OUT WHY SENDING A TO P5 CAUSES ODD THINGS TO HAPPEN`). We drop alpha.

### 6.2 New preferences schema (zod, in `@maze/contracts/schemas/prefs.ts`)

```ts
export const UiPrefsV1 = z.object({
  v: z.literal(1),
  theme: z.enum(['system', 'light', 'dark', 'high-contrast']),
  palette: z.enum(['default', 'okabe-ito', 'custom']),
  colors: z.object({ background: Hex, cell: Hex, wall: Hex, path: Hex, frontier: Hex }),
  cellSize: z.number().int().min(3).max(200),
  wallWidth: z.number().int().min(1).max(20),
  playbackSpeed: z.number().min(0.25).max(64),
  view: z.object({ mode: z.enum(['2d', '3d']), preset: z.string(), projection: z.boolean(), mirror: z.boolean() }),
  reducedMotion: z.enum(['system', 'on', 'off']),
});
```

### 6.3 One-time migration on first load

```ts
// apps/web/src/prefs/migrateLegacy.ts  (runs once; idempotent)
if (!localStorage.getItem('mazelab:prefs') && localStorage.getItem('cellSizeKey')) {
  const rgb = (k: string) => parseLegacyColor(localStorage.getItem(k)); // "r:g:b[:a]" -> "#rrggbb" | undefined
  const prefs = UiPrefsV1.parse({
    v: 1, theme: 'system', palette: 'custom',
    colors: { background: rgb('backgroundColorKey') ?? DEFAULTS.background, cell: rgb('cellColorKey') ?? DEFAULTS.cell,
              wall: rgb('cellWallColorKey') ?? DEFAULTS.wall, path: DEFAULTS.path, frontier: DEFAULTS.frontier },
    cellSize: clampInt(localStorage.getItem('cellSizeKey'), 3, 200, DEFAULTS.cellSize),
    wallWidth: clampInt(localStorage.getItem('cellWallSizeKey'), 1, 20, DEFAULTS.wallWidth),
    playbackSpeed: 1,            // frameRateKey does not map to a meaningful speed; reset
    view: { mode: '3d', preset: 'isometric', projection: true, mirror: false },
    reducedMotion: 'system',
  });
  localStorage.setItem('mazelab:prefs', JSON.stringify(prefs));
  // legacy keys are left in place (harmless) so a rollback to /legacy still works during the overlap window
}
```

Rules: parse defensively (every legacy value is untrusted text), never throw on bad input,
record `prefs_migrated` once in analytics, and keep the migration module for two minor
releases after switch-over, then remove it behind a Changeset.

Signed-in users later get server-side preferences (`users/preferences` in `apps/api`); the
local schema is the same zod object, so the sync is a merge by `updatedAt`.

## 7. Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Visual regressions in 3D mode that only the author can judge | Medium | Medium | Side-by-side recording of `apps/legacy` vs `apps/web` for each P-03..P-06, P-14..P-17, P-21; Playwright screenshot baselines once accepted |
| `apps/legacy` stops building even in Docker (npm registry removals, `node-sass` binaries) | Medium | Low | Job is advisory; the recorded characterization fixtures, not the running legacy app, are the source of truth for algorithm behaviour |
| Characterization tests cannot reproduce legacy output because `p5.random` is not seedable in the legacy code | Low | Medium | Mock `p.random`/`p.floor` in the legacy test harness; fixtures are generated once from the mocked run |
| Scope creep: redesigning P-10/P-13/P-16/P-17 turns parity into product work | High | Medium | Parity PRs implement the "Redesign" target *minimally*; UX polish is separate backlog items in 15-backlog |
| Users lose preferences | Low | Low | Migration in section 6 with unit tests on real exported legacy values |
| three.js bundle size blows the 250 kB budget | Medium | Medium | `three` chunk lazy-loaded on first 3D toggle; 2D is the default route experience |
| Tailwind v4 / shadcn churn during the project | Low | Low | Pin versions via Syncpack; Renovate opens upgrade PRs with Storybook visual diffs |
| Team unfamiliarity with TanStack Router | Medium | Low | Route skeleton and one full route (`/play`) done first as the reference implementation |

## 8. Estimated effort per workstream

Ideal engineering weeks, one developer with coding agents. These roll up into Phases 1-2 of
[14-roadmap.md](./14-roadmap.md).

| Workstream | Estimate (weeks) | Depends on |
|------------|------------------|------------|
| M-1 Freeze legacy (`apps/legacy`, workspace exclusion, advisory CI job) | 0.5 | - |
| M-2 Characterization fixtures + `@maze/core` recursive backtracker + property tests | 1.0 | M-1 |
| M-3 Monorepo scaffold (`@maze/config`, Turborepo, Changesets, Syncpack, ESLint boundaries) | 0.5 | - |
| M-4 `apps/web` shell: Vite, React 19, TanStack Router/Query, Zustand, Tailwind v4, shadcn/ui, PWA plugin | 1.0 | M-3 |
| M-5 `@maze/renderer/canvas2d` + `@maze/player` Step Player + `/play` route at 2D parity | 1.5 | M-2, M-4 |
| M-6 `@maze/renderer/three`: walls, projection, mirror, culling, light rig, camera presets, follow-mouse, first-person run + peek | 2.0 | M-5 |
| M-7 Options panel, colour pickers, sliders, persistence, legacy prefs migration | 1.0 | M-4 |
| M-8 Parity verification (side-by-side recordings, Playwright baselines, axe/Lighthouse gates), switch-over PR, ADR-019 acceptance | 0.5 | M-5..M-7 |
| **Total** | **8.0** | |

Contingency of 20 % is applied at roadmap level, not per workstream.
