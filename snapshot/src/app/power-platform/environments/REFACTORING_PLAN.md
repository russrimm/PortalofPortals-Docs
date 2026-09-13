# Power Platform Environments Page Refactoring Plan

## Current State
- **File:** `src/app/power-platform/environments/page.jsx`
- **Size:** 7,549 lines
- **Status:** Monolithic JSX file requiring TypeScript migration

## Refactoring Strategy

### Guardrails (Do This Every Step)
- **Behavior first**: No UI/logic changes; only extract and wire.
- **Small slices**: 100-300 lines per change; stop when it works.
- **One concern per PR**: Avoid mixing UI tweaks or feature changes.
- **Prefer extraction over rewrites**: Move code into components/hooks, keep props and return values identical.
- **Verify quickly**: Load the page, expand 2 environments, open 2 modals, change tabs, verify filters.

### Documentation Workflow (What Works / What Doesn't)
- Log each extraction in [REFACTORING_LOG.md](REFACTORING_LOG.md).
- Track: what moved, what broke, fixes, and time spent.
- Capture patterns that repeat (e.g., props explosion, stale closures, event handlers needing `useCallback`).

### Phase 1: Extract Foundation (✅ COMPLETED)
1. ✅ **constants.ts** - All constants and configuration
2. ✅ **types.ts** - TypeScript interfaces and types
3. ✅ **utils.ts** - Utility functions

### Phase 2: Extract Tab Components (PARTIALLY COMPLETE - 2/3 ✅)
Create three tab components to break up the main UI:

1. ✅ **tabs/SummaryTab.tsx** (335 lines) - **COMPLETED**
   - Environment summary cards with type counts
   - Environment type badges with CHART_COLORS
   - Storage overview (database, file, log metrics)
   - Capacity metrics with progress bars
   - Resource Analytics sections (by environment, by owner, recently created)
   - Props: summaryData, inventoryMetrics, inventoryModal, inventoryQueryData
   - Status: 0 TypeScript errors, ready to use

2. ✅ **tabs/AnalyticsTab.tsx** (250 lines) - **COMPLETED**
   - Resource analytics with 3 pie charts (environment count, owner count, recent resources)
   - Loading/error states for each section
   - Data tables with sortable columns
   - Uses StoragePieChart component with proper children prop
   - Props: inventoryQueryData, inventoryModal
   - Status: 0 TypeScript errors, ready to use
   - Fixed: Added children={null} to StoragePieChart, formatResourceType fallback

3. ⚠️ **tabs/DetailsTab.tsx** (~1,766 lines) - **DEFERRED**
   - **Complexity**: Extremely high (15+ resource modals, governance controls, deep state)
   - Environment card grid with pagination
   - Search/filter/sort controls
   - Expanded environment details with 3 sections (overview, governance, resources)
   - Teams, apps, flows, connectors, Power Pages management
   - Dataverse tables, solutions, audit logs, transcripts
   - Governance: Managed Environments, Enable/Disable, Backups, Failover, Delete
   - **Status**: Requires careful extraction to avoid breaking functionality
   - **Recommendation**: Extract after main page refactor or during TypeScript migration

## Phase 2 Accomplishments

**What Was Extracted:**
- **SummaryTab.tsx**: 335 lines (was ~800 lines inline)
- **AnalyticsTab.tsx**: 250 lines (was ~500 lines inline)
- **Total extracted**: 585 lines into focused components

**Impact on Main Page:**
- Reduced inline JSX by ~1,300 lines
- Created reusable tab components with clear props interfaces
- Improved code organization and maintainability
- 0 TypeScript errors in extracted components

**Why DetailsTab Was Deferred:**
The DetailsTab section (1,766 lines) contains:
- 15+ distinct resource modal states and handlers
- Complex governance operations (enable/disable/backup/failover/delete)
- Deep environment state management (expanded, transient, selected sections)
- Tightly coupled action handlers that need careful extraction
- Risk of introducing infinite render loops if state dependencies break

**Recommended Next Steps:**
1. Continue TypeScript migration with smaller files (200-400 lines)
2. Build up experience with Next.js 15 patterns (await searchParams, etc.)
3. Return to DetailsTab extraction with more context and confidence
4. Alternatively, migrate entire page to TSX first, then refactor

### Phase 3: Extract Modal Management (PENDING)
Create **hooks/useModalManagement.ts** (~300-400 lines)
Consolidate all modal states:
- membersModal
- botsModal
- solutionsModal
- analysisModal
- teamsModal
- tablesModal
- flowsModal
- flowRunsModal
- inventoryModal

**Gradual approach:**
1. Extract a single modal state + open/close helpers.
2. Pass through existing setters (no API changes).
3. Replace usage in one place, verify, then move the next modal.

### Phase 4: Extract Data Fetching Logic (PENDING)
Create **hooks/useEnvironmentOperations.ts** (~400-500 lines)
Consolidate data fetching functions:
- fetchStorageHistory
- fetchMembers
- fetchBots
- fetchSolutions
- fetchTeams
- fetchTables
- fetchFlows
- fetchFlowRuns
- loadInventoryQueries

**Gradual approach:**
1. Extract one fetcher at a time with identical signatures.
2. Keep error handling intact (same messages and fallbacks).
3. Verify response shapes by logging once per extraction (remove after).

### Phase 5: Extract Action Handlers
Create **actions/** folder:

1. **environmentActions.ts** (~300-400 lines)
   - deleteEnvironment
   - enableEnvironment
   - disableEnvironment
   - setManagedEnvironment
   - triggerFailover

2. **solutionActions.ts** (~400-500 lines)
   - exportSolution
   - downloadSolution
   - analyzeSolution
   - sendToFlow

3. **flowActions.ts** (~200-300 lines)
   - viewFlowRuns
   - authenticateFlow
   - viewFlowDiagram

### Phase 6: Main Page Restructure
**page.tsx** (target: ~400-600 lines)
- Import all extracted components
- Main layout structure
- Tab switching logic
- Modal orchestration
- Error boundary wrapper

**Gradual approach:**
1. Move one UI section per step (header, tabs, content, footer).
2. Keep state in `page.jsx` until components are stable.
3. Only migrate to TSX after UI extraction is stable.

## File Structure (Target)

```
src/app/power-platform/environments/
├── page.tsx                    (400-600 lines) ← Main entry point
├── constants.ts                (✅ 60 lines)
├── types.ts                    (✅ 180 lines)
├── utils.ts                    (✅ 120 lines)
├── envStyles.js               (existing, keep)
│
├── components/
│   ├── EnvironmentCard.jsx    (existing, migrate later)
│   ├── EnvironmentCardHeader.jsx (existing, migrate later)
│   └── PaginationControls.jsx (existing, migrate later)
│
├── tabs/
│   ├── SummaryTab.tsx         (800-1000 lines) ← NEW
│   ├── DetailsTab.tsx         (2000-2500 lines) ← NEW
│   └── AnalyticsTab.tsx       (500-800 lines) ← NEW
│
├── hooks/
│   ├── useDebouncedExpansion.js (existing)
│   ├── useEnvironmentSummary.js (existing)
│   ├── useFlowCounts.js        (existing)
│   ├── useModalManagement.ts   (NEW, ~300 lines)
│   └── useEnvironmentOperations.ts (NEW, ~400 lines)
│
├── actions/
│   ├── environmentActions.ts  (NEW, ~300 lines)
│   ├── solutionActions.ts     (NEW, ~400 lines)
│   └── flowActions.ts         (NEW, ~200 lines)
│
└── modals/
    ├── BotsModal.tsx           (existing)
    ├── MembersModal.tsx        (existing)
    ├── AnalysisModal.tsx       (existing)
    ├── FlowRunsModal.tsx       (existing)
    ├── TableDataModal.tsx      (existing)
    └── AuditModal.tsx          (existing)
```

## Expected Outcome
- **Before:** 1 file, 7,549 lines (unmaintainable)
- **After:** ~15-20 focused files, ~500-2500 lines each (maintainable)
- **Main page:** Reduced to ~500 lines
- **TypeScript:** All new files in TypeScript
- **Testability:** Much improved with isolated components
- **Reusability:** Components can be reused across pages

## Migration Order
1. ✅ Extract constants, types, utils
2. ⏳ Extract SummaryTab component
3. ⏳ Extract DetailsTab component
4. ⏳ Extract AnalyticsTab component
5. ⏳ Extract modal management hook
6. ⏳ Extract data fetching hook
7. ⏳ Extract action handlers
8. ⏳ Update main page.tsx to use extracted components
9. ⏳ Test thoroughly
10. ⏳ Migrate remaining .jsx components to .tsx

## Suggested Micro-Steps (First 2-3 Sessions)
1. **Extract SummarySkeleton + EnvironmentCardSkeleton**
   - Move into `components/EnvironmentLoadingSkeletons.tsx` (keep same output).
2. **Extract Tabs Bar**
   - Move tabs header into `components/EnvironmentTabs.tsx` with `activeTab` + handlers.
3. **Extract Search/Filter Row (Details Tab)**
   - Move filter UI into `components/EnvironmentFilters.tsx`.
4. **Extract Pagination Controls Usage**
   - Wrap pagination logic into `components/EnvironmentPagination.tsx` (pure UI).

## Quick Verification Checklist (Per Step)
- Page renders, no console errors
- Tabs switch and selected tab state persists
- At least one environment expands/collapses
- Open two modals (e.g., Flows, Apps) and close them
- Search/filter still filters the list

## Stop/Backtrack Signals
- Infinite re-render loop
- Environment card actions stop responding
- Modal no longer opens or shows blank content
- Filters/pagination produce different results than before

## Notes
- Keep existing functionality 100% intact
- No breaking changes to API or behavior
- Incremental migration allows for testing at each step
- Can be done in parallel with other TypeScript migrations
