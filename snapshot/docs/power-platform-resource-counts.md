# Getting Resource Counts in Power Platform Environments

This document explains how to retrieve counts of solutions, Power Apps, flows, agents, and other resources across Power Platform environments.

## Overview

There are three main approaches to get resource counts:

1. **Dataverse Web API** - Direct OData queries against each environment's Dataverse
2. **Power Platform Admin Connector V2** - Centralized admin API with filtering
3. **Power Platform Unified API** - Management API for cross-environment queries

## Method 1: Dataverse Web API (Per Environment)

### Overview
Query each environment's Dataverse database directly using the Web API. This is the most accurate method as it queries the actual data.

### Authentication
Requires OAuth token scoped to the specific Dataverse instance:
```
Scope: {instanceUrl}/.default
Example: https://orgname.crm.dynamics.com/.default
```

### Base URL Pattern
```
https://{orgname}.{region}.dynamics.com/api/data/v9.2/{entityset}
```

### Common Entity Sets and Count Queries

#### Solutions
```http
GET https://orgname.crm.dynamics.com/api/data/v9.2/solutions?$count=true&$top=0
```

**With Filters (exclude system solutions):**
```http
GET https://orgname.crm.dynamics.com/api/data/v9.2/solutions?$count=true&$top=0&$filter=isvisible eq true and ismanaged eq false
```

**Response:**
```json
{
  "@odata.context": "...",
  "@odata.count": 42,
  "value": []
}
```

#### Canvas Apps (Power Apps)
```http
GET https://orgname.crm.dynamics.com/api/data/v9.2/canvasapps?$count=true&$top=0
```

**With Status Filter (published only):**
```http
GET https://orgname.crm.dynamics.com/api/data/v9.2/canvasapps?$count=true&$top=0&$filter=statecode eq 0
```

#### Model-Driven Apps
```http
GET https://orgname.crm.dynamics.com/api/data/v9.2/appmodules?$count=true&$top=0
```

#### Cloud Flows (Power Automate)
```http
GET https://orgname.crm.dynamics.com/api/data/v9.2/workflows?$count=true&$top=0&$filter=category eq 5
```

**Explanation:** `category eq 5` filters for modern cloud flows (vs classic workflows)

**By State:**
- Active: `statecode eq 1`
- Suspended: `statecode eq 2`
- Off: `statecode eq 0`

```http
GET https://orgname.crm.dynamics.com/api/data/v9.2/workflows?$count=true&$top=0&$filter=category eq 5 and statecode eq 1
```

#### Desktop Flows (RPA)
```http
GET https://orgname.crm.dynamics.com/api/data/v9.2/workflows?$count=true&$top=0&$filter=type eq 3
```

#### Agents (Copilot Studio / Power Virtual Agents)
```http
GET https://orgname.crm.dynamics.com/api/data/v9.2/bots?$count=true&$top=0
```

**Active Agents Only:**
```http
GET https://orgname.crm.dynamics.com/api/data/v9.2/bots?$count=true&$top=0&$filter=statecode eq 0
```

#### Custom Connectors
```http
GET https://orgname.crm.dynamics.com/api/data/v9.2/connectors?$count=true&$top=0&$filter=connectortype eq 1
```

**Explanation:** `connectortype eq 1` filters for custom connectors (vs standard)

#### Connection References
```http
GET https://orgname.crm.dynamics.com/api/data/v9.2/connectionreferences?$count=true&$top=0
```

#### Environment Variables
```http
GET https://orgname.crm.dynamics.com/api/data/v9.2/environmentvariabledefinitions?$count=true&$top=0
```

#### Tables (Entities)
```http
GET https://orgname.crm.dynamics.com/api/data/v9.2/EntityDefinitions?$count=true&$top=0
```

**Custom Tables Only:**
```http
GET https://orgname.crm.dynamics.com/api/data/v9.2/EntityDefinitions?$count=true&$top=0&$filter=IsCustomEntity eq true
```

### Key Query Parameters

| Parameter | Purpose | Example |
|-----------|---------|---------|
| `$count=true` | Include total count in response | Required for counts |
| `$top=0` | Don't return items, only count | Improves performance |
| `$filter` | Filter results | `statecode eq 0` |
| `$select` | Choose specific columns | `$select=name,createdon` |

### Example: Get All Counts for an Environment

```javascript
async function getEnvironmentCounts(instanceUrl, accessToken) {
  const counts = {};
  
  const queries = {
    solutions: 'solutions?$count=true&$top=0&$filter=isvisible eq true',
    canvasApps: 'canvasapps?$count=true&$top=0',
    modelDrivenApps: 'appmodules?$count=true&$top=0',
    cloudFlows: 'workflows?$count=true&$top=0&$filter=category eq 5',
    activeCloudFlows: 'workflows?$count=true&$top=0&$filter=category eq 5 and statecode eq 1',
    desktopFlows: 'workflows?$count=true&$top=0&$filter=type eq 3',
    agents: 'bots?$count=true&$top=0',
    customConnectors: 'connectors?$count=true&$top=0&$filter=connectortype eq 1',
    connectionReferences: 'connectionreferences?$count=true&$top=0',
    environmentVariables: 'environmentvariabledefinitions?$count=true&$top=0'
  };
  
  for (const [key, query] of Object.entries(queries)) {
    const response = await fetch(
      `${instanceUrl}/api/data/v9.2/${query}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'OData-MaxVersion': '4.0',
          'OData-Version': '4.0'
        }
      }
    );
    
    const data = await response.json();
    counts[key] = data['@odata.count'] || 0;
  }
  
  return counts;
}
```

---

## Method 2: Power Platform Admin Connector V2

### Overview
The Power Platform for Admins V2 connector provides centralized access to retrieve apps and flows across all environments.

### Available Operations

#### Get Apps as Administrator
```
Operation ID: Get-AdminApps
Endpoint: /providers/Microsoft.PowerApps/scopes/admin/environments/{environmentId}/apps
```

**Parameters:**
- `environmentId` (required) - Name field of the environment
- `$top` (optional) - Number of apps in the response
- `$skiptoken` (optional) - Get next page of responses
- `api-version` - The API version

**Returns:** List of PowerApps with details including:
- App ID, name, display name
- Owner information
- Created/modified dates
- Connection references
- Shared users/groups count

**To Get Count:** 
```javascript
let count = 0;
let nextLink = null;

do {
  const response = await fetch(url + (nextLink ? `&$skiptoken=${nextLink}` : ''));
  const data = await response.json();
  count += data.value.length;
  nextLink = data.nextLink ? new URL(data.nextLink).searchParams.get('$skiptoken') : null;
} while (nextLink);
```

#### Retrieve Cloud Flows with Filters
```
Operation ID: ListCloudFlows
Endpoint: GET /providers/Microsoft.PowerApps/scopes/admin/environments/{environmentId}/v2/flows
```

**Parameters:**
- `environmentId` (required)
- `workflowId`, `resourceId`, `createdBy`, `ownerId` (optional filters)
- `createdOnStartDate`, `createdOnEndDate` (optional date filters)
- `modifiedOnStartDate`, `modifiedOnEndDate` (optional date filters)

**Response:** Returns array with `nextLink` for pagination

**To Get Total Count:** Paginate through all results and sum

#### Retrieve Flow Actions with Filters
```
Operation ID: ListFlowActions
Endpoint: /providers/Microsoft.PowerApps/scopes/admin/environments/{environmentId}/flowActions
```

**Use Case:** Count flows using specific connectors

**Parameters:**
- `connector` - Filter by connector name
- `isTrigger` - Filter for triggers only
- `parameterName`, `parameterValue` - Search in parameters

### Limitations
- No direct count endpoint - must paginate through results
- Page size: 250 items
- Requires admin permissions (Power Platform Admin or Environment Admin role)

---

## Method 3: Power Platform Unified API (api.powerplatform.com)

### Overview
The unified API provides management plane operations including retrieving environment information.

### Authentication
```
Scope: https://api.powerplatform.com/.default
```

### List Connectors in Environment
```
Operation ID: ListConnectors
GET /providers/Microsoft.PowerApps/scopes/admin/environments/{environmentId}/apis
```

**Query Parameters:**
- `$filter` - Filter expression (e.g., `environment eq '{environmentName}'`)
- `api-version` - API version

**Returns:** List of connectors with:
- Connector ID, name, display name
- Icon URI, brand color
- API environment
- Capabilities, tier, publisher
- Created/changed times

**To Get Count:** Parse `value.length` or paginate if needed

---

## Method 4: Aggregate Across All Environments

### Strategy 1: Iterate Through Environments

```javascript
async function getAllEnvironmentCounts() {
  // 1. Get list of all environments
  const envsResponse = await fetch(
    'https://api.bap.microsoft.com/providers/Microsoft.BusinessAppPlatform/scopes/admin/environments?api-version=2023-06-01',
    {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    }
  );
  
  const environments = await envsResponse.json();
  
  // 2. For each environment with Dataverse, get counts
  const results = [];
  
  for (const env of environments.value) {
    if (env.properties?.linkedEnvironmentMetadata?.instanceUrl) {
      const instanceUrl = env.properties.linkedEnvironmentMetadata.instanceUrl;
      
      // Get Dataverse token for this environment
      const dvToken = await getDataverseTokenForUser(instanceUrl);
      
      // Get counts
      const counts = await getEnvironmentCounts(instanceUrl, dvToken);
      
      results.push({
        environmentId: env.name,
        displayName: env.properties.displayName,
        instanceUrl,
        ...counts
      });
    }
  }
  
  return results;
}
```

### Strategy 2: Use Power Automate Flow

Create a flow that:
1. Lists all environments (Power Platform for Admins connector)
2. For each environment:
   - Get apps count (Get-AdminApps → count value array)
   - Get flows count (ListCloudFlows → count value array)
3. Store results in SharePoint list or Excel Online

---

## Comparison of Methods

| Method | Scope | Accuracy | Speed | Admin Required | Best For |
|--------|-------|----------|-------|----------------|----------|
| Dataverse Web API | Single environment | Highest | Fast | No (user access) | Real-time counts per environment |
| Admin Connector V2 | Cross-environment | High | Medium | Yes | Admin dashboards |
| Unified API | Cross-environment | Medium | Fast | Yes | Infrastructure queries |
| Power Automate | Custom | High | Slow | Yes | Scheduled reports |

---

## Implementation Example: Environment Summary Page

### API Route: `/api/environments/[id]/counts/route.js`

```javascript
import { getDataverseTokenForUser } from '@/lib/dataverseToken';

export async function GET(request, { params }) {
  const { id } = params; // environment ID
  
  try {
    // Get environment details first (to get instanceUrl)
    const env = await getEnvironmentDetails(id);
    const instanceUrl = env.properties.linkedEnvironmentMetadata.instanceUrl;
    
    // Get Dataverse token for this specific environment
    const token = await getDataverseTokenForUser(instanceUrl);
    
    // Define all count queries
    const queries = {
      solutions: 'solutions?$count=true&$top=0&$filter=isvisible eq true and ismanaged eq false',
      canvasApps: 'canvasapps?$count=true&$top=0&$filter=statecode eq 0',
      modelDrivenApps: 'appmodules?$count=true&$top=0',
      cloudFlows: 'workflows?$count=true&$top=0&$filter=category eq 5',
      activeFlows: 'workflows?$count=true&$top=0&$filter=category eq 5 and statecode eq 1',
      desktopFlows: 'workflows?$count=true&$top=0&$filter=type eq 3',
      agents: 'bots?$count=true&$top=0&$filter=statecode eq 0',
      customConnectors: 'connectors?$count=true&$top=0&$filter=connectortype eq 1',
      connectionReferences: 'connectionreferences?$count=true&$top=0',
      environmentVariables: 'environmentvariabledefinitions?$count=true&$top=0',
      customTables: 'EntityDefinitions?$count=true&$top=0&$filter=IsCustomEntity eq true'
    };
    
    // Execute all queries in parallel
    const results = await Promise.all(
      Object.entries(queries).map(async ([key, query]) => {
        const response = await fetch(
          `${instanceUrl}/api/data/v9.2/${query}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Accept': 'application/json',
              'OData-MaxVersion': '4.0',
              'OData-Version': '4.0'
            }
          }
        );
        
        if (!response.ok) {
          console.error(`[Counts] ${key} failed:`, response.status);
          return [key, 0];
        }
        
        const data = await response.json();
        return [key, data['@odata.count'] || 0];
      })
    );
    
    const counts = Object.fromEntries(results);
    
    return Response.json({
      environmentId: id,
      environmentName: env.properties.displayName,
      instanceUrl,
      counts,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('[Environment Counts] Error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
```

### UI Component: `src/app/power-platform/environments/[id]/ResourceCounts.jsx`

```jsx
'use client';

import { useState, useEffect } from 'react';

export default function ResourceCounts({ environmentId }) {
  const [counts, setCounts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    async function fetchCounts() {
      try {
        const response = await fetch(`/api/environments/${environmentId}/counts`);
        if (!response.ok) throw new Error('Failed to fetch counts');
        const data = await response.json();
        setCounts(data.counts);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    fetchCounts();
  }, [environmentId]);
  
  if (loading) return <div>Loading resource counts...</div>;
  if (error) return <div className="text-red-600">Error: {error}</div>;
  if (!counts) return null;
  
  const resourceTypes = [
    { key: 'solutions', label: 'Solutions', icon: '📦' },
    { key: 'canvasApps', label: 'Canvas Apps', icon: '📱' },
    { key: 'modelDrivenApps', label: 'Model-Driven Apps', icon: '🖥️' },
    { key: 'cloudFlows', label: 'Cloud Flows', icon: '🔄' },
    { key: 'activeFlows', label: 'Active Flows', icon: '✅' },
    { key: 'desktopFlows', label: 'Desktop Flows', icon: '🤖' },
    { key: 'agents', label: 'Agents (Copilots)', icon: '💬' },
    { key: 'customConnectors', label: 'Custom Connectors', icon: '🔌' },
    { key: 'connectionReferences', label: 'Connection References', icon: '🔗' },
    { key: 'environmentVariables', label: 'Environment Variables', icon: '⚙️' },
    { key: 'customTables', label: 'Custom Tables', icon: '📊' }
  ];
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {resourceTypes.map(({ key, label, icon }) => (
        <div
          key={key}
          className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 flex items-center justify-between"
        >
          <div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {icon} {label}
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
              {counts[key]?.toLocaleString() || 0}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

## Common Filters and Scenarios

### Active Resources Only
```http
$filter=statecode eq 0
```

### Resources Created in Last 30 Days
```http
$filter=createdon gt {30_days_ago_ISO}
```

Example:
```http
$filter=createdon gt 2024-10-03T00:00:00Z
```

### Resources by Specific Owner
```http
$filter=_ownerid_value eq '{user_guid}'
```

### Unmanaged Solutions Only
```http
$filter=isvisible eq true and ismanaged eq false
```

### Modern Flows (Not Classic Workflows)
```http
$filter=category eq 5
```

### Combine Multiple Filters
```http
$filter=category eq 5 and statecode eq 1 and createdon gt 2024-10-01T00:00:00Z
```

---

## Best Practices

1. **Use `$count=true` with `$top=0`**
   - Gets count without returning items
   - Much faster than retrieving all items

2. **Cache Counts**
   - Counts don't change frequently
   - Cache for 5-15 minutes
   - Refresh on demand

3. **Parallel Requests**
   - Use `Promise.all()` to fetch multiple counts simultaneously
   - Significantly faster than sequential requests

4. **Error Handling**
   - Some environments may not have Dataverse
   - Handle 404s and 401s gracefully
   - Return 0 for missing resources

5. **Permissions**
   - User must have read access to the resource in that environment
   - Admins can query across all environments
   - Consider using service principal for automation

6. **Rate Limiting**
   - Dataverse Web API: 6,000 requests per 5 minutes per user
   - Admin Connector: 100 requests per 60 seconds per connection
   - Implement exponential backoff for retries

---

## Troubleshooting

### "Resource not found" Error
- Verify the entity set name is correct (e.g., `bots` not `bot`)
- Check that the environment has Dataverse provisioned
- Ensure API version is correct (`v9.2` or later)

### Zero Counts When Resources Exist
- Check filter syntax (e.g., `eq` not `=`)
- Verify state codes (0 = active for most, 1 = active for workflows)
- Ensure user has read permissions on the table

### Token Errors
- Dataverse tokens are environment-specific
- Scope must match: `{instanceUrl}/.default`
- Token may have expired (refresh every 50-55 minutes)

### Performance Issues
- Always use `$top=0` when only counting
- Avoid complex `$expand` in count queries
- Consider caching results

---

## References

- [Dataverse Web API Query Data](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/query-data-web-api)
- [Count Number of Rows](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/query/count-rows)
- [Power Platform Admin Connector V2](https://learn.microsoft.com/en-us/connectors/powerplatformadminv2/)
- [Filter Rows](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/query/filter-rows)
- [Dataverse Entity Reference](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/reference/entities)
