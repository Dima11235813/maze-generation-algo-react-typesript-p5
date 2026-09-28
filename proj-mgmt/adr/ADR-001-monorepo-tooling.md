# ADR-001 - Monorepo tooling: pnpm workspaces + Turborepo

> Status: Proposed | Date: 2026-09-27 | Deciders: Dmitri Larionov | Register ID: D-01

## Context

The next phase needs shared TypeScript packages (core algorithms, contracts, UI, renderer)
consumed by several apps (web, api, desktop, mobile, legacy). The current repo is a single
CRA project with a Yarn 1 lockfile and no shared code. We need fast, cached, affected-only
builds and a single dependency graph.

## Decision

Use **pnpm workspaces** for package management and **Turborepo** for task orchestration and
remote caching. Versioning of `packages/*` via **Changesets**. Dependency alignment via
**Syncpack**.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Nx | Rich generators, graph visualisation, module boundaries lint | Heavier mental model, more config; plugins lag framework releases | Turborepo is enough for < 15 workspaces; boundaries covered by ESLint |
| Lerna (+ Nx) | Familiar | Now a thin wrapper over Nx | No advantage |
| Bun workspaces | Fast installs | Ecosystem/tooling maturity risk for Tauri, Prisma, NestJS | Reassess in 12 months |
| Yarn Berry + Turborepo | PnP strictness | PnP friction with Vite/Tauri/Prisma | pnpm gives strictness without PnP pain |

## Consequences

- Positive: strict, deduplicated `node_modules`; `workspace:*` links; cached CI.
- Negative: contributors must use pnpm (enforced via Corepack + `preinstall` guard).
- Follow-ups: S1.1; remote cache location (Vercel vs GCS) decided during S1.4.

## Compliance

`packageManager` field pinned; CI fails if a `yarn.lock`/`package-lock.json` appears outside
`apps/legacy`.
