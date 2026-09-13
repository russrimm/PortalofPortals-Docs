# Power Platform environment request

Portal 360° includes a self-service "request a new Power Platform environment" form that captures the parameters needed by the BAP environment-creation API and hands them off to a configured Azure Logic App. The Logic App owns the privileged BAP call, so the portal itself never needs environment-admin credentials.

| Surface | Path |
| --- | --- |
| Request form (UI) | [`/power-platform/environments/request`](../src/app/power-platform/environments/request/page.tsx) |
| Submission API | `POST /api/power-platform/environments/request` ([handler](../src/app/api/power-platform/environments/request/route.ts)) |
| Validation schema | [`src/lib/schemas/environment-request.ts`](../src/lib/schemas/environment-request.ts) |

The route is registered in [`src/lib/route-registry.ts`](../src/lib/route-registry.ts) with `Power Platform → Environments → Request new environment` as its breadcrumb chain.

## Labels and validation feedback

Visible field labels target the actual inputs, including the environment-owner
picker. Hints remain associated when a field error appears. Failed submissions
focus the error summary, whose links reach the affected field or section without
clearing entered values. Field-specific errors mark the control invalid and clear
when that field is edited.

The current API flattens nested validation errors to `dataverse` and `requester`.
Those messages are associated with their section and its inputs rather than
incorrectly attributing a group error to one field. They remain until the next
submission revalidates the group. This increment does not change the request
payload, validation schema, provisioning workflow, or permissions.

---

## Architecture

```
┌─────────────────┐     POST /api/power-platform/environments/request
│ Browser (form)  │ ──────────────────────────────────────────────────► Next.js (BFF)
└─────────────────┘                                                       │
                                                                          │ validates
                                                                          │ + adds
                                                                          │ submittedBy
                                                                          ▼
                                                              Azure Logic App (HTTPS trigger)
                                                                          │
                                                                          ▼
                                                    POST .../environments?api-version=…
                                                       (privileged BAP call)
```

The browser never sees a BAP token. The portal forwards a validated payload to the Logic App, then forwards the Logic App's status back to the UI.

---

## Configuration

| Environment variable | Required | Purpose |
| --- | --- | --- |
| `POWER_PLATFORM_ENV_REQUEST_LOGIC_APP_URL` | ✅ Yes | Full HTTPS trigger URL of the Logic App, including the SAS `sig` query parameter. The API returns `503 NotConfigured` if missing or not `https://`. |
| `POWER_PLATFORM_ENV_REQUEST_LOGIC_APP_HEADER_NAME` | Optional | Custom header name sent on every forwarded request — pair with the value below for a shared-secret check inside the Logic App. |
| `POWER_PLATFORM_ENV_REQUEST_LOGIC_APP_HEADER_VALUE` | Optional | Custom header value. Only sent when both name and value are set. |
| `POWER_PLATFORM_ENV_REQUEST_DEFAULT_ENVIRONMENT_GROUP_ID` | Optional | Tenant default environment-group GUID. Injected server-side when the request omits one so end users don't have to know the GUID. |
| `POWER_PLATFORM_ENV_REQUEST_DEFAULT_BILLING_POLICY_ID` | Optional | Tenant default billing-policy GUID. Injected server-side when the request omits one. |
| `POWER_PLATFORM_ENV_REQUEST_DEFAULT_SECURITY_GROUP_ID` | Optional | Tenant default Dataverse security-group GUID. Injected server-side when the request omits one (only used when `provisionDataverse` is true). |

Values for the three `_DEFAULT_*` variables must be GUIDs — invalid values are ignored with a warning and the field is treated as unset.

A 30-second client-side abort timeout is applied to the upstream call so the UI gets a deterministic 502 if the Logic App is slow.

---

## Request payload

The body posted to `/api/power-platform/environments/request` is validated by `EnvironmentRequestSchema` (Zod). The shape mirrors the BAP environment-creation arguments:

```json
{
  "displayName": "Contoso Sales — Production",
  "description": "Customer-facing sales app + Dataverse store",
  "environmentType": "Production",
  "location": "unitedstates",
  "azureRegion": "eastus",
  "cadence": "Frequent",
  "environmentGroupId": "00000000-0000-0000-0000-000000000000",
  "billingPolicyId": "00000000-0000-0000-0000-000000000000",
  "ownerId": "00000000-0000-0000-0000-000000000000",
  "releaseCycle": "GA",
  "allowBingSearch": false,
  "allowMovingDataAcrossRegions": false,
  "provisionDataverse": true,
  "dataverse": {
    "languageCode": "1033",
    "currencyCode": "USD",
    "securityGroupId": "00000000-0000-0000-0000-000000000000",
    "domain": "contoso-sales-prod",
    "templates": ["D365_Sales"]
  },
  "requester": {
    "name": "Pat Lee",
    "email": "pat.lee@contoso.com",
    "businessJustification": "New geo rollout; required by Q3 launch."
  }
}
```

### Validation highlights

- `displayName` — 1–60 characters.
- `environmentType` — `Production` | `Sandbox` | `Trial` | `Developer`.
- `cadence` — `Frequent` | `Moderate` (optional).
- All GUID-shaped fields (`environmentGroupId`, `billingPolicyId`, `ownerId`, `securityGroupId`) accept either a valid GUID or empty string.
- `dataverse.languageCode` — 4-digit LCID (e.g. `1033`).
- `dataverse.currencyCode` — 3 uppercase ISO letters.
- `dataverse.domain` — letters/digits/hyphens, must start with a letter and not end with a hyphen.
- `dataverse.templates` — up to 20 template codes (e.g. `D365_Sales`).
- `requester.email` — must be a valid email; `businessJustification` 10–2000 chars.
- Cross-field rule: if `provisionDataverse` is `true`, the `dataverse` block is **required** (error reported under `dataverse`).

### Server-injected fields

The request form intentionally does **not** collect these fields — the API route fills them in before validation:

- `requester.name`, `requester.email` — taken from the authenticated Entra ID session (`session.user`). The API returns `400 IdentityMissing` if the signed-in user has no name or email in Entra.
- `environmentGroupId`, `billingPolicyId`, `dataverse.securityGroupId` — filled from the `POWER_PLATFORM_ENV_REQUEST_DEFAULT_*` env vars when the request omits them. If the env var is unset (or not a GUID), the field stays omitted and the Logic App should apply its own tenant default.

References used to build the schema:

- [Create a Power Platform environment](https://learn.microsoft.com/power-platform/admin/create-environment)
- [`New-AdminPowerAppEnvironment` cmdlet](https://learn.microsoft.com/powershell/module/microsoft.powerapps.administration.powershell/new-adminpowerappenvironment)
- [Terraform `powerplatform_environment` resource](https://microsoft.github.io/terraform-provider-power-platform/resources/environment/)

---

## Forwarded payload (portal → Logic App)

The handler enriches the validated body with audit metadata derived from the authenticated session, so the Logic App can record who actually triggered each request:

```json
{
  "correlationId": "5cf2…",
  "submittedAt": "2026-05-27T13:00:00.000Z",
  "submittedBy": {
    "name": "Pat Lee",
    "email": "pat.lee@contoso.com",
    "id": "<oid>"
  },
  "request": { /* the validated body shown above */ }
}
```

Headers attached to the upstream request:

- `Content-Type: application/json`
- `x-correlation-id: <same correlationId as above>`
- the configured shared-secret header (if both env vars are set)

The Logic App should respond with JSON, ideally `{ "status": "queued", "trackingId": "..." }`. The handler will pass that body through under the `upstream` field on a 202 response. Non-JSON responses are truncated to 500 characters and wrapped in `{ "text": "..." }`.

---

## API responses

| Status | When | Body shape |
| --- | --- | --- |
| `202 Accepted` | Logic App accepted the request. | `{ status: "submitted", message, correlationId, upstream }` |
| `400 InvalidBody` | Body was not JSON. | `{ error, message }` |
| `400 ValidationError` | Zod validation failed. | `{ error, message, issues }` |
| `401` | No authenticated session (every API route in the portal authenticates first). | `UNAUTHORIZED_RESPONSE` |
| `403` | Missing/invalid CSRF token. | from `requireCsrf` |
| `502 UpstreamUnavailable` | Could not reach the Logic App (network error or 30s timeout). | `{ error, message, correlationId }` |
| `502 UpstreamError` | Logic App returned a non-2xx status. | `{ error, message, correlationId, status, details }` |
| `503 NotConfigured` | `POWER_PLATFORM_ENV_REQUEST_LOGIC_APP_URL` missing or not `https://`. | `{ error, message }` |

All error responses are sanitised — no Logic App secrets, no upstream stack traces. `correlationId` is the value to look up in Logic App run history when investigating an individual submission.

---

## Logic App contract

The portal does not impose a specific Logic App template, only this contract:

1. **Trigger** — *When a HTTP request is received* (POST). The trigger's body schema should match the "Forwarded payload" section above. A sample is shown in the form's "API contract" tooltip and reproduced [in the schema file](../src/lib/schemas/environment-request.ts).
2. **Auth check (recommended)** — Validate the shared-secret header if configured.
3. **Business action** — Call `POST {bap-host}/providers/Microsoft.BusinessAppPlatform/environments?api-version=...` (or the equivalent for environment-group scoped creation). Use a managed identity / service principal with `Power Platform Administrator` or scoped environment-admin role.
4. **Response** — Return JSON. `200` or `202` is treated as success; anything else triggers a `502 UpstreamError` to the UI.

---

## Security checks performed by the handler

- ✅ Authenticates first (`verifyAuth`) before any I/O.
- ✅ CSRF-protected (`requireCsrf`) — the form attaches the token automatically.
- ✅ Validates the body with Zod (`safeParse`) and returns flattened field errors.
- ✅ Verifies the Logic App URL is configured **and** `https://` before reading the body.
- ✅ Embeds requester identity from the session, not the body, so the Logic App's audit log is trustworthy.
- ✅ Truncates upstream response text to 500 chars to avoid log/output bloat.

---

## Related docs

- [Power Platform schema sync](./power-platform-schema-sync.md) — keeps the inventory API version + tenant settings in sync.
- [Power Platform API features](./power-platform-api-features.md)
- [Power Platform authentication guide](./power-platform-authentication-guide.md)
