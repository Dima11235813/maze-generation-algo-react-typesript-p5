# ADR-013 - Hosting on Google Cloud (Firebase Hosting, Cloud Run, Cloud SQL, Memorystore) with Terraform

> Status: Proposed | Date: 2026-09-27 | Deciders: Dmitri Larionov | Register ID: D-13

## Context

The legacy app deployed to App Engine Standard (`nodejs12`, EOL) by copying the build into an
Express server and using a downloaded service-account key. The owner already has a GCP project
and Identity Platform (ADR-010) is a GCP product. We need static hosting with CDN and preview
channels, a container API runtime that scales to zero-ish, managed Postgres/Redis, secrets, and
reproducible infrastructure.

## Decision

**Firebase Hosting** for the static web app (preview channels per PR), **Cloud Run** for the
API (canary traffic splitting), **Cloud SQL (PostgreSQL 16)**, **Memorystore (Redis)**,
**Secret Manager**, **Artifact Registry**. All provisioned with **Terraform** (state in GCS).
GitHub Actions authenticates via **Workload Identity Federation** (no JSON keys). App Engine is
retired.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Vercel + Neon + Upstash | Excellent DX, generous free tiers | Split vendors; API on serverless functions constrains NestJS/OTel; less control | Single cloud with existing IdP |
| Fly.io | Simple containers, global | Smaller ecosystem for managed Postgres/Redis, secrets | GCP already in use |
| AWS (Amplify/ECS/RDS) | Everything available | No existing footprint; more IAM complexity | GCP |
| Keep App Engine | Familiar | Legacy runtime model, key-based deploy | Cloud Run is the modern path |

## Consequences

- Positive: one IAM model, OTel exports natively, PR previews for free.
- Negative: Cloud SQL/Memorystore minimum cost; mitigated with smallest tiers and budgets.
- Follow-ups: infra/terraform modules (Phase 4); S14.4 budgets.

## Compliance

No infrastructure created outside Terraform (drift detection job weekly); no service-account
keys in CI (org policy `iam.disableServiceAccountKeyCreation`).
