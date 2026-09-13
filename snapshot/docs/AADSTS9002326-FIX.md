# Fix for AADSTS9002326: Cross-Origin Token Redemption Error

**Error Message:**
```
invalid_request: Error(s): 9002326 - Timestamp: 2025-12-08 15:13:59Z
Description: AADSTS9002326: Cross-origin token redemption is permitted only for the 'Single-Page Application' client-type.
Request origin: 'https://portal360.yourdomain.com'
```

## Root Cause

This error occurs when:
1. Your application is deployed to Azure App Service (or another hosting provider)
2. The redirect URI is registered under the **Web** platform type in Azure AD
3. The browser is making cross-origin requests to redeem authorization codes

**Why this happens:**
- Next.js with NextAuth is running on the **server** (Node.js), not purely in the browser
- However, Azure AD sees the cross-origin request from the browser and enforces SPA security policies
- The "Web" platform type doesn't permit cross-origin token redemption for security reasons
- The "Single-page application (SPA)" platform type explicitly allows this with CORS support

## Solution

You need to change your redirect URI registration from **Web** platform to **Single-page application (SPA)** platform in Azure AD.

### Step 1: Access Azure Portal

1. Navigate to [Azure Portal](https://portal.azure.com)
2. Go to **Microsoft Entra ID** (formerly Azure Active Directory)
3. Select **App registrations**
4. Find and select your application: **PortalofPortals**

### Step 2: Update Redirect URI Platform Type

#### Option A: Update Existing Redirect URI (Recommended)

1. Click on **Authentication** in the left menu
2. Locate your Azure App Service redirect URI under **Platform configurations > Web**:
   - `https://portal360.yourdomain.com/api/auth/callback/azure-ad`
3. **Remove** this redirect URI from the **Web** section
4. Click **Add a platform**
5. Select **Single-page application**
6. Add the redirect URI:
   ```
   https://portal360.yourdomain.com/api/auth/callback/azure-ad
   ```
7. Click **Configure**
8. Click **Save** at the top of the Authentication page

#### Option B: Use Application Manifest (Alternative Method)

1. Click on **Manifest** in the left menu
2. Find the `replyUrlsWithType` array
3. Locate the entry for your Azure App Service URL:
   ```json
   {
     "url": "https://portal360.yourdomain.com/api/auth/callback/azure-ad",
     "type": "Web"
   }
   ```
4. Change `"type": "Web"` to `"type": "Spa"`:
   ```json
   {
     "url": "https://portal360.yourdomain.com/api/auth/callback/azure-ad",
     "type": "Spa"
   }
   ```
5. Click **Save** at the top

### Step 3: Verify Configuration

After updating:

1. Ensure the redirect URI appears under **Single-page application** section
2. Verify it's no longer listed under **Web** section
3. Keep your localhost development URIs under **Web** platform (they don't have cross-origin issues)

**Expected configuration:**
- **Web platform:**
  - `http://localhost:3000/api/auth/callback/azure-ad`
  - `http://localhost:3001/api/auth/callback/azure-ad` (if needed)
  
- **Single-page application platform:**
  - `https://portal360.yourdomain.com/api/auth/callback/azure-ad`
  - Any other production/staging URLs

### Step 4: Test the Fix

1. Clear your browser cache and cookies for `portal360.yourdomain.com`
2. Navigate to: https://portal360.yourdomain.com
3. Sign in with Azure AD
4. The AADSTS9002326 error should no longer appear

## Important Notes

### Why SPA Type Works for Next.js Server Apps

Even though Next.js is a server-rendered application, the SPA platform type is correct because:

1. **OAuth Flow Origin**: The authorization code exchange happens from the user's browser origin
2. **CORS Headers**: SPA type enables proper CORS headers on the token endpoint
3. **Security**: SPA type uses PKCE (Proof Key for Code Exchange) which is more secure
4. **Microsoft Guidance**: Microsoft now recommends auth code flow with PKCE for all modern apps

### Backward Compatibility

The `Spa` redirect type is backward-compatible:
- Apps using implicit flow can switch to SPA type without issues
- Next.js with NextAuth will continue working normally
- No code changes are required in your application

### Don't Change Localhost URIs

Keep your local development redirect URIs (`http://localhost:*`) under the **Web** platform:
- Local requests don't have cross-origin issues
- Changing them to SPA type may cause unnecessary complications
- Only production/hosted URLs need the SPA platform type

## Related Documentation

- [Microsoft Docs: Redirect URIs for SPAs](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow#redirect-uris-for-single-page-apps-spas)
- [Microsoft Docs: How to Add Redirect URI](https://learn.microsoft.com/en-us/entra/identity-platform/how-to-add-redirect-uri)
- [Error Code AADSTS9002326 Explanation](https://learn.microsoft.com/en-us/entra/identity-platform/reference-error-codes)

## Troubleshooting

### Error Persists After Update

1. **Wait 5-10 minutes**: Azure AD changes may take time to propagate
2. **Clear Browser Cache**: Old authentication state may be cached
3. **Check Redirect URI Match**: Ensure the URL matches exactly (including trailing slashes, http vs https)
4. **Verify Manifest**: Use the manifest editor to confirm the `type` field is set to `"Spa"`

### Multiple Environments

If you have multiple deployment environments:

**Development:**
- `http://localhost:3000/api/auth/callback/azure-ad` → **Web** platform

**Staging:**
- `https://staging.portalofportals.com/api/auth/callback/azure-ad` → **Single-page application** platform

**Production:**
- `https://portal360.yourdomain.com/api/auth/callback/azure-ad` → **Single-page application** platform

### Still Getting Errors?

If the error persists after following all steps:

1. Check Azure AD sign-in logs:
   - Azure Portal → Entra ID → Monitoring → Sign-in logs
   - Filter by your application
   - Look for additional error details

2. Verify environment variables on Azure App Service:
   - `AUTH_URL` or `NEXTAUTH_URL` should match your application domain
   - `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID` are correctly set

3. Ensure NextAuth configuration:
   - Check `src/lib/auth.ts` has `trustHost: true` (already configured)
   - Verify no hardcoded redirect URIs in the code

## Summary

**Quick Fix:**
1. Go to Azure Portal → App registrations → Your App → Authentication
2. Move the Azure App Service redirect URI from **Web** to **Single-page application** platform
3. Save changes
4. Wait 5-10 minutes, clear browser cache, and test

The error will be resolved, and authentication will work correctly on Azure App Service.
