# Dataverse Web API - Quick Reference

## Endpoints Summary

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/power-platform/dataverse/query` | GET | Query/Read records |
| `/api/power-platform/dataverse/operations` | POST | CRUD operations |
| `/api/power-platform/dataverse/batch` | POST | Batch multiple operations |
| `/api/power-platform/dataverse/execute` | POST | Execute actions/functions |
| `/api/power-platform/dataverse/elastic-table` | GET | Query Cosmos DB elastic tables |

## Quick Examples

### 📖 Read (Query)
```typescript
const response = await fetch('/api/power-platform/dataverse/query?' + new URLSearchParams({
  instanceUrl: 'https://org.crm.dynamics.com',
  entitySet: 'accounts',
  '$select': 'name,revenue',
  '$top': '10'
}))
```

### ➕ Create
```typescript
await fetch('/api/power-platform/dataverse/operations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    operation: 'create',
    entitySet: 'accounts',
    instanceUrl: 'https://org.crm.dynamics.com',
    data: { name: 'Contoso' }
  })
})
```

### ✏️ Update
```typescript
await fetch('/api/power-platform/dataverse/operations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    operation: 'update',
    entitySet: 'accounts',
    id: 'guid',
    instanceUrl: 'https://org.crm.dynamics.com',
    data: { revenue: 5000000 }
  })
})
```

### � Update Single Property
```typescript
await fetch('/api/power-platform/dataverse/operations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    operation: 'updateProperty',
    entitySet: 'contacts',
    id: 'guid',
    property: 'telephone1',
    value: '555-0105',
    instanceUrl: 'https://org.crm.dynamics.com'
  })
})
```

### 🔍 Retrieve Single Property
```typescript
const response = await fetch('/api/power-platform/dataverse/operations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    operation: 'retrieveProperty',
    entitySet: 'contacts',
    id: 'guid',
    property: 'telephone1',
    instanceUrl: 'https://org.crm.dynamics.com'
  })
})
const data = await response.json()
console.log(data.data.value) // '555-0105'
```

### �🗑️ Delete
```typescript
await fetch('/api/power-platform/dataverse/operations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    operation: 'delete',
    entitySet: 'accounts',
    id: 'guid',
    instanceUrl: 'https://org.crm.dynamics.com'
  })
})
```

### 🔗 Associate
```typescript
await fetch('/api/power-platform/dataverse/operations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    operation: 'associate',
    entitySet: 'accounts',
    id: 'account-guid',
    navigationProperty: 'contact_customer_accounts',
    relatedEntitySet: 'contacts',
    relatedId: 'contact-guid',
    instanceUrl: 'https://org.crm.dynamics.com'
  })
})
```

### 📦 Batch
Up to 100 unique operation IDs. Writes run atomically first, then reads; results
return in input order. Check both HTTP status and `success`. HTTP 422 reports
known unsuccessful outcomes; HTTP 502 reports unverified outcomes. Never retry
unverified writes without reconciling records. See the
[batch response contract](dataverse-web-api-operations.md).

```typescript
const response = await fetch('/api/power-platform/dataverse/batch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    instanceUrl: 'https://org.crm.dynamics.com',
    requests: [
      { id: '1', method: 'POST', url: '/accounts', body: { name: 'A1' } },
      { id: '2', method: 'POST', url: '/accounts', body: { name: 'A2' } }
    ]
  })
})
const result = await response.json()
if (!response.ok || result.success !== true) {
  throw new Error(result.error || 'Batch operations did not all succeed')
}
```

### ⚡ Execute Action
```typescript
await fetch('/api/power-platform/dataverse/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'action',
    name: 'WinOpportunity',
    bound: true,
    entitySet: 'opportunities',
    recordId: 'opp-guid',
    instanceUrl: 'https://org.crm.dynamics.com',
    parameters: { Status: 3 }
  })
})
```

## TypeScript Client

```typescript
import { createDataverseClient } from '@/lib/dataverseClient'

const client = createDataverseClient('https://org.crm.dynamics.com')

// Query
const accounts = await client.query('accounts', { top: 10 })

// Create
const { id } = await client.create('accounts', { name: 'Contoso' })

// Update
await client.update('accounts', id, { revenue: 5000000 })

// Update single property (more efficient)
await client.updateProperty('contacts', id, 'telephone1', '555-0105')

// Retrieve single property
const phone = await client.retrieveProperty('contacts', id, 'telephone1')

// Delete
await client.delete('accounts', id)

// Associate
await client.associate('accounts', accountId, {
  navigationProperty: 'contact_customer_accounts',
  relatedEntitySet: 'contacts',
  relatedId: contactId
})

// Batch
await client.batch([...])

// Execute
await client.execute({ type: 'function', name: 'WhoAmI' })
```

## OData Query Options

| Option | Example | Description |
|--------|---------|-------------|
| `$select` | `name,revenue` | Columns to return |
| `$filter` | `revenue gt 100000` | Filter condition |
| `$orderby` | `revenue desc` | Sort expression |
| `$expand` | `primarycontactid($select=fullname)` | Include related records |
| `$top` | `25` | Limit results |
| `$count` | `true` | Include total count |

## Common Filter Operators

| Operator | Example | Description |
|----------|---------|-------------|
| `eq` | `statecode eq 0` | Equals |
| `ne` | `statecode ne 1` | Not equals |
| `gt` | `revenue gt 100000` | Greater than |
| `ge` | `revenue ge 100000` | Greater or equal |
| `lt` | `revenue lt 100000` | Less than |
| `le` | `revenue le 100000` | Less or equal |
| `and` | `statecode eq 0 and revenue gt 100000` | Logical AND |
| `or` | `statecode eq 0 or statecode eq 1` | Logical OR |
| `contains` | `contains(name,'Contoso')` | String contains |
| `startswith` | `startswith(name,'Con')` | String starts with |

## Response Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 204 | No Content (delete/disassociate success) |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 412 | Precondition Failed (ETag) |
| 500 | Internal Server Error |

## Best Practices

✅ Use `$select` to request only needed columns  
✅ Use batch operations for multiple writes  
✅ Use `$top` to limit large result sets  
✅ Cache instance URLs to avoid lookups  
✅ Use TypeScript client for type safety  
✅ Handle errors with try-catch blocks  
✅ Use conditional operations (ETags) for concurrency control  

## Common Patterns

### Pattern 1: Create with Lookup
```typescript
await client.create('accounts', {
  name: 'Contoso',
  'primarycontactid@odata.bind': '/contacts(contact-guid)'
})
```

### Pattern 2: Deep Insert (Create Related)
```typescript
// Create account with contact and tasks in one operation
await client.create('accounts', {
  name: 'Fourth Coffee',
  primarycontactid: {
    firstname: 'Susie',
    lastname: 'Curtis',
    Contact_Tasks: [
      { subject: 'Task 1', description: 'First task' },
      { subject: 'Task 2', description: 'Second task' }
    ]
  }
})
```

### Pattern 3: Update Single Property Efficiently
```typescript
// For updating one property, use updateProperty instead of update
await client.updateProperty('contacts', id, 'telephone1', '555-0105')

// Much more efficient than:
// await client.update('contacts', id, { telephone1: '555-0105' })
```

### Pattern 4: Pagination
```typescript
let allRecords = []
let nextLink = null

do {
  const params = new URLSearchParams({
    instanceUrl,
    entitySet: 'accounts',
    '$top': '100',
    ...(nextLink && { next: nextLink })
  })
  
  const response = await fetch(`/api/power-platform/dataverse/query?${params}`)
  const data = await response.json()
  
  allRecords = allRecords.concat(data.value)
  nextLink = data.next
} while (nextLink)
```

### Pattern 5: Conditional Update (Optimistic Concurrency)
```typescript
// Get current record with ETag
const record = await client.retrieve('accounts', id)
const etag = record['@odata.etag']

// Update only if not modified
await client.update('accounts', id, {
  revenue: 6000000
}, { ifMatch: etag })
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| 401 Unauthorized | Check authentication session |
| 403 Forbidden | Verify security role permissions |
| 404 Not Found | Confirm entity set name and record ID |
| 400 Bad Request | Validate query syntax and parameters |
| 412 Precondition Failed | ETag mismatch - record was modified |

## Additional Resources

- [Full Documentation](./dataverse-web-api-operations.md)
- [Microsoft Docs - Web API](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/perform-operations-web-api)
- [OData Query Reference](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/query/overview)
