# Pay-as-you-go Budget Guardrails

Caps pay-as-you-go spend on a Power Platform billing policy and automatically
unlinks environments when the cap is reached. Unlinking is the only hard spend
ceiling the platform offers: an environment is either linked to a billing policy
and billable, or unlinked and not.

- **Page:** `/power-platform/licensing/payg-guardrails`
- **APIs:** `/api/power-platform/licensing/payg-guardrails{,/addon,/credit-import,/evaluate}`
- **Server logic:** `src/lib/power-platform/payg-guardrails/`

Prior art: [Herding Clouds: Taming Pay-As-You-Go Billing Policies in Power
Platform at Scale](https://microsoft.github.io/mcscatblog/posts/managing-spend-pay-as-you-go/),
which chains an Azure Budget alert → Action Group → Automation runbook → Power
Automate solution. This feature collapses that five-service chain into the
portal and closes the blind spot the post documents as its own ceiling.

## This is an optional add-on, not a core capability

The feature ships wired into every deployment but **dormant**. Nothing under
`payg-guardrails/*` can create, evaluate, or enforce a guardrail for a tenant
until an admin installs it from the page itself — there is no environment
variable to set and no redeploy required.

Two independent switches exist, and they are not the same thing:

| Switch | Scope | Where | What it controls |
|---|---|---|---|
| **Add-on installed** | Whole tenant | `PUT /api/power-platform/licensing/payg-guardrails/addon` `{ installed: boolean }` | Master gate. `false` (the default for every tenant) means every write, evaluate, and credit-import route on this feature returns `404 { error: 'not_installed' }` — including the scheduled sweep, which becomes a silent no-op rather than enforcing anything nobody asked for. |
| **Guardrail enabled** | One billing policy | `PaygGuardrail.enabled`, set via the page's guardrail modal | Fine-grained arm/disarm for that policy's budget, once the add-on is installed. |

Uninstalling the add-on flips the tenant-wide switch back to `false` **without
deleting saved guardrail configuration** — every budget, cap, and the imported
credit report survive. Reinstalling resumes enforcement with the same settings
rather than forcing an admin to reconfigure from scratch. This is deliberate:
an admin trying the feature, deciding against it, and coming back later should
not lose their work, and an admin who wants a hard, immediate stop to all
enforcement should not have to delete every guardrail one at a time to get it.

Install state is persisted the same way as guardrail configuration (Cosmos,
partitioned by `/tenantId`, with the same `App_Data` fallback for local dev) —
see [Storage](#storage) below.

## Why Copilot credits are imported, not fetched

**The licensing API cannot be consented to. This is not a configuration gap.**

Credit consumption is served by `licensing.powerplatform.microsoft.com`
(first-party app `1c2909a7-6432-4263-a70d-929a3c1f9ee5`, *Common Data Service
License Management*). That resource is **preauthorized for Microsoft's own
first-party clients** and exposes no delegated scope a customer app registration
can be granted. `AADSTS65001` against it is therefore terminal — an admin who
goes looking for the consent button will not find one, because consent between a
first-party resource and a third-party client cannot be issued.

The Power Platform admin center *is* one of those preauthorized clients, which
is why an admin can export the report by hand from a browser while Portal 360
cannot fetch the same data server-side.

So `/api/power-platform/licensing/copilot-credits` and its `download` sibling
return **`501` with `importRequired: true`**, not `403 consentRequired`. That
wording is deliberate: the previous message told admins to grant consent and
sent them chasing something that does not exist.

### Importing the report

1. Export the **per-agent credit report** from the Power Platform admin center.
2. Upload it on `/power-platform/licensing/payg-guardrails`.

The parser (`creditImport.ts`) matches columns by **normalized alias**, not exact
string equality, because the export is undocumented and its labels have drifted
across releases and localize per tenant. Any header it cannot map is reported in
`unmappedHeaders` and shown in the UI, so a format change surfaces as a visible
warning instead of a silently dropped column.

Verified against a real export header:

```
Agent Name,Agent Id,Product,AI Feature,Billed credits,Non-billed credits,
Channel,Knowledge Source,Tool Used,LLM Model,Scenario Name,Environment Id,Environment Name
```

The CSV reader is RFC 4180 compliant (quoted commas, escaped quotes, CRLF, BOM)
rather than a `split(',')`, because agent and scenario names routinely contain
commas — a naive split misaligns every later column and lands credits in the
wrong environment, which reads as a wrong number rather than as a parse error.

## Two signals, not one

The guardrail evaluates two independent signals and trips on whichever breaches
first:

| Signal | Source | Latency | Unit |
|---|---|---|---|
| `azureCost` | Azure Cost Management, scoped to the policy's `billingInstrument` | **8–24 hours** | Billed currency |
| `copilotCredits` | Imported CSV | Near real time | Copilot Credits |

The cost lag is a property of Cost Management, not of this code, and it is the
ceiling the reference design calls out: a runaway agent burning credits at speed
is not visible in dollars until well after the damage. The credit signal is what
closes that gap. Neither signal alone is sufficient — treat a passing cost check
as *"no known breach as of yesterday"*, never as *"safe right now"*.

## Enforcement rules

- **Policy budget breached** → every environment on the policy is unlinked
  (the reference design's kill switch).
- **Per-environment cap breached** → only that environment is unlinked, so one
  runaway environment does not take the whole policy down with it.
- **A signal that could not be read never trips the guardrail.** Unlinking on
  missing data would take production offline because Cost Management happened to
  be throttled, which is worse than briefly overspending. Unreadable signals are
  reported with `unavailableReason` and treated as not breached.
- **`action: 'alertOnly'`** records the breach without changing billing. Run a
  guardrail in this mode before arming it.
- **`dryRun`** reports what would happen and unlinks nothing.

> Azure cost is only measurable at the policy's billing scope, so a
> *per-environment* cost cap is compared against the **policy** total. Only the
> credit cap is genuinely per-environment. The UI states this.

## Scheduling

`POST /api/power-platform/licensing/payg-guardrails/evaluate` is classified `H`
(hybrid) in `auth-mode-classifications.json` and serves two callers:

| Caller | Auth | Tokens | Attribution |
|---|---|---|---|
| Admin in the UI | Session + `portal.write` + CSRF | Delegated (OBO) | Attributable to that admin |
| Scheduler | `PORTAL360_CRON_SECRET` | App-only | `appOnly: true` in the audit record |

The scheduled path is app-only because budget enforcement must run on a timer
with no signed-in user — a category-3 background job under
[`APP-ONLY-JOBS.md`](./APP-ONLY-JOBS.md). A browser cannot trigger it: it
requires the shared secret, which the UI never holds.

```bash
curl -X POST https://<host>/api/power-platform/licensing/payg-guardrails/evaluate \
  -H "x-portal360-cron-secret: $PORTAL360_CRON_SECRET" \
  -H 'content-type: application/json' \
  -d '{}'
```

Evaluations run **sequentially**, not fanned out: each issues a Cost Management
query, and that API is governed by a shared tenant QPU budget that parallel
fan-out would exhaust immediately.

## Storage

Cosmos container `payg-guardrails`, partitioned by `/tenantId`, with an
`App_Data/power-platform-payg-guardrails.json` fallback for local development.

| Document | TTL | Why |
|---|---|---|
| `paygGuardrailsAddon` (install state) | `-1` | The tenant-wide master switch. Losing it must never silently flip a tenant from "not installed" to enforcing, or vice versa. |
| `paygGuardrail` (config) | `-1` | Losing it silently disarms a spend ceiling |
| `paygCreditImport` | `-1` | An expired import reads as "no data" and stops the credit signal tripping |
| `paygEvaluation` (history) | `PAYG_EVALUATION_RETENTION_DAYS`, default 180 | Evidence trail for "why did this stop being billable?" |

## Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `PORTAL360_CRON_SECRET` | For scheduled runs | — | Shared secret authorizing the unattended sweep |
| `COSMOS_DB_PAYG_GUARDRAILS_CONTAINER_ID` | No | `payg-guardrails` | Container override |
| `PAYG_EVALUATION_RETENTION_DAYS` | No | `180` (min 30, max 730) | Evaluation history retention |

## Audit

Every configuration change, import, install/uninstall, and enforcement run is
written to the security audit trail via `logSensitiveAction*`. Each evaluation
is also persisted with its signal readings and per-environment outcomes, so an
unlink can always be traced back to the numbers that caused it.
