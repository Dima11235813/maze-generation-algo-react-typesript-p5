@AGENTS.md

## Claude Code specifics

- "Proceed to the next work item" = run the protocol in AGENTS.md section 2 (also available as
  the `/next-item` command in `.claude/commands/next-item.md`).
- After finishing a work item, refresh the auto-memory `project-state` entry (current commit,
  what changed, which queue item is `NEXT`) so the next session starts from the right place.
- The LAN dev server is always on at http://192.168.86.96:41920 (MazeLab-LocalServers task); do not
  start another one. Abort: `scripts/register_local_servers.ps1 -Unregister`.
- Browser checks: run `pnpm --filter @maze/web check:viewports -- <routes>` (headless Chromium with
  software WebGL, real viewports, screenshots in `.local/viewport-checks/`), then Read the PNGs.
  For interactions (taps, drags, keys) write a short Playwright script in the scratchpad against
  http://127.0.0.1:41920. The Chrome extension cannot resize its window and the Playwright MCP
  browser may be locked by another profile (L-16, L-19).
- After a work item: queue item DONE with the merge commit, next item NEXT, lessons appended,
  `project-state` memory refreshed, and the report gives the LAN URL to try it.
- When the owner names a feature idea, log it as a queue item first (with a design note when it
  is large) and ask where it goes in the order unless they say "build it now".
