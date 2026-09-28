# Maze Lab - Project Management Hub (Next Phase Plan)

> Planning workspace for turning the 2019-2020 p5.js maze generator prototype into an
> enterprise-grade, multi-platform **maze playground and computer-science learning tool**.
>
> Status: **In execution** (foundation + parity merged to develop/main on 2026-09-27; Phase 3 in progress on feature branches)
> Owner: Dmitri Larionov | Plan date: 2026-09-27

---

## 1. Why this exists

The current repo is a single Create-React-App project where the recursive-backtracker
algorithm, the p5 WebGL renderer, MobX UI state and the (stubbed) auth/GraphQL layer are
tightly coupled. It works as a demo but cannot grow into the product described in
[01-product-vision.md](./01-product-vision.md) without a structural reset.

This folder is the single source of truth for **what** we are building next, **why** each
architectural choice was made, and **in what order** the work happens.

## 2. How to read this folder

| # | Document | Answers |
|---|----------|---------|
| 00 | [Current-State Assessment](./00-current-state-assessment.md) | What exists today, what is broken, what is worth keeping |
| 01 | [Product Vision & Idea Refinement](./01-product-vision.md) | Who it is for, the six feature pillars, user stories, non-goals |
| 02 | [Domain Model & Algorithm Catalog](./02-domain-model-and-algorithms.md) | Shared TypeScript models, step engine, generation & solving algorithms, metrics |
| 03 | [Target Architecture](./03-target-architecture.md) | Monorepo layout, package boundaries, SOLID/DRY mapping, rendering abstraction |
| 04 | [Backend Rewrite](./04-backend-rewrite.md) | API stack, module design, contracts, error handling, versioning |
| 05 | [Data, Persistence & Caching](./05-data-persistence-and-caching.md) | Schema, maze serialization format, PostgreSQL/Redis/client caching strategy |
| 06 | [Authentication & Authorization](./06-authn-authz.md) | Identity provider, session model, RBAC + ownership policies, guest mode |
| 07 | [Security](./07-security.md) | Findings in current code, threat model, controls, secrets, supply chain |
| 08 | [CI/CD, Deployment & Observability](./08-ci-cd-deployment-observability.md) | Pipelines, environments, IaC, release process, logging/tracing/errors |
| 09 | [Modernization & Migration](./09-modernization-migration.md) | Dependency-by-dependency upgrade path, strangler-fig strategy, parity checklist |
| 10 | [Accessibility](./10-accessibility.md) | WCAG 2.2 AA plan, canvas a11y, keyboard/screen-reader, reduced motion, testing |
| 11 | [Multi-Platform (Web/Desktop/Mobile)](./11-multi-platform.md) | One codebase -> PWA, Tauri desktop, Tauri mobile; alternatives and trade-offs |
| 12 | [Quality Engineering](./12-quality-engineering.md) | Testing pyramid, property-based tests, coding standards, Definition of Done |
| 13 | [Education & Playground Mode](./13-education-and-playground.md) | Learning experience design, step debugger, curriculum, AI-vs-AI race rules |
| 14 | [Roadmap](./14-roadmap.md) | Phases, milestones, sequencing, estimates, risks |
| 15 | [Backlog](./15-backlog.md) | Epics and issue-ready stories with acceptance criteria |
| 16 | [Human Actions](./16-human-actions.md) | Owner-only to-dos (key rotation, pushes, GitHub/GCP/store setup) that unblock each phase |
| ADR | [adr/](./adr/) | Architecture Decision Records (one file per decision) |

Read order for a newcomer: **01 -> 00 -> 03 -> 02 -> 14**, then dive into the specialised docs.

## 3. Decision register (the "constitution")

Every document in this folder must be consistent with this table. Change a decision here
(and in its ADR) before changing it anywhere else.

| ID | Area | Decision | Alternatives considered | ADR |
|----|------|----------|-------------------------|-----|
| D-01 | Repo | **pnpm workspaces + Turborepo** monorepo | Nx, Lerna, Bun workspaces | [ADR-001](./adr/ADR-001-monorepo-tooling.md) |
| D-02 | Language/runtime | **TypeScript 5.x `strict`** everywhere; **Node 22 LTS**; ESM only | JS + JSDoc, Deno, Bun | [ADR-002](./adr/ADR-002-language-and-runtime.md) |
| D-03 | Core algorithms | Pure, dependency-free **`@maze/core`** package; algorithms expressed as **ES generators yielding `Step` objects**; **seeded RNG** so a maze is reproducible from `(algorithm, seed, params)` | Class-per-algorithm with internal timers (current approach) | [ADR-003](./adr/ADR-003-core-step-engine.md) |
| D-04 | Rendering | **Renderer port** with adapters: **Canvas 2D** (2D top-down) and **three.js / react-three-fiber** (3D / first-person). **p5.js retired** | Keep p5, PixiJS, raw WebGL, Babylon.js | [ADR-004](./adr/ADR-004-rendering-abstraction.md) |
| D-05 | Web app | **Vite + React 19 + TanStack Router + TanStack Query + Zustand**, PWA-enabled | Next.js, React Router 7 framework mode, keep CRA | [ADR-005](./adr/ADR-005-web-app-stack.md) |
| D-06 | UI kit & styling | **shadcn/ui (Radix primitives) + Tailwind CSS v4** with design tokens; **MUI retired** | MUI v7, Mantine, Chakra | [ADR-006](./adr/ADR-006-ui-kit.md) |
| D-07 | Backend | **NestJS (Fastify adapter)**, modular hexagonal layout, **REST + OpenAPI** | Hono + tRPC, Express, GraphQL (Apollo), Go/Rust service | [ADR-007](./adr/ADR-007-backend-framework.md) |
| D-08 | API contracts | **ts-rest contracts defined with zod in `@maze/contracts`**, consumed by the NestJS server and a typed React-Query client; OpenAPI spec generated from the same source | tRPC, GraphQL codegen, hand-written OpenAPI | [ADR-008](./adr/ADR-008-api-contracts.md) |
| D-09 | Database & ORM | **PostgreSQL 16 (Cloud SQL) + Prisma**; **Redis (Memorystore)** for cache, rate-limit, leaderboards | Drizzle, Firestore, MongoDB, Supabase | [ADR-009](./adr/ADR-009-database-and-cache.md) |
| D-10 | AuthN | **OIDC via Google Cloud Identity Platform (Firebase Auth SDK)** behind an `AuthProvider` port; Google/GitHub/Apple/email + passkeys; API-issued short-lived JWT + httpOnly refresh cookie on web, OS secure storage in Tauri | Auth0, Clerk, Keycloak, Better Auth, roll-your-own | [ADR-010](./adr/ADR-010-authentication.md) |
| D-11 | AuthZ | **RBAC + resource ownership + visibility** expressed as isomorphic **CASL** abilities in `@maze/contracts`, enforced by NestJS guards and reused by the UI | Cerbos, Oso, OPA, ad-hoc `if` checks | [ADR-011](./adr/ADR-011-authorization.md) |
| D-12 | Multi-platform | **One React web codebase** -> PWA (web), **Tauri 2** (Windows/macOS/Linux **and** iOS/Android) | Expo/React Native universal app, Capacitor, Electron | [ADR-012](./adr/ADR-012-multi-platform.md) |
| D-13 | Hosting | **Google Cloud**: static web on Firebase Hosting (CDN), API on **Cloud Run**, Cloud SQL, Memorystore, Secret Manager; **App Engine retired**; IaC with **Terraform** | Vercel + Neon, Fly.io, AWS, keep App Engine | [ADR-013](./adr/ADR-013-hosting-and-iac.md) |
| D-14 | CI/CD | **GitHub Actions**; Turborepo remote cache; PR preview channels; **Changesets** for versioning; Renovate; CodeQL + gitleaks + Semgrep | GitLab CI, Cloud Build, CircleCI | [ADR-014](./adr/ADR-014-ci-cd.md) |
| D-15 | Testing | **Vitest** (+ **fast-check** property tests on core), **React Testing Library**, **Playwright** (E2E + axe + visual), **Storybook** for `@maze/ui` | Jest, Enzyme (retired), Cypress | [ADR-015](./adr/ADR-015-testing-strategy.md) |
| D-16 | Observability | **OpenTelemetry** -> Cloud Trace/Logging; **Sentry** for FE + BE errors (replaces stackdriver-errors-js); structured JSON logs (pino) | Datadog, only GCP native | [ADR-016](./adr/ADR-016-observability.md) |
| D-17 | Accessibility | **WCAG 2.2 AA** is a release gate; canvas content has a DOM/ARIA equivalent; `prefers-reduced-motion` honoured | Best-effort only | [ADR-017](./adr/ADR-017-accessibility-baseline.md) |
| D-18 | Maze format | Versioned **`MazeDocument v1`** (JSON envelope, 4-bit wall nibbles base64-packed, provenance `{algorithm, seed, params}`, content hash id) | Store full cell objects, store only seed | [ADR-018](./adr/ADR-018-maze-document-format.md) |
| D-19 | Migration strategy | **Strangler fig**: legacy CRA app moved to `apps/legacy` read-only; new app built beside it; feature parity checklist gates the switch-over | Big-bang rewrite in place, incremental upgrade of CRA | [ADR-019](./adr/ADR-019-migration-strategy.md) |

Status legend used in ADRs: `Proposed` -> `Accepted` -> `Superseded by ADR-xxx` / `Deprecated`.

## 4. Guiding principles

1. **Algorithms are data-pure and UI-free.** Anything in `@maze/core` runs in Node, a Web
   Worker, a browser, a Tauri shell, or a test with no DOM.
2. **One model, everywhere (DRY).** Types, validation schemas, permissions and the maze wire
   format live once in `packages/` and are imported by every app and the API.
3. **SOLID by construction.** Ports/adapters for rendering, persistence, auth and telemetry;
   new algorithms plug in through registries without touching existing code (Open/Closed).
4. **Reproducibility.** Every maze, every solve, every race is replayable from a seed and a
   version.
5. **Accessible and secure by default.** WCAG 2.2 AA and OWASP ASVS L2 are gates, not
   afterthoughts.
6. **Ship thin slices.** Each roadmap phase ends with something deployable and demo-able.

## 5. Glossary

| Term | Meaning |
|------|---------|
| **Perfect maze** | A maze whose passage graph is a spanning tree: every pair of cells has exactly one path. All generators here produce perfect mazes unless a "braid" post-processor is applied. |
| **Step** | One atomic, serialisable event emitted by a generator or solver (e.g. `carve`, `visit`, `expand`, `dead-end`). Rendering, narration and metrics all derive from steps. |
| **Step Player** | Playback controller (play / pause / step / seek / speed) that consumes steps independently of frame rate. |
| **Agent** | A solver plus a budget, used in Race mode. |
| **Race** | Two or more agents solving the same seeded maze in lockstep, compared on steps, nodes expanded and path optimality. |
| **MazeDocument** | The versioned persisted representation of a maze (see D-18). |
| **Provenance** | `{algorithm, seed, params}` that allows a generated maze to be recomputed instead of stored. |

## 6. Conventions for this folder

- Documents are Markdown, wrapped at ~100 chars, with a status line at the top.
- Decisions go in **ADRs**; documents reference ADRs, never re-argue them.
- Dates are absolute (ISO-8601). Estimates are in ideal engineering weeks for one full-time
  developer assisted by coding agents, and are labelled as estimates.
- Backlog items use the ID scheme `E<n>` (epic) / `S<n>.<m>` (story) so they can be copied
  straight into GitHub Issues.
- Nothing in this folder is deleted; superseded documents get a `Superseded` status line.
