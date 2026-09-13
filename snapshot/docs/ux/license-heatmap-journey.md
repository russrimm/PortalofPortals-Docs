# User Journey — License Utilization Heat Map

> Persona: Priya, M365 Licensing Admin. See `license-intelligence-jtbd.md` for full context.
> Trigger: Finance email — “EA renewal is in 90 days, give me a downgrade-candidate list per
> department.”

---

## Journey stages

### Stage 1 — Trigger & landing

**Doing:** Opens Portal 360° → Azure → License Usage. Today this shows totals only. New entry
point: a **Utilization** tab on the same page (keeps Priya in one mental location).
**Thinking:** “I need a per-user, per-workload view, scoped by department. SKU totals don’t
help finance.”
**Feeling:** 😥 Daunted. 4,200 rows × 12 columns is a lot to look at.
**Pain:**
- The current page is aggregate only.
- Department / cost-center attribute lives on the user object (`department`); finance asks by
  department, not by SKU.
**Opportunity:**
- Open on a **scoped view**, not the full tenant. First control on the page is a department
  picker, defaulting to “all” but obviously editable.
- Show a **summary strip** above the heat map: “In [Sales]: 412 users, 89 over-licensed, 31
  severely over-licensed.” Numbers click through to filter the grid.

### Stage 2 — Read the heat map

**Doing:** Scans the grid. Rows = users. Columns = workloads, grouped by SKU tier (E1 /
E3 / E5). Cell shading = activity intensity over last 28 days (none → light → medium → heavy).
A badge next to the user name shows their highest-tier SKU.
**Thinking:** “I want to see the rows where the E5 badge sits next to a row that’s only lit up
in the E1 columns.”
**Feeling:** 🤔 Wants the eye to be drawn to the right rows without having to scan all of them.
**Pain:**
- A literal heat map across 5,000 rows is unreadable and slow.
- Color-only encoding fails for color-blind users *and* in print.
**Opportunity:**
- Default sort: **“Over-licensed first”** (severely → over → right-sized → unassigned-but-active).
  Priya never has to scroll past the answer.
- Cell encoding: **color shade + numeric label** (“0”, “3”, “18”, “40+”) so it works in print
  and for screen readers.
- **Virtualised grid**, page size 50 rows, with sticky user column and sticky tier-group
  header row. Keyboard navigation cell-by-cell.
- **Tier dividers** (vertical rule between E1 / E3 / E5 column groups) so the eye can land on
  “E5 badge, nothing east of the E1 divider” in one glance.

### Stage 3 — Triage a row

**Doing:** Clicks a row to open a side panel showing: SKUs held, date each was assigned, last
activity per workload (numeric, not just shaded), manager, department, and a **“Suggested
action”** dropdown (“Keep”, “Review with manager”, “Downgrade to E3”, “Exclude — exec”,
“Exclude — compliance hold”).
**Thinking:** “There’s always a story behind these. The CFO is on E5 because the board’s on E5.
I need to capture the story so I don’t re-litigate it next quarter.”
**Feeling:** 😌 Empowered.
**Pain:**
- Without a way to record “why we kept this seat,” Priya re-does the same triage every quarter.
**Opportunity:**
- The Suggested-action selection and reason **persist per tenant** (session store today,
  Dataverse / Cosmos later).
- A “Reviewed by [Priya] on [date]” audit line, so finance can see the decision wasn’t random.
- Side panel uses the existing `portal-modal-panel` token noted in repo memory; do not
  introduce a new modal style.

### Stage 4 — Package for finance

**Doing:** Filters to “Severely over-licensed” + selected department, exports CSV.
**Thinking:** “Finance wants a flat list with: user, current SKU, suggested SKU, last activity
date per premium workload, and my note.”
**Feeling:** 😊 Confident.
**Pain:**
- A raw activity matrix CSV is too wide for a finance analyst.
**Opportunity:**
- Two export choices: **“Full matrix”** (everything on screen) and **“Finance summary”** (one
  row per user, current SKU, suggested SKU, last activity in highest-tier workload, reviewer
  note). Default to Finance summary because that’s the actual job.

### Stage 5 — Outcome

**Doing:** Sends the CSV. Returns next quarter; her reviewer notes are still attached to the
same users, so triage time drops from a day to an hour.
**Thinking:** “This is the first quarter I didn’t have to rebuild the spreadsheet.”
**Feeling:** 😌 Trust earned.
**Success metric:** Quarter-over-quarter, triage time per department drops by **≥50%**.

---

## Heat-map cell encoding spec

Never color-only. Every cell carries:

| Activity in last 28 days | Background      | Numeric label | Screen-reader text                       |
|--------------------------|-----------------|---------------|------------------------------------------|
| 0                        | Neutral / empty | `0`           | “No activity in Word in last 28 days”    |
| 1–2                      | Lightest tint   | actual count  | “Low activity: 2 days in last 28”        |
| 3–7                      | Mid tint        | actual count  | “Moderate activity: 5 days in last 28”   |
| 8–20                     | Strong tint     | actual count  | “Frequent activity: 14 days in last 28”  |
| 21+                      | Strongest tint  | `21+`         | “Daily activity in last 28”              |

Use the existing `portal-tile` shade ramp; do **not** introduce a red/green palette — it’s
culturally loaded (“red = bad person”) and fails color-blindness checks.

---

## Edge cases the design must handle

1. **User holds no license** — row is hidden by default, toggle in filter bar to show.
2. **User holds overlapping SKUs** (E3 + E5 add-on packs, or E5 plus a standalone Defender
   SKU) — badge shows the *effective* tier; side panel lists every SKU.
3. **Shared mailboxes / service accounts** — detected via `accountEnabled = false` or known
   service-account patterns; excluded by default, surfaced under a filter.
4. **Department attribute missing** — group those users under “Unassigned department”; do not
   silently drop them.
5. **Tenant >10k users** — default to “severely over-licensed only” for the initial render;
   warn that loading “all users” will page through Graph and may take a minute.
6. **Workload removed from M365** (a column we used to show no longer exists) — hide column,
   note in the data-freshness caption.
