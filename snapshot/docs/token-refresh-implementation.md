# Token Refresh Implementation

## Problem
Azure API routes were failing with ExpiredAuthenticationToken errors after the user's access token expired (observed after 4 days). The error:

```
[Azure Resources] API error: 401 
{"error":{"code":"ExpiredAuthenticationToken","message":"The access token expiry UTC time '11/24/2025 11:31:00 PM' is earlier than current UTC time '11/28/2025 5:28:45 AM'."}}
```

## Root Cause
- NextAuth session includes `accessToken` but this token expires after a period (typically 1 hour for Azure AD tokens)
- Session cookie persists but contained an expired access token
- API routes were using `session.accessToken` directly without checking expiry or refreshing
- No refresh token mechanism was in place for Azure Management API calls

## Solution

### Created Token Helper (`src/lib/azureToken.js`)
Created a centralized token helper that:
1. Checks if the current token is expired (with 5-minute buffer)
2. Validates the token audience (must be for `management.azure.com`)
3. Automatically uses the refresh token to get a fresh token if needed
4. Uses MSAL (Microsoft Authentication Library) for token refresh

Key functions:
- `getAzureManagementToken()` - Gets or refreshes token for Azure Management API
- `getAzureResourceGraphToken()` - Gets or refreshes token for Resource Graph API (uses same endpoint)
- `acquireTokenByRefreshToken()` - Generic refresh token exchange using MSAL
- `isTokenExpired()` - JWT expiry checker with 5-minute buffer

### Updated API Routes
Modified the following routes to use the token helper:

1. **src/app/api/azure/resources/route.js**
   - Uses: Resource Graph API for querying Azure resources
   - Changed from: `const accessToken = session.accessToken`
   - Changed to: `const accessToken = await getAzureResourceGraphToken({...})`

2. **src/app/api/azure/metrics/values/route.js**
   - Uses: Azure Monitor API for metric values
   - Changed from: `const accessToken = session.accessToken`
   - Changed to: `const accessToken = await getAzureManagementToken({...})`

3. **src/app/api/azure/metrics/definitions/route.js**
   - Uses: Azure Monitor API for metric definitions
   - Changed from: `const accessToken = session.accessToken`
   - Changed to: `const accessToken = await getAzureManagementToken({...})`

4. **src/app/api/azure/cost-details/route.js** (both POST and GET)
   - Uses: Azure Cost Management API
   - Fixed typo: `session.azureAccessToken` → `accessToken`
   - Changed to: `const accessToken = await getAzureManagementToken({...})`

### Routes NOT Updated (No Changes Needed)
These routes already use proper token acquisition patterns:
- `src/app/api/azure/subscriptions/route.js` - Uses client credentials (app-only token)
- `src/app/api/azure/resourceGroups/route.js` - Uses client credentials
- `src/app/api/azure/subscribed-skus/route.js` - Uses `getGraphDelegatedToken()` helper

## How Token Refresh Works

```javascript
// Before (broken)
const accessToken = session.accessToken // Could be expired!
const response = await fetch('https://management.azure.com/...', {
  headers: { 'Authorization': `Bearer ${accessToken}` }
})

// After (fixed)
const accessToken = await getAzureManagementToken({
  userAccessToken: session.accessToken,  // Current token (may be expired)
  refreshToken: session.refreshToken      // Refresh token (long-lived)
})
const response = await fetch('https://management.azure.com/...', {
  headers: { 'Authorization': `Bearer ${accessToken}` }
})
```

### Token Refresh Flow
1. Check if current `userAccessToken` is valid and for correct audience
2. If valid and correct audience → use it
3. If expired or wrong audience → use `refreshToken` with MSAL:
   ```javascript
   const result = await msalApp.acquireTokenByRefreshToken({
     refreshToken: session.refreshToken,
     scopes: ['https://management.azure.com/.default']
   })
   ```
4. Return fresh `accessToken` for the API call

## Authentication Architecture

### Token Types in Session
From `src/lib/auth.ts`:
```typescript
session: {
  accessToken?: string    // Primary OAuth2 access token (expires in ~1 hour)
  idToken?: string        // OIDC ID token (user identity)
  refreshToken?: string   // Long-lived refresh token (expires in days/months)
  user: { ... }
}
```

### Token Scopes
- **Login scope** (in `auth.ts`): `openid profile email offline_access User.Read`
  - `offline_access` is critical - grants refresh token
  - User.Read for basic Microsoft Graph access
  
- **Azure Management scope** (in token helper): `https://management.azure.com/.default`
  - Acquired via refresh token exchange
  - Valid for Azure Resource Graph, Monitor, Cost Management, etc.

## Additional Fix
**src/app/api/power-platform/tenant-applications/route.js**
- Fixed syntax error: Missing `try` statement before `catch` block
- The `withAuth` wrapper expects the handler function to manage its own try/catch

## Testing
To verify the fix works:
1. Wait for your session token to expire (or manually revoke it in Azure AD)
2. Navigate to Azure Resources page (`/azure/resources`)
3. API should automatically refresh the token and load resources successfully
4. Check browser console for `[Azure Token]` logs if debugging is enabled

## Dependencies
The solution requires:
- `@azure/msal-node` (already installed) - For MSAL token acquisition
- NextAuth configured with Azure AD provider including `offline_access` scope ✅
- Session callback storing `refreshToken` ✅

## Future Improvements
1. Add token caching to avoid repeated refresh calls within the same request cycle
2. Implement token refresh middleware to handle all routes automatically
3. Add proper error handling when refresh token expires (require re-authentication)
4. Log token refresh events for monitoring/debugging
5. Consider implementing token refresh on session callback (proactive refresh)

## Impact
- ✅ Fixes 401 ExpiredAuthenticationToken errors on Azure API routes
- ✅ Enables long-running sessions without forced re-login
- ✅ Maintains security by using short-lived access tokens
- ✅ Leverages existing refresh tokens stored in session
- ⚠️ Note: Refresh token can also expire (typically 90 days) requiring re-authentication
