# API Authentication Quick Reference

<!-- 
  Copy-paste this template when creating new API routes.
  Every API route MUST verify authentication.
  User-triggered routes MUST use delegated (OBO) tokens — see below.
-->

> **Heads-up:** every user-triggered route in this repo is already
> **delegated (OBO)**. Reach for `getAppOnlyGraphClient({ reason })` only if
> your route is a declared background job listed in
> [`APP-ONLY-JOBS.md`](./APP-ONLY-JOBS.md). See
> [`DELEGATED-AUTH-MIGRATION.md`](./DELEGATED-AUTH-MIGRATION.md).

## 🔑 Graph client cheat sheet

| Helper                                  | Acts as              | When to use                                                                                  |
|-----------------------------------------|----------------------|----------------------------------------------------------------------------------------------|
| `withDelegatedAuth()` *(default)*       | Signed-in user (OBO) | **Almost everywhere.** Any route a human can trigger — reads, writes, admin ops. Wires auth, OBO Graph client, and 401 reauth handling automatically. |
| `getGraphClientForUser()`               | Signed-in user (OBO) | Use when `withDelegatedAuth` is too rigid (custom error handling, multiple Graph clients, etc.). |
| `getDelegatedGraphClient()` *(legacy)*  | Signed-in user (OBO) | Older delegated helper still used by some routes; new code should prefer `withDelegatedAuth` / `getGraphClientForUser`. |
| `getAppOnlyGraphClient({ reason })`     | Service principal    | True background jobs (timers/queues with no user) **or** Graph endpoints that only support Application permissions. Caller must be listed in [`APP-ONLY-JOBS.md`](./APP-ONLY-JOBS.md). |
| `getGraphClient()` *(deprecated)* | Service principal    | Do not use. Retained only so `verify:auth-mode` can flag reintroduction. |

### Non-Graph resources

Every non-Graph API the portal calls has a delegated helper in
`src/lib/graphClient.ts`. Use these — the app-only siblings are `@deprecated`.

| Resource | Delegated helper | Per-user prerequisite |
|---|---|---|
| Azure Resource Manager | `getAzureTokenForUser()` | Azure RBAC at the target scope |
| Exchange Online (EWS) | `getExchangeTokenForUser()` | Exchange admin role |
| Exchange / OWA internal | `getExchangeOwaTokenForUser()` | Exchange admin role |
| M365 Admin Center | `getAdminCenterTokenForUser()` | M365 admin role |
| AI Foundry | `getAIFoundryTokenForUser()` | Azure RBAC on the Foundry account |
| Power Platform API | `getPowerPlatformTokenForUser()` | Power Platform Administrator |
| BAP (`api.bap.microsoft.com`) | `getBapTokenForUser()` | Power Platform Administrator |
| Power Apps service | `getPowerAppsTokenForUser()` | Power Platform Administrator |
| Dataverse | `getDataverseTokenForUser(orgUrl)` | Security role in the target org |
| Defender | `getDefenderTokenForUser()` | Security Reader / Administrator |
| Purview Compliance | `getPurviewComplianceTokenForUser()` | Compliance admin role |
| SharePoint | `getSharePointTokenForUser(origin)` | Site access / SharePoint admin |
| Azure OpenAI | `getCognitiveServicesTokenForUser()` | `Cognitive Services OpenAI User` on the resource |
| Log Analytics | `getLogAnalyticsTokenForUser()` | `Log Analytics Reader` on the workspace |
| Application Insights | `getLogAnalyticsTokenForUser()` | `Reader`/`Monitoring Reader` on the component **and** its Log Analytics workspace |

If you're not sure, use `withDelegatedAuth()`. Verify the endpoint's
supported permissions in the [Microsoft Graph permissions reference](https://learn.microsoft.com/graph/permissions-reference)
before choosing app-only.

For Dataverse, use `getUserDataverseToken(instanceUrl)` from
`src/lib/dataverseDelegated.ts`. It reads the current user's tokens from the
server-side token store and never falls back to the application identity.

## 🚀 Quick Start Template (delegated, default)

```typescript
import { NextResponse } from 'next/server'
import { withDelegatedAuth } from '@/lib/api-auth'

// ✅ Auth, OBO Graph client, and 401 reauth handling all wired automatically.
export const GET = withDelegatedAuth(async (_request, _session, { graph }) => {
  const data = await graph.api('/your-endpoint').get()
  return NextResponse.json(data)
})
```

If `withDelegatedAuth` is too rigid for your handler, use the explicit form:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import {
  verifyAuth,
  UNAUTHORIZED_RESPONSE,
  reauthRequiredResponse,
} from '@/lib/api-auth'
import { getGraphClientForUser } from '@/lib/graphClient'
import { isDelegatedAuthRequiredError } from '@/lib/auth/errors'

export async function GET(_request: NextRequest) {
  const session = await verifyAuth()
  if (!session) return UNAUTHORIZED_RESPONSE()

  try {
    const graph = await getGraphClientForUser()
    const data = await graph.api('/your-endpoint').get()
    return NextResponse.json(data)
  } catch (err) {
    if (isDelegatedAuthRequiredError(err)) {
      return reauthRequiredResponse(err.reason, err.requiredScopes)
    }
    console.error('Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

## 🛠 App-only (background jobs only)

```typescript
// src/jobs/inventory-sync.ts
import { getAppOnlyGraphClient } from '@/lib/auth/appOnly'

export async function run() {
  const graph = await getAppOnlyGraphClient({
    reason: 'Tenant-wide nightly user inventory sync',
    jobId: 'inventory-sync',
  })
  // ...
}
```

App-only callers MUST be listed in [`APP-ONLY-JOBS.md`](./APP-ONLY-JOBS.md)
and classified as `"B"` in `auth-mode-classifications.json`.

---

## Legacy template (deprecated)

The patterns below use the older `getDelegatedGraphClient()` helper. It is
still correct (delegated) but new code should prefer `withDelegatedAuth` /
`getGraphClientForUser`.

### Basic API Route (GET)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getDelegatedGraphClient, DelegatedAuthError } from '@/lib/delegatedGraph'
import { verifyAuth, UNAUTHORIZED_RESPONSE } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  // ✅ REQUIRED: Verify authentication first
  const session = await verifyAuth()
  if (!session) return UNAUTHORIZED_RESPONSE()

  try {
    // Runs Graph as the signed-in user via OBO
    const client = await getDelegatedGraphClient()
    const data = await client.api('/your-endpoint').get()
    
    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof DelegatedAuthError) {
      // No session tokens (e.g. cookie expired) — ask the user to sign in again
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

### API Route with POST/PUT/DELETE

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getDelegatedGraphClient, DelegatedAuthError } from '@/lib/delegatedGraph'
import { verifyAuth, UNAUTHORIZED_RESPONSE, createErrorResponse } from '@/lib/api-auth'

export async function POST(request: NextRequest) {
  // ✅ REQUIRED: Verify authentication
  const session = await verifyAuth()
  if (!session) return UNAUTHORIZED_RESPONSE()

  try {
    const body = await request.json()
    
    // Validate input
    if (!body.name) {
      return createErrorResponse('Name is required', 400)
    }

    // Mutation runs as the signed-in user (audit trail attributes correctly)
    const client = await getDelegatedGraphClient()
    const result = await client.api('/your-endpoint').post(body)
    
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    if (error instanceof DelegatedAuthError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error:', error)
    return createErrorResponse('Failed to create resource', 500, error)
  }
}
```

### API Route with Dynamic Parameters

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getDelegatedGraphClient, DelegatedAuthError } from '@/lib/delegatedGraph'
import { verifyAuth, UNAUTHORIZED_RESPONSE } from '@/lib/api-auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // ✅ REQUIRED: Verify authentication
  const session = await verifyAuth()
  if (!session) return UNAUTHORIZED_RESPONSE()

  try {
    const { id } = await params
    
    const client = await getDelegatedGraphClient()
    const data = await client.api(`/your-endpoint/${id}`).get()
    
    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof DelegatedAuthError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    console.error('Error:', error)
    return NextResponse.json(
      { error: 'Resource not found' },
      { status: 404 }
    )
  }
}
```

### App-only template (rare — only when a delegated token won't work)

```typescript
import { NextRequest, NextResponse } from 'next/server'
// app-only on purpose: <one-line reason — e.g. "Graph subscriptions are bound
// to the calling app principal for their full lifetime">.
import { getAppOnlyGraphClient } from '@/lib/auth/appOnly'
import { verifyAuth, UNAUTHORIZED_RESPONSE } from '@/lib/api-auth'

export async function POST(request: NextRequest) {
  const session = await verifyAuth()
  if (!session) return UNAUTHORIZED_RESPONSE()

  const client = await getAppOnlyGraphClient({ reason: '<why this cannot be delegated>' })
  // ...
}
```


### Multiple HTTP Methods

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getDelegatedGraphClient } from '@/lib/delegatedGraph'
import { verifyAuth, UNAUTHORIZED_RESPONSE } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  const session = await verifyAuth()
  if (!session) return UNAUTHORIZED_RESPONSE()
  
  // GET logic here
}

export async function POST(request: NextRequest) {
  const session = await verifyAuth()
  if (!session) return UNAUTHORIZED_RESPONSE()
  
  // POST logic here
}

export async function DELETE(request: NextRequest) {
  const session = await verifyAuth()
  if (!session) return UNAUTHORIZED_RESPONSE()
  
  // DELETE logic here
}
```

---

## 🔍 Available Auth Utilities

### From `/src/lib/api-auth.ts`:

```typescript
import { 
  verifyAuth,              // Main auth check function
  UNAUTHORIZED_RESPONSE,   // 401 response
  FORBIDDEN_RESPONSE,      // 403 response
  isAdmin,                 // Check if user is admin
  getUserEmail,            // Extract user email
  createErrorResponse,     // Create standardized error
  withAuth,                // HOF wrapper (alternative)
} from '@/lib/api-auth'
```

### Usage Examples

#### Basic Authentication Check
```typescript
const session = await verifyAuth()
if (!session) return UNAUTHORIZED_RESPONSE()
```

#### Admin-Only Endpoint
```typescript
const session = await verifyAuth()
if (!session) return UNAUTHORIZED_RESPONSE()
if (!isAdmin(session)) return FORBIDDEN_RESPONSE()
```

#### Get User Email
```typescript
const session = await verifyAuth()
if (!session) return UNAUTHORIZED_RESPONSE()

const email = getUserEmail(session)
console.log('Request from:', email)
```

#### Custom Error Response
```typescript
return createErrorResponse(
  'Invalid request parameters',
  400,
  { field: 'name', reason: 'required' }
)
```

#### Higher-Order Function (Alternative Pattern)
```typescript
export const GET = withAuth(async (request, session) => {
  // session is guaranteed to exist here
  const email = session.user?.email
  // Your logic...
})
```

---

## ❌ Common Mistakes

### 1. Forgetting Auth Check
```typescript
// ❌ WRONG - No auth check
export async function GET(request: NextRequest) {
  const client = await getDelegatedGraphClient()
  // Publicly accessible!
}

// ✅ CORRECT
export async function GET(request: NextRequest) {
  const session = await verifyAuth()
  if (!session) return UNAUTHORIZED_RESPONSE()
  
  const client = await getDelegatedGraphClient()
  // Protected
}
```

### 2. Checking Auth After Business Logic
```typescript
// ❌ WRONG - Auth check too late
export async function GET(request: NextRequest) {
  const data = await fetchSensitiveData() // Executes before auth!
  
  const session = await verifyAuth()
  if (!session) return UNAUTHORIZED_RESPONSE()
}

// ✅ CORRECT - Auth check first
export async function GET(request: NextRequest) {
  const session = await verifyAuth()
  if (!session) return UNAUTHORIZED_RESPONSE()
  
  const data = await fetchSensitiveData() // Only if authenticated
}
```

### 3. Only Protecting GET, Not POST/PUT/DELETE
```typescript
// ❌ WRONG - Only GET is protected
export async function GET(request: NextRequest) {
  const session = await verifyAuth()
  if (!session) return UNAUTHORIZED_RESPONSE()
  // ...
}

export async function DELETE(request: NextRequest) {
  // Unprotected! Anyone can delete
}

// ✅ CORRECT - All methods protected
export async function GET(request: NextRequest) {
  const session = await verifyAuth()
  if (!session) return UNAUTHORIZED_RESPONSE
  // ...
}

export async function DELETE(request: NextRequest) {
  const session = await verifyAuth()
  if (!session) return UNAUTHORIZED_RESPONSE()
  // ...
}
```

### 4. Using App-Only Auth Without Justification
```typescript
// ❌ WRONG — reaches for app-only credentials even though the call is
// user-initiated. RBAC is bypassed, audit trail attributes everything to
// the service principal.
export async function GET(request: NextRequest) {
  const session = await verifyAuth()
  if (!session) return UNAUTHORIZED_RESPONSE()
  
  const client = await getAppOnlyGraphClient({ reason: '<why this cannot be delegated>' }) // app-only — wrong default
  return NextResponse.json(await client.api('/users').get())
}

// ✅ CORRECT — default to delegated; only fall back to app-only with a
// documented reason (background job, app-only-only endpoint, etc.)
export async function GET(request: NextRequest) {
  const session = await verifyAuth()
  if (!session) return UNAUTHORIZED_RESPONSE()
  
  const client = await getDelegatedGraphClient()
  return NextResponse.json(await client.api('/users').get())
}
```

---

## ✅ Checklist for New API Routes

Before committing a new API route, verify:

- [ ] Imported `verifyAuth` and `UNAUTHORIZED_RESPONSE` from `@/lib/api-auth`
- [ ] Called `verifyAuth()` at the **start** of **every** HTTP method handler
- [ ] Returned a fresh `UNAUTHORIZED_RESPONSE()` if session is null
- [ ] Auth check happens **before** any business logic
- [ ] All HTTP methods (GET, POST, PUT, PATCH, DELETE) are protected
- [ ] **Default to `getDelegatedGraphClient()`** — only use `getAppOnlyGraphClient({ reason })` for a background job listed in `APP-ONLY-JOBS.md`
- [ ] If using delegated, caught `DelegatedAuthError` and returned 401 (so an expired session re-prompts sign-in)
- [ ] No tokens or sensitive data exposed in error responses
- [ ] Tested unauthenticated access returns 401
- [ ] Tested authenticated access works correctly

---

## 🧪 Testing Your API Route

### Test 1: Unauthenticated Access (Should Return 401)

```bash
curl -i http://localhost:3000/api/your-endpoint

# Expected Response:
# HTTP/1.1 401 Unauthorized
# {"error":"Unauthorized","message":"Authentication required. Please sign in."}
```

### Test 2: Authenticated Access (Should Succeed)

```typescript
// In browser console or test file
fetch('/api/your-endpoint')
  .then(r => r.json())
  .then(console.log)
// Should return data if logged in, 401 if not
```

### Test 3: Browser DevTools
1. Open DevTools → Application → Cookies
2. Check for `next-auth.session-token`
3. Delete the cookie
4. Try API call → Should get 401
5. Log in again
6. Try API call → Should succeed

---

## 📚 Reference Links

- **Full Documentation:** [`docs/api-authentication-security-fix.md`](../docs/api-authentication-security-fix.md)
- **Auth Utilities:** [`src/lib/api-auth.ts`](../src/lib/api-auth.ts)
- **Audit Report:** [`API-AUTH-AUDIT.md`](./API-AUTH-AUDIT.md)
- **BFF Security:** [`.github/copilot-instructions.md`](../.github/copilot-instructions.md)

---

## 🆘 Need Help?

**"My auth check isn't working"**
- Verify `AUTH_SECRET` is set in `.env.local`
- Check NextAuth configuration in `src/lib/auth.ts`
- Look for errors in terminal logs
- Test session with: `console.log(await verifyAuth())`

**"Getting 401 even when logged in"**
- Check browser cookies (DevTools → Application)
- Verify cookie domain matches your URL
- Check for CORS issues in Network tab
- Ensure `trustHost: true` in `src/lib/auth.ts`

**"Want to test without authentication (development only)"**
- **DO NOT** disable auth checks in code
- Use a test account and sign in properly
- Consider seeding test data instead

---

**Remember:** Every API route is a potential security vulnerability if not properly protected. When in doubt, add authentication! 🔒
