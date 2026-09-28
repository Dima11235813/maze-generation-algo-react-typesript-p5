# ADR-016 - Observability: OpenTelemetry to Google Cloud, Sentry for errors, pino structured logs

> Status: Proposed | Date: 2026-09-27 | Deciders: Dmitri Larionov | Register ID: D-16

## Context

Legacy error handling posts to a custom `/reportError` endpoint and uses the experimental
`stackdriver-errors-js` with a hard-coded fake user. There are no traces, metrics or structured
logs.

## Decision

**OpenTelemetry** SDK in the API (traces, metrics, logs) exported to Cloud Trace / Monitoring /
Logging; **pino** structured JSON logs with trace ids and PII redaction; **Sentry** for web and
API errors with privately uploaded source maps; web vitals collected. SLOs: 99.9 % availability,
p95 latency targets; alerting via Cloud Monitoring.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| GCP Error Reporting only | Native | Weaker FE grouping, source-map workflow | Sentry FE experience |
| Datadog | Complete | Cost | Not at this scale |
| Custom `/reportError` | Existing | Reinvents Sentry, leaks PII | Replaced |

## Consequences

- Positive: vendor-neutral instrumentation; correlation across web and API.
- Negative: two backends (GCP + Sentry) to manage; Sentry free tier limits.
- Follow-ups: S7.1, S14.1-S14.3.

## Compliance

No `console.log` in API code (lint); PII redaction list reviewed each release.
