# Developer Setup

Local development guide for Portal 360°. It covers prerequisites, environment configuration, the supported dev commands, the BFF / DAL conventions you must follow, and how to ship a change end-to-end.

> If you only need to run the app to demo it, jump to [`quick-start.md`](./quick-start.md). For deployment, see [`AZURE-DEPLOYMENT-GUIDE.md`](./AZURE-DEPLOYMENT-GUIDE.md).

---

## 1. Prerequisites

| Requirement                                  | Notes                                                                                  |
|----------------------------------------------|----------------------------------------------------------------------------------------|
| **Node.js 24+**                              | The dev server passes `--max-http-header-size=32768` and assumes modern Node features. |
| **pnpm 10+**                                 | Install with `npm install -g pnpm@10.34.5`. Pinned via `packageManager`.               |
| **Git**                                      | Anything modern.                                                                       |
| **Microsoft Entra ID tenant**                | With permission to create app registrations and grant admin consent.                   |
| **Reader access** to a subscription          | Required for any Azure / Cost / Advisor / Monitor pages.                               |
| **Power Platform admin**                     | Required for Power Platform and Dataverse features.                                    |
| **(Optional) Docker / Podman**               | Only needed if you want to run Redis or other infra locally.                           |

---

## 2. Clone and install

```bash
git clone https://github.com/russrimm/PortalofPortals.git
cd PortalofPortals
pnpm install
```

The install step will compile native dependencies (e.g. `lightningcss`) and run optional `ws` install.

> **Windows, macOS, and Linux all work natively.** All `dev`, `dev:*`, `build`, and `start` scripts route through `scripts/run-next.mjs`, a Node wrapper that sets env vars, `NODE_OPTIONS`, and the `-p` port without relying on POSIX `VAR=value CMD` shell syntax. WSL2 is no longer required. To restart a dev server against a clean build cache, use `pnpm run dev:reset`.

---

## 3. Configure `.env.local`

Create a `.env.local` in the repository root. The minimum required keys are:

```bash
AZURE_TENANT_ID=<tenant-guid>
AZURE_CLIENT_ID=<app-id>
AZURE_CLIENT_SECRET=<client-secret>

NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<openssl rand -base64 32>
```

The full reference (including optional alias names, Power Platform tenants, Application Insights, Defender, Cosmos, Redis, ServiceNow, etc.) is in [`ENVIRONMENT-VARIABLES.md`](./ENVIRONMENT-VARIABLES.md). For provider-specific scopes and required API permissions, see [`auth-providers.md`](./auth-providers.md).

> When the codebase requires a new env var, it always validates at the boundary — if a feature does not work, check the server logs for a clear "missing `XYZ`" error rather than guessing.

---

## 4. Running the app

| Command                | Purpose                                                                                    |
|------------------------|--------------------------------------------------------------------------------------------|
| `pnpm run dev`          | Turbopack dev server with error-only console filtering, on `$PORT` or 3000.                |
| `pnpm run dev:turbo`    | Explicit Turbopack alias (same as `dev`).                                                  |
| `pnpm run dev:webpack`  | Webpack dev server — use only if a Turbopack module-resolution edge case blocks you.       |
| `pnpm run dev:port`     | Same as `dev:webpack` but without forcing `--webpack`; honors `PORT`.                     |
| `pnpm run dev:light`    | Webpack + disables OpenTelemetry instrumentation — fastest startup.                        |
| `pnpm run dev:reset`    | Runs `clean:next` (removes `.next/`) then a webpack dev server.                            |
| `pnpm run build`        | Production build with `--max-old-space-size=3072`.                                         |
| `pnpm run start`        | Runs the production build on `$PORT` or 8080 (via `--default-port 8080`).                  |
| `pnpm run lint`         | ESLint across the repository.                                                              |

Under the hood, every command above shells to `node scripts/run-next.mjs <next-subcommand> [flags]`. The wrapper understands three synthetic flags and one option:

- `--flag=error-only-logs` — sets `PORTAL360_ERROR_ONLY_LOGS=true` and injects the console filter (`scripts/dev-console-filter.cjs`) via `NODE_OPTIONS --require`.
- `--flag=disable-instrumentation` — sets `DISABLE_INSTRUMENTATION=true` and ensures `NODE_ENV=development`.
- `--flag=console-filter` — attaches the console filter without also toggling `PORTAL360_ERROR_ONLY_LOGS`.
- `--flag=max-old-space-3072` — appends `--max-old-space-size=3072` to `NODE_OPTIONS`.
- `--default-port <port>` — port to use when `dev` / `start` are invoked without `-p` and `PORT` is unset (defaults to 3000).

The wrapper resolves the Next.js CLI from `node_modules/next/dist/bin/next` directly, so no shell alias, `.bin` shim, or PATH modification is required.

Sign in once at <http://localhost:3000>. After that, the Swagger UI / ReDoc / OpenAPI endpoints listed in [`api-integration.md`](./api-integration.md) become available because they require a session cookie.

---

## 5. Repository layout (the parts you will touch most)

```text
src/
  app/
    api/                 # All backend routes (auth FIRST in every handler — see § 7)
      auth/[...nextauth] # NextAuth — the only auth-exempt prefix besides /api/health
    (authenticated)/     # Protected page tree
    ...                  # Other page trees (home, settings, etc.)
  lib/
    api-auth.ts          # verifyAuth() + UNAUTHORIZED_RESPONSE — REQUIRED in every API route
    csrf.ts              # CSRF validation used by middleware
    authCookies.ts       # NextAuth cookie name resolution
    rbac.ts              # In-app role helpers
    route-registry.ts    # Single source of truth for page routes + breadcrumbs (REQUIRED for every new page)
    schemas/             # Zod schemas for Server Actions / Route Handlers
    dal/                 # Data access layer (verifies session, returns DTOs)
middleware.ts            # Rate limit + CSRF + CSP + nonce
auth.ts                  # NextAuth v5 configuration
scripts/                 # Build / sync / audit / housekeeping scripts
docs/                    # Public-facing documentation (including OpenAPI artifacts)
tests/                   # Playwright tests
```

The conventions enforced across the codebase are documented in `.github/copilot-instructions.md`. The ones you cannot violate are summarized below.

---

## 6. Non-negotiable conventions

### 6.1 BFF security model

- Tokens **never** leave the server. The browser only ever sees an opaque HttpOnly session cookie.
- All upstream API calls (Graph, ARM, Power Platform, Dataverse, …) happen in route handlers / server actions using the server-only token helpers in `src/lib/`.

### 6.2 API route authentication

Every handler under `src/app/api/**/route.ts` (other than `/api/auth/**` and `/api/health/**`) **must** start with:

```ts
import { verifyAuth, UNAUTHORIZED_RESPONSE } from '@/lib/api-auth'

export async function GET() {
  const session = await verifyAuth()
  if (!session) return UNAUTHORIZED_RESPONSE
  // ... handler body
}
```

The check is the **first** line of the handler — before URL parsing, body parsing, external calls, or any business logic. CI runs `node scripts/test-api-auth.js` to enforce this.

### 6.3 Validation

External input is validated with **Zod**:

```ts
const Schema = z.object({ id: z.string().uuid() })
const parsed = Schema.safeParse(await req.json())
if (!parsed.success) {
  return NextResponse.json({ error: 'invalid-body', details: parsed.error.flatten() }, { status: 400 })
}
```

Define reusable schemas under `src/lib/schemas/`.

### 6.4 New pages — register them

Every new page **must** be added to `src/lib/route-registry.ts` so breadcrumbs and parent links work. The structure is:

```ts
'/your-feature': {
  title: 'Your Feature',
  navigable: true,
  parent: '/parent-area',
}
```

If you forget this, navigation and breadcrumbs render URL segments instead of human titles.

### 6.5 Theming

Use the shared theme tokens defined in `src/app/globals.css` (`portal-surface`, `portal-card`, `portal-strip`, etc.). Do **not** hard-code colors inline.

### 6.6 Interior page spacing

`ClientLayout` owns the single breadcrumb on non-home pages. Its card starts
8px below the app header; the `portal-breadcrumb-bar` stays above the scrolling
content, with an 8px content inset below its divider. Keep the breadcrumb's
wrapping and shared navigation targets intact rather than fixing its height.
Horizontal gutters and bottom padding remain responsive. Pages keep their own
internal padding and section spacing; do not add another breadcrumb or remove
page padding globally to compensate for shell spacing. The home shell retains
its separate spacing.

---

## 7. After you add or change an API route

1. **Confirm auth is the first line** (`verifyAuth` → `UNAUTHORIZED_RESPONSE`).
2. **Regenerate the OpenAPI schema:**

   ```bash
   pnpm run docs:openapi
   ```

   This rewrites `docs/openapi.yaml` and `docs/openapi.json`. The `/api/openapi.json`, `/api/docs`, and `/api/redoc` endpoints will then reflect your changes.
3. **Try it in Swagger UI** at <http://localhost:3000/api/docs>. Swagger UI is preconfigured with `withCredentials: true` and forwards the CSRF cookie as `X-CSRF-Token`, so "Try it out" works against your local server.
4. **Run the auth audit** for the touched files:

   ```bash
   node scripts/test-api-auth.js
   ```

---

## 8. Testing

| Suite                                   | Command                                  | Notes                                                                       |
|-----------------------------------------|------------------------------------------|------------------------------------------------------------------------------|
| Smoke (route coverage)                  | `pnpm run test:smoke`                     | Requires 2xx at each intended route; rejects unexpected login/404 and navigation failures. Requires `pnpm run test:auth-setup` first. Use `pnpm run test:smoke-ci` for structural synthetic-auth coverage. |
| Critical administrative journeys       | `pnpm run test:critical-journeys`         | Starts a private loopback server with ephemeral synthetic authentication and blocked server-side provider egress; runs bounded existing behavioral fixtures with one worker. No saved tenant authentication. |
| Accessibility                          | `pnpm run test:a11y`                      | Runs the `authenticated` project only. Requires `pnpm run test:auth-setup` first; `pnpm run test:a11y-ci` uses the existing synthetic-auth CI setup. |
| Page health + load times                | `pnpm run test:health`                    | Visits every navigable route, confirms it responds, and records TTFB / FCP / DCL / load / network-idle per route. Requires `pnpm run test:auth-setup` first (or use `pnpm run test:health-all`). |
| Page load-time benchmark                | `pnpm run test:health:perf`               | Same sweep with a single worker, so timings are uncontended and comparable between runs. |
| Screenshot gallery                      | `pnpm run test:screenshots`               | Requires `pnpm run test:auth-setup` first.                                    |
| Visual regression                       | `pnpm run test:visual`                    | Diff-based; baseline images live in `tests/visual-regression.spec.ts-snapshots/`. |
| CI synthetic auth (no Microsoft login)  | `pnpm run test:auth-ci`                   | Requires `PORTAL360_ALLOW_SYNTHETIC_AUTH=1` **and** an explicit `AUTH_SECRET` (no fallback). Boot in production refuses the flag; only safe in CI/local. |

Playwright needs browser binaries: `pnpm exec playwright install --with-deps chromium`.

Before the first local smoke or accessibility run in each clone or worktree:

```bash
pnpm run test:auth-setup
pnpm run test:smoke
pnpm run test:a11y
```

The last two commands reuse `playwright/.auth/user.json`. Their preflight stops before
Playwright starts if the file is missing, unreadable, or malformed and names the setup
command to run. It does not perform sign-in, generate synthetic sessions, or verify the
server session's lifetime. Rerun setup if your session expires or tests land on sign-in.
The state file contains session data: keep it private and never commit it.

The critical-journey command is separate from that live-auth setup. Use a worktree
without private `.env` files and stop any dev server owned by that worktree first;
the runner will not reuse it. It strips inherited service credentials and generates
its own signing secret. The first browser journey proves both server authentication
and a React state transition. Selected session-recovery, VM scope/bulk, MFA
partial-removal, user/policy write freshness, and search journeys then assert real component
behavior against explicit provider fixtures. Unknown mutations cannot receive
generic successful fixture responses.

Quality CI runs this gate after the fast unit/invariant and type/lint jobs. The
existing unit gate continues to collect the report-cache, tenant-storage,
Dataverse-batch, and ingestion regressions under `tests/unit`; the VM browser
scenarios cover reviewed/submitted scope. Empty/skipped/flaky suites fail the
runner. `test-results/critical-journeys/summary.json` records commit identity,
dirty-worktree state, gate tier, and passing suite counts. Keep traces and stored
session files disabled; neither this result nor the structural smoke gate proves
live Microsoft authorization or a production rollout.

### Page health sweep

`pnpm run test:health` writes `artifacts/page-health-report.md` (human-readable) and
`artifacts/page-health-report.json` (machine-readable), and prints a console summary with
p50/p75/p95/p99 load-time percentiles, the 10 slowest routes, and any broken pages.

A route counts as **broken** when it returns 4xx/5xx, redirects to sign-in, renders a Next.js
error boundary, comes back blank, or throws an uncaught JS error. Lower-signal noise — CSP
violations, hydration mismatches, unauthenticated NextAuth session probes — is collected
separately under **Warnings** so it does not mask the "did this page respond" result.

| Flag | Effect |
|------|--------|
| `--serial` | One worker, for comparable timings. |
| `--slow-ms=N` | Slow-route threshold, default `3000` (time to network idle). |
| `--strict` | Exit non-zero when any route is broken. Use in CI. |
| `--report-only` | Re-render the report from the last run's shards without launching a browser. |
| `-- <args>` | Everything after `--` is passed through to Playwright, e.g. `-- --grep "/azure"`. |

Playwright runs each worker in its own process, so the spec writes a per-worker shard to
`artifacts/.page-health-shards/` and `scripts/run-page-health.mjs` merges them once the run
ends. Invoking the spec through `pnpm exec playwright test` directly still works but produces
shards rather than a merged report — run `node scripts/run-page-health.mjs --report-only`
afterwards to assemble it.

Test-writing guidance is in [`playwright-typescript.instructions.md`](../.github/instructions/playwright-typescript.instructions.md).

---

## 9. Background sync workflows

Run any of the sync scripts locally before pushing if you touched Power Platform integration code:

```bash
pnpm run sync:tenant-settings           # diff vs Terraform provider docs
pnpm run sync:tenant-settings:write     # apply diffs
pnpm run sync:inventory-api             # diff vs MicrosoftDocs/power-platform inventory-api.md
pnpm run sync:inventory-api:write       # apply diffs
```

See [`power-platform-schema-sync.md`](./power-platform-schema-sync.md) for the design and CI behavior.

---

## 10. Committing and pushing

Conventional commits are encouraged. Before opening a PR:

- [ ] `pnpm run lint` clean.
- [ ] `pnpm run docs:openapi` re-run if any API route was added or changed.
- [ ] New page added to `src/lib/route-registry.ts`.
- [ ] API routes start with `verifyAuth()`.
- [ ] `pnpm run test:smoke` clean.

For deeper code-review expectations, see [`code-review-generic.instructions.md`](../.github/instructions/code-review-generic.instructions.md).

---

## 11. Common dev gotchas

| Symptom                                                  | Fix                                                                                                  |
|----------------------------------------------------------|------------------------------------------------------------------------------------------------------|
| `431 Request Header Fields Too Large` after many sign-ins | Clear cookies for `localhost:3000`. The dev server already raises the header limit; see [`fixing-431-header-too-large.md`](./fixing-431-header-too-large.md). |
| `AADSTS9002326` on sign-in                               | Token cache stale. See [`AADSTS9002326-FIX.md`](./AADSTS9002326-FIX.md).                            |
| Swagger UI shows `Failed to load API definition`         | Run `pnpm run docs:openapi` (the `/api/openapi.json` endpoint serves the file from disk).            |
| 403 `Invalid CSRF token` after a long pause              | Refresh the page so a fresh CSRF cookie is issued, then retry the mutating request.                  |
| `Module not found: 'server-only'` in a client component  | A `lib/dal/*` helper was imported from a `'use client'` file. Move the call to a server component.   |
| HSTS lingering on `localhost`                            | The dev server intentionally skips HSTS; clear browser HSTS state in `chrome://net-internals/#hsts`. |

For everything else, the [`TROUBLESHOOTING.md`](./TROUBLESHOOTING.md) catalog is the first stop.
