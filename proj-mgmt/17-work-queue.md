# 17 - Work Queue

> Status: Live | Last updated: 2026-10-03 | Owner: Dmitri Larionov
> The ordered list of what to build next. "Proceed to the next work item" means: take the item
> marked **NEXT**, follow `AGENTS.md` section 2, and update this file when it is done.
> Status values: `NEXT`, `TODO`, `BLOCKED (H-x)`, `DONE yyyy-mm-dd (commit)`.

## Where we are (2026-10-03, `develop` == `main` == 551e277, not pushed)

Shipped: monorepo foundation and legacy parity; 12 generators + braid; 12 solvers; race scheduler
in core (no UI yet); Watch (pseudo-code, step log, stats); Explore catalogue + Compare; a11y grid
and narrator; PWA + chunking; 3D view controls (orbit/tilt/zoom/reset); timeline (play, pause,
step back, restart, scrub) for generation and solving; responsive workspace (phone column,
tablet grid, desktop/wide columns). Gate: core 280, player 21, renderer 34, web 53 tests; lint 0
errors (339 warnings); e2e 16/16.

## Queue

### WI-01 Race page: two to four solvers compete on one maze - **NEXT**

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

### WI-02 Run Maze as a game: timer, moves, undo, hint, recorded solves - TODO

The owner especially enjoys the first-person walkthrough. Make it a complete experience.

- Scope: timer and move counter in the HUD; move history with undo/rewind of the player's own
  moves (reuse the timeline pattern); optional hint (reveal the next N cells of the shortest
  path); finish summary (time, moves, optimal moves, efficiency); save the solve (move list) with
  the maze in the library; 2D top-down self-solve with arrow/WASD/swipe as an alternative.
- Acceptance: unit tests for move history and replay; touch D-pad and keyboard both work; the
  finish summary is announced; phone check of the HUD layout.
- Branch: `feat/run-maze-game`. Blocked by: nothing.

### WI-03 Build mode editor - TODO

`packages/core/src/editing.ts` provides pure edit ops, validation and undo/redo; no UI yet.

- Scope: `/build`; start from a generated or library maze; tap/click a wall to toggle, set start
  and goal, resize, braid; undo/redo; validation issues listed and focusable; save/fork to the
  library; export PNG/SVG/JSON and import JSON; keyboard cell cursor for wall edits.
- Acceptance: edits keep wall symmetry (tests); validation shown; saved maze reloads identically;
  works on touch (tap targets) and keyboard.
- Branch: `feat/build-editor`. Blocked by: nothing.

### WI-04 Algorithm parameters and complete Watch content - TODO

- Scope: forms generated from `ParamDescriptor` for generators and solvers (Play options, Watch,
  Compare, Race); pseudo-code listings for all 12 solvers (only BFS/DFS today); solver-relative
  metrics (`solverRelativeMetrics`) in Watch statistics; Dijkstra weights painter (stretch).
- Acceptance: adding a param to an algorithm's meta shows a control with no UI change (test);
  every solver has a listing whose `stepToLine` covers every step type (exhaustive test).
- Branch: `feat/algorithm-params`. Blocked by: nothing.

### WI-05 Quality debt sweep - TODO

- Scope: promote lint rules from warn to error one by one (339 warnings; biggest:
  restrict-template-expressions, no-confusing-void-expression, unbound-method); act on knip
  findings (unused deps/exports); fix the landing "coming soon" card contrast (axe serious,
  excluded via `KNOWN_ISSUES` in `apps/web/e2e/a11y.spec.ts`); "Regenerate same seed" should
  reuse the stored grid size; add an e2e journey at a phone viewport.
- Acceptance: lint warnings < 50 with no new suppressions; knip clean or annotated; axe exclusion
  removed.
- Branch: `chore/quality-debt`. Blocked by: nothing.

### WI-06 Learn mode MVP (roadmap Phase 5) - TODO

Lesson framework (MDX, embedded StepPlayer demos, quizzes, progress) and modules M1-M5, M7 per
`proj-mgmt/13-education-and-playground.md`. Plan it into smaller items when it becomes NEXT.

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
