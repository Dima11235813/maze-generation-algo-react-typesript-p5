# 10 - Accessibility

> Status: Proposed | Last updated: 2026-09-27
> Decisions referenced: D-04, D-06, D-15, D-17
> ADRs: [ADR-017](./adr/ADR-017-accessibility-baseline.md), [ADR-004](./adr/ADR-004-rendering-abstraction.md),
> [ADR-006](./adr/ADR-006-ui-kit.md)

A maze playground that teaches computer science must be usable by people who cannot see the
canvas, cannot use a mouse, or cannot tolerate motion. D-17 makes **WCAG 2.2 Level AA** a
release gate. This document turns that decision into architecture, interaction design,
theming rules and a test plan.

---

## 1. Current state findings (legacy app)

| # | Finding | WCAG SC | Severity |
|---|---------|---------|----------|
| A-01 | `public/index.html` sets `<meta name="viewport" ... user-scalable=no ...>`; pinch-zoom is disabled | 1.4.4 Resize Text, 1.4.10 Reflow | High |
| A-02 | All maze content is drawn on a WebGL canvas with no text alternative, no DOM equivalent, no `aria-label` | 1.1.1 Non-text Content, 1.3.1 Info and Relationships | Critical |
| A-03 | Visited / current / stack-depth state is conveyed by colour only (green shade, blue highlight) | 1.4.1 Use of Color | High |
| A-04 | Options drawer (`SwipeableDrawer`) opens without moving focus into it and `role="presentation"` wraps interactive controls; the placeholder "Left"/"Right" buttons are unlabeled | 2.4.3 Focus Order, 4.1.2 Name Role Value | High |
| A-05 | Keyboard handling for "Run Maze" is a `document`-level `keydown` listener registered in a store constructor, uses deprecated `keyCode`, cannot be turned off, and is not discoverable | 2.1.1 Keyboard, 2.1.2 No Keyboard Trap, 3.3.2 Labels or Instructions | High |
| A-06 | `<title>React App</title>`; manifest name "Create React App Sample" | 2.4.2 Page Titled | Medium |
| A-07 | Continuous 3D animation (cube projection, mirror, mouse-following light, sine-driven depth) with no `prefers-reduced-motion` handling and no pause control | 2.2.2 Pause Stop Hide, 2.3.3 Animation from Interactions | High |
| A-08 | Colour contrast never checked; default wall colour is white at 100/255 alpha over a user-chosen background | 1.4.3 Contrast (Minimum), 1.4.11 Non-text Contrast | Medium |
| A-09 | Colour pickers (`react-color` `SketchPicker`) are not keyboard operable | 2.1.1 Keyboard | High |
| A-10 | `IconButton` with `aria-label="menu"` does nothing; empty `IconButton` in the sidebar | 4.1.2 | Low |
| A-11 | Header hides on scroll (`HideOnScroll`), so the only navigation can disappear while focused | 2.4.11 Focus Not Obscured (Minimum) | Medium |
| A-12 | No skip link, no landmarks (`<main>`, `<nav>`) | 2.4.1 Bypass Blocks, 1.3.1 | Medium |

None of these are fixed in place; they are design inputs for `apps/web` and `@maze/ui`.

## 2. Target standard and mapping to design decisions

Target: **WCAG 2.2 Level AA**, plus selected AAA criteria where cheap (2.3.3, 2.4.12). The
criteria most relevant to a canvas-heavy interactive application and the decision that
satisfies each:

| SC | Name | How we satisfy it |
|----|------|-------------------|
| 1.1.1 | Non-text Content | `dom` renderer adapter mirrors the maze as an ARIA grid (section 3.1); every mode has a textual summary |
| 1.3.1 | Info and Relationships | Semantic landmarks; grid semantics; Step log as an ordered list; controls grouped with `fieldset`/`legend` |
| 1.4.1 | Use of Color | Every coloured state also has a pattern, glyph or text (section 5.3) |
| 1.4.3 | Contrast (Minimum) | Token palette validated at 4.5:1 for text, enforced by a unit test over the token file |
| 1.4.4 | Resize Text | Viewport meta allows zoom; layout uses `rem`; no fixed pixel heights on text containers |
| 1.4.10 | Reflow | Responsive to 320 CSS px; canvas region scrolls independently; controls collapse into a sheet |
| 1.4.11 | Non-text Contrast | Wall/passage and frontier/visited overlays >= 3:1 against background in every theme; slider/toggle outlines >= 3:1 |
| 1.4.12 | Text Spacing | No clipping when line-height 1.5 / letter-spacing 0.12em are forced (Storybook story with the override) |
| 1.4.13 | Content on Hover or Focus | Tooltips dismissible with `Esc`, hoverable, persistent (Radix Tooltip defaults) |
| 2.1.1 | Keyboard | Every action in section 4 has a key; drags have click alternatives |
| 2.1.2 | No Keyboard Trap | Canvas region is a single tab stop; `Esc` always returns focus to the toolbar |
| 2.1.4 | Character Key Shortcuts | Single-key shortcuts (WASD, V, P, Space) active only while the canvas region has focus; remappable in settings |
| 2.2.2 | Pause, Stop, Hide | Step Player is the only animation source; global pause; auto-play off by default for Watch/Race |
| 2.3.1 | Three Flashes | Overlay changes are rate-limited to < 3 full-canvas flashes per second (section 6) |
| 2.3.3 | Animation from Interactions (AAA, adopted) | `prefers-reduced-motion` disables parallax, mirror, cube rise/fall, camera easing |
| 2.4.1 | Bypass Blocks | Skip link to `main`; landmarks |
| 2.4.2 | Page Titled | Route-level titles: "Play - Maze Lab", "Build - 30x20 maze - Maze Lab" |
| 2.4.3 | Focus Order | Focus moves into dialogs/sheets on open and back to the trigger on close (Radix); roving tabindex in toolbars |
| 2.4.7 | Focus Visible | 2 px outline token with >= 3:1 contrast in all themes; never `outline: none` without replacement |
| 2.4.11 | Focus Not Obscured (Minimum) | No auto-hiding header; sticky bars reserve space; focused element scrolled into view |
| 2.5.1 | Pointer Gestures | Pinch-zoom and swipe have button/keyboard equivalents |
| 2.5.7 | Dragging Movements | Wall-painting drag has click-to-toggle; slider thumbs have +/- buttons and typed input |
| 2.5.8 | Target Size (Minimum) | 24x24 CSS px minimum everywhere; 44x44 on touch layouts |
| 3.2.6 | Consistent Help | Help/shortcuts entry point in the same toolbar position on every route |
| 3.3.1 / 3.3.3 | Error Identification / Suggestion | zod messages rendered next to the field with `aria-describedby`; summary region on submit |
| 3.3.7 | Redundant Entry | Maze name/tags pre-filled from previous save |
| 3.3.8 | Accessible Authentication (Minimum) | Passkeys and OAuth (D-10); no cognitive tests; paste allowed in password fields |
| 4.1.2 | Name, Role, Value | shadcn/Radix primitives; custom canvas region exposes `role="application"` only inside the grid, never on the page |
| 4.1.3 | Status Messages | Live regions for "maze generated", "saved", "solver finished in N steps" |

## 3. Canvas accessibility architecture

The visual renderers (`canvas2d`, `three`) are pixels. Accessibility comes from the parallel
**`dom` renderer adapter** defined in 03 section 5 and from the **Step stream** in 03 section 3.
Both are fed by the same `MazeState` and `Step` objects, so there is one source of truth
and no separate "accessible mode" to fall out of sync.

### 3.1 `dom` adapter: the ARIA grid

```
<div role="region" aria-labelledby="maze-title" aria-describedby="maze-summary" tabindex="0" class="sr-canvas-host">
  <p id="maze-summary">30 by 20 maze, start top-left, goal bottom-right. Generated with Prim's algorithm, seed "oak-7". 12 dead ends.</p>
  <div role="grid" aria-rowcount="20" aria-colcount="30" aria-label="Maze cells">
    <div role="row" aria-rowindex="1">
      <div role="gridcell" aria-colindex="1" aria-label="Row 1, column 1. Start. Open: east. Walls: north, south, west." tabindex="-1"></div>
      ...
```

Rules:

- The grid is **virtualised**: only rows within a configurable window around the cursor (default
  +/- 5 rows) are in the DOM; `aria-rowcount`/`aria-colcount` give the full size. A 500x500 maze
  never renders 250 000 nodes.
- Each `gridcell` label is generated by `describeCell(maze, id, overlay)` in `@maze/core`: position,
  role (start/goal/current/on-path/frontier/visited/dead end), open directions, wall directions.
  Labels are the same strings the narrator speaks (section 3.2) and the tests assert on.
- A **"describe region"** command (`R`) reads a summary of the 3x3 or 5x5 neighbourhood; **"describe
  route so far"** (`Shift+R`) reads the current path length and turns.
- The `dom` adapter is **always mounted** beside a visual adapter (D-17). It is visually hidden
  (`sr-only`) except in the "Text view" toggle, where it becomes a visible, zoomable text grid
  that doubles as a low-vision mode and a print fallback.
- Focus lives on one cell at a time (roving `tabindex`); the visual renderer draws a focus ring
  at the same cell so sighted keyboard users get the same affordance.

### 3.2 Narrator: live-region verbalisation of Steps

`@maze/player` exposes a `Narrator` subscriber that converts `GenStep`/`SolveStep` into short
sentences and pushes them to an `aria-live` region.

| Verbosity | What is announced | Typical use |
|-----------|-------------------|-------------|
| `off` | Nothing (status messages still fire) | Sighted users |
| `low` | Milestones only: started, 25/50/75 %, backtracked to start, path found (length), done | Default for screen-reader users during playback |
| `medium` | Every N-th step, batched: "Carved 12 passages toward the east side; stack depth 34" | Learning with playback at low speed |
| `high` | Every step: "Expand row 4 column 9, cost 13. Discovered 2 neighbours." | Single-stepping in Learn mode |

Implementation details:

- `aria-live="polite"` for step narration; `role="status"` for milestones; `role="alert"` only for
  errors. Announcements are coalesced per animation frame and throttled to one utterance per
  750 ms at `medium`, so assistive tech is never flooded.
- Playback speed above 4x automatically drops verbosity to `low` and says so once.
- A **Step log panel** (visible, `<ol>`) shows the same sentences with timestamps and is
  searchable; it is the textual equivalent of the animation (1.1.1, 1.2.x-style parity).
- **Sonification (optional, off by default)**: pitch mapped to frontier size or path cost, a
  click per step, distinct timbres per agent in Race mode. Uses the Web Audio API; respects the
  OS "reduce sound" preference where exposed and has its own toggle.

## 4. Keyboard model per mode

All shortcuts are active only while the canvas region has focus (2.1.4) and are listed in a
shortcuts dialog (`?`). Every shortcut is remappable in `/account` settings; conflicts are
detected. Vim-style keys are an opt-in preset.

### 4.1 Play (you solve the maze)

| Action | Keys |
|--------|------|
| Move north / east / south / west | Arrow keys, `W A S D`, (vim: `K L J H`) |
| Turn left / right (first-person) | `Q` / `E`, or Shift+Left / Shift+Right |
| Peek over walls (first-person) | hold `P` |
| Where am I | `I` - announces position, open directions, distance to goal if hints on |
| What is around me | `R` - describes 3x3 neighbourhood |
| Undo last move / restart | `Backspace` / `Shift+Home` |
| Toggle 2D / 3D | `T` |
| Toggle text view | `Alt+T` |
| Leave canvas, focus toolbar | `Esc` |

### 4.2 Build (edit a maze)

| Action | Keys |
|--------|------|
| Move cell cursor | Arrow keys |
| Toggle wall north / east / south / west of cursor | `Shift+Arrow` |
| Toggle all walls of cursor (isolate / open) | `X` |
| Set start / goal at cursor | `Home` / `End` |
| Jump to start / goal | `G S` / `G G` |
| Resize grid | `Ctrl+Shift+Arrow` (announces new size) |
| Generate with current algorithm | `Ctrl+Enter` |
| Undo / redo | `Ctrl+Z` / `Ctrl+Shift+Z` |
| Paint mode (hold to toggle walls while moving) | hold `Space` - drag alternative per 2.5.7 |

### 4.3 Watch and Race (algorithms run)

Media-style controls following common player shortcuts:

| Action | Keys |
|--------|------|
| Play / pause | `Space` or `K` |
| Step forward / back | `.` / `,` (also Right / Left when paused) |
| Speed up / down | `>` / `<` or `Shift+.` / `Shift+,` |
| Seek to start / end | `Home` / `End` |
| Jump to next milestone (backtrack, dead end, path found) | `N` / `Shift+N` |
| Switch focused agent (Race) | `1` / `2` or `Tab` inside the agents legend |
| Toggle narrator verbosity | `Alt+V` cycles off/low/medium/high |
| Open pseudo-code panel / data-structure view | `C` / `D` |

### 4.4 Toolbars, panels and dialogs

- Toolbars use the **roving tabindex** pattern: one tab stop, arrows move between buttons.
- Side panels (`Sheet`) and dialogs trap focus while open, return focus to the trigger on close,
  close on `Esc` (Radix behaviour).
- Sliders: arrows +/- 1, PageUp/PageDown +/- 10, Home/End min/max, plus a numeric input.
- The colour picker exposes hue/saturation/lightness as three labelled sliders and a hex input;
  the 2D saturation/lightness area is an enhancement, never the only path.
- Skip link "Skip to maze" is the first focusable element on every route.

## 5. Colour, theming and non-colour redundancy

### 5.1 Tokens

All colours are CSS custom properties defined once in `@maze/ui/tokens.css` and consumed by
Tailwind v4 (`@theme`) and by `RenderTheme` in `@maze/renderer`. Themes: `light`, `dark`,
`high-contrast`; palettes: `default`, `okabe-ito`, `custom`.

A Vitest test loads the token file, computes WCAG contrast for every documented pair
(text/background, non-text/background, overlay/overlay) and fails below 4.5:1 (text) or 3:1
(non-text). Custom user palettes are checked live; the picker shows the ratio and a warning
badge, and offers "nearest accessible colour".

### 5.2 Colour-blind-safe overlay palette

Overlay states (frontier, visited, current, path, dead end, agent A, agent B) use the
**Okabe-Ito** palette by default and are additionally distinguished by shape/pattern:

| State | Colour (Okabe-Ito) | Redundant cue |
|-------|--------------------|---------------|
| Frontier | sky blue `#56B4E9` | Dotted border |
| Visited | light grey `#BBBBBB` | Diagonal hatch |
| Current | vermillion `#D55E00` | Pulsing ring (static thick ring under reduced motion) + focus glyph |
| Path | bluish green `#009E73` | Solid centre line with arrowheads |
| Dead end | yellow `#F0E442` | "x" glyph |
| Agent A / Agent B | blue `#0072B2` / orange `#E69F00` | Circle / triangle markers; labels "A" / "B" |
| Start / Goal | black / reddish purple `#CC79A7` | "S" / "G" glyphs and flag icon |

### 5.3 Theme behaviours

- `prefers-color-scheme` selects light/dark unless overridden.
- `prefers-contrast: more` selects `high-contrast` (pure black/white, 7:1 text, thick walls).
- `prefers-reduced-motion: reduce` (or the in-app override) disables: mirror animation, cube
  rise/fall easing, mouse-following light and parallax, camera fly-throughs; Step Player
  playback becomes discrete jumps at <= 2 steps/s with no interpolation; auto-play is off.
- Inverse colours (legacy feature P-07) is implemented as a theme transform, and the resulting
  pairs are re-validated at runtime.
- Text and UI are never rendered inside the canvas; labels, legends and metrics are DOM.

## 6. Motion, flashing and timing

- The Step Player is the **only** source of animation; there is no free-running draw loop.
- Overlay updates that change more than 25 % of the canvas area are coalesced so no more than
  **3 full-area flashes per second** occur at any playback speed (2.3.1). Fast playback shows
  progress as a growing region rather than blinking cells.
- No content is time-limited. Race mode results wait for the user; there is no countdown that
  cannot be paused (2.2.1).
- First-person camera turns use 90-degree snaps (no smooth rotation) when reduced motion is on.

## 7. Touch targets, zoom and reflow

- Minimum interactive target **24x24 CSS px** everywhere (2.5.8); on touch layouts (pointer:
  coarse) all controls are **44x44** and the on-screen d-pad buttons are 56x56.
- Viewport meta is `width=device-width, initial-scale=1` with **no** `user-scalable=no`
  (fixes A-01). Pinch-zoom on the canvas is handled inside the canvas element via pointer events
  only when the canvas region is focused, so page zoom still works.
- Layout works at 320 px width and at 400 % browser zoom: controls move into a bottom sheet,
  the canvas takes the remaining viewport and scrolls independently.
- Text view (section 3.1) provides an alternative that reflows like normal text.

## 8. Forms, errors and help

- All inputs have visible labels (no placeholder-as-label); required state announced.
- Validation uses the same zod schemas as the API (`@maze/contracts`); messages are rendered
  beside the field, linked with `aria-describedby`, and summarised in a `role="alert"` region on
  submit. Errors say what to do, not just what is wrong (3.3.3).
- Help entry (`?` button and shortcut) is in the same toolbar slot on every route (3.2.6).
- Authentication (D-10) offers passkeys and OAuth so no memorised secret or CAPTCHA is required
  (3.3.8); email code fallback allows paste.

## 9. Internationalisation readiness

- All user-facing strings, including generated cell descriptions and narrator sentences, go
  through the i18n layer chosen in 03 section 9 with ICU plurals ("1 dead end" / "12 dead ends").
- `lang` attribute set on `<html>`; direction-aware layout (`dir="auto"`, logical CSS
  properties) so RTL is possible later without a rewrite.
- Keyboard shortcuts are described by `event.key` values and shown using the user's layout via
  `KeyboardLayoutMap` where supported.

## 10. Testing approach

| Layer | Tool | Gate |
|-------|------|------|
| Component | Storybook + `@storybook/addon-a11y` (axe) on every `@maze/ui` story; RTL tests query by role/name only | Story-level axe violations = failing test |
| Token | Vitest contrast test over `tokens.css` | Any pair below threshold fails CI |
| Route | Playwright + `@axe-core/playwright` on every route in every theme x reduced-motion combination | Zero `serious`/`critical` violations |
| Keyboard | Playwright "keyboard-only walkthrough" scripts: generate, play to goal, build a 5x5 maze, run a race, save - without any mouse events | Script completes; focus assertions pass |
| Narrator | Unit tests asserting exact sentences for fixed seeds and steps; snapshot of Step log for a 5x5 BFS | Deterministic output |
| Lighthouse CI | Accessibility category | `>= 100` on `/`, `/play`, `/build`, `/watch`, `/learn` (see 03 section 12) |
| Manual | Screen-reader passes per release: NVDA + Firefox, JAWS + Chrome, VoiceOver + Safari (macOS and iOS), TalkBack + Chrome (Android); low-vision pass at 400 % zoom; switch-access smoke on one route | Checklist signed in the release PR |

### 10.1 Acceptance-criteria template for stories

Every story in [15-backlog.md](./15-backlog.md) that touches UI includes this block:

```
Accessibility acceptance criteria
- [ ] All new controls reachable and operable by keyboard; documented in the shortcuts dialog if a single-key shortcut is added
- [ ] Names/roles/values verified with the Accessibility Tree (DevTools) and one screen reader
- [ ] No colour-only state; contrast test passes for any new token
- [ ] Behaviour under prefers-reduced-motion specified and tested
- [ ] axe (Storybook and Playwright) reports zero serious/critical issues
- [ ] Narrator/dom adapter updated if the change affects maze state or steps
```

## 11. Accessibility statement and governance

- Public page `/accessibility` states the conformance target (WCAG 2.2 AA), known exceptions
  with dates, the feedback channel, and the assistive technologies tested per release. It is
  regenerated from a YAML file in the repo so it never drifts from reality.
- Ownership: the **project owner** is accountable; every PR author is responsible for the
  acceptance criteria above; a **quarterly external audit** (or community audit) is budgeted
  once the product is public.
- Issues labelled `a11y` with severity `critical` or `serious` are release blockers, the same
  policy as security P0/P1 in 07-security.

## 12. Phased plan (aligned with 14-roadmap)

| Roadmap phase | Accessibility deliverables |
|---------------|----------------------------|
| Phase 1 (core + scaffold) | `describeCell` and narrator sentence generation in `@maze/core`/`@maze/player` with unit tests; token file with contrast test; `@maze/config` ESLint `jsx-a11y` preset |
| Phase 2 (web parity) | Landmarks, skip link, titles; `dom` adapter mounted on `/play`; roving-tabindex toolbar; accessible sliders and colour picker; reduced-motion handling for all legacy 3D effects; axe + Lighthouse gates in CI; fixes for A-01..A-12 by construction |
| Phase 3 (solvers, race) | Narrator verbosity levels; Step log panel; media-style shortcuts; agent markers with shape redundancy; keyboard-only race walkthrough test |
| Phase 4 (backend, auth, build/save) | Accessible auth flows (passkeys/OAuth, 3.3.8); Build-mode keyboard model; form error patterns; status messages for save/sync |
| Phase 5 (learn) | Pseudo-code panel with synchronized highlighting exposed as text; data-structure views as tables/lists; sonification (optional) |
| Phase 6 (desktop/mobile) | 44 px touch targets, on-screen d-pad, safe areas; VoiceOver iOS and TalkBack passes in the Tauri shells |
| Phase 7 (hardening) | Full manual AT matrix; accessibility statement published; external audit; remaining exceptions documented with dates |

## 13. Out of scope for v1 (documented, not forgotten)

- Full sign-language or audio-description media (there is no video content).
- Braille display-specific layouts beyond what the ARIA grid already provides.
- Haptic maze navigation on mobile beyond simple wall-bump feedback (tracked in 11-multi-platform).
