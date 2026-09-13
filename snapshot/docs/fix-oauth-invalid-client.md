# Fixing OAuth invalid_client Error on Azure App Service

## Error
```
OAuthCallbackError: OAuth Provider returned an error: invalid_client
```

This error occurs when Azure AD rejects the authentication attempt from your Azure App Service deployment.

## Root Causes & Solutions

### 1. Missing or Incorrect Client Secret (Most Common)

**Problem**: The `AZURE_CLIENT_SECRET` environment variable in Azure App Service is missing, incorrect, or expired.

**Solution**:
1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to: **Azure Active Directory** → **App registrations** → **[Your App]**
3. Click **Certificates & secrets**
4. Check if your client secret has expired
5. If expired or missing, create a new secret:
   - Click **New client secret**
   - Add description: "Azure App Service Production"
   - Set expiration (recommend: 24 months)
   - **COPY THE VALUE IMMEDIATELY** (you can't see it again!)
6. Go to [Azure Portal](https://portal.azure.com) → App Services → Your App → Settings → Environment variables
7. Add/Update: `AZURE_CLIENT_SECRET` = `[your new secret value]`
8. **Important**: Redeploy your app for changes to take effect

### 2. Missing Redirect URI Configuration

**Problem**: Your application domain is not registered as an allowed redirect URI in Azure AD.

**Solution**:
1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to: **Azure Active Directory** → **App registrations** → **[Your App]**
3. Click **Authentication** in the left menu
4. Under **Platform configurations** → **Web**, add redirect URIs:
   ```
   https://[your-domain]/api/auth/callback/azure-ad
   ```
   
   **Example**:
   ```
   https://portal360.yourdomain.com/api/auth/callback/azure-ad
   ```

5. If you have **preview deployments**, you may need wildcards (not recommended for production):
   ```
   https://portal360.yourdomain.com/api/auth/callback/azure-ad
   ```
   
   Or add each preview domain individually.

6. Click **Save**

### 3. Missing Environment Variables in Azure App Service

**Problem**: Required NextAuth environment variables are not set in Azure App Service.

**Solution**: Verify all environment variables are set in Azure App Service:

#### Required Variables:
```bash
AZURE_CLIENT_ID=32c72b33-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_CLIENT_SECRET=your-secret-value-from-azure
AZURE_TENANT_ID=f33d7d7f-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AUTH_SECRET=generate-random-string-here
AUTH_URL=https://portal360.yourdomain.com
```

#### Generate AUTH_SECRET:
```bash
openssl rand -base64 32
```

Or use NextAuth CLI:
```bash
pnpm dlx auth secret
```

### 4. Client ID Mismatch

**Problem**: The `AZURE_CLIENT_ID` in Azure App Service doesn't match the App Registration in Azure AD.

**Solution**:
1. Go to Azure Portal → Azure Active Directory → App registrations → [Your App]
2. Copy the **Application (client) ID** from the Overview page
3. Verify it matches `AZURE_CLIENT_ID` in Azure App Service environment variables exactly
4. Update if different and redeploy

### 5. Wrong Tenant ID

**Problem**: Using 'common' tenant when app is single-tenant, or using specific tenant ID when app is multi-tenant.

**Solution**:
1. Check your app registration type in Azure Portal:
   - **Single tenant**: Use specific tenant ID (`AZURE_TENANT_ID=f33d7d7f-...`)
   - **Multi-tenant**: Can use 'common' or specific tenant ID
2. Verify `AZURE_TENANT_ID` matches your app's tenant configuration
3. Update Azure App Service environment variable if needed and redeploy

## Verification Steps

### Step 1: Check Azure AD Configuration
```bash
✓ App registration exists
✓ Client ID is correct
✓ Client secret is valid (not expired)
✓ Redirect URI includes: https://[your-domain]/api/auth/callback/azure-ad
✓ Tenant ID matches app registration
```

### Step 2: Check Azure App Service Environment Variables
In Azure Portal, go to **App Services → [Your App] → Settings → Environment variables** and verify:
```bash
✓ AZURE_CLIENT_ID (matches Azure App Registration)
✓ AZURE_CLIENT_SECRET (valid, not expired)
✓ AZURE_TENANT_ID (matches Azure tenant)
✓ AUTH_SECRET (random string, 32+ characters)
✓ AUTH_URL (your production domain with https://)
```

### Step 3: Test Authentication Flow
1. Redeploy your Azure App Service app after making changes
2. Visit your production URL: `https://[your-domain]`
3. Click sign in
4. Should redirect to Microsoft login
5. After successful login, should redirect back to your app

## Debugging Commands

### View NextAuth Configuration (Production)
Already logging in your auth.ts file:
```typescript
console.log('[auth] Production configuration:', {
  hasClientId: !!clientId,
  clientIdPrefix: clientId ? clientId.substring(0, 8) + '...' : 'missing',
  hasClientSecret: !!clientSecret,
  hasTenantId: !!tenantId,
  hasSecret: !!resolvedSecret,
  authUrl: process.env.AUTH_URL || process.env.NEXTAUTH_URL || 'not set',
  issuer
})
```

Check Azure App Service logs to see this output and verify all values are present.

### Test Redirect URI
Open browser and navigate to:
```
https://login.microsoftonline.com/[TENANT_ID]/oauth2/v2.0/authorize?client_id=[CLIENT_ID]&response_type=code&redirect_uri=https://[YOUR_DOMAIN]/api/auth/callback/azure-ad&scope=openid profile email
```

Replace:
- `[TENANT_ID]` with your Azure tenant ID
- `[CLIENT_ID]` with your Azure client ID
- `[YOUR_DOMAIN]` with your application domain

**Expected**: Should show Microsoft login page
**Error**: "AADSTS50011" = invalid redirect URI (not registered)

## Common Errors & Meanings

| Error Code | Meaning | Solution |
|------------|---------|----------|
| `invalid_client` | Client authentication failed | Check client secret, client ID, tenant ID |
| `AADSTS50011` | Redirect URI mismatch | Add redirect URI to Azure AD app registration |
| `AADSTS7000215` | Invalid client secret | Generate new client secret in Azure Portal |
| `AADSTS700016` | Application not found | Check client ID matches app registration |
| `AADSTS90002` | Tenant not found | Check tenant ID is correct |

## Quick Fix Checklist

- [ ] Verify client secret is not expired (Azure Portal)
- [ ] Add Azure App Service redirect URI to Azure AD (Azure Portal → Authentication)
- [ ] Set all environment variables in Azure App Service (Azure Portal → Settings)
- [ ] Redeploy Azure App Service app after changing environment variables
- [ ] Test authentication flow on production domain
- [ ] Check Azure App Service logs for configuration status
- [ ] Verify AUTH_URL matches your production domain exactly

## Still Having Issues?

1. **Check Azure App Service Logs**: Azure Portal → Deployments → [Latest] → Runtime Logs
2. **Enable Debug Mode**: Add `DEBUG=1` environment variable in Azure App Service
3. **Test Locally**: Set environment variables in `.env.local` and run `pnpm run dev`
4. **Compare Configs**: Ensure local working config matches Azure App Service config exactly

## Additional Resources

- [NextAuth.js Deployment Guide](https://authjs.dev/getting-started/deployment)
- [Azure AD OAuth Provider Setup](https://authjs.dev/getting-started/providers/azure-ad)
- [Azure App Service app settings](https://learn.microsoft.com/en-us/azure/app-service/configure-common)
- [Azure AD App Registration Guide](https://learn.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app)
