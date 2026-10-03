# Maze Lab

An interactive maze playground and computer-science learning tool: generate mazes step by
step, watch and compare solving algorithms, race them, build and save your own, and explore the
graph theory underneath. Web first, packaged for desktop and mobile from one codebase.

This repository started in 2019 as a Create React App + p5.js port of Daniel Shiffman's
"Maze Generator" coding challenge. That app is preserved unchanged under `apps/legacy`; the
rebuild that replaces it lives in `packages/*` and `apps/web`. The full plan, architecture and
decision records are in [`proj-mgmt/`](./proj-mgmt/README.md).

---

## Repository layout

```
apps/
  web/        Vite + React 19 app (the product UI; also used by the Tauri shells later)
  legacy/     Frozen 2019-2020 CRA + p5 app, read-only reference (own yarn.lock, not in the workspace)
packages/
  core/       @maze/core     pure TS engine: grid, seeded RNG, generators/solvers as step generators,
                             trackers, metrics, MazeDocument v1, navigation. Zero runtime deps.
  player/     @maze/player   StepPlayer (play/pause/step/speed, frame-rate independent) + React hook
  renderer/   @maze/renderer Renderer port + adapters: canvas2d (2D) and three (3D / first-person)
  ui/         @maze/ui       Design system: Radix primitives + Tailwind v4 tokens
  config/     @maze/config   Shared tsconfig presets
proj-mgmt/    Plan: assessment, vision, architecture, ADRs, roadmap, backlog
.github/      CI (typecheck, test, build)
```

Dependency rule: `core <- player, renderer, ui <- apps/web`. Nothing in `packages/` imports from
`apps/`, and `@maze/core` imports nothing at runtime.

## Getting started

Requirements: Node 22 (see `.node-version`), pnpm 10 (`corepack enable` or `npm i -g pnpm`).

```bash
pnpm install
pnpm dev          # web app on http://localhost:5173
pnpm test         # all package tests (Vitest; core uses fast-check property tests)
pnpm typecheck    # TypeScript strict across the workspace
pnpm build        # production build of apps/web into apps/web/dist
```

Per package: `pnpm --filter @maze/core test`, `pnpm --filter @maze/web dev`, and so on.

### Try it on a phone

```bash
pnpm --filter @maze/web dev -- --host    # prints a Network URL such as http://192.168.x.y:5173
```

Open that URL on a phone on the same Wi-Fi. The layout collapses to a one-row toolbar with a
"More controls" sheet, the metrics strip scrolls sideways, pinch zooms the maze, and first-person
mode shows an on-screen D-pad. `pnpm --filter @maze/web build && pnpm --filter @maze/web preview`
serves the production build (installable as a PWA) on port 4173.

## What works today

- **Play**: generate with any of 12 algorithms, watch it in 2D or 3D (extruded walls, the
  stack-depth cube projection and mirror), orbit/tilt/zoom the view, run it in first person
  (keyboard or touch D-pad, peek), solve it with any of 12 solvers, save and load mazes locally.
- **Timeline**: play, pause, step, step back, restart and scrub through generation and solving.
- **Watch**: a solver step by step with pseudo-code highlighting, a step log, statistics and a legend.
- **Explore**: the algorithm catalogue and Compare mode (2-4 generators on one seed in lockstep).
- Responsive on phone, tablet and desktop; installable PWA; screen-reader maze grid and narration.

What comes next is in [`proj-mgmt/17-work-queue.md`](./proj-mgmt/17-work-queue.md); agents follow
[`AGENTS.md`](./AGENTS.md). The longer roadmap is [`proj-mgmt/14-roadmap.md`](./proj-mgmt/14-roadmap.md).

## Adding an algorithm

1. Add one file under `packages/core/src/generators/` (or `solvers/`) exporting an object with
   `meta` and a `*run()` generator function that yields `GenStep`s (or `SolveStep`s).
2. Register it in the folder's `index.ts`.
3. Run `pnpm --filter @maze/core test`: the shared property-based suite checks every registry
   entry (spanning tree, wall symmetry, determinism, path validity), and the UI menus pick it up
   automatically.

## Conventions

- Wall/direction order is **N, E, S, W** (the legacy Top, Right, Bottom, Left).
- Every maze is reproducible from `(algorithm, seed, params, size)`; seeds are normalised strings.
- Decisions are recorded as ADRs in `proj-mgmt/adr/`; change the decision register before the code.

## Legacy app

See [`apps/legacy/README.md`](./apps/legacy/README.md). The API key found in its `src/.env` is
scheduled for rotation and must not be reused ([security plan](./proj-mgmt/07-security.md)).

## License

Private project; no license granted yet. A license decision is part of the launch checklist.
