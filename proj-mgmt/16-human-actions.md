# 16 - Human Actions (things only the owner can do)

> Status: Live checklist | Last updated: 2026-09-27
> Everything else in the roadmap is being executed by agents on feature branches merged into
> `develop` (then fast-forwarded to `main`). The items below need credentials, console access
> or a decision that is yours. Tick them off here; each unblocks the phases named.

## Now (unblocks pushing and public work)

| # | Action | Why / what it unblocks | Notes |
|---|--------|------------------------|-------|
| H-1 | **Rotate and restrict the Google API key** that was committed in the legacy `src/.env` and `errorHandler.js` (project `devenv-259801`); delete the App Engine service account key named in `.gcloudignore` | Security P0 (proj-mgmt/07 section 12). The old key is in git history on GitHub already | The file is no longer tracked (`apps/legacy/src/.env.example` replaces it); history purge is optional after rotation |
| H-2 | **Push branches**: `git push -u origin main develop` (feature branches optional: `git push origin 'refs/heads/feat/*'`) | Agents cannot push (blocked by policy). CI only runs on the remote | Run from the repo root; `master` stays untouched |
| H-3 | GitHub repo settings: set **default branch to `main`**, add branch protection for `main` and `develop` (require the CI check, no force-push), enable **secret scanning + push protection** and Dependabot alerts | Branch model and safety net | Dependabot PR branches for the legacy app can be closed |
| H-4 | Decide the **repository visibility and license** | Launch checklist; affects how aggressively we purge history | Plan assumes private until launch |

## Phase 4 (backend, accounts, sharing)

| # | Action | Unblocks |
|---|--------|----------|
| H-5 | Create/confirm the GCP project for Maze Lab, enable billing, create the Terraform state bucket, grant a Workload Identity Federation provider for GitHub Actions (no JSON keys) | infra/terraform, `deploy-api.yml`, `deploy-web.yml` |
| H-6 | Enable **Identity Platform** (Google, GitHub, Apple, email + passkeys), register the OAuth apps at Google/GitHub/Apple | Sign-in (D-10) |
| H-7 | Create a **Sentry** organisation/project (or decide against it) and put the DSN in Secret Manager | Error reporting (D-16) |
| H-8 | Choose the production **domain** and point DNS at Firebase Hosting | Public URL, cookies (`__Host-` refresh cookie needs HTTPS) |

## Phase 6 (desktop and mobile)

| # | Action | Unblocks |
|---|--------|----------|
| H-9 | Apple Developer Program membership, Google Play Console account, Windows code-signing certificate (or Azure Trusted Signing) | Tauri builds and store submission |
| H-10 | Decide store presence (App Store / Play required; Microsoft Store and Mac App Store optional) | Release pipelines |

## Local machine (optional)

| # | Action | Why |
|---|--------|-----|
| H-13 | Allow phones on the LAN to reach the dev server: in an admin PowerShell `New-NetFirewallRule -DisplayName "Maze Lab dev (41920)" -Direction Inbound -Protocol TCP -LocalPort 41920 -Action Allow -Profile Private` (port moved from 5180 on 2026-10-03; an old 5180 rule, if you added one, can go) | The fnm Node binary has no inbound rule on the Private profile |
| H-14 | Reclaim disk: the merged agent worktrees under `.claude/worktrees/` each hold a full `node_modules`. When happy, run `git worktree remove --force <path>` for each (`git worktree list`) and delete the `worktree-agent-*` branches | Agents never delete files on Drive; this is the owner's call |

## Nice to have

| # | Action | Unblocks |
|---|--------|----------|
| H-11 | Turborepo remote cache token (Vercel) or a GCS bucket for the cache | Faster CI |
| H-12 | A second reviewer for `CODEOWNERS` on `apps/legacy` and `proj-mgmt/adr` | Review policy in proj-mgmt/12 |

## Working with the branch model

- Feature branches: `feat/<scope>` from `develop`; conventional commits; merged with `--no-ff`.
- `develop` is integration; `main` is fast-forwarded from `develop` when the full suite is green.
- Agents never push. After you push, CI on GitHub is the source of truth for green.
