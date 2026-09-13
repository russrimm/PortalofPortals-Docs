# IT Administrator Troubleshooting Guide

**Quick reference for diagnosing and resolving common issues in Portal 360°**  
**Last Updated:** November 1, 2025

This guide helps IT administrators quickly diagnose and resolve authentication, API, and permission issues.

---

## Table of Contents

1. [Quick Diagnostics Checklist](#quick-diagnostics-checklist)
2. [Authentication Issues](#authentication-issues)
3. [Permission Errors](#permission-errors)
4. [API Connection Failures](#api-connection-failures)
5. [Power Platform Issues](#power-platform-issues)
6. [Token Problems](#token-problems)
7. [Environment Configuration](#environment-configuration)
8. [Debugging Tools & Techniques](#debugging-tools--techniques)
9. [Common Error Codes](#common-error-codes)
10. [Getting Help](#getting-help)

---

## Quick Diagnostics Checklist

Use this checklist for rapid issue triage:

### ✅ Initial Health Check

- [ ] Application starts without errors (`pnpm run dev` or `pnpm start`)
- [ ] User can access the login page
- [ ] `.env.local` file exists with required variables
- [ ] All environment variables are non-empty
- [ ] App registration exists in Azure Portal
- [ ] Client secret has not expired
- [ ] User has been assigned necessary admin roles

### ✅ Authentication Check

- [ ] User can click "Sign In" without errors
- [ ] Microsoft login page appears
- [ ] User can complete authentication
- [ ] User is redirected back to application
- [ ] User's name appears in the UI after login

### ✅ API Access Check

- [ ] Users page loads without errors (`/users`)
- [ ] Groups page loads without errors (`/groups`)
- [ ] Power Platform page shows environments (`/power-platform`)
- [ ] Azure resources page shows data (`/azure/resources`)

If any of the above fail, proceed to the relevant section below.

---

## Authentication Issues

### Issue: "Sign In" button does nothing or shows error

**Symptoms**:
- Clicking "Sign In" has no effect
- Console shows JavaScript errors
- Error message: "Auth disabled" or similar

**Causes & Solutions**:

1. **Missing environment variables**
   ```bash
   # Check these are set in .env.local:
   AZURE_CLIENT_ID=...
   AZURE_CLIENT_SECRET=...
   AZURE_TENANT_ID=...
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=...
   ```
   
   **Fix**: Create or update `.env.local` with all required variables. Restart dev server after changes.

2. **Incorrect NEXTAUTH_URL**
   - If dev server is on port 3001 but `NEXTAUTH_URL=http://localhost:3000`, authentication will fail
   
   **Fix**: Update `NEXTAUTH_URL` to match your actual dev server port:
   ```bash
   NEXTAUTH_URL=http://localhost:3001
   ```

3. **Invalid redirect URI in app registration**
   - Azure Portal > App registrations > Your app > Authentication > Redirect URIs
   - Must include: `http://localhost:3000/api/auth/callback/azure-ad` (dev)
   - And: `https://your-domain.com/api/auth/callback/azure-ad` (production)
   
   **Fix**: Add missing redirect URIs in Azure Portal, wait 5 minutes for propagation.

**Verification**:
```bash
# Check if NextAuth is properly configured
node -e "console.log(require('dotenv').config().parsed)"
# Should show all environment variables
```

---

### Issue: User redirected to login page but sees "AADSTS error"

**Common AADSTS Error Codes**:

#### AADSTS50011: Reply URL mismatch
- **Cause**: Redirect URI in request doesn't match registered URIs
- **Fix**: Add the exact redirect URI to app registration (Azure Portal > Authentication)

#### AADSTS50020: User account from identity provider does not exist
- **Cause**: User's account is from a different tenant
- **Fix**: 
  - Ensure `AZURE_TENANT_ID` matches user's tenant
  - Or change app to multi-tenant (not recommended for admin portal)

#### AADSTS65001: User or administrator has not consented
- **Cause**: Admin consent not granted for required permissions
- **Fix**: Azure Portal > App registrations > API permissions > **Grant admin consent**

#### AADSTS700016: Application not found in directory
- **Cause**: Incorrect `AZURE_CLIENT_ID` or app deleted
- **Fix**: Verify `AZURE_CLIENT_ID` matches app registration's "Application (client) ID"

#### AADSTS7000215: Invalid client secret
- **Cause**: Wrong secret, expired secret, or secret not yet active
- **Fix**: Create new client secret in Azure Portal > Certificates & secrets > Update `AZURE_CLIENT_SECRET`

**Documentation**: [Azure AD authentication error codes](https://learn.microsoft.com/en-us/azure/active-directory/develop/reference-aadsts-error-codes)

---

### Issue: User logs in successfully but immediately logged out

**Symptoms**:
- Login succeeds
- User redirected to home page
- Immediately redirected back to login

**Causes & Solutions**:

1. **Invalid or missing NEXTAUTH_SECRET**
   - Causes JWT decryption to fail
   
   **Fix**: 
   ```bash
   # Generate a new secret
   openssl rand -base64 32
   # Add to .env.local:
   NEXTAUTH_SECRET=<generated-secret>
   ```

2. **Session cookie domain mismatch**
   - Occurs when deploying behind a proxy or load balancer
   
   **Fix**: Ensure `NEXTAUTH_URL` matches the public URL users access

3. **Browser blocking third-party cookies**
   - Rare in same-domain scenarios
   
   **Fix**: Check browser console for cookie warnings. Test in incognito mode.

---

## Permission Errors

### Issue: "Forbidden" (403) or "Unauthorized" (401) after login

**Symptoms**:
- User can log in
- Specific pages show 403 or 401 errors
- API calls fail with permission errors

**Diagnostic Steps**:

1. **Check which API is failing**
   - Open browser Developer Tools (F12)
   - Go to Network tab
   - Reproduce the error
   - Find the failing request (red status code)
   - Note the URL and response body

2. **Identify required permission**
   - Use [API-ENDPOINTS-REFERENCE.md](./API-ENDPOINTS-REFERENCE.md) to find required permission
   - Example: `/users` requires `User.Read.All`

3. **Verify permission is granted**
   - Azure Portal > App registrations > Your app > API permissions
   - Check if permission is listed
   - Check if "Granted for {Tenant}" appears in Status column
   - If not granted, click **Grant admin consent for {Tenant}**

4. **Wait for propagation**
   - After granting consent, wait 5-10 minutes
   - Cached tokens may still have old permissions
   - User may need to sign out and sign back in

**Common Permission Fixes**:

| Error Message | Missing Permission | How to Add |
|---------------|-------------------|------------|
| "Insufficient privileges to complete the operation" | Application.ReadWrite.All or similar | Add delegated permission in API permissions |
| "Access is denied" | Azure RBAC role missing | Assign Reader/Contributor role to service principal in Azure Portal |
| "User does not have access to environment" | Power Platform admin role | Assign Power Platform Administrator in Microsoft 365 Admin Center |
| "The bot entity does not exist" | Application user needs security role | Create application user in Dataverse environment with System Administrator role |

---

### Issue: Microsoft Graph API works but Power Platform API fails

**Symptoms**:
- Users page loads fine
- Power Platform environments page shows 401 or 403

**Causes & Solutions**:

1. **Missing delegated permission for the Power Platform resource** (most common)

   Each Power Platform resource is a separate Entra application and needs its own consented delegated permission. A missing one shows up in the server log as:

   ```
   AADSTS65001: The user or administrator has not consented to use the application
   with ID '<your-app-id>' named '<your-app-name>'.
   ```

   Map the requested scope in the log to the API you need to add:

   | Requested scope | Add this API | Application ID |
   |-----------------|--------------|----------------|
   | `https://service.powerapps.com/.default` | PowerApps Service | `475226c6-020e-4fb2-8a90-7a972cbfc1d4` |
   | `https://api.bap.microsoft.com/.default` | PowerApps-Advisor | `8578e004-a5c6-46e7-913e-12f58912df43` |
   | `https://api.powerplatform.com/.default` | Power Platform API | `8578e004-a5c6-46e7-913e-12f58912df43` |

   **Fix**: App registration → **API permissions** → **Add a permission** → **APIs my organization uses** → search by the Application ID → **Delegated permissions** → **Grant admin consent**. Then sign out and back in.

   See [`power-platform-api-permissions.md`](./power-platform-api-permissions.md) for full setup steps.

2. **User lacks Power Platform admin role**
   
   **Fix**: 
   - Go to [Microsoft 365 Admin Center](https://admin.microsoft.com)
   - Roles > Role assignments > Power Platform Administrator
   - Add user to this role
   - Wait 15 minutes for role propagation

3. **Token scope is incorrect**
   - Check `src/lib/ppToken.ts` uses `https://api.powerplatform.com/.default`
   
   **Verification**:
   ```javascript
   // In browser console on failing page:
   console.log(session); // Should show tokens
   ```

4. **On-Behalf-Of flow failing**
   - MSAL may fail to exchange user token for Power Platform token
   - `AADSTS50013: Assertion failed signature validation` is expected here: the sign-in
     access token is Microsoft Graph-audience, and Graph tokens cannot be replayed as OBO
     assertions. The portal falls back to a refresh-token exchange, so this error alone is
     not the root cause — look at the error that follows it.
   
   **Fix**: Check refresh token is present in session:
   ```javascript
   // In src/lib/auth.ts, verify refresh token is stored:
   if (typeof a.refresh_token === 'string') token.refreshToken = a.refresh_token
   ```

---

### Issue: Windows Update catalog returns 403 with an empty `UnknownError`

**Symptoms**:
- `/windows-updates/catalog` shows an error banner
- Server log shows `Graph API error: 403 - {"error":{"code":"UnknownError","message":"", ...}}` for `/beta/admin/windows/updates/catalog/entries`

**Cause**: Graph reports a bare `UnknownError` for this endpoint whenever the caller is not authorized. Two independent requirements must both be met:

1. **App registration scope** — delegated `WindowsUpdates.Read.All` (or `WindowsUpdates.ReadWrite.All`) with admin consent. Tokens are acquired with `.default`, so a scope that was never consented is silently absent from the token rather than triggering a consent prompt.
2. **Signed-in user role** — *Intune Administrator*, *Windows Update Deployment Administrator*, or *Global Administrator*. The permission alone is not enough.

**Fix**:
1. App registration → **API permissions** → **Add a permission** → **Microsoft Graph** → **Delegated permissions** → `WindowsUpdates.Read.All` → **Grant admin consent**.
2. Assign the signing-in admin one of the three roles above.
3. Sign out and back in so a fresh token carries the new scope.

Affected routes: `/api/windows-updates/catalog`, `/api/intune/windows-update-catalog`.

**Documentation**: [List catalog entries](https://learn.microsoft.com/en-us/graph/api/windowsupdates-catalog-list-entries?view=graph-rest-beta)

---

## API Connection Failures

### Issue: "Failed to fetch" or network errors

**Symptoms**:
- API calls timeout
- "TypeError: Failed to fetch"
- Network tab shows failed requests

**Diagnostic Steps**:

1. **Check if external APIs are reachable**
   ```bash
   # Test Graph API
   curl -I https://graph.microsoft.com/v1.0/users
   # Should return 401 (expected without auth)
   
   # Test Power Platform API
   curl -I https://api.powerplatform.com/environmentmanagement/environments
   # Should return 401 (expected without auth)
   ```
   
   If curl fails, check:
   - Corporate firewall blocking Microsoft endpoints
   - Proxy configuration needed
   - DNS resolution issues

2. **Check proxy settings** (if applicable)
   ```bash
   # Set proxy in .env.local if needed:
   HTTP_PROXY=http://proxy.company.com:8080
   HTTPS_PROXY=http://proxy.company.com:8080
   NO_PROXY=localhost,127.0.0.1
   ```

3. **Verify SSL/TLS certificates**
   - Corporate SSL inspection may cause certificate errors
   - Node.js may reject custom CA certificates
   
   **Fix** (development only, NOT for production):
   ```bash
   # .env.local
   NODE_TLS_REJECT_UNAUTHORIZED=0
   ```

---

### Issue: Rate limiting errors (429 Too Many Requests)

**Symptoms**:
- API returns 429 status
- Error message: "Rate limit exceeded" or similar
- Retry-After header present

**Causes & Solutions**:

1. **Microsoft Graph throttling**
   - Application is making too many requests
   
   **Fix**: Application has built-in retry logic in `src/lib/graphClient.ts`
   - Wait for the time specified in `Retry-After` header
   - Reduce request frequency if persistent

2. **Dataverse service protection limits**
   - Exceeding 6,000 requests per 5 minutes per user
   
   **Fix**: 
   - Implement caching for frequently accessed data
   - Reduce concurrent requests
   - Use `$select` to fetch only needed fields

**Best Practices**:
- Always respect `Retry-After` header
- Implement exponential backoff
- Cache responses when appropriate
- Use batching for multiple operations

---

## Power Platform Issues

### Issue: Environments load but show no data for teams/solutions/agents

**Symptoms**:
- Power Platform page shows environments
- Clicking "Teams" or "Solutions" button shows empty modal or error
- Console shows 401, 403, or 404 errors

**Causes & Solutions**:

1. **Application user not created in Dataverse**
   
   **Fix**:
   - [Power Platform Admin Center](https://admin.powerplatform.microsoft.com)
   - Environments > Select environment > Settings > Users + permissions > Application users
   - Click **+ New app user**
   - Select your app registration by Application ID
   - Assign **System Administrator** security role
   - Click Create

2. **Incorrect token scope**
   - Dataverse requires token scoped to specific environment URL
   
   **Verification**:
   ```javascript
   // Check src/lib/ppToken.ts or wherever Dataverse token is acquired
   // Should use: https://{environment-url}/.default
   // NOT: https://api.powerplatform.com/.default
   ```

3. **Environment URL has trailing slash**
   - Causes invalid token scope
   
   **Fix**: Normalize instanceUrl before token acquisition:
   ```javascript
   const normalizedUrl = instanceUrl.replace(/\/+$/, '');
   const scope = `${normalizedUrl}/.default`;
   ```

4. **Bot/Copilot entity permissions**
   - Application user may lack read access to `bot` entity
   
   **Fix**:
   - In Dataverse, edit application user's security role
   - Ensure **Read** privilege on **Copilot** (bot) entity
   - Or assign System Administrator role

---

### Issue: "Default environment" or "GUID environment" error messages

**Symptoms**:
- Error: "Cannot perform operation on Default environment"
- Error: "Use environment GUID instead of name"

**Cause**: Some Dataverse management operations don't work on the default environment or require environment GUID.

**Fix**: 
- Use a non-default environment for testing
- Identify environment GUID from environment list
- Fallback to `dataverseId` when `id` fails (implemented in some routes)

---

## Token Problems

### Issue: "Invalid audience" or "Token validation failed"

**Symptoms**:
- API returns 401 with "Invalid audience" error
- Token audience (aud claim) doesn't match API resource

**Diagnostic**:

Decode the JWT token to inspect claims:

```javascript
// In browser console or Node.js:
function decodeJwt(token) {
  const parts = token.split('.');
  const payload = JSON.parse(atob(parts[1]));
  console.log('Audience:', payload.aud);
  console.log('Scopes:', payload.scp || payload.roles);
  console.log('Expiration:', new Date(payload.exp * 1000));
  return payload;
}

// Usage:
const token = 'eyJ0eXAiOiJKV1QiLCJh...';
decodeJwt(token);
```

**Expected Audiences**:
- Microsoft Graph: `https://graph.microsoft.com` or `00000003-0000-0000-c000-000000000000`
- Azure Resource Manager: `https://management.azure.com` or `https://management.core.windows.net`
- Power Platform: `https://api.powerplatform.com`
- Dataverse: `https://{environment-url}` (dynamic)

**Fix**: Verify token scope matches the API being called. Check `src/lib/obo.ts`, `src/lib/ppToken.ts`, and `src/lib/graphClient.ts` for correct scopes.

---

### Issue: Token expired errors

**Symptoms**:
- API works initially, then returns 401 after some time
- Error message: "Token is expired" or "AADSTS7000222"

**Cause**: Access tokens expire after 60-90 minutes.

**Fix**: Application should automatically refresh tokens via:
1. Refresh token stored in session
2. MSAL token cache
3. Re-authentication flow

**Verification**:
```javascript
// Check if refresh token is present in session (src/lib/auth.ts):
async session({ session, token }) {
  if (token.refreshToken) session.refreshToken = token.refreshToken
  return session
}
```

If refresh token is missing, user must sign out and sign back in.

---

## Environment Configuration

### Issue: Environment variables not loading

**Symptoms**:
- Application starts but features don't work
- Console logs show `undefined` for environment variables
- Error: "Configuration error"

**Diagnostic**:

```bash
# Check if .env.local exists
ls -la .env.local

# Verify contents (DO NOT share output with secrets!)
cat .env.local

# Check Next.js can read variables
node -e "require('dotenv').config({ path: '.env.local' }); console.log(process.env.AZURE_CLIENT_ID)"
```

**Common Issues**:

1. **File named incorrectly**
   - Must be `.env.local` (not `env.local` or `.env`)
   - Must be in project root directory

2. **Variables not prefixed for client-side**
   - Client components need `NEXT_PUBLIC_` prefix
   - Example: `NEXT_PUBLIC_API_URL=...`
   - **⚠️ NEVER** prefix secrets with `NEXT_PUBLIC_`

3. **Server not restarted**
   - Changes to `.env.local` require server restart
   ```bash
   # Stop server (Ctrl+C), then restart:
   pnpm run dev
   ```

4. **Environment variables in wrong environment**
   - `.env.local` for local development
   - Azure App Service: Application Settings
   - Docker: Pass via `-e` flag or docker-compose

---

### Issue: Secrets exposed in browser

**Symptoms**:
- Secrets visible in browser DevTools > Network tab
- Secrets visible in client-side JavaScript

**⚠️ CRITICAL SECURITY ISSUE**

**Fix**:
1. Immediately rotate all exposed secrets:
   - Create new client secret in Azure Portal
   - Update `AZURE_CLIENT_SECRET` in `.env.local` or App Service settings
   - Delete old secret in Azure Portal

2. Verify secrets are never sent to client:
   - Secrets should only be in server-side code
   - API routes in `src/app/api/` are server-side (safe)
   - Components in `src/app/` with `'use client'` are client-side (unsafe for secrets)
   - Never use `process.env.SECRET_NAME` in client components

3. Review codebase for accidental exposure:
   ```bash
   # Search for potential secret usage in client code
   grep -r "AZURE_CLIENT_SECRET" src/app/
   # Should only appear in API routes, never in page.tsx with 'use client'
   ```

---

## Debugging Tools & Techniques

### Browser Developer Tools

**Network Tab**:
- Monitor all API requests and responses
- Check status codes (200 OK, 401 Unauthorized, 403 Forbidden, 429 Rate Limit)
- Inspect request headers (Authorization, Content-Type)
- View response bodies for error messages

**Console Tab**:
- Application logs and errors
- Custom debug output: `console.log(session)`
- React component errors

**Application Tab**:
- Check cookies (especially NextAuth session cookie)
- View localStorage and sessionStorage
- Inspect service workers

### JWT Debugging

**Online Tool**: [https://jwt.ms](https://jwt.ms) (Microsoft's JWT decoder)
- Paste access token
- View claims (aud, scp, roles, exp)
- Verify audience matches API

**Programmatic**:
```javascript
// In src/app/api/debug/route.ts (create if needed)
export async function GET() {
  const session = await auth();
  const token = session?.accessToken;
  if (token) {
    const parts = token.split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    return Response.json({ 
      audience: payload.aud,
      scopes: payload.scp,
      expiration: new Date(payload.exp * 1000),
      roles: payload.roles 
    });
  }
  return Response.json({ error: 'No token' }, { status: 401 });
}
```

### MSAL Logging

Enable verbose MSAL logging in `src/lib/ppToken.ts` or `src/lib/obo.ts`:

```javascript
const cca = new ConfidentialClientApplication({
  auth: { /* ... */ },
  system: { 
    loggerOptions: { 
      loggerCallback(level, message, containsPii) {
        console.log(`[MSAL][${level}]`, message);
      },
      piiLoggingEnabled: false, // Set true only in dev for detailed logs
      logLevel: 'Verbose' // Trace, Debug, Info, Warning, Error, Verbose
    } 
  },
});
```

### Test Scripts

Use included test scripts for diagnostics:

```bash
# Test Power Platform token acquisition
node whoami-powerplatform.js
# Should output: Environments list or error details

# Test MSAL certificate authentication
node test-msal-cert.js
# Should output: Token acquired successfully or error
```

---

## Common Error Codes

### HTTP Status Codes

| Code | Meaning | Common Causes | Fix |
|------|---------|---------------|-----|
| **400 Bad Request** | Malformed request | Invalid query parameters, missing required fields | Check request syntax; see error message for details |
| **401 Unauthorized** | Missing or invalid token | No token, expired token, wrong audience | Verify token is present and valid; check audience claim |
| **403 Forbidden** | Insufficient permissions | Missing API permission or Azure role | Grant required permission; wait 5-10 mins for propagation |
| **404 Not Found** | Resource doesn't exist | Wrong URL, resource deleted, wrong environment | Verify resource ID and URL are correct |
| **429 Too Many Requests** | Rate limit exceeded | Too many requests in short time | Implement retry with exponential backoff; respect Retry-After header |
| **500 Internal Server Error** | Server-side error | Microsoft API issue, transient error | Retry request; check Microsoft service health |
| **502 Bad Gateway** | Upstream service error | Power Platform transient error | Retry after 30-60 seconds |
| **503 Service Unavailable** | Service temporarily down | Maintenance or high load | Retry after 60 seconds; check service health |
| **504 Gateway Timeout** | Request took too long | Complex query, service overload | Reduce query complexity; add pagination; retry |

### Microsoft Graph Errors

| Error Code | Message | Fix |
|------------|---------|-----|
| `Authorization_RequestDenied` | Insufficient privileges | Grant required Graph API permission |
| `ResourceNotFound` | Resource not found | Verify resource ID is correct |
| `InvalidAuthenticationToken` | Token validation failed | Check token audience; ensure not expired |
| `UnsupportedQueryOption` | Invalid query parameter | Remove unsupported parameter; check Graph API docs |

### Azure Errors

| Error Code | Message | Fix |
|------------|---------|-----|
| `AuthorizationFailed` | Not authorized | Assign Azure RBAC role (Reader, Contributor, etc.) |
| `SubscriptionNotFound` | Subscription doesn't exist | Verify AZURE_SUBSCRIPTION_ID is correct |
| `ResourceGroupNotFound` | Resource group doesn't exist | Verify resource group name |

### Dataverse Errors

| Error Code | Message | Fix |
|------------|---------|-----|
| `0x80040220` | Principal user not found | Create application user in environment |
| `0x8004037f` | Insufficient privileges | Assign System Administrator security role to app user |
| `0x80048306` | Entity not found | Verify entity logical name; check if entity exists in environment |

---

## Getting Help

### Before Requesting Support

Collect this information:

1. **Error details**:
   - Full error message
   - HTTP status code
   - Request URL
   - Timestamp

2. **Environment**:
   - Node.js version: `node --version`
   - pnpm version: `pnpm --version`
   - Next.js version: Check `package.json`
   - Operating system

3. **Configuration** (sanitized):
   - Environment variables (without secret values)
   - App registration permissions list
   - Azure role assignments

4. **Steps to reproduce**:
   - What were you trying to do?
   - What did you expect to happen?
   - What actually happened?

5. **Browser console output**:
   - JavaScript errors
   - Network tab failures (screenshot)

### Internal Support Channels

- **GitHub Issues**: [Repository Issues Page](https://github.com/your-repo/issues)
- **IT Help Desk**: Submit ticket with "Portal 360" category
- **Email**: admin-portal-support@company.com

### External Resources

- **Microsoft Graph**: [Graph API Support](https://developer.microsoft.com/en-us/graph/support)
- **Azure Support**: [Azure Portal Support](https://portal.azure.com/#blade/Microsoft_Azure_Support/HelpAndSupportBlade)
- **Power Platform**: [Power Platform Support](https://admin.powerplatform.microsoft.com/support)
- **Microsoft Q&A**: [Microsoft Q&A Forum](https://learn.microsoft.com/en-us/answers/)

### Documentation References

- [API Documentation](./API-DOCUMENTATION.md) - Complete API reference
- [API Endpoints Reference](./API-ENDPOINTS-REFERENCE.md) - Quick endpoint lookup
- [Quick Start Guide](./quick-start.md) - Initial setup
- [Application Installation](./application-installation.md) - Deployment guide

---

## Appendix: Diagnostic Commands

### Check Application Health

```bash
# Verify dependencies
pnpm list --depth=0

# Check for outdated packages
pnpm outdated

# Verify build succeeds
pnpm run build

# Run linting
pnpm run lint

# Check for type errors
pnpm exec tsc --noEmit
```

### Check Azure Configuration

```bash
# List app registrations (requires Azure CLI)
az ad app list --display-name "Portal 360" --output table

# Show app permissions
az ad app show --id <app-id> --query "requiredResourceAccess"

# List service principal role assignments
az role assignment list --assignee <service-principal-id>
```

### Check Power Platform Configuration

```PowerShell
# List environments (requires Power Platform CLI)
pac admin list

# Show environment details
pac admin show --environment <environment-id>
```

### Network Diagnostics

```bash
# Test connectivity to Microsoft endpoints
curl -I https://graph.microsoft.com/v1.0/users
curl -I https://management.azure.com/subscriptions
curl -I https://api.powerplatform.com/environmentmanagement/environments

# Check DNS resolution
nslookup graph.microsoft.com
nslookup login.microsoftonline.com

# Test SSL certificate
openssl s_client -connect graph.microsoft.com:443 -servername graph.microsoft.com
```

---

**Document Version:** 1.0  
**Last Updated:** November 1, 2025  
**Maintained By:** IT Operations & Development Team

For detailed API information, see [API-DOCUMENTATION.md](./API-DOCUMENTATION.md).
