# Environment Variables Configuration

This file documents the environment variables Portal 360° reads at runtime. Variables marked **required** must be set for the application to start; everything else is feature-gated and enables specific pages or capabilities.

`.env.local.example` in the repository root is the canonical starter file. Copy it to `.env.local` for local development, and inject the same values via App Service settings (with Key Vault references for secrets) in production.

## 1. NextAuth & Microsoft Entra ID (required)

These power sign-in. NextAuth v5 accepts either the legacy `NEXTAUTH_*` / `AZURE_*` names or the new `AUTH_*` aliases — whichever is set first wins.

| Variable | Purpose |
|---|---|
| `NEXTAUTH_URL` or `AUTH_URL` | Public URL of the portal (e.g. `http://localhost:3000`, `https://portal.example.com`). |
| `NEXTAUTH_SECRET` or `AUTH_SECRET` | 32-byte random secret used to sign session cookies. Generate with `openssl rand -base64 32`. |
| `AZURE_TENANT_ID` (or `AUTH_AZURE_AD_TENANT_ID`) | Microsoft Entra tenant GUID. |
| `AZURE_CLIENT_ID` (or `AUTH_MICROSOFT_ENTRA_ID_ID`, `AUTH_AZURE_AD_CLIENT_ID`) | App registration (client) ID. |
| `AZURE_CLIENT_SECRET` (or `AUTH_MICROSOFT_ENTRA_ID_SECRET`, `AUTH_AZURE_AD_CLIENT_SECRET`) | App registration client secret. |
| `AUTH_DISABLED` | Set to `1` to disable authentication during local development. Never set in production. |
| `PORTAL360_ALLOW_SYNTHETIC_AUTH` | Set to `1` **only** in CI or local test runs. Enables the synthetic-session code path used by Playwright screenshots and route-coverage tests. `validateAuthConfig()` at boot rejects this flag when `NODE_ENV=production`; `src/lib/auth.ts` throws on module load as a second layer. Never set on staging/preview slots. |
| `ENABLE_DEBUG_ENDPOINTS` | Set to `1` to allow admin-gated diagnostic responses from `/api/auth/check`, `/api/debug/env`, `/api/debug/token-store`, `/api/debug-cookie`, `/api/debug-headers`, `/api/debug-token`, `/api/auth/session-debug`, `/api/test-graph-token`, `/api/test-sharepoint`, and `/api/exchange/debug`. Without this flag those routes reply 404 (or in `check`'s case, only a probe response). Keep unset in production unless actively troubleshooting. |

## 2. Azure subscription (optional)

Used by the Azure resource, billing, advisor, policy, and virtual-machine pages.
The Bicep wizard is [export only](azure-bicep-sdk-migration.md); neither a default
subscription nor `AZURE_DEPLOY_ALLOWED_SUBSCRIPTIONS` enables direct Bicep deployment.

| Variable | Purpose |
|---|---|
| `AZURE_SUBSCRIPTION_ID` | Default subscription used by `/api/azure/**` routes when the caller does not pass one. |
| `NEXT_PUBLIC_AZURE_SUBSCRIPTION_ID` | Same value exposed to the browser for client-side links and defaults. |

## 3. RBAC (optional, recommended)

Maps signed-in users to portal roles. See [`RBAC-IMPLEMENTATION.md`](./RBAC-IMPLEMENTATION.md) for the full role/permission matrix.

| Variable | Purpose |
|---|---|
| `RBAC_ADMIN_EMAILS` | Comma-separated list of emails mapped to `admin`. |
| `RBAC_OPERATOR_EMAILS` | Comma-separated list of emails mapped to `operator`. |
| `RBAC_VIEWER_EMAILS` | Comma-separated list of emails mapped to `viewer`. |
| `RBAC_ADMIN_DOMAINS` | Comma-separated list of email domains mapped to `admin`. |
| `RBAC_OPERATOR_DOMAINS` | Comma-separated list of domains mapped to `operator`. |
| `RBAC_VIEWER_DOMAINS` | Comma-separated list of domains mapped to `viewer`. |
| `RBAC_DEFAULT_ROLE` | Fallback role when no list matches. Accepts `admin`, `operator`, or `viewer`. Defaults to `viewer`. |

## 4. Session storage (Redis) — **required for multi-instance deployments**

Portal 360° uses Redis for two pieces of shared state:

- **Token store** (`src/lib/tokenStore.ts`) — OAuth/OBO access and refresh tokens, keyed by the session JWT's `jti`.
- **Rate limiter** (`src/lib/rateLimiter.ts`) — the distributed sliding-window limits applied to API routes.

When no Redis is configured **both fall back to a process-local in-memory store**. That is fine for local development and for a single instance, but on a multi-instance deployment it means:

- Tokens live only on the instance that handled the sign-in. A request routed to any other instance finds no tokens and the user hits a spurious re-auth prompt or a `401`.
- Rate limits are counted per process, so the effective limit is multiplied by the instance count.

**Redis is REQUIRED for any deployment running more than one instance** (App Service scale-out, Container Apps replicas, AKS pods, staging slots serving traffic). See [`redis-setup-guide.md`](./redis-setup-guide.md) for provisioning.

**Single-instance deployments without Redis must enable App Service ARR affinity** (*App Service > Settings > Configuration > General settings > Session affinity: **On***) so every request from a browser session lands on the same instance. Without it, a scale event or instance recycle silently signs users out.

At Node startup, `src/instrumentation.ts` loads the Node-only startup checks for Redis configuration. In production with none present it logs a prominent `[redis][cfg] WARNING` naming both the token store and the rate limiter as degraded. Required Redis and Cosmos configuration checks run before optional telemetry and scheduling; disabling telemetry cannot bypass them.

| Variable | Purpose |
|---|---|
| `AZURE_REDIS_HOST` | Hostname of an Azure Cache for Redis instance (e.g. `mycache.redis.cache.windows.net`). Only used when `AZURE_REDIS_USE_ENTRA_ID=true`. |
| `AZURE_REDIS_USE_ENTRA_ID` | Set to `true` to authenticate to Redis with the application's managed identity instead of an access key. |
| `AZURE_REDIS_USERNAME` | Username used with Entra ID auth. Defaults to `default`. |
| `AZURE_REDIS_CONNECTION_STRING` | Full `rediss://` connection string when not using Entra ID. |
| `REDIS_URL` | Alternative connection string for a non-Azure Redis (e.g. local `redis://localhost:6379`). |
| `PORTAL360_REQUIRE_REDIS` | Set to `1` to **fail startup** when no Redis configuration is present, instead of only warning. Recommended for every multi-instance environment. Applies regardless of `NODE_ENV`, so leave it unset locally (development deliberately skips Redis — the Azure IMDS probe used by `DefaultAzureCredential` hangs outside Azure). |

A configuration counts as "present" when either `AZURE_REDIS_HOST` **and** `AZURE_REDIS_USE_ENTRA_ID=true` are set, or one of `REDIS_URL` / `AZURE_REDIS_CONNECTION_STRING` is set. Setting `AZURE_REDIS_HOST` without the Entra ID flag is ignored and logs its own warning.

## 5. Cosmos DB (optional)

Audit logs and per-user settings persist to Cosmos DB when configured. The core
`cosmosClient.ts` path uses Microsoft Entra credentials; it does not fall back to
an account key. Production dependency verification follows that same identity path.

| Variable | Purpose |
|---|---|
| `COSMOS_DB_ENDPOINT` | `https://<account>.documents.azure.com:443/` |
| `COSMOS_DB_DATABASE_ID` | Database name. Defaults to `portal360`. |
| `COSMOS_DB_AUDIT_CONTAINER_ID` | Container for audit logs. Defaults to `audit-logs`. |
| `COSMOS_DB_USER_SETTINGS_CONTAINER_ID` | Container for user settings. Defaults to `user-settings`. |
| `COSMOS_DB_KPI_SNAPSHOTS_CONTAINER_ID` | Container for executive KPI daily snapshots. Defaults to `kpi-snapshots`. |
| `KPI_SNAPSHOT_RETENTION_DAYS` | Retention for KPI snapshots, enforced by Cosmos native TTL. Defaults to `90`; clamped to 7–730. Changing it after the container exists requires updating `defaultTtl` on the container (redeploy `infra/main.bicep`) — the app does not retune TTL on an existing container. |
| `COSMOS_DB_DRIFT_SNAPSHOTS_CONTAINER_ID` | Container for Power Platform tenant drift baselines and snapshot history. Defaults to `drift-snapshots`. |
| `DRIFT_SNAPSHOT_RETENTION_DAYS` | Retention for drift snapshots, enforced by Cosmos native TTL. Defaults to `180`; clamped to 30–730. The approved baseline is written with `ttl: -1` and never expires. Same caveat as above: the app does not retune `defaultTtl` on an existing container. |
| `COSMOS_DB_KEY` | Account key consumed by some standalone tools; not an authentication fallback for the core application Cosmos client or production dependency verification. Treat as a secret. |
| `COSMOS_DB_PAYG_GUARDRAILS_CONTAINER_ID` | Container holding pay-as-you-go budget guardrails. Defaults to `payg-guardrails`. See [Pay-as-you-go Budget Guardrails](./payg-budget-guardrails.md). |
| `PAYG_EVALUATION_RETENTION_DAYS` | Retention for guardrail evaluation history, enforced by Cosmos native TTL. Defaults to `180`; clamped to 30–730. Guardrail configuration and the imported credit report are written with `ttl: -1` and never expire — losing either would silently disarm a spend ceiling. Same caveat as above: the app does not retune `defaultTtl` on an existing container. |
| `COSMOS_DB_MANAGED_IDENTITY_CLIENT_ID` | Optional. Client ID of a *user-assigned* managed identity to use for Cosmos. Leave unset to use the host's system-assigned identity. |
| `PORTAL360_REQUIRE_COSMOS` | Set to `1` to **fail startup** when no Cosmos configuration is present, instead of only warning. Recommended for any environment with a compliance or retention obligation: `logSensitiveAction` swallows write failures, so without Cosmos a privileged action still succeeds but leaves no durable audit record, and the `audit-log-ingest` / `kpi-snapshot` WebJobs persist nothing. Applies regardless of `NODE_ENV`, so leave it unset locally. |

The requirement flag also controls production dependency verification: `1` or
`true` (trimmed, case-insensitive) requires actual reads of the configured audit
and user-settings containers, with the expected `/tenantId` and `/userId`
partition keys. An optional Cosmos instance (flag unset, `0`, or `false`) is not
probed and cannot fail that gate. Configuration-only startup checks remain separate.

> **Credential selection.** When the host exposes a managed identity (`IDENTITY_ENDPOINT` is
> present on App Service and Container Apps), Cosmos binds directly to that identity instead of
> using `DefaultAzureCredential`. `DefaultAzureCredential` resolves `EnvironmentCredential` first
> whenever `AZURE_CLIENT_ID`/`AZURE_CLIENT_SECRET` are set, which sends Cosmos requests as the
> Graph service principal and returns `403` with substatus `5301`. Grant the **Cosmos DB Built-in
> Data Contributor** data-plane role to the managed identity's principal ID — see
> `cosmosDataContributorPrincipalIds` in [`infra/main.bicep`](../infra/main.bicep).

> **Daily KPI snapshots.** `scripts/cron/kpi-snapshot.mjs` runs as an Azure WebJob
> (`App_Data/jobs/triggered/kpi-snapshot/`, 06:20 and 18:20 UTC) and is the sole writer for the
> `mfa-coverage`, `device-compliance`, `high-sev-alerts`, and `guest-exposure` series. It needs
> the same `AZURE_CLIENT_ID` / `AZURE_CLIENT_SECRET` / `AZURE_TENANT_ID` as the audit-log cron,
> plus the Graph app roles listed in [`APP-ONLY-JOBS.md`](./APP-ONLY-JOBS.md). Optional tuning:
> `KPI_SNAPSHOT_GRAPH_RETRY_MAX` (default `5`), `KPI_SNAPSHOT_GRAPH_RETRY_BASE_DELAY_MS`
> (default `1000`), `KPI_SNAPSHOT_DEVICE_PAGE_LIMIT` (default `50` pages of 1000 devices).
> Re-running it on the same day overwrites rather than duplicates, so it is safe to trigger
> manually from the Azure portal.

> **No legacy KPI history exists to migrate.** KPI snapshots briefly targeted an
> `App_Data/kpi-snapshots.json` ring file, but `App_Data/` inside the app root is a
> read-only run-from-package mount on App Service Linux, so every write failed with `EROFS`
> and was swallowed by the store's error handler. Cosmos is the first storage that ever
> persisted a point. Home-dashboard sparklines therefore stay empty until the cron has run on
> two distinct days.

## 5a. Production dependency verification

| Variable | Purpose |
|---|---|
| `PORTAL360_VERIFY_PRODUCTION_DEPENDENCIES` | Exact `1` enables the public, read-only `/api/health/dependencies` probe only when `NODE_ENV=production`. Runtime, server-only, **nonsecret**; unset or any other value returns 503 `not-verified`/`not-enabled` with no backend work. Set `1` on production and `0` on staging, as a **deployment slot setting** (sticky). Required by the deployment workflow preflight; it never sets the flag itself. |

The App Service configuration owner (Website Contributor or equivalent scoped
configuration-write permissions) prepares this flag in **Settings → Environment
variables → App settings** on the production app and the `test` slot **before
the first deployment using the gate**. Saving settings can restart the affected
slot. Preserve existing sticky settings, session secrets, and backend identities;
do not grant staging production access. The value is not needed at build time
and must not use a `NEXT_PUBLIC_` prefix.

Redis is always required by the production probe, irrespective of the optional
startup-warning flag. It uses the token store/rate limiter's existing
configuration precedence and Entra credential/OID mapping, or the configured
Redis URL, and checks a reserved session key without reading session contents.
Cosmos follows the requirement flag above and the core application's managed
identity selection. Existing application data access is needed; this setting
does not grant it. Probe failures do not justify broader permissions.

The endpoint enforces a five-second total probe deadline, aborts/disposes
short-lived clients, and uses a ten-second per-worker success/failure cache plus
single-flight deduplication. No timeout or force-refresh setting is exposed.
Configuration-only `/api/health/ready` stays the staging/platform health path;
after swap the workflow requires actual dependency `verified` status and the
expected build commit, otherwise its existing rollback path runs. Backend
reads do not prove writes or user journeys.

Safely confirm the nonsecret flag/stickiness via deployment preflight and, only
during an authorized rollout, check the generic production dependency result
and build `commit`. Never publish full app settings or SDK diagnostics. See
[Production dependency verification](./DEPLOYMENT-CHECKLIST.md#2a-production-dependency-verification)
for exact checks, outcomes, rollout requirements, and limits.

## 6. Application Insights / OpenTelemetry (optional)

See [`AI-TELEMETRY-SETUP.md`](./AI-TELEMETRY-SETUP.md) and [`OPENTELEMETRY-SETUP.md`](./OPENTELEMETRY-SETUP.md).

| Variable | Purpose |
|---|---|
| `APPLICATIONINSIGHTS_CONNECTION_STRING` | Server-side exporter configuration. Used only outside development on the Node runtime. Missing configuration warns and skips telemetry, not startup guards or scheduling. |
| `AZURE_TELEMETRY_DISABLED` | `true` skips server telemetry. Does not disable authentication checks, required backend checks, or explicitly opted-in tenant-health scheduling. |
| `NEXT_PUBLIC_APPLICATIONINSIGHTS_CONNECTION_STRING` | Browser-side connection string consumed by `AppInsightsProvider`. |

Startup settings require a process restart. The service name is `PortalofPortals`.
For independent, default-off scheduling, see
[scheduled health refresh](./multi-tenant-onboarding.md#7-scheduled-health-refresh).

## 6a. Server-side logging (optional)

Server code logs through `src/lib/logger.ts` rather than bare `console`. By default
`debug` and `info` are suppressed when `NODE_ENV=production`, so routine tracing does
not fill the App Service log stream. `warn` and `error` **always** emit, in every
environment and at every configured level — they carry security-relevant signals
(token-store misses, rate-limiter fallback, CSP violations).

| Variable | Purpose |
|---|---|
| `PORTAL360_LOG_LEVEL` | `debug` \| `info` \| `warn` \| `error`. Overrides the environment default so an operator can restore detail while debugging a production incident. An unrecognised value is ignored and the environment default applies, so a typo can never hide a warning. Setting it to `warn` or `error` does **not** suppress `warn`/`error`. |

> **Note:** `@azure/monitor-opentelemetry` only ships Bunyan and Winston log
> instrumentation, and neither is enabled by default — there is no `console`
> instrumentation. Console output therefore never reached Application Insights;
> it goes to stdout/stderr and lands in the App Service log stream. Raising
> `PORTAL360_LOG_LEVEL` makes detail visible there, not in App Insights.

## 7. Cookie namespace (optional)

Useful when multiple Portal 360° deployments share a parent domain.

| Variable | Purpose |
|---|---|
| `AUTH_COOKIE_NAMESPACE` | Server-side cookie name suffix. |
| `NEXT_PUBLIC_AUTH_COOKIE_NAMESPACE` | Same value exposed to the browser. |
| `NEXT_PUBLIC_COOKIE_BASE_NAME` | Base name used for CSRF cookies. Defaults to `portalofportals`. |

## 8. Demo mode (optional)

| Variable | Purpose |
|---|---|
| `PORTAL360_DEMO_MODE` | `true` to show synthetic data in pages that support a demo fallback. |
| `NEXT_PUBLIC_DEMO_MODE` | Same flag exposed to the browser. |
| `PORTAL360_DEMO_READ_ONLY` | `true` to block all mutating actions in demo mode regardless of role. |

## 9. Human-in-the-loop connector (optional)

| Variable | Purpose |
|---|---|
| `PORTAL360_HITL_CONNECTOR_SECRET` | Shared secret expected on the `/api/hitl/**` webhook endpoints. Callback URLs must use HTTPS and end in `.powerplatform.com`, `.azure-apim.net`, or `.logic.azure.com`. |

## 10. Power Platform & Dataverse (optional)

The Power Platform pages work with the standard Entra ID app registration plus the BAP / Power Platform API permissions described in [`power-platform-bap-api-setup.md`](./power-platform-bap-api-setup.md) and [`power-platform-api-permissions.md`](./power-platform-api-permissions.md). Dataverse-specific credentials are only needed for the service-principal flow used by some background jobs.

| Variable | Purpose |
|---|---|
| `DATAVERSE_TENANT_ID` | Override tenant GUID for Dataverse client-credentials calls. Falls back to `AZURE_TENANT_ID`. |
| `DATAVERSE_CLIENT_ID` | Override client ID. Falls back to `AZURE_CLIENT_ID`. |
| `DATAVERSE_CLIENT_SECRET` | Override client secret. Falls back to `AZURE_CLIENT_SECRET`. |

## 11. Microsoft Defender (optional)

The Defender pages use a separate app registration in many tenants because the Defender APIs (`api.securitycenter.microsoft.com`, `api.security.microsoft.com`) require their own admin consent. The portal accepts two naming conventions; either set works.

| Variable | Purpose |
|---|---|
| `DEFENDER_ATP_TENANT_ID` / `DEFENDER_TENANT_ID` | Tenant GUID. Falls back to `AZURE_TENANT_ID`. |
| `DEFENDER_ATP_CLIENT_ID` / `DEFENDER_CLIENT_ID` | Defender app registration client ID. |
| `DEFENDER_ATP_CLIENT_SECRET` / `DEFENDER_CLIENT_SECRET` | Client secret. |
| `DEFENDER_ATP_SCOPE` | Override the OAuth scope. Defaults to `https://api.security.microsoft.com/.default`. |
| `DEFENDER_MANAGEMENT_SCOPE` | Override the ARM scope used for the Defender for Cloud pages. Defaults to `https://management.azure.com/.default`. |

## 12. Azure DevOps (optional)

Required only for the Azure DevOps pages.

| Variable | Purpose |
|---|---|
| `AZURE_DEVOPS_ORGANIZATION` | DevOps organization slug (e.g. `contoso`). |
| `AZURE_DEVOPS_CLIENT_ID` | App registration with DevOps delegated permissions. |
| `AZURE_DEVOPS_CLIENT_SECRET` | Client secret. Falls back to `AZURE_CLIENT_SECRET`. |

## 13. ServiceNow integration (optional)

| Variable | Purpose |
|---|---|
| `SERVICENOW_INSTANCE` | Instance name (e.g. `dev12345`). The URL is constructed as `https://<instance>.service-now.com`. |
| `SERVICENOW_USERNAME` | Basic-auth username. |
| `SERVICENOW_PASSWORD` | Basic-auth password. |

When all three are set, the "Create incident" form uses the server-side credentials. When they are missing, the form prompts the signed-in user for connection details on each submission.

## 14. AI Foundry / Azure OpenAI (optional)

Powers the **Portal 360° Assistant** chat widget (floating chat bubble → `/api/chat`) and the AI Foundry agent-chat route. Uses the app registration in `AZURE_CLIENT_ID` / `AZURE_CLIENT_SECRET` to acquire a token via client credentials — no API key required.

| Variable | Purpose |
|---|---|
| `AZURE_ENDPOINT` | Base URL of the AI resource, e.g. `https://<name>.openai.azure.com`, `https://<name>.cognitiveservices.azure.com`, or `https://<name>.services.ai.azure.com`. Required. |
| `AZURE_AI_DEPLOYMENT` | Name of the model deployment to call. Required. |

> **Required role assignment:** The `AZURE_CLIENT_ID` service principal must be granted a role directly on the AI resource — API permissions in the app registration are **not** sufficient. Assign **Cognitive Services OpenAI User** on Azure OpenAI / Cognitive Services resources, or **Azure AI Developer** on AI Foundry projects. Without this, `/api/chat` returns `AI service authentication failed. Check the Azure AI credentials.` See [`INSTALLATION-GUIDE.md` Step 6a](./INSTALLATION-GUIDE.md#step-6a-assign-azure-openai--ai-foundry-rbac-to-the-service-principal) for the full CLI walkthrough.

## 14a. Azure OpenAI image generation (optional)

Used by the infographic generator on `/agents/infographic` and the tenant sign-in
background image generator on `/organizational-branding`.
Auth is via the same Cognitive Services scope (Entra client credentials); no API key required.

| Variable | Purpose |
|---|---|
| `AZURE_IMAGE_DEPLOYMENT` | Name of the image model deployment (e.g. `gpt-image-2` or `dall-e-3`). Required to enable the feature. |
| `AZURE_IMAGE_ENDPOINT` | Endpoint of the Azure AI resource hosting the image deployment. Falls back to `AZURE_ENDPOINT`, which is almost always wrong, because the image model normally lives on a *different* resource than the chat model. Set this explicitly. |
| `AZURE_IMAGE_API_VERSION` | Optional override for the image API version. GPT Image deployments default to `2025-04-01-preview`; other deployments default to `2024-10-21`. |

> **These are separate from the chat variables.** `AZURE_ENDPOINT` / `AZURE_AI_DEPLOYMENT` drive the
> Portal 360° Assistant chat agent and must point at a chat completion model. Image generation ignores
> `AZURE_AI_DEPLOYMENT` entirely. If `AZURE_IMAGE_DEPLOYMENT` is unset the route returns
> `503 Image generation is not configured` and never calls Azure.
>
> The service principal in `AZURE_CLIENT_ID` needs **Cognitive Services OpenAI User** on the resource
> named by `AZURE_IMAGE_ENDPOINT`, in addition to whatever role it holds on the chat resource.

## 14b. Microsoft MCP Server for Enterprise (optional)

Grounds the **Portal 360° Assistant** chat agent in live tenant data by attaching Microsoft's hosted MCP endpoint (`https://mcp.svc.cloud.microsoft`) as a tool on every Azure OpenAI Responses API call. Enables natural-language answers to questions like "how many users are in my tenant" or "list my active security incidents" using a Microsoft-maintained Graph surface, without additional API code in this app.

**Preview limitations:** delegated user tokens only (no app-only), global commercial cloud only (no Gov/DoD/China), 100 requests/minute per user, read-only.

| Variable | Purpose |
|---|---|
| `ENABLE_ENTERPRISE_MCP` | Set to `true` to attach the MCP tool to the chat agent. Default `false`. |
| `ENTERPRISE_MCP_SCOPE` | Optional override for the OAuth resource scope requested when acquiring the delegated MCP token. Defaults to `api://e8c77dc2-69b3-43f4-bc51-3213c9d915b4/.default`. The audience is the MCP server's **resource app URI**, not its hostname — requesting `https://mcp.svc.cloud.microsoft/.default` yields a token the server rejects, which shows up as an `mcp_list_tools` step that returns zero tools and no `mcp_call`. |

> **Tenant setup is required before enabling.** The MCP Server service principal (`e8c77dc2-69b3-43f4-bc51-3213c9d915b4`) is not present in a tenant by default and its scopes do not appear in the Entra portal's "Add a permission" picker. Run `pwsh ./scripts/provision-enterprise-mcp.ps1 -ApplicationId <AZURE_CLIENT_ID>` — see [`INSTALLATION-GUIDE.md § Microsoft MCP Server for Enterprise`](./INSTALLATION-GUIDE.md#microsoft-mcp-server-for-enterprise-optional---ai-grounding-for-chat) for the full walkthrough. Sign users out and back in after granting so refresh tokens pick up the new `MCP.*` scopes.

## 15. GitHub Models (optional)

| Variable | Purpose |
|---|---|
| `GITHUB_AI_ENDPOINT` | Override the GitHub Models API endpoint. |
| `GITHUB_AI_MODEL` | Override the default model identifier. |
| `GITHUB_AI_PAT` | Personal access token with `models:read` scope. |

## Example `.env.local`

```bash
# 1. NextAuth + Entra ID (required)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<openssl rand -base64 32>
AZURE_TENANT_ID=12345678-1234-1234-1234-123456789012
AZURE_CLIENT_ID=12345678-1234-1234-1234-123456789012
AZURE_CLIENT_SECRET=<client-secret>

# 2. Azure subscription
AZURE_SUBSCRIPTION_ID=12345678-1234-1234-1234-123456789012

# 3. RBAC
RBAC_ADMIN_EMAILS=admin@example.com
RBAC_OPERATOR_EMAILS=ops@example.com
RBAC_DEFAULT_ROLE=viewer

# 4. Redis (required for multi-instance; single instance must enable ARR affinity)
AZURE_REDIS_HOST=portal360-cache.redis.cache.windows.net
AZURE_REDIS_USE_ENTRA_ID=true
PORTAL360_REQUIRE_REDIS=1

# 5. Cosmos DB
COSMOS_DB_ENDPOINT=https://portal360.documents.azure.com:443/
COSMOS_DB_DATABASE_ID=portal360
PORTAL360_REQUIRE_COSMOS=1

# 6. Application Insights
APPLICATIONINSIGHTS_CONNECTION_STRING=InstrumentationKey=...
NEXT_PUBLIC_APPLICATIONINSIGHTS_CONNECTION_STRING=InstrumentationKey=...

# 8. Demo mode (off in production)
PORTAL360_DEMO_MODE=false
NEXT_PUBLIC_DEMO_MODE=false

# 11. Defender (only if using Defender pages)
DEFENDER_ATP_TENANT_ID=12345678-1234-1234-1234-123456789012
DEFENDER_ATP_CLIENT_ID=12345678-1234-1234-1234-123456789012
DEFENDER_ATP_CLIENT_SECRET=<defender-secret>

# 13. ServiceNow (only if integrating)
SERVICENOW_INSTANCE=dev12345
SERVICENOW_USERNAME=portal360
SERVICENOW_PASSWORD=<password>
```

## Security checklist

1. Never commit `.env.local` or any file containing real secrets.
2. Generate `NEXTAUTH_SECRET` (or `AUTH_SECRET`) with `openssl rand -base64 32`.
3. Rotate Entra ID client secrets, Defender / ServiceNow / DevOps credentials, and Cosmos / Redis keys on a regular schedule.
4. Use different credentials for development and production.
5. Grant the Entra ID app registration the minimum API permissions actually needed.
6. In production, store secrets in Azure Key Vault and reference them from App Service settings (`@Microsoft.KeyVault(SecretUri=…)`). The portal does **not** read directly from Key Vault — App Service injects the resolved secret as an environment variable.
7. Prefer Microsoft Entra authentication (managed identity) over keys for Cosmos DB, Redis, and Storage where the resource supports it.
8. Configure Redis for every multi-instance deployment and set `PORTAL360_REQUIRE_REDIS=1`. Without it the rate limiter counts per process, so the enforced limit is silently multiplied by the instance count.

## Build resource controls

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `PORTAL360_BUILD_CPUS` | No | `4` | Caps Next.js build worker fan-out to 1-8 processes. Increase only on agents with enough memory; lower it when builds are OOM-killed. |

## Troubleshooting

### ServiceNow incidents are not created

- Verify `SERVICENOW_INSTANCE` is just the instance name (not the full URL).
- Confirm the credentials have permission to create incidents.
- Check that the ServiceNow instance is reachable from your network.

### Sign-in fails

- Ensure `NEXTAUTH_URL` matches the actual URL (including the port) the browser uses.
- Verify `AZURE_TENANT_ID` matches your Microsoft Entra tenant.
- Confirm the client secret has not expired.
- If only the `AUTH_*` aliases are set, double-check the variable names — the bare `AZURE_AD_*` form is **not** read by the application (only `AZURE_*` and `AUTH_AZURE_AD_*`).

### Microsoft Graph or Power Platform API permission errors

- Review the app registration permissions and confirm admin consent was granted.
- Verify the signed-in user has the directory or Power Platform role the API requires.
- Use an admin-gated debug endpoint only during an approved troubleshooting window; the browser must never receive or inspect access-token claims.
