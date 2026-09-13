# Copilot Productivity ROI Calculator

**Route:** `/microsoft365/copilot/roi-calculator`
**API:** `/api/copilot/roi`, `/api/copilot/roi/export`

Native port of [`jordankingisalive/CopilotROICalculator`](https://github.com/jordankingisalive/CopilotROICalculator),
cataloged in the [Microsoft Analytics Hub](https://github.com/microsoft/Analytics-Hub).

Upstream is a browser-only calculator that requires a manual CSV export from the Decoding
Super Usage Power BI report. This port keeps the same financial identity but seeds the
population straight from live Graph Copilot usage, so no export step is needed. The
pure-assumption mode is still available for pre-deployment business cases.

---

## What it answers

- What is Microsoft 365 Copilot returning against what it costs?
- What would have to be true for it to break even?
- Where is value being left on the table, and which lever is cheapest to pull?
- How does the return differ between a dormant user and a super user?

---

## The model

```
weekly actions   = active users × actions per active user per week
monthly actions  = weekly actions × 4.333          (52 ÷ 12)
gross hours      = monthly actions × minutes per action ÷ 60
realized hours   = gross hours × realization rate
monthly value    = realized hours × hourly rate
monthly cost     = licensed users × license cost per user
ROI multiple     = annual value ÷ annual cost
FTE equivalent   = annual realized hours ÷ 1,880
```

### Deliberate departures from upstream

| Change | Why |
|---|---|
| **Realization rate** (default 70%) | Upstream implicitly assumes 100% — that every minute saved becomes value. That does not survive a finance review. Set it to 100 to reproduce upstream's numbers exactly. |
| **Cost counts all licenses, value counts only active users** | Idle licenses bill whether or not anyone opens Copilot. This is the conservative choice and it is what makes the activation lever worth so much. |
| **Scenario band** | A single figure invites an argument about that figure. A conservative / expected / optimistic band moves the argument to whether the *range* is plausible, which is a far more winnable conversation. |
| **Break-even thresholds** | Value is linear in active users, actions and minutes, so break-even for any one of them is `currentValue / roiMultiple`. Answers "what would have to be true" directly. |
| **Three-month linear ramp on payback** | Licenses bill in full from day one but nobody is productive on day one. Without a ramp, payback is either "immediate" or "never". Returns `null` (an honest "not reached") when the run-rate never clears cost. |
| **Per-tier economics** | Cost is flat per head; value is not. This is the evidence for spending on enablement rather than on more licenses. |
| **Live tenant seed** | Removes the manual CSV export entirely. |

---

## Data sources

| Input | Modeled | Live tenant | Live + measured |
|---|---|---|---|
| Licensed users | Default | Graph Copilot usage | Graph Copilot usage |
| Active users | Default | Graph Copilot usage | Graph Copilot usage |
| Actions per user per week | Default | Assumed (intensity ladder) | **Measured** — Viva Person Query |
| License candidates | 0 | Readiness report (opt-in) | Readiness report (opt-in) |
| Everything else | Operator | Operator | Operator |

Seeding is **best-effort**. A Graph failure degrades to the modeled seed with the error
surfaced on the Method tab rather than returning a 500 — a broken usage report should not
prevent someone building a business case.

Tenant seeding is **per request**, including XLSX/PPTX exports. The outer ROI seed and the
underlying Super User and Readiness models are not cached across requests. Each tenant-source
request reaches the current caller's delegated reporting authorization, so a previous success
cannot bypass a later Graph denial or supply another caller's protected population or tiers.
This follows Graph's [report permission and role requirements](https://learn.microsoft.com/en-us/graph/reportroot-authorization)
without adding a model-cache grace period after the provider denies access.

A denial of the critical Copilot usage report still returns HTTP 200 with the existing
explicit `status.mode: 'modelled'` fallback: seed population and candidate counts are zero,
tiers are empty, and measured-action
and Viva provenance are cleared. The financial calculation uses static defaults or explicit
operator inputs, labeled as assumptions, not as measured tenant data. Anonymous requests still
return 401. `source=modelled` performs no report lookup, and `refresh=1` remains accepted but
is no longer needed to avoid seed reuse.

Repeated tenant-source requests incur another report fetch and calculation. This policy does
not change directory enrichment caching, Viva dataset storage, or client-side caching, and does
not establish those separate boundaries as safe.

### Candidate lookup is opt-in

`includeCandidates=1` additionally builds the full readiness model (nine extra Graph
report calls) purely to read `readiness.license.readyUnlicensed`. It is off by default
because most sessions do not need the extra report fan-out. If only the readiness lookup
is denied, the authorized usage seed remains available, the candidate count is zero, and
the provenance description explicitly says candidate sizing was unavailable.

### Tier intensity ladder

When action volumes are not measured, per-tier rates are inferred from a weight ladder:

```
dormant 0 · novice 0.3 · explorer 0.7 · habitual 1.2 · power 2.0 · super 3.0
```

These weights are renormalized so the population-weighted mean still equals the operator's
global assumption. **The distribution across tiers is a judgment; the total is not.** Rows
derived this way are flagged `measured: false` and badged in the UI. Upload a Viva Insights
Person Query on `/microsoft365/copilot/super-users` to replace the ladder with real counts.

---

## Tabs

| Tab | Contents |
|---|---|
| **Calculator** | Headline KPIs, insight callouts, sensitivity curve, scenario band, break-even thresholds |
| **Tier analysis** | Value vs cost per adoption tier, full detail table, top-tier and underwater callouts |
| **Opportunity** | Three levers in the order they should be pulled: activate, intensify, then license |
| **Adoption journey** | Six-phase rollout guide ported from upstream's "Start Here", with links to the portal reports that produce each metric |
| **Method** | Formula, provenance, departures from upstream, and honest limitations |

---

## Exports

`GET /api/copilot/roi/export?<inputs>` — XLSX (7 sheets) by default, `&format=pptx` for a
7-slide deck. The query string is produced by `roiInputsToQuery()`, which omits anything
left at its seeded value, so a pasted link reproduces exactly what was on screen.

---

## Architecture

```
src/lib/copilot/roi/
  types.ts       canonical shapes — no `server-only`, crosses to the client
  presets.ts     defaults, bounds, industry rates, scenarios, adoption phases
  calculate.ts   pure calculateRoi() — runs on the server for exports and in the
                 browser for instant slider feedback
  buildModel.ts  'server-only' — per-request delegated Graph seeding, modeled fallback
  request.ts     query-string contract shared by both routes
src/app/api/copilot/roi/route.ts         GET { seed, model }
src/app/api/copilot/roi/export/route.ts  XLSX / PPTX
src/app/microsoft365/copilot/roi-calculator/
  page.tsx, charts/RoiCharts.tsx, components/*
```

`calculate.ts` being pure and client-importable is the reason slider drags are instant: the
API is only re-hit when the *seed* has to change (data source, period, candidate lookup).

Input precedence is **explicit query parameter → tenant seed → static default**. The page
tracks which inputs the operator has personally moved so a background seed refresh never
silently overwrites them.

---

## Limitations

- **Minutes saved per action is an assumption, not a measurement.** No Microsoft API reports
  how long a task would have taken without Copilot. The sensitivity curve exists precisely
  because this number cannot be sourced.
- **The model has no view of quality.** An action producing a worse output than manual work
  still counts as time saved.
- **License cost uses a single list price.** Real agreements have discounts, mixed SKUs,
  ramp deals and true-ups.
- **Correlation, not causation.** Value attributed to Copilot may be partly attributable to
  other concurrent changes. This is a projection, not a controlled experiment.
- **Activation is measured over the selected period.** A short period understates occasional
  users and overstates the idle count.

---

## Related

- [`docs/copilot-readiness-report.md`](./copilot-readiness-report.md) — who should get a seat
- [`docs/copilot-super-user-analytics.md`](./copilot-super-user-analytics.md) — the tier model this seeds from
- [`docs/analytics-hub-port-status.md`](./analytics-hub-port-status.md) — port coverage across the whole Analytics Hub
