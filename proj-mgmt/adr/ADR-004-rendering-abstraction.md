# ADR-004 - Rendering port with Canvas 2D and three.js adapters; retire p5.js

> Status: Accepted (implemented 2026-09-27) | Date: 2026-09-27 | Deciders: Dmitri Larionov | Register ID: D-04

## Context

p5.js owns the draw loop, mixes 2D and WEBGL modes, has awkward TypeScript typings (the repo
carries `global.d.ts` and bogus `typeRoots` hacks), and does not fit React's lifecycle. We need
2D top-down rendering, a 3D/first-person view, printing/export, an accessible DOM mirror, and
the ability to render in a Worker.

## Decision

Define a `Renderer` port in `@maze/renderer` driven by `MazeState` and `Step`s. Ship three
adapters: **`canvas2d`** (default), **`three`** (three.js via react-three-fiber for 3D and
first-person), and **`dom`** (accessible mirror). **p5.js is retired**.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Keep p5 | Existing code | Global loop, typings, bundle size, React mismatch | Root cause of legacy coupling |
| PixiJS | Fast 2D WebGL | 3D not covered; 2D canvas is fast enough for grids | Would still need three.js |
| Babylon.js | Full engine | Heavier than needed | three.js ecosystem fit with React |
| Raw WebGL | Control | Cost | Not justified |

## Consequences

- Positive: renderer swap without touching algorithms; SSR/print-friendly SVG later.
- Negative: re-implementing the legacy 3D effects (extrusion, cube projection, mirror) in
  three.js is real work (S3.2, S3.3).
- Follow-ups: SP1 OffscreenCanvas spike; SP2 camera collision spike.

## Compliance

Only `@maze/renderer/*` imports `three` or touches `CanvasRenderingContext2D`; lint boundary
rule enforces it.
