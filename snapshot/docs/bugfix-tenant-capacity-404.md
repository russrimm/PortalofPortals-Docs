# Tenant Capacity API Fix

**Date:** December 17, 2025  
**Issue:** Tenant Capacity button returning 404 errors  
**Status:** ✅ Fixed

## Problem

The Tenant Capacity page (`/power-platform/licensing/tenant-capacity`) was attempting to fetch data from `/api/power-platform/licensing/tenant-capacity`, but:

1. **Wrong API route location** - Route existed at `/api/power-platform/tenant-capacity/route.js` instead of the expected `/api/power-platform/licensing/tenant-capacity/route.ts`
2. **Wrong Microsoft endpoint** - Using environments API (`https://api.bap.microsoft.com/providers/Microsoft.BusinessAppPlatform/scopes/admin/environments?$expand=capacity`) instead of the correct Tenant Capacity Details API
3. **Wrong authentication method** - Using app-only (client credentials) instead of delegated user authentication

## Solution

### 1. Created Correct API Route
**File:** `src/app/api/power-platform/licensing/tenant-capacity/route.ts` (NEW)

**Correct Endpoint:**
```
GET https://licensing.powerplatform.microsoft.com/TenantCapacity/TenantCapacityDetails
```

**Reference:** [Microsoft Documentation](https://learn.microsoft.com/en-us/rest/api/power-platform/licensing/tenant-capacity-details/get-tenant-capacity-details)

### 2. Implementation Details

**Authentication:**
- Uses delegated user authentication via `auth()` from NextAuth
- Acquires Power Platform Licensing token using `getLicensingDelegatedToken()`
- Follows the same pattern as Copilot Credits API route

**Headers:**
```typescript
{
  'Authorization': `Bearer ${licensingToken}`,
  'Content-Type': 'application/json',
  'Accept': 'application/json'
}
```

**Error Handling:**
- 401: Unauthorized (no session)
- 403: Insufficient permissions (needs Power Platform Administrator role)
- 404: API not available in tenant
- 429: Rate limiting
- 500: Token acquisition or unexpected errors

**Response Format:**
The API returns tenant capacity details including:
- `capacitySummary` - Overall status and FinOps information
- `tenantCapacities` - Array of capacity types (Database, File, Log)
- `licenseModelType` - License model information
- `temporaryLicenseInfo` - Temporary license details if applicable
- `legacyModelCapacity` - Legacy capacity information
- `tenantId` - Tenant identifier

### 3. Files Changed

**Created:**
- `src/app/api/power-platform/licensing/tenant-capacity/route.ts`

**Deleted:**
- `src/app/api/power-platform/tenant-capacity/route.js` (old incorrect route)
- `src/app/api/power-platform/tenant-capacity/` directory (empty after deletion)

**No changes needed to:**
- `src/app/power-platform/licensing/tenant-capacity/page.tsx` - Already correctly requesting `/api/power-platform/licensing/tenant-capacity`

## API Comparison

### ❌ Old (Incorrect) Implementation
```javascript
// Wrong endpoint - returns environment capacity, not tenant licensing capacity
const apiUrl = 'https://api.bap.microsoft.com/providers/Microsoft.BusinessAppPlatform/scopes/admin/environments?$expand=capacity&api-version=2023-06-01'

// Wrong auth - app-only (client credentials)
const tokenUrl = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`
const params = new URLSearchParams({
  client_id: CLIENT_ID,
  client_secret: CLIENT_SECRET,
  scope: 'https://api.bap.microsoft.com/.default',
  grant_type: 'client_credentials'
})
```

### ✅ New (Correct) Implementation
```typescript
// Correct endpoint - Tenant Capacity Details from Licensing API
const apiUrl = 'https://licensing.powerplatform.microsoft.com/TenantCapacity/TenantCapacityDetails'

// Correct auth - delegated user token with licensing scope
licensingToken = await getLicensingDelegatedToken({
  userAccessToken: session.accessToken,
  userIdToken: session.idToken,
  refreshToken: session.refreshToken
})
```

## Why This Matters

### Different Data Sources
According to `docs/capacity-data-sources.md`, there are two distinct APIs for capacity information:

1. **Tenant Capacity API (Licensing)** - What we fixed
   - Purpose: Billing and license planning
   - Source: Microsoft's licensing/billing database
   - Shows: What you're **allocated** and **licensed for**
   - URL: `https://licensing.powerplatform.microsoft.com/TenantCapacity/TenantCapacityDetails`
   - Update frequency: Daily or on billing cycles

2. **Environment Capacity API (BAP)**
   - Purpose: Real-time operational monitoring
   - Source: Each environment's live Dataverse database
   - Shows: What you're **currently using**
   - URL: `https://api.bap.microsoft.com/.../environments?$expand=capacity`
   - Update frequency: Real-time

The old implementation was trying to use the Environment Capacity API when users wanted Tenant Capacity data for billing/licensing purposes.

## Testing Checklist

- [x] API route exists at correct path
- [x] Uses correct Microsoft endpoint
- [x] Uses delegated authentication (not app-only)
- [x] Follows established pattern from copilot-credits route
- [x] Proper error handling for all status codes
- [x] TypeScript types correct
- [x] No linting errors
- [x] Session validation before API calls
- [x] Comprehensive error messages for users
- [x] Logging for troubleshooting

## Expected Response Structure

```typescript
interface TenantCapacityData {
  capacitySummary?: {
    status?: string
    statusMessage?: string
    statusMessageCode?: string
    finOpsStatus?: string
    finOpsStatusMessage?: string
    finOpsStatusMessageCode?: string
  }
  tenantCapacities?: TenantCapacity[]
  licenseModelType?: string
  temporaryLicenseInfo?: {
    hasTemporaryLicense?: boolean
    temporaryLicenseExpiryDate?: string
  }
  legacyModelCapacity?: {
    totalCapacity: number
    totalConsumption: number
    capacityUnits: string
  }
  tenantId?: string
}

interface TenantCapacity {
  capacityType: string // "Database", "File", "Log"
  capacityUnits: string
  totalCapacity: number
  maxCapacity: number
  status: string
  consumption?: {
    actual: number
    rated: number
    actualUpdatedOn?: string
    ratedUpdatedOn?: string
  }
  overflowCapacity?: OverflowCapacity[]
  capacityEntitlements?: CapacityEntitlement[]
}
```

## User Experience Flow

1. **Before Fix:**
   - User clicks "Tenant Capacity" in navigation
   - Page loads but API returns 404
   - Error message displayed: "The Power Platform Licensing API is not accessible..."
   - No capacity data shown

2. **After Fix:**
   - User clicks "Tenant Capacity" in navigation
   - Page loads and fetches from correct endpoint
   - Displays tenant-wide capacity information:
     - Database capacity (total, used, available)
     - File capacity (total, used, available)
     - Log capacity (total, used, available)
   - Shows capacity entitlements and license information
   - Visual charts and metrics for capacity planning

## Related Documentation

- [Microsoft API Reference](https://learn.microsoft.com/en-us/rest/api/power-platform/licensing/tenant-capacity-details/get-tenant-capacity-details)
- [Capacity Data Sources](./capacity-data-sources.md) - Explains differences between Tenant Capacity and Environment Capacity APIs
- [Power Platform Licensing Overview](https://learn.microsoft.com/en-us/power-platform/admin/pricing-billing-skus)

## Dependencies

- NextAuth: User session management
- `@/lib/auth`: Auth configuration with `auth()` function
- `@/lib/ppToken`: Token acquisition with `getLicensingDelegatedToken()`
- Power Platform Licensing API
- React/SWR on frontend for data fetching

## Code Quality

- ✅ TypeScript strict mode compliant
- ✅ Proper error type handling (no `any` types)
- ✅ Consistent with existing API route patterns
- ✅ Comprehensive inline documentation
- ✅ Defensive programming (null checks, try/catch)
- ✅ User-friendly error messages
- ✅ Server-side logging for debugging

---

**Fix Complete:** December 17, 2025  
**Status:** Production Ready ✅  
**Validation:** Build passes, no TypeScript or lint errors
