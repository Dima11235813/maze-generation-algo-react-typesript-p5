# ADR-009 - PostgreSQL 16 + Prisma; Redis for cache, rate limits and leaderboards

> Status: Proposed | Date: 2026-09-27 | Deciders: Dmitri Larionov | Register ID: D-09

## Context

Data is relational (users own mazes with versions, solves reference mazes, races reference
solvers and mazes) with a few JSONB blobs (algorithm params, meta). Leaderboards and public
maze reads are hot paths. Hosting is Google Cloud (ADR-013).

## Decision

**PostgreSQL 16** on Cloud SQL with **Prisma** as ORM and migration tool. **Redis**
(Memorystore) for cache-aside reads, rate limiting, idempotency keys, token denylist, BullMQ
queues and leaderboard sorted sets.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Drizzle ORM | Lighter, SQL-like | Migration tooling less mature; smaller ecosystem | Prisma DX and Nest integration; revisit if Prisma cold-start/bundle becomes an issue |
| Firestore | Serverless, cheap start | Weak relational queries, leaderboard/versioning awkward | Relational model |
| MongoDB | Flexible | Same as above | Same |
| Supabase | Postgres + auth + storage | Vendor coupling for auth; we chose Identity Platform | Could host Postgres later if cost dictates |

## Consequences

- Positive: strong constraints, PITR backups, familiar tooling.
- Negative: Cloud SQL + Memorystore have a fixed monthly floor; Redis is optional until
  leaderboards ship (Phase 4).
- Follow-ups: S7.3, S7.7; expand/contract migration policy in 05.

## Compliance

Prisma is imported only in `apps/api/src/shared/persistence`; repositories are ports.
