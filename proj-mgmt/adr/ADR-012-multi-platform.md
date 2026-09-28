# ADR-012 - One React web codebase delivered as PWA + Tauri 2 (desktop and mobile)

> Status: Proposed (pending SP3 spike result) | Date: 2026-09-27 | Deciders: Dmitri Larionov | Register ID: D-12

## Context

Requirement: web, desktop (Windows/macOS/Linux) and mobile (iOS/Android) from one shared
codebase. The UI is canvas/WebGL heavy; the algorithm core is pure TypeScript. Team is one
developer plus agents; native expertise is limited.

## Decision

`apps/web` is the single UI. It ships as a **PWA** and is wrapped by **Tauri 2** projects for
desktop and mobile. A small `platform` port abstracts native capabilities (fs, share, deep
links, secure storage, notifications, haptics) with `web` and `tauri` adapters. A 2-day spike
(SP3) validates WebGL performance in iOS WKWebView before Phase 6; failure triggers the
fallback below.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Expo / React Native universal (react-native-web) | True native UI, mature mobile tooling | Two rendering stacks (Skia/expo-gl vs DOM canvas), RN-compatible UI kit required, web is second-class | Higher cost; kept as fallback |
| Capacitor (mobile) + Electron (desktop) | Web-first like Tauri | Electron bundle size; two wrapper ecosystems | Tauri covers both with one toolchain |
| PWA only | Zero packaging | No store presence, limited native APIs, iOS PWA restrictions | Stores and deep native features are wanted |

## Consequences

- Positive: near-100 % code sharing; small binaries; Rust shell with capability allowlists.
- Negative: WebView differences (WKWebView WebGL limits, Android WebView versions); app-store
  review risk for "web wrapper" apps mitigated by real native value (offline, deep links,
  share, haptics).
- Fallback: if SP3 fails, ship mobile as 2D-only PWA/Tauri first and open an ADR for an Expo
  app reusing `@maze/core` and `@maze/contracts`.
- Follow-ups: S11.1-S11.5.

## Compliance

No direct `window.__TAURI__`/plugin imports outside `apps/web/src/platform/tauri/*`.
