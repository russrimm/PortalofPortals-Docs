# User Journey — Copilot Readiness & ROI

> Persona: Priya, M365 Licensing Admin. See `license-intelligence-jtbd.md` for full context.
> Trigger: CIO email — “Board wants a Copilot renewal recommendation by Friday.”

---

## Journey stages

### Stage 1 — Trigger & landing

**Doing:** Opens Portal 360°, navigates to Microsoft 365 → Copilot. Today this redirects to
`/microsoft365/copilot/user-count`, a flat per-user table. New entry point: a **Readiness &
ROI** tab alongside the existing user-count view.
**Thinking:** “I need a number for the CIO and a list for me. Where do I start?”
**Feeling:** 😥 Time pressure. Suspicious of any number that looks too round.
**Pain:**
- Existing table is per-user only — no cohort view.
- No definition of “active” on screen, so any number she quotes is contestable.
**Opportunity:** Open on a **four-bucket funnel** (Assigned → Enabled → Active → ROI-positive)
with the definitions visible *on the chart*, not behind a tooltip.

### Stage 2 — Orient & trust

**Doing:** Reads the funnel headline, checks the data freshness label, hovers a bucket to see
its definition, and clicks the definition to edit the ROI threshold.
**Thinking:** “Is this current? What does ‘active’ mean here? Can I make it match how *we*
define active?”
**Feeling:** 🤔 Cautious. Will not screenshot anything until trust is established.
**Pain:**
- Default threshold may not match her org’s definition.
- If the data is >48 h old she needs to know *before* she quotes a number.
**Opportunity:**
- Persistent “As of [date], from Graph usage reports” caption under the funnel.
- Inline editable threshold: “ROI-positive = ≥ [5] interactions/week across ≥ [2] hosts for
  [4] of the last [8] weeks.” Changing it re-computes the funnel in place, no page reload.
- A “save as default for this tenant” action so finance and Priya share one definition.

### Stage 3 — Drill into the gap

**Doing:** Clicks the gap between “Assigned” (620) and “Active” (440) to see the **180 idle
seats** as a list. Sorts by “days since last Copilot activity” and “date Copilot assigned.”
**Thinking:** “Are these recent assignments that haven’t had a chance yet, or genuinely stale?”
**Feeling:** 😌 Productive. This is the list she came for.
**Pain:**
- Recent hires (assigned <30 days) get flagged unfairly.
- No way to mark a user as “protected” (exec, pilot cohort).
**Opportunity:**
- Auto-segment the idle list into **“never active”**, **“dormant 30–90 d”**, **“dormant 90+ d”**,
  and **“assigned <30 d (too new to judge)”**.
- Per-row action: **Mark as protected** with a reason field. Persists in our session store.
- Per-row action: **Open in M365 admin** (deep link) — the actual reclaim happens there, not here.

### Stage 4 — Package for the CIO

**Doing:** Exports the funnel chart as PNG, exports the idle list as CSV, drops both into an
email with three sentences.
**Thinking:** “The CIO will look at this for 15 seconds. The CFO will forward the CSV to a
finance analyst who will look at it for an hour.”
**Feeling:** 😊 Confident if the export looks the same as what she saw on screen.
**Pain:**
- PNG exports often lose the data-freshness caption and the definitions.
- CSV exports often have machine column names (`copilotChatLastActivityDate`) the analyst has
  to rename.
**Opportunity:**
- PNG export includes title, definition, threshold values, and `reportRefreshDate` baked in.
- CSV export uses the friendly column names already mapped in `FRIENDLY_NAMES` in
  `src/app/microsoft365/copilot/user-count/page.tsx`.
- “Copy CIO summary” button: produces a 3-line markdown block with the four numbers and a
  link back to the saved view.

### Stage 5 — Outcome

**Doing:** Sends the email Thursday afternoon. Returns the following Monday to re-check the
idle list — expects roughly the same 180 names (Copilot adoption doesn’t swing wildly week
to week).
**Thinking:** “If this list has changed by more than 20% week-over-week, something is wrong
*or* something is right — either way I want to know.”
**Feeling:** 😌 In control.
**Success metric:** A repeat visit takes **<2 minutes** because the saved view, threshold, and
protected-user list are all still there.

---

## Cohort funnel — conceptual structure

The headline chart for this journey:

```
Assigned     ████████████████████████  620
              ↓ 180 never opened a Copilot host
Enabled      █████████████████        500
              ↓ 60 opened a host but ran no Copilot action
Active       ████████████████          440
              ↓ 160 below threshold
ROI-positive ██████████               280
```

Each drop is clickable and produces a focused list. Each bucket label has an info icon that
opens the definition for that step in a popover (not a tooltip — popover keeps it readable on
screen readers and on touch).

---

## Edge cases the design must handle

1. **Zero Copilot SKUs assigned** — show empty state with link to “Assign Copilot licenses” in
   M365 admin; do not render an empty funnel.
2. **Report data unavailable** (Graph returns 403/404 because Reports Reader is missing) —
   surface the consent gap explicitly with a “Request consent” link, do not show “0 active.”
3. **Privacy mode** — if the tenant has enabled the M365 admin center setting that anonymises
   user-level reports, the per-user list must show a banner and disable export of names.
   Aggregate funnel still works.
4. **Mixed Copilot SKUs** (Copilot for M365 + Copilot for Sales + Copilot for Service) —
   default view aggregates; a SKU filter switches the funnel to one SKU at a time.
5. **Recent reorg** — if >10% of assigned users have an `assignedDateTime` <30 days, surface a
   banner: “ X% of assignments are new — ROI numbers will mature over the next 4 weeks.”
