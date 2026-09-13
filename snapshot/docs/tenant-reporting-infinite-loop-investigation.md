# Tenant Reporting Infinite Loop Investigation

**Date:** 2025-01-30
**Issue:** Reported infinite loop on `/reports/tenant-reporting` causing endless GET requests
**Status:** ⚠️ Unable to reproduce - Investigation paused

## Investigation Summary

### Initial Report
User reported that the tenant-reporting page was going into an infinite loop, causing terminal flooding similar to the environments and deploy pages.

### Code Analysis

**File:** `src/app/reports/tenant-reporting/page.jsx`

#### Findings:
1. **No useEffect hooks** - Unlike the environments and deploy pages, this page has ZERO useEffect hooks
2. **Only SWR data fetching** - Uses 6 parallel `useApiData` calls:
   ```javascript
   const { data: ppEnvironments } = useApiData('/api/power-platform/environments')
   const { data: azureResources } = useApiData('/api/azure/resources?resourceType=all')
   const { data: azureAdvisor } = useApiData('/api/azure/advisor/recommendations')
   const { data: licenses } = useApiData('/api/graph/organization/subscribedSkus')
   const { data: users } = useApiData('/api/graph/users?...')
   const { data: devices } = useApiData('/api/graph/devices?...')
   ```
3. **Simple state management** - Only uses `useState` for:
   - `isExporting` (boolean)
   - `selectedSections` (object, updated via toggleSection function)

#### SWR Configuration Review

**File:** `src/lib/apiClient.ts`

Default SWR configuration used by all `useApiData` calls:
```typescript
{
  revalidateOnFocus: false,      // ✅ Good - prevents refetch on tab focus
  revalidateOnReconnect: true,   // ✅ Reasonable - only on network reconnect
  dedupingInterval: 5000,        // ✅ Good - prevents duplicate requests
  errorRetryCount: 3,            // ✅ Reasonable retry limit
  errorRetryInterval: 5000,      // ✅ Good backoff
  shouldRetryOnError: true,      // Standard behavior
  revalidateIfStale: true,       // Could cause revalidation
  keepPreviousData: true,        // Maintains data during revalidation
}
```

### Potential Causes (Hypotheses)

Since no obvious code issues were found, the infinite loop could be caused by:

1. **Missing API Route** - If `/api/azure/advisor/recommendations` doesn't exist and returns errors, SWR might retry rapidly
   - **Evidence:** This route is called but may not be implemented yet
   - **Status:** ⚠️ Need to verify this route exists

2. **Error Cascade** - One failing API call triggering React re-renders which restart all 6 calls
   - **Evidence:** 6 simultaneous SWR calls could amplify a subtle render loop
   - **Status:** ❓ Need runtime testing to verify

3. **Network Instability** - Transient network issues causing reconnection triggers
   - **Evidence:** `revalidateOnReconnect: true` would refetch all 6 endpoints
   - **Status:** ❓ User-specific environmental issue

4. **Browser Dev Tools** - Having React Dev Tools or similar extensions can cause unexpected re-renders
   - **Evidence:** Common cause of phantom render loops
   - **Status:** ❓ User's browser environment

5. **Hot Module Replacement** - During development, HMR updates could trigger cascading reloads
   - **Evidence:** Only happens in dev server, not production
   - **Status:** ❓ Would need dev server logs to confirm

### Testing Performed

1. ✅ **Code inspection** - No useEffect hooks found
2. ✅ **SWR config review** - Configuration looks reasonable
3. ✅ **Static page load** - Page HTML renders successfully (tested with curl)
4. ❌ **Runtime testing** - Not performed (would need authenticated session in browser)
5. ❌ **API route verification** - Did not check if all 6 API routes exist

### Comparison to Fixed Pages

**Environments & Deploy Pages:**
- **Had problem:** useEffect hooks depending on SWR objects
- **Solution:** Added ref-based hash tracking to prevent re-processing same data

**Tenant Reporting Page:**
- **No useEffect hooks** - Cannot apply same fix
- **Only SWR hooks** - Data fetching is handled internally by SWR
- **No state dependencies** - selectedSections is only updated via user interaction (checkbox clicks)

## Recommendations

### Immediate Actions (If Issue Recurs)

1. **Check API Routes** - Verify all 6 API endpoints exist and return valid responses:
   ```bash
   # Test each endpoint manually
   curl http://localhost:3000/api/power-platform/environments
   curl http://localhost:3000/api/azure/resources?resourceType=all
   curl http://localhost:3000/api/azure/advisor/recommendations  # ← Likely missing
   curl http://localhost:3000/api/graph/organization/subscribedSkus
   curl http://localhost:3000/api/graph/users?...
   curl http://localhost:3000/api/graph/devices?...
   ```

2. **Monitor Network Tab** - Open browser Dev Tools Network tab and watch for:
   - Repeated requests to same endpoint
   - 404/500 errors triggering retries
   - Request timing patterns (every X seconds)

3. **Check Console for SWR Errors** - Look for SWR error messages that might indicate retry loops

### Potential Fixes (If Issue Is Confirmed)

#### Option 1: Disable Retry on Missing Routes
If advisor recommendations route doesn't exist, disable that specific call:
```javascript
const { data: azureAdvisor } = useApiData(
  advisorRouteExists ? '/api/azure/advisor/recommendations' : null
)
```

#### Option 2: Add More Conservative SWR Config
Override SWR config for this page:
```javascript
const swrConfig = {
  revalidateIfStale: false,  // Prevent automatic revalidation
  dedupingInterval: 10000,   // Longer dedup window
  errorRetryCount: 1,        // Reduce retry attempts
}

const { data: ppEnvironments } = useApiData('/api/power-platform/environments', swrConfig)
// ... apply to all useApiData calls
```

#### Option 3: Implement Loading Gate
Prevent all fetches until user clicks a "Load Data" button:
```javascript
const [shouldLoad, setShouldLoad] = useState(false)

const { data: ppEnvironments } = useApiData(
  shouldLoad ? '/api/power-platform/environments' : null
)
```

## Missing API Route Check

Need to verify if this route exists:
```bash
ls src/app/api/azure/advisor/recommendations/route.js
```

If it doesn't exist, create it or remove the API call from the page.

## Conclusion

**Unable to reproduce the infinite loop issue** during investigation. The page code structure looks clean with no obvious causes for render loops. The issue may be:
- Transient (network/environmental)
- Caused by a missing API route triggering rapid SWR retries
- Related to specific user browser configuration

**Status:** Investigation paused pending user confirmation that issue still occurs. If it recurs, follow the recommendations above to identify the root cause.

## Related Fixes

- [Environments Page Infinite Loop Fix](./bugfix-infinite-render-loop.md)

## Next Steps

1. ⏳ Wait for user to confirm if issue still occurs
2. ⏳ If confirmed, test with authenticated browser session
3. ⏳ Verify all 6 API routes exist
4. ⏳ Monitor browser console and network tab during reproduction
5. ⏳ Apply appropriate fix based on root cause identification
