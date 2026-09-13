# Analytics Hub → Portal 360 port status

Running record of every tool cataloged in
[microsoft/Analytics-Hub](https://github.com/microsoft/Analytics-Hub), whether it has been
ported into Portal 360, and — where it has not — exactly why.

Last updated: see git history for this file.

## Status at a glance

| # | Tool | Upstream repo | Portal 360 | Page |
|---|---|---|---|---|
| 1 | Super Usage Adoption | `microsoft/DecodingSuperUsage` | ✅ Ported | `/microsoft365/copilot/super-users` |
| 2 | Super User Impact | `microsoft/superuserimpact` | 🚧 Partial | `/microsoft365/copilot/super-users` → Work patterns tab |
| 3 | Copilot Chat & Agent Intelligence | `microsoft/CopilotChatAnalytics` | 🚧 Partial | `/pax/copilot-usage`, `/microsoft365/copilot/agents` |
| 4 | AI-in-One Dashboard | `microsoft/AI-in-One-Dashboard` | 🚧 Partial | `/pax/*` |
| 5 | GitHub Copilot Impact | `microsoft/GitHubCopilotImpact` | ⛔ Blocked | — |
| 6 | What I Did — Copilot Impact | `microsoft/What-I-Did-Copilot` | ⛔ Cannot port | — |
| 7 | M365 Copilot Readiness | `microsoft/M365UsageAnalytics` | ✅ Ported | `/microsoft365/copilot/readiness` |
| 8 | Adoption & Sentiment | `olivierpecheux/copilot-adoption-sentiment-report` | ⏳ Planned | — |
| 9 | PAX — Portable Audit eXporter | `microsoft/PAX` | ✅ Ported | `/pax/*` (7 pages) |
| 10 | Productivity ROI Calculator | `jordankingisalive/CopilotROICalculator` | ✅ Ported | `/microsoft365/copilot/roi-calculator` |
| 11 | CustomizeCopilot add-ons | `microsoft/customizecopilot` | ➖ N/A | — |

Legend: ✅ ported · 🚧 partial · ⏳ planned · ⛔ blocked · ➖ not applicable

## Cannot port

### 6. What I Did — Copilot Impact Report

**Reason: the data does not exist in any tenant API.**

The upstream tool is a Python CLI that reads GitHub Copilot session transcripts from
`~/.copilot/` **on the operator's own workstation** and authenticates with `gh auth login`
using that operator's personal credentials.

Those session files are local artefacts. They are never uploaded to GitHub, Microsoft Graph,
or any other service, so a server-hosted BFF portal has no route to them. Reproducing this in
Portal 360 would require shipping an agent onto every developer machine — well outside the
product boundary, and a significant privacy escalation.

**Recommendation:** keep pointing people at the upstream CLI. It is the correct tool for the
job and runs where the data is.

### 11. CustomizeCopilot add-ons

**Reason: not an application — it is Power BI source material.**

The repo ships Power BI `.pbip` *page folders* designed to be copied into the Super Usage
`.pbit` template. There is no dataset, no API, and no standalone report; the artefact only
has meaning inside Power BI Desktop.

Marked N/A rather than blocked — there is nothing to port. The equivalent visuals are already
native pages in Portal 360.

## Blocked — needs a decision or a credential

### 5. GitHub Copilot Impact

**Reason: requires a credential type the portal does not hold.**

The report is technically feasible. The data comes from the GitHub REST API:

- `GET /enterprises/{enterprise}/copilot/metrics`
- `GET /orgs/{org}/copilot/billing/seats`

Both need a **GitHub Enterprise credential** — either a fine-grained PAT with
`Copilot Business` read scope, or a GitHub App installed at the enterprise level. Portal 360
currently authenticates only against Microsoft Entra ID; there is no GitHub credential in the
token store and no UI for supplying one.

**Blocked on:** a decision about which credential model to adopt, and where the secret lives
(Key Vault reference vs. per-tenant configuration record).

Once that is settled the port itself is straightforward — the metrics endpoint returns
pre-aggregated daily data, so there is no heavy analysis engine to build.

## Ported

### 1. Super Usage Adoption → `/microsoft365/copilot/super-users`

Full native port. Documented in
[`copilot-super-user-analytics.md`](./copilot-super-user-analytics.md).

### 7. M365 Copilot Readiness → `/microsoft365/copilot/readiness`

Full native port. Documented in
[`copilot-readiness-report.md`](./copilot-readiness-report.md).

One deliberate deviation from upstream: this port reads **live Graph usage reports** rather
than a Purview unified-audit-log export. Equivalent signal, no export step, slightly different
granularity. The trade-off is documented in the report doc and surfaced in the page's
Data sources tab.

### 9. PAX — Portable Audit eXporter → `/pax/*`

Already implemented across seven pages before this porting effort began.

### 10. Productivity ROI Calculator → `/microsoft365/copilot/roi-calculator`

Full native port. Documented in
[`copilot-roi-calculator.md`](./copilot-roi-calculator.md).

Improves on upstream in three ways: the population is seeded from live Graph usage instead of
a manual CSV export, a realisation-rate haircut is applied so the headline figure survives a
finance review, and results are presented as a conservative/expected/optimistic band with
explicit break-even thresholds rather than as a single point estimate.

## Partial — port planned to complete them

### 2. Super User Impact

Currently the Work patterns tab of the Super Users page, which reuses the uploaded Viva
Person Query dataset. Missing from upstream: the time-saved value model, cross-team
benchmarking, and the sentiment overlay.

### 3. Copilot Chat & Agent Intelligence

`/pax/copilot-usage` and `/microsoft365/copilot/agents` between them cover interaction volume
and agent inventory. Missing: the conversation-shape analysis and prompt-category clustering
that give the upstream report its name.

### 4. AI-in-One Dashboard

The PAX audit pages cover the underlying `CopilotInteraction` data. Missing: the unified
cross-surface roll-up that stitches Copilot, agents, and Entra app data into one view.

## Planned

### 8. Adoption & Sentiment

Tenant usage joined against an uploaded survey CSV. No blockers — the upload mechanism
already exists for Viva Person Query data and can be generalised.
