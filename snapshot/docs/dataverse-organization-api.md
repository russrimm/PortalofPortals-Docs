# Dataverse Web API - Organization Entity Properties

This document describes the properties available from the Dataverse Web API's `organization` entity, based on official Microsoft documentation.

## Overview

The `organization` table in Dataverse contains a single row with configuration settings for the entire Dataverse environment. You can query it via:

```http
GET {instanceUrl}/api/data/v9.2/organizations?$select=property1,property2,...
```

## Authentication

Requires OAuth2 token scoped to the specific Dataverse instance:
```
Scope: {instanceUrl}/.default
```

## Key Properties Currently Used

### Audit Settings
| Property | Type | Description |
|----------|------|-------------|
| `isauditenabled` | Boolean | Whether auditing is enabled for the environment |
| `isreadauditenabled` | Boolean | Whether read operations are audited |
| `isuseraccessauditenabled` | Boolean | Whether user access is audited |
| `auditretentionperiodv2` | Integer | Days to retain audit logs (1-365,000, -1 = forever, default 30) |
| `useraccessauditinginterval` | Integer | How often user access is logged, in hours (default 4) |
| `auditsettings` | String | JSON string containing additional audit feature settings |

### Organization Identity
| Property | Type | Description |
|----------|------|-------------|
| `organizationid` | Guid | Unique identifier for the organization (primary key) |
| `name` | String | Internal name of the organization |
| `friendlyname` | String | Display name of the organization |

### Security
| Property | Type | Description |
|----------|------|-------------|
| `sqlaccessgroupid` | Guid | Security group ID if environment is restricted, null if open access |
| `sqlaccessgroupname` | String | Display name of the security group |

### Version Information
| Property | Type | Description |
|----------|------|-------------|
| `version` | String | Dataverse platform version (e.g., "9.2.24052.00158") |
| `versionnumber` | Integer | Internal version number |

### Timestamps
| Property | Type | Description |
|----------|------|-------------|
| `createdon` | DateTime | When the organization was created |
| `modifiedon` | DateTime | When the organization was last modified |

### Financial
| Property | Type | Description |
|----------|------|-------------|
| `basecurrencyid` | Guid | Base currency for the organization |

## Additional Available Properties

The organization entity has hundreds of properties controlling various features. Some notable ones include:

### Feature Flags
- `isactioncardenabled` - Action cards feature
- `isactivityanalysisenabled` - Activity analysis
- `isautodatacaptureenabled` - Auto data capture
- `isbasicgeospatialintegrationenabled` - Geospatial features
- `iscollaborationexperienceenabled` - Collaboration features
- `ismicrosoftflowintegrationenabled` - Power Automate integration
- `issensitivitylabelsenabled` - Sensitivity labels

### Additional Audit Controls
- `AuditRetentionPeriod` - Legacy audit retention setting
- `AuditSettings` - JSON string with settings like:
  - `StoreLabelNameforPicklistAudits` - Store both value and label for picklist audits
  - `IsSqlAuditWriteDisabled` - If NoSQL audits enabled, stop writing to SQL
  - `ApplyRetentionToExistingLogs` - Apply new retention to existing records

### Integration Settings
- `integrationuserid` - System user for integrations
- `externalbas eurl` - External base URL
- `globalhelp url` - Custom help URL
- `globalhelpurlenabled` - Whether custom help URL is enabled

### Email Settings
- `incomingemailexchangeemailretrievalbatchsize` - Email retrieval batch size
- `ignoreInternalEmail` - Whether to ignore internal emails

### Throttling & Limits
- `flowlogsttlinminutes` - Flow logs time-to-live
- `flowruntimetoLiveinseconds` - Flow runtime TTL
- `goalRollupExpiryTime` - Goal rollup expiry
- `goalRollupFrequency` - Goal rollup frequency

### Display & Formatting
- `fullnameconventioncode` - How to format full names
- `fiscalcalendarstart` - Fiscal year start date
- `fiscalyearformat` - Fiscal year display format
- `dateformatcode` - Date format
- `timeformatcode` - Time format
- `currencysymbol` - Currency symbol

### Theme & Branding
- `themedata` - Theme JSON data
- `highcontrastthemedata` - High contrast theme
- `entityimage` - Organization logo

## Query Examples

### Basic Audit Information
```http
GET {instanceUrl}/api/data/v9.2/organizations?$select=isauditenabled,isreadauditenabled,isuseraccessauditenabled
```

### Security Group Information
```http
GET {instanceUrl}/api/data/v9.2/organizations?$select=sqlaccessgroupid,sqlaccessgroupname
```

### Comprehensive Query (Current Implementation)
```http
GET {instanceUrl}/api/data/v9.2/organizations?$select=organizationid,name,friendlyname,isauditenabled,version,createdon,modifiedon,versionnumber,sqlaccessgroupid,sqlaccessgroupname,isreadauditenabled,isuseraccessauditenabled,auditretentionperiodv2,useraccessauditinginterval,auditsettings,basecurrencyid
```

## Response Format

```json
{
  "@odata.context": "https://org.crm.dynamics.com/api/data/v9.2/$metadata#organizations(...)",
  "value": [
    {
      "organizationid": "12345678-1234-1234-1234-123456789012",
      "name": "org12345678",
      "friendlyname": "My Organization",
      "isauditenabled": true,
      "isreadauditenabled": false,
      "isuseraccessauditenabled": true,
      "auditretentionperiodv2": 90,
      "useraccessauditinginterval": 4,
      "version": "9.2.24052.00158",
      "versionnumber": 1234567,
      "sqlaccessgroupid": "abcdef12-3456-7890-abcd-ef1234567890",
      "sqlaccessgroupname": "Environment Security Group",
      "createdon": "2023-01-15T10:30:00Z",
      "modifiedon": "2024-11-01T14:22:00Z",
      "basecurrencyid": "fedcba98-7654-3210-fedc-ba9876543210"
    }
  ]
}
```

## Common Issues

### 1. "Loading..." Stuck State
**Symptoms**: Auditing field shows "Loading..." indefinitely

**Possible Causes**:
- Authentication failure (check Client ID, Secret, Tenant ID)
- Missing permissions (app registration needs Dataverse permissions)
- Network error or timeout
- Invalid instance URL
- Property name mismatch (case-sensitive: use `isauditenabled` not `IsAuditEnabled`)

**Debugging**:
```javascript
// Check browser console for errors
console.log('[Dataverse Org] Fetching...')
console.log('[Dataverse Org] Response:', response)
console.log('[Dataverse Org] Data:', data)
```

### 2. 401 Unauthorized
**Cause**: App registration doesn't have Dataverse API permissions

**Fix**: Add Dynamics CRM (Dataverse) API permissions to your Azure AD app:
- API: Dynamics CRM / Dataverse
- Permission: `user_impersonation` (delegated) or application permissions
- Admin consent required

### 3. 403 Forbidden
**Cause**: Service principal doesn't have System Administrator or System Customizer role in Dataverse

**Fix**: Add the app registration as an Application User in Dataverse with appropriate security role

### 4. 404 Not Found
**Cause**: Invalid instance URL or organizations endpoint

**Fix**: Ensure URL format is correct:
- ✅ `https://org.crm.dynamics.com/api/data/v9.2/organizations`
- ❌ `https://org.crm.dynamics.com/organizations` (missing /api/data/v9.2)

### 5. Property Returns `null` or `undefined`
**Cause**: Property not included in `$select` query, or feature not enabled

**Fix**: 
- Verify property name spelling (case-sensitive)
- Check if feature is enabled in environment
- Some properties may be null if not configured (e.g., `sqlaccessgroupid` if no security group)

## Security Considerations

### Required Permissions
To query the organization table, the authenticated identity needs:
- **System Administrator** or **System Customizer** role in Dataverse
- Or specific table permissions for the `organization` entity

### Sensitive Properties
Some properties contain sensitive information:
- `auditsettings` - May contain internal configuration
- `sqlaccessgroupid` - Security group information
- Integration user IDs and keys
- External URLs and endpoints

### Best Practices
1. Use specific `$select` queries (don't retrieve all properties)
2. Cache responses when possible (organization settings change infrequently)
3. Log errors without exposing sensitive data
4. Use environment variables for credentials (never hardcode)
5. Implement proper error handling for all API calls

## References

- [Configure auditing - Microsoft Learn](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/auditing/configure)
- [Organization table/entity reference](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/reference/entities/organization)
- [Retrieve a table row using Web API](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/retrieve-entity-using-web-api)
- [Organization table settings](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/organization-table)

## Testing

Use the provided test script to verify your setup:

```bash
node scripts/test-dataverse-org.js https://yourorg.crm.dynamics.com
```

This will:
1. Acquire an OAuth token
2. Query the organizations endpoint
3. Display all returned properties
4. Show any errors with details

Required environment variables:
- `AZURE_CLIENT_ID` (or `DATAVERSE_CLIENT_ID`)
- `AZURE_CLIENT_SECRET` (or `DATAVERSE_CLIENT_SECRET`)
- `AZURE_TENANT_ID` (or `DATAVERSE_TENANT_ID`)
