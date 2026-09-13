# NextAuth v5 beta: accepted risk

**Status:** accepted risk, reviewed 2026-08-22
**Current pin:** `next-auth@5.0.0-beta.32` (exact, in `package.json`)

## Summary

Portal 360° authenticates with a **pre-release** version of NextAuth. A
pre-release in the authentication path is the kind of thing a reviewer should
challenge, so this note records why it is the correct choice today, and what
would change that.

The short version: **there is no GA release of NextAuth v5 to move to, and
`5.0.0-beta.32` is the security-patched release.** Every earlier v5 beta is
vulnerable to a critical advisory.

## Why not "just use the stable version"

`next-auth@4.x` holds the npm `latest` tag, so tooling and audit reports will
describe v4 as the stable line and v5 as unreleased. Downgrading to v4 would be
a **regression**, not a hardening step:

- v4 predates the App Router-first design this app is built on. The portal uses
  the v5 `auth()` entry point, the v5 route-handler shape, and v5 JWT
  `encode`/`decode` overrides to keep tokens in the server-side token store
  (see `src/lib/auth.ts`). None of that ports cleanly backwards.
- The BFF architecture in `.github/copilot-instructions.md` depends on that
  encode/decode seam to guarantee the browser never receives a token.

v5 has been on the `beta` tag for an extended period while being used widely in
production. The `beta` label here reflects the project's release cadence more
than the maturity of the code.

## The pin is the patched version — do not lower it

`5.0.0-beta.32` is the fix release for four advisories published in July 2026.
**Betas 0 through 31 are affected.**

| Advisory | Severity | Issue |
| --- | --- | --- |
| [CVE-2026-73421](https://github.com/advisories/GHSA-8FPG-XM3F-6CX3) | **Critical (CVSS 9.1)** | Configuration errors could make existence-based auth checks **fail open** — a missing env var after deploy could grant every visitor access. |
| CVE-2026-73419 | Medium (CVSS 6.8) | Anti-CSRF (`state`, `nonce`, PKCE verifier) cookies were not bound to the issuing provider, enabling account-linking takeover in multi-provider setups. |
| GHSA-7rqj-j65f-68wh | — | Email Unicode normalization bypass. |
| GHSA-xmf8-cvqr-rfgj | — | Malformed authorization headers in `getToken`. |

Because of CVE-2026-73421, **`next-auth` must stay pinned at `>= 5.0.0-beta.32`.**
Loosening the pin to a range that could resolve to an earlier beta would
reintroduce a critical authentication bypass.

### The fail-open pattern is not used here

CVE-2026-73421 affects code that gates access on the mere *existence* of an
auth object (`if (auth)` / `!!auth`). This codebase does not do that: routes
call `verifyAuth()` and branch on an explicit null check
(`if (!session) return UNAUTHORIZED_RESPONSE`), and a grep for existence-only
checks across `src/` returns nothing. The patched runtime plus the explicit
null check means the portal is not exposed on either layer.

## Residual risk

- Being on a pre-release means future betas may introduce breaking changes, so
  upgrades need testing rather than a blind bump.
- Beta releases are not covered by an LTS support commitment.

Both are accepted. The alternative — an unsupported v4 downgrade that breaks
the BFF token seam — is materially worse.

## What would change this decision

1. **NextAuth v5 reaches GA.** Plan the upgrade then. Expect breaking changes in
   `src/lib/auth.ts`, `src/lib/authCookies.ts`, and the JWT encode/decode
   integration with the token store.
2. **A new advisory lands against `beta.32`.** Move to the patched beta promptly;
   do not wait for GA.

## How to re-check

```bash
# Is there a non-beta v5 yet?
npm view next-auth versions --json | Select-String '5\.0\.0"'

# Current advisories for the installed version
gh api repos/russrimm/PortalofPortals/dependabot/alerts \
  --jq '.[] | select(.dependency.package.name=="next-auth")'
```

## Related

- [`DELEGATED-PERMISSION-GAPS.md`](./DELEGATED-PERMISSION-GAPS.md) — delegated-first auth model
- `.github/copilot-instructions.md` — BFF token rules this pin protects
