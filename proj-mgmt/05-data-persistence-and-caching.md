# 05 - Data, Persistence & Caching

> Status: Proposed | Last updated: 2026-09-27
> Decisions referenced: D-03, D-05, D-09, D-13, D-18

This document fixes the maze wire format, the relational schema, the migration workflow and
the caching strategy at every layer (CDN, Redis, client).

---

## 1. MazeDocument v1 (D-18)

### 1.1 Envelope

```jsonc
{
  "v": 1,                                   // format version, integer, required
  "id": "mz1_7f3c...e91a",                  // content hash id (section 1.4), required on read, ignored on write
  "grid": { "width": 30, "height": 20, "topology": "orthogonal" },
  "walls": "////v9//8...",                  // base64url of packed nibbles (section 1.2); REQUIRED when provenance absent
  "start": 0,                               // CellId = row * width + col
  "goal": 599,
  "provenance": {                           // optional; present => walls can be re-derived
    "algorithm": "recursive-backtracker",   // id from @maze/core generators registry
    "seed": "spring-otter-42",              // string; numeric seeds are stringified
    "params": { "bias": 0 },                // validated against the algorithm's zod ParamSchema
    "coreVersion": "1.4.0"                  // @maze/core version that produced it (guards against RNG changes)
  },
  "meta": {                                 // optional, free-form but schema-checked
    "name": "Spring Otter",
    "description": "",
    "tags": ["tutorial"],
    "perfect": true,                        // claim checked by server on save
    "edited": false                         // true once any manual edit occurred
  }
}
```

The zod schema `MazeDocumentV1` lives in `@maze/contracts/src/schemas/maze-document.ts`; the
encoder/decoder and hash live in `@maze/core/src/document/`. Contracts import the *types*
from core and re-declare the runtime schema (core stays dependency-free per D-03).

### 1.2 Wall packing

Each cell owns one nibble (4 bits), bit set = wall present:

| Bit | Dir | Legacy `walls[i]` |
|-----|-----|-------------------|
| 0 (LSB) | `N` | `walls[0]` Top |
| 1 | `E` | `walls[1]` Right |
| 2 | `S` | `walls[2]` Bottom |
| 3 | `W` | `walls[3]` Left |

Cells are in row-major order (`CellId` order). Two cells per byte: even `CellId` in the low
nibble, odd in the high nibble. Odd cell counts pad the final high nibble with `0`. The byte
array is base64url-encoded without padding.

Size math:

| Grid | Cells | Nibble bytes | base64url chars | JSON envelope (approx) |
|------|-------|--------------|-----------------|------------------------|
| 10 x 10 | 100 | 50 | 67 | ~350 B |
| 30 x 20 | 600 | 300 | 400 | ~700 B |
| 100 x 100 | 10,000 | 5,000 | 6,667 | ~7 kB |
| 500 x 500 | 250,000 | 125,000 | 166,667 | ~170 kB (hard cap, see 1.5) |

Shared walls are stored twice (once per neighbour) on purpose: it keeps decode O(1) per cell,
matches the legacy representation, and the redundancy is verified as an invariant
(`hasWall(a,E) === hasWall(b,W)`) on every decode. A future v2 may switch to an edge bitmap
(~half the size) if storage ever matters; the `v` field exists for that.

### 1.3 Provenance-only storage

| Maze kind | Stored | Read path |
|-----------|--------|-----------|
| Generated, unedited (`meta.edited === false`, provenance present) | `provenance` + `id` + `start`/`goal` + `meta`; `walls` column is NULL | Server (or client) regenerates via `@maze/core` with the pinned `coreVersion`; result is cached by `id` |
| Edited (`meta.edited === true`) | Full `walls`; provenance kept as lineage only | Direct decode |
| Imported/hand-built | Full `walls`, no provenance | Direct decode |

Rule: the server always recomputes the content hash from the *materialised* walls, never
trusts a client hash. If `@maze/core` RNG behaviour ever changes, `coreVersion` allows the
old generator to be kept in a `legacy-rng/` folder so provenance-only mazes remain
reproducible; a one-off job can also materialise all provenance-only mazes before such a
change ships.

Edited mazes optionally keep a **patch history** in `maze_versions.patch` as a JSON array of
`{ op: 'toggleWall' | 'setStart' | 'setGoal' | 'resize', ...args }` operations from
`@maze/core/editing`, allowing undo/redo replay and diff views. The full `walls` snapshot is
always stored per version too; patches are an optimisation for the editor UI, not the source
of truth.

### 1.4 Content hash id

```
canonical = UTF-8 of JSON with keys sorted, no whitespace, of:
            { v, grid:{width,height,topology}, walls (materialised, base64url), start, goal }
id        = "mz1_" + base32-lowercase(SHA-256(canonical))[0:26]
```

`meta` and `provenance` are excluded, so the same maze generated twice or edited into an
identical shape dedupes to one id. The `mz1_` prefix ties the hash to the v1 canonical form.
Two rows may reference the same content (different owners saving the same seeded maze); see
`mazes.content_hash` and the `maze_contents` table below.

### 1.5 Limits (enforced by zod)

| Field | Limit |
|-------|-------|
| `grid.width`, `grid.height` | 2 .. 500 |
| cells | <= 250,000 |
| `meta.name` | 1 .. 80 chars |
| `meta.description` | <= 2,000 chars |
| `meta.tags` | <= 10, each <= 24 chars, slug pattern |
| `provenance.seed` | <= 64 chars |
| request body (`POST /v1/mazes`) | 256 kB |

## 2. Relational schema (PostgreSQL 16, D-09)

### 2.1 Conventions

- Primary keys are `uuid` v7 (time-ordered) generated in the app via the `IdPort`.
- Every table has `created_at timestamptz not null default now()`; mutable tables add
  `updated_at` maintained by trigger.
- Soft delete via `deleted_at timestamptz null` on user-owned content; partial indexes
  exclude deleted rows; hard purge after 30 days by the `user.purge` / `content.purge` jobs.
- JSONB columns hold data whose shape is owned by a zod schema in `@maze/contracts`; the
  database only enforces `jsonb_typeof = 'object'` and size. Validation happens at the API
  edge, never in SQL.
- No cross-schema FKs to auth provider tables; the provider `subject` is a plain unique text.

### 2.2 Tables

```sql
create table users (
  id               uuid primary key,
  auth_subject     text not null unique,            -- Identity Platform uid
  email            citext unique,                   -- null for pure-passkey accounts until verified
  email_verified   boolean not null default false,
  handle           citext not null unique check (handle ~ '^[a-z0-9_]{3,24}$'),
  display_name     text not null check (length(display_name) between 1 and 60),
  role             text not null default 'user' check (role in ('user','educator','admin')),
  avatar_url       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);

create table user_preferences (
  user_id          uuid primary key references users(id) on delete cascade,
  prefs            jsonb not null default '{}'::jsonb,   -- UserPreferences schema (theme, reduced motion, renderer, default algorithm...)
  version          integer not null default 1,           -- optimistic lock
  updated_at       timestamptz not null default now()
);

-- Content-addressed maze bodies, shared between rows in `mazes`
create table maze_contents (
  content_hash     text primary key,                     -- mz1_...
  width            smallint not null check (width between 2 and 500),
  height           smallint not null check (height between 2 and 500),
  topology         text not null default 'orthogonal',
  walls            bytea,                                -- NULL when provenance-only
  provenance       jsonb,                                -- {algorithm, seed, params, coreVersion} or NULL
  start_cell       integer not null,
  goal_cell        integer not null,
  is_perfect       boolean,                              -- computed by server, NULL if not evaluated
  metrics          jsonb,                                -- MazeMetrics: deadEnds, solutionLength, diameter, ...
  created_at       timestamptz not null default now(),
  check (walls is not null or provenance is not null)
);

create table mazes (
  id               uuid primary key,
  owner_id         uuid not null references users(id),
  content_hash     text not null references maze_contents(content_hash),  -- current version's content
  current_version  integer not null default 1,
  name             text not null,
  description      text not null default '',
  tags             text[] not null default '{}',
  visibility       text not null default 'private' check (visibility in ('private','unlisted','public')),
  forked_from_id   uuid references mazes(id),
  edited           boolean not null default false,
  moderation       text not null default 'ok' check (moderation in ('ok','hidden','removed')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);
create index mazes_owner_idx     on mazes (owner_id, created_at desc) where deleted_at is null;
create index mazes_public_idx    on mazes (created_at desc) where visibility = 'public' and deleted_at is null and moderation = 'ok';
create index mazes_tags_gin      on mazes using gin (tags) where visibility = 'public' and deleted_at is null;
create index mazes_content_idx   on mazes (content_hash);

create table maze_versions (
  maze_id          uuid not null references mazes(id) on delete cascade,
  version          integer not null,
  content_hash     text not null references maze_contents(content_hash),
  patch            jsonb,                                -- EditOp[] from previous version, optional
  note             text not null default '',
  author_id        uuid not null references users(id),
  created_at       timestamptz not null default now(),
  primary key (maze_id, version)
);

create table maze_shares (
  id               uuid primary key,
  maze_id          uuid not null references mazes(id) on delete cascade,
  token            text not null unique,                 -- 22-char base64url, the capability
  created_by       uuid not null references users(id),
  expires_at       timestamptz,
  max_uses         integer,
  uses             integer not null default 0,
  revoked_at       timestamptz,
  created_at       timestamptz not null default now()
);

create table solves (
  id               uuid primary key,
  user_id          uuid not null references users(id),
  maze_id          uuid not null references mazes(id),
  maze_version     integer not null,
  content_hash     text not null references maze_contents(content_hash),  -- leaderboards key on content, not row
  moves            bytea not null,                       -- 2 bits per move (N,E,S,W), packed
  move_count       integer not null,
  optimal_length   integer not null,                     -- BFS shortest path length
  efficiency       numeric(6,4) not null,                -- optimal_length / move_count
  server_duration_ms integer not null,                   -- authoritative (submit time - start token issue time)
  client_duration_ms integer,                            -- reported, informational
  mode             text not null check (mode in ('2d','3d-first-person')),
  verified         boolean not null default true,
  created_at       timestamptz not null default now(),
  unique (user_id, maze_id, maze_version, created_at)
);
create index solves_leaderboard_idx on solves (content_hash, server_duration_ms) where verified;
create index solves_user_idx        on solves (user_id, created_at desc);

create table races (
  id               uuid primary key,
  created_by       uuid not null references users(id),
  content_hash     text not null references maze_contents(content_hash),
  config           jsonb not null,                       -- RaceConfig: agents[], seed, maxSteps, lockstep rules
  status           text not null default 'pending' check (status in ('pending','verified','disputed','failed')),
  client_result    jsonb,                                -- RaceResult as reported
  server_result    jsonb,                                -- RaceResult from replay job
  visibility       text not null default 'unlisted' check (visibility in ('private','unlisted','public')),
  created_at       timestamptz not null default now(),
  verified_at      timestamptz
);
create index races_public_idx on races (created_at desc) where visibility = 'public' and status = 'verified';

create table race_participants (
  race_id          uuid not null references races(id) on delete cascade,
  slot             smallint not null,
  solver_id        text not null,                        -- id from @maze/core solvers registry
  params           jsonb not null default '{}'::jsonb,
  steps_to_goal    integer,
  nodes_expanded   integer,
  path_length      integer,
  peak_frontier    integer,
  rank             smallint,
  primary key (race_id, slot)
);

create table lessons (
  slug             text primary key,
  title            text not null,
  ordinal          integer not null,
  body_ref         text not null,                        -- path in the content bundle (MDX shipped with the web app)
  algorithm_ids    text[] not null default '{}',
  published        boolean not null default false,
  updated_at       timestamptz not null default now()
);

create table lesson_progress (
  user_id          uuid not null references users(id) on delete cascade,
  lesson_slug      text not null references lessons(slug),
  state            jsonb not null default '{}'::jsonb,   -- LessonProgress: completedSections[], quizScores{}
  completed_at     timestamptz,
  updated_at       timestamptz not null default now(),
  primary key (user_id, lesson_slug)
);

create table audit_log (
  id               uuid primary key,
  actor_id         uuid,                                 -- null for system
  action           text not null,                        -- 'maze.create', 'user.delete', 'auth.login', ...
  subject_type     text not null,
  subject_id       text not null,
  context          jsonb not null default '{}'::jsonb,   -- request id, ip hash, user agent family; never raw PII
  created_at       timestamptz not null default now()
);
create index audit_log_subject_idx on audit_log (subject_type, subject_id, created_at desc);
create index audit_log_actor_idx   on audit_log (actor_id, created_at desc);

create table outbox (
  id               uuid primary key,
  event_type       text not null,
  payload          jsonb not null,
  created_at       timestamptz not null default now(),
  dispatched_at    timestamptz
);
create index outbox_pending_idx on outbox (created_at) where dispatched_at is null;
```

Notes:

- `maze_contents` is the dedupe point: N users saving the same seed share one row.
- `solves.moves` at 2 bits/move keeps a 10,000-move solve under 2.5 kB.
- `email` is `citext` (extension) for case-insensitive uniqueness.
- Nothing references Identity Platform beyond `users.auth_subject`, honouring the
  `AuthProviderPort` boundary (D-10).

### 2.3 Prisma excerpt

```prisma
model Maze {
  id             String        @id @db.Uuid
  ownerId        String        @map("owner_id") @db.Uuid
  owner          User          @relation(fields: [ownerId], references: [id])
  contentHash    String        @map("content_hash")
  content        MazeContent   @relation(fields: [contentHash], references: [contentHash])
  currentVersion Int           @default(1) @map("current_version")
  name           String
  description    String        @default("")
  tags           String[]      @default([])
  visibility     Visibility    @default(private)
  forkedFromId   String?       @map("forked_from_id") @db.Uuid
  forkedFrom     Maze?         @relation("Forks", fields: [forkedFromId], references: [id])
  forks          Maze[]        @relation("Forks")
  edited         Boolean       @default(false)
  moderation     Moderation    @default(ok)
  versions       MazeVersion[]
  shares         MazeShare[]
  solves         Solve[]
  createdAt      DateTime      @default(now()) @map("created_at") @db.Timestamptz
  updatedAt      DateTime      @updatedAt @map("updated_at") @db.Timestamptz
  deletedAt      DateTime?     @map("deleted_at") @db.Timestamptz

  @@index([ownerId, createdAt(sort: Desc)])
  @@index([contentHash])
  @@map("mazes")
}

model MazeVersion {
  mazeId      String      @map("maze_id") @db.Uuid
  maze        Maze        @relation(fields: [mazeId], references: [id], onDelete: Cascade)
  version     Int
  contentHash String      @map("content_hash")
  content     MazeContent @relation(fields: [contentHash], references: [contentHash])
  patch       Json?
  note        String      @default("")
  authorId    String      @map("author_id") @db.Uuid
  createdAt   DateTime    @default(now()) @map("created_at") @db.Timestamptz

  @@id([mazeId, version])
  @@map("maze_versions")
}

model Solve {
  id               String      @id @db.Uuid
  userId           String      @map("user_id") @db.Uuid
  mazeId           String      @map("maze_id") @db.Uuid
  mazeVersion      Int         @map("maze_version")
  contentHash      String      @map("content_hash")
  moves            Bytes
  moveCount        Int         @map("move_count")
  optimalLength    Int         @map("optimal_length")
  efficiency       Decimal     @db.Decimal(6, 4)
  serverDurationMs Int         @map("server_duration_ms")
  clientDurationMs Int?        @map("client_duration_ms")
  mode             SolveMode
  verified         Boolean     @default(true)
  createdAt        DateTime    @default(now()) @map("created_at") @db.Timestamptz
  maze             Maze        @relation(fields: [mazeId], references: [id])
  content          MazeContent @relation(fields: [contentHash], references: [contentHash])

  @@index([contentHash, serverDurationMs])
  @@index([userId, createdAt(sort: Desc)])
  @@map("solves")
}
```

Partial indexes (`where deleted_at is null`, etc.) are not expressible in Prisma's schema
language; they are added in hand-written SQL inside the generated migration files, which
Prisma supports and preserves.

### 2.4 Migrations

- `prisma migrate dev` locally; `prisma migrate deploy` in the deploy pipeline (D-14) as a
  Cloud Run Job that runs before the new API revision receives traffic.
- **Expand / contract** for zero downtime: (1) add nullable column or new table, (2) deploy
  code that writes both, (3) backfill job, (4) deploy code that reads new, (5) drop old in a
  later release. No migration both adds and drops in one step.
- Every migration is reviewed with `EXPLAIN` on affected hot queries; indexes on large
  tables are created `concurrently` via raw SQL.
- Schema drift check (`prisma migrate diff`) runs in CI against a fresh database.

## 3. Caching strategy

Principle: cache keys embed the content hash or version so invalidation is mostly implicit;
explicit deletes are limited to owner-scoped lists.

### 3.1 HTTP / CDN layer (Firebase Hosting, D-13)

| Resource | Headers | Rationale |
|----------|---------|-----------|
| Hashed static assets (`/assets/*.[hash].js`) | `Cache-Control: public, max-age=31536000, immutable` | Vite content hashes |
| `index.html`, manifest, service worker | `Cache-Control: no-cache` + ETag | Always revalidate the shell |
| `GET /v1/mazes/:id` (public) | `Cache-Control: public, max-age=60, stale-while-revalidate=600` + `ETag: "<content_hash>:<version>"` | Public mazes change rarely; SWR hides API latency |
| `GET /v1/mazes/:id` (private/unlisted) | `Cache-Control: private, no-store` | Never cached at CDN |
| `GET /v1/mazes/:id/versions/:v` | `public, max-age=31536000, immutable` | A version never changes |
| `GET /v1/algorithms`, `/v1/lessons` | `public, max-age=3600` + ETag | Changes only on deploy |
| `GET /v1/openapi.json` | `public, max-age=3600` | |
| Everything else | `no-store` | |

Clients send `If-None-Match`; the API returns `304` without touching Postgres when the ETag
matches the Redis-cached `(content_hash, version)` for the id.

### 3.2 Redis layer (Memorystore)

| Key pattern | Type | TTL | Written by | Invalidated by |
|-------------|------|-----|------------|----------------|
| `maze:rec:{id}` | JSON string (`MazeRecord` without document) | 10 min | cache-aside on read | `mazes.update/delete` -> DEL; version bump changes ETag |
| `maze:doc:{content_hash}` | JSON string (`MazeDocumentV1`) | 24 h | cache-aside on read; also written on create | never (content-addressed); LRU eviction only |
| `maze:list:public:{filterHash}:{cursor}` | JSON string | 60 s | cache-aside | TTL only (short) |
| `maze:list:owner:{userId}` | sorted set of ids by createdAt | 10 min | cache-aside | `mazes.create/update/delete` for that owner -> DEL |
| `lb:maze:{content_hash}` | sorted set: score = server_duration_ms, member = solveId | none (rebuilt hourly) | `solves.submit` (ZADD) + `leaderboard.recompute` job | job rebuild |
| `lb:maze:{content_hash}:meta:{solveId}` | hash (user handle, move_count) | 7 d | `solves.submit` | job rebuild |
| `rl:{scope}:{key}` | token bucket (INCR + PEXPIRE) | window | rate limiter | TTL |
| `idem:{principalId}:{key}` | hash `{status, bodyHash, body}` | 24 h | idempotency helper | TTL |
| `sess:deny:{jti}` | string | until token expiry | `auth.logout`, revoke | TTL |
| `sess:refresh:{userId}:{familyId}` | string (current refresh token hash) | 30 d | `auth.refresh` rotation | rotation / logout |
| `algos:catalog:{coreVersion}` | JSON string | 24 h | startup warm | deploy (new version key) |
| `lock:{name}` | string (owner token) | ms-scale | `withLock` | release / TTL |

Rules:

- Cache-aside with request coalescing (`withLock`) for `maze:doc:*` to avoid regeneration
  stampedes on popular provenance-only mazes.
- Redis unavailability degrades to direct Postgres reads plus in-process `lru-cache` (1,000
  entries) for `maze:doc:*`; rate limiting fails *open* for authenticated users and *closed*
  for anonymous write routes (there are none) so availability is preserved.
- All cached JSON is validated with its zod schema on read; a parse failure evicts the key.
- Memory budget: 1 GB instance; `maxmemory-policy allkeys-lru`; leaderboards and session
  keys are the only sets we would mind losing, and both are rebuildable from Postgres.

### 3.3 Client layer (D-05)

| Resource (TanStack Query key) | `staleTime` | `gcTime` | Notes |
|-------------------------------|-------------|----------|-------|
| `['maze', id]` | 5 min | 30 min | ETag revalidation makes refetch cheap |
| `['maze', id, 'version', v]` | Infinity | 24 h | immutable |
| `['mazes', 'mine']` | 30 s | 10 min | invalidated optimistically on create/update/delete |
| `['mazes', 'public', filters]` | 60 s | 5 min | |
| `['algorithms']` | Infinity (per app version) | Infinity | also bundled as a fallback from `@maze/core` |
| `['leaderboard', hash]` | 30 s | 5 min | polls while a solve is pending verification |
| `['race', id]` | 5 s while `pending`, 1 h when `verified` | 1 h | |
| `['me']`, `['me','preferences']` | 5 min | 1 h | refetch on window focus |

Optimistic updates: saving a maze inserts the summary into `['mazes','mine']` immediately
with a temporary id and rolls back on `4xx`.

**IndexedDB (Dexie)** - `mazelab` database, versioned schema:

| Store | Purpose |
|-------|---------|
| `guestMazes` | Guest library (full `MazeDocumentV1` + local metadata); merged into the account on sign-up (see 06) |
| `outbox` | Pending saves/solves while offline (PWA/Tauri); replayed with their original `Idempotency-Key` |
| `docCache` | LRU of recently opened `MazeDocumentV1` by content hash (offline play) |
| `lessonCache` | Lesson MDX and progress for offline reading |

**localStorage** is limited to tiny UI preferences (theme, reduced motion, last renderer,
sidebar state) under a single JSON key `mazelab.prefs.v1`, validated by the
`UserPreferences` zod schema. Preferences for signed-in users sync to
`PUT /v1/users/me/preferences` with last-write-wins on `version`.

**Legacy key migration** (runs once on first load of the new app, then sets
`mazelab.migratedLegacyPrefs = true`):

| Legacy `localStorage` key | Legacy format | New field |
|---------------------------|---------------|-----------|
| `backgroundColorKey` | `"r:g:b:a"` string | `prefs.theme.custom.background` (hex) |
| `cellColorKey` | `"r:g:b:a"` | `prefs.theme.custom.cell` |
| `cellWallColorKey` | `"r:g:b:a"` | `prefs.theme.custom.wall` |
| `cellSizeKey` | int string | `prefs.render.cellSizePx` (clamped 3..200) |
| `cellWallSizeKey` | int string | `prefs.render.wallWidthPx` |
| `cellWallStrokeCapStyleKey` | `"ROUND" \| "SQUARE" \| "PROJECT"` | dropped (canvas2d uses `lineCap: 'square'` always) |
| `frameRateKey` | int string | `prefs.player.stepsPerSecond` (mapped 1:1, clamped 1..240) |

Legacy keys are left in place (not deleted) so `apps/legacy` keeps working during the
strangler period (D-19).

## 4. Data retention, export and deletion

| Data | Retention |
|------|-----------|
| Soft-deleted mazes/solves/races | 30 days, then hard purge (`content.purge` job); `maze_contents` rows with no references purged weekly |
| `audit_log` | 400 days, partitioned monthly, dropped by partition |
| `outbox` dispatched rows | 7 days |
| Redis idempotency / rate-limit keys | 24 h / window |
| Sentry events | 90 days (vendor default) |
| Cloud SQL automated backups | 7 daily + PITR window 7 days (`point_in_time_recovery_enabled = true` in Terraform) |

**Export** (`POST /v1/users/me/export`): the `user.export` job assembles
`{ user, preferences, mazes[] (full MazeDocumentV1 per version), solves[], races[], lessonProgress[] }`
as JSON, uploads to a private Cloud Storage bucket with a 24 h signed URL, emails the link.
Rate-limited to one export per 24 h.

**Deletion** (`DELETE /v1/users/me`): immediately soft-deletes the user row (handle and
email are replaced with tombstones so they can be reused), revokes all sessions, deletes the
Identity Platform account via `AuthProviderPort`, and schedules `user.purge` for T+30 days.
Public mazes owned by the user are either transferred to a system "community" owner (if the
user opts in at deletion time) or soft-deleted with them. Audit log rows keep the opaque
`actor_id` but no PII.

## 5. Capacity estimate (10,000 registered users, first year)

Assumptions: 20 % monthly active, each active user saves 5 mazes/month, solves 30/month;
average maze 30x20; 5 % of mazes edited (full walls).

| Item | Rows / size |
|------|-------------|
| `mazes` | ~120k rows, ~60 MB with indexes |
| `maze_contents` | ~90k rows after dedupe; walls stored for ~5k (~1.5 MB) |
| `maze_versions` | ~150k rows, ~40 MB |
| `solves` | ~720k rows, ~250 MB (moves bytea dominates) |
| `races` + participants | ~50k rows, ~40 MB |
| `audit_log` | ~5M rows/year, ~1.5 GB (partitioned) |
| Total Postgres | < 3 GB; Cloud SQL `db-custom-1-3840` is sufficient; scale vertically first |
| Redis working set | < 200 MB; 1 GB Memorystore Basic tier |
| API load | peak ~20 rps; Cloud Run min 1 / max 10 instances |
| Cloud Storage (thumbnails, exports) | ~5 GB |

Storage is not a constraint at this scale; latency and correctness dominate, which is why
the plan favours content-addressing and immutable versions over compression tricks.

## 6. Open items for this document

1. Decide whether `solves.moves` should also store timestamps per move (needed for replay
   animation of human solves in Watch mode). Adds ~4 bytes/move; likely yes for v1.
2. Confirm `citext` availability on Cloud SQL (it is a supported extension) in the Terraform
   module before the first migration.
3. Leaderboard fairness for provenance-only mazes across `coreVersion` bumps: leaderboards
   key on `content_hash`, which already changes if the walls change, so no action expected;
   verify with a test in `@maze/core`.
