# Portal 360° - Comprehensive Unified Microsoft Administration Portal

> Portal 360° is a unified Microsoft cloud administration workspace that brings identity, security, device, collaboration, and platform operations into one experience. It helps IT and MSP teams manage high-frequency workflows faster with centralized visibility, cross-service actions, and audit-ready operations across Microsoft ecosystems.

[![Next.js](https://img.shields.io/badge/Next.js-16.3.3-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2.3-blue)](https://react.dev/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

| Light theme | Dark theme |
| --- | --- |
| _Screenshot pending — run `pnpm run test:screenshots-tenant-light`_ | ![Portal 360 Dashboard — dark theme](docs/screenshots/home.jpg) |

📸 **[Browse the full screenshot gallery](docs/screenshots/README.md)** — every page in the portal, captured from a live tenant with all personally identifiable and tenant-identifying data redacted. For a shorter narrative walkthrough, see the **[product tour](docs/screenshots/TOUR.md)**.

---

## Security-First & AI-Powered

Portal 360° uses a BFF-style architecture where privileged API calls stay server-side. The app integrates Microsoft Graph, Azure management APIs, Power Platform APIs, Microsoft Foundry, and observability/security surfaces with per-route auth checks and audit-focused workflows.

Automatic session recovery shares one cookie-cleanup and sign-in attempt per
browser document, including overlapping session polls and failed API requests.
The login screen leaves stale-session cleanup to the sign-in action and explains
expired sessions or `MissingCSRF` failures with a retry message. CSRF and origin
checks remain enforced; failed recovery stops at the login screen instead of
repeatedly clearing cookies.

## Current Product Areas

- **Microsoft 365**: licensing, Copilot usage, agent identity/registry pages
- **Identity & Security**: users (including User 360), groups, apps, service principals, PIM, entitlement management, sign-ins, Entra Usage & insights reports, conditional access, risky users, secure score, audit logs
- **Azure Infrastructure**: organization hierarchy, resource management, networking, VMs, deployment stacks, policy/compliance, advisor, cost, budgets, forecasts, reservations, metrics, monitoring/logs
- **Power Platform**: environments (with self-service [new-environment request form](docs/power-platform-environment-request.md)), Copilot Studio, DLP, governance, billing plans, capacity, inventory reports, Dataverse analytics, [Copilot credit and Entitlement Insight reports](docs/power-platform-api-features.md#copilot-credit-and-entitlement-insight-reports) for resource, user, and license breakdowns, [Copilot Credit Governance](src/app/power-platform/copilot-studio/credit-governance/page.tsx) for environment allocations and GitHub Copilot harness agent limits, [solution analysis](docs/power-platform-solution-analysis.md) for Dataverse exports and uploaded `.zip` files, and an auto-synced [tenant-settings reference](docs/tenant-settings-refactor-summary.md) with Microsoft Learn cross-links
- **Device Management**: Intune devices, compliance/configuration, reports, Windows update catalog
- **Bulk administration**: accessible multi-row selection for users and managed devices, with preview, bounded server-side execution, per-item audit/results, and failed-item retry
- **Collaboration & Health**: Exchange mailboxes/folders, Teams, SharePoint, service health/announcements
- **Operations & Integrations**: ServiceNow, human review queue for Copilot Studio workflows, Azure DevOps, Microsoft Fabric, reporting hub, AI Foundry, Graph Explorer, DOCX editor, and [PAX reporting](docs/pax-integration.md) with Fabric-backed audit/usage reports, all official Mini-Kitchen recipes, `.paxlite` import/export, and a daily managed-identity export job
- **Agents**: reusable guided generation workflows, beginning with ten structured infographic archetypes backed by the configured Azure OpenAI image deployment
- **Theme Preview**: an in-portal proposal for the shared accessible visual standard, available at `/tools/theme-preview` before the wider UI migration

The Copilot Agents catalog uses purpose-specific element icons for declarative and custom-engine Copilots, activities, agent connectors, agent skills, and Office add-ins. Unrecognized element types retain their text labels.

On `/copilot-interactions`, use the **Columns** icon to show or hide available
columns. Drag a column header's right edge to resize it, focus the edge and use
Left/Right arrow keys, or use the width buttons in the picker. **Reset columns**
restores visibility and default widths. These display choices last while the
page is open, including when changing users or time ranges.

Interaction search also supports **Selected user** or **All users**, custom
**From / To** date and time in UTC, keywords in prompts and responses, an exact
app-class filter, and interaction type. Choose **Search interactions** to apply
custom filters. **All users** scans histories beyond the loaded user list and
reports scan progress; **Next results** continues the scan after a matching
page. Cancellation, unavailable histories, and unfinished scans remain explicitly
partial. **Clear filters** resets the search, not your column preferences.
Search is restricted to portal admins in the configured home tenant. The existing
application-identity exception is retained; directory discovery uses delegated
access. Search text and opaque continuation state are sent in a protected request
body, not placed in browser URLs.

**Microsoft Foundry** starts with a subscription-wide **All Resources** list,
with search and type/region filters. It distinguishes Foundry accounts, projects,
hubs, hub projects, Azure OpenAI endpoints, AI Search, and other AI services.
Select a resource to open its applicable views without entering its resource
group. Deployments use the account scope; agents use the project endpoint;
available models and quotas use the subscription and region. Resource groups
are requested only when creating an account. Partial discovery and permission
failures are shown explicitly. Classic hub-project agent operations link back
to Azure rather than using an incompatible Foundry project endpoint.

**Model Playground** compares two existing chat deployments in the selected
Foundry or Azure OpenAI account, including the same model with different
instructions. Share a prompt and text/PDF/DOCX references, adjust each panel's
supported settings, and compare answers, reported token use, and inference
duration. Experiments stay in page memory until cleared or explicitly exported;
the playground does not deploy models or run agent tools. See
[playground usage and limits](docs/ai-foundry-projects-implementation.md#model-playground).

### Navigation and everyday actions

The sidebar organizes the portal into six work areas. **Overview & governance**
brings the governance dashboard, Governance Hub, policy compliance, tenant health
assistant, and multitenant management together. New browser profiles start with
the other work areas collapsed; saved menu preferences are preserved, and opening
a page reveals its current section.

Azure DevOps separates planning, code and packages, pipelines and releases,
quality and reporting, security, and project administration. Intune keeps
compliance and encryption reports under **Reports & Audit**, and Windows update
status and CVEs under **Updates & Vulnerability**. Page destinations and saved
page favorites are unchanged by these groupings.

**Settings Catalog** at `/device-management/settings-catalog` presents compact
configuration policies, collapsed by default, with platform and assignment status
visible. Expand a policy to read its full description, management technology, and
dates. Search names and descriptions or filter the loaded policies by platform.
The list uses the page's main scrollbar rather than a nested table scroller;
there is no Settings count column. **Create Policy** creates an empty policy;
use **Open Intune** to configure individual settings and assignments.

Use **Find a page** to search page names, descriptions, and product context. Each
word narrows the results, exact names rank first, and **Show all** reveals matches
beyond the initial list. Search also finds pages you have hidden. The header's
global search remains available for cloud objects and commands, including a
visible search button on narrow screens. Menu search clears after navigation so
the destination's section and sibling pages are visible again. Tab-specific
links, such as Azure Service Health Events, identify the selected destination.

Use the star beside any page, including nested pages and search results, to add
it to **Favorites**. Favorites and menu visibility stay in your browser; they do
not store tenant records. Parent menus have separate overview links, so opening
a section no longer prevents you from visiting its landing page. The unpinned
menu supports click, keyboard, and pointer interaction, and mobile navigation
remains fully expanded regardless of your desktop pin preference.
Changes to favorites, visibility, and pinning stay synchronized between desktop
navigation, the mobile drawer, and other tabs.
**Your profile** is available in the sidebar and mobile drawer, even when the
header's profile link is hidden at smaller widths.
The tenant health briefer at `/agent` uses the same profile photo as the header
beside your messages, with a user icon when a photo is unavailable.

Long breadcrumb labels and shared page titles wrap instead of hiding task
context. Shared page wrappers avoid a second padded frame inside the content
card. Global search uses the shared accessible dialog, with **Close search**,
keyboard focus containment, and focus returned to its trigger when dismissed.

**Azure resources** combines Azure Overview and Resource Explorer at `/azure`.
Existing `/azure/resources` links still open the same workspace, and saved
favorites resolve to its single menu entry. Subscription, resource group,
resource search, and shareable submitted KQL stay in the URL for reload and Back/Forward.
Oversized queries remain runnable but are not embedded in URLs; the workspace
warns you to copy them before leaving rather than creating an unusable bookmark.
Queries run only when you choose **Run query**; scope changes clear old results.
Partial and empty results remain distinct from failures. Cost and security
links open their existing views instead of displaying sample overview metrics.
Resource-group filtering requires resource IDs in the query result; aggregate
queries must include their group filter in KQL with **All resource groups** selected.

Copilot Studio transcript rows offer **Analyze** without copying an ID. Review
the selected agent, environment, and transcript, then choose **Run analysis**.
The row retains the highest-severity finding from the last completed analysis.
Dataverse activity limitations remain visible; no findings does not establish a
healthy conversation. Cancel stops waiting, and switching transcripts or
environments discards stale responses. The standalone analyzer still supports
its transcript picker and JSON upload.

ServiceNow incident filters reload after an empty result, cancel obsolete reads,
and keep pending, failed, and empty states distinct. Reconfiguration closes old
incident dialogs, and completed updates merge by incident ID without replacing a
newer list. Incident APIs use the server-configured connection; the legacy
browser credential fields do not override it or persist their values in browser
storage. The setup page now explains that distinction.

**Customize nav** uses a keyboard-accessible dialog in both themes. Tenant loading,
switching, and health-check failures now display an explicit message instead of
silently leaving the menu loading. Tenant selection stays disabled while context
loads, and stale responses cannot overwrite a newer selection.

Guest User Management uses shared loading, secondary, and destructive buttons.
It prevents duplicate invitation submissions, explains the 50-invitation batch
limit, and provides keyboard-friendly confirmation before removing a guest.

Access package cards use native detail links, DevOps project headers use native
sort buttons, and work items, conditional access policies, and provisioning logs
have named detail controls. Environment-request labels, hints, and validation
messages are associated with their controls; PAX audit filters have visible
labels. This is the bounded control/label increment in #773, not the separate
dialog migration or a claim of portal-wide accessibility conformance.

### Reading unavailable and partial data

The governance dashboard, drift summaries, work items, Fabric collections,
command palette, authentication reports, and Security Pulse distinguish failed
reads from successful empty results. Retained results are labeled when a refresh
fails; a missing metric is not a measured zero. Microsoft Secure Score describes
security posture, not overall tenant health or regulatory compliance.

MFA rates require both success and failure series. Sign-in chart updates remain
provisional until the stream completes. Where an API does not report provider
completeness, the UI describes returned records rather than asserting a complete
inventory. Permission failures do not establish that additional application
permissions are needed. Unsupported provider capabilities and modeled calculator
assumptions are unchanged.

### Assistant on demand

The assistant loads when you open it rather than on every page. It provides
loading and recovery feedback, focuses the message composer, and preserves
drafts and conversations when minimized.

### Bicep export only

The wizard at `/azure/deploy` generates and downloads Bicep source and modules.
Direct Bicep deployment is unavailable server-side, regardless of Azure
configuration. Review and compile the complete source set outside the portal
before using your approved deployment workflow. Deployment Stacks are unchanged.
See the [API contract and recovery guidance](docs/azure-bicep-sdk-migration.md).

### MFA registration removal

**Reset MFA registrations** removes supported phone, Microsoft Authenticator,
and software OATH registrations only. It preserves passwords, email recovery,
Temporary Access Pass, FIDO2/passkeys, and Windows Hello. Results identify removed,
preserved, unsupported, and unresolved methods; retry targets only unresolved
items after fresh server-side discovery. Individual method removal remains a
separate, confirmed action. Phone restrictions and unsupported methods need review
in Microsoft Entra, not a promise of universal re-registration at next sign-in.
See the [operation contract](docs/API-DOCUMENTATION.md#authentication-method-removal).

### Report download safety

Microsoft Intune report downloads require an authenticated session and an
allowlisted HTTPS destination, with redirects blocked. The proxy streams exports
without buffering the complete file on the server, disables storage in HTTP
caches, and sends downloads as attachments with content sniffing disabled.
ZIP, JSON, CSV, and plain-text report types remain available to the report viewer;
unexpected types such as HTML or SVG are served as binary downloads, never as
active documents on the portal's origin.

### Dependency advisory follow-ups

Next.js is pinned to `16.3.3` for the Windows-hosted server and AVIF image
optimization fixes (GHSA-p293-qw3h-jr36 and GHSA-2xp9-vwfh-vxw4).
The `sharp` override is pinned to `0.35.4` for its patched libheif binaries
(GHSA-rgj7-g3m4-5g8c), without disabling image optimization or lowering the audit gate.

The lockfile includes patched releases of `fast-uri`, `fflate`, `@xmldom/xmldom`,
and `@humanfs/node`. Two development-only `qs` advisories await availability of
the patched package in the configured feed ([follow-up](https://github.com/russrimm/PortalofPortals/issues/834)).
Two production `image-size` advisories still have no recorded upstream fix
([follow-up](https://github.com/russrimm/PortalofPortals/issues/835)); their existing,
explicit audit exceptions remain. No new advisory exceptions were added.

### Audit ingestion recovery

The scheduled audit ingester reports unresolved item writes as incomplete and
exits nonzero. It retries only supported transient failures and supports bounded,
idempotent window replay with
`node scripts/cron/audit-log-ingest.mjs --source directory-audits --start 2026-09-05T12:00:00Z --end 2026-09-05T12:15:00Z`.
Run replay only in an approved, already-configured job environment; `--help`
performs no remote operations. See the
[outcomes and recovery procedure](docs/DEPLOYMENT-CHECKLIST.md#audit-ingestion-outcomes-and-recovery)
for failure categories, Power Platform replay, and retention limitations.

## Current Tech Stack

- **Next.js** `16.3.3`
- **React** `19.2.3`
- **TypeScript** `5.x`
- **Tailwind CSS** `4.x`
- **NextAuth** `5.0.0-beta.32`

## Quick Start

### Prerequisites

- Node.js **22.22.3+, 24.15.0+, or 26+** (per the `engines.node` field in `package.json`)
- **pnpm 10+** — `npm install -g pnpm@10.34.5` (this repo pins pnpm via the `packageManager` field)
- Entra ID app registration with permissions needed for target pages

### Entra ID setup (required first)

Portal 360° cannot start a usable session without a Microsoft Entra ID app registration. Complete this **before** installing:

1. Register a single-tenant app and add the redirect URI `http://localhost:3000/api/auth/callback/azure-ad` (plus one per deployed host) — see [Auth Provider Setup § 1](docs/auth-providers.md#1-register-an-entra-id-application).
2. Create a client secret and record the client ID, tenant ID, and secret value for `.env.local`.
3. Add the API permissions listed in [Auth Provider Setup § 2](docs/auth-providers.md#2-api-permissions) (Microsoft Graph, Azure Service Management, Power Platform, Defender, and Azure Monitor). For the per-route permission catalog, see [`docs/API-DOCUMENTATION.md`](docs/API-DOCUMENTATION.md).
4. **Grant tenant-wide admin consent.** This is mandatory — most of the directory, device, security, and Power Platform scopes are admin-consent-only, and those pages fail with `403 Insufficient privileges` until a Global Administrator or Privileged Role Administrator grants consent.

### Installation

```bash
git clone https://github.com/russrimm/PortalofPortals.git
cd PortalofPortals
pnpm install
```

> **Why pnpm?** Development here often happens in multiple git worktrees at once.
> pnpm keeps one global content-addressable store and hardlinks packages into each
> checkout, so the second and subsequent worktrees install without re-downloading
> and without consuming extra disk. `.npmrc` sets `node-linker=hoisted`, which keeps
> `node_modules` a flat, real-directory tree so the `output: 'standalone'` build and
> the zip-based App Service deploy behave exactly as they did under npm.

Copy the committed template to create your `.env.local` — the repo ships `.env.local.example` as the starting point. See `docs/ENVIRONMENT-VARIABLES.md` and `docs/API-DOCUMENTATION.md` for the authoritative variable reference.

```bash
cp .env.local.example .env.local
```

> **Already have a `.env.local`?** Run `pnpm env:link` instead. `.env.local` is
> gitignored, so a fresh clone or a new `git worktree` starts without it. That
> command promotes your existing file to a canonical copy at
> `~/.secrets/portalofportals/.env.local` — outside every checkout — and
> hardlinks it back into the current working tree. From then on, `pnpm dev`
> re-links it automatically, and `git worktree add` provisions new worktrees via
> `.githooks/post-checkout` — the script sets `core.hooksPath=.githooks` for you
> when it is unset. You can delete and re-clone the repo without losing
> your credentials. Override the canonical location with `PORTAL360_ENV_FILE`.
> Use `pnpm env:check` to confirm a working tree is provisioned.

At minimum, `.env.local` should include:

```bash
AZURE_TENANT_ID=<tenant-guid>
AZURE_CLIENT_ID=<app-id>
AZURE_CLIENT_SECRET=<client-secret>
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<generate-with-openssl-rand-base64-32>
```

Optional NextAuth v5 aliases supported by the code:

```bash
AUTH_SECRET=<same-secret>
AUTH_AZURE_AD_CLIENT_ID=<app-id>
AUTH_AZURE_AD_CLIENT_SECRET=<client-secret>
AUTH_AZURE_AD_TENANT_ID=<tenant-guid>
```

Run locally:

```bash
pnpm run dev
```

Production build:

```bash
pnpm run build
pnpm start
```

The framework startup hook is `src/instrumentation.ts`, beside `src/app`.
Production auth configuration and explicitly required Redis/Cosmos configuration
fail closed independently of optional telemetry. Server telemetry is disabled in
development; the existing service name is `PortalofPortals`.
Tenant-health scheduling stays off unless explicitly configured, and operates
independently of telemetry when enabled. See
[startup behavior](docs/OPENTELEMETRY-SETUP.md) and
[scheduler configuration](docs/multi-tenant-onboarding.md#7-scheduled-health-refresh)
before enabling it; per-process registration does not coordinate replicas.

> **Power Platform / Dataverse features:** Destructive solution and generic Dataverse routes act as the signed-in administrator through delegated OBO tokens, so Dataverse enforces that administrator's environment security role. Some specialized Copilot Studio, transcript, and background routes still use app-only access and therefore require the app to be registered as a Dataverse Application User in the target environment. Assign the narrowest custom security role required; do not grant System Administrator by default or bulk-register the service principal across every environment.

## Scripts

Key scripts from `package.json`:

- `pnpm run dev` - Next.js dev server with Turbo (same command as `dev:turbo`)
- `pnpm run dev:turbo` - Next.js dev server with Turbo (identical to `dev`; kept for explicitness)
- `pnpm run dev:webpack` - Next.js dev server using the Webpack bundler instead of Turbo
- `pnpm run lint` - ESLint across repository
- `pnpm run typecheck` - Full TypeScript check without emitting files
- `pnpm run verify:api-auth` - Static API authentication and server-token ownership checks
- `pnpm run build` - Production build
- `pnpm run test:unit` - Vitest unit tests for `src/lib` (no browser, no build required)
- `pnpm run test:unit:watch` - Vitest in watch mode
- `pnpm run test:unit:coverage` - Vitest with a V8 coverage report over `src/lib`
- `pnpm run test:security` - API security-boundary and injection regression tests
- `pnpm run test:auth-setup` - Create local Playwright authentication state before running authenticated tests
- `pnpm run test:smoke` - Authenticated-only structural route smoke test; requires auth setup and rejects non-2xx responses, unexpected destinations, and navigation failures
- `pnpm run test:smoke-ci` - Same gate under synthetic auth, as run by CI
- `pnpm run test:critical-journeys` - Isolated behavioral release gate for session recovery, scoped VM actions, MFA removal, user/policy write freshness, and search; no tenant credentials or saved authentication state
- `pnpm run test:a11y` - Authenticated-only accessibility suite; requires auth setup first
- `pnpm run test:screenshots` - Screenshot capture test suite
- `pnpm run test:visual` - Visual regression suite
- `pnpm run sync:tenant-settings` / `:write` - Diff (or apply) Power Platform tenant-settings schema against the Terraform provider docs
- `pnpm run sync:inventory-api` / `:write` - Diff (or apply) the supported Power Platform inventory `api-version` against [`MicrosoftDocs/power-platform/admin/inventory-api.md`](https://github.com/MicrosoftDocs/power-platform/blob/main/power-platform/admin/inventory-api.md)

> Playwright tests require installed browser binaries and valid auth/tenant configuration. Unit tests
> (`pnpm run test:unit`) have no such prerequisites — they run against `src/lib` in a Node environment
> with Redis, Azure Identity, NextAuth, and Graph stubbed out.

In each new clone or worktree, run `pnpm run test:auth-setup` before `pnpm run test:smoke`
or `pnpm run test:a11y`. Both commands reuse `playwright/.auth/user.json` and stop before
starting Playwright if the file is missing, unreadable, or malformed, with a message naming
the setup command. They do not sign in automatically or create synthetic sessions. The
preflight checks the local file, not whether the server session is still valid; rerun setup
if the session expires or tests land on sign-in. Never commit or share this session file.

### Unit tests

Unit tests live in `tests/unit/**/*.test.ts` and are configured by [`vitest.config.ts`](vitest.config.ts).
The `include` glob is deliberately scoped to `tests/unit` so Vitest never picks up the Playwright specs
that sit directly under `tests/`.

Current coverage focuses on the security core: `rbac.ts`, `csrf.ts`, `api-auth.ts`, `authCookies.ts`,
`authConfig.ts`, `auth/errors.ts`, `auth/scopeMap.ts`, and `tokenStore.ts`. When you add a module under
`src/lib` that makes an authorization, CSRF, session, or token decision, add a unit test for it in the
same pull request.

### Critical administrative journeys

Run `pnpm run test:critical-journeys` in an isolated worktree without private `.env`
files or an existing dev server. Install the existing Playwright Chromium runtime
first with `pnpm exec playwright install chromium`. The runner creates an ephemeral
signing secret, starts its own loopback server, and runs a bounded selection of the
existing fixture suites with one worker and no retries. It does not consume the
normal saved session or copy development credentials. Server-side external network
connections are blocked as well as browser provider traffic.

The gate requires actual authentication and a React-driven interaction before
administrative journeys run. It verifies reviewed/submitted targets, cancellation,
partial failure, safe retry, and mutation outcomes retained after failed refresh.
Empty, skipped, flaky, or failing suites are not passing results. Synthetic-only
reports record the source commit, dirty-worktree state, and executed suite counts in
`test-results/critical-journeys`. These fixtures do not establish live delegated
permissions or production service availability.

## Automation

### Pre-push checks

`.githooks/pre-push` runs the fast half of the quality gate before every push — `check:pins`,
`verify:api-auth`, `verify:write-authz`, `verify:audit-coverage`, `check:ts-nocheck`, `test:unit`,
and `test:security`, about 25 seconds in total. `typecheck` and `build` are deliberately left to CI
so the hook stays fast enough not to be bypassed. It skips cleanly when pushing a branch deletion, or
when `pnpm`/`node_modules` are unavailable, and `git push --no-verify` bypasses it deliberately.

The hook is active once `core.hooksPath=.githooks` is set, which `pnpm env:link` and
`.githooks/post-checkout` do for you.

This matters more here than in most repositories: this is a private repo on a free plan, so GitHub
branch protection and required status checks are unavailable and **no red merge can be blocked
server-side**. The deploy workflow still fails closed, so a failing commit never ships, but `main`
itself can go red. The hook is the earliest place to catch that.

The **Quality and security checks** workflow (`.github/workflows/quality.yml`) gates pull requests on exact dependency
pins, API authentication invariants, write-authorization and audit-coverage ratchets, the `@ts-nocheck` ratchet,
unit tests, security boundary tests, type checking, type-aware security lint, production dependency auditing, and a
production build and the isolated critical-journey gate. Draft pushes skip quality;
marking a PR ready for review now starts the checks on its current head. The deploy
workflow calls the same workflow as a required job, so nothing reaches
App Service that could not be merged. It has no `push: main` trigger of its own precisely because the deploy workflow
already runs it on every push to `main`.

Before deploying the dependency-verification change, the deployment owner must
prepare the sticky `PORTAL360_VERIFY_PRODUCTION_DEPENDENCIES` setting: `1` in
production and `0` in staging. The workflow verifies these values but does not
change them. Staging retains configuration-only readiness; post-swap production
verification performs bounded Redis and required Cosmos reads. See
[Production dependency verification](docs/DEPLOYMENT-CHECKLIST.md#2a-production-dependency-verification).


Portal 360° ships a weekly **Sync Power Platform schemas** workflow ([`.github/workflows/sync-tenant-settings.yml`](.github/workflows/sync-tenant-settings.yml)) that keeps two integration surfaces aligned with their upstream Microsoft sources and opens a PR whenever drift is detected:

- The tenant-settings registry in [`src/app/power-platform/tenant-settings/page.tsx`](src/app/power-platform/tenant-settings/page.tsx) is diffed against the [Terraform Power Platform provider docs](https://microsoft.github.io/terraform-provider-power-platform/resources/tenant_settings/); new attributes get stub entries with Learn links.
- The supported inventory `api-version` in [`src/lib/power-platform-inventory-api.ts`](src/lib/power-platform-inventory-api.ts) is rewritten from the raw [`inventory-api.md`](https://github.com/MicrosoftDocs/power-platform/blob/main/power-platform/admin/inventory-api.md) source so every Resource Query caller (`INVENTORY_QUERY_URL`) follows automatically.

See [Power Platform schema sync](docs/power-platform-schema-sync.md) for the full design, local commands, and troubleshooting.

## Documentation

### Interactive API reference

After signing in to a running instance, the following endpoints are available to any authenticated user (local URLs shown; replace the origin in production):

- **OpenAPI schema:** <http://localhost:3000/api/openapi.json>
- **Swagger UI:** <http://localhost:3000/api/docs>
- **ReDoc:** <http://localhost:3000/api/redoc>

Swagger UI automatically uses the current session cookie and forwards the CSRF cookie as `X-CSRF-Token` for same-origin mutating requests, so "Try it out" works against the running instance without any manual token handling. Regenerate the schema with `pnpm run docs:openapi` whenever an API route changes.

### Guides

- [Documentation Index](docs/README.md)
- [Portal 360° Quick Start Guide](docs/quick-start.md)
- [Developer Setup](docs/development.md)
- [Administrator Guide](docs/admin-guide.md)
- [Auth Provider Setup](docs/auth-providers.md)
- [API Integration Guide](docs/api-integration.md)
- [API Documentation](docs/API-DOCUMENTATION.md)
- [API Endpoints Reference](docs/API-ENDPOINTS-REFERENCE.md)
- [Feature Walkthrough](docs/FEATURE-WALKTHROUGH.md)
- [Power Platform schema sync](docs/power-platform-schema-sync.md)
- [Power Platform solution analysis](docs/power-platform-solution-analysis.md)
- [Power Platform environment request form](docs/power-platform-environment-request.md)
- [Demo Walkthrough Video Plan](docs/demo-walkthrough-video.md)
- [Video Transcript](docs/video-transcript.md)

## Windows CVE Report — backend options

The **Windows CVE Report** at `/device-management/cve-report` reproduces the layout of Intune's *Reports &gt; Windows Autopatch &gt; Windows quality updates &gt; Common Vulnerabilities and Exposures (CVEs)* report. Microsoft does not currently expose that report through the Graph or Intune APIs, so Portal 360° provides two interchangeable backends:

### v1 — MSRC CVRF + Intune (default, shipping)

Implemented in [`src/app/api/intune/cve-report/route.ts`](src/app/api/intune/cve-report/route.ts).

- Pulls the last ~90 days of Windows OS CVEs from the public [MSRC CVRF v3 feed](https://api.msrc.microsoft.com/cvrf/v3.0/swagger/index) (no auth required).
- Joins them against `managedDevices` (`DeviceManagementManagedDevices.Read.All`) to estimate "Devices Missing Update" from each device's `lastSyncDateTime` versus the CVE publish date.
- Works out of the box — no extra Microsoft licensing.
- Limitation: the "Devices Missing" column is a deliberate undercount. Devices that are online but simply haven't installed the patch are not flagged, because Graph's `windowsUpdateState` resource does not carry KB-to-build mapping.

### v2 — Microsoft Defender for Endpoint TVM (opt-in, requires P2)

For tenants with **Microsoft Defender for Endpoint Plan 2** you can swap the device-exposure side of the report for authoritative counts:

- Endpoints: `GET https://api.securitycenter.microsoft.com/api/vulnerabilities` for the CVE list, and `GET /api/vulnerabilities/{id}/machineReferences` per CVE for exposed machines.
- Auth: a separate Entra app registration with the `Vulnerability.Read.All` / `Machine.Read.All` application permissions and `securitycenter.microsoft.com` as the resource.
- Pros: per-CVE exposed-machine counts come directly from Defender's vulnerability assessment (matches the Intune Autopatch numbers).
- Cons: Defender for Endpoint Plan 2 licensing required for every onboarded device.

To enable, drop a parallel route at `src/app/api/intune/cve-report-dfe/route.ts` that reuses the MSRC parsing helpers from the v1 route for the catalog rows but replaces `fetchWindowsDevicesForCve` with a Defender TVM call, then switch the page's `useApiData` URL behind an env flag. The v1 page is intentionally backend-agnostic — only the API URL changes.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Open a Pull Request

## License

This project is licensed under the MIT License - see [LICENSE](LICENSE).

## Dependency policy

This repo uses **exact version pins** for every entry in `dependencies`, `devDependencies`, and `optionalDependencies` in `package.json`. Floating ranges (`^1.2.3`, `~1.2.3`, `>=1.2.3`, `*`, `latest`, etc.) are not allowed.

### Why

Builds resolve packages through an internal npm feed (`packagefeedproxy.microsoft.io/npm/`) that does not always mirror the newest published version of every package. A floating range like `^1.2.3` may resolve to a version the feed doesn't carry, causing `pnpm install` to fail unpredictably on other machines and in CI. Exact pins guarantee everyone installs the same version and lets us verify up front that the version is available on the feed.

### Adding a new dependency

```bash
pnpm add --save-exact <package>@<version>
# short form:
pnpm add -E <package>@<version>
```

`--save-exact` (or `-E`) tells pnpm to write the exact version to `package.json` instead of prefixing it with `^`.

### Updating a dependency

1. Manually edit the exact version in `package.json` (e.g. change `"foo": "1.2.3"` to `"foo": "1.3.0"`).
2. Run `pnpm install` to update `pnpm-lock.yaml`.
3. Run `pnpm run build` and any relevant tests.
4. Confirm the version is on the internal feed before pushing:
   ```bash
   pnpm view <package>@<version> version
   ```
   If this command returns the version string, the feed has it. If it errors, pick a different version that is available.

### CI enforcement

The **`Quality and security checks`** workflow (`.github/workflows/quality.yml`) runs on every pull request. Its `Verify dependency pins` step executes `node scripts/check-exact-pins.mjs`, which reads `package.json` and fails the build if any spec uses a range, wildcard, or floating tag. The same check also gates the deploy workflow, which runs this workflow as a required job before anything ships, and `.githooks/pre-push` runs it locally before every push. You can run it manually at any time:

```bash
pnpm run check:pins
```

### Grandfathered allowlist

A number of dependencies were already on floating ranges when this policy was introduced. Rather than pinning ~70 packages in a single high-risk change, the check script includes a `GRANDFATHERED` allowlist. Those entries produce **warnings** instead of failures, and appear at the top of every local check run as a visible tech-debt reminder.

**New or modified deps must be exact — the allowlist is not an escape hatch.** When you touch a grandfathered dep, please take the opportunity to pin it to an exact version and delete its entry from the allowlist. The script also fails if a grandfathered entry is already exact but hasn't been removed from the list, so it self-cleans over time.

### Audit exceptions

`pnpm audit --prod --audit-level high` runs in the quality and deploy workflows. Advisories are only silenced through `pnpm.auditConfig.ignoreGhsas` in `package.json`, and only when the fixed version is not yet available on the internal feed *and* the fix has been backported locally as a pnpm patch. Every entry must be listed here with the condition for removing it.

| GHSA | Package | Why it is ignored | Remove when |
| --- | --- | --- | --- |
| [GHSA-rgw5-rvv9-x895](https://github.com/advisories/GHSA-rgw5-rvv9-x895) | `brace-expansion` | Fixed in 5.0.9 (published 2026-07-30), which the internal feed does not carry yet — nor the 3.0.6 / 2.1.4 / 1.1.18 backports. `patches/brace-expansion@5.0.8.patch` vendors the upstream 5.0.9 `dist/commonjs` and `dist/esm` sources verbatim (plus the pre-existing callable-CommonJS shim), so the installed code is not vulnerable; only the `version` field still reads 5.0.8, which is what the audit matches on. | `pnpm view brace-expansion@5.0.9 version` succeeds. Then bump the `brace-expansion` override and `patchedDependencies` key to `5.0.9`, regenerate the patch so it only contains the callable-CommonJS shim, and delete this row and the `ignoreGhsas` entry. |
| [GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8) | `nanoid` | Transitive dependency of `postcss` (resolves to `nanoid@3.3.16`); `customAlphabet`/`customRandom` loop indefinitely if called with `size: 0`. Fixed upstream in `3.3.17`, which the internal feed does not carry yet. The `docx > nanoid` subtree is already pinned to the unaffected `5.1.16` via a separate override and is not impacted. | `pnpm view nanoid@3.3.17 version` succeeds. Then add a `"postcss>nanoid": "3.3.17"` override (do not override the bare `nanoid` key — that would also force the unrelated `docx > nanoid@5.1.16` pin) and delete this row and the `ignoreGhsas` entry. |
| [GHSA-w3rx-r6r6-pgpr](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr) | `image-size` | ICNS parser can spin in an infinite loop on a crafted image, hanging the event loop. No fixed version exists upstream yet (`first_patched_version` is null on the advisory) for any release `<= 2.0.2`. | The advisory is updated with a patched version and `pnpm view image-size@<patched-version> version` succeeds. Then bump the pin and delete this row and the `ignoreGhsas` entry. |
| [GHSA-5p2g-fcmc-qvqq](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq) | `image-size` | Same root cause as GHSA-w3rx-r6r6-pgpr but in the JXL/HEIF parsers instead of ICNS; also unfixed upstream (`first_patched_version` is null) for any release `<= 2.0.2`. | The advisory is updated with a patched version and `pnpm view image-size@<patched-version> version` succeeds. Then bump the pin and delete this row and the `ignoreGhsas` entry. |

## Disclaimer

This project is **not affiliated with, endorsed by, or supported by Microsoft Corporation**. It is an independent community tool, built using multiple APIs including Microsoft Graph and Azure Management APIs.

This software is provided **as-is, without warranty of any kind**. Users are solely responsible for ensuring their use complies with Microsoft's terms of service and all applicable laws. The author assumes no liability for any damages or issues that may arise from using this tool.

Users should continue using Microsoft's official admin portals for critical operations and compliance tasks.
