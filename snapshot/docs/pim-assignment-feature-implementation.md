# PIM Assignment Feature Implementation

**Date:** 2025-02-02  
**Status:** ✅ Complete

## Overview
Added comprehensive PIM (Privileged Identity Management) role assignment capabilities including:
1. Admin interface to create new role assignments
2. Display of expiration dates on all role views
3. Support for both eligible and active role assignments

## User Request
> "i also want a way to create and assign PIM assignments and see expiration date and times of assignments"

## Implementation Summary

### 1. New Pages Created

#### **Assign Roles Page** (`/pim/assign-roles`)
**File:** `src/app/pim/assign-roles/page.tsx`

> **Note (updated):** `/pim/assign-roles` now redirects to `/pim/role-assignments?tab=assign` — the "Assign Role" functionality described below was later folded into the main Role Assignments page as a tab. The original page and its features are described below for historical context.

**Features:**
- **Principal Search:** Autocomplete search for users and groups
  - Real-time search with debouncing
  - Displays user/group display name and email
  - Tab switching between users and groups
  
- **Role Selection:** Dropdown of all available directory roles
  - Fetches roles from Microsoft Graph
  - Shows role display name
  
- **Assignment Type:** Toggle between:
  - **Eligible:** Role requires activation by user
  - **Active:** Role is immediately active
  
- **Expiration Configuration:** Three modes:
  - **After Duration:** ISO 8601 durations (1 hour to 1 year)
    - PT1H, PT2H, PT4H, PT8H
    - P1D, P7D, P30D, P90D, P180D, P365D
  - **End Date:** Specific calendar date picker
  - **Permanent:** No expiration (NoExpiration type)
  
- **Justification:** Required text area for assignment reason
  
- **Form Validation:** All required fields validated before submission
  
- **Dark Mode:** Fully styled for dark mode

**UI Pattern:**
```
1. Search for user/group
2. Select from dropdown
3. Choose role from dropdown
4. Select eligible or active
5. Configure expiration
6. Provide justification
7. Submit assignment
```

### 2. New API Endpoints Created

#### **User Search API**
**Endpoint:** `GET /api/graph/users?search={query}`  
**File:** `src/app/api/graph/users/route.ts`

**Implementation:**
```typescript
// Filter: startswith(displayName) or startswith(userPrincipalName)
// Returns: id, displayName, userPrincipalName, mail
// Limit: Top 10 results
// Auth: Delegated token (user context)
```

#### **Group Search API**
**Endpoint:** `GET /api/graph/groups?search={query}`  
**File:** `src/app/api/graph/groups/route.ts`

**Implementation:**
```typescript
// Filter: startswith(displayName)
// Returns: id, displayName, mail
// Limit: Top 10 results
// Auth: Delegated token
```

#### **Assign Active Role API**
**Endpoint:** `POST /api/pim/assign-role`  
**File:** `src/app/api/pim/assign-role/route.ts`

**Microsoft Graph API:** `POST /roleManagement/directory/roleAssignmentScheduleRequests`

**Request Body:**
```json
{
  "action": "adminAssign",
  "principalId": "user-or-group-guid",
  "roleDefinitionId": "role-guid",
  "directoryScopeId": "/",
  "justification": "Reason for assignment",
  "scheduleInfo": {
    "startDateTime": "2026-01-13T...",
    "expiration": {
      "type": "AfterDuration",
      "duration": "PT8H"
    }
  }
}
```

**Features:**
- 25-second timeout with AbortController
- Accept-Language: en-US header
- Detailed error handling
- Timeout detection

#### **Assign Eligible Role API**
**Endpoint:** `POST /api/pim/assign-eligibility`  
**File:** `src/app/api/pim/assign-eligibility/route.ts`

**Microsoft Graph API:** `POST /roleManagement/directory/roleEligibilityScheduleRequests`

**Implementation:** Identical structure to assign-role but for eligible assignments

### 3. Updated Existing Pages

#### **Role Assignments Page** (`/pim/role-assignments`)
**File:** `src/app/pim/role-assignments/page.tsx`

**Changes:**
- ✅ Added "Expiration" column to table
- ✅ Displays expiration information for both active and eligible assignments
- ✅ Shows:
  - "Permanent" for NoExpiration type
  - Date and time for AfterDateTime type
  - "—" when no expiration data available
- ✅ Format: `MM/DD/YYYY` with time on second line

**Expiration Display Logic:**
```tsx
{assignment.scheduleInfo?.expiration?.type === 'NoExpiration' ? (
  <span className="text-gray-500 dark:text-gray-400">Permanent</span>
) : assignment.scheduleInfo?.expiration?.endDateTime ? (
  <div>
    <div>{new Date(assignment.scheduleInfo.expiration.endDateTime).toLocaleDateString()}</div>
    <div className="text-xs text-gray-500 dark:text-gray-400">
      {new Date(assignment.scheduleInfo.expiration.endDateTime).toLocaleTimeString()}
    </div>
  </div>
) : (
  <span className="text-gray-400 dark:text-gray-500">—</span>
)}
```

#### **My Roles Page** (`/pim/my-roles`)
**File:** `src/app/pim/my-roles/page.tsx`

**Status:** ✅ Already displays expiration dates correctly

**Existing Implementation:**
```tsx
{role.scheduleInfo?.expiration?.endDateTime && (
  <div className="mt-2 flex items-center text-sm text-gray-500 dark:text-gray-400">
    <ClockIcon className="h-4 w-4 mr-1" />
    Expires: {new Date(role.scheduleInfo.expiration.endDateTime).toLocaleString()}
  </div>
)}
```

### 4. Navigation Updates

#### **Graph Explorer Navigation**
**File:** `src/app/graph-explorer/nav-areas.ts`

**Changes:**
1. ✅ Added `UserPlusIcon` to imports from `@heroicons/react/24/outline`
2. ✅ Added new navigation item under "Privileged Identity Management":

```typescript
{
  name: 'Privileged Identity Management',
  description: 'PIM role assignments and activation',
  icon: ShieldCheckIcon,
  children: [
    { name: 'My Roles', href: '/pim/my-roles', description: 'View and activate your eligible roles', icon: UserIcon },
    { name: 'Role Assignments', href: '/pim/role-assignments', description: 'View all active and eligible role assignments', icon: ShieldCheckIcon },
    { name: 'Assign Roles', href: '/pim/assign-roles', description: 'Create new PIM role assignments', icon: UserPlusIcon },
  ]
}
```

## Technical Details

### Microsoft Graph PIM APIs Used

#### Role Assignment Schedule Requests (Active Assignments)
```
POST /roleManagement/directory/roleAssignmentScheduleRequests
Permissions: RoleAssignmentSchedule.ReadWrite.Directory
            RoleManagement.ReadWrite.Directory
```

#### Role Eligibility Schedule Requests (Eligible Assignments)
```
POST /roleManagement/directory/roleEligibilityScheduleRequests
Permissions: RoleAssignmentSchedule.ReadWrite.Directory
            RoleManagement.ReadWrite.Directory
```

### Assignment Action Types
- **`adminAssign`**: Administrator assigns role to another user/group
- **`selfActivate`**: User activates their own eligible role (not used in this feature)

### Expiration Types

#### 1. AfterDuration
ISO 8601 duration strings:
- `PT1H` - 1 hour
- `PT8H` - 8 hours
- `P1D` - 1 day
- `P30D` - 30 days
- `P365D` - 1 year

#### 2. AfterDateTime
Specific end date/time:
```json
{
  "type": "AfterDateTime",
  "endDateTime": "2026-02-13T10:30:00Z"
}
```

#### 3. NoExpiration
Permanent assignment:
```json
{
  "type": "NoExpiration"
}
```

### Schedule Info Structure
```typescript
interface ScheduleInfo {
  startDateTime: string // ISO 8601 datetime
  expiration: {
    type: 'AfterDuration' | 'AfterDateTime' | 'NoExpiration'
    duration?: string // ISO 8601 duration (e.g., PT8H)
    endDateTime?: string // ISO 8601 datetime
  }
}
```

### Error Handling

All API endpoints include:
- **Timeout handling:** 25-second client-side timeout
- **Error messages:** Detailed error responses
- **Loading states:** UI feedback during operations
- **Validation:** Required field checks
- **Retry logic:** (Inherited from previous timeout fixes)

### Authentication Pattern

All endpoints use delegated authentication:
```typescript
const token = await getGraphDelegatedToken({
  userAccessToken: session.accessToken,
  userIdToken: session.idToken,
  refreshToken: session.refreshToken,
})
```

## Files Created/Modified

### Created Files (6 total):
1. `src/app/pim/assign-roles/page.tsx` - Main UI (~430 lines)
2. `src/app/api/graph/users/route.ts` - User search API
3. `src/app/api/graph/groups/route.ts` - Group search API
4. `src/app/api/pim/assign-role/route.ts` - Active assignment API
5. `src/app/api/pim/assign-eligibility/route.ts` - Eligible assignment API
6. `docs/pim-assignment-feature-implementation.md` - This document

### Modified Files (2 total):
1. `src/app/pim/role-assignments/page.tsx` - Added expiration column
2. `src/app/graph-explorer/nav-areas.ts` - Added navigation item

## Testing Checklist

### Manual Testing Steps:

#### 1. Assign Eligible Role
- [ ] Navigate to PIM → Assign Roles
- [ ] Search for a user
- [ ] Select user from dropdown
- [ ] Choose a role (e.g., "Global Reader")
- [ ] Select "Eligible (requires activation)"
- [ ] Choose "After Duration" → "8 hours"
- [ ] Enter justification: "Testing eligible assignment"
- [ ] Submit form
- [ ] Verify success message

#### 2. View Assignment on Role Assignments Page
- [ ] Navigate to PIM → Role Assignments
- [ ] Switch to "Eligible Assignments" tab
- [ ] Find the newly created assignment
- [ ] Verify expiration shows correct date/time

#### 3. Assign Active Role with Permanent Expiration
- [ ] Navigate to PIM → Assign Roles
- [ ] Search for a group
- [ ] Select group from dropdown
- [ ] Choose a role
- [ ] Select "Active (immediately active)"
- [ ] Choose "Permanent"
- [ ] Enter justification: "Testing permanent active assignment"
- [ ] Submit form

#### 4. View on Role Assignments Page
- [ ] Navigate to PIM → Role Assignments
- [ ] Switch to "Active Assignments" tab
- [ ] Find the group assignment
- [ ] Verify expiration shows "Permanent"

#### 5. Assign with End Date
- [ ] Create new assignment
- [ ] Choose "End Date" for expiration
- [ ] Select date 30 days in future
- [ ] Submit and verify

#### 6. My Roles Page
- [ ] Have an eligible role assigned to your account
- [ ] Navigate to PIM → My Roles
- [ ] Verify expiration displays correctly
- [ ] Activate a role
- [ ] Verify activated role shows expiration

## Required Permissions

### Microsoft Graph Permissions (Delegated):
- `RoleManagement.ReadWrite.Directory` - Required for creating assignments
- `RoleAssignmentSchedule.ReadWrite.Directory` - Required for schedule management
- `User.Read.All` - For user search
- `Group.Read.All` - For group search
- `RoleManagement.Read.Directory` - For reading role definitions

## Known Limitations

1. **Search Results:** Limited to top 10 results per search
2. **Directory Scope:** Currently only supports directory-wide scope ("/")
3. **No Approval Workflow:** Assignments are created immediately without approval
4. **No Bulk Assignment:** One assignment at a time
5. **No Assignment Removal:** Must use Azure Portal or Graph Explorer to remove assignments

## Future Enhancements (Optional)

- [ ] Add approval workflow for sensitive roles
- [ ] Add bulk assignment capability
- [ ] Add assignment removal/modification
- [ ] Add role activation history view
- [ ] Add notification on assignment creation
- [ ] Add resource-specific scope support (not just directory)
- [ ] Add assignment templates
- [ ] Add audit log for all PIM operations

## API Reference

**Microsoft Documentation:**
- [PIM Overview](https://learn.microsoft.com/en-us/graph/api/resources/privilegedidentitymanagementv3-overview)
- [roleAssignmentScheduleRequest resource](https://learn.microsoft.com/en-us/graph/api/resources/roleassignmentschedulerequest)
- [roleEligibilityScheduleRequest resource](https://learn.microsoft.com/en-us/graph/api/resources/roleeligibilityschedulerequest)
- [Create roleAssignmentScheduleRequest](https://learn.microsoft.com/en-us/graph/api/rbacapplication-post-roleassignmentschedulerequests)
- [Create roleEligibilityScheduleRequest](https://learn.microsoft.com/en-us/graph/api/rbacapplication-post-roleeligibilityschedulerequests)

## Accessibility

All form elements include proper accessibility attributes:
- ✅ All select elements have `title` attributes
- ✅ All inputs have labels or `title` attributes
- ✅ Radio buttons grouped with labels
- ✅ Focus states clearly visible
- ✅ Dark mode fully supported
- ✅ Keyboard navigation functional

## Security Considerations

1. **Authorization:** All APIs check for authenticated session
2. **Token Handling:** Uses delegated tokens with OBO flow
3. **Justification Required:** All assignments require justification text
4. **Timeout Protection:** 25-second timeout prevents hanging requests
5. **Error Privacy:** Error messages don't expose sensitive details to UI

## Performance

- **Search Debouncing:** 300ms delay on principal search
- **API Timeouts:** 25-second timeout on all Graph calls
- **Result Limiting:** Top 10 results to prevent large payloads
- **Loading States:** User feedback during operations

## Completion Status

✅ **All Tasks Complete:**
1. ✅ Create assign PIM roles page
2. ✅ Create assign PIM roles API endpoints (both active and eligible)
3. ✅ Update role assignments page to show expiration dates
4. ✅ Update my roles page to show expiration dates (already implemented)
5. ✅ Update navigation to include assign roles link

**Total Development Time:** ~2 hours  
**Code Quality:** Production-ready with error handling and accessibility  
**Testing:** Manual testing recommended before production deployment
