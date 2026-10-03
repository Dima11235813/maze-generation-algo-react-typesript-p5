# 14 - Roadmap

> Status: In execution | Last updated: 2026-10-03
> Estimates are ideal engineering weeks for one full-time developer assisted by coding agents.
> They are estimates, not commitments. Each phase ends in something deployable.

---

## 0. Status (2026-10-03)

| Phase | Status | Notes |
|-------|--------|-------|
| 0 Hygiene & safety | Partial | `.env` untracked, gitleaks via CI/hooks; key rotation and push are owner actions (H-1, H-2) |
| 1 Foundation | Done | monorepo, `@maze/core`, CI workflow, ADRs 001-003/018 accepted |
| 2 Web parity | Done | all parity rows (09 section 4.1); PWA, e2e + axe, responsive layouts |
| 3 Solvers, Step Player, Race | Done | 12 generators, 12 solvers, Watch, Compare, timeline/rewind, Race UI (WI-01) |
| 4 Backend, accounts, Build | Build UI = WI-03; backend blocked on H-5..H-8 | core editing ops already exist |
| 5 Learn | Not started | WI-06 |
| 6 Desktop & mobile | Blocked (H-9, H-10) | PWA works today |
| 7 Hardening | Ongoing | lint/knip/a11y debt = WI-05 |
| New: Tree view | Done | maze as a growing spanning tree, 2D + 3D = WI-09 ([19-tree-view.md](./19-tree-view.md)) |

Work is sequenced in [17-work-queue.md](./17-work-queue.md).

## 1. Phase overview

| Phase | Name | Outcome (demo-able) | Est. | Cumulative |
|-------|------|---------------------|------|------------|
| 0 | Hygiene & safety | Key rotated, secrets gone, legacy frozen, repo ready for monorepo | 1 wk | 1 |
| 1 | Foundation: monorepo + core | `@maze/core` with recursive backtracker + BFS, seeded RNG, MazeDocument v1, 90 % tests, CI green | 3 wk | 4 |
| 2 | Web app parity | New `apps/web` reaches legacy parity (2D + 3D, options, first-person run) on the new stack; PWA deployed to Firebase Hosting preview | 4 wk | 8 |
| 3 | Solvers, Step Player, Race | Full generator/solver registries, Watch and Race pillars, Compare mode, metrics | 3 wk | 11 |
| 4 | Backend, accounts, Build | NestJS API on Cloud Run, Identity Platform sign-in, Build/edit/save/share/version, leaderboards with replay validation | 5 wk | 16 |
| 5 | Learn mode | 12-module curriculum MVP (M1-M5 and M7 complete; M6, M8-M12 outlines with working demos), pseudo-code sync, data-structure visualisers, quizzes | 4 wk | 20 |
| 6 | Desktop & mobile | Tauri 2 builds for Win/macOS/Linux, Android, iOS (TestFlight); platform port; store submissions started | 2 wk | 22 |
| 7 | Hardening & launch | WCAG 2.2 AA audit, security review (ASVS L2 checklist, DAST), perf budgets met, runbooks, public launch | 2 wk | 24 |

Total: **~24 ideal weeks** (about 6-7 calendar months at full time; longer part-time).

## 2. Phase detail

### Phase 0 - Hygiene & safety (1 wk)

Goals: stop the bleeding, make the repo safe to work in publicly.

- [ ] Rotate and restrict the Google API key found in `src/.env` / `src/errorHandler.js`; rotate the
      service account referenced in `.gcloudignore`; disable the App Engine service if unused.
- [ ] Remove secrets from the working tree; add `.env.example`; decide on history purge
      (`git filter-repo`) vs. rotate-only (see 07).
- [ ] Add `gitleaks` pre-commit and a GitHub Actions secret-scan workflow.
- [ ] Record reference screenshots/videos of every legacy behaviour (parity evidence).
- [ ] Add `SECURITY.md`, `CODEOWNERS`, PR template, issue templates from the backlog IDs.
- [ ] Create the GitHub project board from [15-backlog.md](./15-backlog.md).

Exit criteria: no secret in tree; secret scan passes; parity evidence captured.

### Phase 1 - Foundation: monorepo + `@maze/core` (3 wk)

- [ ] Scaffold pnpm + Turborepo monorepo; `@maze/config` presets; Node 22 pinned; Changesets.
- [ ] Move legacy app to `apps/legacy` verbatim (own lockfile; build-optional in CI).
- [ ] `@maze/core`: `Grid`, `Dir`, wall nibble helpers, `Rng` (PCG32), `Step` types, registries.
- [ ] Recursive backtracker as a generator function + **characterisation test** reproducing
      legacy behaviour with a scripted RNG.
- [ ] BFS solver; metrics: dead ends, solution length, diameter.
- [ ] `MazeDocument v1` encode/decode/hash; zod schema in `@maze/contracts`.
- [ ] Property-based tests (fast-check) for the invariants in 03 section 3.4; `vitest bench`.
- [ ] CI: typecheck, lint, test, build, coverage gate, size-limit; CodeQL/Semgrep/gitleaks.

Exit criteria: `@maze/core` >= 90 % coverage; CI green on PRs; ADR-001..003, 018 Accepted.

### Phase 2 - Web app parity (4 wk)

- [ ] `apps/web`: Vite + React 19 + TanStack Router/Query + Zustand; `@maze/ui` with shadcn/ui,
      Tailwind v4 tokens (light/dark/high-contrast/colour-blind palettes).
- [ ] `@maze/renderer/canvas2d` and `/three`; `dom` a11y adapter; `@maze/player` StepPlayer +
      Worker bridge.
- [ ] Port every row of the parity checklist (09 section 4): 2D/3D, extrusion, cube projection +
      mirror, colours, sliders, inverse mode, follow-mouse, view rotation, zoom, first-person run
      with peek, resize handling, localStorage migration.
- [ ] Guest-only; preferences persisted locally; PWA manifest and offline shell.
- [ ] Playwright E2E + axe on `/play`; Storybook for `@maze/ui`.
- [ ] Deploy to Firebase Hosting preview channels per PR; production channel on `main`.

Exit criteria: parity checklist 100 % keep/redesign items done; Lighthouse a11y 100; switch
default deployment to the new app; `apps/legacy` marked read-only.

### Phase 3 - Solvers, Step Player, Race (3 wk)

- [ ] Generators: Prim, Kruskal, Aldous-Broder, Wilson, Hunt-and-Kill, Growing Tree, Eller,
      Sidewinder, Binary Tree, Recursive Division, Origin Shift; post-processors Braid/Sparsify.
- [ ] Solvers: DFS, Dijkstra, A* (3 heuristics), Greedy, Bidirectional BFS, Wall Follower,
      Tremaux, Pledge, Dead-End Filling, Flood Fill, Random Mouse.
- [ ] Watch pillar: overlays, step log, playback controls, speed, breakpoints, step-back.
- [ ] Race pillar: lockstep scheduler, scoring, replay file, share via URL (client-side).
- [ ] Explore pillar: catalogue from registry metadata; Compare mode; metrics dashboard.
- [ ] Narrator (ARIA live) driven by steps; reduced-motion mode.

Exit criteria: 12+/12+ algorithms with property tests; race replay reproducible from URL.

### Phase 4 - Backend, accounts, Build (5 wk)

- [ ] `apps/api` NestJS/Fastify; ts-rest contract; Prisma + PostgreSQL; Redis; OTel; Sentry;
      Problem Details; rate limiting; docker-compose for local dev.
- [ ] Terraform: Cloud Run, Cloud SQL, Memorystore, Secret Manager, Firebase Hosting, WIF for
      GitHub Actions; environments dev/staging/prod; deploy workflows with canary + rollback.
- [ ] Identity Platform sign-in (Google, GitHub, email + passkey); `AuthProvider` port; refresh
      cookie flow; guest -> account merge.
- [ ] CASL abilities in `@maze/contracts`; guards; UI permission checks.
- [ ] Mazes: CRUD, versions, forks, visibility, share links, export; Build mode editor with
      validation.
- [ ] Solves + leaderboards with server-side replay validation; Race results persisted.
- [ ] Offline queue (IndexedDB) and sync; data export/delete endpoints.

Exit criteria: staging environment with real sign-in; a maze built on the phone appears on the
desktop; ASVS L2 checklist items for API complete.

### Phase 5 - Learn mode (4 wk)

- [ ] Lesson framework: MDX content, embedded demos bound to StepPlayer, pseudo-code panel with
      line highlighting per Step type, data-structure visualisers (stack, queue, priority queue,
      disjoint set, distance map), quiz component, progress tracking.
- [ ] Author M1-M5 and M7 fully; M6 and M8-M12 as outlines with working demos (scope agreed in
      13 section 14).
- [ ] Educator basics: seed share links, "classroom seed" mode.
- [ ] Light gamification: module badges; per-seed human leaderboards.

Exit criteria: a new learner can complete M1-M3 end-to-end; lesson a11y verified with a screen
reader.

### Phase 6 - Desktop & mobile (2 wk)

- [ ] Spike (2 days, go/no-go): WebGL performance in iOS WKWebView for the three.js view.
- [ ] `apps/desktop`, `apps/mobile` Tauri 2 projects; `platform` port with `tauri` adapter (fs,
      share, deep links, secure storage, notifications, haptics).
- [ ] Signing/notarisation pipelines; GitHub Releases + updater; Play Console + TestFlight.

Exit criteria: installable builds on all five targets; deep link opens a shared maze.

### Phase 7 - Hardening & launch (2 wk)

- [ ] External-style WCAG 2.2 AA audit pass with NVDA/VoiceOver/TalkBack scripts; fix list.
- [ ] Security: ZAP baseline on staging, dependency audit clean, secrets review, threat-model
      refresh, incident runbook.
- [ ] Performance: budgets in 03 section 12 met and enforced in CI.
- [ ] Docs: user guide, contributor guide (add-an-algorithm tutorial), runbooks, accessibility
      statement, privacy notice.
- [ ] Launch checklist; post-launch monitoring dashboards and alerts on.

## 3. Sequencing rationale

- Core before UI so the algorithms are tested once and reused everywhere.
- Parity before new features so the rewrite is judged against a fixed target and the legacy
  app can be retired early.
- Solvers/Race before the backend because they are client-only and deliver the most visible
  product value with zero infrastructure cost.
- Backend before Learn so lesson progress and educator features have persistence to land on.
- Packaging late but the platform port early (Phase 2) so nothing in the UI assumes a browser.

## 4. Milestones

| Milestone | When | Definition |
|-----------|------|------------|
| M-A "Safe" | end Phase 0 | Secrets rotated, scanning on |
| M-B "Engine" | end Phase 1 | `@maze/core` published internally, CI green |
| M-C "Parity" | end Phase 2 | New web app replaces legacy in production |
| M-D "Playground" | end Phase 3 | Watch/Race/Explore live (guest) |
| M-E "Platform" | end Phase 4 | Accounts, Build, sharing, leaderboards live |
| M-F "School" | end Phase 5 | Learn MVP live |
| M-G "Everywhere" | end Phase 6 | Desktop + mobile builds |
| M-H "Launch" | end Phase 7 | Public launch |

## 5. Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Scope creep in Phase 2 (adding features during the port) | High | Schedule | Parity checklist is the only Phase 2 scope; new ideas go to the backlog |
| three.js first-person mode harder than the p5 version | Medium | Schedule | Time-box; ship 2D parity first, 3D as a feature flag |
| WKWebView WebGL performance insufficient | Medium | Mobile scope | Phase 6 spike with go/no-go; fallback: 2D-only on mobile or Expo path (ADR-012 alternative) |
| Identity Platform limitations (e.g. passkeys) | Low | Auth scope | `AuthProvider` port; swap to Auth0/Clerk without touching app code |
| Single developer bandwidth | High | Everything | Agents run the same quality gates; phases produce shippable slices so a pause is safe |
| Cost of Cloud SQL + Memorystore for a hobby-scale launch | Medium | Budget | Start with smallest tiers, budgets/alerts in Terraform; Redis optional until leaderboards |
| Legacy app no longer builds | Medium | Parity evidence | Capture screenshots/videos in Phase 0; Docker with pinned Node 14 |

## 6. What "done" means for the plan itself

The plan is executed when M-H is reached, every decision in the register is `Accepted` or
`Superseded`, and this folder's documents have been updated to describe what was built rather
than what was proposed.
