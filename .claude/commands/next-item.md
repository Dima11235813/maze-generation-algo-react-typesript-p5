---
description: Take the next work item from proj-mgmt/17-work-queue.md and deliver it end to end
---

Proceed to the next work item.

1. Read `AGENTS.md`, `proj-mgmt/17-work-queue.md` and `proj-mgmt/18-lessons-learned.md`.
2. Pick the item marked `NEXT`. If its "Blocked by" names an open action in
   `proj-mgmt/16-human-actions.md`, tell the owner and take the next unblocked item instead.
3. Restate the item's goal and acceptance criteria in two or three lines, then work through it on
   a `feat/<slug>` branch from `develop` without asking for confirmation on routine choices.
4. Meet the Definition of Done in `AGENTS.md` section 4, including the phone/tablet/desktop
   browser check against the LAN dev server.
5. Merge into `develop` (`--no-ff`) and fast-forward `main`. Do not push.
6. Mark the item `DONE` (date, merge commit), mark the following unblocked item `NEXT`, append any
   new lessons to `proj-mgmt/18-lessons-learned.md`, and update the `project-state` memory.
7. Report: what shipped, how to try it (LAN URL), gate results, and what is `NEXT`.

$ARGUMENTS
