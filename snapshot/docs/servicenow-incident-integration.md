# ServiceNow Incident Creation Integration

**Implementation Date**: January 2025  
**Status**: ✅ Complete  
**API**: ServiceNow Table API (`/api/now/table/incident`)

## Overview

This integration adds ServiceNow incident creation capability to Portal 360°, allowing users to create incident tickets directly from security alerts, device issues, or any other event detected in the application.

## Architecture

### Backend API Route
**File**: `src/app/api/servicenow/incidents/create/route.js`

- **Endpoint**: POST `/api/servicenow/incidents/create`
- **Authentication**: Basic Auth (username/password)
- **ServiceNow API**: POST `https://{instance}.service-now.com/api/now/table/incident`

**Key Features**:
- Supports environment variable configuration OR request body credentials
- Comprehensive error handling with detailed messages
- Automatic detection of hibernating developer instances
- Tracks incident source (origin from Portal 360°)
- Returns incident number and direct link to ServiceNow

### Frontend Components
**File**: `src/components/ServiceNowIncidentModal.jsx`

**Two components provided**:

1. **ServiceNowIncidentModal**: Full-featured modal for incident creation
   - Form with all incident fields
   - Configuration management (localStorage)
   - Success/error feedback
   - Auto-redirect to created incident

2. **ServiceNowIncidentButton**: Simple button that opens the modal
   - Customizable button text and styling
   - Pre-fill incident data via props
   - Easy integration into any page

## ServiceNow API Details

### Authentication
**Method**: Basic Authentication
```
Authorization: Basic base64(username:password)
```

### Endpoint
```
POST https://{instance}.service-now.com/api/now/table/incident
Content-Type: application/json
Accept: application/json
```

### Required Fields
- `short_description` - Brief summary of the incident

### Optional Fields
| Field | Type | Description | Default |
|-------|------|-------------|---------|
| `description` | string | Detailed description | '' |
| `caller_id` | string | User sys_id who reported | '' |
| `category` | string | inquiry, software, hardware, network, database | 'inquiry' |
| `subcategory` | string | Subcategory | '' |
| `impact` | number | 1=High, 2=Medium, 3=Low | 3 |
| `urgency` | number | 1=High, 2=Medium, 3=Low | 3 |
| `priority` | number | Calculated from impact/urgency if null | null |
| `assignment_group` | string | Group sys_id | '' |
| `assigned_to` | string | User sys_id | '' |
| `comments` | string | Additional comments | '' |
| `work_notes` | string | Internal work notes | '' |

### Custom Fields (if configured in ServiceNow)
- `u_source` - Origin of the incident (default: "Portal 360°")
- `u_source_url` - Link back to source page
- `u_source_user` - Email of user who created incident

## Setup Instructions

### 1. ServiceNow Instance Setup

#### Personal Developer Instance (Free)
1. Request a free instance at [developer.servicenow.com](https://developer.servicenow.com)
2. Wait for instance creation (5-10 minutes)
3. Note your instance URL (e.g., `https://dev12345.service-now.com`)
4. Use admin credentials provided in email

#### Production Instance
1. Create a service account user in ServiceNow
2. Grant permissions: `rest_api_explorer`, `itil` roles
3. Note the instance URL
4. Securely store credentials

### 2. Environment Variables (Optional)

Add to `.env.local`:

```bash
# ServiceNow Configuration (Optional - can be provided at runtime)
SERVICENOW_INSTANCE=https://your-instance.service-now.com
SERVICENOW_USERNAME=your-username
SERVICENOW_PASSWORD=your-password
```

**Note**: Environment variables are optional. Users can configure ServiceNow connection at runtime via the modal.

### 3. Verify Integration

#### Test API Endpoint
```bash
# Check configuration
curl http://localhost:3000/api/servicenow/incidents/create

# Create test incident (with environment variables)
curl -X POST http://localhost:3000/api/servicenow/incidents/create \
  -H "Content-Type: application/json" \
  -d '{
    "short_description": "Test incident from Portal 360°",
    "impact": 3,
    "urgency": 3
  }'

# Create test incident (with inline credentials)
curl -X POST http://localhost:3000/api/servicenow/incidents/create \
  -H "Content-Type: application/json" \
  -d '{
    "instanceUrl": "https://dev12345.service-now.com",
    "username": "admin",
    "password": "your-password",
    "short_description": "Test incident from Portal 360°",
    "impact": 3,
    "urgency": 3
  }'
```

#### Expected Response (Success)
```json
{
  "success": true,
  "incident": {
    "number": "INC0010001",
    "sys_id": "abc123...",
    "link": "https://dev12345.service-now.com/nav_to.do?uri=incident.do?sys_id=abc123...",
    "state": "1",
    "priority": "5"
  },
  "data": { /* full incident record */ }
}
```

## Usage Examples

### 1. Basic Usage with Button Component

```jsx
import { ServiceNowIncidentButton } from '@/components/ServiceNowIncidentModal'

export default function MyPage() {
  return (
    <div>
      <h1>Security Alerts</h1>
      <ServiceNowIncidentButton 
        buttonText="Report Issue"
        initialData={{
          short_description: 'Security alert detected',
          impact: 2,
          urgency: 2
        }}
      />
    </div>
  )
}
```

### 2. Advanced Usage with Modal Component

```jsx
import { useState } from 'react'
import { ServiceNowIncidentModal } from '@/components/ServiceNowIncidentModal'

export default function DefenderAlerts() {
  const [showModal, setShowModal] = useState(false)
  const [selectedAlert, setSelectedAlert] = useState(null)

  const handleCreateIncident = (alert) => {
    setSelectedAlert({
      short_description: `Security Alert: ${alert.title}`,
      description: `Alert ID: ${alert.id}\nSeverity: ${alert.severity}\n\n${alert.description}`,
      category: 'software',
      impact: alert.severity === 'High' ? 1 : alert.severity === 'Medium' ? 2 : 3,
      urgency: alert.severity === 'High' ? 1 : 2,
      u_source_url: `${window.location.origin}/defender-atp?alertId=${alert.id}`
    })
    setShowModal(true)
  }

  return (
    <div>
      {alerts.map(alert => (
        <div key={alert.id}>
          <button onClick={() => handleCreateIncident(alert)}>
            Create Incident
          </button>
        </div>
      ))}

      <ServiceNowIncidentModal 
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        initialData={selectedAlert}
      />
    </div>
  )
}
```

### 3. Programmatic Incident Creation

```javascript
async function createIncident(incidentData) {
  const response = await fetch('/api/servicenow/incidents/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      // ServiceNow config (if not using env vars)
      instanceUrl: 'https://dev12345.service-now.com',
      username: 'admin',
      password: 'password',
      
      // Incident fields
      short_description: 'Device compliance failure',
      description: 'Device XYZ failed compliance check',
      category: 'software',
      impact: 2,
      urgency: 2,
      u_source_url: window.location.href
    })
  })

  const data = await response.json()
  
  if (data.success) {
    console.log('Incident created:', data.incident.number)
    window.open(data.incident.link, '_blank')
  }
}
```

## Integration Points

### Recommended Pages for Incident Creation

1. **Defender ATP Alerts** (`/defender-atp`)
   - Create incidents from security alerts
   - Pre-fill severity, title, description
   - Link back to alert details

2. **Windows Update States** (`/intune/windows-updates`)
   - Create incidents for non-compliant devices
   - Pre-fill device name, compliance state
   - Link back to device details

3. **Log Analytics Security Alerts** (`/log-analytics`)
   - Create incidents from SecurityAlert table
   - Pre-fill alert type, severity
   - Include KQL query link

4. **Device Compliance Issues** (`/device-management/compliance-status`)
   - Create incidents for failed compliance
   - Pre-fill device, policy details
   - Link back to compliance dashboard

### Example Integration in Defender ATP Page

Add to `src/app/defender-atp/page.jsx`:

```jsx
import { ServiceNowIncidentButton } from '@/components/ServiceNowIncidentModal'

// In the alerts table, add action column:
<td className="px-6 py-4">
  <ServiceNowIncidentButton 
    buttonText="Create Incident"
    className="text-sm px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
    initialData={{
      short_description: `Security Alert: ${alert.title}`,
      description: `
Alert ID: ${alert.id}
Severity: ${alert.severity}
Category: ${alert.category}
Machine: ${alert.machineId}

${alert.description}
      `,
      category: 'software',
      impact: alert.severity === 'High' ? 1 : alert.severity === 'Medium' ? 2 : 3,
      urgency: alert.severity === 'High' ? 1 : 2,
      u_source_url: `${window.location.origin}/defender-atp?alertId=${alert.id}`
    }}
  />
</td>
```

## Configuration Management

### localStorage Configuration
The modal component stores ServiceNow configuration in `localStorage`:

```javascript
// Configuration is saved as:
localStorage.setItem('servicenow-config', JSON.stringify({
  instanceUrl: 'https://dev12345.service-now.com',
  username: 'admin',
  password: 'encrypted-password' // Consider encryption in production
}))

// Retrieved automatically on component mount
const config = JSON.parse(localStorage.getItem('servicenow-config'))
```

### Security Considerations
1. **localStorage**: Credentials are stored in browser localStorage
   - **Risk**: Accessible via JavaScript
   - **Mitigation**: Consider encrypting passwords before storage
   - **Alternative**: Use environment variables only (server-side)

2. **Environment Variables**: Preferred for production
   - **Pros**: More secure, centralized management
   - **Cons**: Requires deployment to change

3. **Best Practice**: 
   - Use environment variables for shared/production credentials
   - Use localStorage for individual user testing/development

## Error Handling

### Common Errors

#### 1. Authentication Failed (401)
**Error**: `Authentication failed. Please check your credentials.`

**Causes**:
- Incorrect username or password
- User account disabled
- Insufficient permissions

**Solution**:
- Verify credentials in ServiceNow
- Check user has `rest_api_explorer` role
- Ensure instance URL is correct

#### 2. Instance Hibernating (503)
**Error**: `ServiceNow developer instance is hibernating`

**Cause**: Personal Developer Instances hibernate after 10 days of inactivity

**Solution**:
- Visit instance URL in browser
- Wait 1-2 minutes for instance to wake
- Retry incident creation

#### 3. HTML Error Page (502)
**Error**: `ServiceNow returned an HTML page instead of JSON`

**Causes**:
- Incorrect instance URL
- Redirect to login page
- API endpoint incorrect

**Solution**:
- Verify instance URL format: `https://instance.service-now.com`
- Check API endpoint: `/api/now/table/incident`
- Test URL in browser first

#### 4. Missing Configuration (400)
**Error**: `ServiceNow configuration missing`

**Solution**:
- Set environment variables in `.env.local`
- OR provide credentials in request body
- OR configure via modal's configuration section

#### 5. Missing Required Field (400)
**Error**: `short_description is required`

**Solution**:
- Ensure `short_description` field is not empty
- Minimum length varies by ServiceNow configuration

## API Response Structure

### Successful Response (201 Created)
```json
{
  "success": true,
  "incident": {
    "number": "INC0010001",
    "sys_id": "abc123def456...",
    "link": "https://instance.service-now.com/nav_to.do?uri=incident.do?sys_id=abc123...",
    "state": "1",
    "priority": "5"
  },
  "data": {
    "number": "INC0010001",
    "sys_id": "abc123def456...",
    "short_description": "Test incident",
    "description": "Detailed description",
    "state": "1",
    "priority": "5",
    "impact": "3",
    "urgency": "3",
    "caller_id": "",
    "category": "inquiry",
    "opened_at": "2025-01-30 12:00:00",
    "sys_created_on": "2025-01-30 12:00:00",
    /* ... more fields ... */
  }
}
```

### Error Response (4xx/5xx)
```json
{
  "success": false,
  "error": "Authentication failed. Please check your credentials.",
  "details": "Additional error information"
}
```

## ServiceNow Field Reference

### State Values
- `1` - New
- `2` - In Progress
- `3` - On Hold
- `6` - Resolved
- `7` - Closed
- `8` - Canceled

### Impact Values
- `1` - High (affects multiple users/critical service)
- `2` - Medium (affects group/important service)
- `3` - Low (affects single user/minor service)

### Urgency Values
- `1` - High (must be resolved immediately)
- `2` - Medium (should be resolved quickly)
- `3` - Low (can wait for normal resolution)

### Priority Calculation
Priority is automatically calculated from Impact and Urgency:

| Impact / Urgency | High (1) | Medium (2) | Low (3) |
|------------------|----------|------------|---------|
| **High (1)**     | 1        | 2          | 3       |
| **Medium (2)**   | 2        | 3          | 4       |
| **Low (3)**      | 3        | 4          | 5       |

### Category Values
- `inquiry` - General inquiry
- `software` - Software issue
- `hardware` - Hardware issue
- `network` - Network issue
- `database` - Database issue

## Testing

### Manual Testing Checklist
- [ ] Environment variables loaded correctly
- [ ] Modal opens from button click
- [ ] Configuration can be saved in modal
- [ ] Form validation works (required fields)
- [ ] Incident created successfully
- [ ] Success message displays with incident number
- [ ] Link to ServiceNow incident works
- [ ] Error handling displays helpful messages
- [ ] Dark mode displays correctly

### Automated Testing
```bash
# Confirm the ServiceNow routes enforce authentication
pnpm run verify:api-auth

# Exercise the route surface end to end
pnpm run test:smoke
```

There is no component-level test runner in this repo — UI coverage is
Playwright only. Add ServiceNow UI assertions to a spec under `tests/`
rather than expecting a standalone component test command.

## Performance Considerations

### Response Times
- **Typical**: 500ms - 2s
- **Hibernating instance**: 60-120s (wake time)
- **Network timeout**: 30s

### Rate Limits
- ServiceNow enforces rate limits per user/instance
- Typical limit: 100 requests per minute per user
- Exceeded limit returns 429 status

### Optimization Tips
1. **Cache configuration**: Store credentials in localStorage
2. **Batch incidents**: Consider queuing if creating many
3. **Async processing**: Use background jobs for bulk creation

## Future Enhancements

### Planned Features
- [ ] **OAuth2 Support**: Replace Basic Auth with OAuth2
- [ ] **Attachment Support**: Upload screenshots/files to incidents
- [ ] **Incident Templates**: Pre-configured templates for common scenarios
- [ ] **Bulk Creation**: Create multiple incidents at once
- [ ] **Incident Status Tracking**: Monitor incident progress within app
- [ ] **Auto-assignment**: Automatically assign incidents based on rules
- [ ] **Integration Webhooks**: ServiceNow notifies app of incident updates

### Potential Improvements
- Encrypt passwords before localStorage storage
- Add incident search/list functionality
- Show recently created incidents
- Link incidents to original alerts/devices
- Bi-directional sync (update app when incident resolves)

## Related Documentation

### ServiceNow Documentation
- [Table API Documentation](https://docs.servicenow.com/bundle/xanadu-api-reference/page/integrate/inbound-rest/concept/c_TableAPI.html)
- [Incident Table](https://docs.servicenow.com/bundle/xanadu-it-service-management/page/product/incident-management/concept/c_IncidentManagement.html)
- [REST API Explorer](https://developer.servicenow.com/dev.do#!/reference/api/xanadu/rest/c_TableAPI)

### Internal Documentation
- [Windows Update State Integration](./windows-update-state-integration.md)
- [Defender ATP Integration](./defender-atp-integration.md)
- [API Documentation](./API-DOCUMENTATION.md)

## Troubleshooting Guide

### "ServiceNow developer instance is hibernating"
1. Open instance URL in browser: `https://dev12345.service-now.com`
2. Wait for "Instance is waking up" message
3. Wait 1-2 minutes
4. Retry incident creation

### "Authentication failed"
1. Verify username/password in ServiceNow
2. Try logging in via browser first
3. Check user has `rest_api_explorer` and `itil` roles
4. Ensure password doesn't contain special characters that need encoding

### "Unexpected response type"
1. Verify instance URL format (should end with `.service-now.com`)
2. Check API endpoint is correct (`/api/now/table/incident`)
3. Ensure instance is not redirecting to login page
4. Test URL in browser first

### Incident Not Created But No Error
1. Check ServiceNow audit logs
2. Verify API permissions
3. Check incident filters (might be created but hidden)
4. Look for validation rules in ServiceNow

---

**User Request Confirmation**:  
✅ **"Add the ability to create servicenow incidents"**

**Implementation Complete**: January 2025

**Features Delivered**:
- ✅ API route for incident creation (`/api/servicenow/incidents/create`)
- ✅ Reusable modal component (`ServiceNowIncidentModal`)
- ✅ Simple button component (`ServiceNowIncidentButton`)
- ✅ Supports environment variables OR runtime configuration
- ✅ Comprehensive error handling
- ✅ Auto-links to created incidents
- ✅ Ready to integrate across all pages
- ✅ Complete documentation with examples
