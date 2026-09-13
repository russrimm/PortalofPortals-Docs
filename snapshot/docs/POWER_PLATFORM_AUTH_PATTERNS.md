# Power Platform API Authentication Patterns

This document describes the authentication patterns used across the application. **Follow these patterns strictly** to avoid breaking working APIs.

## Pattern 1: Delegated OBO (default for interactive routes)

**When to use:** Every route that a signed-in administrator can trigger, including Dataverse reads and writes.

The browser sends only its HttpOnly session cookie. The route obtains the stored user token server-side and exchanges it for the target Power Platform or Dataverse audience. Never read tokens from `session`, and never send them to the browser.

**Implementation:**
```typescript
import { getUserDataverseToken } from '@/lib/dataverseDelegated'
import { withRouteTemplate } from '@/lib/routeTemplate'

export const POST = withRouteTemplate(async ({ request, session }) => {
  const body = RequestSchema.safeParse(await request.json())
  if (!body.success) {
    return Response.json({ error: 'Invalid request' }, { status: 400 })
  }

  const token = await getUserDataverseToken(body.data.instanceUrl)
  // Call the validated Dataverse URL with the delegated token.
  // Emit a sensitive-action audit event before returning.
  return Response.json({ success: true })
}, {
  permission: 'portal.write',
  requireCsrf: true,
})
```

`withRouteTemplate` fails closed when options are omitted: GET/HEAD routes require `portal.read`; POST/PUT/PATCH/DELETE routes require `portal.write` and CSRF.

---

## Pattern 2: Client credentials (background jobs only)

**When to use:** A timer, queue worker, or reconciliation job with no initiating user, or a documented upstream endpoint that supports application permissions only.

App-only callers must be explicitly classified and reviewed. An interactive API route must never combine a viewer session with a privileged app-only token; that creates a confused-deputy authorization bypass.

Use managed identity for Azure-hosted jobs where the target API supports it. If client credentials are unavoidable, keep the credential server-side, assign least privilege, and record the job identity and reason in the app-only inventory.

---

## API-to-Pattern Mapping

| Workload | Interactive request | Background job |
|---|---|---|
| Dataverse | `getUserDataverseToken()` | App-only only when inventoried and least-privileged |
| Power Platform admin API | `getPowerPlatformDelegatedToken()` using `getServerTokens()` | Managed identity or reviewed client credentials |
| BAP API | Delegated token where supported | Reviewed client credentials for documented tenant sync |
| Flow API | Delegated token | Reviewed worker identity |

---

## Common Mistakes to Avoid

1. Do not read `session.accessToken`, `session.idToken`, or `session.refreshToken`.
2. Do not call app-only token helpers from user-triggered routes.
3. Do not accept arbitrary instance hosts; validate canonical Dataverse URLs.
4. Require `portal.write`, CSRF, Zod input validation, and audit logging before writes.
5. Do not reflect raw upstream response bodies to the browser.

---

## Testing Checklist

Before changing any authentication code:

1. Verify unauthenticated requests return 401 before parsing input.
2. Verify viewer sessions return 403 for writes.
3. Verify CSRF failures return 403.
4. Verify delegated-auth failures return `401 reauth_required`.
5. Verify the upstream API independently rejects callers without its required role.
6. Verify successful and failed sensitive actions emit audit events.

---

## Reference Utilities

- **Delegated Dataverse helper:** `src/lib/dataverseDelegated.ts`
- **Power Platform OBO helpers:** `src/lib/ppToken.ts`
- **Route security wrapper:** `src/lib/routeTemplate.ts`
- **Server-side token store access:** `src/lib/getServerToken.ts`

---

## When in Doubt

**Rule of thumb:** if a human can trigger it, use delegated OBO. Tenant-wide scope does not by itself justify app-only access.
