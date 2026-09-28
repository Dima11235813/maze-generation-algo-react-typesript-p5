# 07 - Security

> Status: Proposed | Last updated: 2026-09-27
> Decisions referenced: D-10, D-11, D-13, D-14 (see [README.md](./README.md))

Security is a release gate (guiding principle 5). This document records what is wrong in the
legacy codebase, the threat model for the target architecture in
[03-target-architecture.md](./03-target-architecture.md), the controls that close each
threat, and the checklists that make those controls verifiable in CI and code review.

---

## 1. Findings in the current codebase

Severity scale: **P0** act before any further public deploy; **P1** fix in Phase 0/1;
**P2** fix during migration; **P3** track only. Line numbers are as of commit `59ce2ca`.

| # | Sev | Location | Issue | Remediation |
|---|-----|----------|-------|-------------|
| F-01 | P0 | `src/.env:8`, `src/errorHandler.js:8-9` | Google API key `AIzaSy...K8FsY` committed in plain text and shipped in the client bundle, together with GCP project id `devenv-259801`. A second, older key is left in a comment at `src/errorHandler.js:6`. `src/.env` is not in `.gitignore` (only the `.local` variants are). | Rotate **both** keys in the GCP console today; restrict the replacement by HTTP referrer and to the Error Reporting API only. Purge from history with `git filter-repo` (or accept the leak and rely on rotation, documented in the ADR). Add `src/.env` to `.gitignore`, commit `src/.env.example` instead. Add gitleaks (section 7). |
| F-02 | P0 | `gcpServer/.gcloudignore:16`, `gcpServer/.gitignore:4` | A service-account key file `devenv-259801-e0a3c51e758c.json` was used for deploys. `git log --all` confirms it was never committed, but it lived on a developer machine and its name is public. | Delete the key in IAM and rotate. Never create long-lived SA keys again: CI authenticates via Workload Identity Federation (see [08](./08-ci-cd-deployment-observability.md) section 6). |
| F-03 | P1 | `src/utils/errorReporting.ts:62-66` | Hardcoded fake PII (`name: "Some User"`, `preferredName: "Suser@gmail.com"`, `isAdmin: "true"`) is attached to every error report POSTed to `/reportError`. Shows the report schema was designed to carry user identity and admin flag. | Remove. Error reports carry an opaque session id only; identity is joined server-side if ever needed. Sentry replaces the custom endpoint (D-16). |
| F-04 | P1 | `src/AppRoutes.tsx:11,36` | The `/login` route renders `ComponentThatThrows`, a test component that throws in `componentDidMount`. Test artifact wired into a production route; also a trivial way to generate error-report traffic. | Restore `LoginView` or remove the route until the new auth flow exists. Test-only components move under `__tests__/` or `*.stories.tsx`. |
| F-05 | P1 | `src/AppWrapper.tsx:19-20` | Apollo client hardcodes `http://localhost:4000/graphql` with `credentials: "include"`. In production this sends cookies to an unreachable origin and signals a cookie-based session design without CSRF protection. | Backend and auth are replaced (D-07, D-10). The new client reads its base URL from validated env config and uses bearer tokens plus a SameSite refresh cookie. |
| F-06 | P1 | `gcpServer/` (server.js not versioned), `postBuild/app.yaml` | No Content-Security-Policy, HSTS or other security headers are defined anywhere that is versioned. `helmet` is in `gcpServer/package.json` but the server file that would configure it is git-ignored, so the deployed configuration is unknown and unreproducible. | Retire App Engine (D-13). Headers are set declaratively in `firebase.json` for the SPA and in the NestJS bootstrap for the API (section 4). |
| F-07 | P1 | `src/.env:10` | `GENERATE_SOURCEMAP=true` publishes full source maps with the production bundle, exposing source and any embedded config. | Build with source maps but upload them privately to Sentry; do not serve `*.map` (section 4.4). |
| F-08 | P1 | `postBuild/postBuild.js:1` | Requires `fs-extra`, which is not declared in `package.json`. The build only works because of a transitive install; a clean install or a hijacked transitive would break or compromise the deploy step. | Declared, pinned dependencies only; `pnpm` strict `node-linker` disallows undeclared imports. Build script replaced by the CI pipeline. |
| F-09 | P1 | `postBuild/app.yaml:1` | `runtime: nodejs12` is end-of-life on App Engine and no longer receives security patches. | Node 22 LTS on Cloud Run (D-02, D-13). |
| F-10 | P1 | `package.json` | Dependencies frozen in 2020: `react-scripts@3.1.2`, `node-sass@4`, `apollo-boost`, `typescript@3.6.3`, `helmet@3`, `express@4.17`, `body-parser@1.19`. Dozens of published CVEs in the transitive tree (`minimist`, `node-forge`, `browserslist`, `ansi-regex`, `serialize-javascript` ...). No `audit` step exists in any script. | Full dependency reset in the new monorepo (see [09](./09-modernization-migration.md)); `pnpm audit --prod` and OSV-Scanner as CI gates (section 6). |
| F-11 | P2 | `public/index.html:7` | `user-scalable=no` disables pinch zoom. Primarily a WCAG 1.4.4 failure (see [10](./10-accessibility.md)) but also a "security" footgun: it is often paired with clickjacking-style overlays. | Remove; use `width=device-width, initial-scale=1`. |
| F-12 | P2 | `src/mazeGenComp/mazeUtils/mazeOptions.ts:46-56` | Every `MazeOptions` instance adds a `wheel` listener to `window` that is never removed, and reads the non-standard `event.wheelDelta`. Leaks on every re-render/resize; a page left open degrades (self-inflicted DoS). | Legacy code is frozen. In the new app, event subscriptions live in the renderer adapter's `mount`/`destroy` pair and are tested for cleanup. |
| F-13 | P2 | `src/api/CustomFetch.ts:35-37` | `catch` swallows the error and rejects with `undefined`, hiding failures from the user and from telemetry. | Typed error channel (RFC 9457 Problem Details) and Sentry breadcrumbs. |
| F-14 | P3 | `tempData/`, `misc/`, `pics/` | Screenshots of GCP console (`tempData/info/*.PNG`) and a `sampleReq.json` are committed. Screenshots may reveal project ids, emails and IAM layout. | Review images before any public mirror; move to a private docs location or redact. Per workspace rules nothing is deleted from Drive, so record the review outcome in the ADR. |
| F-15 | P3 | `src/shared/sharedData.ts` | Local-storage key names for `access_token` / `id_token` indicate tokens were intended to be stored in `localStorage` (XSS-readable). | Access token in memory only; refresh via httpOnly `SameSite=Strict` cookie (D-10, section 4.3). |

Verification commands used for this table (re-run before Phase 0 sign-off):

```bash
git log --all --diff-filter=A --name-only --format="" | grep -i "devenv-259801"   # expect no output
grep -rn "AIza" --include=*.js --include=*.ts --include=*.env src/               # expect no output after fix
```

## 2. Threat model (STRIDE-lite over the target architecture)

Assets: user accounts and sessions, saved mazes (private/unlisted/public), solve and race
records that feed leaderboards, lesson progress, the build and deploy pipeline, cloud
credentials.

| Component | Spoofing | Tampering | Repudiation | Info disclosure | Denial of service | Elevation of privilege |
|-----------|----------|-----------|-------------|-----------------|-------------------|------------------------|
| **Web / Tauri client** | Phishing lookalike; stolen refresh cookie | XSS injecting into maze names/descriptions; tampered Tauri bundle | n/a | Secrets in bundle; source maps; verbose errors | Huge maze params freezing the tab | Client-side CASL bypass (UI only; API re-checks) |
| **API (Cloud Run)** | Forged/expired JWT; token from wrong audience/issuer | Body/param injection; mass assignment on `MazeDocument`; replayed solve submissions | Missing audit trail for admin actions | Stack traces in Problem Details; PII in logs; IDOR on `/mazes/:id` | Unbounded generation requests; unpaginated lists; missing rate limit | Ownership check missing on update/delete; role claim trusted from client |
| **PostgreSQL** | Reused DB password | Prisma raw queries; migration from untrusted branch | Missing `updated_by` | Public IP; backups unencrypted; over-broad DB role | Connection exhaustion | `postgres` superuser used by app |
| **Redis** | Unauthenticated instance | Cache poisoning of leaderboards | n/a | Session material cached in clear | Key-space flood via rate-limit keys | n/a |
| **Identity Platform (IdP)** | Account takeover via weak email flow | Tampered ID token claims | n/a | Provider misconfig exposing emails | Auth outage blocks sign-in (guest mode mitigates) | Custom claims set by a compromised service account |
| **CI / GitHub Actions** | Compromised third-party action; PR from fork running with secrets | Malicious dependency in lockfile; Terraform drift | Unsigned commits/releases | Secrets echoed in logs; artifact leaks | Cache poisoning | Long-lived SA key in repo secrets (the legacy pattern) |

Each cell maps to at least one control in sections 4 to 8. The residual-risk register lives
in the ADR and is reviewed each phase gate.

## 3. Requirements mapping

Target: **OWASP ASVS 4.0.3 Level 2** for the API and web app. Selected chapters and how each
is satisfied. (V6 cryptography is covered by the platform: TLS at the edge, Cloud KMS at rest.)

| ASVS chapter | Requirement (summary) | Implementation | OWASP Top 10 2021 |
|--------------|-----------------------|----------------|-------------------|
| V1 Architecture | Trust boundaries documented; components segregated | This doc + 03 section 11; ESLint import boundaries | A04 Insecure Design |
| V2 Authentication | Delegated to OIDC IdP; MFA/passkeys available; no custom password store | D-10, [06](./06-authn-authz.md) | A07 Identification & Auth Failures |
| V3 Session | Short-lived access tokens; rotating refresh tokens in httpOnly cookies; server-side revocation list in Redis | 06 section on sessions | A07 |
| V4 Access control | Deny by default; every mutation checks ownership; abilities defined once | D-11 CASL guard + `@maze/contracts/abilities` | A01 Broken Access Control |
| V5 Validation | All input validated with zod at the contract boundary; output encoding by React; no `dangerouslySetInnerHTML` | D-08 ts-rest + zod; ESLint rule `react/no-danger` | A03 Injection |
| V7 Error handling & logging | Problem Details without stack traces; structured logs without PII; audit log for admin actions | 04 backend errors filter; pino redaction | A09 Logging Failures |
| V8 Data protection | Data minimisation; export/delete endpoints; TLS everywhere; secrets in Secret Manager | Section 4.3, section 9 | A02 Cryptographic Failures |
| V9 Communications | TLS 1.2+; HSTS preload; no mixed content | Firebase Hosting + Cloud Run defaults, headers in section 4.1 | A02 |
| V10 Malicious code | Lockfile integrity; dependency review; SBOM; provenance | Section 6 | A08 Software & Data Integrity |
| V11 Business logic | Solve/race submissions replay-validated with `@maze/core`; rate limits on scoring endpoints | 04 solves module | A04 |
| V12 Files & resources | Maze import size and dimension caps; no file uploads in v1 | Contract schemas `max` bounds | A05 Security Misconfiguration |
| V13 API | CORS allowlist; JSON only; schema-validated; versioned | Section 4.2 | A05 |
| V14 Configuration | Hardened headers; no default credentials; IaC reviewed; SSRF not applicable (no outbound fetch of user URLs) | Section 4, [08](./08-ci-cd-deployment-observability.md) | A05, A06 Vulnerable Components, A10 SSRF |

## 4. Controls by layer

### 4.1 Edge / static hosting (Firebase Hosting, D-13)

Headers declared in `firebase.json` and verified by a Playwright test against the preview
channel:

```json
{
  "hosting": {
    "headers": [{
      "source": "**",
      "headers": [
        { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" },
        { "key": "Content-Security-Policy", "value": "default-src 'self'; script-src 'self' 'nonce-{{nonce}}'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' https://api.mazelab.app https://*.googleapis.com https://*.sentry.io; worker-src 'self' blob:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=(), payment=()" },
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" }
      ]
    }]
  }
}
```

- CSP nonces: Vite injects a build-time nonce placeholder; the SPA shell is served by the CDN
  so nonces are per-build, and `'strict-dynamic'` is added once all scripts are module
  scripts. `style-src 'unsafe-inline'` is a known Tailwind v4 / Radix constraint and is
  tracked as a residual risk with a plan to move to hashed styles.
- `Cross-Origin-Embedder-Policy: require-corp` is enabled only on routes that need
  `SharedArrayBuffer` (large-maze Worker mode); everything else stays COEP-less to keep
  third-party avatars working.
- `*.map` files are excluded from the deployed directory (F-07).

### 4.2 API (NestJS on Fastify, D-07)

| Control | Implementation |
|---------|----------------|
| Security headers | `@fastify/helmet` with the same CSP family as the edge (API returns JSON only, so `default-src 'none'`) |
| CORS | `@fastify/cors` with an explicit origin allowlist per environment from validated env config; credentials allowed only for the refresh endpoint |
| Rate limiting | `@fastify/rate-limit` backed by Redis: global 300 req/min per IP; 20 req/min on `/auth/*`; 10 req/min on `/solves` and `/races` submissions; 5 req/min on `/mazes` create for guests |
| Input validation | Every route implements the ts-rest contract (D-08); zod schemas carry `max` bounds: grid <= 500x500, name <= 80 chars, description <= 2000 chars, tags <= 10 |
| Body limits | Fastify `bodyLimit` 256 kB default; 1 MB on `/mazes` import; `MazeDocument.walls` length must equal `width*height` after base64 decode |
| Authentication | Identity Platform JWT verified against JWKS with issuer and audience pinned; clock skew 30 s; revoked-token check in Redis |
| Authorization | CASL guard (D-11) on every non-public route; ownership loaded from the repository, never from the request body; `visibility` transitions validated |
| Mass assignment | DTOs are `z.object({...}).strict()`; update routes accept explicit patch schemas, never the full entity |
| Error handling | Global filter emits RFC 9457 Problem Details with a correlation id; stack traces only to Sentry; 5xx messages are generic |
| Anti-replay | Solve submissions carry the maze content hash, seed and a move list; server replays with `@maze/core`, rejects if goal not reached or moves illegal; idempotency key per submission |
| Dependency pinning | Exact versions in `package.json` for `apps/api`; lockfile frozen in CI (`pnpm install --frozen-lockfile`) |
| Health endpoints | `/health/live` and `/health/ready` return no version or dependency details to unauthenticated callers |

### 4.3 Data (Cloud SQL, Memorystore, Secret Manager)

- Cloud SQL on **private IP only**, accessed from Cloud Run through the VPC connector;
  automated backups with 7-day PITR; encryption at rest with Google-managed keys (CMEK is
  a documented upgrade path, not required for v1 data classes).
- Two DB roles: `maze_migrator` (DDL, used only by the migration job) and `maze_app` (DML on
  application tables, no `CREATE`, no `SUPERUSER`). Prisma uses `maze_app` at runtime.
- Redis with AUTH enabled and TLS in transit; no session payloads stored, only opaque ids,
  rate-limit counters, leaderboard sorted sets and cache-aside entries with TTL.
- Secrets (DB password, Redis AUTH, Sentry DSN, IdP service account for custom claims) live
  in **Secret Manager** and are mounted into Cloud Run as env vars at deploy time. No
  `.env` files in production images. Rotation schedule: DB and Redis credentials every 90
  days (automated Terraform + Cloud Run redeploy), IdP keys managed by Google, Sentry DSN on
  suspicion only.
- Logs: pino `redact` list covers `req.headers.authorization`, `req.headers.cookie`,
  `*.email`, `*.password`, `*.token`. No maze content is logged (may be user-created).
- PII inventory: email, display name, OAuth provider id, IP in rate-limit keys (hashed,
  10 min TTL). Nothing else.

### 4.4 Client (web PWA and Tauri shells)

- **No secrets in the bundle.** The Identity Platform web API key is a public identifier
  restricted by HTTP referrer and Android/iOS app id; it is the only key allowed client-side.
  A CI check greps the built `dist/` for `AIza`, `sk_`, `-----BEGIN` and fails on match.
- **Trusted Types**: `require-trusted-types-for 'script'` is enabled once three.js and the
  Worker loader are verified compatible (spike in Phase 2); until then the directive runs in
  `Content-Security-Policy-Report-Only`.
- **User content**: maze names, descriptions and tags are rendered as text by React, length
  and character-class validated by the shared zod schema, and never interpolated into HTML,
  URLs or CSS. Markdown in descriptions is out of scope for v1.
- **Share links**: `/m/:shareId` uses a 128-bit random, base62 id generated server-side,
  separate from the primary key; unlisted mazes are not enumerable; public mazes go through
  a moderation flag before appearing in `/explore`.
- **Storage**: access token in memory (Zustand, non-persisted slice); refresh cookie
  `httpOnly; Secure; SameSite=Strict; Path=/auth/refresh`; guest data in IndexedDB is
  non-sensitive (mazes and preferences).
- **Tauri 2**: capabilities declared per window in `src-tauri/capabilities/*.json` with only
  `fs:allow-app-write`, `dialog:allow-save`, `shell:allow-open` (for external links) and the
  updater plugin; CSP set in `tauri.conf.json` mirroring 4.1 with `tauri:` and `ipc:` schemes;
  updater artifacts signed with the Tauri minisign key stored in GitHub encrypted secrets and
  verified on the client; IPC commands validate arguments with `serde` types and never
  accept raw paths outside the app data dir.

## 5. Authentication and authorization security notes (D-10, D-11)

Design lives in [06-authn-authz.md](./06-authn-authz.md). Security-relevant constraints that
document must honour:

- Only Identity Platform issues identities; the API never sees passwords.
- Access token lifetime <= 15 min; refresh token rotation with reuse detection (a reused
  refresh token revokes the whole family).
- Roles (`guest`, `user`, `educator`, `admin`) are **custom claims set server-side** via the
  Admin SDK and mirrored in the `users` table; the API trusts the database row, not the
  client-presented claim, for anything beyond routing.
- Educator/admin promotion is an audited admin action with a second approver in v1 (two
  admin accounts exist from day one so this is enforceable).
- CASL abilities are unit-tested with a matrix of (role x action x resource state) in
  `@maze/contracts`; the same test file is executed by the API test suite to prove parity.

## 6. Supply chain

| Control | Tooling | Gate |
|---------|---------|------|
| Deterministic installs | `pnpm-lock.yaml`, `--frozen-lockfile`, `engine-strict`, `minimum-release-age` set to 3 days in `.npmrc` to avoid freshly published malicious versions | CI fails on lockfile drift |
| Vulnerability scanning | `pnpm audit --prod --audit-level=high` and **OSV-Scanner** on the lockfile | Fail on high/critical without an approved `.osv-scanner.toml` ignore with expiry |
| Behavioural scanning | **Socket** GitHub app (or `socket-security` action) flagging install scripts, network access, typosquats in PRs | Blocking comment on PR |
| Updates | **Renovate** with grouped weekly PRs, automerge for patch-level dev dependencies with green CI, pinned GitHub Actions by SHA | Weekly cadence |
| Provenance | GitHub `attest-build-provenance` for API container image and Tauri artifacts; images signed with `cosign` (keyless, Sigstore) | Cloud Run deploy verifies attestation |
| SBOM | CycloneDX generated per release for `apps/api` image and `apps/web` bundle (`@cyclonedx/cyclonedx-npm`), attached to the GitHub Release | Required release artifact |
| Actions hygiene | Third-party actions pinned to full SHA; `permissions:` block minimal per job; `pull_request` from forks runs without secrets; Dependabot for actions | Enforced by `zizmor` lint in CI |
| Build isolation | API image built from `node:22-slim` digest-pinned base, multi-stage, non-root user, read-only filesystem, `pnpm deploy --prod` output only | Trivy image scan on build |

## 7. Secret scanning

- **gitleaks** runs as a `lefthook` pre-commit hook (staged diff) and in `security.yml` on
  the full history of the PR branch; a baseline file documents the two known legacy leaks
  (F-01) so the scan stays green after rotation while still failing on anything new.
- GitHub **secret scanning with push protection** is enabled on the repository.
- Build output scan (section 4.4) catches secrets that reach the bundle through env
  interpolation rather than source.

## 8. Security testing in the pipeline

| Stage | Tool | Scope | Failure policy |
|-------|------|-------|----------------|
| Pre-commit | gitleaks, eslint security rules | staged files | block commit |
| PR | **CodeQL** (javascript-typescript, `security-extended` suite) | whole repo | block merge on high |
| PR | **Semgrep** with `p/typescript`, `p/nodejs`, `p/react`, `p/owasp-top-ten`, plus custom rules: no `process.env` outside `env.ts`, no `dangerouslySetInnerHTML`, no Prisma `$queryRawUnsafe` | changed files | block merge |
| PR | Unit tests for CASL matrix, zod bounds, Problem Details filter | contracts, api | block merge |
| PR | Playwright security assertions: headers present, `*.map` 404, CSP violations reported = 0 | preview channel | block merge |
| Nightly | **OWASP ZAP baseline** against staging API and web (authenticated with a test user) | staging | open issue on new medium+ |
| Nightly | OSV-Scanner + Trivy on latest images | artifacts | open issue |
| Per release | Manual review of ADR residual-risk register; SBOM diff | release | release checklist |
| Annually | External penetration test once the app has real users and a leaderboard | prod | budget line item |

## 9. Privacy

- **Data minimisation**: account = email + display name + provider id. No date of birth,
  no location. Analytics are cookie-less (Plausible-style, self-hosted or privacy-first
  vendor) with no cross-site identifiers; decision recorded in ADR-016 addendum.
- **User rights**: `/account/export` returns a JSON archive (profile, mazes, solves, progress);
  `/account/delete` soft-deletes immediately, hard-deletes after 30 days, and anonymises
  leaderboard rows (score kept, identity removed). Both are covered by E2E tests.
- **Consent**: no non-essential cookies, so no cookie banner is legally required in most
  jurisdictions; a short privacy notice is linked in the footer and in the app stores.
- **Children**: the product is educational and may attract under-13 users. v1 does not
  collect age; guest mode is fully functional without an account so the sign-up path can be
  gated behind an age statement when required.
- **Retention**: error events 90 days (Sentry), request logs 30 days, audit logs 400 days,
  backups 7 days PITR.

## 10. Incident response and disclosure

- `SECURITY.md` at the repo root: supported versions, how to report (dedicated mailbox and
  GitHub private vulnerability reporting), PGP key optional, expected response times.
- Triage SLA: acknowledge within 2 business days, severity assigned within 5, fix or
  mitigation for critical within 7 days, disclosure coordinated after fix.
- Runbook `infra/runbooks/incident.md`: revoke tokens (Redis flush of refresh families),
  rotate secrets via Terraform, roll back Cloud Run revision, disable sign-ups via feature
  flag, communicate via status page.
- Post-incident review within 10 days, written up as an ADR addendum with action items in
  the backlog.

## 11. Definition of Done - security gate

A story is not done until every applicable item is checked. The checklist is a PR template
section; reviewers verify it.

- [ ] New inputs validated by a zod schema in `@maze/contracts` with explicit bounds.
- [ ] New API routes have a CASL ability and a test in the (role x action) matrix.
- [ ] No new `process.env` access outside `env.ts`; no new secrets; build-output grep passes.
- [ ] No PII added to logs, traces, analytics or error reports; redaction list updated.
- [ ] Error paths return Problem Details without internals.
- [ ] New dependencies reviewed (Socket report clean, licence acceptable, maintained).
- [ ] Rate limit considered for any new mutation endpoint.
- [ ] Headers/CSP unchanged, or change reviewed and Playwright header test updated.
- [ ] Tauri capabilities unchanged, or the diff is justified in the PR.
- [ ] Threat model table (section 2) updated if a new component or data flow was introduced.

## 12. Phase 0 - do immediately (before any other work)

Ordered; the first three happen the same day this plan is accepted.

1. Rotate the Error Reporting API key(s) in GCP project `devenv-259801`; restrict the new key
   by referrer and API; confirm the old keys return 403.
2. Delete the `devenv-259801-e0a3c51e758c` service-account key in IAM; check Cloud Audit Logs
   for its recent use.
3. Remove `src/.env` from the index, add it to `.gitignore`, add `src/.env.example` with
   placeholder values; strip the key literals from `src/errorHandler.js`.
4. Decide (ADR) whether to rewrite history with `git filter-repo`. Recommendation: yes, since
   the repository has a single contributor and no downstream forks; coordinate with the Drive
   sync so the rewritten clone replaces the working copy without deleting Drive files.
5. Enable GitHub secret scanning with push protection; add gitleaks pre-commit and CI job with
   a baseline.
6. Replace the `/login` route's `ComponentThatThrows` with a placeholder page or remove the
   route from the legacy app before it is moved to `apps/legacy`.
7. Take the App Engine service offline or restrict it to authenticated IAP access until the
   Cloud Run deployment replaces it; it runs an EOL runtime with an unversioned server.
8. Review `tempData/info/*.PNG` for exposed identifiers; document the outcome.
9. Add `SECURITY.md`.

Completion of this list is the exit criterion for Phase 0 in
[14-roadmap.md](./14-roadmap.md).
