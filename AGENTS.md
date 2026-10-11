# Maze Lab - Agent Rules

Read this first in every session. It is the working agreement for any coding agent (Claude Code,
Codex, Antigravity, subagents) in this repo. The workspace-wide rules in `D:\GDrive\AGENTS.md`
also apply (never delete files on Google Drive, secrets only via environment variables, give
`file:///` links).

## 1. Where things are

| What                  | Where                                                                                    |
| --------------------- | ---------------------------------------------------------------------------------------- |
| Plan, decisions, ADRs | `proj-mgmt/README.md` (decision register D-01..D-19), `proj-mgmt/adr/`                   |
| **Next work**         | `proj-mgmt/17-work-queue.md` - the ordered queue; the item marked `NEXT` is the next one |
| Lessons learned       | `proj-mgmt/18-lessons-learned.md` - read before planning; append after each work item    |
| Owner-only actions    | `proj-mgmt/16-human-actions.md` (pushes, key rotation, cloud accounts)                   |
| Engine (pure TS)      | `packages/core` - grid, RNG, generators, solvers, trackers, metrics, editing, race       |
| Playback              | `packages/player` - StepPlayer (play/pause/step/seek/stepBack/restart), narrator         |
| Rendering             | `packages/renderer` - port + `canvas2d`, `three` (3D/first person), `dom` (a11y)         |
| UI kit                | `packages/ui` (Radix + Tailwind v4)                                                      |
| App                   | `apps/web` - `/play /watch /race /build /explore /explore/compare` (+ `/learn` stub)     |
| Original app          | `apps/legacy` - frozen, read-only, not in the workspace                                  |
| Original brief        | `next.md` (historical; the live queue is `proj-mgmt/17-work-queue.md`)                   |
| Local ports           | block 41920-41939 in `D:\GDrive\proj-mgmt\inventory\local-ports.md` (see section 3)      |

## 2. "Proceed to the next work item"

When the owner says this (or runs `/next-item`):

1. Read `proj-mgmt/17-work-queue.md`, take the item marked `NEXT`. Read
   `proj-mgmt/18-lessons-learned.md`. Check the item's "Blocked by" against
   `proj-mgmt/16-human-actions.md`; if blocked, say so and take the next unblocked item.
2. Branch `feat/<slug>` (or `fix/`, `chore/`) from `develop`.
3. Implement to the item's acceptance criteria. Keep the scope of the item.
4. Pass the Definition of Done (section 4), including the phone-width check.
5. Merge `--no-ff` into `develop`, then `git checkout main && git merge --ff-only develop`.
6. Update the queue (item -> `DONE` with date and commit, next item -> `NEXT`), append lessons,
   refresh the project-state memory, and report. Never push (the owner pushes).

## 3. Commands

Node 22 comes from **fnm** and is not on PATH by default:

```bash
# Git Bash
eval "$(fnm env --shell bash)"; export PATH="$APPDATA/npm:$PATH"
# PowerShell
$env:Path = "$(fnm env --json | ConvertFrom-Json | Select-Object -ExpandProperty FNM_MULTISHELL_PATH);$env:Path"
```

```bash
pnpm install                                   # also installs git hooks (lefthook)
pnpm turbo run typecheck                       # TS 7 strict, all packages
pnpm --filter @maze/<core|player|renderer|web> test
pnpm lint                                      # 0 errors required; warnings are tracked debt
pnpm --filter @maze/web build                  # includes the bundle-size gate
pnpm --filter @maze/web e2e                    # Playwright + axe, builds and serves on :41922
pnpm --filter @maze/web check:viewports -- play build   # phone/tablet/desktop/wide screenshots +
                                               # overflow + page errors (no leading slash in Git Bash)
```

Ports: block **41920-41939** (registered in `D:\GDrive\proj-mgmt\inventory\local-ports.md`):
41920 LAN dev server, 41921 `vite preview`, 41922 e2e, 41923 responsive-preview harness.

The dev server **stays running** on **http://192.168.86.96:41920**
(owner's call, 2026-10-03): the `MazeLab-LocalServers` scheduled task starts it at logon and
re-checks every 15 minutes (`scripts/run_local_servers.ps1`; starts what is down, never kills).
Do not start another dev server; use that one. Logs: `.local/logs/local-servers/`.

```bash
# Abort (removes the task and stops everything on 41920-41939):
powershell -ExecutionPolicy Bypass -File scripts/register_local_servers.ps1 -Unregister
# Re-enable:
powershell -ExecutionPolicy Bypass -File scripts/register_local_servers.ps1
```

## 3a. Shared machine - workspace harness

This project runs on a shared machine. The workspace harness at `D:\GDrive\AGENTS.md` (section 0)
takes precedence over local convenience, and defines:

- **Ports** - claim a block in `D:\GDrive\proj-mgmt\inventory\local-ports.md` before binding.
  Never use common defaults (3000, 4173, 4200, 5173, 8080...). Bind `127.0.0.1` unless LAN
  exposure is deliberate and recorded (ours is: 41920, the owner's phone/tablet testing).
- **Resources** - ceilings and pacing in `D:\GDrive\proj-mgmt\inventory\local-resources.md`.
  Never drive a resource to 100%; a slower batch beats a burst. `D:` is a 7200 rpm HDD behind
  three real-time antivirus engines: every file touch is scanned three times.

Before a heavy job (full test suite, `build`, `e2e`, `check:viewports`, `pnpm install`, a
repo-wide search):

```powershell
powershell -ExecutionPolicy Bypass -File D:\GDrive\proj-mgmt\inventory\scripts\preflight-resources.ps1
```

- The script exits 1 while any standing breach exists, so read its table, not the exit code
  (L-36).
- A **transient** breach (D: active time or response, CPU, free RAM) means **wait**, not
  "proceed carefully". Re-check in a few minutes.
- A **standing** breach (antivirus engine count; dev-server/watcher count, which our always-on
  41920 server adds to) is the owner's to fix: note it in the report and keep going with the
  pacing rules below.
- Pacing: run the gate steps **one at a time** (never e2e next to `check:viewports` or a second
  suite); prefer one file or package over the whole suite while iterating; scratch, logs and
  temp output go to the session scratchpad on `C:`, not `D:`. A timeout seen while another heavy
  job ran is load, not a regression (L-32).

## 4. Definition of Done for a work item

- [ ] Typecheck clean; all package tests pass; new behaviour has tests (core: property tests for
      invariants; web: RTL with the fake renderer factory in `apps/web/src/test/fakeRenderer.ts`).
- [ ] `pnpm lint` 0 errors; build passes the size gate; e2e all green (26+; add a journey when a
      route or major flow is added). A timeout on a slow run (> 1.5 min) is rerun once before it
      counts as a failure; report both runs.
- [ ] Checked in a real browser at **phone (390px), tablet (820px) and desktop (1280px+)** with
      `check:viewports` (and look at the screenshots): no page-level horizontal overflow, the page
      scrolls on phones, controls reachable by touch, **nothing covers the maze** on phones.
- [ ] Accessible: labelled controls, keyboard path, live-region status for state changes.
- [ ] Docs: queue item updated; ADR/plan touched if a decision changed; lessons appended.

## 5. Conventions

- Branch model: `feat/*` -> `develop` (`--no-ff`) -> `main` (fast-forward). `master` is the old
  default and stays untouched.
- Conventional commits with a **lower-case subject** (`feat(play): run maze ...`, not `Run Maze`);
  body lines <= 120 chars (commitlint). End messages with the attribution trailer from the
  session's system instructions. Never skip hooks; fix what they report.
- Dependency rule: `packages/*` never import `apps/*`; `@maze/core` has zero runtime deps, no DOM,
  no `Math.random` (lint enforces). Algorithms are ES generators yielding `Step`s with a seeded
  `Rng`; determinism is what makes rewind (replay) and sharing exact.
- New algorithms: one file + registry entry; the shared property suite and the UI pick it up.
- Layout: pages use `apps/web/src/layout/Workspace.tsx` + `Section.tsx` (phone column, tablet
  grid, desktop side column, wide three columns). Canvases get `pageScroll` on touch layouts.
- Controls never sit on top of the maze on phones/tablets: use the maze tools widget
  (`routes/tools/MazeTools.tsx`, a row below the maze; floating and draggable on desktop) or an
  in-flow bar below the canvas (`RunBar`, `RideAlongBar`, `TreeControls`). Every action has a
  tooltip with its shortcut.
- Shared viewing modes: 2D / 3D / Tree (`maze/treeView.ts`), Ride along (`maze/rideAlong.ts`) and
  Run Maze runs (`core/run.ts`) are derived from steps or moves, so rewind/undo is exact replay.

## 6. Gotchas (details and causes in `proj-mgmt/18-lessons-learned.md`)

- `git push` is blocked for agents, even with the owner's go-ahead in chat; the owner pushes
  (`! git push -u origin develop main`). Google Drive sometimes locks `.git/objects`:
  retry git writes after ~2 s.
- Commit hook runs `eslint --fix` + `prettier --check` on staged files. If it fails or reports
  "conflict while merging unstaged changes": `pnpm exec prettier --write <staged files>`,
  `git add` them fully, commit again.
- typescript-eslint cannot use TS 7, so the lint toolchain pins TS 6 inside `packages/config`.
  No `baseUrl` in tsconfigs (TS 7).
- React StrictMode double-mounts in dev: objects disposed in an effect cleanup must be revivable
  (see `CompareController.revive`).
- Visually hidden (`sr-only`) text is absolutely positioned: give scroll containers `relative`
  or it escapes and makes the page overflow. Never `scrollIntoView` inside a page that scrolls.
- Max **two** parallel subagents; each must commit after every fix (rate limits killed six
  concurrent agents twice before any commit).
- Windows Python cannot read Git Bash `/tmp`; use the session scratchpad for temp files.
- Write multi-line patch scripts to the scratchpad and run them as files; long inline heredocs
  break the shell, and Python string escapes (`\r`, `\f`) corrupt Windows paths (use the Edit
  tool or `chr(92)`, then grep for control characters).
- The LAN dev server on 41920 is always on (`MazeLab-LocalServers` task); never start another dev
  server. Git Bash rewrites `/route` arguments into Windows paths: pass routes without the slash.
- Run `prettier --write` only on files you changed (other files have drifted; that is WI-05).
- jsdom never loads images and has no layout: anything awaiting media needs a timeout fallback;
  tests needing sizes stub `clientWidth`/`offsetWidth` (see `routes/tools/tools.test.tsx`).
- A second surface for the same action (toolbar + maze tools) makes loose queries ambiguous:
  scope RTL/Playwright queries to their container (`within(toolbar)`).
- `setTimeout` return types depend on which lib (DOM/Node) TypeScript sees first: never rely on
  them (`Number(setTimeout(...))` or `ReturnType<typeof setTimeout>`).
