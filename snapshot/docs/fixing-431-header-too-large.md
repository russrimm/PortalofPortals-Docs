# Fixing 431 Header Too Large Errors

## Problem
The application was experiencing `431 Request Header Fields Too Large` errors in Azure App Service. This was caused by storing large OAuth tokens (access token, ID token, refresh token) directly in the NextAuth session object, which gets serialized into session cookies.

## Root Cause
- NextAuth JWT strategy stores the entire JWT in a session cookie
- The JWT contained: `accessToken` (~2-4KB), `idToken` (~1-2KB), `refreshToken` (~200 bytes)
- Combined with other cookies, this exceeded Azure App Service's default header size limit (typically 16-32KB)

## Solution
**Remove tokens from the session object** and access them server-side only by decoding the JWT directly.

### Changes Made

#### 1. Updated `src/lib/auth.ts`
- Removed `accessToken`, `idToken`, `refreshToken` from Session interface
- Updated `session()` callback to NOT pass tokens to client session
- Added cookie configuration with `__Secure` prefix for production

#### 2. Created `src/lib/getServerToken.ts`
New helper functions for server-side token access:
- `getServerAccessToken()` - Get access token from JWT
- `getServerIdToken()` - Get ID token from JWT  
- `getServerRefreshToken()` - Get refresh token from JWT
- `getServerTokens()` - Get all tokens at once (most efficient)

### Migration Guide

#### Before (❌ Old - causes 431 errors)
```typescript
// In API route
export async function GET(request: Request) {
  const session = await auth()
  const accessToken = session?.accessToken // ❌ No longer available
  
  const response = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
  
  return Response.json(await response.json())
}
```

#### After (✅ New - no 431 errors)
```typescript
// In API route
import { getServerAccessToken } from '@/lib/getServerToken'

export async function GET(request: Request) {
  const accessToken = await getServerAccessToken()
  
  if (!accessToken) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const response = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
  
  return Response.json(await response.json())
}
```

#### For Multiple Tokens (✅ Best Practice)
```typescript
// In API route
import { getServerTokens } from '@/lib/getServerToken'

export async function POST(request: Request) {
  const { accessToken, idToken, refreshToken } = await getServerTokens()
  
  if (!accessToken) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // Use tokens...
}
```

### Files That Need Migration

Search for these patterns and update:
```bash
# Find files accessing tokens from session
grep -r "session\.accessToken" src/
grep -r "session\.idToken" src/
grep -r "session\.refreshToken" src/
```

Common files that need updates:
- API routes: `src/app/api/**/*.{ts,js}`
- Server components accessing tokens
- Any file using `useSession()` that checks for tokens

### Client-Side Token Access (❌ Not Allowed)
**Tokens should NEVER be accessed client-side**. If you have client components that need authenticated API calls:

1. Create an API route that uses tokens server-side
2. Call that API route from your client component
3. The API route handles token refresh and API calls

```typescript
// ❌ BAD - Don't do this
'use client'
import { useSession } from 'next-auth/react'

export default function MyComponent() {
  const { data: session } = useSession()
  const token = session?.accessToken // ❌ Undefined - not in session
  
  // Make API call with token...
}

// ✅ GOOD - Use API route instead
'use client'
export default function MyComponent() {
  const handleAction = async () => {
    const response = await fetch('/api/my-endpoint')
    const data = await response.json()
    // Use data...
  }
  
  return <button onClick={handleAction}>Do Something</button>
}
```

### Testing the Fix

1. **Deploy to Azure** - The 431 error only occurs in production/Azure
2. **Check session cookie size**:
   ```javascript
   // In browser console on Azure site
   document.cookie.split(';').forEach(c => {
     console.log(c.trim().split('=')[0], c.length)
   })
   ```
   - Session cookie should be < 4KB (was 8-12KB before)

3. **Verify token access**:
   - Test API routes that use `getServerTokens()`
   - Verify Microsoft Graph calls still work
   - Check Power Platform API calls

### Benefits

1. **No more 431 errors** - Session cookies are much smaller
2. **Better security** - Tokens never sent to client
3. **Faster page loads** - Smaller cookies = less data transfer
4. **Same functionality** - All features work the same server-side

### Notes

- Tokens are still stored in JWT (encrypted server-side)
- JWT is still in a cookie, but it's not expanded into session properties
- This is the recommended NextAuth pattern for large tokens
- Client components can still use `useSession()` for user info and role
