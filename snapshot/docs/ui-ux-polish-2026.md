# Recent UI/UX Polish (2026)

A running log of small UI/UX-only changes that don't warrant their own
implementation doc but should be findable when someone asks "when did that
change?". Larger reworks continue to live in their own docs (e.g.
[`fabric-lakehouse-detail-view.md`](./fabric-lakehouse-detail-view.md),
[`MOBILE-RESPONSIVENESS-UPDATES.md`](./MOBILE-RESPONSIVENESS-UPDATES.md)).

---

## Navigation: Microsoft Fabric promoted to top level

**File:** `src/app/graph-explorer/nav-areas.ts`

The left-hand nav used to have a "**Data**" group whose only child was
"**Microsoft Fabric**", which then had its own submenu. That double nesting
buried every Fabric page one extra click deep and had no other siblings.

The **Data** group has been removed. **Microsoft Fabric** is now a top-level
nav entry containing the same items directly:

- Capacities
- Workspaces
- Warehouses
- SQL databases
- Notebooks
- Semantic models
- Reports
- Domains
- Lakehouses
- (and the other Fabric surface items previously nested one level deeper)

No page routes changed. Only the nav grouping was flattened.

---

## Azure › Service retirements: findings collapsed by default

**File:** `src/app/azure/service-retirements/page.tsx`

Each finding on `/azure/service-retirements` used to render fully expanded,
which forced heavy scrolling on tenants with many affected resources.

Each finding is now a collapsible section:

- Collapsed by default.
- Chevron in the header toggles open/closed.
- The **impact badge**, **affected-resource count**, and **countdown** stay
  visible in the collapsed header row, so operators can still triage at a
  glance without expanding.
- Expanding renders the full details (resource list, remediation, links).

No API changes; this is a pure client-state toggle.

---

## Azure › SQL databases: icon-based action buttons

**File:** `src/app/azure/sql-databases/page.tsx`

The per-row action bar on `/azure/sql-databases` previously used text buttons
("Start", "Pause", "Edit"). At the widths shared with the primary columns those
buttons wrapped onto two lines on narrower breakpoints and looked cluttered.

Actions are now icon buttons:

| Old text | New icon | Source |
|---|---|---|
| Start | `PlayIcon` | `@heroicons/react/24/outline` |
| Pause | `PauseIcon` | `@heroicons/react/24/outline` |
| Edit / properties | `Cog6ToothIcon` | `@heroicons/react/24/outline` |

The row also uses `flex-nowrap` so icons stay on a single line. Hover
tooltips (`title=`) preserve the original text labels for accessibility and
discoverability.

No behavior changed — same handlers, same confirmation dialogs, same API
routes underneath.
