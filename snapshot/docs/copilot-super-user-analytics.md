# Copilot Super User Analytics

Portal 360 implementation of Microsoft's
[DecodingSuperUsage](https://github.com/microsoft/DecodingSuperUsage) toolkit — a
Power BI + Viva Insights template for identifying Microsoft 365 Copilot "super users",
understanding what they do differently, and turning that into repeatable enablement.

**Route:** `/microsoft365/copilot/super-users`

---

## Why this exists

DecodingSuperUsage ships as a Power BI template that requires a Viva Insights Person
Query. That excludes any tenant without the right Viva licensing, and it lives outside the
admin's day-to-day tooling. This implementation delivers the same analytical story inside
Portal 360, with Viva as an *optional* enrichment rather than a hard prerequisite.

## Two-tier data strategy

| Tier | Source | Availability | Unlocks |
|---|---|---|---|
| **1 — Graph proxy** | `getMicrosoft365CopilotUsageUserDetail` (beta) + Entra ID `/users` | Always | Tier distribution, adoption funnel, surface mix, breadth, org × function concentration, action lists |
| **2 — Viva native** | Viva Insights Person Query CSV, uploaded by an admin | Optional | Everything above, plus true weekly cadence tiering, journey over time, time-to-super, durability cohorts, work-pattern comparison |

Every visual carries a provenance badge (`Graph` / `Viva` / `Blended`) and degrades
gracefully. Viva-only tabs render an explicit call-to-action instead of an empty chart.

### Why the CSV upload

Viva Insights Person Query has **no public REST API**. The only supported programmatic
paths are the proprietary Power BI connector (Partition ID + Query ID) and CSV export from
the Analyst Workbench. This mirrors DecodingSuperUsage's own documented "Option 1: CSV
Import" path. Partition ID and Query ID can be recorded alongside an upload for
traceability but are not used to fetch anything.

### The Graph limitation that shapes everything

`getMicrosoft365CopilotUsageUserDetail` returns only a **last activity date per surface** —
never a frequency or a count. So the Graph-proxy tier model infers habit from:

- **Breadth** — how many of the eight Copilot surfaces were touched inside the recency
  window (default 28 days)
- **Recency** — how long ago the most recent activity was

The Viva-native model replaces that inference with the real thing: active days per week and
actions per week, with a super week defined as ≥ 3 active days and ≥ 15 actions, and a
super *user* defined as someone hitting super weeks in ≥ 60 % of observed weeks. Both
models are described in the UI so nobody mistakes a proxy for a measurement.

## Tier model

| Tier | Graph proxy | Viva native |
|---|---|---|
| Dormant | Licensed, no activity in window | No active weeks |
| Novice | 1 surface, low recency | Occasional activity |
| Explorer | 2 surfaces | Regular but sub-threshold weeks |
| Habitual | ≥ 3 surfaces, recent | Some super weeks |
| Power | ≥ 4 surfaces, recent | Frequent super weeks |
| Super | ≥ 5 surfaces, recent | Super weeks in ≥ 60 % of observed weeks |

Thresholds are tunable from the page header (recency window, super breadth, privacy floor)
and passed through as query parameters, so a tenant can calibrate the model to its own
adoption curve without a code change.

## Tabs

1. **Executive summary** — KPI strip, auto-generated narrative insights, adoption funnel,
   tier distribution, surface radar
2. **Super user profile** — surface mix with lift versus everyone else, breadth histogram,
   per-tier profile table
3. **Journey** *(Viva)* — population over time, super users produced per week,
   time-to-super distribution, durability cohorts
4. **Work patterns** *(Viva)* — collaboration, meeting, focus and network measures compared
   between super users and everyone else
5. **Change management** — organization performance, org × function opportunity heatmap,
   job-function table, and five action lists
6. **Data sources** — connection status, tier model explanation, Person Query upload,
   metric checklist, privacy controls

## Action lists

| List | Who | Recommended play |
|---|---|---|
| Champions | Established super users | Recruit as enablement champions and scenario authors |
| Rising stars | Power/habitual users close to super | Targeted nudge — one more surface or one more weekly habit |
| At-risk super users | Former super users who have gone quiet | Check in before the habit is lost |
| Stalled licenses | Activated but stuck at low breadth | Scenario-led training for their job function |
| Never activated | Licensed, zero activity | Onboarding or license reclamation |

Each list exports to Excel via `/api/copilot/super-users/export?format=xlsx&list=<id>`.

## Privacy

- **Aggregation floor** (default 5, tunable) — any organization, function or comparison
  cohort below the floor is suppressed rather than displayed. This mirrors the row-level
  security guidance in DecodingSuperUsage.
- **`displayConcealedNames` is honored** — read from `/admin/reportSettings`. When the
  tenant has anonymized identifiers enabled, person-level names stay concealed throughout.
- **No raw Viva rows retained** — the uploaded CSV is parsed in memory; only per-person
  derived aggregates and weekly summaries are stored, scoped to the tenant, expiring after
  14 days.
- **Framing** — the UI states in several places that these are behavioral measures for
  enablement, never a performance measure for individual evaluation.

## Architecture

```
src/lib/copilot/superUsage/
  types.ts               Canonical shapes shared by engine, API and client (no server-only)
  tiers.ts               Thresholds, surface/tier/work-pattern definitions, classification
  analyze.ts             Pure analyzeSuperUsage(input) -> SuperUsageModel
  directoryAttributes.ts Pure directory taxonomy (department -> Organization, title -> Function)
  directory.ts           Entra ID enrichment via Graph, 30-minute cache
  buildModel.ts          Per-request server-side assembly (Graph + directory + Viva)
  tenant.ts              Tenant key resolution

src/lib/viva/
  personQuery.ts  Tolerant Person Query CSV parser (v13 + legacy metric names)
  datasetStore.ts In-memory + optional Cosmos persistence, 14-day TTL

src/app/api/copilot/super-users/route.ts         GET model JSON
src/app/api/copilot/super-users/export/route.ts  GET xlsx / pptx
src/app/api/viva-insights/dataset/route.ts       GET status, POST upload, DELETE

src/app/microsoft365/copilot/super-users/
  page.tsx                 Shell: period, filters, threshold tuning, tabs
  charts/SuperUsageCharts.tsx
  components/*.tsx         One component per tab plus shared primitives

scripts/verify-super-usage-model.ts  Regression check (pnpm run verify:super-usage)
```

`analyze.ts` is deliberately pure and free of I/O, so the whole model can be unit-tested
with fixture rows and no Graph or Viva dependency. The pure directory taxonomy lives in
`directoryAttributes.ts` specifically so `analyze.ts` never pulls in `server-only`.

The builder does not cache assembled models. Every JSON request and XLSX/PPTX export
fetches the critical Copilot usage report with the current caller's delegated context
before enrichment. Graph therefore rechecks its
[report permissions and role requirements](https://learn.microsoft.com/en-us/graph/reportroot-authorization);
the builder adds no five-minute grace period after Graph denies access. `refresh=1`
remains accepted, but is no longer needed to avoid model reuse. Repeated requests cost
another report fetch and model computation.

This policy covers this builder, the [readiness builder](./copilot-readiness-report.md),
and their outer [ROI seed builder](./copilot-roi-calculator.md). A denial of ROI's critical
usage report still returns its explicit modeled fallback, never another caller's cached seed.
It does not change the directory enrichment cache, Viva dataset storage, or client-side
caches. The deployment-configured `tenantKey` remains an enrichment
storage key, not proof of the caller's effective report tenant or reporting authorization.

### Units invariant

Every rate, share, adoption and score on `SuperUsageModel` is on a **0–100 scale**
(`88.8` means 88.8%). The only exceptions are `SurfaceMixRow.lift` and `WorkPatternRow.lift`,
which are **0–1 relative ratios** (`0.42` means +42%).

Formatters therefore must not rescale: `fmtPct` in the UI and `pct()` in the export route
format the value as-is, and `fmtLift` multiplies by 100. A stray `* 100` in the engine
silently produces executive reports that are wrong by two orders of magnitude, so
`pnpm run verify:super-usage` asserts this invariant across the whole model.

Surfaces used exclusively by super users would divide by zero, so lift applies a half-person
continuity correction and is capped at `10` (+1000%). This keeps niche-but-signature surfaces
visible instead of reporting them as "no difference".

### Verification

```bash
pnpm run verify:super-usage   # engine invariants against a 500-person fixture
pnpm run typecheck
pnpm run build
```

## Permissions

| Need | Permission |
|---|---|
| Copilot usage detail | `Reports.Read.All` (delegated, admin consented) |
| Directory enrichment | `User.Read.All` (delegated) |
| Report settings | `ReportSettings.Read.All` (delegated) — optional, failure is non-fatal |

The signed-in user also needs a reports-capable admin role such as Reports Reader or
Global Reader. All Graph calls use `getGraphClientForUser()` (delegated / OBO) so activity
is attributed to the actual admin in the Entra audit log.

## Uploading a Person Query

1. Open the Viva Insights **Analyst Workbench** and create a **Person Query**
2. Set a **weekly** cadence over at least 12 weeks (26 gives better journey cohorts)
3. Add the metric groups listed on the **Data sources** tab — Copilot activity, Copilot
   Chat, work patterns, and the `Organization` / `FunctionType` / `LevelDesignation`
   attributes
4. Run the query and export the result as CSV
5. Drop the CSV on the **Data sources** tab

Missing metrics simply hide the dependent visual; the checklist on that tab shows exactly
what was found and what was not.

## Known limitations

- Viva `PersonId` is assumed to match the Graph UPN. When Viva identities are hashed, the
  parser falls back to display-name matching, which is best-effort.
- Work-pattern differences are correlations, not causal proof. The UI says so.
- The Graph report refreshes daily, so same-day changes will not appear.
