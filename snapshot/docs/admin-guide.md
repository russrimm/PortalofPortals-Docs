# Administrator Guide

Operational guide for IT administrators running Portal 360°. It covers post-deployment configuration, day-to-day operations, monitoring, and incident response.

> For initial deployment to Azure, see [`AZURE-DEPLOYMENT-GUIDE.md`](./AZURE-DEPLOYMENT-GUIDE.md) and [`DEPLOYMENT-CHECKLIST.md`](./DEPLOYMENT-CHECKLIST.md). For the upstream API permissions Portal 360° depends on, see [`API-DOCUMENTATION.md`](./API-DOCUMENTATION.md).

---

## 1. Roles and responsibilities

Portal 360° expects (at minimum) three operational roles:

| Role                  | Responsibilities                                                                        |
|-----------------------|------------------------------------------------------------------------------------------|
| **Tenant admin**      | Owns the Entra ID app registration, grants admin consent, manages PIM eligibility.       |
| **Platform owner**    | Owns the hosting environment (App Service / Container Apps), secrets, observability.     |
| **Portal operator**   | Day-to-day user of Portal 360° — handles tickets, triage, governance reviews.            |

A single person can fill all three roles in small tenants, but the responsibilities below are addressed to whichever role is appropriate.

---

## 2. Required environment variables

Portal 360° is configured exclusively via environment variables. The canonical reference is [`docs/ENVIRONMENT-VARIABLES.md`](./ENVIRONMENT-VARIABLES.md). The minimum required set is:

```bash
# Microsoft Entra ID (Azure AD)
AZURE_TENANT_ID=<tenant-guid>
AZURE_CLIENT_ID=<app-id>
AZURE_CLIENT_SECRET=<client-secret>

# NextAuth v5
NEXTAUTH_URL=https://portal.example.com   # canonical public URL
NEXTAUTH_SECRET=<openssl rand -base64 32>

# Optional NextAuth aliases (both naming schemes are accepted)
AUTH_URL=https://portal.example.com
AUTH_SECRET=<same value as NEXTAUTH_SECRET>
AUTH_AZURE_AD_TENANT_ID=<tenant-guid>
AUTH_AZURE_AD_CLIENT_ID=<app-id>
AUTH_AZURE_AD_CLIENT_SECRET=<client-secret>
```

> Never check secrets into the repository. Use Azure Key Vault references in App Service / Container Apps and rotate the client secret on a published schedule.

For provider-specific scopes (Graph, ARM, Power Platform, Defender, etc.) see [`auth-providers.md`](./auth-providers.md).

---

## 3. Post-deployment checklist

After the first successful deploy:

1. **Grant admin consent** for every Graph / ARM / Power Platform permission listed in [`API-DOCUMENTATION.md`](./API-DOCUMENTATION.md).
2. **Verify session sign-in** works end-to-end (`/` → Microsoft login → portal home).
3. **Confirm API auth** by running:

   ```bash
   curl -i https://portal.example.com/api/users
   # expected: HTTP/2 401 with body { "error": "Unauthorized" }
   ```

4. **Smoke-test docs endpoints** while signed in:
   - `/api/openapi.json` returns JSON
   - `/api/docs` renders Swagger UI
   - `/api/redoc` renders ReDoc
5. **Enable Application Insights** (set `APPLICATIONINSIGHTS_CONNECTION_STRING`) and confirm telemetry is flowing — see [`AI-TELEMETRY-SETUP.md`](./AI-TELEMETRY-SETUP.md).
6. **Configure scheduled jobs** (Power Platform schema sync, screenshot regression, etc.) — see § 7.

A more complete go-live checklist is in [`DEPLOYMENT-CHECKLIST.md`](./DEPLOYMENT-CHECKLIST.md).

---

## 4. Access control (RBAC)

Portal 360° has its own coarse RBAC layer on top of Entra ID group membership. The role helpers live in `src/lib/rbac.ts` and the implementation guide is [`RBAC-IMPLEMENTATION.md`](./RBAC-IMPLEMENTATION.md).

Recommended approach:

- Create dedicated **security groups** (e.g. `portal360-admins`, `portal360-operators`, `portal360-readers`) in Entra ID.
- Map those groups to Portal 360° roles via the group-ID environment variables documented in `ENVIRONMENT-VARIABLES.md`.
- Use **PIM (Privileged Identity Management)** for admin roles so day-to-day staff inherit standing reader access only.

---

## 5. Session, CSRF, and rate limits

The portal ships with secure defaults; administrators should be aware of them when triaging support tickets:

| Control                  | Default                                                                | Where to change                            |
|--------------------------|-------------------------------------------------------------------------|--------------------------------------------|
| Session cookie           | HttpOnly, `Secure` in prod, `SameSite=Lax`, NextAuth-managed lifetime  | `auth.ts`                                  |
| CSRF                     | Required for all cookie-authenticated `POST` / `PUT` / `PATCH` / `DELETE` | `middleware.ts` + `src/lib/csrf.ts`        |
| Rate limit (unauth IP)   | 20 requests / minute                                                    | `RATE_LIMIT_UNAUTH` in `middleware.ts`     |
| Rate limit (auth IP)     | 200 requests / minute                                                   | `RATE_LIMIT_AUTH` in `middleware.ts`       |
| Strict CSP               | `script-src 'self' 'nonce-…' 'strict-dynamic'`                          | `applySecurityHeaders` in `middleware.ts`  |

Common 4xx symptoms are documented in [`api-integration.md`](./api-integration.md) § 8.

---

## 6. Observability

Portal 360° emits OpenTelemetry traces, logs, and metrics via `@azure/monitor-opentelemetry`. See:

- [`OPENTELEMETRY-SETUP.md`](./OPENTELEMETRY-SETUP.md) — Application Insights connection-string setup
- [`OPENTELEMETRY-QUERIES.md`](./OPENTELEMETRY-QUERIES.md) — pre-built KQL queries for common dashboards
- [`AI-TELEMETRY-SETUP.md`](./AI-TELEMETRY-SETUP.md) — telemetry around AI-powered features

For ad-hoc analysis, use the Logs blade in Application Insights and the queries in `OPENTELEMETRY-QUERIES.md`. When investigating any failure, query before asserting numbers from memory and prefer the last 24 hours unless a longer window is required.

---

## 7. Scheduled automation

The repository ships a weekly GitHub Actions workflow (`.github/workflows/sync-tenant-settings.yml`) that:

- Diffs the Power Platform tenant-settings registry against the upstream Terraform provider docs.
- Diffs the supported Power Platform inventory API version against `MicrosoftDocs/power-platform/admin/inventory-api.md`.
- Opens a PR whenever drift is detected.

Local equivalents:

```bash
pnpm run sync:tenant-settings           # dry-run diff
pnpm run sync:tenant-settings:write     # apply diffs

pnpm run sync:inventory-api             # dry-run diff
pnpm run sync:inventory-api:write       # apply diffs
```

See [`power-platform-schema-sync.md`](./power-platform-schema-sync.md) for the full design.

---

## 8. Backups, restore, secrets rotation

- **Secrets:** rotate `AZURE_CLIENT_SECRET` and `NEXTAUTH_SECRET` on the cadence required by your organization (often 90 days). Store them in Key Vault and reference them from the app service settings.
- **Configuration:** environment variables and tenant-specific settings are managed in your IaC layer (Bicep / Terraform). Treat them as code and review changes via PR.
- **State:** Portal 360° is stateless aside from the in-process rate limiter and (optionally) Redis-backed session storage. For Redis, follow [`redis-setup-guide.md`](./redis-setup-guide.md).

---

## 9. Incident response

When a regression is reported:

1. Check Application Insights for spikes in `requests` failures, `exceptions`, or dependency latency.
2. Tail the App Service log stream for the affected revision.
3. Compare the active revision to the previous one and roll back if a deploy is the obvious cause.
4. If the issue is upstream (Graph / ARM / Power Platform), check the Service Health page in Portal 360° (`/service-health`).
5. Capture screenshots and KQL queries in the post-mortem.

For a curated incident-response playbook, including the most common error modes (CSRF, 431 header size, OAuth invalid client, AADSTS9002326), see:

- [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md)
- [`AADSTS9002326-FIX.md`](./AADSTS9002326-FIX.md)
- [`fixing-431-header-too-large.md`](./fixing-431-header-too-large.md)
- [`fix-oauth-invalid-client.md`](./fix-oauth-invalid-client.md)

---

## 10. Updating Portal 360°

1. Pull the latest `main` and review `CHANGELOG`-style entries in `docs/`.
2. Run `pnpm install` to pick up dependency updates.
3. Run `pnpm run docs:openapi` if you added or changed any API routes.
4. Run `pnpm run lint` and the Playwright smoke suite before promoting.
5. Promote through your usual environments (dev → staging → prod) with a deliberate gap between stages.

For dependency upgrades that touch authentication (NextAuth, MSAL), test the sign-in flow end-to-end before promoting to production.
