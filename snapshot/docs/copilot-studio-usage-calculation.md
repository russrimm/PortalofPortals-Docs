# Copilot Studio Agent Usage — How It's Calculated

This document explains exactly how individual Copilot Studio agent usage metrics are computed in Portal 360°, including the Dataverse tables queried, the math applied, and how the results are surfaced in the UI.

> **Scope:** this document covers the **conversation-transcript** path (source 3 in the map below). For the full picture of what Copilot Studio telemetry exists and which portal feature consumes it, start with the source map immediately below.

---

## Telemetry Source Map — what's available where

Copilot Studio scatters its telemetry across six surfaces with very different shapes, retention, and permission models. They are **not** interchangeable, and five of the six cannot answer "which connector did this agent call, and when".

| # | Source | Lives in | Granularity | Has timestamps? | Carries tool/connector identity? | Portal feature built on it |
|---|---|---|---|---|---|---|
| 1 | `microsoft.copilotstudio/agents` | Power Platform Inventory API | Agent | Last-used only | No | Agent list, [credit consumption](./copilot-agent-credit-consumption.md) |
| 2 | `bots`, `botcomponents`, `connectionreferences` | Dataverse | Agent + component | **No — design-time** | Configured only, never invoked | Agent Connector Report, Agent Review |
| 3 | `conversationtranscripts` | Dataverse | Conversation | Yes (`createdon`) | Not for classic activities | **This document**, User Prompt Report, transcript viewer |
| 4 | `msdyn_aievent` | Dataverse | Credit event | Yes (`msdyn_processingdate`) | No — model/automation grained | [Credit Events](./copilot-agent-credit-consumption.md) |
| 5 | Agent-level telemetry → `customEvents` | Application Insights | Message / topic event | Yes | **No** | Copilot Studio Dashboard |
| 6 | Environment-level telemetry → `dependencies` | Application Insights | OTel span | Yes | **Yes** | [Tool & Connector Call Report](./copilot-studio-tool-call-report.md) |

### The distinction that matters most

Sources 5 and 6 are both "Application Insights", and the product docs present them as siblings. They are not:

| | Agent-level telemetry | Environment-level telemetry (preview) |
|---|---|---|
| Configured on | Each agent individually | The environment (must be **managed**) |
| Primary table | `customEvents` | `dependencies` |
| Telemetry model | Event-based | OpenTelemetry trace/span |
| Scope | One agent | Every agent in the environment |
| Tool / connector identity | **Absent** | `gen_ai.tool.name`, `gen_ai.tool.type` |

If only agent-level telemetry is enabled, no amount of querying will produce connector-call data. Only environment-level export emits the `ExecuteTool` spans that carry it.

### Runtime vs design-time — a common trap

Source 2 produces a clean agent→connector table by joining `botcomponents` to `connectionreferences`, and it is tempting to treat that as connector usage. It is not: it describes what an agent is **configured** to reach for and carries no timestamps at all. It cannot distinguish a connector invoked ten thousand times from one that has never fired once.

Pairing the two answers the governance question neither can answer alone:

```
source 2 (configured)  MINUS  source 6 (actually called)  =  dead connector bindings
source 6 (actually called)  MINUS  source 2 (configured)  =  tools reached outside connection references
```

### Where each is implemented

| Source | Route | Server logic |
|---|---|---|
| 1 | `/api/power-platform/copilot-studio/agents` | inline (inventory resourcequery) |
| 2 | `/api/power-platform/dataverse/agent-connector-report` | `src/lib/power-platform/agent-connection-refs.ts` |
| 3 | `/api/power-platform/copilot-studio/analytics` | `src/lib/power-platform/agentAnalytics.ts` |
| 4 | `/api/power-platform/copilot-studio/ai-events` | inline |
| 5 | `/api/power-platform/copilot-studio/dashboard-telemetry` | `src/lib/appInsightsQuery.ts` |
| 6 | `/api/power-platform/copilot-studio/tool-call-report` | `src/lib/copilot-studio/toolCallReport.ts` |

---

## Architecture Overview

```
Browser (Next.js client)
  └─► GET /api/power-platform/copilot-studio/agents      → inventory master list + Dataverse-enriched 30-day counts
  └─► POST /api/power-platform/copilot-studio/analytics  → deep analytics for one agent

Route handlers (server-side)
  └─► Power Platform Inventory API (resourcequery) → canonical `microsoft.copilotstudio/agents` rows
  └─► Power Platform BAP API                        → environment display name + Dataverse instance URL
  └─► Dataverse Web API                             → best-effort enrichment from bots + conversationtranscripts

agentAnalytics.ts (server-side lib)
  └─► Parses Bot Framework Activity JSON from each transcript
  └─► Derives all KPIs, distributions, and citations
  └─► Runs rule-based recommendations engine
```

---

## Data Sources

### 1. Power Platform Inventory API (`microsoft.copilotstudio/agents`)

The `/api/power-platform/copilot-studio/agents` route now uses inventory as its
source of truth so list counts align with `/power-platform/inventory-reports`.

**Resource Query target:**
```
POST https://api.powerplatform.com/resourcequery/resources/query?api-version=2024-10-01
```

**Type filter:**
```
type == 'microsoft.copilotstudio/agents'
```

**Key fields used:**
- Agent identity: `name` (CDS bot ID), `properties.displayName`
- Environment context: `properties.environmentId`
- Classification/config: `properties.isCLIAgent`, `properties.orchestration`, `properties.model`, `properties.authentication`, `properties.channels`
- Governance metadata: sharing counts, quarantine flags, Entra IDs, connector capability counts
- Last-used enrichment via `microsoft.powerplatformusage/usages` left-outer join

### 2. Dataverse `bots` (best-effort enrichment)

After loading the inventory master set, the route queries Dataverse per
environment to enrich rows with bot metadata when delegated access is available.

**OData URL template:**
```
{instanceUrl}/api/data/v9.2/bots
  ?$select=botid,name,schemaname,runtimeprovider,publishedon,statecode,statuscode,createdon,modifiedon
  &$orderby=name asc
```

---

### 3. Dataverse `conversationtranscripts`

Queried in two places with different fields.

#### 2a. 30-day count + 7-day sparkline (agent list)

**OData URL:**
```
{instanceUrl}/api/data/v9.2/conversationtranscripts
  ?$select=_bot_conversationtranscriptid_value,conversationtranscriptid,createdon
  &$filter=createdon ge {30-day ISO cutoff}
  &$top=5000
```

**Fields used:**

| Column | Use |
|---|---|
| `_bot_conversationtranscriptid_value` | Foreign key linking transcript to a bot (agent) |
| `createdon` | Used to count per-agent volume and build the 7-day sparkline |

**Math:**
- All transcripts from the last 30 days (capped at 5,000 rows) are fetched in a single call per environment.
- They are bucketed in memory by `_bot_conversationtranscriptid_value`.
- `transcriptCount30d` = count of rows matching a given bot's ID.
- `transcriptsByDay` = 7-element array (index 0 = 6 days ago, index 6 = today):
  ```
  daysAgo = floor((now - createdon) / 86400000)
  bins[6 - daysAgo]++   // if 0 ≤ daysAgo < 7
  ```

---

#### 2b. Deep analytics (agent detail page)

**OData URL:**
```
{instanceUrl}/api/data/v9.2/conversationtranscripts
  ?$select=conversationtranscriptid,createdon,content
  &$filter=_bot_conversationtranscriptid_value eq {botId} and createdon ge {cutoff}
  &$orderby=createdon desc
  &$top=500
```

**Fields used:**

| Column | Use |
|---|---|
| `conversationtranscriptid` | Transcript identity (used for deduplication in citation aggregation) |
| `createdon` | Timestamp used for date grouping, 7d/30d window classification, hourly distribution |
| `content` | Raw JSON payload of Bot Framework activities — all KPIs are derived from this |

> **Cap:** 500 transcripts per request. If the agent has more than 500 sessions in the window, the UI shows a warning banner and calculations are based on the 500 most recent.

---

## The `content` Field — Bot Framework Activity JSON

Each transcript's `content` is a JSON blob containing an array of Bot Framework Activity objects. The portal handles three wire formats emitted by different Copilot Studio runtime versions:

| Format | Structure |
|---|---|
| A | Direct array: `[{type,from,text,...}, ...]` |
| A2 | Object with activities key: `{activities: [...]}` |
| B | Double-encoded: `{text: "<json string with {activities:[...]}>"}` |

Each activity has:
- `type`: `"message"`, `"event"`, `"conversationUpdate"`, etc. — only `"message"` activities with non-empty `text` are counted.
- `from.role`: Identifies who sent the message.  
  - User: `"user"` or `1`  
  - Bot: `"bot"`, `0`, or `"channel"`
- `timestamp`: ISO 8601 string or Unix epoch seconds (both formats are handled).
- `channelData.citations[]`, `entities[]`, `attachments[]`: Gen-AI citation data (see below).

---

## Session-Level Calculations

Each transcript = one session. The `analyzeSession()` function processes a single transcript:

### Duration

```
durationSeconds = (lastTimestamp - firstTimestamp) / 1000
```

Where `firstTimestamp` and `lastTimestamp` are the earliest and latest timestamps across all `message` type activities in the transcript. Sessions with no parseable timestamps get `durationSeconds = 0` and are excluded from the duration average.

### Outcome Classification

| Condition | Outcome |
|---|---|
| `userMessageCount ≤ 1` AND `botMessageCount === 0` | `unengaged` |
| `botMessageCount === 0` (user sent messages but bot never replied) | `abandoned` |
| Bot replied after the last user message | `resolved` |
| Bot replied but the conversation ended with a user message | `abandoned` |

The "resolved" check:
```
lastUserIdx = last index in messages[] where isUserRole(message) is true
hasReplyAfterLastUser = lastUserIdx >= 0 AND lastUserIdx < messages.length - 1
```

### Bot Response Time

For every consecutive user→bot message pair:
```
responseTimes.push((nextBotTimestamp - userTimestamp) / 1000)
```

Pairs where `delta < 0` or `delta ≥ 600s` are discarded (likely clock skew or the bot activity was unrelated).

### Depth Bucket

Based on the number of user messages in the session:

| Bucket label | User message range |
|---|---|
| `1-2` | 1–2 |
| `3-5` | 3–5 |
| `6-10` | 6–10 |
| `11-20` | 11–20 |
| `20+` | 21+ |

---

## Aggregate KPIs (across all transcripts)

Computed by `deriveAnalytics()` in `src/lib/power-platform/agentAnalytics.ts`.

### Volume

| Metric | Formula |
|---|---|
| `totalSessions` | `transcripts.length` |
| `sessionsLast7Days` | Sessions where `now - createdon ≤ 7 days` |
| `sessionsLast30Days` | Sessions where `now - createdon ≤ 30 days` |
| `sessionsChange` | `((sessionsLast7Days - sessionsPrev7Days) / sessionsPrev7Days) × 100` — the "previous 7 days" is the 7-day window immediately before the current 7 days |

### Quality

| Metric | Formula |
|---|---|
| `successRate` | `(sessionsWithAtLeastOneBotReply / totalSessions) × 100` |
| `successRateChange` | `rateLast7d - ratePrev7d` (percentage-point delta, not ratio) |
| `engagementRate` | `(sessionsWhereUserSent≥2Messages / totalSessions) × 100` |

### Performance

| Metric | Formula |
|---|---|
| `avgDurationSeconds` | `sum(session.durationSeconds for sessions where duration > 0) / count(sessions where duration > 0)` |
| `durationChange` | `((avgDurLast7 - avgDurPrev7) / avgDurPrev7) × 100` |
| `avgResponseTimeSeconds` | `sum(all responseTimes across all sessions) / count(all responseTimes)` |

### Distributions

| Metric | How it's built |
|---|---|
| `byDate` | Per-`YYYY-MM-DD` count of sessions + successful/failed split |
| `outcomesByDate` | Per-`YYYY-MM-DD` count of resolved / abandoned / unengaged |
| `hourlyDistribution` | 24-bucket array keyed by `createdon.getHours()` (UTC) |
| `depthDistribution` | Sessions bucketed by depth bucket label |
| `responseTimeByDate` | Per-day average: `sum(responseTimes for day) / count(responseTimes for day)` |
| `lastActivity` | `createdon` of the most recent transcript |

---

## Gen-AI Citation Tracking

When an agent uses Generative Answers (Generative AI runtime), it cites its knowledge sources. The portal extracts and ranks these citations from bot message activities.

### Three extraction formats

**Format 1 — `channelData.citations[]`** (primary, newer runtime):
```json
{
  "channelData": {
    "citations": [
      { "title": "Source Name", "url": "https://...", "contentTitle": "..." }
    ]
  }
}
```

**Format 2 — `entities[]`** (older Bot Framework citation entity):
```json
{
  "entities": [
    { "type": "citation", "name": "Source Name", "url": "https://..." }
  ]
}
```

**Format 3 — Adaptive card `FactSet`** (legacy citation cards):
```json
{
  "attachments": [{
    "contentType": "application/vnd.microsoft.card.adaptive",
    "content": {
      "body": [{ "type": "FactSet", "facts": [{ "title": "Source Name" }] }]
    }
  }]
}
```

### Citation aggregation

Citations are deduplicated using a key = `URL.trim().toLowerCase()` when a URL is present, or `title.trim().toLowerCase()` otherwise.

```
for each transcript:
  for each citation found in bot messages:
    key = url ?? title (normalized)
    citationMap[key].count++       // total times cited across all sessions
    if key not seen yet in this transcript:
      citationMap[key].sessionCount++   // distinct sessions referencing this source
```

Results are sorted by `count` descending. The UI shows the top 15 sources.

---

## Recommendations Engine

`getRecommendations()` applies rule-based thresholds to the computed KPIs and returns a prioritized list of `Recommendation` objects.

| Condition | Severity | Title |
|---|---|---|
| `successRate < 50%` | critical | Low resolution rate |
| `successRate < 75%` | warning | Resolution rate could improve |
| `successRate ≥ 90%` | success | Excellent resolution rate |
| `abandonRate > 30%` | critical | High abandonment rate |
| `abandonRate > 15%` | warning | Moderate abandonment |
| `unengagedRate > 40%` | warning | Many unengaged sessions |
| `engagementRate < 40%` | warning | Low engagement rate |
| `engagementRate ≥ 80%` | success | Strong engagement |
| `avgResponseTimeSeconds > 30` | critical | Slow response time |
| `avgResponseTimeSeconds > 10` | warning | Response time above ideal |
| `avgResponseTimeSeconds ≤ 3` (and > 0) | success | Fast response time |
| `shortSessionRate > 60%` (1-2 msg sessions) | warning | Most sessions are very short |
| `sessionsChange < -30%` | warning | Declining usage |
| `sessionsChange > 50%` | info | Strong growth |
| Peak usage hour (always emitted) | info | Peak usage at HH AM/PM |

Where:
```
abandonRate     = (outcomes.abandoned / total) × 100
unengagedRate   = (outcomes.unengaged / total) × 100
shortSessionRate = (depthDistribution['1-2'].count / totalSessions) × 100
```

---

## How It's Surfaced in the Portal

### 1. Agent List — `/power-platform/copilot-studio`

**File:** `src/app/power-platform/copilot-studio/CopilotStudioDashboard.tsx`

Summary statistics shown at the top of the page:

| Pill | Value |
|---|---|
| Total agents | `agents.length` |
| Active | `agents.filter(a => a.statecode === 0).length` |
| Conversations · 30d | `sum(agent.transcriptCount30d)` across all agents |

> Note: The "Conversations · 30d" label is accompanied by a sparkline that is currently built from `modifiedon` timestamps as a proxy, not from `transcriptsByDay`. The per-agent cards use `transcriptsByDay` (the accurate 7-day bucketed data).

**Per-agent card** (`AgentCard.tsx`):
- Agent name, schema name, Active/Inactive badge
- Runtime type pill (Classic / Generative)
- 7-day sparkline (SVG polyline) from `transcriptsByDay`
- 30-day session count from `transcriptCount30d`
- Last modified date

Clicking a card navigates to `/power-platform/copilot-studio/[agentId]`.

---

### 2. Agent Detail Page — `/power-platform/copilot-studio/[agentId]`

**File:** `src/app/power-platform/copilot-studio/[agentId]/page.tsx`

Three tabs: **Analytics**, **Components**, **Transcripts**.

#### Analytics tab

Powered by `AgentAnalyticsPanel.tsx` (Recharts). Default window: 30 days.

**KPI cards (top row):**

| Card | Value | Delta label |
|---|---|---|
| Total sessions | `analytics.totalSessions` | `sessionsChange`% vs prior period |
| Resolution rate | `(outcomes.resolved / totalSessions) × 100` formatted as `XX.X%` | `successRateChange` pp vs prior period |
| Abandon rate | `(outcomes.abandoned / totalSessions) × 100` formatted as `XX.X%` | none |
| Avg duration | `avgDurationSeconds` formatted as `Xm Ys` | `durationChange`% vs prior period |
| Avg response | `avgResponseTimeSeconds` formatted as `X.Xs` | none |

**Charts:**

| Chart | Type | X-axis | Y-axis / series |
|---|---|---|---|
| Conversation outcomes · 30 days | Stacked area | Date (MM-DD) | Resolved / Abandoned / Unengaged counts |
| Outcome split | Donut pie | — | Resolved / Abandoned / Unengaged % |
| Conversation depth (messages) | Bar | Depth bucket | Session count |
| Peak hours (UTC) | Bar | Hour (0:00–23:00) | Session count |
| Response time trend | Line | Date (MM-DD) | Avg seconds |
| Gen-AI citations · top sources | Horizontal bar list | Source title / URL | Citation count + session count |

**Recommendations** are displayed above the KPI cards when present, as colored alert cards (🔴 critical, 🟡 warning, 🔵 info, 🟢 success).

#### Transcripts tab

Renders raw transcript content via `TranscriptsPanel`. This is a read-only view of the underlying `conversationtranscripts` rows.

#### Components tab

Renders agent component metadata via `AgentComponentsPanel` (topics, entities, etc. from the Dataverse `botcomponents` table — outside the scope of usage calculation).

---

## Caching

| Layer | TTL | Scope |
|---|---|---|
| Agent list (`/api/power-platform/copilot-studio/agents`) | 10 minutes | In-process Map, keyed by `instanceUrl` |
| Analytics (`/api/power-platform/copilot-studio/analytics`) | 5 minutes | Server-side LRU cache (`cache5min`), keyed by `instanceUrl:botId:windowDays` |

Both caches are cleared on server restart.

---

## Authentication

Inventory calls use a **delegated** Power Platform token (OBO) so tenant admin
inventory access is evaluated against the signed-in admin's directory role.

Dataverse enrichment also uses delegated per-user token acquisition.

BAP environment enumeration uses app credentials with scope
`https://api.bap.microsoft.com/.default`.

All API routes enforce `verifyAuth()` (NextAuth session check) before any Dataverse calls are made.

---

## File Map

| File | Purpose |
|---|---|
| `src/app/api/power-platform/copilot-studio/agents/route.ts` | Fetches inventory master list, then enriches with Dataverse bot/transcript data (best-effort) |
| `src/app/api/power-platform/copilot-studio/analytics/route.ts` | Fetches transcripts for one agent and calls `deriveAnalytics` |
| `src/lib/power-platform/agentAnalytics.ts` | All KPI math, citation parsing, and recommendations engine |
| `src/types/agentAnalytics.ts` | TypeScript interfaces for `AgentAnalytics`, `SessionMeta`, `CitationStat`, etc. |
| `src/app/power-platform/copilot-studio/CopilotStudioDashboard.tsx` | Agent list page with summary pills and sparkline cards |
| `src/app/power-platform/copilot-studio/components/AgentCard.tsx` | Individual agent card with 7-day sparkline |
| `src/app/power-platform/copilot-studio/[agentId]/page.tsx` | Agent detail page with tabs and analytics fetch |
| `src/app/power-platform/copilot-studio/[agentId]/components/AgentAnalyticsPanel.tsx` | All Recharts visualisations and KPI cards |
