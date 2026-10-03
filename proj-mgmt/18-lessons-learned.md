# 18 - Lessons Learned

> Status: Live | Last updated: 2026-10-03
> Append-only log. Each entry: what happened, why, and the rule we now follow. Rules that every
> session needs are mirrored in `AGENTS.md` section 6; this file keeps the reasoning.

## Process and orchestration

**L-01 Six parallel agents exhausted the session limit before anyone committed.** Two rounds of
six concurrent subagents hit the rate limit and lost hours of uncommitted work. *Rule:* at most
two agents at once; the coordinator commits a `wip(...)` snapshot on each agent branch before
resuming; briefs say "commit after each fix" and "keep tool output to grep'd lines".

**L-02 Isolated worktrees sometimes start from `origin/master`.** Two agents' worktrees were cut
from the old default branch. *Rule:* briefs tell agents to check `git log -1` against the
expected base and reset their branch before working.

**L-03 Agents cannot push.** The auto-mode classifier blocks `git push`. *Rule:* merge locally
into `develop`/`main`; list the push in `16-human-actions.md` and the final report.

**L-04 Google Drive locks `.git/objects` mid-write.** `git add`/`commit` fail with "Permission
denied" intermittently. *Rule:* wrap git writes in a short retry loop.

**L-05 Merge order matters for shared files.** `package.json`, `pnpm-lock.yaml`, `PlayPage.tsx`
and `router.tsx` are hot spots. *Rule:* pre-install dependencies on `develop` before fanning out;
resolve `package.json` by union of keys, take one lockfile side, then `pnpm install`.

## Toolchain

**L-06 TypeScript 7 (native) is installed.** typescript-eslint rejects it and `baseUrl` is gone.
*Rule:* lint toolchain pins TS 6 inside `packages/config`; tsconfig `paths` use `./src/*`.

**L-07 Vite 8 / Rolldown.** `manualChunks` as an object is unsupported; use
`build.rolldownOptions.output.codeSplitting`. Vitest 5 benches use `test(..., ({ bench }) => ...)`.

**L-08 Commit hooks rewrite staged files.** `eslint --fix` + `prettier --check` can leave files
half staged ("conflict while merging unstaged changes"). *Rule:* run `prettier --write` on the
staged files, `git add` them fully, commit; wrap commit bodies at 120 columns (commitlint).

**L-09 jsdom gaps.** No `ResizeObserver`, `matchMedia`, `scrollTo`, `crypto.subtle`. They are
polyfilled in `apps/web/src/test/setup.ts`; user-event needs `[[` to type `[`.

**L-10 Registry growth breaks loose test queries.** `/breadth-first/i` started matching
"Bidirectional Breadth-First Search". *Rule:* anchor role-name regexes (`/^breadth-first search/i`).

## Product and runtime

**L-11 Determinism pays off.** Seeded generators/solvers let rewind be "re-create the source and
replay to step N" (`StepPlayer.seek`), exact and simple. Keep every source deterministic.

**L-12 StrictMode double mount in dev.** Compare's controller was disposed by the dev-only
effect cleanup and every lane stayed at step 0 (production was fine). *Rule:* anything disposed
in a cleanup must be revivable, or be created inside the effect.

**L-13 Touch layouts.** `touch-action: none` on a full-width canvas trapped page scroll on
phones. *Rule:* `pageScroll` on touch layouts sets `pan-y` (horizontal drag still orbits, pinch
still zooms); on-screen buttons cover tilt.

**L-14 Hidden text escapes scrollers.** `sr-only` elements are absolutely positioned; without a
positioned ancestor they extend the document and cause horizontal/vertical page scroll.
`scrollIntoView` in a log scrolled the whole page on phones. *Rule:* scroll containers get
`relative`; logs scroll their own viewport. To measure overflow, load the page in a same-origin
iframe from the dev server and compare `scrollWidth` with `clientWidth` (cross-origin iframes
cannot be inspected).

**L-15 The owner tests on a phone over the LAN.** Port 5173 is held by another project
(`mirror-chess` preview on 0.0.0.0). *Rule:* serve on `--port 5180 --host 0.0.0.0`
(http://192.168.86.96:5180); the fnm Node binary may need a Private-profile firewall rule
(owner's call, command in `16-human-actions.md`).

**L-16 Browser automation limits.** The Chrome extension cannot resize its window and throttles
animation in unfocused tabs. *Rule:* use `proj-mgmt/tools/responsive-preview.html` for sizes and
reduced motion or run-to-end for visual checks.

**L-17 What the owner values.** The 3D views (stack-depth cube projection, mirror) and the
first-person walkthrough are favourites; phone usability is checked on every change; progress
should land in small merged slices with the app always runnable.
