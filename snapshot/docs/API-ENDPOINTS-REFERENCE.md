# API Endpoints Quick Reference

**Quick lookup guide for all external API endpoints used in Portal 360°**  
**Last Updated:** May 20, 2026  
**Total API Routes:** 706  
**Auth Coverage:** 100% (0 unauthenticated routes)

> **For the full authentication audit** (all 706 routes with auth type, RBAC permissions, and upstream API details), see [`docs/API-AUTH-AUDIT.md`](./API-AUTH-AUDIT.md).  
> **To validate auth compliance programmatically**, run: `node scripts/validate-api-auth.js`

This document provides a flat reference of every external API endpoint called by the application, organized by feature area. Use this for quick troubleshooting and endpoint verification.

---

## Authentication Architecture Summary

All API routes (`src/app/api/**`) are protected using one of these mechanisms:

| Pattern | Count | Description |
|---------|-------|-------------|
| `verifyAuth()` direct | 600 | Direct call from `@/lib/api-auth` at top of each handler |
| `createGraphReportRoute()` | 70 | Helper for Graph Reports — calls `verifyAuth()` internally |
| `withRouteTemplate()` | 25 | Route template wrapper — `requireAuth: true` by default |
| NextAuth endpoints | 4 | `src/app/api/auth/*` — the auth flow itself (intentionally public) |
| MS Graph webhook | 2 | `clientState` secret validation (not session-based, per MS spec) |
| Re-export | 1 | Delegates to authenticated parent route |

**Session tokens are never returned to the browser.** The browser holds only an HttpOnly session cookie containing a `jti` claim. The actual access/refresh tokens are stored server-side in Redis (production) or in-memory (development) and retrieved via `getServerTokens()`.

---

## Route Categories at a Glance

| Category | Routes | HTTP Methods | Upstream APIs | Documentation |
|----------|--------|-------------|--------------|---------------|
| `admin` | 2 | GET, PATCH | Microsoft Graph | [Graph – Admin API](https://learn.microsoft.com/en-us/graph/api/resources/adminreportsettings) |
| `ai` | 4 | POST | Internal (Azure OpenAI) | [Azure AI Foundry](https://learn.microsoft.com/en-us/azure/ai-foundry/overview) |
| `applications` | 9 | GET, POST, PATCH, DELETE | Microsoft Graph | [Graph – Applications](https://learn.microsoft.com/en-us/graph/api/resources/application) |
| `audit-log-*` | 5 | GET, POST | Internal audit store | [Graph – Audit Logs](https://learn.microsoft.com/en-us/graph/api/resources/auditlogroot) |
| `azure` | 83 | GET, POST, PUT, PATCH, DELETE | Azure Resource Manager | [Azure REST API](https://learn.microsoft.com/en-us/rest/api/azure/) |
| `azure-advisor-*` | 4 | GET, POST | Azure Resource Manager | [Azure Advisor REST API](https://learn.microsoft.com/en-us/rest/api/advisor/) |
| `copilot-studio` | 3 | GET, POST | Internal | [Microsoft Copilot Studio](https://learn.microsoft.com/en-us/microsoft-copilot-studio/fundamentals-what-is-copilot-studio) |
| `defender-atp` | 1 | POST | Defender for Endpoint API | [Defender for Endpoint API](https://learn.microsoft.com/en-us/defender-endpoint/api-introduction) |
| `device-management` | 8 | GET, POST, DELETE | Microsoft Graph (Intune) | [Graph – Intune Device Management](https://learn.microsoft.com/en-us/graph/api/resources/intune-devices-manageddevice) |
| `devops` | 52 | GET, POST, PATCH, DELETE | Azure DevOps API | [Azure DevOps REST API](https://learn.microsoft.com/en-us/rest/api/azure/devops/) |
| `entitlement` | 19 | GET, POST, DELETE | Microsoft Graph | [Graph – Entitlement Management](https://learn.microsoft.com/en-us/graph/api/resources/entitlementmanagement-overview) |
| `exchange` | 5 | GET, POST, PATCH, DELETE | Microsoft Graph | [Graph – Mail (Exchange) API](https://learn.microsoft.com/en-us/graph/api/resources/mail-api-overview) |
| `fabric` | 5 | GET, POST | Microsoft Fabric API | [Microsoft Fabric REST API](https://learn.microsoft.com/en-us/rest/api/fabric/articles/) |
| `graph` | 57 | GET, POST, PATCH, DELETE | Microsoft Graph | [Microsoft Graph API](https://learn.microsoft.com/en-us/graph/api/overview) |
| `groups` | 3 | GET, POST, PATCH, DELETE | Microsoft Graph | [Graph – Groups API](https://learn.microsoft.com/en-us/graph/api/resources/group) |
| `guests` | 4 | GET, POST, DELETE | Microsoft Graph | [Graph – Users/Guests API](https://learn.microsoft.com/en-us/graph/api/resources/user) |
| `hitl` | 4 | GET, POST, DELETE | Internal, Power Platform callback | [Power Automate – Human in the Loop](https://learn.microsoft.com/en-us/power-automate/desktop-flows/human-in-the-loop) |
| `intune` | 39 | GET, POST, PATCH, DELETE | Microsoft Graph | [Graph – Intune API](https://learn.microsoft.com/en-us/graph/api/resources/intune-graph-overview) |
| `licensing` | 2 | GET | Microsoft Graph | [Graph – License Management](https://learn.microsoft.com/en-us/graph/api/resources/subscribedsku) |
| `microsoft365` | 6 | GET | Microsoft Graph Reports | [Graph – Reports API](https://learn.microsoft.com/en-us/graph/api/resources/report) |
| `onedrive` | 1 | GET | Microsoft Graph | [Graph – OneDrive API](https://learn.microsoft.com/en-us/graph/api/resources/onedrive) |
| `pim` | 6 | GET, POST | Microsoft Graph | [Graph – PIM API](https://learn.microsoft.com/en-us/graph/api/resources/privilegedidentitymanagement-root) |
| `power-platform` | 169 | GET, POST, PUT, PATCH, DELETE | PP API, Dataverse, ARM | [Power Platform REST API](https://learn.microsoft.com/en-us/rest/api/power-platform/) |
| `reports` | 72 | GET | Microsoft Graph Reports | [Graph – Reports API](https://learn.microsoft.com/en-us/graph/api/resources/report) |
| `risky-users` | 1 | GET | Microsoft Graph | [Graph – Identity Protection](https://learn.microsoft.com/en-us/graph/api/resources/riskyuser) |
| `search` | 1 | GET | Microsoft Graph, ARM | [Graph – Search API](https://learn.microsoft.com/en-us/graph/api/resources/search-api-overview) |
| `secure-score` | 3 | GET | Microsoft Graph, ARM | [Graph – Secure Score API](https://learn.microsoft.com/en-us/graph/api/resources/securescores) |
| `service-health` | 2 | GET | Microsoft Graph | [Graph – Service Health API](https://learn.microsoft.com/en-us/graph/api/resources/serviceannouncement) |
| `servicenow` | 12 | GET, POST, PATCH, DELETE | ServiceNow API | [ServiceNow REST API](https://developer.servicenow.com/dev.do#!/reference/api/latest/rest) |
| `sharepoint` / `sharepoint-sites` | 10 | GET, POST, PATCH, DELETE | Microsoft Graph | [Graph – SharePoint API](https://learn.microsoft.com/en-us/graph/api/resources/sharepoint) |
| `teams` | 10 | GET, POST, PATCH, DELETE | Microsoft Graph | [Graph – Teams API](https://learn.microsoft.com/en-us/graph/api/resources/teams-api-overview) |
| `token-lifetime-policies` | 2 | GET, POST, PATCH, DELETE | Microsoft Graph | [Graph – Token Lifetime Policies](https://learn.microsoft.com/en-us/graph/api/resources/tokenlifetimepolicy) |
| `users` | 17 | GET, POST, PATCH, DELETE | Microsoft Graph | [Graph – Users API](https://learn.microsoft.com/en-us/graph/api/resources/user) |
| `windows-updates` | 2 | GET, POST | Microsoft Graph | [Graph – Windows Updates API](https://learn.microsoft.com/en-us/graph/api/resources/windowsupdates-windowsupdatesnamespace) |

---

## Table of Contents

- [Users Management](#users-management)
- [Groups Management](#groups-management)
- [Applications & Service Principals](#applications--service-principals)
- [Audit & Sign-in Logs](#audit--sign-in-logs)
- [Security & Compliance](#security--compliance)
- [Microsoft 365 Reports](#microsoft-365-reports)
- [Service Health](#service-health)
- [SharePoint & OneDrive](#sharepoint--onedrive)
- [Device Management (Intune)](#device-management-intune)
- [Exchange & Teams](#exchange--teams)
- [Azure DevOps](#azure-devops)
- [Microsoft Fabric](#microsoft-fabric)
- [Privileged Identity Management (PIM)](#privileged-identity-management-pim)
- [Entitlement Management](#entitlement-management)
- [Windows Updates](#windows-updates)
- [Azure Resources](#azure-resources)
- [Azure Costs & Billing](#azure-costs--billing)
- [Azure Security (Defender)](#azure-security-defender)
- [Azure Monitoring](#azure-monitoring)
- [Power Platform Environments](#power-platform-environments)
- [Human Review Queue](#human-review-queue)
- [Dataverse (Power Platform)](#dataverse-power-platform)
- [ServiceNow Integration](#servicenow-integration)
- [External Data Sources](#external-data-sources)

---

## Users Management

### List All Users
- **Endpoint**: `GET https://graph.microsoft.com/v1.0/users`
- **Authentication**: OAuth 2.0 delegated session token (via `verifyAuth()` + `getDelegatedGraphClient()`)
- **Required Permission**: `User.Read.All`
- **Source File**: `src/app/api/users/route.ts`
- **Query Parameters**:
  - `$select`: Field selection (e.g., `displayName,userPrincipalName,mail`)
  - `$filter`: OData filter (e.g., `accountEnabled eq true`)
  - `$top`: Limit results (max 999)
  - `$skip`: Skip results for pagination
  - `$orderby`: Sort order
  - `$count`: Include count
  - `$expand`: Include related data
- **Response**: JSON array of user objects
- **Pagination**: Use `@odata.nextLink` for next page
- **Rate Limit**: Part of Graph API throttling (varies by tenant)
- **Documentation**: [Microsoft Graph - List users](https://learn.microsoft.com/en-us/graph/api/user-list)

### Get User Details
- **Endpoint**: `GET https://graph.microsoft.com/v1.0/users/{id}`
- **Authentication**: OAuth 2.0 delegated session token (via `verifyAuth()` + `getDelegatedGraphClient()`)
- **Required Permission**: `User.Read.All`
- **Source File**: `src/app/api/user-details/route.js`
- **Path Parameters**: `{id}` - User ID or UPN
- **Response**: Single user object with full details
- **Documentation**: [Microsoft Graph - Get user](https://learn.microsoft.com/en-us/graph/api/user-get)

### Create User
- **Endpoint**: `POST https://graph.microsoft.com/v1.0/users`
- **Authentication**: OAuth 2.0 delegated session token (via `verifyAuth()` + `getDelegatedGraphClient()`)
- **Required Permission**: `User.ReadWrite.All`
- **Source File**: `src/app/api/users/create-user/route.js`
- **Request Body** (minimum):
  ```json
  {
    "accountEnabled": true,
    "displayName": "John Doe",
    "mailNickname": "jdoe",
    "userPrincipalName": "jdoe@contoso.com",
    "passwordProfile": {
      "forceChangePasswordNextSignIn": true,
      "password": "TempPassword123!"
    }
  }
  ```
- **Response**: Created user object
- **Documentation**: [Microsoft Graph - Create user](https://learn.microsoft.com/en-us/graph/api/user-post-users)

### Get User Recent Activities
- **Endpoint**: `GET https://graph.microsoft.com/v1.0/users/{id}/activities/recent`
- **Authentication**: OAuth 2.0 delegated session token (via `verifyAuth()` + `getDelegatedGraphClient()`)
- **Required Permission**: `UserActivity.ReadWrite.CreatedByApp`
- **Source File**: `src/app/api/users/recent-activities/route.js`
- **Response**: User activity timeline
- **Documentation**: [Microsoft Graph - List recent activities](https://learn.microsoft.com/en-us/graph/api/projectrome-get-recent-activities)

---

## Groups Management

### List All Groups
- **Endpoint**: `GET https://graph.microsoft.com/v1.0/groups`
- **Authentication**: OAuth 2.0 delegated session token (via `verifyAuth()` + `getDelegatedGraphClient()`)
- **Required Permission**: `Group.Read.All`
- **Source File**: `src/app/groups/page.jsx`
- **Query Parameters**: Same as users ($select, $filter, $top, etc.)
- **Response**: JSON array of group objects
- **Pagination**: Use `@odata.nextLink`
- **Documentation**: [Microsoft Graph - List groups](https://learn.microsoft.com/en-us/graph/api/group-list)

### Get Group Details
- **Endpoint**: `GET https://graph.microsoft.com/v1.0/groups/{id}`
- **Authentication**: OAuth 2.0 delegated session token (via `verifyAuth()` + `getDelegatedGraphClient()`)
- **Required Permission**: `Group.Read.All`
- **Response**: Single group object
- **Documentation**: [Microsoft Graph - Get group](https://learn.microsoft.com/en-us/graph/api/group-get)

### List Group Members
- **Endpoint**: `GET https://graph.microsoft.com/v1.0/groups/{id}/members`
- **Authentication**: OAuth 2.0 delegated session token (via `verifyAuth()` + `getDelegatedGraphClient()`)
- **Required Permission**: `GroupMember.Read.All`
- **Response**: Array of directory objects (users, groups, service principals)
- **Documentation**: [Microsoft Graph - List members](https://learn.microsoft.com/en-us/graph/api/group-list-members)

---

## Applications & Service Principals

### List Applications (App Registrations)
- **Endpoint**: `GET https://graph.microsoft.com/v1.0/applications`
- **Authentication**: OAuth 2.0 delegated session token (via `verifyAuth()` + `getDelegatedGraphClient()`)
- **Required Permission**: `Application.Read.All`
- **Source File**: `src/app/applications/page.jsx`
- **Query Parameters**: `$select`, `$filter`, `$top`, `$orderby`
- **Response**: Array of application objects
- **Documentation**: [Microsoft Graph - List applications](https://learn.microsoft.com/en-us/graph/api/application-list)

### Add Application Password (Create Secret)
- **Endpoint**: `POST https://graph.microsoft.com/v1.0/applications/{id}/addPassword`
- **Authentication**: OAuth 2.0 delegated session token (via `verifyAuth()` + `getDelegatedGraphClient()`)
- **Required Permission**: `Application.ReadWrite.All`
- **Source File**: `src/app/api/applications/[id]/credentials/route.js`
- **Request Body**:
  ```json
  {
    "passwordCredential": {
      "displayName": "MySecret",
      "endDateTime": "2025-12-31T23:59:59Z"
    }
  }
  ```
- **Response**: Password credential object with secret value (only returned once)
- **Documentation**: [Microsoft Graph - application: addPassword](https://learn.microsoft.com/en-us/graph/api/application-addpassword)

### Remove Application Password (Delete Secret)
- **Endpoint**: `POST https://graph.microsoft.com/v1.0/applications/{id}/removePassword`
- **Authentication**: OAuth 2.0 delegated session token (via `verifyAuth()` + `getDelegatedGraphClient()`)
- **Required Permission**: `Application.ReadWrite.All`
- **Source File**: `src/app/api/applications/[id]/remove-password/route.js`
- **Request Body**:
  ```json
  {
    "keyId": "credential-key-id-guid"
  }
  ```
- **Response**: 204 No Content on success
- **Documentation**: [Microsoft Graph - application: removePassword](https://learn.microsoft.com/en-us/graph/api/application-removepassword)

---

## Audit & Sign-in Logs

### List Directory Audit Logs
- **Endpoint**: `GET https://graph.microsoft.com/v1.0/auditLogs/directoryAudits`
- **Authentication**: OAuth 2.0 delegated session token (via `verifyAuth()` + `getDelegatedGraphClient()`)
- **Required Permission**: `AuditLog.Read.All`
- **Source File**: `src/app/audit-logs/page.jsx`
- **Query Parameters**:
  - `$filter`: e.g., `activityDateTime ge 2025-01-01T00:00:00Z`
  - `$top`: Limit results (max 1000)
  - `$orderby`: e.g., `activityDateTime desc`
- **Response**: Array of directory audit objects
- **Documentation**: [Microsoft Graph - List directoryAudits](https://learn.microsoft.com/en-us/graph/api/directoryaudit-list)

### List Sign-in Logs
- **Endpoint**: `GET https://graph.microsoft.com/v1.0/auditLogs/signIns`
- **Authentication**: OAuth 2.0 delegated session token (via `verifyAuth()` + `getDelegatedGraphClient()`)
- **Required Permission**: `AuditLog.Read.All`, `Directory.Read.All`
- **Source File**: `src/app/api/user-signins/route.js`
- **Query Parameters**: Same filtering as directory audits
- **Response**: Array of sign-in objects
- **Note**: Premium P1 or P2 license required
- **Documentation**: [Microsoft Graph - List signIns](https://learn.microsoft.com/en-us/graph/api/signin-list)

### List Provisioning Logs
- **Endpoint**: `GET https://graph.microsoft.com/v1.0/auditLogs/provisioning`
- **Authentication**: OAuth 2.0 delegated session token (via `verifyAuth()` + `getDelegatedGraphClient()`)
- **Required Permission**: `AuditLog.Read.All`
- **Source File**: `src/app/api/provisioning-logs/route.js`
- **Query Parameters**: Standard OData filters
- **Response**: Array of provisioning event objects
- **Documentation**: [Microsoft Graph - List provisioningObjectSummary](https://learn.microsoft.com/en-us/graph/api/provisioningobjectsummary-list)

---

## Security & Compliance

### Get Secure Score
- **Endpoint**: `GET https://graph.microsoft.com/v1.0/security/secureScores`
- **Authentication**: OAuth 2.0 delegated session token (via `verifyAuth()` + `getDelegatedGraphClient()`)
- **Required Permission**: `SecurityEvents.Read.All`
- **Source File**: `src/app/api/secure-score/route.js`
- **Query Parameters**: `$top=1` for latest score
- **Response**: Array of secure score objects with current and max scores
- **Documentation**: [Microsoft Graph - List secureScores](https://learn.microsoft.com/en-us/graph/api/security-list-securescores)

### List Security Alerts
- **Endpoint**: `GET https://graph.microsoft.com/v1.0/security/alerts_v2`
- **Authentication**: OAuth 2.0 delegated session token (via `verifyAuth()` + `getDelegatedGraphClient()`)
- **Required Permission**: `SecurityEvents.Read.All`
- **Source File**: Multiple security routes
- **Query Parameters**: `$filter`, `$top`, `$skip`
- **Response**: Array of security alert objects
- **Documentation**: [Microsoft Graph - List alerts_v2](https://learn.microsoft.com/en-us/graph/api/security-list-alerts_v2)

### List Risky Users
- **Endpoint**: `GET https://graph.microsoft.com/v1.0/identityProtection/riskyUsers`
- **Authentication**: OAuth 2.0 delegated session token (via `verifyAuth()` + `getDelegatedGraphClient()`)
- **Required Permission**: `IdentityRiskyUser.Read.All`
- **Source File**: `src/app/api/risky-users/route.js`
- **Query Parameters**: `$filter`, `$top`, `$select`
- **Response**: Array of risky user objects with risk levels
- **Note**: Requires Microsoft Entra ID Premium P2
- **Documentation**: [Microsoft Graph - List riskyUsers](https://learn.microsoft.com/en-us/graph/api/riskyuser-list)

### List Conditional Access Policies
- **Endpoint**: `GET https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies`
- **Authentication**: OAuth 2.0 delegated session token (via `verifyAuth()` + `getDelegatedGraphClient()`)
- **Required Permission**: `Policy.Read.All`
- **Response**: Array of conditional access policy objects
- **Documentation**: [Microsoft Graph - List conditionalAccessPolicies](https://learn.microsoft.com/en-us/graph/api/conditionalaccessroot-list-policies)

---

## Microsoft 365 Reports

### Get Office 365 Active User Counts
- **Endpoint**: `GET https://graph.microsoft.com/v1.0/reports/getOffice365ActiveUserCounts(period='D7')`
- **Authentication**: OAuth 2.0 delegated session token (via `verifyAuth()` + `getDelegatedGraphClient()`)
- **Required Permission**: `Reports.Read.All`
- **Source File**: `src/app/api/reports/**/route.js`
- **Query Parameters**: `period` - D7, D30, D90, D180
- **Response**: CSV data with user counts by product
- **Documentation**: [Microsoft Graph - getOffice365ActiveUserCounts](https://learn.microsoft.com/en-us/graph/api/reportroot-getoffice365activeuserdetail)

### Get Teams User Activity
- **Endpoint**: `GET https://graph.microsoft.com/v1.0/reports/getTeamsUserActivityUserDetail(period='D7')`
- **Authentication**: OAuth 2.0 delegated session token (via `verifyAuth()` + `getDelegatedGraphClient()`)
- **Required Permission**: `Reports.Read.All`
- **Source File**: `src/app/api/teams/user-activity/route.js`
- **Query Parameters**: `period` - D7, D30, D90, D180
- **Response**: CSV data with Teams activity by user
- **Documentation**: [Microsoft Graph - getTeamsUserActivityUserDetail](https://learn.microsoft.com/en-us/graph/api/reportroot-getteamsuseractivityuserdetail)

### Get SharePoint Site Usage
- **Endpoint**: `GET https://graph.microsoft.com/v1.0/reports/getSharePointSiteUsageDetail(period='D7')`
- **Authentication**: OAuth 2.0 delegated session token (via `verifyAuth()` + `getDelegatedGraphClient()`)
- **Required Permission**: `Reports.Read.All`
- **Response**: CSV data with SharePoint site metrics
- **Documentation**: [Microsoft Graph Reports](https://learn.microsoft.com/en-us/graph/api/resources/report)

---

## Service Health

### List Service Health Overviews
- **Endpoint**: `GET https://graph.microsoft.com/v1.0/admin/serviceAnnouncement/healthOverviews`
- **Authentication**: OAuth 2.0 delegated session token (via `verifyAuth()` + `getDelegatedGraphClient()`)
- **Required Permission**: `ServiceHealth.Read.All`
- **Source File**: `src/app/service-health/page.jsx`
- **Response**: Array of service health status objects
- **Documentation**: [Microsoft Graph - List serviceHealths](https://learn.microsoft.com/en-us/graph/api/serviceannouncement-list-healthoverviews)

### List Service Issues
- **Endpoint**: `GET https://graph.microsoft.com/v1.0/admin/serviceAnnouncement/issues`
- **Authentication**: OAuth 2.0 delegated session token (via `verifyAuth()` + `getDelegatedGraphClient()`)
- **Required Permission**: `ServiceHealth.Read.All`
- **Query Parameters**: `$filter`, `$select`, `$top`
- **Response**: Array of active service issue objects
- **Documentation**: [Microsoft Graph - List issues](https://learn.microsoft.com/en-us/graph/api/serviceannouncement-list-issues)

### List Service Messages
- **Endpoint**: `GET https://graph.microsoft.com/v1.0/admin/serviceAnnouncement/messages`
- **Authentication**: OAuth 2.0 delegated session token (via `verifyAuth()` + `getDelegatedGraphClient()`)
- **Required Permission**: `ServiceMessage.Read.All`
- **Response**: Array of message center announcements
- **Documentation**: [Microsoft Graph - List messages](https://learn.microsoft.com/en-us/graph/api/serviceannouncement-list-messages)

---

## SharePoint & OneDrive

### Get SharePoint Admin Settings
- **Endpoint**: `GET https://graph.microsoft.com/v1.0/admin/sharepoint/settings`
- **Authentication**: OAuth 2.0 delegated session token (via `verifyAuth()` + `getDelegatedGraphClient()`)
- **Required Permission**: `SharePointTenantSettings.Read.All`
- **Source File**: `src/app/api/sharepoint/sites/route.js`
- **Response**: SharePoint tenant settings object
- **Documentation**: [Microsoft Graph - Get sharepointSettings](https://learn.microsoft.com/en-us/graph/api/sharepointsettings-get)

### Search SharePoint Sites
- **Endpoint**: `GET https://graph.microsoft.com/v1.0/sites?search=*`
- **Authentication**: OAuth 2.0 delegated session token (via `verifyAuth()` + `getDelegatedGraphClient()`)
- **Required Permission**: `Sites.Read.All`
- **Query Parameters**: `search` - Search query string
- **Response**: Array of site objects
- **Documentation**: [Microsoft Graph - Search for sites](https://learn.microsoft.com/en-us/graph/api/site-search)

---

## Device Management (Intune)

### List Managed Devices
- **Endpoint**: `GET https://graph.microsoft.com/v1.0/deviceManagement/managedDevices`
- **Authentication**: OAuth 2.0 delegated session token (via `verifyAuth()` + `getDelegatedGraphClient()`)
- **Required Permission**: `DeviceManagementManagedDevices.Read.All`
- **Source File**: `src/app/devices/page.jsx`
- **Query Parameters**: `$select`, `$filter`, `$top`, `$skip`
- **Response**: Array of managed device objects
- **Pagination**: Use `@odata.nextLink`
- **Documentation**: [Microsoft Graph - List managedDevices](https://learn.microsoft.com/en-us/graph/api/intune-devices-manageddevice-list)

### Get Device Details
- **Endpoint**: `GET https://graph.microsoft.com/v1.0/deviceManagement/managedDevices/{id}`
- **Authentication**: OAuth 2.0 delegated session token (via `verifyAuth()` + `getDelegatedGraphClient()`)
- **Required Permission**: `DeviceManagementManagedDevices.Read.All`
- **Source File**: `src/app/api/device-management/route.js`
- **Response**: Single managed device object
- **Documentation**: [Microsoft Graph - Get managedDevice](https://learn.microsoft.com/en-us/graph/api/intune-devices-manageddevice-get)

### Remote Lock Device
- **Endpoint**: `POST https://graph.microsoft.com/v1.0/deviceManagement/managedDevices/{id}/remoteLock`
- **Authentication**: OAuth 2.0 delegated session token (via `verifyAuth()` + `getDelegatedGraphClient()`)
- **Required Permission**: `DeviceManagementManagedDevices.PrivilegedOperations.All`
- **Request Body**: Empty
- **Response**: 204 No Content on success
- **Documentation**: [Microsoft Graph - remoteLock action](https://learn.microsoft.com/en-us/graph/api/intune-devices-manageddevice-remotelock)

### Wipe Device
- **Endpoint**: `POST https://graph.microsoft.com/v1.0/deviceManagement/managedDevices/{id}/wipe`
- **Authentication**: OAuth 2.0 delegated session token (via `verifyAuth()` + `getDelegatedGraphClient()`)
- **Required Permission**: `DeviceManagementManagedDevices.PrivilegedOperations.All`
- **Request Body**: 
  ```json
  {
    "keepEnrollmentData": false,
    "keepUserData": false
  }
  ```
- **Response**: 204 No Content on success
- **Documentation**: [Microsoft Graph - wipe action](https://learn.microsoft.com/en-us/graph/api/intune-devices-manageddevice-wipe)

---

## Azure Resources

### Query Resources with Resource Graph
- **Endpoint**: `POST https://management.azure.com/providers/Microsoft.ResourceGraph/resources?api-version=2024-04-01`
- **Authentication**: OAuth 2.0 delegated token (scope: `https://management.azure.com/.default`, acquired via `getServerTokens()`)
- **Required Permission**: Azure Reader role on subscription
- **Source File**: `src/app/api/resource-graph/route.js`
- **Request Body**:
  ```json
  {
    "query": "Resources | where type == 'microsoft.compute/virtualmachines' | project name, location, resourceGroup",
    "subscriptions": ["subscription-id-here"]
  }
  ```
- **Response**: JSON with data array and query statistics
- **Documentation**: [Azure Resource Graph REST API](https://learn.microsoft.com/en-us/rest/api/azureresourcegraph/resourcegraph(2021-03-01)/resources/resources)

### List Subscriptions
- **Endpoint**: `GET https://management.azure.com/subscriptions?api-version=2020-01-01`
- **Authentication**: OAuth 2.0 delegated token (scope: `https://management.azure.com/.default`)
- **Required Permission**: Reader role or higher
- **Source File**: `src/app/billing/page.jsx`
- **Response**: Array of subscription objects
- **Documentation**: [Azure Subscriptions - List](https://learn.microsoft.com/en-us/rest/api/resources/subscriptions/list)

---

## Azure Costs & Billing

### Query Cost Data
- **Endpoint**: `POST https://management.azure.com/subscriptions/{subscriptionId}/providers/Microsoft.CostManagement/query?api-version=2023-03-01`
- **Authentication**: OAuth 2.0 delegated token (scope: `https://management.azure.com/.default`)
- **Required Permission**: Cost Management Reader or higher
- **Source File**: `src/app/billing/page.jsx`
- **Request Body**:
  ```json
  {
    "type": "ActualCost",
    "timeframe": "MonthToDate",
    "dataset": {
      "granularity": "Daily",
      "aggregation": {
        "totalCost": { "name": "Cost", "function": "Sum" }
      },
      "grouping": [
        { "type": "Dimension", "name": "ResourceGroup" }
      ]
    }
  }
  ```
- **Response**: Cost data with columns and rows
- **Documentation**: [Azure Cost Management - Query API](https://learn.microsoft.com/en-us/rest/api/cost-management/query/usage)

### Get Usage Details
- **Endpoint**: `GET https://management.azure.com/subscriptions/{subscriptionId}/providers/Microsoft.Consumption/usageDetails?api-version=2024-08-01`
- **Authentication**: OAuth 2.0 delegated token (scope: `https://management.azure.com/.default`)
- **Required Permission**: Cost Management Reader
- **Source File**: `src/app/billing/page.jsx`
- **Query Parameters**:
  - `$filter`: e.g., `properties/usageStart ge '2025-01-01'`
  - `$top`: Limit results
- **Response**: Array of usage detail objects
- **Documentation**: [Azure Consumption - Usage Details](https://learn.microsoft.com/en-us/rest/api/consumption/usage-details/list)

---

## Azure Security (Defender)

### List Security Assessments
- **Endpoint**: `GET https://management.azure.com/providers/Microsoft.Security/assessments?api-version=2024-09-01`
- **Authentication**: OAuth 2.0 delegated token (scope: `https://management.azure.com/.default`)
- **Required Permission**: Security Reader role
- **Source File**: `src/app/api/security/assessments/route.js`
- **Query Parameters**: `$expand=links,metadata`
- **Response**: Array of security assessment objects
- **Documentation**: [Microsoft Defender - List assessments](https://learn.microsoft.com/en-us/rest/api/defenderforcloud/assessments/list)

### Get Security Assessment
- **Endpoint**: `GET https://management.azure.com/subscriptions/{subscriptionId}/providers/Microsoft.Security/assessments/{assessmentName}?api-version=2024-09-01`
- **Authentication**: OAuth 2.0 delegated token (scope: `https://management.azure.com/.default`)
- **Required Permission**: Security Reader role
- **Source File**: `src/app/api/security/assessments/get/route.js`
- **Path Parameters**: `{assessmentName}` - Assessment ID
- **Response**: Single assessment object with findings
- **Documentation**: [Microsoft Defender - Get assessment](https://learn.microsoft.com/en-us/rest/api/defenderforcloud/assessments/get)

### List Azure Advisor Recommendations
- **Endpoint**: `GET https://management.azure.com/subscriptions/{subscriptionId}/providers/Microsoft.Advisor/recommendations?api-version=2023-01-01`
- **Authentication**: OAuth 2.0 delegated token (scope: `https://management.azure.com/.default`)
- **Required Permission**: Reader role
- **Source File**: `src/app/api/azure-advisor-list/route.js`
- **Query Parameters**: `$filter`, `$top`, `$skip`
- **Response**: Array of recommendation objects
- **Documentation**: [Azure Advisor - List recommendations](https://learn.microsoft.com/en-us/rest/api/advisor/recommendations/list)

### Get Advisor Score
- **Endpoint**: `GET https://management.azure.com/subscriptions/{subscriptionId}/providers/Microsoft.Advisor/advisorScore?api-version=2023-01-01`
- **Authentication**: OAuth 2.0 delegated token (scope: `https://management.azure.com/.default`)
- **Required Permission**: Reader role
- **Source File**: `src/app/api/azure-advisor-score/route.js`
- **Response**: Advisor score object with category scores
- **Documentation**: [Azure Advisor Score](https://learn.microsoft.com/en-us/rest/api/advisor/advisor-score)

---

## Azure Monitoring

### Azure Monitor API Coverage

- **Endpoint**: `GET /api/azure/monitor/api-coverage?subscriptionId={subscriptionId}&activityLookbackHours=24`
- **Upstream Endpoints**: Azure Monitor REST APIs under `https://management.azure.com/`, including Activity Log events/categories, fired alerts, action groups, metric alerts/status, activity log alerts, alert processing rules, scheduled query rules, smart detector rules, autoscale settings, data collection rules/endpoints, subscription diagnostic settings, Azure Monitor workspaces, Application Insights components/web tests/workbooks, Log Analytics workspaces/deleted workspaces, and query packs
- **Authentication**: OAuth 2.0 delegated token (scope: `https://management.azure.com/.default`)
- **Required Permission**: Reader or Monitoring Reader role, depending on operation group
- **Source File**: `src/app/api/azure/monitor/api-coverage/route.ts`
- **Response**: Per-operation-group status, item counts, API versions, request URLs, and small samples
- **Documentation**: [Azure Monitor REST API index](https://learn.microsoft.com/en-us/azure/azure-monitor/fundamentals/azure-monitor-rest-api-index)

### List Log Analytics Workspaces
- **Endpoint**: `GET https://management.azure.com/subscriptions/{subscriptionId}/providers/Microsoft.OperationalInsights/workspaces?api-version=2023-09-01`
- **Authentication**: OAuth 2.0 delegated token (scope: `https://management.azure.com/.default`)
- **Required Permission**: Reader role
- **Source File**: `src/app/api/log-analytics-workspaces/route.js`
- **Response**: Array of workspace objects
- **Documentation**: [Log Analytics - List workspaces](https://learn.microsoft.com/en-us/rest/api/loganalytics/workspaces/list)

### Query Log Analytics Workspace
- **Endpoint**: `POST https://management.azure.com/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.OperationalInsights/workspaces/{workspaceName}/api/query?api-version=2023-09-01`
- **Authentication**: OAuth 2.0 delegated token (scope: `https://management.azure.com/.default`)
- **Required Permission**: Log Analytics Reader role
- **Source File**: `src/app/api/log-analytics-query/route.js`
- **Request Body**:
  ```json
  {
    "query": "AzureActivity | where TimeGenerated > ago(1h) | take 100",
    "timespan": "PT1H"
  }
  ```
- **Response**: Query results with tables and rows
- **Documentation**: [Log Analytics - Query](https://learn.microsoft.com/en-us/rest/api/loganalytics/dataaccess/query/execute)

### List Application Insights Instances
- **Endpoint**: `GET https://management.azure.com/subscriptions/{subscriptionId}/providers/Microsoft.Insights/components?api-version=2020-02-02`
- **Authentication**: OAuth 2.0 delegated token (scope: `https://management.azure.com/.default`)
- **Required Permission**: Reader role
- **Source File**: `src/app/api/application-insights-instances/route.js`
- **Response**: Array of Application Insights component objects
- **Documentation**: [Application Insights - List](https://learn.microsoft.com/en-us/rest/api/application-insights/components/list)

### Query Application Insights
- **Endpoint**: `POST https://api.loganalytics.azure.com/v1/{armResourceId}/query`
- **Authentication**: OAuth 2.0 delegated token (scope: `https://api.loganalytics.io/.default`)
- **Required Permission**: Reader or Monitoring Reader on the component **and** its Log Analytics workspace
- **Source File**: `src/app/api/application-insights-query/route.ts` (via `src/lib/appInsightsQuery.ts`)
- **Request Body**:
  ```json
  {
    "query": "exceptions | where timestamp > ago(24h) | summarize count() by type",
    "timespan": "P1D"
  }
  ```
- **Response**: Query results with tables
- **Documentation**: [Application Insights Query API](https://learn.microsoft.com/en-us/rest/api/application-insights/query/execute)

### Get Application Insights Metrics
- **Endpoint**: `POST https://api.loganalytics.azure.com/v1/{armResourceId}/query`
- **Authentication**: OAuth 2.0 delegated token (scope: `https://api.loganalytics.io/.default`)
- **Required Permission**: Reader or Monitoring Reader on the component **and** its Log Analytics workspace
- **Source File**: `src/app/api/application-insights-metrics/route.ts` (via `src/lib/appInsightsQuery.ts`)
- **Body Parameters**:
  - `query`: KQL summarizing the metric (exception and failed-request counts)
  - `timespan`: ISO 8601 duration, e.g. `P7D`
- **Response**: `tables[].columns[]/rows[]`
- **Documentation**: [Querying logs for Azure resources](https://learn.microsoft.com/en-us/azure/azure-monitor/logs/api/azure-resource-queries)

---

## Power Platform Environments

### List Power Platform Environments
- **Endpoint**: `GET https://api.powerplatform.com/environmentmanagement/environments?api-version=2024-10-01`
- **Authentication**: OAuth 2.0 delegated token (scope: `https://api.powerplatform.com/.default`, acquired via `getPowerPlatformDelegatedToken()`)
- **Required Permission**: Power Platform Administrator role
- **Source File**: `src/app/power-platform/page.jsx`
- **Response**: Array of environment objects with:
  - `id`, `name`, `properties.displayName`
  - `properties.linkedEnvironmentMetadata.instanceUrl` (Dataverse URL)
  - `properties.capacity` (storage, database capacity)
  - `properties.addons` (capacity add-ons)
  - `properties.environmentType` (Production, Sandbox, Trial, etc.)
- **Documentation**: [Power Platform API - List environments](https://learn.microsoft.com/en-us/rest/api/power-platform/environmentmanagement/environments/get-environments)

### Get Power Platform Tenant Settings
- **Endpoint**: `POST https://api.bap.microsoft.com/providers/Microsoft.BusinessAppPlatform/listtenantsettings?api-version=2020-10-01`
- **Authentication**: Client credentials (service principal) with scope `https://api.bap.microsoft.com/.default`
- **Method**: POST (no body required)
- **Source File**: `src/app/api/power-platform/tenant-settings/route.js`
- **Required Permission**: Power Platform Administrator role
- **Response**: Tenant settings object
- **Documentation**: [Power Platform Tenant Settings API](https://learn.microsoft.com/en-us/power-platform/admin/list-tenantsettings)

### List Environment Operations
- **Endpoint**: `GET /api/power-platform/environmentmanagement/environments/{environmentId}/operations`
- **Authentication**: OAuth 2.0 delegated token (scope: `https://service.powerapps.com/.default`)
- **Required Permission**: Power Platform Administrator role
- **Source File**: `src/app/api/power-platform/environmentmanagement/environments/[environmentId]/operations/route.ts`
- **Response**: Collection of long-running operation metadata for the environment
- **Documentation**: [Environment Operations](https://learn.microsoft.com/en-us/rest/api/power-platform/environmentmanagement/environments)

### Get Environment Operation Detail
- **Endpoint**: `GET /api/power-platform/environmentmanagement/environments/{environmentId}/operations/{operationId}`
- **Authentication**: OAuth 2.0 delegated token (scope: `https://service.powerapps.com/.default`)
- **Required Permission**: Power Platform Administrator role
- **Source File**: `src/app/api/power-platform/environmentmanagement/environments/[environmentId]/operations/[operationId]/route.ts`
- **Response**: Current status and details of a specific environment operation
- **Documentation**: [Environment Operations](https://learn.microsoft.com/en-us/rest/api/power-platform/environmentmanagement/environments)

### Environment Groups Management
- **Endpoint**: `GET/POST/PUT/DELETE /api/power-platform/environmentmanagement/environment-groups/*`
- **Authentication**: OAuth 2.0 delegated token (scope: `https://service.powerapps.com/.default`)
- **Required Permission**: Power Platform Administrator role
- **Source Files**:
  - `src/app/api/power-platform/environmentmanagement/environment-groups/route.ts`
  - `src/app/api/power-platform/environmentmanagement/environment-groups/[groupId]/route.ts`
  - `src/app/api/power-platform/environmentmanagement/environment-groups/[groupId]/add-environment/[environmentId]/route.ts`
  - `src/app/api/power-platform/environmentmanagement/environment-groups/[groupId]/remove-environment/[environmentId]/route.ts`
- **Response**: Environment group objects, membership operation results, and operation IDs
- **Documentation**: [Environment Groups](https://learn.microsoft.com/en-us/rest/api/power-platform/environmentmanagement/environment-groups)

### List Environment Application Packages
- **Endpoint**: `GET /api/power-platform/tenant-apps?environmentId={environmentId}`
- **Authentication**: OAuth 2.0 delegated token (scope: `https://service.powerapps.com/.default`)
- **Required Permission**: Power Platform Administrator role
- **Source File**: `src/app/api/power-platform/tenant-apps/route.ts`
- **Response**: Installable first-party application packages for the target environment
- **Documentation**: [Get Environment Application Package](https://learn.microsoft.com/en-us/rest/api/power-platform/appmanagement/applications/get-environment-application-package)

### Install Environment Application Package
- **Endpoint**: `POST /api/power-platform/appmanagement/environments/{environmentId}/application-packages/{uniqueName}/install`
- **Authentication**: Power Platform delegated token + CSRF validation
- **Required Permission**: Power Platform Administrator role
- **Source File**: `src/app/api/power-platform/appmanagement/environments/[environmentId]/application-packages/[uniqueName]/install/route.ts`
- **Response**: Install request acceptance and operation metadata (includes operation ID)
- **Documentation**: [Install Application Package](https://learn.microsoft.com/en-us/rest/api/power-platform/appmanagement/applications/install-application-package)

### Get Application Package Install Status
- **Endpoint**: `GET /api/power-platform/appmanagement/environments/{environmentId}/operations/{operationId}`
- **Authentication**: OAuth 2.0 delegated token (scope: `https://service.powerapps.com/.default`)
- **Required Permission**: Power Platform Administrator role
- **Source File**: `src/app/api/power-platform/appmanagement/environments/[environmentId]/operations/[operationId]/route.ts`
- **Response**: Operation state (NotStarted/Running/Succeeded/Failed) and status details
- **Documentation**: [Get Application Package Install Status](https://learn.microsoft.com/en-us/rest/api/power-platform/appmanagement/applications/get-application-package-install-status)

### Billing Policies
- **Endpoint**: `GET/POST /api/power-platform/licensing/billing-policies`
- **Authentication**: OAuth 2.0 delegated token (scope: `https://service.powerapps.com/.default`)
- **Required Permission**: Billing Admin and/or Power Platform Administrator role
- **Source File**: `src/app/api/power-platform/licensing/billing-policies/route.ts`
- **Response**: Billing policy collection
- **Documentation**: [Billing Policies](https://learn.microsoft.com/en-us/rest/api/power-platform/licensing/billing-policy)

### Billing Policy Item CRUD
- **Endpoint**: `GET/PATCH/DELETE /api/power-platform/licensing/billing-policies/{policyId}`
- **Authentication**: Power Platform delegated token (`PATCH`/`DELETE` also require CSRF validation)
- **Required Permission**: Billing Admin and/or Power Platform Administrator role
- **Source File**: `src/app/api/power-platform/licensing/billing-policies/[policyId]/route.ts`
- **Response**: Billing policy item details and lifecycle operation results
- **Documentation**: [Billing Policies](https://learn.microsoft.com/en-us/rest/api/power-platform/licensing/billing-policy)

### Billing Policy Environment Membership
- **Endpoint**: `GET/POST /api/power-platform/licensing/billing-policies/{policyId}/environments`
- **Authentication**: Power Platform delegated token (`POST` also requires CSRF validation)
- **Required Permission**: Billing Admin and/or Power Platform Administrator role
- **Source File**: `src/app/api/power-platform/licensing/billing-policies/[policyId]/environments/route.ts`
- **Response**: Environment membership list and add/remove operation results
- **Documentation**: [Billing Policy Environments](https://learn.microsoft.com/en-us/rest/api/power-platform/licensing/billing-policy)

---

## Human Review Queue

### Create Human Review Request
- **Endpoint**: `POST /api/hitl/requests/$subscriptions`
- **Authentication**: Authenticated Portal 360 session with CSRF validation, or optional server-to-server shared secret via `PORTAL360_HITL_CONNECTOR_SECRET`
- **Source File**: `src/app/api/hitl/requests/$subscriptions/route.ts`
- **Request Body**: Power Platform custom connector webhook action payload with `notificationUrl` and `body` fields
- **Response**: `201` with request ID and pending status
- **Security Note**: Stores the Power Platform `notificationUrl` server-side only; it is never returned to browser clients

### List Human Review Requests
- **Endpoint**: `GET /api/hitl/requests?status={status}`
- **Authentication**: Authenticated Portal 360 session via `verifyAuth()`
- **Source File**: `src/app/api/hitl/requests/route.ts`
- **Query Parameters**:
  - `status`: Optional filter (`pending`, `approved`, `rejected`, `needs-info`, `cancelled`)
  - `scenario`: Optional metadata scenario filter
- **Response**: Review request DTOs without callback URLs

### Submit Human Review Response
- **Endpoint**: `POST /api/hitl/requests/{id}/respond`
- **Authentication**: Authenticated Portal 360 session via `verifyAuth()` plus CSRF validation
- **Source File**: `src/app/api/hitl/requests/[id]/respond/route.ts`
- **Request Body**: Decision (`approved`, `rejected`, or `needs-info`) and response text
- **Response**: Updated review request after the Power Platform callback succeeds

### Cancel Human Review Request
- **Endpoint**: `DELETE /api/hitl/requests/{id}`
- **Authentication**: Authenticated Portal 360 session with CSRF validation, or optional server-to-server shared secret for connector unsubscribe
- **Source File**: `src/app/api/hitl/requests/[id]/route.ts`
- **Response**: Cancelled request ID and status

---

## Dataverse (Power Platform)

**Important**: All Dataverse endpoints use dynamic base URLs based on the environment:  
`https://{environment-url}/api/data/v9.2/`

Example: `https://org12345678.crm.dynamics.com/api/data/v9.2/`

### Dataverse Admin Snapshot

- **Endpoint**: `GET /api/power-platform/dataverse/admin-snapshot?instanceUrl={instanceUrl}`
- **Upstream Endpoints**: `WhoAmI`, `organizations`, `EntityDefinitions`, `solutions`, `systemusers`, `teams`, `businessunits`, `connectionreferences`, and `asyncoperations`
- **Authentication**: Dataverse token scoped to `{instanceUrl}/.default`
- **Required Permission**: Read access to Dataverse metadata and administration tables; System Administrator or equivalent recommended
- **Source File**: `src/app/api/power-platform/dataverse/admin-snapshot/route.ts`
- **Response**: Environment summary, audit posture, table and solution counts, user/team samples, connection reference health, recent async operations, and admin recommendations
- **Documentation**: [Dataverse Web API samples](https://deepwiki.com/microsoft/PowerApps-Samples/4.2-web-api-samples)

### List Teams
- **Endpoint**: `GET {instanceUrl}/api/data/v9.2/teams`
- **Authentication**: Dataverse token scoped to `{instanceUrl}/.default`
- **Required Permission**: System Administrator security role in environment
- **Source File**: `src/app/power-platform/environments/page.jsx` (line ~550)
- **Query Parameters**:
  - `$select=teamid,name,description,_businessunitid_value,teamtype,_administratorid_value`
  - `$orderby=name asc`
  - `$filter`: OData filter expression
  - `$top`: Limit results
- **Response**: JSON object with `value` array of team objects
- **Documentation**: [Dataverse - team entity](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/reference/entities/team)

### Create Team
- **Endpoint**: `POST {instanceUrl}/api/data/v9.2/teams`
- **Authentication**: Dataverse token
- **Required Permission**: System Administrator security role
- **Source File**: `src/app/power-platform/environments/page.jsx` (line ~1786+)
- **Request Headers**:
  - `Content-Type: application/json`
  - `OData-MaxVersion: 4.0`
  - `OData-Version: 4.0`
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
- **Response**: 204 No Content with `OData-EntityId` header containing new team URL
- **Documentation**: [Dataverse - Create entity](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/create-entity-web-api)

### Get Team Members
- **Endpoint**: `GET {instanceUrl}/api/data/v9.2/teams({teamId})/teammembership_association`
- **Authentication**: Dataverse token
- **Required Permission**: Read access to team
- **Source File**: `src/app/api/power-platform/dataverse/teams/{teamId}/members/route.js`
- **Query Parameters**: `$select=systemuserid,fullname,internalemailaddress`
- **Response**: Array of systemuser objects
- **Documentation**: [Dataverse - Retrieve related entities](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/retrieve-related-entities-query)

### Add Team Member
- **Endpoint**: `POST {instanceUrl}/api/data/v9.2/teams({teamId})/teammembership_association/$ref`
- **Authentication**: Dataverse token
- **Required Permission**: Write access to team
- **Request Body**:
  ```json
  {
    "@odata.id": "{instanceUrl}/api/data/v9.2/systemusers({userId})"
  }
  ```
- **Response**: 204 No Content on success
- **Documentation**: [Dataverse - Associate entities](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/associate-disassociate-entities-using-web-api)

### Remove Team Member
- **Endpoint**: `DELETE {instanceUrl}/api/data/v9.2/teams({teamId})/teammembership_association({userId})/$ref`
- **Authentication**: Dataverse token
- **Required Permission**: Write access to team
- **Source File**: `src/app/power-platform/environments/page.jsx` (line ~1154+)
- **Response**: 204 No Content on success
- **Documentation**: [Dataverse - Disassociate entities](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/associate-disassociate-entities-using-web-api#disassociate-entities)

### List / Create Dataverse Security Roles
- **Endpoint**: `GET|POST /api/power-platform/dataverse/security-roles?instanceUrl={instanceUrl}`
- **Upstream Endpoints**: `GET {instanceUrl}/api/data/v9.2/roles`, `POST {instanceUrl}/api/data/v9.2/roles`
- **Authentication**: Delegated Dataverse token scoped to `{instanceUrl}/.default` (`getUserDataverseToken`)
- **Required Permission**: `portal.write` (POST) plus System Administrator or System Customizer in the environment
- **Source File**: `src/app/api/power-platform/dataverse/security-roles/route.ts`
- **Query Parameters (GET)**: `instanceUrl` (required), `search` (optional name filter)
- **Request Body (POST)**:
  ```json
  {
    "instanceUrl": "https://org12345678.crm.dynamics.com",
    "name": "Invoice Reviewer",
    "description": "Read-only access to invoice tables",
    "isInherited": 1,
    "businessUnitId": "optional-guid"
  }
  ```
- **Response**: GET returns root-business-unit roles only (`_parentroleid_value eq null`); POST returns the new `roleId` parsed from the `OData-EntityId` header
- **Documentation**: [Dataverse - role entity](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/reference/entities/role)

### Get / Update Security Role Privileges
- **Endpoint**: `GET|POST /api/power-platform/dataverse/security-roles/privileges`
- **Upstream Endpoints**: `GET {instanceUrl}/api/data/v9.2/RetrieveRolePrivilegesRole(RoleId={roleId})`, `POST {instanceUrl}/api/data/v9.2/roles({roleId})/Microsoft.Dynamics.CRM.ReplacePrivilegesRole`
- **Authentication**: Delegated Dataverse token
- **Required Permission**: `portal.write` (POST) plus System Administrator or System Customizer
- **Source File**: `src/app/api/power-platform/dataverse/security-roles/privileges/route.ts`
- **Query Parameters (GET)**: `instanceUrl`, `roleId`
- **Request Body (POST)**:
  ```json
  {
    "instanceUrl": "https://org12345678.crm.dynamics.com",
    "roleId": "guid",
    "changes": [
      { "privilegeName": "prvReadaccount", "depth": "Global" },
      { "privilegeName": "prvDeleteaccount", "depth": "None" }
    ]
  }
  ```
- **Note**: `depth: "None"` removes the privilege. The route re-reads the current privilege set server-side and merges the requested changes before calling `ReplacePrivilegesRole`, because Dataverse has no partial-update message that can also remove privileges.
- **PrivilegeDepth values**: `Basic` (User), `Local` (Business Unit), `Deep` (Parent: Child BU), `Global` (Organization)
- **Documentation**: [ReplacePrivilegesRole Action](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/reference/replaceprivilegesrole)

### List Table Privilege Metadata
- **Endpoint**: `GET /api/power-platform/dataverse/security-roles/tables?instanceUrl={instanceUrl}`
- **Upstream Endpoint**: `GET {instanceUrl}/api/data/v9.2/EntityDefinitions?$select=LogicalName,DisplayName,IsCustomEntity,IsPrivate,IsIntersect,Privileges`
- **Authentication**: Delegated Dataverse token (acquired outside the cache callback — delegated acquisition reads the session cookie and cannot run inside `unstable_cache`)
- **Required Permission**: Read access to Dataverse metadata
- **Source File**: `src/app/api/power-platform/dataverse/security-roles/tables/route.ts`
- **Response**: Tables with their `SecurityPrivilegeMetadata` (`PrivilegeId`, `Name`, `PrivilegeType`, `CanBeBasic/Local/Deep/Global`). Private and intersect tables are filtered in code. Cached for 10 minutes.
- **Documentation**: [SecurityPrivilegeMetadata](https://learn.microsoft.com/en-us/dotnet/api/microsoft.xrm.sdk.metadata.securityprivilegemetadata)

### Copy Security Role to Another Environment
- **Endpoint**: `POST /api/power-platform/dataverse/security-roles/copy`
- **Upstream Endpoints**: source `RetrieveRolePrivilegesRole`, target `GET /privileges?$filter=name eq '...'`, target `POST /roles`, target `ReplacePrivilegesRole`
- **Authentication**: Delegated Dataverse token acquired separately for the source and target instance URLs
- **Required Permission**: `portal.write` plus System Administrator or System Customizer in **both** environments
- **Source File**: `src/app/api/power-platform/dataverse/security-roles/copy/route.ts`
- **Request Body**:
  ```json
  {
    "sourceInstanceUrl": "https://dev.crm.dynamics.com",
    "targetInstanceUrl": "https://test.crm.dynamics.com",
    "roleId": "guid",
    "targetRoleName": "Invoice Reviewer",
    "conflictBehavior": "create"
  }
  ```
- **Response**: `{ created, overwritten, sourcePrivilegeCount, copiedPrivilegeCount, skippedPrivileges, unnameablePrivilegeCount }`
- **Errors**: `409` with `code: "role_exists"` when `conflictBehavior` is `create` and the target name is taken
- **Note**: Privilege GUIDs differ per environment for custom tables, so privileges are mapped by **name** (e.g. `prvCreatenew_invoice`) and re-resolved against the target. Names are resolved in batches of 40 to stay within URL length limits. Privileges whose backing table does not exist in the target are reported in `skippedPrivileges`.
- **Documentation**: [RetrieveRolePrivilegesRole Function](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/reference/retrieveroleprivilegesrole)

### List Solutions
- **Endpoint**: `GET {instanceUrl}/api/data/v9.2/solutions`
- **Authentication**: Dataverse token
- **Required Permission**: Read access to solutions
- **Query Parameters**: `$select=friendlyname,uniquename,version,ismanaged,createdon,modifiedon,installedon&$orderby=friendlyname asc`
- **Response**: Array of solution objects
- **Documentation**: [Dataverse - solution entity](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/reference/entities/solution)

### List Bots (Copilot Agents)
- **Endpoint**: `GET {instanceUrl}/api/data/v9.2/bots`
- **Authentication**: Dataverse token
- **Required Permission**: Read access to bot entity
- **Source File**: `src/app/power-platform/environments/page.jsx` (line ~1600+)
- **Query Parameters**: `$select=name,schemaname,publishedon,statecode,statuscode`
- **Response**: Array of bot objects
- **Note**: Application user must have read access to bot entity; assign appropriate security role
- **Documentation**: [Dataverse - bot entity](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/reference/entities/bot)

### List Business Units
- **Endpoint**: `GET {instanceUrl}/api/data/v9.2/businessunits`
- **Authentication**: Dataverse token
- **Required Permission**: Read access to business units
- **Query Parameters**: `$select=businessunitid,name&$filter=contains(name,'search-term')`
- **Response**: Array of business unit objects
- **Documentation**: [Dataverse - businessunit entity](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/reference/entities/businessunit)

### List System Users
- **Endpoint**: `GET {instanceUrl}/api/data/v9.2/systemusers`
- **Authentication**: Dataverse token
- **Required Permission**: Read access to users
- **Query Parameters**: `$select=systemuserid,fullname,internalemailaddress&$filter=contains(fullname,'search-term')`
- **Response**: Array of systemuser objects
- **Documentation**: [Dataverse - systemuser entity](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/reference/entities/systemuser)

### List Audit Logs
- **Endpoint**: `GET {instanceUrl}/api/data/v9.2/audits`
- **Authentication**: Dataverse token
- **Required Permission**: Read access to audit entity
- **Source File**: `src/app/power-platform/environments/page.jsx`
- **Query Parameters**: 
  - `$select=auditid,createdon,action,operation,objecttypecode,_objectid_value,_userid_value,attributemask`
  - `$orderby=createdon desc`
  - `$top=100`
- **Response**: Array of audit record objects with change tracking information
- **Note**: `_objectid_value` is the GUID of the audited record; use `objecttypecode` for entity type
- **Documentation**: [Dataverse - audit entity](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/reference/entities/audit)

### List Conversations (Transcripts)
- **Endpoint**: `GET {instanceUrl}/api/data/v9.2/conversationtranscripts`
- **Authentication**: Dataverse token
- **Required Permission**: Read access to conversation transcripts
- **Source File**: `src/app/power-platform/environments/page.jsx` (line ~2350+)
- **Query Parameters**: `$select=...&$orderby=createdon desc&$top=100`
- **Response**: Array of conversation transcript objects
- **Documentation**: [Dataverse - conversationtranscript entity](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/reference/entities/conversationtranscript)

### List Tables (EntityDefinitions)
- **Endpoint**: `GET {instanceUrl}/api/data/v9.2/EntityDefinitions`
- **Authentication**: Dataverse token
- **Required Permission**: Read metadata
- **Source File**: `src/app/api/power-platform/dataverse/tables/route.js`
- **Query Parameters**: `$select=LogicalName,SchemaName,EntitySetName,DisplayName,PrimaryNameAttribute`
- **Response**: Array of entity metadata objects
- **Documentation**: [Dataverse - EntityMetadata](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/reference/entitymetadata)

### Query Table Rows
- **Endpoint**: `GET {instanceUrl}/api/data/v9.2/{entitySetName}`
- **Authentication**: Dataverse token
- **Required Permission**: Read access to specific table
- **Source File**: `src/app/api/power-platform/dataverse/query/route.js`
- **Query Parameters**:
  - `$select=field1,field2,field3` - Select specific columns
  - `$filter=statecode eq 0` - Filter results
  - `$orderby=createdon desc` - Sort order
  - `$top=50` - Limit results
  - `$expand=ownerid($select=fullname)` - Include related data
  - `$count=true` - Include total count
- **Response**: JSON object with `value` array and optional `@odata.nextLink` for pagination
- **Documentation**: [Dataverse - Query data](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/query-data-web-api)

### Export Solution
- **Endpoint**: `POST {instanceUrl}/api/data/v9.2/ExportSolution`
- **Authentication**: Dataverse token
- **Required Permission**: System Administrator security role
- **Source File**: `src/app/api/power-platform/dataverse/solutions/export/route.js`
- **Request Body**:
  ```json
  {
    "SolutionName": "MyCustomSolution",
    "Managed": false,
    "ExportAutoNumberingSettings": true,
    "ExportCalendarSettings": true,
    "ExportCustomizationSettings": true,
    "ExportEmailTrackingSettings": true,
    "ExportGeneralSettings": true,
    "ExportMarketingSettings": true,
    "ExportOutlookSynchronizationSettings": true,
    "ExportRelationshipRoles": true,
    "ExportIsvConfig": true,
    "ExportSales": true,
    "ExportExternalApplications": true
  }
  ```
- **Response**: JSON with `ExportJobId` (GUID) and `AsyncOperationId` for status tracking
- **Documentation**: [Dataverse - ExportSolution Action](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/reference/exportsolution)

### Check Solution Export Status
- **Endpoint**: `GET {instanceUrl}/api/data/v9.2/asyncoperations({asyncOperationId})`
- **Authentication**: Dataverse token
- **Required Permission**: System Administrator security role
- **Source File**: `src/app/api/power-platform/dataverse/solutions/export/status/route.js`
- **Query Parameters**: `$select=statuscode,statecode,message,percentcomplete`
- **Response**: Async operation status object
- **Retry Logic**: 20-second timeout with 2 retries on connection failure
- **Documentation**: [Dataverse - asyncoperation entity](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/reference/entities/asyncoperation)

### Download Exported Solution
- **Endpoint**: `GET {instanceUrl}/api/data/v9.2/exportsolutionuploads({exportJobId})`
- **Authentication**: Dataverse token
- **Required Permission**: System Administrator security role
- **Source File**: `src/app/api/power-platform/dataverse/solutions/export/download/route.js`
- **Query Parameters**: `$select=exportsolutionuploadid,name,createdon,solutionfile`
- **Response**: JSON object with base64-encoded solution file in `solutionfile` field
- **Note**: Solution file is a .zip archive encoded in base64
- **Documentation**: [Dataverse - exportsolutionupload entity](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/reference/entities/exportsolutionupload)

### Analyze Solution (Dataverse export)
- **Endpoint**: `POST /api/power-platform/solutions/analyze`
- **Authentication**: Session cookie + CSRF token; Dataverse delegated OBO token acquired server-side
- **Required Permission**: `portal.read`, plus a Dataverse security role that permits `ExportSolution` in the target environment
- **Source File**: `src/app/api/power-platform/solutions/analyze/route.ts`
- **Request Body**: `{ "instanceUrl": "https://org.crm.dynamics.com", "solutionName": "ContosoFieldService", "solutionDisplayName": "Contoso Field Service", "managed": false }`
- **Behavior**: Exports the solution, polls the async operation, downloads the `.zip`, then runs the shared analysis pipeline
- **Response**: `SolutionAnalysisResponse` — deterministic inventory, flow lint, Canvas App Power Fx findings, redacted security findings, plus an AI Markdown report in `analysis`
- **Note**: An AI failure is non-fatal. `analysis` is `null` and `analysisError` is set, but the deterministic analysis is still returned.
- **Max Duration**: 300 seconds
- **Documentation**: [Power Platform solution analysis](./power-platform-solution-analysis.md)

### Analyze Solution (uploaded .zip)
- **Endpoint**: `POST /api/power-platform/solutions/analyze/upload`
- **Authentication**: Session cookie + CSRF token
- **Required Permission**: `portal.read`
- **Source File**: `src/app/api/power-platform/solutions/analyze/upload/route.ts`
- **Request Body**: `multipart/form-data` with a `file` field containing the solution `.zip`
- **Response**: Same `SolutionAnalysisResponse` shape as the Dataverse route
- **Limits**: 100 MB upload; 25,000 archive entries; 2 MB per text file; 48 MB total text budget
- **Errors**: `400` missing/empty/non-`.zip` file · `413` over 100 MB · `422` malformed archive
- **Max Duration**: 300 seconds
- **Documentation**: [Power Platform solution analysis](./power-platform-solution-analysis.md)

### Environment Management Settings
- **Endpoint**: `GET/POST/PATCH https://api.powerplatform.com/environmentmanagement/environments/{environmentId}/settings?api-version=2024-10-01`
- **Authentication**: OAuth 2.0 token (scope: `https://api.powerplatform.com/.default`)
- **Required Permission**: Power Platform Administrator role or equivalent environment administration permission
- **Source File**: `src/app/api/power-platform/environment-management-settings/route.ts`
- **Response**: Environment management settings response with `objectResult` for list operations
- **Documentation**: [Environment Management Settings](https://learn.microsoft.com/en-us/rest/api/power-platform/environmentmanagement/environment-management-settings)

### Enable Managed Environment
- **Endpoint**: `POST https://api.powerplatform.com/environmentmanagement/environments/{environmentId}/enableManagedEnvironment?api-version=2024-10-01`
- **Authentication**: OAuth 2.0 delegated token (scope: `https://service.powerapps.com/.default`)
- **Required Permission**: Power Platform Administrator role
- **Source File**: `src/app/api/power-platform/environments/{environmentId}/enable-managed/route.js`
- **Response**: Success or error status
- **Documentation**: [Enable Managed Environment](https://learn.microsoft.com/en-us/power-platform/admin/managed-environment-enable)

### Disable Managed Environment
- **Endpoint**: `POST https://api.powerplatform.com/environmentmanagement/environments/{environmentId}/disableManagedEnvironment?api-version=2024-10-01`
- **Authentication**: OAuth 2.0 delegated token (scope: `https://service.powerapps.com/.default`)
- **Required Permission**: Power Platform Administrator role
- **Source File**: `src/app/api/power-platform/environments/{environmentId}/disable-managed/route.js`
- **Response**: Success or error status
- **Documentation**: [Managed Environment Management](https://learn.microsoft.com/en-us/power-platform/admin/managed-environment-enable)

### Delete Environment
- **Endpoint**: `DELETE https://api.powerplatform.com/environmentmanagement/environments/{environmentId}?api-version=2024-10-01`
- **Authentication**: OAuth 2.0 delegated token (scope: `https://service.powerapps.com/.default`)
- **Required Permission**: Power Platform Administrator role
- **Source File**: `src/app/api/power-platform/environments/{environmentId}/delete/route.js`
- **Response**: 202 Accepted with operation tracking
- **Documentation**: [Delete Environment](https://learn.microsoft.com/en-us/rest/api/power-platform/environmentmanagement/environments/delete-environment)

### Query Power Platform Inventory
- **Endpoint**: `POST https://api.powerplatform.com/resourcequery/resources/query?api-version=2024-10-01`
- **Authentication**: OAuth 2.0 delegated token (scope: `https://api.powerplatform.com/.default`, acquired via `getPowerPlatformDelegatedToken()`)
- **Required Permission**: Power Platform Administrator role
- **Source File**: `src/app/api/power-platform/inventory/route.js`
- **Request Body**:
  ```json
  {
    "TableName": "PowerPlatformResources",
    "Clauses": [
      {
        "$type": "summarize",
        "SummarizeClauseExpression": {
          "OperatorName": "count",
          "OperatorFieldName": "resourceCount",
          "FieldList": ["type"]
        }
      },
      {
        "$type": "orderby",
        "FieldNamesAscDesc": { "resourceCount": "desc" }
      }
    ]
  }
  ```
- **Response**: JSON with `totalRecords`, `count`, `resultTruncated`, `data[]` array
- **Supported Clauses**: where, project, take, orderby, distinct, count, summarize, extend, join
- **Documentation**: [Power Platform Inventory API](https://learn.microsoft.com/en-us/power-platform/admin/inventory-api)

### Send Data to Power Automate Flow
- **Endpoint**: `POST /api/power-platform/send-to-flow` (internal proxy)
- **Target**: User-provided Power Automate HTTP trigger URL
- **Authentication**: 
  - Detects SAS authentication in URL (sig, sp, sv, se parameters)
  - If no SAS: Acquires Power Automate delegated token (`https://service.flow.microsoft.com/.default`)
- **Required Permission**: Depends on flow configuration
- **Source File**: `src/app/api/power-platform/send-to-flow/route.js`
- **Request Body**: 
  ```json
  {
    "flowUrl": "https://prod-XX.eastus.logic.azure.com:443/workflows/.../triggers/manual/paths/invoke?...",
    "payload": { /* arbitrary JSON data */ }
  }
  ```
- **Response**: Proxied response from Power Automate flow
- **Note**: Handles both "Anyone" (SAS) and "Any authenticated user in tenant" (OAuth) flow authentication
- **Documentation**: [Power Automate HTTP triggers](https://learn.microsoft.com/en-us/power-automate/triggers-introduction)

---

## External Data Sources

### National Vulnerability Database (NVD)
- **Endpoint**: `GET https://services.nvd.nist.gov/rest/json/cves/2.0`
- **Authentication**: None (optional API key for higher rate limits)
- **Source File**: `src/app/api/nvd/route.js`
- **Query Parameters**:
  - `resultsPerPage`: Limit (max 2000)
  - `startIndex`: Pagination offset
  - `pubStartDate`, `pubEndDate`: Publication date range
  - `lastModStartDate`, `lastModEndDate`: Modification date range
  - `cvssV3Severity`: e.g., CRITICAL, HIGH
- **Response**: JSON with CVE list
- **Rate Limit**: 5 requests per 30 seconds (10/30s with API key)
- **Documentation**: [NVD API 2.0](https://nvd.nist.gov/developers/vulnerabilities)

### Microsoft Security Response Center (MSRC)
- **Endpoint**: `GET https://api.msrc.microsoft.com/cvrf/v2.0/cvrf/{id}`
- **Authentication**: None
- **Source File**: `src/app/api/msrc/route.js`
- **Path Parameters**: `{id}` - CVRF document ID (e.g., 2025-Jan)
- **Response**: XML (CVRF format) with security updates
- **Documentation**: [MSRC CVRF API](https://api.msrc.microsoft.com/cvrf/v2.0/swagger/index)

### Common Weakness Enumeration (CWE)
- **Endpoint**: `GET https://cwe.mitre.org/data/xml/cwec_latest.xml.zip`
- **Authentication**: None
- **Source File**: `src/app/api/cwe/route.js`
- **Response**: ZIP archive containing CWE XML database
- **Documentation**: [CWE List](https://cwe.mitre.org/data/index.html)

### Windows Update Catalog
- **Endpoint**: `https://www.catalog.update.microsoft.com/Search.aspx`
- **Authentication**: None
- **Source File**: `src/app/api/windows-updates/catalog/route.js`
- **Method**: Web scraping (HTML parsing)
- **Query Parameters**: `q` - Search query (e.g., KB number)
- **Response**: HTML (parsed for update information)
- **Note**: Not an official API; subject to breaking changes

---

## Rate Limits Summary

| API | Rate Limit | Retry Header | Documentation |
|-----|------------|--------------|---------------|
| **Microsoft Graph** | Varies (1k-10k req/min per app) | `Retry-After` | [Throttling guidance](https://learn.microsoft.com/en-us/graph/throttling) |
| **Azure Resource Manager** | 12,000 req/hour per subscription | `Retry-After` | [Request limits](https://learn.microsoft.com/en-us/azure/azure-resource-manager/management/request-limits-and-throttling) |
| **Dataverse** | 6,000 req per 5 min per user | `Retry-After` | [Service protection limits](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/api-limits) |
| **Power Platform API** | Inherited from Dataverse | `Retry-After` | Same as Dataverse |
| **NVD** | 5 req per 30 sec (10 with key) | None | [NVD API docs](https://nvd.nist.gov/developers/start-here) |

---

## Common Headers Used

### Microsoft Graph & Dataverse OData Headers
```http
Authorization: Bearer {token}
Accept: application/json
Content-Type: application/json
OData-MaxVersion: 4.0
OData-Version: 4.0
Prefer: odata.include-annotations="*"
```

### Azure Resource Manager Headers
```http
Authorization: Bearer {token}
Content-Type: application/json
```

### Power Platform API Headers
```http
Authorization: Bearer {token}
Accept: application/json
```

---

**Document Version:** 2.0  
**Last Updated:** May 2, 2026  
**Maintained By:** Development Team

> **Auth audit:** `docs/API-AUTH-AUDIT.md` — comprehensive per-route authentication record  
> **Auth validation script:** `scripts/validate-api-auth.js` — run to verify all routes are protected  
> **Full API documentation:** [`docs/API-DOCUMENTATION.md`](./API-DOCUMENTATION.md)

---

## Exchange & Teams

### List User Mailbox Settings
- **Endpoint**: `GET https://graph.microsoft.com/v1.0/users/{id}/mailboxSettings`
- **Authentication**: OAuth 2.0 delegated session token (via `verifyAuth()` + `getDelegatedGraphClient()`)
- **Required Permission**: `MailboxSettings.Read`
- **Source File**: `src/app/api/exchange/route.ts`
- **Response**: Mailbox settings object (timezone, locale, automatic replies)
- **Documentation**: [Microsoft Graph - mailboxSettings](https://learn.microsoft.com/en-us/graph/api/user-get-mailboxsettings)

### List User Messages
- **Endpoint**: `GET https://graph.microsoft.com/v1.0/me/messages`
- **Authentication**: OAuth 2.0 delegated session token (via `verifyAuth()` + `getDelegatedGraphClient()`)
- **Required Permission**: `Mail.Read`
- **Source File**: `src/app/api/messages/route.ts`
- **Response**: Array of message objects
- **Documentation**: [Microsoft Graph - List messages](https://learn.microsoft.com/en-us/graph/api/user-list-messages)

### List Teams
- **Endpoint**: `GET https://graph.microsoft.com/v1.0/groups?$filter=resourceProvisioningOptions/Any(x:x eq 'Team')`
- **Authentication**: OAuth 2.0 delegated session token (via `verifyAuth()` + `getDelegatedGraphClient()`)
- **Required Permission**: `Team.ReadBasic.All`, `Group.Read.All`
- **Source File**: `src/app/api/teams/list-teams/route.ts`
- **Response**: Array of group objects with team provisioning
- **Documentation**: [Microsoft Graph - List joined teams](https://learn.microsoft.com/en-us/graph/api/user-list-joinedteams)

### Create Team
- **Endpoint**: `POST https://graph.microsoft.com/v1.0/teams`
- **Authentication**: OAuth 2.0 delegated session token (via `verifyAuth()` + `getDelegatedGraphClient()`)
- **Required Permission**: `Team.Create`
- **Source File**: `src/app/api/teams/create-team/route.ts`
- **Response**: 202 Accepted with operation URL header
- **Documentation**: [Microsoft Graph - Create team](https://learn.microsoft.com/en-us/graph/api/team-post)

### Delete Team
- **Endpoint**: `DELETE https://graph.microsoft.com/v1.0/groups/{id}`
- **Authentication**: OAuth 2.0 delegated session token (via `verifyAuth()` + `getDelegatedGraphClient()`)
- **Required Permission**: `Group.ReadWrite.All`
- **Source File**: `src/app/api/teams/delete-team/[id]/route.ts`
- **Response**: 204 No Content
- **Documentation**: [Microsoft Graph - Delete group](https://learn.microsoft.com/en-us/graph/api/group-delete)

### Subscribe to Meeting Transcripts (Webhook)
- **Endpoint**: `POST https://graph.microsoft.com/v1.0/subscriptions`
- **Authentication**: OAuth 2.0 delegated session token (via `verifyAuth()` + `getDelegatedGraphClient()`)
- **Required Permissions**: `OnlineMeetingTranscript.Read.All`, `CallTranscripts.Read.All`
- **Source File**: `src/app/api/teams/transcripts/subscribe/route.ts`
- **Notes**: Creates change-notification subscriptions. The callback endpoint (`/api/teams/transcripts/notifications`) validates incoming notifications via `GRAPH_WEBHOOK_CLIENT_STATE` env var.
- **Notification URL allowlist**: `notificationUrl` is caller-supplied and is validated against a host allowlist before Graph is asked to deliver to it, so the route cannot be used to point Graph at an arbitrary (or internal) host. The allowlist defaults to this portal's own host, derived from `NEXTAUTH_URL` (falling back to `NEXT_PUBLIC_APP_URL`). Set `GRAPH_WEBHOOK_ALLOWED_HOSTS` to a comma-separated host list to widen it for deployments that terminate webhooks elsewhere. With none of these configured the route fails closed with `503`.
- **`clientState` is never returned** by this route or by `GET /api/teams/transcripts/subscriptions`. It is the shared secret the notification endpoint uses to authenticate inbound calls from Graph, so returning it to a caller would let them forge notifications.
- **Documentation**: [MS Graph - Create subscription](https://learn.microsoft.com/en-us/graph/api/subscription-post-subscriptions)

### Transcript Notification Webhook ⚠️ Special Auth
- **Endpoint**: `GET/POST /api/teams/transcripts/notifications`
- **Authentication**: **NOT session-based** — validates `clientState` against `GRAPH_WEBHOOK_CLIENT_STATE` env var
- **Source File**: `src/app/api/teams/transcripts/notifications/route.ts`
- **Notes**: This endpoint is called by Microsoft Graph (not the browser). GET handles subscription validation handshake; POST handles incoming change notifications. See [MS Graph webhook docs](https://learn.microsoft.com/en-us/graph/change-notifications-delivery-webhooks).
- **Required Env Var**: `GRAPH_WEBHOOK_CLIENT_STATE`

---

## Azure DevOps

Azure DevOps routes use the Azure DevOps REST API. Authentication uses an Azure DevOps personal access token (PAT) or OAuth delegated token acquired via `getDevOpsToken()`.

**Required Env Vars**:
- `AZURE_DEVOPS_ORG_URL` — e.g., `https://dev.azure.com/myorg`
- `AZURE_DEVOPS_PAT` — Personal Access Token (if using PAT auth)
- `AZURE_DEVOPS_CLIENT_ID` / `AZURE_DEVOPS_CLIENT_SECRET` — For OAuth delegated auth

### Key Azure DevOps Endpoints (52 total routes)

| Route | Methods | Azure DevOps API | Notes |
|-------|---------|-----------------|-------|
| `/api/devops/environments` | GET, POST | `/{org}/{project}/_apis/distributedtask/environments` | Deployment environments |
| `/api/devops/projects` | GET | `/{org}/_apis/projects` | List ADO projects |
| `/api/devops/pipelines` | GET | `/{org}/{project}/_apis/pipelines` | CI/CD pipelines |
| `/api/devops/builds` | GET | `/{org}/{project}/_apis/build/builds` | Build runs |
| `/api/devops/releases` | GET | `/{org}/{project}/_apis/release/releases` | Release pipelines |
| `/api/devops/repos` | GET | `/{org}/{project}/_apis/git/repositories` | Git repositories |
| `/api/devops/work-items` | GET, POST, PATCH | `/{org}/{project}/_apis/wit/workitems` | Work items (bugs, tasks) |
| `/api/devops/users` | GET | `/{org}/_apis/graph/users` | Organization users |
| `/api/devops/service-endpoints` | GET | `/{org}/{project}/_apis/serviceendpoint/endpoints` | Service connections |
| `/api/devops/agent-pools` | GET | `/{org}/_apis/distributedtask/pools` | Agent pools |

All routes return 401 if not authenticated, and require a valid Portal 360° session.

**Documentation**: [Azure DevOps REST API](https://learn.microsoft.com/en-us/rest/api/azure/devops)

---

## Microsoft Fabric

Most Microsoft Fabric routes use the Fabric REST API (`https://api.fabric.microsoft.com/v1`).
The activity-events route uses the Power BI admin API
(`https://api.powerbi.com/v1.0/myorg/admin/activityevents`) because that endpoint
is not hosted on the Fabric API origin.

**Authentication**: OAuth 2.0 delegated tokens acquired server-side. Fabric
routes use `https://api.fabric.microsoft.com/.default`; activity events use
`https://analysis.windows.net/powerbi/api/.default`.

**Required Permission**: Portal `portal.read` for user-scoped inventory routes.
Tenant-wide admin routes require Portal `audit.view` plus the corresponding
upstream Fabric administrator role and delegated scope.

| Route | Methods | Fabric API Endpoint | Notes |
|-------|---------|-------------------|-------|
| `/api/fabric/workspaces` | GET | `/workspaces` | List Fabric workspaces |
| `/api/fabric/capacities` | GET | `/capacities` | List Fabric capacities |
| `/api/fabric/items` | GET | `/workspaces/{workspaceId}/items` | List items in workspace |
| `/api/fabric/lakehouses` | GET | `/workspaces/{workspaceId}/lakehouses` | List lakehouses |
| `/api/fabric/notebooks` | GET, POST | `/workspaces/{workspaceId}/notebooks` | Fabric notebooks |
| `/api/fabric/domains` | GET | `/admin/domains?preview=false` | Tenant-wide domain inventory; Fabric administrator required |
| `/api/fabric/admin/activity-events` | GET | Power BI `/admin/activityevents` | Same-UTC-day audit window; Fabric administrator required |

**Documentation**: [Microsoft Fabric REST API](https://learn.microsoft.com/en-us/rest/api/fabric/articles/)

---

## Privileged Identity Management (PIM)

### List Eligible Role Assignments
- **Endpoint**: `GET https://graph.microsoft.com/v1.0/roleManagement/directory/roleEligibilitySchedules`
- **Authentication**: OAuth 2.0 delegated session token (via `verifyAuth()` + `getDelegatedGraphClient()`)
- **Required Permission**: `PrivilegedAccess.Read.AzureAD`, `RoleManagement.Read.Directory`
- **Source File**: `src/app/api/pim/route.ts`
- **Response**: Array of role eligibility schedule objects
- **Documentation**: [Microsoft Graph - List roleEligibilitySchedules](https://learn.microsoft.com/en-us/graph/api/rbacapplication-list-roleeligibilityschedules)

### Create PIM Role Assignment
- **Endpoint**: `POST https://graph.microsoft.com/v1.0/roleManagement/directory/roleAssignmentScheduleRequests`
- **Authentication**: OAuth 2.0 delegated session token (via `verifyAuth()` + `getDelegatedGraphClient()`)
- **Required Permission**: `RoleManagement.ReadWrite.Directory`, `PrivilegedAccess.ReadWrite.AzureAD`
- **Source File**: `src/app/api/pim/route.ts`
- **Request Body**:
  ```json
  {
    "action": "adminAssign",
    "principalId": "user-guid",
    "roleDefinitionId": "role-guid",
    "directoryScopeId": "/",
    "scheduleInfo": {
      "startDateTime": "2026-01-01T00:00:00Z",
      "expiration": { "type": "AfterDuration", "duration": "P30D" }
    }
  }
  ```
- **Documentation**: [Microsoft Graph - Create roleAssignmentScheduleRequest](https://learn.microsoft.com/en-us/graph/api/rbacapplication-post-roleassignmentschedulerequests)

---

## Entitlement Management

Access package and entitlement management routes use Microsoft Graph Identity Governance APIs.

**Required Permission**: `EntitlementManagement.Read.All` (read), `EntitlementManagement.ReadWrite.All` (write)

| Route | Methods | Graph Endpoint | Notes |
|-------|---------|---------------|-------|
| `/api/entitlement/access-packages` | GET, POST | `/identityGovernance/entitlementManagement/accessPackages` | Access packages |
| `/api/entitlement/catalogs` | GET, POST | `/identityGovernance/entitlementManagement/catalogs` | Access package catalogs |
| `/api/entitlement/assignments` | GET | `/identityGovernance/entitlementManagement/assignments` | Package assignments |
| `/api/entitlement/requests` | GET, POST | `/identityGovernance/entitlementManagement/assignmentRequests` | Access requests |
| `/api/entitlement/policies` | GET, POST | `/identityGovernance/entitlementManagement/assignmentPolicies` | Assignment policies |
| `/api/entitlement/connected-orgs` | GET | `/identityGovernance/entitlementManagement/connectedOrganizations` | Connected organizations |

All routes authenticate via `verifyAuth()`.

**Documentation**: [Microsoft Graph - Entitlement Management](https://learn.microsoft.com/en-us/graph/api/resources/entitlementmanagement-overview)

---

## Windows Updates

### List Update Rings
- **Endpoint**: `GET https://graph.microsoft.com/beta/deviceManagement/deviceConfigurations?$filter=isof('microsoft.graph.windowsUpdateForBusinessConfiguration')`
- **Authentication**: OAuth 2.0 delegated session token (via `verifyAuth()` + `getDelegatedGraphClient()` beta)
- **Required Permission**: `DeviceManagementConfiguration.Read.All`
- **Source File**: `src/app/api/windows-updates/route.ts`
- **Response**: Array of Windows Update ring configuration objects
- **Documentation**: [Microsoft Graph - windowsUpdateForBusinessConfiguration](https://learn.microsoft.com/en-us/graph/api/resources/intune-deviceconfig-windowsupdateforbusinessconfiguration)

### List Update Catalog Entries
- **Endpoint**: `GET https://graph.microsoft.com/beta/admin/windows/updates/catalog/entries?$filter=isof('microsoft.graph.windowsUpdates.qualityUpdateCatalogEntry')`
- **Authentication**: OAuth 2.0 delegated session token (via `verifyAuth()` + `getDelegatedGraphClient()` beta)
- **Required Permission**: `WindowsUpdates.Read.All` (or `WindowsUpdates.ReadWrite.All`)
- **Additional requirement**: the signed-in user must hold *Intune Administrator*, *Windows Update Deployment Administrator*, or *Global Administrator*. Without the scope **or** the role, Graph returns `403` with an empty `UnknownError` body.
- **Source Files**: `src/app/api/windows-updates/catalog/route.ts`, `src/app/api/intune/windows-update-catalog/route.ts`
- **Response**: Array of Windows Update for Business deployment service catalog entries
- **Documentation**: [Microsoft Graph - List catalog entries](https://learn.microsoft.com/en-us/graph/api/windowsupdates-catalog-list-entries?view=graph-rest-beta)

### Enrich Update Data
- **Endpoint**: `POST https://services.nvd.nist.gov/rest/json/cves/2.0` (NVD enrichment)
- **Authentication for portal route**: OAuth 2.0 delegated session token (via `verifyAuth()`)
- **Source File**: `src/app/api/windows-updates/enrich/route.ts`
- **Response**: Windows Update entries enriched with CVE/severity data from NVD
- **Note**: The portal `/api/windows-updates/enrich` route is authenticated; the downstream NVD call is unauthenticated (public API)

---

## ServiceNow Integration

ServiceNow routes proxy to the customer's ServiceNow instance using OAuth or basic auth credentials configured via environment variables.

**Authentication for portal routes**: All routes require `verifyAuth()` — 12 routes in `src/app/api/servicenow/`

**Required Env Vars**:
- `SERVICENOW_INSTANCE_URL` — e.g., `https://mycompany.service-now.com`
- `SERVICENOW_CLIENT_ID` + `SERVICENOW_CLIENT_SECRET` — OAuth app credentials
- `SERVICENOW_USERNAME` + `SERVICENOW_PASSWORD` — Basic auth fallback

| Route | Methods | ServiceNow Table/API | Notes |
|-------|---------|---------------------|-------|
| `/api/servicenow/incidents` | GET, POST | `incident` table | List/create incidents |
| `/api/servicenow/incidents/[id]` | GET, PATCH, DELETE | `incident/{sys_id}` | Get/update/close incident |
| `/api/servicenow/incidents/create` | POST | `incident` table | Create incident with structured body |
| `/api/servicenow/changes` | GET | `change_request` table | Change management requests |
| `/api/servicenow/changes/[id]` | GET, PATCH | `change_request/{sys_id}` | Get/update change request |
| `/api/servicenow/changes/[id]/tasks` | GET | `change_task?sysparm_query=change_request={id}` | Change tasks |
| `/api/servicenow/changes/[id]/conflict` | GET | Change conflict detection | Conflict check for change |
| `/api/servicenow/changes/templates` | GET | `change_request` templates | Change templates |
| `/api/servicenow/knowledge` | GET | `kb_knowledge` table | Knowledge base articles |
| `/api/servicenow/knowledge/[id]` | GET | `kb_knowledge/{sys_id}` | Single knowledge article |
| `/api/servicenow/config` | GET | Config endpoint | ServiceNow connection config |

**Documentation**: [ServiceNow Table API](https://developer.servicenow.com/dev.do#!/reference/api/washingtondc/rest/c_TableAPI)
