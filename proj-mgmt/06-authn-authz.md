# 06 - Authentication & Authorization

> Status: Proposed | Last updated: 2026-09-27
> Decisions referenced: D-05, D-07, D-08, D-09, D-10, D-11, D-12, D-13

This document specifies how users prove who they are (AuthN) and what they may do (AuthZ),
how guests work, and how the same permission rules drive both the API and the UI.

---

## 1. Current state

There is no authentication or authorization in the existing app; there are fragments that
suggest one was intended and then abandoned.

| Finding | Evidence | Risk today |
|---------|----------|------------|
| Login route renders a crash-test component | `src/AppRoutes.tsx` maps `/login` to `<ComponentThatThrows />`, which throws in `componentDidMount`; the real `LoginView` import is commented out | Any visitor clicking LOGIN in the header triggers the error boundary and an error report |
| Auth constants copied from another project | `src/shared/sharedData.ts` defines MSAL-style keys (`afterAuthRedirectUrl`, `access_token`, `id_token`, `shouldRedirectToComingSoon`) and a title mentioning "Msal for Auth" | Misleading; nothing reads them |
| Feature flag without a feature | `REACT_APP_USE_AUTH=true` parsed into `USE_AUTH` in `src/shared/config.ts`; no consumer | Dead configuration |
| Fabricated identity in error reports | `src/utils/errorReporting.ts` hardcodes `name: "Some User"`, `preferredName: "Suser@gmail.com"`, `isAdmin: "true"` and sends them in every `/reportError` payload | Pollutes error data; establishes a pattern of fake PII in telemetry |
| Login form does not capture input | `LoginForm.tsx` `onChange` handlers return objects instead of calling the setters; `onSubmit` is attached to a `Button`, not the form | Would not work even with a server |
| GraphQL login mutation targets a non-existent server | `LoginView.tsx` + `AppWrapper.tsx` (`localhost:4000/graphql`, `credentials: "include"`) | See 04-backend-rewrite.md |
| `UserDTO` carries a plaintext `password` field | `src/api/models/UserDTO.ts` | Shape encourages sending/storing passwords in app models |

None of this is carried forward. The new design starts from the ports below.

## 2. Authentication (D-10)

### 2.1 Provider and boundary

Identity is delegated to **Google Cloud Identity Platform** (the enterprise tier of Firebase
Auth) via OIDC. The application never stores passwords or implements credential flows. All
provider-specific code sits behind one port so the provider is a deployment detail:

```ts
// packages/contracts/src/auth/types.ts
export const VerifiedIdentity = z.object({
  subject: z.string(),                     // provider uid, stable, opaque
  email: z.string().email().optional(),
  emailVerified: z.boolean(),
  providerId: z.enum(['google.com', 'github.com', 'password', 'passkey', 'emailLink', 'anonymous']),
  issuedAt: z.number().int(),              // seconds
  expiresAt: z.number().int(),
  authTime: z.number().int(),              // when the user actually authenticated (for step-up)
  mfaVerified: z.boolean().default(false),
});

// apps/api/src/modules/auth/ports/auth-provider.port.ts
export interface AuthProviderPort {
  /** Verify a provider-issued ID token: signature (JWKS), iss, aud, exp, nbf. */
  verifyIdToken(idToken: string, opts?: { checkRevoked?: boolean }): Promise<VerifiedIdentity>;
  /** Server-side revocation of all provider refresh tokens for a subject (logout-everywhere, account delete). */
  revokeRefreshTokens(subject: string): Promise<void>;
  getUser(subject: string): Promise<ProviderUser | null>;
  deleteUser(subject: string): Promise<void>;
  /** Mint a custom claim set (role) so the UI can read it without an API round trip. */
  setCustomClaims(subject: string, claims: { role: Role }): Promise<void>;
}
```

Adapters: `IdentityPlatformAuthProvider` (firebase-admin, JWKS cached from
`securetoken.google.com`), `EmulatorAuthProvider` (local dev, points at the Firebase Auth
emulator), `FakeAuthProvider` (tests, signs tokens with an in-memory key).

On the client, `@maze/player` exposes an `AuthClient` port with a Firebase Web SDK adapter;
`apps/web` never imports `firebase/*` directly outside that adapter.

### 2.2 Supported sign-in methods

| Method | Phase | Notes |
|--------|-------|-------|
| Google | 4 | One-tap on web; system browser flow in Tauri via deep link (`mazelab://auth/callback`) |
| GitHub | 4 | Target audience (developers, students) |
| Email + password | 4 | Provider-enforced password policy (min 12 chars, breached-password check via provider setting); never seen by our API |
| Passkeys / WebAuthn | 4 | Preferred passwordless path on desktop and mobile |
| Email magic link | 5 | For classroom onboarding (educators) |
| Anonymous (provider-side) | not used | Guest mode is implemented locally (section 2.5), not via anonymous provider accounts, to avoid orphaned identities |
| MFA (TOTP / SMS) | 5, optional | Required for `admin` role; optional for others |

### 2.3 Token model

```
Client (web/Tauri)                              API (Cloud Run)
------------------                              ---------------
1. Sign in with provider SDK  -> provider ID token (RS256, 1 h, iss=securetoken.google.com/<project>)
2. POST /v1/auth/session  { idToken }  ------>  verifyIdToken() via AuthProviderPort
                                                upsert users row by auth_subject
                                                issue APP access token (ES256, 15 min, aud=mazelab-api,
                                                  claims: sub=users.id, role, jti, sid)
                                                issue refresh token (opaque 256-bit, 30 d, rotating,
                                                  bound to session family `sid`)
   <-----  { accessToken, expiresIn, user }   +  Set-Cookie: __Host-rt=<refresh>; HttpOnly; Secure;
                                                  SameSite=Lax; Path=/v1/auth; Max-Age=2592000
3. Calls carry  Authorization: Bearer <accessToken>
4. POST /v1/auth/refresh  (cookie only)  ---->  validate refresh hash in Redis sess:refresh:{uid}:{sid}
                                                rotate: new refresh + new access; old refresh invalid
                                                reuse of an old refresh => revoke whole family (theft signal)
```

Why an app-issued access token rather than forwarding the provider token everywhere:

- the API needs `users.id` and `role` as claims, not the provider uid;
- 15-minute lifetime bounds the blast radius of a stolen token;
- the provider can be swapped without changing the token the rest of the system verifies.

Storage by platform (D-12):

| Platform | Access token | Refresh token |
|----------|--------------|---------------|
| Web (PWA) | In memory only (Zustand, not persisted); re-obtained via refresh on reload | `__Host-` prefixed httpOnly cookie; JS never sees it |
| Tauri desktop | In memory | `tauri-plugin-stronghold` (encrypted at rest with OS keychain-derived key) |
| Tauri iOS / Android | In memory | OS keychain / Keystore via `tauri-plugin-keychain`; refresh endpoint accepts the token in a body field `{ refreshToken }` *only* when the request carries the Tauri app origin and a `X-Client: tauri` header, and the cookie is absent |

### 2.4 Session lifecycle and revocation

| Event | Effect |
|-------|--------|
| Sign in | New session family `sid`; `audit_log` `auth.login` with provider id and coarse device info |
| Access token expiry | Silent refresh by the client 60 s before `exp` |
| Refresh | Rotation; previous token hash kept for 10 s grace to tolerate concurrent tabs, then removed |
| Refresh reuse detected | Entire family revoked; `sess:deny:{jti}` entries for outstanding access tokens; user notified by email |
| Logout (this device) | Refresh family deleted; current access `jti` added to `sess:deny` until `exp`; cookie cleared |
| Logout everywhere | All families for the user deleted; `revokeRefreshTokens(subject)` at the provider; all live `jti`s denied |
| Role change, account delete, password reset | Same as logout everywhere, then new claims on next login |
| Idle | Refresh cookie `Max-Age` 30 d sliding; absolute maximum session age 90 d (`sid` creation time in Redis) |

The API checks `sess:deny:{jti}` on every request (one Redis `EXISTS`, ~0.2 ms). If Redis is
unavailable, requests with tokens issued more than 5 minutes ago are rejected (`401
token_expired`) so a revocation can never be bypassed silently; the client refreshes and
retries.

### 2.5 Guest mode

Guests are first-class: everything in Play, Watch, Race, Build and Learn works without an
account. The API sees guests as a `Principal` with `role: 'guest'` and no `userId`.

| Capability | Guest | Signed-in |
|------------|-------|-----------|
| Generate / solve / race / edit mazes locally | yes | yes |
| Save to library | IndexedDB `guestMazes` (see 05) | Server + IndexedDB cache |
| Share link | no (requires server row) | yes |
| Leaderboards | view only | submit |
| Lesson progress | localStorage/IndexedDB | server-synced |

**Upgrade path** (guest -> account): after the first successful `POST /v1/auth/session`, the
client offers to import the guest library. It calls `POST /v1/auth/merge-guest` with
`GuestLibraryImport = { mazes: MazeDocumentV1[], lessonProgress, preferences }` (chunked at
50 mazes/request, each chunk with an `Idempotency-Key`). The server dedupes by content hash,
creates `mazes` rows owned by the new user, and returns a `MergeResult` mapping local ids to
server ids. Local copies are kept but marked `synced`. The prompt appears once; declining
leaves the guest library untouched and re-offers from Settings.

### 2.6 Account linking, verification, protections

- **Linking**: Identity Platform links providers by verified email when
  "one account per email" is enabled; the API only ever sees one `auth_subject`. Linking a
  second provider is done client-side via the SDK; no API change.
- **Email verification**: required before `visibility: 'public'` or share links are allowed
  (ability condition `emailVerified === true`); everything else works unverified.
- **Handle**: chosen on first login; uniqueness enforced by `users.handle`; reserved list
  (`admin`, `mazelab`, `api`, ...) checked in the use-case.
- **Brute force / enumeration**: credential attempts happen at the provider (which throttles
  and can require reCAPTCHA Enterprise). On our side, `POST /v1/auth/session` is limited to
  20/min per IP and returns the same `401 unauthenticated` for invalid, expired and unknown
  tokens. `GET /v1/users/:handle` returns `404` for both non-existent and soft-deleted users.
- **Step-up**: destructive actions (`DELETE /v1/users/me`, logout everywhere, role changes
  by admin) require `authTime` within the last 5 minutes; otherwise `403` with
  `code: 'forbidden'` and `detail: 'reauthentication_required'`, and the client re-runs the
  provider flow.

## 3. Authorization (D-11)

### 3.1 Model

RBAC for coarse capability, plus **ownership** and **visibility** conditions evaluated on the
loaded subject. Rules are written once with CASL in `@maze/contracts` and executed by both
the NestJS guard and the React UI.

**Roles** (stored in `users.role`, mirrored into the access-token claim and provider custom
claim):

| Role | Who | Adds |
|------|-----|------|
| `guest` | No token | Read public content, use all local features |
| `user` | Any signed-in account | Own content CRUD, solves, races, share links (after email verification), forks |
| `educator` | Verified request (Phase 5) | Everything `user` has plus classroom-scoped visibility of learners' progress (future `Classroom` subject) |
| `admin` | Allow-listed operators | Moderate any maze, read audit log, change roles; requires MFA |

**Subjects**: `Maze`, `MazeVersion` (inherits `Maze`), `Solve`, `Race`, `Lesson`,
`LessonProgress`, `User`, `AuditLog`, `Classroom` (future).

**Actions**: `read`, `create`, `update`, `delete`, `fork`, `share`, `export`, `moderate`,
`manage` (CASL wildcard, admin only).

**Visibility** on `Maze` and `Race`: `private` (owner only), `unlisted` (anyone with the id or
a share token), `public` (listed, searchable).

**Fork rules**: any maze the principal can `read` can be forked; the fork is a new `Maze`
owned by the forker with `forkedFromId` set and visibility `private`. A fork of a `private`
maze is only possible through a share link (the read check passes via the token). Forks
carry `provenance` and `meta` but not the original's `name` (prefixed "Fork of").

### 3.2 Abilities (single source of truth)

```ts
// packages/contracts/src/abilities/define-abilities.ts
import { AbilityBuilder, createMongoAbility, MongoAbility } from '@casl/ability';

export type Action = 'read' | 'create' | 'update' | 'delete' | 'fork' | 'share' | 'export' | 'moderate' | 'manage';
export type Subjects = 'Maze' | 'MazeVersion' | 'Solve' | 'Race' | 'Lesson' | 'LessonProgress' | 'User' | 'AuditLog' | 'all'
  | Maze | Solve | Race | LessonProgress | UserPublic;   // instances for row-level checks
export type AppAbility = MongoAbility<[Action, Subjects]>;

export interface Principal {
  userId?: string;            // undefined for guest
  role: 'guest' | 'user' | 'educator' | 'admin';
  emailVerified: boolean;
  shareTokens?: string[];     // share tokens presented in this request (from /m/:shareId)
}

export function defineAbilitiesFor(p: Principal): AppAbility {
  const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  // --- everyone (including guests)
  can('read', 'Maze', { visibility: 'public', moderation: 'ok', deletedAt: null });
  can('read', 'Maze', { visibility: 'unlisted', moderation: 'ok', deletedAt: null });   // id is the capability
  can('read', 'Maze', { 'shares.token': { $in: p.shareTokens ?? [] } });               // share link overrides private
  can('read', 'Race', { visibility: { $in: ['public', 'unlisted'] } });
  can('read', 'Lesson', { published: true });
  can('read', 'Solve', { verified: true });                                             // leaderboards
  can('read', 'User');                                                                  // public profile fields only (schema-filtered)

  if (p.role === 'guest') return build();

  // --- signed-in users
  can('read',   'Maze', { ownerId: p.userId });
  can('create', 'Maze');
  can(['update', 'delete'], 'Maze', { ownerId: p.userId });
  can('fork',   'Maze');                                   // subject to read; checked in use-case as read && fork
  if (p.emailVerified) can('share', 'Maze', { ownerId: p.userId });
  else cannot('share', 'Maze').because('email_verification_required');
  cannot('update', 'Maze', ['ownerId', 'moderation', 'forkedFromId']);  // field-level: never self-serve these

  can('read',   'Solve', { userId: p.userId });
  can('create', 'Solve');
  can('read',   'Race', { createdById: p.userId });
  can('create', 'Race');
  can(['read', 'update'], 'LessonProgress', { userId: p.userId });
  can(['read', 'update', 'delete', 'export'], 'User', { id: p.userId });
  cannot('update', 'User', ['role', 'authSubject', 'emailVerified']);

  if (p.role === 'educator') {
    // Phase 5: can('read', 'LessonProgress', { 'classroom.educatorId': p.userId });
  }

  if (p.role === 'admin') {
    can('manage', 'all');
    can('moderate', 'Maze');
    can('read', 'AuditLog');
  }
  return build();
}
```

Field-level restrictions (`cannot('update', 'Maze', ['ownerId', ...])`) are enforced with
CASL's `permittedFieldsOf` inside the update use-case, and the same call strips disallowed
fields from the editor form in the UI.

### 3.3 Enforcement on the API

```ts
// apps/api/src/shared/authz/casl.guard.ts  (coarse, before the handler)
@Injectable()
export class CaslGuard implements CanActivate {
  canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const rule = this.reflector.get<[Action, SubjectType]>(CHECK_ABILITY, ctx.getHandler());
    if (!rule) return true;                                     // route declared anon / no ability
    const ability = defineAbilitiesFor(req.principal);
    if (!ability.can(...rule)) throw new ForbiddenError('forbidden');
    req.ability = ability;                                      // reused by the use-case
    return true;
  }
}

// inside a use-case (row-level, after loading)
const maze = await this.mazes.findById(id);
if (!maze) throw new NotFoundError();
ForbiddenError.from(ability).throwUnlessCan('update', subject('Maze', maze));   // throws with .because() reason
```

Repository list queries are built from the same rules with `@casl/prisma`'s
`accessibleBy(ability).Maze`, so `GET /v1/mazes` can never leak a row the principal could not
read individually (no duplicated WHERE clauses).

`403` vs `404`: for `private` resources the API returns `404 not_found` to non-owners to
avoid confirming existence; `403 forbidden` is used only when the principal can `read` but
not perform the requested action.

### 3.4 Enforcement in the UI (same code, D-11)

```tsx
// packages/player/src/auth/use-ability.ts
export const useAbility = () => {
  const principal = useAuthStore(s => s.principal);       // { role, userId, emailVerified }
  return useMemo(() => defineAbilitiesFor(principal), [principal]);
};

// apps/web/src/routes/build/MazeToolbar.tsx
const ability = useAbility();
<Can I="share" this={subject('Maze', maze)} ability={ability} passThrough>
  {(allowed) => <ShareButton disabled={!allowed} reason={ability.relevantRuleFor('share', subject('Maze', maze))?.reason} />}
</Can>
```

The UI check is a convenience (hide/disable, explain why); the API check is the security
boundary. Because both call `defineAbilitiesFor`, a rule change is a single commit in
`@maze/contracts` and a Changeset.

### 3.5 Policy test matrix

`packages/contracts/src/abilities/__tests__/policy.spec.ts` runs `it.each` over this table;
`apps/api` HTTP tests assert the same outcomes end-to-end for a subset.

| Role | Action | Subject state | Expected |
|------|--------|---------------|----------|
| guest | read | Maze public, ok | allow |
| guest | read | Maze unlisted | allow |
| guest | read | Maze private, no token | deny (API: 404) |
| guest | read | Maze private, valid share token | allow |
| guest | read | Maze public, moderation hidden | deny |
| guest | create | Maze | deny (API: 401) |
| guest | fork | Maze public | deny (API: 401) |
| guest | read | Solve verified | allow |
| guest | read | Lesson unpublished | deny |
| user | read | own Maze private | allow |
| user | read | other's Maze private | deny (404) |
| user | update | own Maze | allow |
| user | update | own Maze, field `ownerId` | deny (field stripped, 422 if only field) |
| user | update | other's Maze public | deny (403) |
| user | delete | own Maze | allow |
| user | fork | other's Maze public | allow |
| user | fork | other's Maze private via share token | allow |
| user | share | own Maze, email unverified | deny, reason `email_verification_required` |
| user | share | own Maze, email verified | allow |
| user | share | other's Maze | deny |
| user | create | Solve | allow |
| user | read | other's Solve unverified | deny |
| user | read | other's Race private | deny |
| user | update | own LessonProgress | allow |
| user | update | own User, field `role` | deny |
| user | export | own User | allow |
| user | export | other User | deny |
| user | read | AuditLog | deny |
| educator | read | LessonProgress of non-member | deny (until Classroom exists) |
| admin | moderate | any Maze | allow |
| admin | read | AuditLog | allow |
| admin | update | other's Maze (manage all) | allow, audited |
| admin | delete | own account without step-up | deny (403 reauthentication_required) |

## 4. Auth-specific threats and controls

| Threat | Control |
|--------|---------|
| Access token theft via XSS | Token lives in memory only; strict CSP (see 07); 15-min lifetime; `sess:deny` on logout |
| Refresh token theft | httpOnly `__Host-` cookie scoped to `/v1/auth`; rotation with reuse detection revokes the family; Tauri stores in OS keychain |
| CSRF on `/v1/auth/refresh` | `SameSite=Lax` cookie + custom header `X-Requested-With: mazelab` required + `Origin` allow-list check; no state change is possible from a top-level navigation |
| Open redirect after login | Redirect targets are relative paths validated against the TanStack route tree; Tauri deep link callback validates `state` nonce |
| Token replay across services | `aud=mazelab-api` claim enforced; provider ID tokens are accepted only at `/v1/auth/session`, never as bearer tokens elsewhere |
| Algorithm confusion / key rotation | ES256 only; `kid` required; JWKS cached 1 h with background refresh; unknown `kid` triggers immediate refetch then rejection |
| Clock skew | 30 s leeway on `exp`/`nbf`; API instances sync via Cloud Run |
| Session fixation | `sid` is generated server-side at session creation and never accepted from the client |
| Privilege escalation via claims | Role read from `users.role` at token issue; client-visible custom claims are informational; guard uses the API token claim and re-validates role on role-sensitive routes |
| Enumeration | Uniform `401`/`404` responses (section 2.6); provider handles credential throttling |
| Account takeover via linked provider | Provider requires verified email for linking; login with a *new* provider on an existing email triggers a confirmation email |
| Guest merge abuse | Merge is idempotent, chunked, rate-limited (5 merges/day), and every imported maze is content-hash validated like any save |

## 5. Why a managed OIDC provider, and why the port matters

Rolling our own credential storage means owning password hashing, breach monitoring,
reset flows, passkey ceremonies, provider OAuth quirks, MFA and the audit burden that goes
with ASVS L2. A managed provider delivers all of that with a compliance posture we could not
match at this team size, and Identity Platform in particular keeps the whole stack inside
the GCP project already chosen in D-13 (single bill, single IAM, single Terraform module).

The `AuthProviderPort` is deliberately narrow (verify, revoke, read user, delete, set
claims). Everything else - app tokens, sessions, roles, abilities - is ours. Swapping to
Auth0, Clerk or a self-hosted Better Auth instance is therefore:

1. a new adapter implementing five methods (~150 lines),
2. a new client-side `AuthClient` adapter in `@maze/player`,
3. a data migration mapping old `auth_subject` values to new ones (the provider uid is the
   only provider-specific value in our database),
4. zero changes to abilities, guards, contracts or the UI.

The alternatives remain listed in ADR-010 with the conditions that would trigger a switch
(pricing above a threshold, need for on-prem deployment, or provider deprecation).

## 6. Phased rollout (aligned with 14-roadmap.md)

| Phase | Auth scope |
|-------|------------|
| 2 (web parity) | Guest-only. `Principal { role: 'guest' }` everywhere; abilities package exists and gates UI affordances (e.g. Share button hidden with a "sign in to share" hint); IndexedDB guest library |
| 4 (backend + persistence) | Identity Platform live; Google, GitHub, email+password, passkeys; `/v1/auth/*`; guest merge; roles `user`/`admin`; CASL guard on all routes; policy matrix in CI; email verification gate on sharing |
| 5 (education) | Magic link; `educator` role and `Classroom` subject; optional MFA; admin MFA mandatory |
| 6 (desktop/mobile) | Tauri deep-link OAuth flow; keychain refresh storage; `X-Client: tauri` refresh path |
| 7 (hardening) | External review of the auth flows against OWASP ASVS V2/V3; refresh-reuse alerting wired to Sentry; penetration test of `/v1/auth/*` |

## 7. Open items for this document

1. Confirm Identity Platform passkey support status and pricing tier at Phase 4 kickoff; if
   unavailable, passkeys move to Phase 5 and the port gains no new methods.
2. Decide whether the Tauri mobile refresh path (token in body) should instead use the
   provider SDK's own refresh and skip our refresh token entirely on native. Leaning: keep
   one model for all platforms.
3. Educator verification process (manual allow-list vs institutional email domain) is a
   product decision for 13-education-and-playground.md.
