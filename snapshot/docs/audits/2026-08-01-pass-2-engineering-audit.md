# Portal 360 Engineering Audit - Pass 2

## Scope and safety

This pass reviewed the merged pass-1 work for second-order regressions, extended authorization and tenant-isolation coverage, assessed deployment identity behavior, introduced a bounded type-aware lint gate, and measured constrained production builds.

No deployment, credential use, tenant access, cloud-resource change, repository-setting change, or history rewrite was performed.

## Implemented

### Authorization inventory and route boundaries

- Added a reproducible inventory for all 804 API routes, 408 pages, and exported Server Actions.
- Generated `docs/authorization-inventory.csv` with authentication, portal authorization, CSRF, tenant-scope, and token-mode signals.
- Added `portal.write` checks to 24 high-confidence route files covering destructive application, Azure DevOps, Power Platform governance/settings, Copilot Studio, and Dataverse metadata/team operations.
- Corrected half-applied sibling-route checks so each exported mutation handler enforces `portal.write`; read-only handlers no longer inherit unnecessary write authorization.
- Added an AST-based regression that inspects each exported `POST`, `PUT`, `PATCH`, and `DELETE` handler instead of accepting one file-level permission string.
- Reduced mutation route files without a statically detected portal permission from 178 to 153.
- Corrected the intentional public-health classification for `/api/ping`.
- Removed a duplicate page-health route that prevented the full Playwright suite from collecting.

### HITL and audit isolation

- Tenant-keyed all in-memory HITL records and lookups.
- Bounded each tenant to 1,000 HITL records.
- Added two-minute claim expiration and stale-claim recovery so interrupted callbacks do not permanently strand requests.
- Required connector tenant headers to resolve to a registered tenant.
- Required tenant-specific `portal.read` or `portal.write` authorization before switching the active tenant or reading and mutating HITL requests.
- Scoped Cosmos audit reads and writes to the active tenant partition.
- Added trusted system-actor audit persistence for authenticated connector workflows.

The HITL store remains process-local. It cannot coordinate replicas or survive process replacement; a durable store requires an owner-approved retention policy and shared infrastructure.

### Type-aware linting

- Added exact `typescript-eslint@8.65.0`.
- Enabled `await-thenable`, `no-floating-promises`, and `no-misused-promises`.
- Scoped the typed project to authentication, DAL, audit, and HITL code after an unrestricted run found 715 problems and took 289.91 seconds.
- Added `pnpm run lint:typed` to the quality workflow. The final cold run completed in 97.20 seconds.

### API type-check coverage

- Independently counted 281 tracked `src/**` files and 269 of 804 API route files with `@ts-nocheck` (33.5%).
- Removing the directive from a representative ten-route sample surfaced 90 diagnostics: 33 implicit parameters, 18 unsafe `unknown` error accesses, 11 missing properties, 7 unsafe index operations, 6 nullable accesses, and 15 other inference/assignability errors.
- Removed `@ts-nocheck` from four low-error sampled routes (session debug, Intune Android Enterprise, Power Platform connections, and Graph user details), reducing the API baseline to 265 of 804 (33.0%).
- Added `check:ts-nocheck` to CI as a ratchet preventing the 278 total and 265 API baselines from increasing.

The sample ranged from one to 41 diagnostics per route and projects to roughly 2,385 diagnostics if representative. Removing the remaining directives is not mechanical; estimate four to eight engineer-weeks plus provider integration regression testing.

### Build resource pressure

- Added `PORTAL360_BUILD_CPUS` with a default of four and a validated range of one to eight.
- Reduced static-generation fan-out from 11 workers to 4.
- Kept the existing 3 GiB Node heap cap.

The initial unmodified baseline and first final audit build were different code states and separate milestone runs. They provide artifact-size context but are not a controlled worker-count comparison:

| Metric | Unmodified baseline | First final audit build | Delta |
| --- | ---: | ---: | ---: |
| Build workers | 11 | 4 | -7 (-63.6%) |
| Production build time | 635.47 s | 757.90 s | +122.43 s (+19.3%) |
| `.next` bytes | 588,065,834 | 585,880,231 | -2,185,603 (-0.37%) |
| `.next/server/app` bytes | 105,368,299 | 105,547,040 | +178,741 (+0.17%) |
| Largest client chunk | 4,994,817 bytes | 4,994,817 bytes | unchanged; speech SDK remains lazy |

These milestone timings must not be attributed solely to worker count. The cap addresses OOM risk by limiting concurrency, not by reducing bundle payload.

The authoritative worker comparison is a controlled pair of clean builds on the same commit, which isolated the affected page-data/static-generation phase:

| Metric | 11 workers | 4 workers | Delta |
| --- | ---: | ---: | ---: |
| Whole-build peak descendant working set | 4.567 GiB | 4.230 GiB | -0.337 GiB (-7.4%) |
| Static-generation peak descendant working set | 3.980 GiB | 2.480 GiB | -1.500 GiB (-37.7%) |
| Maximum live descendant processes | 19 | 11 | -8 (-42.1%) |
| Build time | 361.70 s | 795.81 s | +434.11 s (+120.0%) |

Memory was sampled every 750 ms across the `pnpm run build` process tree. The cap materially reduced peak memory in the phase it controls, with a substantial wall-clock cost.

### Azure deployment identity review

The deployment surfaces have different principals:

- Deployment Stacks uses delegated Azure Resource Manager tokens, so Azure authorizes the signed-in user.
- Bicep deploy uses `ClientSecretCredential`, so Azure authorizes the configured service principal. Portal user attribution must come from the application audit trail.

The exact boundaries and owner decisions are documented in `docs/azure-deployment-identity-semantics.md`. Runtime deployment behavior was intentionally not changed.

## Validation

| Command | Result |
| --- | --- |
| `pnpm exec playwright test --config=playwright.security.config.ts tests/security-boundaries.spec.ts` | 42 passed |
| `pnpm exec playwright test --project=chromium` | Collection blocker fixed; then 280 passed, 381 failed, 375 did not run because the suite expected a configured/running authenticated application |
| `pnpm run typecheck` | Passed; 265 of 804 API routes remain explicitly exempt through `@ts-nocheck` |
| `pnpm run lint:typed` | Passed in 97.20 s |
| `pnpm run lint` | Failed with 36 errors and 10 warnings in pre-existing scripts/test-plan files; baseline was 37 errors and 11 warnings |
| `pnpm run build` | Passed in 757.90 s using 4 workers; 862 pages |
| `pnpm run verify:api-auth` | Passed: 804 routes, 798 authenticated, 6 path-prefix exemptions, 0 missing; generated inventory identifies 5 runtime-public routes because session debug is guarded |
| Auth negative control | A temporary unauthenticated route was named as missing and `verify:api-auth` exited 1; after removal, the gate passed again |
| Typed-lint negative control | A temporary floating promise triggered `@typescript-eslint/no-floating-promises` and exited 1; after removal, the gate passed again |
| `pnpm run check:ts-nocheck` | Passed at reduced baselines of 278 total and 265 API files; a temporary route raised them to 279/266 and made the ratchet exit 1 |
| `pnpm run verify:auth-mode:strict` | Failed on the unchanged backlog of 191 unclassified routes; 0 U-classified routes remain app-only |
| `pnpm run verify:graph-app-perms` | Completed: 52 app-only credential call sites, 51 user-triggered and 1 background; 21 have no granted app permission |
| `pnpm run check:pins` | Passed; 74 specs checked, 69 grandfathered |
| `pnpm audit --prod --audit-level high` | Passed threshold; 4 moderate vulnerabilities on this branch |
| Built-app health probe | Blocked before listening by intentionally missing local auth configuration; no credentials or synthetic production configuration were introduced |

The unmodified baseline could not collect the full Chromium suite because `/pim/role-assignments` was declared twice. After that defect was fixed, the suite reached application-dependent tests and exposed its existing requirement for a configured authenticated server.

The quality workflow executes API authentication, security tests, typecheck, typed lint, dependency audit, and build for every pull request and for pushes to `main`. Feature-branch pushes without a pull request do not trigger it.

## Remaining recommendations

### P0

1. Keep app-only Bicep deployment disabled until the owner approves its execution identity, template-content policy, least-privilege Azure roles, audit requirements, and Bicep-to-ARM compilation contract.
2. Review the 51 user-triggered app-only Graph call sites. Migrate interactive workflows to delegated access; do not grant the 21 currently missing application permissions merely to make them work.

### P1

1. Select durable HITL storage and a retention/deletion policy, then implement atomic claims with tenant partitioning and expiry.
2. Review the 153 remaining mutation route files without a statically detected portal permission. Many are read-like POSTs, so policy ownership is required before changing them.
3. Review the 376 inventory rows with absent or manually classified tenant scope using a non-production multi-tenant fixture.
4. Classify the 191 strict auth-mode backlog and make the strict gate mandatory only after it reaches zero.
5. Fix the test harness so unit tests do not require a live app, application tests start a configured server, and credential-dependent screenshot suites are separate opt-in projects.
6. Resolve the repository's 36 existing lint errors, beginning with the syntax error in `scripts/process-solution.cjs`.
7. Remove the remaining 265 API `@ts-nocheck` directives incrementally, lowering the ratchet in each validated change. The ten-route sample indicates a multi-sprint migration rather than a mechanical cleanup.

### P2

1. Profile the 4.99 MB lazy speech SDK chunk and load it only on speech-enabled interactions.
2. Capture peak resident memory in CI so `PORTAL360_BUILD_CPUS` can be tuned from evidence rather than wall-clock time alone.
3. Replace broad portal roles with workload/action permissions after the product owner approves the authorization model.

## Owner-only actions

- Remove the unused `ServiceMessage.Read.All` Graph application permission after confirming no external workload depends on it.
- Review and reduce service-principal Azure role assignments used by Bicep deployment.
- Choose HITL retention, data residency, and durable-storage policy.
- Provide an approved non-production tenant and test identities for delegated, conditional-access, and multi-tenant integration validation.
