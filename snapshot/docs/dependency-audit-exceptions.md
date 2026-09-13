# Dependency Audit Exceptions

`pnpm audit --prod --audit-level high` runs as a blocking CI gate in
`.github/workflows/quality.yml`, which `.github/workflows/azure-app-service-deploy.yml`
invokes via `workflow_call`. Because `package.json` cannot carry comments, every
entry in `pnpm.auditConfig.ignoreGhsas` is justified here.

## Rules

1. An advisory is only ignored when **no upstream fix exists**, or when the fix
   is already applied by another mechanism (an override or a local patch).
2. Never lower `--audit-level`. Suppress individual advisories so the gate keeps
   working for everything else.
3. Every entry carries a review date. On that date, re-check upstream and delete
   the entry if a fix has shipped.
4. Prefer `pnpm.overrides` over suppression whenever a patched version exists.

## Current exceptions

Last reviewed: **2026-08-08** · Next review: **2026-09-08**

### GHSA-rgw5-rvv9-x895 — `brace-expansion`

DoS via unbounded intermediate arrays, bypassing the CVE-2026-14257 mitigation.

Already remediated locally: `pnpm.patchedDependencies` pins
`brace-expansion@5.0.8` to `patches/brace-expansion@5.0.8.patch`. The advisory
still matches on version number, so the suppression records that the fix is
applied by patch rather than by version bump. Remove once a fixed release exists
and the override can move to it.

### GHSA-2v37-7h3g-55p8 — `nanoid` (`next > postcss > nanoid`)

Non-secure generators can loop indefinitely with a negative `size`.

**No fix available.** The advisory names `>=3.3.17` as patched, but 3.3.17 was
never published — 3.3.16 is the newest release on the 3.x line. The latest
`postcss` (8.5.25) still depends on `nanoid ^3.3.16`, and `nanoid` 4+ is
ESM-only, so overriding it breaks CJS `postcss` and therefore the Next.js build.

Exposure is low: `postcss` calls `nanoid` at CSS build time with a fixed size to
generate source-map identifiers. The `size` argument is never attacker-supplied,
so the looping condition is unreachable.

Remove when `postcss` widens its range to a fixed 3.x, or when a 3.3.17+ is
published.

### GHSA-w3rx-r6r6-pgpr and GHSA-5p2g-fcmc-qvqq — `image-size` (`pptxgenjs > image-size`)

DoS through infinite loops in the ICNS, JXL, and HEIF parsers.

**No fix available.** Both advisories report `patched: <0.0.0`, meaning no fixed
version of `image-size` exists. `pptxgenjs` 4.0.1 is the latest release and pins
`image-size ^1.2.1`.

Exposure is low: the only image `pptxgenjs` parses is the tenant's own Entra
organizational branding logo, fetched server-side from Microsoft Graph in
`src/app/reports/tenant-reporting/utils/generatePowerPoint.ts`. There is no path
for arbitrary user-supplied images to reach the parser, so triggering this would
require a tenant admin to set a malicious ICNS/JXL/HEIF as their own branding
logo and then export a report — a denial of service against their own request.

Remove when `image-size` ships a fix, or when `pptxgenjs` drops the dependency.

## Reviewing

```bash
pnpm audit --prod --audit-level high
```

To see what the suppressions are currently hiding, temporarily empty
`ignoreGhsas` and re-run. For each remaining advisory, check whether a patched
version now exists before renewing the exception.

## Registry differences between local and CI

`.npmrc` pins the registry to an internal Microsoft feed proxy, which is only
routable from the corporate network. The command above therefore works as-is
locally, and `https://registry.npmjs.org/` is the host that is unreachable.

GitHub runners see the reverse, so the CI step sets
`NPM_CONFIG_REGISTRY=https://registry.npmjs.org/` for the audit alone. Installs
need no override: every entry in `pnpm-lock.yaml` carries an absolute `tarball:`
URL on a public `ms-feed-*.pkgs.visualstudio.com` mirror, so
`--frozen-lockfile` never resolves against the configured registry. `pnpm audit`
is the only step that talks to the registry host, because it POSTs to
`<registry>/-/npm/v1/security/audits/quick`.

If this step starts timing out again, fix the registry. Do **not** add
`--ignore-registry-errors`: it exits 0 whenever the registry is unreachable, so
on a host that can never reach it the gate passes on every run and the audit
silently becomes a no-op.
