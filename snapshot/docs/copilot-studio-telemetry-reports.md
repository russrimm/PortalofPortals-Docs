# Copilot Studio telemetry reports

The **Application Insights Telemetry** panel on an agent's detail page
(`/power-platform/copilot-studio/[agentId]`) runs a catalog of prepared KQL
reports against that agent's own Application Insights resource, plus a
free-form Custom KQL box.

- Catalog: [`src/lib/copilot-studio/telemetryQueries.ts`](../src/lib/copilot-studio/telemetryQueries.ts)
- Panel: [`AppInsightsTelemetryPanel.tsx`](../src/app/power-platform/copilot-studio/[agentId]/components/AppInsightsTelemetryPanel.tsx)
- Route: `POST /api/power-platform/copilot-studio/agents/[botId]/appinsights-telemetry`
- Attribution and upstream mapping: [`TELEMETRY-QUERIES-NOTICE`](../src/lib/copilot-studio/TELEMETRY-QUERIES-NOTICE)

## Prerequisites

The agent must have an Application Insights connection string configured
(**Settings → Advanced → Application Insights** in Copilot Studio, or the
beaker button on the agent card in the portal). The signed-in user needs
**Reader** or **Monitoring Reader** on both the Application Insights component
and the Log Analytics workspace behind it — queries run as the user, never as
the service principal.

Two agent settings change what several reports can show:

| Setting | Reports affected if disabled |
| --- | --- |
| **Enable logging** | Everything — no custom events are emitted at all |
| **Log conversation details** | User Message Patterns, the text-rate column in Conversation Quality, and the message-length column in Daily Activity Breakdown |

## Report catalog

| Category | Report | Table |
| --- | --- | --- |
| Usage | Daily Conversations | `customEvents` |
| Usage | Unique Users per Day | `customEvents` |
| Usage | Message Volume | `customEvents` |
| Usage | Daily Activity Breakdown | `customEvents` |
| Usage | Peak Usage Hours | `customEvents` |
| Usage | User Retention Mix | `customEvents` |
| Usage | Channel Breakdown | `customEvents` |
| Usage | Locale Breakdown | `customEvents` |
| Usage | Agent Instance Comparison | `customEvents` |
| Engagement | Top Topics | `customEvents` |
| Engagement | Topic Completion Rates | `customEvents` |
| Engagement | Escalations to Human | `customEvents` |
| Engagement | Generative Answers | `customEvents` |
| Engagement | Unanswered Questions | `customEvents` |
| Engagement | User Engagement Levels | `customEvents` |
| Engagement | Conversation Length Distribution | `customEvents` |
| Quality | Conversation Quality | `customEvents` |
| Quality | Failure Events per Day | `customEvents` |
| Quality | Failure Event Breakdown | `customEvents` |
| Quality | Top Exceptions | `exceptions` |
| Performance | Response Latency Percentiles | `dependencies` |
| Performance | Latency by Operation | `dependencies` |
| Dependencies & Tools | Dependency Health | `dependencies` |
| Dependencies & Tools | Slowest Dependency Calls | `dependencies` |
| Dependencies & Tools | Dependency Failures | `dependencies` |
| Advanced | Conversation Flow Transitions | `customEvents` |
| Advanced | User Message Patterns | `customEvents` |
| Alerts | Alert: Error Rate Spikes | `exceptions` |
| Alerts | Alert: Activity Drops | `customEvents` |
| Alerts | Alert: Dependency Failure Rate | `dependencies` |
| Custom | Custom KQL | any |

## Adapting the upstream queries

Most of the catalog is adapted from
[GuenterS/copilotadvandcedanalytics](https://github.com/GuenterS/copilotadvandcedanalytics/tree/main/CopilotStudio-KQL)
(MIT). The queries could not be used verbatim. Each change below is a
correctness or compatibility fix, not a style preference.

### `render` clauses removed

Upstream ends several queries with `| render timechart`. The panel charts with
Recharts and reads `tables[0]` from the Azure Monitor response, so a render
directive is at best ignored and at worst returns a second table. All charting
is declared in the catalog's `chartType`/`valueKeys` instead.

### Hard-coded time ranges replaced

Upstream pins `ago(14d)`, `ago(7d)`, `ago(30d)` or `ago(1h)` per file. Every
report here is a `(days: number) => string` so the panel's 7/30/90-day picker
actually changes the query. A unit test asserts this for every report.

### `cloud_RoleName == "Microsoft Copilot Studio"` dropped

Upstream filters `dependencies` and `exceptions` on that literal. It isn't in
Microsoft's
[dependencies field reference](https://learn.microsoft.com/microsoft-copilot-studio/advanced-environment-level-agent-telemetry)
for Copilot Studio, and the filter returns nothing on a real resource. It is
also unnecessary here: the route resolves the agent's own Application Insights
resource, so the data is already agent-scoped.

### `customDimensions['message']` corrected to `text`

Upstream reads message bodies from a `message` dimension. Copilot Studio
[documents `text`](https://learn.microsoft.com/microsoft-copilot-studio/advanced-bot-framework-composer-capture-telemetry);
`Message` (capitalized) appears only on the `GenerativeAnswers` event. Reading
`message` yields empty strings, which silently turns every derived metric —
average length, word count, text completion rate — into zero. The catalog
coalesces `text` and `Message`.

### Test-canvas filter made case-insensitive

The portal previously used `| where isDesignMode != "True"`, which is
case-sensitive and lets a lowercase `"true"` through. The catalog now uses
upstream's tolerant form, which also keeps rows where the dimension is absent
so agents that don't stamp it aren't reported as having zero traffic:

```kusto
| extend isDesignMode = tostring(customDimensions["designMode"])
| where isempty(isDesignMode) or tolower(isDesignMode) != "true"
```

### Topic events matched for both agent generations

Modern Copilot Studio agents emit `TopicStart`/`TopicEnd` with a `TopicName`
dimension. Classic Bot Framework agents emit
`DialogStart`/`DialogComplete`/`DialogCancel`/`DialogFail` with `dialogName`.
The portal previously matched only the classic names, so topic reports were
empty for modern agents. Every topic report now matches both and coalesces the
label.

### Alert windows re-based on the selected range

Upstream's alerts are point-in-time checks (`ago(1h)` against a 24-hour
baseline) meant for an Azure Monitor alert rule. The panel is an investigation
surface with a 7/30/90-day picker, so they are expressed as "show me the
windows that breached" over the selected range: hourly exception spikes, days
whose volume fell more than 50% below the period average, and dependencies over
a 20% failure rate. The thresholds are unchanged.

### Division guarded

Every rate is wrapped in `iff(denominator > 0, …, 0.0)` so an empty bucket
yields `0` rather than `NaN`, which the results table would render as a blank.

### Near-duplicates merged

Three upstream files group by `cloud_RoleInstance` (`01-Usage-Metrics/06`,
`04-Agent-Evaluation/03`, `06-Advanced-Analytics/03`); they are one report,
**Agent Instance Comparison**. `02-Performance-Metrics/02` and
`05-Dependencies/02` are the same slow-call query at different thresholds; they
are **Slowest Dependency Calls**. `01-Usage-Metrics/03` and
`04-Agent-Evaluation/01` are the same daily rollup; they are **Daily Activity
Breakdown**. The full file-to-report mapping is in the `NOTICE`.

Two upstream filenames also describe something their query doesn't do:
`06-channel-distribution` and `03-locale-analysis` both group by agent instance
rather than by channel or locale. **Channel Breakdown** (by `channelId`) and
**Locale Breakdown** (by `locale`) do what those names imply.

## Verification

`tests/unit/lib/copilot-studio/telemetryQueries.test.ts` covers the couplings
that fail silently — a report whose KQL emits `P95` while the chart reads
`P95Ms` renders an empty chart with no error. It asserts that every `xKey` and
`valueKeys[].key` appears in the generated query, that the time range is
honored, that no report emits a `render` clause, and that the designMode filter
is the tolerant form.

```bash
pnpm exec vitest run tests/unit/lib/copilot-studio/telemetryQueries.test.ts
```

The catalog was also executed end to end against two live Application Insights
resources — one with Copilot Studio custom events, one with dependency and
exception data — and all 31 reports returned a single well-formed table.
