# Delegated-Auth Migration

> **Status:** code migration complete. Every user-triggered route acquires a
> delegated (OBO) token — `pnpm run verify:auth-mode` reports
> `U-classified routes still on app-only: 0`. What remains is the **tenant**
> work: consent the two outstanding delegated scopes and delete the eight
> now-unused Graph application permissions (wave **G** below).
> **Goal:** every user-triggered Graph / ARM / Exchange / Power Platform call
> runs as the **signed-in user** (OBO), not as the service principal. App-only
> tokens are reserved for declared background jobs.

## Why

The historical default — `getGraphClient()` from `src/lib/graphClient.ts` —
always returns an app-only / client-credentials Graph client. That means:

- **RBAC** is collapsed to "passed `verifyAuth()`" + "passed app-side
  `hasPermission()`". Entra and Azure RBAC never see the real user, so
  least-privilege defenses are weaker than the spec implies.
- **Audit attribution** (Entra sign-in / audit logs, Azure activity logs)
  records the service principal — not "who actually did this?" — for every
  user-triggered action.
- Any route that passes `verifyAuth()` effectively gets full app-permission
  scope, regardless of the signed-in user's tenant role.

Switching user-triggered routes to delegated (OBO) tokens fixes all three at
once.

## What landed in this PR (foundation)

| Capability | File | Notes |
| --- | --- | --- |
| Typed delegated-auth errors | `src/lib/auth/errors.ts` | `DelegatedAuthRequiredError`, `AppOnlyAuthError` |
| Scope catalog | `src/lib/auth/scopeMap.ts` | Single place for least-privilege scopes |
| Token-issuance telemetry | `src/lib/auth/tokenAudit.ts` | `[token-audit] {...}` JSON log per issuance |
| Delegated Graph client | `getGraphClientForUser()` in `src/lib/graphClient.ts` | Drop-in replacement for `getGraphClient()` |
| Delegated ARM token | `getAzureTokenForUser()` | Use under `/api/azure/**`, governance |
| Delegated Exchange token | `getExchangeTokenForUser()` / `getExchangeOwaTokenForUser()` | EWS.AccessAsUser.All / OWA |
| Delegated Admin Center token | `getAdminCenterTokenForUser()` | `admin.microsoft.com` internal APIs |
| Delegated AI Foundry token | `getAIFoundryTokenForUser()` | Foundry project data plane |
| Delegated Power Platform tokens | `getPowerPlatformTokenForUser()`, `getBapTokenForUser()`, `getPowerAppsTokenForUser()` | PP API / BAP / Power Apps service |
| Delegated Dataverse token | `getDataverseTokenForUser(orgUrl)` | Applies the caller's Dataverse security roles |
| Delegated Defender token | `getDefenderTokenForUser()` | `api.security.microsoft.com` |
| Delegated Purview token | `getPurviewComplianceTokenForUser()` | Compliance Manager |
| Delegated Azure OpenAI token | `getCognitiveServicesTokenForUser()` | Chat / image routes; needs `Cognitive Services OpenAI User` |
| Delegated Azure Monitor tokens | `getLogAnalyticsTokenForUser()` | KQL query APIs, including Application Insights (queried resource-centrically via Azure Monitor Logs) |
| Delegated SharePoint token | `getSharePointTokenForUser(origin)` | SharePoint tenant REST |
| App-only choke-point | `getAppOnlyGraphClient()` in `src/lib/auth/appOnly.ts` | Requires `reason`; logs `app-only` token-audit |
| Route-template ctx | `withRouteTemplate` injects `getGraph()` | Lazy delegated client |
| `withDelegatedAuth` HOF | `src/lib/api-auth.ts` | Builds delegated `graph` and turns OBO failures into 401 `reauth_required` |
| OBO consolidation | `src/lib/obo.ts` | Deprecated shim, re-exports from `graphClient` |
| Audit script | `scripts/audit-auth-mode.mjs` + `pnpm run verify:auth-mode` | CI gate |
| App-permission audit | `scripts/audit-graph-app-permissions.mjs` + `pnpm run verify:graph-app-perms` | Maps app-only call sites → the Graph app role they consume |
| Classification file | `auth-mode-classifications.json` | Per-route U / B / H |

## Target: retire the application permissions

The migration is not finished when routes stop calling `getGraphClient()` —
it is finished when the **app registration's application permissions are
deleted**. That is the control that actually shrinks the blast radius.

A live audit of the `Portal360-Graph` registration found that **all ten
granted Graph application permissions have a delegated equivalent, and nine
of the ten are already consented as delegated scopes.** No Graph capability
the portal exposes to a signed-in user requires app-only. Only the scheduled
audit-log ingest genuinely needs application permissions, because it runs with
no user context at all.

Run the audit before and after each wave:

```bash
pnpm run verify:graph-app-perms                                   # summary
node scripts/audit-graph-app-permissions.mjs --uncovered         # already-403 calls
node scripts/audit-graph-app-permissions.mjs --permission <name> # call sites
```

The per-permission inventory, migration order, and removal commands live in
[`docs/DELEGATED-PERMISSION-GAPS.md`](./DELEGATED-PERMISSION-GAPS.md).

### Three things the audit surfaced

1. **`ServiceMessage.Read.All` is retirable today** — no app-only call site
   touches `/admin/serviceAnnouncement/messages`.
2. **21 app-only Graph endpoints are already broken.** They need application
   permissions the registration does not hold (`User.Read.All`,
   `Group.Read.All`, `Sites.Read.All`, `DeviceManagementApps.Read.All`, …) so
   they return `403 Authorization_RequestDenied` today. The matching delegated
   scopes *are* consented. Migrating those routes is a bug fix, not just a
   hardening exercise — **do not grant the missing application permissions.**
3. **Two app roles must stay.** `scripts/cron/audit-log-ingest.mjs` is a real
   scheduled job with no signed-in user, so `AuditLog.Read.All` and
   `AuditLogsQuery.Read.All` remain application permissions. Migrating the
   sign-in / provisioning / audit-query *routes* is still worth doing for
   per-user attribution, but it does not remove those two app roles.

The audit classifies every permission as **RETIRABLE** (nothing uses it),
**MIGRATE** (only user-triggered routes use it), or **BACKGROUND** (a
declared background job needs it). Only MIGRATE and RETIRABLE permissions are
deletable. End state: **2** Graph application permissions, down from 10.

## Migration recipe (per route)

For a route currently on app-only Graph (the common case):

```ts
// Before
import { getGraphClient } from '@/lib/graphClient'
import { verifyAuth, UNAUTHORIZED_RESPONSE } from '@/lib/api-auth'

export async function GET() {
  const session = await verifyAuth()
  if (!session) return UNAUTHORIZED_RESPONSE
  const graph = await getGraphClient()
  const data = await graph.api('/users').get()
  return NextResponse.json(data)
}
```

```ts
// After
import { withDelegatedAuth } from '@/lib/api-auth'

export const GET = withDelegatedAuth(async (_req, _session, { graph }) => {
  const data = await graph.api('/users').get()
  return NextResponse.json(data)
})
```

If `withDelegatedAuth` is too restrictive (e.g., the route also calls ARM /
Exchange), use `getGraphClientForUser` / `getAzureTokenForUser` /
`getExchangeTokenForUser` directly and let `DelegatedAuthRequiredError`
propagate to a `try / catch` that returns
`reauthRequiredResponse(err.reason, err.requiredScopes)`.

For a route that is genuinely background-only (cron, webhook, warmup):

1. Move the file to `src/jobs/**` or `src/workers/**`, or
   add `export const APP_ONLY_JUSTIFICATION = '...'` to the file.
2. Replace `getGraphClient()` with
   `getAppOnlyGraphClient({ reason: '...', jobId: '...' })`.
3. Add the route to `auth-mode-classifications.json` with class `"B"`.
4. Add an entry to [`docs/APP-ONLY-JOBS.md`](./APP-ONLY-JOBS.md).

For hybrid routes (sometimes a user, sometimes a scheduler), classify as
`"H"` and have the handler branch on whether a session is present:

```ts
const session = await verifyAuth()
const graph = session
  ? await getGraphClientForUser()
  : await getAppOnlyGraphClient({ reason: 'scheduled tenant inventory', jobId: 'inv-sync' })
```

## CI gate

```
pnpm run verify:auth-mode           # observe-only summary
pnpm run verify:auth-mode:strict    # fails when:
                                   #   * a U-classified route uses app-only
                                   #   * an API route is unclassified
pnpm run verify:graph-app-perms     # which Graph app roles are still needed
```

CI can run the strict variant now: `auth-mode-classifications.json` covers
every API route that acquires a privileged token (384 entries — 381 `U`,
3 `B`), and `pnpm run verify:auth-mode:strict` exits 0. Any newly added route
that acquires a token is reported as `unclassified` until it is added to the
file, which is the intended gate.

## Migration waves

| Wave | Scope | Notes | Status |
| --- | --- | --- | --- |
| **A** | `/api/graph/me/**`, `/api/users/recent-activities`, `/api/users/me/**` | Highest audit-trail win; lowest blast radius | ✅ |
| **B** | Read-only `Directory.*` / `Group.*` / `User.*Read.All` listings | Forces real user RBAC | ✅ |
| **C** | Writes via the action framework (user/group/device/role/intune/Exchange admin) | Wire delegated tokens into `executionService` | ✅ |
| **D** | `/api/azure/**`, `/api/governance/**`, advisor / cost / policy | `getAzureTokenForUser` | ✅ |
| **E** | `/api/reports/**` | `createGraphReportRoute` is delegated-only; app-only fallback removed | ✅ |
| **F** | Dataverse, Power Platform admin, Exchange specialty | `getDataverseTokenForUser`, `getPowerPlatformTokenForUser`, `getBapTokenForUser`, `getPowerAppsTokenForUser`, `getExchangeOwaTokenForUser` | ✅ |
| **G** | Delete the `RETIRABLE` Graph application permissions from the app registration (8 of 10) | The wave that actually shrinks the blast radius — see `DELEGATED-PERMISSION-GAPS.md` | ⬜ tenant action |

Each wave: change handlers → run `pnpm run verify:auth-mode` **and**
`pnpm run verify:graph-app-perms` → confirm the "U-classified routes still on
app-only" count strictly decreases and the "Retirable now" count strictly
increases → ship.

## Risks & mitigations

- **Consent fatigue / token expiry** — `DelegatedAuthRequiredError` is
  surfaced as `401 { error: "reauth_required", reason, requiredScopes }`.
  The UI listens for that and triggers `signIn()` (or
  `signIn('azure-ad', { scope })` for incremental consent). **Never silently
  fall back to app-only.**
- **APIs that only support app-only** — none of the resources the portal calls
  fall into this category any more. Every Graph, ARM, Exchange, Power Platform,
  BAP, Power Apps, Dataverse, Defender and Purview call site now has a
  delegated helper. The only sanctioned app-only surfaces left are listed in
  `docs/APP-ONLY-JOBS.md` (audit-log cron, Teams change-notification
  lifecycle, and the portal's own PAX Fabric store).
- **Three resources have no consentable delegated scopes — and that is fine** —
  `admin.microsoft.com`, `api.bap.microsoft.com`, and `compliance.microsoft.com`
  publish no delegated scopes, so they can never appear in
  `requiredResourceAccess`. Entra still issues tokens for all three (verified);
  the `roles` claim comes back empty because these services authorize on the
  signed-in user's service admin role rather than on Entra permissions. No
  consent and no code change is needed. In particular, **do not** repoint the 29
  BAP call sites at Power Platform API — it has not reached parity (DLP policies
  and tenant settings return `404` there today), and delegated BAP is confirmed
  working end-to-end (`dlp-policies`, `environments`, `tenant-settings` all
  `200` from a signed-in session). See
  [Runtime verification](./DELEGATED-PERMISSION-GAPS.md#runtime-verification-signed-in-end-to-end),
  [Resources with no consentable scopes](./DELEGATED-PERMISSION-GAPS.md#resources-with-no-consentable-scopes-this-is-fine--they-self-authorize)
  and [Do not repoint BAP to Power Platform API](./DELEGATED-PERMISSION-GAPS.md#do-not-repoint-bap-to-power-platform-api).
- **The app manifest can only list 10 of the 14 resources this app needs** —
  Entra caps `requiredResourceAccess` at 10 APIs from other tenants, and every
  resource here is a Microsoft first-party API. The cap cannot be raised and is
  the same for every `signInAudience`. Consent for the other four is therefore
  version-controlled in `scripts/consent-manifest.json` and reconciled by
  `pnpm run verify:consent` / `pnpm run bootstrap:consent`. Note the service
  returns a misleading `Directory_ResourceSizeExceeded` ("size of the object has
  exceeded its limit") for what is actually a resource-count violation. Pruning
  to 10 was verified to cause no sign-in or runtime regression, but it **does**
  revoke the dropped resources' consent on a delay — re-run
  `pnpm run verify:consent` a few minutes after any manifest edit, and
  `pnpm run bootstrap:consent` to restore. See
  [The manifest can only ever list 10 of the 14 resources](./DELEGATED-PERMISSION-GAPS.md#the-manifest-can-only-ever-list-10-of-the-14-resources).
- **Restarting the dev server signs everyone out** — the token store is
  in-memory and keyed by the JWT `jti`, so after a restart `/api/auth/session`
  returns `null` and every route returns `401` until the user signs in again.
  Also note `GET /api/auth/signin/azure-ad` is not a valid Auth.js v5 entry
  point; it throws `UnknownAction`. Use `/api/auth/signin`.
- **Delegated introduces per-user prerequisites that app-only bypassed** —
  Intune endpoints need an Intune RBAC role on the signed-in user,
  `IdentityRiskyUser.Read.All` needs Entra ID P2, Exchange endpoints need an
  Exchange admin role, ARM endpoints need Azure RBAC at the target scope,
  Power Platform endpoints need Power Platform Administrator, and Dataverse
  endpoints need a security role in the target org. Help-desk-tier admins will
  legitimately see less data. Record the shortfall via `recordPermissionGap()`;
  **never** fall back to app-only to paper over it.
- **`unstable_cache` cannot read cookies** — delegated token acquisition reads
  the session cookie, which Next.js forbids inside `unstable_cache`. Acquire
  the client outside the cache and pass it in; see
  `resolveServiceHealthClient()` in `src/lib/health/getServiceHealth.ts`.
- **Long-running operations** — pass the user's refresh token (or a
  short-lived delegated token plus a re-acquisition callback) into the job
  context so pollers can refresh; do not switch to app-only mid-flow.
- **Migration scope (~755 routes)** — `withDelegatedAuth` makes the typical
  migration a one-line edit. The audit script's wave-by-wave count is the
  source of truth for progress. App-only call sites went from **231 → 29**;
  the 29 are helper definitions plus the sanctioned background surfaces.

## Definition of done

- `pnpm run verify:auth-mode:strict` is green in CI.
- `pnpm run verify:graph-app-perms` reports no permission as `MIGRATE` — only
  `BACKGROUND` (the audit-log cron) remains — and `--uncovered` returns zero
  endpoints.
- Every app-only call site is inside `src/jobs/**` / `src/workers/**` or
  carries `APP_ONLY_JUSTIFICATION`.
- Entra audit log shows real user UPNs for user-triggered reads/writes
  (sampled across each wave).
- The app registration's Graph application permissions are reduced to the
  documented background-job set (`AuditLog.Read.All`,
  `AuditLogsQuery.Read.All`, plus the change-notification lifecycle).
- The deprecated `getGraphClient()` alias (and `src/lib/obo.ts` shim) are
  removed.
