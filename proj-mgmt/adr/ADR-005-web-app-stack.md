# ADR-005 - Web app stack: Vite, React 19, TanStack Router/Query, Zustand, PWA

> Status: Accepted (implemented 2026-09-27) | Date: 2026-09-27 | Deciders: Dmitri Larionov | Register ID: D-05

## Context

Create React App is sunset; the legacy app uses MobX 5 decorators, react-router 5 and a
duplicated Context/MobX state model. The app is a client-side interactive tool (canvas/WebGL
heavy) that must also run inside Tauri shells and offline as a PWA. SEO needs are limited to a
few public pages (maze share pages, lessons).

## Decision

**Vite** build, **React 19**, **TanStack Router** (type-safe, file-based), **TanStack Query** for
server state, **Zustand** for UI state, **vite-plugin-pwa** (Workbox). Client-rendered SPA; a
small pre-render step for public share/lesson pages if SEO demands it later.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Next.js | SSR/RSC, ecosystem | Server runtime complicates Tauri packaging and offline; overkill for a canvas app | SPA + Tauri fit |
| React Router 7 (framework mode) | Familiar lineage | Framework mode adds server concerns similar to Next | TanStack Router's type safety wins for a SPA |
| Keep MobX (v6) | Continuity | Two paradigms with React Query; decorators baggage | Zustand is smaller and RN/Worker friendly |
| Redux Toolkit | Mature | More ceremony for mostly local UI state | Zustand |

## Consequences

- Positive: fast dev loop, small bundles, typed routes/search params (seed, algorithm in URL).
- Negative: no SSR by default; mitigated by pre-render for a handful of routes.
- Follow-ups: S4.1; pre-render decision when share pages ship (S7.4).

## Compliance

No `react-scripts`, `mobx`, `react-router` in any non-legacy workspace (Syncpack banned list).
