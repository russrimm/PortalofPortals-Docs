# Elastic Tables - Azure Cosmos DB Integration

This document explains how to configure and use Azure Cosmos DB connectivity for Dataverse Elastic Tables.

## Overview

Dataverse Elastic Tables are backed by Azure Cosmos DB. When you click on an elastic table in the portal, the application now connects directly to Cosmos DB to retrieve and display the data, providing faster access and better scalability for high-volume scenarios.

### Time To Live (TTL) Support

Elastic tables support automatic data expiration through the TTL (Time To Live) feature:
- **TTL Column**: Shows whether TTL is enabled for each elastic table
- **Record-level TTL**: Each record can have a `ttl` field indicating when it expires (in seconds)
- **Automatic Cleanup**: Records are automatically deleted after their TTL expires
- **Use Cases**: Session data, temporary logs, time-limited analytics data

The TTL value represents seconds until expiration. For example:
- `ttl: 3600` = Expires in 1 hour
- `ttl: 86400` = Expires in 24 hours  
- `ttl: -1` = Never expires (default if TTL is enabled but not set)
- No `ttl` field = TTL not configured

## Prerequisites

1. **Azure Cosmos DB Account**: You need access to the Cosmos DB account that backs your Dataverse elastic tables
2. **Cosmos DB Credentials**: Endpoint URL and access key
3. **Container Information**: Knowledge of the database and container naming conventions used by Dataverse

## Environment Configuration


2. **Power Platform Admin Center Method**:
   - The Cosmos DB account is automatically created when you create elastic tables
   - Check the Azure subscription linked to your Power Platform environment
   - Look for a Cosmos DB account with a name related to your Dataverse organization

## How It Works

### 1. Table Type Detection

When displaying Dataverse tables, the application now checks the `tableType` property:
- `"Standard"` - Uses traditional Dataverse Web API
- `"Elastic"` - Uses Azure Cosmos DB SDK
- `"Virtual"` - Uses Dataverse Web API with virtual table support

### 2. Container Naming

Elastic tables in Dataverse typically map to Cosmos DB containers using:
- `entitySetName` - The plural entity set name (e.g., `accounts`, `contacts`)
- `logicalCollectionName` - Alternative collection name
- Fallback: `{logicalName}s` (logical name + 's')

### 3. Data Retrieval

When you click an elastic table:
```typescript
// Example API call
GET /api/power-platform/dataverse/elastic-table?instanceUrl=https://org.crm.dynamics.com&containerId=customtable&$top=100
```

The API:
1. Connects to Cosmos DB using the configured endpoint and key
2. Determines the database ID (typically `dataverse-{orgname}`)
3. Queries the container using the Cosmos DB SQL API
4. Returns results in the same format as standard Dataverse tables

## Usage

### Viewing Elastic Table Data

1. Navigate to **Power Platform** > **Environments**
2. Select an environment and click **Tables**
3. The tables list now shows a **Table Type** column
4. Click any table with type "Elastic"
5. Data is fetched from Cosmos DB and displayed in the modal

### Parent-Child Table Relationships

Elastic child tables cannot be queried directly and require a parent record reference. The portal automatically handles this:

- **When viewing a parent elastic table**: The system automatically detects child table relationships and expands them using OData `$expand`
- **Child table data**: Appears as nested collections within parent records
- **Example**: When viewing a parent table with a `flowlogs` child table, the portal will expand `flowlogs` to show related child records

**How it works:**
1. Detects elastic tables with child relationships (tables starting with `adx_` or `msft_`)
2. Queries EntityDefinitions to find OneToManyRelationships
3. Adds `$expand` parameter to include child table data
4. Displays parent and child data together in the result

### Query Limitations

- Default limit: 100 items (configurable via `$top` parameter)
- Uses `OFFSET/LIMIT` for pagination
- Complex filtering not yet implemented (coming soon)

## API Reference

### GET /api/power-platform/dataverse/elastic-table

Query elastic table data via Cosmos DB.

**Query Parameters:**
- `instanceUrl` (required) - Dataverse instance URL
- `containerId` (required) - Cosmos DB container ID
- `$top` (optional) - Number of items to return (default: 100)

**Response:**
```json
{
  "value": [...],
  "count": 100,
  "databaseId": "dataverse-orgname",
  "containerId": "customtable",
  "note": "Showing first 100 items from Cosmos DB elastic table"
}
```

## Troubleshooting

### Error: "Cosmos DB configuration not found"

**Solution**: Add `COSMOS_DB_ENDPOINT` and `COSMOS_DB_KEY` to your environment variables.

### Error: "Container not found"

**Possible causes**:
1. The container name doesn't match the Dataverse entity set name
2. The database ID is incorrect
3. The table hasn't been created in Cosmos DB yet

**Solution**: 
- Check Azure Portal to see the actual container names
- Verify the `COSMOS_DB_DATABASE_ID` environment variable
- Ensure the elastic table has been used/populated in Dataverse

### Error: "Authorization failed"

**Solution**: 
- Verify your Cosmos DB key is correct
- Ensure the key has read permissions
- Check if the key has expired (keys don't typically expire, but access policies can change)

## Performance Considerations

### Benefits of Direct Cosmos DB Access

1. **Lower Latency**: Direct queries bypass Dataverse API layers
2. **Higher Throughput**: Cosmos DB can handle millions of operations per second
3. **Cost Efficiency**: Reduces load on Dataverse API quota
4. **Flexible Queries**: Can use Cosmos DB SQL query syntax

### Best Practices

1. **Limit Result Sets**: Use `$top` parameter to avoid loading too much data
2. **Monitor RU Consumption**: Check Cosmos DB metrics in Azure Portal
3. **Use Indexes**: Ensure appropriate indexes exist on frequently queried properties
4. **Cache Results**: Consider implementing client-side caching for frequently accessed data

## Security Notes

1. **Connection String Security**: Store Cosmos DB keys securely in environment variables
2. **Read-Only Access**: Consider using read-only keys for production environments
3. **Row-Level Security**: Cosmos DB queries bypass Dataverse security roles - implement application-level security as needed
4. **Audit Logging**: Consider logging elastic table access for compliance

## Future Enhancements

Planned features:
- [ ] Advanced filtering and sorting
- [ ] Pagination support (continuation tokens)
- [ ] Cross-partition queries
- [ ] Change feed integration for real-time updates
- [ ] Export to CSV/JSON
- [ ] Custom query builder UI
- [ ] Performance metrics display

## References

- [Azure Cosmos DB JavaScript SDK](https://learn.microsoft.com/en-us/azure/cosmos-db/how-to-javascript-get-started)
- [Dataverse Elastic Tables](https://learn.microsoft.com/en-us/power-apps/maker/data-platform/create-edit-elastic-tables)
- [Cosmos DB Query Language](https://learn.microsoft.com/en-us/azure/cosmos-db/nosql/query/getting-started)
- [Cosmos DB Best Practices](https://learn.microsoft.com/en-us/azure/cosmos-db/nosql/best-practice-dotnet)
