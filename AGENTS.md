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
| App                   | `apps/web` - routes `/play /watch /explore /explore/compare` (+ stubs)                   |
| Original app          | `apps/legacy` - frozen, read-only, not in the workspace                                  |
| Original brief        | `next.md` (historical; the live queue is `proj-mgmt/17-work-queue.md`)                   |

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

## 4. Definition of Done for a work item

- [ ] Typecheck clean; all package tests pass; new behaviour has tests (core: property tests for
      invariants; web: RTL with the fake renderer factory in `apps/web/src/test/fakeRenderer.ts`).
- [ ] `pnpm lint` 0 errors; build passes the size gate; e2e 16+/16+ green (add a journey when a
      route or major flow is added).
- [ ] Checked in a real browser at **phone (390px), tablet (820px) and desktop (1280px+)**:
      no page-level horizontal overflow, the page scrolls on phones, controls reachable by touch.
- [ ] Accessible: labelled controls, keyboard path, live-region status for state changes.
- [ ] Docs: queue item updated; ADR/plan touched if a decision changed; lessons appended.

## 5. Conventions

- Branch model: `feat/*` -> `develop` (`--no-ff`) -> `main` (fast-forward). `master` is the old
  default and stays untouched.
- Conventional commits; body lines <= 120 chars (commitlint). End messages with the attribution
  trailer from the session's system instructions.
- Dependency rule: `packages/*` never import `apps/*`; `@maze/core` has zero runtime deps, no DOM,
  no `Math.random` (lint enforces). Algorithms are ES generators yielding `Step`s with a seeded
  `Rng`; determinism is what makes rewind (replay) and sharing exact.
- New algorithms: one file + registry entry; the shared property suite and the UI pick it up.
- Layout: pages use `apps/web/src/layout/Workspace.tsx` + `Section.tsx` (phone column, tablet
  grid, desktop side column, wide three columns). Canvases get `pageScroll` on touch layouts.

## 6. Gotchas (details and causes in `proj-mgmt/18-lessons-learned.md`)

- `git push` is blocked for agents; ask the owner. Google Drive sometimes locks `.git/objects`:
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
