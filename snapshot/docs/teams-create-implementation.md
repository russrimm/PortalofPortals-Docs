# Teams Create Feature Implementation

## Overview
Added the ability to create Microsoft Teams using the Microsoft Graph API on the List Teams page.

## Implementation Date
November 16, 2025

## Files Modified/Created

### 1. API Route: `src/app/api/teams/create-team/route.js` (NEW)
**Purpose**: Backend API endpoint to create Teams via Microsoft Graph API

**Features**:
- Uses delegated authentication (requires user context)
- Validates required fields (displayName)
- Supports optional fields: description, firstChannelName, visibility
- Uses the standard Teams template
- Returns 202 Accepted status with operation location
- Proper error handling and logging

**Required Permission**: `Team.Create` (delegated)

**API Documentation**: https://learn.microsoft.com/en-us/graph/api/team-post

### 2. UI Component: `src/app/teams/list-teams/page.jsx` (UPDATED)
**Purpose**: Frontend UI for listing and creating Teams

**New Features**:
- "Create Team" button in the header
- Modal dialog for team creation with form fields:
  - Team Name (required)
  - Description (optional)
  - First Channel Name (optional, defaults to "General")
  - Visibility (Private/Public dropdown)
- Form validation
- Loading states during submission
- Success/error message display
- Auto-refresh of teams list after successful creation
- Auto-close modal after 3 seconds on success

**UI/UX Enhancements**:
- Clean, accessible modal with dark mode support
- Helpful field descriptions and hints
- Disabled states for buttons during loading
- Spinner animation during team creation
- Error handling with detailed messages

## Technical Details

### Authentication Flow
1. User session retrieved via `auth()` from NextAuth
2. Delegated token obtained using `getGraphDelegatedToken()` with user's tokens
3. Token passed to Microsoft Graph API in Authorization header

### API Request Format
```json
{
  "template@odata.bind": "https://graph.microsoft.com/v1.0/teamsTemplates('standard')",
  "displayName": "Team Name",
  "description": "Optional description",
  "firstChannelName": "General",
  "visibility": "Private"
}
```

### API Response
- **Success**: 202 Accepted with `Location` and `Content-Location` headers
- **Error**: Appropriate HTTP status code with error details

### SWR Integration
- Uses existing `useApiData` hook for listing teams
- `mutate()` function called to refresh teams list after creation
- Deduplication interval: 30 seconds

## Testing Instructions

### Prerequisites
1. Ensure `Team.Create` permission is granted to the Azure app registration
2. User must have appropriate permissions in Azure AD to create teams
3. Dev server running on http://localhost:3000

### Test Steps
1. Navigate to `/teams/list-teams`
2. Click "Create Team" button
3. Fill in the form:
   - Team Name: "Test Team" (required)
   - Description: "This is a test team" (optional)
   - First Channel Name: "General" (optional)
   - Visibility: Select "Private" or "Public"
4. Click "Create Team" button
5. Verify success message appears
6. Wait for modal to auto-close (3 seconds)
7. Check if new team appears in the list (may take a few moments)

### Expected Behavior
- Modal opens on button click
- Form validates required fields
- Submit button disabled until displayName is filled
- Loading spinner shows during submission
- Success message displays on 202 Accepted response
- Teams list refreshes automatically
- Modal closes after success message

### Error Scenarios
- **401 Unauthorized**: No session or failed to get delegated token
- **400 Bad Request**: Missing displayName
- **403 Forbidden**: Insufficient permissions
- **500 Internal Server Error**: Graph API error or server error

## Permissions Required

### Azure App Registration
In the Azure Portal, ensure the following delegated permissions are granted:
- `Team.Create` - Create teams
- `Team.ReadBasic.All` - Read teams (for listing)

### User Permissions
Users must have appropriate permissions in their Azure AD tenant to create teams. This is typically restricted to administrators or users with team creation permissions.

## Notes

### Team Creation Process
- Team creation is asynchronous in Microsoft Graph
- Returns 202 Accepted immediately
- Actual provisioning may take several minutes
- SharePoint site creation can take additional time

### Template
- Uses the 'standard' Teams template
- Can be extended to support other templates (educationClass, retail, etc.)
- See documentation for available templates

### Future Enhancements
- Support for adding initial members during creation
- Custom channels configuration
- Different team templates selection
- Team settings configuration (member/guest permissions, etc.)
- Progress polling for team creation status

## References
- [Create team API](https://learn.microsoft.com/en-us/graph/api/team-post?view=graph-rest-1.0&tabs=http)
- [Teams templates](https://learn.microsoft.com/en-us/MicrosoftTeams/get-started-with-teams-templates)
- [Team resource type](https://learn.microsoft.com/en-us/graph/api/resources/team?view=graph-rest-1.0)
