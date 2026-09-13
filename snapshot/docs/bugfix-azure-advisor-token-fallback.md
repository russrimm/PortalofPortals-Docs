# Azure Advisor Token Fix - Client Credentials Flow

**Date:** 2025-02-02  
**Issue:** Azure Advisor recommendations endpoint returning 500 errors  
**Status:** ✅ FIXED

## Problem

The `/api/azure/advisor/recommendations` endpoint was consistently returning 500 errors. The endpoint was attempting to use delegated token flow (user context) via `getAzureManagementToken()`, which failed when:
1. Session didn't have valid `accessToken` and `refreshToken` 
2. MSAL ConfidentialClientApplication configuration had issues
3. Refresh token was expired

## Root Cause

The endpoint was using a complex delegated authentication flow that depended on user session tokens and MSAL refresh token exchange. This approach was unreliable because:
- NextAuth session tokens may not always be available
- Refresh tokens can expire
- MSAL configuration adds unnecessary complexity
- The working `/api/azure-advisor-list` endpoint uses a simpler approach

## Solution

Replaced the complex delegated token flow with **direct client credentials authentication**, matching the pattern used in the working `/api/azure-advisor-list` endpoint.

### Before (Complex - Unreliable)
```javascript
import { getAzureManagementToken, getAzureServicePrincipalToken } from '@/lib/azureToken'

// Try delegated token with fallback to service principal
let accessToken;
try {
  accessToken = await getAzureManagementToken({
    userAccessToken: session.accessToken,
    refreshToken: session.refreshToken
  })
} catch (tokenError) {
  accessToken = await getAzureServicePrincipalToken();
}
```

### After (Simple - Reliable)
```javascript
// Direct client credentials token acquisition
const tokenRes = await fetch(`https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: process.env.AZURE_CLIENT_ID,
    client_secret: process.env.AZURE_CLIENT_SECRET,
    scope: 'https://management.azure.com/.default',
    grant_type: 'client_credentials',
  }),
})

const { access_token: accessToken } = await tokenRes.json()
```

## Benefits

1. **Reliability:** No dependency on user session tokens or refresh token flow
2. **Simplicity:** Single direct token request, no MSAL library needed
3. **Consistency:** Matches the working `/api/azure-advisor-list` pattern
4. **Maintainability:** Fewer moving parts, easier to debug
5. **Performance:** Eliminates fallback logic and multiple token attempts

## Files Modified

### `src/app/api/azure/advisor/recommendations/route.js`
- Removed imports: `getAzureManagementToken`, `getAzureServicePrincipalToken` from `@/lib/azureToken`
- Removed complex try-catch fallback logic
- Added direct OAuth2 client credentials flow
- Token acquisition now matches `/api/azure-advisor-list` pattern exactly

## Testing Checklist

- [x] Verify endpoint returns recommendations successfully
- [x] Check server logs show successful token acquisition
- [x] Confirm recommendations display on `/reports/tenant-reporting` page
- [x] Validate error handling when environment variables missing
- [x] Test category filtering still works correctly

## Environment Requirements

Required environment variables:

```env
AZURE_CLIENT_ID=<app-registration-client-id>
AZURE_CLIENT_SECRET=<app-registration-client-secret>
AZURE_TENANT_ID=<azure-tenant-id>
AZURE_SUBSCRIPTION_ID=<target-subscription-id>
```

The service principal must have **Reader** role (or higher) on the subscription to read Azure Advisor recommendations.

## Related Endpoints

This fix aligns `/api/azure/advisor/recommendations` with the authentication pattern already used by:
- `/api/azure-advisor-list` - Main advisor recommendations endpoint
- `/api/azure-advisor-recommendation` - Single recommendation details

All Azure Advisor endpoints now use consistent client credentials authentication.
