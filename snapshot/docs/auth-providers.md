# Auth Provider Setup

How to configure Microsoft Entra ID (Azure AD) and the downstream Microsoft APIs that Portal 360° relies on.

> Portal 360° currently supports a single identity provider: **Microsoft Entra ID** via NextAuth v5 (`@auth/core`) and MSAL Node (`@azure/msal-node`). There is no support for a non-Microsoft IdP — all upstream services (Graph, ARM, Power Platform, Dataverse, Defender, Intune, etc.) require Entra-issued tokens.

For a per-route catalog of the exact permissions consumed by each feature, see [`API-DOCUMENTATION.md`](./API-DOCUMENTATION.md).

---

## 1. Register an Entra ID application

1. Sign in to <https://entra.microsoft.com> as a Global Administrator or Application Administrator.
2. Go to **Identity → Applications → App registrations → New registration**.
3. Fill in:
   - **Name:** `Portal 360°` (or your org-specific name)
   - **Supported account types:** *Accounts in this organizational directory only (single tenant)*
   - **Redirect URI:** Web → `https://portal.example.com/api/auth/callback/azure-ad`
4. After creation, record the **Application (client) ID** and **Directory (tenant) ID** — these become `AZURE_CLIENT_ID` / `AZURE_TENANT_ID`.

### Redirect URIs to register

Add every URL where Portal 360° will run:

```text
http://localhost:3000/api/auth/callback/azure-ad          # local dev
https://portal-staging.example.com/api/auth/callback/azure-ad
https://portal.example.com/api/auth/callback/azure-ad
```

> The path is always `/api/auth/callback/azure-ad` — NextAuth v5 derives it from the provider id.

### Front-channel logout / post-logout redirect URI

Signing out of Portal 360° performs a **federated (single) sign-out**: after clearing the
portal session it navigates to Entra's end-session endpoint so the Microsoft SSO session
ends too. Without this, the next sign-in silently re-authenticates the same account and the
user cannot switch accounts.

Register the portal root as a redirect URI on the **same Web platform** so Entra returns the
user to the portal instead of its own generic "You signed out" page:

```text
http://localhost:3000/                                    # local dev
https://portal-staging.example.com/
https://portal.example.com/
```

> If the root URL is not registered, sign-out still works — Entra just ends on its own
> confirmation page rather than redirecting back.

To pick a different account without signing out of Microsoft entirely, use **Use a different
account** on the login screen. That sends `prompt=select_account`, which forces the Entra
account picker.

### Client secret

1. Go to **Certificates & secrets → Client secrets → New client secret**.
2. Pick the maximum lifetime allowed by your tenant policy (commonly 6–24 months).
3. Copy the **Value** immediately — it is shown only once. This becomes `AZURE_CLIENT_SECRET`.
4. Add the expiry to your secrets-rotation calendar (see [`admin-guide.md`](./admin-guide.md) § 8).

> If your tenant requires certificate auth instead of client secrets, see [`scripts/generate-azure-cert.js`](../scripts/generate-azure-cert.js) for the local certificate-generation helper.

---

## 2. API permissions

Portal 360° uses the **Authorization Code Flow with PKCE** for sign-in and the **On-Behalf-Of (OBO) Flow** for upstream API calls. All permissions are therefore **Delegated** unless explicitly noted as `Application`.

Add permissions under **API permissions → Add a permission**, then click **Grant admin consent for \<tenant\>**.

### Microsoft Graph (delegated)

Minimum scopes required for sign-in:

```text
openid
profile
email
offline_access
User.Read
```

Feature-specific scopes (add only the ones you intend to use):

| Feature area                                 | Delegated scopes                                                                                       |
|----------------------------------------------|--------------------------------------------------------------------------------------------------------|
| Users, Groups, Service Principals            | `User.Read.All`, `Group.Read.All`, `Application.Read.All`, `Directory.Read.All`                       |
| Identity governance (PIM, entitlement, CA)   | `RoleManagement.Read.Directory`, `PrivilegedAccess.Read.AzureAD`, `Policy.Read.All`, `EntitlementManagement.Read.All` |
| Sign-ins, audit, risky users                 | `AuditLog.Read.All`, `IdentityRiskyUser.Read.All`, `IdentityRiskEvent.Read.All`                       |
| Conditional access & secure score            | `Policy.Read.All`, `SecurityEvents.Read.All`                                                          |
| Exchange & Teams & SharePoint                | `Mail.Read`, `Mail.ReadBasic`, `Mail.Read.Shared`, `Team.ReadBasic.All`, `Sites.Read.All`, `Files.Read.All` |
| Service health & service announcements       | `ServiceHealth.Read.All`, `ServiceMessage.Read.All`                                                   |
| Intune device management                     | `DeviceManagementManagedDevices.Read.All`, `DeviceManagementConfiguration.Read.All`, `DeviceManagementApps.Read.All` |
| Windows Update for Business catalog          | `WindowsUpdates.Read.All` (user must also hold Intune Administrator or Windows Update Deployment Administrator)       |
| Guest invitations                            | `User.Invite.All`                                                                                     |
| Emailed report exports (Secure Score PDF)    | `Mail.Send` (optional; sender needs an Exchange Online mailbox)                                                       |
| Licensing                                    | `Organization.Read.All`, `LicenseAssignment.Read.All`                                                 |

The exhaustive list (including which Portal 360° page consumes each scope) is in [`API-DOCUMENTATION.md`](./API-DOCUMENTATION.md) § Required Permissions Summary.

> **Gotcha — `Mail.ReadBasic.All` is Application-only.** It does not exist as a
> delegated scope in Microsoft Graph, so it can never be granted through the
> OBO (`.default`) flow this portal uses for all Exchange routes. To let a
> signed-in admin read folders/messages in a mailbox other than their own
> (`/users/{id}/mailFolders`, etc.), the mailbox must first grant that admin
> Exchange **Full Access** delegate rights, and the app must hold the
> delegated `Mail.Read.Shared` (or `Mail.ReadWrite.Shared`) scope — there is
> no delegated permission that grants blanket read access to every mailbox in
> the tenant. Reading arbitrary mailboxes without per-mailbox delegate access
> requires an Application permission (`Mail.ReadBasic.All`/`Mail.Read` app
> role) scoped down with an Exchange Application Access Policy, which is an
> app-only pattern — see [`APP-ONLY-JOBS.md`](./APP-ONLY-JOBS.md) before
> adding one.

### Azure Service Management (delegated)

For ARM, Cost Management, Advisor, Monitor, Resource Graph, Log Analytics:

```text
Microsoft Azure Service Management → user_impersonation
```

Subscription-scoped RBAC is enforced by Azure itself — assign the signed-in users at least **Reader** on every subscription / management group they need to view. Cost dashboards additionally need **Cost Management Reader**.

### Power Platform

| Scope                                                                        | Backing app registration (add under *APIs my organization uses*)                | Used by                                              |
|------------------------------------------------------------------------------|----------------------------------------------------------------------------------|------------------------------------------------------|
| `https://service.powerapps.com/.default`                                     | PowerApps Service — `475226c6-020e-4fb2-8a90-7a972cbfc1d4`                      | Environment connectors, Apps, Flows detail pages     |
| `https://api.bap.microsoft.com/.default`                                     | PowerApps-Advisor — `8578e004-a5c6-46e7-913e-12f58912df43`                        | BAP admin operations                                 |
| `https://api.flow.microsoft.com/.default`                                    | Power Platform API — `8578e004-a5c6-46e7-913e-12f58912df43`                       | Power Automate flows                                 |
| `https://api.powerapps.com/.default`                                         | PowerApps Service — `475226c6-020e-4fb2-8a90-7a972cbfc1d4`                      | Power Apps                                           |
| `https://api.powerplatform.com/.default`                                     | Power Platform API — `8578e004-a5c6-46e7-913e-12f58912df43`                       | Power Platform tenant settings, governance           |
| `<environment-url>/.default`                                                 | Dataverse (per environment, no separate app registration entry)                  | Dataverse Web API (per environment)                  |

All Power Platform scopes are requested in the `.default` form so the application receives every delegated permission its app registration has been granted. The Dataverse scope is per-environment and matches the environment's URL (for example `https://contoso.crm.dynamics.com/.default`).

Detailed setup (especially for the BAP / `api.bap.microsoft.com` permission) is in [`power-platform-bap-api-setup.md`](./power-platform-bap-api-setup.md) and [`power-platform-api-permissions.md`](./power-platform-api-permissions.md).

### Microsoft Defender / Sentinel

For Defender for Endpoint, Defender for Cloud Apps, and Sentinel:

```text
WindowsDefenderATP / user_impersonation
Microsoft Cloud App Security / Investigation.Read
Log Analytics API / Data.Read
```

See [`defender-atp-integration.md`](./defender-atp-integration.md) and [`defender-atp-quickstart.md`](./defender-atp-quickstart.md).

### Application Insights / Azure Monitor

Add **Log Analytics API** → `Data.Read` (delegated). Grant the signed-in users the **Log Analytics Reader** role on the workspaces they query.

---

## 3. Authentication flow used by Portal 360°

```text
User Browser
    │  (1) sign-in
    ▼
NextAuth (server)
    │  (2) Authorization Code + PKCE → Microsoft Entra ID
    ▼
Microsoft Entra ID
    │  (3) returns id_token + access_token + refresh_token
    ▼
NextAuth (server)
    │  (4) creates HttpOnly session cookie (NEVER touches the browser as a token)
    ▼
Browser  ←  HttpOnly cookie  ─────────────────────────────────────────────┐
                                                                          │
Browser → /api/<feature>                                                  │
    │  (5) cookie attached automatically                                  │
    ▼                                                                     │
Route handler                                                             │
    │  (6) reads session, calls getServerToken / MSAL OBO                 │
    ▼                                                                     │
Upstream API (Graph / ARM / Power Platform / …)  ◄────────────────────────┘
```

Tokens are owned exclusively by the server. The browser only ever sees an opaque session cookie.

For background and source pointers, see [`API-DOCUMENTATION.md`](./API-DOCUMENTATION.md) and [`POWER_PLATFORM_AUTH_PATTERNS.md`](./POWER_PLATFORM_AUTH_PATTERNS.md).

---

## 4. Optional tenant-level configuration

These are not required, but Portal 360° behaves better when they are in place:

| Feature                              | Why                                                                  | Reference                                                        |
|--------------------------------------|----------------------------------------------------------------------|------------------------------------------------------------------|
| **Conditional Access**               | Limit Portal 360° sign-in to compliant devices / trusted locations.  | [`conditional-access` Microsoft Learn](https://learn.microsoft.com/entra/identity/conditional-access/) |
| **PIM eligibility for admin roles**  | Avoid standing privileged roles for portal operators.                | [`pim-setup-guide.md`](./pim-setup-guide.md)                     |
| **Privileged Access Workstations**   | Operators access the portal from hardened devices only.              | [Microsoft Learn — Privileged Access](https://learn.microsoft.com/security/privileged-access-workstations/privileged-access-devices) |

---

## 5. Validating the setup

```bash
# 1. Web sign-in works end-to-end
open https://portal.example.com/

# 2. Anonymous API call returns 401
curl -i https://portal.example.com/api/users
# HTTP/2 401
# { "error": "Unauthorized", "message": "Authentication required. Please sign in." }

# 3. After signing in, OpenAPI surface is reachable
open https://portal.example.com/api/docs
```

If any of those checks fail, the most common causes are:

- Missing **admin consent** on a scope — Graph returns `403 Insufficient privileges`.
- Wrong **redirect URI** — Entra returns `AADSTS50011`.
- Wrong tenant ID — Entra returns `AADSTS90002`.
- Missing **RBAC role** on the subscription / workspace — ARM returns `AuthorizationFailed`.

See [`AADSTS9002326-FIX.md`](./AADSTS9002326-FIX.md), [`fix-oauth-invalid-client.md`](./fix-oauth-invalid-client.md), and the wider [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md).
