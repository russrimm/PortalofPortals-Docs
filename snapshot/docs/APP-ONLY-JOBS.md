# Sanctioned App-Only (Client-Credentials) Callers

Every app-only / client-credentials Graph or ARM call must:

1. Be invoked from a file under `src/jobs/**` or `src/workers/**`, **or**
2. Export `APP_ONLY_JUSTIFICATION = '<short reason>'` at the top of the file, **or**
3. Use `getAppOnlyGraphClient({ reason, jobId })` from `src/lib/auth/appOnly.ts`,
   which makes the reason show up in the structured `[token-audit]` log
   (`tokenType: 'app-only'`).

This page lists every legitimate caller, what it touches, and why it cannot
use a delegated (OBO) token. Adding a new app-only caller without an entry
here will fail `pnpm run verify:auth-mode:strict` once strict mode is enabled
in CI.

## Current state

**Seven app-only callers are sanctioned** (see the table below). As of the
delegated-auth migration, `pnpm run verify:auth-mode` reports **30** raw
app-only call sites, and every one of them is a *helper definition itself* in
`src/lib/graphClient.ts`, `src/lib/azureToken.ts`, `src/lib/ppToken.ts`,
`src/lib/auth/appOnly.ts`, `src/lib/delegatedGraph.ts`, `src/lib/api-auth.ts`,
and `src/lib/paxFabricClient.ts`. **Zero user-triggered routes call a raw
app-only helper** (`U-classified routes still on app-only: 0`).

`pnpm run verify:auth-mode:strict` currently **fails**, but not on auth mode —
it fails on three routes that have no entry in
`auth-mode-classifications.json`: `/api/pax/job-config`,
`/api/power-platform/copilot-studio/agents/[botId]/migration-prep`, and
`/api/secure-score/assign`. Classify those to make the gate green.

The Teams transcript change-notification lifecycle
(`src/app/api/teams/transcripts/**`) now routes through
`getAppOnlyGraphClient({ reason, jobId })`, so its app-only usage shows up as
`app-only-sanctioned` in the audit and carries a reason in the `[token-audit]`
log. The `/api/health/all` enrollment summary uses the same helper. The PAX
Fabric SQL warehouse connection (`src/lib/paxFabricClient.ts`) remains
app-only — see the table below.

The unused app-only helpers (`getAzureToken`, `getExchangeToken`,
`getExchangeOwaToken`, `getAIFoundryToken`, `getPowerPlatformToken`,
`getBapToken`, `getPowerAppsToken`, `getDefenderToken`, `getDataverseToken`,
`getSharePointToken`, `getAppInsightsToken`, `getFreshAppInsightsToken`,
`getCognitiveServicesToken`, `getLogAnalyticsToken`)
are retained but marked `@deprecated` so `scripts/audit-auth-mode.mjs` can keep
policing reintroduction. Do not call them.

> `getAppInsightsToken` / `getFreshAppInsightsToken` would now fail outright: the
> **Application Insights API** was removed from the app registration and its
> consent grant revoked, so `https://api.applicationinsights.io/.default` no
> longer resolves. Application Insights is queried through Azure Monitor Logs —
> see `src/lib/appInsightsQuery.ts`.

Every Graph application permission on the app registration has a delegated
equivalent, so the target end state is **zero** user-triggered Graph app-only
callers — only the scheduled audit-log ingest and the change-notification
lifecycle below stay app-only. See
[`DELEGATED-PERMISSION-GAPS.md`](./DELEGATED-PERMISSION-GAPS.md) for the
permission-by-permission inventory and migration order.

## Sanctioned callers

| Caller | Provider | Permission(s) | Why app-only | Status |
| --- | --- | --- | --- | --- |
| `scripts/cron/audit-log-ingest.mjs` | Graph `/auditLogs/directoryAudits`, `/security/auditLog/queries` | `AuditLog.Read.All`, `AuditLogsQuery.Read.All` | Scheduled tenant-wide ingest with no signed-in user; runs on a timer outside any request (categories 3 and 5) | **Sanctioned** — keep these two app roles |
| `scripts/cron/kpi-snapshot.mjs` | Graph `/reports/authenticationMethods/userRegistrationDetails`, `/deviceManagement/managedDevices`, `/security/alerts_v2`, `/users/$count` | `AuditLog.Read.All`, `DeviceManagementManagedDevices.Read.All`, `SecurityAlert.Read.All`, `User.Read.All` | Tenant posture snapshot for dashboard trends and drift detection, twice daily (06:20 / 18:20 UTC). Runs on a WebJob timer with no signed-in user, and deliberately measures the whole tenant (category 3). A delegated token would also make the series depend on *which* admin happened to load the dashboard — Intune scope tags and Defender device groups narrow the same query per-admin | **Sanctioned** — see the note below on the roles this keeps alive |
| `src/app/api/teams/transcripts/subscribe/route.ts` | Graph `/subscriptions` | change-notification lifecycle | Subscription renewal and webhook delivery outlive any user session (category 1) | **Sanctioned** — wrapped in `getAppOnlyGraphClient`. Kept as `U` (an admin triggers it from the UI) so strict mode still flags any switch to a raw app-only helper |
| `src/app/api/teams/transcripts/subscriptions/route.ts` | Graph `/subscriptions` | change-notification lifecycle | Same as above | **Sanctioned** — same treatment |
| `src/lib/paxFabricClient.ts` | Fabric SQL analytics endpoint | none (SQL grants on the warehouse) | The PAX warehouse is the portal's *own* backing store, not tenant data. Access is granted to the service principal as a database principal; individual operators hold no SQL grant (category 4) | **Sanctioned** |
| `src/app/api/users/[id]/ai-interactions/route.ts` | Graph `/copilot/users/{id}/interactionHistory/getAllEnterpriseInteractions` | `AiEnterpriseInteraction.Read.All` | Microsoft Graph documents this API as **delegated: Not supported** for both work/school and personal accounts. A delegated call fails with `412 PreconditionFailed — "Requested API is not supported in delegated context"`. The route now keeps only the **history export** call app-only: tenant-scoped portal-admin access is enforced first, `/users` enumeration stays delegated, and each resumed target user is re-verified with delegated `GET /users/{id}` before the sanctioned app-only history read. Application permission remains the only option for the history endpoint itself (category 4). | **Sanctioned** — UI shows an "Acting as service principal" badge |
| `src/app/api/power-platform/licensing/payg-guardrails/evaluate/route.ts` (scheduled path only) | ARM Cost Management + `api.powerplatform.com/licensing` | Azure `user_impersonation` equivalent app role; Power Platform admin | Pay-as-you-go budget enforcement must run unattended on a timer — the entire point is that it fires without a human present, so there is no session to delegate as (category 3). The **interactive** path in the same route uses delegated tokens and is attributable to the signing-in admin; app-only is reached only when the caller presents `PORTAL360_CRON_SECRET`. Both paths are additionally gated on the guardrails add-on being installed for the tenant (see below), so the scheduled sweep is a no-op for any tenant that never opted in | **Sanctioned** — classified `H` (hybrid). See [`payg-budget-guardrails.md`](./payg-budget-guardrails.md) |
| `src/app/api/health/all/route.ts` (enrollment summary) | Graph beta `/deviceManagement/depOnboardingSettings`, `/deviceAppManagement/vppTokens`, `/deviceManagement/applePushNotificationCertificate` | `DeviceManagementServiceConfig.Read.All` | Tenant-wide APNs/DEP/VPP expiry aggregate cached under a **single shared key** for all admins (category 3). Delegated acquisition cannot run inside `unstable_cache`, and per-user cache keys would still let one admin's Intune-scope-filtered view be served to another. The value is a tenant posture signal, not a per-admin view | **Sanctioned** — wrapped in `getAppOnlyGraphClient`. Kept as `U` (an admin loads the dashboard) so strict mode still flags any switch to a raw app-only helper |

Everything else currently on app-only is a migration target, not a sanctioned
caller. Do not add rows here to legitimise an existing route — migrate it.

The Copilot interaction route delegates its history reads to
`src/lib/copilot-interactions/search.ts`. The application-permission inventory
follows local path builders and conditional paths passed to `.api()`, so this
refactoring must not make `AiEnterpriseInteraction.Read.All` appear unused.
It reports this permission as **REQUIRED** while a caller exists because the
history API has no delegated equivalent; removing its last caller still makes
the strict unused-permission gate fail. File-level mixed-identity attribution
remains conservative and is not evidence for removing a tenant grant.

> **The KPI snapshot cron keeps three roles that were previously retirable.**
> `DeviceManagementManagedDevices.Read.All`, `SecurityAlert.Read.All`, and
> `User.Read.All` were listed as retirable in
> [`DELEGATED-PERMISSION-GAPS.md`](./DELEGATED-PERMISSION-GAPS.md) on the
> grounds that *nothing used them*. A declared background job does use them, so
> their verdict is now `BACKGROUND`, not `RETIRABLE`. This was an explicit
> tradeoff: standing tenant-wide read access in exchange for a contiguous daily
> posture series that does not depend on an admin loading the dashboard. The
> documented end state moves from 2 Graph application permissions to 5. If that
> trade is ever reversed, delete the WebJob and the three roles together.
>
> Note `Reports.Read.All` is deliberately **not** required: Microsoft documents
> `AuditLog.Read.All` as the least-privileged application permission for
> `userRegistrationDetails`, and the cron relies on that instead.

## Legitimate categories

The categories below describe **types** of work that genuinely cannot run
under OBO. Use these as the schema for the `reason` field.

### 1. Webhook signature validation

Inbound webhooks (e.g. Microsoft Graph change notifications, Azure Event
Grid) are not initiated by a user session. The handler must use app-only
to validate the signature and persist the payload. Do all user-facing
work asynchronously after a user later visits the UI.

### 2. Scheduled token / cache warmup

Background tasks that prime token caches before the first user request.
These never read user data; the only Graph call is `getGraphToken()` itself.

### 3. Tenant-wide inventory sync

Nightly inventory of users, groups, devices, licenses across the tenant
into our own store. The work intentionally spans every user — there is no
single "signed-in user" to delegate as.

### 4. APIs that only expose app-only permissions

Certain Power Platform BAP / Power Apps admin endpoints, and some Reports
APIs, do not expose delegated permissions. Document the specific endpoint
and the upstream API limitation in the table above. UI surfaces that
display data from these calls **must** show an "acting as service
principal" badge so the user knows the action is not personally
attributable.

> **No Microsoft Graph permission currently on the app registration falls
> into this category.** All ten granted Graph application permissions have a
> delegated equivalent. If you are reaching for this justification for a
> Graph call, check `docs/DELEGATED-PERMISSION-GAPS.md` first — the answer is
> almost certainly "migrate to delegated".
>
> **Exception:** `AiEnterpriseInteraction.Read.All` is a genuine category-4
> Graph permission — Microsoft documents
> [`getAllEnterpriseInteractions`](https://learn.microsoft.com/graph/api/aiinteractionhistory-getallenterpriseinteractions)
> as *delegated: Not supported*. It is **not** currently on the app
> registration; the Copilot interactions page will return `403` until a tenant
> admin grants it.

### 5. System-of-record reconciliation

E.g., reconciling our local DB with Entra after an admin change made
outside the portal. Treat as a background job, not a user-triggered call.
