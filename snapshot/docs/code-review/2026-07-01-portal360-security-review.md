# Security Review: Portal 360°

**Date**: 2026-07-01
**Last updated**: 2026-07-01 (post-remediation)
**Scope**: Full repository — authentication, session, API routes, middleware, client rendering, outbound HTTP, package footprint
**Reviewer role**: Security Reviewer (OWASP Top 10 + BFF architecture)
**Ready for Production**: **Yes**, once the outstanding mediums (M6–M10) are triaged. All criticals and highs from this review are resolved or withdrawn.

---

## Summary of counts

| Severity | Reported | Resolved | Withdrawn | Open |
|---|---|---|---|---|
| 🔴 Critical | 2 | 1 (C2) | 1 (C1 — false positive) | 0 |
| 🟡 High | 3 | 3 (H3, H4, H5) | 0 | 0 |
| 🟠 Medium | 5 | 0 | 0 | 5 (M6–M10) |
| 🟢 Low | 5 | 0 | 0 | 5 (L11–L15) |

The BFF architecture is largely correct: tokens live server-side, session cookies are `HttpOnly`+`SameSite=Lax`+`Secure` (in prod), custom JWT `encode/decode` moves OAuth tokens to a Redis/in-memory server-store keyed by `jti`, `proxy.ts` enforces CSRF, rate limiting, HSTS, `frame-ancestors 'none'`, nonce-based CSP, and OBO is used for delegated Graph/ARM calls. The findings below are drift from that design.

---

## 🔴 P1 — Critical (block merge / block production)

### C1 — Stored/reflected XSS in `ReleasePlanner` via unsanitized `dangerouslySetInnerHTML` — WITHDRAWN (false positive)

**Status**: ❌ Withdrawn — the reviewer traced the render sites without checking the variable definitions.

**Location**: [src/app/power-platform/components/ReleasePlanner.tsx](../../src/app/power-platform/components/ReleasePlanner.tsx#L616-L618)

The values passed to `dangerouslySetInnerHTML` at lines 682–700 (`businessValue`, `featureDetails`, `geo`) are already wrapped through the file-local helper `sanitizeReleaseHtml()`, which calls `DOMPurify.sanitize()` with a strict `ALLOWED_TAGS` list (no `<script>`, `<iframe>`, `<style>`, or event handlers) and a narrow `ALLOWED_ATTR` list (`href`, `target`, `rel`, `data-linktype`). DOMPurify's defaults strip `javascript:` URLs from `href`.

**Action**: None required. Consider adding an ESLint rule (`react/no-danger`) with an allow-list so future regressions still fail CI.

---

### C2 — SSRF + delegated-token exfiltration in `POST /api/power-platform/send-to-flow` — RESOLVED

**Status**: ✅ Resolved 2026-07-01.

**Location**: [src/app/api/power-platform/send-to-flow/route.ts](../../src/app/api/power-platform/send-to-flow/route.ts)

**Original issue**: The handler accepted an arbitrary `flowUrl`, did `new URL(flowUrl)` for parsing only, and issued `fetch(flowUrl, …)`. When the URL had no SAS parameters, it attached a Power Automate–audience delegated Bearer token to `Authorization`. No hostname allow-list, no SSRF guard, followed redirects.

**Fix applied**:

- Added `FLOW_ALLOWED_HOST_SUFFIXES` covering public cloud, US Gov, China (21Vianet), and air-gapped Power Automate / Logic Apps hostnames.
- Replaced the bare `new URL(flowUrl)` with `assertExternalUrl(flowUrl, { allowedHostSuffixes, allowedProtocols: ['https:'] })` — reuses the existing SSRF helper that blocks RFC1918, loopback, link-local, IMDS `169.254.169.254`, CGNAT, and IPv6 ULA/link-local addresses, and enforces the hostname allow-list.
- Changed the outbound `fetch` to use the validated `urlObj.toString()` and set `redirect: 'error'`, so a 3xx response cannot bounce the delegated Bearer token to an off-list target.

**Follow-up**: L12 (verbose token-claim logging on the same route) remains open — see below.

---

## 🟡 P2 — High (must fix before next release)

### H3 — Unauthenticated environment enumeration at `GET /api/auth/check` — RESOLVED

**Status**: ✅ Resolved 2026-07-01.

**Location**: [src/app/api/auth/check/route.ts](../../src/app/api/auth/check/route.ts)

**Original issue**: The endpoint had no `verifyAuth()` guard and returned full configuration diagnostics (callback URI, env-var presence, token-store backend, cookie names, hints).

**Fix applied**: Unauthenticated callers now receive only `{ ok: true, timestamp }` — enough for a liveness probe. The full diagnostic body is returned only when the caller is an authenticated admin **and** `ENABLE_DEBUG_ENDPOINTS=1` is set, matching the pattern used by every other `/api/debug*` route.

---

### H4 — Stack traces leaked to clients in production — RESOLVED

**Status**: ✅ Resolved 2026-07-01 (2 of 3 files — the third was a false positive).

**Locations**:

- [src/app/api/azure/bicep/diagnose/route.ts](../../src/app/api/azure/bicep/diagnose/route.ts) — both response paths (inner `catch (clientError)` and outer `catch (error)`) now spread `...(process.env.NODE_ENV !== 'production' && { stack })`.
- [src/app/api/power-platform/storage-history/route.ts](../../src/app/api/power-platform/storage-history/route.ts) — outer `catch (err)` gated behind the same check.
- **[src/app/api/sharepoint/sites/route.ts](../../src/app/api/sharepoint/sites/route.ts) — false positive.** The `error.stack` reference at line 18 is inside a `console.log` inside the internal `retryApiCall` helper; the client-facing response at line 86 only returns `details: error.message`. No fix needed.

---

### H5 — `PORTAL360_ALLOW_SYNTHETIC_AUTH=1` bypasses OAuth entirely — RESOLVED

**Status**: ✅ Resolved 2026-07-01.

**Locations**:

- [src/lib/authConfig.ts](../../src/lib/authConfig.ts) — `validateAuthConfig()` now pushes an error when `NODE_ENV=production` and `PORTAL360_ALLOW_SYNTHETIC_AUTH=1`. `instrumentation.register()` calls `validateAuthConfig()` at boot and throws on errors, so production containers refuse to start with the flag set.
- [src/lib/auth.ts](../../src/lib/auth.ts) — belt-and-braces module-load `throw` covers the case where boot-time validation is skipped (edge runtime, alternate entry).
- [package.json](../../package.json) — dropped the `AUTH_SECRET=${AUTH_SECRET:-dev-fallback-secret-change-me}` default from `test:auth-ci` and `test:screenshots-ci`. CI now must supply `AUTH_SECRET` explicitly.
- [tests/ci-auth-setup.ts](../../tests/ci-auth-setup.ts) — removed the same well-known fallback; the existing "must be set" error now applies to local runs too.

---

## 🟠 P3 — Medium (address in current sprint)

### M6 — In-memory token-store fallback in production

**Location**: [src/lib/tokenStore.ts](../../src/lib/tokenStore.ts#L60-L74), [src/lib/tokenStore.ts](../../src/lib/tokenStore.ts#L240-L272)

If Redis is unconfigured or fails to connect, the store silently degrades to a per-process `Map`. In multi-instance App Service that means: sign-in on instance A, request on instance B → "tokens missing" → session invalidated. It also means `signOut` on instance A leaves the token cached on B for its natural lifetime.

`get()` does fail closed when Redis was configured but errors (see [src/lib/tokenStore.ts](../../src/lib/tokenStore.ts#L262-L268)) — good — but the "configured?" check is `this.isRedisEnabled`, which flips off after the first error, so subsequent reads no longer fail closed.

**Suggested fix**: Introduce a `TOKENSTORE_REQUIRE_REDIS=1` env var that (a) refuses to boot in production if Redis env vars are unset, and (b) keeps `isRedisEnabled = true` semantically for the fail-closed check even during transient Redis outages, replying `503` to callers instead of serving stale memory.

---

### M7 — Session cookies use `__Secure-` instead of `__Host-`

**Location**: [src/lib/authCookies.ts](../../src/lib/authCookies.ts#L36-L45)

The comment justifies this by App Service TLS termination. `__Secure-` still requires HTTPS but permits `Domain=` overrides and thus subdomain overwriting by any co-hosted app on the parent domain.

**Why this matters**: If Portal 360° is deployed at `portal360.contoso.com` and any other app runs on `*.contoso.com`, a compromise there can set an overriding session cookie. On `*.azurewebsites.net` this risk is real because the parent zone is shared by every Microsoft customer.

**Suggested fix**: Use `__Host-` in production **when deployed under a custom domain** and drop `Domain=`/`Path=/`. Detect App Service (`WEBSITE_HOSTNAME` ending `.azurewebsites.net`) and warn loudly that custom-domain hosting is required for full cookie hardening.

---

### M8 — KQL injection surface in `POST /api/resource-graph`

**Location**: [src/app/api/resource-graph/route.ts](../../src/app/api/resource-graph/route.ts#L45-L58)

```ts
const rgClause = resourceGroup
  ? `| where resourceGroup =~ '${resourceGroup.replace(/'/g, "''")}'`
  : ''
```

The escape doubles single quotes (OData/SQL style), but KQL string escapes are backslash-based. `\` in `resourceGroup` breaks out of the literal. The `query` parameter itself is passed unfiltered.

**Why this matters**: The user already holds an ARG token, so from a data-exfil standpoint the injection isn't giving them more than they had. However:
- Audit-log attribution and any downstream telemetry recording the composed query will show a distorted intent.
- Any UI/policy layer that assumes the `resourceGroup` filter is enforced (e.g., a "scope this query to my RG" tab) can be bypassed.

**Suggested fix**:

```ts
import { RESOURCE_GROUP_RE } from '@/lib/validators'
if (resourceGroup && !RESOURCE_GROUP_RE.test(resourceGroup)) {
  return NextResponse.json({ error: 'Invalid resource group name' }, { status: 400 })
}
```

Also switch `query` to a bounded-size, timeout-limited parameter with a max complexity/rowcount envelope (`options.$top`, ARG `resultTruncated` flag).

---

### M9 — Shell interpolation in Bicep converter drifts from stated `execFile` policy

**Location**: [src/lib/azure/bicep/converter.ts](../../src/lib/azure/bicep/converter.ts#L37-L86)

Uses `execAsync` (shell) with template-string interpolation of `armFile` / `bicepFile`. Paths are server-generated (`path.join('/tmp', 'bicep-…')`) so exploitation requires a bug elsewhere that lets user input into the path. The file's own comment insists on `execFile` and even imports it — but the two functions never switch over.

**Suggested fix**: Replace with `execFileAsync('bicep', ['decompile', armFile, '--outfile', bicepFile], { timeout: 30000 })`. Removes /bin/sh from the call graph entirely.

---

### M10 — `add-password` return leaks full Graph error `body` in prod

**Location**: [src/app/api/applications/[id]/add-password/route.ts](../../src/app/api/applications/%5Bid%5D/add-password/route.ts#L57-L80)

```ts
return NextResponse.json({
  error: errorMessage,
  code: errorCode,
  details: error.body || error.toString(),
  …
})
```

Graph error bodies routinely contain the request URI (including `$select`/`$expand` clauses that reveal internal query shape), the tenant id, and the failing target's object id. Not a token leak, but a fingerprinting/enumeration primitive available on a route reachable by any operator/admin who can hit `POST /applications/:id/addPassword`.

**Suggested fix**: Same treatment as H4 — strip `details` in production.

---

## 🟢 P4 — Low / Informational

### L11 — CSP `connect-src 'self'` blocks Application Insights browser telemetry

**Location**: [proxy.ts](../../src/proxy.ts#L100)

`@microsoft/applicationinsights-web` posts to `https://<region>.in.applicationinsights.azure.com`. With `connect-src 'self'` that XHR is blocked and browser telemetry silently drops. Not a security defect, but if telemetry is a security-monitoring dependency, treat this as a P3.

**Suggested fix**: Extend `connect-src` to include the App Insights ingestion endpoint derived from `APPLICATIONINSIGHTS_CONNECTION_STRING`.

---

### L12 — Verbose token-claim logging in `send-to-flow`

**Location**: [src/app/api/power-platform/send-to-flow/route.ts](../../src/app/api/power-platform/send-to-flow/route.ts#L173-L184)

Logs `aud, iss, tid, oid, sub, appid, exp, nbf`. Combined `tid + oid` uniquely identifies a user; centralising this in App Insights turns log searches into a directory enumeration. Move to debug-only.

---

### L13 — `ENABLE_DEBUG_ENDPOINTS=1` is a single-toggle escape hatch

Every `debug*` route and `test-*` route respects one flag. If it ever flips on in prod, admins can dump: env var presence, token store size, cookie sizes, header sizes, decoded delegated tokens ([src/app/api/debug-token/route.ts](../../src/app/api/debug-token/route.ts#L18)), and Graph token claims ([src/app/api/test-graph-token/route.ts](../../src/app/api/test-graph-token/route.ts#L15)).

**Suggested fix**: Add a startup log line that names every route enabled by the flag, and a scheduled synthetic test that fails if any `/api/debug*` route returns anything other than 404 from a production hostname.

---

### L14 — Rate limiter in-memory fallback is per-instance

**Location**: [src/lib/rateLimiter.ts](../../src/lib/rateLimiter.ts#L2)

When Redis is unreachable, buckets are per-process, so a multi-instance deployment lets a single client hit `N × limit` before being throttled. Ties to M6 — same "require Redis in prod" fix covers this.

---

### L15 — `adm-zip` package footprint

**Location**: [package.json](../../package.json#L60)

`adm-zip` has a well-documented ZipSlip history (CVE-2018-1002204 and later). Search for callers to confirm every use runs `entry.entryName` through a `path.resolve` + `startsWith(destDir)` check.

**Suggested action**: `rg "AdmZip|adm-zip" src` — audit callers, and prefer `yauzl` or `unzipper` with explicit path guards if none exists.

---

## Positive controls verified (do not regress)

- BFF architecture: OAuth tokens live only in the server-side token store keyed by `jti`; only the `jti` and cosmetic user fields (`email`, `name`, `role`, `sub`) travel in the JWT cookie ([src/lib/auth.ts](../../src/lib/auth.ts#L280-L349)).
- JWT signature verified on every server-side token lookup ([src/lib/getServerToken.ts](../../src/lib/getServerToken.ts#L24-L42)) — the earlier "trust the cookie" antipattern is gone.
- CSRF enforced globally for authenticated mutations in [proxy.ts](../../src/proxy.ts#L204-L212), backed by constant-time compare in [src/lib/csrf.ts](../../src/lib/csrf.ts#L84-L96).
- Force-signout and clear-session correctly refuse `GET` and require same-origin `POST` ([src/app/api/auth/force-signout/route.ts](../../src/app/api/auth/force-signout/route.ts#L39-L48), [src/app/api/clear-session/route.ts](../../src/app/api/clear-session/route.ts#L10-L23)) and purge the server-side token store, not just the cookie.
- Security headers set on every response: HSTS, `X-Frame-Options: DENY`, `Referrer-Policy`, `X-Content-Type-Options`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, per-request nonce CSP with `strict-dynamic` ([proxy.ts](../../src/proxy.ts#L67-L103)).
- SSRF helper `assertExternalUrl` blocks RFC1918, loopback, link-local (including Azure IMDS `169.254.169.254`), CGNAT, IPv6 ULA/link-local, and enforces a hostname allow-list ([src/lib/validators.ts](../../src/lib/validators.ts#L133-L190)).
- Rate limiter distinguishes read/write and auth/unauth buckets, IP source respects XFF trust boundary ([proxy.ts](../../src/proxy.ts#L11-L20), [src/lib/rateLimiter.ts](../../src/lib/rateLimiter.ts#L50-L70)).
- Server Actions locked to an explicit allow-list — no reliance on the spoofable `Host` header ([next.config.ts](../../next.config.ts#L4-L38)).
- Screenshot serve route defends against path traversal with a strict regex, `startsWith(dir + sep)` check, and `statSync().isFile()` ([src/app/api/screenshots/[filename]/route.ts](../../src/app/api/screenshots/%5Bfilename%5D/route.ts#L17-L38)).
- Refresh-token failure path invalidates the server-side token entry and forces re-authentication ([src/lib/auth.ts](../../src/lib/auth.ts#L539-L550)).
- Debug routes (`/api/debug/*`, `/api/debug-*`, `/api/test-*`, `/api/auth/session-debug`, `/api/exchange/debug`) are collectively gated by `NODE_ENV !== 'production' || ENABLE_DEBUG_ENDPOINTS === '1'` and require admin.

---

## Recommended remediation order

1. ~~**This week** — C1 (three-line `sanitizeHtml` fix), H4 (gate stack traces in three files), H3 (add `verifyAuth` + admin gate to `/api/auth/check`).~~ Done (C1 withdrawn, H3 + H4 fixed).
2. ~~**Before next release** — C2 (SSRF allow-list on `send-to-flow`), H5 (production guard on `PORTAL360_ALLOW_SYNTHETIC_AUTH`, remove `dev-fallback-secret-change-me` default).~~ Done.
3. **Current sprint** — M6/M7/M8/M9/M10.
4. **Backlog** — L11–L15 plus an ESLint `react/no-danger` allow-list and CI check for new `/api/debug*` routes.
