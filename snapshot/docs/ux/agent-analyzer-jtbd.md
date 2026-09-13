# Agent Analyzer — Jobs-to-be-Done

> UX research for a new **Analyzer** tab on the Copilot Studio agent detail page
> (`/power-platform/copilot-studio/[agentId]`).
>
> Inspired by the MIT-licensed [`mcs-modern-agent-analyser`](https://github.com/russrimm/mcs-modern-agent-analyser)
> (Python/Reflex). Heuristics ported to TypeScript so we can run them inside the BFF —
> no LLM, no data leaves the tenant, no second runtime.

---

## Assumptions to confirm

These drove the artifacts; flag any that are wrong:

- Primary persona is a **Copilot Studio maker / admin** who owns one or more modern agents
  (`cliagent` template — instructions + knowledge + tools, no topics/orchestrator).
- The user has already landed on `/power-platform/copilot-studio/[agentId]` — Analyzer is a
  new tab, not a new destination. They are not hunting for an agent, they are
  investigating one they know.
- The two inputs the heuristics need are already in the app:
  - **BotDefinition YAML** — fetched by `/api/power-platform/copilot-studio/bot-config`
    and `/api/power-platform/copilot-studio/components`
  - **Transcript JSON** — fetched by [TranscriptsPanel.tsx](../../src/app/power-platform/environments/modals/components/TranscriptsPanel.tsx)
- We will **not** support classic topic-based bots in v1 — feature-detect the template and
  hide/disable the tab with a clear "modern agents only" empty state.
- The user is willing to pick **one transcript at a time** in v1. Batch / trend analysis
  across many conversations is a v2 concern.
- Existing panels stay authoritative for what they already do — Analyzer complements them,
  it does not replace:
  - [InstructionsAnalysisPanel.tsx](../../src/app/components/InstructionsAnalysisPanel.tsx)
    → prompt quality (LLM-graded)
  - [AgentComponentsPanel.tsx](../../src/app/power-platform/copilot-studio/[agentId]/components/AgentComponentsPanel.tsx)
    → component inventory
  - [AppInsightsTelemetryPanel.tsx](../../src/app/power-platform/copilot-studio/[agentId]/components/AppInsightsTelemetryPanel.tsx)
    → production telemetry

---

## Personas

### P1 — Agent Maker (primary)

- Builds and iterates modern Copilot Studio agents day-to-day.
- Comfortable in the Copilot Studio authoring canvas, less comfortable in App Insights.
- Debugs by chatting in the test pane, then wondering "why did it do *that*?".
- Success metric: shorter loop between "agent misbehaved" and "I know which knowledge
  source / tool / instruction to fix".

### P2 — Power Platform Admin (secondary)

- Reviews agents built by others before publish / renewal.
- Wants a quick "is this agent healthy?" verdict without opening the authoring canvas.
- Cares about hidden failures, undeclared tools, ungrounded answers — governance signals.

Not in scope for v1: end users of the agent, security reviewers, finance (Copilot Credit
estimate is a nice-to-have surfaced value, not a persona driver).

---

## Job statements

### Job 1 — Diagnose a single misbehaving conversation (P1, primary)

> **When** a tester or user tells me the agent gave a wrong / weird / empty answer,
> **I want to** see exactly which knowledge source, tool call, or reasoning step went
> sideways in that specific conversation,
> **so I can** change the instruction, knowledge, or tool config with confidence — not
> guess and re-test.

**Current solution & pain points**
- Current: Read the raw transcript JSON manually. Cross-reference against the
  BotDefinition YAML by scrolling. Open App Insights and try to correlate.
- Pain: Modern transcripts have no timestamps; `toolCalls` and `thoughts` are nested and
  noisy; a `completed` status can still hide a failure; citations are numeric refs the
  YAML doesn't name the same way.
- Consequence: The loop takes 20–60 min per incident. Makers give up and just tweak the
  instruction, which often doesn't fix the root cause.

### Job 2 — Sanity-check an agent build before publishing (P2, secondary)

> **When** I'm about to publish or hand off a modern agent,
> **I want to** see quick-win findings (unused knowledge sources, undeclared tools,
> ungrounded answers, over-retrieval, skill-gap fallbacks),
> **so I can** fix the obvious issues before real users hit them.

**Current solution & pain points**
- Current: Manual code-review of the YAML plus a few test-pane conversations.
- Pain: Easy to miss "knowledge source added but never searched", "tool called but not
  declared", "answer with a `[1]` citation whose source doesn't exist".
- Consequence: Bugs surface in production and show up as complaints or App Insights
  errors instead of being caught pre-publish.

### Job 3 — Estimate the Copilot Credit cost of a conversation (P1/P2, tertiary)

> **When** I'm designing an agent that will run at scale,
> **I want to** see a heuristic per-conversation credit estimate,
> **so I can** trade design choices (more searches vs. more tool calls vs. bigger
> knowledge base) against cost before rollout.

**Current solution & pain points**
- Current: Read the [official billing docs](https://learn.microsoft.com/microsoft-copilot-studio/requirements-messages-management)
  and try to count events by hand.
- Pain: Tedious, error-prone, no per-conversation breakdown.
- Consequence: Cost surprises after rollout.

---

## What we deliberately do **not** try to do in v1

- **Multi-conversation trend analysis** — v2. Would need aggregation UI and a bigger
  transcript picker.
- **Classic (topic-based) agent analysis** — separate tool, different transcript shape,
  different heuristics. Feature-detect and hide.
- **LLM-graded conversation quality** — the upstream tool is deterministic-heuristic on
  purpose; we preserve that. Prompt-quality LLM analysis stays in the existing
  `InstructionsAnalysisPanel`.
- **Editing the agent from the report** — read-only. Fixes happen in Copilot Studio
  authoring canvas (deep-link out).
- **Replacing App Insights** — production telemetry stays in `AppInsightsTelemetryPanel`.
  Analyzer works on one transcript at a time from the test canvas or a downloaded
  conversation.

---

## Success metrics

- **Time-to-diagnose (Job 1)**: median time from opening Analyzer to identifying the
  root cause drops from ~30 min (manual) to **< 5 min**.
- **Pre-publish catch rate (Job 2)**: at least 1 severity-tagged finding surfaced on
  ≥ 60 % of agents on first analysis.
- **Adoption**: Analyzer tab opened on ≥ 30 % of agent detail-page visits by makers
  within 30 days of launch.
- **Trust**: zero false-positive "hidden failure" findings reported in the first month
  (heuristic precision matters more than recall — we can miss things, we cannot cry wolf).

---

## Open questions for stakeholders

1. Do we pull transcripts from the existing Transcripts panel data source, or do we also
   let the user drag-drop a `conversation-details.json` they exported from the test pane?
   (Recommendation: **both** — file drop is the escape hatch when the API doesn't have
   the specific conversation.)
2. Where does the Copilot Credit estimate live — inside Analyzer only, or also surfaced
   as a tile on the existing Analytics tab?
3. Is there appetite for a "compare two conversations" view in v2, or is the priority
   multi-conversation aggregation?
