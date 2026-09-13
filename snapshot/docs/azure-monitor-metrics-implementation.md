# Azure Monitor Metrics Implementation

## Overview
Implemented a comprehensive Azure Monitor Metrics explorer page that allows users to browse and query metric definitions and time series data for Azure resources.

## Implementation Date
January 2025

## Features

### 1. Resource Selection
- **Resource Type Filter**: Select from 5 common Azure resource types:
  - Virtual Machines
  - Storage Accounts
  - SQL Databases
  - Log Analytics Workspaces
  - App Services

- **Resource Dropdown**: Automatically populated when a resource type is selected
  - Shows resource name, type, and location
  - Fetches resources from Azure Resource Graph API

### 2. Metric Definitions Tab
Displays available metrics for the selected resource:
- **Metric Name**: Full name of the metric
- **Unit**: Unit of measurement (e.g., Count, Bytes, Percent)
- **Aggregations**: Supported aggregation types (Average, Minimum, Maximum, Total, Count)
- **Dimensions**: Available dimensions for filtering

### 3. Metric Values Tab
Query and display time series data:
- **Metric Selector**: Choose from available metrics
- **Time Range**: ISO 8601 duration format (PT1H, PT6H, P1D, P7D, P30D)
- **Aggregation**: Select aggregation type
- **Interval**: Time grain for data points

**Data Display**:
- Metadata: Resource ID, timespan, interval
- Data Points Table: Timestamp and value for each data point

## API Endpoints

### 1. `/api/azure/metrics/definitions` (POST)
Fetches available metric definitions for a resource.

**Request Body**:
```json
{
  "resourceId": "/subscriptions/{sub}/resourceGroups/{rg}/providers/{provider}/{resource}"
}
```

**Response**:
```json
{
  "success": true,
  "definitions": [
    {
      "name": { "value": "Percentage CPU", "localizedValue": "Percentage CPU" },
      "unit": "Percent",
      "primaryAggregationType": "Average",
      "supportedAggregationTypes": ["Average", "Minimum", "Maximum"],
      "dimensions": []
    }
  ]
}
```

### 2. `/api/azure/metrics/values` (POST)
Fetches time series data for a specific metric.

**Request Body**:
```json
{
  "resourceId": "/subscriptions/{sub}/resourceGroups/{rg}/providers/{provider}/{resource}",
  "metricName": "Percentage CPU",
  "timeRange": "PT1H",
  "aggregation": "Average",
  "interval": "PT5M"
}
```

**Time Range Formats**:
- `PT1H` - Past 1 hour
- `PT6H` - Past 6 hours
- `PT12H` - Past 12 hours
- `P1D` - Past 1 day
- `P7D` - Past 7 days
- `P30D` - Past 30 days

**Response**:
```json
{
  "success": true,
  "metric": {
    "id": "...",
    "name": { "value": "Percentage CPU", "localizedValue": "Percentage CPU" },
    "unit": "Percent",
    "timespan": "2024-01-01T00:00:00Z/2024-01-01T01:00:00Z",
    "interval": "PT5M",
    "timeseries": [
      {
        "data": [
          { "timeStamp": "2024-01-01T00:00:00Z", "average": 15.5 }
        ]
      }
    ]
  }
}
```

### 3. `/api/azure/resources` (GET)
Queries Azure resources by type using Resource Graph API.

**Query Parameters**:
- `resourceType`: One of: `virtualmachines`, `storageaccounts`, `sqldatabases`, `loganalyticsworkspaces`, `appservices`

**Response**:
```json
{
  "success": true,
  "resources": [
    {
      "id": "/subscriptions/{sub}/resourceGroups/{rg}/providers/{provider}/{resource}",
      "name": "myvm",
      "type": "microsoft.compute/virtualmachines",
      "location": "eastus",
      "resourceGroup": "myrg"
    }
  ]
}
```

## Azure API Integration

### Authentication
All API endpoints use session-based authentication with Azure AD access tokens:
```javascript
const session = await getServerSession(authOptions)
if (!session?.accessToken) {
  return NextResponse.json({ success: false, requiresAuth: true }, { status: 401 })
}
```

### Azure Monitor REST API
- **Base URL**: `https://management.azure.com`
- **Metric Definitions API Version**: `2018-01-01`
- **Metric Values API Version**: `2019-07-01`

### Azure Resource Graph API
- **Endpoint**: `https://management.azure.com/providers/Microsoft.ResourceGraph/resources`
- **API Version**: `2021-03-01`
- **Query Language**: KQL (Kusto Query Language)

## Time Range Parsing

The implementation includes ISO 8601 duration parsing:

```javascript
function parseDuration(duration) {
  // PT format: hours/minutes
  if (duration.startsWith('PT')) {
    const hours = duration.match(/(\d+)H/)
    const minutes = duration.match(/(\d+)M/)
    return (parseInt(hours?.[1] || 0) * 60 + parseInt(minutes?.[1] || 0)) * 60 * 1000
  }
  // P format: days
  if (duration.startsWith('P')) {
    const days = duration.match(/(\d+)D/)
    return parseInt(days?.[1] || 1) * 24 * 60 * 60 * 1000
  }
  return 60 * 60 * 1000 // Default: 1 hour
}
```

## UI Components

### Resource Selection
```jsx
<select onChange={(e) => setResourceType(e.target.value)}>
  <option value="">Select resource type...</option>
  <option value="virtualmachines">Virtual Machines</option>
  <option value="storageaccounts">Storage Accounts</option>
  <option value="sqldatabases">SQL Databases</option>
  <option value="loganalyticsworkspaces">Log Analytics Workspaces</option>
  <option value="appservices">App Services</option>
</select>
```

### Tab Navigation
```jsx
<div className="flex gap-2 mb-4">
  <button
    onClick={() => setActiveTab('definitions')}
    className={activeTab === 'definitions' ? 'active' : ''}
  >
    Metric Definitions
  </button>
  <button
    onClick={() => setActiveTab('values')}
    className={activeTab === 'values' ? 'active' : ''}
  >
    Metric Values
  </button>
</div>
```

## Error Handling

All API routes include comprehensive error handling:

```javascript
try {
  const response = await fetch(url, { headers })
  if (!response.ok) {
    if (response.status === 401) {
      return NextResponse.json({ success: false, requiresAuth: true }, { status: 401 })
    }
    throw new Error(`HTTP ${response.status}`)
  }
  const data = await response.json()
  return NextResponse.json({ success: true, definitions: data.value || [] })
} catch (error) {
  console.error('Error:', error)
  return NextResponse.json({ success: false, error: error.message }, { status: 500 })
}
```

## Navigation Integration

Added to `/src/app/graph-explorer/nav-areas.ts` under the Azure section:

```typescript
{ 
  name: 'Azure Monitor Metrics', 
  href: '/azure/metrics', 
  description: 'Metric definitions and time series data', 
  icon: ChartBarIcon 
}
```

## Files Created

1. **Page Component**: `src/app/azure/metrics/page.jsx` (650 lines)
2. **API Routes**:
   - `src/app/api/azure/metrics/definitions/route.js`
   - `src/app/api/azure/metrics/values/route.js`
   - `src/app/api/azure/resources/route.js`
3. **Documentation**: This file

## Testing

### Manual Testing Steps

1. **Navigate to the page**:
   - Go to http://localhost:3001/azure/metrics
   - Or use the navigation menu: Azure > Azure Monitor Metrics

2. **Test Resource Selection**:
   - Select a resource type (e.g., Virtual Machines)
   - Verify resources are loaded in the dropdown
   - Select a resource

3. **Test Metric Definitions**:
   - Ensure the "Metric Definitions" tab is active
   - Click "Load Metric Definitions"
   - Verify table shows metrics with units, aggregations, and dimensions

4. **Test Metric Values**:
   - Switch to "Metric Values" tab
   - Select a metric from the dropdown
   - Choose a time range (e.g., PT1H)
   - Select an aggregation type
   - Click "Get Metric Values"
   - Verify time series data is displayed with timestamps and values

5. **Test Error Handling**:
   - Test with invalid resource ID
   - Test with unauthenticated session
   - Verify error messages are user-friendly

### Automated Testing

Consider adding Playwright tests:

```javascript
test('Azure Monitor Metrics page loads', async ({ page }) => {
  await page.goto('/azure/metrics')
  await expect(page.locator('h1')).toContainText('Azure Monitor Metrics')
})

test('Can select resource type and load resources', async ({ page }) => {
  await page.goto('/azure/metrics')
  await page.selectOption('select', 'virtualmachines')
  await expect(page.locator('select').nth(1)).not.toBeDisabled()
})
```

## Future Enhancements

### 1. Dimension Filtering
Add support for filtering metrics by dimensions:
```javascript
const dimensions = metricDefinitions
  .find(m => m.name.value === selectedMetric)
  ?.dimensions || []

// UI for dimension selection
dimensions.map(dim => (
  <select key={dim.value}>
    <option>Select {dim.localizedValue}...</option>
  </select>
))
```

### 2. Chart Visualization
Integrate a charting library (e.g., Recharts) to visualize time series data:

```jsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'

<LineChart data={chartData}>
  <CartesianGrid strokeDasharray="3 3" />
  <XAxis dataKey="timestamp" />
  <YAxis />
  <Tooltip />
  <Line type="monotone" dataKey="value" stroke="#8884d8" />
</LineChart>
```

### 3. Export Functionality
Add CSV/JSON export for metric data:

```javascript
function exportToCSV(data) {
  const csv = data.map(d => `${d.timeStamp},${d.average}`).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'metrics.csv'
  a.click()
}
```

### 4. Metric Comparison
Allow comparing multiple metrics or resources side-by-side:

```javascript
const [comparisonMetrics, setComparisonMetrics] = useState([])

// Add metric to comparison
function addToComparison(metric) {
  setComparisonMetrics([...comparisonMetrics, metric])
}
```

### 5. Custom Time Range Picker
Add a date/time picker for custom time ranges:

```jsx
<input 
  type="datetime-local" 
  value={startTime}
  onChange={(e) => setStartTime(e.target.value)}
/>
<input 
  type="datetime-local" 
  value={endTime}
  onChange={(e) => setEndTime(e.target.value)}
/>
```

### 6. Saved Queries
Allow users to save and load metric query configurations:

```javascript
const savedQueries = JSON.parse(localStorage.getItem('metricQueries') || '[]')

function saveQuery(query) {
  const updated = [...savedQueries, query]
  localStorage.setItem('metricQueries', JSON.stringify(updated))
}
```

### 7. Alert Thresholds
Display and configure alert rules for metrics:

```jsx
<div className="alert-config">
  <label>Alert when {selectedMetric} {condition}</label>
  <input type="number" value={threshold} />
  <select value={condition}>
    <option value="greater">greater than</option>
    <option value="less">less than</option>
  </select>
</div>
```

## References

- [Azure Monitor REST API Documentation](https://learn.microsoft.com/en-us/azure/azure-monitor/essentials/rest-api-walkthrough)
- [Azure Resource Graph API](https://learn.microsoft.com/en-us/azure/governance/resource-graph/overview)
- [Supported Metrics in Azure Monitor](https://learn.microsoft.com/en-us/azure/azure-monitor/essentials/metrics-supported)
- [ISO 8601 Duration Format](https://en.wikipedia.org/wiki/ISO_8601#Durations)

## Conclusion

The Azure Monitor Metrics implementation provides a comprehensive interface for exploring and querying Azure metric data. It follows Microsoft's REST API patterns, includes proper error handling, and provides a clean, tab-based UI for both metric definitions and time series data retrieval. The implementation is production-ready and can be extended with additional features like chart visualization, dimension filtering, and custom time ranges.
