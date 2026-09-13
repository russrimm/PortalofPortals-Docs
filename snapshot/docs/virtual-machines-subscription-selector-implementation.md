# Virtual Machines Subscription Selector Implementation

**Date**: 2025-02-01  
**Status**: ✅ Complete

## Overview
Fixed the `/azure/virtual-machines` page to support subscription selection and work without requiring `AZURE_SUBSCRIPTION_ID` environment variable configuration. The page now defaults to querying all subscriptions across the tenant, matching the behavior of the resource explorer.

## Scoped action safety

The current `VirtualMachinesClient.tsx` selects targets by their full Azure Resource
Manager ("ARM") identity, including subscription, resource group, and VM name.
Start, deallocate, and delete confirmations show that exact target snapshot;
delete retains its second confirmation. An invalid or mismatched identity disables
selection and actions for that row.

Changing subscriptions resets the list, filters, selection, pending confirmation,
and action results. Stale list responses and refresh timers cannot repopulate the
new scope. A scope change during a batch cancels requests not yet sent; it cannot
recall requests already submitted.
Pending requests remain locked by full identity when you return to a subscription
or switch to the all-subscription view.

Action results remain visible after refresh. Accepted requests are removed from
selection, while failed targets remain selected for a reviewed retry. A network
failure with no response, a request timeout, or a server/gateway error is labeled
as an unknown outcome and is not automatically
selected for retry: refresh and check the VM before submitting it again. An
accepted request means Azure accepted the operation, not that it has completed.
Server-side delegated authorization remains unchanged.

After confirming Start, the row button shows **Starting** and stays disabled
through request acceptance and subsequent status refreshes, including cached
stopped/deallocated responses. The page checks status every 10 seconds while an
accepted start is pending in the current subscription view; a reported running
state restores the normal Stop action. Provider-reported starting states also
show **Starting**, not Stop. A rejected request restores Start. A reported
provisioning failure or five minutes without confirmation ends local tracking
with a message to check the VM before retrying; neither is presented as success.

### Fixture-only regression tests

Run `pnpm exec vitest run tests/unit/vm-targets.test.ts --maxWorkers=1` for identity
validation. For browser scenarios, use
`pnpm exec playwright test --config=playwright.vm-fixtures.config.ts`.
This dedicated configuration never starts a server or invokes the environment-linking
development wrapper. It requires an already-running isolated development server
bound to `127.0.0.1`, with the same process-only ephemeral `AUTH_SECRET` and
`PORTAL360_ALLOW_SYNTHETIC_AUTH=1` in the server and test processes. Set `BASE_URL`
in both processes if not using `http://127.0.0.1:3144`. Never load real environment
files or provider credentials for these fixtures. The tests keep synthetic session
cookies in memory and intercept application mutations and tenant API requests.

## Problem Statement
The virtual machines page was throwing an error when `AZURE_SUBSCRIPTION_ID` was not configured:
```
AZURE_SUBSCRIPTION_ID not configured
```

This prevented the page from loading even when the user had access to multiple subscriptions through their Azure credentials.

## Solution Architecture

### 1. API Route Modifications (`src/app/api/azure/virtual-machines/route.js`)

#### Parameter Handling
Changed from requiring environment variable to accepting optional query parameter:

**Before**:
```javascript
const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID
if (!subscriptionId) {
  return NextResponse.json(
    { error: 'AZURE_SUBSCRIPTION_ID not configured' },
    { status: 500 }
  )
}
```

**After**:
```javascript
const subscriptionId = searchParams.get('subscriptionId')
console.log('[Azure VMs] Fetching virtual machines via Resource Graph', {
  subscriptionId: subscriptionId || 'all subscriptions',
  statusOnly: expand === 'false' ? 'true' : 'false',
  expand
})
```

#### Resource Graph Query
Made the `subscriptions` parameter conditional in Azure Resource Graph requests:

**Before**:
```javascript
body: JSON.stringify({
  subscriptions: [subscriptionId],
  query: query
})
```

**After**:
```javascript
const requestBody = { query }
if (subscriptionId) {
  requestBody.subscriptions = [subscriptionId]
}

body: JSON.stringify(requestBody)
```

**Key Insight**: When the `subscriptions` array is omitted from Azure Resource Graph requests, Azure automatically queries across all subscriptions accessible to the authenticated user within the tenant.

### 2. Client Component Updates (`src/app/azure/virtual-machines/page.jsx`)

#### State Management
Added subscription selection state:
```javascript
const [subscriptions, setSubscriptions] = useState([])
const [selectedSubscription, setSelectedSubscription] = useState('')
```

#### Subscription Fetching
Added effect to load available subscriptions on mount:
```javascript
useEffect(() => {
  let cancelled = false
  fetch('/api/azure/subscriptions')
    .then(r => r.json())
    .then(d => {
      if (!cancelled) setSubscriptions(Array.isArray(d?.value) ? d.value : [])
    })
    .catch(() => {})
  return () => { cancelled = true }
}, [])
```

#### Refetch on Subscription Change
Modified authentication effect to also watch for subscription changes:
```javascript
useEffect(() => {
  if (status === 'unauthenticated') {
    signIn('azure-ad')
    return
  }

  if (status === 'authenticated') {
    fetchVirtualMachines()
  }
}, [status, selectedSubscription]) // Added selectedSubscription dependency
```

#### Dynamic URL Construction
Updated fetch logic to include subscription parameter only when selected:
```javascript
const fetchVirtualMachines = async () => {
  try {
    setLoading(true)
    setError(null)

    const url = selectedSubscription 
      ? `/api/azure/virtual-machines?expand=instanceView&subscriptionId=${encodeURIComponent(selectedSubscription)}`
      : '/api/azure/virtual-machines?expand=instanceView'
    
    const response = await fetch(url)
    // ... rest of fetch logic
  }
}
```

#### UI Enhancement
Added subscription selector dropdown between search and status filter:
```jsx
<select
  value={selectedSubscription}
  onChange={(e) => setSelectedSubscription(e.target.value)}
  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm min-w-[200px]"
>
  <option value="">All subscriptions (tenant)</option>
  {subscriptions.map(s => (
    <option key={s.subscriptionId} value={s.subscriptionId}>{s.displayName}</option>
  ))}
</select>
```

## Technical Details

### Azure Resource Graph Behavior
- **With subscriptions parameter**: `{ subscriptions: ["abc-123"], query: "..." }`  
  Queries only the specified subscriptions
  
- **Without subscriptions parameter**: `{ query: "..." }`  
  Queries all subscriptions the user has access to within the tenant

This behavior is consistent across Azure Resource Graph API and is leveraged to provide tenant-wide querying without explicit subscription enumeration.

### Error Handling Pattern
The API route now handles both scenarios gracefully:
1. **Specific subscription requested**: Includes subscription ID in Resource Graph query
2. **All subscriptions requested**: Omits subscriptions parameter, allowing Azure to query tenant-wide

### Consistency with Resource Explorer
This implementation follows the same pattern used in the resource explorer (`src/app/azure/AzureResourcesClient.jsx`):
- Same subscription fetching logic
- Same "All subscriptions (tenant)" dropdown option
- Same conditional parameter passing to APIs

## Testing Results

### Dev Server Output
```
[Azure VMs] Fetching virtual machines via Resource Graph {
  subscriptionId: 'all subscriptions',
  statusOnly: 'false',
  expand: 'instanceView'
}
[Azure VMs] Success: { vmCount: 12 }
GET /api/azure/virtual-machines?expand=instanceView 200 in 1877ms
```

### Verified Behaviors
✅ Page loads without `AZURE_SUBSCRIPTION_ID` environment variable  
✅ Subscription dropdown populates from `/api/azure/subscriptions`  
✅ Default selection shows "All subscriptions (tenant)"  
✅ VMs load from all accessible subscriptions when no specific subscription selected  
✅ Selecting specific subscription filters VMs to that subscription  
✅ No TypeScript/ESLint errors  
✅ Consistent UX with resource explorer page

## Related Changes

### Previous Session
This fix builds on the earlier tenant-wide query fix for the resource explorer:
- **File**: `src/app/api/resource-graph/route.js`
- **Pattern**: Omitting `subscriptions` parameter for tenant-wide queries
- **Issue Fixed**: "SubscriptionsContainInvalidGuids" error when selecting "All subscriptions (tenant)"

See: `docs/bugfix-infinite-render-loop.md` for related resource explorer improvements

## Benefits

1. **Removes Environment Dependency**: Page works without `AZURE_SUBSCRIPTION_ID` configuration
2. **Improves Discoverability**: Users can see VMs across all their subscriptions
3. **Consistent UX**: Matches the subscription selection pattern used in resource explorer
4. **Flexible Filtering**: Users can view all VMs or narrow to specific subscriptions
5. **Better Error Handling**: No blocking errors when env var is missing

## Files Modified

1. `src/app/api/azure/virtual-machines/route.js`
   - Lines 157-184: Made subscriptionId optional from query params
   - Lines 192-210: Conditional subscriptions parameter in Resource Graph request

2. `src/app/azure/virtual-machines/page.jsx`
   - Lines 9-48: Added subscription state and fetching logic
   - Lines 53-58: Added dependency on selectedSubscription for refetching
   - Lines 69-76: Dynamic URL construction with optional subscription parameter
   - Lines 390-410: Added subscription selector dropdown in UI

## Future Enhancements

Consider applying this pattern to other Azure resource pages:
- Azure Kubernetes Service (AKS) clusters
- App Services
- SQL Databases
- Storage Accounts
- Any other resource-specific pages that currently require `AZURE_SUBSCRIPTION_ID`

## References

- Azure Resource Graph API: https://learn.microsoft.com/en-us/rest/api/azure-resourcegraph/
- Next.js App Router: https://nextjs.org/docs/app
- Related fix: `docs/bugfix-infinite-render-loop.md`
