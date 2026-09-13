# Power Automate Flow Token Claims Implementation

## Issue Description
When exporting a solution and choosing option 3 (send to Power Automate flow), the HTTP trigger requires specific JWT claims in the authorization token: `aud` (audience), `iss` (issuer), and `tid` (tenant ID).

## Root Cause
Power Automate HTTP triggers with Azure AD OAuth authentication require tokens to contain specific claims as per Microsoft documentation:
- **aud**: Audience of the flow service (e.g., `https://service.flow.microsoft.com/` for public cloud)
- **iss**: Issuer of the requestor (Azure AD STS)
- **tid**: Tenant ID of the requestor
- **oid**: Object ID of the requestor (optional, required only for specific user restrictions)

Reference: [Add OAuth authentication for HTTP request triggers](https://learn.microsoft.com/en-us/power-automate/oauth-authentication#choose-the-claims-for-your-http-request)

## Solution Implemented

### 1. Token Validation Function
Added a comprehensive JWT token validation function in `src/app/api/power-platform/send-to-flow/route.js`:

```javascript
/**
 * Decode JWT token without verification (for claim inspection)
 * Returns the decoded payload or null if invalid
 */
function decodeJwt(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1], 'base64url').toString('utf-8');
    return JSON.parse(payload);
  } catch (err) {
    console.error('[Token Decode] Error:', err.message);
    return null;
  }
}

/**
 * Validate that token contains required claims for Power Automate HTTP trigger
 * Required claims: aud, iss, tid
 */
function validateFlowTokenClaims(token) {
  const claims = decodeJwt(token);
  if (!claims) {
    return { valid: false, error: 'Token cannot be decoded' };
  }

  // Check for missing required claims
  const requiredClaims = ['aud', 'iss', 'tid'];
  const missingClaims = requiredClaims.filter(claim => !claims[claim]);
  
  if (missingClaims.length > 0) {
    return { 
      valid: false, 
      error: `Token missing required claims: ${missingClaims.join(', ')}`,
      claims
    };
  }

  // Validate audience for Power Automate
  const validAudiences = [
    'https://service.flow.microsoft.com/',
    'https://service.flow.microsoft.com',
    'https://gov.service.flow.microsoft.us/',      // Government Community Cloud (GCC)
    'https://high.service.flow.microsoft.us/',     // Government Community Cloud High (GCCH)
    'https://service.powerautomate.cn/',          // China
    'https://service.flow.appsplatform.us/'       // Department of Defense (DOD)
  ];
  
  const isValidAudience = validAudiences.some(validAud => 
    claims.aud === validAud || claims.aud.startsWith(validAud)
  );
  
  if (!isValidAudience) {
    return {
      valid: false,
      error: `Token audience (${claims.aud}) is not valid for Power Automate`,
      claims
    };
  }

  return { 
    valid: true, 
    claims,
    summary: {
      aud: claims.aud,
      iss: claims.iss,
      tid: claims.tid,
      oid: claims.oid,
      sub: claims.sub
    }
  };
}
```

### 2. Integration into Send-to-Flow Route
The validation function is now called before sending data to the Power Automate flow:

```javascript
// Get Power Automate-specific token
const flowToken = await getPowerAutomateDelegatedToken({
  userAccessToken: session.accessToken,
  userIdToken: session.idToken,
  refreshToken: session.refreshToken
});

// Validate token contains required claims (aud, iss, tid)
const validation = validateFlowTokenClaims(flowToken);
if (!validation.valid) {
  console.error('[Send to Flow] Token validation failed:', validation.error);
  console.error('[Send to Flow] Token claims:', validation.claims);
  return Response.json({
    error: 'Token validation failed',
    message: validation.error,
    details: 'The token does not contain the required claims (aud, iss, tid) for Power Automate HTTP trigger authentication.'
  }, { status: 401 });
}

console.log('[Send to Flow] Token validation successful:', validation.summary);
headers['Authorization'] = `Bearer ${flowToken}`;
```

### 3. Enhanced Token Generation Documentation
Updated `src/lib/ppToken.js` with better documentation:

```javascript
export async function getPowerAutomateDelegatedToken({ userAccessToken, userIdToken, refreshToken }) {
  // Power Automate (Flow) API uses a different resource endpoint
  // Reference: https://learn.microsoft.com/en-us/rest/api/power-platform/powerautomate/flow-runs/list-flow-runs
  // Requires audience: https://service.flow.microsoft.com/
  // Required claims for HTTP trigger authentication: aud, iss, tid, oid
  // Reference: https://learn.microsoft.com/en-us/power-automate/oauth-authentication#choose-the-claims-for-your-http-request
  const scopes = ['https://service.flow.microsoft.com/.default'];
  const app = getCca();
  
  // 1) Try OBO with access token
  // 2) Try OBO with id token  
  // 3) Try refresh token exchange
  
  // Standard MSAL OBO flow automatically includes aud, iss, tid claims in the token
}
```

## Validation & Testing

### Expected Token Claims
A valid Power Automate token should contain:

```json
{
  "aud": "https://service.flow.microsoft.com/",
  "iss": "https://sts.windows.net/{tenant-id}/",
  "tid": "{tenant-id-guid}",
  "oid": "{user-object-id}",
  "sub": "{user-subject}",
  "exp": 1234567890,
  "nbf": 1234567890,
  "iat": 1234567890
}
```

### Testing Steps
1. Navigate to Power Platform environments page
2. Select an environment with solutions
3. Export a solution
4. Choose option 3: "Send directly to Power Automate flow"
5. Enter a flow URL (with OAuth authentication, not SAS)
6. Submit the request

### Error Scenarios Handled
1. **Token missing required claims**: Returns 401 with specific missing claims listed
2. **Invalid audience**: Returns 401 with expected vs actual audience values
3. **Token decode failure**: Returns 401 with decoding error
4. **Token acquisition failure**: Returns 401 with MSAL error details

### Success Indicators
- Console logs show: `[Send to Flow] Token validation successful: { aud, iss, tid, oid, sub }`
- Flow receives authenticated request with valid Bearer token
- Solution data is successfully sent to Power Automate flow

## Technical Details

### Cloud-Specific Audience Values
The validation supports all Microsoft cloud environments:

| Cloud Type | Audience Value |
|-----------|----------------|
| Public cloud | `https://service.flow.microsoft.com/` |
| Government Community Cloud (GCC) | `https://gov.service.flow.microsoft.us/` |
| Government Community Cloud High (GCCH) | `https://high.service.flow.microsoft.us/` |
| China | `https://service.powerautomate.cn/` |
| Department of Defense (DOD) | `https://service.flow.appsplatform.us/` |

### MSAL Token Acquisition
The `getPowerAutomateDelegatedToken` function uses a 3-tier fallback strategy:
1. **On-Behalf-Of (OBO) with access token** - Preferred method
2. **OBO with ID token** - Fallback if access token fails
3. **Refresh token exchange** - Final fallback for expired sessions

Azure AD automatically includes the required claims (`aud`, `iss`, `tid`) in tokens issued via these methods.

## Files Modified
1. `src/app/api/power-platform/send-to-flow/route.js` - Added token validation
2. `src/lib/ppToken.js` - Enhanced documentation

## Related Documentation
- [Power Automate OAuth Authentication](https://learn.microsoft.com/en-us/power-automate/oauth-authentication)
- [Azure AD Access Tokens](https://learn.microsoft.com/en-us/entra/identity-platform/access-tokens)
- [Access Token Claims Reference](https://learn.microsoft.com/en-us/entra/identity-platform/access-token-claims-reference)

## Summary
The implementation adds robust token validation to ensure Power Automate HTTP triggers receive properly-formed JWT tokens with all required claims. This prevents authentication failures and provides clear error messages when token validation fails, making it easier to diagnose permission or configuration issues.
