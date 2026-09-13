# Power Platform BAP Admin API Setup

The endpoints at `https://api.bap.microsoft.com` are the **legacy Power Platform admin REST surface** (sometimes informally called the "BAP" API after the `Microsoft.BusinessAppPlatform` resource provider segment in the URLs). Microsoft Learn now refers to it under the [Power Platform admin programmability — legacy](https://learn.microsoft.com/en-us/power-platform/admin/programmability-authentication) docs.

This is **not** the same thing as the newer, RBAC-based [Power Platform API](https://learn.microsoft.com/en-us/power-platform/admin/programmability-authentication-v2) at `https://api.powerplatform.com` (application ID `8578e004-a5c6-46e7-913e-12f58912df43`). The two APIs require different audiences and a different setup; see [Power Platform API vs. BAP admin API](#power-platform-api-vs-bap-admin-api) below.

## API details

| Property | Value |
| --- | --- |
| Base URL | `https://api.bap.microsoft.com` |
| Delegated token audience | `https://service.powerapps.com` |
| Delegated scope | `https://service.powerapps.com/.default` |
| App-only scope | `https://api.bap.microsoft.com/.default` |
| Resource provider segment | `Microsoft.BusinessAppPlatform` |
| API version (this repo) | `2021-04-01` |

There is **no app-registration entry called "Business Application Platform"** in the Azure portal's *APIs my organization uses* picker. For delegated access, add the **PowerApps Service** API (`475226c6-020e-4fb2-8a90-7a972cbfc1d4`) and its **User** permission (`0eb56b90-a7b5-43b5-9402-8137a8083e90`). Microsoft-owned Power Platform clients use that resource when calling the legacy BAP host. Access also requires the signed-in user's Power Platform admin role. App-only access uses the BAP resource directly and requires registering the service principal as a Power Platform admin management app. See [Authentication](#authentication) below.

## Endpoints called from this repo

| Repo route | BAP endpoint | Auth helper |
| --- | --- | --- |
| `GET /api/power-platform/tenant-settings` ([route](../src/app/api/power-platform/tenant-settings/route.ts)) | `POST https://api.bap.microsoft.com/providers/Microsoft.BusinessAppPlatform/listtenantsettings?api-version=2021-04-01` | `getBapTokenForUser()` in [graphClient.ts](../src/lib/graphClient.ts) (delegated / OBO) |
| Inventory reports download ([route](../src/app/api/power-platform/inventory-reports/[reportId]/route.ts)) | Various `…/scopes/admin/environments/{id}` BAP URLs | `getBAPClientCredentialsToken()` in [powerPlatformAuth.ts](../src/lib/powerPlatformAuth.ts) |
| Copilot Studio agents listing ([route](../src/app/api/power-platform/copilot-studio/agents/route.ts)) | BAP environment lookups | `getBAPClientCredentialsToken()` in [powerPlatformAuth.ts](../src/lib/powerPlatformAuth.ts) |
| Copilot Studio App Insights helpers ([lib](../src/lib/copilotStudioAppInsights.ts)) | `…/environments/{id}` and `…/scopes/admin/environments/{id}` | Shares the cached BAP token |

Microsoft reference for `listtenantsettings`: <https://learn.microsoft.com/en-us/power-platform/admin/list-tenantsettings>.

## Authentication

**Delegated is the required flow.** `getBapTokenForUser()` acquires a PowerApps
Service token for the signed-in user (refresh-token flow, OBO fallback) and
sends it to the BAP endpoint, so BAP evaluates the caller's own Power Platform
admin role. The signed-in user must hold **Power
Platform Administrator** (or Global Administrator) or BAP returns 403.

The app-only flow below is documented for reference and for the
`getBAPClientCredentialsToken()` helper that some inventory-report routes still
share; do not introduce new app-only BAP call sites.

### App-only (service principal / client credentials) — reference only

Used by `getBAPClientCredentialsToken()`. Token request:

```
POST https://login.microsoftonline.com/{tenant-id}/oauth2/v2.0/token
Content-Type: application/x-www-form-urlencoded

client_id={AZURE_CLIENT_ID}
&client_secret={AZURE_CLIENT_SECRET}
&scope=https://api.bap.microsoft.com/.default
&grant_type=client_credentials
```

BAP rejects app-only tokens until the service principal is **registered as a Power Platform admin management application**. There are two equivalent ways to do that:

- **PowerShell** (Power Platform admin module):

   ```powershell
   Install-Module -Name Microsoft.PowerApps.Administration.PowerShell -Scope CurrentUser
   Add-PowerAppsAccount
   New-PowerAppManagementApp -ApplicationId <AZURE_CLIENT_ID>
   ```

- **REST** (must be called by a user who is already a Power Platform / Dynamics 365 admin, using a delegated token for `https://api.bap.microsoft.com/`):

   ```http
   PUT https://api.bap.microsoft.com/providers/Microsoft.BusinessAppPlatform/adminApplications/{AZURE_CLIENT_ID}?api-version=2021-04-01
   Authorization: Bearer <delegated BAP token>
   ```

Microsoft reference: [Use service principal with Power Platform APIs](https://learn.microsoft.com/en-us/power-platform/admin/powerplatform-api-create-service-principal).

You do **not** add any "BAP" permission in the App Registration's *API permissions* blade for this flow — none is exposed.

### Delegated (On-Behalf-Of)

`getBAPDelegatedToken()` in [ppToken.ts](../src/lib/ppToken.ts) exchanges the signed-in user's NextAuth access/ID/refresh token for a PowerApps Service token via OBO. The signed-in user must hold one of:

- Power Platform Administrator
- Dynamics 365 Administrator
- Global Administrator

The Entra ID app registration must have the PowerApps Service **User** delegated permission with tenant admin consent. The repository manages this grant in `scripts/consent-manifest.json`.

## Required environment variables

For app-only routes:

| Variable | Purpose |
| --- | --- |
| `AZURE_TENANT_ID` | Entra ID tenant for the token endpoint |
| `AZURE_CLIENT_ID` | App registration also registered via `New-PowerAppManagementApp` |
| `AZURE_CLIENT_SECRET` | Secret for that app registration |

Delegated routes additionally rely on the standard NextAuth/Entra ID variables from [quick-start.md](quick-start.md).

## Debugging tokens

Set `DEBUG_TOKENS=true` in `.env.local` to log token audience, issuer and scopes (server logs only). A delegated token must show:

- `aud` = `https://service.powerapps.com`
- `scp` = `User`
- `iss` = `https://login.microsoftonline.com/{tenant-id}/v2.0`
- For app-only tokens, `roles` will be empty and there is no `scp` claim — that's expected; admin-management-app registration is what authorizes the call.

## Troubleshooting

### `AADSTS500011` — resource principal not found (app-only)
The app-only token audience is wrong, or the service principal for `https://api.bap.microsoft.com` isn't materialized in the tenant. Confirm the app-only scope is exactly `https://api.bap.microsoft.com/.default`.

### `AADSTS65001` — admin consent required (delegated only)
The Portal360 app lacks admin consent for the PowerApps Service **User** delegated permission. Reconcile `scripts/consent-manifest.json`, then sign out and sign back in.

### `403 Forbidden` from BAP
- **App-only:** the service principal isn't registered as an admin management app. Re-run `New-PowerAppManagementApp` or the `adminApplications` PUT and retry. Propagation can take a few minutes.
- **Delegated:** the signed-in user doesn't hold a Power Platform / Dynamics 365 / Global admin role. Assign one in the Microsoft 365 admin center and wait for propagation.

### `401 Unauthorized` from BAP
Usually an audience mismatch. Delegated calls must use a PowerApps Service token (`aud=https://service.powerapps.com`); app-only calls use a BAP token (`aud=https://api.bap.microsoft.com`).

### "All token acquisition methods failed" (delegated)
The user's NextAuth session has expired or the refresh token is no longer valid. Sign out, sign back in, and retry. Also verify `AZURE_TENANT_ID`, `AZURE_CLIENT_ID` and `AZURE_CLIENT_SECRET` are present.

## Power Platform API vs. BAP admin API

The two APIs are easy to confuse — they're both "Power Platform" admin APIs, but they're separate services:

| | BAP admin API (this doc) | Power Platform API |
| --- | --- | --- |
| Host | `api.bap.microsoft.com` | `api.powerplatform.com` |
| Application ID | `475226c6-020e-4fb2-8a90-7a972cbfc1d4` (PowerApps Service, delegated) | `8578e004-a5c6-46e7-913e-12f58912df43` |
| Scope | `https://service.powerapps.com/.default` (delegated); `https://api.bap.microsoft.com/.default` (app-only) | `https://api.powerplatform.com/.default` (plus namespaced delegated scopes like `AppManagement.ApplicationPackages.Read`) |
| App-only setup | `New-PowerAppManagementApp` / `adminApplications` PUT | Assign an [RBAC role](https://learn.microsoft.com/en-us/power-platform/admin/programmability-tutorial-rbac-role-assignment) to the service principal |
| Delegated setup | Add PowerApps Service **User** permission and grant admin consent; tenant admin role on the signed-in user | Add the permission in the Azure portal (*APIs my organization uses* → *Power Platform API*) |
| Docs | [legacy programmability](https://learn.microsoft.com/en-us/power-platform/admin/programmability-authentication) | [programmability v2](https://learn.microsoft.com/en-us/power-platform/admin/programmability-authentication-v2) |
| Helpers in this repo | `getBapTokenForUser()` *(delegated, use this)*, `getBAPClientCredentialsToken()`, `getBAPDelegatedToken()` | `getPowerPlatformTokenForUser()` *(delegated, use this)*, `getPowerPlatformClientCredentialsToken()` and the `getPowerPlatform…` helpers in [ppToken.ts](../src/lib/ppToken.ts) |

If you tried to "Add a permission → APIs my organization uses → Business Application Platform" in the Azure portal and didn't find anything, that's expected. Select **PowerApps Service** (`475226c6-020e-4fb2-8a90-7a972cbfc1d4`) for delegated BAP calls. The GUID `8578e004-a5c6-46e7-913e-12f58912df43` is the newer Power Platform API, not BAP.

## Additional resources

- [Power Platform admin programmability — legacy](https://learn.microsoft.com/en-us/power-platform/admin/programmability-authentication)
- [Power Platform admin programmability — v2](https://learn.microsoft.com/en-us/power-platform/admin/programmability-authentication-v2)
- [Use service principal with Power Platform APIs](https://learn.microsoft.com/en-us/power-platform/admin/powerplatform-api-create-service-principal)
- [`listtenantsettings`](https://learn.microsoft.com/en-us/power-platform/admin/list-tenantsettings)
- [On-Behalf-Of flow](https://learn.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-on-behalf-of-flow)
