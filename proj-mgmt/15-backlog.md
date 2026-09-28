# 15 - Backlog (Epics and Stories)

> Status: Proposed | Last updated: 2026-09-27
> IDs: `E<n>` epic, `S<n>.<m>` story. Copy into GitHub Issues with labels `phase:<n>`,
> `area:<core|web|api|infra|ui|a11y|security|learn|platform>`, `type:<feature|chore|bug|spike>`.
> Every story carries acceptance criteria (AC). Definition of Done is in
> [12-quality-engineering.md](./12-quality-engineering.md).

---

## E0 - Hygiene and safety (Phase 0)

| ID | Story | AC |
|----|-------|----|
| S0.1 | Rotate and restrict leaked Google API key; rotate service account | New key restricted to the correct APIs/referrers; old key disabled; documented in 07 |
| S0.2 | Remove secrets from tree, add `.env.example`, decide on history purge | `gitleaks detect` on full history reports only known-rotated findings or none |
| S0.3 | Add gitleaks pre-commit + `security.yml` workflow | Workflow blocks a PR containing a test secret |
| S0.4 | Capture legacy parity evidence | Screenshots/videos for every row of the parity checklist stored under `apps/legacy/docs/parity/` |
| S0.5 | Repo governance files | `SECURITY.md`, `CODEOWNERS`, PR and issue templates exist; issue templates map to `type:*` |
| S0.6 | Create GitHub project board with this backlog | All E/S IDs exist as issues; phases as milestones |

## E1 - Monorepo foundation (Phase 1)

| ID | Story | AC |
|----|-------|----|
| S1.1 | Scaffold pnpm workspaces + Turborepo + Changesets + `@maze/config` | `pnpm turbo build typecheck lint test` runs on an empty package set; remote cache configured |
| S1.2 | Move legacy app to `apps/legacy` verbatim | `git log --follow` preserved; `apps/legacy/README.md` marks it read-only; CI job builds it in Node 14 container or is marked optional |
| S1.3 | ESLint flat config with boundaries, jsx-a11y, strict-type-checked; Prettier; lefthook; commitlint | Import from `apps/*` inside `packages/*` fails lint; commits without Conventional Commit prefix rejected |
| S1.4 | CI workflow `ci.yml` (affected-only) | PR shows typecheck/lint/test/build/coverage/size checks; cache hit on re-run |

## E2 - `@maze/core` engine (Phase 1)

| ID | Story | AC |
|----|-------|----|
| S2.1 | `Grid`, `Dir`, `CellId` helpers, wall nibble helpers | Unit tests for `neighbor`, `opposite`, edge cases; 100 % branch coverage |
| S2.2 | `Rng` interface with PCG32 + mulberry32, string/number seed normalisation | Same seed -> identical sequence across Node and browser (test in both via Vitest environments) |
| S2.3 | `Step` types, `StepStream` helpers, record/replay | A recorded step array replays to the same final `MazeState` |
| S2.4 | Recursive backtracker as generator function | Property tests: spanning tree, wall symmetry, determinism; characterisation test vs legacy with scripted RNG |
| S2.5 | BFS solver + `SolveResult`/`SolveStats` | Shortest path verified against brute force on small grids (fast-check) |
| S2.6 | Metrics: dead ends, solution length, diameter (double BFS), branching | Hand-computed fixtures pass; complexity documented in TSDoc |
| S2.7 | `MazeDocument v1` encode/decode/hash | Round-trip property test; hash stable across platforms; fixture bytes checked in |
| S2.8 | Algorithm registries + `AlgorithmMeta` with zod `ParamSchema` | `generators.ids` drives a `describe.each` invariant suite; adding a fake algorithm in a test picks it up automatically |
| S2.9 | Benchmarks with thresholds | `vitest bench` for 500x500 BFS >= 1M steps/s in CI runner (soft gate) |

## E3 - Renderer and player (Phase 2)

| ID | Story | AC |
|----|-------|----|
| S3.1 | `Renderer` port + `canvas2d` adapter with dirty-rect redraw | 200x200 maze renders < 16 ms per applied step batch; visual snapshot tests |
| S3.2 | `three` adapter: extruded walls, lights, camera rig, view rotation, follow-mouse, zoom | Parity rows for 3D marked done; lazy-loaded chunk |
| S3.3 | `three` adapter: stack-depth cube projection with mirror and depth culling | Matches legacy reference video within reason; toggleable; off under reduced motion |
| S3.4 | `dom` a11y adapter (ARIA grid mirror, virtualised) | axe passes; NVDA reads cell exits; summary for > 400 cells |
| S3.5 | `StepPlayer` (play/pause/step/back/seek/speed/breakpoints) | Unit tests on timing independence from rAF; step-back uses recorded steps |
| S3.6 | Worker bridge via Comlink with main-thread fallback | Generation of 500x500 does not block UI; fallback path tested |
| S3.7 | Narrator (ARIA live) with verbosity levels | Announces carve/expand/path events; rate-limited |

## E4 - Web app parity (Phase 2)

| ID | Story | AC |
|----|-------|----|
| S4.1 | `apps/web` scaffold: Vite, React 19, TanStack Router/Query, Zustand, PWA plugin | Routes render; Lighthouse PWA installable |
| S4.2 | `@maze/ui` design system: tokens, themes (light/dark/high-contrast/colour-blind), shadcn/ui components, Storybook | Every component has a story and passes a11y addon |
| S4.3 | Options panel: generator params from `ParamSchema`, size, seed, colours, wall size, speed, toggles | Form auto-generated from zod schema; validation messages accessible |
| S4.4 | Preferences persistence + legacy localStorage migration | Legacy keys imported once, then removed from use; test covers all seven keys |
| S4.5 | Play: top-down self-solve (keyboard/mouse/touch), timer, moves, hints | Solve recorded as move list; replay reproduces path |
| S4.6 | Play: first-person mode (arrows/WASD, quarter turns, peek, minimap toggle) | Parity rows done; gamepad optional |
| S4.7 | Resize handling via ResizeObserver without regenerating the maze | Maze persists across resize; renderer resizes |
| S4.8 | Playwright E2E + axe for `/play`; visual regression with fixed seed | Green in CI; screenshots stable |
| S4.9 | Firebase Hosting preview channels per PR; production on `main` | PR comment contains preview URL |
| S4.10 | Switch-over: new app at production URL; `apps/legacy` read-only | Parity checklist 100 %; ADR-019 Accepted |

## E5 - Algorithm catalogue (Phase 3)

| ID | Story | AC |
|----|-------|----|
| S5.1 | Generators: Prim, Kruskal (disjoint set), Aldous-Broder, Wilson | Property suite passes; uniform-spanning-tree statistical test for AB/Wilson on 3x3 |
| S5.2 | Generators: Hunt-and-Kill, Growing Tree (params), Eller, Sidewinder | Property suite; Growing Tree "newest" reproduces backtracker exactly |
| S5.3 | Generators: Binary Tree, Recursive Division, Origin Shift | Property suite; Origin Shift supports continuous evolution mode |
| S5.4 | Post-processors: Braid (%), Sparsify | Braid reduces dead ends by target %; graph stays connected |
| S5.5 | Solvers: DFS, Dijkstra (weighted cells), A* (Manhattan/Euclidean/Chebyshev, tie-break), Greedy | Optimality tests where applicable; A* expansions <= Dijkstra on fixtures |
| S5.6 | Solvers: Bidirectional BFS, Wall Follower (L/R), Tremaux, Pledge, Dead-End Filling, Flood Fill, Random Mouse | Completeness caveats encoded in `AlgorithmMeta.tags`; wall follower fails gracefully on non-edge start |
| S5.7 | Metrics: twistiness, river, difficulty heuristic, solver-relative metrics | Fixtures; documented formulas in 02 |

## E6 - Watch, Race, Explore (Phase 3)

| ID | Story | AC |
|----|-------|----|
| S6.1 | Watch page: solver picker, overlays (frontier/visited/path/costs), step log | Screen-reader step log usable; overlays toggle |
| S6.2 | Pseudo-code panel with per-Step line highlighting | Every solver ships pseudo-code with step mapping; test asserts every Step type maps |
| S6.3 | Data-structure visualiser (stack/queue/PQ/disjoint set/distance map) | Driven by step payloads only |
| S6.4 | Race: lockstep scheduler, budgets, scoring, disqualification rules | Deterministic result for a given URL; unit tests for tie-breaks |
| S6.5 | Race replay file + share URL (client-side, compressed) | URL < 2 kB for typical race; opens identical replay |
| S6.6 | Explore catalogue from registry metadata; Compare mode (N side by side, synced) | Adding an algorithm shows up with zero UI changes |
| S6.7 | Metrics dashboard for any maze | Values match `@maze/core/metrics` |

## E7 - Backend platform (Phase 4)

| ID | Story | AC |
|----|-------|----|
| S7.1 | `apps/api` NestJS/Fastify scaffold: helmet, CORS, rate limit, pino, OTel, Sentry, health | `/health/live`, `/health/ready`; traces visible in Cloud Trace on staging |
| S7.2 | `@maze/contracts` ts-rest contract v1 + generated OpenAPI + React-Query client | Contract change breaks compile on both sides (demonstrated in test) |
| S7.3 | Prisma schema + migrations (users, mazes, maze_versions, shares, solves, races, lessons, progress, audit) | Migrations apply on empty DB; expand/contract documented |
| S7.4 | Mazes module: CRUD, versions, forks, visibility, share links, export | Contract tests; CASL policy table tests |
| S7.5 | Solves module with server-side replay validation | Tampered move list rejected; valid solve accepted and ranked |
| S7.6 | Races module: persist configs/results; leaderboard recompute job | BullMQ job idempotent; Redis sorted sets |
| S7.7 | Redis cache-aside for public maze reads, rate limits, idempotency keys | Cache hit ratio metric; invalidation on version bump |
| S7.8 | docker-compose local stack (postgres, redis, otel-collector, api) | `pnpm dev` brings up everything |

## E8 - Identity and access (Phase 4)

| ID | Story | AC |
|----|-------|----|
| S8.1 | `AuthProvider` port + Identity Platform adapter (web SDK) | Google, GitHub, email+password, passkey sign-in on staging |
| S8.2 | API token verification (JWKS), refresh cookie flow, revocation denylist | Expired/revoked tokens rejected; CSRF protection on refresh |
| S8.3 | Guest -> account merge of local library | Local mazes appear in account after sign-in; conflicts resolved by content hash |
| S8.4 | CASL abilities in contracts; NestJS guard; UI `Can` helper | Policy matrix tests (role x action x resource) pass; UI hides forbidden actions |
| S8.5 | Account page: profile, preferences sync, data export, delete account | Export produces JSON zip; delete purges within SLA and is audited |

## E9 - Build mode (Phase 4)

| ID | Story | AC |
|----|-------|----|
| S9.1 | Editor: cell cursor, toggle wall (symmetric), set start/goal, resize, braid | Pure ops with patches; undo/redo via patch stack |
| S9.2 | Validation: unreachable goal, isolated regions, degenerate sizes | Issues listed and focusable; save blocked or warned per severity |
| S9.3 | Save/version/fork/share UI; provenance-only vs full-wall storage decision automatic | Generated-unedited mazes stored as provenance; edited as walls |
| S9.4 | Export PNG/SVG/PDF/JSON, import JSON | Round-trip import; print-quality PDF |
| S9.5 | Offline save queue (IndexedDB) and sync | Airplane-mode save syncs on reconnect; conflict UI |

## E10 - Learn mode (Phase 5)

| ID | Story | AC |
|----|-------|----|
| S10.1 | Lesson framework: MDX, embedded StepPlayer demos, quiz, progress | Lesson renders offline; progress persisted (guest local / account server) |
| S10.2 | Author modules M1-M5 and M7 | Each has objectives, demo, challenge, quiz; reviewed by one external learner |
| S10.3 | Outline modules M6 and M8-M12 with demos | Pages exist with shorter prose and working demos |
| S10.4 | Educator seed links / classroom seed mode | Link opens same maze for all; race on projector with narration |
| S10.5 | Badges and per-seed human leaderboards | Anti-cheat via S7.5 |

## E11 - Desktop and mobile (Phase 6)

| ID | Story | AC |
|----|-------|----|
| S11.1 | Spike: WebGL performance in iOS WKWebView (go/no-go) | Report with fps on 100x100 3D; decision recorded in ADR-012 |
| S11.2 | `platform` port + `web`/`tauri` adapters | Feature-detected at build time; unit tests per adapter |
| S11.3 | `apps/desktop` Tauri 2: capabilities, CSP, updater, signing (Win/macOS/Linux) | Signed installers in GitHub Releases; auto-update works |
| S11.4 | `apps/mobile` Tauri 2: Android + iOS, deep links, share sheet, haptics, secure storage | Deep link opens shared maze; TestFlight and Play internal track |
| S11.5 | Responsive/touch UX: gestures, on-screen d-pad, safe areas | Manual test matrix passes on 3 device sizes |

## E12 - Accessibility (cross-phase, gate in Phase 7)

| ID | Story | AC |
|----|-------|----|
| S12.1 | Fix `user-scalable`, titles, landmarks, focus order in new shell | axe clean; keyboard-only walkthrough script passes |
| S12.2 | Colour-blind-safe palettes + pattern redundancy for state | Okabe-Ito palette; contrast checks in Storybook |
| S12.3 | Reduced motion and contrast preferences | Mirror/cube animations off; playback discrete |
| S12.4 | Screen-reader passes (NVDA/VoiceOver/TalkBack) per release | Findings triaged; zero blockers at launch |
| S12.5 | Accessibility statement page | Published with contact and known issues |

## E13 - Security (cross-phase, gate in Phase 7)

| ID | Story | AC |
|----|-------|----|
| S13.1 | CSP with nonces, HSTS, security headers on Hosting and API | securityheaders.com A; no `unsafe-inline` |
| S13.2 | Dependency policy: Renovate, `pnpm audit` gate, OSV-Scanner, SBOM | Weekly PRs; CI fails on high CVEs without exception record |
| S13.3 | SAST/DAST: CodeQL, Semgrep, ZAP baseline on staging | Zero high findings at launch |
| S13.4 | Threat model refresh + incident runbook | Documented in 07; tabletop exercise done |

## E14 - Observability and operations (Phase 4 onwards)

| ID | Story | AC |
|----|-------|----|
| S14.1 | OTel traces/metrics/logs API -> Cloud Trace/Monitoring/Logging | Trace id in every log line; dashboards for RED metrics |
| S14.2 | Sentry web + API with private source maps | Errors grouped with readable stacks; PII scrubbed |
| S14.3 | SLOs + alerts (availability 99.9 %, p95 latency) | Alert fires in a game-day test |
| S14.4 | Cost budgets and alerts in Terraform | Budget alert at 50/80/100 % |

## E15 - Documentation (cross-phase)

| ID | Story | AC |
|----|-------|----|
| S15.1 | Root README rewrite (done in this planning pass), CONTRIBUTING with add-an-algorithm tutorial | New contributor adds a toy algorithm in < 1 h following the guide |
| S15.2 | ADRs kept current; superseded ones marked | Register in `proj-mgmt/README.md` matches `adr/` |
| S15.3 | Runbooks: deploy, rollback, rotate secrets, restore DB | Each runbook rehearsed once |
| S15.4 | User guide and accessibility statement | Linked from app footer |

## Spikes (time-boxed, produce an ADR update)

| ID | Spike | Box |
|----|-------|-----|
| SP1 | OffscreenCanvas + Worker rendering viability across browsers | 1 day |
| SP2 | three.js first-person camera collision against wall nibbles | 1 day |
| SP3 | WebGL in iOS WKWebView (S11.1) | 2 days |
| SP4 | Identity Platform passkey support and pricing at 10k MAU | 0.5 day |
| SP5 | ts-rest vs tRPC ergonomics with NestJS (confirm D-08) | 0.5 day |
