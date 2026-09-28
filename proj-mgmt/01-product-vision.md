# 01 - Product Vision and Idea Refinement

> Status: Proposed | Last updated: 2026-09-27
> Working name: **Maze Lab** (placeholder; naming is a Phase 2 task)

---

## 1. One-paragraph vision

Maze Lab is an interactive playground and learning tool built around one deceptively simple
object: the maze. Mazes are grid graphs; generating them is spanning-tree construction; solving
them is graph search; comparing algorithms exposes complexity, heuristics, randomness and data
structures. Maze Lab lets a person **play** a maze themselves (2D or first-person 3D), **watch**
an algorithm solve one step by step, **race** two algorithms head to head on the same seed,
**build** and edit their own mazes and save/share them, **learn** the underlying computer
science through guided lessons bound to live visualisations, and **explore** a catalogue of
generation and solving algorithms with measurable characteristics. It runs as a web app, a
desktop app and a mobile app from one codebase.

## 2. Who it is for

| Persona | Goal | What success looks like |
|---------|------|-------------------------|
| **Learner** (high-school / early-university CS, bootcamp) | Understand DFS/BFS/Dijkstra/A*, spanning trees, heuristics by *seeing* them | Completes a module, can predict which algorithm wins a race and why |
| **Self-taught developer** (interview prep) | Refresh graph algorithms with intuition, not just code | Uses Compare mode to see the frontier of BFS vs A*, reads the pseudo-code panel, tries a challenge |
| **Educator** | Demonstrate algorithms live; give the class the same maze | Shares a seed link; students race algorithms; progress is visible (later phase) |
| **Puzzle player** | Solve mazes, beat times, build mazes for friends | Saves a library, shares a link, appears on a per-seed leaderboard |
| **Tinkerer / contributor** | Add an algorithm or renderer | Adds one file to a registry, gets tests and UI for free |

Non-persona: enterprise procurement. "Enterprise-level quality" here means engineering rigour
(security, accessibility, testing, observability, maintainability), not B2B features.

## 3. The six pillars

| Pillar | Route | Core capability | Teaches |
|--------|-------|-----------------|---------|
| **Play** | `/play` | Generate a maze (algorithm, size, seed), solve it yourself in 2D top-down or 3D first-person; timer, move counter, hints (reveal solution progressively) | Spatial reasoning; wall-following from inside the maze |
| **Watch** | `/watch` | Pick a solver, watch it run with the Step Player (play/pause/step/seek/speed); overlays for frontier, visited, path, costs; pseudo-code highlighting; data-structure view | How each search algorithm actually behaves |
| **Race** | `/race` | Two (later N) solvers on the same seeded maze in lockstep; live metrics; winner by steps/expansions/optimality; shareable replay | Trade-offs: completeness, optimality, memory, heuristics |
| **Build** | `/build` | Generate with any algorithm and parameters, then edit: toggle walls, move start/goal, resize, braid; validation (unreachable goal, isolated regions); save, version, fork, share (private/unlisted/public); export PNG/SVG/PDF/JSON | Graph editing invariants; what makes a maze hard |
| **Learn** | `/learn` | Curriculum of modules (grids & graphs -> DFS -> BFS -> spanning trees -> uniform spanning trees -> Dijkstra -> A* -> agent-perspective algorithms -> metrics -> randomness -> complexity -> build your own); each lesson embeds live demos, quizzes and challenges | The CS, structured |
| **Explore** | `/explore` | Algorithm catalogue with metadata (complexity, bias, texture), Compare mode (same seed, N algorithms side by side), metrics dashboard for any maze (dead ends, diameter, twistiness, river) | Analysis and intuition for algorithm "texture" |

Cross-cutting: **Library & Sharing** (your mazes, races, replays; public gallery), **Accounts**
(guest-first, optional sign-in), **Preferences** (themes, colour-blind palettes, motion, sound).

## 4. Idea refinement: from the brief to product decisions

The brief in `next.md` lists capabilities. This section turns each into a decision.

| Brief item | Refinement |
|------------|------------|
| "enable the user to solve a maze" | Two modes: top-down (mouse/keyboard/touch path drawing) and first-person (existing Run Maze concept, upgraded: smooth turning, minimap toggle, wall-follower hint). Both record a **Solve** (moves + timing) that the server can replay-validate. |
| "see an AI solve a maze" | Framed honestly as **algorithmic solvers**. "AI" in UI copy is allowed for the Race feature name, but every solver is labelled with its algorithm. An RL agent is a stretch goal to contrast *learning* with *search*. |
| "see two AIs compete" | **Race mode** with strict fairness: same seed, lockstep steps, identical budgets, published scoring formula. Replays are first-class artefacts. |
| "build a maze and save it, edit the maze" | **Build mode** with pure edit operations and validation; every save is a version; generated mazes are stored as provenance (`algorithm, seed, params`) and edited ones as full walls. |
| "support different maze creation algorithms" | A **registry** of 12 generators + 3 post-processors at launch (see 02). Adding one is a single file. |
| "play with different algos for the solver" | A registry of 12+ solvers with tunable parameters (heuristic, tie-break, weights). |
| "learn about comp-sci algos... graph based considerations" | **Learn mode** with a 12-module curriculum, pseudo-code sync, data-structure visualisers, and metrics that make "graph" concrete (spanning tree, diameter, branching). |
| "powerful playground and educational tool" | **Explore/Compare** and the Step Player are the playground; Learn is the guided path. Same engine underneath. |
| "mobile/web/desktop from one shared codebase" | One React web app; PWA + Tauri 2 wrappers (D-12). |
| "enterprise level quality", "DRY and SOLID", "monorepo with shared TS models", "backend rewrite" | Decisions D-01..D-19; architecture in 03; quality gates in 12. |

## 5. User stories (representative; full list in [15-backlog.md](./15-backlog.md))

- As a **guest**, I can open the app, get a maze immediately, and solve it with keyboard or
  touch, with no account.
- As a **learner**, I can watch BFS and A* on the same maze side by side and see why A* expands
  fewer nodes, with the pseudo-code line that is executing highlighted.
- As a **learner**, I can step backwards through a solve to re-inspect the frontier.
- As a **player**, I can share a link to a maze I built; anyone can open it and their solve time
  goes on that maze's leaderboard.
- As an **educator**, I can give my class a seed so everyone gets the same maze, and run a race
  on the projector with narration on for accessibility.
- As a **screen-reader user**, I can hear a description of the cell I am on and its exits, and
  hear the algorithm narrated as it runs.
- As a **contributor**, I can add "Eller's algorithm" by implementing one generator function
  and get it in every menu, test suite and the Explore catalogue automatically.
- As a **user on a phone**, I can install the app, play offline from my saved library, and sync
  when back online.

## 6. Non-goals (for this phase)

- Multiplayer real-time human-vs-human races (needs WebSockets/rooms; later).
- General-purpose graph editor beyond grid mazes (hex/polar/weave topologies are designed for,
  not shipped).
- LLM tutor (must not ship API keys client-side; considered after Learn MVP).
- Monetisation, organisations/SSO, classroom management dashboards (educator basics only).
- Native code beyond the Tauri shell.

## 7. Success metrics (first 90 days after launch)

| Metric | Target |
|--------|--------|
| Time from landing to first solved maze (guest) | < 60 s median |
| Learn module completion rate (M1-M3) | > 40 % of starters |
| Race replays shared per week | growing week over week |
| Lighthouse a11y / perf | 100 / >= 90 on `/play` |
| Crash-free sessions | > 99.5 % |
| Algorithms in registry | >= 12 generators, >= 12 solvers |

## 8. Principles for product decisions

1. **Guest-first.** Every pillar except saving to the cloud works without an account.
2. **Deterministic and shareable.** Anything you see has a URL that reproduces it exactly.
3. **Honest about "AI".** Name the algorithm; show its cost.
4. **Learn by doing.** Every concept has a control you can manipulate.
5. **Accessible is a feature**, not a compliance line item: narration, keyboard, palettes.
6. **Small core, big catalogue.** The engine stays tiny; algorithms and lessons scale.
