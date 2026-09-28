# 04 - Backend Rewrite

> Status: Proposed | Last updated: 2026-09-27
> Decisions referenced: D-02, D-03, D-07, D-08, D-09, D-10, D-11, D-13, D-16, D-18

This document specifies the `apps/api` service: why the existing "backend" is discarded,
how the NestJS + Fastify service is structured, how the shared ts-rest contract is
implemented, and the concrete v1 endpoint surface.

---

## 1. Why the current backend is unusable

The repo contains the *shape* of a backend but no working one. Nothing below is salvageable
as code; only the intent (a user can log in, a maze can be saved) carries forward.

| Finding | Evidence | Consequence |
|---------|----------|-------------|
| The deployed server is not in source control | `.gitignore` contains `/gcpServer/*`; `gcpServer/package.json` declares `"start": "node server.js"` but no `server.js` exists in the repo | Deployment is not reproducible; the `/reportError` endpoint the front end posts to cannot be audited |
| GraphQL client points at a server that does not exist | `src/AppWrapper.tsx` creates `ApolloClient({ uri: "http://localhost:4000/graphql" })`; no schema, resolvers or server code anywhere | Login view can never succeed; `credentials: "include"` against localhost leaks nothing today but is a misconfiguration |
| Generated GraphQL types belong to a different product | `src/schemaTypes.ts` defines `CancelSubscriptionMutation`, `ChangeCreditCardMutation`, `ccLast4` fields | Copied from a SaaS tutorial; irrelevant to mazes and misleading |
| Two overlapping HTTP layers | `src/api/CustomFetch.ts` (REST, `ApiResponse<T>` envelope) and Apollo (GraphQL) coexist | Neither is used by any maze feature |
| Fetch wrapper swallows errors | `customFetch` `.catch(() => Promise.reject())` discards the error and `newInit` ignores the caller's `init` | Would make any real API integration undebuggable |
| Auth strings from an unrelated project | `src/shared/sharedData.ts` references MSAL redirect keys, `access_token`, `id_token` | No implementation behind them |
| Runtime is end-of-life | `postBuild/app.yaml` targets `nodejs12` on App Engine Standard | Cannot be redeployed; App Engine is retired per D-13 |

Decision: rewrite from zero on the stack fixed by D-07/D-08/D-09. The legacy `ApiResponse<T>`
envelope, `UserDTO` and `ErrorReport` interfaces are replaced by zod schemas in
`@maze/contracts`; the legacy GraphQL fragments and `schemaTypes.ts` are deleted from the new
codebase (they remain untouched inside `apps/legacy` per D-19).

## 2. Service shape

### 2.1 Runtime

- NestJS 11 on the **Fastify adapter** (D-07). Fastify gives ~2x Express throughput and
  first-class schema validation hooks; Nest gives DI, module boundaries and testability.
- Node 22 LTS, ESM, TypeScript `strict` (D-02). Single Docker image, distroless base, runs on
  Cloud Run (D-13).
- Process boundaries: one HTTP service (`apps/api`) plus one worker entrypoint
  (`apps/api/src/worker.ts`) that shares the same Nest modules but only registers job
  processors. Both build from the same image; Cloud Run selects the entrypoint by env var.

### 2.2 Module layout (hexagonal per module)

```
apps/api/src/
  main.ts                       bootstrap: Fastify, helmet, CORS, rate limit, OTel, pino, ProblemDetails filter
  worker.ts                     bootstrap for background jobs (BullMQ processors only)
  app.module.ts
  config/
    env.ts                      zod-parsed environment (single place that reads process.env)
  modules/
    <module>/
      <module>.module.ts        Nest wiring: binds ports to adapters
      application/              use-cases (services), pure orchestration, no framework imports
      domain/                   entities, value objects, domain errors (re-uses @maze/core types)
      ports/                    interfaces: XRepository, CachePort, AuthProviderPort, ClockPort, RngPort, JobQueuePort
      adapters/
        http/                   ts-rest handler classes (@TsRestHandler), maps contract <-> use-case
        persistence/            Prisma repository implementations
        cache/                  Redis implementations
        external/               Identity Platform, Sentry, etc.
  shared/
    persistence/prisma.service.ts, transaction.ts, outbox/
    cache/redis.service.ts, cache-aside.ts, rate-limiter.ts, idempotency.ts
    authz/casl.guard.ts, current-user.decorator.ts
    errors/problem-details.filter.ts
    telemetry/otel.ts, logger.ts
    ports/clock.port.ts, rng.port.ts, id.port.ts
```

Modules and their responsibilities:

| Module | Owns | Depends on |
|--------|------|------------|
| `auth` | Token verification (JWKS), refresh-cookie exchange, session revocation, guest-to-account merge | `users`, `AuthProviderPort`, `CachePort` |
| `users` | Profile, preferences, data export/delete | `MazeRepository` (for export) |
| `mazes` | CRUD, versions, forks, visibility, share links, content-hash dedupe | `@maze/core` document codec, `CachePort` |
| `solves` | Record and replay-validate user solves | `mazes`, `@maze/core` |
| `races` | Race configs, server-side replay, leaderboards | `mazes`, `@maze/core`, `JobQueuePort` |
| `lessons` | Curriculum metadata, progress | none |
| `health` | `/healthz`, `/readyz`, `/version` | Prisma, Redis ping |

### 2.3 Ports (interfaces) and adapters

All ports live under `modules/<m>/ports` or `shared/ports`. Use-cases depend only on ports;
Nest modules bind concrete adapters. Test modules bind in-memory fakes.

```ts
// shared/ports/clock.port.ts
export interface ClockPort { now(): Date }

// shared/ports/rng.port.ts  (wraps @maze/core Rng for server-side generation)
export interface RngPort { fromSeed(seed: string): Rng; randomSeed(): string }

// modules/mazes/ports/maze.repository.ts
export interface MazeRepository {
  findById(id: MazeId, opts?: { includeDocument?: boolean }): Promise<MazeRecord | null>;
  findByContentHash(hash: string): Promise<MazeRecord | null>;
  listByOwner(ownerId: UserId, page: CursorPage): Promise<CursorResult<MazeSummary>>;
  listPublic(filter: PublicMazeFilter, page: CursorPage): Promise<CursorResult<MazeSummary>>;
  create(input: CreateMazeInput, tx?: Tx): Promise<MazeRecord>;
  appendVersion(mazeId: MazeId, doc: MazeDocumentV1, note: string, tx?: Tx): Promise<MazeVersion>;
  update(id: MazeId, patch: MazePatch, expectedVersion: number): Promise<MazeRecord>; // optimistic lock
  softDelete(id: MazeId): Promise<void>;
}

// shared/cache/cache.port.ts
export interface CachePort {
  get<T>(key: string, schema: ZodType<T>): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  del(...keys: string[]): Promise<void>;
  withLock<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T>;
}

// modules/auth/ports/auth-provider.port.ts  (detail in 06-authn-authz.md)
export interface AuthProviderPort {
  verifyIdToken(token: string): Promise<VerifiedIdentity>;
  revokeRefreshTokens(subject: string): Promise<void>;
  getUser(subject: string): Promise<ProviderUser | null>;
}

// shared/ports/job-queue.port.ts
export interface JobQueuePort {
  enqueue<J extends JobName>(name: J, payload: JobPayload<J>, opts?: { dedupeKey?: string; delayMs?: number }): Promise<void>;
}
```

Adapter bindings per environment:

| Port | production | local dev | unit tests |
|------|------------|-----------|------------|
| `MazeRepository` | Prisma / Cloud SQL | Prisma / docker postgres | `InMemoryMazeRepository` |
| `CachePort` | ioredis / Memorystore | ioredis / docker redis | `MapCache` |
| `AuthProviderPort` | Identity Platform (firebase-admin) | Identity Platform emulator | `FakeAuthProvider` |
| `ClockPort` | `SystemClock` | `SystemClock` | `FixedClock` |
| `RngPort` | `@maze/core` PCG32 | same | same, fixed seeds |
| `JobQueuePort` | BullMQ on Redis | BullMQ on docker redis | `RecordingQueue` |

## 3. Contract implementation (D-08)

### 3.1 Where the contract lives

`@maze/contracts/src/api/` defines one ts-rest router per module and composes them:

```ts
// packages/contracts/src/api/index.ts
export const apiContract = c.router(
  { auth: authContract, users: usersContract, mazes: mazesContract,
    solves: solvesContract, races: racesContract, lessons: lessonsContract, health: healthContract },
  { pathPrefix: '/v1', strictStatusCodes: true, commonResponses: { 400: ProblemDetails, 401: ProblemDetails, 403: ProblemDetails, 404: ProblemDetails, 409: ProblemDetails, 422: ProblemDetails, 429: ProblemDetails, 500: ProblemDetails } }
);
```

Every route declares `body`, `query`, `pathParams`, `headers` and per-status `responses` as
zod schemas. The inferred types are the only DTOs in the system.

### 3.2 Server side

`@ts-rest/nest` handlers implement the contract. The handler class is the *only* place that
knows about HTTP; it maps validated input to a use-case call and the use-case result to a
response tuple.

```ts
@Controller()
export class MazesHttpHandler {
  constructor(private readonly createMaze: CreateMazeUseCase, private readonly getMaze: GetMazeUseCase) {}

  @TsRestHandler(apiContract.mazes)
  handle(@CurrentUser() user: Principal) {
    return tsRestHandler(apiContract.mazes, {
      create: async ({ body, headers }) => {
        const maze = await this.createMaze.execute({ principal: user, input: body, idempotencyKey: headers['idempotency-key'] });
        return { status: 201, body: MazeRecordSchema.parse(maze) };
      },
      getById: async ({ params }) => {
        const maze = await this.getMaze.execute({ principal: user, id: params.id });
        return { status: 200, body: maze };
      },
      // ... every route in the contract must be implemented or the build fails
    });
  }
}
```

Validation: ts-rest runs the zod schemas at the edge (`validateResponses: true` in non-prod
so a handler returning a malformed body fails loudly in CI/staging).

### 3.3 OpenAPI 3.1

`@ts-rest/open-api` generates the spec from the same contract in CI
(`pnpm --filter @maze/contracts openapi`). The spec is:

- published as a build artefact and served at `/v1/openapi.json` (unauthenticated, cacheable),
- diffed against the previous release with `oasdiff` to flag breaking changes,
- used to generate a Scalar/Redoc page at `/v1/docs` in non-prod environments.

No hand-written OpenAPI exists anywhere.

## 4. Request lifecycle

```
Fastify onRequest  -> request-id + trace context (OTel) -> pino child logger
Fastify preHandler -> rate limiter (Redis token bucket per IP + per principal)
Nest Guard 1       -> AuthGuard: verify bearer JWT via JWKS (auth module), attach Principal
                      (guest principal if no token and route allows anonymous)
Nest Guard 2       -> CaslGuard: defineAbilitiesFor(principal) then ability.can(action, subjectType)
                      (coarse check; row-level check happens in the use-case after loading)
ts-rest            -> zod validation of path/query/body/headers  -> 400/422 ProblemDetails
Handler            -> use-case.execute(command)
Use-case           -> loads aggregate via repository port, re-checks ability against the loaded
                      subject (ForbiddenError if owner/visibility mismatch), mutates, persists
                      in a transaction, publishes outbox event, invalidates cache keys
Handler            -> maps result to { status, body }; ts-rest validates response (non-prod)
ExceptionFilter    -> domain/infra error -> RFC 9457 ProblemDetails (never a stack trace)
```

## 5. Error model

RFC 9457 Problem Details is the only error body. The schema and error codes are shared:

```ts
// packages/contracts/src/errors/problem-details.ts
export const ErrorCode = z.enum([
  'validation_failed', 'unauthenticated', 'token_expired', 'forbidden',
  'not_found', 'conflict', 'version_conflict', 'idempotency_key_reused',
  'maze_invalid', 'maze_not_perfect', 'solve_invalid_replay', 'race_config_invalid',
  'rate_limited', 'payload_too_large', 'internal',
]);

export const ProblemDetails = z.object({
  type: z.string().url(),          // https://mazelab.dev/problems/<code>
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),   // human-readable, never contains PII or stack traces
  instance: z.string().optional(), // request path
  code: ErrorCode,
  traceId: z.string().optional(),
  errors: z.array(z.object({ path: z.string(), message: z.string() })).optional(), // zod issues
});
```

Mapping: domain errors extend `DomainError { code, status }`; the global filter maps them
1:1. Unknown errors become `internal` with status 500, are reported to Sentry with the
`traceId`, and the body carries only the `traceId`.

## 6. Idempotency, pagination, versioning

### 6.1 Idempotency keys

All non-GET write routes that create resources (`mazes.create`, `solves.submit`,
`races.create`) accept an `Idempotency-Key` header (UUIDv4, required from clients; the ts-rest
contract marks it required). The `idempotency` helper stores
`idem:{principalId}:{key} -> {status, bodyHash, responseBody}` in Redis for 24 h:

- same key + same body hash -> replay stored response;
- same key + different body -> `409 idempotency_key_reused`;
- in-flight duplicate -> Redis lock, second request waits up to 5 s then replays.

### 6.2 Pagination

Cursor pagination only (no offsets). Cursor = base64url of `{ sortValue, id }`, opaque to
clients. Contract shape:

```ts
export const CursorQuery = z.object({ cursor: z.string().optional(), limit: z.number().int().min(1).max(100).default(25) });
export const cursorResult = <T extends ZodTypeAny>(item: T) =>
  z.object({ items: z.array(item), nextCursor: z.string().nullable(), total: z.number().int().optional() });
```

Default sort is `(createdAt DESC, id DESC)`; list endpoints expose a whitelisted `sort` enum.

### 6.3 Optimistic concurrency

`mazes.update` requires `If-Match: <version>`; mismatch returns `409 version_conflict` with
the current version in the body so the editor can offer a merge.

### 6.4 API versioning

- URL prefix `/v1`. A `/v2` is introduced only for breaking changes; both served by the same
  process from two contract routers for a deprecation window of at least 6 months.
- `@maze/contracts` is semver'd with Changesets (D-14). Minor = additive (new optional field,
  new route); major = breaking. CI fails a PR that changes a schema without a changeset.
- `oasdiff` in CI blocks accidental breaking changes to `/v1`.
- Responses carry `Deprecation` and `Sunset` headers when a route is scheduled for removal.

## 7. Replay validation with `@maze/core` (anti-cheat and dedupe)

Because `@maze/core` is pure and deterministic (D-03), the server can recompute anything a
client claims.

| Flow | Server-side work | Rejects with |
|------|------------------|--------------|
| Save generated maze | Client sends provenance `{algorithm, seed, params, width, height}` plus its content hash. Server re-generates with `@maze/core`, computes the canonical hash, compares. On match, stores provenance-only (see 05). If a maze with that hash exists, returns the existing record (dedupe) with `201` and `Location` of the existing resource | `422 maze_invalid` |
| Save edited maze | Client sends full walls. Server decodes, checks wall symmetry and bounds, computes hash, checks spanning-tree property only if `meta.perfect === true` is claimed | `422 maze_invalid`, `422 maze_not_perfect` |
| Submit solve | Client sends `{ mazeId, mazeVersion, moves: Dir[], clientDurationMs }`. Server loads the maze, replays moves from `start`, verifies no wall is crossed and the final cell is `goal`; computes `moveCount`, `optimalLength` (BFS) and `efficiency`. Server time is authoritative for leaderboards; client duration is stored but flagged | `422 solve_invalid_replay` |
| Submit race result | Client sends race config (maze provenance or id, agent ids + params, seed). Server enqueues a replay job that runs the race in lockstep with `@maze/core` and writes the authoritative result. Client-reported result is displayed as "pending verification" until the job completes | job marks result `disputed` |

Replay CPU budget: generation and BFS on a 200x200 grid are sub-10 ms in Node; races are
bounded by `maxSteps` in the config and run in the worker process, not the request path.

## 8. Background jobs

BullMQ on Redis (D-09), processors in the `worker.ts` entrypoint deployed as a second Cloud
Run service with `min-instances=0`; Cloud Run Jobs are used for scheduled batch work.

| Job | Trigger | Work |
|-----|---------|------|
| `race.replay` | `races.submit` | Deterministic replay, persist authoritative result, update leaderboard sorted set |
| `leaderboard.recompute` | Cloud Scheduler hourly | Rebuild `lb:maze:{hash}` and `lb:global:*` sorted sets from `solves` to heal drift |
| `maze.thumbnail` | maze create/version | Render PNG via `@maze/renderer/canvas2d` in `node-canvas`, upload to Cloud Storage |
| `user.export` | `users.requestExport` | Assemble JSON export, upload, email signed URL (see 05) |
| `user.purge` | `users.delete` + 30 days | Hard-delete soft-deleted rows |
| `outbox.dispatch` | every 5 s | Publish domain events from `outbox` table (future: webhooks, analytics) |

Job payloads are zod-validated; jobs are idempotent by `dedupeKey`.

## 9. Rate limiting

Token buckets in Redis (`@fastify/rate-limit` with the Redis store, keyed per route group):

| Scope | Limit | Notes |
|-------|-------|-------|
| Anonymous, per IP | 60 req/min | Public reads only |
| Authenticated, per principal | 600 req/min | |
| `solves.submit`, `races.submit` | 30 req/min per principal | Prevents leaderboard spam |
| `auth.refresh` | 10 req/min per cookie | |
| `mazes.create` | 20 req/min per principal, 200/day | |

Responses include `RateLimit-*` headers (IETF draft) and `429 rate_limited` Problem Details.

## 10. Configuration

One file reads `process.env`:

```ts
// apps/api/src/config/env.ts
export const Env = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().default(8080),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  IDENTITY_PLATFORM_PROJECT_ID: z.string(),
  JWT_AUDIENCE: z.string(),
  JWT_ISSUER: z.string().url(),
  REFRESH_COOKIE_SECRET: z.string().min(32),
  SENTRY_DSN: z.string().url().optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
  PUBLIC_WEB_ORIGINS: z.string().transform(s => s.split(',')),
  ROLE: z.enum(['api', 'worker']).default('api'),
});
export type Env = z.infer<typeof Env>;
```

Secrets are injected by Cloud Run from Secret Manager (D-13); no `.env` is committed. The
legacy `src/.env` with an embedded API key is a Phase 0 remediation item (see 07-security).

## 11. Local development

`infra/docker/docker-compose.yml` provides: `postgres:16`, `redis:7`, `otel-collector`,
and the Firebase Auth emulator. `pnpm dev:api` runs `prisma migrate dev`, seeds a demo user
and 20 public mazes, then starts Nest in watch mode with the Fastify logger pretty-printed.
Contract changes rebuild both API and web via Turborepo watch.

## 12. v1 endpoint table

`Auth` column: `anon` = no token needed (guest principal), `user` = valid JWT required,
`admin` = JWT with admin role. `Ability` is the CASL `(action, subject)` checked by the guard;
row-level ownership/visibility is re-checked in the use-case.

| Method | Path | Auth | Ability | Request schema | Response schema |
|--------|------|------|---------|----------------|-----------------|
| GET | `/v1/healthz` | anon | - | - | `HealthStatus` |
| GET | `/v1/readyz` | anon | - | - | `HealthStatus` |
| GET | `/v1/version` | anon | - | - | `BuildInfo` |
| GET | `/v1/openapi.json` | anon | - | - | OpenAPI 3.1 |
| POST | `/v1/auth/session` | anon | - | `ExchangeIdToken` | `SessionTokens` (+ sets refresh cookie) |
| POST | `/v1/auth/refresh` | cookie | - | - | `SessionTokens` |
| POST | `/v1/auth/logout` | user | - | - | 204 |
| POST | `/v1/auth/merge-guest` | user | `create Maze` | `GuestLibraryImport` | `MergeResult` |
| GET | `/v1/users/me` | user | `read User(self)` | - | `UserPrivate` |
| PATCH | `/v1/users/me` | user | `update User(self)` | `UserPatch` | `UserPrivate` |
| GET | `/v1/users/me/preferences` | user | `read User(self)` | - | `UserPreferences` |
| PUT | `/v1/users/me/preferences` | user | `update User(self)` | `UserPreferences` | `UserPreferences` |
| POST | `/v1/users/me/export` | user | `export User(self)` | - | 202 `JobAccepted` |
| DELETE | `/v1/users/me` | user | `delete User(self)` | `ConfirmDeletion` | 202 `JobAccepted` |
| GET | `/v1/users/:handle` | anon | `read User` | - | `UserPublic` |
| GET | `/v1/mazes` | anon | `read Maze` | `PublicMazeQuery` + `CursorQuery` | `cursorResult(MazeSummary)` |
| GET | `/v1/mazes/mine` | user | `read Maze(own)` | `CursorQuery` | `cursorResult(MazeSummary)` |
| POST | `/v1/mazes` | user | `create Maze` | `CreateMaze` (+ `Idempotency-Key`) | `MazeRecord` 201 |
| GET | `/v1/mazes/:id` | anon | `read Maze` | - | `MazeRecord` (includes `MazeDocumentV1`) |
| PATCH | `/v1/mazes/:id` | user | `update Maze` | `MazePatch` (+ `If-Match`) | `MazeRecord` |
| DELETE | `/v1/mazes/:id` | user | `delete Maze` | - | 204 |
| GET | `/v1/mazes/:id/versions` | anon | `read Maze` | `CursorQuery` | `cursorResult(MazeVersionSummary)` |
| GET | `/v1/mazes/:id/versions/:v` | anon | `read Maze` | - | `MazeDocumentV1` |
| POST | `/v1/mazes/:id/fork` | user | `fork Maze` | `ForkMaze` | `MazeRecord` 201 |
| POST | `/v1/mazes/:id/share` | user | `share Maze` | `CreateShareLink` | `ShareLink` |
| DELETE | `/v1/mazes/:id/share/:shareId` | user | `share Maze` | - | 204 |
| GET | `/v1/m/:shareId` | anon | - (link is the capability) | - | `MazeRecord` |
| POST | `/v1/mazes/generate` | anon | - | `GenerateRequest` | `MazeDocumentV1` (stateless helper, heavily cached) |
| GET | `/v1/algorithms` | anon | - | - | `AlgorithmCatalog` (from `@maze/core` registries) |
| POST | `/v1/solves` | user | `create Solve` | `SubmitSolve` (+ `Idempotency-Key`) | `SolveRecord` 201 |
| GET | `/v1/solves/mine` | user | `read Solve(own)` | `CursorQuery` | `cursorResult(SolveRecord)` |
| GET | `/v1/mazes/:id/leaderboard` | anon | `read Solve` | `LeaderboardQuery` | `Leaderboard` |
| POST | `/v1/races` | user | `create Race` | `CreateRace` (+ `Idempotency-Key`) | `RaceRecord` 202 |
| GET | `/v1/races/:id` | anon | `read Race` | - | `RaceRecord` (status: pending/verified/disputed) |
| GET | `/v1/races` | anon | `read Race` | `RaceQuery` + `CursorQuery` | `cursorResult(RaceSummary)` |
| GET | `/v1/lessons` | anon | `read Lesson` | - | `LessonIndex` |
| GET | `/v1/lessons/:slug` | anon | `read Lesson` | - | `Lesson` |
| GET | `/v1/lessons/progress` | user | `read LessonProgress(own)` | - | `LessonProgressList` |
| PUT | `/v1/lessons/:slug/progress` | user | `update LessonProgress(own)` | `LessonProgressPatch` | `LessonProgress` |
| GET | `/v1/config` | anon | - | - | `ClientConfig` (feature flags, min client version) |
| GET | `/v1/admin/audit` | admin | `read AuditLog` | `AuditQuery` + `CursorQuery` | `cursorResult(AuditEntry)` |
| POST | `/v1/admin/mazes/:id/moderate` | admin | `moderate Maze` | `ModerationAction` | `MazeRecord` |

Every schema name above is exported from `@maze/contracts/src/schemas` and every route from
`@maze/contracts/src/api`; the web client never declares a type for any of them.

## 13. Testing the API

| Layer | Tool | What is covered |
|-------|------|-----------------|
| Use-cases | Vitest with in-memory port fakes | Business rules, ability re-checks, idempotency, version conflicts |
| Repositories | Vitest + Testcontainers (postgres, redis) | SQL correctness, indexes used (`EXPLAIN` snapshot for hot queries) |
| HTTP | Vitest + `@ts-rest/core` client against an in-process Nest app | Contract conformance, ProblemDetails mapping, auth guard behaviour |
| Contract | `oasdiff` in CI | No unintended breaking change |
| Load | k6 script in `apps/api/load/` | p95 < 150 ms at 100 rps on read routes (target from 03, section 12) |

## 14. Migration note

Nothing from `gcpServer/`, `src/api/`, `src/graphql/` or `src/schemaTypes.ts` is ported. The
only intent carried forward is: a user can sign in, save a maze, and errors are reported.
Error reporting moves to Sentry (D-16); the bespoke `/reportError` endpoint and its
`ErrorReport` payload (which included fabricated PII) are not recreated.

## 15. Open items for this document

1. Confirm whether `POST /v1/mazes/generate` should exist server-side at all (client can
   generate locally). Kept for share previews and link unfurling; revisit in Phase 4.
2. Decide the worker deployment: second Cloud Run service (current plan) vs Cloud Run Jobs
   only. Depends on race replay latency expectations from 13-education-and-playground.md.
