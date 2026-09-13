# PIM (Privileged Identity Management) Setup Guide

This guide explains how to configure the required permissions for PIM features to work in the Portal of Portals application.

## Required Microsoft Graph API Permissions

To use PIM features, you must grant the following **Delegated permissions** to your Azure AD app registration:

### PIM Role Management (Choose one or more based on your needs)

**Read-only access:**
- `RoleManagement.Read.Directory` - Read role-based access control (RBAC) settings
- `RoleEligibilitySchedule.Read.Directory` - Read role eligibility schedules

**Read/Write access (required for role activation):**
- `RoleManagement.ReadWrite.Directory` - Read and write role-based access control settings
- `RoleEligibilitySchedule.ReadWrite.Directory` - Read and write role eligibility schedules

**Alternative (broader scope):**
- `RoleManagement.Read.All` - Read all RBAC settings for all resources

## How to Add Permissions

### Step 1: Open Azure Portal
1. Navigate to [Azure Portal](https://portal.azure.com)
2. Go to **Azure Active Directory** → **App registrations**
3. Select your app registration (the one used for this application)

### Step 2: Add API Permissions
1. Click **API permissions** in the left menu
2. Click **+ Add a permission**
3. Select **Microsoft Graph**
4. Select **Delegated permissions**
5. Search for and select the following permissions:
   - `RoleManagement.Read.Directory` (minimum for viewing)
   - `RoleEligibilitySchedule.Read.Directory` (minimum for viewing)
   - `RoleManagement.ReadWrite.Directory` (for activation)
   - `RoleEligibilitySchedule.ReadWrite.Directory` (for activation)

### Step 3: Grant Admin Consent
1. After adding permissions, click **Grant admin consent for [Your Tenant]**
2. Confirm the consent dialog
3. Wait for the status to show "Granted"

### Step 4: Verify Permissions
After granting permissions, verify they appear in the API permissions list with status "Granted for [Your Tenant]"

## Features and Required Permissions

| Feature | Minimum Required Permissions |
|---------|----------------------------|
| View My Eligible Roles | `RoleEligibilitySchedule.Read.Directory` |
| View All Role Assignments | `RoleManagement.Read.Directory` |
| Activate Eligible Roles | `RoleManagement.ReadWrite.Directory`, `RoleEligibilitySchedule.ReadWrite.Directory` |

## Additional Configuration

### User Assignment Required
If your app registration has "User assignment required" enabled:
1. Go to **Enterprise applications** in Azure AD
2. Find your application
3. Click **Properties**
4. Set **User assignment required** to **No** (or assign users/groups explicitly)

### Conditional Access
Ensure that Conditional Access policies don't block the application from accessing these APIs.

## Troubleshooting

### "403 Forbidden" Error
- **Cause**: Missing API permissions or admin consent not granted
- **Solution**: Follow steps above to add permissions and grant admin consent

### "Authorization failed due to missing permission scope"
- **Cause**: The delegated token doesn't include required scopes
- **Solution**: 
  1. Verify permissions are granted in Azure Portal
  2. Sign out and sign back in to get a new token with updated scopes
  3. Clear browser cache/cookies if issue persists

### "No eligible roles found"
- **Cause**: User doesn't have any PIM role assignments
- **Solution**: 
  1. Verify user has eligible roles assigned in Azure AD → Privileged Identity Management
  2. Check role assignments in Azure Portal: Azure AD → Privileged Identity Management → Azure AD roles → Assignments

## API Reference
- [PIM Role Eligibility Schedules](https://learn.microsoft.com/en-us/graph/api/rbacapplication-list-roleeligibilityschedules)
- [PIM Role Assignment Schedules](https://learn.microsoft.com/en-us/graph/api/rbacapplication-list-roleassignmentschedules)
- [Activate PIM Role](https://learn.microsoft.com/en-us/graph/api/rbacapplication-post-roleassignmentschedulerequests)
- [Microsoft Graph Permissions Reference](https://learn.microsoft.com/en-us/graph/permissions-reference#role-management-permissions)
