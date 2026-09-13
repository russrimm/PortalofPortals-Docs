# Multi-tenant management console — onboarding

End-to-end setup for the multi-tenant console: Entra app, admin consent,
secrets, environment variables, and optional discovery via Microsoft 365
Lighthouse or GDAP.

## 1. Architecture recap

- **Home tenant** = the tenant the operator signs in to.
  - Auth model: delegated (OBO) — same flow the rest of the portal uses.
  - No extra setup beyond what Portal 360 already needs.
- **Secondary tenants** = customer / partner tenants the operator administers.
  - Auth model: app-only via client credentials against a **multi-tenant
    Entra app**.
  - One admin consent per secondary tenant grants the portal's app the
    Graph permissions it needs.
- Tenant registry: `App_Data/tenant-registry.json` (file-backed, single
  source of truth). Secrets are **never** written here — only the Key
  Vault secret *name*.
- Per-tenant RBAC: `App_Data/tenant-rbac.json` overrides the env-driven
  `RBAC_*_EMAILS` / `RBAC_*_DOMAINS` per tenant.
- Audit log: `App_Data/tenant-rbac-audit.jsonl` (append-only).

## 2. Register the multi-tenant Entra app

In the **home** tenant, create a new app registration:

1. **Entra ID → App registrations → New registration**
   - Name: `Portal 360 — multi-tenant`
   - Supported account types: **Accounts in any organizational directory
     (Any Microsoft Entra ID tenant — Multitenant)**
   - Redirect URI: leave blank (this app is used app-only — no user sign-in)
2. Record the **Application (client) ID** → set as `MULTITENANT_APP_CLIENT_ID`.
3. **API permissions → Add a permission → Microsoft Graph → Application
   permissions** and add at least:
   - `Organization.Read.All` (health probe)
   - `User.Read.All` (cross-tenant UPN lookup)
   - `Policy.Read.All` (Conditional Access coverage)
   - `Policy.ReadWrite.ConditionalAccess` (Named Location propagation — only
     if you'll use the propagate button)
   - Add any other Application permissions your bulk actions require.
   - Do **not** add Delegated permissions — this app never signs users in.
4. **Certificates & secrets → New client secret**. Copy the **value**
   immediately. You will store it in Key Vault below, not in env vars.

> ⚠️ Application permissions confer tenant-wide read/write. Every secondary
> tenant grants the same scopes. Use the smallest set of permissions that
> your features actually need.

## 3. Store the client secret in Key Vault

The tenant registry stores only the secret *name*; the plaintext lives in
Azure Key Vault and is fetched server-side via `DefaultAzureCredential`.

1. Pick (or create) the vault that holds Portal 360 secrets. Set its URI as
   `MULTITENANT_KEYVAULT_URI` (e.g. `https://my-portal-kv.vault.azure.net`).
2. Add a secret. Suggested naming:
   `mt-app-secret-default` (use one secret per Entra app rotation, not per
   tenant — every secondary tenant uses the same multi-tenant app and
   therefore the same client secret).
3. Grant the portal's managed identity (or the developer's account in dev)
   the **Key Vault Secrets User** role on the vault.

When registering a tenant in the admin UI you'll be asked for this name.

## 4. Required environment variables

```
# Home tenant (defaults to AUTH_AZURE_AD_TENANT_ID / AZURE_TENANT_ID)
HOME_TENANT_ID=
HOME_TENANT_DISPLAY_NAME=Acme — production
HOME_TENANT_DOMAIN=acme.onmicrosoft.com

# Multi-tenant Entra app used for secondary tenants
MULTITENANT_APP_CLIENT_ID=00000000-0000-0000-0000-000000000000
MULTITENANT_KEYVAULT_URI=https://my-portal-kv.vault.azure.net

# Optional in-process scheduler (otherwise use an external cron — see §7)
MULTITENANT_HEALTH_INTERVAL_MIN=0
PORTAL360_CRON_SECRET=
```

## 5. Per-tenant admin consent

Each secondary tenant must grant admin consent to the multi-tenant Entra
app **once** before the portal can call Graph there.

The Tenants admin page auto-generates the URL when you register a tenant.
The pattern is:

```
https://login.microsoftonline.com/{tenantId}/adminconsent
  ?client_id={MULTITENANT_APP_CLIENT_ID}
```

Send the URL to a Global Administrator in the target tenant. Once they
click **Accept**, the next health probe will flip from `unauthorized` to
`healthy`.

If consent is later revoked the health badge returns to `unauthorized`
and the **Re-consent** banner appears on every `/multi-tenant/*` page
with a fresh copy-button next to the URL.

## 6. Discovery via GDAP / Microsoft 365 Lighthouse (optional)

If you already have GDAP relationships or Lighthouse onboarded customers,
the admin page can list them and prefill the register form.

Requirements:

- The signed-in user must have **delegated** permission to read partner
  relationships in the home tenant. Add these to the home-tenant app
  registration's *Delegated permissions* (not the multi-tenant app):
  - `DelegatedAdminRelationship.Read.All` (GDAP)
  - `ManagedTenant.Read.All` (Microsoft 365 Lighthouse, beta)
- An admin must consent to those scopes once for the home tenant.

The `/api/multi-tenant/lighthouse/discover` endpoint queries both Graph
endpoints in parallel; either failure is reported in the modal as a
non-fatal error so the other source's results still render.

## 7. Scheduled health refresh

Two options. Pick one; running both duplicates probes and registry writes.

### Option A: external cron (recommended for multi-instance hosts)

Have your scheduler POST to:

```
POST /api/multi-tenant/health-refresh
Headers:
  x-portal360-cron-secret: <PORTAL360_CRON_SECRET>
```

Examples:

- **Azure App Service WebJob** — single-line shell script with `curl`.
- **GitHub Actions** — `schedule:` trigger calling the endpoint via `curl`.
- **Azure Logic Apps / Functions Timer Trigger** — same call.

### Option B: in-process scheduler (single-instance dev / small deployments)

Explicitly configure the interval, cron credential, and portal origin:

```
MULTITENANT_HEALTH_INTERVAL_MIN=10
PORTAL360_CRON_SECRET=<long-random-string>
AUTH_URL=https://your-portal.example.com   # or NEXTAUTH_URL / WEBSITE_HOSTNAME
```

`src/instrumentation.ts` loads the Node-only startup module and registers one
timer set per process, including in development and with telemetry disabled,
unconfigured, or unable to initialize. Required auth, Redis, and audit
configuration guards still run first and can reject startup.

The interval is **off by default** (unset or `0`). Positive whole minutes from
`1` to `35791` are accepted; invalid or overflowing values warn and stay off.
A missing cron credential or origin also warns and leaves scheduling off.
The first request waits 30 seconds; subsequent requests follow the interval.
Redirects are rejected. Restart the process after changing startup settings.

The timer only invokes the existing endpoint; it does not confer provider
permissions or guarantee healthy probes. In particular, a cron request has no
signed-in user's delegated session for the home-tenant probe.

> For multi-instance deployments avoid Option B — every instance would
> refresh independently. Prefer Option A and leave
> `MULTITENANT_HEALTH_INTERVAL_MIN=0`.

Duplicate registration calls in one process do not add timers. Separate workers,
replicas, and external cron invocations are not coordinated, so this is not an
exactly-once execution guarantee.

## 8. Per-tenant portal RBAC

Default behavior: a user gets the same role in every tenant (resolved
from `RBAC_*_EMAILS` / `RBAC_*_DOMAINS`).

To grant a different role in a specific tenant, open
**Multi-tenant → Tenants & roles → Roles** and add an override. The
change is appended to `App_Data/tenant-rbac-audit.jsonl` — view it in
the **Audit** tab.

Resolution order in `requireTenantPermission(session, tenantId, perm)`:

1. Explicit override in `tenant-rbac.json`
2. Env-var role from `resolveRoleForEmail(email)`
3. `RBAC_DEFAULT_ROLE` (defaults to `viewer`)

### Audit and change-freeze storage

Audit pages, timeline reads, audit-storage requests, and advisory freeze windows
authorize the effective tenant in the data access layer ("DAL") before accessing
storage or cached records. An explicit tenant override takes precedence over the
signed-in session role, including roles derived from Microsoft Entra ID claims.
Without an override, these boundaries retain the verified session role and its
existing defaults.

Query parameters, active-tenant cookies, and `x-portal-request-url` are selection
requests, not authorization. Unknown or invalid selections fail closed rather
than reading or writing the home partition. Unreadable or malformed tenant-role
configuration also fails closed; a missing role file means no overrides.

The DAL passes an immutable, permission-bound tenant context between reads and
writes, checks its provenance and current caller, and rechecks the effective
role before cache access. Do not construct contexts from request bodies or
reuse them for another caller or operation. Delegated audit-query imports
explicitly target the home tenant where their Graph records originate.

The server-internal security audit sink is separate from user ingestion.
`securityAudit.ts` may append fixed security events and enrich them with freeze
identifiers even for denied attempts or authenticated connector operations.
It validates the tenant and derives a signed-in actor from the server session;
it does not grant that actor access to read audit/freeze contents or ingest
arbitrary records. Security events use the operation's explicit tenant, or home
for ordinary delegated operations, never an independently interpreted request
preference. Do not call the actor-based sink from user-facing routes.
Freeze windows remain advisory. These changes do not alter provider token
acquisition or the human-in-the-loop ("HITL") store.

## 9. Verification checklist

- [ ] `pnpm run build` succeeds.
- [ ] Sign in, open **Multi-tenant**, confirm the home tenant appears in
      the sidebar switcher with a `Home` badge.
- [ ] Register a secondary tenant (or click *Discover* and pick one).
- [ ] Send the admin-consent URL to a target-tenant admin and verify
      success.
- [ ] On the **Tenants** tab click the refresh icon — the health badge
      becomes `healthy` with a latency in milliseconds.
- [ ] Open `/multi-tenant/user-lookup`, search a known UPN. The hit
      tenant returns user details; other tenants return `Not found`.
- [ ] Open `/multi-tenant/conditional-access` — coverage matrix renders
      across all healthy tenants.
- [ ] Set `MULTITENANT_HEALTH_INTERVAL_MIN=1` and `PORTAL360_CRON_SECRET`,
      restart, wait 90 seconds — every tenant's `checkedAt` advances and
      the in-process scheduler logs `Health refresh scheduled every 1m`.

## 10. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Sidebar shows no tenants | Home tenant env vars unset | Set `HOME_TENANT_ID` |
| New tenant stuck on `unknown` | Health probe never ran | Click refresh icon or wait for scheduler |
| `unauthorized` after consent | Cached app-only token from before consent | Wait 60s for cache to expire, then refresh |
| `MULTITENANT_KEYVAULT_URI is not configured` | env var missing in prod | Set in App Service config and restart |
| `Key Vault returned 403 for secret '…'` | Managed identity lacks Secrets User role | Assign via the vault's RBAC blade |
| Discovery returns "no tenants" | No GDAP / Lighthouse relationships, or missing delegated consent | Re-consent the home-tenant app with `DelegatedAdminRelationship.Read.All` and `ManagedTenant.Read.All` |
| Audit tab is empty | `tenant-rbac-audit.jsonl` doesn't exist yet | Grant or revoke a role to create the first entry |
