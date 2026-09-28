# ADR-017 - Accessibility baseline: WCAG 2.2 AA as a release gate, DOM mirror for canvas

> Status: Proposed | Date: 2026-09-27 | Deciders: Dmitri Larionov | Register ID: D-17

## Context

The legacy app is canvas-only, blocks zoom (`user-scalable=no`), encodes state by colour alone
and has heavy motion. The product targets learners and educators, including users of assistive
technology; accessibility is both an ethical and a product requirement.

## Decision

**WCAG 2.2 Level AA** conformance is a Definition-of-Done item and a release gate. Every visual
renderer is paired with the **`dom` a11y adapter** (ARIA grid mirror) and a **step narrator**
(ARIA live). `prefers-reduced-motion` and `prefers-contrast` are honoured. Automated checks
(axe in Playwright, Storybook a11y addon, Lighthouse a11y 100) run in CI; manual screen-reader
passes happen each release.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Best-effort a11y | Less upfront work | Regressions, exclusion, legal exposure | Not acceptable for an education product |
| WCAG 2.1 AA | Slightly less | Misses 2.2 criteria relevant here (focus not obscured, target size, dragging alternatives) | 2.2 is current |
| AAA | Maximal | Some criteria impractical for interactive canvas | AA with selected AAA where cheap |

## Consequences

- Positive: keyboard/narration features double as learning aids.
- Negative: design constraints on motion and colour; more test surface.
- Follow-ups: S3.4, S3.7, S12.1-S12.5; plan in 10.

## Compliance

axe violations fail CI; a11y acceptance criteria required on every UI story.
