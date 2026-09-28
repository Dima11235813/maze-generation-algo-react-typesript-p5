# ADR-018 - MazeDocument v1: versioned JSON envelope with packed wall nibbles and provenance

> Status: Accepted (implemented 2026-09-27) | Date: 2026-09-27 | Deciders: Dmitri Larionov | Register ID: D-18

## Context

Mazes must be saved, versioned, shared by URL, exported/imported, deduplicated and replayed on
the server. Generated mazes are fully determined by `(algorithm, seed, params, grid)`; edited
mazes are not. The legacy app stores nothing but UI options.

## Decision

Define **`MazeDocument v1`**: a JSON envelope `{ v, width, height, topology, walls, start, goal,
provenance?, meta? }` where `walls` is a base64url string of one 4-bit nibble per cell in
`Dir N,E,S,W` order (matching legacy `walls[0..3]`), `provenance` is `{ algorithm, seed,
params }`, and the document id is the SHA-256 of its canonical JSON. Generated-and-unedited
mazes may be stored provenance-only and re-derived by `@maze/core`; edited mazes store full
`walls`. Versioned with migration hooks. Detailed in 02 and 05.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Store full cell objects (JSON array) | Simple | 20-50x larger; no dedupe | Size and hashing |
| Store only seed | Tiny | Cannot represent edited mazes; algorithm changes break old mazes | Provenance is optional, walls are canonical |
| Binary-only format | Smallest | Opaque in URLs/DB, harder to debug | JSON envelope + packed payload balances both |

## Consequences

- Positive: 100x100 maze is ~6.7 kB base64; deterministic ids; URL-shareable when compressed.
- Negative: algorithm implementations must be frozen per version for provenance replay
  (record `coreVersion` in provenance).
- Follow-ups: S2.7; format spec in 02 section on serialization; migration hooks for v2 (hex,
  weave).

## Compliance

Round-trip and hash-stability property tests in CI; zod schema in `@maze/contracts` is the only
validator.
