# 13 - Education & Playground Mode

> Status: Proposed | Last updated: 2026-09-27
> Decisions referenced: D-03 (step engine), D-04 (rendering port), D-11 (abilities, for educator
> roles), D-17 (accessibility baseline), D-18 (maze document / seeds)
> ADRs: [ADR-003](./adr/ADR-003-core-step-engine.md), [ADR-004](./adr/ADR-004-rendering-abstraction.md),
> [ADR-011](./adr/ADR-011-authorization.md), [ADR-017](./adr/ADR-017-accessibility-baseline.md)

This document designs the learning experience. It depends on the step engine and algorithm
catalog in [02-domain-model-and-algorithms.md](./02-domain-model-and-algorithms.md) and on the
product pillars in [01-product-vision.md](./01-product-vision.md). Scope for the roadmap's
Phase 5 is fixed in section 12.

---

## 1. Pedagogical thesis

A maze is the smallest object that makes a surprising amount of computer science visible at
once:

| Idea | Where the learner sees it |
|------|---------------------------|
| Graphs (vertices, edges, adjacency, degree) | Cells, passages, junctions, dead ends |
| Trees and spanning trees | Every perfect maze **is** a spanning tree; braiding adds cycles |
| Traversal (DFS/BFS) and its data structures (stack/queue) | Generation by backtracking; solving by flooding |
| Shortest paths and relaxation | BFS layers, Dijkstra with weighted cells |
| Heuristics, admissibility, greedy failure | A* vs greedy best-first on the same maze |
| Randomised algorithms, uniformity, bias | Backtracker vs Wilson's; binary tree's diagonal bias |
| Disjoint sets, priority queues | Kruskal's, Prim's, shown live |
| Complexity and constant factors | Same seed, 10x10 vs 500x500, Worker benchmark |
| Reproducibility and state | Seeds; "send me your maze" is a 12-character string |
| Local vs global information | Wall follower / Tremaux (no map) vs BFS (full map) |

The learner never reads about these in the abstract first. They **watch** them happen on a
maze they chose, **step** through them, **race** them, then **read** the concept with the demo
still on screen.

## 2. Learners and outcomes

| Persona | Enters with | Leaves able to |
|---------|------------|----------------|
| CS student (late high school / first year) | Loops, arrays, maybe recursion | Explain DFS vs BFS, implement one from memory, state why A* needs an admissible heuristic |
| Self-taught developer preparing for interviews | Working code skills, patchy theory | Recognise graph problems, pick the right traversal, reason about time/space, discuss trade-offs out loud |
| Educator | A syllabus and 30 students | Assign one seed to a class, project a synchronised demo, see who completed which module |
| Curious puzzle player | Likes mazes | Solves, builds and shares mazes; picks up vocabulary incidentally through "Why did the AI go there?" prompts |

## 3. How each pillar teaches

| Pillar | Learner action | Concept exposure |
|--------|---------------|------------------|
| **Play** | Solve a maze by hand (2D or first-person) | Intuition for dead ends, systematic exploration; post-solve overlay compares your path to BFS |
| **Watch** | Pick a generator or solver, press play | The primary "lecture": animation + pseudo-code + data structure |
| **Race** | Pit two solvers on the same seed | Empirical complexity; heuristics; local vs global information |
| **Build** | Generate, edit walls, set start/goal, save | Graph edits and their consequences; validation shows unreachable regions and cycles |
| **Learn** | Follow modules with embedded demos and quizzes | Structured curriculum (section 7) |
| **Explore** | Change seeds/params, read metrics, compare | Statistics of random structures; bias; difficulty |

## 4. Learn-mode page anatomy

Every lesson page has the same regions so that the step player, code panel and data-structure
view keep their positions across the curriculum.

```
+--------------------------------------------------------------------------------------+
| Breadcrumb: Learn > M3 BFS & shortest paths > 3.2 The frontier is a ring   [progress] |
+-------------------------------------------+------------------------------------------+
| Concept (MDX prose, 150-300 words)        | Interactive demo (Renderer, D-04)        |
| - one idea per section                    |  seed [golden  ] size [20x12] [regen]    |
| - inline terms link to glossary           |  [|<] [<] [play] [>] [>|]  speed [x1 v]  |
|                                           |  breakpoint: [until next: deadend v]     |
+-------------------------------------------+------------------------------------------+
| Pseudo-code panel                         | Data-structure view                      |
|  1 queue <- [start]        <- highlighted |  Queue: [12][13][21][22]  (FIFO)         |
|  2 while queue not empty                  |  visited: 37 / 240   frontier peak: 9    |
|  3   cur <- queue.dequeue()               |  dist[cur] = 6                            |
+-------------------------------------------+------------------------------------------+
| Complexity callout: O(V+E) time, O(V) space - why each term                           |
| Try it: "Make BFS expand fewer than 50 cells on this seed by moving the goal."        |
| Quiz (3 questions) -> Further reading (CLRS 22.2, Jamis Buck ch. 4)                   |
+--------------------------------------------------------------------------------------+
```

### 4.1 Pseudo-code highlighting synced to steps

Each lesson's pseudo-code block carries a mapping from `Step.t` (and optional payload
predicates) to line numbers:

```ts
// in the lesson MDX front matter / sidecar
export const codeMap: CodeMap = {
  algorithm: 'bfs',
  lines: [
    { match: { t: 'expand' },   line: 3 },
    { match: { t: 'discover' }, line: 5 },
    { match: { t: 'path' },     line: 8 },
    { match: { t: 'done' },     line: 9 },
  ],
};
```

The `StepPlayer` (see `@maze/player`) emits every step to the code panel, which highlights the
mapped line and shows the payload values as inline annotations (`cur = 21`, `g = 6`). Because the
mapping is data, a lesson author needs no code changes to add one.

### 4.2 Data-structure visualiser

Driven only by step payloads (no access to solver internals, which enforces that steps carry
what teaching needs):

| Structure | Rebuilt from | Shown as |
|-----------|-------------|----------|
| Stack (DFS, backtracker) | `visit` pushes, `backtrack` pops | Vertical bar of cell ids, top highlighted |
| Queue (BFS) | `discover` enqueues, `expand` dequeues | Horizontal FIFO with ring colours by depth |
| Priority queue / binary heap (Dijkstra, A*, true Prim) | `discover`/`relax` insert or decrease-key, `expand` pops min | Heap tree with `f`/`g`/`h` labels; sift animation |
| Disjoint set (Kruskal, Eller) | `union` | Forest of set representatives, coloured components on the maze |
| Distance map (flood fill, Dijkstra) | `expand` with `g` | Heat map overlay + numeric grid for small mazes |
| Frontier set (Prim, Growing Tree) | `frontier` deltas | Outlined cells; policy pointer for Growing Tree |
| Marks (Tremaux) | `mark` | Tick marks on passages (1 or 2) |
| Heading + counter (Wall follower, Pledge) | `move` payload | Compass arrow, turn counter |

### 4.3 Step Player controls

| Control | Behaviour | Implementation note |
|---------|-----------|---------------------|
| Play / Pause | Advances at `speed` steps per second (not per frame) | `StepPlayer` uses a time accumulator; rendering batches steps per animation frame |
| Step forward | Exactly one step | Generator `next()` |
| Step back | Rewinds one step | Steps are recorded into a ring buffer (default 100k, configurable); the renderer applies inverse overlays; for generators, `carve` is undone by re-adding the wall in the *display copy* only |
| Seek | Slider over recorded steps; beyond the recorded end it runs forward silently | For runs above the buffer limit the player re-runs from the seed (deterministic) |
| Speed | `0.1x` to `1000x`, plus "instant" | Above ~60 steps/s the renderer switches to coalesced overlay updates |
| Breakpoints | "Run until next `deadend`", "until frontier size > N", "until cell X expanded" | Predicate over steps; the same predicate type powers quiz checks |
| Narrate | Toggle: each step also emits a sentence to an `aria-live` region and a text log | Required by D-17; see [10-accessibility.md](./10-accessibility.md) |

## 5. Compare mode and its relation to Race

**Compare** = the same `MazeDocument` (or seed) rendered N times (2-4 panels) with one solver
or generator each, one shared Step Player, and a metrics table updating live:

| | BFS | A* (manhattan) | Greedy |
|---|---|---|---|
| expanded | 187 | 64 | 41 |
| frontier peak | 23 | 11 | 6 |
| path length | 48 | 48 | 62 |
| optimal | yes | yes | **no** |

**Race** = Compare + lockstep scheduling + scoring + a result that can be saved and shared
(rules in 02 section 9). Compare is exploratory and free-form; Race is a fixed event with a
winner. They share panels, renderers and the metrics table component; Race adds the
`RaceScheduler` and result persistence. Generators can be compared (texture, dead-end ratio)
but not raced in v1.

## 6. The "AI" framing

- The product says **"algorithmic solvers"** (or just "solvers") in the UI and docs, and
  explains in M1 why classical search is not machine learning. "Watch an AI solve" is
  acceptable marketing copy on the landing page only, with a tooltip.
- **Stretch (post-v1)**: a tabular **Q-learning agent** on grids up to 10x10, trained live in a
  Worker over a few thousand episodes, as an agent-perspective solver (`rl-qlearning`). It
  visibly *learns* (early episodes wander; later ones go straight), which contrasts learning
  with search. Training must be deterministic under the race seed to fit Race mode.
- **Optional LLM tutor** ("explain what just happened") is **out of scope for v1**. If added,
  it is an API endpoint that receives the recent step window and the lesson id and returns a
  short explanation; model keys live only in the API's Secret Manager configuration and are
  never shipped to any client (see [07-security.md](./07-security.md)).

## 7. Curriculum outline

Each module is 20-40 minutes. `Pre` lists prerequisite modules. Assessment is a 3-5 question
quiz plus one "try it" check verified by a step predicate or a metric.

| Module | Pre | Learning objectives | Interactive activities | Assessment |
|--------|-----|---------------------|-----------------------|------------|
| **M1 Grids & graphs** | - | Map cells/passages to vertices/edges; define degree, path, cycle, tree; recognise a perfect maze as a spanning tree | Toggle walls in Build; validator shows cycles and isolated regions live; count `passages` vs `cells - 1` | Quiz; "make this maze a tree by removing exactly 2 walls" |
| **M2 DFS & the recursive backtracker** | M1 | Explain stack-based traversal; predict where backtracking occurs; explain why the result is a tree | Watch backtracker at 1x with stack view; breakpoint on `backtrack`; compare `recursive-dfs` overflow on 200x200 | "Predict the next 3 cells" quiz on a paused run |
| **M3 BFS & shortest paths** | M2 | Explain queue/frontier rings; argue BFS optimality on unweighted graphs; read a distance map | Flood-fill heat map; Compare DFS vs BFS on one seed | "Move the goal so BFS expands < N cells" |
| **M4 Spanning trees: Prim, Kruskal, disjoint sets** | M1, M3 | Describe frontier growth vs global edge selection; implement union-find with path compression conceptually | Watch `prims-simplified`, `prims-true`, `kruskals`; disjoint-set forest view | Quiz on union-find operation counts |
| **M5 Uniform spanning trees: Aldous-Broder & Wilson** | M4 | Define uniformity; explain loop erasure; discuss expected running time | Run both at 100x; histogram of `deadEndRatio` over 50 seeds vs backtracker | "Which generator produced this maze?" (from metrics) |
| **M6 Dijkstra & weighted mazes** | M3 | Explain relaxation and priority queues; contrast with BFS when weights differ | Paint terrain costs on a maze; watch `relax` steps in the heap view | "Find a weight assignment where BFS path != Dijkstra path" |
| **M7 A\* & heuristics** | M6 | Define admissible/consistent heuristics; predict greedy failure; explain tie-breaking | Compare `astar` with each heuristic and `greedy-best-first`; `weighted` heuristic slider showing suboptimality | Quiz; "make greedy return a path 20 % longer than optimal" |
| **M8 Solving without a map** | M2 | Reason about local information; state when wall-following fails; explain Pledge's counter and Tremaux marks | First-person Run Maze with wall-follower overlay; braided maze where wall-follower loops | "Escape this island using Pledge" (hands-on first-person) |
| **M9 Analysing mazes: metrics & bias** | M5 | Compute dead-end ratio, river, diameter; identify a generator by its texture; explain double-BFS diameter | Explore panel: metrics table across all generators for one seed; symmetry view of `binary-tree` | "Rank these 4 mazes by difficulty score and justify" |
| **M10 Randomness, seeds & reproducibility** | M2 | Explain PRNGs, seeds, forks; why `Math.random` breaks replay; modulo bias | Change one character of a seed; fork an RNG per agent in a race; view `mulberry32` internals | Quiz; "share a seed that yields a maze with > 30 dead ends" |
| **M11 Complexity & performance** | M3, M4 | Read big-O from step counts; separate asymptotics from constants; understand Workers | Benchmark panel: steps and ms for 10x10..500x500 across algorithms in a Worker; plot | "Which algorithm scales worst here, and why does the table disagree with the big-O?" |
| **M12 Capstone: build your own generator** | all | Implement a generator against the `MazeGenerator` interface; pass the invariant tests | In-browser TypeScript editor (Monaco) with the plugin template; property tests run in a Worker; publish to your profile | Automated: invariants pass; peer review optional |

Later modules (not v1): M13 Bidirectional & memory-bounded search, M14 Weave/hex topologies,
M15 Origin Shift and Markov chains, M16 Reinforcement learning vs search.

## 8. First-person "Run Maze" as embodied learning

The legacy app's first-person mode (arrow keys, `P` to peek) is kept and repurposed:

- The learner is the agent: they see walls of the current cell only. Optional overlays show
  what wall-follower or Tremaux **would** do next, so the learner can follow or deviate.
- A "peek" (the legacy `P` key) lifts the camera to reveal the map for two seconds and costs
  points in Play mode - a tangible price for global information (M8).
- Movement produces `move` steps, so a human run is recorded in the **same step format** as a
  solver's and can be replayed, compared against BFS, and submitted to a leaderboard.
- The 3D renderer adapter (D-04) implements this; `@maze/core` only sees `move` steps.

## 9. Educator features (later phase, after auth D-10/D-11)

| Feature | Detail | Ability (CASL) |
|---------|--------|----------------|
| Classroom | An educator creates a classroom with a join code; students join with their account or as named guests | `manage Classroom` for owner |
| Assignment by seed | Educator pins `(algorithm, seed, size)` or a saved maze; every student sees the same maze | `read Assignment` for members |
| Projector mode | Full-screen demo with large fonts, synchronised playback controls, no account chrome | any |
| Progress dashboard | Module completion, quiz scores, time-on-lesson per student; export CSV | `read Progress` scoped to classroom |
| Lesson remix | Duplicate a lesson's MDX, edit the prose, keep the demo bindings | `create Lesson` |

## 10. Gamification (kept light)

- Streaks and module badges; no paid currency, no ads, no dark patterns.
- **Leaderboards per seed** for human solves (time, moves, peeks). Submissions include the
  recorded `move` steps; the API replays them with `@maze/core` against the maze to verify the
  path is legal and reaches the goal before accepting the score (see
  [04-backend-rewrite.md](./04-backend-rewrite.md), solves module). Replay is deterministic, so
  server and client agree by construction.
- Race results are shareable cards (image generated client-side from the canvas renderer).

## 11. Content authoring model

- Lessons are **MDX files** in `apps/web/src/content/learn/<module>/<lesson>.mdx`, versioned
  with the code. Front matter: `id`, `module`, `order`, `title`, `algorithms: [...]`,
  `prerequisites`, `estimatedMinutes`, `codeMap`.
- `AlgorithmMeta.docsSlug` points from each algorithm to its lesson; the Learn index and the
  "Learn more" links in Watch/Race are generated from the registry, so an algorithm without a
  lesson is a lint error (`docsSlug` must resolve).
- Demo blocks are MDX components: `<Demo algorithm="bfs" seed="golden" size="20x12" />`,
  `<Compare algorithms={['bfs','astar']} />`, `<Quiz id="m3q1" />`, `<TryIt check="expanded<50" />`.
- Quizzes and try-it checks are data (`quizzes.json`, step predicates); progress is stored
  per user (API) or locally for guests.
- Content review: a `content` CODEOWNERS group; MDX is type-checked (`mdx-js` + zod front
  matter) and every demo seed is rendered in a Playwright smoke test.

## 12. Accessibility of the learning experience

Cross-reference [10-accessibility.md](./10-accessibility.md); the specific commitments here:

- Every step has a narration string (`describeStep(step, maze): string`) in `@maze/player`;
  "Narrate" streams it to an `aria-live="polite"` region and to a text log panel that can be
  copied or downloaded.
- The data-structure views are real DOM lists/tables, not canvas, so they are readable by
  screen readers and keyboard-focusable.
- Pseudo-code highlighting is conveyed by text (`> ` marker and `aria-current`), not colour
  alone; colour palettes are colour-blind safe (Okabe-Ito) by default.
- `prefers-reduced-motion` disables the mirror/cube animations and switches the player to
  discrete step mode.
- Quizzes are plain forms; try-it checks announce success/failure textually.

## 13. Success metrics

| Metric | Target after 3 months of Learn mode being live | Source |
|--------|-------------------------------------------------|--------|
| Lesson completion rate (started -> quiz passed) | >= 55 % for M1-M3 | progress events |
| Time-to-first-race for new users | median < 5 min | client analytics (privacy-preserving) |
| 7-day return rate | >= 25 % | signed-in users |
| Quiz first-attempt pass rate | 60-80 % (too high = too easy) | quiz results |
| Modules completed per active learner | >= 3 | progress |
| Narration toggle usage | tracked, no target (a11y signal) | client analytics |

## 14. Scope: Phase 5 MVP vs later

**Phase 5 MVP** (see [14-roadmap.md](./14-roadmap.md)):

- Lesson page shell with all five regions; MDX pipeline; registry-driven Learn index.
- Step Player complete (play/pause/step/back/seek/speed/breakpoints/narrate).
- Pseudo-code sync and data-structure views for: stack, queue, heap, disjoint set, distance map.
- Compare mode (2 panels) with the metrics table.
- Modules **M1-M5** and **M7** written and tested; M6, M8-M11 stubs with demos but shorter prose.
- Local (guest) progress; quizzes; try-it checks.

**Later**:

- M6, M8-M12 full prose; Monaco capstone editor (M12); benchmark panel (M11) polish.
- Educator classroom features, dashboard, projector mode (needs auth and backend).
- Leaderboards with server replay; shareable race cards.
- Q-learning agent; LLM tutor (through API only); additional topologies (M14).
