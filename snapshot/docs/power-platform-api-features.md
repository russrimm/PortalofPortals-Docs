# Power Platform API Features Implementation

## Overview
This document describes the Power Platform REST API features exposed in the Portal 360° application, based on the official Microsoft Power Platform API documentation.

## Authentication Reference

**Official Guide**: [Authenticate to Power Platform services](https://learn.microsoft.com/en-us/power-platform/admin/security/authenticate-services)

This application implements the **On-Behalf-Of (OBO) flow** described in the Microsoft Learn documentation for delegated user access to Power Platform APIs. The OBO flow allows the application to exchange user tokens for resource-specific tokens while maintaining the user's security context.

## API Endpoint
- **Base URL**: `https://api.bap.microsoft.com`
- **API Version**: `2020-10-01`
- **Authentication**: OAuth 2.0 with On-Behalf-Of (OBO) flow
- **Scope**: `https://api.bap.microsoft.com/.default`
- **Token Helper**: `src/lib/ppToken.js` (getPowerPlatformDelegatedToken)

## Environment Properties Exposed

### Basic Information
- **Environment Name** (`displayName`)
- **Environment ID** (`id`, `name`)
- **Location/Region** (`location`, `azureRegion`)
- **Environment Type** (`environmentSku`): Production, Sandbox, Trial, Developer, Teams, etc.
- **Database Type** (`databaseType`): Dataverse, None, etc.
- **Creation Time** (`createdTime`)
- **Created By** (`createdBy.displayName`, `createdBy.id`)
- **Provisioning State** (`provisioningState`)

### Governance & Protection Features ✨ NEW

#### 1. **Managed Environment Status**
- **Property**: `properties.governanceConfiguration.protectionLevel`
- **Display**: Green "🛡️ Managed" badge when value is `"Standard"`
- **Values**: 
  - `"Standard"` = Managed Environment (Enhanced Governance)
  - `"Basic"` = Not a Managed Environment
- **Purpose**: Indicates environment has enhanced governance capabilities
- **Features Enabled**:
  - Environment groups
  - Sharing limits
  - Usage insights
  - Data policies enforcement
  - Solution checker integration
  - IP firewall
  - Extended backup (28 days)
  - Maker welcome content

#### 2. **Customer-Managed Key (CMK)**
- **Property**: `properties.protectionStatus.keyManagedBy`
- **Display**: Purple "🔐 CMK" badge when set to "Customer"
- **Purpose**: Indicates environment uses customer-managed encryption keys
- **Benefits**: Enhanced data sovereignty and compliance control

#### 3. **Release Cycle**
- **Property**: `properties.cluster.category`
- **Display**: Blue "🔄 {cycle}" badge
- **Purpose**: Shows which release cycle (update wave) the environment is on
- **Values**:
  - `"FirstRelease"` = Early (First Release) - Gets updates first
  - `"Prod"` = Standard - Gets updates on standard schedule
- **Additional Context**: Cluster number (`cluster.number`) and geo (`cluster.geoShortName`)

#### 4. **Backup Retention**
- **Property**: `retentionDetails.retentionPeriod`
- **Additional**: `retentionDetails.backupsAvailableFromDateTime`
- **Display**: Shown in Governance & Protection section
- **Purpose**: Backup retention policy (7 days default, 28 days for Managed Environments)

### Connected Microsoft 365 Groups ✨ NEW
- **Property**: `connectedGroups`
- **Type**: Array of group objects
- **Display**: Separate section listing connected groups with IDs
- **Purpose**: Shows which Microsoft 365 groups have access to the environment

### Storage & Capacity
- **Database Storage**: `capacity[].actualConsumption` (where `capacityType` = "Database")
- **File Storage**: `capacity[].actualConsumption` (where `capacityType` = "File")
- **Log Storage**: `capacity[].actualConsumption` (where `capacityType` = "Log")
- **Unit**: `capacity[].capacityUnit` (typically "MB")
- **Last Updated**: `capacity[].updatedOn`

### Dataverse Organization Details
- **Instance URL**: `linkedEnvironmentMetadata.instanceUrl`
- **API URL**: `linkedEnvironmentMetadata.instanceApiUrl`
- **Domain Name**: `linkedEnvironmentMetadata.domainName`
- **Unique Name**: `linkedEnvironmentMetadata.uniqueName`
- **Version**: `linkedEnvironmentMetadata.version`
- **State**: `linkedEnvironmentMetadata.instanceState`
- **Base Language**: `linkedEnvironmentMetadata.baseLanguage`

### Runtime Endpoints
- **Property**: `runtimeEndpoints`
- **Services**: 
  - `microsoft.Flow` - Power Automate
  - `microsoft.PowerApps` - Power Apps
  - `microsoft.BusinessAppPlatform` - BAP
  - `microsoft.CommonDataModel` - CDM
  - `microsoft.ApiManagement` - APIM
  - `microsoft.PowerAppsAdvisor` - Advisor

## UI Enhancements

### Badge System
Compact badges displayed on collapsed environment cards:
1. **Environment Type** (e.g., "Production", "Sandbox") - White badge
2. **Managed Environment** - Green badge with shield icon
3. **Customer-Managed Key** - Purple badge with lock icon
4. **Update Ring** - Blue badge with refresh icon

### Governance & Protection Section
New dedicated section in expanded environment details showing:
- Managed Environment status with feature description
- Encryption key management type
- Backup retention period and available backups timeline
- Update ring assignment

### Connected Groups Display
Separate section listing all connected Microsoft 365 groups with:
- Group display name
- Group ID (for reference)

## API Query Patterns

### List All Environments (Full Details)
```
GET https://api.bap.microsoft.com/providers/Microsoft.BusinessAppPlatform/scopes/admin/environments?api-version=2020-10-01&$expand=properties.capacity,properties.addons,properties.linkedEnvironmentMetadata
```

### Get Single Environment
```
GET https://api.bap.microsoft.com/providers/Microsoft.BusinessAppPlatform/scopes/admin/environments/{environmentId}?api-version=2020-10-01&$expand=properties.capacity,properties.addons,properties.linkedEnvironmentMetadata
```

### List Environments (Summary - Minimal)
```
GET https://api.bap.microsoft.com/providers/Microsoft.BusinessAppPlatform/scopes/admin/environments?api-version=2020-10-01
```
*Note: Summary mode strips properties to minimal set: id, name, location, type, displayName*

## Caching Strategy
- **List requests**: 60 seconds TTL
- **Individual environment details**: 120 seconds TTL
- **Token**: Cached until 60 seconds before expiry

## Related APIs (Implemented in Portal Backend)

### Copilot credit and Entitlement Insight reports

The [Entitlement Insight page](../src/app/power-platform/licensing/entitlement-insight/page.tsx)
uses the delegated Power Platform API at `https://api.powerplatform.com`, API version
`2024-10-01`. `MCSMessages` identifies Copilot Credits. These are read-only reports;
they do not change allocations, agent limits, or tenant consent.

| Report | Path below `/licensing/entitlements/{entitlementId}` | Report rows |
| --- | --- | --- |
| Tenant Resources | `/resources` | Resource consumption across environments |
| Environment Resources | `/environments/{environmentId}/resources` | Resource consumption in the selected environment |
| License Trends | `/licenses` | License quantities and entitlements, with the parent date and license model |
| Tenant Users | `/users` | User consumption |
| Resources by User | `/users/{userId}/resources` | The selected user's resource consumption |
| Users by Resource | `/resources/{resourceId}/users` | The selected resource's user consumption |

All six require inclusive `fromDate` and `toDate` values. The portal rejects invalid
calendar dates and reversed ranges. The shared adapter accepts documented `value`
envelopes, nested resource/user collections, and bare collections, and preserves
metadata rather than silently converting an unexpected response into an empty report.
`204 No Content` becomes an empty result; failed reads and malformed responses remain errors.

Tenant resource reports and the resource picker request `includeFields=users,tags,asOfDate`
and `pageSize=5000`, following the Microsoft article below. The rich fields are described
by that article and its sample, but are not fully specified by the tenant-resources
OpenAPI schema. The portal's 5,000 page-size bound is not a claim about Microsoft's
maximum; this endpoint documents page size as environment fan-out, not returned row count.
Paging continues while the service supplies a continuation, even for short pages.
Environment resource reports request the same optional rich fields; the user and license
operations keep their separate documented query parameters.

The browser's BFF requests use `continuationToken` for opaque tokens or `nextPage`
for the query portion of an upstream `@odata.nextLink`. The server validates every
next-page request against the original endpoint, dates, entitlement, and query options
before acquiring delegated credentials. It never follows an arbitrary host or resource
path. License Trends has no documented token-submission parameter, so it follows supplied
next links; a token-only response is labeled partial with guidance to narrow the range
or use the native admin center. `Load more` is never a silent rerun of page one.

Changing dates or scope invalidates prior results, paging state, and resource selections.
Refresh makes a new, uncached report request. If it fails, retained rows are labeled
as the last loaded results. The resource picker reports its bounded 20-page limit
instead of implying that a truncated list is complete. The aggregate Copilot Credits
report also follows all available pages and fails rather than returning a capped
inventory as a tenant total.

**Interpretation:** consumption is delayed, not real time. Several rows can describe
the same agent and day with different channel, feature, or model dimensions. Keep those
rows when analyzing consumption; do not sum reported user counts into a distinct-user
total. Billed consumption and non-billable metadata are separate measures. License
entitlement is capacity, not consumption. Missing optional tool/model/knowledge-source
fields can be a source-telemetry limitation, particularly for GitHub Copilot harness
agents. Empty data alone does not establish zero consumption or missing permissions.
The article identifies `entitlement.capacity.consumed.lastUpdatedOn` on the separate
tenant-capacity endpoint as a way to determine the latest completed usage date; these
explorer reports display the dates actually returned in their rows.

References:

- [Microsoft Entitlement Insight operation reference](https://learn.microsoft.com/rest/api/power-platform/licensing/entitlement-insight)
- [Where Are Your Copilot Credits Going?](https://microsoft.github.io/mcscatblog/posts/copilot-credit-consumption-api/)
- [Manage Copilot Credits and capacity in the Power Platform admin center](https://learn.microsoft.com/power-platform/admin/manage-copilot-studio-copilot-credits-capacity)

### Rule Based Policies API (Full Operation Coverage)
- **Reference**: https://learn.microsoft.com/en-us/rest/api/power-platform/governance/rule-based-policies
- **Portal endpoints**:
  - `GET /api/power-platform/governance/rule-based-policies`
  - `POST /api/power-platform/governance/rule-based-policies`
  - `GET /api/power-platform/governance/rule-based-policies/[policyId]`
  - `PUT /api/power-platform/governance/rule-based-policies/[policyId]`
  - `GET /api/power-platform/governance/rule-based-policies/assignments`
  - `GET /api/power-platform/governance/rule-based-policies/[policyId]/assignments`
  - `GET /api/power-platform/governance/rule-based-policies/environments/[environmentId]/assignments`
  - `GET /api/power-platform/governance/rule-based-policies/environment-groups/[groupId]/assignments`
  - `POST /api/power-platform/governance/rule-based-policies/[policyId]/environments/[environmentId]/assignments`
  - `POST /api/power-platform/governance/rule-based-policies/[policyId]/environment-groups/[groupId]/assignments`

### Environment Management Settings API (Full Operation Coverage)
- **Reference**: https://learn.microsoft.com/en-us/rest/api/power-platform/environmentmanagement/environment-management-settings
- **Portal endpoint**: `src/app/api/power-platform/environment-management-settings/route.ts`
- **API version**: `2024-10-01`
- **Supported methods**:
  - `GET` (List environment management settings by environment ID)
  - `POST` (Create environment management settings)
  - `PATCH` (Update environment management settings)
- **Portal UX page**: `/power-platform/environment-settings` (includes direct `POST` and `PATCH` actions)

### Environment Groups API (Full Operation Coverage)
- **Reference**: https://learn.microsoft.com/en-us/rest/api/power-platform/environmentmanagement/environment-groups
- **Portal endpoints**:
  - `GET /api/power-platform/environmentmanagement/environment-groups`
  - `POST /api/power-platform/environmentmanagement/environment-groups`
  - `GET /api/power-platform/environmentmanagement/environment-groups/[groupId]`
  - `PUT /api/power-platform/environmentmanagement/environment-groups/[groupId]`
  - `DELETE /api/power-platform/environmentmanagement/environment-groups/[groupId]`
  - `POST /api/power-platform/environmentmanagement/environment-groups/[groupId]/add-environment/[environmentId]`
  - `POST /api/power-platform/environmentmanagement/environment-groups/[groupId]/remove-environment/[environmentId]`
  - `GET /api/power-platform/environmentmanagement/environment-group-operations/[operationId]`
  - `GET /api/power-platform/environmentmanagement/environments/[environmentId]/operations`
  - `GET /api/power-platform/environmentmanagement/environments/[environmentId]/operations/[operationId]`
- **Portal UX page**: `/power-platform/environment-groups` (create, update, delete, membership, and operation status)

### Authorization RBAC API (Full Operation Coverage)
- **Reference**: https://learn.microsoft.com/en-us/rest/api/power-platform/authorization/role-based-access-control
- **Built-in role catalog reference**: https://learn.microsoft.com/en-us/power-platform/admin/security/role-based-access-control#built-in-power-platform-roles
- **Portal endpoints**:
  - `GET /api/power-platform/role-definitions`
  - `GET /api/power-platform/role-assignments`
  - `POST /api/power-platform/role-assignments`
  - `DELETE /api/power-platform/role-assignments/[roleAssignmentId]`
- **Notes**:
  - Role definitions route merges API role definitions with known built-in role IDs for stable UX.
  - Role assignment management UI is available at `/power-platform/role-assignments`.

### Tenant Settings API
- **Endpoint**: `POST https://api.bap.microsoft.com/providers/Microsoft.BusinessAppPlatform/listtenantsettings?api-version=2020-10-01`
- **Returns**: Tenant-wide governance settings including:
  - `powerPlatform.governance.disableAdminDigest` - Managed Environment admin digest
  - `powerPlatform.licensing.ApplyAutoClaimToOnlyManagedEnvironments` - License autoclaim settings
  - Environment creation restrictions
  - Copilot settings
  - Sharing policies

### App Management API
- **Base**: `https://api.powerplatform.com/appmanagement`
- **Purpose**: Manage first-party app installations (Dynamics 365, etc.)
- **Portal endpoints**:
  - `GET /api/power-platform/tenant-apps?environmentId={environmentId}`
  - `POST /api/power-platform/appmanagement/environments/[environmentId]/application-packages/[uniqueName]/install`
  - `GET /api/power-platform/appmanagement/environments/[environmentId]/operations/[operationId]`
- **Operations**: List installable packages, trigger install, and poll install status

### Licensing/Billing Policies API
- **Base**: `https://api.powerplatform.com/licensing`
- **Purpose**: Manage billing policies and capacity allocation
- **Portal endpoints**:
  - `GET /api/power-platform/licensing/billing-policies`
  - `POST /api/power-platform/licensing/billing-policies`
  - `GET /api/power-platform/licensing/billing-policies/[policyId]`
  - `PATCH /api/power-platform/licensing/billing-policies/[policyId]`
  - `DELETE /api/power-platform/licensing/billing-policies/[policyId]`
  - `GET /api/power-platform/licensing/billing-policies/[policyId]/environments`
  - `POST /api/power-platform/licensing/billing-policies/[policyId]/environments`
- **Operations**: Collection + item CRUD, and environment membership actions

## PowerShell Equivalent
For reference, the PowerShell cmdlet that exposes these features:
```powershell
Get-AdminPowerAppEnvironment -EnvironmentName {guid} -GetProtectedEnvironment
```

## References
- [Power Platform API Reference](https://learn.microsoft.com/en-us/rest/api/power-platform/)
- [Rule-based Policies: List rule-based policies](https://learn.microsoft.com/en-us/rest/api/power-platform/governance/rule-based-policies/list-rule-based-policies)
- [Tutorial: Create Daily Capacity Report](https://learn.microsoft.com/en-us/power-platform/admin/programmability-tutorial-create-daily-capacity-report)
- [List Tenant Settings](https://learn.microsoft.com/en-us/power-platform/admin/list-tenantsettings)
- [Managed Environments Overview](https://learn.microsoft.com/en-us/power-platform/admin/managed-environment-overview)
- [PowerShell for Power Platform](https://learn.microsoft.com/en-us/power-platform/admin/powerapps-powershell)

## Future Enhancements
Potential additional features from the API:
1. **Environment Operations API**: Backup, restore, copy, reset operations
2. **Tenant Settings Management**: Read/write tenant-wide governance policies
3. **Billing Policy Management**: Capacity allocation and billing policy CRUD
4. **Application Management**: Additional package lifecycle actions beyond install/status (when added to API docs)
5. **Environment Group UX**: Dedicated UI workflows for create/update/delete and membership operations
6. **Data Policies**: DLP policy enforcement status per environment
7. **Usage Analytics**: API call metrics, storage trends over time

## Implementation Notes
- All properties are optional - UI gracefully handles missing data
- Badge display is conditional on property existence
- Managed Environment detection uses `states.management.id` presence
- CMK detection checks `protectionStatus.keyManagedBy === 'Customer'`
- Connected groups array may be empty even when property exists
- Storage values are in MB, converted to appropriate units for display
