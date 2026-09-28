# ADR-002 - Language and runtime: TypeScript 5 strict, Node 22 LTS, ESM

> Status: Accepted (implemented 2026-09-27) | Date: 2026-09-27 | Deciders: Dmitri Larionov | Register ID: D-02

## Context

Legacy uses TypeScript 3.6.3 with `experimentalDecorators` + `emitDecoratorMetadata`, and
Node 12 on App Engine. Shared models across web, API and native shells demand one language and
maximum type safety.

## Decision

**TypeScript 5.x** with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`,
`verbatimModuleSyntax`; **ESM only**; **Node 22 LTS** pinned via `.nvmrc`/`engines`. No
TypeScript decorators outside NestJS (which uses standard TS decorators for DI).

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| JS + JSDoc | No build step | Weak generics, no shared inference across packages | Type safety is a core requirement |
| Deno | Built-in tooling | Ecosystem gaps (Prisma, NestJS, Tauri tooling) | Risk |
| Bun runtime | Speed | Production maturity, Cloud Run base images | Reassess later |

## Consequences

- Positive: zod-inferred types, template literal types, `satisfies`, better DX.
- Negative: stricter flags cause upfront friction; addressed by starting green in new packages.
- Follow-ups: `@maze/config/tsconfig.base.json` (S1.1).

## Compliance

`tsc --noEmit` in CI per package; `@maze/config` is the only place compiler options live.
