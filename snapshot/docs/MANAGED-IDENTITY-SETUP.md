# Managed Identity Setup — Retiring `AZURE_CLIENT_SECRET`

How to move Portal 360° from a Microsoft Entra **client secret** to a **user-assigned managed
identity** used as a **federated identity credential (FIC)** on the app registration.

> **Status: infrastructure ready, application code not yet migrated.**
>
> `infra/main.bicep` creates the managed identity (`deployWebAppManagedIdentity`, default `true`).
> The application still reads `AZURE_CLIENT_SECRET` in `src/lib/auth.ts`, `src/lib/graphClient.ts`,
> and the other token helpers. **Do not remove the secret until the code changes in
> [§7](#7-application-code-changes-required) are done and verified** — the app will fail to start
> and sign-in will break.

Every Azure behaviour below was verified against Microsoft Learn. Where something depends on a
library version rather than on Azure, it is called out explicitly.

---

## 1. Why user-assigned, and not system-assigned

This is the single most important constraint, and it overrides the intuition that a system-assigned
identity is the simpler choice:

> "You can only use **User-Assigned Managed Identities** as a credential."
>
> — [Configure an application to trust a managed identity](https://learn.microsoft.com/entra/workload-id/workload-identity-federation-config-app-trust-managed-identity)

A **system-assigned** identity is still useful — it can hold data-plane roles on Cosmos DB, Key
Vault, or Redis — but Microsoft Entra will not accept it as a federated identity credential on an
app registration. It therefore **cannot** be used to retire `AZURE_CLIENT_SECRET`.

There is a second, operational reason. The FIC `subject` is the identity's **principal (object)
ID**. A system-assigned identity's principal ID is created and destroyed with the App Service, so
deleting and recreating `portal365` would silently invalidate the FIC and break authentication
tenant-wide. The user-assigned identity in `infra/main.bicep` has a lifecycle independent of the
web app, so its principal ID is stable.

---

## 2. What the identity actually does

The identity has two unrelated jobs. Keeping them straight avoids most of the confusion in this area.

| Job | Mechanism | Replaces |
| --- | --- | --- |
| **Data-plane access** — Cosmos DB, Key Vault, Redis | The identity's own token is sent straight to the resource | Account keys, connection strings |
| **App registration credential** — Graph, ARM, Power Platform, Dataverse, sign-in | The identity's token is exchanged for an *app* token via a FIC (client assertion) | `AZURE_CLIENT_SECRET` |

The second job is the interesting one. Instead of proving identity with a shared secret, the app
asks the Azure platform for a managed identity token whose audience is `api://AzureADTokenExchange`,
then presents that token to Entra as a `client_assertion`. Entra checks the assertion's `issuer` and
`subject` against the FIC on the app registration and, if they match, issues the app token.

Nothing about this requires the app to hold a long-lived credential; the platform mints the
assertion on demand and rotates the underlying keys itself.

---

## 3. Deploy the identity

`infra/main.bicep` creates the identity and grants it the Cosmos DB Built-in Data Contributor
data-plane role.

```bash
azd provision
# or, without azd:
az deployment group create \
  --resource-group <rg-name> \
  --template-file infra/main.bicep \
  --parameters infra/main.bicepparam
```

Capture the three outputs:

```bash
az deployment group show \
  --resource-group <rg-name> \
  --name main \
  --query "properties.outputs.{resourceId:webAppManagedIdentityResourceId.value, clientId:webAppManagedIdentityClientId.value, principalId:webAppManagedIdentityPrincipalId.value}" \
  -o table
```

| Output | Used for |
| --- | --- |
| `webAppManagedIdentityResourceId` | Attaching the identity to the App Service ([§4](#4-attach-the-identity-to-the-app-service)) |
| `webAppManagedIdentityClientId` | App settings, so the app binds to *this* identity ([§5](#5-application-settings)) |
| `webAppManagedIdentityPrincipalId` | The FIC `subject` ([§6](#6-create-the-federated-identity-credential)) — **not** the client ID |

> Using the client ID where the principal ID is required is the most common mistake here, and Entra
> accepts it silently. See the warning in [§6](#6-create-the-federated-identity-credential).

### Why the App Service itself is not in this template

`infra/main.bicep` is an infrastructure-only `azd` project covering the PAX export job and Cosmos DB.
The `portal365` App Service is deployed by `.github/workflows/azure-app-service-deploy.yml` and, per
`azure.yaml`, is deliberately out of scope. The Bicep therefore creates the *identity* — which other
resources in the template must trust — and leaves attaching it to the App Service as the explicit
step below, rather than taking ownership of a live production resource.

---

## 4. Attach the identity to the App Service

```bash
RG=$(az webapp list --query "[?name=='portal365'].resourceGroup" -o tsv)
MI_RESOURCE_ID=<webAppManagedIdentityResourceId from §3>

az webapp identity assign \
  --name portal365 \
  --resource-group "$RG" \
  --identities "$MI_RESOURCE_ID"
```

`--identities` is additive and takes a space-separated list. If the app already relies on its
system-assigned identity for existing grants, keep both so nothing is revoked mid-migration:

```bash
az webapp identity assign \
  --name portal365 \
  --resource-group "$RG" \
  --identities [system] "$MI_RESOURCE_ID"
```

Confirm:

```bash
az webapp identity show --name portal365 --resource-group "$RG" -o json
```

### Deployment slots have their own identity

Identity is a property of the slot resource and **does not swap**. The `test` staging slot
therefore does not inherit production's identity, and today has none at all. Production keeps
its identity and every role assignment through a swap, so slot deployments are safe — but the
staging slot cannot exercise anything that authenticates with `DefaultAzureCredential` (Redis
over Entra ID, Cosmos DB, ARM).

That is why `/api/health/ready` gates on *configuration* rather than connectivity: those
dependencies only resolve once the build is running under production's identity. If you want
the slot to be a genuine pre-production environment rather than a swap staging area, assign it
an identity and mirror the role assignments:

```bash
az webapp identity assign --name portal365 --resource-group "$RG" --slot test --identities [system]
```

Then repeat the role grants in [§6](#6-create-the-federated-identity-credential) for the slot's
principal ID. See `docs/DEPLOYMENT-CHECKLIST.md` → Slot Deployment & Health Check.

---

## 5. Application settings

```bash
az webapp config appsettings set \
  --name portal365 \
  --resource-group "$RG" \
  --settings \
    AZURE_MANAGED_IDENTITY_CLIENT_ID="<webAppManagedIdentityClientId>" \
    COSMOS_DB_MANAGED_IDENTITY_CLIENT_ID="<webAppManagedIdentityClientId>"
```

### ⚠️ `AZURE_CLIENT_ID` is overloaded — do not remove or repurpose it

`AZURE_CLIENT_ID` means two different things depending on who reads it:

- **Portal 360°** uses it as the **app registration's** client ID (`src/lib/auth.ts`,
  `src/lib/graphClient.ts`). It must keep that value.
- **`DefaultAzureCredential`** reads the same variable to decide which *user-assigned managed
  identity* to bind to, and `EnvironmentCredential` reads it together with `AZURE_CLIENT_SECRET` to
  authenticate as a service principal.

`src/lib/cosmos/cosmosClient.ts` already documents the resulting failure mode: with
`AZURE_CLIENT_ID` and `AZURE_CLIENT_SECRET` both set, `DefaultAzureCredential` picks
`EnvironmentCredential` first and Cosmos returns `403` (substatus `5301`), because the data-plane
role was granted to the managed identity and not to that service principal.

Two consequences:

1. **Always bind the identity explicitly.** Use `new ManagedIdentityCredential({ clientId })` with
   the value from `AZURE_MANAGED_IDENTITY_CLIENT_ID`. Never let `DefaultAzureCredential` guess.
2. **Removing `AZURE_CLIENT_SECRET` changes credential resolution.** `EnvironmentCredential` stops
   activating, so anything still relying on `DefaultAzureCredential` silently switches to a
   different credential in the chain. Re-test Cosmos, Redis, and Key Vault paths after removal.

---

## 6. Create the federated identity credential

Create `credential.json`:

```json
{
  "name": "portal360-webapp-mi",
  "issuer": "https://login.microsoftonline.com/<TENANT_ID>/v2.0",
  "subject": "<webAppManagedIdentityPrincipalId>",
  "description": "Portal 360 web app user-assigned managed identity",
  "audiences": ["api://AzureADTokenExchange"]
}
```

```bash
az ad app federated-credential create \
  --id <APP_REGISTRATION_CLIENT_ID> \
  --parameters credential.json
```

Verify:

```bash
az ad app federated-credential list --id <APP_REGISTRATION_CLIENT_ID> -o table
```

### Field reference

| Field | Value | Notes |
| --- | --- | --- |
| `issuer` | `https://login.microsoftonline.com/{tenantId}/v2.0` | Leading/trailing whitespace blocks the exchange |
| `subject` | Managed identity **Object (Principal) ID** | Case-sensitive; must match exactly |
| `audiences` | `api://AzureADTokenExchange` | `…USGov` / `…China` for sovereign clouds |
| `name` | 3–120 chars, URL-friendly, first char alphanumeric | **Immutable** once created |

### ⚠️ Misconfiguration fails silently

> "If you accidentally add incorrect information in the *issuer*, *subject* or *audience* setting the
> federated identity credential is created successfully without error. The error does not become
> apparent until the token exchange fails."

A successful `az ad app federated-credential create` proves nothing. Only an end-to-end token
acquisition does.

### Other verified constraints

- **Maximum 20 federated identity credentials** per application.
- The app registration and the managed identity **must be in the same tenant**.
- **Wildcards are not supported** in any FIC property.
- Accessing resources in **another tenant is supported**; accessing **another cloud is not** — those
  token requests fail. This matters for Portal 360°'s multi-tenant paths
  (`src/lib/tenants/tokens.ts`): cross-tenant works, but the app registration must be multi-tenant
  and provisioned into the customer tenant.
- Creating the FIC requires Application Administrator, Application Developer, Cloud Application
  Administrator, or Application Owner (permission
  `microsoft.directory/applications/credentials/update`).

---

## 7. Application code changes required

None of this is done yet. Entra supports every flow below with a client assertion — that part is
verified — but the code currently sends `client_secret`.

### 7.1 Shared assertion helper

```ts
// src/lib/auth/managedIdentityAssertion.ts
import 'server-only'
import { ManagedIdentityCredential } from '@azure/identity'

// Global cloud. Use api://AzureADTokenExchangeUSGov or …China for sovereign clouds.
const MI_AUDIENCE = 'api://AzureADTokenExchange'

let credential: ManagedIdentityCredential | undefined

/** Returns a managed identity token to present to Entra as a client assertion. */
export async function getClientAssertion(): Promise<string> {
  const clientId = process.env.AZURE_MANAGED_IDENTITY_CLIENT_ID
  if (!clientId) {
    throw new Error('AZURE_MANAGED_IDENTITY_CLIENT_ID is not configured')
  }

  // Bind explicitly — see the AZURE_CLIENT_ID collision in §5.
  credential ??= new ManagedIdentityCredential({ clientId })

  const token = await credential.getToken(`${MI_AUDIENCE}/.default`)
  if (!token) throw new Error('Failed to acquire managed identity assertion')
  return token.token
}
```

### 7.2 MSAL Node (the OBO path in `src/lib/graphClient.ts`)

`@azure/msal-node` accepts `clientAssertion` as either an assertion string or a callback returning
one, so the OBO leg needs no protocol-level work:

```ts
cca = new ConfidentialClientApplication({
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    clientAssertion: getClientAssertion, // replaces clientSecret
  },
})
```

> Confirm the exact `clientAssertion` shape against the installed `@azure/msal-node` v5 typings
> before relying on it; the callback signature has changed across major versions.

### 7.3 Raw token requests

Every hand-rolled `client_credentials` POST in `src/lib/graphClient.ts` (ARM, BAP, Dataverse,
SharePoint, App Insights, Log Analytics, Cognitive Services, Exchange OWA, Power Platform) swaps two
parameters:

```diff
 body: new URLSearchParams({
   client_id: clientId,
-  client_secret: clientSecret,
+  client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
+  client_assertion: await getClientAssertion(),
   scope,
   grant_type: 'client_credentials',
 })
```

The same substitution applies to the on-behalf-of and refresh-token grants — Entra documents
`client_assertion_type` / `client_assertion` as a direct replacement for `client_secret` on all of
them.

### 7.4 NextAuth sign-in — the one genuinely awkward leg

`src/lib/auth.ts` configures the Entra provider with `clientSecret` and
`token_endpoint_auth_method: 'client_secret_post'`.

Entra accepts a client assertion for the authorization-code redemption (it is documented as
"required for confidential web apps" alongside the secret). **However**, Auth.js v5's built-in
client authentication methods sign their own JWT from a private key; they do not expose a hook for
presenting an externally minted assertion like a managed identity token.

So this leg needs one of:

- a custom token-endpoint request that posts `client_assertion` directly, or
- performing the code exchange with MSAL Node (which already supports the assertion callback) and
  handing the result to Auth.js.

Verify the available extension points against the pinned `next-auth` version
(`5.0.0-beta.32`) before committing to an approach — this is the part most likely to need
iteration, and it is a library limitation rather than an Azure one.

---

## 8. Update the deployment pipeline gate

`.github/workflows/azure-app-service-deploy.yml` **hard-fails** the deploy when
`AZURE_CLIENT_SECRET` is missing:

```yaml
for setting in NEXTAUTH_SECRET NEXTAUTH_URL AZURE_CLIENT_ID AZURE_CLIENT_SECRET AZURE_TENANT_ID; do
```

Remove `AZURE_CLIENT_SECRET` from that list and add `AZURE_MANAGED_IDENTITY_CLIENT_ID` in the same
change that removes the app setting. Otherwise the first deploy after retiring the secret fails the
verification step before it ever reaches the app.

The workflow's own Azure login already uses OIDC federated credentials (`azure/login@v2` with
`id-token: write`), so the pipeline itself holds no Azure secret to rotate.

---

## 9. What still genuinely requires a secret

Not everything can move. These are real constraints, not gaps in the migration.

| Case | Why a managed identity cannot cover it |
| --- | --- |
| **Local development** | Managed identity tokens are issued by a local token endpoint that the Azure host injects — IMDS on VMs, `IDENTITY_ENDPOINT` on App Service (which is exactly what `src/lib/cosmos/cosmosClient.ts` probes for). A developer laptop has neither, so `ManagedIdentityCredential` cannot mint the assertion. Local dev needs a separate dev app registration with its own secret or certificate — keep it scoped to a dev tenant and never share the production credential. |
| **`NEXTAUTH_SECRET` / `AUTH_SECRET`** | Not an Entra credential at all. It is the symmetric key that encrypts and signs the session cookie. No managed identity can replace it; it must remain a secret and should be a Key Vault reference. Frequently conflated with the client secret — they are unrelated. |
| **Hosting outside Azure** | Containers on-premises or on another cloud have no Azure-issued managed identity. Those deployments need a client secret or, better, a certificate credential. |
| **Cross-cloud resource access** | Verified: cross-*tenant* access works, cross-*cloud* does not. Token requests from a commercial-cloud identity to a sovereign cloud fail regardless of FIC configuration. |
| **Non-Entra third-party credentials** | `AI_API_KEY`, ServiceNow credentials, and similar are not Entra app credentials. They are out of scope here and still need Key Vault. |
| **A separate Azure DevOps app registration** | If `AZURE_DEVOPS_CLIENT_ID` points at a *different* app registration, that app needs its own FIC. It can reuse the same managed identity as `subject` (each app has its own 20-credential budget), but the FIC must be created on each app registration separately. |

Certificates are the middle ground where a managed identity is unavailable: they avoid a shared
secret in configuration but still require rotation.

---

## 10. Verification

Work in this order; each step depends on the previous one.

1. **Identity attached** — `az webapp identity show --name portal365 --resource-group "$RG"` lists
   the user-assigned identity.
2. **FIC present and correct** — `az ad app federated-credential list --id <APP_ID> -o json`, then
   check `subject` character-for-character against `webAppManagedIdentityPrincipalId`. Creation
   succeeding does not mean it is right.
3. **Assertion obtainable** — from the app (or an App Service SSH session), acquire a token for
   `api://AzureADTokenExchange/.default` using the identity.
4. **Exchange works** — acquire an app token for `https://graph.microsoft.com/.default` using the
   assertion.
5. **Sign-in works** — full interactive sign-in, which exercises the auth-code leg from §7.4.
6. **Delegated calls work** — load a Graph-backed page to exercise the OBO leg.
7. **Cosmos works** — load `/audit-logs`. A `403` with substatus `5301` means the role assignment
   or the identity binding is wrong, not the FIC.

Only after all seven pass:

```bash
az webapp config appsettings delete \
  --name portal365 \
  --resource-group "$RG" \
  --setting-names AZURE_CLIENT_SECRET
```

Then delete the secret from the app registration ([§11](#11-90-day-secret-rotation-for-tenants-that-must-stay-on-secrets)
covers the commands) and from Key Vault.

### Rollback

The FIC and the client secret can coexist — Entra accepts either credential. Keep the secret in
place until verification passes; rollback is then just restoring the `AZURE_CLIENT_SECRET` app
setting. Removing the FIC is not required.

### Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| `AADSTS7000215: Invalid client secret provided` | Code still sending `client_secret` while the secret is gone, or a stale value |
| Assertion rejected / no matching federated identity record | `subject` holds the client ID instead of the principal ID, wrong tenant in `issuer`, or whitespace in `issuer` |
| Token acquisition times out on the identity | Identity not attached to the App Service, or `AZURE_MANAGED_IDENTITY_CLIENT_ID` not set |
| Cosmos `403` substatus `5301` | Data-plane role missing for this identity, or `DefaultAzureCredential` bound to the wrong principal (see §5) |

---

## 11. 90-day secret rotation (for tenants that must stay on secrets)

For tenants that cannot adopt federated credentials — typically because Portal 360° runs outside
Azure, or local/dev app registrations — rotate on a 90-day cycle.

Verified limits: **a client secret's lifetime cannot exceed 24 months**, and Microsoft recommends
under 12. A 90-day cycle is well inside both.

### ⚠️ Always use `--append`

`az ad app credential reset` **clears all existing passwords and certificates by default.** Running
it without `--append` on a live app registration invalidates the running secret immediately and
takes the application down.

### The rotation

**1. Create the new secret alongside the current one**

```bash
APP_ID=<APP_REGISTRATION_CLIENT_ID>
EXPIRY=$(date -u -d "+90 days" +%Y-%m-%dT%H:%M:%SZ)   # macOS: date -u -v+90d +%Y-%m-%dT%H:%M:%SZ

az ad app credential reset \
  --id "$APP_ID" \
  --append \
  --display-name "portal360-$(date -u +%Y%m%d)" \
  --end-date "$EXPIRY" \
  --query password -o tsv
```

`--end-date` is used rather than `--years` because `--years` is whole years only and defaults to 1.
The command prints the secret **once** — it cannot be retrieved again.

**2. Store it in Key Vault**

```bash
az keyvault secret set \
  --vault-name <KEYVAULT_NAME> \
  --name portal360-client-secret \
  --value "<new secret>" \
  --expires "$EXPIRY" \
  --output none        # keeps the value out of the terminal and CI logs
```

**3. Point the app at the new version**

If the app setting is a versionless Key Vault reference
(`@Microsoft.KeyVault(SecretUri=https://<vault>.vault.azure.net/secrets/portal360-client-secret/)`),
App Service picks up the new version automatically, though it can take up to 24 hours. Force it:

```bash
az webapp restart --name portal365 --resource-group "$RG"
```

If the reference is version-pinned, update it explicitly:

```bash
NEW_VERSION=$(az keyvault secret show \
  --vault-name <KEYVAULT_NAME> \
  --name portal360-client-secret \
  --query id -o tsv)

az webapp config appsettings set \
  --name portal365 \
  --resource-group "$RG" \
  --settings AZURE_CLIENT_SECRET="@Microsoft.KeyVault(SecretUri=${NEW_VERSION})"
```

**4. Verify before removing the old secret**

Confirm sign-in and at least one Graph-backed page. Check the Key Vault reference resolved:

```bash
az webapp config appsettings list \
  --name portal365 \
  --resource-group "$RG" \
  --query "[?name=='AZURE_CLIENT_SECRET']" -o json
```

**5. Delete the superseded secret**

List credentials and remove the old `keyId` — never a blind `reset` without `--append`:

```bash
az ad app credential list --id "$APP_ID" \
  --query "[].{keyId:keyId, displayName:displayName, end:endDateTime}" -o table

az ad app credential delete --id "$APP_ID" --key-id <OLD_KEY_ID>
```

### Operational notes

- **Overlap deliberately.** Create the new secret, cut over, verify, *then* delete the old one. Both
  are valid simultaneously, so there is no reason to accept downtime.
- **Alert ahead of expiry.** Set the Key Vault `--expires` attribute as above and alert on
  `SecretNearExpiry` via Event Grid, so rotation is scheduled rather than incident-driven.
- **Never log the value.** Use `--query password -o tsv` to emit only the secret, pipe it straight
  into Key Vault, and use `--output none` on the write. Do not echo it into CI logs or commit it.
- **Rotate the DevOps registration too** if `AZURE_DEVOPS_CLIENT_ID` is a separate app.
- **Prefer certificates** where federated credentials are unavailable but a secret is undesirable:
  `az ad app credential reset --id "$APP_ID" --append --create-cert --keyvault <KEYVAULT_NAME>`
  creates the certificate directly in Key Vault.

---

## References

- [Configure an application to trust a managed identity](https://learn.microsoft.com/entra/workload-id/workload-identity-federation-config-app-trust-managed-identity)
- [Workload identity federation overview](https://learn.microsoft.com/entra/workload-id/workload-identity-federation)
- [OAuth 2.0 on-behalf-of flow](https://learn.microsoft.com/entra/identity-platform/v2-oauth2-on-behalf-of-flow)
- [OAuth 2.0 authorization code flow](https://learn.microsoft.com/entra/identity-platform/v2-oauth2-auth-code-flow)
- [Managed identities for App Service](https://learn.microsoft.com/azure/app-service/overview-managed-identity)
- [`az ad app federated-credential`](https://learn.microsoft.com/cli/azure/ad/app/federated-credential)
- [`az ad app credential`](https://learn.microsoft.com/cli/azure/ad/app/credential)
- [`az webapp identity`](https://learn.microsoft.com/cli/azure/webapp/identity)

### Related repository docs

- [`docs/ENVIRONMENT-VARIABLES.md`](./ENVIRONMENT-VARIABLES.md) — credential-selection behaviour
- [`docs/DEPLOYMENT-CHECKLIST.md`](./DEPLOYMENT-CHECKLIST.md) — Key Vault references and consent
- [`docs/auth-providers.md`](./auth-providers.md) — app registration, scopes, OBO
- [`docs/APP-ONLY-JOBS.md`](./APP-ONLY-JOBS.md) — the app-only callers that must stay app-only
