# API Authentication Security Fix

**Date:** February 2, 2026 (initial) · June 1, 2026 (delegated-Graph follow-up)  
**Severity:** 🔴 CRITICAL → ✅ RESOLVED  
**Status:** ✅ Complete — every route gated with `verifyAuth()` AND defaults to delegated Graph (OBO)

---

## 📋 Executive Summary

Two waves of work:

1. **Wave 1 (Feb 2026).** A critical vulnerability where **75 of 130 API routes
   (58%)** were publicly accessible without authentication. All routes were
   gated with `verifyAuth()` and the missing `src/lib/api-auth.ts` utility was
   introduced.
2. **Wave 2 (Jun 2026).** Even after wave 1, Graph/Azure calls inside those
   routes were still **app-only** (client credentials), so they ran as the
   service principal instead of as the signed-in user — bypassing per-user RBAC
   and breaking audit attribution. **202 files** in `src/app/` and `src/lib/`
   were migrated to a new delegated/OBO helper
   (`src/lib/delegatedGraph.ts → getDelegatedGraphClient()`). Only 3 routes
   stay on `getGraphClient()`, each with an inline `// app-only on purpose:`
   justification.

3. **Wave 3 (Aug 2026).** The remaining `getGraphToken()` / `getAzureToken()` /
   `getExchangeToken()` / Power Platform / Dataverse / Defender / Purview /
   Azure OpenAI / Azure Monitor **app-only** call sites were migrated to
   delegated helpers. App-only call sites went from **231 → 34**, and the 34 are
   the deprecated helper definitions plus the sanctioned background surfaces.
   `pnpm run verify:auth-mode` now reports
   `U-classified routes still on app-only: 0`, and
   `pnpm run verify:graph-app-perms` reports **8 of 10** Graph application
   permissions retirable.

### Outcomes

- ✅ Every API route verifies the user session before any other work.
- ✅ Every user-triggered Graph/Azure call runs as the signed-in user (OBO),
  so user-level RBAC is enforced and the audit trail attributes actions to
  the human who took them.
- ✅ Reusable utilities: [`/src/lib/api-auth.ts`](../src/lib/api-auth.ts),
  [`/src/lib/delegatedGraph.ts`](../src/lib/delegatedGraph.ts).
- ✅ Migration tooling kept in tree:
  [`scripts/migrate-to-delegated-graph.cjs`](../scripts/migrate-to-delegated-graph.cjs).
- ✅ Per-route audit: [`docs/API-AUTH-AUDIT.md`](./API-AUTH-AUDIT.md).

---

## 🔐 The Vulnerability

### Wave 1 — missing session checks

Most API routes had **no session verification at all** and relied on
**App-Only (Client Credentials)** authentication via `getGraphClient()`. That
meant any caller who knew the URL could hit the endpoint and the route would
happily fetch data as the service principal:

- ❌ No verification that a user is logged in
- ❌ No session validation
- ❌ Direct API access without authentication
- ❌ Potential data breach exposure

### Wave 2 — privilege escalation via app-only

After every route was gated with `verifyAuth()`, authenticated users could
still trigger Graph/Azure calls that ran as the **service principal**, not
themselves:

- ❌ User-level RBAC was bypassed — any signed-in user effectively had the
  full app-permission scope.
- ❌ Audit trail attributed every change to the app, so we couldn't answer
  "who did this?".
- ❌ Least-privilege was weaker than the spec implied.

### Example of Vulnerable Code

```typescript
// ❌ BEFORE (wave 1) — no session check at all
export async function GET(request: NextRequest) {
  const client = await getGraphClient() // app-only, no user check
  const users = await client.api('/users').get()
  return NextResponse.json(users)
}

// ❌ AFTER WAVE 1 — session checked, but still runs as the service principal
export async function GET(request: NextRequest) {
  const session = await verifyAuth()
  if (!session) return UNAUTHORIZED_RESPONSE
  
  const client = await getGraphClient() // app-only — bypasses user RBAC
  return NextResponse.json(await client.api('/users').get())
}

// ✅ AFTER WAVE 2 — runs as the signed-in user via OBO
export async function GET(request: NextRequest) {
  const session = await verifyAuth()
  if (!session) return UNAUTHORIZED_RESPONSE
  
  const client = await getDelegatedGraphClient()
  return NextResponse.json(await client.api('/users').get())
}
```

### Attack Scenario (wave 1)

```bash
# Before wave 1 — attacker could directly call the API without logging in
curl https://yourapp.com/api/users
# Returns full user directory without authentication ❌
```

---

## ✅ The Solution

### 1. Authentication Utility Module

Created `/src/lib/api-auth.ts` with reusable authentication helpers:

```typescript
import { verifyAuth, UNAUTHORIZED_RESPONSE } from '@/lib/api-auth'

// Method 1: Manual check (recommended for flexibility)
export async function GET(request: NextRequest) {
  const session = await verifyAuth()
  if (!session) return UNAUTHORIZED_RESPONSE
  
  // Your protected API logic here
  const client = await getGraphClient()
  // ...
}

// Method 2: Higher-order function (cleaner but less flexible)
export const GET = withAuth(async (request, session) => {
  // session is guaranteed to be authenticated
  const client = await getGraphClient()
  // ...
})
```

### 2. BFF Security Architecture

This follows the **Backend-for-Frontend (BFF)** security model:

- ✅ **Browser** → HttpOnly session cookie (no tokens exposed)
- ✅ **API Routes** → Verify session server-side
- ✅ **Backend** → Use tokens to call Graph/Azure APIs
- ✅ **Never** expose access tokens to client

### 3. Fixed Routes

#### User Management (4 routes)
- ✅ `/api/users` - User directory listing
- ✅ `/api/users/[id]` - User details (GET, PATCH)
- ✅ `/api/users/licenses` - User license information
- ✅ `/api/users/groups` - User group memberships

#### Azure Security (4 routes)
- ✅ `/api/azure/security/assessments` - Security assessments
- ✅ `/api/azure/security/compliance-results` - Compliance data
- ✅ `/api/azure/security/allowed-connections` - Network security
- ✅ `/api/azure/sql-databases` - SQL databases (GET, POST, PUT)

#### Entitlement Management (2 routes)
- ✅ `/api/entitlement/catalogs` - Access package catalogs (GET, POST)
- ✅ `/api/applications` - App registrations (POST)

---

## 🚨 Remaining Vulnerable Routes

**60+ routes still need to be fixed.** See [`API-AUTH-AUDIT.md`](./API-AUTH-AUDIT.md) for the complete list.

### High Priority Routes (Fix Next)

1. **Azure Virtual Desktop** (5 routes)
   - `/api/azure/virtual-desktop/**`
   
2. **Azure Quota & Resources** (3 routes)
   - `/api/azure/quota-requests`
   - `/api/azure/redis-caches`
   - `/api/azure/service-health-events`

3. **Entitlement Management** (17+ routes)
   - `/api/entitlement/access-packages/**`
   - `/api/entitlement/assignments/**`
   - `/api/entitlement/catalogs/**`

4. **Power Platform Dataverse** (6 routes)
   - `/api/power-platform/dataverse/**`
   - `/api/power-platform/capacity`

5. **Microsoft 365** (10+ routes)
   - `/api/microsoft365/**`
   - `/api/subscribed-skus`
   - `/api/licenses/**`

---

## 🛠️ How to Fix Remaining Routes

### Step-by-Step Guide

#### 1. Add Import Statement

At the top of the route file, add:

```typescript
import { verifyAuth, UNAUTHORIZED_RESPONSE } from '@/lib/api-auth'
```

#### 2. Add Auth Check at Start of Handler

```typescript
export async function GET(request: NextRequest) {
  // ✅ ADD THIS CHECK FIRST
  const session = await verifyAuth()
  if (!session) return UNAUTHORIZED_RESPONSE

  // Rest of your existing code
  try {
    // ...
  }
}
```

#### 3. Repeat for All HTTP Methods

Make sure to add the check to **ALL methods** in the file:
- `GET`
- `POST`
- `PUT`
- `PATCH`
- `DELETE`

### Example: Complete Fix

**Before:**
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getGraphClient } from '@/lib/graphClient'

export async function GET(request: NextRequest) {
  try {
    const client = await getGraphClient()
    const data = await client.api('/some/endpoint').get()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
```

**After:**
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getGraphClient } from '@/lib/graphClient'
import { verifyAuth, UNAUTHORIZED_RESPONSE } from '@/lib/api-auth'

export async function GET(request: NextRequest) {
  // ✅ Authentication check
  const session = await verifyAuth()
  if (!session) return UNAUTHORIZED_RESPONSE

  try {
    const client = await getGraphClient()
    const data = await client.api('/some/endpoint').get()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
```

---

## 🧪 Testing Authentication

### Test 1: Unauthenticated Access (Should Fail)

```bash
# Without authentication cookie
curl http://localhost:3000/api/users
# Expected: {"error":"Unauthorized","message":"Authentication required. Please sign in."}
# Status: 401
```

### Test 2: Authenticated Access (Should Succeed)

```bash
# With authentication cookie
curl http://localhost:3000/api/users -H "Cookie: next-auth.session-token=..."
# Expected: {"value":[...users...]}
# Status: 200
```

### Test 3: Browser DevTools

1. Open browser DevTools (F12)
2. Navigate to **Application** → **Cookies**
3. Verify you see: `next-auth.session-token` (or `__Secure-next-auth.session-token` in production)
4. Try accessing API endpoint without this cookie → Should get 401

---

## 📊 Security Checklist

Before deploying to production, verify:

- [ ] All API routes verify authentication via `verifyAuth()`
- [ ] No tokens exposed to client (check Network tab in DevTools)
- [ ] Session cookie is `HttpOnly`, `Secure`, `SameSite=Lax`
- [ ] Error messages don't leak sensitive information
- [ ] Rate limiting is configured on public endpoints
- [ ] CORS is restricted (no wildcard origins with credentials)
- [ ] CSP headers are configured in middleware
- [ ] Debug routes (`/api/debug/*`) are disabled in production

---

## 🔒 Security Best Practices

### DO ✅

- **Always** call `verifyAuth()` at the start of every API handler
- Use `UNAUTHORIZED_RESPONSE` for consistent error responses
- Keep authentication logic in `/src/lib/api-auth.ts`
- Follow BFF architecture (server handles all tokens)
- Log authentication failures (without sensitive data)

### DON'T ❌

- **Never** expose tokens to the client
- **Never** skip authentication checks
- **Never** trust client-provided tokens
- **Never** use app-only auth for user-facing APIs without session validation
- **Never** return raw error messages in production

---

## 🚀 Batch Fix Script

To help fix remaining routes quickly, use this pattern with multi-file replacements:

```typescript
// scripts/fix-api-auth.ts
import { readFileSync, writeFileSync } from 'fs'
import { glob } from 'glob'

const files = glob.sync('src/app/api/**/route.ts')

for (const file of files) {
  let content = readFileSync(file, 'utf-8')
  
  // Skip if already has auth check
  if (content.includes('verifyAuth')) continue
  
  // Add import
  if (!content.includes('@/lib/api-auth')) {
    const importMatch = content.match(/^(import .+\n)+/)
    if (importMatch) {
      const imports = importMatch[0]
      const newImport = "import { verifyAuth, UNAUTHORIZED_RESPONSE } from '@/lib/api-auth'\n"
      content = content.replace(imports, imports + newImport)
    }
  }
  
  // Add auth check to each handler
  content = content.replace(
    /export async function (GET|POST|PUT|PATCH|DELETE)\(/g,
    (match, method) => {
      return `export async function ${method}(request: NextRequest) {
  const session = await verifyAuth()
  if (!session) return UNAUTHORIZED_RESPONSE\n\n  ${match}`
    }
  )
  
  writeFileSync(file, content)
  console.log(`✅ Fixed: ${file}`)
}
```

**Note:** Review changes carefully before committing!

---

## � Follow-up: Delegated Graph Migration (June 2026)

**Status:** ✅ Complete — 202 files migrated

Even after every API route was gated with `verifyAuth()`, a second weakness
remained: most `getGraphClient()` calls were still **app-only** (client
credentials), so Graph requests ran as the service principal regardless of
which user triggered them. That weakened user-level RBAC and made the audit
trail attribute every change to the app, not the human.

### What changed

- **New helper `src/lib/delegatedGraph.ts`** — exposes
  `getDelegatedGraphClient()` and `getDelegatedGraphToken()` built on the
  shared retry/throttle plumbing in `graphClient.ts`. The client transparently
  re-acquires a fresh OBO token on `401`.
- **169 API routes** in `src/app/api/**` switched from `getGraphClient()` to
  `getDelegatedGraphClient()`.
- **33 server pages** (RSCs in `src/app/**/page.tsx`) plus the
  `src/lib/health/getServiceHealth.ts` and `src/lib/intuneDeviceActions.ts`
  helpers switched too.
- **Migration script:** `scripts/migrate-to-delegated-graph.cjs` (dry-run by
  default, `--write` to apply). Idempotent — safe to re-run.

### Routes kept on app-only (with inline `// app-only on purpose:` comments)

| Route                                                | Reason                                                                            |
|------------------------------------------------------|-----------------------------------------------------------------------------------|
| `/api/teams/transcripts/subscribe`                   | Graph change-notification subscriptions are bound to the calling app principal.   |
| `/api/teams/transcripts/subscriptions`               | Paired listing/management of the same subscriptions.                              |
| `/api/chat`                                          | AI chat tool fan-out runs across many users/devices; per-user delegated perms vary. Session auth + per-tool-call audit logging still applies. |

### Rule going forward

**Default to `getDelegatedGraphClient()`.** Only reach for `getGraphClient()`
when one of the following is true:

1. The route is a true background job (timer/queue trigger with no signed-in user).
2. The specific Graph endpoint only supports `Application` permissions — verify
   against the [Microsoft Graph permissions reference](https://learn.microsoft.com/graph/permissions-reference) first.
3. Long-lived state (subscriptions, app-only tokens for system tools) that must
   survive any individual user's session.

Whenever you fall back to `getGraphClient()`, add a one-line
`// app-only on purpose: <reason>` comment above the import so the next
reviewer can tell at a glance that it's deliberate.

### Verification

```bash
# Should print a small list of intentional app-only files (3 routes + chat).
grep -rln "getGraphClient(" src/app/api/

# Type-check across the whole project — should exit 0.
pnpm exec tsc --noEmit -p tsconfig.json
```

---

## �📚 Additional Resources

- [Copilot Instructions - BFF Security](../.github/copilot-instructions.md#-critical-bff-security-architecture-non-negotiable)
- [API Auth Audit Report](./API-AUTH-AUDIT.md)
- [NextAuth v5 Documentation](https://authjs.dev/)
- [OWASP API Security Top 10](https://owasp.org/API-Security/)

---

## 🆘 Need Help?

If you encounter issues:

1. **Check existing protected routes** for reference patterns:
   - `/src/app/api/pim/my-roles/route.ts`
   - `/src/app/api/users/route.ts` (newly fixed)

2. **Verify authentication is working**:
   ```typescript
   // Test in any API route
   const session = await verifyAuth()
   console.log('Session:', session?.user?.email)
   ```

3. **Check NextAuth configuration**:
   - `/src/lib/auth.ts`
   - Ensure `AUTH_SECRET` is set
   - Verify Azure AD credentials

4. **Review error logs**:
   - Look for `[API Auth] Error verifying session:` messages
   - Check NextAuth callback errors

---

**Status:** ✅ Complete — every API route is gated with `verifyAuth()` **and** defaults to delegated/OBO Graph  
**Next Steps:** Audit any new routes against the checklist in [`API-AUTH-QUICK-REFERENCE.md`](./API-AUTH-QUICK-REFERENCE.md) before merge  
**Target:** Maintain 100% delegated coverage; only allow app-only with a documented inline reason
