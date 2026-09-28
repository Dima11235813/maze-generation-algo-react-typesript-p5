# 11 - Multi-Platform: Web, Desktop and Mobile from One Codebase

> Status: Proposed | Last updated: 2026-09-27
> Decisions referenced: D-04, D-05, D-06, D-12, D-13, D-14, D-15, D-17
> ADRs: [ADR-012](./adr/ADR-012-multi-platform.md), [ADR-005](./adr/ADR-005-web-app-stack.md),
> [ADR-004](./adr/ADR-004-rendering-abstraction.md)

## 1. Goal

Ship Maze Lab as:

| Target | Form | Distribution |
|--------|------|--------------|
| Web | Installable PWA | Firebase Hosting (D-13) |
| Desktop | Windows, macOS, Linux native windows | Direct download with auto-update; optional stores |
| Mobile | iOS and Android apps | Apple App Store, Google Play |

from **one React codebase** (`apps/web`), with `@maze/core`, `@maze/renderer`, `@maze/player`,
`@maze/ui` and `@maze/contracts` shared 100 % across all targets. D-12 selects **PWA + Tauri 2**.
This document records the trade-off analysis for the record, then specifies how the shared code
adapts to each platform.

## 2. Options analysis (for the record; decision is D-12)

| Criterion | (a) PWA + Tauri 2 (chosen) | (b) Expo / React Native universal (react-native-web, Skia or expo-gl) | (c) Capacitor (mobile) + Electron (desktop) | (d) PWA only |
|-----------|----------------------------|------------------------------------------------------------------------|---------------------------------------------|--------------|
| UI code shared | ~98 % (one React DOM app; platform port only) | ~85 % (RN primitives; web needs RNW shims; DOM-only libs unusable) | ~95 % | 100 % |
| Native feel | Good: native window chrome, menus, tray, notifications; web UI inside | Best on mobile (native views, gestures) | Good | Limited (no store presence, iOS install friction) |
| WebGL / canvas performance | Desktop: system WebView (WebView2 / WKWebView / WebKitGTK) is near-Chrome; iOS WKWebView WebGL is good but memory-constrained (see spike, section 12) | Skia/expo-gl fast, but requires rewriting `@maze/renderer` adapters for RN; three.js works via expo-gl with caveats | Same WebView story as (a) on mobile; Chromium on desktop | Browser-native |
| Bundle / install size | Desktop 5-15 MB; mobile ~ 10 MB | Mobile 30-60 MB; web larger due to RNW | Desktop 150 MB+ (Chromium); mobile ~ 15 MB | n/a |
| Build and signing complexity | Rust toolchain + per-OS signing; Tauri CLI handles bundles | EAS Build/Submit handles most signing; two runtimes to reason about | Two unrelated toolchains | None |
| Store policy risk (web-wrapped apps) | Medium: must show native value (offline, deep links, share, haptics); same as (c) | Low | Medium | n/a |
| Offline | Workbox + Tauri fs; full offline library | Full | Full | Workbox only; iOS storage eviction risk |
| Plugin ecosystem | Tauri 2 official plugins cover fs, dialog, notification, deep-link, store, updater, haptics, biometric | Expo SDK is the richest | Capacitor plugins mature | Web APIs only |
| Team skill fit | React + TS already; Rust only for rare custom commands | New paradigm (RN styling, navigation, no DOM) | React + TS | React + TS |
| Rendering abstraction impact | None: `canvas2d` and `three` adapters run unchanged | New adapters (`skia`, `expo-gl`) and a DOM-less `dom` a11y adapter equivalent | None | None |
| Verdict | **Chosen** | Fallback if the iOS WebGL spike fails | Superseded by (a): Tauri covers both | Insufficient (no stores, no desktop) |

## 3. Chosen architecture

```
apps/web        Vite + React 19 -> dist/            (the only UI)
apps/desktop    Tauri 2 project: frontendDist = ../web/dist, targets win/mac/linux
apps/mobile     Tauri 2 project: frontendDist = ../web/dist, targets ios/android
```

- `apps/desktop` and `apps/mobile` contain **no React code**: `tauri.conf.json`, capability
  files, icons, Rust `src-tauri/` with a handful of commands, and platform assets.
- They could be a single Tauri project with per-target config; two folders are used so
  capabilities, signing and store metadata stay separate and the mobile spike can be dropped
  without touching desktop.
- `apps/web` is built once per release with `VITE_PLATFORM=web|tauri`; the Tauri projects consume
  the `tauri` build. Web-only features (install prompt, service worker) are compiled out in the
  Tauri build; Tauri-only features (native menus, updater) are compiled out on the web.

## 4. The `platform` port

Defined in 03 section 7 and expanded here. It is a small set of **capability interfaces**
(Interface Segregation) with a `web` adapter and a `tauri` adapter, selected at build time via
a Vite alias so the unused adapter is not bundled.

```ts
// packages/platform/src/ports.ts  (or apps/web/src/platform/ports.ts)
export interface FilePort {
  saveFile(opts: { suggestedName: string; mime: string; data: Blob | string }): Promise<void>;
  openFile(opts: { accept: string[] }): Promise<File | null>;
}
export interface SharePort   { canShare(): boolean; share(data: { title: string; text?: string; url: string }): Promise<void>; }
export interface NotifyPort  { requestPermission(): Promise<boolean>; notify(n: { title: string; body: string; tag?: string }): Promise<void>; }
export interface DeepLinkPort { onOpen(cb: (url: URL) => void): () => void; }
export interface SecureStorePort { get(key: string): Promise<string | null>; set(key: string, v: string): Promise<void>; remove(key: string): Promise<void>; }
export interface HapticsPort { impact(style: 'light' | 'medium' | 'heavy'): Promise<void>; selection(): Promise<void>; }
export interface WindowPort  { setFullscreen(on: boolean): Promise<void>; isFullscreen(): Promise<boolean>; setTitle(t: string): Promise<void>; }
export interface PlatformInfo { kind: 'web' | 'tauri'; os: 'windows' | 'macos' | 'linux' | 'ios' | 'android' | 'unknown'; pointer: 'fine' | 'coarse'; }
```

| Capability | `web` adapter | `tauri` adapter |
|------------|---------------|-----------------|
| File save/open (maze import/export as `.maze.json`, PNG, SVG, PDF) | File System Access API where available; `<a download>` + `<input type=file>` fallback | `@tauri-apps/plugin-dialog` + `@tauri-apps/plugin-fs` |
| Share | Web Share API; clipboard fallback with toast | Share via OS sheet (`tauri-plugin-share` community / `shell.open` for mailto); clipboard fallback |
| Notifications ("race finished", "sync complete") | Notification API; no-op if denied | `@tauri-apps/plugin-notification` |
| Deep links `mazelab://m/<id>` and `https://mazelab.app/m/<id>` | Router handles `https` path directly | `@tauri-apps/plugin-deep-link` registers scheme + universal/app links; forwards to router |
| Secure storage (refresh token on mobile/desktop) | Not used: web uses httpOnly cookie (D-10) | `@tauri-apps/plugin-stronghold` (or OS keychain via `tauri-plugin-keyring`) |
| Haptics | Vibration API on Android Chrome; no-op elsewhere | `@tauri-apps/plugin-haptics` (mobile) |
| Window / fullscreen | Fullscreen API | `@tauri-apps/api/window` |
| Updater | n/a (service worker refresh prompt) | `@tauri-apps/plugin-updater` (desktop only; mobile updates through stores) |

Selection:

```ts
// vite.config.ts
resolve: { alias: { '@platform': process.env.VITE_PLATFORM === 'tauri' ? './src/platform/tauri' : './src/platform/web' } }
```

Rule: **no `window.__TAURI__` checks in feature code**. Features import from `@platform` and
call `platform.info.kind` only for copy/UI hints ("Install app" vs "Check for updates").

## 5. Tauri 2 specifics

### 5.1 Capabilities and permissions

Tauri 2 denies all plugin commands by default; each window gets an allowlist in
`src-tauri/capabilities/*.json`.

```jsonc
// apps/desktop/src-tauri/capabilities/main.json
{
  "identifier": "main-window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "dialog:allow-open", "dialog:allow-save",
    { "identifier": "fs:allow-read-file",  "allow": [{ "path": "$DOWNLOAD/**" }, { "path": "$DOCUMENT/MazeLab/**" }] },
    { "identifier": "fs:allow-write-file", "allow": [{ "path": "$DOWNLOAD/**" }, { "path": "$DOCUMENT/MazeLab/**" }] },
    "notification:default", "deep-link:default", "os:allow-platform",
    "updater:default", "shell:allow-open", "stronghold:default", "window:allow-set-fullscreen"
  ]
}
```

Mobile capability file additionally grants `haptics:default` and omits `updater` and `shell`.

### 5.2 Content Security Policy

`tauri.conf.json` `app.security.csp` mirrors the web CSP from 07-security, with `ipc:` and
`http://ipc.localhost` allowed for the bridge, `connect-src` limited to the API origin, Sentry
and Identity Platform, and `script-src 'self'` (Tauri injects nonces for its own scripts).
`dangerousDisableAssetCspModification` stays `false`.

### 5.3 Plugin list

| Plugin | Desktop | Mobile | Purpose |
|--------|---------|--------|---------|
| `plugin-fs`, `plugin-dialog` | yes | yes | Import/export mazes |
| `plugin-shell` (`open` only) | yes | no | Open docs links in default browser |
| `plugin-store` | yes | yes | Non-secret prefs cache (mirrors localStorage; survives WebView data clears) |
| `plugin-stronghold` | yes | yes | Refresh token / offline session |
| `plugin-deep-link` | yes | yes | `mazelab://` and universal/app links |
| `plugin-notification` | yes | yes | Race finished, sync complete |
| `plugin-os` | yes | yes | `PlatformInfo.os` |
| `plugin-haptics` | no | yes | Wall bump, selection ticks |
| `plugin-updater` + `plugin-process` | yes | no | Signed auto-update |
| `plugin-window-state` | yes | no | Remember window size/position |
| `plugin-single-instance` | yes | no | Deep links focus the existing window |

### 5.4 Updater

- Release workflow (D-14) builds all desktop bundles, signs them with the Tauri updater
  key pair (private key in GitHub Encrypted Secrets, public key in `tauri.conf.json`), and
  publishes `latest.json` to a GitHub Release. The app checks on launch and offers "Restart to
  update"; silent updates are never applied mid-race.
- Mobile updates ship through the stores; the web bundle inside is **not** hot-swapped (store
  policy compliance).

## 6. Code signing

| OS | Requirement | Plan |
|----|-------------|------|
| Windows | Authenticode signature; unsigned installers trigger SmartScreen | Azure Trusted Signing (pay-as-you-go, no hardware token) or an EV certificate; `tauri-action` signs `.msi`/`.exe` in CI |
| macOS | Developer ID signing + notarisation; hardened runtime | Apple Developer Program (USD 99/yr); `APPLE_ID`, app-specific password, team id in CI secrets; `tauri-action` notarises `.dmg`/`.app` |
| Linux | No hard requirement; AppImage/deb/rpm; optional GPG signature | Publish `.AppImage` + `.deb` + `.rpm`; sign checksums with a release GPG key; consider Flathub later |
| Android | Upload key + Play App Signing | Keystore in CI secrets (base64); Play App Signing enrolled; AAB uploaded via `r0adkll/upload-google-play` or Fastlane |
| iOS | Distribution certificate + provisioning profile; App Store Connect | Fastlane `match` with a private git repo for certs; `tauri ios build --export-method app-store-connect`; TestFlight for betas |

Secrets live in GitHub Environments (`release`) with required reviewers (07-security).

## 7. Store distribution

| Channel | Decision | Notes |
|---------|----------|-------|
| Direct download (Win/mac/Linux) | **Yes, primary desktop channel** | GitHub Releases + a `/download` page; updater handles upgrades |
| Microsoft Store | Optional, phase 7+ | MSIX packaging via Tauri; Store handles updates then (disable updater in that build) |
| Mac App Store | Optional, phase 7+ | Requires sandbox entitlements; `fs` access limited to user-selected files, which our `FilePort` already assumes |
| Google Play | **Yes** | Target latest API level; data-safety form (analytics, crash reports, account data) |
| Apple App Store | **Yes** | Guideline 4.2 (minimum functionality) risk for web-wrapped apps; mitigations below |
| F-Droid | No (proprietary services: Sentry, Identity Platform) | Revisit if an OSS build variant appears |

Apple review mitigations (must be visibly present in the iOS build): full **offline** library
and offline play/generation; **deep links** and universal links; **native share**; **haptics**;
system-integrated **sign in with Apple** when other social logins are offered (App Store rule
4.8); no web-page-like navigation chrome; native-looking safe-area layout. These are features
we want anyway, so they are not throwaway work.

## 8. PWA specifics (`apps/web`)

- Fix the placeholder manifest: `name: "Maze Lab"`, `short_name: "Maze Lab"`, description,
  `id`, `start_url: "/"`, `display: "standalone"`, `theme_color`/`background_color` from tokens,
  maskable icons at 192/512 plus monochrome icon, `screenshots` (required for the richer
  install UI), `shortcuts` (Play, Build, Watch), `share_target` optional later.
- Install prompt: capture `beforeinstallprompt`, show an unobtrusive "Install" entry in the
  account menu, never a modal on first visit.
- Service worker via `vite-plugin-pwa` (Workbox, `injectManifest`):

| Resource | Strategy |
|----------|----------|
| App shell, JS/CSS chunks (hashed) | Precache; `CacheFirst` |
| three.js chunk | Precache on idle after first 3D use; `CacheFirst` |
| `/api/mazes/:id` (public mazes) | `StaleWhileRevalidate`, max 200 entries, 7 days |
| `/api/me`, `/api/mazes?mine` | `NetworkFirst`, 3 s timeout, fall back to cache |
| Save/solve POSTs while offline | Background Sync queue (`workbox-background-sync`) mirroring the Dexie outbox from 03 section 7 |
| Fonts | `CacheFirst`, 1 year |

- Offline library: `MazeDocument`s saved locally in IndexedDB (Dexie) are playable and editable
  offline; sync status is shown per maze. Storage persistence requested via
  `navigator.storage.persist()` to reduce eviction on iOS Safari.
- Update flow: new service worker waits; toast "Update available - Reload"; never reload
  mid-race or mid-edit.

## 9. Responsive and adaptive UI rules

| Concern | Rule |
|---------|------|
| Breakpoints | Tailwind defaults (`sm 640`, `md 768`, `lg 1024`, `xl 1280`); container queries inside panels so components adapt to their slot, not the viewport |
| Layout modes | `< md`: canvas full-bleed, controls in a bottom sheet; `>= md`: right side panel; `>= xl`: optional second panel (pseudo-code / metrics) |
| Pointer type | `@media (pointer: coarse)` switches to 44 px targets, shows the on-screen d-pad in Play, hides hover-only affordances; `(hover: hover)` gates tooltips |
| Safe areas | `env(safe-area-inset-*)` padding on the app shell; `viewport-fit=cover`; Tauri mobile windows are edge-to-edge |
| Orientation | Both supported; landscape on phones hides the header behind a swipe; maze re-fits without regeneration (P-13) |
| Virtual keyboard | `interactive-widget=resizes-content`; inputs in sheets scroll into view; canvas region does not steal focus while an input is active |
| Density | `devicePixelRatio`-aware canvas sizing capped at 2x on mobile to bound memory |

## 10. Input abstraction

An `InputSource` layer in `@maze/player` normalises all inputs to **intents**
(`move(N|E|S|W)`, `turn(L|R)`, `peek(on|off)`, `toggleWall(dir)`, `play/pause`, `step(+/-)`,
`zoom(delta)`, `pan(dx,dy)`), so game logic never sees raw events and every intent has a
keyboard equivalent (10-accessibility section 4).

| Source | Platform | Mapping |
|--------|----------|---------|
| Keyboard | all | Shortcut map from 10-accessibility, remappable |
| Gamepad API | desktop (and Bluetooth pads on mobile browsers) | D-pad/left stick -> move; A -> play/pause; bumpers -> speed; polled in the Step Player tick only when a pad is connected |
| Touch gestures | mobile | Swipe (>= 24 px, < 300 ms) -> move one cell in that direction; pinch -> zoom; two-finger drag -> pan; long-press (500 ms) on a wall in Build -> toggle; double-tap -> play/pause |
| On-screen d-pad | mobile Play mode (auto when pointer: coarse) | Four 56 px buttons + peek button; hideable |
| Pointer (mouse/pen) | all | Click cell -> select/toggle (Build); drag -> pan (2D) or orbit (3D); wheel -> zoom |
| Accessibility tech | all | Acts through the `dom` adapter's grid; same intents |

Gestures always have a visible alternative (2.5.1/2.5.7): the d-pad, zoom +/- buttons, and
wall toggle buttons in the cell inspector.

## 11. Rendering per platform

| Topic | Web (Chromium/Firefox/Safari) | Tauri desktop (WebView2 / WKWebView / WebKitGTK) | Tauri iOS (WKWebView) | Tauri Android (Chromium WebView) |
|-------|-------------------------------|--------------------------------------------------|-----------------------|----------------------------------|
| WebGL 2 | Yes | Yes (WebKitGTK may fall back to software on some distros: detect and force 2D) | Yes; GPU memory limits are tight; context loss must be handled | Yes |
| OffscreenCanvas + Worker rendering | Chromium/Firefox yes; Safari partial | WebView2 yes; WKWebView partial | Partial: keep `canvas2d` rendering on main thread, run algorithms in a Worker | Yes |
| `devicePixelRatio` | 1-3 | 1-2 | 2-3: cap backing store at 2x | 2-3.5: cap at 2x |
| three.js chunk | Lazy-loaded on first 3D use | Same | Same; lower default instance counts; disable mirror by default | Same |
| Context loss | `webglcontextlost` -> pause player, rebuild scene on restore | Same | Most likely here; tested in the spike | Same |
| Fonts/UI | System font stack | Same | Same | Same |

The `three` adapter exposes a `quality` preset (`low/medium/high`) chosen from `PlatformInfo`
and a first-frame benchmark; users can override it.

## 12. iOS WebGL performance spike (from 03 section 13)

Two-day spike before Phase 6, run on a real mid-range iPhone (current minus two generations)
and an iPad, using a throwaway Tauri iOS project loading the Phase-2 web build.

| Test | Pass criterion |
|------|----------------|
| 3D view of a 60x40 maze with cube projection and mirror on | >= 45 fps sustained for 60 s; no context loss |
| 2D playback of BFS on 200x200 at 32x speed | >= 55 fps; main thread long tasks < 50 ms |
| Memory | Peak WebView memory < 600 MB; no jetsam kill in 10 min of use |
| Interaction | Swipe-to-move latency < 100 ms perceived; pinch zoom smooth |
| Suspension/resume | App backgrounded 5 min, resumed: scene restored, Step Player paused at the same step |

**Go**: all criteria pass -> continue with Tauri mobile (D-12 stands).
**No-go**: any criterion fails after one day of tuning (quality preset `low`, mirror off,
instance caps) -> record the result in ADR-012, keep Tauri for desktop, and open a new ADR to
build `apps/mobile` with Expo, reusing `@maze/core`, `@maze/contracts` and `@maze/player`
(non-React parts) and writing `skia`/`expo-gl` renderer adapters. UI would be re-implemented
with RN primitives; this is the ~15 % non-shared cost estimated in section 2.

## 13. Performance budgets per platform

| Budget | Web | Desktop | Mobile |
|--------|-----|---------|--------|
| Initial route JS (gzip, excl. three) | < 250 kB (03 section 12) | same bundle | same bundle |
| Time to interactive on `/play` | < 2.5 s on 4G / mid-range laptop | < 1.5 s | < 3 s on mid-range phone |
| 2D generation 100x100 to first frame | < 200 ms | < 150 ms | < 400 ms |
| 3D 60x40 frame rate | 60 fps | 60 fps | 45 fps (quality `medium`) |
| Installer / app size | n/a (PWA precache < 5 MB) | < 15 MB | < 30 MB |
| Cold start (Tauri) | n/a | < 1 s to window | < 2 s to splash dismiss |

Budgets are enforced with Lighthouse CI (web), a startup-time smoke test with `tauri-driver`
(desktop) and a manual/Maestro measurement on the device farm (mobile) per release.

## 14. Testing matrix

| Layer | Web | Desktop | Mobile |
|-------|-----|---------|--------|
| Unit / component | Vitest + RTL + Storybook (D-15) | shared | shared |
| E2E functional | Playwright (Chromium, Firefox, WebKit) incl. axe | `tauri-driver` (WebDriver) smoke: launch, open maze, save file, deep link, update check (Windows + Linux runners; macOS via self-hosted or skipped) | Maestro flows on Android emulator and iOS simulator: launch, generate, play 5 moves, save offline, deep link |
| Visual regression | Playwright screenshots per theme/reduced-motion | Screenshot of main window at 2 sizes | Screenshots at 2 device sizes |
| Platform adapters | Unit tests with mocked Web APIs | Unit tests with mocked `@tauri-apps/*` (`mockIPC`) | same |
| Real devices | BrowserStack Live (Safari iOS, Chrome Android) for the PWA | Manual on 3 OSes before release | BrowserStack App Live or a small device lab (2 iOS, 2 Android) |
| Store pre-checks | n/a | MSIX/App Store validators when opted in | Play pre-launch report; TestFlight beta |

## 15. Release cadence

| Platform | Cadence | Mechanism |
|----------|---------|-----------|
| Web (PWA) | Continuous: every merge to `main` -> Firebase preview channel; tag -> production | GitHub Actions (D-14) |
| Desktop | Every minor version (roughly monthly) + hotfixes | `tauri-action` builds, signs, publishes GitHub Release + `latest.json`; updater rolls out |
| Android | Every minor version; staged rollout 10 % -> 50 % -> 100 % | Play Console via Fastlane in the release workflow |
| iOS | Every minor version; TestFlight for 1 week before store submission | Fastlane `deliver`/`pilot` |
| API compatibility | Web ships first; mobile/desktop builds pin a minimum API version; API keeps N-1 contract compatibility for a deprecation window of at least 6 months (04-backend-rewrite) | Version header + feature flags |

## 16. Effort estimate

Ideal engineering weeks for one developer with coding agents; rolls into Phase 6 of
[14-roadmap.md](./14-roadmap.md) except where noted.

| Workstream | Estimate (weeks) | Phase |
|------------|------------------|-------|
| MP-1 `platform` port with `web` adapter, Vite alias wiring, PWA manifest/service worker/offline library | 1.0 | 2 |
| MP-2 Responsive layout modes, pointer-type adaptation, on-screen d-pad, touch gestures, gamepad | 1.0 | 2-3 |
| MP-3 `apps/desktop`: Tauri 2 project, capabilities, CSP, plugins, `tauri` adapter, updater, window state, single instance | 1.0 | 6 |
| MP-4 Desktop signing + release pipeline (Windows, macOS notarisation, Linux bundles), download page | 0.5 | 6 |
| MP-5 iOS WebGL spike (go/no-go) | 0.5 | 5-6 boundary |
| MP-6 `apps/mobile`: Tauri 2 iOS/Android projects, safe areas, haptics, deep/universal links, secure storage, store assets | 1.0 | 6 |
| MP-7 Mobile signing, Fastlane, TestFlight/Play internal track, store listings and review mitigations | 0.5 | 6 |
| MP-8 Testing matrix: `tauri-driver` smoke, Maestro flows, device-farm setup | 0.5 | 6 |
| **Total** | **6.0** | (of which 2.0 land in Phases 2-3) |

If the spike returns **no-go**, add an estimated 4-6 weeks for an Expo `apps/mobile` with RN UI
and renderer adapters; this contingency is listed as a risk in 14-roadmap, not in the base plan.
