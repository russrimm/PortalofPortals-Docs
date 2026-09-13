# License Intelligence — Jobs-to-be-Done

> UX research for two related capabilities:
> 1. **M365 Copilot Readiness & ROI** — who is enabled, who is active, who is ROI-positive.
> 2. **License Utilization Heat Map** — who holds E5 but only uses E1-tier workloads.
>
> Both share one persona, one mental model (“am I paying for value?”), and one data spine
> (Graph SKU assignments × Graph usage reports). Treat them as one feature surface in nav.

---

## Assumptions to confirm

These drove the artifacts; flag any that are wrong:

- Primary persona is an **M365 / Licensing Admin** in a 500–10,000-seat tenant, with a finance
  partner and a CIO/COO who reads the summary but not the detail.
- Decisions are anchored to a **renewal or true-up cycle** (annual or quarterly). Outside that
  window the user does spot checks, not deep work.
- We can rely on Graph endpoints already used elsewhere in this app:
  `subscribedSkus`, `users?$select=assignedLicenses`, and the Microsoft 365 usage reports
  (`getMicrosoft365CopilotUsageUserDetail`, `getOffice365ActiveUserDetail`, Teams / Outlook
  activity reports). No new connectors required.
- The tenant has **Reports Reader** consent already granted (the existing
  `/microsoft365/copilot/user-count` page proves this).
- Cost data (£ / $ per SKU) is **manually entered or pulled from EA portal** — Graph does not
  return per-SKU price. Persona is willing to enter or import a price list once.

---

## Persona

**Name:** Priya, M365 Licensing Admin
**Org:** 4,200 seats, mixed E3/E5, 800 Copilot for M365 add-ons purchased last quarter.
**Reports to:** Director of Productivity, who reports to the CIO.
**Tools today:**
- Microsoft 365 admin center → Billing → Licenses (counts only, no usage cross-ref)
- Copilot Dashboard in Viva Insights (CIO loves it; Priya finds it locked to aggregates)
- A quarterly Excel pulled by a colleague from Graph + manually joined to the EA price list
- Power BI “M365 Usage Analytics” template (slow, stale, IT-owned not admin-owned)

**Pain in own words:**
> “I know we have 800 Copilot seats. I can tell you 620 are assigned. I cannot tell you, without
> two days of work, how many of those 620 actually used Copilot last week, and I definitely
> cannot tell my CIO which 180 to reclaim before the next true-up.”
>
> “Finance keeps asking ‘who is on E5 and doesn’t need it?’ I can answer ‘who has E5’. I cannot
> answer ‘who needs E5’.”

**Tech comfort:** High for admin UI, medium for KQL/PowerShell, low for Power BI authoring.
**Accessibility:** No declared needs, but works from laptop on a 1366×768 screen and exports
to PDF for the CIO — contrast and print layout matter.

---

## Job 1 — Copilot Readiness & ROI

**When** the renewal conversation for Copilot for M365 add-ons is approaching, or finance asks
“is this thing working,”
**I want to** see every Copilot-licensed user grouped by whether they are *assigned*, *enabled*,
*active*, or *ROI-positive*,
**so I can** defend the seats that are working, reclaim the ones that aren’t, and give the CIO
a one-line answer with a credible chart behind it.

### Definitions the user wants the product to own (not invent themselves)

| Bucket            | Definition (proposed — confirm with persona) |
|-------------------|-----------------------------------------------|
| **Assigned**      | User has a Copilot for M365 SKU in `assignedLicenses`. |
| **Enabled**       | Assigned **and** has signed in to a Copilot-enabled host (Teams, Word, Excel, PowerPoint, Outlook, Loop, Copilot Chat) in the last 28 days, per Graph usage report. |
| **Active**        | Enabled **and** has at least one Copilot interaction (any `*CopilotLastActivityDate` within 28 days). |
| **ROI-positive**  | Active **and** crosses a usage threshold (default: ≥5 Copilot interactions/week across ≥2 hosts for 4 of the last 8 weeks). Threshold is admin-configurable; default is a *suggestion*, not a verdict. |
| **Idle**          | Assigned but **not** active in 28 days. Candidate for reclaim. |

> 🚩 The persona explicitly does **not** want the product to claim a dollar ROI number. They
> want the *cohort*; finance owns the dollar math. Surface “reclaim candidates: 180 seats ×
> your unit price = £X potential” as an opt-in helper, not the headline.

### Incumbent solution and why it fails

- **Viva Insights Copilot Dashboard** — aggregates only, no “give me the list of 180 names.”
- **Manual Graph export to Excel** — two days of work, stale by the time it’s reviewed,
  no shared definition of “active.”
- **Power BI template** — IT-owned, change requests take weeks, no reclaim workflow.

### Success metrics for the feature

- Priya can answer “how many Copilot seats should we renew?” in **under 5 minutes**, from
  cold start, without exporting to Excel.
- The list of reclaim candidates is **exportable to CSV** and **sharable as a saved view**
  (so finance and Priya are looking at the same definition next month).
- The CIO summary chart is **screenshot-ready** (no scrolling, dark/light parity, alt text).

---

## Job 2 — License Utilization Heat Map

**When** preparing for an EA true-up, or after a layoff/reorg leaves SKUs mis-assigned,
**I want to** see a heat map of users × workloads showing “how much of what they’re paying
for are they actually using,”
**so I can** identify users who could safely be moved to a cheaper SKU (e.g., E5 → E3, or
E3 → F3) without breaking their day job.

### What “heat” means here

A cell = (user, workload). Workload columns are grouped by SKU tier they unlock:

- **E1-tier workloads** (web Office, Outlook, Teams) — included in everything
- **E3-tier workloads** (desktop Office, Intune basics, Azure Information Protection P1)
- **E5-tier workloads** (Defender for O365 P2, Power BI Pro, Audio Conferencing, AIP P2, Cloud App Security)

A user holding **E5** whose row only lights up on **E1 columns** is the headline finding.

### Definitions the product owns

| Status                  | Rule (proposed default) |
|-------------------------|--------------------------|
| **Right-sized**         | Uses at least one workload from the highest tier their SKU includes (in last 28 days). |
| **Over-licensed**       | Uses no workloads above tier *N* but holds tier *N+1* or higher SKU. |
| **Severely over-licensed** | Over-licensed **and** has held the higher SKU for ≥90 days (i.e., not just onboarded). |
| **Unassigned-but-active** | Uses a workload from a tier they don’t hold a SKU for — likely a misconfig, surface it. |

### Incumbent solution and why it fails

- **Microsoft 365 admin center → Active users → Licenses** — shows what’s assigned, never
  what’s used.
- **The “unused licenses” view in M365 admin** — only flags users with **zero** activity in
  any workload. Misses the much bigger pool of *partially* used premium SKUs.
- **Same Excel pull as Job 1** — same staleness, same lack of shared truth.

### Success metrics for the feature

- Priya can produce a “SKU downgrade candidate list” for one department in **under 10 minutes**.
- The heat map renders for **5,000 users × 12 workloads** without freezing the browser (paged
  or virtualised).
- A user can be **excluded from the list** with a reason (“exec”, “compliance hold”) and the
  exclusion persists across sessions.

---

## What the persona does *not* want

- **An AI verdict.** “Consider reclaiming this seat” → fine. “Reclaim this seat” with a one-click
  button → frightening. Reclaim must be deferred to existing license-assignment workflows.
- **A dollar number that pretends to be authoritative.** Show the math, let finance own the price.
- **Another dashboard to log into.** This must live inside Portal 360° next to the existing
  `/azure/license-usage` page, not as a separate tool.
- **Real-time data.** Graph usage reports lag 24–48 hours; that is fine. Surface the
  `reportRefreshDate` so the user trusts what they see.
