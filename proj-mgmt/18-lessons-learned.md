# 18 - Lessons Learned

> Status: Live | Last updated: 2026-10-18
> Append-only log. Each entry: what happened, why, and the rule we now follow. Rules that every
> session needs are mirrored in `AGENTS.md` section 6; this file keeps the reasoning.

## Rules at a glance (consolidated 2026-10-10)

The one-line rules every session needs; the entries below keep the story behind each.

| Area | Rule | From |
|------|------|------|
| Agents | At most two subagents; they commit after every fix; check their base commit | L-01, L-02 |
| Git | Branch from and merge into `develop`, push only `develop`; the owner promotes to `main`; retry git writes on Drive locks | L-03, L-04 |
| Git | Lower-case commit subjects, no `wip` type; never skip hooks; prettier only your files | L-27, L-28, L-33 |
| Shell | Patch scripts as files in the scratchpad; no long heredocs; watch `\r`/`\f` escapes | L-25, L-30 |
| Toolchain | Lint pins TS 6; no `baseUrl`; Vite 8 `codeSplitting`; don't trust timer return types | L-06, L-07, L-20 |
| Tests | Polyfill jsdom gaps; anchor role-name regexes; scope queries to their container | L-09, L-10, L-26 |
| Tests | Media waits get timeouts; check component state before "fixing" it; rerun slow e2e once | L-29, L-22, L-23 |
| Tests | Timeouts on a busy machine: run the file alone and the `develop` baseline first | L-32 |
| Runtime | Sources stay deterministic (rewind = replay); StrictMode-safe disposal | L-11, L-12 |
| Layout | `pan-y` canvases on touch; `relative` scrollers; nothing over the maze on phones | L-13, L-14, BUG-01 |
| Layout | Measured layouts need hysteresis; touch sizing must not reshape switches | L-18, L-31 |
| Colour | Overlay colours mix with the base colour; resolve the theme once | L-21 |
| Ports | Block 41920-41939; the dev server on 41920 is always on (task + `-Unregister` abort) | L-24 (replaces L-15, L-19 ports) |
| Checks | `check:viewports` for sizes; Playwright scripts for interactions | L-16, L-19 |
| Machine | Preflight before heavy jobs; wait on transient breaches; one heavy job at a time | L-35 |
| Machine | Preflight exits 1 on standing breaches: judge by the transient rows, not the exit code | L-36 |
| Git | Anchor ignore patterns (`/build/`); check new folders with `git status`, not just tests | L-37 |
| Lint | Every rule is an error; relax in the config with a reason, widen untrusted input explicitly | L-38, L-39 |
| Tests | RTL async timeout is 5 s for lazy routes; lesson modules keep components off the top level | L-41, L-42 |
| Learn | Views read steps only: when a view needs a value, add it to the step; test each model against its algorithm | L-43 |
| Checks | Interaction scripts live in `apps/web/.local/` (ignored); open collapsed phone sections first | L-44 |
| Learn | Offer only what an algorithm can do (probe it); stateful breakpoints fork the live state | L-45 |
| Tests | Radio groups: tab in forwards; checks met together share one live message | L-46 |
| Owner | Phone-first, small merged slices, protect the 3D views and the walkthrough | L-17 |

## Process and orchestration

**L-01 Six parallel agents exhausted the session limit before anyone committed.** Two rounds of
six concurrent subagents hit the rate limit and lost hours of uncommitted work. *Rule:* at most
two agents at once; the coordinator commits a snapshot (`feat(...)`/`fix(...)`, there is no
`wip` type, L-33) on each agent branch before resuming; briefs say "commit after each fix" and "keep tool output to grep'd lines".

**L-02 Isolated worktrees sometimes start from `origin/master`.** Two agents' worktrees were cut
from the old default branch. *Rule:* briefs tell agents to check `git log -1` against the
expected base and reset their branch before working.

**L-03 Pushing.** Until 2026-10-11 the auto-mode classifier blocked agent pushes, even after the
owner's go-ahead in chat. On 2026-10-12 the owner allowed it and the first push of `develop` and
`main` went through, and changed the branch rule: agents merge into `develop` and push it; the
owner promotes `develop` -> `main`. *Rule:* push only `develop`; if a push is blocked, report it
and suggest `! git push origin develop`.

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

**L-28 Commit subjects are lower case.** commitlint rejects a sentence-case subject ("Run Maze as
a game"); the long `-q` commit failed with only "exit status 1" visible. *Rule:* start the subject
in lower case, and when a commit fails print the hook output without `-q` filters. Do not skip
hooks to get past it (one amend in WI-02 skipped eslint/prettier for a message-only change; the
tree was then re-checked by hand: same tree, prettier clean, lint 0 errors).

**L-29 jsdom never loads images.** `makeThumbnail` waited for `img.onload`/`onerror`, which never
fire in jsdom, so "Save run" hung in tests (and could in a browser with a stalled image).
*Rule:* every promise that waits on media or network gets a timeout fallback.

**L-30 Long inline heredocs break the shell.** A long `python - <<'EOF'` patch with nested
quotes failed to parse, and a stray `cat > /dev/null` waited on stdin until the tool timed out.
*Rule:* write patch scripts to the scratchpad with the Write tool and run them as files.

**L-31 Touch sizing rules must not resize every control.** A coarse-pointer rule gave every
toolbar button (and switch) a 44px minimum width and height, which squashed switches into
circles on phones. *Rule:* grow hit areas with an invisible `::after` overlay for controls whose
shape matters; check toolbar screenshots at phone width, not just the maze.

**L-32 A busy machine times out RTL journeys, also on an unchanged `develop`.** During WI-04 the
full web suite failed 4-10 route journeys at the 5 s default while each passed alone in 1.5-2 s;
the same run on an untouched `develop` failed ten. Other sessions were running a repo-wide
`git grep`, an Angular server and another project's Playwright suite. *Rule:* before calling a
timeout a regression, run the failing file alone and the baseline on `develop` (commit first;
`git stash` can fail on Drive locks). The web suite now has `testTimeout: 30_000`; long journeys
set their own (45 s). Do not kill other sessions' processes.

**L-33 commitlint has no `wip` type.** A `wip(params): ...` snapshot commit was rejected
(type-enum: build, chore, ci, docs, feat, fix, perf, refactor, revert, style, test). *Rule:* use
`feat(...)`/`fix(...)` for mid-item snapshot commits; the merge commit names the item.

**L-34 Re-arm effects must not double-fire on the change that already re-arms.** Watch re-arms
the solver when its parameters change; switching solvers changed the parameter key too, so the
solve was cleared twice and the ride-along journey timed out waiting for Play. *Rule:* compare
the previous (solver, params) pair and react only to edits of the same solver's parameters.

**L-35 The workspace harness owns ports and machine capacity.** The owner's workspace analysis
(2026-10-10) measured `D:` at 94% active and ~5% of its sequential throughput while five dev
servers, three antivirus engines and several agents' jobs competed; it matches the WI-04 test
timeouts (L-32), where this session ran e2e next to a viewport check while other sessions ran a
repo-wide `git grep` and another Playwright suite. *Rule:* AGENTS.md section 3a: run
`preflight-resources.ps1` before heavy jobs, wait on transient breaches, report standing ones
(antivirus engines, watcher count), and run gate steps one at a time.

**L-36 Paced, the gate is clean on the first run; the preflight's exit code is not the signal.**
Re-verifying WI-04 (2026-10-10) with the transient preflight rows green and every step run
alone: typecheck, 516 unit tests, lint and e2e 27/27 (1.2 min) all passed first time, where the
same gate under contention had needed reruns (L-32). The preflight exits 1 whenever a standing
breach exists (3 antivirus engines, 4-6 watchers including our 41920 server), so it never
returns 0 here today. *Rule:* read the table: proceed when every transient row (D: active time
and response, transfers, RAM, CPU, GPU) is OK; wait when one is not; report standing rows.

**L-37 A bare `build/` ignore pattern hid a whole feature from git for two days.** The root
`.gitignore` listed `build/` for build output; it also matched `apps/web/src/routes/build`, so the
WI-03 Build editor (page, panels, toolbar, tests) was never committed while every local check
passed: tests, typecheck and the dev server read the files from disk, and ESLint (`**/build/**`)
and prettier (which reads `.gitignore`) skipped them silently. Found in WI-05 when an
`eslint-disable` count differed between `develop` and the working tree. *Rule:* anchor ignore
patterns to the folders they mean (`/build/`, `apps/*/build/`); after adding a folder, check
`git status` shows it; `git ls-files --others --ignored --exclude-standard` must list no source.

**L-38 Paying lint debt: change what the rule sees, not the rule.** 313 warnings went to 0 in
three passes: numbers in template literals allowed by option (164 findings; typescript-eslint's
own non-strict default), callback props and store actions typed as function properties
(`onX: () => void`, 59 `unbound-method` findings), then ESLint's autofixes and ~40 hand fixes.
Every rule was then promoted to `error` so the count cannot creep back. *Rule:* relax a rule in
`packages/config/eslint` with a comment, never inline; non-component exports live outside
component files (react-refresh).

**L-39 A typed local does not widen a union; an assertion does.** `const ok: boolean =
config.lockstep` (typed `true`) is still narrowed to `true` on assignment, so
`no-unnecessary-condition` keeps firing; non-union targets (`const v: number = doc.v`) do widen.
*Rule:* for runtime guards on typed-but-untrusted input, widen with `x as boolean` / `as T |
undefined` and say why in a comment.

**L-40 Lazy routes were nearly free.** `lazyRouteComponent` for the six feature pages cut the
initial JS from 233.7 to 157.4 kB gzip with no test changes: RTL journeys already awaited their
first element (`findBy...`), Playwright waits by default, and `defaultPreload: 'intent'` plus the
service-worker precache keep navigation instant and offline-safe. *Rule:* new pages are lazy by
default; tests start with an async query.

**L-41 Lazy routes plus a heavier suite pushed first queries past RTL's 1 s default.** After WI-06a
added Learn tests, the first test in four route files (play, race, tools, ride-along) failed at
~1.3 s in the full run but passed alone: the first `findBy...` waits for Vite to transform the
lazily imported page. *Rule:* `configure({ asyncUtilTimeout: 5_000 })` in `src/test/setup.ts`;
a failure only in the full run, at about the timeout, is the async-util budget, not the code.

**L-42 react-refresh rejects a module that defines a component and exports data.** A lesson
module exports a `lesson` object holding its prose component; a top-level `function Body()`
made `only-export-components` fail even with `lesson` allowed by name. *Rule:* lesson prose is
written inline in the `lesson` object (`Body: () => (...)`), so no config change is needed.

**L-43 Rebuilding structures from steps finds gaps in the steps and in our assumptions.** Two
surprises in WI-06b: greedy best-first's `discover` did not carry its priority, so its heap could
not be rebuilt (fixed in core: `f = h` on `discover`); and flood fill floods from the *goal*, which
the "every expand takes the front" test caught at once (119 out-of-order expansions) before any
view showed wrong data. *Rule:* a view reads steps only; when it needs a value, the step gets it;
every model is tested against its algorithm on real and braided mazes, in batches and at once.

**L-44 Interaction scripts: where they live and what phones hide.** A Playwright screenshot script
must run from `apps/web` (it imports `@playwright/test`), so a copy landed in the repo as an
untracked file that the Drive rule then forbids deleting (kept out of git via
`.git/info/exclude`). On phones Watch's sections start collapsed, so the script timed out until it
opened the section. *Rule:* put interaction scripts in `apps/web/.local/` (ignored by `.local/`) and
open collapsed sections before waiting on their content.

**L-45 Offer what the algorithm actually does, found by running it.** The plan listed "a cost is
lowered" as a breakpoint for Dijkstra and A*, but on unit-cost mazes with default parameters no
solver ever relaxes: the first discovery is already the cheapest (the Dijkstra source says so).
A probe run of each solver on two small mazes (one perfect, one braided) decides which
breakpoints it is offered, so the picker never offers a run that cannot stop, and a new solver
needs no table entry. The "frontier > N" breakpoint needs the frontier as it is now, so it forks
the live structure tracker (which keeps its step history) instead of guessing size deltas per
model. *Rule:* derive UI choices from what the code does on a probe, test every offered choice
against a brute-force scan of real step lists, and give stateful predicates a fork of the live
state.

**L-46 Keyboard tests and live messages: two small traps.** user-event enters an unanswered
radio group from its *last* option when tabbing backwards (as browsers do), so arrow keys wrap
and pick the wrong answer; tab in forwards. In a lesson, one pause can satisfy two try-it checks
at once; announcing them one by one let the second message replace the first before it was read.
*Rule:* tab into radio groups forwards in tests; combine everything that passed at one moment into
one live message. Also: ESLint now ignores `**/.local/**` and `**/*.tmp.*`, so local scratch
scripts no longer fail `pnpm lint`.
