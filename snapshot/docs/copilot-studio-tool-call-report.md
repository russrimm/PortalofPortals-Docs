# Copilot Studio Tool & Connector Call Report

Reports which connectors, MCP servers, and agent flows each Copilot Studio agent **actually invoked**, and when — as opposed to which ones it is configured to use.

- **Page:** `/power-platform/copilot-studio/tool-call-report`
- **API:** `POST /api/power-platform/copilot-studio/tool-call-report`
- **KQL builders:** `src/lib/copilot-studio/toolCallReport.ts`
- **Query transport:** `src/lib/appInsightsQuery.ts` (Azure Monitor resource-centric Logs API)

For where this sits among the other Copilot Studio telemetry surfaces, see the
[telemetry source map](./copilot-studio-usage-calculation.md#telemetry-source-map--whats-available-where).

## Why Application Insights and not Dataverse

Dataverse can describe an agent's connector *bindings* but never its connector *calls*:

| Candidate source | Why it can't answer "which connector, when" |
|---|---|
| `botcomponents` + `connectionreferences` | Design-time. Lists configured connection references with **no timestamps**. |
| `msdyn_aievent` | Runtime, but credit-grained — carries model and automation name, not connector identity. |
| `conversationtranscripts` | Runtime, but classic Bot Framework activities carry no tool-call structure. `parseDataverseActivities()` in `src/lib/copilot-studio/analyzer/parse-transcript.ts` deliberately returns `toolCalls: []` for this reason. |
| Agent-level App Insights (`customEvents`) | Message and topic events only. No tool or connector identity. |
| **Environment-level App Insights (`dependencies`)** | **The only source that carries it.** |

## The span model

Environment-level telemetry export writes Copilot Studio agent activity to the Application Insights
`dependencies` table as OpenTelemetry spans following the
[GenAI agent span conventions](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-agent-spans.md).

Each agent **turn** is one trace, grouped by `operation_Id`:

```
InvokeAgent          ← trace root (the user prompt)
├── ExecuteTool      ← one span per tool / connector invocation   ◄── this report
└── OutputMessages   ← the agent's reply
```

`ExecuteTool` children carry `operation_ParentId` = the `InvokeAgent` span's `id`. A conversation
spans multiple turns; `gen_ai.conversation.id` threads them together.

### Native columns used

| Column | Use |
|---|---|
| `timestamp` | The "when" — drives the daily trend and the day × hour heatmap |
| `name` | Filtered to `ExecuteTool` |
| `success` | Outcome; see the type caveat below |
| `resultCode` | `OK` / `ERROR` fallback label in the recent-calls table |
| `duration` | Latency, surfaced as P95 |
| `itemCount` | Sampling weight; see the sampling caveat below |
| `operation_Id` | Trace correlation |

### `customDimensions` keys used

Agent and tool semantics live in `customDimensions`, not native columns.

| Key | Use |
|---|---|
| `gen_ai.tool.name` | The connector / MCP server / flow being called, e.g. `workiqsharepoint:mcp_SharePointRemoteServer` |
| `gen_ai.tool.type` | Tool category, e.g. `MCP - Power Platform Connector` |
| `gen_ai.agent.name`, `gen_ai.agent.id` | Which agent made the call |
| `gen_ai.conversation.id` | Distinct-conversation counts |
| `gen_ai.request.model` | Model in use for the turn |
| `microsoft.channel.name` | Channel; used to exclude `Copilot Studio Test Pane` traffic by default |
| `error.type` | Failure label |

> **Deliberately not projected:** `gen_ai.tool.call.arguments` and `gen_ai.tool.call.result` carry
> end-user payloads. This is an aggregate usage report, not a conversation inspector, so those keys
> are never requested.

## Prerequisite: environment-level export

This report returns nothing until **environment-level** telemetry export is enabled. That is a
different feature from the per-agent Application Insights connection most tenants already have:

| | Agent-level | Environment-level (preview) |
|---|---|---|
| Configured on | Each agent | The environment — must be **managed** |
| Table | `customEvents` | `dependencies` |
| Model | Event-based | OpenTelemetry spans |
| Scope | One agent | All agents in the environment |
| Tool identity | Absent | Present |

See [Environment-level telemetry with Application Insights](https://learn.microsoft.com/microsoft-copilot-studio/advanced-environment-level-agent-telemetry).

Because one resource receives spans for every agent in the environment, the page collapses the
discovered agent→resource pairs to **unique `appId`s** rather than listing the same resource once
per agent.

## How the resource is discovered

The page reuses the agent-level discovery path to find candidate resources:

```
GET /api/power-platform/copilot-studio/agents
  └─► for each agent:
      GET /api/power-platform/copilot-studio/agents/{botId}/appinsights?environmentId=…
          └─► connection string → instrumentation key → Azure Resource Graph → appId (10-min cache)
```

`appId` is then resolved to an ARM resource ID and queried resource-centrically through
`api.loganalytics.azure.com`. Queries run as the **signed-in user**, so the operator needs Reader
(or Monitoring Reader) on both the Application Insights component *and* the Log Analytics
workspace behind it.

## Request

```jsonc
POST /api/power-platform/copilot-studio/tool-call-report
{
  "appId": "1111aaa1-aa11-11aa-11a1-a1aaa1111aa1",  // App Insights Application ID (GUID)
  "days": 30,              // 1–365, default 30
  "agents": [],            // optional gen_ai.agent.name allow-list, max 100
  "tools": [],             // optional gen_ai.tool.name allow-list, max 100
  "includeTestData": false,// include "Copilot Studio Test Pane" traffic
  "recentLimit": 200       // 1–1000
}
```

### No caller-supplied KQL

Unlike the older `dashboard-telemetry` route, this endpoint does **not** accept a query string.
Every KQL statement is composed server-side in `toolCallReport.ts` from the validated parameters
above, so an authenticated browser session cannot pivot the endpoint into an arbitrary Log
Analytics reader.

Filter values are interpolated only as `dynamic([...])` literals encoded with `JSON.stringify`.
Kusto uses the same escape rules as JSON for the characters that matter (`"`, `\`, control
characters), which makes that encoding injection-safe:

```kusto
| where agentName in (dynamic(["Contoso HR Agent","Odd\"Name"]))
```

`days` is clamped to an integer in `[1, 365]` before being inlined into `ago(…d)`.

## Two caveats that silently corrupt results

### 1. `dependencies` is a sampled table

Application Insights ingestion sampling means one stored row can represent several real calls.
`count()` therefore **undercounts**. Every volume figure uses `sum(itemCount)` / `sumif(itemCount, …)`:

```kusto
| summarize totalCalls = sum(itemCount), failedCalls = sumif(itemCount, callSucceeded == false)
```

This is easy to miss because low-volume tenants are not sampled at all — the bug only appears once
traffic grows.

### 2. `success` is not consistently typed

`success` presents as a **bool** in the classic `dependencies` schema and as a **string** in some
workspace-based exports. A naive `where success == false` reports a flat 0% failure rate against
the string form. The base query normalises once:

```kusto
| extend callSucceeded = tobool(success)
```

`tobool()` is an identity on bools, parses `"True"` / `"False"`, and yields `null` for anything
unparseable — so an unknown outcome counts as neither a success nor a failure.

## Response shape

One round trip returns every section; each is an independent Azure Monitor query fanned out with
`Promise.all`.

```jsonc
{
  "summary": {
    "totalCalls": 18420, "failedCalls": 212, "failureRatePct": 1.15,
    "uniqueTools": 14, "uniqueAgents": 6, "uniqueConversations": 3311,
    "uniqueUsers": 480, "avgDurationMs": 412.7, "p95DurationMs": 1180
  },
  "daily":            [{ "day": "2026-08-01", "calls": 610, "failed": 4, "succeeded": 606 }],
  "agentTool":        [{ "agentName": "…", "toolName": "…", "toolType": "…", "calls": 900,
                         "failed": 3, "failureRatePct": 0.33, "conversations": 210,
                         "p95DurationMs": 940, "firstCall": "…", "lastCall": "…" }],
  "toolLeaderboard":  [{ "toolName": "…", "toolType": "…", "calls": 2100, "agents": 3, … }],
  "agentLeaderboard": [{ "agentName": "…", "calls": 5400, "tools": 7, … }],
  "heatmap":          [{ "dayOfWeek": 2, "hour": 14, "calls": 180 }],
  "toolTypes":        [{ "toolType": "MCP - Power Platform Connector", "calls": 9100, "tools": 6 }],
  "recent":           [{ "timestamp": "…", "agentName": "…", "toolName": "…", "success": true,
                         "durationMs": 380, "channel": "…", "conversationId": "…" }],
  "presence":         [{ "name": "ExecuteTool", "spans": 18420 }],
  "agentOptions":     ["Contoso HR Agent"],
  "toolOptions":      ["workiqsharepoint:mcp_SharePointRemoteServer"],
  "partialAccess":    { "deniedTables": [] }   // present only when rows were dropped
}
```

### `presence` drives the empty states

`presence` counts `InvokeAgent` / `ExecuteTool` / `OutputMessages` spans separately so the UI can
distinguish two very different situations that a single "no data" message would conflate:

| Condition | Meaning | Remediation |
|---|---|---|
| `presence` is empty | No agent spans at all | Environment-level export is not enabled |
| `InvokeAgent > 0`, `ExecuteTool == 0` | Agents ran but called no tools | Nothing to fix — or test-pane traffic is being filtered out |
| `ExecuteTool > 0` | Report renders | — |

## Failure modes

- **401** — not signed in. Auth is verified *before* body parsing, so an invalid `appId` still
  returns `401` rather than `400`.
- **400** — body failed the Zod schema; `issues` carries the field-level detail.
- **403** — `permissionError: true`. Either the Azure Monitor query returned an
  `InsufficientAccessError`, or the caller can see the component but not the workspace behind it.
  The latter is detected by `AppInsightsAccessError`, which exists because Azure Monitor returns
  HTTP 200 and *silently drops* unreadable rows — indistinguishable from an empty result without it.
- **`partialAccess`** — the query succeeded but some tables were withheld; the UI surfaces the
  dropped table names rather than showing a misleadingly small number.
- **405** — only `POST` is exported.

## Surfaced in the UI

`src/app/power-platform/copilot-studio/tool-call-report/ToolCallReportClient.tsx`

| Section | Source field | Answers |
|---|---|---|
| KPI row | `summary` | Volume, distinct tools, failure rate, P95 latency |
| Tool calls over time | `daily` | Trend, with success/failure split |
| Calls by tool type | `toolTypes` | Connector vs MCP vs flow mix |
| Most-called tools | `toolLeaderboard` | Which connectors dominate |
| When tools are called | `heatmap` | Day-of-week × hour-of-day load |
| **Agent → tool usage** | `agentTool` | **The core report**: every agent/tool pair, first and last call |
| Recent tool calls | `recent` | Individual invocations for spot-checking |

The agent→tool matrix and the recent-calls table both export to CSV.

## Related

- [Copilot Studio Agent Usage — How It's Calculated](./copilot-studio-usage-calculation.md) — transcript-derived usage metrics and the full telemetry source map
- [Copilot Studio & Agent Builder Credit Consumption](./copilot-agent-credit-consumption.md) — credit-grained runtime consumption
- [Copilot Agent Kit integration](./copilot-agent-kit-integration.md) — design-time agent quality review
