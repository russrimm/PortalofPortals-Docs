# Flow Specification — License Intelligence

> Handoff document for the design team (Figma) and the engineers who will wire it.
> Companion to:
> - `license-intelligence-jtbd.md`
> - `copilot-roi-journey.md`
> - `license-heatmap-journey.md`

---

## Information architecture

Two features, two homes (kept close to the existing pages users already know):

```
Microsoft 365
  Copilot
    User count            (existing  — /microsoft365/copilot/user-count)
    Readiness & ROI       (NEW       — /microsoft365/copilot/roi)

Azure
  License usage           (existing  — /azure/license-usage)
    ├ Overview tab        (existing aggregate charts)
    └ Utilization tab     (NEW       — /azure/license-usage/utilization)
```

**Route registry entries to add** (per `.github/copilot-instructions.md` rule):

```ts
// lib/route-registry.ts
'/microsoft365/copilot/roi': {
  title: 'Readiness & ROI',
  navigable: true,
  parent: '/microsoft365/copilot',
},
'/azure/license-usage/utilization': {
  title: 'Utilization heat map',
  navigable: true,
  parent: '/azure/license-usage',
},
```

---

## Flow A — Copilot Readiness & ROI

**Entry:** Microsoft 365 → Copilot → Readiness & ROI tab.

**Screen 1 — Funnel overview**
- Page header: “Copilot Readiness & ROI” + data-freshness caption “As of YYYY-MM-DD, from
  Microsoft Graph usage reports (updates every 24–48 h).”
- Hero: four-bucket horizontal funnel (Assigned → Enabled → Active → ROI-positive) with
  drop-off labels between buckets.
- Below funnel: threshold editor, collapsed by default —
  “ROI-positive = ≥ [5] Copilot interactions/week across ≥ [2] hosts for [4] of the last [8]
  weeks. [Save as tenant default]”
- Right of funnel: three KPI cards — “Assigned seats,” “Active seats,” “Idle seats (reclaim
  candidates).” Each clickable, scrolls to filtered list.
- Filter strip: SKU (Copilot for M365 / Sales / Service / All), Department, Date range.

**Screen 2 — Cohort list (loads when a funnel bucket is clicked)**
- Tab strip across the top of the list: “Never active,” “Dormant 30–90 d,” “Dormant 90+ d,”
  “Assigned <30 d.” Counts in each tab.
- Table columns: User, Department, SKU, Assigned date, Last Copilot activity, Last host used,
  Status (“Protected” badge if marked), Actions.
- Row action menu: **Mark as protected** (opens reason field), **Open in M365 admin**
  (external link), **View timeline** (opens side panel with 8-week activity sparkline).
- Bulk actions on selection: **Mark protected**, **Export selection (CSV)**.

**Screen 3 — Saved view & export**
- “Save view” button persists current filters + threshold under a name (“Q2 renewal pass 1”).
- “Export” split button: PNG of funnel chart · CSV of current list · “Copy CIO summary”
  (markdown to clipboard).

**Exits**
- Success: CSV downloaded / summary copied / link to saved view shared.
- Partial: “I’ll come back to this” → saved view captures state.
- Blocked: Graph 403 → friendly empty state explaining the consent gap, no scary error trace.

---

## Flow B — License Utilization Heat Map

**Entry:** Azure → License usage → Utilization tab.

**Screen 1 — Scoped summary**
- Page header reuses the existing License Usage page header so the user knows they are still
  in the same workspace.
- Filter row (first thing on the page): Department picker (default “All”), SKU picker, Status
  filter (Right-sized / Over-licensed / Severely over-licensed / Unassigned-but-active /
  All), Include service accounts toggle (off by default).
- Summary strip: 4 stat cards reflecting the filter — each clickable to set the Status filter.
- Data-freshness caption identical to Flow A.

**Screen 2 — Heat-map grid**
- Sticky user column on the left (name, department, effective-tier badge).
- Workload columns grouped under tier headers “E1-tier workloads,” “E3-tier workloads,”
  “E5-tier workloads,” with vertical dividers between tier groups.
- Cells: background tint + numeric label, per the encoding table in
  `license-heatmap-journey.md`.
- Default sort: severity (severely over-licensed first), then alphabetical by user.
- Virtualised, 50 rows per page, with keyboard cell navigation.
- Row click → side panel (Screen 3). Does **not** navigate away.

**Screen 3 — Per-user side panel**
- Use the existing `portal-modal-panel` token (see repo-memory note).
- Sections: Identity (name, department, manager, account state), SKUs held (with assigned
  date), Activity matrix (numeric, last 28 days, per workload), Suggested action dropdown
  with reason field, Audit trail (“Reviewed by X on YYYY-MM-DD”).
- Footer actions: “Save”, “Open in M365 admin,” “Close.”

**Screen 4 — Export**
- Split button: **Finance summary (CSV)** (default) · **Full matrix (CSV)** · **PDF of
  current view**.

**Exits**
- Success: CSV downloaded, reviewer notes saved.
- Partial: Reviewer notes persist; user can come back next quarter.
- Blocked: Graph throttling → surface retry-after, do not silently fail.

---

## Design principles (apply to both flows)

1. **Definitions live on the chart.** Any number that depends on a threshold must show the
   threshold next to the number. No hidden assumptions.
2. **Cohorts before verdicts.** Surface the *list of users in a bucket*; never tell the admin
   what to do. “Reclaim” is a button in *the other* admin tool, not here.
3. **One mental location.** Both features live next to existing pages users already use
   (`/microsoft365/copilot/...` and `/azure/license-usage/...`). No new top-level nav.
4. **Reuse the theme tokens.** `portal-card`, `portal-tile`, `portal-tile-icon`,
   `portal-modal-panel`. No bespoke colors, no new modal patterns.
5. **Print- and screenshot-friendly.** Exports must include title, definition, threshold
   values, and `reportRefreshDate` baked into the image / CSV header.
6. **Trust before action.** Data-freshness caption is *always* visible. If data is >72 h old,
   escalate to a warning banner.

---

## Accessibility requirements (for Figma implementation)

### Keyboard
- [ ] Funnel buckets are buttons — reachable by Tab, activated by Enter/Space.
- [ ] Heat-map grid supports arrow-key cell navigation (left/right/up/down), Home/End for
      row start/end, Page Up/Down for paging.
- [ ] Side panels open with focus on the first interactive control; Escape closes; focus
      returns to the originating row.
- [ ] Bulk-select checkboxes reachable in tab order before row content.

### Screen reader
- [ ] Funnel announces “Bucket: Active. 440 users. 71% of assigned. Click to view list.”
- [ ] Heat-map cells announce “[User] [Workload]: [N] active days in last 28.”
- [ ] Status changes (filter applied, view saved, export started) announced via live region.
- [ ] Tier-group column headers use `<th scope="colgroup">` so the workload → tier
      relationship is exposed.
- [ ] Effective-tier badge has visible text *and* `aria-label` (“Effective tier: E5”), not
      color-only.

### Visual
- [ ] Cell encoding = color shade **plus** numeric label. Never color alone.
- [ ] Contrast ≥ 4.5:1 for text on every shade in the ramp; verify the darkest *and* lightest
      shades against light and dark theme backgrounds.
- [ ] Focus ring is 2 px, uses the existing portal focus token, visible on all backgrounds
      including the strongest heat-map shade.
- [ ] Page layout holds together at 200% zoom and at 1366×768 (Priya’s laptop).
- [ ] Print stylesheet: heat map renders with hatching patterns in addition to shades so it
      survives a black-and-white print to PDF.

### Error & empty states
- [ ] Missing consent (Reports Reader) — explicit message, link to consent flow, no stack
      trace.
- [ ] Privacy-mode tenant — banner explains anonymisation; aggregate views still work, name
      columns and name-bearing exports are disabled.
- [ ] Zero data in a bucket — friendly empty state, not a blank space.

---

## Data × UI mapping (for engineers reading this)

| UI element                          | Source of truth                                                          |
|-------------------------------------|---------------------------------------------------------------------------|
| “Assigned” bucket count             | `subscribedSkus` + `users?$select=assignedLicenses` (Copilot SKU IDs)     |
| “Enabled” bucket count              | `getOffice365ActiveUserDetail` filtered to Copilot-host activity in 28 d  |
| “Active” bucket count               | `getMicrosoft365CopilotUsageUserDetail` — any `*CopilotLastActivityDate` |
| “ROI-positive” bucket count         | Same report, with the threshold applied client-side                      |
| Heat-map cell activity values       | `getOffice365ActiveUserDetail` (per workload, 28-day window)              |
| Effective-tier badge                | Computed from `assignedLicenses` against a SKU→tier lookup table         |
| Reviewer notes / protected flags    | Session store today, Dataverse or Cosmos when promoted out of preview    |
| Data-freshness caption              | `reportRefreshDate` from any usage-report response                       |

> The SKU→tier and SKU→workload lookup tables are the *only* new reference data this feature
> needs. Maintain them in `lib/licensing/sku-catalog.ts` so they are versioned with the code.

---

## Handoff checklist

For the Figma designer:
- [ ] Build the funnel in Figma using the existing `portal-card` and `portal-tile` styles.
- [ ] Design the editable threshold control as an inline form, not a modal.
- [ ] Mock the heat map at 50 rows × 12 columns at the 1366×768 breakpoint and at 1920×1080.
- [ ] Mock the per-user side panel using `portal-modal-panel`.
- [ ] Produce empty, loading, partial-consent, privacy-mode, and >72 h-stale states for
      both flows.
- [ ] Validate all color shades against the existing `portal-*` ramp for WCAG AA contrast.

For engineering, before any code is written:
- [ ] Confirm SKU→tier mapping with the licensing team (one source of truth, please).
- [ ] Confirm threshold defaults with the persona, not invented in code.
- [ ] Confirm the privacy-mode behavior matches the tenant’s legal/HR position.
- [ ] Register the two new routes in `lib/route-registry.ts` (per copilot-instructions).
- [ ] Plan for the per-row reviewer-note persistence story (session store → Dataverse).

---

## Success metric (single, shared)

A licensing admin can produce **a defensible renewal recommendation** — cohort sizes, a list
of candidate seats, and a one-line summary for the CIO — in **under 15 minutes per quarter**,
for both Copilot and the broader E5 estate, without exporting to Excel.
