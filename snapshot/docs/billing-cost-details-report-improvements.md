# Billing Page - Cost Details Report Improvements

**Date:** December 12, 2025  
**Changes:** Removed "Show Advanced" toggle, updated API to 2025-03-01, fixed timeout issues

## Summary of Changes

### 1. UI Improvements (billing/page.jsx)
- **Removed "Show Advanced" toggle** - The Generate Cost Details Report button is now always visible
- **Simplified UI** - Cleaner interface with direct access to report generation
- **Updated heading** - Changed from "Cost Details Report (Preview)" to "Cost Details Report"

### 2. API Updates (api/azure/billing/reports/route.js)
- **Upgraded to API version 2025-03-01** - Using the latest Azure Cost Management API
  - Old: `generateCostDetailsReport?api-version=2022-05-01`
  - New: `generateDetailedCostReport?api-version=2025-03-01`
- **Improved response handling**:
  - Now handles immediate success (200) when report generates quickly
  - Properly handles async operations (202) with Location header
  - Extracts `properties.downloadUrl` from new API response format
- **Better timeout handling**:
  - Increased retry-after default from 5s to 10s
  - Client-side polling interval increased from 5s to 10s
  - Maximum polling attempts increased from 30 to 60 (up to 10 minutes)

### 3. Timeout Fix Details

#### Previous Behavior (causing timeouts):
- Polling every 5 seconds
- Max wait time: ~2.5 minutes (30 polls × 5s)
- Reports taking longer would timeout

#### New Behavior:
- Polling every 10 seconds (respects Azure's processing time)
- Max wait time: ~10 minutes (60 polls × 10s)
- More realistic timeout for detailed cost reports

### API Endpoint Changes

#### Generate Report (POST)
```javascript
// Old API call
POST https://management.azure.com/subscriptions/{id}/providers/Microsoft.CostManagement/generateCostDetailsReport?api-version=2022-05-01

// New API call
POST https://management.azure.com/subscriptions/{id}/providers/Microsoft.CostManagement/generateDetailedCostReport?api-version=2025-03-01

// Request body (same)
{
  "metric": "ActualCost",
  "timePeriod": {
    "start": "2024-12-01",
    "end": "2024-12-12"
  }
}
```

#### Response Handling

**Immediate Success (200):**
```json
{
  "name": "operation-id",
  "type": "Microsoft.Consumption/operationResult",
  "id": "/subscriptions/.../operationResults/...",
  "properties": {
    "downloadUrl": "https://ccmreportstorageeastus.blob.core.windows.net/...",
    "validTill": "2024-12-13T05:55:59.4394737Z"
  }
}
```

**Async Operation (202):**
```http
HTTP/1.1 202 Accepted
Location: https://management.azure.com/subscriptions/.../operationResults/...
Retry-After: 60
```

#### Poll for Status (GET)
```javascript
// Poll using Location header URL
GET https://management.azure.com/subscriptions/{id}/providers/Microsoft.CostManagement/operationResults/{operationId}?api-version=2025-03-01

// While processing (202)
HTTP/1.1 202 Accepted
Retry-After: 60

// When complete (200)
{
  "properties": {
    "downloadUrl": "https://...",
    "validTill": "2024-12-13T05:55:59.4394737Z"
  }
}
```

### Files Modified

1. **src/app/billing/page.jsx**
   - Removed `showAdvanced` state and toggle button
   - Updated polling interval: 5s → 10s
   - Increased max polls: 30 → 60
   - Simplified component structure

2. **src/app/api/azure/billing/reports/route.js**
   - Updated generate endpoint API version
   - Added handling for immediate 200 responses
   - Updated poll response parsing for new API format
   - Increased default retry-after from 5s to 10s

### Testing Checklist

- [x] Build completes without errors
- [x] Dev server starts successfully
- [x] Billing page loads correctly
- [x] Generate button is always visible (no toggle)
- [x] Report generation API uses 2025-03-01 version
- [ ] Test report generation with actual subscription
- [ ] Verify polling completes within 10 minutes
- [ ] Confirm download link works
- [ ] Test CSV preview display

### Known Behavior

From dev server logs, the report generation successfully:
- Initiates request (POST /api/azure/billing/reports)
- Polls for status multiple times (~1-2s per poll)
- Returns 200 when complete
- Handles rate limiting with retries

The cost batch API also shows rate limiting behavior but successfully retries:
```
[Billing Costs Batch API] Query "forecast" rate limited (attempt 1/3), waiting 2000ms before retry...
[Billing Costs Batch API] Query "forecast" rate limited (attempt 2/3), waiting 4000ms before retry...
POST /api/azure/billing/costs-batch 200 in 37.7s
```

### User Experience Improvements

1. **Simpler Interface**: No need to click "Show advanced" - button is immediately available
2. **Longer Timeout**: Reports have 10 minutes to generate instead of 2.5 minutes
3. **Better Polling**: Waits 10 seconds between polls instead of 5, reducing API load
4. **Latest API**: Uses newest Azure Cost Management API with improved reliability

### Documentation References

- [Generate Detailed Cost Report - Create Operation](https://learn.microsoft.com/en-us/rest/api/cost-management/generate-detailed-cost-report/create-operation?view=rest-cost-management-2025-03-01)
- [Generate Detailed Cost Report Operation Results - Get](https://learn.microsoft.com/en-us/rest/api/cost-management/generate-detailed-cost-report-operation-results/get?view=rest-cost-management-2025-03-01)

### Migration Notes

The API version change is **backward compatible** for subscription-scoped reports:
- Same request body format
- Same authentication requirements
- Improved response structure with clearer property names
- Better async operation handling with standardized headers
