# Role-Based Access Control (RBAC) Implementation

## Overview

Portal 360° has three portal-level roles, layered on top of Microsoft Entra ID authentication:

| Role       | Capabilities                                                                                  |
|------------|------------------------------------------------------------------------------------------------|
| `admin`    | All permissions (`*`) including portal write, RBAC management, and audit viewing.              |
| `operator` | Day-to-day operations: `portal.read`, `portal.write`, `rbac.view`, `audit.view`, `reports.view`. |
| `viewer`   | Read-only access: `portal.read`, `reports.view`.                                               |

These roles are **portal roles only** — they govern which Portal 360° features a signed-in user can use. They do **not** replace Microsoft Entra directory roles, Azure RBAC, or the per-API permissions enforced by Microsoft Graph, ARM, Power Platform, and Dataverse.

The canonical implementation lives in [`src/lib/rbac.ts`](../src/lib/rbac.ts) (role + permission matrix and email/domain resolution) and [`src/lib/permissions.ts`](../src/lib/permissions.ts) (helper functions consumed by UI components).

## Role Assignment

Roles are resolved from the signed-in user's email address at JWT-callback time, using environment-variable allow lists.

### Environment variables

| Variable                  | Purpose                                                                                  |
|---------------------------|-------------------------------------------------------------------------------------------|
| `RBAC_ADMIN_EMAILS`       | Comma-separated list of email addresses that map to `admin`.                              |
| `RBAC_OPERATOR_EMAILS`    | Comma-separated list of email addresses that map to `operator`.                           |
| `RBAC_VIEWER_EMAILS`      | Comma-separated list of email addresses that map to `viewer`.                             |
| `RBAC_ADMIN_DOMAINS`      | Comma-separated list of email domains that map to `admin` (e.g. `contoso.com`).           |
| `RBAC_OPERATOR_DOMAINS`   | Comma-separated list of domains that map to `operator`.                                   |
| `RBAC_VIEWER_DOMAINS`     | Comma-separated list of domains that map to `viewer`.                                     |
| `RBAC_DEFAULT_ROLE`       | Fallback role when no list matches. Accepts `admin`, `operator`, or `viewer`. Defaults to `viewer`. |

Resolution priority is `admin → operator → viewer` — if a user matches multiple lists, the highest privilege wins.

### Resolution flow

1. NextAuth's JWT callback in [`src/lib/auth.ts`](../src/lib/auth.ts) reads `profile.email`.
2. `resolveRoleForEmail(email)` from `src/lib/rbac.ts` returns the matching `PortalRole`.
3. The role is stored on the token (`token.role`) and surfaced on the session as `session.user.role`.
4. Server-side checks use `hasPermissionForSession(session, 'portal.write')` (or similar) before performing privileged actions.

```ts
// src/lib/rbac.ts (excerpt)
export function resolveRoleForEmail(email?: string | null): PortalRole {
  // …matches RBAC_*_EMAILS / RBAC_*_DOMAINS, falls back to RBAC_DEFAULT_ROLE (default 'viewer')
}
```

## Permission System

The permission matrix lives in [`src/lib/rbac.ts`](../src/lib/rbac.ts):

```ts
const ROLE_PERMISSIONS: Record<PortalRole, Array<Permission | '*'>> = {
  admin:    ['*'],
  operator: ['portal.read', 'portal.write', 'rbac.view', 'audit.view', 'reports.view'],
  viewer:   ['portal.read', 'reports.view'],
}
```

### Exported helpers

#### `rbac.ts` (preferred for server-side checks)

- `getPermissionsForRole(role)` — returns the permission list for a role.
- `hasPermission(role, permission)` — boolean check against the matrix.
- `hasPermissionForSession(session, permission)` — read role from session, then check.
- `getRoleFromSession(session)` — returns the role string (falls back to `RBAC_DEFAULT_ROLE`).
- `resolveRoleForEmail(email)` — used by the JWT callback.

#### `permissions.ts` (UI convenience wrappers)

These boolean helpers wrap the role check so client components stay short:

```ts
canDelete(session: Session | null): boolean    // true if role === 'admin'
canCreate(session: Session | null): boolean    // true if role is 'admin' or 'operator'
canUpdate(session: Session | null): boolean    // true if role is 'admin' or 'operator'
isReadOnly(session: Session | null): boolean   // true if role is 'viewer' (or missing)
getReadOnlyMessage(): string                   // user-facing message for denied actions
```

### Usage in UI components

```tsx
'use client'
import { useSession } from 'next-auth/react'
import { canCreate, canDelete, getReadOnlyMessage } from '@/lib/permissions'

export function CreateResourceButton() {
  const { data: session } = useSession()
  return (
    <button
      onClick={() => canCreate(session) ? handleCreate() : alert(getReadOnlyMessage())}
      disabled={!canCreate(session)}
    >
      Create Resource
    </button>
  )
}
```

### Usage in server-side checks

Prefer `hasPermissionForSession` from `rbac.ts` over the boolean helpers when you want a clear permission name in the audit trail:

```ts
import { verifyAuth, UNAUTHORIZED_RESPONSE } from '@/lib/api-auth'
import { hasPermissionForSession } from '@/lib/rbac'
import { NextResponse } from 'next/server'

export async function DELETE() {
  const session = await verifyAuth()
  if (!session) return UNAUTHORIZED_RESPONSE
  if (!hasPermissionForSession(session, 'portal.write')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  // proceed with deletion
}
```

## Protected Features

Mutating UI controls and API routes both consult the role. A few representative examples:

### Frontend

- **Teams management** (`src/app/teams/list-teams/page.jsx`): create / delete buttons gated by `canCreate` / `canDelete`.
- **Applications management** (`src/app/applications/ApplicationsTable.jsx`): the trash icon next to a secret is disabled for non-admins.
- **Power Platform environments** (`src/app/power-platform/environments/EnvironmentsClient.tsx`): the danger-zone delete-environment section is only rendered when `canDelete(session)` is true.

Use the helpers in `@/lib/permissions` for these controls so the wiring stays consistent across pages.

### Backend

Every destructive API route under `src/app/api/**` must verify authentication first (see [`API-AUTH-QUICK-REFERENCE.md`](./API-AUTH-QUICK-REFERENCE.md)) and then check the role. Today most routes guard with:

```ts
const session = await verifyAuth()
if (!session) return UNAUTHORIZED_RESPONSE
if (!hasPermissionForSession(session, 'portal.write')) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
```

Both `src/app/api/teams/create-team/route.ts` and `src/app/api/teams/delete-team/[id]/route.ts` already call `requirePermission(session, 'portal.write')` before their handler body runs; a previously-dead `session.user?.role === 'readonly'` check (unreachable — `'readonly'` was never a member of the `admin | operator | viewer` role set) has since been removed from both.

## Security Considerations

### Defense in Depth

The RBAC system implements defense in depth with multiple layers of protection:

1. **Frontend UI Controls**: Buttons are disabled or hidden based on permissions
2. **API Route Guards**: Server-side checks reject unauthorized requests
3. **Session Validation**: All protected routes verify user session and role

### Why Both Frontend and Backend Protection?

- **Frontend**: Provides better UX by preventing users from attempting unauthorized actions
- **Backend**: Critical security layer that cannot be bypassed, even if frontend is modified

### Important Notes

⚠️ **Never rely solely on frontend checks for security**. Frontend code can be modified by users. The backend API protection is the actual security boundary.

## Testing the RBAC System

Seed the role lists in `.env.local`:

```bash
RBAC_ADMIN_EMAILS=admin@example.com
RBAC_OPERATOR_EMAILS=ops@example.com
RBAC_VIEWER_EMAILS=demo@example.com
RBAC_DEFAULT_ROLE=viewer
```

### Sign in as admin

With `admin@example.com` signed in, verify you can create teams, delete environments, remove application secrets, and see all danger-zone sections.

### Sign in as viewer

With `demo@example.com` signed in, verify the UI hides or disables create/update/delete affordances, and that calling a destructive API directly returns `403 Forbidden`.

### Testing API protection

```bash
# Should return 401 when unauthenticated, 403 when signed in as viewer, 200/204 when signed in as admin.
curl -X DELETE https://your-domain.com/api/teams/delete-team/<team-id> \
  -H "Cookie: <your-session-cookie>"
```

## Adding New Protected Features

### 1. UI component (client)

```tsx
'use client'
import { useSession } from 'next-auth/react'
import { canDelete, getReadOnlyMessage } from '@/lib/permissions'

export function DeleteButton({ onClick }: { onClick: () => void }) {
  const { data: session } = useSession()
  if (!canDelete(session)) return null
  return <button onClick={onClick}>Delete</button>
}
```

### 2. API route (server)

```ts
import { verifyAuth, UNAUTHORIZED_RESPONSE } from '@/lib/api-auth'
import { hasPermissionForSession } from '@/lib/rbac'
import { NextResponse } from 'next/server'

export async function DELETE() {
  const session = await verifyAuth()
  if (!session) return UNAUTHORIZED_RESPONSE
  if (!hasPermissionForSession(session, 'portal.write')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  // proceed with deletion
}
```

## Customizing Role Resolution

The simplest customization is editing the `RBAC_*` env-var lists at deploy time. For more complex policies (e.g. resolving from Entra ID group membership) replace the body of `resolveRoleForEmail` in `src/lib/rbac.ts`:

```ts
export function resolveRoleForEmail(email?: string | null): PortalRole {
  // example: trust an upstream groups claim instead of email allow-lists
  // const groups = (currentToken?.groups as string[]) ?? []
  // if (groups.includes(process.env.RBAC_ADMIN_GROUP_ID ?? '')) return 'admin'
  // …
  return getDefaultRole()
}
```

Keep the function deterministic and side-effect free — it runs inside the NextAuth JWT callback on every sign-in and token refresh.

## Future Enhancements

Potential improvements tracked on the roadmap:

1. **Entra ID group integration** — resolve roles directly from group claims rather than email allow-lists.
2. **Resource-level permissions** — per-tenant or per-environment overrides.
3. **Admin UI** — a portal page for managing role assignments without redeploying.
4. **Audit logging** — record every permission check and denied operation in Application Insights.

## Troubleshooting

### User has the wrong role

1. Confirm the email in the session: `console.log(session.user?.email)` (server-side only).
2. Confirm the role on the session: `console.log(session.user?.role)`.
3. Confirm the `RBAC_*` env vars are set in the **server** environment (not just `.env.local` if running in production).
4. Sign out and back in — the role is computed in the JWT callback at sign-in.

### API returns 403 for an admin user

1. Check the session reaches the API route (`verifyAuth()` returns a non-null session).
2. Verify the role on the token (`session.user.role === 'admin'`).
3. Verify the route uses `hasPermissionForSession(session, '<permission>')` and that the permission exists in the matrix.

### Frontend allows an action that the API denies

That is the intended layering. The UI uses `permissions.ts` for fast disable/hide decisions; the API is the security boundary and must always re-check. Never rely on the UI alone.

## References

- [`src/lib/rbac.ts`](../src/lib/rbac.ts) — role + permission matrix
- [`src/lib/permissions.ts`](../src/lib/permissions.ts) — UI helpers
- [`API-AUTH-QUICK-REFERENCE.md`](./API-AUTH-QUICK-REFERENCE.md) — the `verifyAuth` pattern for API routes
- NextAuth.js: <https://authjs.dev/>
- Next.js Route Handlers: <https://nextjs.org/docs/app/building-your-application/routing/route-handlers>
