# Portal 360 Product and Engineering Audit - 2026-07-31

## Audit record

| Field | Value |
| --- | --- |
| Repository | `russrimm/PortalofPortals` |
| Branch | `russrimm-upgraded-waddle` |
| Audit commit | `ec1b11ff3f330afb2767ad8aa6f195fddc06efd0` |
| Pre-audit parent | `675dd51683cad456a140182d082ee457cf23ea9a` |
| Commit message | `fix(security): harden portal trust boundaries` |
| Committed scope | 47 files, 2,424 insertions, 3,756 deletions |
| Worktree after commit | Clean |
| Deployment performed | No |
| Production or cloud resources modified | No |
| Real credentials used | No |

## Executive summary

This audit reviewed Portal 360 as a security-first Next.js 16 and React 19 administration workspace spanning Microsoft Graph, Azure, Power Platform, Intune, Exchange, Teams, SharePoint, ServiceNow, Fabric, and AI surfaces.

The committed work focused on findings that were both high-confidence and low-risk to remediate locally. It closed authenticated SSRF and token-forwarding paths, restored broken delegated token flows, completed static authentication coverage across all API routes, hardened sensitive Fabric and Dataverse mutations, removed sensitive session identifiers from logs, upgraded critical framework dependencies, added CI security gates, and improved shared accessibility and rendering performance.

The audit did not use live credentials, execute real provider writes, deploy the application, or modify tenant or Azure resources. Items requiring incident response, architecture migration, broad authorization classification, or real-tenant validation remain in the deferred backlog.

## Audit coverage

The review covered:

- API route authentication and authorization boundaries
- Tenant isolation and delegated versus app-only token use
- CSRF, SSRF, injection, URL validation, and redirect handling
- Token, cookie, secret, and session identifier handling
- Destructive-action safeguards and audit logging
- Provider errors, timeouts, throttling, pagination, and caching posture
- Dependency and supply-chain vulnerabilities
- Responsive layout, accessibility, loading states, and error boundaries
- Bundle, hydration, rendering, and network performance
- Test, build, type-check, CI, environment onboarding, and documentation drift

Repository inventory at audit time:

- 804 API route files
- 408 page files
- 13 `loading.tsx` files after the changes
- 1 `error.tsx` file
- 12 existing test files discovered in the initial inventory

## Implemented changes

### 1. API authentication coverage

Previously uncovered Fabric endpoints now perform explicit authentication before parsing input or calling Fabric APIs. This includes:

- `src/app/api/fabric/admin/activity-events/route.ts`
- `src/app/api/fabric/admin/domains/route.ts`
- `src/app/api/fabric/admin/tenant-settings/route.ts`
- `src/app/api/fabric/admin/workspaces/route.ts`
- `src/app/api/fabric/connections/route.ts`
- `src/app/api/fabric/deployment-pipelines/route.ts`
- `src/app/api/fabric/domains/route.ts`
- `src/app/api/fabric/external-data-shares/route.ts`
- `src/app/api/fabric/gateways/route.ts`

The static validator was updated to recognize the existing authenticated `withAuth(...)` wrapper at `scripts/validate-api-auth.js:46-49`.

Final static result:

- 804 total routes
- 798 authenticated routes
- 6 intentional public auth or health endpoints
- 0 routes missing an accepted authentication pattern

### 2. SSRF and outbound token protection

#### AI Foundry agents

`src/app/api/azure/ai-foundry/agents/route.ts` now:

- Accepts only HTTPS endpoints under `.services.ai.azure.com`
- Requires the canonical `/api/projects/<project-name>` path shape
- Rejects explicit ports, query strings, URL fragments, credentials, and invalid cursors
- Rejects redirects
- Uses `DefaultAzureCredential`, allowing managed identity in Azure while retaining environment credential compatibility
- Scopes future cache keys by caller identity
- Stops including upstream response bodies in thrown errors
- Restores TypeScript checking for the route

Evidence: `src/app/api/azure/ai-foundry/agents/route.ts:14-103`.

#### Azure Cost Management polling

`src/app/api/azure/cost-details/route.ts` now:

- Validates polling URLs against the exact `management.azure.com` host
- Rejects private, malformed, credential-bearing, and non-HTTPS URLs through `assertExternalUrl`
- Rejects redirects when polling
- Reads delegated tokens from the server token store rather than `session.accessToken`
- Validates Azure scope shape before composing the ARM URL
- Requires `reports.view` authorization
- Requires CSRF for report generation
- Allows refresh-token recovery when the current access token is unavailable
- Removes duplicate scope validation

Evidence: `src/app/api/azure/cost-details/route.ts:12-196`.

#### Tenant Graph fan-out

`src/lib/tenants/tenantFetch.ts` now validates absolute and relative Graph targets before token acquisition. Only HTTPS requests to `graph.microsoft.com` are accepted, and redirects are rejected.

Evidence: `src/lib/tenants/tenantFetch.ts:18-58`.

#### Fabric REST helper

`src/lib/fabricApi.ts` now:

- Restricts requests to `api.fabric.microsoft.com`
- Validates destinations before issuing requests
- Rejects redirects
- Accepts access, ID, or refresh token state for delegated recovery
- Redacts raw upstream bodies from client responses
- Returns generic internal errors while retaining status and request ID diagnostics server-side
- Restores TypeScript checking

Evidence: `src/lib/fabricApi.ts:48-82`.

### 3. Delegated token and tenant-safe request handling

`src/app/api/graph/service-principals/route.ts` previously used `next-auth/jwt.getToken()` and expected an access token inside the session JWT. That pattern cannot work with the repository's server-side token store.

The route now:

- Uses `getGraphClientForUser()` for delegated Graph access
- Returns a dedicated reauthentication response for delegated-auth failures
- Uses `scopeCacheKey(...)` so future caching cannot mix callers or tenants
- Retains validated OData query composition
- Avoids manually constructing bearer-token fetches

Evidence: `src/app/api/graph/service-principals/route.ts:44-75`.

### 4. Fabric workspace creation workflow

`src/app/api/fabric/workspaces/create/route.ts` was repaired and hardened. It now:

- Verifies authentication first
- Requires `portal.write`
- Requires CSRF
- Validates input with a strict Zod schema
- Enforces workspace name and description limits
- Validates capacity and domain IDs as UUIDs
- Uses `getServerTokens()` rather than browser-facing session fields
- Supports delegated refresh through access, ID, or refresh tokens
- Applies a 15-second timeout and rejects redirects
- Redacts upstream bodies from client responses
- Writes success and failure audit records
- Restores TypeScript checking

Evidence: `src/app/api/fabric/workspaces/create/route.ts:11-110`.

### 5. Dataverse generic mutation safeguards

#### Execute action/function route

`src/app/api/power-platform/dataverse/execute/route.ts` now:

- Restricts operation names and identifiers to safe shapes
- Validates bound entity sets and GUID record IDs
- Limits function parameters to 50 entries
- Rejects invalid parameter names and unsupported function values
- Escapes single quotes in OData function string parameters
- Requires `portal.write`
- Requires CSRF
- Records success and failure audit events
- Redacts raw Dataverse errors from client responses

Evidence: `src/app/api/power-platform/dataverse/execute/route.ts:10-164`.

#### Generic operations route

`src/app/api/power-platform/dataverse/operations/route.ts` now:

- Uses an explicit operation allowlist
- Validates entity, property, navigation, and relationship identifiers
- Validates record and related-record GUIDs
- Validates `$select`, bounds `$expand`, and rejects control characters
- Bounds conditional header values
- Requires `portal.write`
- Requires CSRF
- Records success and failure audit events
- Removes an unused duplicate `RequestInit` allocation
- Redacts raw upstream errors

Evidence: `src/app/api/power-platform/dataverse/operations/route.ts:11-305`.

### 6. Session, token, and log hygiene

The audit removed session identifiers and token-presence metadata from production and test logs.

Changes include:

- Removed JTI and token-length logging from `src/lib/auth.ts`
- Removed JTI values from token-store warnings in `src/lib/getServerToken.ts`
- Removed JTI output from `tests/ci-auth-setup.ts`
- Removed temporary repeated `AUTH_URL` production diagnostics from `src/lib/auth.ts`
- Updated `scripts/find-session-token-usage.js` to ignore comment-only false positives and reset global regex state correctly

The committed runtime token snapshot was deleted without reading or reproducing its contents:

- Deleted: `.tmp/token-store/376af20e-0c51-4f32-a301-1a0e96b423a8.json`
- Added ignore rule: `.gitignore:170`

### 7. CSP and observability

The CSP remains BFF-oriented and blocks arbitrary browser egress. `proxy.ts` now derives Application Insights `connect-src` entries only from configured HTTPS ingestion and live endpoints.

This allows browser telemetry to function without adding broad wildcard origins.

Evidence:

- Telemetry origin parsing: `proxy.ts:62-87`
- CSP output: `proxy.ts:127`
- Existing rate limiting: `proxy.ts:181`
- Existing mutation CSRF enforcement: `proxy.ts:229`

### 8. Dependency and supply-chain remediation

Patched dependency versions in `package.json`:

- Next.js: `16.2.10` to `16.2.11`
- NextAuth: `5.0.0-beta.31` to `5.0.0-beta.32`
- Bot Framework Web Chat: `^4.18.0` to exact `4.19.1`
- Swiper: added exact `12.1.2`
- brace-expansion override: exact `5.0.8`

The Web Chat upgrade removed vulnerable markdown/linkification dependencies and moved the application onto patched Swiper and modern Web Chat packages.

Two deterministic package patches were added:

- `patches/brace-expansion@5.0.8.patch`
  - Preserves the callable CommonJS API required by older `minimatch` consumers while retaining the fixed 5.0.8 implementation.
- `patches/react-chain-of-responsibility@0.4.2.patch`
  - Removes a transitive preview declaration that globally changed `Array.isArray` to a readonly-array type guard and broke TypeScript throughout unrelated application code.

Supporting changes:

- Added `patches/*.patch whitespace=-blank-at-eol` to `.gitattributes` because unified patch context markers require a leading space on blank context lines.
- Removed Web Chat from the grandfathered dependency allowlist in `scripts/check-exact-pins.mjs`.
- Updated `pnpm-lock.yaml` for the new graph and patched dependencies.

Evidence: `package.json:74-131`.

### 9. Rendering and bundle performance

`src/app/components/GlobalAssistants.tsx` now dynamically loads:

- `CopilotStudioAgent`
- `AzureOpenAIChatWidget`

This removes the MSAL, Web Chat, and assistant implementations from the root synchronous client bundle.

Evidence: `src/app/components/GlobalAssistants.tsx:5-6`.

Theme and hydration improvements:

- Removed the root inline `dangerouslySetInnerHTML` theme style from `src/app/layout.tsx`
- Removed the full-app invisible-until-mounted wrapper from `ThemeProvider`
- Initialized the theme to the server-rendered dark default
- Deferred client context synchronization until after hydration

Evidence: `src/app/components/ThemeProvider.tsx:23`, `src/app/components/ThemeProvider.tsx:69-73`.

### 10. Accessibility and responsive UX

Global improvements in `src/app/globals.css`:

- Added `color-scheme: light` and `color-scheme: dark`
- Added `touch-action: manipulation` for links and buttons
- Added a reduced-motion media query that minimizes animation, transition, and smooth-scrolling effects

Evidence: `src/app/globals.css:4-22`, `src/app/globals.css:86-102`.

Shared component improvements:

- `src/app/components/ClientLayout.tsx`
  - Keys mobile drawer state to the current route
  - Closes with Escape
  - Uses dialog semantics
  - Makes the closed drawer inert
  - Replaces the clickable backdrop div with an accessible button
- `src/app/components/Breadcrumb.tsx`
  - Adds labels and disclosure state to icon-only settings controls
  - Labels the About link
  - Associates the settings trigger with its menu
- `src/app/components/TenantSwitcher.tsx`
  - Adds popup state, control relationships, live updates, active-tenant state, and accessible health labels
- `src/app/components/AppHeader.tsx`
  - Adds explicit avatar dimensions to avoid layout shift
- `src/components/MessageCard.tsx`
  - Moves navigation interaction to the semantic link
  - Removes the clickable non-semantic wrapper
  - Removes unused preview sanitization and icon imports from the client bundle
- `src/components/nav/LeftNav.tsx`
  - Adds navigation filter name, autocomplete, and spellcheck metadata
  - Adds expansion state to disclosure buttons
  - Replaces broad `transition-all` usage on shared footer actions
- `src/app/components/GlobalAdminSearch.tsx`
  - Replaces broad `transition-all` with targeted color transitions

### 11. CI and deployment gates

New workflow: `.github/workflows/quality.yml`.

It runs on pull requests and main-branch pushes and requires:

1. Frozen dependency installation
2. Exact dependency pin verification
3. API authentication and server-token invariant checks
4. Full TypeScript checking
5. Production dependency audit at high severity
6. Production build

The App Service deployment workflow now runs the same checks before packaging or deploying:

- `pnpm run check:pins`
- `pnpm run verify:api-auth`
- `pnpm run typecheck`
- `pnpm audit --prod --audit-level high`
- `pnpm run build`

Evidence:

- `.github/workflows/quality.yml:17-41`
- `.github/workflows/azure-app-service-deploy.yml:39-42`

### 12. Documentation and onboarding

Documentation changes include:

- Updated README Next.js version to 16.2.11
- Updated README NextAuth version to beta.32
- Corrected production startup command from `npm start` to `pnpm start`
- Documented `typecheck` and `verify:api-auth`
- Documented the new quality and security workflow
- Regenerated `docs/openapi.yaml` and `docs/openapi.json`
  - 804 route files
  - 802 unique paths
  - 101 tags
  - Removed stale endpoint entries
  - Added the Fabric workspace request body schema

## Complete committed file inventory

### Repository and automation

- `.gitattributes` - added patch whitespace handling
- `.github/workflows/azure-app-service-deploy.yml` - added pre-deployment quality and security gates
- `.github/workflows/quality.yml` - added PR/main quality workflow
- `.gitignore` - ignored runtime token snapshots
- `.tmp/token-store/376af20e-0c51-4f32-a301-1a0e96b423a8.json` - deleted tracked runtime token snapshot

### Documentation

- `README.md` - updated versions, commands, scripts, and automation documentation
- `docs/openapi.json` - regenerated current API definition
- `docs/openapi.yaml` - regenerated current API definition

### Dependency management

- `package.json` - dependency fixes, validation scripts, overrides, and patch registrations
- `pnpm-lock.yaml` - updated resolved dependency graph
- `patches/brace-expansion@5.0.8.patch` - CommonJS compatibility patch
- `patches/react-chain-of-responsibility@0.4.2.patch` - Type pollution patch
- `scripts/check-exact-pins.mjs` - removed pinned Web Chat from grandfathered list

### Security validation scripts

- `scripts/find-session-token-usage.js` - removed comment false positives and fixed regex state
- `scripts/validate-api-auth.js` - recognized authenticated `withAuth` wrappers

### Security middleware and libraries

- `proxy.ts` - added least-privilege Application Insights CSP destinations
- `src/lib/auth.ts` - removed sensitive and temporary diagnostics
- `src/lib/fabricApi.ts` - added destination validation, redirect rejection, and safe errors
- `src/lib/getServerToken.ts` - removed JTI logging
- `src/lib/tenants/tenantFetch.ts` - added Graph destination validation and redirect rejection

### API routes

- `src/app/api/azure/ai-foundry/agents/route.ts` - SSRF protection, managed identity support, caller-scoped key, and restored typing
- `src/app/api/azure/cost-details/route.ts` - ARM polling validation, server tokens, RBAC, and CSRF
- `src/app/api/fabric/admin/activity-events/route.ts` - auth, audit permission, and typing
- `src/app/api/fabric/admin/domains/route.ts` - explicit auth and typing
- `src/app/api/fabric/admin/tenant-settings/route.ts` - explicit auth and typing
- `src/app/api/fabric/admin/workspaces/route.ts` - explicit auth and typing
- `src/app/api/fabric/connections/route.ts` - explicit auth and typing
- `src/app/api/fabric/deployment-pipelines/route.ts` - explicit auth and typing
- `src/app/api/fabric/domains/route.ts` - explicit auth and typing
- `src/app/api/fabric/external-data-shares/route.ts` - explicit auth and typing
- `src/app/api/fabric/gateways/route.ts` - explicit auth and typing
- `src/app/api/fabric/workspaces/create/route.ts` - repaired token flow, validation, RBAC, CSRF, audit, timeout, and safe errors
- `src/app/api/graph/service-principals/route.ts` - delegated Graph flow and caller-scoped key
- `src/app/api/power-platform/dataverse/execute/route.ts` - input validation, RBAC, CSRF, and audit
- `src/app/api/power-platform/dataverse/operations/route.ts` - allowlist validation, RBAC, CSRF, audit, and safe errors

### Shared UI and rendering

- `src/app/components/AppHeader.tsx` - explicit avatar dimensions
- `src/app/components/Breadcrumb.tsx` - accessible icon controls and disclosure relationships
- `src/app/components/ClientLayout.tsx` - responsive drawer state and dialog semantics
- `src/app/components/GlobalAdminSearch.tsx` - targeted transitions
- `src/app/components/GlobalAssistants.tsx` - deferred assistant bundles
- `src/app/components/TenantSwitcher.tsx` - accessible popup and tenant health state
- `src/app/components/ThemeProvider.tsx` - removed hydration-wide visibility gate
- `src/app/globals.css` - color scheme, touch, and reduced-motion support
- `src/app/layout.tsx` - removed unsafe inline theme HTML and used lazy assistants
- `src/components/MessageCard.tsx` - semantic card navigation and dead bundle removal
- `src/components/nav/LeftNav.tsx` - form metadata, disclosure state, and targeted transitions

### Tests

- `tests/ci-auth-setup.ts` - stopped logging synthetic session JTI values

## Validation results

| Check | Exact result |
| --- | --- |
| Production build | Passed on Node 24.18.0 |
| Next.js compile | Passed in 4.2 minutes |
| Build TypeScript phase | Passed in 4.1 minutes |
| Static generation | 862 pages generated in 12.4 seconds |
| Full TypeScript | Passed: `tsc --noEmit --incremental false` |
| API authentication audit | 804 total, 798 authenticated, 6 public, 0 missing |
| Session-token misuse scan | 0 executable references |
| Exact dependency pin policy | 73 specs checked; passed; 69 grandfathered ranges remain |
| Production dependency audit | 0 critical, 0 high, 3 moderate |
| Remaining dependency advisory | Legacy `uuid` copies under Web Chat, Direct Line, and Speech SDK parents |
| Runtime unauthenticated probes | Selected Fabric, AI Foundry, ARM polling, Graph, and Dataverse routes returned 401 |
| Playwright route coverage | 1 of 1 passed in 2.7 minutes |
| Responsive checks | Passed at 375, 768, 1280, and 1920 pixels |
| Responsive overflow | 0 failures |
| Browser page errors | 0 |
| Unlabeled buttons on reviewed workflow | 0 |
| Skip link | Present at all reviewed viewports |
| High-confidence changed-file secret scan | 0 matches |
| Git diff integrity | Passed |
| Final worktree | Clean after commit |

## Known baseline failures not introduced by this change

### Repository lint

`pnpm run lint` remains unsuccessful:

- 48 total findings
- 37 errors
- 11 warnings

Most are in legacy scripts, tools, test-plan JavaScript, and vendored Obsidian plugin code. Applying the full Next.js TypeScript rules to the entire source tree currently reports approximately:

- 2,040 errors
- 1,183 warnings
- 1,970 files evaluated

A scoped lint migration is safer than a mass automatic rewrite.

### Auth-mode classification

Final auth-mode audit:

- 5 sanctioned app-only call sites
- 269 app-only call sites
- 125 delegated call sites
- 215 unclassified API routes
- 0 user-classified routes still using app-only helpers

Strict auth-mode enforcement cannot be enabled until the 215 routes are classified.

### Loading and error boundaries

Current inventory:

- 408 pages
- 13 loading files
- 1 error file
- 134 data-fetching pages identified earlier without a local loading boundary

The application has a root error boundary, but high-value administrative workflows should receive route-local streaming and recovery states.

## Deferred recommendations

### P0 - incident response and trust model

1. Revoke sessions represented by the deleted token snapshot and purge the file from Git history. Do not inspect or redistribute its contents.
2. Enable GitHub secret scanning and push protection. The GitHub API reported that secret scanning is disabled for this repository.
3. Replace the signed identity-bearing session cookie with an opaque rotating BFF session. The current JWT and token-store defaults allow a 24-hour lifetime (`src/lib/auth.ts:460`, `src/lib/tokenStore.ts:204-223`). Add rotation, idle timeout, absolute lifetime, revocation, and server-side ownership.
4. Classify the 215 auth-mode routes and review all 269 app-only call sites before enabling strict least-privilege enforcement.

### P1 - systematic security and reliability

5. Add explicit route-level CSRF and permission declarations to legacy mutations. Proxy-level CSRF is active at `proxy.ts:229`, but the audit identified 303 mutation routes without an explicit route-local CSRF signal.
6. Extend audit-event coverage to every sensitive or destructive write and verify actor, target, permission context, upstream operation, result, and correlation ID completeness.
7. Add sandbox integration tests for real Graph, Azure, Power Platform, Intune, Fabric, Exchange, Teams, SharePoint, and ServiceNow writes. Include throttling, pagination, partial failure, idempotency, and audit assertions.
8. Expand loading and error boundaries around User 360, devices, incidents, environments, Foundry, search, audit, and approval workflows.
9. Resolve the moderate transitive `uuid` advisories by upgrading the parent Web Chat, Direct Line, and Speech packages when compatible releases become available. Do not force a major `uuid` override into parents that consume older APIs.

### P2 - scale and maintainability

10. Pin the 69 grandfathered dependency ranges incrementally as their owning areas are changed.
11. Re-enable shared response caching only after every key includes tenant and caller identity. The cache remains deliberately disabled because historical flat keys could leak cross-tenant data (`src/lib/cache.ts:2-29`).
12. Introduce scoped lint baselines by application area, then make each clean area a CI gate.
13. Add exhaustive authenticated route smoke tests instead of relying only on static coverage and selected runtime probes.
14. Continue replacing broad transitions, missing local loading states, and legacy hard-coded theme utilities as pages are touched.

## Blockers and limits

- GitHub secret scanning is disabled for the repository.
- No live credentials were used.
- No real provider mutation was executed.
- Cross-tenant behavior was not tested against multiple real tenants.
- Provider throttling and upstream audit correlation were not exercised end to end.
- No deployment or cloud resource modification was performed.
- Global lint is not ready to serve as a merge gate because of the documented pre-existing baseline.

## Commands and checks used

Representative commands and checks run during the audit:

```text
node scripts/validate-api-auth.js
node scripts/find-session-token-usage.js
node scripts/audit-auth-mode.mjs --strict
node scripts/check-exact-pins.mjs
pnpm audit --prod --audit-level high
pnpm exec tsc --noEmit --incremental false
pnpm run build
pnpm run docs:openapi
playwright test route-coverage.spec.ts --project=chromium
```

The production build and final validations used Node 24.18.0. The local environment also exposed an older Node 22.12.0 runtime, which is below the repository's declared `^22.22.3` minimum and was not used for the production build.
