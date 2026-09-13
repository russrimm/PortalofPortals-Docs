# ServiceNow Integration

## Overview
Complete ServiceNow integration for viewing and managing incidents from your ServiceNow instance.

## Features

### Incident Management
- **View Incidents**: Display all incidents from your ServiceNow instance in a clean, responsive table
- **Click for Details**: Click any incident row to view full details in a modal
- **Filter by State**: Filter incidents by state (New, In Progress, On Hold, Resolved, Closed, Canceled)
- **Filter by Priority**: Filter incidents by priority (Critical, High, Moderate, Low, Planning)
- **Color-Coded Badges**: Visual feedback with color-coded state and priority indicators
- **Secure Configuration**: Credentials stored locally in browser (localStorage) for security
- **Open in ServiceNow**: Direct link to open incident in ServiceNow portal

### Configuration
The integration requires three pieces of information:
1. **Instance URL**: Your ServiceNow instance URL (e.g., `https://your-instance.service-now.com`)
2. **Username**: Your ServiceNow username
3. **Password**: Your ServiceNow password

Credentials are stored locally in your browser and are only sent to the backend API during incident fetching requests.

## Implementation Details

### Frontend Component
**File**: `src/app/servicenow/incidents/page.jsx` (459 lines)

**Key Features**:
- Client-side React component with local state management
- Configuration form with validation
- localStorage persistence for credentials
- Filter controls for state and priority
- Responsive incident table with 6 columns
- Color-coded badges for visual feedback
- Empty states and error handling

**State Management**:
```javascript
const [incidents, setIncidents] = useState([])
const [loading, setLoading] = useState(false)
const [error, setError] = useState(null)
const [config, setConfig] = useState({ instanceUrl: '', username: '', password: '' })
const [configured, setConfigured] = useState(false)
const [filters, setFilters] = useState({ state: 'all', priority: 'all' })
```

**Helper Functions**:
- `getStateLabel(state)`: Maps state numbers (1-8) to text labels
- `getStateBadgeColor(state)`: Returns Tailwind classes for state badge colors
- `getPriorityLabel(priority)`: Maps priority numbers (1-5) to text labels
- `getPriorityBadgeColor(priority)`: Returns Tailwind classes for priority badge colors

### API Route
**File**: `src/app/api/servicenow/incidents/route.js` (96 lines)

**Endpoint**: `POST /api/servicenow/incidents`

**Request Body**:
```json
{
  "instanceUrl": "https://your-instance.service-now.com",
  "username": "your-username",
  "password": "your-password",
  "filters": {
    "state": "1",
    "priority": "2"
  }
}
```

**Response**:
```json
{
  "success": true,
  "incidents": [
    {
      "sys_id": "...",
      "number": "INC0010001",
      "short_description": "Issue description",
      "state": "2",
      "priority": "2",
      "assigned_to": "John Doe",
      "sys_created_on": "2025-01-15 10:30:00",
      "opened_at": "2025-01-15 10:30:00",
      "caller_id": "Jane Smith",
      "category": "Hardware",
      "subcategory": "Laptop",
      "urgency": "2",
      "impact": "2"
    }
  ]
}
```

**ServiceNow API Integration**:
- Uses ServiceNow Table API: `GET /api/now/table/incident`
- Basic Authentication with Base64-encoded credentials
- Query parameters:
  - `sysparm_limit=100`: Limit results to 100 records
  - `sysparm_display_value=true`: Return display values instead of sys_ids
  - `sysparm_fields`: Comma-separated list of fields to return
  - `sysparm_query`: Encoded filter query (state, priority)
  - Order by: `ORDERBYDESCsys_created_on`

**Error Handling**:
- 400: Missing configuration
- 401: Authentication failure
- Other errors: ServiceNow API errors with status codes

## State and Priority Values

### State Values
| Value | Label | Badge Color |
|-------|-------|-------------|
| 1 | New | Blue |
| 2 | In Progress | Yellow |
| 3 | On Hold | Orange |
| 6 | Resolved | Green |
| 7 | Closed | Gray |
| 8 | Canceled | Red |

### Priority Values
| Value | Label | Badge Color |
|-------|-------|-------------|
| 1 | Critical | Red |
| 2 | High | Orange |
| 3 | Moderate | Yellow |
| 4 | Low | Green |
| 5 | Planning | Blue |

## Navigation
The ServiceNow integration is accessible through the main navigation menu:
- **Navigation Path**: ServiceNow > Incidents
- **URL**: `/servicenow/incidents`
- **Icon**: ExclamationTriangleIcon

## Usage

### Initial Setup
1. Navigate to ServiceNow > Incidents
2. Enter your ServiceNow instance URL (e.g., `https://dev226313.service-now.com`)
3. Enter your ServiceNow username
4. Enter your ServiceNow password
5. Click "Save Configuration"

### Viewing Incidents
Once configured:
1. Incidents will load automatically
2. Use the state dropdown to filter by incident state
3. Use the priority dropdown to filter by priority level
4. Click "Refresh" to reload incidents with current filters
5. Click "Reconfigure" to change your ServiceNow credentials
6. **Click any incident row** to view full details including:
   - Complete description
   - Assigned to and caller information
   - Category and subcategory
   - Urgency and impact levels
   - Created and opened timestamps
   - Direct link to open in ServiceNow portal

### Data Security
- Credentials are stored in browser localStorage only
- Credentials are NOT sent to any backend service except during API calls to fetch incidents
- The backend API does not persist credentials
- Each API call uses credentials from the request body

## Technical Notes

### Authentication
- Uses Basic Authentication (Base64-encoded username:password)
- Token format: `Authorization: Basic ${base64Token}`
- Credentials must have appropriate permissions in ServiceNow

### Rate Limiting
- Limited to 100 incidents per request
- Filters help reduce the number of records returned
- Consider implementing pagination for large datasets

### Browser Compatibility
- Requires localStorage support
- Modern browsers (Chrome, Firefox, Edge, Safari)
- Responsive design works on desktop and mobile

## Future Enhancements
Potential improvements for future iterations:
1. **Comments/Work Notes**: View incident comments and work notes history
2. **Create Incidents**: Form to create new incidents
3. **Update Incidents**: Change state, priority, assignment directly from the portal
4. **Advanced Filters**: Filter by assigned to, category, urgency, impact
5. **Search**: Full-text search across incident fields
6. **Pagination**: Load more than 100 incidents
7. **Sorting**: Sort by any column
8. **Export**: Export to CSV or Excel
9. **Bulk Actions**: Update multiple incidents at once
10. **Real-time Updates**: WebSocket integration for live incident updates
11. **Attachments**: View and download incident attachments

## Testing Checklist
- [ ] Test with valid ServiceNow credentials
- [ ] Test with invalid credentials (should show auth error)
- [ ] Test state filtering (all states)
- [ ] Test priority filtering (all priorities)
- [ ] Test combination of filters
- [ ] Test localStorage persistence (reload page)
- [ ] Test reconfigure functionality
- [ ] Test responsive design on mobile
- [ ] Test error handling (network errors, API errors)
- [ ] Test empty states (no incidents)

## Troubleshooting

### Authentication Errors
**Issue**: "Authentication failed. Please check your credentials."
**Solution**: 
- Verify username and password are correct
- Check that the account has permissions to access the ServiceNow Table API
- Ensure the instance URL is correct (no trailing slash)

### No Incidents Displayed
**Issue**: Incidents list is empty
**Solution**:
- Check that incidents exist in your ServiceNow instance
- Try changing filters to "All" for both state and priority
- Verify the account has permission to view incidents

### CORS Errors
**Issue**: CORS policy blocking requests
**Solution**:
- The API route acts as a proxy to avoid CORS issues
- Ensure the API route is working correctly
- Check browser console for specific error messages

### Configuration Not Saving
**Issue**: Configuration resets after page reload
**Solution**:
- Check that localStorage is enabled in your browser
- Clear browser cache and try again
- Check browser console for localStorage errors

## API Documentation

### ServiceNow Table API Reference
- **Documentation**: https://docs.servicenow.com/bundle/washingtondc-api-reference/page/integrate/inbound-rest/concept/c_TableAPI.html
- **Endpoint**: `/api/now/table/{tableName}`
- **Methods**: GET, POST, PUT, PATCH, DELETE
- **Authentication**: Basic Auth, OAuth 2.0

### Query Parameters
- `sysparm_limit`: Maximum number of records to return
- `sysparm_offset`: Starting record index for pagination
- `sysparm_query`: Encoded query string for filtering
- `sysparm_fields`: Comma-separated list of fields to return
- `sysparm_display_value`: Return display values (true/false)
- `sysparm_exclude_reference_link`: Exclude reference links (true/false)

### Filter Operators
- `=`: Equals
- `!=`: Not equals
- `^`: AND operator
- `^OR`: OR operator
- `^NQ`: New query (grouping)
- `ORDERBY`: Sort ascending
- `ORDERBYDESC`: Sort descending

## Version History

### v1.1.0 (2025-11-24)
- Added clickable incident rows
- Implemented incident details modal
- Display full incident information including description, category, urgency, impact
- Added "Open in ServiceNow" button for direct portal access
- Enhanced user experience with modal interactions

### v1.0.0 (2025-01-15)
- Initial implementation
- Incident viewing with state and priority filters
- localStorage-based configuration persistence
- Color-coded state and priority badges
- Basic error handling and empty states
- Responsive design for mobile and desktop
