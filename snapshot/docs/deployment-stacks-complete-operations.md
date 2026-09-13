# Azure Deployment Stacks - Complete Operations Implementation

**Date**: January 2, 2026  
**Reference**: [Microsoft Learn - Deployment Stacks Quickstart](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/quickstart-create-deployment-stacks?tabs=azure-cli%2CCLI)

## Summary

All deployment stack operations from the Microsoft documentation have been implemented and are now available on the Deployment Stacks page.

## Changes Made

### 1. API Version Update

**File**: `src/app/api/azure/deployment-stacks/route.js`

- ✅ Updated from `2022-08-01-preview` (preview) to `2024-03-01` (stable)
- This ensures compatibility with the latest Azure deployment stacks features

### 2. New Operations Implemented

#### Validate Stack Operation

**API Endpoint**: `POST /{scope}/providers/Microsoft.Resources/deploymentStacks/{name}/validate`

**Purpose**: Runs preflight validation on the deployment stack template to verify its acceptance to Azure Resource Manager before actual deployment.

**Request Example**:
```json
{
  "action": "validate",
  "scope": "subscription",
  "subscriptionId": "...",
  "stackName": "myStack",
  "location": "eastus",
  "properties": {
    "actionOnUnmanage": {
      "resources": "detach",
      "resourceGroups": "detach"
    },
    "denySettings": {
      "mode": "none",
      "applyToChildScopes": false
    },
    "template": { /* Bicep/ARM template JSON */ },
    "parameters": { /* parameters object */ }
  }
}
```

**Response**: Returns validation results including list of resources that will be deployed.

#### Enhanced Delete Operation

**Improvements**:
- ✅ Added support for `deleteAll` action (delete managed resources)
- ✅ Added support for `detachAll` action (keep managed resources)
- ✅ User now chooses action via interactive dialog
- ✅ Supports all three unmanage action parameters:
  - `unmanageActionResources`
  - `unmanageActionResourceGroups`
  - `unmanageActionManagementGroups`

#### BypassStackOutOfSyncError Support

**Added to**: Create/Update operations (PUT)

**Purpose**: Allows updating a deployment stack even if it's out of sync with the actual Azure resources.

**Usage**: Add `bypassStackOutOfSyncError: true` to the properties object when creating/updating.

### 3. Front-End Enhancements

**File**: `src/app/azure/deployment-stacks/page.jsx`

#### New "Validate" Button

- Added next to "Create Stack" button in the create/update modal
- Validates the template before deployment
- Shows validation results including:
  - List of resources to be deployed
  - Validation duration
  - Any validation errors or warnings

#### Improved Delete Dialog

- Two-step confirmation process:
  1. First dialog: Choose to DELETE managed resources or cancel
  2. Second dialog: If cancelled, confirm to DETACH (keep) managed resources
- Clear feedback message after deletion showing what happened to resources

## Complete Operations List

All operations from the quickstart guide are now implemented:

### ✅ List Deployment Stacks
- **CLI**: `az stack group show`
- **API**: `GET /{scope}/providers/Microsoft.Resources/deploymentStacks`
- **Scopes**: subscription, resourceGroup, managementGroup

### ✅ Get Single Stack
- **CLI**: `az stack group show --name <name>`
- **API**: `GET /{scope}/providers/Microsoft.Resources/deploymentStacks/{name}`
- **Scopes**: subscription, resourceGroup, managementGroup

### ✅ Create/Update Stack
- **CLI**: `az stack group create`
- **API**: `PUT /{scope}/providers/Microsoft.Resources/deploymentStacks/{name}`
- **Scopes**: subscription, resourceGroup, managementGroup
- **Features**:
  - Template deployment
  - Parameters
  - Action on unmanage (delete/detach)
  - Deny settings (none/denyDelete/denyWriteAndDelete)
  - Apply to child scopes
  - Bypass stack out of sync error

### ✅ Validate Stack (NEW)
- **CLI**: N/A (SDK only in 2024-03-01)
- **API**: `POST /{scope}/providers/Microsoft.Resources/deploymentStacks/{name}/validate`
- **Scopes**: subscription, resourceGroup, managementGroup
- **Purpose**: Preflight validation before deployment

### ✅ Delete Stack
- **CLI**: `az stack group delete`
- **API**: `DELETE /{scope}/providers/Microsoft.Resources/deploymentStacks/{name}`
- **Scopes**: subscription, resourceGroup, managementGroup
- **Actions**:
  - `deleteAll`: Delete stack and all managed resources
  - `detachAll`: Delete stack but keep managed resources

### ✅ Export Template
- **CLI**: N/A
- **API**: `POST /{scope}/providers/Microsoft.Resources/deploymentStacks/{name}/exportTemplate`
- **Scopes**: subscription, resourceGroup, managementGroup
- **Purpose**: Download the deployment stack template as JSON

## API Documentation Reference

**Base URL**: `https://management.azure.com`  
**API Version**: `2024-03-01`  
**Documentation**: https://learn.microsoft.com/en-us/rest/api/resources/deployment-stacks

## Testing Checklist

To verify all operations work correctly:

- [ ] **List Stacks**: Select subscription/resource group and view stacks list
- [ ] **Get Stack Details**: Click on a stack to view full details
- [ ] **Create Stack**: 
  - [ ] At subscription scope
  - [ ] At resource group scope
  - [ ] At management group scope
- [ ] **Validate Stack**: Click "Validate" button before creating
- [ ] **Update Stack**: Modify existing stack and update
- [ ] **Delete Stack**:
  - [ ] Choose "Delete" action (removes resources)
  - [ ] Choose "Detach" action (keeps resources)
- [ ] **Export Template**: Click export button and download JSON

## User Experience Improvements

1. **Validation Feedback**: Users can now validate templates before deployment, catching errors early
2. **Delete Clarity**: Clear dialogs explain what will happen to managed resources
3. **Stable API**: Using the stable 2024-03-01 version instead of preview
4. **Complete Feature Set**: All documented operations are available

## Files Modified

1. `src/app/api/azure/deployment-stacks/route.js` (602 lines)
   - Updated API version
   - Added validate operation handler
   - Enhanced POST method to support both export and validate
   - Added bypassStackOutOfSyncError parameter documentation

2. `src/app/azure/deployment-stacks/page.jsx` (1497 lines)
   - Added `validateStack()` function
   - Enhanced `deleteStack()` with interactive dialogs
   - Added "Validate" button to create modal
   - Improved user feedback messages

## Next Steps

1. Test each operation in a real Azure environment
2. Consider adding:
   - Real-time validation as user types template
   - Template editor with syntax highlighting (Monaco Editor)
   - Visual resource tree view
   - Deployment history tracking
3. Add more detailed error messages for common validation failures

## Compliance

All implementations follow:
- ✅ Microsoft Azure REST API guidelines
- ✅ Azure deployment stacks best practices
- ✅ Next.js 16 App Router patterns
- ✅ Existing codebase conventions
