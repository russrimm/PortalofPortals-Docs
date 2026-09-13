# Power Platform Authentication Implementation Guide

## Overview

This document details how Portal 360° implements authentication for Power Platform APIs following Microsoft's official guidance. The implementation provides secure, delegated access to Power Platform resources while maintaining user security context.

## Official Microsoft Documentation

**Primary Reference**: [Authenticate to Power Platform services](https://learn.microsoft.com/en-us/power-platform/admin/security/authenticate-services)

This Microsoft Learn article is the authoritative source for Power Platform authentication and covers:
- OAuth 2.0 flows (Authorization Code, Client Credentials, On-Behalf-Of)
- Token acquisition patterns for different scenarios
- Security best practices and compliance considerations
- API permissions and required admin roles
- Error handling and retry strategies

## Authentication Architecture

### Token Acquisition Flow

Portal 360° uses delegated resource tokens so Power Platform honors the
signed-in administrator's permissions:

```
┌─────────────────────────────────────────────────────────────────┐
│ User Authentication (NextAuth + Entra ID)                       │
│ • Authorization Code Flow                                       │
│ • Initial Scopes: openid, profile, email, offline_access       │
│ • Returns: Access Token, ID Token, Refresh Token               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Power Platform Token Acquisition (src/lib/graphClient.ts)      │
│                                                                 │
│ Step 1: Refresh Token Exchange                                 │
│ • Requests a Power Platform resource token for the user        │
│ • Uses the refresh token issued with offline_access             │
│ • Identifies missing tenant consent as consent_required         │
│                                                                 │
│         ↓ (if Step 1 fails)                                    │
│                                                                 │
│ Step 2: On-Behalf-Of (OBO), when the session assertion was     │
│         issued to Portal 360°                                  │
│ • Does not exchange the Graph-scoped login token                │
│ • Preserves the signed-in user's Power Platform permissions     │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Power Platform API Call                                         │
│ • Bearer token authentication                                   │
│ • User permissions honored                                      │
│ • Audit trail maintained                                        │
└─────────────────────────────────────────────────────────────────┘
```

### Why This Approach?

This delegated strategy provides:

1. **Reliability**: avoids the guaranteed `AADSTS50013` exchange of a Graph-scoped access token
2. **Security**: maintains least privilege with user context
3. **Compliance**: preserves an audit trail for user actions
4. **User Experience**: identifies missing consent without treating it as a sign-in failure

## Implementation Details

### Token Helper Module

**File**: `src/lib/graphClient.ts`

Use the centralized helper for new Power Platform API routes:

```typescript
import { getPowerPlatformTokenForUser } from '@/lib/graphClient'

const token = await getPowerPlatformTokenForUser()
```

`AADSTS65001` means that the tenant has not granted the required delegated
Power Platform scopes. Use `pnpm run verify:consent` to report consent drift,
or have an appropriately privileged Microsoft Entra administrator run
`pnpm run bootstrap:consent` to apply the grants in
`scripts/consent-manifest.json`, then sign in again.

### Token Expiration Handling

The implementation includes automatic token expiration detection with a 5-minute buffer:

```javascript
/**
 * Check if JWT token is expired or will expire soon
 * @param {string} token - JWT token to validate
 * @param {number} bufferSeconds - Expiration buffer (default: 300 = 5 minutes)
 * @returns {boolean} - True if expired or expiring soon
 */
function isTokenExpired(token, bufferSeconds = 300) {
  if (!token) return true;
  
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    const expiryTime = payload.exp * 1000; // Convert to milliseconds
    const currentTime = Date.now();
    const bufferTime = bufferSeconds * 1000;
    
    return (currentTime + bufferTime) >= expiryTime;
  } catch {
    return true; // If can't decode, assume invalid
  }
}
```

**Benefits**:
- Proactive token refresh before expiration
- Reduces authentication failures
- Improves user experience (no unexpected 401 errors)
- Follows Microsoft's best practice of token pre-validation

## API Route Integration

### Example: Tenant Apps API

**File**: `src/app/api/power-platform/tenant-apps/route.ts`

```typescript
import { auth } from '@/lib/auth';
import { getPowerPlatformDelegatedToken } from '@/lib/ppToken';

export async function GET(request: Request) {
  try {
    // 1. Verify user session
    const session = await auth();
    if (!session) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Acquire Power Platform token using OBO flow
    const ppToken = await getPowerPlatformDelegatedToken({
      userAccessToken: session.accessToken,
      userIdToken: session.idToken,
      refreshToken: session.refreshToken
    });

    if (!ppToken) {
      return Response.json(
        { error: 'Failed to acquire Power Platform token' },
        { status: 401 }
      );
    }

    // 3. Call Power Platform API
    const response = await fetch(
      'https://api.powerplatform.com/appmanagement/environments/{id}/applicationpackages',
      {
        headers: {
          'Authorization': `Bearer ${ppToken}`,
          'Accept': 'application/json'
        }
      }
    );

    const data = await response.json();
    return Response.json(data);
    
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
```

### Common API Routes Using This Pattern

All Power Platform API routes follow this authentication pattern:

| Route | Purpose | API Endpoint |
|-------|---------|-------------|
| `/api/power-platform/environments` | List environments | `GET /powerapps/environments` |
| `/api/power-platform/apps` | List Power Apps | `GET /powerapps/environments/{id}/apps` |
| `/api/power-platform/flows` | List Power Automate flows | `GET /powerapps/environments/{id}/flows` |
| `/api/power-platform/tenant-apps` | List tenant apps | `GET /appmanagement/environments/{id}/applicationpackages` |
| `/api/power-platform/connectors` | List connectors | `GET /powerapps/environments/{id}/connectors` |
| `/api/power-platform/licensing/*` | Licensing & capacity | `GET /licensing/*` |
| `/api/power-platform/governance/*` | Governance reports | `GET /governance/*` |

## Required Configuration

### Environment Variables

```bash
# Entra ID App Registration
AZURE_CLIENT_ID=<your-client-id>
AZURE_CLIENT_SECRET=<your-client-secret>
AZURE_TENANT_ID=<your-tenant-id>

# NextAuth Configuration
NEXTAUTH_URL=https://your-app-url.com
NEXTAUTH_SECRET=<random-secret-32-chars>
```

### App Registration Scopes

**Initial Login Scopes** (configured in `src/lib/auth.ts`):
```javascript
authorization: {
  params: {
    scope: 'openid profile email offline_access User.Read'
  }
}
```

**Note**: The `offline_access` scope is critical for refresh token functionality.

### Required Admin Roles

Users must have appropriate Power Platform admin roles assigned in the [Power Platform Admin Center](https://admin.powerplatform.microsoft.com):

| Role | Access Level |
|------|-------------|
| **Power Platform Administrator** | Full tenant access |
| **Dynamics 365 Administrator** | Dataverse & D365 environments |
| **Environment Administrator** | Specific environment access |

**No additional API permissions** need to be granted in the Entra ID app registration for Power Platform API access. The user's assigned roles determine access.

## Security Best Practices

Following Microsoft's guidance, Portal 360° implements these security measures:

### 1. Confidential Client Pattern
- Uses `ConfidentialClientApplication` from `@azure/msal-node`
- Client secret stored securely in environment variables
- Never exposed to client-side code

### 2. Token Security
- Tokens never sent to browser (server-side only)
- Short-lived tokens (1 hour default)
- Automatic refresh before expiration
- Secure session storage with JWT

### 3. Least Privilege
- Uses delegated permissions (user context)
- No application-level permissions for Power Platform
- User's actual permissions enforced
- Full audit trail maintained

### 4. Error Handling
- Graceful fallback when token acquisition fails
- Detailed logging for debugging
- User-friendly error messages
- Retry logic for transient failures

### 5. Production Considerations
- Token caching to reduce API calls
- Rate limiting awareness
- Correlation IDs for debugging
- Monitoring and alerting

## Troubleshooting

### Common Issues

#### 1. "Failed to acquire Power Platform token"

**Causes**:
- User lacks required Power Platform admin role
- Refresh token expired (user needs to re-authenticate)
- Network connectivity issues
- Client credentials misconfigured

**Solutions**:
- Verify user has Power Platform admin role
- Sign out and sign back in
- Check environment variables
- Review server logs for detailed error

#### 2. "AADSTS50076: Due to a configuration change..."

**Cause**: Conditional Access policy requires fresh authentication

**Solution**: Clear session and re-authenticate

#### 3. "The token has expired"

**Cause**: Token expiration buffer too small or clock skew

**Solution**: The 5-minute buffer should prevent this. If recurring, check server time sync.

### Debug Mode

Enable detailed token logging:

```bash
# .env.local
DEBUG_TOKENS=true
```

This will log token acquisition attempts, failures, and timing information to the server console.

## Additional Resources

### Microsoft Documentation
- [Authenticate to Power Platform services](https://learn.microsoft.com/en-us/power-platform/admin/security/authenticate-services) - Primary reference
- [Power Platform API Overview](https://learn.microsoft.com/en-us/power-platform/admin/programmability-overview)
- [Use OAuth with Power Platform API](https://learn.microsoft.com/en-us/power-platform/admin/programmability-authentication)
- [MSAL Node Documentation](https://github.com/AzureAD/microsoft-authentication-library-for-js/tree/dev/lib/msal-node)

### Related Documentation in this Repository
- [API Architecture Diagram](./api-architecture-diagram.md) - Complete flow diagram
- [Power Platform API Permissions](./power-platform-api-permissions.md) - Permission setup
- [Power Platform API Features](./power-platform-api-features.md) - API capabilities
- [API Documentation](./API-DOCUMENTATION.md) - All API endpoints

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2025-12-21 | 1.0 | Initial documentation with Microsoft Learn references |
