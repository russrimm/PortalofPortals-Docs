# Session Validation Implementation

## Overview
The home page now validates the Entra ID (Azure AD) authentication session on first load. If no valid session or token is found, the user is automatically redirected to sign in.

## Implementation Details

### Components Created

#### 1. **useSessionValidation Hook** (`src/hooks/useSessionValidation.ts`)
A custom React hook that:
- Checks the NextAuth session endpoint (`/api/auth/session`)
- Validates that a session exists with valid tokens
- Automatically redirects to sign-in if validation fails
- Returns: `{ isValid, isChecking, error }`

#### 2. **SessionGuard Component** (`src/app/components/SessionGuard.tsx`)
A wrapper component that:
- Uses NextAuth's `useSession` hook for session state
- Shows loading UI while validating
- Redirects to sign-in if unauthenticated or missing tokens
- Preserves callback URL for post-auth redirect

#### 3. **Home Page Updates** (`src/app/page.tsx`)
Enhanced the main page to:
- Validate NextAuth session on mount using `useSession` hook
- Check for access tokens (`accessToken` or `idToken`)
- Fall back to demo auth if NextAuth is not available
- Show loading state during validation
- Auto-redirect to Entra sign-in if no valid session

## How It Works

### Session Validation Flow

```
User loads home page
    ↓
Check NextAuth session status
    ↓
┌─────────────────┬──────────────────┬──────────────────┐
│   Loading       │  Unauthenticated │   Authenticated  │
│   (wait)        │      ↓           │        ↓         │
│                 │  Check demo auth │  Check tokens    │
│                 │      ↓           │        ↓         │
│                 │  If no demo auth │  If no tokens    │
│                 │  → Sign in       │  → Re-auth       │
│                 │                  │        ↓         │
│                 │                  │  Valid session   │
│                 │                  │  → Show content  │
└─────────────────┴──────────────────┴──────────────────┘
```

### Token Validation
The implementation checks for:
- **Session existence**: User has an active NextAuth session
- **Token presence**: Session contains either `accessToken` or `idToken`
- **Demo auth fallback**: If NextAuth is not configured, checks for demo cookie auth

### Automatic Re-authentication
If any validation fails:
1. User is redirected to `/api/auth/signin`
2. Provider is set to `azure-ad` (Entra ID)
3. Callback URL preserves current page path
4. After successful auth, user returns to original page

## Configuration

### NextAuth Setup
Session provider is already configured in `src/app/SessionProviderWrapper.tsx`:
```tsx
<SessionProvider 
  basePath="/api/auth"
  refetchInterval={5 * 60}        // Refresh every 5 minutes
  refetchOnWindowFocus={true}     // Refresh on window focus
>
```

### Token Scopes
Configured in `src/lib/auth.ts`:
- `openid profile email offline_access`
- `User.Read`
- `UserAuthenticationMethod.Read.All`
- `AuditLog.Read.All`
- `Organization.Read.All`
- `https://orgservice.crm.dynamics.com/user_impersonation`

## Usage Examples

### Using SessionGuard (Optional Alternative)
Wrap any page or component to protect it:

```tsx
import SessionGuard from '@/app/components/SessionGuard'

export default function ProtectedPage() {
  return (
    <SessionGuard>
      <YourContent />
    </SessionGuard>
  )
}
```

### Using useSessionValidation Hook (Optional Alternative)
For custom validation logic:

```tsx
import { useSessionValidation } from '@/hooks/useSessionValidation'

function MyComponent() {
  const { isValid, isChecking, error } = useSessionValidation()
  
  if (isChecking) return <LoadingSpinner />
  if (!isValid) return null // Will redirect automatically
  
  return <YourContent />
}
```

### Current Home Page Implementation
The home page uses inline validation with `useSession`:

```tsx
const { data: session, status } = useSession()

useEffect(() => {
  if (status === 'unauthenticated') {
    // No demo auth? Redirect to sign-in
    if (!demoAuth) await signIn('azure-ad')
  }
  if (status === 'authenticated' && !session?.accessToken) {
    // Re-authenticate to get fresh tokens
    await signIn('azure-ad')
  }
}, [session, status])
```

## Testing

### Test Scenarios
1. **No session**: Should redirect to Entra sign-in
2. **Valid session with tokens**: Should show dashboard
3. **Session without tokens**: Should re-authenticate
4. **Demo auth active**: Should bypass NextAuth validation
5. **Session expired**: Should detect on refetch and re-authenticate

### Manual Testing
1. Clear cookies and localStorage
2. Navigate to home page (`/`)
3. Verify redirect to `/api/auth/signin`
4. Sign in with Entra credentials
5. Verify redirect back to home page
6. Check browser DevTools console for validation logs

### Console Logs
The implementation logs validation steps:
- `[Home] No NextAuth session found...`
- `[Home] Valid Entra session detected with tokens`
- `[Home] Session exists but no tokens available...`

## Security Considerations

### Token Storage
- Tokens are stored in JWT (not client-side localStorage)
- Session cookies are httpOnly and secure
- Refresh tokens enable token renewal without re-authentication

### Session Lifetime
- JWT max age: 24 hours (configured in `auth.ts`)
- Auto-refresh: Every 5 minutes (SessionProvider)
- Window focus refresh: Enabled

### Fallback Behavior
- Demo auth for development/testing
- Graceful degradation if NextAuth not configured
- No sensitive data exposed to client

## Troubleshooting

### Issue: Infinite redirect loop
**Cause**: Session validation fails repeatedly
**Solution**: Check environment variables for NextAuth configuration

### Issue: "Session missing tokens" error
**Cause**: OAuth scopes not granted or refresh token expired
**Solution**: Sign out and sign in again to re-consent to scopes

### Issue: Demo auth not working
**Cause**: Cookie not persisting or demo users not recognized
**Solution**: Check browser cookies and DEMO_USERS configuration

## Environment Variables Required

```env
# NextAuth v5
AUTH_SECRET=<random-secret>
AUTH_URL=http://localhost:3000

# Azure AD / Entra ID
AUTH_AZURE_AD_CLIENT_ID=<your-app-id>
AUTH_AZURE_AD_CLIENT_SECRET=<your-client-secret>
AUTH_AZURE_AD_TENANT_ID=<your-tenant-id>

# Alternative v4 names (fallback)
NEXTAUTH_SECRET=<random-secret>
NEXTAUTH_URL=http://localhost:3000
AZURE_CLIENT_ID=<your-app-id>
AZURE_CLIENT_SECRET=<your-client-secret>
AZURE_TENANT_ID=<your-tenant-id>
```

## Related Files
- `src/app/page.tsx` - Home page with validation
- `src/app/components/SessionGuard.tsx` - Reusable guard component
- `src/hooks/useSessionValidation.ts` - Validation hook
- `src/lib/auth.ts` - NextAuth configuration
- `src/app/SessionProviderWrapper.tsx` - Session provider wrapper
- `src/app/layout.tsx` - Root layout with providers

## Future Enhancements
- [ ] Add token refresh on 401 responses
- [ ] Implement token expiry countdown
- [ ] Add session persistence across tabs
- [ ] Add "Remember me" functionality
- [ ] Implement silent token renewal
