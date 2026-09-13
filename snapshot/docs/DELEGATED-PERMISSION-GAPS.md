# Application → Delegated Permission Inventory

> **Goal:** run every Microsoft Graph call as the **signed-in user**
> (delegated / OBO) and reduce the app registration's **application**
> permissions to the smallest set that genuinely cannot work delegated.
>
> Companion docs: [`DELEGATED-AUTH-MIGRATION.md`](./DELEGATED-AUTH-MIGRATION.md)
> (how to migrate a route) and [`APP-ONLY-JOBS.md`](./APP-ONLY-JOBS.md)
> (which app-only callers are sanctioned).

## TL;DR

**Every Graph application permission on the app registration has a delegated
equivalent.** There is no *currently granted* Graph app role the portal needs
application-only.

> **One exception:** `AiEnterpriseInteraction.Read.All`.
> Microsoft documents `aiInteractionHistory: getAllEnterpriseInteractions` as
> *delegated: Not supported*, so the Copilot interactions page must run
> app-only. See
> [Granted and required app-only](#granted-and-required-app-only).

> **⚠️ Incident history:** the Power Platform API delegated consent grant has
> been accidentally deleted twice, breaking Power Platform pages tenant-wide
> with 401s. Never revoke it from the Entra portal — see
> [Do not remove the Power Platform API consent grant](#️-do-not-remove-the-power-platform-api-consent-grant).

Nine of the ten are *already* granted as delegated scopes too, so migrating a
route is a code change only — no new admin consent needed.

> ### ✅ Code migration complete — and verified at runtime
>
> Every user-triggered route now acquires a **delegated** token.
> `pnpm run verify:auth-mode` reports `U-classified routes still on app-only: 0`,
> and the only remaining app-only call sites are the helper definitions plus the
> two sanctioned background surfaces in [`APP-ONLY-JOBS.md`](./APP-ONLY-JOBS.md).
>
> Confirmed against a live signed-in session across Graph, BAP, Power Platform
> API, ARM, and Application Insights — including the `settings-catalog` route
> whose `403` started this work. See
> [Runtime verification](#runtime-verification-signed-in-end-to-end).
>
> ### ✅ Tenant action complete
>
> The eight unused Graph application roles have been removed from the app
> registration, and `DeviceManagementManagedDevices.Read.All` +
> `SecurityAlert.Read.All` were granted for the KPI snapshot cron. Verified
> 2026-08-08 against `Portal360-Graph`: the requested and granted role sets
> agree at **six**, and `pnpm run verify:graph-app-perms` reports
> `Retirable now: 0/6`.

| Verdict | Count | Permissions |
| --- | --- | --- |
| **BACKGROUND** — a scheduled job needs it | 5 | `AuditLog.Read.All`, `AuditLogsQuery.Read.All`, `DeviceManagementManagedDevices.Read.All`, `SecurityAlert.Read.All`, `User.Read.All` |
| **APP-ONLY BY NECESSITY** — no delegated path | 1 | `AiEnterpriseInteraction.Read.All` |

Nothing is retirable. Every remaining Graph application role is consumed by a
declared background job or has no delegated equivalent.

> **Why the background set grew from 2 to 5.** Adding
> `scripts/cron/kpi-snapshot.mjs` (daily tenant posture snapshots) put three
> previously-unused roles back into service. Their old `RETIRABLE` verdict
> rested on "nothing uses it", which a declared background job changes.
> `User.Read.All` is preferred over reusing `Directory.Read.All` because it is
> least-privilege for `/users/$count` — which is what let `Directory.Read.All`
> be retired. See [`APP-ONLY-JOBS.md`](./APP-ONLY-JOBS.md) for the tradeoff.

## Current application permissions (Microsoft Graph)

App registration: **`Portal360-Graph`**. The sibling `Portal360` registration
holds **no** application permissions.

App-only call-site counts below are **post-migration**: all user-triggered
routes now use the delegated helpers.

| Application permission | Delegated equivalent exists | Delegated already consented | App-only call sites | Verdict |
| --- | --- | --- | --- | --- |
| `AiEnterpriseInteraction.Read.All` | ❌ — *delegated: Not supported* | n/a | 1 user-triggered | **Keep** — no delegated path exists |
| `AuditLog.Read.All` | ✅ | ✅ | 2 background | **Keep** — audit-log + KPI snapshot crons |
| `AuditLogsQuery.Read.All` | ✅ | ✅ | 1 background | **Keep** — cron job |
| `DeviceManagementManagedDevices.Read.All` | ✅ | ✅ | 1 background | **Keep** — KPI snapshot cron |
| `SecurityAlert.Read.All` | ✅ | ✅ | 1 background | **Keep** — KPI snapshot cron |
| `User.Read.All` | ✅ | ✅ | 1 background | **Keep** — KPI snapshot cron |

### Retired application permissions

Removed from the app registration and no longer granted. Each has a consented
delegated equivalent, so an app-only caller that reaches one of these endpoints
must move to delegated rather than have the role granted back — the audit
script reports them under `--uncovered` for exactly that reason.

`Directory.Read.All`, `IdentityRiskyUser.Read.All`, `Reports.Read.All`,
`SecurityEvents.Read.All`, `ServiceHealth.Read.All`, `ServiceMessage.Read.All`,
`CopilotPackages.Read.All`, `CopilotPolicySettings.Read`

> For the two Copilot roles the consented delegated scopes are the **ReadWrite**
> variants (`CopilotPackages.ReadWrite.All`, `CopilotPolicySettings.ReadWrite`),
> which subsume Read — the Copilot admin pages were already delegated and are
> unaffected by the retirement.

### Granted and required app-only

| Application permission | Delegated equivalent exists | Currently granted | Needed by | Verdict |
| --- | --- | --- | --- | --- |
| `AiEnterpriseInteraction.Read.All` | ❌ — Graph documents `getAllEnterpriseInteractions` as *delegated: Not supported* | ✅ | `/api/users/[id]/ai-interactions` (Copilot interactions page) | **Keep as application permission** — there is no delegated path. |

This is the sole Graph capability the portal uses that is genuinely
application-only. See
[`APP-ONLY-JOBS.md`](./APP-ONLY-JOBS.md) category 4.

The one legitimate background caller is
[`scripts/cron/audit-log-ingest.mjs`](../scripts/cron/audit-log-ingest.mjs),
which requests a `client_credentials` token directly and reads
`/auditLogs/directoryAudits` plus `/security/auditLog/queries`. It is a
scheduled tenant-wide ingest with no signed-in user, so it stays app-only —
see [`APP-ONLY-JOBS.md`](./APP-ONLY-JOBS.md).

### Non-Graph application permissions

| Resource | Application permission | Delegated equivalent | Action |
| --- | --- | --- | --- |
| Power Platform API | `CopilotStudio.Copilots.Invoke` | same scope, already consented delegated | Retirable once callers move to delegated |
| Azure SQL Database | `app_impersonation` | no app-role equivalent; delegated path is `user_impersonation` (consented) | Keep only if a background job needs SQL as the service principal |

## Regenerating this inventory

Two scripts back this document. Run both before editing the tables.

```bash
# Which routes still use app-only helpers at all
pnpm run verify:auth-mode

# Which *application permission* each app-only Graph call consumes,
# and which app roles are therefore retirable
pnpm run verify:graph-app-perms

# Detail for one permission
node scripts/audit-graph-app-permissions.mjs --permission Reports.Read.All

# App-only calls that no granted application permission covers
node scripts/audit-graph-app-permissions.mjs --uncovered
```

To re-read the live grants straight from the tenant:

```bash
SP=$(az ad sp list --filter "appId eq '<client-id>'" --query "[0].id" -o tsv)
az rest --method GET \
  --url "https://graph.microsoft.com/v1.0/servicePrincipals/$SP/appRoleAssignments"
az rest --method GET \
  --url "https://graph.microsoft.com/v1.0/servicePrincipals/$SP/oauth2PermissionGrants"
```

## Where each application permission is still consumed

Migrating these call sites to `getGraphClientForUser()` / `withDelegatedAuth`
is what unblocks deleting the corresponding app role.

### `ServiceMessage.Read.All` — retired

No app-only call site references `/admin/serviceAnnouncement/messages`. The app
role has been removed from the app registration.

### `IdentityRiskyUser.Read.All` — retired

The only app-only call site (`src/app/api/home/attention/route.ts`) was deleted
along with the "Needs your attention" home strip. The app role has been removed
from the app registration.

Note: if it is ever reinstated, delegated requires the signed-in user to hold an
**Entra ID P2** license.

### `SecurityEvents.Read.All` — 1 call site

- `src/app/api/home/exec-kpis/route.ts` → `/security/secureScores`

### `SecurityAlert.Read.All` — 1 call site

- `src/app/api/home/exec-kpis/route.ts` → `/security/alerts_v2`

The delegated scope **is consented** in the tenant, so this route works today.

### `DeviceManagementManagedDevices.Read.All` — 2 call sites

- `src/app/api/home/exec-kpis/route.ts` → `/deviceManagement/managedDevices`
- `src/app/api/playbooks/summary/route.ts` → `/deviceManagement/managedDevices`

Delegated additionally requires the signed-in user to hold an **Intune RBAC
role**. The Graph scope alone is not sufficient.

### `AuditLog.Read.All` — 3 user call sites + 1 background (**keep the app role**)

- `src/app/api/applications/sign-in-logs/route.ts` → `/auditLogs/signIns`
- `src/app/api/users/sign-in-logs/route.ts` → `/auditLogs/signIns`
- `src/app/api/provisioning-logs/route.ts` → `/auditLogs/provisioning`
- `scripts/cron/audit-log-ingest.mjs` → `/auditLogs/directoryAudits` — **background, stays app-only**

Migrate the three routes for audit attribution, but the app role stays for
the cron job.

### `AuditLogsQuery.Read.All` — 3 user call sites + 1 background (**keep the app role**)

- `src/app/api/audit-log-queries/route.ts`
- `src/app/api/audit-log-queries/[queryId]/route.ts`
- `src/app/api/audit-log-queries/[queryId]/records/route.ts`
- `scripts/cron/audit-log-ingest.mjs` — **background, stays app-only**

All hit `/security/auditLog/queries`.

### `ServiceHealth.Read.All` — 5 call sites

- `src/lib/health/getServiceHealth.ts`
- `src/app/api/graph/admin/serviceAnnouncement/healthOverviews/route.ts`
- `src/app/api/service-health/issues/[issueId]/route.ts`
- `src/app/api/service-health/issues/[issueId]/incident-report/route.ts`
- `src/app/api/power-platform/known-issues/_data.ts`

`getServiceHealth.ts` resolves a **delegated-only** client via
`resolveServiceHealthClient()` — acquired outside the cache scope. It is the
reference implementation for the `unstable_cache` problem described below.
A 401/403 there records a `service-health` permission gap and surfaces to the
caller; there is deliberately no app-only retry.

### `Reports.Read.All` — 8 call sites

- `src/app/api/home/exec-kpis/route.ts`
- `src/app/api/playbooks/summary/route.ts`
- `src/app/api/reports/conditional-access-blocked-signins/route.ts`
- `src/app/api/intune/non-compliance-report/route.ts`
- `src/app/api/device-management/reports/export/route.ts`
- `src/app/api/device-management/reports/export/[id]/route.ts`
- `src/app/api/exchange/admin-dashboard/route.ts`
- `src/app/api/exchange/debug/route.ts`

The shared M365 usage-report helper
[`src/app/api/reports/createGraphReportRoute.ts`](../src/app/api/reports/createGraphReportRoute.ts)
— which backs every `reportRoot` route, including the three behind
`/microsoft365/activity` — is **delegated-only**. The app-only fallback was
removed so the `Reports.Read.All` application role can be retired. A delegated
401/403 records a `graph-reports:*` entry in the permission-gap tracker and is
returned to the caller as a 403 with remediation text.

Graph proxies these reads to the M365 reporting substrate, which returns the
real failure nested inside `error.message`:

```json
{"error":{"code":"UnknownError","message":"{\"error\":{\"code\":\"S2SUnauthorized\",\"message\":\"Invalid permission.\"}}"}}
```

`S2SUnauthorized` means the delegated token does not carry `Reports.Read.All`,
or the signed-in user holds no reports-capable role. Grant the delegated scope
with admin consent, sign out and back in so the new scope lands on the token,
and confirm the user is Reports Reader / Global Reader or equivalent.

### `Directory.Read.All` — 16 call sites

Largest cluster; mostly `/organization`, `/subscribedSkus`, `/applications`,
`/servicePrincipals`, `/policies/**`, `/identity/conditionalAccess/**`.

- `src/app/api/graph/organization/subscribedSkus/route.ts`
- `src/app/api/graph/organizational-branding/{logo,banner-logo,square-logo,square-logo-dark,background-image}/route.ts`
- `src/app/api/graph/applications/route.ts`
- `src/app/api/graph/get-users-by-ids/route.ts`
- `src/app/api/graph/identity/conditionalAccess/policies/route.ts`
- `src/app/api/graph/identity/conditionalAccess/policies/[id]/route.ts`
- `src/app/api/graph/policies/authenticationStrengthPolicies/route.ts`
- `src/app/api/graph/policies/authenticationStrengthPolicies/[id]/route.ts`
- `src/app/api/graph/policies/crossTenantAccessPolicy/default/route.ts`
- `src/app/api/azure/license-usage/route.ts`
- `src/app/api/chat/route.ts`
- `src/app/api/playbooks/summary/route.ts`

## Already-broken app-only calls (historical — now migrated)

21 app-only Graph endpoints required an application permission the app
registration **does not have**, so they returned `403
Authorization_RequestDenied`. In every case the matching **delegated** scope
was already consented, so the fix was to migrate the route — never to add
another application permission. **All of these are now delegated.** The table
is retained so the same mistake is not repeated.

| Endpoint | Would need app permission | Delegated scope status |
| --- | --- | --- |
| `/users`, `/users/$count`, `/users/{id}`, `/users/{id}/photo/$value` | `User.Read.All` | ✅ consented |
| `/groups`, `/groups/$count`, `/groups/{id}` | `Group.Read.All` | ✅ consented |
| `/devices/$count` | `Device.Read.All` | ✅ consented |
| `/sites/root`, `/sites/getAllSites` | `Sites.Read.All` | ✅ consented |
| `/deviceAppManagement/mobileApps**`, `/deviceAppManagement/vppTokens` | `DeviceManagementApps.Read.All` | ✅ consented |
| `/deviceManagement`, `/deviceManagement/configurationPolicies` | `DeviceManagementConfiguration.Read.All` | ✅ consented |
| `/deviceManagement/depOnboardingSettings`, `/deviceManagement/applePushNotificationCertificate` | `DeviceManagementServiceConfig.Read.All` | ❌ **not consented either** |
| `/tenantRelationships/findTenantInformationByTenantId` | `CrossTenantInformation.ReadBasic.All` | ✅ consented |
| `/admin/exchange/mailboxes` | `Exchange.ManageAsApp` | delegated path is EXO `user_impersonation` |
| `/subscriptions` (Graph change notifications) | resource-specific | see note below |

**Graph change-notification subscriptions** (`/subscriptions`, used by
`src/app/api/teams/transcripts/**`) are the one genuine app-only candidate:
the renewal and webhook-delivery lifecycle outlives any user session. Treat
these as background jobs per `APP-ONLY-JOBS.md` rather than migrating them.

## Migration order

Work smallest-blast-radius first. After each step re-run
`pnpm run verify:graph-app-perms` and confirm the retirable count increases.

| Step | Work | Removes app role | Status |
| --- | --- | --- | --- |
| 1 | Delete the `ServiceMessage.Read.All` and `IdentityRiskyUser.Read.All` app roles — nothing uses them | `ServiceMessage.Read.All`, `IdentityRiskyUser.Read.All` | ✅ done — removed from the app registration |
| 2 | Consent delegated `SecurityAlert.Read.All`, then migrate `/api/home/exec-kpis` | `SecurityAlert.Read.All`, `SecurityEvents.Read.All` | ✅ done — route migrated and delegated scope confirmed consented |
| 3 | Migrate service-health routes; hoist the Graph client out of `unstable_cache` | `ServiceHealth.Read.All` | ✅ done (`resolveServiceHealthClient` is delegated-only) |
| 4 | Migrate reports routes via the shared `createGraphReportRoute` helper | `Reports.Read.All` | ✅ done — app-only fallback removed |
| 5 | Migrate the `Directory.Read.All` call sites | `Directory.Read.All` | ✅ done |
| 6 | Migrate Intune / device routes (needs Intune RBAC on the user) | `DeviceManagementManagedDevices.Read.All` | ✅ done |
| 7 | Migrate the sign-in / provisioning / audit-query **routes** for attribution | — cron still needs `AuditLog.Read.All` + `AuditLogsQuery.Read.All` | ✅ routes done |
| 8 | Move Teams transcript subscriptions to `src/jobs/**` with `getAppOnlyGraphClient` | — documents the remaining minimum | ⬜ |
| 9 | Grant `User.Read.All` **application** so the KPI snapshot cron can read `/users/$count` | — adds an app role | ✅ done |
| 10 | Grant `DeviceManagementManagedDevices.Read.All` + `SecurityAlert.Read.All` **application** for the KPI snapshot cron | — adds two app roles | ✅ done 2026-08-08 — both metrics now return data |
| 11 | Retire `CopilotPackages.Read.All` and `CopilotPolicySettings.Read` — no app-only call site uses them | `CopilotPackages.Read.All`, `CopilotPolicySettings.Read` | ✅ done 2026-08-08 |

End state today: **6** Graph application permissions — five background
(`AuditLog.Read.All`, `AuditLogsQuery.Read.All`,
`DeviceManagementManagedDevices.Read.All`, `SecurityAlert.Read.All`,
`User.Read.All`) and one app-only by necessity
(`AiEnterpriseInteraction.Read.All`), plus whatever the change-notification
lifecycle needs. `pnpm run verify:graph-app-perms` reports `Retirable now: 0/6`.

> **Steps 2 and 6 are partially reversed by design.** They removed the last
> *user-triggered* app-only callers of `SecurityAlert.Read.All` and
> `DeviceManagementManagedDevices.Read.All`, which was the point — no
> user-facing request runs as the service principal. The KPI snapshot cron
> reintroduces them on the *background* surface only, which was always the
> sanctioned place for app-only.

> **Tenant follow-up.** None outstanding. The application-permission set is at
> its minimum: every remaining role is consumed by a declared background job or
> has no delegated equivalent. Re-check with `pnpm run verify:graph-app-perms`
> after adding any new app-only caller.

## Non-Graph resources

The same delegated-first rule applies to every non-Graph resource. Each app-only
helper now has a delegated counterpart in `src/lib/graphClient.ts`:

| Resource | App-only helper (deprecated) | Delegated helper | Scope key |
| --- | --- | --- | --- |
| Azure Resource Manager | `getAzureToken` | `getAzureTokenForUser` | `armUserImpersonation` |
| Exchange Online (EWS) | `getExchangeToken` | `getExchangeTokenForUser` | `exchangeUserImpersonation` |
| Exchange Online (OWA) | `getExchangeOwaToken` | `getExchangeOwaTokenForUser` | `exchangeDefault` |
| M365 Admin Center | — | `getAdminCenterTokenForUser` | `adminCenterDefault` |
| Azure AI Foundry | `getAIFoundryToken` | `getAIFoundryTokenForUser` | `aiFoundryDefault` |
| Power Platform API | `getPowerPlatformToken` | `getPowerPlatformTokenForUser` | `powerPlatformApiDefault` |
| BAP | `getBapToken` | `getBapTokenForUser` | `powerPlatformDefault` |
| Power Apps service | `getPowerAppsToken` | `getPowerAppsTokenForUser` | `powerAppsDefault` |
| Dataverse | `getDataverseToken` | `getDataverseTokenForUser` | `${orgUrl}/.default` |
| Defender for Endpoint / XDR | `getDefenderToken` | `getDefenderTokenForUser` | `defenderDefault` |
| Purview Compliance Manager | inline client-credentials | `getPurviewComplianceTokenForUser` | `purviewComplianceDefault` |
| SharePoint tenant | `getSharePointToken` | `getSharePointTokenForUser` | `${origin}/.default` |
| Azure OpenAI / Cognitive Services | `getCognitiveServicesToken` | `getCognitiveServicesTokenForUser` | `cognitiveServicesDefault` |
| Log Analytics query API | `getLogAnalyticsToken` | `getLogAnalyticsTokenForUser` | `logAnalyticsDefault` |
| Microsoft Work IQ | *(none — app-only is not supported by the service)* | `getWorkIqTokenForUser` | `workIqDefault` |
| Application Insights query API | `getAppInsightsToken`, `getFreshAppInsightsToken` (unused tombstones) | `getLogAnalyticsTokenForUser` — App Insights is queried resource-centrically through Azure Monitor Logs | `logAnalyticsDefault` |

All of them are zero-argument (except Dataverse and SharePoint, which take the
org / tenant URL) and throw `DelegatedAuthRequiredError` rather than silently
escalating to the service principal. `src/lib/api-errors.ts` maps that error to
a `401 { error: 'reauth_required' }` response, so routes that already use
`toClientError` / `toClientErrorResponse` get correct re-auth semantics for free.

Scope keys live in `src/lib/auth/scopeMap.ts`. Add a key there rather than
passing a raw scope string, so the audit tooling can see it.

### Tenant consent status for non-Graph resources

Verified against tenant `f33d7d7f-d7a8-49c9-9dfe-af8c9ca30123` on the
`Portal360-Graph` app registration (`e47c9169-a1b6-4ef7-9cca-8b3f3e8b18c1`).

Already consented before this migration: Microsoft Graph, Azure Resource
Manager, Dataverse, Power BI / Fabric, Microsoft Flow Service, PowerApps
Service, Azure Machine Learning Services, Power Platform API,
Microsoft MCP Server for Enterprise.

> **Correction.** An earlier revision of this table listed Azure Machine
> Learning Services as covering `ai.azure.com`. It does not. Azure Machine
> Learning Services publishes `https://ml.azure.com` (app ID
> `0736f41a-0425-4b46-bdb5-1563eff02385`); the Microsoft Foundry data plane is a
> separate resource — see
> [Azure AI Foundry (`ai.azure.com`) is not consentable](#azure-ai-foundry-aiazurecom-is-not-consentable).

Granted as part of this migration:

| Resource | Resource app ID | Delegated scopes granted |
| --- | --- | --- |
| Office 365 Exchange Online | `00000002-0000-0ff1-ce00-000000000000` | `Exchange.ManageV2` |
| Microsoft Threat Protection | `8ee8fdad-f234-4243-8f3b-15c294843740` | `Incident.Read`, `AdvancedHunting.Read` |
| Microsoft Cognitive Services | `7d312290-28c8-473c-a0ed-8e53749b6d6d` | `user_impersonation` |
| Log Analytics API | `ca7f3f0b-7d91-482c-8e09-c5d840d0eac5` | `Data.Read` (also serves Application Insights, queried resource-centrically) |
| Work IQ | `fdcc1f02-fc51-4226-8753-f668596af7f7` | `WorkIQAgent.Ask` |

These were created as `oauth2PermissionGrants` (consent type `AllPrincipals`)
directly on the service principal rather than through `requiredResourceAccess`,
because **the manifest can only ever list 10 of the 14 resources this app
needs** — see
[The manifest can only ever list 10 of the 14 resources](#the-manifest-can-only-ever-list-10-of-the-14-resources)
below. The grant is what governs runtime authorization; `requiredResourceAccess`
only drives the consent prompt and the portal UI.

### Resources with no consentable scopes (this is fine — they self-authorize)

Three resources have no service principal in the tenant that publishes delegated
scopes, so they cannot appear in `requiredResourceAccess` and cannot have an
`oauth2PermissionGrant`:

| Resource | Used by |
| --- | --- |
| `admin.microsoft.com` | `getAdminCenterTokenForUser` |
| `api.bap.microsoft.com` | `getPowerPlatformTokenForUser` (29 call sites) |
| `compliance.microsoft.com` | `getPurviewComplianceTokenForUser` |

**That does not mean they are unusable.** Entra issues tokens for all three
today. Verified against this app registration — each returns a valid token whose
`roles` claim is *empty*:

```
POST /oauth2/v2.0/token  scope=https://admin.microsoft.com/.default       -> aud=https://admin.microsoft.com       roles=(none)
POST /oauth2/v2.0/token  scope=https://api.bap.microsoft.com/.default     -> aud=https://api.bap.microsoft.com     roles=(none)
POST /oauth2/v2.0/token  scope=https://compliance.microsoft.com/.default  -> aud=https://compliance.microsoft.com  roles=(none)
```

An empty `roles` claim is the point: these services do **not** gate on Entra
permissions at all. They authorize on their own model instead —

- **Delegated:** the signed-in user's service admin role (Power Platform
  Administrator for BAP, Global/Exchange/etc. for `admin.microsoft.com`,
  a Purview role group for `compliance.microsoft.com`).
- **App-only:** a service-side registration. For BAP that is
  `PUT https://api.bap.microsoft.com/providers/Microsoft.BusinessAppPlatform/adminApplications/{clientId}?api-version=2020-10-01`,
  which `src/lib/ppToken.ts` already references in its error text.

So the absence of an Entra grant is expected and correct for these three.
Nothing needs to be consented, and **no code change is required** — see
[Do not repoint BAP to Power Platform API](#do-not-repoint-bap-to-power-platform-api).

### Microsoft Work IQ (`api://workiq.svc.cloud.microsoft`)

Work IQ backs the **Work IQ Content Search** page (`/microsoft365/work-iq`) and
is the one resource here where delegated auth is not merely preferred but the
only option Microsoft supports — the service rejects application-only tokens
outright, because it security-trims every answer to the signed-in user's own
Microsoft 365 access.

| Property | Value |
| --- | --- |
| Token audience | `api://workiq.svc.cloud.microsoft` |
| Scope | `WorkIQAgent.Ask` (`0b1715fd-f4bf-4c63-b16d-5be31f9847c2`, admin-consent) |
| Resource app ID | `fdcc1f02-fc51-4226-8753-f668596af7f7` |
| Scope key | `workIqDefault` |
| Helper | `getWorkIqTokenForUser()` |

Two failure modes look identical from the outside and are worth separating:

- **401** — the token carried the wrong audience. Nothing is wrong with consent;
  re-check the scope key.
- **403** — either admin consent for `WorkIQAgent.Ask` has not been granted, **or
  it has and Copilot Credits billing is not enabled for the tenant.** Work IQ is
  metered on usage-based billing, so a correctly consented tenant with no billing
  configured still gets 403. `workIqFailureMessage()` in `src/lib/workIq.ts`
  surfaces both possibilities to the operator rather than guessing.

Because Work IQ would be an eleventh external API, its consent lives only in
`scripts/consent-manifest.json` as a standalone `oauth2PermissionGrant`. Apply it
with `pnpm run bootstrap:consent`, and re-run `pnpm run verify:consent` after any
app-registration change — pressing "Grant admin consent" in the Entra portal
rebuilds grants from `requiredResourceAccess` and silently deletes this one.

> **Correction.** An earlier revision of this document claimed these three
> "cannot be consented" and that the 29 BAP call sites had to be repointed at
> Power Platform API. That was wrong. It inferred "no resource service principal"
> (true) from a Graph `servicePrincipalNames` filter, then assumed that meant "no
> token" (false). Always confirm by requesting an actual token before declaring a
> resource unreachable.

`getSharePointTokenForUser` is wired up by
`src/lib/sharepointRest.ts`, which backs
`GET /api/sharepoint-sites/{siteId}/security` (the per-site permission and
oversharing view). It needs **`AllSites.FullControl`** delegated on the
**Office 365 SharePoint Online** resource (`00000003-0000-0ff1-ce00-000000000000`),
admin-consented.

`AllSites.Read` is *not* sufficient: reading `_api/web/roleassignments` requires
full control, mirroring Graph's own requirement that
`GET /sites/{id}/permissions` use `Sites.FullControl.All`
([docs](https://learn.microsoft.com/graph/api/site-list-permissions)). The
signed-in user must additionally have access to the site — the delegated token
never grants more than the user already has.

The `/admins` and `/manage` routes for the same site-details panel go through
`getDelegatedGraphClient()` (Microsoft Graph OBO, not the SharePoint REST
service) and hit `GET|POST|DELETE /sites/{id}/permissions` and
`PATCH /sites/{id}` (`lockState`, `archive`, `restore`, `delete`) respectively.
Both need the Graph-side **`Sites.FullControl.All`** delegated scope — a
separate grant from the SharePoint REST one above, on a different resource
(Microsoft Graph, not Office 365 SharePoint Online).

Both scopes are declared in `scripts/consent-manifest.json` but are not yet
granted in this tenant. Until an admin runs `pnpm run bootstrap:consent` (after
`az login` as a Global Administrator or Privileged Role Administrator) to create
the `oauth2PermissionGrant`s, all three routes return `403` with an explanatory
message rather than an empty, falsely reassuring report.

### Azure AI Foundry (`ai.azure.com`) is not consentable

`https://ai.azure.com` behaves differently from the three resources above: it is
not merely unconsented, it appears to publish **no delegated scope at all** that a
third-party app registration can request. Refresh-token and OBO exchanges for
`https://ai.azure.com/.default` therefore fail with:

```
AADSTS65001: The user or administrator has not consented to use the application
with ID '…' named 'Portal360-Graph'. Send an interactive authorization request
for this user and resource.
```

There is nothing to consent to, so this cannot be fixed in the Azure portal.
Microsoft's documented authorization model for the Foundry data plane is Azure
RBAC on the Foundry account (`Foundry User`, `Azure AI User`, `Azure AI
Developer`), applied to whichever principal holds the token — not
app-registration API permissions. Every official sample uses
`DefaultAzureCredential` / managed identity, i.e. the app's own identity, and no
Microsoft source documents an On-Behalf-Of pattern for this audience.

**What this means for the portal:**

| Route family | Audience | Status |
| --- | --- | --- |
| `/openai/deployments/**`, `/openai/responses?api-version=…` | `cognitiveservices.azure.com` | ✅ Works — consented, delegated |
| `/openai/v1/**` | `ai.azure.com`, falls back to `cognitiveservices.azure.com` | ⚠️ Fallback is unverified upstream |
| `/api/projects/**` (Foundry Agents / `assistants`) | `ai.azure.com` only | ❌ Blocked — no delegated path |

`getAzureAiToken(url)` in `src/lib/graphClient.ts` encodes this table. It picks
the audience from the **route**, not the hostname, because a Foundry
(`*.services.ai.azure.com`) account serves both API families on the same host.
Choosing on hostname alone is what sent classic Azure OpenAI calls to the Foundry
audience and produced the AADSTS65001 above.

`/api/azure/ai-foundry/agents` is the one surface with no delegated path. It
returns `401 { error: 'reauth_required', reason: 'consent_required' }` rather
than silently escalating to app-only. If that surface has to ship, the options
are: (a) declare it a sanctioned app-only job in
[`APP-ONLY-JOBS.md`](./APP-ONLY-JOBS.md) and assign the portal's service
principal the `Foundry User` role, or (b) drop it. Do **not** add a silent
app-only fallback inside the delegated helper.

### Do not repoint BAP to Power Platform API

Power Platform API (`api.powerplatform.com`) is **not** a drop-in replacement for
the legacy BAP surface. Microsoft is explicit that parity is a future goal, not a
current state:

> "More namespaces will be added over time, **until full parity is reached** in
> Power Platform API for what an administrator can perform in Power Platform
> admin center."
> — [Power Platform API reference](https://learn.microsoft.com/rest/api/power-platform/)

Probed live with a delegated token:

| Endpoint | Result |
| --- | --- |
| `GET /environmentmanagement/environments` | `200` |
| `GET /licensing/billingPolicies` | `200` |
| `GET /governance/v1/policies` (DLP) | `404` |
| `GET /environmentmanagement/tenantsettings` | `404` |

The BAP surfaces this app depends on that have no Power Platform API equivalent
today include DLP policies (`PowerPlatform.Governance/v1/policies`), connector
policy configurations, tenant settings, admin connector policies, environment
features, and `addAppUser`.

Guidance:

- **Keep BAP** for DLP, tenant settings, connector policies, and `addAppUser`.
  Delegated is [verified working](#runtime-verification-signed-in-end-to-end)
  there and is governed by the user's Power Platform Administrator role.
- **Prefer Power Platform API for new work**, and for environments and licensing
  where it already has coverage. It is
  [delegated-only by design](https://learn.microsoft.com/power-platform/admin/programmability-authentication-v2)
  ("Power Platform API uses delegated permissions only at this time"), which
  matches this codebase's delegated-first policy exactly.
- Revisit periodically; as namespaces land, individual call sites can migrate
  one at a time. This does not need to be — and should not be — a single sweep.


### Runtime verification (signed-in, end-to-end)

Every claim above was confirmed against a real interactive session — `pnpm dev`
on `http://localhost:3000`, browser sign-in through the `azure-ad` provider,
then each route called with the session cookie. Not inferred from token
requests; actually exercised.

The delegated token the app hands to Graph:

```json
{ "idtyp": "user", "aud": "https://graph.microsoft.com", "scopeCount": 48, "roleCount": 0 }
```

`idtyp: user` plus `roleCount: 0` is the proof — the call carries the signed-in
user's identity and **zero** application roles.

| Route | Resource | Result |
| --- | --- | --- |
| `/api/intune/settings-catalog` | Graph (beta, DCv2) | `200` — 19 policies |
| `/api/exchange/mailboxes` | Graph | `200` |
| `/api/power-platform/dlp-policies` | BAP | `200` |
| `/api/power-platform/environments` | BAP | `200` |
| `/api/power-platform/tenant-settings` | BAP | `200` |
| `/api/power-platform/licensing/billing-policies` | Power Platform API | `200` |
| `/api/azure/subscriptions` | ARM | `200` |
| `/api/application-insights-instances` | ARM / App Insights | `200` |

`/api/intune/settings-catalog` is the route whose app-only `403` started this
migration (*"Application is not authorized to perform this operation. Application
must have one of the following scopes: DeviceManagementConfiguration.Read.All…"*).
It now returns `200` under delegated auth.

Two things this run also established:

- **Pruning `requiredResourceAccess` to 10 resources broke nothing.** Interactive
  sign-in and all of the above still work, because `.default` resolves against
  the `oauth2PermissionGrant`, not the manifest.
- **The token store is in-memory.** Restarting the dev server invalidates every
  session — `/api/auth/session` returns `null` and routes return `401` until the
  user signs in again. Expected in development; production needs a shared store.

> `/api/defender-atp` is out of scope for this policy. It authenticates with a
> **separate** app registration via `DEFENDER_ATP_CLIENT_ID` /
> `DEFENDER_ATP_CLIENT_SECRET`, not the portal's own client, so it is unaffected
> by the portal's consent state.

Reproducing it: sign in, then from the browser console —

```js
await (await fetch('/api/power-platform/dlp-policies', { credentials: 'same-origin' })).status
```

Note that `GET /api/auth/signin/azure-ad` is **not** a valid entry point in
Auth.js v5 — it throws `UnknownAction` and redirects to
`/api/auth/error?error=Configuration`. Use `/api/auth/signin` and click through.

### The manifest can only ever list 10 of the 14 resources

`az ad app permission add` and raw Graph `PATCH` against `Portal360-Graph` both
fail with:

> `The size of the object has exceeded its limit. Please reduce the number of values and retry your request.`

**The error message is misleading — this is not a size problem.** The app object
is only ~26 KB and every documented collection limit has enormous headroom. The
real constraint is a resource-count cap that Microsoft documents under
[Validation differences by supported account types](https://learn.microsoft.com/entra/identity-platform/supported-accounts-validation):

> API permissions (`requiredResourceAccess`): No more than 50 total APIs
> (resource apps), **with no more than 10 APIs from other tenants.** No more than
> 400 permissions total across all APIs.

Every resource this app talks to is a Microsoft first-party API, which means
every one of them is "from another tenant" and counts against the limit of 10.
The cap is identical for all four `signInAudience` values, so changing the app to
single-tenant does not help, and Microsoft states plainly that
[the limit cannot be raised](https://learn.microsoft.com/entra/identity-platform/troubleshoot-required-resource-access-limits).

This was verified empirically against the live app registration:

| Payload | Result |
| --- | --- |
| 1 resource × 58 permissions | accepted |
| 9 resources × 1 permission | accepted |
| 10 resources × 1 permission | accepted |
| **11 resources × 1 permission** | **`Directory_ResourceSizeExceeded`** |
| 11 resources × 78 permissions | `Directory_ResourceSizeExceeded` |

Permission *count* is irrelevant. Resource count is the whole story.

The portal needs delegated consent on **15** resources and can list **10**. That
gap is not closable, which is why `scripts/bootstrap-consent.mjs` exists.

One of those 15 could never have been listed anyway. **Power Virtual Agents**
(`96ff4394-9197-43aa-b393-6a41652e21f8`), the audience the Copilot Studio
botmanagement / App Insights endpoint demands, publishes an **empty
`oauth2PermissionScopes` collection** on its service principal. It does not
appear under *APIs my organization uses*, so there is no manifest entry and no
consent checkbox to click — the `oauth2PermissionGrant` has to be written
directly. The scope is real regardless: a token minted by a pre-authorized
first-party client such as the Azure CLI carries `scp: user_impersonation` for
that audience, and Entra accepts a grant naming it. See
[`docs/power-platform-api-permissions.md`](power-platform-api-permissions.md#power-virtual-agents).

#### What is in the manifest, and what is script-only

Five resources were dropped from `requiredResourceAccess` to make room for the
Exchange / Defender / Cognitive Services / Log Analytics / Application Insights
entries added during the delegated migration:

| Dropped from manifest | Why it was safe to drop |
| --- | --- |
| Azure SQL Database | Registered but never consented, and no call site uses it. |
| Microsoft MCP Server for Enterprise | ~40 scopes, requested only as `.default`. |
| Power BI Service | 15 scopes, requested only as `.default`. |
| Power Platform API | ~69 scopes, requested only as `.default`. |
| Azure Machine Learning Services | Single scope, requested only as `.default`. |

**Removing a resource from the manifest *does* revoke its consent.** This was the
opposite of what an earlier revision of this document claimed. After the five
resources above were dropped, `pnpm run verify:consent` reported four of them
(Azure ML, MCP Server, Power BI, Power Platform API — 124 scopes in total) as
`missing`; their `oauth2PermissionGrant` objects had been deleted. Entra
cascades the removal, on a delay long enough that an immediate re-check still
showed all 16 grants intact — which is exactly what made the earlier conclusion
look correct.

Recovering is a single command, and this is precisely why the script exists:

```bash
pnpm run bootstrap:consent
```

So dropping a resource from the manifest is still safe, but only because consent
is version-controlled and reproducible. **Always re-run `pnpm run verify:consent`
after editing `requiredResourceAccess`, and do not trust an immediate check —
give it a few minutes.**

Dropping them is only possible because nothing requests them by named scope —
all five resolve through `<resource>/.default` in `src/lib/auth/scopeMap.ts`, and
`.default` is evaluated against the *grant*, not the manifest. **If you ever add
a named-scope request for one of these resources, put it back in the manifest or
consent it explicitly first.**

Four entries removed along the way were fabricated placeholder GUIDs with
obviously synthetic hex patterns — never real permission IDs, and they would
never have resolved during consent:
`a3b7c9d1-e2f4-5678-9abc-def012345678`, `b4c8d2e3-f5a6-6789-0bcd-ef1234567890`
(Microsoft MCP Server for Enterprise), `0f3e9c7a-8c41-4d5e-9e2b-7a6d2f4b1c93`,
`a8f3c9e7-2b4d-4f1a-9c6e-8d5f7a9b3c2e` (Power Platform API).

### Consent is version-controlled: `scripts/bootstrap-consent.mjs`

Because a third of the required resources can never appear in the manifest, the
Entra portal's **Grant admin consent** button cannot stand up a working tenant on
its own. `scripts/consent-manifest.json` is the source of truth instead: it
records all 15 resources and their 200 delegated scopes, keyed by resource
`appId` (not tenant-specific service principal object IDs) so it is portable.

```bash
pnpm run verify:consent    # read-only drift report; non-zero exit on drift
pnpm run bootstrap:consent # create missing grants, add missing scopes
```

Run `az login` first as a Privileged Role Administrator or Global Administrator;
the script borrows the CLI's identity and never reads a secret. It resolves the
client from `AZURE_CLIENT_ID` (override with `--client-id`).

Behavior worth knowing:

- It only manages `consentType: AllPrincipals` grants. Per-user (`Principal`)
  consents are ignored, not deleted.
- It is additive by default. Scopes present in the tenant but absent from the
  manifest are reported as drift and **left alone** — revoking consent is
  destructive and usually breaks a route nobody remembered. Pass `--prune`
  alongside `--apply` to force an exact match.
- It never touches `requiredResourceAccess`.

One live drift is currently reported and is intentional: Microsoft Graph has
three `extra` delegated scopes — **`AiEnterpriseInteraction.Read`**,
**`LifecycleWorkflows.Read.All`**, and **`Mail.Send`** — consented in the
tenant but present in neither `consent-manifest.json` nor any call site. They
are left in place because revoking consent is destructive; `pnpm run
verify:consent` therefore exits non-zero until they are either revoked
(`pnpm run bootstrap:consent -- --prune`) or added to the manifest. Revoking is
the least-privilege choice if nothing is planned for them.

> `SecurityIncident.Read.All` was moved out of this list and into the manifest
> once `src/app/api/security/defender-dashboard/route.ts` gave it a real call
> site (`GET /security/incidents`). Re-run `pnpm run verify:consent` after
> pulling this change — if it still reports the scope missing from the tenant
> grant, the earlier "extra" drift was never actually reconciled and an admin
> needs to run `pnpm run bootstrap:consent --apply`.

Every other resource is in sync as of the last reconcile. If a check reports a
resource as `missing` rather than `extra`, its grant was cascaded away by an edit
to `requiredResourceAccess` — run `pnpm run bootstrap:consent` and re-verify
after a few minutes.

The tradeoff to accept: **the manifest is no longer a complete description of
what this app needs.** Treat `scripts/consent-manifest.json` as the real
inventory, and re-run `pnpm run verify:consent` after any change to
`src/lib/auth/scopeMap.ts`.

### ⚠️ Do not remove the Power Platform API consent grant

**This has broken production twice** (once around 2026-08-05, again on
2026-08-12 18:50 UTC) by the same mechanism: the tenant-wide
`oauth2PermissionGrant` (`consentType: AllPrincipals`) between
`Portal360-Graph` and **Power Platform API**
(`8578e004-a5c6-46e7-913e-12f58912df43`, aka `api.powerplatform.com`) was
deleted — via a manual edit in the Entra admin center, or an interrupted
`bootstrap-consent.mjs` reconciliation run that removed the grant but never
completed re-adding it — and never restored.

**Impact when this happens:** every delegated token request for
`https://api.powerplatform.com/.default` fails instantly with `AADSTS65001`
(consent_required), for **every signed-in user simultaneously**, because
`.default` resolves against this tenant-level grant, not the app
registration's `requiredResourceAccess` list (see
[Consent is version-controlled](#consent-is-version-controlled-scriptsbootstrap-consentmjs)
above). Symptom: the Environments page and Inventory page both return 401s
tenant-wide, while Graph/BAP/ARM-backed pages keep working fine because they
use separate, unaffected grants.

**Rules going forward:**
- Never revoke or "clean up" this grant from the Entra admin center
  (**Enterprise applications → Portal360-Graph → Permissions**). If a scope
  genuinely needs to be removed, do it by editing
  `scripts/consent-manifest.json` and running
  `pnpm run bootstrap:consent -- --prune`, not by hand in the portal.
- If you run `pnpm run bootstrap:consent --apply` and it gets interrupted
  (Ctrl+C, terminal closed, network drop) partway through a resource's
  reconcile, **re-run it to completion** — do not assume a partial run left
  the grant intact.
- If Power Platform pages suddenly 401 tenant-wide with no code change,
  check this first:
  ```bash
  pnpm run verify:consent
  ```
  If it reports `Power Platform API [drift]` with all scopes `missing`, the
  grant was deleted. Fix with `pnpm run bootstrap:consent --apply` (requires
  `az login` as a Privileged Role Administrator or Global Administrator).

## Blockers to know about before migrating

### `unstable_cache` cannot read cookies or headers

Delegated token acquisition reads the session cookie. Next.js forbids that
inside `unstable_cache`, so a naive swap throws:

> ``Route ... used `headers()` inside a function cached with `unstable_cache()` ``

The fix is always the same: **acquire the delegated client outside the cache
and pass it in**. `resolveServiceHealthClient()` in
`src/lib/health/getServiceHealth.ts` is the working example, and
`src/app/api/home/exec-kpis/route.ts` shows the same hoist applied to five
`cache10min` callbacks.

> **Today this is latent, not live.** `src/lib/cache.ts` is currently a
> pass-through no-op (see its header comment for why), so delegated acquisition
> inside a cache callback works. It will break the moment caching is re-enabled,
> so hoist anyway.

### Per-user prerequisites that app-only silently bypassed

| Delegated scope | Extra requirement on the signed-in user |
| --- | --- |
| `DeviceManagement*.Read.All` | An Intune RBAC role (e.g. Intune Administrator) |
| `IdentityRiskyUser.Read.All` | Entra ID **P2** license |
| `AuditLogsQuery.Read.All` | Purview audit search entitlement |
| Exchange endpoints | An Exchange admin role |
| ARM (`management.azure.com`) | Azure RBAC on the subscription / resource |
| Power Platform / BAP | Power Platform Administrator or environment admin |
| Dataverse | A Dataverse security role in the target org |
| AI Foundry data plane | Azure AI User / Azure AI Developer on the Foundry account |
| Purview Compliance Manager | A Purview / Compliance admin role |

Plan for help-desk-tier admins to see partial data where app-only previously
returned everything. That is the intended least-privilege outcome, not a bug —
surface it as a permission gap rather than falling back to app-only.

## Runtime permission-gap tracker

When a delegated call returns 401/403 with an authorization error code,
`recordPermissionGap()` (`src/lib/permissionGaps.ts`) writes an entry to
`App_Data/permission-gaps.json` naming the exact missing scope.

```bash
# Sign in as an admin, then:
curl -b cookies.txt https://<host>/api/admin/permission-gaps | jq
curl -X DELETE https://<host>/api/admin/permission-gaps   # reset
```

Each entry looks like:

```jsonc
{
  "key": "service-health:GET /admin/serviceAnnouncement/healthOverviews",
  "source": "service-health",
  "endpoint": "GET /admin/serviceAnnouncement/healthOverviews",
  "delegatedPermission": "ServiceHealth.Read.All (delegated)",
  "previousAppPermission": "ServiceHealth.Read.All (application)",
  "fallbackUsed": true,
  "status": 403,
  "errorCode": "Authorization_RequestDenied",
  "message": "Insufficient privileges to complete the operation.",
  "count": 7,
  "firstSeen": "2026-06-02T12:34:56.000Z",
  "lastSeen":  "2026-06-02T15:01:18.000Z"
}
```

### After granting a missing delegated scope

1. Grant the scope in the app registration and admin-consent it.
2. Sign the user out and back in so the new scope lands on the next token.
3. Clear the tracker: `curl -X DELETE https://<host>/api/admin/permission-gaps`.
4. Reload the page — the source should populate without recording a new gap.

## Removing an application permission

Only after `pnpm run verify:graph-app-perms` reports the permission as
`RETIRABLE`:

```bash
# Inspect first
az ad app show --id <client-id> --query "requiredResourceAccess"

# Remove the app role, then re-consent
az ad app permission delete --id <client-id> \
  --api 00000003-0000-0000-c000-000000000000 --api-permissions <role-guid>
az ad app permission admin-consent --id <client-id>
```

Removing an app role does **not** revoke an already-issued client-credentials
token. Wait out the token TTL (or restart the app) before declaring success,
and watch `App_Data/permission-gaps.json` for fallout.
