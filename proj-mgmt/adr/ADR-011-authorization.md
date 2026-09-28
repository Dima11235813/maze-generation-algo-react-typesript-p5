# ADR-011 - Authorization with isomorphic CASL abilities shared by API and UI

> Status: Proposed | Date: 2026-09-27 | Deciders: Dmitri Larionov | Register ID: D-11

## Context

Permissions are role-based (guest, user, educator, admin) plus ownership and visibility
(private/unlisted/public) on mazes, solves, races and lessons. The UI must hide or disable what
the API will reject, without duplicating rules (DRY).

## Decision

Define abilities once with **CASL** in `@maze/contracts/abilities`
(`defineAbilitiesFor(user)`). The NestJS layer enforces them in a guard/policy handler; the
React app uses the same builder for `Can` checks. Policy behaviour is pinned by a role x action
x resource test matrix.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Cerbos / OPA | Central policy service, audit | Extra infrastructure, YAML/Rego policies not shareable with the browser | Overkill for current scale |
| Oso | Nice DSL | Hosted/library split, less TS-native | CASL is TS-native |
| Ad-hoc `if` checks | Zero deps | Drift between UI and API | The problem we are solving |

## Consequences

- Positive: one definition, testable in isolation, zero infrastructure.
- Negative: complex attribute rules can get verbose; keep resources coarse.
- Follow-ups: S8.4; policy matrix in 06.

## Compliance

Controllers may not contain role checks; only the CASL guard does. Lint rule forbids
`user.role ===` outside `abilities/`.
