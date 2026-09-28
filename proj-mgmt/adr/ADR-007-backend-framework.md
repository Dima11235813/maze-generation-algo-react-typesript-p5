# ADR-007 - Backend framework: NestJS on Fastify, hexagonal modules, REST + OpenAPI

> Status: Proposed | Date: 2026-09-27 | Deciders: Dmitri Larionov | Register ID: D-07

## Context

No backend exists in the repo (the Express `server.js` was gitignored; the Apollo client points
at a non-existent GraphQL server). The API must persist mazes, versions, solves, races and
lesson progress; verify OIDC tokens; enforce policies; replay-validate solves with
`@maze/core`; run jobs; and be observable. "Enterprise-level" and SOLID were explicit asks.

## Decision

**NestJS** with the **Fastify** adapter, organised as hexagonal modules (controllers ->
services -> ports -> adapters), **REST** endpoints described by the shared ts-rest contract
(ADR-008), OpenAPI 3.1 published. Prisma for persistence (ADR-009). BullMQ on Redis for jobs.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Hono + tRPC | Tiny, fast, end-to-end types | Less structure for DI/modules; tRPC couples client to TS only (no OpenAPI for third parties) | Structure matters for a growing modular API |
| Express | Familiar | No structure, slower | Same |
| GraphQL (Apollo) | Flexible queries | Caching/complexity, N+1, auth surface; product needs are CRUD-shaped | REST + typed contract is simpler |
| Go / Rust service | Performance | Splits the TypeScript model sharing goal | Shared TS types are a requirement |

## Consequences

- Positive: DI, guards, interceptors, testing utilities; clear module boundaries; OpenAPI for
  future integrations.
- Negative: NestJS decorators and ceremony; mitigated by keeping domain logic in plain classes.
- Follow-ups: S7.1; SP5 confirms ts-rest ergonomics with NestJS.

## Compliance

Domain services have no Nest imports; adapters are the only place Prisma/Redis are imported
(lint boundary).
