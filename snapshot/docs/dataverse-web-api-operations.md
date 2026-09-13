# Dataverse Web API Operations

Complete implementation of Dataverse Web API operations for the Portal 360 application.

## Overview

This implementation provides full CRUD (Create, Read, Update, Delete) capabilities plus advanced operations like batch processing, associations, and custom actions/functions execution.

## Features

✅ **Query Data** - Read records with filtering, sorting, paging  
✅ **Create Records** - Insert new data with related records (deep insert)  
✅ **Update Records** - Modify existing data with conditional updates  
✅ **Update Single Property** - Update individual properties efficiently  
✅ **Retrieve Single Property** - Get individual property values  
✅ **Delete Records** - Remove records with conditional deletes  
✅ **Upsert** - Update or insert in one operation  
✅ **Associate/Disassociate** - Manage relationships (1:N and N:N)  
✅ **Batch Operations** - Execute multiple operations in one request  
✅ **Actions & Functions** - Execute bound/unbound operations  
✅ **TypeScript Client** - Type-safe client library  

## API Endpoints

### 1. Query Endpoint (Read-Only)

**GET** `/api/power-platform/dataverse/query`

Query records with OData parameters.

**Parameters:**
- `instanceUrl` (required) - Dataverse instance URL
- `entitySet` (required) - Entity set name (e.g., `accounts`, `contacts`)
- `$select` - Columns to return
- `$filter` - Filter expression
- `$orderby` - Sort expression
- `$expand` - Include related records
- `$top` - Number of records to return
- `$count` - Include total count

**Example:**
```javascript
const params = new URLSearchParams({
  instanceUrl: 'https://org.crm.dynamics.com',
  entitySet: 'accounts',
  '$select': 'name,revenue',
  '$filter': 'revenue gt 100000',
  '$orderby': 'revenue desc',
  '$top': '10'
})

const response = await fetch(`/api/power-platform/dataverse/query?${params}`)
const data = await response.json()
console.log(data.value) // Array of records
```

### 2. Operations Endpoint (CRUD)

**POST** `/api/power-platform/dataverse/operations`

Perform write operations on Dataverse.

#### Create Operation

```javascript
const response = await fetch('/api/power-platform/dataverse/operations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    operation: 'create',
    entitySet: 'accounts',
    instanceUrl: 'https://org.crm.dynamics.com',
    data: {
      name: 'Contoso Ltd',
      revenue: 5000000,
      'primarycontactid@odata.bind': '/contacts(guid)' // Associate on create
    },
    prefer: 'return=representation' // Return created record
  })
})

const result = await response.json()
console.log(result.id) // New record GUID
console.log(result.data) // Complete record if return=representation
```

#### Retrieve Operation

```javascript
const response = await fetch('/api/power-platform/dataverse/operations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    operation: 'retrieve',
    entitySet: 'accounts',
    id: 'guid-here',
    instanceUrl: 'https://org.crm.dynamics.com',
    select: 'name,revenue',
    expand: 'primarycontactid($select=fullname)'
  })
})

const result = await response.json()
console.log(result.data) // Single record
```

#### Update Operation

```javascript
const response = await fetch('/api/power-platform/dataverse/operations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    operation: 'update',
    entitySet: 'accounts',
    id: 'guid-here',
    instanceUrl: 'https://org.crm.dynamics.com',
    data: {
      name: 'Contoso Corporation',
      revenue: 6000000
    },
    ifMatch: '*', // Conditional update (optional)
    prefer: 'return=representation'
  })
})

const result = await response.json()
console.log(result.data) // Updated record
```

#### Upsert Operation

```javascript
const response = await fetch('/api/power-platform/dataverse/operations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    operation: 'upsert',
    entitySet: 'accounts',
    id: 'guid-here',
    instanceUrl: 'https://org.crm.dynamics.com',
    data: {
      name: 'New or Updated Account',
      revenue: 7000000
    }
  })
})
```

#### Update Single Property Operation

Update a single property using PUT (more efficient than PATCH for single values):

```javascript
const response = await fetch('/api/power-platform/dataverse/operations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    operation: 'updateProperty',
    entitySet: 'contacts',
    id: 'contact-guid',
    instanceUrl: 'https://org.crm.dynamics.com',
    property: 'telephone1',
    value: '555-0105'
  })
})
```

#### Retrieve Single Property Operation

Retrieve a single property value:

```javascript
const response = await fetch('/api/power-platform/dataverse/operations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    operation: 'retrieveProperty',
    entitySet: 'contacts',
    id: 'contact-guid',
    instanceUrl: 'https://org.crm.dynamics.com',
    property: 'telephone1'
  })
})

const result = await response.json()
console.log(result.data.value) // '555-0105'
```

#### Delete Operation

```javascript
const response = await fetch('/api/power-platform/dataverse/operations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    operation: 'delete',
    entitySet: 'accounts',
    id: 'guid-here',
    instanceUrl: 'https://org.crm.dynamics.com',
    ifMatch: '*' // Conditional delete (optional)
  })
})
```

#### Associate Operation

```javascript
// Associate contact with account (many-to-many or many-to-one)
const response = await fetch('/api/power-platform/dataverse/operations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    operation: 'associate',
    entitySet: 'accounts',
    id: 'account-guid',
    instanceUrl: 'https://org.crm.dynamics.com',
    navigationProperty: 'contact_customer_accounts',
    relatedEntitySet: 'contacts',
    relatedId: 'contact-guid'
  })
})
```

#### Disassociate Operation

```javascript
// Remove contact from account
const response = await fetch('/api/power-platform/dataverse/operations', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    operation: 'disassociate',
    entitySet: 'accounts',
    id: 'account-guid',
    instanceUrl: 'https://org.crm.dynamics.com',
    navigationProperty: 'contact_customer_accounts',
    relatedId: 'contact-guid' // Omit for single-valued navigation properties
  })
})
```

### 3. Batch Endpoint

**POST** `/api/power-platform/dataverse/batch`

Execute up to 100 operations per portal request. Each input `id` must be unique.
Authentication, `portal.write` permission, and the portal's anti-CSRF protection
are required, including for a batch containing only reads.

```javascript
const response = await fetch('/api/power-platform/dataverse/batch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    instanceUrl: 'https://org.crm.dynamics.com',
    requests: [
      {
        id: 'req1',
        method: 'POST',
        url: '/accounts',
        headers: { 'Prefer': 'return=representation' },
        body: { name: 'Account 1' }
      },
      {
        id: 'req2',
        method: 'POST',
        url: '/accounts',
        body: { name: 'Account 2' }
      },
      {
        id: 'req3',
        method: 'GET',
        url: '/accounts?$select=name&$top=5'
      }
    ]
  })
})

const result = await response.json()
if (!response.ok || result.success !== true) {
  // Inspect result.responses; reconcile uncertain writes before retrying.
  throw new Error(result.error || 'Batch operations did not all succeed')
}
console.log(result.responses) // One correlated result per input, in input order
```

**Ordering and transaction contract:** The portal preserves its existing wire
order: all writes run first in one atomic changeset, followed by all GETs.
Relative order within each group is preserved, including write `Content-ID`
references such as `$req1`. Interleaving a GET before a write in the input does
not make that GET run before the write. Result order is the original input order,
not the wire order. The portal does not request `odata.continue-on-error` or
automatically retry writes.

**Response contract:** `success`, `totalRequests`, and `responses` remain.
Each result has the original `id`, zero-based `inputIndex`, `success`, `outcome`,
`status`, `statusText`, `headers`, and an optional successful `body`.

| Item outcome | Meaning |
| --- | --- |
| `success` | Confirmed successful GET, or a write in a fully confirmed committed changeset. |
| `failure` | A correlated inner HTTP failure. Its status is retained; raw provider errors are not returned. |
| `rolled_back` | No write committed because the changeset failed. If the error has no Content-ID, all writes have this outcome; which operation ran or failed is unknown. |
| `skipped` | Not executed after a known earlier failure. |
| `unparseable` | Execution/commit outcome cannot be verified: missing, malformed, contradictory, or uncorrelatable results. This is not proof of rollback. Reconcile records before retrying. |

`status` is the observed inner HTTP status, or `null` when no individual response
can be attributed. A rolled-back operation can retain an earlier 2xx status;
**use `success` and `outcome`, never status alone**. Bodies and resource headers
are omitted for all unsuccessful results. Successful headers use lowercase keys
and include only `content-type`, `etag`, `odata-entityid`, `location`, and
`odata-version`; credential-bearing and arbitrary upstream headers are excluded.

Aggregate `outcome` is `success`, `failure`, `partial` (some confirmed successful
items), or `unparseable` (at least one unknown item, even if others succeeded).
`changesetOutcome` is `not_present`, `committed`, `rolled_back`, or `unparseable`.
`changesetErrorStatus` retains the inner changeset error status even when no
Content-ID identifies the failing operation; otherwise it is `null`.
`upstreamStatus` reports the outer HTTP status when a response was received.

| Portal HTTP status | Meaning |
| --- | --- |
| 200 | Every input operation has a confirmed successful result. |
| 422 | Known operation failure, rollback, skipped operations, or partial completion. |
| 502 | Response could not establish all outcomes; never treat as successful or retry blindly. |
| 500 | Unexpected failure, including transport failure. After submission, results are marked `unparseable`. |
| 400 / 401 / 403 | Invalid input / authentication or delegated consent required / permission or CSRF rejection. |

**Compatibility:** Previously an outer success could return `success: true` with
missing/failed operations. Callers must now handle non-2xx batch outcomes and
nullable per-item statuses. `DataverseClient.batch()` still returns an array on
complete success, but throws `DataverseBatchError` otherwise. Its optional
`result` contains the validated response envelope for inspecting individual
outcomes; malformed envelopes do not produce a result. Do not automatically
resubmit the whole batch: writes can commit even when a later GET fails.

Audits record success only for complete success. Failure/partial/unknown outcomes
use a failure audit with aggregate status, changeset state, and outcome counts,
not provider bodies or record data. `changedFieldsCount` counts only confirmed
committed writes, so zero with `unparseable` does not prove no change occurred.

The [Dataverse batch contract](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/execute-batch-operations-using-web-api)
defines sequential execution, atomic changesets, Content-ID references, and
stop-on-error behavior.

### 4. Execute Endpoint (Actions & Functions)

**POST** `/api/power-platform/dataverse/execute`

Execute Dataverse actions and functions (built-in or custom).

#### Execute Function (Bound)

```javascript
// WhoAmI function
const response = await fetch('/api/power-platform/dataverse/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'function',
    name: 'WhoAmI',
    bound: false,
    instanceUrl: 'https://org.crm.dynamics.com'
  })
})

const result = await response.json()
console.log(result.data.UserId)
```

#### Execute Action (Unbound)

```javascript
// GrantAccess action
const response = await fetch('/api/power-platform/dataverse/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'action',
    name: 'GrantAccess',
    bound: false,
    instanceUrl: 'https://org.crm.dynamics.com',
    parameters: {
      Target: {
        '@odata.type': 'Microsoft.Dynamics.CRM.account',
        accountid: 'guid-here'
      },
      PrincipalAccess: {
        AccessMask: 'ReadAccess',
        Principal: {
          '@odata.type': 'Microsoft.Dynamics.CRM.systemuser',
          systemuserid: 'user-guid'
        }
      }
    }
  })
})
```

#### Execute Custom Action (Bound)

```javascript
// Custom action bound to account
const response = await fetch('/api/power-platform/dataverse/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    type: 'action',
    name: 'new_CustomAccountAction',
    bound: true,
    entitySet: 'accounts',
    recordId: 'account-guid',
    instanceUrl: 'https://org.crm.dynamics.com',
    parameters: {
      InputParameter: 'value'
    }
  })
})

const result = await response.json()
console.log(result.data.OutputParameter)
```

## TypeScript Client Library

For type-safe operations, use the provided client library:

```typescript
import { createDataverseClient } from '@/lib/dataverseClient'

const client = createDataverseClient('https://org.crm.dynamics.com')

// Query
const accounts = await client.query('accounts', {
  select: 'name,revenue',
  filter: 'revenue gt 100000',
  orderby: 'revenue desc',
  top: 10
})

// Create
const { id } = await client.create('accounts', {
  name: 'Contoso Ltd',
  revenue: 5000000
})

// Update
await client.update('accounts', id, {
  revenue: 6000000
})

// Delete
await client.delete('accounts', id)

// Update single property
await client.updateProperty('contacts', contactId, 'telephone1', '555-0105')

// Retrieve single property
const phone = await client.retrieveProperty('contacts', contactId, 'telephone1')

// Associate
await client.associate('accounts', accountId, {
  navigationProperty: 'contact_customer_accounts',
  relatedEntitySet: 'contacts',
  relatedId: contactId
})

// Batch
const responses = await client.batch([
  { id: '1', method: 'POST', url: '/accounts', body: { name: 'Account 1' } },
  { id: '2', method: 'POST', url: '/contacts', body: { firstname: 'John' } }
])

// Execute
const result = await client.execute({
  type: 'function',
  name: 'WhoAmI',
  bound: false
})
```

## Usage Examples

### Example 1: Create Account with Related Contact (Deep Insert)

```typescript
const client = createDataverseClient(instanceUrl)

// Create account with primary contact and related tasks in one operation
const { id: accountId } = await client.create('accounts', {
  name: 'Fourth Coffee',
  primarycontactid: {
    firstname: 'Susie',
    lastname: 'Curtis',
    jobtitle: 'Coffee Master',
    annualincome: 48000,
    Contact_Tasks: [
      {
        subject: 'Sign invoice',
        description: 'Invoice #12321',
        scheduledstart: '2023-04-19T03:00:00+07:00',
        scheduledend: '2023-04-19T04:00:00+07:00'
      },
      {
        subject: 'Setup new display',
        description: 'Theme is - Spring is in the air',
        scheduledstart: '2023-04-20T03:00:00+07:00',
        scheduledend: '2023-04-20T04:00:00+07:00'
      }
    ]
  }
})
```

### Example 2: Bulk Create with Batch

```typescript
const client = createDataverseClient(instanceUrl)

const contacts = [
  { firstname: 'John', lastname: 'Smith' },
  { firstname: 'Jane', lastname: 'Doe' },
  { firstname: 'Bob', lastname: 'Johnson' }
]

const requests = contacts.map((contact, i) => ({
  id: `contact-${i}`,
  method: 'POST' as const,
  url: '/contacts',
  body: contact
}))

const responses = await client.batch(requests)
console.log(`Created ${responses.filter(r => r.status === 201).length} contacts`)
```

### Example 3: Query with Expand

```typescript
const client = createDataverseClient(instanceUrl)

const accounts = await client.query('accounts', {
  select: 'name,revenue',
  expand: 'primarycontactid($select=fullname,emailaddress1)',
  filter: 'statecode eq 0', // Active accounts
  orderby: 'createdon desc',
  top: 25
})

accounts.forEach(account => {
  console.log(`${account.name} - ${account.primarycontactid?.fullname}`)
})
```

### Example 4: Update Single Property

```typescript
const client = createDataverseClient(instanceUrl)

// Update just the phone number (more efficient than PATCH for single properties)
await client.updateProperty('contacts', contactId, 'telephone1', '555-0105')

// Retrieve just the phone number
const phone = await client.retrieveProperty('contacts', contactId, 'telephone1')
console.log(`Phone: ${phone}`)
```

### Example 5: Create with Association

```typescript
const client = createDataverseClient(instanceUrl)

// Create account and associate with existing contact in one operation
const { id: accountId } = await client.create('accounts', {
  name: 'Contoso Ltd',
  telephone1: '555-5555',
  'primarycontactid@odata.bind': `/contacts(${existingContactId})`
})
```

## All Sample Operations Covered

This implementation includes **all operations** from the [Web API Basic Operations Sample](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/web-api-basic-operations-sample):

### ✅ Section 1: Basic Create and Update
- Create contact record
- Update contact with multiple properties (PATCH)
- Retrieve contact with selected properties
- Update single property (PUT)
- Retrieve single property

### ✅ Section 2: Create with Association
- Create account with existing contact association using `@odata.bind`
- Retrieve account with expanded primary contact

### ✅ Section 3: Create Related Rows (Deep Insert)
- Create account with new primary contact and related tasks in one operation
- Retrieve account with expanded related data

### ✅ Section 4: Associate and Disassociate
- Associate existing records (1:N and N:N relationships)
- Retrieve associated records
- Disassociate records

### ✅ Section 5: Delete
- Delete records

## Security Considerations

1. **Authentication**: All endpoints require authentication via NextAuth session
2. **Token Acquisition**: Automatically handles Dataverse token acquisition with proper scopes
3. **Input Validation**: Entity set names are validated against allowed characters
4. **Error Handling**: Comprehensive error responses with helpful hints
5. **Conditional Operations**: Support for ETags to prevent conflicts

## Error Handling

All endpoints return consistent error responses:

```json
{
  "error": "Error message",
  "status": 400,
  "details": {
    "message": "Detailed error information"
  }
}
```

Common status codes:
- `400` - Bad request (validation error)
- `401` - Unauthorized (no session or token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not found (entity/record doesn't exist)
- `412` - Precondition failed (ETag mismatch)
- `500` - Internal server error

## Performance Tips

1. **Use Batch Operations**: Combine multiple writes into a single batch
2. **Use $select**: Request only needed columns
3. **Limit Results**: Use `$top` to avoid large responses
4. **Use Upsert**: Combine update/create logic for efficiency
5. **Cache Tokens**: Token acquisition is cached automatically
6. **Parallel Reads**: Query operations can be parallelized

## API Quotas

The Dataverse Web API has limits:
- **API Limits**: 6,000 requests per 5 minutes per user
- **Batch Limits**: The portal accepts up to 100 operations per batch
- **Page Size**: Maximum 5,000 records per request

Monitor usage and use batch operations to stay within limits.

## References

- [Dataverse Web API Reference](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/perform-operations-web-api)
- [Query Data](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/query/overview)
- [Create Records](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/create-entity-web-api)
- [Update/Delete](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/update-delete-entities-using-web-api)
- [Associate/Disassociate](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/associate-disassociate-entities-using-web-api)
- [Batch Operations](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/execute-batch-operations-using-web-api)
- [Actions & Functions](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/use-web-api-actions)
