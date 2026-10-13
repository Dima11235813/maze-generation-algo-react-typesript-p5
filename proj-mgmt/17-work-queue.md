# 17 - Work Queue

> Status: Live | Last updated: 2026-10-12 | Owner: Dmitri Larionov
> The ordered list of what to build next. "Proceed to the next work item" means: take the item
> marked **NEXT**, follow `AGENTS.md` section 2, and update this file when it is done.
> Status values: `NEXT`, `TODO`, `BLOCKED (H-x)`, `DONE yyyy-mm-dd (commit)`.

## Where we are (2026-10-12, `develop` at 1c7f087 and pushed; `main` is promoted by the owner)

Shipped: monorepo foundation and legacy parity; 12 generators + braid; 12 solvers; race scheduler
in core (no UI yet); Watch (pseudo-code, step log, stats); Explore catalogue + Compare; a11y grid
and narrator; PWA + chunking; 3D view controls (orbit/tilt/zoom/reset); timeline (play, pause,
step back, restart, scrub) for generation and solving; responsive workspace (phone column,
tablet grid, desktop/wide columns); Race page (2-4 solvers, lockstep transport, standings,
ranking, deep link); Tree view (maze as its spanning tree: upright, radial, 3D; growth, morph,
outline, Compare); maze tools widget (BUG-01); Ride along (watch a solver in first person).
Run Maze as a game (WI-02); Build editor (WI-03); algorithm parameter forms, pseudo-code for all
solvers and solver-relative stats (WI-04); quality debt paid (WI-05: every lint rule an error,
knip and prettier clean, lazy-loaded pages, the Build editor source finally tracked in git);
Learn opened (WI-06a: curriculum, lesson page, BFS queue view, pilot lesson M3.1); data-structure
views for every frontier solver, also on Watch (WI-06b).
Gate: core 305, player 21, renderer 39, web 205 tests; lint 0 problems; e2e 29/29; initial JS
158/250 kB gzip.

## Queue

### WI-01 Race page: two to four solvers compete on one maze - DONE 2026-10-03 (17c7471)

The original brief's "see two AIs compete" pillar. `runRace` (`packages/core/src/agents/race.ts`)
already runs agents in lockstep and ranks them; there is no UI.

- Scope: `/race` route; pick 2-4 solvers (registry-driven) and a scoring mode
  (`first-to-goal`, `fewest-expanded`, `composite`); one seeded maze (seed in the URL, generator
  from prefs); lanes side by side showing each agent's overlay on the same maze; a shared
  transport driven by a `StepPlayer` over the `runRace` tick generator (so play, pause, step
  back, restart and the scrubber work for free); live standings (expanded, path length,
  finished/disqualified) and a final ranking table with the winner announced in the live region;
  deep link `/race?seed=&agents=bfs,astar&scoring=`; landing and nav cards switch Race to live.
- Layout: reuse `Workspace`/`Section`; lanes 1 column on phones, 2 on tablets, up to 4 on wide.
- Acceptance: deterministic result for a given URL (unit test); RTL test mounts N fake renderers
  and shows a ranking after run-to-end; one Playwright journey (pick two solvers, run to end,
  winner announced); phone/tablet/desktop check; a11y names on lanes and standings.
- Branch: `feat/race-page`. Blocked by: nothing.
- Delivered: `/race?seed=&agents=&scoring=&size=&gen=` (size and generator are in the URL too, so
  the URL alone fixes the race on every device); `RaceRun` (`apps/web/src/maze/race.ts`) wraps
  `runRace` in a `StepPlayer` and folds ticks into one `SolveTracker` per lane; lanes pick their
  column count by measuring the stage (2 stack on phones, 4 make a 2 x 2 grid); winning lane gets
  a trophy and "(winner)" in its name; axe check and e2e journey added.

### BUG-01 Maze tools widget: the floating view controls cover part of the maze - DONE 2026-10-05 (43309d6)

Reported by the owner 2026-10-03 (phone screenshot): the "View controls" panel (rotate, tilt,
zoom, reset) floats over the bottom-right of the maze canvas on Play and Watch, so part of the
maze is always hidden, worst on phones where the panel is large relative to the canvas.

- Scope: replace `ViewControls` with a **maze tools widget** shared by Play and Watch (and Race
  where it applies).
  - Phone and tablet (touch layouts): render the widget as an in-flow **row below the maze**
    (above the timeline), never over the canvas, so the full maze panel is always visible. The
    row scrolls horizontally inside itself if it does not fit; no page-level overflow.
  - Desktop/wide: a **draggable floating widget** over the canvas. Drag by a grip handle (mouse,
    pen, touch); the grip also moves it with the arrow keys; the position is clamped to the
    stage, persisted in prefs, and "Reset position" (or double-click on the grip) docks it back
    to the corner. A collapse button shrinks it to the grip so it can be tucked away.
  - Actions in the widget, not only camera moves: **Play/Pause**, **Step back**, **Step**,
    **Run to end**, **Solve / Clear solve** (current solver), plus the existing zoom in/out,
    reset view and 3D rotate/tilt.
  - Proposed quick actions (owner to confirm or trim): New maze (N), 2D/3D toggle (T),
    first-person walk (R, Play only), cycle camera preset (V, 3D), fullscreen the maze panel,
    save a PNG snapshot of the canvas.
  - Every action has a **tooltip** with its name and keyboard shortcut, an accessible name, and
    disabled states that match the toolbar (e.g. Solve disabled while generating).
- Acceptance: RTL tests for the widget (actions call the session; tooltips/labels present;
  keyboard move of the grip; touch layout renders the row variant, not an overlay); a
  Playwright check that on a 390px viewport the widget's box does not intersect the canvas box;
  phone/tablet/desktop check; the 3D walkthrough HUD is unaffected.
- Branch: `fix/maze-tools-widget`. Blocked by: nothing.
- Delivered: `routes/tools/MazeTools.tsx` (row on phones/tablets, floating draggable panel on
  desktop: grip drag, arrow-key nudge, Home/double-click dock, collapse, persisted position) with
  playback, solve/clear, new maze, first person, 2D/3D, camera (rotate/tilt/zoom/reset/next
  angle), PNG snapshot and full screen; tooltips with shortcuts on every action. Placement maths in
  `maze/toolsPosition.ts` (property-tested). The Tree view's morph slider stays in its own row.

### WI-10 Ride along: watch a solver in first person - DONE 2026-10-05 (f92e323)

Owner idea 2026-10-04: watch the solver from the perspective of running the maze. The first-person
camera (Run Maze) follows the solver instead of the player.

- Scope: a "Ride along" toggle on Watch (and on Play while a solve runs) that puts the 3D view in
  first person on the solver's current cell.
  - Walking solvers (wall follower, Tremaux, Pledge, random mouse, flood-fill descent) already
    yield `move` steps with a heading: the camera follows them exactly, turns included.
  - Search solvers (BFS, DFS, A*, Dijkstra, greedy, bidirectional BFS, dead-end filling) jump
    between expanded cells: when the next cell is not adjacent the camera rises to peek height
    and glides there (looking towards it), so it never passes through walls at eye level; the
    frontier and visited marks glow on the floor as in the 3D view.
  - When the solver finishes, the camera walks the found path from start to goal at eye level.
  - Works with play, pause, step, step back and the scrubber (the pose is derived from the solve
    tracker, so rewinding is exact); speed slider applies; reduced motion jumps instead of easing.
  - Controls in the maze tools widget (BUG-01): a Ride along toggle; status (solver name, step,
    "walking" / "searching" / "replaying the path") in the live region and a short line below the
    canvas; R toggles on Watch; the pose is announced on request.
- Acceptance: unit tests for the pose derivation (walking solvers follow `move` headings; search
  solvers mark non-adjacent jumps as glides; rewind gives the same pose); RTL test that the
  toggle switches to the 3D renderer with a first-person state following the solver; e2e journey
  (Watch, ride along with the wall follower, step, step back); phone check.
- Branch: `feat/ride-along`. Blocked by: nothing.
- Delivered: core `RideAlongTracker` / `pathPoses` (property tests: walking solvers follow open
  passages and their headings, search solvers glide exactly on non-adjacent jumps, rewind exact);
  `MazeSession.ridePose`; `useRideAlong` (live pose, then the walk along the solution; reduced
  motion jumps to the goal); toggle in the maze tools on Watch (R, Esc stops) and on Play once a
  solve runs; status line below the canvas and phase announcements; camera buttons hidden while
  riding. Tests: 5 core, 3 RTL, 1 e2e.

### WI-02 Run Maze as a game: timer, moves, undo, hint, recorded solves - DONE 2026-10-09 (54d8a6e)

The owner especially enjoys the first-person walkthrough. Make it a complete experience.

- Scope: timer and move counter in the HUD; move history with undo/rewind of the player's own
  moves (reuse the timeline pattern); optional hint (reveal the next N cells of the shortest
  path); finish summary (time, moves, optimal moves, efficiency); save the solve (move list) with
  the maze in the library; 2D top-down self-solve with arrow/WASD/swipe as an alternative.
- Acceptance: unit tests for move history and replay; touch D-pad and keyboard both work; the
  finish summary is announced; phone check of the HUD layout.
- Branch: `feat/run-maze-game`. Blocked by: nothing.
- Delivered: core run model (`run.ts`: moves F/B/L/R and N/E/S/W, undo/redo/seek by exact replay,
  hints, summary, `encodeRun`/`decodeRun`; 6 property tests); session game state (timer from the
  first step, summary announced assertively, hints drawn as a path, replay of saved runs); run bar
  below the maze (time, moves vs shortest, undo U / redo Shift+U, a "your moves" scrubber, hint H,
  restart, exit, finish summary with Save run and Play again); 2D top-down walk (K; arrows, WASD,
  swipes, touch D-pad); library keeps runs per maze with the best run and "Replay best run".
  Thumbnails time out after 1.5 s so saves never hang. Tests: 6 core, 5 session, 3 RTL, 1 e2e.

### WI-03 Build mode editor - DONE 2026-10-09 (6a67739)

`packages/core/src/editing.ts` provides pure edit ops, validation and undo/redo; no UI yet.

- Scope: `/build`; start from a generated or library maze; tap/click a wall to toggle, set start
  and goal, resize, braid; undo/redo; validation issues listed and focusable; save/fork to the
  library; export PNG/SVG/JSON and import JSON; keyboard cell cursor for wall edits.
- Acceptance: edits keep wall symmetry (tests); validation shown; saved maze reloads identically;
  works on touch (tap targets) and keyboard.
- Branch: `feat/build-editor`. Blocked by: nothing.
- Delivered: `/build?item=` with Walls/Start/Goal tap tools (the 2D renderer reports where in a
  cell a click landed; core `nearestWall` picks the wall), keyboard cursor (arrows, Shift+arrow
  toggles a wall, S/G, Enter, U/Shift+U), resize, braid and close/open all as single undo steps
  (core `snapshotEdit`), validation list that moves the cursor to the problem, show-solution
  overlay, Save (over the library item, `replace`) and Save as a copy, PNG/SVG (core `mazeToSvg`)/
  JSON export, JSON import with errors explained. Tests: 5 core (incl. a symmetry property over
  random edits), 5 model, 6 RTL, 2 e2e (a real tap near a wall, axe). Also fixed touch styling that
  squashed toolbar switches into circles.

### WI-04 Algorithm parameters and complete Watch content - DONE 2026-10-10 (8d2d10c)

- Scope: forms generated from `ParamDescriptor` for generators and solvers (Play options, Watch,
  Compare, Race); pseudo-code listings for all 12 solvers (only BFS/DFS today); solver-relative
  metrics (`solverRelativeMetrics`) in Watch statistics; Dijkstra weights painter (stretch).
- Acceptance: adding a param to an algorithm's meta shows a control with no UI change (test);
  every solver has a listing whose `stepToLine` covers every step type (exhaustive test).
- Branch: `feat/algorithm-params`. Blocked by: nothing.
- Delivered: `ParamFields`/`AlgorithmParams` (`apps/web/src/routes/params/`) render controls from
  descriptors (slider for short ranges, number input for long ones, switch, select; descriptions
  under each) with values in `prefs.algoParams` (raw, clamped by `sanitizeParams` on read). Forms
  on Play (options sheet, "Algorithms"), Watch (above the solver list; an edit re-arms the solve),
  Compare (per selected generator; edits regenerate the lanes on the same seed) and Race (per
  racer and the generator; edits restart the race). Parameters reach `MazeSession.generate`
  (recorded in provenance, reused by "Regenerate") and `startSolve`; status lines name changed
  values ("A* Search (Heuristic weight 5)"). Pseudo-code for all 12 solvers with a `Record` over
  every step verb (compile-time exhaustive) plus a test that runs each solver and checks every
  emitted step lands on a line. Watch statistics add "Explored" (share of cells) and "Vs
  shortest" (path / shortest), and "Optimal" now measures the path ("yes (not guaranteed)" for
  weighted A* in a perfect maze). New e2e journey `e2e/params.spec.ts` (27 total).
- Not done: the Dijkstra weights painter (stretch) and parameters in the Race URL (a shared link
  uses the recipient's own parameters); both are noted for later.

### WI-09 Tree view: "treeify" the maze in 2D and 3D - DONE 2026-10-03 (3183337)

Owner idea 2026-10-03. A perfect maze is a spanning tree; "pulled and stretched out in the proper
way" it looks like a tree (Wikipedia, Maze generation algorithm). Design:
[19-tree-view.md](./19-tree-view.md).

- Scope: core `spanningTree` + `TreeTracker` + tidy/radial/3D layouts; a "Tree" view mode
  (beside 2D/3D) with a grid<->tree morph slider; the tree growing live during generation (with
  rewind); a 3D botanical tree; solver overlays on the tree (Watch); tree metrics in
  Explore/Compare; dashed loop edges for braided mazes; an ARIA tree outline.
- Delivery: five slices (design doc section 6), each merged and phone-checked on its own.
  Start with slice 1 (core, no UI); plan the rest into items when it becomes NEXT.
- Acceptance (slice 1): property tests: n-1 tree edges for perfect mazes, leaves = dead ends,
  goal depth = solution length, layouts overlap-free and deterministic.
- Branch: `feat/tree-core` (then `feat/tree-view-2d`, ...). Blocked by: nothing; slice 2 wants
  BUG-01's maze tools widget for the morph slider.
- Delivered (owner asked to build it straight after roadmapping, ahead of BUG-01): all five
  slices. Core `treeify`/`tidyLayout`/`radialLayout`/`layout3d`/`treeMetrics` with property tests;
  `TreeScene` (shared tween/re-root state) with 2D drawing (upright fir layout, radial with ring
  arcs) and a 3D botanical tree (instanced branches thickening towards the root, golden-angle
  branches, morph-aware camera fit); 2D/3D/Tree toggle (Y) on Play and Watch; tree controls row
  below the canvas (layout, maze-to-tree morph, replay pull); ARIA tree outline of corridors and
  forks highlighted on the canvas; live growth during generation (forest rooted at the oldest
  cells, re-rooted at the start when done); Compare lanes as trees and tree-shape columns.
  The morph slider lives in the tree row for now; BUG-01's widget can absorb it.

### WI-05 Quality debt sweep - DONE 2026-10-11 (a89409b)

- Scope: promote lint rules from warn to error one by one (313 warnings at 91705db; biggest:
  restrict-template-expressions, no-confusing-void-expression, unbound-method); act on knip
  findings (unused deps/exports); fix the landing "coming soon" card contrast (axe serious,
  excluded via `KNOWN_ISSUES` in `apps/web/e2e/a11y.spec.ts`); "Regenerate same seed" should
  reuse the stored grid size; add an e2e journey at a phone viewport.
- Also: the initial JS bundle is at 234 of 250 kB gzip after WI-04 (pages are not lazy-loaded):
  split the routes (`lazyRouteComponent`) so new pages do not push it over the gate.
- Also (review of WI-04): Play's Regenerate with an empty seed box calls `session.regenerate()`,
  which replays the old maze's parameters (provenance), while a typed seed uses the current
  ones. The box is normally filled with the current seed, so this is an edge; make both paths
  agree (current parameters, matching "changes apply to the next maze").
- Acceptance: lint warnings < 50 with no new suppressions; knip clean or annotated; axe exclusion
  removed.
- Branch: `chore/quality-debt`. Blocked by: nothing.
- Delivered: lint 313 warnings -> 0, and every rule is now an `error` (only the advisory
  `import-x/no-unresolved` stays `warn`) with no new inline disables: numbers allowed in
  template literals (typescript-eslint's own default), callback props and store actions typed as
  function properties, non-component exports moved out of component files, runtime guards on
  untrusted input widened explicitly. knip clean: unused deps dropped (web clsx/three, three
  Radix packages, root vitest), jsdom listed in renderer, private symbols unexported, stale stubs
  removed, tailwindcss and vite/client annotated. Landing cards: dashed outline instead of
  `opacity-80`; the axe exclusion is gone. Regenerate (Play and Watch) keeps the grid size and
  uses the current generator and parameters (RTL test drives a resize). Feature pages are
  lazy-loaded: initial JS 233.7 -> 157.4 kB gzip. New `e2e/phone.spec.ts` (touch, 390px:
  landing -> Play solve -> Watch -> Race, no overflow). `prettier --check .` is clean with a
  `.prettierignore` for legacy, planning docs and the lockfile.
- Found on the way (fixed first as `fix/track-build-route`, adc9a05): the root `.gitignore`'s bare
  `build/` matched `apps/web/src/routes/build`, so the WI-03 Build editor source (page, panels,
  toolbar, tests) had never been committed; ESLint's `**/build/**` and prettier skipped it too.
  Both patterns are anchored to output folders now (L-37).

### WI-06 Learn mode MVP (roadmap Phase 5) - IN PROGRESS (planned 2026-10-11)

Lesson framework, embedded StepPlayer demos, data-structure views, quizzes, progress and modules
M1-M5, M7 per `proj-mgmt/13-education-and-playground.md`. Planned into six slices with design
note [20-learn-mode.md](./20-learn-mode.md) (decision D-20: lessons are typed TSX modules, not
MDX). Each slice is merged and phone-checked on its own.

### WI-06a Learn: lesson shell and pilot lesson - DONE 2026-10-11 (34bb6d0)

- Scope: content model and curriculum registry (all twelve modules; unwritten ones "planned");
  `/learn` index with local progress; `/learn/$lessonId` lesson page with concept, live demo
  (transport below the maze), pseudo-code, data-structure view and complexity regions; BFS queue
  view rebuilt from steps; landing "Learn" card goes live. Pilot lesson: M3.1 "The frontier is a
  ring" (BFS).
- Acceptance: index and navigation derive from the registry (a test adds a fake module); the
  queue model is FIFO-exact against BFS on real mazes; progress survives a reload; phone,
  tablet and desktop checked; e2e journey for the lesson.
- Branch: `feat/learn-shell`. Blocked by: nothing.
- Delivered: `content/learn/` (types, `curriculum.ts` with all twelve modules, lesson bodies
  lazy-loaded), `/learn` index (modules, objectives, lessons, "N of M done", start/continue
  link) and `/learn/$lessonId` (breadcrumb, Mark as done, concept, live 2D demo with the tools
  row + speed + timeline below the maze, queue view, pseudo-code, try-this prompts, complexity,
  previous/next). `learn/queueModel.ts` rebuilds the BFS queue from steps only; tests prove every
  `expand` takes the front on four generators and that the queue never holds more than two
  neighbouring distances (the lesson's claim). `state/learnProgress.ts` persists
  `maze-lab:learn` with sanitised loading. Pilot lesson M3.1 "The frontier is a ring". Landing
  Learn card live; the Learn stub page removed. RTL: 7 tests; e2e `learn.spec.ts`.
- Not done (later slices): quizzes and try-it checks (WI-06c), other structures (WI-06b).

### WI-06b Learn: data-structure views - DONE 2026-10-12 (1c7f087)

Stack (DFS, backtracker), priority queue with g/h/f (Dijkstra, A*, greedy), disjoint-set forest
(Kruskal), distance map; also a "Data structure" section on Watch. Each model checked against
its algorithm on real mazes. Design: [20-learn-mode.md](./20-learn-mode.md) section 3.

- Delivered: `learn/stackModel.ts` (DFS stack; recursive backtracker path stack),
  `priorityQueueModel.ts` (one entry per open cell with its best key: Dijkstra g, A* f = g + h,
  greedy h; relaxations lower the key), `disjointSetModel.ts` (Kruskal components),
  `distanceModel.ts`; `solveStructure.ts` + `useSolveStructure.ts` choose and fold the solver's
  structure (flood fill floods from the goal). Views (`routes/learn/*View.tsx`) are DOM lists with
  the next cell marked and keys printed, plus a distance grid for small mazes. Watch has a new
  data-structure section; lesson demos use the same views. Core: greedy best-first `discover`
  now carries its priority as `f`. Tests: every model checked against its algorithm on real and
  braided mazes (stack LIFO, smallest key expanded, unions only across components, rings).
- Not done: generator demos in lessons (the backtracker stack and Kruskal views are ready for
  WI-06d/e); a heap-tree drawing (the sorted list carries the same facts).

### WI-06c Learn: breakpoints, quizzes, try-it checks - NEXT

`StepPlayer.runUntil(predicate)` with a breakpoint picker; data-driven `<Quiz>` and `<TryIt>`;
a passed quiz completes the lesson. Keyboard-operable, results announced.

### WI-06d Learn: modules M1-M3 - TODO

Grids & graphs (Build-style demo), DFS & the backtracker (stack view, breakpoint on backtrack),
BFS & shortest paths completed (rings, DFS vs BFS). Playwright smoke per lesson demo.

### WI-06e Learn: modules M4, M5, M7 - TODO

Prim/Kruskal with disjoint sets; Aldous-Broder & Wilson with a dead-end histogram; A* and
heuristics with Compare and the weight slider.

### WI-06f Learn: stub modules and "Learn more" links - TODO

M6, M8-M11 short lessons with demos; "Learn more" links from Watch, Race and Explore via
`docsSlug`; a test that every `docsSlug` resolves.

### WI-07 Backend, accounts, cloud saves (roadmap Phase 4) - BLOCKED (H-5, H-6, H-7, H-8)

NestJS API, Prisma/Postgres, Identity Platform sign-in, sharing and leaderboards per
`proj-mgmt/04`-`06`. Needs the owner's cloud setup first.

### WI-08 Desktop and mobile shells (roadmap Phase 6) - BLOCKED (H-9, H-10)

Tauri 2 builds; starts with the 2-day WKWebView WebGL spike (ADR-012).

## Done

| Item | Date | Merge |
|------|------|-------|
| Foundation + legacy parity (Phases 1-2) | 2026-09-27 | 1927972 |
| Generators, solvers, race core, metrics, editing ops | 2026-10-01 | 86d31f0, 8c5dd11, 0fdf04f |
| A11y grid + narrator, Watch, Explore/Compare, PWA/perf, tooling, mobile pass | 2026-10-02 | 48b222e .. 9a8d1cf |
| 3D view controls + Compare phone fix | 2026-10-02 | dc450bf |
| Timeline: play, pause, step back, restart, scrub | 2026-10-02 | eaf0104 |
| Responsive workspace (phone/tablet/desktop/wide) | 2026-10-03 | 551e277 |
| WI-01 Race page | 2026-10-03 | 17c7471 |
| WI-09 Tree view (all five slices) | 2026-10-03 | 26c4c69, 3183337 |
| WI-03 Build editor | 2026-10-09 | 6a67739 |
| WI-02 Run Maze as a game | 2026-10-09 | 54d8a6e |
| WI-10 Ride along | 2026-10-05 | f92e323 |
| BUG-01 Maze tools widget | 2026-10-05 | 43309d6 |
| WI-04 Algorithm parameters, pseudo-code, solver stats | 2026-10-10 | 8d2d10c |
| Build editor source tracked (`.gitignore` fix) | 2026-10-11 | adc9a05 |
| WI-05 Quality debt sweep | 2026-10-11 | a89409b |
| WI-06b Learn data-structure views | 2026-10-12 | 1c7f087 |
| WI-06a Learn shell + pilot lesson | 2026-10-11 | 34bb6d0 |
