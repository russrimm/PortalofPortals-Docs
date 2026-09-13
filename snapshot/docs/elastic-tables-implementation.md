# Elastic Tables Implementation for Flow Logs

## Overview
This document describes the implementation of proper elastic table querying for the Power Platform Flow Logs feature using the ExecuteCosmosSqlQuery function.

## Problem
The flowlogs table in Dataverse is an **elastic table**, which requires special querying methods. Standard OData queries (`$orderby`, `$filter`, `$top`) fail with 400 errors on elastic tables because they use a different underlying storage mechanism (Azure Cosmos DB) and require Cosmos SQL syntax.

## Solution
Replaced the standard OData query approach with ExecuteCosmosSqlQuery function calls using proper Cosmos SQL syntax.

## Key Changes

### 1. Query Syntax
**Before (OData):**
```javascript
const apiUrl = `${instanceUrl}/api/data/v9.2/flowlogs?$top=50&$orderby=starttime desc`;
```

**After (Cosmos SQL):**
```javascript
const cosmosQuery = `SELECT TOP ${top} c.props.flowlogid, c.props.starttime, c.props.endtime, c.props.createdon, c.props.status, c.props.type, c.props.workflowname, c.props.workflowid, c.props.partitionid, c.props.errormessage, c.props.errorcode FROM c ORDER BY c.props.starttime DESC`;

const apiUrl = `${instanceUrl}/api/data/v9.2/ExecuteCosmosSqlQuery?QueryText=${cosmosQuery}&EntityLogicalName=flowlog`;
```

### 2. Column References
Elastic tables require the `c.props.` prefix for all column references:
- ✅ `c.props.starttime`
- ✅ `c.props.workflowname`
- ✅ `c.props.status`
- ❌ `starttime` (doesn't work)
- ❌ `workflowname` (doesn't work)

### 3. Response Handling
**Before (OData):**
```javascript
const json = await response.json();
return { value: json.value };
```

**After (ExecuteCosmosSqlQuery):**
```javascript
const json = await response.json();
// Result is a JSON string containing an array
const results = JSON.parse(json.Result);
return { 
  value: results,
  hasMore: json.HasMore,
  pagingCookie: json.PagingCookie
};
```

## Implementation Details

### File Modified
- `src/app/api/power-platform/dataverse/flowlogs/route.ts`

### Key Features
1. **Cosmos SQL Query Building**: Constructs proper SELECT statement with `c.props` prefix
2. **ExecuteCosmosSqlQuery Function**: Uses the correct Dataverse function endpoint
3. **Result Parsing**: Handles the JSON string Result field returned by the function
4. **Pagination Support**: Implements HasMore and PagingCookie for pagination
5. **Partition Optimization**: Supports optional partitionId parameter for performance
6. **Error Handling**: Provides helpful error messages for common issues

### Query Structure
```sql
SELECT TOP ${top} 
  c.props.flowlogid,
  c.props.starttime,
  c.props.endtime,
  c.props.createdon,
  c.props.status,
  c.props.type,
  c.props.workflowname,
  c.props.workflowid,
  c.props.partitionid,
  c.props.errormessage,
  c.props.errorcode
FROM c 
ORDER BY c.props.starttime DESC
```

### API Endpoint
```
GET /api/data/v9.2/ExecuteCosmosSqlQuery?QueryText=<query>&EntityLogicalName=flowlog&PartitionId=<optional>
```

### Response Format
```json
{
  "Result": "[{\"flowlogid\":\"...\",\"starttime\":\"...\",\"status\":\"...\"}]",
  "HasMore": false,
  "PagingCookie": null
}
```

## Testing
1. ✅ Build passes: `pnpm run build`
2. ✅ Lint passes: `pnpm run lint` (no new warnings)
3. ✅ TypeScript compilation successful
4. ✅ Dev server starts correctly

## References
- [Microsoft Docs: Query JSON columns in elastic tables](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/query-json-columns-elastic-tables)
- [ExecuteCosmosSqlQuery Function - SDK](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/org-service/use-executecosmocsqlquery-elastic-tables)
- [ExecuteCosmosSqlQuery Function - Web API](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/query-data-elastic-tables)

## Benefits
1. **Proper Elastic Table Support**: Uses the correct querying mechanism for elastic tables
2. **Better Performance**: Supports partition-scoped queries when partitionId is provided
3. **Pagination**: Implements proper pagination with HasMore and PagingCookie
4. **Column Access**: Uses c.props prefix to access JSON columns correctly
5. **Error Messages**: Provides clear hints when issues occur

## Future Enhancements
- Add filtering support using Cosmos SQL WHERE clauses
- Implement pagination continuation using PagingCookie
- Add support for additional flow log columns as needed
- Consider caching frequently accessed flow logs
