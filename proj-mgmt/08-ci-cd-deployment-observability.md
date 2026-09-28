# 08 - CI/CD, Deployment & Observability

> Status: Proposed | Last updated: 2026-09-27
> Decisions referenced: D-01, D-02, D-12, D-13, D-14, D-16 (see [README.md](./README.md))

This document defines how code moves from a pull request to production for every app in the
monorepo described in [03-target-architecture.md](./03-target-architecture.md), how the cloud
footprint is provisioned, and how the running system is observed.

---

## 1. Current state

| Aspect | Today | Problem |
|--------|-------|---------|
| Build | `yarn build` locally; `postbuild` copies `build/` and `postBuild/app.yaml` into `gcpServer/` | Runs on a developer laptop; depends on undeclared `fs-extra`; no reproducibility |
| Deploy | `gcloud app deploy` from `gcpServer/` using a service-account JSON key on disk | App Engine Standard `nodejs12` (EOL); manual; key-file based auth (see [07](./07-security.md) F-02) |
| Server | `gcpServer/server.js` referenced by `package.json` but git-ignored via `/gcpServer/*` | The thing that actually serves production is not in version control |
| CI | None | No tests, lint or typecheck run anywhere but a laptop |
| Environments | One App Engine service; no staging | Every deploy is a production deploy |
| Observability | `stackdriver-errors-js` (marked experimental by its authors) plus a custom `/reportError` POST; `console.log` metrics inside the p5 draw loop | No traces, no structured logs, no dashboards, fake PII in reports |
| Infra as code | `postBuild/app.yaml` and two failed attempts in `tempData/*.yaml` | Nothing else is declared; everything was clicked in the console (`tempData/info/*.PNG`) |

Everything in this table is retired by the target design; nothing is migrated in place.

## 2. Pipeline overview

```
 PR opened ---> ci.yml -----------------> required checks green
           |--> security.yml ----------> required checks green
           |--> deploy-web.yml (preview channel per PR, URL commented on PR)
           `--> deploy-api.yml (ephemeral Cloud Run revision tagged pr-<n>, 0% traffic)

 merge to main ---> ci.yml + security.yml (re-run on merge commit)
               |--> deploy-web.yml   -> staging channel -> manual approval -> prod (live)
               |--> deploy-api.yml   -> staging service -> smoke -> manual approval -> prod canary 10% -> 100%
               `--> release.yml      -> Changesets "Version Packages" PR; on merge: tag, GitHub Release, SBOM

 tag v*.*.* ---> desktop-mobile.yml -> Tauri build matrix -> signed artifacts -> GitHub Release + updater manifest
                                     -> Android AAB to Play internal track, iOS IPA to TestFlight
```

Principles: every workflow is idempotent, every job has a minimal `permissions:` block,
third-party actions are pinned to a SHA, and nothing long-lived is stored as a GitHub secret
except the Tauri signing key and store credentials.

## 3. Workflows

### 3.1 `ci.yml` - build, test, lint

```yaml
name: ci
on:
  pull_request:
  push: { branches: [main] }
permissions: { contents: read }
concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }
jobs:
  verify:
    runs-on: ubuntu-latest
    timeout-minutes: 25
    steps:
      - uses: actions/checkout@<sha>
        with: { fetch-depth: 0 }                      # turbo --filter needs history
      - uses: pnpm/action-setup@<sha>                 # version from packageManager field
      - uses: actions/setup-node@<sha>
        with: { node-version-file: .nvmrc, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo run typecheck lint test build --filter=...[origin/main] --cache-dir=.turbo
        env: { TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}, TURBO_TEAM: maze-lab }
      - run: pnpm turbo run storybook:build --filter=@maze/ui
      - run: pnpm size-limit                          # apps/web budgets from 03 section 12
      - uses: codecov/codecov-action@<sha>            # or coverage summary comment
  e2e:
    needs: verify
    runs-on: ubuntu-latest
    services:
      postgres: { image: postgres:16, env: { POSTGRES_PASSWORD: test }, ports: ['5432:5432'] }
      redis:    { image: redis:7, ports: ['6379:6379'] }
    steps:
      - # checkout / pnpm / node as above
      - run: pnpm --filter @maze/api prisma migrate deploy
      - run: pnpm --filter @maze/api start:test &
      - run: pnpm --filter web exec playwright install --with-deps chromium
      - run: pnpm --filter web test:e2e             # includes axe assertions and visual snapshots
      - uses: actions/upload-artifact@<sha>
        if: failure()
        with: { name: playwright-report, path: apps/web/playwright-report }
```

Notes:

- `--filter=...[origin/main]` runs only affected workspaces; the Turborepo remote cache makes
  full runs cheap when nothing changed.
- Visual snapshots use deterministic seeds so canvas output is stable (see
  [12](./12-quality-engineering.md)).
- The `e2e` job is required for merge; `verify` alone is not enough.

### 3.2 `security.yml`

```yaml
name: security
on:
  pull_request:
  push: { branches: [main] }
  schedule: [{ cron: '0 3 * * *' }]
permissions: { contents: read, security-events: write }
jobs:
  codeql:
    steps: [checkout, github/codeql-action/init (javascript-typescript, queries: security-extended), autobuild, analyze]
  gitleaks:
    steps: [checkout (fetch-depth 0), gitleaks/gitleaks-action with .gitleaks.toml baseline]
  semgrep:
    container: semgrep/semgrep
    steps: [checkout, semgrep ci --config p/typescript --config p/nodejs --config p/react --config p/owasp-top-ten --config .semgrep/]
  deps:
    steps:
      - pnpm install --frozen-lockfile
      - pnpm audit --prod --audit-level=high
      - google/osv-scanner-action (lockfile mode, config .osv-scanner.toml)
      - zizmor .github/workflows            # lints the workflows themselves
```

All four jobs are required checks. The nightly schedule catches newly disclosed CVEs in an
unchanged lockfile.

### 3.3 `deploy-web.yml`

```yaml
name: deploy-web
on:
  pull_request:
  push: { branches: [main] }
permissions: { contents: read, id-token: write, pull-requests: write }
jobs:
  build:
    steps:
      - # checkout / pnpm / node
      - run: pnpm turbo run build --filter=web
        env: { VITE_API_URL: ${{ vars.API_URL }}, VITE_IDP_KEY: ${{ vars.IDP_WEB_KEY }}, VITE_SENTRY_RELEASE: ${{ github.sha }} }
      - run: pnpm --filter web exec sentry-cli sourcemaps upload --release ${{ github.sha }} dist   # then delete *.map
      - run: find apps/web/dist -name '*.map' -delete
      - run: grep -rE 'AIza|sk_live|BEGIN (RSA|EC) PRIVATE' apps/web/dist && exit 1 || true
      - uses: actions/upload-artifact@<sha>
        with: { name: web-dist, path: apps/web/dist }
  preview:
    if: github.event_name == 'pull_request'
    needs: build
    steps:
      - uses: google-github-actions/auth@<sha>
        with: { workload_identity_provider: ${{ vars.WIF_PROVIDER }}, service_account: ${{ vars.DEPLOYER_SA }} }
      - uses: FirebaseExtended/action-hosting-deploy@<sha>
        with: { channelId: pr-${{ github.event.number }}, expires: 7d, projectId: ${{ vars.GCP_PROJECT }} }
  staging:
    if: github.ref == 'refs/heads/main'
    needs: build
    environment: staging
    steps: [auth, firebase hosting:channel:deploy staging]
  production:
    needs: staging
    environment: production          # requires manual approval in GitHub environment settings
    steps: [auth, firebase deploy --only hosting:web]
```

Firebase Hosting rewrites `/api/**` to the Cloud Run service so the web origin and API share
a domain (simpler CORS, cookies scoped to one site).

### 3.4 `deploy-api.yml`

```yaml
name: deploy-api
on:
  pull_request: { paths: ['apps/api/**', 'packages/core/**', 'packages/contracts/**', 'infra/docker/**'] }
  push: { branches: [main] }
permissions: { contents: read, id-token: write, packages: write, attestations: write }
env:
  IMAGE: ${{ vars.REGION }}-docker.pkg.dev/${{ vars.GCP_PROJECT }}/maze/api
jobs:
  image:
    steps:
      - # checkout, auth via WIF, docker/setup-buildx
      - run: docker buildx build -f infra/docker/api.Dockerfile -t $IMAGE:${{ github.sha }} --push --provenance=true --sbom=true .
      - uses: aquasecurity/trivy-action@<sha>
        with: { image-ref: '${{ env.IMAGE }}:${{ github.sha }}', severity: 'HIGH,CRITICAL', exit-code: '1' }
      - uses: actions/attest-build-provenance@<sha>
      - run: cosign sign --yes $IMAGE@$DIGEST
  migrate-staging:
    needs: image
    environment: staging
    steps:
      - run: gcloud run jobs execute maze-api-migrate --region $REGION --wait   # image tag = sha; runs `prisma migrate deploy` as maze_migrator
  deploy-staging:
    needs: migrate-staging
    steps:
      - run: gcloud run deploy maze-api-staging --image $IMAGE:${{ github.sha }} --region $REGION --no-traffic --tag sha-${{ github.sha }}
      - run: pnpm --filter @maze/api smoke -- --base-url https://sha-${{ github.sha }}---maze-api-staging-<hash>.a.run.app
      - run: gcloud run services update-traffic maze-api-staging --to-latest
  deploy-prod:
    needs: deploy-staging
    environment: production
    steps:
      - run: gcloud run jobs execute maze-api-migrate-prod --wait
      - run: gcloud run deploy maze-api --image $IMAGE:${{ github.sha }} --no-traffic --tag canary
      - run: gcloud run services update-traffic maze-api --to-tags canary=10
      - run: pnpm --filter @maze/api smoke -- --base-url https://canary---maze-api-<hash>.a.run.app
      - run: sleep 600 && node scripts/check-slo.mjs --window 10m --revision canary   # error rate < 1%, p95 < 300ms
      - run: gcloud run services update-traffic maze-api --to-latest
      - if: failure()
        run: gcloud run services update-traffic maze-api --to-revisions LATEST=0,$PREVIOUS=100
```

Dockerfile outline (`infra/docker/api.Dockerfile`): `node:22-slim@sha256:...` base; stage 1
`pnpm install --frozen-lockfile` + `turbo build --filter=@maze/api`; stage 2
`pnpm deploy --prod --filter=@maze/api /out`; final stage copies `/out`, runs as `node`
user, read-only root FS, `HEALTHCHECK` on `/health/live`, `NODE_OPTIONS=--enable-source-maps`.

### 3.5 `release.yml`

- `changesets/action` opens/updates a "Version Packages" PR whenever changesets exist on
  `main`; merging it bumps `packages/*` versions, updates changelogs, and creates git tags.
- Packages stay private (`"private": true` in the root, `publishConfig` pointing at GitHub
  Packages is prepared but disabled until a second consumer exists).
- Apps are tagged `web-v<semver>`, `api-v<semver>`, `desktop-v<semver>` by the same job using
  `changeset tag`; a GitHub Release is created with the CycloneDX SBOMs and the OpenAPI spec
  generated from `@maze/contracts`.

### 3.6 `desktop-mobile.yml` (D-12)

```yaml
on: { push: { tags: ['desktop-v*'] } }
jobs:
  desktop:
    strategy:
      matrix:
        include:
          - { os: windows-latest, target: x86_64-pc-windows-msvc }
          - { os: macos-latest,   target: aarch64-apple-darwin }
          - { os: macos-latest,   target: x86_64-apple-darwin }
          - { os: ubuntu-22.04,   target: x86_64-unknown-linux-gnu }
    runs-on: ${{ matrix.os }}
    steps:
      - # checkout, pnpm, node, dtolnay/rust-toolchain, tauri-apps/tauri-action
      - uses: tauri-apps/tauri-action@<sha>
        env:
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}          # notarisation on macOS
          WINDOWS_CERTIFICATE: ${{ secrets.WINDOWS_CERTIFICATE }}      # Authenticode
        with: { tagName: ${{ github.ref_name }}, releaseName: 'Maze Lab ${{ github.ref_name }}', includeUpdaterJson: true }
  android:
    runs-on: ubuntu-latest
    steps: [setup JDK 17 + Android SDK/NDK, pnpm tauri android build --aab, sign with upload key, upload to Play internal track via r0adkll/upload-google-play]
  ios:
    runs-on: macos-latest
    steps: [xcode-select, pnpm tauri ios build --export-method app-store-connect, upload via App Store Connect API key (apple-actions/upload-testflight-build)]
```

The updater manifest (`latest.json`) published with the release is what installed desktop
apps poll; signatures are verified against the public key embedded in `tauri.conf.json`.
Mobile store promotion from internal/TestFlight to production is a manual step by design.

## 4. Environments

| Env | Web | API | Data | Purpose | Deploy trigger | Approval |
|-----|-----|-----|------|---------|----------------|----------|
| **local** | Vite dev server | `nest start --watch` | `docker compose up` (postgres:16, redis:7, otel-collector, mailpit) | Development | manual | none |
| **dev (PR preview)** | Firebase preview channel `pr-<n>` (7-day expiry) | Cloud Run revision tag `pr-<n>` on staging service, 0% traffic | Shared staging DB with per-PR schema? No: uses staging DB read-only fixtures + ephemeral Redis namespace | Review | PR open/update | none |
| **staging** | Firebase channel `staging` | `maze-api-staging` service | `maze-staging` Cloud SQL instance (small), staging Redis | Integration, ZAP, load tests | merge to `main` | none |
| **production** | Firebase live channel on `mazelab.app` | `maze-api` service, canary tags | `maze-prod` Cloud SQL (HA), prod Redis | Users | after staging green | required reviewer (owner) |

Promotion rules:

- Only images that passed staging smoke tests are eligible for prod; the workflow deploys the
  same digest, never rebuilds.
- Database migrations run in a dedicated Cloud Run Job before the app revision receives
  traffic; migrations must be backward compatible with the previous revision (expand/contract
  pattern) so canary and previous revision can coexist.
- Staging data is synthetic (seed script) plus an anonymised weekly snapshot; production data
  never leaves production.

## 5. Local developer loop

```bash
pnpm install
docker compose -f infra/docker/compose.yaml up -d        # postgres, redis, otel-collector -> Jaeger UI, mailpit
pnpm --filter @maze/api prisma migrate dev
pnpm dev                                                  # turbo run dev --parallel: web on :5173, api on :3000, storybook on :6006
pnpm test                                                 # vitest across affected packages
pnpm --filter web test:e2e --ui
```

`lefthook` pre-commit runs lint-staged, typecheck on changed packages and gitleaks; the same
gates run in CI so local green means CI green in the common case.

## 6. Infrastructure as code (D-13)

```
infra/terraform/
  envs/
    staging/   main.tf  backend.tf  terraform.tfvars
    prod/      main.tf  backend.tf  terraform.tfvars
  modules/
    project/           APIs enabled, budgets, org policies (disable SA key creation), audit log sinks
    network/           VPC, serverless VPC connector, private services access for Cloud SQL
    cloud-run/         service + migrate job, min/max instances, CPU always-on flag, ingress internal+LB, env from Secret Manager
    cloud-sql/         PostgreSQL 16, private IP, PITR, maintenance window, users maze_app / maze_migrator, IAM auth
    memorystore/       Redis 7, AUTH, TLS, maintenance window
    secrets/           Secret Manager secrets + versions (values supplied out of band), IAM bindings
    firebase-hosting/  site, custom domain, rewrite /api/** to Cloud Run
    iam/               deployer SA, runtime SA, Workload Identity Federation pool + GitHub provider, least-privilege roles
    observability/     log-based metrics, uptime checks, alert policies, notification channels, dashboards (JSON)
```

- **State**: GCS bucket per environment with object versioning and state locking; state
  bucket bootstrapped once by hand and documented.
- **Workload Identity Federation**: GitHub Actions authenticates with its OIDC token; the WIF
  provider condition restricts to `repository == 'dmitri/maze-lab'` and, for prod, to
  `ref == 'refs/heads/main'` or release tags. This replaces the downloaded JSON key file the
  legacy deploy used (07 F-02). The org policy `iam.disableServiceAccountKeyCreation` is set
  so a key file cannot be recreated by accident.
- **Runtime service account** for Cloud Run has only `cloudsql.client`, `secretmanager.
  secretAccessor` on its own secrets, `logging.logWriter`, `cloudtrace.agent`,
  `monitoring.metricWriter`.
- **Plan on PR, apply on merge**: `infra.yml` runs `terraform plan` for PRs touching
  `infra/**` and posts the plan; `apply` runs after merge with environment approval for prod.
  Drift detection runs nightly (`plan -detailed-exitcode`) and opens an issue on drift.

## 7. Configuration and secrets flow

```
 developer .env.local  --->  never committed; template .env.example checked in
 GitHub vars (non-secret) -> VITE_* build-time values, WIF ids, project ids
 GitHub secrets (rare)   -> TURBO_TOKEN, Tauri signing key, Apple/Windows certs, store API keys, SENTRY_AUTH_TOKEN
 Secret Manager          -> DATABASE_URL, REDIS_URL, SENTRY_DSN_API, IDP_ADMIN_CREDENTIALS -> mounted as Cloud Run env
 apps/api/src/env.ts     -> zod-parses process.env once; app fails fast on missing/invalid values
 apps/web/src/env.ts     -> zod-parses import.meta.env once; only VITE_* public values
```

Rule: a secret appears in exactly one place (Secret Manager or GitHub encrypted secret) and
is referenced by name everywhere else.

## 8. Database migration policy

- Prisma Migrate; migration files are reviewed like code and are append-only.
- Expand/contract: add nullable column or new table -> deploy code that writes both -> backfill
  job -> switch reads -> remove old column in a later release. No destructive migration ships
  in the same release as the code that stops using the column.
- The migrate job runs as `maze_migrator`; the app runs as `maze_app` and cannot run DDL.
- `prisma migrate diff` in CI fails the build if the schema and migrations disagree.
- Rollback = deploy previous revision; migrations are forward-only, which the expand/contract
  rule makes safe.

## 9. Feature flags

- A `flags` table plus a `/config` endpoint (cached 60 s in Redis and in the client) returns a
  flat `{ [key]: boolean | number | string }` scoped by environment and optional user role.
- Flags gate risky surfaces: `race.enabled`, `learn.enabled`, `signup.enabled` (kill switch),
  `renderer.three.enabled`, `worker.mode`.
- Flags are removed within two releases of full rollout (tracked in the backlog) to avoid
  permanent branching.

## 10. Observability (D-16)

### 10.1 Traces, metrics, logs

- **API**: `@opentelemetry/sdk-node` initialised before Nest bootstrap with auto-instrumentation
  for Fastify, Prisma, ioredis and `undici`; exporter `@google-cloud/opentelemetry-cloud-trace-exporter`
  and Cloud Monitoring exporter; head-based sampling 100% in staging, 10% in prod plus 100%
  of errors (tail sampling via the OTel collector sidecar is a later upgrade).
- **Logs**: pino with `pino-opentelemetry-transport` so every log line carries `trace_id`,
  `span_id`, `request_id`; JSON to stdout, ingested by Cloud Logging. Redaction list per
  [07](./07-security.md) section 4.3. Log levels: `info` for request summaries, `warn` for
  handled 4xx anomalies (rate limit, auth failure), `error` for 5xx with Sentry event id.
- **Custom metrics**: `maze_generate_duration_ms{algorithm}`, `solve_validation_result{ok}`,
  `race_runs_total`, `cache_hit_ratio{cache}`, `auth_refresh_failures_total`.
- **Web**: `web-vitals` (LCP, INP, CLS) and custom spans for `generate`, `first-frame`,
  `step-player-throughput`, sent to Sentry Performance with 10% sampling; no third-party RUM
  script beyond Sentry.
- **Worker**: step engine reports throughput and memory as `performance.measure` entries
  surfaced in dev tools and sampled into telemetry.

### 10.2 Errors (Sentry)

- `@sentry/react` in web (with React Router/TanStack integration, `ErrorBoundary` fallback
  component from `@maze/ui`), `@sentry/nestjs` in API. One Sentry project per app,
  environments `staging`/`production`, release = git SHA (web) or image digest (API).
- Source maps uploaded from CI with `sentry-cli` and deleted from the deployed bundle.
- PII scrubbing enabled server-side in Sentry; `beforeSend` strips maze content and user
  emails; users identified by opaque id only.
- Replaces `stackdriver-errors-js`, `src/errorHandler.js`, `src/utils/errorReporting.ts` and
  the `/reportError` endpoint entirely.

### 10.3 SLOs, dashboards, alerts

| SLI | SLO | Alert (burn rate) |
|-----|-----|-------------------|
| API availability (non-5xx / total) | 99.9% per 30 days | page at 14.4x burn over 1 h, ticket at 3x over 6 h |
| API read latency p95 | < 150 ms | ticket when > 300 ms for 15 min |
| API write latency p95 | < 400 ms | ticket when > 800 ms for 15 min |
| Web LCP p75 | < 2.5 s | ticket when > 3 s for a day |
| Solve validation error rate | < 0.5% | ticket |
| Cloud SQL CPU / connections | < 70% / < 80% of max | ticket |

Dashboards (Cloud Monitoring JSON in `infra/terraform/modules/observability/dashboards/`):
API golden signals, DB and Redis health, web vitals (from Sentry), release markers. Uptime
checks hit `/health/ready` and the web root from three regions.

On-call for v1 is the owner; alerts route to email plus a mobile push channel. The Definition
of Done requires every new endpoint to appear in the golden-signals dashboard automatically
via route-label metrics, so no per-feature dashboard work is needed.

### 10.4 Cost guardrails

- Cloud Run: `min-instances=1` prod (cold-start avoidance), `0` staging; `max-instances=10`
  prod; CPU throttled outside requests; concurrency 80.
- Cloud SQL: `db-custom-1-3840` staging, `db-custom-2-7680` HA prod; storage auto-increase
  capped.
- Budgets: monthly budget with alerts at 50/80/100%; Terraform sets a hard `max-instances` so a
  traffic spike cannot exceed roughly 3x the baseline bill.
- Preview channels expire after 7 days; PR API revisions are deleted by a nightly job.

## 11. Release process and rollback runbook

Release cadence: continuous to staging; production promotion at least weekly, never on
Friday afternoon without an owner available the next day.

Release checklist (PR template for the Version Packages PR):

1. Changelog reviewed; breaking contract changes have a matching client change in the same
   release.
2. Migrations reviewed for expand/contract compliance.
3. Feature flags for new surfaces default off in prod.
4. Staging smoke and ZAP baseline green within the last 24 h.
5. SBOM and OpenAPI attached to the GitHub Release.

Rollback runbook (`infra/runbooks/rollback.md`):

| Component | Command / action | Time to recover |
|-----------|------------------|-----------------|
| API | `gcloud run services update-traffic maze-api --to-revisions <prev>=100` | < 1 min |
| Web | `firebase hosting:rollback` (or redeploy previous artifact) | < 2 min |
| Migration | Forward-only: deploy previous API revision (compatible by policy); if data corruption, PITR restore to timestamp | minutes to 1 h |
| Desktop | Publish previous `latest.json` pointing at the prior signed artifacts | < 10 min, clients pick up on next check |
| Mobile | Halt rollout in Play Console / App Store Connect; users keep the installed version | manual |
| Flags | Flip kill switch in `flags` table; propagates within 60 s | < 2 min |

## 12. Metrics to track (DORA)

| Metric | Source | Target after Phase 4 |
|--------|--------|----------------------|
| Deployment frequency | GitHub deployments API | daily to staging, weekly+ to prod |
| Lead time for changes | PR merge -> prod deploy timestamp | < 2 days |
| Change failure rate | prod deploys followed by rollback or incident within 24 h | < 10% |
| Time to restore | incident open -> resolved | < 1 h |

A weekly GitHub Action writes these into `proj-mgmt/metrics/dora.md` so the numbers live next
to the plan.
