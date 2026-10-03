@AGENTS.md

## Claude Code specifics

- "Proceed to the next work item" = run the protocol in AGENTS.md section 2 (also available as
  the `/next-item` command in `.claude/commands/next-item.md`).
- After finishing a work item, refresh the auto-memory `project-state` entry (current commit,
  what changed, which queue item is `NEXT`) so the next session starts from the right place.
- Browser checks: the Chrome extension cannot resize its window and suspends animation in
  unfocused tabs. For phone/tablet/desktop checks serve
  `proj-mgmt/tools/responsive-preview.html` (iframes at 390/820/1280/1680 px) and, to measure
  overflow, load pages in a same-origin iframe from the dev server (see lessons L-14).
