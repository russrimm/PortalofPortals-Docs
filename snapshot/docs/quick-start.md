# Portal 360° – Quick Start

A trimmed, copy‑paste friendly path to get the portal running locally. For full detail (screenshots, rationale, troubleshooting) see [application-installation.md](application-installation.md).

---
## 1. Prerequisites (Verify)
- Node.js **24+** (LTS)
- pnpm 10+ (`npm install -g pnpm@10.34.5`)
- An Entra ID (Azure AD) tenant where you can create an App Registration
- (Optional) Azure CLI if you want to script the app registration

```bash
node -v   # should print v24.x or newer
pnpm -v
```

---
## 2. Clone
```bash
git clone https://github.com/russrimm/PortalofPortals.git
cd PortalofPortals
pnpm install
```

---
## 3. Register the Entra ID App (Choose ONE method)

Portal 360° signs users in with NextAuth v5's `azure-ad` provider. The browser only sees an HttpOnly session cookie — tokens are exchanged and held server-side and downstream API calls use the On-Behalf-Of (OBO) flow or, for a few areas (e.g. some Graph reports, Power Platform admin APIs, Defender), the client-credentials flow.

### A) Portal (Fast UI)
1. Azure Portal → Entra ID → App registrations → **New registration**
2. Name: `Portal360Local` (any) — Supported account types: single or multi-tenant
3. Redirect URI (Web): `http://localhost:3000/api/auth/callback/azure-ad`
4. Register → copy **Application (client) ID** + **Directory (tenant) ID**
5. **Certificates & secrets** → New client secret → copy the **Value** (shown once)
6. **API permissions** → Add a permission → **Microsoft Graph**:
   - **Delegated** (required for interactive sign-in / OBO):
     - `openid` `profile` `email` `offline_access` `User.Read`
     - Add other delegated scopes for pages you plan to use (e.g. `Group.Read.All`, `Directory.Read.All`, `AuditLog.Read.All`, `Reports.Read.All`, `Sites.Read.All`, `Policy.Read.All`, `IdentityRiskyUser.Read.All`, `SecurityEvents.Read.All`)
   - **Application** (only needed for features that use client-credentials — Graph reports, some Power Platform / Defender calls):
     - `User.Read.All` `Group.Read.All` `Application.Read.All` `Device.Read.All` `Directory.Read.All` `AuditLog.Read.All` `Reports.Read.All` (and others matching the features you enable)
7. **Grant admin consent** for the tenant (repeat after adding any new permissions)
8. Remove unused permissions to keep least privilege

### B) CLI (Scriptable)
```bash
DISPLAY_NAME="Portal360Local"
GRAPH_API_ID="00000003-0000-0000-c000-000000000000"

az ad app create \
  --display-name "$DISPLAY_NAME" \
  --web-redirect-uris "http://localhost:3000/api/auth/callback/azure-ad"

APP_ID=$(az ad app list --display-name "$DISPLAY_NAME" --query "[0].appId" -o tsv)
TENANT_ID=$(az account show --query tenantId -o tsv)

# Delegated Microsoft Graph permissions used by the initial sign-in (=Scope).
# GUIDs: openid, profile, email, offline_access, User.Read.
az ad app permission add --id "$APP_ID" --api "$GRAPH_API_ID" --api-permissions \
  37f7f235-527c-4136-accd-4a02d197296e=Scope \
  14dad69e-099b-42c9-810b-d002981feec1=Scope \
  64a6cdd6-aab1-4aaf-94b8-3cc8405e90d0=Scope \
  7427e0e9-2fba-42fe-b0c0-848c9e6a8182=Scope \
  e1fe6dd8-ba31-4d61-89e7-88639da4683d=Scope

# Optional application (app-only) permissions for client-credentials features (=Role).
# GUIDs: User.Read.All, Group.Read.All, Directory.Read.All, Reports.Read.All.
az ad app permission add --id "$APP_ID" --api "$GRAPH_API_ID" --api-permissions \
  df021288-bdef-4463-88db-98f22de89214=Role \
  5b567255-7703-4780-807c-7be8301ae99b=Role \
  7ab1d382-f21e-4acd-a863-ba3e13f7da61=Role \
  230c1aed-a721-4c5d-9cb4-a90514e508ef=Role

# Grant admin consent for everything you've added
az ad app permission admin-consent --id "$APP_ID"

# Create a client secret (1 year) — copy the printed "password" value
az ad app credential reset --id "$APP_ID" --append --display-name "local-dev" --years 1
```
Record: `appId`, `tenantId`, and the generated secret value. Look up other Graph permission GUIDs with `az ad sp show --id "$GRAPH_API_ID" --query "oauth2PermissionScopes[].{name:value,id:id}"` (delegated) or `... appRoles[].{name:value,id:id}` (application).

---
## 4. Environment File
Copy the template and fill it in:
```bash
cp .env.local.example .env.local
```

Minimum values to sign in locally (both name styles are accepted by the code — pick one):

```bash
# NextAuth v5
NEXTAUTH_URL=http://localhost:3000
AUTH_SECRET=<openssl rand -base64 32>

# Entra ID — v5 preferred names
AUTH_AZURE_AD_TENANT_ID=<tenant-guid>
AUTH_MICROSOFT_ENTRA_ID_ID=<app-id>
AUTH_MICROSOFT_ENTRA_ID_SECRET=<client-secret>

# …or the legacy AZURE_* aliases (also supported)
AZURE_TENANT_ID=<tenant-guid>
AZURE_CLIENT_ID=<app-id>
AZURE_CLIENT_SECRET=<client-secret>
```

Generate a secret:
```bash
openssl rand -base64 32
```

Optional integrations (Redis, Cosmos DB, Application Insights, Copilot Studio, ServiceNow, HITL connector, demo mode) are documented in [.env.local.example](../.env.local.example) and [docs/ENVIRONMENT-VARIABLES.md](ENVIRONMENT-VARIABLES.md). Skip them for a first run.

> Never commit `.env.local`. Secrets stay on your machine; use Key Vault + managed identity in shared environments.

---
## 5. Run
```bash
pnpm run dev
```
Open <http://localhost:3000>, click **Sign In with Entra ID**, and complete the Microsoft sign-in. There are no built-in username/password credentials.

Theme: the app remembers your choice in a `pulseTheme` cookie. You can force a theme via `?theme=light` or `?theme=dark` on any URL.

---
## 6. Build (Prod Test)
```bash
pnpm run build
pnpm start   # listens on $PORT, defaults to 8080
```
If you want the prod server on the same port as dev, run `PORT=3000 pnpm start` (and make sure `NEXTAUTH_URL` matches).

---
## 7. Quick Troubleshooting
| Issue | Fix |
|-------|-----|
| Redirect URI mismatch on login | App registration must include `http://localhost:3000/api/auth/callback/azure-ad` exactly |
| `AADSTS65001` consent error | Grant admin consent for the delegated/application permissions you added |
| 401 / 403 from Graph or Azure APIs | Missing permission or no admin consent for the scope that page uses — see [docs/AADSTS9002326-FIX.md](AADSTS9002326-FIX.md) and the page-specific docs |
| Login loop or "Configuration" error | `AUTH_SECRET` / `NEXTAUTH_SECRET` missing, or `NEXTAUTH_URL` doesn't match the URL you opened |
| Env vars ignored | Restart `pnpm run dev`; file must be `.env.local` in the repo root |
| Port already in use | `PORT=3001 pnpm run dev:port` or stop the existing process |
| Smoke or accessibility test reports missing, unreadable, or malformed authentication state | Run `pnpm run test:auth-setup` in this clone or worktree, then rerun the test |

---
## 8. Next Steps (Optional)
- Configure Redis (`AZURE_REDIS_HOST` + `AZURE_REDIS_USE_ENTRA_ID=true`) for shared session/token storage
- Add Application Insights via `APPLICATIONINSIGHTS_CONNECTION_STRING`
- Wire RBAC by mapping users to `admin` / `operator` / `viewer` roles (see [docs/RBAC-IMPLEMENTATION.md](RBAC-IMPLEMENTATION.md))
- Move secrets to Key Vault and switch to managed identity in production
- Run local tests: `pnpm run test:auth-setup`, then `pnpm run test:smoke` or `pnpm run test:a11y`
- For CI, use the existing synthetic-auth workflow (`pnpm run test:smoke-ci` / `pnpm run test:a11y-ci`), not unattended local sign-in; see [Testing](development.md#8-testing)

Local smoke and accessibility tests run only the `authenticated` project and reuse
`playwright/.auth/user.json`. Both stop before starting Playwright when the file is
missing, unreadable, or malformed and tell you to run `pnpm run test:auth-setup`.
They never sign in automatically or create synthetic sessions. The preflight cannot
verify a server session is still valid; rerun setup after expiration or a sign-in redirect.
Keep the session file private and never commit it. Browser binaries and valid auth/tenant
configuration are also required; see [Testing](development.md#8-testing).

---
**Need more depth?** See [docs/application-installation.md](application-installation.md), [docs/auth-providers.md](auth-providers.md), and [docs/API-DOCUMENTATION.md](API-DOCUMENTATION.md).
