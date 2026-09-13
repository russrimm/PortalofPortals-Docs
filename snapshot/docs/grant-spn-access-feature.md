# Grant SPN Access Feature

## Overview
This feature allows administrators to grant Service Principal (SPN) System Administrator access to Power Platform environments with Dataverse directly from the environment card UI.

## Why This Was Needed
- The service principal used by the app (defined in `AZURE_CLIENT_ID`) lacks permissions to query all Power Platform environments
- Manually granting access via Dataverse Web API requires technical knowledge and multiple steps
- This feature streamlines the process into a single button click

## Architecture

### Backend API
**File:** `src/app/api/power-platform/grant-spn-access/route.ts`

**Endpoint:** `POST /api/power-platform/grant-spn-access`

**Request Body:**
```json
{
  "environmentUrl": "https://<org>.crm.dynamics.com"
}
```

**Authentication Flow:**
1. Uses delegated (user context) authentication via On-Behalf-Of (OBO) flow
2. Requires user to have Power Platform Administrator role
3. Calls Dataverse Web API using user's token with `{environmentUrl}/.default` scope

**Process:**
1. Check if application user already exists for the service principal
2. If not, create application user via POST to `systemusers`
3. Query System Administrator role GUID via GET from `roles`
4. Assign role to application user via POST to `systemuserroles_association`

**Response:**
- Success: `{ success: true, message: "..." }`
- Error: `{ success: false, error: "..." }`

### Frontend Components

**File:** `src/app/power-platform/environments/page.jsx`

**Handler:** `handleGrantSpnAccess(environment)`
- Extracts Dataverse instance URL from environment properties
- Calls backend API with environment URL
- Manages loading, error, and success states
- Auto-clears success message after 5 seconds

**State:** `grantSpnOps[envId]`
```javascript
{
  loading: boolean,
  error: string | null,
  success: string | null
}
```

**File:** `src/app/power-platform/environments/components/EnvironmentCardNew.tsx`

**Props Added:**
- `onGrantSpnAccess?: () => void` - Click handler
- `grantSpnOp?: { loading, error, success }` - Operation state

**UI:**
- Button appears in expanded environment card view
- Only visible for environments with Dataverse (`hasDataverse`)
- Shows loading spinner during operation
- Displays success (green) or error (red) messages
- Blue theme to indicate governance action

## Token Management

**File:** `src/lib/dataverseToken.js`

**Function Added:** `getDataverseDelegatedToken(dataverseUrl, userToken)`
- Uses OBO flow to exchange user's access token for Dataverse token
- Token scope: `{dataverseUrl}/.default`
- Grant type: `urn:ietf:params:oauth:grant-type:jwt-bearer`
- Caches tokens in `dataverseTokenCache` map

## Usage

1. Navigate to Power Platform Environments page
2. Expand an environment card (click to expand)
3. Scroll to resource buttons section
4. Click "🔐 Grant SPN Access" button
5. Wait for success message
6. Service principal now has System Administrator access to that environment

## Permissions Required

**User (Delegated):**
- Power Platform Administrator role in Microsoft 365
- Or Dynamics 365 Administrator role
- Must have rights to create application users and assign roles in Dataverse

**Service Principal:**
- Will be granted System Administrator role in the specific Dataverse environment
- Uses Application ID from `AZURE_CLIENT_ID` environment variable

## Technical Notes

### Why Delegated Auth?
- Creating application users and assigning System Administrator role requires elevated privileges
- Service principal alone cannot grant itself permissions (security by design)
- Delegated flow ensures a human administrator approves the action

### Dataverse API Endpoints Used
1. `GET /api/data/v9.2/systemusers?$filter=applicationid eq '{appId}'`
   - Check if application user exists
2. `POST /api/data/v9.2/systemusers`
   - Create application user with `applicationid` field
3. `GET /api/data/v9.2/roles?$filter=name eq 'System Administrator'`
   - Get System Administrator role GUID
4. `POST /api/data/v9.2/systemusers({userId})/systemuserroles_association/$ref`
   - Associate role with application user

### Security Considerations
- Only users with delegated admin rights can execute this action
- Each environment requires individual approval (no bulk operations)
- Operation is logged in Dataverse audit logs
- Success state auto-clears after 5 seconds to prevent confusion

## Environment Variables Used
- `AZURE_CLIENT_ID` - Service principal application ID
- `AZURE_CLIENT_SECRET` - Service principal secret
- `AZURE_TENANT_ID` - Azure AD tenant ID

## Related Files
- `/src/app/api/power-platform/grant-spn-access/route.ts` - Backend API route
- `/src/app/power-platform/environments/page.jsx` - Page component with handler
- `/src/app/power-platform/environments/components/EnvironmentCardNew.tsx` - UI component
- `/src/lib/dataverseToken.js` - Token acquisition helpers
- `/auth.ts` - NextAuth configuration for user session

## Testing Checklist
- [ ] Button only appears when environment has Dataverse
- [ ] Loading spinner displays during API call
- [ ] Success message shows on successful grant
- [ ] Error message shows on failure (e.g., no permissions)
- [ ] Success message auto-clears after 5 seconds
- [ ] Multiple clicks don't cause duplicate API calls
- [ ] Works for different environment types (sandbox, production)
- [ ] Service principal can query environment data after grant
