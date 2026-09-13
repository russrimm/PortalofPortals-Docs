# Portal 360° - Complete Installation Guide

This guide provides step-by-step instructions to install and configure Portal 360° in your Microsoft Entra ID tenant.

> Multi-tenant administration (a single portal instance switching between several customer tenants) is **not currently implemented** — it is tracked on the [portal roadmap](/tools/portal-roadmap). The instructions below assume a single-tenant deployment. For MSP-style operations today, run one Portal 360° instance per customer tenant.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Entra ID App Registration](#entra-id-app-registration)
- [Environment Configuration](#environment-configuration)
- [Installation Steps](#installation-steps)
- [Production Secrets Management](#production-secrets-management)
- [Power Platform Configuration](#power-platform-configuration)
- [Verification & Testing](#verification--testing)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before starting, ensure you have:

- **Node.js 22.22.3+, 24.15.0+, or 26+** (per the `engines.node` field in `package.json`) installed ([Download](https://nodejs.org/)). The dev server passes `--max-http-header-size=32768` and assumes modern Node features.
- **pnpm 10+** — install with `npm install -g pnpm@10.34.5`. This repo pins pnpm via the `packageManager` field.
- **Microsoft Entra ID tenant** with Global Administrator or Application Administrator rights to create the app registration and grant admin consent.
- **Azure Subscription** (optional, only required for the Azure resource, billing, advisor, and policy pages).
- **Git** installed ([Download](https://git-scm.com/)).
- **Visual Studio Code** (recommended) ([Download](https://code.visualstudio.com/)).

### Required Azure Permissions

- **Application Administrator** or **Global Administrator** to create app registrations
- **Privileged Role Administrator** to assign admin roles
- **User Administrator** to manage users and groups

---

## Entra ID App Registration

> **Automated option:** [`scripts/create-graph-app.sh`](../scripts/create-graph-app.sh) creates the app registration, service principal, redirect URI, and the full permission set below with a single command. Requires `az login` and `jq`. Steps 1–5 below describe the equivalent manual flow.

### Step 1: Create the App Registration

1. Navigate to [Azure Portal](https://portal.azure.com)
2. Go to **Microsoft Entra ID** → **App registrations**
3. Click **+ New registration**

**Configuration:**
- **Name**: `Portal 360 Admin Portal` (or your preferred name)
- **Supported account types**: 
  - For single tenant: **Accounts in this organizational directory only**
  - For MSP multi-tenant: **Accounts in any organizational directory (Any Microsoft Entra ID tenant - Multitenant)**
- **Redirect URI**: 
  - Platform: **Web**
  - URL: `http://localhost:3000/api/auth/callback/azure-ad` (for development)
  - For production: `https://your-domain.com/api/auth/callback/azure-ad`

4. Click **Register**

### Step 2: Note Your Application Details

After registration, note the following from the **Overview** page:
- **Application (client) ID**: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- **Directory (tenant) ID**: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

### Step 3: Create Client Secret

1. In your app registration, go to **Certificates & secrets**
2. Click **+ New client secret**
3. **Description**: `Portal 360 Production Secret`
4. **Expires**: Choose based on your security policy (recommended: 24 months)
5. Click **Add**
6. **IMPORTANT**: Copy the secret **Value** immediately (you cannot view it again)
   - Secret Value: `xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### Step 4: Configure API Permissions

Navigate to **API permissions** and add the following:

#### Microsoft Graph Delegated Permissions

Click **+ Add a permission** → **Microsoft Graph** → **Delegated permissions**. This is the complete least-privilege set derived from the codebase.

**Sign-in / core**
- `openid`, `profile`, `email`, `offline_access` — NextAuth sign-in and refresh tokens

**Users**
- `User.Read` — Initial interactive login
- `User.Read.All` — User lists, sign-in logs, KPIs, admin dashboards
- `User.ReadWrite.All` — User create / actions
- `User.Invite.All` — Guest invitations
- `Mail.Send` — Emailing report exports (for example the Secure Score PDF) from the signed-in admin's mailbox. Optional: without it every other feature still works, and the Secure Score email button returns a clear 403 telling you to consent it. The requesting account also needs an Exchange Online mailbox.

**Groups & Teams**
- `Group.Read.All` — Group and team listings
- `GroupMember.Read.All` — Group member expansion
- `Group.ReadWrite.All` — Team create / delete
- `TeamMember.ReadWrite.All` — Add members to Teams

**Directory & Applications**
- `Directory.Read.All` — Directory roles, organization, subscribed SKUs
- `Application.Read.All` — Applications listing
- `Application.ReadWrite.All` — Add / remove application passwords
- `RoleManagement.Read.Directory` — Role assignments and eligibility

**Audit & Reports**
- `AuditLog.Read.All` — Sign-in logs, directory audits, provisioning logs
- `AuditLogsQuery.Read.All` — Purview audit queries
- `Reports.Read.All` — Reports API

**Security & Policy**
- `Policy.Read.All` — Conditional Access, auth strength, cross-tenant policies
- `IdentityRiskyUser.Read.All` — Risky users
- `SecurityEvents.Read.All` — Alerts and secure scores
- `SecurityAlert.Read.All` — Defender alerts (needed to retire the matching application permission)
- `SecurityAlert.ReadWrite.All` — Defender alert triage writes (assign owner, set status/classification). The signed-in user must also hold **Security Operator** or **Security Administrator** in Entra ID; Graph rejects the write otherwise.

**Service Health & SharePoint**
- `ServiceHealth.Read.All` — Service health overviews / issues
- `ServiceMessage.Read.All` — Service announcements
- `Sites.Read.All` — SharePoint sites search
- `SharePointTenantSettings.Read.All` — Tenant SharePoint settings
- `SharePointTenantSettings.ReadWrite.All` — Tenant SharePoint settings updates (for example, the sync app file-extension block list)

**Intune / device management**
- `DeviceManagementManagedDevices.Read.All`
- `DeviceManagementManagedDevices.PrivilegedOperations.All` — Remote lock / wipe
- `DeviceManagementApps.Read.All`
- `DeviceManagementConfiguration.Read.All`
- `WindowsUpdates.Read.All` — Windows Update for Business deployment service catalog. Also needs the signed-in user to hold Intune Administrator, Windows Update Deployment Administrator, or Global Administrator

**Teams meetings & multi-tenant**
- `OnlineMeetings.Read` — Teams meeting insights
- `DelegatedAdminRelationship.Read.All` — Multi-tenant Lighthouse
- `CrossTenantInformation.ReadBasic.All` — Cross-tenant tenant lookup

**Note:** Least privilege. `ReadWrite` scopes are included only where the app performs writes (users, groups, applications, Intune privileged ops).

#### Microsoft Graph Application Permissions

> **Delegated-first.** Every Graph application permission the portal uses also
> exists as a delegated permission, and the codebase is actively migrating off
> app-only. Grant only what the list below calls **required**; the rest are
> legacy and are being deleted. See
> [`DELEGATED-PERMISSION-GAPS.md`](./DELEGATED-PERMISSION-GAPS.md) for the
> current inventory and `pnpm run verify:graph-app-perms` to regenerate it.

**Required** — only if you run the audit-log-ingest cron job
([`scripts/cron/audit-log-ingest.mjs`](../scripts/cron/audit-log-ingest.mjs)).
It runs on a schedule with no signed-in user, so it cannot use OBO.

Click **+ Add a permission** → **Microsoft Graph** → **Application permissions**

- `AuditLog.Read.All` — Cron audit-log ingest (`/auditLogs/directoryAudits`)
- `AuditLogsQuery.Read.All` — Cron Purview audit queries (`/security/auditLog/queries`)

If you do **not** run that cron job, no Graph application permission is required.

**Legacy / being retired** — grant these only if you are running an older
build that still has app-only routes. Each is superseded by the delegated
scope of the same name:

| Legacy application permission | Status |
| --- | --- |
| `ServiceMessage.Read.All` | No code uses it — safe to delete today |
| `Directory.Read.All` | Migrating to delegated |
| `Reports.Read.All` | Migrating to delegated |
| `ServiceHealth.Read.All` | Migrating to delegated |
| `SecurityEvents.Read.All` | Migrating to delegated |
| `SecurityAlert.Read.All` | Migrating to delegated |
| `IdentityRiskyUser.Read.All` | Migrating to delegated |
| `DeviceManagementManagedDevices.Read.All` | Migrating to delegated |

#### Azure Service Management (Required for Azure pages)

**Required for**: every Azure page in the portal — Cost Management (`/api/azure/daily-costs-comparison`, `/api/azure/forecasts`, `/api/azure/costs/*`, `/api/azure/billing/*`), Azure Advisor, Azure Policy (assignments & compliance), Resource Graph inventory (`/api/azure/resources`), Metrics, and subscription listings.

Click **+ Add a permission** → **APIs my organization uses** → search **Azure Service Management** → **Delegated permissions**.

- `user_impersonation` — Access Azure Service Management as the signed-in user (delegated ARM access via OBO)

**Why this is separate from Graph:** ARM (`https://management.azure.com`) is a different resource from Microsoft Graph. Without this permission the refresh-token exchange for the ARM scope fails with `AADSTS65001: The user or administrator has not consented…` and every Azure page returns 500 / 403 with `consentRequired: true`.

**No app-only ARM permission is required** — the portal always calls ARM in the user's context (RBAC on the subscription/resource still applies).

#### Power Platform (Required for Power Platform features)

Power Platform APIs live on **different resources** from Microsoft Graph, so each one needs its own delegated permission on the app registration. The portal exchanges the signed-in user's refresh token for a resource-scoped access token; without a consented delegated permission that exchange fails with `AADSTS65001` and the page returns 403 with `consentRequired: true`.

Click **+ Add a permission** → **APIs my organization uses** for each API below, select **Delegated permissions**, then **Grant admin consent**.

| API | Application ID | Delegated permission | Required for |
|-----|----------------|----------------------|--------------|
| **PowerApps Service** | `475226c6-020e-4fb2-8a90-7a972cbfc1d4` | `user_impersonation` (all `User` permissions) | Environment detail pages — **Connectors**, Cloud flows, Apps (`api.powerapps.com`, scope `https://service.powerapps.com/.default`) |
| **Power Platform API** | `8578e004-a5c6-46e7-913e-12f58912df43` | `PowerAutomate.Flows.Read` (add `.Write` to enable/disable flows) | Cloud flows page, BAP admin operations (`api.powerplatform.com`, `api.bap.microsoft.com`) |

> **Searching for PowerApps Service:** several first-party apps have similar names. Match on the GUID `475226c6-020e-4fb2-8a90-7a972cbfc1d4` — see [Microsoft Learn: Authentication (Power Platform programmability)](https://learn.microsoft.com/en-us/power-platform/admin/programmability-authentication-v2).

If an API doesn't appear under "APIs my organization uses", provision its service principal once:

```powershell
Connect-AzAccount -Tenant <TENANT_ID>
New-AzADServicePrincipal -ApplicationId 475226c6-020e-4fb2-8a90-7a972cbfc1d4
New-AzADServicePrincipal -ApplicationId 8578e004-a5c6-46e7-913e-12f58912df43
```

Beyond these permissions, users still need the appropriate Power Platform roles (Environment Admin, Power Platform Admin, etc.). A few tenant-wide reads (tenant capacity, tenant settings) use client credentials instead — see [`power-platform-api-permissions.md`](./power-platform-api-permissions.md).

#### Microsoft MCP Server for Enterprise (Optional - AI grounding for chat)

**Required for**: grounding the Portal 360° Assistant chat agent in live tenant data via Microsoft's hosted MCP endpoint (`https://mcp.svc.cloud.microsoft`). Enabled by `ENABLE_ENTERPRISE_MCP=true`. Without this, chat still works but cannot answer live-tenant questions like *"how many users are in my tenant"*, *"list my active security incidents"*, or *"what conditional access policies are in report-only mode?"* through the MCP path.

**Preview limitations** (Microsoft, as of 2026): delegated tokens only (no app-only), **global commercial cloud only** (not available in Gov, DoD, or China clouds), 100 requests/minute per user, read-only.

**Why this is not in the portal's "Add a permission" picker:** the MCP Server for Enterprise service principal (`e8c77dc2-69b3-43f4-bc51-3213c9d915b4`) is not present in a tenant by default. It must be provisioned via the `Microsoft.Entra.Beta` PowerShell module before its `MCP.*` scopes can be granted to any app registration. Attempting to add these scopes through the Entra portal will fail with **`Invalid scopes (not available on resource)`**.

**Automated setup** — from the repo root, run the companion script against your Portal 360° app registration:

```powershell
pwsh ./scripts/provision-enterprise-mcp.ps1 -ApplicationId <AZURE_CLIENT_ID>
```

The script (idempotent, safe to re-run):

1. Installs `Microsoft.Entra.Beta` and `Microsoft.Graph.Applications` PowerShell modules.
2. Signs you in with `Application.ReadWrite.All`, `Directory.Read.All`, `DelegatedPermissionGrant.ReadWrite.All`.
3. Provisions the MCP Server service principal in the tenant (`Grant-EntraBetaMCPServerPermission -ApplicationName VisualStudioCode`).
4. Grants a curated read-only scope set to your app: `MCP.User.Read.All`, `MCP.Group.Read.All`, `MCP.GroupMember.Read.All`, `MCP.Organization.Read.All`, `MCP.RoleManagement.Read.Directory`, `MCP.SecurityAlert.Read.All`, `MCP.SecurityIncident.Read.All`, `MCP.AuditLog.Read.All`, `MCP.Device.Read.All`, `MCP.Application.Read.All`, `MCP.Policy.Read.All`, `MCP.Policy.Read.ConditionalAccess`, `MCP.ServiceHealth.Read.All`, `MCP.Reports.Read.All`.
5. Prints the resulting OAuth2 permission grant for verification.

Discover which `MCP.*` scopes are available in your tenant before granting:

```powershell
pwsh ./scripts/provision-enterprise-mcp.ps1 -ApplicationId <AZURE_CLIENT_ID> -List
```

Grant a narrower subset (e.g., identity-only for a help-desk deployment):

```powershell
pwsh ./scripts/provision-enterprise-mcp.ps1 `
  -ApplicationId <AZURE_CLIENT_ID> `
  -Scopes "MCP.User.Read.All","MCP.Group.Read.All","MCP.GroupMember.Read.All"
```

**Required admin role:** Application Administrator or Cloud Application Administrator (needed for `Grant-EntraBetaMCPServerPermission` and the delegated-permission-grant write).

**Post-grant checklist:**

1. Set `ENABLE_ENTERPRISE_MCP=true` in `.env.local` (optionally override `ENTERPRISE_MCP_SCOPE` — defaults to `api://e8c77dc2-69b3-43f4-bc51-3213c9d915b4/.default`). See [ENVIRONMENT-VARIABLES.md § 14b](./ENVIRONMENT-VARIABLES.md#14b-microsoft-mcp-server-for-enterprise-optional).
2. Sign every user out and back in — new scopes only land in fresh refresh tokens.
3. Restart the app (`pnpm run dev` locally, or redeploy).
4. Verify from the chat widget: *"How many users are in my tenant?"* — the response should include an `mcp_call` step in the trace.

**Troubleshooting: `mcp_list_tools` appears in the logs but no `mcp_call` follows.**
That means the connection succeeded but the MCP server rejected our bearer token, so it advertised zero tools. Check, in order:

- **Token audience.** It must be `api://e8c77dc2-69b3-43f4-bc51-3213c9d915b4/.default`. The hostname form (`https://mcp.svc.cloud.microsoft/.default`) is *not* a valid audience and fails silently. Leave `ENTERPRISE_MCP_SCOPE` unset unless you have a reason to override it.
- **Tenant provisioning.** `Grant-EntraBetaMCPServerPermission` must have been run; the `MCP.*` scopes never appear in the Entra portal permission picker.
- **Stale refresh tokens.** Users who signed in before the grant hold refresh tokens without the `MCP.*` scopes. Sign out and back in.
- **Cloud.** Preview is global commercial cloud only.

Token acquisition failures (`AADSTS500011` = resource not provisioned in the tenant, `AADSTS65001` = user/admin consent missing) are logged by `src/lib/agent/enterpriseMcpToken.ts` along with the scope that was attempted.

**Manual PowerShell equivalent** (if you can't run the script):

```powershell
Install-Module Microsoft.Entra.Beta -Force -AllowClobber -Scope CurrentUser
Connect-Entra -Scopes 'Application.ReadWrite.All','Directory.Read.All','DelegatedPermissionGrant.ReadWrite.All'
Grant-EntraBetaMCPServerPermission -ApplicationName VisualStudioCode
Grant-EntraBetaMCPServerPermission -ApplicationId <AZURE_CLIENT_ID> -Scopes `
  "MCP.User.Read.All","MCP.Group.Read.All","MCP.GroupMember.Read.All", `
  "MCP.Organization.Read.All","MCP.RoleManagement.Read.Directory", `
  "MCP.SecurityAlert.Read.All","MCP.SecurityIncident.Read.All", `
  "MCP.AuditLog.Read.All","MCP.Device.Read.All","MCP.Application.Read.All", `
  "MCP.Policy.Read.All","MCP.Policy.Read.ConditionalAccess", `
  "MCP.ServiceHealth.Read.All","MCP.Reports.Read.All"
```

Reference: [Microsoft Learn — Get started with the Microsoft MCP Server for Enterprise](https://learn.microsoft.com/en-us/graph/mcp-server/get-started).

### Step 5: Grant Admin Consent

1. Click **✓ Grant admin consent for [Your Organization]**
2. Click **Yes** to confirm
3. Wait for green checkmarks to appear next to all permissions

### Step 6: Assign Application Insights RBAC

The portal queries Application Insights **resource-centrically through Azure
Monitor Logs** (`https://api.loganalytics.azure.com/v1/<armResourceId>/query`,
see [`src/lib/appInsightsQuery.ts`](../src/lib/appInsightsQuery.ts)). Queries run
**as the signed-in user** via delegated auth, so RBAC must be granted to the
administrators who use the portal — not to the app registration's service
principal. Without it, KQL queries and Copilot Studio telemetry pages fail with:

> You do not have permission to read this Application Insights resource. Queries run as the signed-in user…

> ⚠️ **Grant on the Log Analytics workspace too.** Because App Insights is
> workspace-backed, a caller with access to the component but not its workspace
> gets **HTTP 200 with rows silently removed**, not a 403. The portal detects
> this via `Prefer: include-permissions=true` and reports it as a permission
> error, but the fix is to grant on both.

**Scope requirement:** grant on **every Application Insights resource the portal should monitor**, not just the one in `APPLICATIONINSIGHTS_CONNECTION_STRING`. This includes:

- The portal's own telemetry AI resource (from `APPLICATIONINSIGHTS_CONNECTION_STRING`)
- **Every AI resource attached to a Copilot Studio agent** you want to view (`/power-platform/copilot-studio/[agentId]`). Each agent stores its own AI connection string.
- Any AI resource surfaced through `/api/application-insights-metrics`, `/api/application-insights-query`, or `/api/application-insights-scan`
- The Log Analytics workspace behind each of the above

**Pick a scope** (broader = less admin later):

| Scope | When to use | Example |
|-------|-------------|---------|
| Subscription | Portal reads AI across many RGs; simplest to maintain | `/subscriptions/<sub>` |
| Resource group | All AI resources live in one RG (e.g. dedicated `AppInsights` RG) | `/subscriptions/<sub>/resourceGroups/AppInsights` |
| Individual AI resource | Strict least-privilege; you must repeat for every agent's AI resource **and its workspace** | `/subscriptions/<sub>/resourceGroups/<rg>/providers/microsoft.insights/components/<name>` |

#### Roles to assign

1. **Monitoring Reader** (or **Reader**) — REQUIRED for resource-centric queries via `api.loganalytics.azure.com/v1/<armResourceId>/query`, on both the component and its Log Analytics workspace
2. **Monitoring Metrics Publisher** — required if `DisableLocalAuth=true` on the AI resource (Entra-ID-authenticated ingest); safe to add otherwise

#### Portal UI

1. Open the Application Insights resource (or the parent RG / subscription)
2. **Access control (IAM)** → **Add role assignment** → pick the role above
3. Assignee: the app registration's enterprise application / service principal (search by app name or paste the client ID)

#### CLI — single resource

```bash
AI_RESOURCE_ID=/subscriptions/<sub>/resourceGroups/<rg>/providers/microsoft.insights/components/<ai-name>
SP_OBJECT_ID=$(az ad sp show --id <app-client-id> --query id -o tsv)
for ROLE in "Monitoring Reader" "Monitoring Metrics Publisher"; do
  az role assignment create --assignee-object-id "$SP_OBJECT_ID" \
    --assignee-principal-type ServicePrincipal --role "$ROLE" --scope "$AI_RESOURCE_ID"
done
```

#### CLI — every Application Insights resource in a subscription (recommended for multi-agent Copilot Studio use)

```bash
CLIENT_ID=<app-client-id>
SUB_ID=<subscription-guid>

IDS=$(az resource list \
  --resource-type "Microsoft.Insights/components" \
  --subscription "$SUB_ID" \
  --query "[].id" -o tsv)

for ID in $IDS; do
  az role assignment create --assignee "$CLIENT_ID" \
    --role "Monitoring Reader" --scope "$ID"
done
```

Role assignments can take 1–5 minutes to propagate. RBAC is evaluated per query, so no dev server restart is needed once the assignment lands.

### Step 6a: Assign Azure OpenAI / AI Foundry RBAC to the Service Principal

**Required for the Portal 360° Assistant chat widget** (the floating chat bubble powered by `/api/chat`) and for the image generator on `/organizational-branding`.

The chat and image routes call Azure OpenAI / Azure AI Foundry **as the signed-in user** (see [`src/lib/graphClient.ts`](../src/lib/graphClient.ts) `getCognitiveServicesTokenForUser` and `getAIFoundryTokenForUser`). Each portal operator who uses the assistant therefore needs a **role assignment on the AI resource itself** — typically `Cognitive Services OpenAI User`. API permissions in the app registration are not sufficient, and neither is subscription-level `Reader`. Assign the role to a group and add your admins to it.

Without this role, the chat replies:

> Sorry, I encountered an error: AI service authentication failed. Check the Azure AI credentials.

and the server log shows:

> `Azure AI Foundry (Responses API) error: 401` (or `403`) with a body containing `PermissionDenied` / `InvalidAuthenticationToken`.

#### Which role to assign

Pick the role that matches the endpoint you configured in `AZURE_ENDPOINT`:

| `AZURE_ENDPOINT` looks like… | Resource type | Role to assign |
|---|---|---|
| `https://<name>.openai.azure.com` | Azure OpenAI | **Cognitive Services OpenAI User** |
| `https://<name>.cognitiveservices.azure.com` | Azure AI Services (multi-service) | **Cognitive Services OpenAI User** |
| `https://<name>.services.ai.azure.com` | Azure AI Foundry project | **Azure AI Developer** |

> The chat route picks the token audience automatically: endpoints containing `services.ai.azure.com` request an `https://ai.azure.com/.default` token; everything else requests `https://cognitiveservices.azure.com/.default`. Match the role to the endpoint or the AI resource will 401.

#### Portal UI

1. Open the Azure OpenAI / AI Foundry resource in the Azure portal
2. **Access control (IAM)** → **Add role assignment** → pick the role from the table above
3. Assignee: **User, group, or service principal** → search for the app registration by name (or paste the client ID) and select the enterprise application
4. Save

#### CLI — Azure OpenAI resource

```bash
CLIENT_ID=<your AZURE_CLIENT_ID>
RG=<resource-group>
AI_NAME=<openai-resource-name>

SP_OBJECT_ID=$(az ad sp show --id "$CLIENT_ID" --query id -o tsv)
AI_RESOURCE_ID=$(az cognitiveservices account show \
  --name "$AI_NAME" --resource-group "$RG" --query id -o tsv)

az role assignment create \
  --assignee-object-id "$SP_OBJECT_ID" \
  --assignee-principal-type ServicePrincipal \
  --role "Cognitive Services OpenAI User" \
  --scope "$AI_RESOURCE_ID"
```

#### CLI — AI Foundry project

```bash
CLIENT_ID=<your AZURE_CLIENT_ID>
RG=<resource-group>
FOUNDRY_NAME=<foundry-project-name>

SP_OBJECT_ID=$(az ad sp show --id "$CLIENT_ID" --query id -o tsv)
AI_RESOURCE_ID=$(az ml workspace show \
  --name "$FOUNDRY_NAME" --resource-group "$RG" --query id -o tsv)

az role assignment create \
  --assignee-object-id "$SP_OBJECT_ID" \
  --assignee-principal-type ServicePrincipal \
  --role "Azure AI Developer" \
  --scope "$AI_RESOURCE_ID"
```

Role assignments propagate in 1–5 minutes. Restart the dev server (or your App Service) after granting the role so the cached token is discarded.

### Step 6b: Assign Azure Subscription RBAC to Signed-in Users

The `user_impersonation` permission on Azure Service Management (Step 4) lets the portal *acquire* an ARM token on behalf of the signed-in user. Azure then evaluates that user's **subscription-scope RBAC** on every request. Without the right role you'll see errors like:

> `RBACAccessDenied — The client does not have authorization to perform action. Request ID: NoHttpContext`

Assign these roles on each subscription (or management group) that users of the portal should be able to read. All roles are **built-in, read-only**.

| Role | Required for | Portal features affected |
|------|--------------|--------------------------|
| **Reader** | Baseline — resources, resource groups, subscriptions | Inventory, Resource Graph, `/azure/resources`, `/azure/policy` compliance view, `/azure/deployment-stacks` |
| **Cost Management Reader** | Cost Management + Consumption APIs | `/azure/billing/*`, `/azure/cost-management`, `/api/azure/daily-costs-comparison`, `/api/azure/forecasts`, `/api/azure/carbon-estimate` |
| **Monitoring Reader** | Azure Monitor metrics + Log Analytics queries | `/azure/metrics`, `/azure/monitor`, `/azure/log-analytics`, `/azure/sentinel` |
| **Advisor Reader** *(or Reader)* | Azure Advisor recommendations | `/azure/advisor`, unified remediation workbench |
| **Resource Policy Contributor** *(read-only equivalent: Reader)* | Policy assignments & compliance | `/azure/policy` |

> `Reader` at subscription scope is sufficient for policy read and Advisor read; add `Cost Management Reader` and `Monitoring Reader` separately since they are not inherited from `Reader`.

#### Portal UI (subscription RBAC)

1. Open the subscription (or management group)
2. **Access control (IAM)** → **Add role assignment**
3. Pick the role, then assign to the user, group, or Entra ID group that contains your portal users
4. Repeat for each additional role

#### CLI — assign the standard portal read set to a user

```bash
USER_UPN=<user@yourtenant.com>
SUB_ID=<subscription-guid>

for ROLE in "Reader" "Cost Management Reader" "Monitoring Reader"; do
  az role assignment create \
    --assignee "$USER_UPN" \
    --role "$ROLE" \
    --scope "/subscriptions/$SUB_ID"
done
```

#### CLI — assign to an Entra ID group (recommended for teams)

```bash
GROUP_OBJECT_ID=$(az ad group show --group "Portal360-Users" --query id -o tsv)
SUB_ID=<subscription-guid>

for ROLE in "Reader" "Cost Management Reader" "Monitoring Reader"; do
  az role assignment create \
    --assignee-object-id "$GROUP_OBJECT_ID" \
    --assignee-principal-type Group \
    --role "$ROLE" \
    --scope "/subscriptions/$SUB_ID"
done
```

**Notes:**

- RBAC assignments propagate in 1–2 minutes; no re-sign-in is required (the token is unchanged — Azure re-evaluates permissions at call time).
- Assign at the **management group** scope if you have many subscriptions — the roles inherit down.
- Billing-account-scoped cost data (EA / MCA enrollment level) requires `Billing Reader` on the billing scope in addition to `Cost Management Reader` on the subscription.

---

## Environment Configuration

### Step 1: Clone the Repository

```bash
git clone https://github.com/russrimm/PortalofPortals.git
cd PortalofPortals
```

### Step 2: Install Dependencies

```bash
pnpm install
```

### Step 3: Create Environment File

Copy `.env.local.example` to `.env.local` in the project root and fill in the values that apply to your tenant:

```env
# NextAuth (required)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<openssl rand -base64 32> or <New-Guid in PowerShell>

# Microsoft Entra ID (required)
AZURE_TENANT_ID=<tenant-guid>
AZURE_CLIENT_ID=<app-id>
AZURE_CLIENT_SECRET=<client-secret>

# Azure subscription (optional, enables Azure resource/billing/policy pages)
AZURE_SUBSCRIPTION_ID=<subscription-guid>
```

> Portal 360° does not currently read tenants, feature toggles, or a list of Key Vault names from environment variables. The full set of supported variables — including Redis, Cosmos DB, Application Insights, Defender, ServiceNow, Azure DevOps, RBAC role lists, and demo mode — is documented in [`ENVIRONMENT-VARIABLES.md`](./ENVIRONMENT-VARIABLES.md). NextAuth v5 aliases (`AUTH_SECRET`, `AUTH_URL`, `AUTH_AZURE_AD_CLIENT_ID`/`SECRET`/`TENANT_ID`, and `AUTH_MICROSOFT_ENTRA_ID_ID`/`SECRET`) are also accepted in place of the `NEXTAUTH_*` and `AZURE_*` names.

### Step 4: Generate Secure Secret

Generate a secure secret for NextAuth:

**Windows (PowerShell):**
```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Mac/Linux:**
```bash
openssl rand -base64 32
```

Copy the output and set it as `NEXTAUTH_SECRET` in your `.env.local` file.

---

## Installation Steps

### Step 1: Run Development Server

```bash
pnpm run dev
```

The application will start on [http://localhost:3000](http://localhost:3000)

### Step 2: First-Time Login

1. Navigate to [http://localhost:3000](http://localhost:3000)
2. Click **Sign In** or navigate to any protected page
3. You will be redirected to Microsoft login
4. Sign in with your Azure AD credentials
5. **Consent** to the requested permissions
6. You will be redirected back to the portal

### Step 3: Verify Access

After logging in, verify you can access:
- **Dashboard** - Main navigation
- **Users** - Microsoft 365 users list
- **Groups** - Azure AD groups
- **Devices** - Intune-managed devices (if enabled)
- **Azure Resources** - Azure subscription resources (if subscription ID configured)
- **Power Platform** - Environments and flows (if Power Platform permissions granted)

---

## Production Secrets Management

Portal 360° reads all secrets from environment variables. To avoid storing those values in plain text, store them in Azure Key Vault and inject them into the hosting environment via Key Vault references — the application does **not** call Key Vault directly.

### Recommended pattern: Key Vault + App Service

1. Create a Key Vault with RBAC authorization:

   ```bash
   az keyvault create \
     --name portal360-secrets \
     --resource-group portal360-rg \
     --location eastus \
     --enable-rbac-authorization true
   ```

2. Store the required secrets:

   ```bash
   az keyvault secret set --vault-name portal360-secrets --name AzureClientSecret --value <client-secret>
   az keyvault secret set --vault-name portal360-secrets --name NextAuthSecret    --value "$(openssl rand -base64 32)"
   ```

3. Assign a managed identity to your App Service (or Container App):

   ```bash
   az webapp identity assign --name portal360 --resource-group portal360-rg
   PRINCIPAL_ID=$(az webapp identity show --name portal360 --resource-group portal360-rg --query principalId -o tsv)
   az role assignment create \
     --role "Key Vault Secrets User" \
     --assignee $PRINCIPAL_ID \
     --scope /subscriptions/<sub-id>/resourceGroups/portal360-rg/providers/Microsoft.KeyVault/vaults/portal360-secrets
   ```

4. Wire the app settings to Key Vault references — the value injected at runtime is the plain secret, and the application sees it as a normal `process.env` value:

   ```bash
   az webapp config appsettings set \
     --name portal360 \
     --resource-group portal360-rg \
     --settings \
       AZURE_CLIENT_SECRET='@Microsoft.KeyVault(SecretUri=https://portal360-secrets.vault.azure.net/secrets/AzureClientSecret)' \
       NEXTAUTH_SECRET='@Microsoft.KeyVault(SecretUri=https://portal360-secrets.vault.azure.net/secrets/NextAuthSecret)'
   ```

For Cosmos DB, Application Insights, and Azure Cache for Redis (also optional), prefer Microsoft Entra ID authentication via the same managed identity instead of connection strings or keys. See [`ENVIRONMENT-VARIABLES.md`](./ENVIRONMENT-VARIABLES.md) for the full variable list and [`redis-setup-guide.md`](./redis-setup-guide.md) for Entra-authenticated Redis.

---

## Power Platform Configuration

Power Platform pages (Environments, Apps, Flows, Copilot Studio, Dataverse) work as soon as the signed-in user has the required Power Platform / Dataverse roles. There is no `ENABLE_POWER_PLATFORM` feature flag — the application uses runtime tokens (OBO and client-credentials) for each upstream API.

For BAP admin operations (`api.bap.microsoft.com`) and Power Platform service operations (`api.powerplatform.com`), see [`power-platform-bap-api-setup.md`](./power-platform-bap-api-setup.md) and [`power-platform-api-permissions.md`](./power-platform-api-permissions.md). The signed-in user typically needs the **Power Platform Administrator** role and, for Dataverse, an **application user** with **System Administrator** in each environment.

### Required delegated permissions on Power Platform API

The **Cloud flows** page (`/power-platform/flows`) calls the Power Platform API (`api.powerplatform.com`) and requires the Power Platform API application to be added to your Entra app registration with a delegated permission:

1. Entra admin center → **App registrations** → your Portal 360° app → **API permissions** → **Add a permission**
2. **APIs my organization uses** tab → search for **Power Platform API** (App ID: `8578e004-a5c6-46e7-913e-12f58912df43`)
3. **Delegated permissions** → check **`PowerAutomate.Flows.Read`** (add `PowerAutomate.Flows.Write` if you want the app to edit/enable/disable flows later)
4. Add the permission, then click **Grant admin consent for &lt;tenant&gt;**

If the Power Platform API doesn't appear under "APIs my organization uses", provision the service principal in your tenant once:

```powershell
Connect-AzAccount -Tenant <TENANT_ID>
New-AzADServicePrincipal -ApplicationId 8578e004-a5c6-46e7-913e-12f58912df43
```

Then repeat the "Add a permission" flow. Without this permission, the flows page returns a 401/500 with a `helpText` field pointing at this section.

### Register service principal as Power Platform admin management app

App-only calls to `api.bap.microsoft.com` (tenant settings, environment discovery, DLP policies, Copilot Studio agents listing) require the service principal to be registered as a Power Platform admin management application. Without this, BAP returns `HTTP 403` and every downstream call receives an empty environment list.

Run once per tenant, signed in as a Power Platform / Global Admin:

```powershell
Install-Module -Name Microsoft.PowerApps.Administration.PowerShell -Scope CurrentUser
Add-PowerAppsAccount
New-PowerAppManagementApp -ApplicationId <AZURE_CLIENT_ID>
```

The Entra "Power Platform Administrator" directory role on a user is **not** a substitute for this — it enables delegated (OBO) admin calls only. REST alternative and troubleshooting: [`power-platform-bap-api-setup.md`](./power-platform-bap-api-setup.md#authentication).

### Export & deploy solutions

From **Power Platform → Environments**, the **Solutions** modal exposes:

- Export a solution as **managed** or **unmanaged**.
- Deploy a managed solution to another environment that the signed-in user can administer.

The export and deploy actions both run server-side using OBO tokens against the source and target environments. There is no separate HTTP-trigger configuration step — the upstream Dataverse import API is called directly.

### Create Dataverse application user

For automated flows that run as a service principal, the portal includes **Power Platform → Create Application User** (`/power-platform/create-app-user`):

1. Pick the target Power Platform environment.
2. Enter the Application (Client) ID of the Microsoft Entra service principal to add.
3. Submit — the application creates the user and assigns the **System Administrator** security role.

This creates a non-interactive application user that can run flows and access Dataverse.

### Bulk-register the service principal across every environment

The in-portal **Create Application User** page above works one environment at a time. For a fresh install (or after adding a new environment), Portal 360° also ships a PowerShell script that iterates every environment in the tenant and registers the same Entra app registration as an **Application User** with the **System Administrator** role in each one.

This is required for any Dataverse-backed feature that runs across multiple environments — Desktop Flows, cloud flows, Copilot Studio agents, solution operations, and Dataverse queries — because the Dataverse OBO / S2S token only succeeds where the calling app registration exists as an application user. Symptoms of skipping this step include `AADSTS50013` signature-validation errors, `AADSTS65001` consent errors on downstream Dataverse calls, and empty result sets on `/api/power-platform/dataverse/*` routes.

Script: [`scripts/add-sp-to-all-environments.ps1`](../scripts/add-sp-to-all-environments.ps1).

Prerequisites:

- [Power Platform CLI (`pac`)](https://aka.ms/PowerPlatformCLI) installed and on `PATH`
- Signed in as a **Power Platform Administrator** in the CLI: `pac auth create --deviceCode`

Preview which environments would be updated (no changes made):

```powershell
./scripts/add-sp-to-all-environments.ps1 `
    -ApplicationId <AZURE_CLIENT_ID> `
    -WhatIf
```

Register the app in every environment with the default `System Administrator` role:

```powershell
./scripts/add-sp-to-all-environments.ps1 `
    -ApplicationId <AZURE_CLIENT_ID>
```

Register with a different Dataverse security role (any role name valid in each environment):

```powershell
./scripts/add-sp-to-all-environments.ps1 `
    -ApplicationId <AZURE_CLIENT_ID> `
    -Role "System Customizer"
```

Under the covers the script runs, per environment:

```powershell
pac admin assign-user `
    --environment <envId> `
    --user <AZURE_CLIENT_ID> `
    --role "System Administrator" `
    --application-user
```

The script prints a summary of environments that were newly registered, environments where the application user already existed (skipped), and any failures. Failures typically mean the signed-in `pac` account is not an admin on that specific environment — grant admin access and re-run; environments that already succeeded are safely skipped.

---

## Verification & Testing

### Test Basic Functionality

1. **Authentication**: Sign in and verify token refresh
2. **Users Page**: View Microsoft 365 users
3. **Groups Page**: View and search Azure AD groups
4. **Devices Page**: View Intune-managed devices
5. **Azure Resources**: Query Azure resources with KQL
6. **Power Platform**: View environments and flows

### Test Multi-Tenant (MSP)

Not supported in the current release. Run one Portal 360° instance per customer tenant instead.

### Test Solution Export

1. Navigate to Power Platform → Environments
2. Select an environment with solutions
3. Open the Solutions modal and export a test solution
4. Deploy the resulting managed solution to another environment
5. Verify the import appears in the target environment

---

## Troubleshooting

### Common Issues

#### 1. "Not authenticated" or 401 errors

**Cause**: Missing or expired Microsoft Entra ID credentials

**Solution:**
- Verify `.env.local` has correct `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID` (or the `AUTH_*` aliases).
- Check that the client secret hasn't expired.
- Sign out and sign in again.

#### 2. Portal 360° Assistant chat: "AI service authentication failed. Check the Azure AI credentials."

**Cause**: The `AZURE_CLIENT_ID` service principal is missing a role on the Azure OpenAI / AI Foundry resource, the wrong role was assigned for the endpoint type, or `AZURE_CLIENT_SECRET` has expired.

**Solution:**
- Tail the server log while reproducing — look for `Azure AI Foundry (Responses API) error: <status> <body>`. The body distinguishes a role problem (`PermissionDenied`, `InvalidAuthenticationToken`) from a credential problem (`AADSTS7000215`, `invalid_client`).
- Assign the correct role on the AI resource — see [Step 6a](#step-6a-assign-azure-openai--ai-foundry-rbac-to-the-service-principal). Match the role to the endpoint type:
  - `*.openai.azure.com` / `*.cognitiveservices.azure.com` → **Cognitive Services OpenAI User**
  - `*.services.ai.azure.com` → **Azure AI Developer**
- If the log shows an `AADSTS` code, rotate `AZURE_CLIENT_SECRET`.
- Wait 1–5 minutes for role propagation, then restart the app so the cached token is discarded.

#### 3. "Power Platform API returned 500"

**Cause**: Missing Power Platform admin role on the signed-in user, or the user has never signed in to `make.powerautomate.com` / `admin.powerplatform.microsoft.com`.

**Solution:**
- Assign the **Power Platform Administrator** role to the signed-in user.
- Have the user sign into <https://admin.powerplatform.microsoft.com> at least once so the upstream service provisions them.
- Sign out of Portal 360° and sign in again to refresh the cached token.

#### 4. "Failed to acquire Power Platform token"

**Cause**: Token audience mismatch or missing `offline_access` consent.

**Solution:**
- Verify `offline_access` is granted as a delegated permission and admin consent is recorded.
- Inspect `src/lib/ppToken.ts` to confirm the scope used (`https://api.bap.microsoft.com/.default`, `https://api.powerplatform.com/.default`, etc.).
- Confirm `auth.ts` only requests `openid profile email offline_access User.Read` at initial sign-in — upstream scopes are acquired on-demand via OBO.

#### 5. Multi-tenant consent not working

Not supported in the current release — Portal 360° is single-tenant. Register the app as single-tenant and run one instance per customer tenant.

#### 6. Azure Key Vault access denied (production)

**Cause**: The hosting environment's managed identity doesn't have access to Key Vault.

**Solution:**
- Verify the role assignment: `Key Vault Secrets User` on the vault scope.
- Confirm the managed identity is enabled on the App Service / Container App.
- Wait 5–10 minutes for role assignment propagation.

#### 7. `RBACAccessDenied` on Azure cost / metrics / policy pages

**Symptom** (in the dev-server console):

```
Cost Management API 401: {"error":{"code":"RBACAccessDenied","message":"The client does not have authorization to perform action. Request ID: NoHttpContext"}}
```

**Cause**: The signed-in user is authenticated (token is valid) but has no Azure subscription RBAC role. The `user_impersonation` API permission is not the same as a subscription role.

**Solution:** Assign the appropriate subscription-scope role — see [Step 6b: Assign Azure Subscription RBAC to Signed-in Users](#step-6b-assign-azure-subscription-rbac-to-signed-in-users). At minimum:

- **Cost Management Reader** for `/azure/billing/*`, `/api/azure/daily-costs-comparison`, `/api/azure/forecasts`, `/api/azure/carbon-estimate`
- **Reader** for `/azure/resources`, policy, deployment stacks
- **Monitoring Reader** for `/azure/metrics`, `/azure/monitor`, Log Analytics

Wait 1–2 minutes for propagation, then reload the page. No re-sign-in required.

#### 7. `AADSTS65001: The user or administrator has not consented…`

**Cause**: The app registration is missing a delegated API permission that the portal is trying to exchange the refresh token for (e.g. Azure Service Management `user_impersonation`, or a Graph scope the user has never consented to).

**Solution:**
- Identify the failing resource from the requested scope in the server log, then confirm its delegated permission is present **and** admin-consented:

  | Requested scope | Add this API | Application ID |
  |-----------------|--------------|----------------|
  | `https://management.azure.com/.default` | Azure Service Management | (search by name) |
  | `https://service.powerapps.com/.default` | PowerApps Service | `475226c6-020e-4fb2-8a90-7a972cbfc1d4` |
  | `https://api.powerplatform.com/.default` | Power Platform API | `8578e004-a5c6-46e7-913e-12f58912df43` |

- Re-check [Step 4 (API Permissions)](#step-4-configure-api-permissions) — confirm every scope the portal needs is listed **and** shows a green admin-consent checkmark.
- If a new permission was added after users first signed in, either click **Grant admin consent for {tenant}** on the app registration, or have users sign out and sign back in so an incremental consent prompt is shown.

### Local debug logging

In development mode the dev script (`pnpm run dev`) emits filtered logs via `scripts/dev-console-filter.cjs`. Set `PORTAL360_ERROR_ONLY_LOGS=false` to see the full unfiltered output, or run `pnpm run dev:light` to skip OpenTelemetry instrumentation. There is no `ENABLE_API_LOGGING` flag.

View logs in the terminal where `pnpm run dev` is running.

---

## Production Deployment

### Azure App Service Deployment

1. **Create App Service** (Node 22 LTS, Linux):
   ```bash
   az webapp create \
     --name portal360 \
     --resource-group portal360-rg \
     --plan portal360-plan \
     --runtime "NODE:22-lts"
   ```

   Use the latest LTS available in `az webapp list-runtimes --os linux` (Node 22 LTS at the time of writing; Node 24 LTS once App Service publishes it).

2. **Configure Environment Variables** (using Key Vault references for secrets):
   ```bash
   az webapp config appsettings set \
     --name portal360 \
     --resource-group portal360-rg \
     --settings \
       NEXTAUTH_URL=https://portal360.azurewebsites.net \
       NEXTAUTH_SECRET='@Microsoft.KeyVault(SecretUri=https://<vault>.vault.azure.net/secrets/NextAuthSecret)' \
       AZURE_TENANT_ID=<tenant-guid> \
       AZURE_CLIENT_ID=<app-id> \
       AZURE_CLIENT_SECRET='@Microsoft.KeyVault(SecretUri=https://<vault>.vault.azure.net/secrets/AzureClientSecret)'
   ```

3. **Assign Managed Identity** and grant it `Key Vault Secrets User` on the vault (see [Production Secrets Management](#production-secrets-management)).

4. **Deploy**:
   ```bash
   pnpm run build
   az webapp deployment source config-zip \
     --name portal360 \
     --resource-group portal360-rg \
     --src ./build.zip
   ```

   The production server listens on `${PORT:-8080}`. App Service injects `PORT` automatically; for local production-mode testing run `PORT=3000 pnpm start`.

   For the full deployment workflow (Oryx, standalone output, startup command), see [`AZURE-DEPLOYMENT-GUIDE.md`](./AZURE-DEPLOYMENT-GUIDE.md).

### Update Redirect URIs

After deployment, update your Azure AD App Registration:
1. Go to **Authentication**
2. Add production redirect URI:
   - `https://portal360.azurewebsites.net/api/auth/callback/azure-ad`
3. Update `NEXTAUTH_URL` in App Service configuration

### ⚠️ Do NOT enable App Service Easy Auth

Portal 360° performs full authentication in-app via NextAuth. Enabling **App Service Authentication** ("Easy Auth") on the same site adds a second auth layer that intercepts requests at `/.auth/login/*` and rejects them with **401** before NextAuth can handle sign-in. It also uses a different callback path (`/.auth/login/aad/callback`) than NextAuth (`/api/auth/callback/azure-ad`), which causes redirect-URI mismatches.

Verify Easy Auth is disabled:

```bash
az webapp auth show --name <site> --resource-group <rg> --query "{enabled:enabled,unauthAction:unauthenticatedClientAction}" -o json
# Expected: enabled=false or unauthAction=AllowAnonymous
```

If it is enabled, disable it:

```bash
az rest --method put \
  --uri "https://management.azure.com/subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.Web/sites/<site>/config/authsettingsV2?api-version=2022-03-01" \
  --body '{"properties":{"platform":{"enabled":false},"globalValidation":{"unauthenticatedClientAction":"AllowAnonymous","requireAuthentication":false}}}'
```

---

## Next Steps

- **Configure Alerts**: Set up Azure Monitor alerts for errors
- **Enable Application Insights**: see [`AI-TELEMETRY-SETUP.md`](./AI-TELEMETRY-SETUP.md) and [`OPENTELEMETRY-SETUP.md`](./OPENTELEMETRY-SETUP.md)
- **Set Up Backups**: Configure automated backups for Key Vault
- **Review Security**: Enable Microsoft Defender for Cloud
- **Documentation**: Review [`admin-guide.md`](./admin-guide.md) for day-to-day operations
- **Pre-production checks**: Run through [`DEPLOYMENT-CHECKLIST.md`](./DEPLOYMENT-CHECKLIST.md) before going live

---

## Support & Resources

- **Documentation**: [Full Documentation](./README.md)
- **API Reference**: [API Documentation](./API-DOCUMENTATION.md)
- **Feature Guide**: [Feature Walkthrough](./FEATURE-WALKTHROUGH.md)
- **GitHub Issues**: [Report Issues](https://github.com/russrimm/PortalofPortals/issues)

---

**Last Updated**: May 30, 2026
