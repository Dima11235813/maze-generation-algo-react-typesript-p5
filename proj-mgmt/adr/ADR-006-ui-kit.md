# ADR-006 - UI kit: shadcn/ui (Radix) + Tailwind CSS v4; retire Material-UI v4

> Status: Accepted (implemented 2026-09-27) | Date: 2026-09-27 | Deciders: Dmitri Larionov | Register ID: D-06

## Context

Material-UI v4 is end-of-life and uses runtime CSS-in-JS. The product needs accessible
primitives (dialogs, sliders, menus, tabs), design tokens for light/dark/high-contrast and
colour-blind palettes, small bundles, and a look that is ours rather than Material.

## Decision

Build `@maze/ui` on **shadcn/ui** components (copied into the repo, backed by **Radix UI**
primitives) styled with **Tailwind CSS v4** and CSS-variable design tokens. Icons from
**lucide-react**. Storybook documents every component with the a11y addon.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| MUI v7 | Continuity, breadth | Runtime CSS-in-JS or Pigment migration, Material look, bundle | Fresh start is cheaper than upgrading v4 -> v7 |
| Mantine | Complete, good a11y | Own styling system | shadcn gives ownership of the code |
| Chakra v3 | Good DX | Runtime styles | Same |
| Headless UI + Tailwind | Minimal | Fewer primitives than Radix | Radix breadth |

## Consequences

- Positive: components are source in our repo (no version lock), tokens drive canvas themes too.
- Negative: we own the component code and its a11y fixes.
- Follow-ups: S4.2; palette validation (S12.2).

## Compliance

`@material-ui/*` banned via Syncpack; every `@maze/ui` component has a story with a11y checks.
