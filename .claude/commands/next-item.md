---
description: Take the next work item from proj-mgmt/17-work-queue.md and deliver it end to end
---

Proceed to the next work item.

1. Read `AGENTS.md`, `proj-mgmt/17-work-queue.md` and `proj-mgmt/18-lessons-learned.md`.
2. Pick the item marked `NEXT`. If its "Blocked by" names an open action in
   `proj-mgmt/16-human-actions.md`, tell the owner and take the next unblocked item instead.
3. Restate the item's goal and acceptance criteria in two or three lines, then work through it on
   a `feat/<slug>` branch from `develop` without asking for confirmation on routine choices.
   If it spans several modules or demo kinds, split it into slices and run steps 4-5 per slice,
   noting each merged slice in the `project-state` memory before the next one (L-52). Probe
   the real numbers before writing lesson thresholds or quiz answers (L-49).
4. Meet the Definition of Done in `AGENTS.md` section 4, including the phone/tablet/desktop
   check (`pnpm --filter @maze/web check:viewports -- <routes>`, then look at the screenshots)
   against the always-on LAN dev server (http://127.0.0.1:41920; do not start another one).
   Commit subjects in lower case; never skip hooks. Shared machine (`AGENTS.md` 3a): run the
   workspace preflight before each heavy gate step and run those steps one at a time.
5. Merge into `develop` (`--no-ff`) and push `develop`. Never touch `main` (the owner promotes
   `develop` -> `main`).
6. Mark the item `DONE` (date, merge commit), mark the following unblocked item `NEXT`, append any
   new lessons to `proj-mgmt/18-lessons-learned.md`, and update the `project-state` memory.
7. Report: what shipped, how to try it (LAN URL), gate results, and what is `NEXT`.

$ARGUMENTS
