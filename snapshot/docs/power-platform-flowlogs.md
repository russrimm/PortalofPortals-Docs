# Power Platform Desktop Flow Logs Query Implementation

## Overview

This application queries **Desktop Flow Logs V2** from Dataverse, which are stored in an **elastic table** (Azure Cosmos DB backed) with the logical name `flowlog`. These logs are **child records** of the `flowsession` parent table, creating a **parent-child relationship** that requires special query patterns.

**Critical Architecture Note**: FlowLogs cannot be queried directly using standard OData `$expand` operations because elastic child tables must be accessed through their parent record's relationship navigation property. This constraint drives the entire query implementation strategy.

---

## Table Structure

### Parent-Child Relationship
```
FlowSession (Parent)
└── flowlog (Child, Elastic Table)
    ├── Relationship: flowsession_flowlog_parentobjectid
    └── Storage: Azure Cosmos DB via Dataverse elastic table
```

### FlowLog Properties (Desktop Flow Logs V2)

| Property | Type | Description |
|----------|------|-------------|
| `flowlogid` | Guid | Primary key |
| `createdon` | DateTime | Log creation timestamp |
| `type` | Int | Log type: 100000001 = Desktop flow action log |
| `level` | Int | Severity: 192350001=Information, 192350002=Warning, 192350003=Error |
| `ttlinseconds` | Int | Time to live (0 = forever) |
| `cloudflowid` | Guid | Parent cloud flow ID |
| `cloudflowrunid` | Guid | Cloud flow run instance ID |
| `desktopflowid` | Guid | Desktop flow ID |
| `flowsessionid` | Guid | Parent flow session ID (foreign key) |
| `flowmachineid` | Guid | Machine that executed the flow |
| `flowmachinegroupid` | Guid | Machine group |
| `workqueueid` | Guid | Work queue ID (if queued) |
| `workqueueitemid` | Guid | Work queue item ID |
| `data` | String (JSON) | **Action output data** (requires JSON.parse) |

### Data Field Structure

The `data` field is a **JSON string** containing nested action output details:

```json
{
  "startTime": "2026-01-23T10:30:00Z",
  "endTime": "2026-01-23T10:35:00Z",
  "status": "Succeeded",
  "workflowName": "Process Invoice",
  "errorMessage": null,
  "errorCode": null,
  "session": {
    "localizedName": "CMD session",
    "value": "Cmd Session is alive. (Process Id: 8560)",
    "variableName": "CmdSession"
  },
  "variables": [
    { "name": "InvoiceNumber", "value": "INV-12345" }
  ]
}
```

**Important**: This field must be parsed with `JSON.parse()` before use, as Dataverse returns it as a string.

---

## Query Implementation Strategy

The API implements a **three-tier fallback strategy** to handle different Dataverse API capabilities:

### Method 1: ExecuteCosmosSqlQuery (Primary)
**Best Performance** - Direct Cosmos SQL query against elastic table

**When Used**: Default for all queries unless API returns 404

**Request Pattern**:
```http
POST /api/data/v9.2/ExecuteCosmosSqlQuery
Content-Type: application/json

{
  "QueryText": "SELECT TOP 50 c.props.flowlogid as flowlogid, c.props.createdon as createdon, c.props.data as data, c.props.level as level, c.props.type as type, c.ttl as ttlinseconds, c.props.cloudflowid as cloudflowid, c.props.cloudflowrunid as cloudflowrunid, c.props.desktopflowid as desktopflowid, c.props.flowmachineid as flowmachineid, c.props.flowmachinegroupid as flowmachinegroupid, c.props.flowsessionid as flowsessionid, c.props.workqueueid as workqueueid, c.props.workqueueitemid as workqueueitemid FROM c ORDER BY c.props.createdon DESC",
  "EntityLogicalName": "flowlog",
  "PageSize": 50
}
```

**Response Processing**:
```javascript
// 1. Parse Result (JSON string array)
const results = JSON.parse(json.Result);

// 2. Parse data field for each log
results.forEach(log => {
  if (typeof log.data === 'string') {
    log.data = JSON.parse(log.data);
  }
});

// 3. Extract nested properties
const transformed = results.map(log => ({
  ...log,
  starttime: log.data?.startTime || log.createdon,
  endtime: log.data?.endTime,
  status: log.data?.status || (log.level === 192350003 ? 'Failed' : 'Success'),
  workflowname: log.data?.workflowName,
  errormessage: log.data?.errorMessage,
  errorcode: log.data?.errorCode
}));
```

**Advantages**:
- Single round-trip query
- Can fetch logs across all sessions
- Full Cosmos SQL capabilities
- Best performance for bulk queries

**Limitations**:
- Not available in all Dataverse environments (requires recent platform version)
- May not support parent-child relationship filtering

---

### Method 2: FlowSession Individual Queries (Fallback 1)
**Moderate Performance** - Query each FlowSession individually for child logs

**When Used**: ExecuteCosmosSqlQuery returns 404 (API not available)

**Request Pattern**:
```javascript
// Step 1: Get recent flow sessions (parents)
GET /api/data/v9.2/flowsessions?$top=20&$orderby=createdon desc&$select=flowsessionid,name,createdon

// Step 2: For each session, query child logs through relationship
for (const session of sessions) {
  GET /api/data/v9.2/flowsessions({session.flowsessionid})/flowsession_flowlog_parentobjectid?$top=100
}
```

**Processing Logic**:
```javascript
const allLogs = [];
for (const session of sessions) {
  const logsRes = await fetch(`${baseUrl}/flowsessions(${session.flowsessionid})/flowsession_flowlog_parentobjectid?$top=100`);
  const logsData = await logsRes.json();
  
  logsData.value.forEach(log => {
    // Parse data field
    let parsedData = log.data;
    if (typeof log.data === 'string') {
      parsedData = JSON.parse(log.data);
    }
    
    allLogs.push({
      ...log,
      flowsessionid: log.flowsessionid || session.flowsessionid,
      data: parsedData,
      starttime: parsedData?.startTime || log.createdon,
      workflowname: parsedData?.workflowName || session.name
    });
  });
}
```

**Advantages**:
- Works with standard OData APIs (no ExecuteCosmosSqlQuery required)
- Properly follows parent-child relationship
- Inherits session context (workflow name, etc.)

**Limitations**:
- Multiple HTTP requests (N+1 query pattern)
- Slower for large numbers of sessions
- Limited to ~20 recent sessions per query

---

### Method 3: Direct FlowSession Relationship Query (Specific Session)
**Best for Single Session** - Query logs for a specific flow session

**When Used**: `flowsessionId` query parameter provided

**Request Pattern**:
```http
GET /api/data/v9.2/flowsessions({flowsessionId})/flowsession_flowlog_parentobjectid?$top=100
```

**Advantages**:
- Single HTTP request
- Direct parent-child navigation
- Fast for specific session lookups

**Use Cases**:
- Drilling down from Flow Run History
- Debugging specific execution
- Flow detail modal showing associated logs

---

## API Endpoints

### GET - Query FlowLogs

#### Endpoint URL
```
GET /api/power-platform/dataverse/flowlogs
```

#### Query Parameters

| Name | Required | Description |
|------|----------|-------------|
| `instanceUrl` | Yes | Dataverse org URL (e.g., `https://org.crm.dynamics.com`) |
| `$top` | No | Maximum records to return (default: 50) |
| `flowsessionId` | No | Specific flow session GUID (triggers Method 3) |
| `workflowId` | No | Filter by cloud flow ID (cloudflowid) |

#### Response Format

```jsonc
{
  "value": [
    {
      "flowlogid": "guid",
      "createdon": "2026-01-23T10:30:00Z",
      "type": 100000001,
      "level": 192350001,
      "ttlinseconds": 0,
      "cloudflowid": "guid",
      "cloudflowrunid": "guid",
      "desktopflowid": "guid",
      "flowsessionid": "guid",
      "flowmachineid": "guid",
      "flowmachinegroupid": "guid",
      "workqueueid": "guid",
      "workqueueitemid": "guid",
      "data": {
        // Parsed JSON object
        "startTime": "2026-01-23T10:30:00Z",
        "session": { ... },
        "variables": [ ... ]
      },
      // Convenience properties extracted from data
      "starttime": "2026-01-23T10:30:00Z",
      "endtime": "2026-01-23T10:35:00Z",
      "status": "Succeeded",
      "workflowname": "Process Invoice",
      "errormessage": null,
      "errorcode": null
    }
  ],
  "queryMethod": "ExecuteCosmosSqlQuery", // or "flowsessions_individual" or "flowsession_relationship"
  "hasMore": false,
  "pagingCookie": null,
  "stats": { // Only for flowsessions_individual method
    "totalSessions": 20,
    "successCount": 18,
    "errorCount": 2
  }
}
```

#### Error Responses

**404 - Desktop Flow Logs Not Available**
```json
{
  "error": "Desktop Flow Logs not available",
  "hint": "ExecuteCosmosSqlQuery is not available and FlowSessions fallback failed. Desktop Flow Logs V2 may not be enabled in this environment. Enable it in Power Platform Admin Center → Environment Settings → Features → Desktop flow run action logs configuration.",
  "details": { ... },
  "documentationUrl": "https://learn.microsoft.com/en-us/power-automate/desktop-flows/configure-desktop-flow-logs"
}
```

**400 - Missing Parameters**
```json
{
  "error": "Missing instanceUrl parameter"
}
```

---

### DELETE - Bulk Delete FlowLogs (DeleteMultiple with Fallback)

Delete multiple flowlog records in a single request. The endpoint **attempts to use DeleteMultiple action** (optimal for elastic tables), but **automatically falls back to individual DELETE requests** if DeleteMultiple is not available in the environment.

#### Deletion Strategy

**Method 1: DeleteMultiple (Primary)**
- Best performance for elastic tables
- Single HTTP request for all records
- Partial success handling
- Requires recent Dataverse platform version

**Method 2: Individual DELETE Requests (Fallback)**
- Used when DeleteMultiple returns 404
- Sequential DELETE requests: `DELETE /flowlogs(guid)`
- Works in all Dataverse environments
- Slower but compatible

#### Endpoint URL
```
DELETE /api/power-platform/dataverse/flowlogs
```

#### Query Parameters

| Name | Required | Description |
|------|----------|-------------|
| `instanceUrl` | Yes | Dataverse org URL (e.g., `https://org.crm.dynamics.com`) |

#### Request Body

```json
{
  "flowlogIds": [
    "guid-1",
    "guid-2",
    "guid-3"
  ]
}
```

**Constraints**:
- Maximum 100 flowlog IDs per request (Microsoft recommendation for elastic tables)
- All IDs must be valid GUIDs
- Application user must have delete permissions on flowlog table

#### Response Format

**Success (All Deleted)**
```json
{
  "success": true,
  "deletedCount": 3,
  "message": "Successfully deleted 3 flowlog record(s)"
}
```
Status: `200 OK`

**Success with Fallback (DeleteMultiple Not Available)**
```json
{
  "success": true,
  "deletedCount": 3,
  "message": "Successfully deleted 3 flowlog record(s)",
  "fallbackUsed": "individual-delete",
  "note": "DeleteMultiple not available, used individual DELETE requests"
}
```
Status: `200 OK`

**Partial Success (Some Deleted, Some Failed)**
```json
{
  "success": true,
  "partialSuccess": true,
  "deletedCount": 2,
  "failedCount": 1,
  "totalRequested": 3,
  "details": [
    {
      "flowlogId": "guid-1",
      "success": true,
      "statusCode": 204,
      "error": null
    },
    {
      "flowlogId": "guid-2",
      "success": true,
      "statusCode": 204,
      "error": null
    },
    {
      "flowlogId": "guid-3",
      "success": false,
      "statusCode": 404,
      "error": "Record not found"
    }
  ],
  "message": "Deleted 2 record(s), 1 failed",
  "fallbackUsed": "individual-delete"
}
```
Status: `207 Multi-Status`

**Complete Failure**
```json
{
  "success": false,
  "error": "DeleteMultiple operation failed",
  "hint": "Ensure: 1) Desktop Flow Logs V2 is enabled, 2) Application user has delete permissions on flowlog table, 3) Provided flowlog IDs are valid",
  "statusCode": 403,
  "details": { ... },
  "documentationUrl": "https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/reference/deletemultiple"
}
```
Status: Original error status (403, 404, 500, etc.)

#### Error Responses

**400 - Missing/Invalid Request Body**
```json
{
  "error": "Missing or invalid flowlogIds array",
  "hint": "Provide an array of flowlog GUIDs to delete, e.g., { \"flowlogIds\": [\"guid1\", \"guid2\"] }"
}
```

**400 - Too Many Records**
```json
{
  "error": "Too many records",
  "hint": "DeleteMultiple supports up to 100 records per request for elastic tables. Split into smaller batches.",
  "provided": 150,
  "maximum": 100
}
```

**400 - Missing instanceUrl**
```json
{
  "error": "Missing instanceUrl parameter"
}
```

#### Usage Example

```javascript
// Delete flowlogs by ID
const deleteFlowLogs = async (instanceUrl, flowlogIds) => {
  const response = await fetch(`/api/power-platform/dataverse/flowlogs?instanceUrl=${encodeURIComponent(instanceUrl)}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ flowlogIds })
  });
  
  const result = await response.json();
  
  if (result.partialSuccess) {
    console.warn(`Partial success: ${result.deletedCount} deleted, ${result.failedCount} failed`);
    result.details.forEach(d => {
      if (!d.success) {
        console.error(`Failed to delete ${d.flowlogId}: ${d.error}`);
      }
    });
  } else if (result.success) {
    console.log(`Successfully deleted ${result.deletedCount} flowlog(s)`);
  } else {
    console.error('Delete operation failed:', result.error);
  }
  
  return result;
};

// Usage
await deleteFlowLogs('https://org.crm.dynamics.com', [
  'guid-1',
  'guid-2',
  'guid-3'
]);
```

#### Implementation Details

The DELETE endpoint uses the Dataverse DeleteMultiple action:

```http
POST https://org.crm.dynamics.com/api/data/v9.2/DeleteMultiple
Authorization: Bearer {token}
Content-Type: application/json
OData-MaxVersion: 4.0
OData-Version: 4.0
Prefer: odata.include-annotations=Microsoft.PowerApps.CDS.ErrorDetails.*

{
  "Targets": [
    {
      "@odata.type": "Microsoft.Dynamics.CRM.flowlog",
      "flowlogid": "guid-1"
    },
    {
      "@odata.type": "Microsoft.Dynamics.CRM.flowlog",
      "flowlogid": "guid-2"
    }
  ]
}
```

**Key Features**:
1. **Automatic Fallback Strategy**: Tries DeleteMultiple first, falls back to individual DELETEs if not available
2. **Environment Compatibility**: Works in both modern (DeleteMultiple) and older (individual DELETE) Dataverse versions
3. **Partial Success Handling**: Can delete some records even if others fail
4. **Detailed Error Reporting**: Returns per-record status with error messages
5. **Batch Size Limits**: Enforces 100-record limit for optimal performance
6. **Token Management**: Uses same Dataverse-scoped token as query operations
7. **Console Logging**: Logs fallback detection and per-method success rates

---

## Data Transformation Pipeline

### Query Parameters

| Name | Required | Description |
|------|----------|-------------|
| `instanceUrl` | Yes | Dataverse org URL (e.g., `https://org.crm.dynamics.com`) |
| `$top` | No | Maximum records to return (default: 50) |
| `flowsessionId` | No | Specific flow session GUID (triggers Method 3) |
| `workflowId` | No | Filter by cloud flow ID (cloudflowid) |

### Response Format

```jsonc
{
  "value": [
    {
      "flowlogid": "guid",
      "createdon": "2026-01-23T10:30:00Z",
      "type": 100000001,
      "level": 192350001,
      "ttlinseconds": 0,
      "cloudflowid": "guid",
      "cloudflowrunid": "guid",
      "desktopflowid": "guid",
      "flowsessionid": "guid",
      "flowmachineid": "guid",
      "flowmachinegroupid": "guid",
      "workqueueid": "guid",
      "workqueueitemid": "guid",
      "data": {
        // Parsed JSON object
        "startTime": "2026-01-23T10:30:00Z",
        "session": { ... },
        "variables": [ ... ]
      },
      // Convenience properties extracted from data
      "starttime": "2026-01-23T10:30:00Z",
      "endtime": "2026-01-23T10:35:00Z",
      "status": "Succeeded",
      "workflowname": "Process Invoice",
      "errormessage": null,
      "errorcode": null
    }
  ],
  "queryMethod": "ExecuteCosmosSqlQuery", // or "flowsessions_individual" or "flowsession_relationship"
  "hasMore": false,
  "pagingCookie": null,
  "stats": { // Only for flowsessions_individual method
    "totalSessions": 20,
    "successCount": 18,
    "errorCount": 2
  }
}
```

### Error Responses

#### 404 - Desktop Flow Logs Not Available
```json
{
  "error": "Desktop Flow Logs not available",
  "hint": "ExecuteCosmosSqlQuery is not available and FlowSessions fallback failed. Desktop Flow Logs V2 may not be enabled in this environment. Enable it in Power Platform Admin Center → Environment Settings → Features → Desktop flow run action logs configuration.",
  "details": { ... },
  "documentationUrl": "https://learn.microsoft.com/en-us/power-automate/desktop-flows/configure-desktop-flow-logs"
}
```

#### 400 - Missing Parameters
```json
{
  "error": "Missing instanceUrl parameter"
}
```

---

## Data Transformation Pipeline

### Step-by-Step Processing

1. **Token Acquisition**
   ```javascript
   // Acquire Dataverse-scoped token
   const tokenRes = await fetch(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`, {
     method: 'POST',
     body: new URLSearchParams({
       client_id: CLIENT_ID,
       client_secret: CLIENT_SECRET,
       scope: `${instanceUrl}/.default`,
       grant_type: 'client_credentials'
     })
   });
   const { access_token } = await tokenRes.json();
   ```

2. **Query Execution** (Method 1 - ExecuteCosmosSqlQuery)
   ```javascript
   const response = await fetch(`${baseUrl}/ExecuteCosmosSqlQuery`, {
     method: 'POST',
     headers: {
       'Authorization': `Bearer ${access_token}`,
       'Content-Type': 'application/json',
       'OData-MaxVersion': '4.0',
       'OData-Version': '4.0'
     },
     body: JSON.stringify({
       QueryText: cosmosQuery,
       EntityLogicalName: 'flowlog',
       PageSize: top
     })
   });
   ```

3. **Parse Cosmos SQL Result**
   ```javascript
   const json = await response.json();
   const results = JSON.parse(json.Result); // Result is JSON string
   ```

4. **Parse Data Field** (Critical Step)
   ```javascript
   results.forEach(log => {
     if (typeof log.data === 'string') {
       try {
         log.data = JSON.parse(log.data);
       } catch (e) {
         console.warn('Failed to parse data field:', e);
       }
     }
   });
   ```

5. **Extract Convenience Properties**
   ```javascript
   const transformed = results.map(log => ({
     ...log,
     starttime: log.data?.startTime || log.createdon,
     endtime: log.data?.endTime,
     status: log.data?.status || (log.level === 192350003 ? 'Failed' : 'Success'),
     workflowname: log.data?.workflowName,
     errormessage: log.data?.errorMessage,
     errorcode: log.data?.errorCode
   }));
   ```

---

## UI Implementation

### Page: /power-platform/flow-logs

**Standalone flow logs viewer** with comprehensive details display.

**Features**:
- Table view with sortable columns
- Details modal with expandable sections
- Technical Details section (level codes, TTL, all IDs)
- Action Output section (parsed data field with nested objects)
- Raw Data JSON collapsible viewer

### Component: FlowLogsModal

**Embedded in flows page** for in-context log viewing.

**Features**:
- Same structure as standalone page
- Filtered by specific flow or session
- Inline action output inspection

### Data Fetching Pattern

```typescript
const fetchLogs = async () => {
  const params = new URLSearchParams({
    instanceUrl: environment.url,
    $top: '50'
  });
  
  if (flowSessionId) {
    params.append('flowsessionId', flowSessionId);
  }
  
  const response = await fetch(`/api/power-platform/dataverse/flowlogs?${params}`);
  const data = await response.json();
  
  // data.value contains fully parsed logs with data field as object
  setLogs(data.value);
};
```

---

## Security & Permissions

### Required Permissions

1. **Application User** registered in Dataverse environment
2. **Security Role** with read privileges on:
   - `flowsession` table
   - `flowlog` table (elastic table)
3. **Desktop Flow Logs V2** feature enabled in Power Platform Admin Center

### Configuration Steps

1. **Power Platform Admin Center**
   ```
   Environment → Settings → Features → Desktop flow run action logs
   ✓ Enable "Desktop flow run action logs v2"
   ```

2. **Application User Setup**
   ```
   Environment → Users → Application users → Add application user
   - Select app registration
   - Assign security role with flowsession/flowlog read access
   ```

3. **Token Scope**
   ```javascript
   scope: `${instanceUrl}/.default`
   // e.g., https://org.crm.dynamics.com/.default
   ```

---

## Troubleshooting

### Common Issues

#### 1. "ExecuteCosmosSqlQuery not available" (404)
**Cause**: Older Dataverse platform version or API not enabled  
**Solution**: Automatic fallback to Method 2 (FlowSessions individual queries)  
**Impact**: More HTTP requests, slightly slower

#### 2. "FlowSessions query failed" (404)
**Cause**: Desktop Flow Logs V2 not enabled  
**Solution**: Enable in Power Platform Admin Center → Features  
**Documentation**: https://learn.microsoft.com/en-us/power-automate/desktop-flows/configure-desktop-flow-logs

#### 3. Data field showing as characters (0, 1, 2...)
**Cause**: Missing JSON.parse() on data field  
**Solution**: Already implemented in API - ensure using latest version  
**Technical**: Dataverse returns data as JSON string, must parse before use

#### 4. Empty logs or no data
**Cause**: No desktop flows executed recently  
**Solution**: Run a desktop flow to generate logs  
**Note**: Logs are created during execution, not from flow definition

#### 5. 401/403 Errors
**Cause**: Insufficient permissions  
**Solution**: Verify application user has read access to flowsession and flowlog tables

---

## Performance Considerations

### Query Method Performance Comparison

| Method | Round Trips | Records/Request | Performance | Use Case |
|--------|-------------|-----------------|-------------|----------|
| ExecuteCosmosSqlQuery | 1 | Unlimited | ⭐⭐⭐⭐⭐ Best | Bulk queries, dashboards |
| FlowSessions Individual | N+1 | 100/session | ⭐⭐⭐ Good | Fallback, recent logs |
| Single Session Relationship | 1 | 100 | ⭐⭐⭐⭐⭐ Best | Specific session |

### Optimization Tips

1. **Use ExecuteCosmosSqlQuery when available** - Single query for all logs
2. **Limit $top parameter** - Smaller result sets = faster response
3. **Filter by flowsessionId** - When viewing specific execution
4. **Filter by workflowId** - When viewing specific flow's history
5. **Implement client-side caching** - Reduce redundant queries

### Elastic Table Considerations

- **Partition-scoped queries** would improve performance but require partition key awareness
- **Cross-partition queries** (current implementation) have higher latency
- **Time to Live (TTL)** - Logs auto-delete based on ttlinseconds (0 = never)

---

## Future Enhancements

1. **Pagination Support** - Handle `@odata.nextLink` for large result sets
2. **Date Range Filtering** - Add $filter parameter for time-based queries
3. **Partition Hints** - Use partitionId for better Cosmos DB performance
4. **Caching Layer** - Redis/memory cache for frequently accessed logs
5. **Streaming Updates** - SignalR/WebSocket for real-time log streaming
6. **Advanced Filtering UI** - Status, level, workflow, machine filters

---

## References

- [Desktop Flow Logs Configuration](https://learn.microsoft.com/en-us/power-automate/desktop-flows/configure-desktop-flow-logs)
- [Dataverse Elastic Tables](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/elastic-tables)
- [ExecuteCosmosSqlQuery API](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/execute-cosmos-sql-query)
- [Parent-Child Relationships in Dataverse](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/query-data-web-api#retrieve-related-entities)
