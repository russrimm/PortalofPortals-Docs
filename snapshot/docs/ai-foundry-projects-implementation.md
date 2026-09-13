# Microsoft Foundry resource discovery

## Browse by subscription

Open **Microsoft Foundry > All Resources** and choose a subscription. Resources
load automatically across resource groups. Search by name, parent, resource
group, or region, or filter by type and region. The table shows the resource
type, parent, resource group, and region. Full resource IDs distinguish resources
that share a name.

The existing `/azure/ai-foundry/accounts` URL remains valid. The overview redirects
there. The saved Azure subscription is reused when available; links from a
selected resource carry the subscription and full resource ID to the next view.

| View | Scope |
| --- | --- |
| All Resources | Foundry accounts, projects, hubs, hub projects, Azure OpenAI, AI Search, and other AI services |
| Projects | Foundry projects and classic hub projects across the subscription |
| Model Deployments | Selected Foundry or Azure OpenAI account; selecting a Foundry project uses its parent account |
| Model Playground | Two deployed text-chat configurations in the selected account; project selection uses its parent account |
| Available Models | Regional subscription catalog; selecting a resource supplies its region |
| Usage & Quotas | Subscription and region; selecting a resource supplies its region |
| List Agents | Selected Foundry project's reported endpoint |
| Agent Chat | Selected Foundry project's endpoint, with an explicit agent name |

Agents are project-scoped data-plane objects, not a resource-group category.
Classic hub projects remain distinguishable from Foundry projects. The portal
does not construct a modern project endpoint for a classic workspace. Unsupported
hub-project agent operations direct you to the Azure resource instead.

A resource group is required only in the **Create account** dialog. Browsing
never lists resource groups as a prerequisite. Account and deployment creation
and deployment deletion retain the existing server authorization and mutation
guards.

## Model playground

Open **Microsoft Foundry > Model Playground** (`/azure/ai-foundry/playground`),
or choose **Model playground** on a selected resource. Select a subscription
and account, then select a deployed text-chat model in each panel. Both panels
use the same prompt and reference documents; instructions, output budget, and
supported temperature settings are independent. Selecting the same deployment
twice is useful for comparing instructions. Models are not deployed, updated,
or given executable tools by the playground.

**Run comparison** submits two separately billed inference requests. Each panel
reports its own answer or failure, provider-reported token counts, finish
status, and server-measured inference duration (excluding account discovery).
This is a single-run observation, not a model benchmark or quality score.
Missing usage is shown as not reported. Token-limit stops, refusals, and filtered
responses are not presented as completed answers. Stop cancels portal requests,
but an upstream generation may already have consumed tokens; there are no
automatic generation retries.

The initial adapter supports recognized OpenAI text-chat families and
Grok/DeepSeek chat models through the v1 Chat Completions API. Embeddings, images,
audio/realtime, Responses-only variants, unrecognized models, and deployments
not in the `Succeeded` state are unavailable. The deployment list explains
unsupported entries and offers the native Foundry handoff. Reasoning models use
their default sampling settings rather than sending unsupported temperature
values. Provider context-window limits still apply.

### Files and privacy

- Supported: UTF-8 `.txt`, `.md`, `.csv`, `.json`, text-based `.pdf`, and `.docx`.
  PDFs need selectable text on every page; blank or scanned pages are rejected.
  Legacy `.doc`, images, encrypted files, and OCR are not supported. DOCX
  extraction rejects macro-enabled/ZIP64 archives and is bounded to 256 entries,
  4 MiB per expanded entry, and 8 MiB total expanded content.
- Limits: three files, 2 MiB per file, 60,000 combined extracted characters,
  12,000 characters each for prompt/instructions, and 8,192 output tokens per
  panel. PDF extraction is limited to 100 pages. Oversized/invalid content is
  rejected, not silently truncated.
- File parsing runs lazily in the browser. Only extracted plain text is sent
  to the portal and the selected model; layout, images, and document formatting
  are not preserved. Review the extracted-text preview before submitting.
- Prompts, attachments, and answers stay in page memory, not browser storage or
  a portal experiment database. Scope changes discard the workspace and cancel
  pending work. Explicit JSON export contains sensitive experiment content;
  handle it according to your organization's policy.
- The portal neither logs prompt/document/response content nor uploads binary
  files to a provider file store. Inference uses `store: false`; this does not
  override the provider's abuse-monitoring, retention, or organizational data
  policies.

### Access and operational requirements

Browsing requires `portal.read`; generating responses requires `portal.write`
(operator or administrator) and valid same-origin CSRF protection. The server
also resolves the effective tenant role, verifies the selected subscription's
tenant, and rereads the selected resource and deployment with the caller's
delegated identity on every request. There are no shared inference caches,
user-supplied endpoints, API keys, app-only retries, or cross-tenant fallbacks.

The caller needs permission to read the subscription/account/deployments in
ARM and the appropriate model inference role on that account. For Azure OpenAI,
Microsoft documents **Cognitive Services OpenAI User** for Entra-authenticated
v1 inference; being able to see a resource does not imply inference access.
The existing delegated helpers acquire ARM and `https://ai.azure.com/.default`
tokens. No new portal endpoint/deployment environment settings are needed, and
the global `AZURE_AI_DEPLOYMENT` is not used by the playground. Existing consent
and RBAC requirements remain independent; a denial is not automatically a
consent problem.

Generation requires the portal's existing durable audit sink. An attempted-run
record must persist before upstream generation starts. Outcome audit failure
preserves the answer with an explicit warning instead of encouraging a second
paid request. Audit metadata records actor, tenant, target, permission context,
correlation, outcome, and duration, never prompt text or filenames.
If `AUDIT_LOG_COSMOS_SERVICE_ALLOWLIST` is configured on the hosting application,
it must include `Azure` or the required audit record is filtered and generation
is blocked. This existing nonsecret setting is read at runtime; the application
configuration owner should confirm a synthetic `ModelPlaygroundRequested`
record in the restricted audit view rather than logging payloads. See
[environment variables](ENVIRONMENT-VARIABLES.md) and the
[deployment checklist](DEPLOYMENT-CHECKLIST.md) for existing Cosmos setup.

## API contracts

### `GET /api/azure/ai-foundry/playground`

Required query: `subscriptionId` (GUID), `resourceId` (full supported account or
project ARM ID in that subscription). Returns `deployments` with full IDs,
model/version/state and supported settings, plus a `partial` flag. Discovery is
bounded to ten pages/1,000 deployments. Continuations must remain on the same
ARM collection. Responses are private and not cached.

### `POST /api/azure/ai-foundry/playground`

JSON fields: `subscriptionId`, `resourceId`, `deploymentId` (full ARM ID),
`instructions`, `prompt`, `documents` (`{ name, text }[]`), `maxOutputTokens`,
and optional `temperature`. Unknown properties, invalid scope, and inputs
outside the limits above are rejected. The JSON body is bounded to 512 KiB,
including chunked requests.

Returns `output`, `model`, `deploymentId`, `finishReason`, `status`
(`completed`, `incomplete`, `blocked`), nullable
`usage.inputTokens/outputTokens/totalTokens`, and `durationMs`.
`auditWarning: true` means the known generation result is retained but its
outcome audit did not persist. Each panel is a separate request: one failure
does not erase the other panel's result. Safe API errors preserve typed
`401 reauth_required` consent signals, upstream denials, and `429` throttling
with bounded `Retry-After`. Requests time out; cancellation is not evidence
that upstream billing stopped.

### `GET /api/azure/ai-foundry/resources`

Required query parameter: `subscriptionId`, an Azure subscription GUID.

The authenticated, delegated-only route returns:

- `value`: normalized resource records with full ARM IDs, names, type labels,
  subscription, resource group, region, and available parent/endpoint metadata.
- `partial`: whether part of the inventory could not be read.
- `warnings`: safe explanations for incomplete discovery.

The server follows continuation pages and limits concurrent child-project
requests. It does not return credentials or acquire application-only permissions
when delegated access fails. Partial results are visibly labeled; a failed read
is not reported as an empty subscription.

### `GET /api/azure/ai-foundry/project-details`

The resource browser supplies `subscriptionId` and `resourceId`, a complete
supported project ARM ID, rather than requiring the user to parse its resource
group and parent. The route selects the matching Cognitive Services or Machine
Learning workspace API. Legacy callers retain their existing query parameters.

Existing deployments, models, usage, agents, and chat endpoints continue to own
their workload-specific requests. The browser selects their scope; it does not
call Azure directly.

The models endpoint requires both `subscriptionId` and `location`. Azure exposes
the catalog at `/locations/{location}/models`, not a subscription-only `/models`
endpoint. The model view retains its initial East US region until you choose a
resource or another region; it does not offer an unsupported all-locations option.

## UI and coverage

`FoundryResourceBrowser` provides the common subscription picker, resource
table, filters, pagination, loading/error/partial states, and full-ID selection.
Selection is resolved against the current subscription inventory. Switching
subscriptions clears the selected scope, and keyed detail views prevent late
responses from restoring another resource's actions.

Resource and deployment details use shared theme tokens. Table controls support
keyboard selection; overflowing tables scroll inside labeled containers.
Creation dialogs use the shared dialog primitive for focus management.

`tests/foundry-resource-discovery.spec.ts` runs with
`playwright.truthful-fixtures.config.ts` against an isolated loopback development
server and ephemeral synthetic authentication. It intercepts API traffic before
navigation and blocks external requests. It covers both themes and narrow/wide
layouts, duplicate resource names, cross-page scope, subscription switching,
partial/error/empty results, and keyboard dialog behavior. These fixtures do not
claim to verify access to a live Azure subscription.

## Microsoft API references

- [Foundry playground concepts](https://learn.microsoft.com/en-us/azure/foundry/concepts/concept-playgrounds)
- [Azure OpenAI v1 API, Entra authentication, and cross-provider support](https://learn.microsoft.com/en-us/azure/foundry/openai/api-version-lifecycle)
- [Foundry resource types](https://learn.microsoft.com/en-us/azure/foundry-classic/concepts/resource-types)
- [Cognitive Services account and project OpenAPI contract](https://github.com/Azure/azure-rest-api-specs/blob/main/specification/cognitiveservices/resource-manager/Microsoft.CognitiveServices/stable/2025-06-01/cognitiveservices.json)
- [Machine Learning workspaces: list by subscription](https://learn.microsoft.com/en-us/rest/api/azureml/workspaces/list-by-subscription?view=rest-azureml-2025-06-01)
- [Regional model catalog request](https://learn.microsoft.com/azure/foundry/concepts/instant-models#supported-models)
