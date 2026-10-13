# 20 - Learn Mode MVP: delivery plan

> Status: In progress (WI-06a-b done, WI-06c next) | Last updated: 2026-10-11 | Owner: Dmitri Larionov
> Queue items: WI-06a..WI-06f in [17-work-queue.md](./17-work-queue.md)
> Design source: [13-education-and-playground.md](./13-education-and-playground.md) sections 4,
> 7, 11, 12 and 14 (Phase 5 MVP scope). This note slices that scope into merged, phone-checked
> items and records the decisions the slices need.

## 1. What exists already

| Piece the MVP needs (13 section 14) | State on 2026-10-11 |
|-------------------------------------|---------------------|
| Step Player: play/pause/step/back/seek/speed/narrate | Done (`@maze/player`, timeline, narrator) |
| Breakpoints ("run until next dead end") | **Missing** |
| Pseudo-code synced to steps | Done for all 12 solvers (`content/pseudocode.ts`, WI-04) |
| Data-structure views (stack, queue, heap, disjoint set, distance map) | **Missing** (steps carry the payloads) |
| Compare (2+ panels, metrics table) | Done (`/explore/compare`) |
| Lesson page shell, content pipeline, Learn index | **Missing** (`/learn` is a stub) |
| Quizzes, try-it checks, local progress | **Missing** |
| Modules M1-M5 and M7 written; M6, M8-M11 stubs | **Missing** |
| `AlgorithmMeta.docsSlug` on every algorithm | Present, not yet resolved anywhere |

## 2. Decisions

- **D-20 Lessons are typed TSX modules, not MDX (for the MVP).** A lesson is a TypeScript
  module exporting metadata and a body component that uses demo blocks as ordinary React
  components (`<Demo>`, later `<Quiz>`, `<TryIt>`). Why: no new build pipeline on Vite 8 /
  TS 7 (MDX tooling lags both), demo props are type-checked and linted like the rest of the
  app, and lessons lazy-load per route with the existing code splitting. The authoring model
  of 13 section 11 (one file per lesson, front matter, demo blocks) is kept; only the file
  type changes. MDX can wrap the same components later if non-developers author content.
- **Lesson ids and routes.** `/learn` is the index; `/learn/$lessonId` a lesson, with ids like
  `m3-frontier-ring` (module prefix + slug). Unknown ids render the not-found page.
- **Curriculum is data.** `content/learn/curriculum.ts` lists all twelve modules (13 section 7)
  with objectives, prerequisites and lessons; a module without lessons shows as "planned".
  The index, breadcrumbs, previous/next links and progress all derive from it.
- **Data-structure views are rebuilt from steps only** (13 section 4.2): a pure model folds the
  player's step batches and resets on rewind (`player.onReset`), so step back and seek stay
  exact. Views are DOM lists (screen-reader readable), never canvas.
- **Progress is local** (guest) in a persisted store `maze-lab:learn`: lesson started /
  completed timestamps. Completion is a button until quizzes land (WI-06c), then a passed quiz.

## 3. Slices

| Item | Scope | Acceptance (beyond the Definition of Done) |
|------|-------|---------------------------------------------|
| **WI-06a** Lesson shell + pilot lesson | Content model and curriculum registry; `/learn` index (modules, lessons, progress); lesson page with the five regions (concept, live demo with transport, pseudo-code, data-structure view, complexity + next steps); queue view for BFS; local progress; landing card goes live. Pilot: **M3.1 "The frontier is a ring"** (BFS) | Index derives from the registry (test adds a fake module); queue model is FIFO-exact against BFS on real mazes (every `expand` pops the head); lesson works at phone/tablet/desktop; progress survives reload |
| **WI-06b** Data-structure views | Stack (DFS solver, backtracker), priority queue with `g/h/f` (Dijkstra, A*, greedy), disjoint-set forest (Kruskal), distance map (flood fill / BFS rings); a "Data structure" section on Watch | Each model checked against its algorithm on real mazes (stack LIFO, heap pops the minimum `f`, sets merge on `union`); views are DOM lists |
| **WI-06c** Breakpoints, quizzes, try-it | `StepPlayer.runUntil(predicate)` + a breakpoint picker ("until next dead end / backtrack / frontier > N"); `<Quiz>` (data, plain forms, announced result); `<TryIt>` (predicate over steps or metrics); a passed quiz completes the lesson | Breakpoint stops exactly on the first matching step (property test); quiz and try-it fully keyboard-operable with live-region feedback |
| **WI-06d** Modules M1-M3 | M1 Grids & graphs (Build-style demo: toggle walls, cycles/isolated regions), M2 DFS & backtracker (stack view, breakpoint on `backtrack`), M3 BFS completed (rings, Compare DFS vs BFS) | Each lesson's demo seed renders in a Playwright smoke test; quizzes per module |
| **WI-06e** Modules M4, M5, M7 | Prim/Kruskal with the disjoint-set view; Aldous-Broder & Wilson with a dead-end histogram over seeds; A* & heuristics with Compare and the weight slider | As WI-06d |
| **WI-06f** Stubs + links | M6, M8-M11 short lessons with demos; "Learn more" links from Watch, Race and Explore via `docsSlug`; a test that every `docsSlug` resolves to a lesson or a planned module | Smoke test covers every lesson; no dangling `docsSlug` |

Order: a -> b -> c -> d -> e -> f. Each slice is merged and phone-checked on its own; a and b
make Learn usable, c makes it interactive, d-f are mostly content.

## 4. WI-06a design

- `apps/web/src/content/learn/types.ts` - `ModuleInfo`, `LessonInfo`, `Lesson` (info + `Body`
  component + `demo` spec + `complexity`).
- `content/learn/curriculum.ts` - the twelve modules; lessons registered with lazy imports so
  lesson bodies stay out of the Learn index chunk.
- `content/learn/m3/frontierRing.tsx` - the pilot lesson (150-300 words of prose, demo spec:
  BFS on a fixed seed and size, complexity callout O(V + E) time, O(V) space).
- `learn/structures.ts` - `QueueModel` (FIFO folded from `discover`/`expand`), pure and tested.
- `learn/useLessonDemo.ts` - owns a `MazeSession`: generates the demo maze synchronously,
  arms the solver paused, folds steps into the pseudo-code line and the structure model.
- `routes/learn/LearnIndex.tsx`, `routes/learn/LessonPage.tsx`, `routes/learn/FrontierView.tsx`
  (queue as an ordered list, head marked), `state/learnProgress.ts` (persisted store).
- Layout: the lesson page uses `Workspace` (demo maze as the stage, concept + pseudo-code +
  structure as sections) so phone/tablet/desktop behave like Watch; controls sit in rows
  below the maze, never on it.
