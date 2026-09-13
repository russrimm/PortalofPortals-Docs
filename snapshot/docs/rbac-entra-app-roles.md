# Portal RBAC — Entra ID integration

The portal resolves each signed-in user's role from their Entra ID token at
login time. Any of the following can grant portal access — highest wins:

| Source                                | How it maps                                                                 |
| ------------------------------------- | --------------------------------------------------------------------------- |
| Entra **App Roles** (`roles` claim)   | `PortalAdmin` → `admin`, `PortalOperator` → `operator`, `PortalViewer` → `viewer` |
| Entra **directory roles** (`wids`)    | Global Admin → `admin`; User Admin / Security Admin / Intune Admin / etc. → `operator`; Global Reader / Security Reader → `viewer` |
| Entra **security groups** (`groups`)  | Group object ID appears in `RBAC_ADMIN_GROUPS` / `RBAC_OPERATOR_GROUPS` / `RBAC_VIEWER_GROUPS` env vars |
| Email / domain allowlist              | `RBAC_ADMIN_EMAILS`, `RBAC_ADMIN_DOMAINS`, etc.                             |
| Fallback                              | `RBAC_DEFAULT_ROLE` or `viewer`                                             |

Portal role → capability:

- `admin`     — full portal, including write actions and RBAC management
- `operator`  — portal read + write actions (VM start/stop, license assign, etc.)
- `viewer`    — read-only

**Note:** Portal roles gate the portal UI/API. Azure operations *also* require
the appropriate Azure RBAC role (Reader / Contributor / etc.) on the target
resource. Delegated tokens are used, so Azure enforces its own permission check.

## Quickest path: grant yourself access via existing Entra role

If you sign in as a **Global Administrator** (or any of the mapped directory
roles above), you'll receive portal `admin` on your next login. No config
changes required.

## Recommended: dedicated Entra App Roles

For everyone else, define app roles on the portal's app registration so admins
can assign portal access through Enterprise Applications → *Users and groups*.

1. **Entra portal → App registrations → \<your portal app\> → App roles → Create app role**, three times:

   | Display name       | Value            | Description                    | Allowed member types |
   | ------------------ | ---------------- | ------------------------------ | -------------------- |
   | Portal Admin       | `PortalAdmin`    | Full access                    | Users/Groups         |
   | Portal Operator    | `PortalOperator` | Read + write actions           | Users/Groups         |
   | Portal Viewer      | `PortalViewer`   | Read-only                      | Users/Groups         |

   Or paste this into the manifest's `appRoles` array:

   ```json
   [
     {
       "allowedMemberTypes": ["User"],
       "description": "Full portal access, including write actions.",
       "displayName": "Portal Admin",
       "id": "00000000-0000-0000-0000-000000000001",
       "isEnabled": true,
       "value": "PortalAdmin"
     },
     {
       "allowedMemberTypes": ["User"],
       "description": "Portal read plus write actions such as VM start/stop.",
       "displayName": "Portal Operator",
       "id": "00000000-0000-0000-0000-000000000002",
       "isEnabled": true,
       "value": "PortalOperator"
     },
     {
       "allowedMemberTypes": ["User"],
       "description": "Portal read-only access.",
       "displayName": "Portal Viewer",
       "id": "00000000-0000-0000-0000-000000000003",
       "isEnabled": true,
       "value": "PortalViewer"
     }
   ]
   ```

   Replace the placeholder `id` values with unique GUIDs.

2. **Entra portal → Enterprise applications → \<your portal app\> → Users and groups → Add user/group**.
   Pick a user or group, then select one of the three app roles, then Assign.

3. Have the user sign out and back in to the portal. The next `id_token`
   includes the `roles` claim and the portal will pick it up automatically.

## Optional: security-group mapping

If you'd rather manage access through existing security groups without adding
app roles, set the group object IDs as env vars:

```
RBAC_ADMIN_GROUPS=<group-object-id>,<another-group-object-id>
RBAC_OPERATOR_GROUPS=<group-object-id>
RBAC_VIEWER_GROUPS=<group-object-id>
```

For this to work the app registration must be configured to emit the `groups`
claim in the id_token (**Token configuration → Add groups claim**). If the user
belongs to more than the `groups` overage limit, Entra will not put the IDs on
the token — use app roles instead.

## Optional: quick email/domain overrides

Useful for local development or one-off admin grants:

```
RBAC_ADMIN_EMAILS=alice@contoso.com
RBAC_ADMIN_DOMAINS=contoso.com
RBAC_OPERATOR_EMAILS=bob@contoso.com
RBAC_VIEWER_DOMAINS=partner.example.com
RBAC_DEFAULT_ROLE=viewer
```

Comma-separated, case-insensitive.

## Navigation visibility by workload

Portal roles (above) decide *what a user may do*. A second, independent model
decides *which workload menus a user sees*. It lives in
[`src/lib/navPermissions.ts`](../src/lib/navPermissions.ts).

At sign-in the `wids` claim — the template IDs of the user's active Entra
built-in directory roles — is mapped to a set of workload scopes. The left nav
and the home grid then hide any area the user holds no scope for. An
Exchange Administrator sees Exchange Online but not Microsoft Intune; an Intune
Administrator sees the reverse.

| Scope           | Gated areas                     | Example roles that grant it                                   |
| --------------- | ------------------------------- | ------------------------------------------------------------- |
| `entra`         | Microsoft Entra ID              | Global Administrator, User Administrator, Helpdesk Administrator, Security Administrator |
| `intune`        | Microsoft Intune                | Intune Administrator, Windows 365 Administrator, Cloud Device Administrator, Security Reader |
| `exchange`      | Exchange Online                 | Exchange Administrator, Exchange Recipient Administrator, Compliance Administrator |
| `teams`         | Teams                           | Teams Administrator, Teams Communications Administrator, Teams Devices Administrator |
| `sharepoint`    | SharePoint, OneDrive            | SharePoint Administrator, Knowledge Administrator, Search Administrator |
| `microsoft365`  | Microsoft 365                   | Exchange / Teams / SharePoint Administrator, Billing Administrator, Reports Reader |
| `powerPlatform` | Power Platform                  | Power Platform Administrator, Dynamics 365 Administrator       |

Role template IDs are stable global GUIDs, identical in every tenant. Every GUID
in the map is taken from the
[Entra built-in roles reference](https://learn.microsoft.com/entra/identity/role-based-access-control/permissions-reference).

### Rules worth knowing

- **Read-only roles still see the menu.** Global Reader and Security Reader grant
  the same visibility as their write counterparts. Visibility answers "may this
  user look at this workload", not "may this user change it".
- **The model fails open.** A token with no `wids` claim at all — guests, tokens
  minted before directory-role claims were configured, admins whose access comes
  from somewhere other than a directory role — sees every area. A token that
  *does* carry `wids` is authoritative, so a user holding only unmapped roles
  sees just the ungated areas.
- **`PortalAdmin` bypasses gating entirely.** The app role is an explicit grant,
  independent of directory roles.
- **Azure and Fabric are never gated.** Azure access comes from Azure RBAC role
  assignments on subscriptions and resource groups, and Fabric access from Fabric
  workspace roles. Neither appears in `wids`, so gating them would hide the menu
  from the admins who use it most. Cross-cutting areas — dashboards, threat
  intelligence, reports, health, help — are ungated for the same reason.
- **This is navigation visibility, not authorization.** A hidden page is still
  reachable by direct URL. Every API route keeps its own `verifyAuth()` check,
  and the upstream Microsoft API enforces the user's real permissions on the
  delegated token.

The scope set rides in the session cookie as a short encoded string (one
character per scope) because the cookie is deliberately minimal — see the
`MinimalJwtPayload` comment in `src/lib/auth.ts`. It surfaces on the client as
`session.user.navScopes`, where `undefined` means unrestricted.

To change what a role unlocks, edit `ENTRA_ROLE_TO_NAV_SCOPES`; to change what an
area requires, edit `AREA_REQUIRED_NAV_SCOPES`. Both are covered by
`tests/unit/lib/nav-permissions.test.ts`.

## Verifying a user's resolved role

The auth callback logs the resolution on each sign-in:

```
[auth][jwt] Resolved role=admin (appRoles=1, wids=2, groups=0)
[auth][jwt] Resolved nav scopes=entra,intune,exchange,teams,sharepoint,microsoft365,powerPlatform
```

The second line reports `unrestricted` when the model failed open and `none` when
the user's roles granted no workload scope.

Look for these lines in the server log after a fresh sign-in. If the role isn't
what you expect, check that the user actually signed *out and back in* — both the
role and the nav scopes are captured at token-mint time.
