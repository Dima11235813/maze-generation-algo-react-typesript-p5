# ADR-019 - Migration strategy: strangler fig with a frozen legacy app and a parity checklist

> Status: Proposed | Date: 2026-09-27 | Deciders: Dmitri Larionov | Register ID: D-19

## Context

Every major dependency of the current app is end-of-life and its architecture couples
algorithm, rendering and state. Upgrading in place would mean rewriting most files anyway while
fighting CRA, MobX decorators and p5. The workspace rule forbids deleting files.

## Decision

Move the current app **verbatim** to `apps/legacy` (read-only, build-optional, excluded from
`pnpm-workspace.yaml` so its Yarn lockfile and dependencies never mix with the monorepo).
Build the new system beside it in `packages/*` and `apps/web`. A **feature parity checklist** (09 section 4)
with recorded reference evidence gates the production switch-over. The legacy app remains one
release after switch-over, then is archived (not deleted).

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Big-bang rewrite in place | One tree | Loses the working reference; no parity target | Risky |
| Incremental upgrade of CRA (CRA -> Vite, MobX 5 -> 6, MUI 4 -> 7, p5 kept) | Continuous | Pays migration cost for code we will replace; p5 coupling remains | Wasteful |
| Keep legacy as the product, add features | Cheapest short-term | Cannot support solvers, save, multi-platform | Does not meet the brief |

## Consequences

- Positive: safe reference, measurable parity, no destructive operations.
- Negative: two apps in the repo for a while; legacy may not build on modern Node (pinned
  container or source-only).
- Follow-ups: S0.4, S1.2, S4.10.

## Compliance

`apps/legacy` has a CODEOWNERS rule requiring explicit approval for any change; CI marks it
optional.
