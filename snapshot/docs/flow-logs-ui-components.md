# Flow Logs UI Components - Desktop Flow Logs V2

## Overview
Two UI components display Power Platform **Desktop Flow Logs V2** execution logs stored in Dataverse elastic tables. FlowLogs are **child records of FlowSession** (parent-child relationship) and must be queried through this relationship for proper permissions and data access.

## Important: Desktop Flow Logs V2 Configuration

### Prerequisites
Before using these components, ensure Desktop Flow Logs V2 is enabled:

1. **Power Platform Admin Center** → Select Environment → Settings → Features
2. Navigate to **Desktop flow run action logs configuration**
3. Set **Action logs version** to **V2 - Stored in the FlowLogs entity** (or **Both**)
4. Configure **FlowLogs entity time to live in minutes** (retention period)
5. Set **Action logs verbosity** level (Full, Debug, Custom, Warning, or Error)

### Key Points
- ✅ FlowLogs are stored in **elastic tables** (Cosmos DB backend)
- ✅ Only captures **desktop flows launched from cloud flows** (not local attended runs)
- ✅ Logs are **child records of FlowSession** (parent-child relationship)
- ✅ Permissions inherited from parent FlowSession record
- ✅ Automatic data retention via TTL (Time-to-Live)
- ✅ Supports up to 10 million actions per run (vs 50-80k in V1)

**Microsoft Documentation:** [Configure Desktop Flow Logs](https://learn.microsoft.com/en-us/power-automate/desktop-flows/configure-desktop-flow-logs)

## Components

### 1. FlowLogsModal Component
**Location:** `src/app/power-platform/flows/components/FlowLogsModal.tsx`

**Purpose:** Modal dialog for viewing flow execution logs, can be filtered to a specific workflow

**Props:**
```typescript
interface FlowLogsModalProps {
  instanceUrl: string;      // Dataverse environment URL
  workflowId?: string;       // Optional: filter logs by workflow
  workflowName?: string;     // Optional: display workflow name
  onClose: () => void;       // Close modal callback
}
```

**Features:**
- Summary statistics (Total Runs, Succeeded, Failed, Running)
- List view of all execution logs with status indicators
- Click log to view detailed information
- Color-coded status badges (green=success, red=failed, blue=running, yellow=cancelled)
- Duration calculation (ms, s, m, h)
- Error message display for failed runs
- Pagination support with "hasMore" indicator

**Usage:**
```tsx
import FlowLogsModal from './components/FlowLogsModal';

<FlowLogsModal
  instanceUrl="https://org.crm.dynamics.com"
  workflowId="workflow-guid-123"
  workflowName="My Flow"
  onClose={() => setShowLogs(false)}
/>
```

**Integration:**
Already integrated into [Power Platform Flows page](../src/app/power-platform/flows/page.tsx) - each flow card has a "View Execution Logs" button that opens this modal.

### 2. Flow Logs Page
**Location:** `src/app/power-platform/flow-logs/page.tsx`

**Purpose:** Standalone page for viewing all flow logs across all workflows in an environment

**Features:**
- Environment selector dropdown
- Summary statistics dashboard
- Status filter buttons (All, Succeeded, Failed, Running)
- Complete log list with search/filter
- Click log to view detailed information
- Responsive design for mobile/tablet/desktop
- Back button to return to flows page

**Access:**
- Direct URL: `/power-platform/flow-logs`
- Optional query param: `?environmentId=env-guid-123`

**API Endpoint Used:**
Both components use the existing API endpoint with parent-child relationship support:
```
GET /api/power-platform/dataverse/flowlogs?instanceUrl={url}&$top=100

# Query specific flow session:
GET /api/power-platform/dataverse/flowlogs?instanceUrl={url}&flowsessionId={guid}

# Filter by workflow:
GET /api/power-platform/dataverse/flowlogs?instanceUrl={url}&workflowId={guid}
```

**Query Methods:**
1. **Parent-child relationship** (specific session): `/flowsessions(guid)/flowsession_flowlog_parentobjectid`
2. **ExecuteCosmosSqlQuery** (all logs): Cosmos SQL query with optional filters

**Response Format:**
```json
{
  "value": [
    {
      "flowlogid": "log-guid",
      "createdon": "2026-01-23T10:00:00Z",
      "type": 100000001,
      "level": "Information",
      "cloudflowid": "workflow-guid",
      "cloudflowrunid": "run-guid",
      "desktopflowid": "desktop-flow-guid",
      "flowsessionid": "session-guid",
      "ttlinseconds": 129600,
      "data": {
        "startTime": "2026-01-23T10:00:00Z",
        "endTime": "2026-01-23T10:05:00Z",
        "status": "Succeeded",
        "workflowName": "My Approval Flow",
        "errorMessage": null,
        "errorCode": null
      },
      "starttime": "2026-01-23T10:00:00Z",
      "endtime": "2026-01-23T10:05:00Z",
      "status": "Succeeded",
      "workflowname": "My Approval Flow"
    }
  ],
  "hasMore": false,
  "pagingCookie": null,
  "queryMethod": "ExecuteCosmosSqlQuery"
}
```

## Data Source

### Elastic Table: flowlog (Desktop Flow Logs V2)
The `flowlog` table is an **elastic table** in Dataverse backed by Azure Cosmos DB. It stores desktop flow action logs as **child records of flowsession** (parent table).

### Parent-Child Relationship
- **Parent:** `flowsession` - Represents a flow execution session
- **Child:** `flowlog` - Action logs for that session
- **Relationship:** `flowsession_flowlog_parentobjectid`
- **Permissions:** Child records inherit permissions from parent FlowSession

### Query Methods

#### Method 1: Query Through Parent Relationship (Specific Session)
```http
GET [Org URL]/api/data/v9.0/flowsessions(aaaaaaaa-0000-1111-2222-bbbbbbbbbbbb)/flowsession_flowlog_parentobjectid
```
Returns all logs for a specific flow session.

#### Method 2: ExecuteCosmosSqlQuery (All Sessions)
```sql
SELECT TOP 50
  c.props.flowlogid as flowlogid,
  c.props.createdon as createdon,
  c.props.data as data,
  c.props.level as level,
  c.props.type as type,
  c.props.cloudflowid as cloudflowid,
  c.props.desktopflowid as desktopflowid,
  c.props.flowsessionid as flowsessionid
FROM c
WHERE c.props.type IN (100000001)
ORDER BY c.props.createdon DESC
```

**Note:** All column references must use `c.props.` prefix for elastic tables.

### Log Types
- `100000001` = Desktop flow action log type (primary type for V2)

### Data Structure
FlowLog V2 has a nested `data` property containing execution details:
- `data.startTime` - Action start time
- `data.endTime` - Action end time
- `data.status` - Execution status (Succeeded, Failed, etc.)
- `data.workflowName` - Flow name
- `data.errorMessage` - Error details if failed
- `data.errorCode` - Error code if failed

### Verbosity Levels
Logs V2 supports different verbosity levels (configured per environment or per flow):
- **Full** - All logs including system actions (default)
- **Debug** - Action outputs and results
- **Custom** - User-defined log messages + warnings/errors
- **Warning** - Warnings and errors only
- **Error** - Errors only

## Status Indicators

| Status | Icon | Color | Description |
|--------|------|-------|-------------|
| Succeeded | ✓ | Green | Flow completed successfully |
| Failed | ✗ | Red | Flow failed with error |
| Running | ⟳ | Blue | Flow currently executing |
| Cancelled | ⚠ | Yellow | Flow was cancelled |
| Unknown | ⏱ | Gray | Status not recognized |

## Duration Display
- Less than 1 second: `500ms`
- Less than 1 minute: `5.2s`
- Less than 1 hour: `12.5m`
- 1 hour or more: `2.3h`
- No end time: `In progress...`

## Error Handling

### Loading States
- Shows animated spinner while fetching data
- Displays "Loading flow logs..." message

### Error States
- Red banner with error icon
- User-friendly error message
- Technical details in console

### Empty States
- "No logs found" message when no data
- Helpful text explaining why (e.g., "No execution logs found for this flow")

## Performance Considerations

### Caching
Both components use SWR with 30-second cache:
```typescript
dedupingInterval: 30000  // Cache for 30 seconds
revalidateOnFocus: false // Don't refetch on tab focus
```

### Pagination
- Default: 100 logs per request (`$top=100`)
- Shows "More logs available" when `hasMore: true`
- Future enhancement: Implement paging with `PagingCookie`

### Partition Optimization
Optional `partitionId` parameter can be passed for better performance when querying specific workflows.

## Accessibility

- Modal dialogs have proper ARIA attributes (`role="dialog"`, `aria-modal="true"`)
- Close buttons have screen reader text (`<span className="sr-only">`)
- Keyboard navigation support (Escape to close)
- Focus management on modal open/close

## Mobile Responsiveness

- Grid layouts collapse to single column on mobile
- Text truncation with ellipsis for long workflow names
- Touch-friendly button sizes
- Horizontal scrolling for long IDs/error messages

## Future Enhancements

### Potential Features
1. **Real-time updates** - WebSocket or polling for running flows
2. **Export to CSV/Excel** - Download log data
3. **Date range filter** - Filter logs by time period
4. **Workflow filter dropdown** - Multi-select workflow filter
5. **Search functionality** - Search by workflow name, error message
6. **Performance metrics** - Average duration, success rate charts
7. **Retry failed runs** - Button to retry failed flow executions
8. **Full pagination** - Navigate through all pages of logs

### API Improvements
1. Implement `PagingCookie` for true pagination
2. Add date range query parameters
3. Support sorting by different columns
4. Add aggregation queries for statistics

## Related Documentation
- [Elastic Tables Implementation](./elastic-tables-implementation.md)
- [ExecuteCosmosSqlQuery API Reference](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/reference/executecosmossqlquery)
- [Query JSON Columns in Elastic Tables](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/query-json-columns-elastic-tables)
- [Power Platform Flow Logs API](./power-platform-flowlogs.md)

## Testing

### Test the Modal Component
1. Navigate to `/power-platform/flows`
2. Select an environment with flows
3. Click "View Execution Logs" on any flow card
4. Verify logs are displayed with correct status colors
5. Click a log to view detailed information
6. Close modal with X button or click outside

### Test the Standalone Page
1. Navigate to `/power-platform/flow-logs`
2. Select an environment from dropdown
3. Verify summary statistics are correct
4. Click status filter buttons (All, Succeeded, Failed, Running)
5. Click a log to view details
6. Test back button navigation

### Test Error States
1. Select environment without ExecuteCosmosSqlQuery support
2. Verify fallback message appears
3. Test with invalid environment URL
4. Verify error banner displays correctly
