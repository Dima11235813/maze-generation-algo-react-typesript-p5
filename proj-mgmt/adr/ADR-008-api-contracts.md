# ADR-008 - API contracts with ts-rest + zod in @maze/contracts

> Status: Proposed | Date: 2026-09-27 | Deciders: Dmitri Larionov | Register ID: D-08

## Context

DRY across client and server requires one definition of every request/response shape, with
runtime validation and static types, and ideally an OpenAPI document for tooling. The legacy
app hand-wrote `ApiResponse<T>` DTOs and pasted generated GraphQL types from another project.

## Decision

Define the API as a **ts-rest** contract using **zod** schemas in `@maze/contracts`. The NestJS
server implements the contract (`@ts-rest/nest`); the web app consumes the generated
**React-Query client** (`@ts-rest/react-query`). **OpenAPI 3.1** is generated from the contract
in CI. Types are always `z.infer`, never duplicated.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| tRPC | Excellent DX | RPC style, no OpenAPI without plugins, TS-only consumers | REST + OpenAPI keeps future non-TS clients possible |
| GraphQL codegen | Typed | Requires GraphQL server (rejected in ADR-007) | n/a |
| OpenAPI-first (hand-written YAML + generators) | Standard | Two sources of truth in practice; generators produce awkward types | Contract-in-TS is the source, OpenAPI is output |
| NestJS DTO classes + class-validator + Swagger | Native to Nest | Client types not shared without codegen; duplication | ts-rest shares directly |

## Consequences

- Positive: compile-time break on contract drift; one validation library across stack.
- Negative: ts-rest is a smaller community than tRPC; mitigated by contract being plain zod
  (portable to another adapter).
- Follow-ups: S7.2; SP5.

## Compliance

No `fetch` outside the generated client in `apps/web`; API controllers must implement the
contract type (compile error otherwise).
