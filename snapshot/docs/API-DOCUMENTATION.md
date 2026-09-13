# API Documentation for Portal 360°

**Last Updated:** May 2, 2026  
**Version:** 2.0

> **Auth audit:** See [`docs/API-AUTH-AUDIT.md`](./API-AUTH-AUDIT.md) for the complete per-route authentication record (702 routes, 100% protected).  
> **Route reference:** See [`docs/API-ENDPOINTS-REFERENCE.md`](./API-ENDPOINTS-REFERENCE.md) for the endpoint quick-reference guide.

## Table of Contents

1. [Overview](#overview)
2. [Authentication Architecture](#authentication-architecture)
3. [Environment Configuration](#environment-configuration)
4. [Microsoft Graph API](#microsoft-graph-api)
5. [Azure Resource Manager API](#azure-resource-manager-api)
6. [Power Platform API](#power-platform-api)
7. [Dataverse API](#dataverse-api)
8. [Microsoft Entra ID (Azure AD)](#microsoft-entra-id-azure-ad)
9. [Application Insights (via Azure Monitor Logs)](#application-insights-via-azure-monitor-logs)
10. [Log Analytics API](#log-analytics-api)
11. [Internal API Routes](#internal-api-routes)
12. [Microsoft Defender for Endpoint API](#microsoft-defender-for-endpoint-api)
13. [Microsoft Graph Reports API](#microsoft-graph-reports-api)
14. [Windows Update State API (Intune)](#windows-update-state-api-intune)
15. [ServiceNow Integration API](#servicenow-integration-api)
16. [Required Permissions Summary](#required-permissions-summary)
17. [Troubleshooting](#troubleshooting)

---

## Overview

Portal 360° is a Next.js application that integrates with multiple Microsoft cloud services to provide a unified administration portal for:

- **Microsoft 365** (via Microsoft Graph)
- **Azure** (via Azure Resource Manager)
- **Power Platform** (via Power Platform API and Dataverse)
- **Microsoft Entra ID** (formerly Azure AD)
- **Security & Compliance** (Defender, Sentinel, Intune)

This document provides IT administrators with detailed information about all external API endpoints, authentication mechanisms, required permissions, and configuration steps.

---

## Authentication Architecture

### Official Microsoft Documentation

**Power Platform Authentication**: [Authenticate to Power Platform services](https://learn.microsoft.com/en-us/power-platform/admin/security/authenticate-services)

This Microsoft Learn article is the authoritative reference for Power Platform authentication patterns, including:
- **OAuth 2.0 flows**: Authorization code, client credentials, On-Behalf-Of (OBO)
- **Token acquisition**: Service-to-service, delegated user access, refresh token exchange
- **API permissions**: Required scopes for Power Platform APIs
- **Security best practices**: Token caching, expiration handling, error retry logic

Portal 360° implements the patterns described in this guide, specifically using:
1. **Authorization Code Flow** for initial user authentication via NextAuth.js
2. **On-Behalf-Of (OBO) Flow** for acquiring Power Platform API tokens while maintaining user context
3. **Refresh Token Exchange** as fallback when OBO tokens expire

### Authentication Flow

Portal 360° uses **NextAuth.js** with the Azure AD provider for user authentication and **MSAL (Microsoft Authentication Library)** for server-side token acquisition.

#### Flow Diagram:

```
User Browser
    ↓ (1) Login request
NextAuth.js (Frontend)
    ↓ (2) OAuth redirect to Microsoft Entra ID
Microsoft Entra ID
    ↓ (3) User authenticates
    ↓ (4) Returns authorization code
NextAuth.js
    ↓ (5) Exchanges code for tokens (access, id, refresh)
    ↓ (6) Stores tokens in JWT session
API Routes (Server)
    ↓ (7) Uses tokens to acquire resource-specific tokens via:
    ├── On-Behalf-Of (OBO) flow
    ├── Refresh token exchange
    └── Client credentials flow
External APIs (Graph, ARM, Power Platform)
```

### Token Types

1. **Access Token**: Short-lived token for user-delegated API access
2. **ID Token**: Contains user identity claims
3. **Refresh Token**: Long-lived token for acquiring new access tokens
4. **Resource-Specific Tokens**: Acquired via OBO or client credentials for specific APIs

---

## Environment Configuration

### Required Environment Variables

Create a `.env.local` file in the project root with the following variables:

```bash
# ============================================
# NEXTAUTH CONFIGURATION
# ============================================
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<random-secret-string>
# Generate with: openssl rand -base64 32

# ============================================
# MICROSOFT ENTRA ID (AZURE AD) APP REGISTRATION
# ============================================
AZURE_CLIENT_ID=<your-app-registration-client-id>
AZURE_CLIENT_SECRET=<your-app-registration-client-secret>
AZURE_TENANT_ID=<your-tenant-id>

# Alternative environment variable names (NextAuth v5 compatibility)
AUTH_AZURE_AD_CLIENT_ID=<your-app-registration-client-id>
AUTH_AZURE_AD_CLIENT_SECRET=<your-app-registration-client-secret>
AUTH_AZURE_AD_TENANT_ID=<your-tenant-id>
AUTH_SECRET=<random-secret-string>

# ============================================
# AZURE SUBSCRIPTION (Optional - for Azure Resource Graph)
# ============================================
AZURE_SUBSCRIPTION_ID=<your-subscription-id>

# ============================================
# HUMAN-IN-THE-LOOP CONNECTOR (Optional)
# ============================================
# Shared secret for custom connector server-to-server calls.
# Keep server-side only; never expose it to browser code.
PORTAL360_HITL_CONNECTOR_SECRET=<random-shared-secret>

# ============================================
# OPTIONAL: DEFENDER FOR CLOUD
# ============================================
DEFENDER_MANAGEMENT_SCOPE=https://management.azure.com/.default
```

### Environment Variable Locations

| Variable | Storage Location | Purpose |
|----------|------------------|---------|
| `NEXTAUTH_URL` | `.env.local` (local) / App Service Settings (Azure) | Base URL of the application |
| `NEXTAUTH_SECRET` / `AUTH_SECRET` | `.env.local` (local) / Azure Key Vault (recommended for production) | JWT encryption secret |
| `AZURE_CLIENT_ID` | `.env.local` (local) / Azure Key Vault (production) | Application (client) ID from app registration |
| `AZURE_CLIENT_SECRET` | `.env.local` (local) / Azure Key Vault (production) | Client secret from app registration |
| `AZURE_TENANT_ID` | `.env.local` (local) / App Service Settings | Microsoft Entra ID tenant ID |
| `AZURE_SUBSCRIPTION_ID` | `.env.local` (local) / App Service Settings | Azure subscription for resource queries |
| `PORTAL360_HITL_CONNECTOR_SECRET` | `.env.local` (local) / Key Vault or App Service Settings (production) | Optional shared secret for custom connector server-to-server human review requests |

### Application Registration Setup

#### Step 1: Create App Registration

1. Navigate to [Azure Portal](https://portal.azure.com)
2. Go to **Microsoft Entra ID** > **App registrations** > **New registration**
3. Configure:
   - **Name**: `Portal 360 Admin Portal`
   - **Supported account types**: Accounts in this organizational directory only (Single tenant)
   - **Redirect URI**: 
     - Type: Web
     - URI: `https://your-domain.com/api/auth/callback/azure-ad` (production)
     - URI: `http://localhost:3000/api/auth/callback/azure-ad` (development)

#### Step 2: Configure Authentication

1. In the app registration, go to **Authentication**
2. Add additional redirect URIs if needed
3. Under **Implicit grant and hybrid flows**, enable:
   - ✅ ID tokens (used for implicit and hybrid flows)
4. Under **Advanced settings**:
   - Allow public client flows: **No**

#### Step 3: Create Client Secret

1. Go to **Certificates & secrets** > **Client secrets** > **New client secret**
2. Description: `Portal360-Production-Secret`
3. Expires: Choose appropriate expiration (recommended: 24 months)
4. **Copy the secret value immediately** and store it securely in Azure Key Vault or `.env.local`

#### Step 4: Configure API Permissions

Navigate to **API permissions** and add the following delegated permissions:

---

## Microsoft Graph API

**Base URL:** `https://graph.microsoft.com/v1.0`  
**Documentation:** [Microsoft Graph REST API Reference](https://learn.microsoft.com/en-us/graph/api/overview)

### Authentication

- **Method**: OAuth 2.0 delegated flow — the user's access token (acquired at login) is used to make Graph API calls server-side
- **Token Scope**: `https://graph.microsoft.com/.default`
- **Token Acquisition**: At login only `openid profile email offline_access User.Read` are requested. Additional Graph permissions are granted via admin consent in the app registration; they are used with the stored refresh/access token via `getDelegatedGraphClient()` / `getGraphClientForUser()`. **App-only (client-credentials) Graph tokens are reserved for the background jobs listed in [`APP-ONLY-JOBS.md`](./APP-ONLY-JOBS.md).**
- **Token Lifetime**: Typically 60-90 minutes; refreshed automatically via `tokenStore`
- **Token Storage**: Server-side only (Redis in production, in-memory in dev) — never in the browser

### Required API Permissions (Delegated)

Configure these in your app registration under **API permissions** > **Microsoft Graph** > **Delegated permissions**:

| Permission | Type | Reason | Admin Consent Required |
|------------|------|--------|----------------------|
| `User.Read` | Delegated | Read signed-in user's profile | No |
| `User.Read.All` | Delegated | Read all users' full profiles | Yes |
| `User.ReadWrite.All` | Delegated | Create and manage users (includes read) | Yes |
| `Directory.Read.All` | Delegated | Read directory data (users, groups, apps) | Yes |
| `Directory.ReadWrite.All` | Delegated | Write directory data | Yes |
| `AuditLog.Read.All` | Delegated | Read audit logs, sign-in logs, provisioning logs | Yes |
| `Group.Read.All` | Delegated | Read all groups | Yes |
| `Group.ReadWrite.All` | Delegated | Manage groups and members | Yes |
| `GroupMember.Read.All` | Delegated | Read group membership | Yes |
| `Application.Read.All` | Delegated | Read applications and service principals | Yes |
| `Application.ReadWrite.All` | Delegated | Manage applications and service principals (includes read) | Yes |
| `Sites.Read.All` | Delegated | Read SharePoint sites | Yes |
| `Sites.ReadWrite.All` | Delegated | Manage SharePoint sites | Yes |
| `Files.Read.All` | Delegated | Read all files (OneDrive) | Yes |
| `Reports.Read.All` | Delegated | Read all M365 usage reports | Yes |
| `SecurityEvents.Read.All` | Delegated | Read security events and alerts | Yes |
| `SecurityIncident.Read.All` | Delegated | Read security incidents | Yes |
| `IdentityRiskEvent.Read.All` | Delegated | Read identity risk events | Yes |
| `IdentityRiskyUser.Read.All` | Delegated | Read risky users | Yes |
| `IdentityRiskyServicePrincipal.Read.All` | Delegated | Read risky service principals | Yes |
| `DeviceManagementManagedDevices.Read.All` | Delegated | Read Intune managed devices | Yes |
| `DeviceManagementManagedDevices.ReadWrite.All` | Delegated | Perform device actions (sync, restart, retire) | Yes |
| `DeviceManagementConfiguration.Read.All` | Delegated | Read device configuration policies | Yes |
| `DeviceManagementConfiguration.ReadWrite.All` | Delegated | Manage device configuration | Yes |
| `DeviceManagementApps.Read.All` | Delegated | Read Intune app management | Yes |
| `DeviceManagementRBAC.Read.All` | Delegated | Read Intune RBAC | Yes |
| `Policy.Read.All` | Delegated | Read conditional access and other policies | Yes |
| `Policy.ReadWrite.ConditionalAccess` | Delegated | Manage conditional access policies | Yes |
| `Organization.Read.All` | Delegated | Read tenant/organization info | Yes |
| `RoleManagement.Read.Directory` | Delegated | Read directory roles and PIM assignments | Yes |
| `RoleManagement.ReadWrite.Directory` | Delegated | Manage PIM role assignments | Yes |
| `PrivilegedAccess.Read.AzureAD` | Delegated | Read PIM privileged access | Yes |
| `PrivilegedAccess.ReadWrite.AzureAD` | Delegated | Manage PIM role activation and assignment | Yes |
| `AccessReview.Read.All` | Delegated | Read identity governance access reviews | Yes |
| `EntitlementManagement.Read.All` | Delegated | Read entitlement access packages | Yes |
| `EntitlementManagement.ReadWrite.All` | Delegated | Manage access packages | Yes |
| `Team.ReadBasic.All` | Delegated | List all teams | Yes |
| `Team.Create` | Delegated | Create teams | Yes |
| `TeamMember.Read.All` | Delegated | Read team members | Yes |
| `TeamMember.ReadWrite.All` | Delegated | Manage team members | Yes |
| `OnlineMeetingTranscript.Read.All` | Delegated | Read meeting transcripts | Yes |
| `CallTranscripts.Read.All` | Delegated | Subscribe to call transcript webhooks | Yes |
| `Mail.Read` | Delegated | Read mailbox/message metadata | Yes |
| `MailboxSettings.Read` | Delegated | Read mailbox settings | Yes |
| `InformationProtectionPolicy.Read` | Delegated | Read Purview labels | Yes |
| `LicenseAssignment.ReadWrite.All` | Delegated | Manage license assignments | Yes |
| `UserAuthenticationMethod.Read.All` | Delegated | Read auth methods (MFA status) | Yes |
| `ServiceHealth.Read.All` | Delegated | Read M365 service health | Yes |
| `ServiceMessage.Read.All` | Delegated | Read service health messages | Yes |
| `SharePointTenantSettings.Read.All` | Delegated | Read SharePoint tenant settings | Yes |
| `WindowsUpdates.Read.All` | Delegated | Read the Windows Update for Business deployment service catalog. Also requires the signed-in user to hold *Intune Administrator*, *Windows Update Deployment Administrator*, or *Global Administrator* | Yes |
| `WindowsUpdates.ReadWrite.All` | Delegated | Manage Windows Update rings and policies | Yes |
| `offline_access` | Delegated | Maintain access to data (refresh tokens) | No |
| `openid` | Delegated | Sign in and read user profile | No |
| `profile` | Delegated | View users' basic profile | No |
| `email` | Delegated | View users' email address | No |

### Common Endpoints Used

#### Users

- **List Users**: `GET /users`
  - **File**: `src/app/api/users/route.ts`
  - **Purpose**: Retrieve all users in the tenant
  - **Query Parameters**: `$select`, `$filter`, `$top`, `$skip`, `$orderby`, `$expand`
  - **Documentation**: [List users](https://learn.microsoft.com/en-us/graph/api/user-list)

- **Get User**: `GET /users/{id}`
  - **File**: `src/app/api/user-details/route.ts`
  - **Purpose**: Get specific user details
  - **Documentation**: [Get user](https://learn.microsoft.com/en-us/graph/api/user-get)

- **Create User**: `POST /users`
  - **File**: `src/app/api/users/create-user/route.ts`
  - **Purpose**: Create a new user
  - **Documentation**: [Create user](https://learn.microsoft.com/en-us/graph/api/user-post-users)

- **Get User Sign-in Activity**: `GET /users/{id}?$select=signInActivity`
  - **File**: Multiple user-related routes
  - **Documentation**: [signInActivity resource type](https://learn.microsoft.com/en-us/graph/api/resources/signinactivity)

#### Groups

- **List Groups**: `GET /groups`
  - **File**: `src/app/groups/page.tsx`
  - **Purpose**: Retrieve all groups
  - **Documentation**: [List groups](https://learn.microsoft.com/en-us/graph/api/group-list)

#### Applications

- **List Applications**: `GET /applications`
  - **File**: `src/app/applications/page.tsx`
  - **Purpose**: List app registrations
  - **Documentation**: [List applications](https://learn.microsoft.com/en-us/graph/api/application-list)

- **Add Password Credential**: `POST /applications/{id}/addPassword`
  - **File**: `src/app/api/applications/[id]/credentials/route.ts`
  - **Purpose**: Create client secret
  - **Documentation**: [application: addPassword](https://learn.microsoft.com/en-us/graph/api/application-addpassword)

- **Remove Password Credential**: `POST /applications/{id}/removePassword`
  - **File**: `src/app/api/applications/[id]/remove-password/route.ts`
  - **Purpose**: Delete client secret
  - **Documentation**: [application: removePassword](https://learn.microsoft.com/en-us/graph/api/application-removepassword)

#### Audit Logs

- **Directory Audit Logs**: `GET /auditLogs/directoryAudits`
  - **File**: `src/app/audit-logs/page.tsx`
  - **Purpose**: Retrieve audit log entries
  - **Query Parameters**: `$filter`, `$top`, `$orderby`
  - **Documentation**: [List directoryAudits](https://learn.microsoft.com/en-us/graph/api/directoryaudit-list)

- **Sign-in Logs**: `GET /auditLogs/signIns`
  - **File**: `src/app/api/user-signins/route.ts`
  - **Purpose**: Retrieve user sign-in logs
  - **Documentation**: [List signIns](https://learn.microsoft.com/en-us/graph/api/signin-list)

- **Provisioning Logs**: `GET /auditLogs/provisioning`
  - **File**: `src/app/api/provisioning-logs/route.ts`
  - **Purpose**: Retrieve provisioning logs
  - **Documentation**: [List provisioningObjectSummary](https://learn.microsoft.com/en-us/graph/api/provisioningobjectsummary-list)

#### Reports

- **Microsoft 365 Active User Counts**: `GET /reports/getOffice365ActiveUserCounts(period='D7')`
  - **File**: `src/app/api/reports/**/route.ts`
  - **Documentation**: [getOffice365ActiveUserCounts](https://learn.microsoft.com/en-us/graph/api/reportroot-getoffice365activeuserdetail)

- **Teams User Activity**: `GET /reports/getTeamsUserActivityUserDetail(period='D7')`
  - **File**: `src/app/api/teams/user-activity/route.ts`
  - **Documentation**: [getTeamsUserActivityUserDetail](https://learn.microsoft.com/en-us/graph/api/reportroot-getteamsuseractivityuserdetail)

#### Security

- **Secure Score**: `GET /security/secureScores`
  - **File**: `src/app/api/secure-score/route.ts`
  - **Purpose**: Retrieve Microsoft Secure Score
  - **Documentation**: [List secureScores](https://learn.microsoft.com/en-us/graph/api/security-list-securescores)

- **Security Alerts**: `GET /security/alerts_v2`
  - **File**: Multiple security routes
  - **Documentation**: [List alerts](https://learn.microsoft.com/en-us/graph/api/security-list-alerts_v2)

- **Risky Users**: `GET /identityProtection/riskyUsers`
  - **File**: `src/app/api/risky-users/route.ts`
  - **Documentation**: [List riskyUsers](https://learn.microsoft.com/en-us/graph/api/riskyuser-list)

#### Service Health

- **Service Health**: `GET /admin/serviceAnnouncement/healthOverviews`
  - **File**: `src/app/service-health/page.tsx`
  - **Purpose**: Get service health status
  - **Documentation**: [List serviceHealths](https://learn.microsoft.com/en-us/graph/api/serviceannouncement-list-healthoverviews)

- **Service Issues**: `GET /admin/serviceAnnouncement/issues`
  - **Documentation**: [List issues](https://learn.microsoft.com/en-us/graph/api/serviceannouncement-list-issues)

#### SharePoint

- **SharePoint Admin Settings**: `GET /admin/sharepoint/settings`
  - **File**: `src/app/api/sharepoint/sites/route.ts`
  - **Purpose**: Get SharePoint tenant settings
  - **Documentation**: [Get settings](https://learn.microsoft.com/en-us/graph/api/sharepointsettings-get)

- **List Sites**: `GET /sites?search=*`
  - **Documentation**: [Search for sites](https://learn.microsoft.com/en-us/graph/api/site-search)

#### Intune (Device Management)

- **List Managed Devices**: `GET /deviceManagement/managedDevices`
  - **File**: `src/app/devices/page.tsx`
  - **Purpose**: Get all Intune-managed devices
  - **Documentation**: [List managedDevices](https://learn.microsoft.com/en-us/graph/api/intune-devices-manageddevice-list)

### Client Implementation

**File**: `src/lib/graphClient.ts` and `src/lib/delegatedGraph.ts`

```javascript
// Example: Acquiring a delegated (OBO) Graph token for the signed-in user.
// This is the mandatory pattern — client_credentials is reserved for the
// declared background jobs in docs/APP-ONLY-JOBS.md.
import { getDelegatedGraphToken } from '@/lib/delegatedGraph'

const accessToken = await getDelegatedGraphToken()
// Throws DelegatedAuthRequiredError, which toClientErrorResponse() maps to
// 401 { error: 'reauth_required' }.

```

### Rate Limits

- **Throttling Threshold**: Varies by endpoint (typically 1,000-10,000 requests per minute per app)
- **Response Header**: `Retry-After` (in seconds)
- **Best Practice**: Implement exponential backoff on 429 (Too Many Requests) responses
- **Documentation**: [Microsoft Graph throttling guidance](https://learn.microsoft.com/en-us/graph/throttling)

---

## Azure Resource Manager API

**Base URL:** `https://management.azure.com`  
**Documentation:** [Azure REST API Reference](https://learn.microsoft.com/en-us/rest/api/azure/)

### Authentication

- **Method**: OAuth 2.0 Client Credentials flow
- **Token Scope**: `https://management.azure.com/.default`
- **Token Acquisition**: Via client credentials (app-only authentication)
- **Token Lifetime**: Typically 60-90 minutes

### Required API Permissions (Application)

Configure these in your app registration under **API permissions** > **Azure Service Management** > **Delegated permissions**:

| Permission | Type | Reason | Admin Consent Required |
|------------|------|--------|----------------------|
| `user_impersonation` | Delegated | Access Azure Resource Manager as the signed-in user | No |

Additionally, assign the application appropriate **Azure RBAC roles** at the subscription or resource group level:

| Azure Role | Scope | Reason |
|------------|-------|--------|
| **Reader** | Subscription | Read Azure resources and resource groups |
| **Contributor** | Subscription (optional) | Manage Azure resources |
| **Security Reader** | Subscription | Read security policies and states |

#### How to Assign Azure Roles

1. Navigate to [Azure Portal](https://portal.azure.com)
2. Go to **Subscriptions** > Select your subscription
3. Click **Access control (IAM)** > **Add role assignment**
4. Select role: **Reader**
5. Assign access to: **User, group, or service principal**
6. Search for your app registration name: `Portal 360 Admin Portal`
7. Click **Save**

### Common Endpoints Used

#### Subscriptions

- **List Subscriptions**: `GET /subscriptions?api-version=2020-01-01`
  - **File**: `src/app/billing/page.tsx`
  - **Purpose**: List all accessible subscriptions
  - **Documentation**: [Subscriptions - List](https://learn.microsoft.com/en-us/rest/api/resources/subscriptions/list)

#### Azure Resource Graph

- **Query Resources**: `POST /providers/Microsoft.ResourceGraph/resources?api-version=2024-04-01`
  - **File**: `src/app/api/resource-graph/route.ts`
  - **Purpose**: Query Azure resources using KQL (Kusto Query Language)
  - **Request Body**:
    ```json
    {
      "query": "Resources | where type == 'microsoft.compute/virtualmachines' | project name, location",
      "subscriptions": ["<subscription-id>"]
    }
    ```
  - **Documentation**: [Azure Resource Graph REST API](https://learn.microsoft.com/en-us/rest/api/azureresourcegraph/resourcegraph(2021-03-01)/resources/resources)

#### Azure Advisor

- **List Recommendations**: `GET /subscriptions/{subscriptionId}/providers/Microsoft.Advisor/recommendations?api-version=2023-01-01`
  - **File**: `src/app/api/azure-advisor-list/route.ts`
  - **Purpose**: Get Azure Advisor recommendations
  - **Documentation**: [Recommendations - List](https://learn.microsoft.com/en-us/rest/api/advisor/recommendations/list)

- **Get Advisor Score**: `GET /subscriptions/{subscriptionId}/providers/Microsoft.Advisor/advisorScore?api-version=2023-01-01`
  - **File**: `src/app/api/azure-advisor-score/route.ts`
  - **Documentation**: [Advisor Score](https://learn.microsoft.com/en-us/rest/api/advisor/advisor-score)

#### Cost Management

- **Query Costs**: `POST /subscriptions/{subscriptionId}/providers/Microsoft.CostManagement/query?api-version=2023-03-01`
  - **File**: `src/app/billing/page.tsx`
  - **Purpose**: Query cost and usage data
  - **Request Body**:
    ```json
    {
      "type": "ActualCost",
      "timeframe": "MonthToDate",
      "dataset": {
        "granularity": "Daily",
        "aggregation": {
          "totalCost": { "name": "Cost", "function": "Sum" }
        }
      }
    }
    ```
  - **Documentation**: [Query API](https://learn.microsoft.com/en-us/rest/api/cost-management/query/usage)

- **Usage Details**: `GET /subscriptions/{subscriptionId}/providers/Microsoft.Consumption/usageDetails?api-version=2024-08-01`
  - **Documentation**: [Usage Details - List](https://learn.microsoft.com/en-us/rest/api/consumption/usage-details/list)

#### Security (Microsoft Defender for Cloud)

- **List Security Assessments**: `GET /providers/Microsoft.Security/assessments?api-version=2024-09-01`
  - **File**: `src/app/api/security/assessments/route.ts`
  - **Purpose**: Get security recommendations from Defender for Cloud
  - **Documentation**: [Assessments - List](https://learn.microsoft.com/en-us/rest/api/defenderforcloud/assessments/list)

- **Get Assessment**: `GET /subscriptions/{subscriptionId}/providers/Microsoft.Security/assessments/{assessmentName}?api-version=2024-09-01`
  - **File**: `src/app/api/security/assessments/get/route.ts`
  - **Documentation**: [Assessments - Get](https://learn.microsoft.com/en-us/rest/api/defenderforcloud/assessments/get)

#### Log Analytics

- **List Workspaces**: `GET /subscriptions/{subscriptionId}/providers/Microsoft.OperationalInsights/workspaces?api-version=2023-09-01`
  - **File**: `src/app/api/log-analytics-workspaces/route.ts`
  - **Purpose**: List Log Analytics workspaces
  - **Documentation**: [Workspaces - List](https://learn.microsoft.com/en-us/rest/api/loganalytics/workspaces/list)

- **Query Workspace**: `POST /subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.OperationalInsights/workspaces/{workspaceName}/api/query?api-version=2023-09-01`
  - **File**: `src/app/api/log-analytics-query/route.ts`
  - **Purpose**: Execute KQL query against workspace
  - **Request Body**:
    ```json
    {
      "query": "AzureActivity | take 10",
      "timespan": "P1D"
    }
    ```
  - **Documentation**: [Query - Execute](https://learn.microsoft.com/en-us/rest/api/loganalytics/dataaccess/query/execute)

#### Application Insights

- **Query Application Insights**: `POST https://api.loganalytics.azure.com/v1/{armResourceId}/query`
  - **File**: `src/app/api/application-insights-query/route.ts` (via `src/lib/appInsightsQuery.ts`)
  - **Purpose**: Query Application Insights telemetry resource-centrically through Azure Monitor Logs
  - **Auth**: delegated token for `https://api.loganalytics.io` (`getLogAnalyticsTokenForUser`)
  - **Documentation**: [Querying logs for Azure resources](https://learn.microsoft.com/en-us/azure/azure-monitor/logs/api/azure-resource-queries)
  - **Note**: the component is addressed by ARM resource ID, not the Application ID
    GUID. The former `api.applicationinsights.io/v1/apps/{appId}/query` path was
    retired so the Application Insights API could be dropped from the app
    registration — see `docs/power-platform-api-permissions.md`.

- **Get Metrics**: `GET /subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Insights/components/{componentName}/api/metrics/{metricId}?api-version=2018-04-20`
  - **File**: `src/app/api/application-insights-metrics/route.ts`
  - **Documentation**: [Metrics - Get](https://learn.microsoft.com/en-us/rest/api/application-insights/metrics/get)

### Client Implementation

**File**: `src/lib/graphClient.ts`

```javascript
// Delegated (OBO) Azure Resource Manager token for the signed-in user.
// The ARM call is then evaluated against that user's Azure RBAC.
import { getAzureTokenForUser } from '@/lib/graphClient'

const token = await getAzureTokenForUser()
```

### Rate Limits

- **General Limit**: 12,000 requests per hour per subscription
- **Read Operations**: 15,000 requests per hour
- **Write Operations**: 1,200 requests per hour
- **Documentation**: [Azure Resource Manager request limits](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/request-limits-and-throttling)

---

## Power Platform API

**Base URL:** `https://api.powerplatform.com`  
**Documentation:** [Power Platform API Reference](https://learn.microsoft.com/en-us/power-platform/admin/programmability-overview)  
**Authentication Guide:** [Authenticate to Power Platform services](https://learn.microsoft.com/en-us/power-platform/admin/security/authenticate-services)

### Authentication

- **Method**: OAuth 2.0 On-Behalf-Of (OBO) flow
- **Token Scope**: `https://api.powerplatform.com/.default`
- **Token Acquisition**: Via MSAL OBO using user's access token or refresh token
- **Helper File**: `src/lib/ppToken.ts`
- **Reference Implementation**: Follows patterns from [Microsoft's authentication guide](https://learn.microsoft.com/en-us/power-platform/admin/security/authenticate-services)

#### Authentication Flow Details

Per Microsoft's official guidance, Portal 360° implements a **cascading token acquisition strategy**:

1. **Primary: On-Behalf-Of (OBO) with Access Token**
   - Exchanges the user's Graph API access token for a Power Platform token
   - Maintains user security context and permissions
   - Preferred method when access token is available and not expired

2. **Fallback 1: On-Behalf-Of (OBO) with ID Token**
   - Uses the OIDC ID token when access token exchange fails
   - Provides continuity when access token has expired

3. **Fallback 2: Refresh Token Exchange**
   - Direct token acquisition using the user's refresh token
   - Used when both OBO attempts fail (token expiry, network issues)
   - Requires `offline_access` scope in initial login

4. **Token Caching & Expiration**
   - Tokens cached with 5-minute expiration buffer
   - Automatic re-acquisition when tokens approach expiry
   - Reduces API calls and improves performance

This multi-tier approach ensures maximum reliability and follows Microsoft's recommended patterns for production deployments.

### Required API Permissions (Delegated)

No explicit API permissions need to be added to the app registration for Power Platform API. Authentication relies on:

1. **User Permissions**: The signed-in user must have appropriate Power Platform admin roles
2. **Token Exchange**: The app exchanges the user's Microsoft Entra ID token for a Power Platform token

#### Required Power Platform Roles

Assign the following roles to users in the [Power Platform Admin Center](https://admin.powerplatform.microsoft.com):

| Role | Purpose |
|------|---------|
| **Power Platform Administrator** | Full access to all Power Platform resources |
| **Dynamics 365 Administrator** | Manage Dynamics 365 and Dataverse environments |
| **Environment Administrator** | Manage specific environments |

### Common Endpoints Used

#### Environments

- **List Environments**: `GET /environmentmanagement/environments?api-version=2024-10-01`
  - **File**: `src/app/power-platform/page.tsx`
  - **Purpose**: List all Power Platform environments
  - **Response Includes**:
    - Environment ID, name, display name
    - State (enabled/disabled)
    - Type (production, sandbox, trial, etc.)
    - Dataverse instance URL
    - Capacity information
    - Add-ons and features
  - **Documentation**: [List environments](https://learn.microsoft.com/en-us/rest/api/power-platform/environmentmanagement/environments/get-environments)

- **Get Environment**: `GET /environmentmanagement/environments/{environmentId}?api-version=2024-10-01`
  - **Purpose**: Get details for a specific environment
  - **Documentation**: [Get environment](https://learn.microsoft.com/en-us/rest/api/power-platform/environmentmanagement/environments/get-environment)

- **Environment Management Settings**: `GET/POST/PATCH /environmentmanagement/environments/{environmentId}/settings?api-version=2024-10-01`
  - **File**: `src/app/api/power-platform/environment-management-settings/route.ts`
  - **Purpose**: List, create, and update environment management settings
  - **Documentation**: [Environment Management Settings](https://learn.microsoft.com/en-us/rest/api/power-platform/environmentmanagement/environment-management-settings)

- **List Environment Operations**: `GET /environmentmanagement/environments/{environmentId}/operations?api-version=2022-03-01-preview`
  - **File**: `src/app/api/power-platform/environmentmanagement/environments/[environmentId]/operations/route.ts`
  - **Purpose**: List long-running environment operations

- **Get Environment Operation**: `GET /environmentmanagement/environments/{environmentId}/operations/{operationId}?api-version=2022-03-01-preview`
  - **File**: `src/app/api/power-platform/environmentmanagement/environments/[environmentId]/operations/[operationId]/route.ts`
  - **Purpose**: Retrieve a specific operation status/detail

#### Environment Groups

- **List/Create Groups**: `GET/POST /environmentmanagement/environmentGroups?api-version=2022-03-01-preview`
  - **File**: `src/app/api/power-platform/environmentmanagement/environment-groups/route.ts`
  - **Purpose**: Create and enumerate environment groups

- **Get/Update/Delete Group**: `GET/PUT/DELETE /environmentmanagement/environmentGroups/{groupId}?api-version=2022-03-01-preview`
  - **File**: `src/app/api/power-platform/environmentmanagement/environment-groups/[groupId]/route.ts`
  - **Purpose**: Group lifecycle management

- **Add/Remove Environment Membership**:
  - `POST /environmentmanagement/environmentGroups/{groupId}/addEnvironment/{environmentId}?api-version=2022-03-01-preview`
  - `POST /environmentmanagement/environmentGroups/{groupId}/removeEnvironment/{environmentId}?api-version=2022-03-01-preview`
  - **Files**:
    - `src/app/api/power-platform/environmentmanagement/environment-groups/[groupId]/add-environment/[environmentId]/route.ts`
    - `src/app/api/power-platform/environmentmanagement/environment-groups/[groupId]/remove-environment/[environmentId]/route.ts`
  - **Purpose**: Manage environment-group membership and track resulting operations

#### App Management

- **List Environment Application Packages**: `GET /appmanagement/environments/{environmentId}/applicationPackages?api-version=2022-03-01-preview`
  - **File**: `src/app/api/power-platform/tenant-apps/route.ts`
  - **Purpose**: Discover installable first-party packages

- **Install Application Package**: `POST /appmanagement/environments/{environmentId}/applicationPackages/{uniqueName}/install?api-version=2022-03-01-preview`
  - **File**: `src/app/api/power-platform/appmanagement/environments/[environmentId]/application-packages/[uniqueName]/install/route.ts`
  - **Purpose**: Trigger package installation in an environment

- **Get Install Operation Status**: `GET /appmanagement/environments/{environmentId}/operations/{operationId}?api-version=2022-03-01-preview`
  - **File**: `src/app/api/power-platform/appmanagement/environments/[environmentId]/operations/[operationId]/route.ts`
  - **Purpose**: Poll installation operation until terminal state

#### Licensing and Billing Policies

- **List/Create Billing Policies**: `GET/POST /licensing/billingPolicies?api-version=2022-03-01-preview`
  - **File**: `src/app/api/power-platform/licensing/billing-policies/route.ts`

- **Get/Update/Delete Billing Policy**: `GET/PATCH/DELETE /licensing/billingPolicies/{policyId}?api-version=2022-03-01-preview`
  - **File**: `src/app/api/power-platform/licensing/billing-policies/[policyId]/route.ts`

- **Billing Policy Environments**:
  - `GET /licensing/billingPolicies/{policyId}/environments?api-version=2022-03-01-preview`
  - `POST /licensing/billingPolicies/{policyId}/environments/add?api-version=2022-03-01-preview`
  - `POST /licensing/billingPolicies/{policyId}/environments/remove?api-version=2022-03-01-preview`
  - **File**: `src/app/api/power-platform/licensing/billing-policies/[policyId]/environments/route.ts`

#### Tenant Settings

- **Get Tenant Settings**: `GET /tenantsettings?api-version=2024-10-01`
  - **Purpose**: Retrieve tenant-wide Power Platform settings
  - **Documentation**: [Tenant Settings API](https://learn.microsoft.com/en-us/power-platform/admin/programmability-tenant-settings)

### Client Implementation

**File**: `src/lib/ppToken.ts`

```javascript
export async function getPowerPlatformDelegatedToken({ userAccessToken, userIdToken, refreshToken }) {
  const scopes = ['https://api.powerplatform.com/.default'];
  const app = getCca();
  
  // 1) Try OBO with access token
  if (userAccessToken) {
    try {
      const res = await app.acquireTokenOnBehalfOf({ oboAssertion: userAccessToken, scopes });
      if (res?.accessToken) return res.accessToken;
    } catch {}
  }
  
  // 2) Try OBO with id token
  if (userIdToken) {
    try {
      const res = await app.acquireTokenOnBehalfOf({ oboAssertion: userIdToken, scopes });
      if (res?.accessToken) return res.accessToken;
    } catch {}
  }
  
  // 3) Try refresh token exchange
  if (refreshToken) {
    try {
      return await acquireTokenByRefreshToken(refreshToken, scopes);
    } catch {}
  }
  
  throw new Error('Unable to get Power Platform delegated token');
}
```

### Rate Limits

- **Service Protection Limits**: Applies to Dataverse API (see Dataverse section)
- **General Guidance**: Implement retry logic for 429 and 503 responses
- **Documentation**: [Service protection API limits](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/api-limits)

### Additional Token Functions

**Power Automate Delegated Token** (NEW):

**File**: `src/lib/ppToken.ts`

```javascript
export async function getPowerAutomateDelegatedToken({ userAccessToken, userIdToken, refreshToken }) {
  const scopes = ['https://service.flow.microsoft.com/.default'];
  const app = getCca();
  
  // Same OBO → refresh token fallback pattern as getPowerPlatformDelegatedToken
  // Returns token with audience: https://service.flow.microsoft.com
}
```

**Use Case**: Sending data to Power Automate flows with OAuth authentication ("Authenticated users" trigger option)

**BAP Delegated Token**:

```javascript
export async function getBAPDelegatedToken({ userAccessToken, userIdToken, refreshToken }) {
  const scopes = ['https://api.bap.microsoft.com/.default'];
  // Returns token for Business Application Platform APIs
}
```

**Use Case**: Alternative Power Platform management operations (less common, api.powerplatform.com preferred)

---

## Dataverse API

**Base URL:** `https://{environment-url}/api/data/v9.2/`  
**Example:** `https://org12345678.crm.dynamics.com/api/data/v9.2/`  
**Documentation:** [Dataverse Web API Reference](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/reference/about)

### Authentication

- **Method**: OAuth 2.0 On-Behalf-Of (OBO) flow
- **Token Scope**: `https://{environment-url}/.default` (dynamic based on environment)
- **Token Acquisition**: Via MSAL OBO using Power Platform token
- **Helper File**: `src/lib/ppToken.ts`

### Important: Dynamic Token Scopes

Each Dataverse environment requires a **unique token** scoped to that environment's URL:

```javascript
// Example: Acquiring token for a specific environment
const instanceUrl = 'https://org12345678.crm.dynamics.com';
const scope = `${instanceUrl}/.default`;
const token = await acquireTokenOnBehalfOf([scope], userAssertion);
```

**⚠️ Critical**: Always normalize the instance URL by removing trailing slashes before constructing the scope:

```javascript
const normalizedUrl = instanceUrl.replace(/\/+$/, ''); // Remove trailing slashes
const scope = `${normalizedUrl}/.default`;
```

### Required Permissions

Dataverse permissions are managed through **Security Roles** within each environment:

1. **System Administrator**: Full access to all tables and operations
2. **System Customizer**: Create and manage custom tables
3. **Basic User**: Read and write own records
4. **Service Writer**: For application users (service-to-service authentication)

#### How to Assign Security Roles

1. Navigate to [Power Platform Admin Center](https://admin.powerplatform.microsoft.com)
2. Select **Environments** > Choose your environment
3. Go to **Settings** > **Users + permissions** > **Users**
4. Find your application user (must be created first)
5. Click **Manage security roles**
6. Assign **System Administrator** or appropriate role

#### Creating an Application User in Dataverse

For app-only authentication, create an application user:

1. In Power Platform Admin Center, go to your environment
2. Go to **Settings** > **Users + permissions** > **Application users**
3. Click **+ New app user**
4. Select your app registration (by Application ID)
5. Select business unit
6. Assign security roles
7. Click **Create**

### Common Endpoints Used

#### Teams

- **List Teams**: `GET /teams?$select=teamid,name,description,_businessunitid_value,modifiedon,_administratorid_value,teamtype,membershiptype,isdefault&$orderby=name asc`
  - **File**: `src/app/power-platform/environments/page.tsx` (line ~550)
  - **Purpose**: List all Dataverse teams in an environment
  - **Response Fields**:
    - `teamid`: Unique identifier (GUID)
    - `name`: Team name
    - `teamtype`: 0=Owner, 1=Access, 2=AAD Security Group, 3=AAD Office Group
    - `_administratorid_value`: Team administrator (systemuser GUID)
  - **Documentation**: [team entity reference](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/reference/entities/team)

- **Create Team**: `POST /teams`
  - **File**: `src/app/power-platform/environments/page.tsx` (line ~1786+)
  - **Request Body**:
    ```json
    {
      "name": "Sales Team",
      "description": "Team for sales operations",
      "businessunitid@odata.bind": "/businessunits(guid)",
      "administratorid@odata.bind": "/systemusers(guid)",
      "teamtype": 0
    }
    ```
  - **Documentation**: [Create team](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/create-entity-web-api)

- **Get Team Members**: `GET /teams({teamId})/teammembership_association?$select=systemuserid,fullname,internalemailaddress`
  - **File**: `src/app/power-platform/environments/page.tsx` (via API route)
  - **Purpose**: Get all members of a specific team
  - **Documentation**: [Retrieve related records](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/retrieve-related-entities-query)

- **Add Team Member**: `POST /teams({teamId})/teammembership_association/$ref`
  - **Request Body**:
    ```json
    {
      "@odata.id": "https://org.crm.dynamics.com/api/data/v9.2/systemusers(user-guid)"
    }
    ```
  - **Documentation**: [Associate entities](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/associate-disassociate-entities-using-web-api)

- **Remove Team Member**: `DELETE /teams({teamId})/teammembership_association({userId})/$ref`
  - **File**: `src/app/power-platform/environments/page.tsx` (line ~1154+)
  - **Documentation**: [Disassociate entities](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/associate-disassociate-entities-using-web-api#disassociate-entities)

#### Solutions

- **List Solutions**: `GET /solutions?$select=friendlyname,uniquename,version,ismanaged,createdon,modifiedon,installedon&$orderby=friendlyname asc`
  - **File**: `src/app/power-platform/environments/page.tsx` (via modal)
  - **Purpose**: List installed Dataverse solutions
  - **Documentation**: [solution entity reference](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/reference/entities/solution)

#### Bots (Copilot Studio Agents)

- **List Bots**: `GET /bots?$select=name,schemaname,publishedon,statecode,statuscode`
  - **File**: `src/app/power-platform/environments/page.tsx` (line ~1600+)
  - **Purpose**: List Copilot Studio agents (formerly Power Virtual Agents)
  - **Documentation**: [bot entity reference](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/reference/entities/bot)

#### Business Units

- **List Business Units**: `GET /businessunits?$select=businessunitid,name`
  - **File**: `src/app/power-platform/environments/page.tsx` (for team creation)
  - **Purpose**: List organizational units
  - **Documentation**: [businessunit entity reference](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/reference/entities/businessunit)

#### System Users

- **List Users**: `GET /systemusers?$select=systemuserid,fullname,internalemailaddress`
  - **File**: `src/app/power-platform/environments/page.tsx` (for admin selection)
  - **Purpose**: List Dataverse users
  - **Documentation**: [systemuser entity reference](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/reference/entities/systemuser)

#### Conversations (Transcripts)

- **List Conversations**: `GET /conversationtranscripts?$select=...&$orderby=createdon desc`
  - **File**: `src/app/power-platform/environments/page.tsx` (line ~2350+)
  - **Purpose**: Retrieve conversation transcripts from Copilot Studio
  - **Documentation**: [conversationtranscript entity reference](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/reference/entities/conversationtranscript)

#### Tables (EntityDefinitions)

- **List Tables**: `GET /EntityDefinitions?$select=LogicalName,SchemaName,EntitySetName,DisplayName,PrimaryNameAttribute`
  - **File**: `src/app/api/power-platform/dataverse/tables/route.ts`
  - **Purpose**: List all table metadata
  - **Documentation**: [EntityMetadata](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/reference/entitymetadata)

- **Query Table Rows**: `GET /{entitySetName}?$select=field1,field2&$filter=...&$orderby=...&$top=50`
  - **File**: `src/app/api/power-platform/dataverse/query/route.ts`
  - **Purpose**: Query records from any Dataverse table
  - **Query Parameters**:
    - `$select`: Comma-separated field names
    - `$filter`: OData filter expression
    - `$orderby`: Sort order (e.g., `createdon desc`)
    - `$top`: Limit number of results
    - `$expand`: Include related records
  - **Documentation**: [Query data using the Web API](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/query-data-web-api)

### OData Query Parameters

Dataverse uses **OData 4.0** query syntax:

| Parameter | Purpose | Example |
|-----------|---------|---------|
| `$select` | Choose specific fields | `$select=name,createdon` |
| `$filter` | Filter results | `$filter=statecode eq 0` |
| `$orderby` | Sort results | `$orderby=createdon desc` |
| `$top` | Limit results | `$top=50` |
| `$skip` | Skip results (pagination) | `$skip=50` |
| `$expand` | Include related records | `$expand=ownerid($select=fullname)` |
| `$count` | Include total count | `$count=true` |

**Documentation**: [Query data using OData](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/query-data-web-api)

### Pagination

Dataverse returns paginated results with a `@odata.nextLink` property:

```javascript
// First request
const response = await fetch(`${instanceUrl}/api/data/v9.2/accounts?$top=50`);
const data = await response.json();

// Check for next page
if (data['@odata.nextLink']) {
  const nextPageUrl = data['@odata.nextLink'];
  // Fetch next page...
}
```

### Rate Limits and Service Protection

Dataverse enforces **service protection limits**:

- **API requests per user per 5 minutes**: 6,000
- **Concurrent requests per user**: 52
- **Execution time per request**: 2 minutes

**429 Response**: When limits are exceeded, Dataverse returns HTTP 429 with a `Retry-After` header (in seconds).

**Best Practice**: Implement exponential backoff:

```javascript
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(url, options);
    if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
      await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      continue;
    }
    return response;
  }
  throw new Error('Max retries exceeded');
}
```

**Documentation**: [Service protection API limits](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/api-limits)

---

## Microsoft Entra ID (Azure AD)

**Token Endpoint:** `https://login.microsoftonline.com/{tenant-id}/oauth2/v2.0/token`  
**Documentation:** [Microsoft identity platform documentation](https://learn.microsoft.com/en-us/azure/active-directory/develop/)

### Authentication Flows

#### 1. Authorization Code Flow (User Sign-In)

Used by NextAuth.js for interactive user login:

1. User clicks "Sign In"
2. Browser redirects to: `https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize?client_id=...&response_type=code&scope=openid+profile+email+offline_access&redirect_uri=...`
3. User authenticates and consents
4. Microsoft Entra ID redirects back with authorization code
5. Backend exchanges code for tokens

**File**: `src/lib/auth.ts` (NextAuth configuration)

#### 2. On-Behalf-Of (OBO) Flow

Used to exchange user token for resource-specific tokens:

```http
POST https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token
Content-Type: application/x-www-form-urlencoded

client_id={client-id}
&client_secret={client-secret}
&grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer
&assertion={user-access-token}
&scope=https://graph.microsoft.com/.default
&requested_token_use=on_behalf_of
```

**File**: `src/lib/obo.ts`

**Documentation**: [Microsoft identity platform and OAuth 2.0 On-Behalf-Of flow](https://learn.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-on-behalf-of-flow)

#### 3. Client Credentials Flow (App-Only)

Used for background services without user context:

```http
POST https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token
Content-Type: application/x-www-form-urlencoded

client_id={client-id}
&client_secret={client-secret}
&scope=https://graph.microsoft.com/.default
&grant_type=client_credentials
```

**File**: `src/lib/graphClient.ts`

**Documentation**: [Microsoft identity platform and the OAuth 2.0 client credentials flow](https://learn.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-client-creds-grant-flow)

#### 4. Refresh Token Flow

Used to acquire new access tokens without user interaction:

```http
POST https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token
Content-Type: application/x-www-form-urlencoded

client_id={client-id}
&client_secret={client-secret}
&refresh_token={refresh-token}
&scope=https://api.powerplatform.com/.default
&grant_type=refresh_token
```

**File**: `src/lib/ppToken.ts`

**Documentation**: [Refresh the access token](https://learn.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-auth-code-flow#refresh-the-access-token)

### Token Lifetimes

| Token Type | Default Lifetime | Configurable | Refresh Strategy |
|------------|------------------|--------------|------------------|
| Access Token | 60-90 minutes | Yes (via token lifetime policies) | Use refresh token |
| ID Token | 60-90 minutes | Yes | Obtain during new sign-in |
| Refresh Token | 90 days (rolling) | Yes | Automatically renewed on use |

**Documentation**: [Configurable token lifetimes](https://learn.microsoft.com/en-us/azure/active-directory/develop/active-directory-configurable-token-lifetimes)

---

## Application Insights (via Azure Monitor Logs)

**Base URL:** `https://api.loganalytics.azure.com/v1/{armResourceId}`
**Documentation:** [Querying logs for Azure resources](https://learn.microsoft.com/en-us/azure/azure-monitor/logs/api/azure-resource-queries)

> The dedicated Application Insights API (`api.applicationinsights.io`) was
> retired from this app so its Entra resource entry could be freed for the Power
> Platform API. Components are now queried **resource-centrically** through Azure
> Monitor Logs, addressed by ARM resource ID rather than Application ID GUID.
> See `docs/power-platform-api-permissions.md` and `src/lib/appInsightsQuery.ts`.

### Authentication

- **Method**: delegated (on-behalf-of the signed-in user)
- **Token Scope**: `https://api.loganalytics.io/.default` (`getLogAnalyticsTokenForUser`)
- **Required Role**: Reader or Monitoring Reader on the Application Insights component **and** its Log Analytics workspace

### Common Endpoints Used

- **Query**: `POST /query`
  - **File**: `src/app/api/application-insights-query/route.ts` (via `src/lib/appInsightsQuery.ts`)
  - **Purpose**: Execute KQL query
  - **Example Query**: `exceptions | where timestamp > ago(24h) | summarize count() by type`

- **Metrics**: derived from KQL summaries rather than a metrics endpoint
  - **File**: `src/app/api/application-insights-metrics/route.ts`
  - **Purpose**: Exception and failed-request counts over a timespan

- **Scan**: `POST /query` (eight queries against one resolved resource ID)
  - **File**: `src/app/api/application-insights-scan/route.ts`
  - **Purpose**: Failure, latency, user-impact, availability and trend summary

---

## Log Analytics API

**Base URL:** Via Azure Resource Manager  
**Documentation:** [Azure Monitor Logs REST API](https://learn.microsoft.com/en-us/rest/api/loganalytics/)

### Authentication

- **Method**: Azure Resource Manager token
- **Token Scope**: `https://management.azure.com/.default`
- **Required Role**: Reader or Log Analytics Reader on the workspace

### Common Endpoints Used

- **Query Workspace**: `POST /subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.OperationalInsights/workspaces/{workspaceName}/api/query?api-version=2023-09-01`
  - **File**: `src/app/api/log-analytics-query/route.ts`
  - **Request Body**:
    ```json
    {
      "query": "ContainerLog | where TimeGenerated > ago(1h)",
      "timespan": "PT1H"
    }
    ```
  - **Documentation**: [Query API](https://learn.microsoft.com/en-us/rest/api/loganalytics/dataaccess/query/execute)

---

## Internal API Routes

These are Next.js API routes that act as proxies to external APIs. They handle authentication, token acquisition, and error handling.

### Copilot interaction search

`POST /api/users/{id|all}/ai-interactions` performs a read-only, CSRF-protected
search. It requires a signed-in **portal admin in the effective home tenant**.
The configured application and sign-in tenants must match that scope. Each
continuation is reauthorized; a global role or a previous successful page does
not grant continuing access.

```json
{
  "from": "2026-09-01T00:00:00.000Z",
  "to": "2026-09-08T00:00:00.000Z",
  "keyword": "quarterly forecast",
  "appClass": "IPM.SkypeTeams.Message.Copilot.BizChat",
  "interactionType": "aiResponse",
  "pageSize": 100,
  "cursor": null
}
```

Use a user GUID for a selected history or `all` to traverse the delegated
directory listing, independently of the UI's loaded users. `tenantId` can bind
the request to the page's tenant selection. The date bounds are exclusive UTC
timestamps; both are required. Blank keyword, app class, and interaction type
mean no corresponding restriction. Types are `userPrompt` and `aiResponse`.
Search text and continuation state remain in the request body rather than URLs.

The response includes `value`, `nextCursor`, `complete`, `warnings`,
`authContext: "application"`, and cumulative `progress` counters
(`usersScanned`, `usersFailed`, `interactionsScanned`, `matchesFound`).
An empty `value` with a cursor means scanning must continue, not that the search
has no matches. `nextCursor: null` with `complete: false` means the scan ended
with unavailable histories. Results follow user/history scan order, not a
tenant-wide chronological sort. Cursors are opaque, expiring, and bound to the
caller, tenant, target, and submitted filters; restart an expired search.
Each cursor expires after 30 minutes. Requests perform at most eight provider
attempts before yielding a continuation. Protective ceilings of 10,000 directory
pages or 10,000 history pages per user stop with explicit partial coverage, never
with a complete result. Oversized or malformed provider pages fail rather than
silently dropping records. Previous pages are read again from Microsoft, not a
stored snapshot, and can change as the source changes.

The original `GET /api/users/{id}/ai-interactions?timeRange=7d` remains supported
(`30d` and `90d` also work); follow-up GETs must send only `cursor`, which freezes
the original date window. New UI searches use POST. Both methods return
`Cache-Control: private, no-store`. Sensitive history reads and search attempts
require successful persistence through the existing audit store; unavailable
audit storage prevents returning histories. See the existing
[environment configuration reference](ENVIRONMENT-VARIABLES.md) for audit-store
settings. No new service or environment variable is introduced.

Microsoft documents `createdDateTime` ranges, exact `appClass` filtering, and
`$top` (100 recommended), but not keyword or interaction-type search for this
operation. The portal therefore applies keyword and type matching while scanning
provider pages, without sending unsupported `$search` or type filters. The
keyword match includes visible text in embedded AdaptiveCard responses without
fetching linked attachments or documents. The
existing `AiEnterpriseInteraction.Read.All` application-permission exception is
retained, while directory discovery and target access checks use delegated
identity. No grants are added or broadened by this change.

Coverage is limited to interactions Microsoft exposes for the licensed user and
enabled experience; Copilot Studio agent histories are excluded. See the
[official export contract](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/api/ai-services/interaction-export/aiinteractionhistory-getallenterpriseinteractions?pivots=graph-v1),
[resource fields](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/api/ai-services/interaction-export/resources/aiinteraction),
and [sanctioned caller](APP-ONLY-JOBS.md#sanctioned-callers).

### Read availability and bounded completeness

These additive fields preserve the existing response shapes. Clients receiving
older responses without metadata must report completeness as unknown, not assume
that an empty array proves an empty source.

| Producer | Additive metadata and interpretation |
|---|---|
| `GET /api/search/global` | `availability.sources` contains `available`, `complete`, and optional `pagesFetched`, `limitReached`, `status`, and `consentRequired` for users, groups, devices, alerts, roles, licenses, mailboxes, environments, Foundry resources, local pages, and commands. `availability.complete` also accounts for the final 50-result limit (`resultLimitReached`). Source failures retain successful peers and local results. Queries shorter than two characters still return suggested commands without contacting providers. |
| `GET /api/user-signins/chart` | Existing SSE event types and fields remain. `progress.total` is the **50-page ceiling**, not a discovered total; `totalIsLimit` and `maxPages` make that explicit. `update` values are provisional. `complete` adds `complete`, `limitReached`, `pagesFetched`, and `maxPages`. Only `complete: true` verifies exhaustion of the interactive-sign-in query. A cap, error, malformed frame, or EOF without completion leaves received values provisional; missing buckets are not verified zeros. `error.message` remains generic, with optional verified status/consent fields. |
| `GET /api/entra/roles-and-administrators` | `definitionAvailability` and `assignmentAvailability` report bounded retrieval independently. Both retain the existing 20-page bounds. Existing `roles`, `total`, `memberCount`, and `memberBreakdown` remain compatible. A count from an unavailable assignment lookup is unknown even when the legacy numeric field is zero; partial counts describe only retrieved assignments. Definitions can remain useful when assignment retrieval fails. GET errors use the shared delegated-auth classifier, never a guessed application-permission remedy. |

Search completeness covers the existing caller-visible queries, not universal
tenant inventory. Some sources filter only the first returned collection
(alerts, roles, licenses, and environments); Graph and Foundry queries have
existing result caps. A full result at a requested limit is conservatively
reported as limited because additional matches have not been excluded. No
additional paging, providers, or permissions are introduced.
[Microsoft Graph paging](https://learn.microsoft.com/en-us/graph/paging) defines
`@odata.nextLink` as the signal for another page; the portal retains its bounded
walk rather than doing an unbounded scan.

User 360 retains the existing aggregate API. Its UI gates each projection by its
associated `errors` entry and field presence. Opaque source failures stay generic:
their text is not evidence of HTTP status or consent. License-derived Teams and
Power Platform plans remain independent of BAP environment discovery. Forwarding
conclusions require both mailbox rules and identity/domain; an absent risk
record is not a no-risk guarantee, and Foundry results are a limited
caller-visible query, not a complete effective-access assessment.
`fetchedAt` is aggregate retrieval time, not source change time.

Changing the selected user clears previous data, options, history, and pending
confirmations. Same-user failed refreshes retain labeled stale data while pausing
actions. A failed post-action read cannot change a confirmed operation or
method-removal outcome. The narrowed MFA removal types, protected methods,
per-method outcomes, and unresolved-only retry contract are unchanged.

### Authentication method removal

`POST /api/users/{id}/actions` retains the `reset-mfa-methods` action name. Its
scope is now limited to phone, Microsoft Authenticator, and software OATH
registrations. Passwords, email recovery, Temporary Access Pass, FIDO2/passkeys,
and Windows Hello are preserved. Hardware OATH and unknown types are not deleted
or deactivated; review them in the native Microsoft Entra admin center. This
uses the supported subset of [Microsoft's re-registration guidance](https://learn.microsoft.com/en-us/entra/identity/authentication/howto-mfa-userdevicesettings),
not a universal reset API or a guarantee of enrollment at the next sign-in.

`DELETE /api/users/{id}/auth-methods/{methodId}` is a separate, confirmed removal
of one supported registration, including recovery/passwordless methods. Both
routes authenticate first, require `rbac.manage`, validate input and CSRF, and
use the signed-in user's delegated Graph client. This repair adds no permissions.
Microsoft still enforces the caller's supported role, consent, MFA, and policy.

Both routes freshly [list the user's methods](https://learn.microsoft.com/en-us/graph/api/authentication-list-methods?view=graph-rest-1.0)
to resolve the concrete type server-side. The abstract
[`authenticationMethod`](https://learn.microsoft.com/en-us/graph/api/resources/authenticationmethod?view=graph-rest-1.0)
has no universal item GET/DELETE contract. Only the following concrete v1.0
collections are allowlisted. Each DELETE has no body and returns 204:

| Method | Collection and primary DELETE contract | Bulk scope |
| --- | --- | --- |
| Phone | [`phoneMethods`](https://learn.microsoft.com/en-us/graph/api/phoneauthenticationmethod-delete?view=graph-rest-1.0) | Eligible, subject to constraints |
| Microsoft Authenticator | [`microsoftAuthenticatorMethods`](https://learn.microsoft.com/en-us/graph/api/microsoftauthenticatorauthenticationmethod-delete?view=graph-rest-1.0) | Eligible |
| Software OATH | [`softwareOathMethods`](https://learn.microsoft.com/en-us/graph/api/softwareoathauthenticationmethod-delete?view=graph-rest-1.0) | Eligible |
| Email recovery | [`emailMethods`](https://learn.microsoft.com/en-us/graph/api/emailauthenticationmethod-delete?view=graph-rest-1.0) | Preserved |
| FIDO2/passkeys | [`fido2Methods`](https://learn.microsoft.com/en-us/graph/api/fido2authenticationmethod-delete?view=graph-rest-1.0) | Preserved |
| Temporary Access Pass | [`temporaryAccessPassMethods`](https://learn.microsoft.com/en-us/graph/api/temporaryaccesspassauthenticationmethod-delete?view=graph-rest-1.0) | Preserved |
| Windows Hello | [`windowsHelloForBusinessMethods`](https://learn.microsoft.com/en-us/graph/api/windowshelloforbusinessauthenticationmethod-delete?view=graph-rest-1.0) | Preserved |

Method IDs are opaque strings, not universally GUIDs. The list contract includes
a base64url FIDO2 example. The portal accepts a path-safe subset of letters,
digits, `_`, and `-`, bounded to 256 characters as a local safety policy, not a
Graph service limit. Email and phone additionally use their documented fixed IDs.
Other formats are preserved for native review, never interpolated into a path.

Phone removal additionally [lists concrete phone methods](https://learn.microsoft.com/en-us/graph/api/authentication-list-phonemethods?view=graph-rest-1.0).
A default MFA phone cannot be deleted; the user must change their default first.
The [v1.0 phone resource](https://learn.microsoft.com/en-us/graph/api/resources/phoneauthenticationmethod?view=graph-rest-1.0)
does not expose that default, and `smsSignInState` is not a substitute. A
400/409 phone refusal is reported as a constraint, without claiming the precise
upstream cause. Mobile is conservatively preserved if the attempt's phone
inventory includes alternate mobile, regardless of deletion order. The portal
never substitutes phone numbers or changes defaults automatically.

The bulk response retains `ok`, `correlationId`, `upstreamApi`, and `details`.
`details` includes `deletedCount`, `deletedMethods`, `complete`, and `outcomes`.
Each outcome includes the method ID/type/label, status, fixed safe message,
upstream operation, HTTP status, and `retryable`. Statuses distinguish `deleted`,
`not_found`, `protected`, `unsupported`, `constrained`, `forbidden`, `throttled`,
`reauth_required`, `failed`, and `not_attempted`. A completed eligible subset
returns 200; unresolved or unsupported methods return 207 with `ok: false`.
Protected methods do not make the supported subset incomplete. The UI always
renders the outcomes rather than interpreting every 2xx response as full reset.

Individual successful removal retains 204. Its failures preserve genuine
404, 401/403, 429, and transport/server statuses. Discovery errors are not
converted to not-found. Per-method outcomes are audited before the next removal,
using existing allowlisted scalar fields; the bulk summary records counts and
success/failure. No passcode, phone number, or upstream exception enters an
outcome. Authentication-method display inventory is uncached and excludes TAP
passcodes so subsequent refreshes reflect completed removals.

Bulk retry sends `methodIds` alongside `type: "reset-mfa-methods"`: a nonempty,
unique list of at most 100 IDs (a portal request bound). The UI derives it only
from retryable unresolved outcomes and keeps previous removals visible. The
server re-lists and re-applies the scope/allowlist; already absent IDs are
`not_found` with no DELETE. Transient DELETE retries are disabled through the
existing client retry budget. Permission/consent/throttle/transport failure stops
further deletes, but prior outcomes remain. Resolve access/consent failures or
wait after throttling before requesting retry. If the whole request is lost,
refresh the inventory and audit history before starting another removal.

The handler/consumer regressions live in
`tests/unit/app/authenticationMethodRemoval.test.ts` and
`tests/unit/authentication-method-outcomes.test.ts`. Browser regressions use
`playwright.mfa-fixtures.config.ts`, not the generic configuration. They mount
the real components in a temporary, authenticated, development-only fixture
route and remove it afterward. Run them only against an isolated loopback Next
server with process-only synthetic authentication, no real environment files,
and a fail-closed outbound network guard. The browser intercepts all application
APIs/mutations and rejects external requests. Do not use the normal
environment-linking development wrapper for these fixtures.

### Route Structure

All internal API routes are located in `src/app/api/` with the following pattern:

```
src/app/api/
├── graph/              # Microsoft Graph proxies
├── power-platform/     # Power Platform proxies
│   ├── dataverse/
│   │   ├── teams/
│   │   ├── tables/
│   │   ├── query/
│   │   └── solutions/
│   │       └── export/      # Solution export operations (NEW)
│   ├── environments/
│   │   └── {environmentId}/
│   │       ├── enable-managed/   # Enable managed environment (NEW)
│   │       ├── disable-managed/  # Disable managed environment (NEW)
│   │       └── delete/           # Delete environment (NEW)
│   ├── inventory/      # Tenant inventory queries (NEW)
│   └── send-to-flow/   # Power Automate integration (NEW)
├── resource-graph/     # Azure Resource Graph
├── security/           # Security & Compliance
└── ...
```

### Example Route Implementation

**File**: `src/app/api/power-platform/dataverse/teams/route.ts`

```javascript
import { auth } from '@/lib/auth';
import { getPowerPlatformDelegatedToken } from '@/lib/ppToken';

export async function GET(request) {
  const session = await auth();
  if (!session) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const instanceUrl = searchParams.get('instanceUrl');
  
  // Get Power Platform token for this environment
  const token = await getPowerPlatformDelegatedToken({
    userAccessToken: session.accessToken,
    userIdToken: session.idToken,
    refreshToken: session.refreshToken,
  });

  // Call Dataverse API
  const response = await fetch(
    `${instanceUrl}/api/data/v9.2/teams?$select=teamid,name`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'OData-MaxVersion': '4.0',
        'OData-Version': '4.0',
      },
    }
  );

  const data = await response.json();
  return Response.json(data);
}
```

### Common Route Patterns

All three patterns below verify authentication **first** and acquire tokens
**server-side only** — the browser never sees a token.

#### 1. Delegated Graph route (the default)

```javascript
import { withDelegatedAuth } from '@/lib/api-auth';

export const GET = withDelegatedAuth(async (request, session, { graph }) => {
  const data = await graph.api('/users').get();
  return Response.json(data);
});
```

#### 2. Delegated non-Graph resource (ARM, Power Platform, Dataverse, …)

```javascript
import { verifyAuth, UNAUTHORIZED_RESPONSE } from '@/lib/api-auth';
import { getAzureTokenForUser } from '@/lib/graphClient';

export async function GET(request) {
  const session = await verifyAuth();
  if (!session) return UNAUTHORIZED_RESPONSE;

  const token = await getAzureTokenForUser(); // OBO — user's Azure RBAC applies
  // ... call Azure Resource Manager
}
```

#### 3. App-only route (background jobs only)

```javascript
// Must be listed in docs/APP-ONLY-JOBS.md and classified "B" in
// auth-mode-classifications.json, or `pnpm run verify:auth-mode:strict` fails.
import { getAppOnlyGraphClient } from '@/lib/auth/appOnly';

const client = await getAppOnlyGraphClient({
  reason: 'scheduled tenant-wide ingest, no signed-in user',
  jobId: 'audit-log-ingest',
});
```

### Error Handling — `toClientError` is mandatory

Every route `catch` block must return through `toClientError` (or
`toClientErrorResponse` for handlers that return a plain `Response`) from
`@/lib/api-errors`. Building the response body from `error.message` is a
security bug and is blocked in CI.

```javascript
import { toClientError } from '@/lib/api-errors';

export async function GET(request) {
  const session = await verifyAuth();
  if (!session) return UNAUTHORIZED_RESPONSE;

  try {
    // ...
  } catch (error) {
    return toClientError(error, {
      fallback: 'Failed to fetch environments',
      logPrefix: 'PP Environments',
    });
  }
}
```

Two reasons this is not optional:

1. **Information disclosure.** Upstream Graph / ARM / Dataverse exception text
   carries endpoint URLs, tenant hints and correlation IDs. `toClientError`
   returns only the generic `fallback` in production while still logging the
   full error server-side, and still echoes `message` / `code` / `details` /
   `stack` when `NODE_ENV !== 'production'` for local debugging.
2. **Consent handling.** `toClientError` is the only place that converts a
   `DelegatedAuthRequiredError` — or a plain error tagged `consentRequired` by
   `src/lib/ppToken.ts` — into `401 { error: 'reauth_required', reason, requiredScopes? }`.
   A hand-rolled `error.message` response turns an AADSTS65001 consent gap into
   an opaque 500, and the UI never prompts the user to consent.

Options: `fallback` (client-facing message), `status` (only when derived from
the error, e.g. `resolveAdoStatus(extractAdoStatus(error))`), `extra` (safe
flags such as `success: false` or `notConfigured: true`), and `logPrefix` (the
route tag used in the server-side log line).

Raw `error.message` remains fine in `console.*` calls, in audit payloads
(`logSensitiveAction*`, `logSecurityEvent`), and for server-side control flow —
just never in anything the client receives, including partial-failure fields
inside an otherwise-successful fan-out response.

Enforced by `pnpm run check:raw-errors`
(`scripts/check-raw-error-message-ratchet.mjs`), which parses every
`src/app/api/**/route.ts` with the TypeScript AST and fails on any raw
`error.message` / `error.stack` that reaches a response body. Routes still
carrying this debt are tracked in `raw-error-message-baseline.json`; that list
may only shrink.

---

## Microsoft Defender for Endpoint API

### Overview

Microsoft Defender for Endpoint (formerly Microsoft Defender ATP) provides security-related data including alerts, machines, vulnerabilities, and recommendations.

### Base URL

```
https://api.securitycenter.microsoft.com
```

### Authentication

- **Method**: Client Credentials Flow
- **Token Endpoint**: `https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token`
- **Scope**: `https://api.securitycenter.microsoft.com/.default`

### Environment Variables

```bash
DEFENDER_ATP_CLIENT_ID=<your-defender-app-client-id>
DEFENDER_ATP_CLIENT_SECRET=<your-defender-app-client-secret>
```

### API Routes

**File**: `src/app/api/defender-atp/route.ts`

**Endpoints Used**:
- **GET /api/alerts** - Retrieve security alerts
- **GET /api/machines** - List all machines
- **GET /api/vulnerabilities** - Get vulnerability data
- **GET /api/recommendations** - Security recommendations

### Required Permissions

Application Permissions:
- `SecurityAlert.Read.All` - Read all security alerts
- `Machine.Read.All` - Read all machine information
- `Vulnerability.Read.All` - Read vulnerability data
- `SecurityRecommendation.Read.All` - Read security recommendations

### Usage

```javascript
const response = await fetch('/api/defender-atp', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json'
  }
})
const data = await response.json()
// Returns: { alerts, machines, vulnerabilities, recommendations }
```

### Documentation

- [Defender for Endpoint API Reference](https://learn.microsoft.com/en-us/defender-endpoint/api/apis-intro)
- [Authentication Guide](https://learn.microsoft.com/en-us/defender-endpoint/api/exposed-apis-create-app-webapp)

---

## Microsoft Graph Reports API

### Overview

The reportRoot API provides access to 70+ Microsoft 365 usage and activity reports covering all services including OneDrive, SharePoint, Teams, Outlook, and more.

### Base URL

```
https://graph.microsoft.com/v1.0/reports
https://graph.microsoft.com/beta/reports (for beta features)
```

### Authentication

- **Method**: User-delegated or Application credentials
- **Token Scope**: `https://graph.microsoft.com/.default`
- **Required Permission**: `Reports.Read.All`

### Report Categories

1. **Microsoft 365 Active Users** - Daily active users by product
2. **Microsoft 365 Apps Usage** - Desktop and mobile app usage
3. **OneDrive Activity** - File activity and user engagement
4. **OneDrive Usage** - Storage consumption statistics
5. **SharePoint Activity** - Site and file interactions
6. **SharePoint Site Usage** - Site storage and page views
7. **Outlook Activity** - Email send/read/receive metrics
8. **Outlook App Usage** - Email client usage
9. **Mailbox Usage** - Mailbox storage and quota
10. **Teams User Activity** - Messages, calls, meetings
11. **Teams Device Usage** - Device types used for Teams
12. **Microsoft 365 Groups** - Group activity and storage
13. **Microsoft 365 Activations** - Office activation counts
14. **Copilot Usage** (Beta) - Copilot adoption metrics
15. **Forms Activity** (Beta) - Forms usage statistics
16. **Browser Usage** (Beta) - Microsoft Edge usage
17. **Viva Engage (Yammer)** - Yammer activity

### Generic Report Route Helper

**File**: `src/app/api/reports/createGraphReportRoute.ts`

Provides a reusable helper function for creating report API routes:

```javascript
import { createGraphReportRoute } from '@/app/api/reports/createGraphReportRoute'

export const GET = createGraphReportRoute({
  endpoint: 'getOneDriveActivityUserDetail',
  supportsPeriod: false,
  supportsDate: true
})
```

### Report Parameters

**Period-based reports** support: `D7`, `D30`, `D90`, `D180`
```
GET /reports/getOffice365ActiveUserCounts(period='D30')
```

**Date-based reports** support: `YYYY-MM-DD`
```
GET /reports/getOneDriveActivityUserDetail(date=2025-11-29)
```

### Frontend Component

**File**: `src/app/components/GraphReportPage.tsx`

Reusable React component for rendering any Graph report with:
- Period/date selection
- CSV export
- Dark mode support
- Automatic data formatting

### Documentation

- [reportRoot API Reference](https://learn.microsoft.com/en-us/graph/api/resources/reportroot?view=graph-rest-beta)
- [Implementation Guide](./reports-implementation-guide.md)

---

## Windows Update State API (Intune)

### Overview

The Windows Update State API provides detailed information about Windows Update status for managed devices, including KB article numbers, update states, quality update version, and feature update version.

### Base URL

```
https://graph.microsoft.com/beta/deviceManagement/managedDevices/{deviceId}/windowsUpdateStates
```

### Authentication

- **Method**: User-delegated
- **Token Scope**: `https://graph.microsoft.com/.default`
- **Required Permission**: `DeviceManagementManagedDevices.Read.All`

### API Routes

**File**: `src/app/api/intune/windows-update-states/route.ts`

**Frontend**: `src/app/intune/windows-updates/page.tsx`

### Query Parameters

- `deviceId` (required) - Intune managed device ID
- `$select` - Specific properties to retrieve
- `$filter` - Filter results
- `$expand` - Include related entities

### Example Usage

```javascript
const response = await fetch(
  '/api/intune/windows-update-states?deviceId=12345678-1234-1234-1234-123456789012'
)
const data = await response.json()
```

### Response Properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | string | Update state record ID |
| `deviceId` | string | Device identifier |
| `deviceDisplayName` | string | Device name |
| `qualityUpdateVersion` | string | Current quality update version (e.g., "10.0.19045.5131") |
| `featureUpdateVersion` | string | Current feature update version (e.g., "22H2") |
| `lastScanDateTime` | datetime | Last Windows Update scan |
| `lastSyncDateTime` | datetime | Last sync with Intune |

### Documentation

- [windowsUpdateState resource type](https://learn.microsoft.com/en-us/graph/api/resources/intune-shared-windowsupdatestate?view=graph-rest-beta)
- [Get windowsUpdateState](https://learn.microsoft.com/en-us/graph/api/intune-shared-windowsupdatestate-get?view=graph-rest-beta)

---

## ServiceNow Integration API

### Overview

ServiceNow integration enables creating incidents directly from the portal based on security alerts, compliance issues, or other events detected in Microsoft 365/Azure.

### Authentication

ServiceNow uses **Basic Authentication** with username/password credentials.

### Environment Variables (Optional)

```bash
SERVICENOW_INSTANCE=<your-instance-name>
SERVICENOW_USERNAME=<service-account-username>
SERVICENOW_PASSWORD=<service-account-password>
```

Note: Credentials can also be provided dynamically via the UI.

### API Routes

#### 1. Fetch Incidents

**File**: `src/app/api/servicenow/incidents/route.ts`

**Method**: POST (with credentials in body)

**Request Body**:
```json
{
  "instance": "dev12345",
  "username": "admin",
  "password": "password"
}
```

**Response**:
```json
{
  "result": [
    {
      "sys_id": "abc123",
      "number": "INC0001234",
      "short_description": "Issue description",
      "state": "2",
      "priority": "3",
      "assigned_to": "John Doe",
      "opened_at": "2025-11-29 10:30:00"
    }
  ]
}
```

#### 2. Create Incident

**File**: `src/app/api/servicenow/incidents/create/route.ts`

**Method**: POST

**Request Body**:
```json
{
  "instance": "dev12345",
  "username": "admin",
  "password": "password",
  "incident": {
    "short_description": "Security alert detected",
    "description": "High severity alert...",
    "urgency": "1",
    "impact": "2",
    "category": "security",
    "assignment_group": "Security Team"
  }
}
```

**Response**:
```json
{
  "result": {
    "sys_id": "xyz789",
    "number": "INC0001235",
    "short_description": "Security alert detected",
    "state": "1"
  }
}
```

### Frontend Component

**File**: `src/app/components/CreateIncidentButton.tsx`

Reusable button component that can be placed anywhere to trigger incident creation:

```jsx
import CreateIncidentButton from '@/app/components/CreateIncidentButton'

<CreateIncidentButton
  title="Security Alert Detected"
  description={`Alert: ${alertData.name}\nSeverity: ${alertData.severity}`}
  urgency="1"
  impact="2"
  category="security"
/>
```

### ServiceNow API Endpoints

**Base URL**: `https://{instance}.service-now.com/api/now`

**Endpoints Used**:
- **GET /table/incident** - Fetch incidents
- **POST /table/incident** - Create incident
- **PATCH /table/incident/{sys_id}** - Update incident

### Documentation

- [ServiceNow REST API Reference](https://developer.servicenow.com/dev.do#!/reference/api/xanadu/rest/)
- [Incident Table API](https://developer.servicenow.com/dev.do#!/reference/api/xanadu/rest/c_TableAPI)
- [Implementation Guide](./servicenow-incident-integration.md)

---

## Required Permissions Summary

### App Registration Permissions

| API | Permission Name | Type | Admin Consent | Purpose |
|-----|----------------|------|---------------|---------|
| **Microsoft Graph** | User.Read.All | Delegated | Yes | Read all users |
| | User.ReadWrite.All | Delegated | Yes | Create/update users |
| | Directory.Read.All | Delegated | Yes | Read directory |
| | AuditLog.Read.All | Delegated | Yes | Read audit logs |
| | Group.Read.All | Delegated | Yes | Read groups |
| | Application.Read.All | Delegated | Yes | Read applications |
| | Sites.Read.All | Delegated | Yes | Read SharePoint |
| | Reports.Read.All | Delegated | Yes | Read usage reports |
| | SecurityEvents.Read.All | Delegated | Yes | Read security events |
| | DeviceManagementManagedDevices.Read.All | Delegated | Yes | Read Intune devices |
| | offline_access | Delegated | No | Get refresh tokens |
| **Azure Service Management** | user_impersonation | Delegated | No | Access ARM as user |
| **Microsoft Defender for Endpoint** | SecurityAlert.Read.All | Application | Yes | Read security alerts |
| | Machine.Read.All | Application | Yes | Read machine information |
| | Vulnerability.Read.All | Application | Yes | Read vulnerabilities |
| | SecurityRecommendation.Read.All | Application | Yes | Read security recommendations |

### Azure RBAC Roles

| Scope | Role | Purpose |
|-------|------|---------|
| Subscription | Reader | Read Azure resources |
| Subscription | Security Reader | Read security assessments |
| Log Analytics Workspace | Log Analytics Reader | Query logs |
| Application Insights | Monitoring Reader | Query metrics |

### Power Platform Roles

| Role | Assigned In | Purpose |
|------|-------------|---------|
| Power Platform Administrator | Microsoft 365 Admin Center | Manage all environments |
| Dynamics 365 Administrator | Microsoft 365 Admin Center | Manage Dataverse |
| System Administrator (Dataverse) | Power Platform Admin Center | Full access to Dataverse |

### Granting Admin Consent

After adding API permissions to your app registration:

1. Navigate to **API permissions** in your app registration
2. Click **Grant admin consent for {Tenant Name}**
3. Confirm by clicking **Yes**
4. Verify all permissions show **Granted for {Tenant Name}** in the Status column

**⚠️ Important**: Admin consent is required for most Microsoft Graph permissions. Without it, users will see consent prompts and may be unable to access features.

---

## Troubleshooting

### Common Error Messages

#### 1. "Unauthorized" (401)

**Cause**: Missing or invalid access token

**Solutions**:
- Verify `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, and `AZURE_TENANT_ID` are set correctly
- Check that the user is signed in (session exists)
- Verify token has not expired
- Check that refresh token is present in session

**Debug**:
```javascript
const session = await auth();
console.log('Session:', JSON.stringify(session, null, 2));
```

#### 2. "Forbidden" (403)

**Cause**: Insufficient permissions

**Solutions**:
- Verify API permissions are configured in app registration
- Ensure admin consent has been granted
- Check Azure RBAC role assignments for the service principal
- Verify Power Platform admin roles for the user

**Check Permissions**:
1. Azure Portal > App registrations > Your app > API permissions
2. Verify all permissions show "Granted" status

#### 3. "Invalid audience" Token Error

**Cause**: Token scope does not match the API resource

**Solutions**:
- For Graph API: Use `https://graph.microsoft.com/.default`
- For ARM API: Use `https://management.azure.com/.default`
- For Power Platform API: Use `https://api.powerplatform.com/.default`
- For Dataverse: Use `https://{environment-url}/.default` (without trailing slash)

**Verify Token**:
```javascript
// Decode JWT to inspect audience (aud) claim
const parts = token.split('.');
const payload = JSON.parse(atob(parts[1]));
console.log('Token audience:', payload.aud);
```

#### 4. "Service protection limit exceeded" (429)

**Cause**: Too many requests to Dataverse API

**Solutions**:
- Implement exponential backoff retry logic
- Respect `Retry-After` header value
- Reduce concurrent requests
- Batch operations where possible

**Example Retry Logic**:
```javascript
async function fetchWithRetry(url, options) {
  const response = await fetch(url, options);
  if (response.status === 429) {
    const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
    return fetchWithRetry(url, options); // Retry
  }
  return response;
}
```

#### 5. "AADSTS50001: Resource not found"

**Cause**: Incorrect resource URI in token request

**Solutions**:
- Verify the resource URL is correct and registered in your tenant
- For Dataverse, ensure the environment URL is correct
- Check for typos in scope/resource parameters

#### 6. "AADSTS65001: User or administrator has not consented"

**Cause**: Admin consent not granted or user cannot consent

**Solutions**:
- Grant admin consent in app registration (API permissions)
- Ensure user has permission to consent to applications
- Check tenant consent policies

#### 7. Power Platform API returns 404 for environments

**Cause**: User does not have Power Platform admin role

**Solutions**:
- Assign **Power Platform Administrator** role in Microsoft 365 Admin Center
- Alternatively, assign **Environment Administrator** for specific environments

### Debugging Tips

#### Enable Verbose Logging

**MSAL Logging** (`src/lib/ppToken.ts`):
```javascript
const cca = new ConfidentialClientApplication({
  auth: { /* ... */ },
  system: { 
    loggerOptions: { 
      loggerCallback(level, message, containsPii) {
        console.log(`[MSAL][${level}]`, message);
      },
      piiLoggingEnabled: false,
      logLevel: 'Verbose'
    } 
  },
});
```

#### Inspect Token Claims

```javascript
function decodeJwt(token) {
  const parts = token.split('.');
  const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
  console.log('Token claims:', JSON.stringify(payload, null, 2));
  console.log('Audience:', payload.aud);
  console.log('Scopes:', payload.scp || payload.roles);
  console.log('Expiration:', new Date(payload.exp * 1000).toISOString());
}
```

#### Test Token Acquisition

Use the provided test scripts:

```bash
# Test Power Platform token acquisition
node whoami-powerplatform.js

# Test MSAL certificate authentication
node test-msal-cert.js
```

#### Check API Response Details

```javascript
const response = await fetch(url, options);
const text = await response.text();
console.log('Status:', response.status);
console.log('Headers:', Object.fromEntries(response.headers.entries()));
console.log('Body:', text);
```

### Useful Links

- **Azure Portal**: [https://portal.azure.com](https://portal.azure.com)
- **Microsoft 365 Admin Center**: [https://admin.microsoft.com](https://admin.microsoft.com)
- **Power Platform Admin Center**: [https://admin.powerplatform.microsoft.com](https://admin.powerplatform.microsoft.com)
- **Microsoft Entra ID Admin Center**: [https://entra.microsoft.com](https://entra.microsoft.com)
- **Microsoft Graph Explorer**: [https://developer.microsoft.com/graph/graph-explorer](https://developer.microsoft.com/graph/graph-explorer)
- **JWT Decoder**: [https://jwt.ms](https://jwt.ms)

---

## Appendix: Quick Reference

### Environment Variables Checklist

- [ ] `NEXTAUTH_URL` set to your application URL
- [ ] `NEXTAUTH_SECRET` or `AUTH_SECRET` generated (32+ characters)
- [ ] `AZURE_CLIENT_ID` from app registration
- [ ] `AZURE_CLIENT_SECRET` from app registration (stored securely)
- [ ] `AZURE_TENANT_ID` from Microsoft Entra ID
- [ ] `AZURE_SUBSCRIPTION_ID` (optional, for Azure Resource Graph)

### App Registration Checklist

- [ ] App registration created in Microsoft Entra ID
- [ ] Redirect URIs configured for authentication
- [ ] Client secret created and stored securely
- [ ] API permissions added for Microsoft Graph
- [ ] API permissions added for Azure Service Management
- [ ] Admin consent granted for all permissions
- [ ] Service principal assigned Azure RBAC roles (Reader, Security Reader)

### Power Platform Checklist

- [ ] User assigned **Power Platform Administrator** role
- [ ] Application user created in each Dataverse environment
- [ ] Application user assigned **System Administrator** security role
- [ ] Environments accessible via Power Platform Admin Center

### Testing Checklist

- [ ] User can sign in successfully
- [ ] Microsoft Graph API returns data (e.g., /users)
- [ ] Azure Resource Graph returns resources
- [ ] Power Platform API returns environments
- [ ] Dataverse API returns teams/solutions
- [ ] Error messages are actionable

---

**Document Maintained By**: IT Operations Team  
**Last Review Date**: November 1, 2025  
**Next Review Date**: February 1, 2026

For questions or updates, please contact your Azure/Microsoft 365 administrator or submit a pull request to this documentation.
