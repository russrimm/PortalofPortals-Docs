# M365 Copilot Readiness Report

Native Portal 360 port of [microsoft/M365UsageAnalytics](https://github.com/microsoft/M365UsageAnalytics),
one of the tools cataloged in [microsoft/Analytics-Hub](https://github.com/microsoft/Analytics-Hub).

Page: `/microsoft365/copilot/readiness`

## Why this exists

Copilot licenses are expensive and finite. The question every tenant asks first is not
"who is using Copilot" — that is the [Super User](./copilot-super-user-analytics.md) report —
but **"who should get the next license, and which licenses are being wasted?"**

Readiness answers that by scoring every person in the tenant on how much M365 signal Copilot
would actually have to work with, then cross-referencing that score against who currently
holds a license.

The upstream project derives its numbers from a Purview unified-audit-log export. This port
reads the **live Graph usage reports** instead, so there is no export step and the page is
current every time it loads. The trade-off is discussed under
[Fidelity vs. upstream](#fidelity-vs-upstream).

## The readiness score

Three components, each normalized to 0–100, then blended:

| Component | Weight | Inputs |
|---|---|---|
| Collaboration | 0.40 | Teams (0.55), Outlook (0.45) |
| Authoring | 0.40 | Word (0.30), Excel (0.30), PowerPoint (0.25), OneNote (0.15) |
| Content grounding | 0.20 | OneDrive (0.50), SharePoint (0.50) |

Every per-workload volume is **percentile-normalized against that workload's own active
population** before it is blended. Without this, email counts — which are an order of
magnitude larger than file counts — would swamp everything else and the score would just be
a proxy for mailbox volume.

`percentileRanks()` uses the **midpoint of tied ranks**, so a population where everyone scores
identically lands at the 50th percentile rather than 0 or 100.

Thresholds live in `src/lib/copilot/readiness/scoring.ts` and are all overridable per request
from the page's tuning sliders:

| Threshold | Default | Meaning |
|---|---|---|
| `recencyWindowDays` | 30 | How recent activity must be to count as current |
| `readyBreadth` | 3 | Distinct workloads a person must touch to be "broad" |
| `primePercentile` | 60 | Readiness percentile at which an unlicensed person is a prime candidate |
| `dormantAfterDays` | 28 | Copilot inactivity after which a license is considered dormant |
| `privacyFloor` | 10 | Minimum group size before a cohort is shown |

## Tiers

Tiers are assigned by **percentile within the tenant**, not by absolute volume — faithful to
upstream, and necessary because raw activity volumes vary enormously between tenants.

| Tier | Rule |
|---|---|
| Tier 1 | ≥ 75th percentile |
| Tier 2 | ≥ 50th percentile |
| Tier 3 | ≥ 25th percentile |
| Tier 4 | below 25th percentile |
| Inactive | no activity in any workload |

## License strategy quadrants

Each person is placed in exactly one of six strategies by crossing license state with
readiness and Copilot recency:

| Strategy | Licensed? | Condition | Recommended action |
|---|---|---|---|
| `amplify` | yes | active in Copilot | Keep, and use as a champion |
| `activate` | yes | ready, never started | Onboard — the signal is there, the habit is not |
| `reclaim` | yes | dormant and low readiness | Recover the license |
| `allocate` | no | ≥ `primePercentile` and ≥ `readyBreadth` | Next license goes here |
| `nurture` | no | some activity, below the bar | Grow the M365 footprint first |
| `defer` | no | no activity | Not a Copilot candidate yet |

## Tabs

| Tab | Content |
|---|---|
| Executive summary | Headline KPIs, generated insights, tier distribution, strategy split, workload radar |
| License strategy | SKU table, strategy quadrants, opportunity scatter, org / function breakdowns |
| Workloads | Adoption by license state, per-workload detail, optional trend series |
| Action lists | The five ranked people lists, each with a per-person reason |
| Data sources | Provenance, exact Graph endpoints, scoring explainer, known limits |

## Action lists

Five ranked lists, defined by `LIST_SPECS` in `analyze.ts`. Each entry carries a plain-English
`reason` so the list is actionable without reading the model:

- `primeCandidates` — unlicensed, high readiness, broad workload use
- `reclaimable` — licensed, dormant, low readiness
- `activationNeeded` — licensed, ready, no Copilot activity yet
- `nurture` — unlicensed with partial signal
- `championsToAmplify` — licensed, active, top-tier readiness

## Privacy

The `privacyFloor` threshold (default 10) suppresses any cohort smaller than the floor in the
aggregate breakdowns. Individual names appear only in the action lists, which are the point of
the report; the same concealment conventions used by the Super User report apply.

## Architecture

```
src/lib/copilot/readiness/
  types.ts       canonical shapes — no `server-only`, shared with client components
  scoring.ts     thresholds, workload / tier / strategy definitions, percentile helpers
  analyze.ts     pure analyzeReadiness(input) -> ReadinessModel — no I/O, unit-testable
  buildModel.ts  'server-only' — per-request Graph I/O and query-string parsing

src/app/api/copilot/readiness/route.ts         GET the model as JSON
src/app/api/copilot/readiness/export/route.ts  XLSX (multi-sheet or single list) and PPTX

src/app/microsoft365/copilot/readiness/
  page.tsx       shell — period, tuning sliders, facet filters, tabs, export links
  charts/        Recharts wrappers
  components/    one file per tab, plus shared primitives
```

Both API routes call `verifyAuth()` as their first statement and use delegated (OBO) Graph
access via `getGraphClientForUser()`. No app-only token is ever acquired.

`buildModel.ts` does not cache assembled models. Every JSON request and XLSX/PPTX export
fetches the critical population report with the current caller's delegated context before
the optional reports and enrichment. Graph rechecks its
[report permissions and role requirements](https://learn.microsoft.com/en-us/graph/reportroot-authorization);
the builder adds no five-minute grace period after Graph denies access. `refresh=1`
remains accepted, but is no longer needed to avoid model reuse. Repeated requests now
repeat report fetching and model computation, increasing upstream calls.

As with [Super User Analytics](./copilot-super-user-analytics.md), this policy also covers
the outer [ROI seed builder](./copilot-roi-calculator.md). ROI preserves its explicitly
modeled fallback when the critical usage report is denied. Directory enrichment, Viva storage, and
client-side caching are not changed. The deployment-configured `tenantKey` is not used
to authorize reports or identify their effective delegated tenant.

### Graph reports consumed

| Report | Role |
|---|---|
| `getOffice365ActiveUserDetail` | Population spine — the only **critical** source |
| `getOffice365ActiveUserCounts` | OneDrive / SharePoint trend, total active |
| `getTeamsUserActivityUserDetail` | Teams volume |
| `getEmailActivityUserDetail` | Outlook volume |
| `getM365AppUserDetail` | Word / Excel / PowerPoint / OneNote per-platform flags |
| `getM365AppUserCounts` | Office app trend |
| `getOneDriveActivityUserDetail` | OneDrive file activity |
| `getSharePointActivityUserDetail` | SharePoint file activity |
| `getMicrosoft365CopilotUsageUserDetail` (beta) | Copilot license and last-activity dates |

Every source except the population spine **degrades silently**: a 401/403 sets
`model.sources.<name>.error` and the Data sources tab explains the gap, rather than failing
the whole page. A permission failure on the spine raises `ReadinessPermissionError`.

### The authoring proxy

`getM365AppUserDetail` reports Word / Excel / PowerPoint / OneNote as **yes/no per platform**,
never as a frequency. No Graph report anywhere exposes per-user Office document counts.

The authoring component therefore uses **platform breadth** — the count of
Windows / Mac / Web / Mobile flags set — as an intensity proxy, floored at 1 whenever the
app-level flag is set. This is surfaced in the UI by a `ProxyBadge` on every affected figure
and explained in full on the Workloads tab.

### CSV quirks handled

- Column names differ between CSV (Title Case) and JSON (camelCase) modes and have drifted
  between report versions. `pick(row, keys)` tries exact keys first, then falls back to a
  normalized (lowercased, non-alphanumeric-stripped) comparison across all row keys.
- Booleans arrive as `Yes`/`No`, `TRUE`/`FALSE`, or `1`/`0`.
- Copilot license is detected from the beta usage report **or** an `Assigned Products` value
  containing `COPILOT`.
- Copilot last activity is the minimum `daysSince` across every column matching
  `/last\s*activity\s*date/i`.

## Permissions

Delegated, all read-only:

- `Reports.Read.All` — every usage report above
- `User.Read.All` — Entra directory attributes for the org / function / country facets

If `Reports.Read.All` is missing the page returns a permission error. If `User.Read.All` is
missing the report still renders; the facet filters simply collapse to a single "Unassigned"
bucket.

## Fidelity vs. upstream

Upstream `M365UsageAnalytics` derives its activity signal from a **Purview unified-audit-log
export**. This port reads the **Graph usage reports** instead.

| | Upstream (Purview UAL) | This port (Graph usage reports) |
|---|---|---|
| Setup | Manual export, re-run to refresh | None — live on every load |
| Granularity | Per-operation | Per-user per-period aggregates |
| Office authoring | True per-document counts | Platform-breadth proxy |
| Latency | Export age | Graph report lag (typically 2–3 days) |

The numbers are therefore *equivalent in shape* but not byte-for-byte identical to upstream.
If exact audit-log fidelity matters more than convenience, the portal's existing
[PAX](../src/app/pax) audit pages already hold UAL-derived data and can be used alongside
this report.

## Known limitations

- Office authoring intensity is a proxy (see above) — it cannot be made exact with any
  currently published Graph endpoint.
- The Copilot usage report is on the **beta** endpoint and its schema may change without
  notice; a schema drift will surface as a source error rather than a crash.
- Graph usage reports lag real time by roughly 2–3 days.
- If the tenant has *Reports* pseudonymization enabled in the M365 admin center, UPNs arrive
  as opaque identifiers and the directory join produces no facets. Disable
  "Display concealed user, group, and site names in all reports" to get named output.
- Trend series are only as long as the selected period; there is no cross-period history store.

## Upstream credit

Model, tier logic, and strategy quadrant concept adapted from
[microsoft/M365UsageAnalytics](https://github.com/microsoft/M365UsageAnalytics)
by way of [microsoft/Analytics-Hub](https://github.com/microsoft/Analytics-Hub).
