# ADR-015 - Testing strategy: Vitest + fast-check, RTL, Playwright (E2E, axe, visual), Storybook

> Status: Accepted (implemented 2026-09-27) | Date: 2026-09-27 | Deciders: Dmitri Larionov | Register ID: D-15

## Context

Legacy tests: three files, one impossible to pass, one asserting the wrong field, Enzyme with no
React 17+ adapter, zero coverage of the algorithm. The new core is pure and invariant-rich
(spanning tree, symmetry, determinism, optimality), which suits property-based testing.

## Decision

**Vitest** everywhere (unit, component, contract, bench). **fast-check** property tests run
against every registry entry. **React Testing Library** + user-event for components.
**Playwright** for E2E, **axe-core** assertions and **visual regression** with fixed seeds.
**Storybook** with interaction and a11y tests for `@maze/ui`. **Testcontainers** for Postgres
repository tests. Coverage gates: >= 90 % core, >= 75 % overall. Optional nightly **Stryker**
mutation testing on core.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Jest | Ubiquitous | Slower with ESM/TS, separate config from Vite | Vitest shares Vite config |
| Cypress | Mature | Slower, weaker multi-browser | Playwright |
| Enzyme | Legacy | Dead | Removed |
| Example-based tests only | Simple | Miss algorithm edge cases | Properties are the point |

## Consequences

- Positive: algorithms verified by construction; renderer verified by screenshots; a11y
  regressions blocked.
- Negative: visual tests need deterministic seeds and fonts; run in a fixed container image.
- Follow-ups: S2.4-S2.9, S4.8, S12.x.

## Compliance

Coverage thresholds in `vitest.config`; required checks on PRs; flaky test quarantine policy in
12.
