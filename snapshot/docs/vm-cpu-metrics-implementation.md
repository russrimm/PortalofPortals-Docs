# Azure Virtual Machine CPU Metrics Implementation

## Overview
Added Azure Monitor CPU metrics visualization to the Virtual Machine details modal on the `/azure/virtual-machines` page.

## Changes Made

### 1. New API Route
**File**: `src/app/api/azure/virtual-machines/metrics/route.js`

- **Endpoint**: `GET /api/azure/virtual-machines/metrics`
- **Query Parameters**:
  - `vmName` (required): Name of the virtual machine
  - `resourceGroup` (required): Resource group name
  - `metricName` (optional): Metric to fetch (default: "Percentage CPU")
- **Functionality**:
  - Fetches metrics from Azure Monitor Metrics API
  - Time range: Last 24 hours
  - Aggregation: Average
  - Interval: 5 minutes (PT5M)
  - API Version: 2018-01-01

### 2. Updated VM Details Page
**File**: `src/app/azure/virtual-machines/page.jsx`

#### New Imports
- Added Recharts components: `LineChart`, `Line`, `XAxis`, `YAxis`, `CartesianGrid`, `Tooltip`, `ResponsiveContainer`

#### New State Variables
- `cpuMetrics`: Stores transformed CPU metrics data for the chart
- `loadingMetrics`: Loading state for metrics fetch

#### New Functions
- `fetchCPUMetrics(vmName, resourceGroup)`: Fetches and transforms CPU metrics data
  - Called automatically when VM details are loaded
  - Transforms Azure Monitor response into chart-friendly format
  - Formats timestamps for display

#### UI Changes
- Added "CPU Utilization (Last 24 Hours)" section in VM details modal
- Positioned after "Status Information" section
- Shows loading spinner while fetching metrics
- Displays line chart with:
  - X-axis: Timestamp (formatted as "MMM DD, HH:MM")
  - Y-axis: CPU percentage
  - Blue line showing average CPU usage
  - Grid lines for easier reading
  - Responsive container (adapts to modal width)
- Shows configuration info: "Time range: Last 1 day | Aggregation: Average | Interval: 5 minutes"
- Displays "No CPU metrics available" message if no data returned

## Azure Monitor Metrics API

### Request Format
```
GET https://management.azure.com/subscriptions/{subscriptionId}/resourceGroups/{resourceGroup}/providers/Microsoft.Compute/virtualMachines/{vmName}/providers/microsoft.insights/metrics?api-version=2018-01-01&metricnames=Percentage%20CPU&timespan={startTime}/{endTime}&interval=PT5M&aggregation=average
```

### Response Format
```json
{
  "value": [
    {
      "id": "...",
      "type": "Microsoft.Insights/metrics",
      "name": {
        "value": "Percentage CPU",
        "localizedValue": "Percentage CPU"
      },
      "unit": "Percent",
      "timeseries": [
        {
          "data": [
            {
              "timeStamp": "2025-12-03T10:00:00Z",
              "average": 3.26
            },
            ...
          ]
        }
      ]
    }
  ]
}
```

## Features

### User Experience
1. Click on any VM name in the list
2. VM details modal opens automatically
3. CPU metrics chart loads alongside VM details
4. Chart displays last 24 hours of CPU usage
5. Hover over chart to see exact CPU percentage at any point

### Error Handling
- Gracefully handles missing metrics (shows "No CPU metrics available")
- Logs errors to console without breaking the modal
- Continues to show VM details even if metrics fail to load

### Responsive Design
- Chart adapts to modal width
- X-axis labels rotate/skip to prevent overlap
- Works in both light and dark modes

## Dependencies
- **recharts**: ^3.3.0 (already installed)
- Azure Management API access token
- Azure Monitor Metrics API permissions

## Future Enhancements
- Add metric selection dropdown (Memory, Disk, Network)
- Time range selector (1 hour, 6 hours, 1 day, 7 days)
- Export metrics data to CSV
- Set up metric alerts from the UI
- Compare multiple VMs side-by-side

## Testing
To test this feature:
1. Navigate to `/azure/virtual-machines`
2. Click on any VM name
3. Verify the CPU metrics chart loads below Status Information
4. Check that the chart displays data for the last 24 hours
5. Hover over the line to see tooltip with exact values

## References
- [Azure Monitor Metrics API Documentation](https://learn.microsoft.com/en-us/rest/api/monitor/)
- [Get VM usage metrics using REST API](https://learn.microsoft.com/en-us/azure/virtual-machines/linux/metrics-vm-usage-rest)
- [Supported metrics for Microsoft.Compute/virtualMachines](https://learn.microsoft.com/en-us/azure/azure-monitor/reference/supported-metrics/microsoft-compute-virtualmachines-metrics)
