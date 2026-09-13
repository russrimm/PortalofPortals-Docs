# Web API Basic Operations - Implementation Checklist

This document confirms that **all operations** from the [Web API Basic Operations Sample](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/web-api-basic-operations-sample) are fully implemented.

## ✅ Section 1: Basic Create and Update Operations

### 1.1 Create Contact
- **Operation**: POST `/api/data/v9.2/contacts`
- **Implementation**: ✅ `/api/power-platform/dataverse/operations` with `operation: 'create'`
- **Example**:
```typescript
await client.create('contacts', {
  firstname: 'Rafel',
  lastname: 'Shillo'
})
```

### 1.2 Update Contact (Multiple Properties)
- **Operation**: PATCH `/api/data/v9.2/contacts(id)`
- **Implementation**: ✅ `/api/power-platform/dataverse/operations` with `operation: 'update'`
- **Example**:
```typescript
await client.update('contacts', id, {
  annualincome: 80000,
  jobtitle: 'Junior Developer'
})
```

### 1.3 Retrieve Contact with Selected Properties
- **Operation**: GET `/api/data/v9.2/contacts(id)?$select=...`
- **Implementation**: ✅ `/api/power-platform/dataverse/operations` with `operation: 'retrieve'`
- **Also Available**: `/api/power-platform/dataverse/query` for multiple records
- **Example**:
```typescript
await client.retrieve('contacts', id, {
  select: 'fullname,annualincome,jobtitle,description'
})
```

### 1.4 Update Single Property
- **Operation**: PUT `/api/data/v9.2/contacts(id)/telephone1`
- **Implementation**: ✅ `/api/power-platform/dataverse/operations` with `operation: 'updateProperty'`
- **Example**:
```typescript
await client.updateProperty('contacts', id, 'telephone1', '555-0105')
```

### 1.5 Retrieve Single Property
- **Operation**: GET `/api/data/v9.2/contacts(id)/telephone1`
- **Implementation**: ✅ `/api/power-platform/dataverse/operations` with `operation: 'retrieveProperty'`
- **Example**:
```typescript
const phone = await client.retrieveProperty('contacts', id, 'telephone1')
```

---

## ✅ Section 2: Create with Association

### 2.1 Create Account with Existing Contact Association
- **Operation**: POST `/api/data/v9.2/accounts` with `@odata.bind`
- **Implementation**: ✅ `/api/power-platform/dataverse/operations` with `operation: 'create'`
- **Example**:
```typescript
await client.create('accounts', {
  name: 'Contoso Ltd',
  telephone1: '555-5555',
  'primarycontactid@odata.bind': `/contacts(${contactId})`
})
```

### 2.2 Retrieve Account with Expanded Contact
- **Operation**: GET `/api/data/v9.2/accounts(id)?$expand=primarycontactid`
- **Implementation**: ✅ `/api/power-platform/dataverse/query` or retrieve operation
- **Example**:
```typescript
await client.retrieve('accounts', id, {
  select: 'name',
  expand: 'primarycontactid($select=fullname,jobtitle,annualincome)'
})
```

---

## ✅ Section 3: Create Related Table Rows (Deep Insert)

### 3.1 Create Account with New Contact and Tasks
- **Operation**: POST `/api/data/v9.2/accounts` with nested objects
- **Implementation**: ✅ `/api/power-platform/dataverse/operations` with `operation: 'create'`
- **Example**:
```typescript
await client.create('accounts', {
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

### 3.2 Retrieve Created Records with Expansion
- **Operation**: GET with `$expand` on collections
- **Implementation**: ✅ `/api/power-platform/dataverse/query`
- **Example**:
```typescript
await client.query('contacts', {
  select: 'fullname',
  expand: 'Contact_Tasks($select=subject,description,scheduledstart,scheduledend)',
  filter: `contactid eq ${contactId}`
})
```

---

## ✅ Section 4: Associate and Disassociate Existing Table Rows

### 4.1 Associate Contact to Account (Collection-Valued)
- **Operation**: POST `/api/data/v9.2/accounts(id)/contact_customer_accounts/$ref`
- **Implementation**: ✅ `/api/power-platform/dataverse/operations` with `operation: 'associate'`
- **Example**:
```typescript
await client.associate('accounts', accountId, {
  navigationProperty: 'contact_customer_accounts',
  relatedEntitySet: 'contacts',
  relatedId: contactId
})
```

### 4.2 Retrieve Associated Records
- **Operation**: GET `/api/data/v9.2/accounts(id)/contact_customer_accounts`
- **Implementation**: ✅ `/api/power-platform/dataverse/query`
- **Example**:
```typescript
await client.query('contacts', {
  filter: `_parentcustomerid_value eq ${accountId}`,
  select: 'fullname,jobtitle'
})
```

### 4.3 Disassociate Contact from Account
- **Operation**: DELETE `/api/data/v9.2/accounts(id)/contact_customer_accounts(contactId)/$ref`
- **Implementation**: ✅ `/api/power-platform/dataverse/operations` with `operation: 'disassociate'`
- **Example**:
```typescript
await client.disassociate('accounts', accountId, {
  navigationProperty: 'contact_customer_accounts',
  relatedId: contactId
})
```

### 4.4 Associate Security Role to User (Many-to-Many)
- **Operation**: POST `/api/data/v9.2/systemusers(id)/systemuserroles_association/$ref`
- **Implementation**: ✅ Same as 4.1 - supports N:N relationships
- **Example**:
```typescript
await client.associate('systemusers', userId, {
  navigationProperty: 'systemuserroles_association',
  relatedEntitySet: 'roles',
  relatedId: roleId
})
```

### 4.5 Disassociate Security Role from User
- **Operation**: DELETE `/api/data/v9.2/systemusers(id)/systemuserroles_association(roleId)/$ref`
- **Implementation**: ✅ Same as 4.3 - supports N:N relationships
- **Example**:
```typescript
await client.disassociate('systemusers', userId, {
  navigationProperty: 'systemuserroles_association',
  relatedId: roleId
})
```

---

## ✅ Section 5: Delete Table Rows

### 5.1 Delete Contact
- **Operation**: DELETE `/api/data/v9.2/contacts(id)`
- **Implementation**: ✅ `/api/power-platform/dataverse/operations` with `operation: 'delete'`
- **Example**:
```typescript
await client.delete('contacts', id)
```

### 5.2 Delete Multiple Records
- **Operation**: Multiple DELETE requests
- **Implementation**: ✅ Use batch operations for efficiency
- **Example**:
```typescript
await client.batch([
  { id: '1', method: 'DELETE', url: `/contacts(${id1})` },
  { id: '2', method: 'DELETE', url: `/accounts(${id2})` }
])
```

---

## 🎯 Additional Capabilities (Beyond Basic Sample)

### Batch Operations
- **Endpoint**: `/api/power-platform/dataverse/batch`
- **Supports**: Up to 100 operations with unique IDs in one portal request
- **Features**: Transactional changesets, mixed read/write
- **Outcomes**: Writes run first, then reads. `client.batch()` returns input-ordered
  results only on complete success; otherwise it throws `DataverseBatchError`.
  Inspect its optional `result` for failure, rollback, skipped, or unparseable
  items. See the [batch response contract](dataverse-web-api-operations.md).
- **Example**:
```typescript
await client.batch([
  { id: '1', method: 'POST', url: '/accounts', body: { name: 'A1' } },
  { id: '2', method: 'POST', url: '/contacts', body: { firstname: 'John' } },
  { id: '3', method: 'GET', url: '/accounts?$top=10' }
])
```

### Upsert Operation
- **Endpoint**: `/api/power-platform/dataverse/operations` with `operation: 'upsert'`
- **Features**: Update if exists, create if not
- **Example**:
```typescript
await client.upsert('accounts', knownId, {
  name: 'Updated or New Account',
  revenue: 1000000
})
```

### Execute Actions and Functions
- **Endpoint**: `/api/power-platform/dataverse/execute`
- **Supports**: Bound/unbound actions and functions
- **Example**:
```typescript
// WhoAmI function
await client.execute({
  type: 'function',
  name: 'WhoAmI',
  bound: false
})

// Custom action
await client.execute({
  type: 'action',
  name: 'new_CustomAction',
  bound: true,
  entitySet: 'accounts',
  recordId: accountId,
  parameters: { InputParam: 'value' }
})
```

### Conditional Operations
- **ETag Support**: If-Match and If-None-Match headers
- **Use Cases**: Optimistic concurrency, prevent overwrites
- **Example**:
```typescript
// Get record with ETag
const record = await client.retrieve('accounts', id)
const etag = record['@odata.etag']

// Update only if not modified
await client.update('accounts', id, { revenue: 6000000 }, { ifMatch: etag })
```

---

## 📊 Implementation Summary

| Sample Section | Operations | Status |
|----------------|-----------|--------|
| Section 1: Basic CRUD | 5 operations | ✅ 100% |
| Section 2: Create with Association | 2 operations | ✅ 100% |
| Section 3: Deep Insert | 2 operations | ✅ 100% |
| Section 4: Associate/Disassociate | 5 operations | ✅ 100% |
| Section 5: Delete | 2 operations | ✅ 100% |
| **Total** | **16 operations** | **✅ 100%** |

### Additional Capabilities
- ✅ Batch operations (up to 100 operations per portal request)
- ✅ Upsert
- ✅ Actions & Functions
- ✅ Conditional operations
- ✅ TypeScript client library

---

## 🧪 Testing the Implementation

### Complete Sample Flow

```typescript
import { createDataverseClient } from '@/lib/dataverseClient'

const client = createDataverseClient('https://org.crm.dynamics.com')

// Section 1: Basic CRUD
const { id: contactId } = await client.create('contacts', {
  firstname: 'Rafel',
  lastname: 'Shillo'
})

await client.update('contacts', contactId, {
  annualincome: 80000,
  jobtitle: 'Junior Developer'
})

const contact = await client.retrieve('contacts', contactId, {
  select: 'fullname,annualincome,jobtitle'
})

await client.updateProperty('contacts', contactId, 'telephone1', '555-0105')
const phone = await client.retrieveProperty('contacts', contactId, 'telephone1')

// Section 2: Create with Association
const { id: accountId } = await client.create('accounts', {
  name: 'Contoso Ltd',
  'primarycontactid@odata.bind': `/contacts(${contactId})`
})

// Section 3: Deep Insert
const { id: account2Id } = await client.create('accounts', {
  name: 'Fourth Coffee',
  primarycontactid: {
    firstname: 'Susie',
    lastname: 'Curtis',
    Contact_Tasks: [
      { subject: 'Task 1' },
      { subject: 'Task 2' }
    ]
  }
})

// Section 4: Associate/Disassociate
await client.associate('accounts', accountId, {
  navigationProperty: 'contact_customer_accounts',
  relatedEntitySet: 'contacts',
  relatedId: contactId
})

await client.disassociate('accounts', accountId, {
  navigationProperty: 'contact_customer_accounts',
  relatedId: contactId
})

// Section 5: Delete
await client.delete('contacts', contactId)
await client.delete('accounts', accountId)
await client.delete('accounts', account2Id)
```

---

## 📚 Documentation

- [Full Documentation](./dataverse-web-api-operations.md)
- [Quick Reference](./dataverse-api-quick-reference.md)
- [Microsoft Docs - Web API Basic Operations Sample](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/web-api-basic-operations-sample)

---

## ✅ Conclusion

**All operations from the Web API Basic Operations Sample are fully implemented and available through:**

1. **REST API Endpoints** - Direct HTTP access
2. **TypeScript Client** - Type-safe wrapper
3. **Batch Support** - Efficient bulk operations
4. **Additional Features** - Upsert, actions, functions, and more

The implementation is production-ready and follows Microsoft's official documentation and best practices.
