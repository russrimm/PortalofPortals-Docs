# Power Platform API Permissions Setup

This document describes how to configure the required API permissions for Power Platform features in Portal 360°.

## Official Documentation

**Microsoft Learn Reference**: [Authenticate to Power Platform services](https://learn.microsoft.com/en-us/power-platform/admin/security/authenticate-services)

This comprehensive guide covers:
- Power Platform service authentication patterns
- OAuth 2.0 authorization flows
- Required API permissions and admin roles
- Token acquisition strategies (OBO, refresh token, client credentials)
- Security considerations and best practices

## Overview

Power Platform APIs require specific delegated permissions to be granted to your Azure AD application registration. Without these permissions, some **Environment Management** capabilities will fail with consent errors.

## Required API Permissions

| API | Application ID | Delegated permission | Resource URI |
|-----|----------------|----------------------|--------------|
| PowerApps Service | `475226c6-020e-4fb2-8a90-7a972cbfc1d4` | `user_impersonation` | `https://service.powerapps.com/` |
| Power Platform API | `8578e004-a5c6-46e7-913e-12f58912df43` | Granular, per namespace (see below) | `https://api.powerplatform.com` |
| Power Virtual Agents | `96ff4394-9197-43aa-b393-6a41652e21f8` | `user_impersonation` | `api://96ff4394-9197-43aa-b393-6a41652e21f8` |

> The legacy BAP host `https://api.bap.microsoft.com` is **not** a separately
> consentable resource for custom clients. It accepts PowerApps Service tokens,
> which is why `scopeMap.bapDefault` maps to `https://service.powerapps.com/.default`.

### PowerApps Service

The PowerApps Service resource backs the PowerApps management endpoints (`https://api.powerapps.com/providers/Microsoft.PowerApps/...`) and is used for:
- Environment **connectors** list (`/api/power-platform/connectors`)
- Environment apps and cloud flows detail pages
- Anything acquiring a token via `getPowerAppsServiceDelegatedToken` in [`src/lib/ppToken.ts`](../src/lib/ppToken.ts)

**API Details:**
- **API Name**: PowerApps Service (this is the exact display name shown in the *APIs my organization uses* picker)
- **Application ID**: `475226c6-020e-4fb2-8a90-7a972cbfc1d4`
- **Resource URI**: `https://service.powerapps.com/`
- **Required Permission**: `user_impersonation` (Delegated) — add all listed **User** delegated permissions
- **Requested scope**: `https://service.powerapps.com/.default`

> Several first-party applications have similar display names. Always match on the GUID `475226c6-020e-4fb2-8a90-7a972cbfc1d4`.

### Power Platform API

The Power Platform API (`https://api.powerplatform.com`) backs most of the
Power Platform surface in this app, including environments, inventory,
licensing, flows, Copilot Studio, connectivity, and governance. Anything
acquiring a token via `getPowerPlatformDelegatedToken` in
[`src/lib/ppToken.ts`](../src/lib/ppToken.ts) depends on it.

**API Details:**
- **API Name**: Power Platform API (match on the GUID — several first-party apps have similar names)
- **Application ID**: `8578e004-a5c6-46e7-913e-12f58912df43`
- **Resource URI**: `https://api.powerplatform.com`
- **Requested scope**: `https://api.powerplatform.com/.default`

> This resource does **not** expose `user_impersonation`. It exposes granular
> scopes grouped by [namespace](https://learn.microsoft.com/en-us/rest/api/power-platform),
> such as `ResourceQuery.Resources.Read`. `.default` resolves to the delegated
> permissions already consented for the resource, so **at least one** scope must
> be consented or every call fails with `AADSTS65001`.

Namespaces this app calls, and the scopes each needs:

| URL namespace | Required delegated scopes |
|---------------|---------------------------|
| `/resourcequery` | `ResourceQuery.Resources.Read` |
| `/environmentmanagement` | `EnvironmentManagement.Environments.Read`, `EnvironmentManagement.Settings.Read`, `EnvironmentManagement.Settings.ReadWrite`, `EnvironmentManagement.Groups.Read`, `EnvironmentManagement.Groups.ReadWrite` |
| `/licensing` | `Licensing.Allocations.Read`, `Licensing.Allocations.ReadWrite`, `Licensing.BillingPolicies.Read`, `Licensing.BillingPolicies.ReadWrite`, `Licensing.IsvContracts.Read` |
| `/appmanagement` | `AppManagement.ApplicationPackages.Read`, `AppManagement.ApplicationPackages.Install` |
| `/analytics` | `Analytics.AdvisorRecommendations.Read`, `Analytics.AdvisorActions.Execute` |
| `/powerautomate` | `PowerAutomate.Flows.Read`, `PowerAutomate.Flows.Write` |
| `/powerapps` | `PowerApps.Apps.Read`, `PowerApps.Apps.Manage` |
| `/powerpages` | `PowerPages.Websites.Read`, `PowerPages.Websites.Write` |
| `/copilotstudio` | `CopilotStudio.AdminActions.Invoke`, `CopilotStudio.MakerOperations.Read`, `CopilotStudio.MakerOperations.ReadWrite`, `CopilotStudio.MakerOperations.Delete` |
| `/connectivity` | `Connectivity.Connections.Read`, `Connectivity.Connections.Write`, `Connectivity.Connectors.Read` |
| `/governance` | `Governance.CrossTenantConnectionReports.Read`, `Governance.CrossTenantConnectionReports.ReadWrite`, `CopilotGovernance.Settings.Read`, `CopilotGovernance.Settings.Write`, `CopilotGovernance.Features.Read` |
| `/usermanagement` | `Authorization.RoleAssignments.Read`, `Authorization.RoleAssignments.Write` |

### Power Virtual Agents

Copilot Studio's **botmanagement** API is the odd one out. It is hosted on the
environment's regional Power Virtual Agents runtime endpoint (for example
`https://<region>.api.powerplatform.com/api/botmanagement/2022-01-15/...`), but
it is *registered under the Power Virtual Agents app*, not under
`https://api.powerplatform.com`. Sending an `api.powerplatform.com` token returns
`AADSTS500131` (audience mismatch), so the App Insights configuration endpoint
needs its own resource and its own consent.

**API Details:**
- **API Name**: Power Virtual Agents
- **Application ID**: `96ff4394-9197-43aa-b393-6a41652e21f8`
- **Resource URI**: `api://96ff4394-9197-43aa-b393-6a41652e21f8`
- **Required Permission**: `user_impersonation` (Delegated)
- **Requested scope**: `96ff4394-9197-43aa-b393-6a41652e21f8/.default`
- **Acquired by**: `getPvaDelegatedToken` in [`src/lib/ppToken.ts`](../src/lib/ppToken.ts),
  wrapped by `getCopilotStudioPvaToken` in [`src/lib/copilotStudioAppInsights.ts`](../src/lib/copilotStudioAppInsights.ts)
- **Used by**: `/api/power-platform/copilot-studio/agents/[botId]/appinsights` (GET and PUT)

This is the same app ID the Microsoft Terraform provider uses for the identical
endpoint (`constants.COPILOT_SCOPE` in
[`terraform-provider-power-platform`](https://github.com/microsoft/terraform-provider-power-platform/blob/main/internal/services/copilot_studio_application_insights/api_copilot_studio_application_insights.go)).

> **This permission cannot be added from the Azure portal.** The Power Virtual
> Agents service principal publishes an **empty `oauth2PermissionScopes`
> collection**, so it never appears under *APIs my organization uses* and there
> is no checkbox to tick. The scope is real — a token minted by a pre-authorized
> first-party client such as the Azure CLI carries `scp: user_impersonation` for
> this audience — it is simply not discoverable. The grant has to be written
> directly as an `oauth2PermissionGrant`, which is exactly what
> `scripts/consent-manifest.json` plus `pnpm run bootstrap:consent` do. See
> [Method 1b](#method-1b-when-the-app-registration-is-full).

Requests also require the `x-cci-tenantid` header, because the regional Copilot
Studio gateway routes by tenant. The regional host itself comes from the BAP
environment's `properties.runtimeEndpoints["microsoft.PowerVirtualAgents"]` — if
BAP returns the generic host instead, the caller lacks the Power Platform
Administrator role and the request will fail before the token is ever used.

## Setup Instructions

### Method 1: Azure Portal (Recommended)

1. **Navigate to App Registration**
   - Go to [Azure Portal](https://portal.azure.com)
   - Navigate to **Azure Active Directory** > **App registrations**
   - Select your app registration (e.g., "Portal360-AdminPortal")

2. **Add API Permission**
   - Click **API permissions** in the left menu
   - Click **Add a permission**
   - Click **APIs my organization uses** tab
   - Search by Application ID and repeat for each API in the table above:
     - **PowerApps Service** — `475226c6-020e-4fb2-8a90-7a972cbfc1d4`
     - **Power Platform API** — `8578e004-a5c6-46e7-913e-12f58912df43`
   - Click on the result

3. **Select Permission Type**
   - Click **Delegated permissions**
   - For PowerApps Service, check **user_impersonation**
   - For Power Platform API, check the scopes listed in the namespace table above
   - Click **Add permissions**

4. **Grant Admin Consent**
   - Back on the API permissions page, click **Grant admin consent for [Your Tenant]**
   - Click **Yes** to confirm
   - Wait for the green checkmark to appear in the "Status" column

5. **Verify**
   - You should see the permission listed as:
     - **API**: Power Platform API
     - **Permission**: the scopes you selected
     - **Type**: Delegated
     - **Status**: ✅ Granted for [Your Tenant]

### Method 1b: When the app registration is full

Adding permissions in the portal or via `az ad app update` can fail with:

```
Directory_ResourceSizeExceeded: The size of the object has exceeded its limit.
Please reduce the number of values and retry your request.
```

The message is misleading. The binding constraint is **not** byte size and not
the total permission count — it is the number of *distinct resource APIs* in
`requiredResourceAccess`. Entra allows [**no more than 10 APIs from other
tenants**](https://learn.microsoft.com/entra/identity-platform/supported-accounts-validation)
(every Microsoft first-party API counts, because its service principal lives in
a Microsoft tenant). The cap is identical for every `signInAudience`, so
switching the app between single- and multi-tenant does not raise it.

Portal 360 sits at exactly 10/10:

| Resource API | Entries |
| --- | --- |
| Power Platform API | 68 |
| Microsoft Graph | 64 |
| Microsoft Flow Service | 9 |
| Dataverse | 2 |
| Microsoft Threat Protection | 2 |
| PowerApps Service | 1 |
| Windows Azure Service Management API | 1 |
| Office 365 Exchange Online | 1 |
| Microsoft Cognitive Services | 1 |
| Log Analytics API | 1 |

> ✅ **The Power Platform API now occupies a real slot.** It was previously an
> undeclared standalone consent grant, which is why it kept being deleted. The
> slot was freed by dropping **Application Insights API** and querying App
> Insights through Azure Monitor Logs instead — see *Permanent fix* below. The
> Power Platform API grant is therefore no longer fragile.
>
> Still undeclared, and still fragile: **Power BI Service**, **Microsoft MCP
> Server for Enterprise**, **Azure Machine Learning Services**, and **Power
> Virtual Agents** (which can never be declared — its service principal
> publishes no `oauth2PermissionScopes`). The automated checks below cover them.

Adding an 11th resource is rejected regardless of how few scopes it carries.
Deleting individual permissions does not help; only removing an entire resource
API frees a slot.

**How to confirm you are hitting the API cap rather than a real size limit:**
retry the PATCH with a single scope for the new API. If it still fails, the
constraint is the API count.

**Workaround (delegated permissions only).** `/.default` resolves against the
*consent grant* (`oauth2PermissionGrants`), not against `requiredResourceAccess`
— the latter only drives the portal's "requested permissions" list and the
consent prompt. So consent can be granted directly even when the registration
is full:

```powershell
$clientSpId = (az ad sp show --id <YOUR_CLIENT_ID> --query id -o tsv)
$ppSpId     = (az ad sp show --id 8578e004-a5c6-46e7-913e-12f58912df43 --query id -o tsv)
$scopes     = 'ResourceQuery.Resources.Read EnvironmentManagement.Environments.Read'  # etc.

$body = @{
  clientId    = $clientSpId
  consentType = 'AllPrincipals'
  resourceId  = $ppSpId
  scope       = $scopes
} | ConvertTo-Json -Compress
Set-Content -Path "$env:TEMP\grant.json" -Value $body -Encoding utf8 -NoNewline

az rest --method POST `
  --uri 'https://graph.microsoft.com/v1.0/oauth2PermissionGrants' `
  --headers 'Content-Type=application/json' --body "@$env:TEMP\grant.json"
```

> ⚠️ **This grant is fragile.** Because the scopes are not in
> `requiredResourceAccess` they do not appear on the portal's **API
> permissions** blade, and anything that rebuilds consent from the registration
> will silently delete them. That includes `az ad app permission admin-consent`,
> the portal's **Grant admin consent** button, and — observed in practice —
> PATCHing `requiredResourceAccess` itself. **Re-verify the grant after any
> change to the app registration:**
>
> ```powershell
> az rest --method GET --uri "https://graph.microsoft.com/v1.0/servicePrincipals/$clientSpId/oauth2PermissionGrants" `
>   --query "value[?resourceId=='$ppSpId'].{consent:consentType,scope:scope}" -o json
> ```

**This is now checked automatically** — you should not be relying on memory:

| Where | Command | Behavior |
| --- | --- | --- |
| Pre-push hook | `pnpm run verify:consent:strict` | Blocks the push when a needed scope is missing. Skips silently without `az`; set `SKIP_CONSENT_CHECK=1` to opt out. |
| Scheduled CI | `.github/workflows/verify-consent.yml` | Daily. Opens/updates an issue labeled `consent-drift`, closes it on recovery. |
| Least-privilege audit | `pnpm run verify:consent` | Also reports *extra* scopes the tenant holds beyond the manifest. |

`--missing-only` (used by the gates) fails only on scopes the app needs but the
tenant lacks. Extra scopes are reported but do not fail, because a gate that is
red for a benign reason gets ignored — which is precisely how the earlier
deletions went unnoticed.

**Permanent fix — done.** A slot was freed by dropping the **Application Insights
API** (`f5c26e74-f226-4ae8-85f0-b4af0080ac9e`) and querying Application Insights
through **Azure Monitor Logs** instead, which authenticates against the **Log
Analytics API** entry the app already holds. The Power Platform API now occupies
the freed slot as a normal declared resource.

Implementation: `src/lib/appInsightsQuery.ts`, used by
`src/app/api/application-insights-{query,metrics,scan}` and
`src/app/api/power-platform/copilot-studio/**`.

```
POST https://api.loganalytics.azure.com/v1/<armResourceId>/query
Authorization: Bearer <token for https://api.loganalytics.io>
Prefer: include-permissions=true

{ "query": "requests | limit 1", "timespan": "P7D" }
```

This is the path Microsoft documents and ships an SDK for
(`LogsQueryClient.queryResource` in `@azure/monitor-query-logs`; note the older
`@azure/monitor-query` package is deprecated). The response shape is identical to
the old Application Insights API — `tables[].columns[].name/type` plus `rows` —
so no response parsing changed.

Components are addressed by **ARM resource ID**, not by the Application ID GUID.
`resolveAppInsightsResourceFromAppId()` in `src/lib/copilotStudioAppInsights.ts`
maps one to the other through Azure Resource Graph, cached for 10 minutes.

> ⚠️ **Partial access is silent.** If the caller can read the component but not
> the Log Analytics workspace behind it, Azure Monitor returns **HTTP 200 with
> rows removed** rather than 403. Requests therefore send
> `Prefer: include-permissions=true`, and `AppInsightsAccessError` is raised when
> the response reports no readable data source. Queries run as the signed-in
> user, so operators need Reader (or Monitoring Reader) on **both** the component
> and its workspace.

<details>
<summary>Alternative: the ARM proxy (works, but not recommended)</summary>

`POST https://management.azure.com/<armResourceId>/api/query?api-version=2020-02-02`
also executes KQL, using an ordinary ARM token. It was verified working against a
live component, but it is **not** the recommended path: it appears on no Azure
Monitor query documentation page, no SDK exposes it, and it returns PascalCase
`Tables`/`Columns`/`ColumnName` rather than the data-plane shape.

If you do use it, note ARM exposes it as resource type `components/api` and
accepts only `2014-04-01`, `2014-08-01`, `2014-12-01-preview`, `2015-05-01`,
`2018-05-01-preview`, `2020-02-02-preview`, `2020-02-02`. The value `2018-04-20`
is correct for the *data-plane* API and is rejected here with
`NoRegisteredProviderFound`.

</details>

> 📌 **Observed:** PATCHing `requiredResourceAccess` to perform this swap did
> **not** delete the standalone grants — all 17 rows survived. The destructive
> operation appears to be *admin-consent* specifically (the portal button and
> `az ad app permission admin-consent`), not the PATCH itself. Re-verify with
> `pnpm run verify:consent:strict` after any registration change regardless.

Note that removing a permission from `requiredResourceAccess` does **not** revoke
it — `oauth2PermissionGrants` and `appRoleAssignments` persist independently.
Trimming the registration is therefore safe for runtime, but it also means
trimming alone does not reduce the app's effective privilege. The Application
Insights `Data.Read` grant was revoked explicitly as part of this change.


### Method 2: Admin Consent URL

You can also grant consent directly via URL:

```
https://login.microsoftonline.com/{TENANT_ID}/adminconsent?client_id={CLIENT_ID}
```

Replace:
- `{TENANT_ID}` with your Azure AD tenant ID
- `{CLIENT_ID}` with your application's client ID

**Example:**
```
https://login.microsoftonline.com/contoso.onmicrosoft.com/adminconsent?client_id=32c72b33-a331-4545-ad5a-6d2fdf961c4c
```

### Method 3: PowerShell / Azure CLI

This script **merges** the Power Platform API into the existing permissions.
Do not use `Update-MgApplication -RequiredResourceAccess` with a single entry —
that property is replaced wholesale and would delete every other API permission
on the registration.

```powershell
$AppObjectId = '<app registration object id>'
$PpApiAppId  = '8578e004-a5c6-46e7-913e-12f58912df43'

# Scopes to request — see the namespace table above
$WantedScopes = @(
  'ResourceQuery.Resources.Read'
  'EnvironmentManagement.Environments.Read'
  'Licensing.BillingPolicies.Read'
  # ...add the rest your features need
)

# Resolve scope value -> id
$byValue = @{}
az ad sp show --id $PpApiAppId --query 'oauth2PermissionScopes' -o json |
  ConvertFrom-Json | ForEach-Object { $byValue[$_.value] = $_.id }

# Merge, preserving every other resource
$merged = @()
az ad app show --id $AppObjectId --query 'requiredResourceAccess' -o json |
  ConvertFrom-Json |
  Where-Object { $_.resourceAppId -ne $PpApiAppId } |
  ForEach-Object {
    $merged += [pscustomobject]@{
      resourceAppId  = $_.resourceAppId
      resourceAccess = @($_.resourceAccess | ForEach-Object { [pscustomobject]@{ id = $_.id; type = $_.type } })
    }
  }
$merged += [pscustomobject]@{
  resourceAppId  = $PpApiAppId
  resourceAccess = @($WantedScopes | ForEach-Object { [pscustomobject]@{ id = $byValue[$_]; type = 'Scope' } })
}

$body = @{ requiredResourceAccess = $merged } | ConvertTo-Json -Depth 10 -Compress
Set-Content -Path "$env:TEMP\app-patch.json" -Value $body -Encoding utf8 -NoNewline

az rest --method PATCH `
  --uri "https://graph.microsoft.com/v1.0/applications/$AppObjectId" `
  --headers 'Content-Type=application/json' --body "@$env:TEMP\app-patch.json"
```

Then grant admin consent for the tenant:

```powershell
az ad app permission admin-consent --id <YOUR_CLIENT_ID>
```

> ⚠️ **Do not run this while any permission is consented via Method 1b only.**
> `admin-consent` rebuilds the tenant's grants from `requiredResourceAccess`, so
> any scope that exists only as a standalone `oauth2PermissionGrant` is deleted.
> Re-verify the grant afterwards using the query in Method 1b.

If the PATCH returns `Directory_ResourceSizeExceeded`, see **Method 1b** above —
the cause is usually the 10-resource-API cap, not the payload size.

## Troubleshooting

### Error: "User or administrator has not consented"

**Full Error:**
```
AADSTS65001: The user or administrator has not consented to use the application 
with ID 'YOUR_APP_ID' named 'YOUR_APP_NAME'. Send an interactive authorization 
request for this user and resource.
```

**Solution:**
1. Identify which resource failed from the requested scope in the log line:
   - `https://service.powerapps.com/.default` → **PowerApps Service** (`475226c6-020e-4fb2-8a90-7a972cbfc1d4`)
   - `https://api.powerplatform.com/.default` → **Power Platform API** (`8578e004-a5c6-46e7-913e-12f58912df43`)
   - `96ff4394-9197-43aa-b393-6a41652e21f8/.default` → **Power Virtual Agents** (see below — portal method does not work)
2. Follow the setup instructions above to add that API permission
3. Grant admin consent
4. Sign out and sign in again to get a fresh token with the new scopes

In the portal this surfaces as a **403 with `consentRequired: true`** and an inline error naming the application ID — not as a sign-out. If you are instead bounced to the home page, the failure is a genuinely lost session, not a consent gap.

#### Special case: Power Virtual Agents / Copilot Studio App Insights

Symptoms — the agent detail page shows **"Could not load App Insights
configuration"**, and the API returns:

```
PVA token: Admin consent required for the Power Virtual Agents API...
Errors: Access token OBO: invalid_grant ... AADSTS50013 ...;
Refresh token (after signature error): invalid_grant: AADSTS65001 ...
```

Read past the `AADSTS50013` line — it is [expected noise](#error-aadsts50013--assertion-failed-signature-validation).
The `AADSTS65001` on the refresh-token exchange is the real failure.

The Azure portal cannot fix this one: Power Virtual Agents exposes no delegated
scopes in its service principal, so it is not listed under *APIs my organization
uses*. Reconcile the grant from the manifest instead:

```bash
az login                              # as Privileged Role Administrator or Global Administrator
pnpm run verify:consent                # confirm "Power Virtual Agents" shows drift
pnpm run bootstrap:consent             # write the oauth2PermissionGrant
```

No sign-out is required afterwards. The existing refresh token can obtain a
token for a newly consented resource, so retrying the page is enough.

### Error: "AADSTS50013 — Assertion failed signature validation"

**Full Error:**
```
AADSTS50013: Assertion failed signature validation. [Reason - Key was found, but
use of the key to verify the signature failed. ... app Id
'00000000-0000-0000-0000-000000000000']
```

**This is expected and is not the failure.** `app Id 00000000-0000-0000-0000-000000000000`
is Microsoft Graph. Interactive sign-in requests only Graph scopes
(`PRIMARY_AUTH_SCOPE` in [`src/lib/auth.ts`](../src/lib/auth.ts)), so
`session.accessToken` has a Graph audience. An OBO assertion must be issued for
the calling app itself, so the OBO attempt in `getPowerPlatformDelegatedToken`
can never succeed and always falls through to the refresh-token exchange —
which is the supported multi-resource pattern for this app.

Read the error that follows it. If the refresh-token exchange also fails with
`AADSTS65001`, the consent gap above is the real problem.

### Error: "Invalid audience"

**Full Error:**
```
The received access token has been obtained from wrong audience or resource 
'https://api.powerplatform.com'. It should exactly match with one of the 
allowed audiences 'https://api.bap.microsoft.com/'
```

**Solution:**
This error indicates the wrong token function is being used. Ensure:

- Regular Power Platform operations use `getPowerPlatformDelegatedToken`
- Flow operations use `getPowerAutomateDelegatedToken`

### Permission not appearing in Azure Portal

If you can't find the API when searching:

1. Try searching by Application ID — `475226c6-020e-4fb2-8a90-7a972cbfc1d4` (PowerApps Service) or `8578e004-a5c6-46e7-913e-12f58912df43` (Power Platform API)
2. Ensure you're in the **"APIs my organization uses"** tab, not "Microsoft APIs"
3. Verify your tenant has Power Platform enabled
4. Provision the service principal once, then search again:
   ```powershell
   az login
   az ad sp create --id 475226c6-020e-4fb2-8a90-7a972cbfc1d4
   az ad sp create --id 8578e004-a5c6-46e7-913e-12f58912df43
   ```
5. Try the admin consent URL method instead

**Power Virtual Agents (`96ff4394-9197-43aa-b393-6a41652e21f8`) will never
appear**, no matter how you search. Its service principal publishes an empty
`oauth2PermissionScopes` collection, so the portal has nothing to render and the
admin consent URL has nothing to resolve `.default` against. Confirm with:

```powershell
az ad sp show --id 96ff4394-9197-43aa-b393-6a41652e21f8 --query "oauth2PermissionScopes[].value" -o json
# []
```

Use `pnpm run bootstrap:consent` for this resource — it writes the
`oauth2PermissionGrant` directly, which Entra accepts even though the scope is
not advertised.

### Consent granted but still failing

1. **Sign out completely** from the application
2. **Clear browser cookies/cache** (or use incognito mode)
3. **Sign in again** to get a fresh token with the new permissions
4. Check the token acquisition logs in the console for specific error messages

## Testing

After granting consent, test the following features:

1. **Power Platform Apps**
   - Navigate to: Power Platform → Environments → [Environment] → Apps
   - Should load without 401/403 errors
   - Should display Power Platform apps across the tenant

2. **Flow Runs**
   - Navigate to: Power Platform → Environments → [Environment] → Flows → [Flow]
   - Click "View Flow Runs"
   - Should display flow execution history

3. **Tenant Settings**
   - Navigate to: Power Platform → Tenant Settings
   - Should display tenant-wide Power Platform configuration

## References

- [Power Platform Admin API Overview](https://learn.microsoft.com/en-us/power-platform/admin/programmability-overview)
- [Authentication for Power Platform APIs](https://learn.microsoft.com/en-us/power-platform/admin/programmability-authentication-v2)
- [Azure AD Consent Framework](https://learn.microsoft.com/en-us/azure/active-directory/develop/application-consent-experience)
- [Microsoft Graph App Consent](https://learn.microsoft.com/en-us/graph/auth-v2-user)

## Support

If you continue to experience issues after following these steps:

1. Check the browser console for detailed error messages
2. Verify your user account has Power Platform admin roles
3. Ensure the app registration has the correct redirect URIs configured
4. Review the [API Documentation](./API-DOCUMENTATION.md) for additional setup requirements
