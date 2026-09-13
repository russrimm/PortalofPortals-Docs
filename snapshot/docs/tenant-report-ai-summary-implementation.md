# Tenant Report AI Executive Summary Implementation

## Overview
Implemented AI-generated Executive Summary for tenant reports based on active Microsoft 365 service health issues. The summary is generated as part of the Word document, not as a UI element.

## Changes Made

### 1. Service Health Page Cleanup (`src/app/service-health/ServiceHealthTable.jsx`)
**REMOVED** incorrectly placed AI summary UI elements:
- Removed AI state variables: `aiSummary`, `aiLoading`, `aiError`, `showAiSummary`
- Removed `activeIssues` useMemo that filtered non-restored issues
- Removed `generateAiSummary` async function
- Removed entire "Active Service Issues" UI section with:
  - Generate AI Summary button
  - AI summary display area
  - Active issues table

**Reason**: User clarified that AI summary should be in the Word document, not on the service-health page UI.

### 2. Tenant Report AI Integration (`src/app/reports/tenant-reporting/page.jsx`)

#### A. Data Fetching
Added service health data fetching:
```javascript
const { data: serviceHealth, loading: serviceHealthLoading } = useApiData(
  '/api/graph/admin/serviceAnnouncement/healthOverviews?$expand=issues'
)
```

#### B. State Management
Added `serviceHealth: true` to `selectedSections` state to enable the feature by default.

Updated loading and data checks:
```javascript
const isLoading = ppLoading || azureLoading || advisorLoading || licensesLoading || 
                  usersLoading || devicesLoading || applicationsLoading || serviceHealthLoading

const hasData = ppEnvironments?.value || azureResources?.resources || azureAdvisor?.value || 
                licenses?.value || users?.value || devices?.value || applications?.value || 
                serviceHealth?.value
```

#### C. Executive Summary Generation
Added Executive Summary section in `generateTenantReport()` function, positioned **after the title page** and **before all other sections**:

**Process**:
1. Check if `serviceHealth` section is selected and data exists
2. Extract all active (non-restored) service health issues from all services
3. If active issues exist, call `/api/ai/service-health-summary` API
4. If AI summary generated successfully, add "Executive Summary" section to Word document
5. Include AI-generated summary text and active issue count

**Word Document Structure**:
```
- Title: "Executive Summary" (Heading 1)
- AI-generated summary paragraph (normal text)
- Active issue count (bold text)
```

**Error Handling**: If AI summary generation fails, the report continues without it (graceful degradation).

#### D. User Interface
Added Service Health checkbox with intelligent status display:
- Label: "AI Executive Summary (Service Health)"
- Loading state: "Loading..."
- Active issues: Shows count (e.g., "3 active issues")
- No issues: "All services healthy"
- No data: "No data"

The checkbox dynamically calculates active issue count client-side.

## Technical Details

### API Endpoints Used
1. **Service Health Data**: `GET /api/graph/admin/serviceAnnouncement/healthOverviews?$expand=issues`
   - Returns all Microsoft 365 services with their health status and issues
   - Expanded with issues to get detailed information

2. **AI Summary Generation**: `POST /api/ai/service-health-summary`
   - Accepts: `{ issues: Array<Issue> }`
   - Returns: `{ success: boolean, summary: string }`
   - Uses Azure OpenAI to generate concise executive summary

### Data Flow
```
User clicks "Generate Tenant Report"
  ↓
Check if serviceHealth section selected & data available
  ↓
Extract active (non-restored) issues from all services
  ↓
Call AI endpoint with active issues
  ↓
Add Executive Summary section to Word document with AI text
  ↓
Continue with other report sections (Power Platform, Azure, etc.)
  ↓
Generate and download Word document
```

### Active Issue Filtering
Issues are considered "active" if their `status !== 'serviceRestored'`. This includes:
- `serviceDegradation` - Service is degraded
- `extendedRecovery` - Extended recovery in progress
- `serviceInterruption` - Service is interrupted
- Any other non-restored status

## Testing Checklist

### Service Health Page
- [ ] Navigate to `/service-health`
- [ ] Verify NO "Generate AI Summary" button appears
- [ ] Verify NO "Active Service Issues" panel appears
- [ ] Page still displays service health data normally

### Tenant Report Generation
- [ ] Navigate to `/reports/tenant-reporting`
- [ ] Verify "AI Executive Summary (Service Health)" checkbox exists
- [ ] Verify checkbox shows active issue count or "All services healthy"
- [ ] Generate report with serviceHealth checked
- [ ] Verify Word document contains "Executive Summary" section after title page
- [ ] Verify summary describes active service issues accurately
- [ ] Verify "Active Issues: N" appears below summary

### Edge Cases
- [ ] Generate report with NO active service health issues
  - Should skip Executive Summary section entirely
- [ ] Generate report with serviceHealth unchecked
  - Should not call AI endpoint or add Executive Summary
- [ ] Test with AI endpoint failure
  - Report generation should continue without Executive Summary
  - Check console for error log

## Files Modified
1. `src/app/service-health/ServiceHealthTable.jsx` - Removed AI UI elements
2. `src/app/reports/tenant-reporting/page.jsx` - Added AI Executive Summary to Word document

## Dependencies
- Existing `/api/ai/service-health-summary` endpoint (already implemented)
- docx library for Word document generation
- Microsoft Graph API service health endpoint

## Notes
- Executive Summary only appears when there are active service health issues
- AI summary generation is asynchronous and happens during report generation
- If AI generation fails, report continues without the summary (no user error shown)
- The feature is opt-in via checkbox but enabled by default
- Summary appears on second page of Word document (after title page)
