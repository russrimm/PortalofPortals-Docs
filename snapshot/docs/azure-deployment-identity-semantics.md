# Azure Deployment Identity Semantics

## Scope

This document records the identity and authorization behavior of Portal 360's Azure deployment surfaces, including export-only containment of direct Bicep deployment.

## Current behavior

| Surface | Portal boundary | Azure token | Principal Azure authorizes | Target-scope control |
| --- | --- | --- | --- | --- |
| `GET /api/azure/deployment-stacks` | Authenticated session | Delegated ARM token | Signed-in user | Azure RBAC |
| `PUT`, `POST`, `DELETE /api/azure/deployment-stacks` | Authenticated session plus `portal.write` | Delegated ARM token | Signed-in user | Azure RBAC |
| `GET /api/azure/bicep/deploy` | Authenticated session plus `portal.write` | None | None | Capability response: export only |
| `POST /api/azure/bicep/deploy` | Authenticated session, CSRF, and `portal.write` | None | None | Unconditional 501 before reading deployment input |

### Deployment Stacks

`src/app/api/azure/deployment-stacks/route.ts` loads the signed-in user's server-side tokens and calls `getAzureManagementToken()`. That helper reuses a valid Azure Resource Manager token or obtains one with the user's refresh token for `https://management.azure.com/.default`.

Azure therefore evaluates the signed-in user's Azure RBAC permissions at the requested subscription, resource group, or management group scope. The portal's `portal.write` permission is an additional application boundary; it does not grant Azure permissions or elevate the user.

Consequences:

- Azure activity is attributable to the user represented by the delegated token.
- A caller can supply a target scope, but Azure Resource Manager must still authorize that user at that scope.
- The application must continue tenant-scoping local caches and records even though Azure enforces upstream RBAC.
- The route currently requires both a stored access token and refresh token before attempting delegated acquisition. This can force reauthentication even when a valid ARM access token exists.

### Bicep deploy

`src/app/api/azure/bicep/deploy/route.ts` no longer acquires credentials or calls
Azure. The former app-only path submitted uncompiled Bicep source as an ARM
template. POST now rejects authorized attempts with 501 and records a blocked
attempt through the existing failure audit sink. GET reports export-only
capability without probing Azure. See [the API contract and recovery guidance](azure-bicep-sdk-migration.md).

## Microsoft platform behavior

- The Microsoft identity platform defines on-behalf-of as delegated propagation of the user's identity and permissions. Application/client-credential tokens instead represent the application: <https://learn.microsoft.com/entra/identity-platform/v2-oauth2-on-behalf-of-flow>
- Azure Resource Manager requires the deployment principal to have `Microsoft.Resources/deployments/*` and write access to the resources being deployed: <https://learn.microsoft.com/azure/azure-resource-manager/templates/deploy-rest#required-permissions>
- Programmatic Bicep compilation produces an ARM template in JSON before an SDK/REST deployment: <https://learn.microsoft.com/azure/azure-resource-manager/bicep/bicep-cli-jsonrpc#methods>

## Requirements before any future re-enablement

1. **Choose the intended Bicep deployment identity.** Delegated ARM tokens would preserve user RBAC and attribution. App-only execution would require a separately approved automation use case, least-privilege roles, and stronger policy controls. The contained route uses neither.
2. **Define allowed deployment content.** Decide how to constrain role assignments, policy assignments, deployment scripts, nested deployments, and tenant- or management-group-scope resources.
3. **Require preview and approval as policy dictates.** Consider mandatory what-if output, explicit confirmation, idempotency, durable audit records, and approval for privileged templates.
4. **Validate the Bicep compilation contract.** [Bicep CLI build](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/bicep-cli#build) converts source to ARM JSON. Require compiled object fixtures and rejection of invalid or unresolved sources before permitting submission. A compiler service requires separate approval.
5. **Prefer workload identity over client secrets.** If app-only execution is retained in Azure hosting, evaluate managed identity after the execution model and permissions are approved.

Direct Bicep deployment remains unavailable regardless of
`AZURE_DEPLOY_ALLOWED_SUBSCRIPTIONS` or other Azure configuration. The owner chose
export-only containment; none of the future requirements above authorize
implementation or deployment.
