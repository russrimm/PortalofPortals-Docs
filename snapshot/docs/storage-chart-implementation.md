# Storage Consumption Chart Implementation

**Date:** January 2025  
**Feature:** Top 5 Storage Consuming Environments Pie Chart

## Overview
Added a new pie chart visualization to the Power Platform environments page showing the top 5 environments consuming the most storage space.

## Implementation Details

### Location
- **File:** `src/app/power-platform/environments/page.jsx`
- **Section:** Environment Summary
- **Position:** Below the existing environment type distribution chart

### Technical Implementation

#### Dynamic Imports
Following the existing pattern in the environments page, Recharts components are dynamically imported using `require()` within the component's IIFE to avoid SSR issues:

```javascript
const PieChart = require('recharts').PieChart
const Pie = require('recharts').Pie
const Cell = require('recharts').Cell
const ResponsiveContainer = require('recharts').ResponsiveContainer
const Tooltip = require('recharts').Tooltip
```

#### Data Processing
The chart calculates total storage consumption per environment by summing:
- Database capacity (`capacityDatabase`)
- Log capacity (`capacityLog`)
- File capacity (`capacityFile`)

```javascript
const envStorageData = environmentsData.value
  .map(env => {
    const dbMB = env.properties?.capacity?.actualConsumption?.capacityDatabase || 0;
    const logMB = env.properties?.capacity?.actualConsumption?.capacityLog || 0;
    const fileMB = env.properties?.capacity?.actualConsumption?.capacityFile || 0;
    const totalMB = dbMB + logMB + fileMB;
    return {
      name: env.properties?.displayName || env.name || 'Unknown',
      totalStorage: totalMB,
      // ... additional properties
    };
  })
  .filter(env => env.totalStorage > 0)
  .sort((a, b) => b.totalStorage - a.totalStorage)
  .slice(0, 5);
```

#### Visualization
- **Chart Type:** Pie chart using Recharts library
- **Colors:** Custom color palette with 5 distinct colors
  - Blue (#3b82f6)
  - Green (#10b981)
  - Amber (#f59e0b)
  - Red (#ef4444)
  - Purple (#8b5cf6)

#### Features
1. **Responsive Design:** Uses `ResponsiveContainer` for adaptive sizing
2. **Smart Labels:** 
   - Truncates long environment names to 20 characters on pie slices
   - Full names shown in tooltip
3. **Storage Formatting:** Uses existing `formatBytes()` function to display sizes in MB/GB
4. **Default Environment Indicator:** Shows "(Default)" tag in legend for default environments
5. **Interactive Tooltip:** Displays environment name and formatted storage size on hover

#### Chart Components
```javascript
<ResponsiveContainer width="100%" height={250}>
  <PieChart>
    <Pie
      data={envStorageData}
      dataKey="totalStorage"
      nameKey="name"
      cx="50%"
      cy="50%"
      outerRadius={80}
      label={(entry) => `${entry.name.substring(0, 20)}...`}
    >
      {envStorageData.map((entry, index) => (
        <Cell key={`cell-${index}`} fill={storageColors[index]} />
      ))}
    </Pie>
    <Tooltip formatter={(value) => [formatBytes(value * 1024 * 1024), 'Total Storage']} />
  </PieChart>
</ResponsiveContainer>
```

### Layout Structure
The chart is positioned in the Environment Summary section:
1. Total Capacity Consumption (displays aggregate totals)
2. Stats Grid (counts by environment type)
3. Environment Types Chart (existing - pie/bar toggle)
4. **NEW: Top 5 Storage Consumption Chart** (below environment types)

## User Experience

### Display
- **Title:** "Top 5 Storage Consuming Environments"
- **Chart Height:** 250px
- **Legend:** Below chart showing:
  - Colored indicator
  - Environment name (truncated to 25 chars)
  - Total storage in GB/MB
  - Default indicator if applicable

### Interactions
- Hover over pie slices to see detailed information
- Tooltip shows:
  - Full environment name
  - Formatted storage size

## Testing

### Build Verification
✅ Build completed successfully: 146/146 pages generated  
✅ No TypeScript errors  
✅ No new lint warnings

### Validation
- Chart data is filtered to exclude environments with zero storage
- Sorted by total storage (descending)
- Limited to top 5 consumers
- Handles missing data gracefully with fallback values

## Benefits
1. **Capacity Planning:** Quickly identify environments consuming the most storage
2. **Cost Management:** Visual insight into storage distribution for optimization
3. **Governance:** Easy identification of environments that may need attention
4. **Trend Analysis:** When combined with the storage history feature, enables tracking of top consumers over time

## Related Features
- Environment Summary section with total capacity breakdown
- Storage history tracking (`/api/power-platform/storage-history`)
- Environment type distribution chart
- Individual environment capacity details in table view

## Future Enhancements
Potential improvements:
- Add drill-down to see breakdown by database/log/file storage
- Historical trending of top consumers
- Configurable number of environments shown (currently fixed at 5)
- Export chart data functionality
- Alert thresholds for high consumption

## Dependencies
- **Recharts:** PieChart, Pie, Cell, ResponsiveContainer, Tooltip components
- **Existing utilities:** `formatBytes()` function from environments page
- **Data source:** Power Platform Environments API capacity data
