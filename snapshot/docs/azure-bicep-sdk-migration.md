# Bicep export-only containment

## Availability

The Bicep wizard at `/azure/deploy` generates and downloads source files only.
Direct deployment is unavailable. This containment affects only
`/api/azure/bicep/deploy`; Deployment Stacks and other Azure deployment paths
are unchanged.

The former SDK implementation submitted the text of `main.bicep` as ARM
`properties.template` and ignored the other module files. It did not compile
Bicep. Microsoft documents that [Bicep CLI build](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/bicep-cli#build)
converts Bicep to a JSON Azure Resource Manager (ARM) template. Passing raw Bicep
to the SDK is not a substitute for that compilation.

## API compatibility

Both methods retain authentication-first and `portal.write` checks.
POST also retains the existing same-origin and CSRF-token checks.

| Request | Authorized response | Azure activity |
| --- | --- | --- |
| `GET /api/azure/bicep/deploy` | `200`, with `configured: false`, `authenticated: false`, `supported: false`, `exportOnly: true`, `code: "bicep_deployment_unsupported"` and an explanatory `message` | None; no credential probe |
| `POST /api/azure/bicep/deploy` | `501`, with `success: false`, `exportOnly: true`, `code: "bicep_deployment_unsupported"` and an explanatory `error` | None; no compilation or deployment |

The legacy GET fields describe deployment readiness, not the caller's portal
session. An anonymous request receives 401. A caller without write permission
or a POST failing CSRF receives 403 before the containment handler runs.

POST rejects all bodies, including legacy `files`, `parameters`,
`deploymentName`, `location`, and `subscriptionId` payloads. It does not read,
parse, validate, store, or log their contents. Invalid JSON also receives 501
after authorization: there is no accepted deployment-input shape while the
operation is unsupported. No input is forwarded to an upstream service.

Each authorized POST invokes the existing failure audit sink once under
`azure.deployment.create`, with `status: "blocked"`, `statusCode: 501`,
`reason: "bicep_deployment_unsupported"`, `affectedCount: 0`, and
`upstreamApi: "none"`. It does not record caller-supplied target IDs, file names,
source, or parameter values, and never records deployment success.
The shared audit sink retains its existing logged-failure behavior if persistence
fails; this route does not promise durable delivery beyond that shared contract.
Unexpected handler errors use the standard sanitized error response.

## Export and recovery

1. Select resources, configure them, and choose **Generate Bicep**.
2. In **Review & Export**, download every file, including all modules.
3. Keep module-relative paths intact. Review the source and compile it with the
   Bicep CLI in your approved local or CI environment. Treat generated source as
   a draft, not as a validated template.
4. Resolve compilation and module errors before submitting a deployment through
   your separately approved workflow. Apply that workflow's identity, scope,
   review, and approval controls.

Do not add credentials, grant Azure roles, set
`AZURE_DEPLOY_ALLOWED_SUBSCRIPTIONS`, or retry this API to restore direct
deployment. No environment setting enables it. Existing settings used by other
Azure features are not removed or changed by this containment.

## Re-enablement boundary

A compiler service is not implemented or approved by this change. Re-enablement
requires separate design approval for bounded module resolution, compiler
invocation, safe diagnostics, scope validation, cancellation, operation tracking,
and deployment identity. It also requires object-shaped compiled ARM template
fixtures and proof that invalid or unresolved sources never reach deployment.
Authentication, write authorization, CSRF, schema validation for any newly
accepted input, and auditing must remain in place.

The containment fixtures exercise the actual handlers with real portal RBAC
and CSRF checks and mocked session, audit, credential, compiler-process, and
provider boundaries. UI fixtures preserve downloads without calling Azure.
No live deployment is required to validate this containment.
