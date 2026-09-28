# ADR-003 - Core algorithms as pure generator functions with seeded RNG

> Status: Proposed | Date: 2026-09-27 | Deciders: Dmitri Larionov | Register ID: D-03

## Context

The legacy `MazeGenerator` advances the algorithm once per p5 `draw()` frame, uses `p.random`
(unseeded) and draws inside the same loop. It cannot run headless, in a Worker, or be tested;
mazes cannot be reproduced. The product needs step-through, replay, race lockstep, server-side
replay validation and reproducible sharing.

## Decision

All generators and solvers live in a dependency-free `@maze/core` package and are implemented
as **ES generator functions** that `yield` serialisable `Step` objects and `return` a result.
Randomness comes only from an injected **seeded `Rng`** (PCG32 default). Algorithms are
registered in typed **registries** with `AlgorithmMeta` (including a zod `ParamSchema`).

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Class with `tick()` method | Familiar OOP | Manual state machines per algorithm; harder to read than the textbook loop | Generators keep algorithms readable |
| Callbacks/observers | Simple | Cannot pause mid-loop without restructuring | Same as above |
| Run to completion + recorded events | Fast | No lockstep or interactive breakpoints | Generators can still run to completion cheaply |
| RxJS streams | Composable | Extra dependency in core; overkill | Core must be dependency-free |

## Consequences

- Positive: one code path for animation, tests, benchmarks, Worker execution and server replay.
- Negative: generator overhead per step (negligible; batch in Worker); developers must learn
  the `yield` discipline.
- Follow-ups: S2.3, S2.4, S2.8; property tests (ADR-015).

## Compliance

`@maze/core/package.json` has no `dependencies`; ESLint forbids DOM globals in core; every
registry entry is exercised by the shared invariant test suite.
