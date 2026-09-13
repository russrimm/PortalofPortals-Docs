# Portal 360° – Installation & Configuration Guide

This comprehensive guide walks you (a first‑time Azure / Microsoft Graph implementer) through:
- Forking & local project setup
- Creating / configuring an Azure (Entra ID) App Registration (Portal UI + CLI)
- Adding Microsoft Graph application permissions (Portal UI + CLI)
- Authenticating with either a client secret or certificate (Portal UI + CLI + script)
- Setting environment variables with full reference and purpose
- (Optional) Power Platform service principal wiring
- Running & verifying the portal (dark mode, demo auth)
- Capturing dark‑mode screenshots for documentation/testing
- Troubleshooting common & advanced issues

Each numbered section now contains: Portal Steps, CLI Equivalent, Screenshot Placeholders, and Notes where applicable.

---
## 1. Fork & Clone

1. On GitHub, click Fork on the `PortalofPortals` repository.

2. Clone your fork:

```powershell
git clone https://github.com/<your-org-or-user>/PortalofPortals.git
cd PortalofPortals
```

3. (Optional) Add upstream remote to pull future updates:

```powershell
git remote add upstream https://github.com/russrimm/PortalofPortals.git
git fetch upstream
```

---
## 2. Prerequisites

Install / have access to:

- Node.js 24+ (recommend latest LTS)
- PowerShell (Windows) or bash/zsh (macOS/Linux)
- An Azure AD (Microsoft Entra ID) tenant where you can create App Registrations
- (Optional) Power Platform admin access (for those pages)
- OpenSSL for certificate conversion (comes with Git for Windows or install separately)

Verify versions:

```powershell
node -v
```

---
## 3. Create Azure App Registration (Interactive Web App)

### 3.A Portal Steps

1. Azure Portal → Microsoft Entra ID → App registrations → New registration.  
2. Name: `Portal360Local` (choose any descriptive name).  
3. Supported account types: Single tenant (recommended) unless you need cross‑tenant access.  
4. Redirect URI (Web): `http://localhost:3000/api/auth/callback/azure-ad` (adjust port if changed).  
5. Click Register.  
6. Copy:  
   - Application (client) ID → `AZURE_CLIENT_ID`  
   - Directory (tenant) ID → `AZURE_TENANT_ID`  
7. (Optional) Branding → add a logo if desired.  

Screenshot placeholders (capture after each major step):

```
> 📸 _Screenshot pending (**App Registration - New** — `screenshots/appreg-new.png`). Regenerate via [`pnpm run test:screenshots`](../tests/README-SCREENSHOTS.md)._
> 📸 _Screenshot pending (**App Registration - Overview** — `screenshots/appreg-overview.png`). Regenerate via [`pnpm run test:screenshots`](../tests/README-SCREENSHOTS.md)._
> 📸 _Screenshot pending (**App Registration - RedirectURI** — `screenshots/appreg-redirect.png`). Regenerate via [`pnpm run test:screenshots`](../tests/README-SCREENSHOTS.md)._
```

### 3.B CLI Equivalent

Create the app (basic):

```powershell
$displayName = "Portal360Local"
az ad app create --display-name $displayName --web-redirect-uris "http://localhost:3000/api/auth/callback/azure-ad"
```

Get the appId / tenant:

```powershell
az ad app list --display-name $displayName --query "[0].appId" -o tsv
az account show --query tenantId -o tsv
```

### 3.C Optional: Expose API (Custom Scopes)

Not required for local portal usage. If another service will call this app, define scopes under Expose an API (Portal) or via CLI (omitted for brevity).

### 3.D Notes

- If you later separate interactive user flow vs. daemon/background tasks, you can create a second app registration and split permissions.  
- Keep redirect URIs consistent with `NEXTAUTH_URL`.

---
## 4. Create a Client Secret OR Certificate

You can authenticate server‑side Graph calls using a confidential client credential: either a client secret (simpler) or a certificate (more secure, recommended for production).

### 4.A Option A – Client Secret (Portal)

1. App Registration → Certificates & secrets → Client secrets → New client secret.  
2. Description: `local-dev`  
3. Expiration: 6–12 months (set a calendar reminder).  
4. Copy the Value immediately → `AZURE_CLIENT_SECRET` (Value, not Secret ID).  

Screenshot placeholders:
```
> 📸 _Screenshot pending (**Client Secret - New** — `screenshots/clientsecret-new.png`). Regenerate via [`pnpm run test:screenshots`](../tests/README-SCREENSHOTS.md)._
> 📸 _Screenshot pending (**Client Secret - Value** — `screenshots/clientsecret-value.png`). Regenerate via [`pnpm run test:screenshots`](../tests/README-SCREENSHOTS.md)._
```

### 4.B Option A – Client Secret (CLI)

```powershell
$appId = <your appId>
az ad app credential reset --id $appId --append --display-name "local-dev" --years 1
# Output includes the new clientSecret (store securely!)
```

### 4.C Option B – Certificate (Local Generation)

Use existing helper script + OpenSSL for a long-lived (example 3 years) self-signed certificate:

```powershell
node scripts/generate-azure-cert.js
openssl req -new -x509 -key powerplatformapp_private.pem -out powerplatformapp.cer -days 1095 -subj "/CN=Portal360Local"
```

Upload `powerplatformapp.cer` under Certificates & secrets → Certificates.

Retrieve thumbprint (Portal) or with PowerShell:
```powershell
Get-FileHash -Algorithm SHA1 powerplatformapp.cer | Select-Object Hash
```
Set env vars:
```
AZURE_CERT_PRIVATE_KEY_PATH=powerplatformapp_private.pem
AZURE_CERT_THUMBPRINT=<thumbprint>
```

### 4.D Option B – Certificate (CLI Upload)

```powershell
az ad app certificate add --id $appId --file powerplatformapp.cer --display-name "local-cert"
```

### 4.E When to Choose Which

- Secret: Quick local prototype, low ceremony, but rotate frequently.  
- Certificate: Better for automation / production; store private key in Azure Key Vault when deployed.  
- You do NOT set secret and certificate simultaneously—choose one credential path in the running environment.

---
## 5. API Permissions (Microsoft Graph)

### 5.A Portal Steps

1. App Registration → API permissions → Add a permission.  
2. Microsoft Graph → Application permissions.  
3. Add each of:  
   - `User.Read.All`  
   - `Group.Read.All`  
   - `Application.Read.All`  
   - `Device.Read.All`  
   - `AuditLog.Read.All`  
   - `SecurityEvents.Read.All`  
   - `Directory.Read.All`  
4. Click Grant admin consent for <tenant>. Confirm.  
5. Status column should show Granted.  

Screenshot placeholders:
```
> 📸 _Screenshot pending (**API Permissions - List** — `screenshots/api-perms-list.png`). Regenerate via [`pnpm run test:screenshots`](../tests/README-SCREENSHOTS.md)._
> 📸 _Screenshot pending (**API Permissions - Grant** — `screenshots/api-perms-grant.png`). Regenerate via [`pnpm run test:screenshots`](../tests/README-SCREENSHOTS.md)._
```

### 5.B CLI Equivalent

```powershell
# Graph resource appId is fixed: 00000003-0000-0000-c000-000000000000
$appId = <your appId>
az ad app permission add --id $appId --api 00000003-0000-0000-c000-000000000000 `
   --api-permissions User.Read.All=Role Group.Read.All=Role Application.Read.All=Role `
   Device.Read.All=Role AuditLog.Read.All=Role SecurityEvents.Read.All=Role Directory.Read.All=Role
az ad app permission admin-consent --id $appId
```

### 5.C Notes

- Add any SharePoint / Reports / Teams specific permissions when enabling those pages; re‑run admin consent.  
- Delegated permissions are only needed when per‑user delegated flows are introduced (not required for current demo auth gate).  
- Least privilege: If some pages/features are disabled, you can omit their related scopes.

---
## 6. Power Platform (Optional)

If using Power Platform pages:

1. Register (or reuse) a Service Principal with required Power Platform admin roles.  
2. Assign roles via the Power Platform Admin Center.  
3. Add any environment-specific API permissions if needed.  

Set environment variables:

```
POWER_PLATFORM_CLIENT_ID=<sp-client-id>
POWER_PLATFORM_CLIENT_SECRET=<sp-secret or certificate-based flow>
```

---
## 7. Environment Variables

Create `.env.local` in project root (never commit). Use only one auth credential path (secret OR cert).

### 7.A Quick Template

```
AZURE_TENANT_ID=<tenant-guid>
AZURE_CLIENT_ID=<app-client-id>
AZURE_CLIENT_SECRET=<secret-if-using-secret>
# Certificate alternative:
# AZURE_CERT_PRIVATE_KEY_PATH=powerplatformapp_private.pem
# AZURE_CERT_THUMBPRINT=<thumbprint>

GRAPH_CLIENT_ID=<same-or-alt-client-id>
GRAPH_CLIENT_SECRET=<graph-secret>

POWER_PLATFORM_CLIENT_ID=<id>
POWER_PLATFORM_CLIENT_SECRET=<secret or leave blank if unused>

NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<strong-random>
# LOG_LEVEL=debug
```

Generate a strong secret (PowerShell):

```powershell
[guid]::NewGuid().ToString('N')
```

### 7.B Detailed Reference
| Variable | Required | Purpose | When to Omit / Notes |
|----------|----------|---------|----------------------|
| AZURE_TENANT_ID | Yes | Identifies Entra tenant for Graph auth | Never omit |
| AZURE_CLIENT_ID | Yes | App Registration client (application) ID | Core confidential client |
| AZURE_CLIENT_SECRET | One of secret/cert | Secret credential for confidential client | Omit if using cert |
| AZURE_CERT_PRIVATE_KEY_PATH | One of secret/cert | Path to PEM private key for certificate auth | Omit if using secret |
| AZURE_CERT_THUMBPRINT | One of secret/cert | Thumbprint Azure associates with uploaded cert | Omit if using secret |
| GRAPH_CLIENT_ID | Optional | Separate client for delegated flows / future features | Can mirror AZURE_CLIENT_ID |
| GRAPH_CLIENT_SECRET | Optional | Secret for separate Graph client | Same rotation rules |
| POWER_PLATFORM_CLIENT_ID | Optional | Service principal for Power Platform pages | Only if those pages used |
| POWER_PLATFORM_CLIENT_SECRET | Optional | Credential for Power Platform SP | Consider certificate later |
| NEXTAUTH_URL | Yes (NextAuth) | Base URL for callback construction | Must match redirect URI host/port |
| NEXTAUTH_SECRET | Yes | Session encryption & CSRF token signing | Rotate on compromise |
| LOG_LEVEL | No | Adjust verbosity (debug/info/warn) | Default may be silent if unset |

### 7.C Production Guidance

- Use Azure App Service / Container App configuration settings (not committed .env).  
- Store secrets in Azure Key Vault + reference via Key Vault references where possible.  
- Rotate secrets/certs regularly and test redeploy.

---
## 8. Install Dependencies

```powershell
pnpm install
```

(If Playwright needed for screenshots/tests:)

```powershell
pnpm exec playwright install
```

---
## 9. Run in Development

```powershell
pnpm run dev
```

Navigate to `http://localhost:3000`.

### 9.A Demo Auth Gate

Temporary login (username/password): `russdemo` / `russdemo`. Replace with real NextAuth + MSAL before prod.

### 9.B Port Changes

If port conflict causes dev server to move (e.g., 3001) update:

```
NEXTAUTH_URL=http://localhost:3001
```

Restart dev server to apply.

### 9.C Dark Mode Confirmation

SSR `<html class="dark">` + early `pulseTheme` script. Force theme:

```
/?theme=light
/?theme=dark
```

Screenshot placeholders:

```
> 📸 _Screenshot pending (**Login Screen** — `screenshots/app-login.png`). Regenerate via [`pnpm run test:screenshots`](../tests/README-SCREENSHOTS.md)._
> 📸 _Screenshot pending (**Dashboard Dark** — `screenshots/app-dashboard-dark.png`). Regenerate via [`pnpm run test:screenshots`](../tests/README-SCREENSHOTS.md)._
```

---
## 10. Building for Production

```powershell
pnpm run build
pnpm start
```

Ensure production secrets use environment variables (e.g., in Azure App Service or Container App settings). Never bake secrets in the image.

---
## 11. Generating Dark Mode Screenshots

### 11.A Automated (Playwright)

```powershell
pnpm exec playwright test tests/dark-mode-screenshots.spec.ts --reporter=line
```

Outputs to `artifacts/screenshots/` (ensure `pnpm exec playwright install` ran once). Add new test steps for additional pages when features expand.

### 11.B Manual Capture Guidelines

- Maintain 16:9 aspect (e.g., 1600×900) for consistency.  
- Use consistent file naming: `feature-context-state.png` (e.g., `secure-score.png`).  
- Store under `docs/screenshots/` for docs embedding.  

### 11.C Updating Docs With Screenshots

Embed with Markdown: `![Secure Score — dark](screenshots/secure-score-dark.png)`. Portal 360° documentation ships light + dark theme pairs — the dark variant always uses the `-dark.png` suffix.

---
## 12. Common & Advanced Issues
| Symptom | Probable Cause | Fix | Prevention |
|---------|----------------|-----|-----------|
| 401 on Graph calls | Admin consent not granted | Re-run admin consent (Portal or CLI) | Add to onboarding checklist |
| 403 on specific endpoint | Missing specific Graph permission | Add required permission + consent | Principle of least privilege docs |
| Dark mode flashes light | Early theme script removed | Restore snippet in `layout.tsx` | Avoid editing theme bootstrap block |
| Audit Logs resize handles missing | UI build stale / feature flag not merged | Stop dev server, `pnpm run dev` again | Automated UI smoke test |
| Login always fails | Wrong demo creds or auth gate logic modified | Use `russdemo` / update logic | Replace with real NextAuth early |
| ENV var not loaded | Incorrect file name / server not restarted | Confirm `.env.local`, restart | Add dev script checking required vars |
| Permission still shows Not Granted | Delay in Graph replication | Wait a few minutes; retry consent | Document expected delay |
| Certificate thumbprint mismatch | Uploaded different cert than using locally | Re-upload correct .cer; update thumbprint | Automated cert output verification |
| Secret expired unexpectedly | Short lifetime chosen | Generate new secret; update `.env.local` | Calendar reminders; rotate proactively |
| Playwright screenshot directory empty | Test skipped or failing | Run with `--reporter=line` to see failures | Add CI step enforcing screenshot test |

---
## 13. Hardening & Next Steps

- Replace demo auth with MSAL + NextAuth (Authorization Code + PKCE + Refresh).  
- Introduce role-based authorization (Azure AD App Roles or custom claims).  
- Cache heavy Graph responses (e.g., Memory + revalidation timer).  
- Enable Application Insights (telemetry + Kusto queries).  
- Add CI pipeline (lint, typecheck, build, Playwright).  
- Integrate Key Vault referencing for secrets in production (App Service / Container App).  
- Add dependency vulnerability scanning (GitHub Dependabot / pnpm audit).  
- Implement structured logging (JSON) for central aggregation.

---
## 14. Updating Your Fork
```powershell
git fetch upstream
git checkout russ   # or your working branch
git merge upstream/main
# Resolve conflicts, test, then push
```

---
## 15. Support
Open an issue in your fork or upstream repository for help. Provide:
- Repro steps
- Logs (sanitized)
- Node version & OS

---
**Portal 360°** – Your complete tenant administration and monitoring solution.
