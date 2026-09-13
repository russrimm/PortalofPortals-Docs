# Copilot Studio & Agent Builder Credit Consumption

Reports every Copilot Studio and Agent Builder agent published in the tenant alongside the
billed and non-billed Copilot credits each agent consumed over a chosen window.

- **Page:** `/power-platform/copilot-studio/agent-credit-consumption`
- **API:** `GET /api/power-platform/copilot-studio/agent-credit-consumption`
- **Server logic:** `src/lib/copilot/agentCreditConsumption.ts`

> Credit consumption is **model/automation-grained**, not connector-grained — it cannot tell you
> which connector an agent called. For that, see the
> [Tool & Connector Call Report](./copilot-studio-tool-call-report.md), and for the full picture of
> which Copilot Studio telemetry lives where, see the
> [telemetry source map](./copilot-studio-usage-calculation.md#telemetry-source-map--whats-available-where).

## Why two upstream APIs

The Microsoft Graph Copilot catalog is the authoritative inventory of agents published to the
tenant, but it carries **no** consumption data. Copilot credit consumption is only exposed by the
Power Platform licensing entitlement API. The report joins them.

| Data | Upstream | Delegated scope |
|------|----------|-----------------|
| Agent inventory + metadata | `GET /v1.0/copilot/admin/catalog/packages` then `GET /v1.0/copilot/admin/catalog/packages/{agentId}` | `CopilotPackages.Read.All` (the app already holds `CopilotPackages.ReadWrite.All`) |
| Billed / non-billed credits | `GET https://licensing.powerplatform.microsoft.com/v2.0/tenants/{tenantId}/entitlements/MCSMessages/resources` | `https://licensing.powerplatform.microsoft.com/.default` |

Both calls run on delegated (OBO) tokens. The Graph list call falls back to `/beta` only when
`/v1.0` reports the endpoint as unavailable (404/400/501); the resolved version is returned as
`graphVersion`.

Reference implementation for the Graph portion:
<https://gist.github.com/joerodgers/b3d76c953dd7a5b17c1b38608d7d3af7>

## Query parameters

| Parameter | Format | Default | Description |
|-----------|--------|---------|-------------|
| `fromDate` | `MM-dd-yyyy` | First day of the current month | Start of the credit consumption window |
| `toDate` | `MM-dd-yyyy` | Today | End of the credit consumption window |
| `environmentId` | string | *(none)* | Restrict credit consumption to a single environment |
| `includeThirdParty` | `true` \| `false` | `false` | Include Microsoft and partner-published packages |

By default only tenant-authored packages are reported — package `type` of `custom`/`lob`
("Your org") or `shared` ("Your users"), matching the reference script's `lob|shared` filter.

## Agent classification

`elementTypes` drives the surface a given agent belongs to:

- **Copilot Studio** — contains a bot / custom-engine element (`Bots`, `CustomEngineAgent`,
  `CustomEngineCopilots`).
- **Agent Builder** — declarative-only (`DeclarativeAgent`, `DeclarativeCopilots`).
- **Other** — anything else.

Graph frequently returns `platform: "Not Available"` for tenant-authored agents, so `platform` is
inferred from the same element types when it is missing. `availableTo` / `deployedTo` enum values
(`allowedForAll`, `acquiredForSome`, …) are mapped to the admin-center wording used in the Microsoft
365 admin center: *All users*, *Specific users or groups*, *No users*.

## Credit join

Licensing resources are matched to catalog agents by normalized display name (trimmed, whitespace
collapsed, lower-cased), summing `consumed` into `billedCredits` and
`metadata.NonBillableQuantity` into `nonBilledCredits`.

Resources that consume credits but match no catalog agent are returned separately in
`unmatchedCreditResources`. That is expected for environment-scoped Copilot Studio agents never
published to the Microsoft 365 Copilot catalog, and for agents renamed after publishing.

## Graceful degradation

The two control planes fail independently:

- **Graph 403** → the whole request returns `403` with `notAvailable: true`, because there is no
  inventory to report.
- **Licensing token or API failure** → the report still returns the full agent inventory with
  `creditsAvailable: false` and a `creditsError` describing the failure, including
  `consentRequired: true` when admin consent for the licensing scope is missing.
- **Per-agent detail failure** → that agent keeps its list-level fields, records `detailError`,
  and increments the report-level `detailErrors` count.

## Response shape

```jsonc
{
  "agents": [
    {
      "id": "…",
      "displayName": "Contoso HR Agent",
      "surface": "Copilot Studio",
      "platform": "Copilot Studio",
      "publisherType": "Your org",
      "availableTo": "All users",
      "deployedTo": "Specific users or groups",
      "billedCredits": 1420.5,
      "nonBilledCredits": 96,
      "totalCredits": 1516.5,
      "creditMatch": "matched",
      "environmentIds": ["…"]
    }
  ],
  "unmatchedCreditResources": [],
  "summary": {
    "totalAgents": 42,
    "copilotStudioAgents": 18,
    "agentBuilderAgents": 22,
    "totalBilledCredits": 15230.75,
    "totalNonBilledCredits": 812
  },
  "graphVersion": "v1.0",
  "creditsAvailable": true,
  "creditsError": null,
  "detailErrors": 0
}
```

**Status codes:** `200` success · `400` invalid query parameters · `401` not signed in or no
delegated tokens · `403` missing `CopilotPackages` consent · `500` unexpected failure.
