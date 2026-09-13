# Portal 360 Authorization Inventory

**Generated:** 2026-09-02
**Source:** static analysis of `src/app`
**Detailed inventory:** [authorization-inventory.csv](authorization-inventory.csv)

This inventory covers every API route, exported Server Action, and App Router page. It records the caller boundary, portal permission checks, tenant-scoping signal, CSRF posture, and upstream token mode. Regenerate it with `pnpm run docs:authorization`.

## Summary

| Surface | Count | Missing explicit authentication |
| --- | ---: | ---: |
| API route files | 863 | 0 |
| Exported Server Actions | 0 | 0 |
| Pages | 438 | 0 |
| **Total inventory rows** | **1301** | **0** |

## Authorization findings

- 2 API route files expose at least one mutation without a statically detected portal permission check. These require workflow-by-workflow review because some POST endpoints are read-like searches or user self-service.
- 354 rows have no statically detected tenant scope or use a provider/configuration-scoped identity that needs manual confirmation.
- Pages without a server guard are documented as **public shell; BFF protects data**. This is not an authorization boundary; all sensitive reads and writes must remain in authenticated DAL or API handlers.
- The inventory distinguishes portal RBAC from upstream authorization. Delegated calls are still re-authorized by Microsoft Graph, Azure RBAC, Dataverse, or Azure DevOps for the signed-in user.

## Intentionally public API routes

These are the only routes classified as public. Authentication-flow endpoints must remain reachable before a session exists; `/api/ping` is the explicit liveness exception.

- `/api/auth/[...nextauth]` (re-export/unknown) - public auth flow
- `/api/auth/check` (GET) - public auth flow
- `/api/auth/force-clear` (GET; POST) - public auth flow
- `/api/auth/force-signout` (GET; POST) - public auth flow
- `/api/health/ready` (GET) - public readiness probe
- `/api/ping` (GET) - public health check

`verify:api-auth` exempts six paths under its coarse auth-prefix/liveness allowlist. One of them, `/api/auth/session-debug`, is not runtime-public: production returns 404 unless `ENABLE_DEBUG_ENDPOINTS=1`, then the handler requires a session and admin role.

## Tenant-isolation model

- Active-tenant operations should use `getActiveTenantId()`, a tenant registry helper, or a caller-scoped cache key.
- Cosmos DB audit records use `/tenantId` as the partition key and queries provide that partition key. This follows Microsoft's partition-key-per-tenant model: <https://learn.microsoft.com/azure/architecture/guide/multitenant/service/cosmos-db>.
- Delegated upstream calls inherit the signed-in user's tenant and upstream permissions, but local caches and persisted records still require explicit tenant keys.
- App-only/configured-identity routes are not automatically tenant-safe. Their configured tenant, target resource scope, and cache keys must be reviewed.

## Known limitations and owner decisions

- Static analysis cannot prove that a provider resource ID belongs to the selected tenant. Rows marked **manual review** need integration tests against a non-production multi-tenant fixture.
- File-level static classification can under-detect conditional production gates and per-handler authorization. The CSV records detected guards, but source review remains required for routes with multiple handlers or environment-dependent behavior.
- Durable HITL storage needs an owner-approved shared store and retention policy. The current process-local store is now tenant-keyed, bounded, and recovers expired claims, but it cannot coordinate multiple app instances or survive replacement.
- Portal RBAC currently has three broad roles. Introducing workload-specific permissions or changing the default role is a product/security policy decision, not an audit-only code change.
- Azure deployment routes do not share one execution identity. Deployment Stacks calls Azure Resource Manager with a delegated user token, while the Bicep deploy route uses the configured service principal. The reviewed behavior and its authorization implications are documented in [Azure deployment identity semantics](azure-deployment-identity-semantics.md).

## Review workflow

1. Filter the CSV `review` column.
2. Prioritize destructive methods and app-only/configured-identity routes.
3. Confirm the intended portal role and tenant source with the feature owner.
4. Add a route-level regression test whenever a missing boundary is fixed.
