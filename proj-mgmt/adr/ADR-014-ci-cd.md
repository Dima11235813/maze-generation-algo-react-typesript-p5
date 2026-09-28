# ADR-014 - CI/CD with GitHub Actions, Turborepo remote cache, Changesets, Renovate, security scanning

> Status: Proposed | Date: 2026-09-27 | Deciders: Dmitri Larionov | Register ID: D-14

## Context

There is no CI today. The monorepo needs affected-only builds, PR previews, gated deploys with
rollback, package versioning, dependency updates and security scanning integrated with GitHub
where the code lives.

## Decision

**GitHub Actions** workflows: `ci`, `security`, `deploy-web`, `deploy-api`, `release`,
`desktop-mobile`. **Turborepo remote cache** for speed. **Changesets** for package versions.
**Renovate** for dependency PRs. **CodeQL**, **gitleaks**, **Semgrep**, `pnpm audit`,
**OSV-Scanner** as required checks. Deploys authenticate with Workload Identity Federation.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Cloud Build | Native GCP | Weaker PR UX, separate config language | GitHub is the collaboration surface |
| GitLab CI / CircleCI | Capable | Another vendor | GitHub |
| Dependabot instead of Renovate | Built-in | Less grouping/config for monorepos | Renovate groups by workspace |

## Consequences

- Positive: everything visible on the PR; reusable workflows; matrix builds for Tauri.
- Negative: Actions minutes for macOS/iOS builds cost more; run desktop/mobile builds on tags
  only.
- Follow-ups: S1.4, S4.9, deploy workflows in Phase 4, S11.3/S11.4.

## Compliance

Branch protection requires `ci` and `security` checks; no direct pushes to `main`.
