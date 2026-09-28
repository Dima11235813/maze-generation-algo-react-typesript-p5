# ADR-010 - Authentication via OIDC (Google Cloud Identity Platform) behind an AuthProvider port

> Status: Proposed | Date: 2026-09-27 | Deciders: Dmitri Larionov | Register ID: D-10

## Context

The legacy app has no working auth (a login form that never updates state, MSAL strings from
another project, a `/login` route that throws). The product is guest-first with optional
accounts for saving/sharing/leaderboards. We need Google/GitHub/email sign-in, passkeys,
standards-based tokens verifiable by the API, and no long-lived secrets in clients.

## Decision

Use **Google Cloud Identity Platform** (Firebase Auth SDK) as the OIDC identity provider with
Google, GitHub, email + passkey and **Sign in with Apple** (mandatory on iOS when other social
logins are offered). Clients obtain short-lived provider ID tokens, exchange them at the API,
and the API issues its own short-lived access JWT; the API verifies provider tokens via JWKS.
Web uses an httpOnly, SameSite refresh cookie flow; Tauri uses secure OS storage. All
provider-specific code sits behind an **`AuthProvider` port** so Auth0/Clerk/Better Auth can
replace it. Details in 06.

## Alternatives considered

| Option | Pros | Cons | Why not |
|--------|------|------|---------|
| Auth0 / Clerk | Polished, enterprise features | Cost at scale, another vendor outside GCP | Port keeps them one adapter away |
| Keycloak (self-hosted) | Full control | Operational burden for one developer | Too heavy now |
| Better Auth / Lucia (library) | Own the data, TS-native | We own security-critical code and its patches | Managed IdP for a small team |
| Roll our own | None | High risk | No |

## Consequences

- Positive: free tier generous; integrates with GCP IAM/logging already in use.
- Negative: SDK lock-in mitigated by the port; passkey support must be verified (SP4).
- Follow-ups: S8.1, S8.2; SP4.

## Compliance

Only `apps/web/src/platform/auth/*` and `apps/api/src/modules/auth/adapters/*` import the
Firebase/Identity SDKs.
