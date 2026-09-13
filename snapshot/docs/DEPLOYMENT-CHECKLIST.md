# Production Deployment Checklist for IT Administrators

**Pre-deployment verification checklist for Portal 360° Admin Portal**  
**Last Updated:** August 21, 2026

> [!IMPORTANT]
> **This document is authoritative for deploying Portal 360° to production.**
> Where it disagrees with any other deployment doc, this one wins.
>
> The others are scoped companions, not alternatives:
> [`AZURE-DEPLOY-QUICK-REF.md`](./AZURE-DEPLOY-QUICK-REF.md) (why Oryx is
> skipped), [`AZURE-DEPLOYMENT-GUIDE.md`](./AZURE-DEPLOYMENT-GUIDE.md)
> (conceptual walkthrough), and
> [`AZURE-STANDALONE-DEPLOYMENT.md`](./AZURE-STANDALONE-DEPLOYMENT.md)
> (packaging detail for troubleshooting).
> `DEPLOYMENT_INTERFACE_GUIDE.md` is unrelated — it documents an in-app wizard.

Use this checklist to ensure your Portal 360° deployment is secure, properly configured, and ready for production use.

---

## Table of Contents

1. [Pre-Deployment Overview](#pre-deployment-overview)
2. [Azure App Registration Configuration](#azure-app-registration-configuration)
3. [API Permissions & Consent](#api-permissions--consent)
4. [Azure Role Assignments](#azure-role-assignments)
5. [Power Platform Configuration](#power-platform-configuration)
6. [Security & Secrets Management](#security--secrets-management)
7. [Application Configuration](#application-configuration)
8. [Testing & Validation](#testing--validation)
9. [Monitoring & Logging](#monitoring--logging)
10. [Scheduled Jobs (WebJobs)](#scheduled-jobs-webjobs)
11. [Slot Deployment & Health Check](#slot-deployment--health-check)
12. [Production Deployment](#production-deployment)
13. [Post-Deployment Verification](#post-deployment-verification)
14. [Rollback Plan](#rollback-plan)

---

## Pre-Deployment Overview

### Timeline

**Recommended Timeline**: 2-3 weeks from start to production

| Phase | Duration | Activities |
|-------|----------|-----------|
| Planning | 2-3 days | Review requirements, obtain approvals |
| App Registration | 30 minutes | Create and configure Azure AD app |
| Permissions | 1-2 hours | Grant permissions, wait for propagation |
| Testing (Dev) | 1 week | Functional testing in development |
| Testing (Staging) | 1 week | Full testing in staging environment |
| Production Deploy | 1 day | Deploy to production with validation |
| Monitoring | Ongoing | Monitor for issues and performance |

### Required Access

Ensure you have the following administrative access:

- [ ] **Global Administrator** or **Application Administrator** role in Microsoft Entra ID
- [ ] **Owner** or **Contributor** role on target Azure subscription
- [ ] **Power Platform Administrator** role
- [ ] Access to create **Azure Key Vault** and store secrets
- [ ] Access to production hosting environment (Azure App Service, Kubernetes, etc.)

### Documentation Review

Before starting, review:

- [ ] [API-DOCUMENTATION.md](./API-DOCUMENTATION.md) - Complete API reference
- [ ] [API-ENDPOINTS-REFERENCE.md](./API-ENDPOINTS-REFERENCE.md) - Endpoint quick reference
- [ ] [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common issues and solutions
- [ ] [Application Installation Guide](./application-installation.md) - Deployment steps

---

## Azure App Registration Configuration

### 1. Create App Registration

- [ ] Navigate to [Azure Portal](https://portal.azure.com) > Microsoft Entra ID > App registrations
- [ ] Click **New registration**
- [ ] Configure:
  - **Name**: `Portal360-Production` (use environment-specific naming)
  - **Supported account types**: Single tenant
  - **Redirect URI**: 
    - Type: Web
    - URI: `https://your-production-domain.com/api/auth/callback/azure-ad`
- [ ] Click **Register**
- [ ] **Copy and save** the following values:
  - Application (client) ID → `AZURE_CLIENT_ID`
  - Directory (tenant) ID → `AZURE_TENANT_ID`

**Screenshot Location**: Save screenshot of app registration overview for documentation

### 2. Create Client Secret

- [ ] In app registration, go to **Certificates & secrets**
- [ ] Click **New client secret**
- [ ] Configure:
  - **Description**: `Portal360-Production-Secret-2025`
  - **Expires**: 24 months (recommended)
- [ ] Click **Add**
- [ ] **⚠️ IMMEDIATELY COPY THE SECRET VALUE** → `AZURE_CLIENT_SECRET`
  - **This is the ONLY time you'll see the secret value**
  - Store securely in Azure Key Vault (see Security section)

**Security Note**: Never store this secret in code, config files, or documentation. Only store in secure secret management system.

### 3. Configure Authentication

- [ ] In app registration, go to **Authentication**
- [ ] Under **Platform configurations**, verify Web platform shows:
  - Redirect URI: `https://your-production-domain.com/api/auth/callback/azure-ad`
- [ ] Click **Add URI** if you need additional environments:
  - Staging: `https://staging.your-domain.com/api/auth/callback/azure-ad`
  - Development: `http://localhost:3000/api/auth/callback/azure-ad` (optional)
- [ ] Under **Implicit grant and hybrid flows**:
  - ✅ **ID tokens** (for implicit and hybrid flows)
  - ❌ Access tokens (not needed)
- [ ] Under **Advanced settings**:
  - **Allow public client flows**: No
  - **Enable the following mobile and desktop flows**: No
- [ ] Click **Save**

### 4. Configure Token Configuration (Optional)

- [ ] In app registration, go to **Token configuration**
- [ ] Click **Add optional claim**
- [ ] Token type: **ID**
- [ ] Add claims:
  - `email`
  - `family_name`
  - `given_name`
  - `preferred_username`
- [ ] Click **Add**
- [ ] If prompted, check "Turn on the Microsoft Graph email permission" and click **Add**

---

## API Permissions & Consent

### 1. Add Microsoft Graph Delegated Permissions

- [ ] In app registration, go to **API permissions**
- [ ] Click **Add a permission** > **Microsoft Graph** > **Delegated permissions**
- [ ] Search and add each permission (see [`INSTALLATION-GUIDE.md`](./INSTALLATION-GUIDE.md#step-4-configure-api-permissions) for the authoritative list — must stay in sync):

#### Sign-in / core
- [ ] `openid`
- [ ] `profile`
- [ ] `email`
- [ ] `offline_access`

#### Users
- [ ] `User.Read`
- [ ] `User.Read.All`
- [ ] `User.ReadWrite.All`
- [ ] `User.Invite.All`
- [ ] `Mail.Send` (optional — only needed for emailed report exports such as the Secure Score PDF)

#### Groups & Teams
- [ ] `Group.Read.All`
- [ ] `GroupMember.Read.All`
- [ ] `Group.ReadWrite.All`
- [ ] `TeamMember.ReadWrite.All`

#### Directory & Applications
- [ ] `Directory.Read.All`
- [ ] `Application.Read.All`
- [ ] `Application.ReadWrite.All`
- [ ] `RoleManagement.Read.Directory`

#### Audit & Reports
- [ ] `AuditLog.Read.All`
- [ ] `AuditLogsQuery.Read.All`
- [ ] `Reports.Read.All`

#### Security & Policy
- [ ] `Policy.Read.All`
- [ ] `IdentityRiskyUser.Read.All`
- [ ] `SecurityEvents.Read.All`
- [ ] `SecurityAlert.Read.All`
- [ ] `SecurityAlert.ReadWrite.All` — required for alert assignment / status / classification updates on the Security Alerts page

#### Service Health & SharePoint
- [ ] `ServiceHealth.Read.All`
- [ ] `ServiceMessage.Read.All`
- [ ] `Sites.Read.All`
- [ ] `SharePointTenantSettings.Read.All`
- [ ] `SharePointTenantSettings.ReadWrite.All` — required to update tenant SharePoint settings (for example, the sync app file-extension block list)

#### Intune / device management
- [ ] `DeviceManagementManagedDevices.Read.All`
- [ ] `DeviceManagementManagedDevices.PrivilegedOperations.All`
- [ ] `DeviceManagementApps.Read.All`
- [ ] `DeviceManagementConfiguration.Read.All`
- [ ] `WindowsUpdates.Read.All` — also requires the signed-in user to hold Intune Administrator, Windows Update Deployment Administrator, or Global Administrator

#### Teams meetings & multi-tenant
- [ ] `OnlineMeetings.Read`
- [ ] `DelegatedAdminRelationship.Read.All`
- [ ] `CrossTenantInformation.ReadBasic.All`

### 1a. Add Microsoft Graph Application Permissions (cron jobs only)

> **Delegated-first.** Every Graph application permission has a delegated
> equivalent and the codebase is migrating off app-only. Grant only the two
> below. See [`DELEGATED-PERMISSION-GAPS.md`](./DELEGATED-PERMISSION-GAPS.md).

Required only if you run `scripts/cron/audit-log-ingest.mjs`, which runs on a
schedule with no signed-in user.

- [ ] Click **Add a permission** > **Microsoft Graph** > **Application permissions**
- [ ] `AuditLog.Read.All`
- [ ] `AuditLogsQuery.Read.All`

Do **not** grant `Reports.Read.All`, `SecurityEvents.Read.All`,
`Directory.Read.All`, `ServiceHealth.Read.All`, or `ServiceMessage.Read.All`
as application permissions — the delegated scopes above cover them.

### 2. Add Azure Service Management Permission

- [ ] Click **Add a permission** > **Azure Service Management** > **Delegated permissions**
- [ ] Add:
  - [ ] `user_impersonation` - Access Azure Service Management as organization users

### 3. Grant Admin Consent

**⚠️ CRITICAL STEP**

- [ ] Click **Grant admin consent for {Your Tenant Name}**
- [ ] Review the permissions list in the popup
- [ ] Click **Yes** to confirm
- [ ] Verify all permissions now show **"Granted for {Tenant}"** in the Status column
- [ ] If any permission shows "Not granted", contact your Global Administrator

**Verification**:
```
Status column should show green checkmark with "Granted for {Tenant}" for ALL permissions
```

**Wait Time**: After granting consent, wait **10 minutes** before proceeding to allow permission propagation.

### 4. Document Permissions

- [ ] Take screenshot of API permissions page showing all granted permissions
- [ ] Save to documentation folder for audit trail
- [ ] Document date and administrator who granted consent

---

## Azure Role Assignments

### 1. Identify Service Principal

After creating app registration, a service principal is automatically created.

- [ ] Navigate to **Microsoft Entra ID** > **Enterprise applications**
- [ ] Search for your app name: `Portal360-Production`
- [ ] Click on the application
- [ ] Copy the **Object ID** (this is the service principal ID)

### 2. Assign Subscription Roles

- [ ] Navigate to **Subscriptions** > Select your production subscription
- [ ] Click **Access control (IAM)**
- [ ] Click **Add** > **Add role assignment**

**Assign Reader Role**:
- [ ] Role: **Reader**
- [ ] Assign access to: **User, group, or service principal**
- [ ] Select members: Search for `Portal360-Production`
- [ ] Click **Review + assign**

**Assign Security Reader Role** (for Defender for Cloud):
- [ ] Repeat above steps with **Security Reader** role

### 3. Assign Resource-Specific Roles (if needed)

For Log Analytics workspaces:
- [ ] Navigate to each Log Analytics workspace
- [ ] Access control (IAM) > Add role assignment
- [ ] Role: **Log Analytics Reader**
- [ ] Member: `Portal360-Production`

For Application Insights:
- [ ] Enumerate **every** Application Insights resource the portal should read from — this includes:
  - The portal's own AI resource (from `APPLICATIONINSIGHTS_CONNECTION_STRING`)
  - **Every AI resource attached to a Copilot Studio agent** you want to view telemetry for (each agent stores its own connection string; missing this returns 403 on `/power-platform/copilot-studio/[agentId]`)
  - Any AI resource queried by `/api/application-insights-*` routes
- [ ] For each: Access control (IAM) > Add role assignment
- [ ] Role: **Monitoring Reader** — required for resource-centric KQL queries via `api.loganalytics.azure.com`, on the Application Insights component **and** its Log Analytics workspace. Queries run as the signed-in user (delegated), so grant to portal administrators.
- [ ] Role: **Monitoring Metrics Publisher** — required for Entra-ID-authenticated telemetry ingest (safe to add even when local auth is enabled)
- [ ] Member: `Portal360-Production`
- [ ] **Shortcut** — if all AI resources live in one subscription and you want future-proof coverage, assign at subscription scope instead:
  ```bash
  az role assignment create --assignee <client-id> \
    --role "Monitoring Reader" --scope "/subscriptions/<sub>"
  ```
  Or loop over every AI resource:
  ```bash
  for ID in $(az resource list --resource-type "Microsoft.Insights/components" --subscription <sub> --query "[].id" -o tsv); do
    az role assignment create --assignee <client-id> --role "Monitoring Reader" --scope "$ID"
  done
  ```

### 4. Verify Role Assignments

```bash
# Use Azure CLI to verify (optional)
az role assignment list --assignee <service-principal-object-id> --all --output table
```

Expected roles:
- Reader (Subscription scope)
- Security Reader (Subscription scope)
- Log Analytics Reader (Workspace scope)
- Monitoring Reader (Application Insights scope)
- Monitoring Metrics Publisher (Application Insights scope)

### 5. Verify App Service Easy Auth is DISABLED

Portal 360° handles authentication entirely via NextAuth. App Service "Easy Auth" adds a second auth layer at `/.auth/login/*` that intercepts requests with **401** before NextAuth runs, and uses a different callback path than the app registration expects.

```bash
az webapp auth show --name <site> --resource-group <rg> \
  --query "{enabled:enabled,unauthAction:unauthenticatedClientAction}" -o json
```

- [ ] `enabled` is `false` OR `unauthenticatedClientAction` is `AllowAnonymous`
- [ ] If Easy Auth is enabled, disable it:

```bash
az rest --method put \
  --uri "https://management.azure.com/subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.Web/sites/<site>/config/authsettingsV2?api-version=2022-03-01" \
  --body '{"properties":{"platform":{"enabled":false},"globalValidation":{"unauthenticatedClientAction":"AllowAnonymous","requireAuthentication":false}}}'
```

---

## Power Platform Configuration

### 1. Assign Power Platform Administrator Role

- [ ] Navigate to [Microsoft 365 Admin Center](https://admin.microsoft.com)
- [ ] Go to **Roles** > **Role assignments**
- [ ] Search for **Power Platform Administrator**
- [ ] Click **Assigned** tab
- [ ] Click **Assign admins**
- [ ] Search for and add users who will use Portal 360
- [ ] Click **Save**

**Alternative**: Assign **Dynamics 365 Administrator** role if Power Platform Administrator is too broad.

### 2. Register Service Principal as Power Platform Admin Management App

**Required for app-only BAP admin calls** (`api.bap.microsoft.com`), including tenant settings, environment discovery, DLP policies, and the Copilot Studio agents listing. Without this, BAP returns `HTTP 403` with `"service principal ... does not have permission to access the path '.../Microsoft.BusinessAppPlatform/scopes/admin/environments'"` and every downstream call receives an empty environment list.

Run once per tenant, signed in as a Power Platform / Global Admin:

```powershell
Install-Module -Name Microsoft.PowerApps.Administration.PowerShell -Scope CurrentUser
Add-PowerAppsAccount
New-PowerAppManagementApp -ApplicationId <AZURE_CLIENT_ID>
```

- [ ] Registration succeeded (no error from `New-PowerAppManagementApp`)
- [ ] Waited 5–10 minutes for propagation before testing

REST alternative and troubleshooting: [`power-platform-bap-api-setup.md`](./power-platform-bap-api-setup.md#authentication).

> The Entra "Power Platform Administrator" directory role on the user (Section 1) is **not** sufficient for the service-principal / client-credentials flow. `New-PowerAppManagementApp` is the required step for app-only access.

### 3. Create Application User in Each Environment

For each Dataverse environment where Portal 360 will be used:

- [ ] Navigate to [Power Platform Admin Center](https://admin.powerplatform.microsoft.com)
- [ ] Select **Environments**
- [ ] Click on environment name
- [ ] Click **Settings**
- [ ] Expand **Users + permissions**
- [ ] Click **Application users**
- [ ] Click **+ New app user**
- [ ] Click **+ Add an app**
- [ ] Search for your app by Application ID: `<AZURE_CLIENT_ID>`
- [ ] Select the app and click **Add**
- [ ] Select **Business unit**: (Choose appropriate business unit, often root)
- [ ] Click **+ Add security role**
- [ ] Select **System Administrator** (or create custom role with minimum required permissions)
- [ ] Click **Save**

**Repeat for each environment**: Production, Staging, Development (if applicable)

### 4. Test Power Platform Access

- [ ] Use test script to verify access:

```bash
# Run from project directory
node whoami-powerplatform.js
```

Expected output: List of environments

If error occurs, see [TROUBLESHOOTING.md](./TROUBLESHOOTING.md#power-platform-issues)

---

## Security & Secrets Management

### 1. Create Azure Key Vault

**⚠️ CRITICAL FOR PRODUCTION**

- [ ] Navigate to [Azure Portal](https://portal.azure.com)
- [ ] Click **Create a resource** > Search for **Key Vault**
- [ ] Click **Create**
- [ ] Configure:
  - **Resource group**: Select or create production resource group
  - **Key vault name**: `portal360-prod-kv-<region>` (must be globally unique)
  - **Region**: Same as your app hosting
  - **Pricing tier**: Standard
- [ ] Click **Review + create** > **Create**

### 2. Configure Key Vault Access Policy

- [ ] Open your Key Vault
- [ ] Go to **Access policies**
- [ ] Click **Create**
- [ ] Select permissions:
  - **Secret permissions**: Get, List
- [ ] Click **Next**
- [ ] Select principal: Search for `Portal360-Production` (your service principal)
- [ ] Click **Next** > **Next** > **Create**

### 3. Add Secrets to Key Vault

**Add each secret**:

- [ ] In Key Vault, go to **Secrets**
- [ ] Click **+ Generate/Import**

**Add these secrets**:

1. **NEXTAUTH-SECRET**:
   - Name: `NEXTAUTH-SECRET`
   - Value: Generate with `openssl rand -base64 32`
   - Click **Create**

2. **AZURE-CLIENT-SECRET**:
   - Name: `AZURE-CLIENT-SECRET`
   - Value: The client secret you saved earlier
   - Click **Create**

**⚠️ Security Checklist**:
- [ ] Verify "Enabled" is set to Yes for all secrets
- [ ] Set expiration date matching client secret expiration
- [ ] Document secret names and creation date
- [ ] **DO NOT** store secrets in:
  - [ ] Source code
  - [ ] Config files committed to Git
  - [ ] Documentation
  - [ ] Email or chat
  - [ ] Screenshots

### 4. Configure Application to Use Key Vault

**For Azure App Service**:
- [ ] In App Service, go to **Configuration** > **Application settings**
- [ ] Add new settings using Key Vault references:

```
NEXTAUTH_SECRET=@Microsoft.KeyVault(SecretUri=https://portal360-prod-kv.vault.azure.net/secrets/NEXTAUTH-SECRET/)
AZURE_CLIENT_SECRET=@Microsoft.KeyVault(SecretUri=https://portal360-prod-kv.vault.azure.net/secrets/AZURE-CLIENT-SECRET/)
```

**For Kubernetes**:
Use Azure Key Vault Provider for Secrets Store CSI Driver

**For Docker**:
Mount secrets as files or use environment variables with Key Vault integration

### 5. Enable Key Vault Logging

- [ ] In Key Vault, go to **Diagnostic settings**
- [ ] Click **Add diagnostic setting**
- [ ] Name: `audit-logs`
- [ ] Select:
  - [ ] **AuditEvent**
- [ ] Send to:
  - [ ] Log Analytics workspace (recommended)
- [ ] Click **Save**

### 6. Rotate Secrets (Schedule)

**Set up secret rotation schedule**:

- [ ] Document client secret expiration date: `__________`
- [ ] Set calendar reminder 30 days before expiration
- [ ] Document rotation procedure in runbook
- [ ] Assign secret rotation responsibility to: `__________`

**Rotation Process** (brief):
1. Create new client secret in Azure Portal
2. Add new secret to Key Vault
3. Update App Service configuration to use new secret
4. Test application functionality
5. Delete old client secret after 7 days

---

## Application Configuration

### 1. Environment Variables (Production)

Configure these in your hosting environment (Azure App Service, Kubernetes, etc.):

**Required**:
```bash
# Application URL
NEXTAUTH_URL=https://your-production-domain.com

# Authentication (from Key Vault)
NEXTAUTH_SECRET=@Microsoft.KeyVault(...)
AZURE_CLIENT_ID=<your-client-id>
AZURE_CLIENT_SECRET=@Microsoft.KeyVault(...)
AZURE_TENANT_ID=<your-tenant-id>

# Alternative names (NextAuth v5 compatibility)
AUTH_SECRET=@Microsoft.KeyVault(...)
AUTH_AZURE_AD_CLIENT_ID=<your-client-id>
AUTH_AZURE_AD_CLIENT_SECRET=@Microsoft.KeyVault(...)
AUTH_AZURE_AD_TENANT_ID=<your-tenant-id>

# Azure (optional)
AZURE_SUBSCRIPTION_ID=<your-subscription-id>
```

**Required when running more than one instance**:
```bash
# Shared state — see "Redis / shared state" below
AZURE_REDIS_HOST=<cache-name>.redis.cache.windows.net
AZURE_REDIS_USE_ENTRA_ID=true
PORTAL360_REQUIRE_REDIS=1
```

**Optional** (based on your needs):
```bash
# Defender for Cloud
DEFENDER_MANAGEMENT_SCOPE=https://management.azure.com/.default

# Custom API endpoints (if using private endpoints)
GRAPH_API_ENDPOINT=https://graph.microsoft.com
POWER_PLATFORM_API_ENDPOINT=https://api.powerplatform.com
```

**Do NOT set in production**:
```bash
# These should NEVER be in production
NODE_TLS_REJECT_UNAUTHORIZED=0  # NEVER in production
AUTH_DISABLED=1                  # NEVER in production
```

### 2. Redis / shared state (REQUIRED for multi-instance)

Portal 360° keeps two pieces of state in Redis:

| Subsystem | Source | What breaks without Redis |
|---|---|---|
| Token store | `src/lib/tokenStore.ts` | OAuth/OBO access and refresh tokens are held in process memory. A request routed to a different instance finds no tokens — the user gets a spurious re-auth prompt or a `401`. |
| Rate limiter | `src/lib/rateLimiter.ts` | Limits are counted per process, so the enforced limit is silently multiplied by the number of instances. |

Both fall back to an in-memory store **silently**. Decide which case you are in:

- [ ] **Multi-instance** (App Service scale-out > 1, Container Apps replicas > 1, AKS, or a traffic-serving slot): **Redis is REQUIRED.**
  - [ ] Provision Azure Cache for Redis — see [redis-setup-guide.md](./redis-setup-guide.md)
  - [ ] Set `AZURE_REDIS_HOST` and `AZURE_REDIS_USE_ENTRA_ID=true` (preferred), or `AZURE_REDIS_CONNECTION_STRING`
  - [ ] Grant the app's managed identity the **Redis Cache Contributor** / data-access role when using Entra ID auth
  - [ ] Set `PORTAL360_REQUIRE_REDIS=1` so a misconfigured deploy **fails startup** instead of serving traffic in a degraded state
  - [ ] Confirm no `[redis][cfg] WARNING` appears in startup logs after deployment

- [ ] **Single instance without Redis**: you **must** enable ARR affinity so a browser session always reaches the same instance.
  - [ ] Azure Portal > App Service > **Settings > Configuration > General settings > Session affinity: On**
  - [ ] Or: `az webapp update --name <app> --resource-group <rg> --client-affinity-enabled true`
  - [ ] Keep the instance count pinned at 1 and autoscale disabled — a scale-out event signs users out
  - [ ] Accept that instance recycles (deployments, platform maintenance) will drop all sessions

> **Startup behavior**: `instrumentation.ts` checks for Redis configuration at boot.
> In production with none present it logs a prominent `[redis][cfg] WARNING` naming
> both the token store and the rate limiter as degraded and unsafe for
> multi-instance. Setting `PORTAL360_REQUIRE_REDIS=1` turns that warning into a
> hard startup failure.

### 3. Verify Configuration

- [ ] All required environment variables are set
- [ ] Secrets are sourced from Key Vault
- [ ] `NEXTAUTH_URL` matches actual production domain
- [ ] No secrets are in plain text in configuration
- [ ] No development/debugging flags enabled

**Who owns these settings**: App Service application settings are configured
**manually** (Azure Portal or `az`), using Key Vault references for anything
secret. The `.github/workflows/azure-app-service-deploy.yml` workflow does
**not** create or overwrite them — no auth secret is stored as a GitHub secret,
and CI never writes one into App Service.

**CI enforces this**: before it deploys, the workflow runs a
`Verify required App Service settings` preflight step that lists the App
Service's setting *names* and **fails the job** if any of these are missing:

| Setting | Purpose |
| --- | --- |
| `NEXTAUTH_SECRET` | NextAuth session/JWT encryption key |
| `NEXTAUTH_URL` | Canonical production URL for OAuth callbacks |
| `AZURE_CLIENT_ID` | Entra app registration (client) ID |
| `AZURE_CLIENT_SECRET` | Entra client secret (Key Vault reference) |
| `AZURE_TENANT_ID` | Entra tenant ID |

The step reads names only, never values, so nothing secret reaches the workflow
log. It runs *before* the app is stopped, so a misconfigured App Service is
never left in a stopped state.

**Self-check the same thing before deploying**:

```bash
az webapp config appsettings list \
  --name portal365 \
  --resource-group <rg-name> \
  --query "[].name" -o tsv | sort
```

If the preflight fails, add the missing settings in **Azure Portal > App
Service > Settings > Environment variables > App settings** (see
[Configure Application to Use Key Vault](#4-configure-application-to-use-key-vault)),
then re-run the workflow. Do not add these values as GitHub secrets.

### 4. Build Configuration

**Update `next.config.ts` for production**:

```typescript
const nextConfig = {
  // ... existing config
  
  // Ensure proper CSP headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          }
        ]
      }
    ]
  },
  
  // Production optimizations
  reactStrictMode: true,
  swcMinify: true,
  
  // Disable source maps in production (optional, for security)
  productionBrowserSourceMaps: false,
}
```

---

## Testing & Validation

### 1. Local Testing

**Before deploying**, test locally with production configuration:

- [ ] Set `.env.local` to use production app registration (with development redirect URI)
- [ ] Run: `pnpm run build`
- [ ] Verify build completes without errors
- [ ] Run: `pnpm start`
- [ ] Test all critical paths:
  - [ ] User can sign in
  - [ ] Users page loads
  - [ ] Groups page loads
  - [ ] Power Platform environments load
  - [ ] Azure resources load
  - [ ] Security alerts load
  - [ ] Reports generate successfully

### 2. Staging Environment Testing

**Deploy to staging environment first**:

- [ ] Deploy application to staging
- [ ] Configure staging environment variables
- [ ] Use staging subdomain: `https://staging.your-domain.com`
- [ ] Add staging redirect URI to app registration

**Staging Test Checklist**:
- [ ] **Authentication**: 5 users can sign in successfully
- [ ] **Users Management**: Can list, view details, create test user
- [ ] **Groups**: Can list groups and view members
- [ ] **Applications**: Can list app registrations and service principals
- [ ] **Audit Logs**: Can view directory audits and sign-in logs
- [ ] **Security**: Secure Score, Risky Users, Alerts load
- [ ] **Azure Resources**: Resource Graph queries return results
- [ ] **Device Management**: Intune devices load
- [ ] **Power Platform**: Environments load, can view teams/solutions
- [ ] **SharePoint**: Sites load with correct data
- [ ] **Reports**: Usage reports generate correctly
- [ ] **Performance**: All pages load within 3 seconds
- [ ] **Mobile**: Test on mobile devices (responsive design)
- [ ] **Browser Compatibility**: Test on Chrome, Edge, Firefox, Safari

### 3. Load Testing (Optional but Recommended)

- [ ] Use tool like Apache Bench or Artillery
- [ ] Simulate 50 concurrent users
- [ ] Verify application remains stable
- [ ] Check Azure monitoring for throttling/errors

```bash
# Example load test
ab -n 1000 -c 10 https://staging.your-domain.com/users
```

### 4. Security Testing

- [ ] Run security scan using:
  - [ ] pnpm audit
  - [ ] OWASP ZAP (optional)
  - [ ] Azure Security Center recommendations
- [ ] Verify no secrets in:
  - [ ] Browser DevTools Network tab
  - [ ] Client-side JavaScript
  - [ ] Error messages
- [ ] Test authentication:
  - [ ] Cannot access pages without login
  - [ ] Session expires appropriately
  - [ ] Logout works correctly

---

## Monitoring & Logging

### 1. Application Insights Setup

- [ ] Create Application Insights resource in Azure Portal
- [ ] Configure connection string in App Service:
  ```
  APPLICATIONINSIGHTS_CONNECTION_STRING=InstrumentationKey=...;IngestionEndpoint=...
  ```
- [ ] Enable Application Insights in code (if not already):
  ```javascript
  // next.config.ts
  module.exports = {
    // ... other config
    experimental: {
      instrumentationHook: true
    }
  }
  ```

### 2. Configure Alerts

**Create alerts for**:

- [ ] **Application Errors**
  - Threshold: > 10 errors in 5 minutes
  - Action: Email admin team

- [ ] **Failed Authentication**
  - Threshold: > 20 failed logins in 5 minutes
  - Action: Email security team

- [ ] **API Response Time**
  - Threshold: Average > 5 seconds
  - Action: Email dev team

- [ ] **Availability**
  - Threshold: < 99% uptime
  - Action: Email on-call engineer

### 3. Log Analytics Workspace

- [ ] Create Log Analytics workspace (if not exists)
- [ ] Link Application Insights to workspace
- [ ] Configure retention: 90 days (recommended)
- [ ] Set up custom queries for:
  - User login patterns
  - API usage statistics
  - Error trends

### 4. Azure Monitor Dashboard

- [ ] Create Azure Monitor dashboard
- [ ] Add tiles for:
  - Application availability
  - Request count
  - Failed requests
  - Average response time
  - User count
- [ ] Share dashboard with operations team

---

## Scheduled Jobs (WebJobs)

Two Azure App Service **triggered WebJobs** deploy with the application from
`App_Data/jobs/triggered/`. They run on a cron schedule inside the same App
Service as the web app.

> [!IMPORTANT]
> WebJob output goes to a **separate log stream** from the web app. The audit
> page's ingest status card reflects the latest stored audit-run status, not a
> durable run history. Check job output as well: an outage can prevent the status
> write itself. Verify these explicitly after every approved deployment.

### 1. What the jobs do

| Job | Schedule (`settings.job`) | In plain English | Entry point |
| --- | --- | --- | --- |
| `audit-log-ingest` | `0 */10 * * * *` | Every 10 minutes | `node scripts/cron/audit-log-ingest.mjs` |
| `kpi-snapshot` | `0 20 6,18 * * *` | 06:20 and 18:20 UTC daily | `node scripts/cron/kpi-snapshot.mjs` |

**`audit-log-ingest`** pulls directory audit events (and, when enabled, Microsoft
365 and Power Platform activity) into the Cosmos `audit-logs` container. If it
stops, the portal's audit history simply stops growing — existing rows remain,
so the failure is easy to miss.

**`kpi-snapshot`** captures tenant posture metrics into the Cosmos
`kpi-snapshots` container so the home dashboard sparklines have a contiguous
series. Snapshot IDs are day-granular (`<metricKey>|<YYYY-MM-DD>`), so the
second daily run **overwrites** the day's point rather than adding one. That is
deliberate: a transient Graph failure in the morning no longer costs a whole day
of history. If it stops, sparklines flatten and the tenant health briefer loses
its trend data.

Both jobs `cd` to `/home/site/wwwroot` before running, with a fallback for hosts
where `HOME` differs.

### 2. Cosmos DB is required for these jobs to do anything

- [ ] Confirm `COSMOS_DB_ENDPOINT` is set on the App Service

Both jobs write exclusively to Cosmos DB. Audit ingestion fails with a nonzero
exit code when `COSMOS_DB_ENDPOINT` is absent. Do not interpret missing
configuration or a stale status document as a successful audit run.

The application warns about this at startup:

```
[cosmos][cfg] WARNING: audit events are NOT being durably persisted.
```

Set `PORTAL360_REQUIRE_COSMOS=1` to turn that warning into a hard startup
failure for deployments with a compliance or retention obligation. See
[Environment Variables](./ENVIRONMENT-VARIABLES.md).

Audit ingestion retains its existing app-only Graph authentication and separate
Cosmos managed-identity selection. Its Graph credentials must already be supplied
through the job host's protected runtime configuration; Cosmos managed identity
does not replace those Graph credentials. See
[`APP-ONLY-JOBS.md`](./APP-ONLY-JOBS.md). Replay adds no credential or permission.

### 3. Confirm a job actually ran

- [ ] List the deployed jobs and check `latest_run` after each deployment

```bash
az webapp webjob triggered list \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --output table
```

Both jobs should appear. The output includes each job's latest run status.

For full run history, including per-run output, use the Kudu (SCM) endpoint:

```
https://<app-name>.scm.azurewebsites.net/api/triggeredwebjobs/<job-name>/history
```

Raw log files are written under `App_Data/jobs/triggered/<job-name>/` on the
App Service filesystem, which you can browse via Kudu.

> [!NOTE]
> There is no dedicated `az` command that tails WebJob output. Use the Kudu
> history endpoint above or the Azure portal (**App Service → WebJobs → Logs**).

### 4. Trigger a job manually for testing

- [ ] Run each job once by hand after the first deployment, before trusting the schedule

```bash
az webapp webjob triggered run \
  --name "$APP_NAME" \
  --resource-group "$RESOURCE_GROUP" \
  --webjob-name audit-log-ingest
```

Then re-check the history endpoint and confirm rows actually landed in the
Cosmos container. A successful HTTP bulk response alone does not prove every
record was saved; check the per-source counters below.

### Audit ingestion outcomes and recovery

**Run only after owner approval in the intended, already-configured job host.**
These commands perform real reads and writes, except `--help`. Do not run them
from a development worktree that might select a developer's Azure credentials.
The script does not load `.env` files or change host configuration.

```bash
# No remote operations or credential acquisition:
node scripts/cron/audit-log-ingest.mjs --help

# Example only: replace these UTC boundaries with the affected source window.
node scripts/cron/audit-log-ingest.mjs --source directory-audits --start 2026-09-05T12:00:00Z --end 2026-09-05T12:15:00Z
node scripts/cron/audit-log-ingest.mjs --source power-platform --start 2026-09-05T12:00:00Z --end 2026-09-05T12:15:00Z
```

`--start` and `--end` must appear together, use UTC ISO timestamps (seconds or
three fractional digits), and define a positive window of at most 24 hours.
`--source` selects one source explicitly, overriding its enable flag for that
invocation only. Without it, the existing enable flags apply. Without a window,
the existing per-source moving lookbacks apply. Power Platform replay creates a
new query with the same boundaries and existing record-type filters.

The worker logs each source's fixed `start` and `end` **before any remote call**.
Retain these job logs and the affected status before another scheduled run
overwrites it. Serialize manual replays with scheduled runs; the single latest
status document is not a concurrency lock. Replay the same boundaries, even if
the moving lookback has since advanced. If the page limit is reached, split the
window into smaller adjacent windows and require completion for each one.

The existing `audit-ingest-status` document keeps its `success` field and adds
`outcome` plus per-source boundaries and failure summaries. A start checkpoint
has `success: false`, `outcome: "running"` and no completion time. It stays
non-success until every enabled source finishes enumeration and all intended
writes are acknowledged. A process interruption or status-store failure cannot
turn that checkpoint into success. If even the initial checkpoint cannot be
written, the previous status may remain; use job exit status and freshness too.

| Per-source field | Meaning |
| --- | --- |
| `total` | Records passed to persistence after enumeration; not the provider's total event count. |
| `filtered` | Records intentionally excluded by the unchanged service allowlist. |
| `attempted` | Unfiltered records submitted for persistence, counted once regardless of retries. |
| `saved` | Records with an acknowledged HTTP 2xx write outcome. |
| `failed` | Unresolved records, including unknown commit outcomes. Not proof that none reached Cosmos. |
| `complete` | Whether provider enumeration finished before the page limit. |
| `failureCounts` | Exact counts by failure category across the submitted records. |
| `failures` | At most 100 per-item diagnostics: zero-based index in the allowlisted input, status code if known, category and attempt count. No record contents or IDs. |
| `failuresTruncated` | More failures exist than the diagnostic sample; replay the window rather than treating sample indices as durable IDs. |

After persistence, `total = filtered + attempted` and
`attempted = saved + failed`. A provider fetch/query failure before persistence
leaves these counters at zero and marks the source `failed`; zero does not mean
that its window contains no events. An unfinished query, malformed read
response, exhausted Graph retry, page cap, or unresolved write makes the run
incomplete and the command exit `1`. No enabled sources also exits `1`. The
existing UI reads `success: false` as **Attention**. It does not display every
new diagnostic field; the authenticated status API retains them.

| Failure category | Response |
| --- | --- |
| `permanent` | No automatic retry. Resolve permission, payload, conflict or service issues before approved replay. HTTP 500 is included; it is not in the retry allowlist. |
| `retry-exhausted` | Four total application-level attempts failed. Resolve throttling/availability before replay. |
| `retry-deferred` | Provider guidance would exceed the remaining retry-wait budget. Wait at least the recorded `retryAfterMs` before replay. |
| `transport-unknown` | The bulk call threw; some writes might have committed. No blind automatic retry of the entire chunk. Replay with stable IDs. |
| `invalid-response` | Missing, invalid or uncorrelatable operation responses. No success is inferred; investigate and replay. |

Only failed items with status `408`, `410`, `429`, `449`, or `503` are retried.
Each 100-item chunk permits four total attempts and at most 30 seconds of
application retry waiting. Delays use exponential backoff with jitter and never
shorten available provider retry guidance. The legacy SDK bulk response does
not guarantee per-item retry headers; backoff is used when no hint is exposed.
SDK-internal retries and request latency are additional, so 30 seconds is **not**
a wall-clock deadline. This follows the
[Cosmos retry guidance](https://learn.microsoft.com/en-us/azure/cosmos-db/nosql/conceptual-resilient-sdk-applications)
and the [operation response contract](https://learn.microsoft.com/en-us/javascript/api/@azure/cosmos/operationresponse?view=azure-node-latest).

Upserts preserve provider `id` / `recordId` values and the tenant partition key.
When both IDs are absent, a canonical hash of the raw record replaces the
previous random ID. Replaying the same record does not add another document,
even under a new query/run ID; ingestion metadata can be refreshed. For ID-less
records, this guarantee requires the same raw content. Identical ID-less
events cannot be distinguished, and changed raw content produces a new hash.
Records previously written under random fallback IDs are not migrated.

**Recovery limit:** this is bounded manual window replay, not an outage-safe
archive or a durable watermark. It can recover only records the provider still
retains and returns. Logs/status retention, a durable per-source cursor,
concurrency-safe checkpoint advancement, and durable failed-window storage
remain follow-up work before claiming gap-free archival. A later healthy
scheduled run does not clear an older failed window. No historical loss has
been measured or repaired by this change.

### 5. Alert on failure

- [ ] Configure an alert so a failing job is not discovered weeks later

Combine job failure, audit status (`success: false` or a stale `running`
checkpoint), and data freshness. A fresh status document alone is not proof
of complete ingestion:

- **Data freshness (recommended):** alert when the newest document in the
  `audit-logs` container is older than ~30 minutes, or when `kpi-snapshots` has
  no document for the current day after 19:00 UTC. This catches silent
  no-op runs that Cosmos misconfiguration causes, which a process-level alert
  would miss.
- **Process failure:** the WebJob writes to the App Service log stream, so a Log
  Analytics alert on `AppServiceConsoleLogs` containing the job name plus an
  error signature will catch hard crashes.

### 6. Post-deployment checklist

- [ ] `az webapp webjob triggered list` shows both jobs
- [ ] Each job has a successful `latest_run` after a manual trigger
- [ ] New documents visible in `audit-logs` within ~10 minutes
- [ ] A `kpi-snapshots` document exists for today after the next scheduled run
- [ ] No `[cosmos][cfg] WARNING` in the startup logs
- [ ] Freshness alert configured

---

## Slot Deployment & Health Check

Deployments do **not** write to the production slot. `.github/workflows/azure-app-service-deploy.yml`
publishes to a staging slot, waits for that slot to report itself ready, and only
then swaps it into production. The swap is a routing change rather than a restart,
so there is no stop/start downtime window, and the build that production was
running stays intact in the staging slot as an instant rollback target.

### 1. Slot topology

| | Value |
|---|---|
| App Service | `portal365` (resource group `Portal360`) |
| Staging slot **resource name** | `test` |
| Staging slot hostname | `portal365-test-<suffix>.westcentralus-01.azurewebsites.net` |
| Health check path | `/api/health/ready` |

> The slot's resource name is `test`, not `portal365-test`. `portal365-test-…` is the
> generated *hostname*. Azure CLI commands take the resource name (`--slot test`);
> the workflow resolves the hostname at runtime rather than hard-coding it.

### 2. The readiness endpoint

`GET /api/health/ready` (`src/app/api/health/ready/route.ts`) is **unauthenticated
by design** — one of the approved public routes alongside `/api/auth/**`. App Service
probes it anonymously and the workflow polls it before any user session exists.

It returns `200` only when the instance's authentication and shared-state
**configuration** passes these checks; it does not prove sign-in or backend access:

| Check | Fails when |
|---|---|
| `auth-config` | `validateAuthConfig()` reports errors — missing `AUTH_SECRET`/`NEXTAUTH_SECRET`, missing or malformed `AUTH_URL`/`NEXTAUTH_URL`, or `PORTAL360_ALLOW_SYNTHETIC_AUTH=1` in production. `AUTH_URL` hostname disagreeing with `WEBSITE_HOSTNAME` is logged as a **warning**, not a failure — see §4 |
| `entra-credentials` | The client id, client secret, or tenant id does not resolve, so `src/lib/auth.ts` would register no sign-in provider at all. Without this the slot can report ready and still be unable to sign anyone in — the one thing the slot exists to verify before a swap |
| `shared-state` | Redis is unconfigured in production, which would silently drop the token store and rate limiter to per-process memory |

Failed configuration returns `503`, which participates in App Service's unhealthy
instance handling and keeps the workflow from swapping.

**The response body never contains configuration detail.** `validateAuthConfig()`
messages embed hostnames and setting names; the route returns only the *names* of
the failing checks (`{"status":"not-ready","failed":["auth-config"]}`) and logs the
full reason server-side. Keep it that way — the endpoint is public.

**Scope limit worth knowing:** these are *configuration* checks, not connectivity
checks. A slot can report ready while being unable to reach Redis or Cosmos DB,
because the staging slot has no managed identity of its own (see §4). That is
deliberate: those dependencies resolve under production's identity after the swap,
so failing the staging probe on them would block every deployment. Production
dependency verification is separate and runs after the swap (§2a).

- [ ] Verify the endpoint responds on production: `curl -i https://<prod-host>/api/health/ready`

### 2a. Production dependency verification

The three signals have different meanings:

| Signal | What success establishes |
|---|---|
| Anonymous `/api/auth/check` | Basic liveness: the request handler responded. It does not establish backend access. Do not use an authenticated debug response as a public artifact. |
| `/api/health/ready` | Configuration-only readiness and package `commit`; used by App Service Health Check and staging warm-up. |
| `/api/health/dependencies` | Production configuration **and actual required-backend reads** succeeded within the probe deadline; used by the post-swap deployment gate. |

`GET /api/health/dependencies` is an intentionally public, minimal, read-only
probe, not an administrative API. It accepts no target, credential, force-refresh,
or timeout parameter. Only `NODE_ENV=production` with the exact runtime setting
`PORTAL360_VERIFY_PRODUCTION_DEPENDENCIES=1` enables work. Otherwise it returns
`503 {"status":"not-verified","reason":"not-enabled","commit":"…"}` without
contacting a backend. A skipped check is never a successful production verification.
Do not infer deployment role from `WEBSITE_HOSTNAME` or `WEBSITE_SLOT_NAME`; warm
workers can retain staging values after a swap.

**Required guarantees:**

- **Redis always:** authenticate using the same configuration precedence and
  credential chain as the token store/rate limiter; connect to the configured
  Redis database and issue `EXISTS` on a fixed reserved `session:` key. This checks
  session-keyspace read access, not just `PING`. No session contents are fetched,
  keys written, refresh subscription started, or in-memory fallback accepted.
  Entra authentication uses the existing `DefaultAzureCredential` chain and SDK
  OID mapping; this probe does not change which identity the application uses.
- **Cosmos only when `isCosmosRequired()` is true:** the existing
  `PORTAL360_REQUIRE_COSMOS` accepts `1`/`true` (trimmed, case-insensitive). Read
  the configured audit and user-settings container metadata in the configured
  database, require their `/tenantId` and `/userId` partition keys, and point-read
  a fixed reserved sentinel ID in a nonbusiness partition to check data-plane
  read authorization. An absent sentinel (404) is normal **only after container
  metadata succeeds**; other read failures fail the check. No tenant documents
  are targeted. Use the same host/user-assigned identity selection as the
  application. Missing database/container, denied read, malformed schema, and
  unreachable endpoint fail. The probe never provisions containers or falls back
  to `COSMOS_DB_KEY`. Unset, `0`, or `false` leaves Cosmos `not-required`, even
  when an optional configured Cosmos instance is unavailable.
- Optional feature stores (KPI/drift/PAYG), Microsoft Graph, and other workload
  APIs are **not** added to the required deployment dependency set.

Each probe round has one **5-second total deadline**, including credential
acquisition. Cancellation reaches identity/HTTP/socket work; Redis reconnects
and Cosmos discovery/background refresh are disabled for these short-lived
clients, and clients/sockets are disposed on completion or cancellation.
Successful **and failed** results are cached for **10 seconds per worker** with
single-flight deduplication. Query strings cannot bypass that limit. If an adapter
ignores cancellation, its in-flight lock remains until it settles, so subsequent
anonymous requests cannot launch unbounded overlapping work. This is a per-worker
bound, not a distributed rate limit. Configuration changes invalidate old success.

All responses use `Cache-Control: no-store`. An enabled successful response is
`200` with `status: "verified"`, `checks.redis: "available"`,
`checks.cosmos: "available" | "not-required"`, `checkedAt`, and the package
`commit`. Failures return `503`, `status: "not-verified"`, and generic
`unavailable`/`timeout` outcomes (or `reason: "configuration"`). No endpoint,
secret, identity, tenant document, SDK body, or exception text is returned or
logged by dependency probing. `checkedAt` is the completed probe time, including
when the result is served from the short internal cache.

**Operator preparation — separately authorized, before the first deployment
containing this gate:** in Azure portal, select App Service `portal365` in
`Portal360` → **Settings → Environment variables → App settings**. Add
`PORTAL360_VERIFY_PRODUCTION_DEPENDENCIES=1` on production and `=0` on deployment
slot `test`, selecting **Deployment slot setting** so the name is sticky.
Preserve all existing sticky names and values. The setting is **nonsecret,
server runtime only**, not `NEXT_PUBLIC_*` or a build variable. A Website
Contributor (or custom role with the required site/slot configuration write
permissions) prepares it; saving app settings can restart the affected slot.
Do not rotate session secrets or grant staging production data access.

The workflow preflight reads only this nonsecret flag and the sticky-name
registration. Missing/wrong values or missing stickiness fail **before deploy**;
the workflow does not repair settings or grant roles. Existing application
principals need their already-approved Redis keyspace access and, when required,
Cosmos data-plane access to the two core containers. A health failure is not
authorization to grant broader access. See
[environment settings](./ENVIRONMENT-VARIABLES.md#5a-production-dependency-verification)
and [Microsoft's slot-swap behavior](https://learn.microsoft.com/azure/app-service/deploy-staging-slots).

After swap, the workflow polls the **production** dependency path, requiring
HTTP 200, `verified`, the required check outcomes, and `commit == GITHUB_SHA`.
Missing/old build, skipped probing, 503, malformed response, or exhausted
timeouts cannot pass. The existing 30-attempt loop (15-second HTTP bound plus
10-second interval) and swap-back failure path remain; **this is not a
five-minute wall-clock promise**. The App Service Health Check/warm-up path
remains `/api/health/ready`; do not point identity-less staging at dependencies.

- [ ] Preflight confirms production `1`, staging `0`, and sticky registration
      without printing secret settings.
- [ ] On an authorized rollout, production returns `verified` for the deployed
      commit; staging's normal dependency request remains `not-enabled`.
- [ ] Treat fixture tests as implementation evidence, not deployed verification.
      Record rollout and rollback evidence separately.

**Limits:** read-only probes cannot prove write permission, audit durability,
all feature stores, token-store singleton recovery, every replica, sign-in, or
delegated administrative workflows. They test new bounded connections using the
application's backend configuration and identity patterns, not the health of
every already-initialized client. Critical journeys and separately approved live
validation remain necessary. Never mark a skipped probe or a configuration-only
200 as proof of those guarantees.

### 3. Slot app settings — the swap hazard

**App Service slots do not inherit app settings.** Every setting that is *not*
marked slot-sticky **moves with the slot during a swap**. A setting that exists on
production but not on the staging slot is therefore **deleted from production** by
the swap — an outage that is both worse than a restart and invisible to a health
check that only probes the slot.

The workflow refuses to deploy unless the slot carries every swappable production
setting (step *Verify slot settings parity with production*). Only setting **names**
are compared; values are never read or logged. Slot-sticky settings (§4) are exempt
because they never swap, and so are the settings App Service writes itself per slot
(`WEBSITE_HTTPLOGGING_RETENTION_DAYS`, written by the diagnostic logging config) —
those are re-created by the platform and copying them by hand only causes the slot
to drift again.

To reconcile the slot after adding a setting to production:

```bash
# Copy every production setting onto the slot, then fix the slot-specific ones.
az webapp config appsettings list \
  --name portal365 --resource-group Portal360 -o json > /tmp/prod-settings.json

az webapp config appsettings set \
  --name portal365 --resource-group Portal360 --slot test \
  --settings @/tmp/prod-settings.json

rm /tmp/prod-settings.json   # contains secret values — do not keep or commit it
```

- [ ] Any new production app setting has also been added to the `test` slot

### 4. Slot-sticky settings

Settings that must **stay** with their slot across a swap are registered in the
site's `slotConfigNames`. `AUTH_URL` and `NEXTAUTH_URL` are sticky so that each
slot's own OAuth callback origin always matches that slot's own hostname on a
fresh boot — without stickiness the staging slot would inherit the production
URL and `validateAuthConfig()` would flag every cold boot as a "repos mixed up"
misconfiguration.

**`WEBSITE_HOSTNAME` does not reliably update after a swap — this check is a
warning, not an error, because of it.** `validateAuthConfig()` originally treated
an `AUTH_URL`/`WEBSITE_HOSTNAME` mismatch as a hard error, and `instrumentation.ts`
fails closed on errors in production. That combination broke every single
deployment for hours: after a swap, `AUTH_URL` (sticky) correctly updates to
production's own value on the live worker process, but `WEBSITE_HOSTNAME` is a
platform-computed value fixed at container boot and does not get refreshed by
the in-place app-settings injection Azure uses for a warm slot swap — so the
already-running process kept reporting the *staging* slot's `WEBSITE_HOSTNAME`
indefinitely, `/api/health/ready` 503'd on every post-swap check, and the
workflow rolled back every build regardless of what it contained. Confirmed via
`AppServiceConsoleLogs`: `does not match this app's WEBSITE_HOSTNAME
portal365-test-...` on production, immediately and only after every swap. The
check now only warns (logged by `instrumentation.ts` via `console.warn`, never
blocks `/api/health/ready` or the boot fail-closed path), which still surfaces a
genuine "repos mixed up" misconfiguration without permanently blocking this
app's slot-swap deployment strategy.

| Slot | `AUTH_URL` / `NEXTAUTH_URL` |
|---|---|
| production | `https://portal365-<suffix>.westcentralus-01.azurewebsites.net` |
| `test` | `https://portal365-test-<suffix>.westcentralus-01.azurewebsites.net` |

To mark an additional setting sticky:

```bash
az webapp config appsettings set \
  --name portal365 --resource-group Portal360 \
  --slot-settings MY_SETTING=<value>
```

**Known gap — managed identity does not swap.** Production has a system-assigned
identity; the `test` slot currently has none. Identity is a property of the slot
resource, so production keeps its identity and its role assignments through every
swap — the swap itself is safe. But it means the staging slot cannot exercise
anything that authenticates with `DefaultAzureCredential` (Redis via Entra ID,
Cosmos DB, ARM). Sign-in on the slot additionally requires the slot's redirect URI
to be registered on the app registration.

- [ ] Decide whether the slot needs its own identity and role assignments for
      genuine pre-production testing, or remains a swap staging area only

### 5. App Service Health Check

Health Check stays configured to `/api/health/ready` for configuration failures
and swap warm-up. Required-backend outages are checked by the separate post-swap
gate, not by this platform health path.

The workflow sets the path on the **slot** before deploying, never on production
up front. Site configuration travels with the slot during a swap, so the path
reaches production together with the build that actually serves it. Pointing
production's probe at a route the *currently running* build does not have would
make App Service recycle a healthy instance.

```bash
# Inspect the configured path
az webapp config show \
  --name portal365 --resource-group Portal360 \
  --query healthCheckPath -o tsv
```

- [ ] Production health check path is `/api/health/ready`
- [ ] `WEBSITE_HEALTHCHECK_MAXPINGFAILURES` is set to a sane value (default 10)

> **Regression to avoid:** the health check was previously set to `/health`, a path
> the application has never served. It returned 404 on every probe, so Health Check
> reported permanent failure and provided no protection at all. Whenever the probe
> path changes, curl it against a running instance before saving.

---

## Production Deployment

### 1. Pre-Deployment Checklist

**Verify ALL items are complete**:

- [ ] App registration configured
- [ ] All API permissions granted
- [ ] Azure roles assigned
- [ ] Power Platform access configured
- [ ] Secrets in Key Vault
- [ ] App Service application settings present (`NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID`) — the deploy workflow fails without them, see [Verify Configuration](#3-verify-configuration)
- [ ] Staging slot `test` carries every swappable production app setting — see [Slot app settings](#3-slot-app-settings--the-swap-hazard)
- [ ] Health check path is `/api/health/ready` and returns 200 on a running instance
- [ ] Production dependency verification opt-in is sticky, production `1` and staging `0`; required backend access is provisioned independently
- [ ] Staging testing completed successfully
- [ ] Monitoring and alerts configured
- [ ] Documentation updated
- [ ] Team trained on application
- [ ] Rollback plan documented
- [ ] Incident response plan in place

### 2. Deployment Window

Slot-based deployment removes the stop/start outage, so a maintenance window is no
longer required for the deployment itself. Still schedule an owner for the release.

- [ ] Date: `_______________`
- [ ] Time: `_______________`
- [ ] On-call engineer: `_______________`
- [ ] Rollback engineer: `_______________`

### 3. Deployment Steps

**Azure App Service (normal path — CI):**

Merging to `main` runs `.github/workflows/azure-app-service-deploy.yml`, which is the
supported way to deploy. It performs, in order:

1. Quality and security gate (same job that runs on every pull request)
2. Build, then package `.next/standalone` into `deploy.zip`
3. Preflight — required settings present on the slot, slot/production settings parity, and sticky production dependency opt-in
4. Publish `deploy.zip` to the **`test` slot** (production untouched, still serving)
5. Poll `https://<slot-host>/api/health/ready` until 200, for up to 10 minutes
6. **Swap** `test` into production
7. Verify `https://<prod-host>/api/health/dependencies` returns 200 with
   `status: "verified"`, required backend outcomes, and the deployed commit;
   **swap back automatically** if it does not
8. Confirm production's health check path

If any step before the swap fails, production is never touched and keeps serving the
previous build.

**Manual deployment (break-glass only):**

```bash
# 1. Build and package
pnpm run build

# 2. Publish to the staging slot — never directly to production
az webapp deploy \
  --resource-group Portal360 --name portal365 --slot test \
  --src-path deploy.zip --type zip

# 3. Gate on readiness before swapping
SLOT_HOST=$(az webapp show --name portal365 --resource-group Portal360 \
  --slot test --query defaultHostName -o tsv)
curl -fsS "https://${SLOT_HOST}/api/health/ready"

# 4. Swap into production
az webapp deployment slot swap \
  --resource-group Portal360 --name portal365 \
  --slot test --target-slot production
```

> Do not `az webapp stop` / `az webapp restart` production as part of a deployment.
> That was the previous approach; it caused a hard outage and left no rollback target.

Application settings are **not** managed by CI. They are set manually (see
[Application Configuration](#application-configuration)); the workflow only verifies
that the required ones exist and that the slot matches production.

**For Docker/Kubernetes**:

1. [ ] Build Docker image:
   ```bash
   docker build -t portal360:latest .
   ```

2. [ ] Push to container registry:
   ```bash
   docker push yourregistry.azurecr.io/portal360:latest
   ```

3. [ ] Deploy to Kubernetes:
   ```bash
   kubectl apply -f k8s/deployment.yaml
   kubectl rollout status deployment/portal360
   ```

### 4. Post-Deployment Smoke Test

**Immediately after deployment**:

- [ ] Application URL is accessible
- [ ] Login page loads
- [ ] Can authenticate successfully
- [ ] Home page displays without errors
- [ ] Critical pages load (users, groups, environments)
- [ ] Check Application Insights for errors
- [ ] Monitor for 15 minutes

---

## Post-Deployment Verification

### 1. Functional Testing (Production)

**Test with real production user accounts**:

- [ ] Admin user can sign in
- [ ] Standard user can sign in
- [ ] Users page displays production data
- [ ] Groups page displays correct groups
- [ ] Power Platform environments are listed
- [ ] Azure resources query works
- [ ] Reports generate with production data
- [ ] Audit logs display correctly

### 2. Performance Verification

- [ ] Measure page load times:
  - [ ] Home page: `_______` seconds (target: < 2s)
  - [ ] Users page: `_______` seconds (target: < 3s)
  - [ ] Power Platform: `_______` seconds (target: < 5s)
- [ ] Check Application Insights for:
  - [ ] Average response time: `_______` ms (target: < 500ms)
  - [ ] Failed requests: `_______` (target: 0)

### 3. Security Verification

- [ ] No secrets visible in browser Network tab
- [ ] HTTPS enforced (no HTTP)
- [ ] Security headers present (X-Frame-Options, etc.)
- [ ] Authentication required for all pages
- [ ] Session timeout works correctly

### 4. Monitoring Verification

- [ ] Application Insights receiving telemetry
- [ ] Logs appearing in Log Analytics workspace
- [ ] Alerts configured and active
- [ ] Dashboard showing real-time metrics

---

## Rollback Plan

### Rolling back an App Service release (swap back)

**A swap is reversible.** After a deployment swaps `test` into production, the build
that production was previously running is still live in the `test` slot. Swapping
again exchanges them back, which restores the previous release in seconds without a
rebuild, a redeploy, or a restart.

```bash
az webapp deployment slot swap \
  --resource-group Portal360 \
  --name portal365 \
  --slot test \
  --target-slot production
```

The workflow prints this exact command in its run summary, and runs it automatically
if production fails its post-swap readiness check.

**Verify the rollback:**

```bash
PROD_HOST=$(az webapp show --name portal365 --resource-group Portal360 \
  --query defaultHostName -o tsv)
curl -i "https://${PROD_HOST}/api/health/ready"   # expect 200 {"status":"ready", ...}
```

- [ ] `/api/health/ready` returns 200
- [ ] Users can sign in
- [ ] Critical pages load (users, groups, environments)
- [ ] Application Insights error rate back to baseline

#### The one-swap rule

The staging slot holds exactly **one** previous build. This has two consequences:

1. **Roll back before deploying again.** Any new deployment overwrites the `test`
   slot and destroys the rollback target. If production is broken, swap back
   *first*, then investigate.
2. **Do not swap twice to "go back further."** A second swap-back just returns the
   broken build to production. To go further back, redeploy the known-good commit
   through the normal workflow — re-run the deploy workflow against that commit
   rather than swapping.

If someone has already redeployed and the rollback target is gone, re-run
`.github/workflows/azure-app-service-deploy.yml` (workflow_dispatch) from the last
known-good commit. That path is slower — a full build — but it is gated by the same
readiness check.

#### App settings do not roll back with a swap

Swapping restores the previous *code and configuration that travels with the slot*.
It does **not** undo an app setting you changed directly on production after the
deployment, and it does not restore a sticky setting. If the incident was caused by
a settings change, revert that change explicitly.

### If the deployment never reached production

When the workflow fails **before** the swap — a failed preflight, or a staging slot
that never reported ready — production was never modified and no rollback is needed.
Read the slot's logs and fix forward:

```bash
az webapp log tail --name portal365 --resource-group Portal360 --slot test
```

### Other platforms

**Kubernetes**:
```bash
kubectl rollout undo deployment/portal360
```

### Document the incident

- [ ] What went wrong?
- [ ] What was the impact?
- [ ] How long was service degraded?
- [ ] What steps were taken?
- [ ] Did the readiness check catch it? If not, what check would have?

### Rollback Decision Criteria

**Roll back immediately if**:
- Users cannot sign in
- Critical data not loading (users, groups, environments)
- Widespread errors (> 10% of requests failing)
- Security issue discovered
- Data corruption detected

**Investigate first if**:
- Minor cosmetic issues
- Single user reporting issue
- Performance slightly degraded but acceptable
- Non-critical feature broken

---

## Communication Plan

### Pre-Deployment Communication

**1 week before**:
- [ ] Email to all users announcing deployment
- [ ] Include:
  - Deployment date and time
  - Expected downtime (if any)
  - New features/changes
  - Support contact information

**1 day before**:
- [ ] Reminder email
- [ ] Final testing window for stakeholders

### During Deployment

- [ ] Status page updated (if available)
- [ ] Real-time updates in team chat
- [ ] Incident bridge open (if needed)

### Post-Deployment Communication

**Within 1 hour**:
- [ ] Email confirming successful deployment
- [ ] Known issues (if any)
- [ ] How to report problems

**Within 24 hours**:
- [ ] Summary report:
  - Deployment timeline
  - Any issues encountered
  - Resolution steps
  - Lessons learned

---

## Documentation Updates

**After successful deployment**:

- [ ] Update README.md with production URL
- [ ] Update environment variable documentation
- [ ] Document any production-specific configurations
- [ ] Create runbook for common operations
- [ ] Update architecture diagrams (if changed)
- [ ] Document troubleshooting steps for production issues
- [ ] Create user guide or training materials

---

## Ongoing Maintenance

### Weekly Tasks

- [ ] Review Application Insights for errors
- [ ] Check performance metrics
- [ ] Review security alerts
- [ ] Verify backup jobs (if applicable)

### Monthly Tasks

- [ ] Review and rotate logs
- [ ] Update dependencies:
  ```bash
  pnpm audit
  pnpm outdated
  pnpm update
  ```
- [ ] Review Azure costs
- [ ] Test disaster recovery procedures
- [ ] Review access logs for suspicious activity

### Quarterly Tasks

- [ ] Review and update API permissions (if needed)
- [ ] Review Azure role assignments
- [ ] Update documentation
- [ ] Conduct security review
- [ ] Load test production environment
- [ ] Review and update incident response plan

### Annual Tasks

- [ ] Rotate client secret (before expiration!)
- [ ] Review architecture for improvements
- [ ] Major version upgrades (Next.js, React, etc.)
- [ ] Comprehensive security audit
- [ ] Disaster recovery drill

---

## Appendix: Contact Information

### Key Personnel

| Role | Name | Email | Phone | Backup |
|------|------|-------|-------|--------|
| Azure Administrator | _______ | _______ | _______ | _______ |
| Application Owner | _______ | _______ | _______ | _______ |
| Security Lead | _______ | _______ | _______ | _______ |
| DevOps Engineer | _______ | _______ | _______ | _______ |
| On-Call Engineer | _______ | _______ | _______ | _______ |

### Support Contacts

- **IT Help Desk**: helpdesk@company.com | +1-555-0100
- **Security Team**: security@company.com | +1-555-0200
- **DevOps Team**: devops@company.com | +1-555-0300

### External Contacts

- **Microsoft Support**: [Azure Support Portal](https://portal.azure.com/#blade/Microsoft_Azure_Support/HelpAndSupportBlade)
- **Microsoft Premier Support**: +1-800-MICROSOFT (if applicable)

---

## Sign-Off

**Deployment approved by**:

| Role | Name | Signature | Date |
|------|------|-----------|------|
| IT Manager | _______ | _______ | _______ |
| Security Manager | _______ | _______ | _______ |
| Application Owner | _______ | _______ | _______ |

**Deployment executed by**:

| Role | Name | Signature | Date |
|------|------|-----------|------|
| DevOps Engineer | _______ | _______ | _______ |

---

**Document Version:** 1.0  
**Last Updated:** November 1, 2025  
**Next Review Date:** February 1, 2026

For detailed API configuration, see [API-DOCUMENTATION.md](./API-DOCUMENTATION.md).  
For troubleshooting assistance, see [TROUBLESHOOTING.md](./TROUBLESHOOTING.md).
