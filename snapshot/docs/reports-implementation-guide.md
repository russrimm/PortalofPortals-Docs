# Microsoft 365 Usage Reports - Complete Implementation Guide

## Overview

The application now includes a comprehensive Microsoft 365 usage reporting system powered by the Microsoft Graph reportRoot API. This provides access to **70+ usage and activity reports** across all Microsoft 365 services.

## Features

### 📊 Reports Hub (`/reports`)

A centralized dashboard displaying all available Microsoft 365 usage reports, organized by category:

- **Microsoft 365 Active Users** (3 reports)
- **Microsoft 365 Apps Usage** (3 reports)
- **OneDrive Activity** (3 reports)
- **OneDrive Usage** (4 reports)
- **SharePoint Activity** (4 reports)
- **SharePoint Site Usage** (5 reports)
- **Outlook Activity** (3 reports)
- **Outlook App Usage** (4 reports)
- **Mailbox Usage** (4 reports)
- **Microsoft Teams User Activity** (3 reports)
- **Microsoft Teams Device Usage** (3 reports)
- **Microsoft 365 Groups** (5 reports)
- **Microsoft 365 Activations** (3 reports)
- **Microsoft 365 Copilot Usage** (3 reports - Beta)
- **Forms Activity** (3 reports - Beta)
- **Browser Usage** (3 reports - Beta)
- **Viva Engage (Yammer)** (5 reports)

### 🔧 Reusable Components

#### GraphReportPage Component

Located at `src/app/components/GraphReportPage.jsx`

A fully-featured, reusable React component for rendering any Microsoft Graph report with:

- ✅ Period selection (D7, D30, D90, D180)
- ✅ Date picker support
- ✅ CSV export functionality
- ✅ Dark mode support
- ✅ Loading and error states
- ✅ Automatic data formatting (dates, numbers, booleans)
- ✅ Pagination for large datasets
- ✅ Responsive table design

**Usage Example:**

```jsx
import GraphReportPage from '@/app/components/GraphReportPage'

export default function OneDriveActivityPage() {
  return (
    <GraphReportPage
      title="OneDrive Activity User Detail"
      apiEndpoint="/api/reports/onedrive-activity-user-detail"
      columns={[
        { key: 'userPrincipalName', label: 'User Principal Name' },
        { key: 'lastActivityDate', label: 'Last Activity Date', type: 'date' },
        { key: 'viewedOrEditedFileCount', label: 'Files Viewed/Edited', type: 'number' },
        { key: 'syncedFileCount', label: 'Files Synced', type: 'number' },
        { key: 'sharedInternallyFileCount', label: 'Files Shared Internally', type: 'number' },
        { key: 'sharedExternallyFileCount', label: 'Files Shared Externally', type: 'number' }
      ]}
      defaultPeriod="D30"
      supportsDate={true}
      description="Get details about OneDrive activity by user"
      docsUrl="https://learn.microsoft.com/en-us/graph/api/reportroot-getonedriveactivityuserdetail"
    />
  )
}
```

#### createGraphReportRoute Helper

Located at `src/app/api/reports/createGraphReportRoute.ts`

A factory function for creating Microsoft Graph report API routes with:

- ✅ Automatic authentication handling
- ✅ Period/date parameter validation
- ✅ Error handling with detailed messages
- ✅ Support for v1.0 and beta endpoints
- ✅ Logging for debugging

**Usage Example:**

```javascript
// src/app/api/reports/onedrive-activity-user-detail/route.js
import { createGraphReportRoute } from '@/app/api/reports/createGraphReportRoute'

export const GET = createGraphReportRoute({
  endpoint: 'getOneDriveActivityUserDetail',
  supportsPeriod: false,
  supportsDate: true
})
```

**Pre-configured Reports:**

The helper includes `ReportConfigs` object with 50+ pre-configured report settings:

```javascript
import { createGraphReportRoute, ReportConfigs } from '@/app/api/reports/createGraphReportRoute'

// Use pre-configured settings
export const GET = createGraphReportRoute(ReportConfigs.oneDriveActivityUserDetail)
```

## Implementation Status

### ✅ Fully Implemented Reports

1. **SharePoint Site Usage Detail** (`/reports/sharepoint-site-usage`)
   - API: `/api/reports/sharepoint-site-usage`
   - Endpoint: `getSharePointSiteUsageDetail`

2. **Office 365 Active User Counts** (`/reports/office365-active-user-counts`)
   - API: `/api/reports/office365-active-user-counts`
   - Endpoint: `getOffice365ActiveUserCounts`

3. **Microsoft 365 App User Counts** (`/reports/m365-app-user-counts`)
   - API: `/api/reports/m365-app-user-counts`
   - Endpoint: `getM365AppUserCounts`

4. **Teams User Activity Detail** (`/teams/user-activity`)
   - API: `/api/teams/user-activity`
   - Endpoint: `getTeamsUserActivityUserDetail`

### 🚧 Framework Ready (Easy to Implement)

All other reports can be implemented in **under 2 minutes** using the reusable components:

1. Create API route using `createGraphReportRoute` helper
2. Create page using `GraphReportPage` component
3. Define column mappings

**Example: Adding OneDrive Activity Report**

**Step 1:** Create API route (`src/app/api/reports/onedrive-activity-user-detail/route.js`)
```javascript
import { createGraphReportRoute, ReportConfigs } from '@/app/api/reports/createGraphReportRoute'
export const GET = createGraphReportRoute(ReportConfigs.oneDriveActivityUserDetail)
```

**Step 2:** Create page (`src/app/reports/onedrive-activity-user-detail/page.jsx`)
```jsx
import GraphReportPage from '@/app/components/GraphReportPage'

export default function Page() {
  return (
    <GraphReportPage
      title="OneDrive Activity User Detail"
      apiEndpoint="/api/reports/onedrive-activity-user-detail"
      columns={[
        { key: 'userPrincipalName', label: 'User', },
        { key: 'lastActivityDate', label: 'Last Activity', type: 'date' },
        { key: 'viewedOrEditedFileCount', label: 'Files Edited', type: 'number' }
      ]}
      supportsDate={true}
      description="OneDrive file activity by user"
      docsUrl="https://learn.microsoft.com/en-us/graph/api/reportroot-getonedriveactivityuserdetail"
    />
  )
}
```

Done! The report is now fully functional with period selection, CSV export, and dark mode.

## API Permissions Required

All reports require the `Reports.Read.All` permission in Microsoft Graph.

The report route factory uses **delegated** `Reports.Read.All` with administrator
consent and the signed-in user's report-capable Microsoft Entra role. It does not
fall back to application permissions. Microsoft Graph enforces the role requirements
for each report; a successful sign-in or token acquisition alone does not grant
report access. See [Microsoft Graph report authorization](https://learn.microsoft.com/graph/reportroot-authorization)
and the [delegated permission guidance](DELEGATED-PERMISSION-GAPS.md).

## Report Data Formats

### Period-based Reports

Support time periods: `D7`, `D30`, `D90`, `D180`

**API Call:**
```
GET /reports/{reportName}(period='D30')
```

**Example:**
```bash
curl https://graph.microsoft.com/v1.0/reports/getOffice365ActiveUserCounts(period='D30')
```

### Date-based Reports

Support specific date: `YYYY-MM-DD`

**API Call:**
```
GET /reports/{reportName}(date=YYYY-MM-DD)
```

**Example:**
```bash
curl https://graph.microsoft.com/v1.0/reports/getOneDriveActivityUserDetail(date=2025-11-29)
```

### Snapshot Reports

No parameters required (activations, etc.)

**API Call:**
```
GET /reports/{reportName}
```

## Column Types and Formatting

The `GraphReportPage` component automatically formats data based on column type:

| Type | Description | Example Input | Example Output |
|------|-------------|---------------|----------------|
| `string` | Plain text (default) | "user@domain.com" | "user@domain.com" |
| `number` | Numeric values with commas | 1234567 | "1,234,567" |
| `date` | ISO 8601 date strings | "2025-11-29" | "11/29/2025" |
| `boolean` | True/false values | true | "✅" |

**Column Definition:**

```javascript
{
  key: 'fieldName',        // Property name in API response
  label: 'Display Name',   // Column header
  type: 'number'          // Optional: string (default), number, date, boolean
}
```

## CSV Export

All reports include CSV export functionality:

1. Click **"📥 Export CSV"** button
2. File downloads automatically with format:
   - Filename: `{ReportTitle}_{Period}_{Date}.csv`
   - Example: `OneDrive_Activity_User_Detail_D30_2025-11-29.csv`
3. Includes all records (table shows first 100)
4. Properly escapes commas and quotes
5. Formats dates and numbers

## Error Handling

The system handles common errors gracefully:

### Authentication Errors (401)
- **Cause:** Expired or missing access token
- **Message:** "Authentication failed. Please sign in again."
- **Action:** User redirected to sign-in

### Permission Errors (403)
- **Cause:** Missing `Reports.Read.All` permission
- **Message:** "Permission denied. Required permission: Reports.Read.All"
- **Action:** Admin must grant consent in Azure AD

### Not Found Errors (404)
- **Cause:** Report has no data for selected period
- **Message:** "Report not found or no data available"
- **Action:** Try different time period

### Invalid Parameters (400)
- **Cause:** Invalid period (must be D7, D30, D90, D180) or date format
- **Message:** Detailed validation error
- **Action:** Correct the parameter

## Performance Considerations

### Server-side authorization and caching

`createGraphReportRoute` does not retain report results in a process-wide cache.
Every valid authenticated request acquires the current server-side delegated
context and calls Microsoft Graph, including repeated requests and requests
through route aliases. Both the Graph request and any redirected CSV download use
`cache: 'no-store'`; successful route responses send `Cache-Control: private, no-store`.
No report cache key is derived from browser-supplied caller or tenant identifiers.

The factory therefore adds no cache grace period after Microsoft Graph begins
denying a revoked permission or role. Microsoft identity/provider propagation and
existing token acquisition behavior still determine when that denial takes effect.
Already delivered client data cannot be recalled. Repeated requests now incur a
Graph request and parsing work rather than a five-minute private-cache hit, so
latency and throttling exposure can increase.

This policy covers the shared report factory, including its Microsoft 365 Copilot
aliases. Separate aggregate-model and client-side caches are not changed by it.
CSV/JSON parsing, empty results, parameter validation, and error response contracts
remain unchanged.

### Large Datasets

- **Table displays first 100 records** for performance
- **CSV export includes all records** (can be thousands)
- **Loading indicator** shows while fetching
- **Pagination** planned for future enhancement

### Caching with SWR

Reports use SWR (stale-while-revalidate) for caching:

- **First load:** Fetches from API
- **Subsequent loads:** Shows cached data immediately
- **Background refresh:** Updates cache automatically
- **Period change:** Fetches new data

## Roadmap

### Short-term Enhancements

- [ ] Implement all 70+ reports (2 min each with framework)
- [ ] Add charting/visualization to numeric reports
- [ ] Server-side pagination for large datasets
- [ ] Advanced filtering and search
- [ ] Scheduled report emails
- [ ] Report favorites and recent reports

### Medium-term Enhancements

- [ ] Custom date ranges (start/end date)
- [ ] Multi-tenant support for MSPs
- [ ] Report comparison (period over period)
- [ ] Excel export with formatting
- [ ] PowerBI integration
- [ ] Custom report builder

### Long-term Enhancements

- [ ] Real-time report updates (WebSockets)
- [ ] Predictive analytics and trends
- [ ] AI-powered insights and anomaly detection
- [ ] White-label reporting for MSPs
- [ ] API for external integrations

## Testing

### Manual Testing Checklist

For each new report:

- [ ] Report loads without errors
- [ ] Period selector works (D7, D30, D90, D180)
- [ ] Date picker works (if applicable)
- [ ] Data displays in table correctly
- [ ] Column formatting is correct (dates, numbers)
- [ ] CSV export downloads successfully
- [ ] CSV contains all records
- [ ] Dark mode displays correctly
- [ ] Loading state shows while fetching
- [ ] Error states display properly
- [ ] Mobile responsive layout works

### API Testing

```bash
# Test API endpoint directly
curl -H "Authorization: Bearer {token}" \
  "http://localhost:3000/api/reports/onedrive-activity-user-detail?period=D30"

# Expected response
{
  "value": [
    {
      "userPrincipalName": "user@domain.com",
      "lastActivityDate": "2025-11-29",
      "viewedOrEditedFileCount": 42,
      ...
    }
  ]
}
```

## Troubleshooting

### "Reports.Read.All permission not granted"

**Solution:**
1. Go to Azure AD → App Registrations → Your App
2. API Permissions → Add Permission
3. Microsoft Graph → Application Permissions
4. Search for "Reports" → Select Reports.Read.All
5. Grant admin consent

### "No data available for the selected period"

**Causes:**
- Organization has no activity in that time frame
- Report requires 24-48 hours to populate after first use
- Date selected is in the future

**Solution:**
- Try longer period (D90 instead of D7)
- Check Microsoft 365 Admin Center → Reports for data
- Wait 24-48 hours after enabling reports

### CSV export shows garbled characters

**Cause:** Excel opening UTF-8 CSV incorrectly

**Solution:**
- Open CSV in Excel using "Data" → "From Text/CSV"
- Select UTF-8 encoding
- Or use Google Sheets (handles UTF-8 correctly)

## References

- [Microsoft Graph reportRoot API Reference](https://learn.microsoft.com/en-us/graph/api/resources/reportroot?view=graph-rest-beta)
- [Microsoft 365 Reports Overview](https://learn.microsoft.com/en-us/microsoft-365/admin/activity-reports/activity-reports)
- [Reports.Read.All Permission](https://learn.microsoft.com/en-us/graph/permissions-reference#reportsreadall)
- [Next.js App Router client-side fetching](https://nextjs.org/docs/app/getting-started/fetching-data#client-side-data-fetching)
- [Next.js API Routes](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)

---

**Last Updated:** November 29, 2025  
**Status:** ✅ Framework Complete, Reports Hub Live  
**Next Steps:** Implement individual report pages using framework
