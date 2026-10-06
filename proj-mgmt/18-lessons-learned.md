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

**L-18 Measured layouts need hysteresis.** The Race page picks its lane column count from the
measured stage size. When a race finished, the winner sentence wrapped to two lines, the stage lost
20 px of height, two near-equal layouts swapped (stacked vs side by side) and the canvases were
caught mid-resize (blank). *Rule:* a measured layout only switches when the new option is clearly
better (10% here), and status lines that change text keep a fixed height (`truncate`).

**L-19 Browser checks without the MCP browsers.** The Playwright MCP browser can be locked by
another profile, and a dev server may already hold port 5180 from an earlier session (check with
`netstat -ano | grep :5180` before starting one). *Rule:* a throwaway Node script that imports
`chromium` from `@playwright/test` (run from `apps/web`) can open real viewports (390/820/1280/1680,
`hasTouch`/`isMobile`), measure `scrollWidth` against `clientWidth` and save screenshots to the
session scratchpad; delete the script afterwards.

**L-20 `setTimeout` typing depends on file order.** With both the DOM lib and Node types loaded
(vitest globals bring Node in), TypeScript picks the first `setTimeout` overload it sees. Adding
one export to `@maze/renderer` reordered files and `return setTimeout(...)` (typed `number`)
stopped compiling in the web typecheck only. *Rule:* never rely on the timer id's type; store
`ReturnType<typeof setTimeout>` or convert with `Number(...)`. Bisect with
`git checkout <sha>` + `tsc --noEmit -p apps/web` when a typecheck breaks without an obvious cause.

**L-21 Overlay colours must survive a new background.** The solver colours were tuned as tints
over green cells; drawn on their own as tree branches, "expanded" (120,170,255) vanished into
the blue background (113,173,245). *Rule:* derive overlay colours by mixing with the base colour
(`mix(base, mark, SOLVE_TINT_ALPHA)`) and resolve the theme (invert) exactly once.

**L-22 Check the RTL assumption before "fixing" a widget.** A failing keyboard test in the tree
outline was the test's assumption (root collapsed), not the widget (root starts expanded, per the
ARIA pattern). *Rule:* log the state the handler sees before changing component code.

**L-23 e2e under load.** A full Playwright run while the LAN dev server and screenshot scripts
were busy took 1.6 min and timed out two journeys; the rerun was 20/20 in 37 s. *Rule:* rerun
once before treating an e2e timeout as a regression, and report both runs.

**L-24 One long-running dev server on a registered port.** Several sessions each started their own
Vite server (5173, 5174, 5180) and the owner's LAN URL changed with them; 5173 also collided with
mirror-chess. *Rule:* Maze Lab owns block 41920-41939 in `D:\GDrive\proj-mgmt\inventory\local-ports.md`;
the `MazeLab-LocalServers` task keeps the LAN dev server on 41920 alive (heartbeat every 15 min,
starts what is down, never kills); agents use it instead of starting another, and
`scripts/register_local_servers.ps1 -Unregister` is the abort. (Supersedes the 5180 advice in
L-15 and L-19.)

**L-25 Windows paths through Python string literals.** Inventory edits written from a heredoc'd
Python script turned `\register` into a carriage return and `\finese` into a form feed (`\r`,
`\f` escapes), silently corrupting the off-switch commands. *Rule:* write Windows paths with the
Edit tool, or in Python use raw strings / `chr(92)`, then grep the result for control
characters before moving on.

**L-26 A second action surface breaks loose queries.** The maze tools widget repeats toolbar
actions ("Run to end", "Play"), so `screen.getByRole('button', { name: /run to end/i })` found
two. *Rule:* scope RTL/Playwright queries to their container (`within(toolbar)`), and keep group
names distinct from other widgets' names ("Playback", not "Solver playback", next to the solver
picker).

**L-27 Running prettier on a whole folder reformats files you did not touch.** Some files had
drifted from the formatter. *Rule:* run `prettier --write` on the files you changed only; revert
formatting-only changes elsewhere (they belong to WI-05).
