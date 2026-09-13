# Token Refresh Testing Guide

## Overview
This guide helps you verify that the token refresh implementation is working correctly for Azure API routes.

## What Was Fixed
Azure API routes were failing with 401 ExpiredAuthenticationToken errors when the session access token expired (typically after 1 hour, but session can persist for days). The fix implements automatic token refresh using the refresh token stored in the session.

## Quick Test (Immediate Verification)

### Test 1: Azure Resources Page
1. Navigate to http://localhost:3000/azure/resources
2. Open browser DevTools (F12) → Console tab
3. Look for these indicators:
   - ✅ Page loads without 401 errors
   - ✅ Resources are displayed (if you have Azure resources)
   - ✅ No "ExpiredAuthenticationToken" errors in console

### Test 2: Azure Metrics Page
1. Navigate to http://localhost:3000/azure/metrics
2. Select a Log Analytics workspace
3. Check for:
   - ✅ Metrics load successfully
   - ✅ No authentication errors

### Test 3: Azure Deploy Page
1. Navigate to http://localhost:3000/azure/deploy
2. Try to load existing network interfaces (if VM module is selected)
3. Verify:
   - ✅ Network interfaces dropdown populates
   - ✅ No 401 errors in Network tab

## Extended Test (Simulate Expired Token)

### Option A: Wait for Natural Expiration
1. Log in to the application
2. Wait for 1-2 hours (typical Azure AD token lifetime)
3. Return to the app (session cookie should still be valid)
4. Navigate to any Azure page
5. Expected: Page loads successfully with automatic token refresh

### Option B: Force Token Refresh
Since the refresh logic checks token expiry, you can verify it's working by:

1. Open DevTools → Application tab → Cookies
2. Note your session cookie is present
3. Navigate to an Azure page (e.g., `/azure/resources`)
4. In the Network tab, check the API call to `/api/azure/resources`
5. If token was expired, you should see a successful refresh happen transparently

## Debugging

### Enable Debug Logging
Add console.log statements to `src/lib/azureToken.js`:

```javascript
export async function getAzureManagementToken({ userAccessToken, refreshToken }) {
  const scopes = ['https://management.azure.com/.default'];
  
  console.log('[Azure Token] Getting management token', {
    hasAccessToken: !!userAccessToken,
    hasRefreshToken: !!refreshToken
  });
  
  // If we have a valid token, use it
  if (userAccessToken && !isTokenExpired(userAccessToken)) {
    console.log('[Azure Token] Using existing token (not expired)');
    // ... rest of logic
  }
  
  // Use refresh token to get a fresh token
  if (refreshToken) {
    console.log('[Azure Token] Refreshing token using refresh token');
    try {
      const newToken = await acquireTokenByRefreshToken(refreshToken, scopes);
      console.log('[Azure Token] Token refreshed successfully');
      return newToken;
    } catch (err) {
      console.error('[Azure Token] Failed to refresh token:', err.message);
      throw new Error('Failed to acquire Azure Management token');
    }
  }
  // ...
}
```

### Check Server Logs
When an API route uses token refresh, you'll see:
```
[Azure Token] Getting management token { hasAccessToken: true, hasRefreshToken: true }
[Azure Token] Refreshing token using refresh token
[Azure Token] Token refreshed successfully
```

### Common Issues

#### Issue: "No valid token or refresh token available"
**Cause**: Session doesn't have a refresh token
**Solution**: 
1. Check `src/lib/auth.ts` includes `offline_access` in login scope ✅ (already configured)
2. Check session callback stores `refreshToken` ✅ (already configured)
3. Log out and log in again to get a new session with refresh token

#### Issue: "Failed to acquire Azure Management token"
**Cause**: Refresh token is invalid or expired
**Solution**: 
1. Refresh tokens typically last 90 days
2. If expired, user must re-authenticate
3. Log out and log in again

#### Issue: Still getting 401 errors
**Cause**: API route not updated or token helper not imported
**Solution**:
1. Check the route imports `getAzureManagementToken` or `getAzureResourceGraphToken`
2. Verify the route calls the token helper before making Azure API calls
3. Check Network tab in DevTools to see which API route is failing

## Updated Routes (Should Work Without Errors)

### Azure Resource Management
- `/api/azure/resources` - Lists Azure resources (VM, Storage, etc.)
- `/api/azure/metrics/values` - Gets metric values for resources
- `/api/azure/metrics/definitions` - Gets available metrics for resources
- `/api/azure/cost-details` - Cost management reports

### Power Platform (Already Using Token Helpers)
All Power Platform routes already use proper token helpers:
- `/api/power-platform/*` - Uses `getPowerPlatformDelegatedToken()`
- `/api/power-platform/dataverse/*` - Uses `getDataverseDelegatedToken()`

## Manual Testing Checklist

- [ ] Log in to the application
- [ ] Navigate to `/azure/resources`
- [ ] Verify resources load without errors
- [ ] Navigate to `/azure/metrics`  
- [ ] Verify metrics load without errors
- [ ] Navigate to `/azure/deploy`
- [ ] Verify Azure CLI status check works
- [ ] Try loading existing network interfaces (VM section)
- [ ] Check browser console for any 401 errors
- [ ] Check server console for token refresh logs
- [ ] Wait 1-2 hours and test again (token expiry test)

## Expected Behavior

### Before Fix
```
GET /api/azure/resources 401 in 500ms
[Azure Resources] API error: 401 {"error":{"code":"ExpiredAuthenticationToken"}}
```

### After Fix
```
GET /api/azure/resources 200 in 1500ms
[Azure Token] Refreshing token using refresh token
[Azure Token] Token refreshed successfully
```

## Verification Commands

### Check if MSAL is installed
```powershell
pnpm list @azure/msal-node
```
Expected: `@azure/msal-node@2.x.x`

### Verify token helper syntax
```powershell
node -e "require('./src/lib/azureToken.js'); console.log('Token helper OK')"
```
Expected: `Token helper OK`

### Check session includes refresh token
1. Log in to the app
2. Open DevTools → Console
3. Run: `fetch('/api/auth/session').then(r => r.json()).then(console.log)`
4. Check output includes:
   ```json
   {
     "user": {...},
     "accessToken": "...",
     "refreshToken": "..."
   }
   ```

## Success Criteria
✅ No ExpiredAuthenticationToken errors in console or server logs
✅ Azure resources/metrics pages load successfully even after 1+ hour session
✅ Token refresh happens automatically and transparently
✅ User doesn't need to re-login unless refresh token expires (typically 90 days)

## Rollback Plan
If issues occur, you can temporarily revert by:
1. Commenting out the token helper import in affected routes
2. Reverting to `const accessToken = session.accessToken`
3. Accepting that users will need to re-login after token expiry

However, the proper fix is to ensure:
- `offline_access` scope is in auth config ✅
- Session callback stores refresh token ✅  
- Token helper is correctly implemented ✅
- Routes use the token helper correctly ✅

All of these are already in place, so the fix should work reliably.
