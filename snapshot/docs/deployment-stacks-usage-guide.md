# Azure Deployment Stacks - Complete Usage Guide

## Overview

The Azure Deployment Stacks feature is **fully implemented** in Portal 360°. This guide explains how to use the existing functionality to create, manage, and delete deployment stacks across subscription, resource group, and management group scopes.

## What are Deployment Stacks?

Azure Deployment Stacks provide declarative resource lifecycle management with:
- **Lifecycle Management**: Track and manage resources as a unit
- **Deny Assignments**: Protect resources from unauthorized modifications or deletions
- **Cleanup Control**: Define what happens to resources when they're removed from templates
- **Multi-scope Support**: Deploy at resource group, subscription, or management group level

## API Implementation

### Base Endpoint
```
/api/azure/deployment-stacks
```

### Supported Operations

#### 1. Create or Update Deployment Stack (PUT)
**Endpoint**: `PUT /api/azure/deployment-stacks`

**Request Body**:
```json
{
  "scope": "subscription",
  "subscriptionId": "00000000-0000-0000-0000-000000000000",
  "stackName": "myDeploymentStack",
  "location": "eastus",
  "tags": {
    "environment": "production",
    "team": "infrastructure"
  },
  "properties": {
    "description": "Production infrastructure stack",
    "actionOnUnmanage": {
      "resources": "detach",
      "resourceGroups": "detach",
      "managementGroups": "detach"
    },
    "denySettings": {
      "mode": "denyDelete",
      "excludedPrincipals": ["principal-id-1", "principal-id-2"],
      "excludedActions": ["Microsoft.Network/*/read"],
      "applyToChildScopes": false
    },
    "template": {
      "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
      "contentVersion": "1.0.0.0",
      "resources": [
        {
          "type": "Microsoft.Storage/storageAccounts",
          "apiVersion": "2021-04-01",
          "name": "mystorageaccount",
          "location": "[resourceGroup().location]",
          "sku": {
            "name": "Standard_LRS"
          },
          "kind": "StorageV2"
        }
      ]
    },
    "parameters": {
      "storageAccountName": {
        "value": "mystorageaccount"
      }
    }
  }
}
```

**Response (201 Created)**:
```json
{
  "success": true,
  "data": {
    "id": "/subscriptions/{subscriptionId}/providers/Microsoft.Resources/deploymentStacks/{stackName}",
    "name": "myDeploymentStack",
    "type": "Microsoft.Resources/deploymentStacks",
    "location": "eastus",
    "properties": {
      "provisioningState": "creating",
      "description": "Production infrastructure stack",
      "actionOnUnmanage": {
        "resources": "detach",
        "resourceGroups": "detach"
      },
      "denySettings": {
        "mode": "denyDelete",
        "applyToChildScopes": false
      }
    }
  },
  "asyncOperation": "https://management.azure.com/...",
  "retryAfter": 10,
  "status": 201
}
```

#### 2. List Deployment Stacks (GET)
**Endpoint**: `GET /api/azure/deployment-stacks?scope=subscription&subscriptionId={id}`

**Query Parameters**:
- `scope`: 'subscription' | 'resourceGroup' | 'managementGroup'
- `subscriptionId`: Required for subscription/resourceGroup scope
- `resourceGroupName`: Required for resourceGroup scope
- `managementGroupId`: Required for managementGroup scope
- `stackName`: Optional - retrieve single stack

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "value": [
      {
        "id": "/subscriptions/{subscriptionId}/providers/Microsoft.Resources/deploymentStacks/{stackName}",
        "name": "myDeploymentStack",
        "type": "Microsoft.Resources/deploymentStacks",
        "location": "eastus",
        "properties": {
          "provisioningState": "succeeded",
          "resources": [
            {
              "id": "/subscriptions/.../providers/Microsoft.Storage/storageAccounts/mystorageaccount",
              "status": "managed",
              "denyStatus": "denyDelete"
            }
          ]
        }
      }
    ]
  }
}
```

#### 3. Delete Deployment Stack (DELETE)
**Endpoint**: `DELETE /api/azure/deployment-stacks?scope=subscription&subscriptionId={id}&stackName={name}`

**Query Parameters**:
- `scope`: 'subscription' | 'resourceGroup' | 'managementGroup'
- `subscriptionId`: Required for subscription/resourceGroup scope
- `resourceGroupName`: Required for resourceGroup scope
- `managementGroupId`: Required for managementGroup scope
- `stackName`: Required
- `unmanageActionResources`: 'delete' | 'detach' (optional, default: detach)
- `unmanageActionResourceGroups`: 'delete' | 'detach' (optional)
- `unmanageActionManagementGroups`: 'delete' | 'detach' (optional)

**Response (200 OK)**:
```json
{
  "success": true,
  "message": "Deployment stack 'myDeploymentStack' deleted successfully"
}
```

#### 4. Export Template (POST)
**Endpoint**: `POST /api/azure/deployment-stacks`

**Request Body**:
```json
{
  "action": "export",
  "scope": "subscription",
  "subscriptionId": "00000000-0000-0000-0000-000000000000",
  "stackName": "myDeploymentStack"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "template": {
    "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
    "contentVersion": "1.0.0.0",
    "resources": [...]
  }
}
```

## UI Usage Guide

### Accessing the Deployment Stacks Page
1. Navigate to `/azure/deployment-stacks`
2. Or use the navigation: Azure → Deployment Stacks

### Creating a New Deployment Stack

1. **Select Scope**:
   - Choose scope: Subscription, Resource Group, or Management Group
   - Enter required IDs (subscription ID, resource group name, or management group ID)

2. **Click "Create Stack" Button**

3. **Fill Out the Form**:
   - **Stack Name** (required): 1-90 characters, alphanumeric with dashes, underscores, parentheses
   - **Location** (required for subscription/management group): Select Azure region
   - **Description** (optional): Up to 4096 characters
   - **Action on Unmanage Resources**: 
     - `detach`: Keep resources when removed from template
     - `delete`: Delete resources when removed from template
   - **Action on Unmanage Resource Groups**: Same options as resources
   - **Deny Settings Mode**:
     - `none`: No restrictions
     - `denyDelete`: Prevent deletion (allow read/modify)
     - `denyWriteAndDelete`: Read-only (prevent modifications and deletions)
   - **Apply to Child Scopes**: Enable to apply deny settings to child resources
   - **Template** (required): ARM/Bicep template JSON
   - **Parameters** (optional): Template parameters JSON

4. **Click "Create Stack"**

### Viewing Deployment Stacks

- **List View**: Shows all stacks in the selected scope
- **Stack Details**: Click the chevron to expand
  - **Resources Tab**: View managed resources with status
  - **Settings Tab**: View deployment scope, duration, correlation ID
  - **Deny Settings Tab**: View deny mode and exclusions

### Managing Stacks

- **Export Template**: Click the download icon to export as JSON
- **Delete Stack**: Click the trash icon (confirmation required)
- **Refresh**: Click the refresh button to reload the list

## Configuration Properties

### ActionOnUnmanage
Defines what happens to resources no longer in the template:
- `resources`: 'delete' | 'detach'
- `resourceGroups`: 'delete' | 'detach'
- `managementGroups`: 'delete' | 'detach'

### DenySettings
Controls access restrictions on managed resources:
- `mode`: 'none' | 'denyDelete' | 'denyWriteAndDelete'
- `excludedPrincipals`: Array of principal IDs (max 5)
- `excludedActions`: Array of action patterns (max 200)
- `applyToChildScopes`: Boolean

**Auto-excluded Actions**:
- When `mode` = 'denyDelete': `*/read`, `Microsoft.Authorization/locks/delete`
- When `mode` = 'denyWriteAndDelete': `Microsoft.Authorization/locks/delete`

### Template Options

You can provide templates in multiple ways:

1. **Inline Template** (current UI):
   ```json
   "template": { "$schema": "...", "resources": [...] }
   ```

2. **Template Link** (API only):
   ```json
   "templateLink": {
     "uri": "https://example.com/template.json",
     "id": "/subscriptions/{subscriptionId}/resourceGroups/{rg}/providers/Microsoft.Resources/templateSpecs/{name}/versions/{version}",
     "contentVersion": "1.0.0.0",
     "queryString": "sv=2019-02-02&sr=b&sig=...",
     "relativePath": "nestedTemplate.json"
   }
   ```

3. **Parameters Link** (API only):
   ```json
   "parametersLink": {
     "uri": "https://example.com/parameters.json",
     "contentVersion": "1.0.0.0"
   }
   ```

## Scopes Explained

### Subscription Scope
- **Creates stack at**: Subscription level
- **Can deploy to**: Same subscription or a resource group within the subscription
- **Location**: Required
- **Use Case**: Managing resources across multiple resource groups
- **Example URL**: `/subscriptions/{subscriptionId}/providers/Microsoft.Resources/deploymentStacks/{stackName}`

### Resource Group Scope
- **Creates stack at**: Resource group level
- **Can deploy to**: Same resource group only
- **Location**: Inherited from resource group
- **Use Case**: Managing resources within a single resource group
- **Example URL**: `/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Resources/deploymentStacks/{stackName}`

### Management Group Scope
- **Creates stack at**: Management group level
- **Can deploy to**: A specific subscription within the management group
- **Location**: Required
- **Use Case**: Enterprise-wide resource governance
- **Example URL**: `/providers/Microsoft.Management/managementGroups/{managementGroupId}/providers/Microsoft.Resources/deploymentStacks/{stackName}`

## Common Use Cases

### 1. Protect Production Resources
```json
{
  "denySettings": {
    "mode": "denyDelete",
    "applyToChildScopes": true,
    "excludedPrincipals": ["emergency-break-glass-account-id"]
  }
}
```

### 2. Temporary Development Stack
```json
{
  "actionOnUnmanage": {
    "resources": "delete",
    "resourceGroups": "delete"
  },
  "denySettings": {
    "mode": "none"
  }
}
```

### 3. Read-Only Compliance Stack
```json
{
  "denySettings": {
    "mode": "denyWriteAndDelete",
    "applyToChildScopes": false,
    "excludedActions": [
      "Microsoft.Network/networkSecurityGroups/read",
      "Microsoft.Compute/virtualMachines/read"
    ]
  }
}
```

### 4. Multi-Region Deployment
```json
{
  "location": "eastus",
  "properties": {
    "deploymentScope": "/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}",
    "template": {
      "resources": [
        { "location": "eastus", ... },
        { "location": "westus", ... }
      ]
    }
  }
}
```

## Authentication & Permissions

### Required Permissions
- **Create/Update Stack**: `Microsoft.Resources/deploymentStacks/write`
- **Delete Stack**: `Microsoft.Resources/deploymentStacks/delete`
- **Read Stack**: `Microsoft.Resources/deploymentStacks/read`
- **Managed Resources**: Appropriate permissions for the resources being managed

### Authentication Flow
1. User authenticates via NextAuth (Entra ID)
2. Backend obtains Azure Management token via `getAzureManagementToken()`
3. Token includes delegated permissions with user's access rights
4. API calls to Azure Resource Manager use this token

## Error Handling

### Common Errors

#### 401 Unauthorized
```json
{
  "error": "Not authenticated",
  "requiresAuth": true
}
```
**Solution**: Re-authenticate via the login page

#### 400 Bad Request - Invalid Stack Name
```json
{
  "error": "stackName must be between 1 and 90 characters"
}
```
**Solution**: Use a valid stack name (1-90 chars, alphanumeric with `-`, `_`, `(`, `)`)

#### 400 Bad Request - Missing Properties
```json
{
  "error": "actionOnUnmanage and denySettings are required in properties"
}
```
**Solution**: Ensure both `actionOnUnmanage` and `denySettings` are in the request

#### 409 Conflict - Stack Already Exists
**Solution**: Use PUT to update the existing stack

#### Template Validation Errors
```json
{
  "error": "Failed to create/update deployment stack (400)",
  "details": "Template validation failed: ..."
}
```
**Solution**: Fix template syntax or resource configuration

## Async Operations

Deployment stack operations are often asynchronous. The API returns:
- **Status 201**: Operation started successfully
- **Azure-AsyncOperation header**: URL to poll for operation status
- **Retry-After header**: Recommended polling interval in seconds

**Polling Example**:
```javascript
const response = await fetch('/api/azure/deployment-stacks', {
  method: 'PUT',
  body: JSON.stringify(stackData)
});

const result = await response.json();

if (result.asyncOperation) {
  // Poll the asyncOperation URL
  const pollUrl = result.asyncOperation;
  const retryAfter = result.retryAfter || 10;
  
  // Wait and check status
  setTimeout(async () => {
    const statusResponse = await fetch(pollUrl, {
      headers: { 'Authorization': 'Bearer ...' }
    });
    const status = await statusResponse.json();
    console.log('Operation status:', status.status);
  }, retryAfter * 1000);
}
```

## API Version

Current implementation uses:
```
api-version=2022-08-01-preview
```

This is a preview API version. For production, monitor for GA version updates.

## Limitations

1. **Template Size**: Maximum 4 MB for inline templates
2. **Excluded Principals**: Maximum 5 per deny setting
3. **Excluded Actions**: Maximum 200 per deny setting
4. **Description Length**: Maximum 4096 characters
5. **Stack Name Length**: 1-90 characters
6. **Stack Name Pattern**: `^[-\w\._\(\)]+$`

## Best Practices

### 1. Use Descriptive Names
✅ Good: `prod-networking-stack`, `dev-app-infrastructure`  
❌ Bad: `stack1`, `test`, `temp`

### 2. Always Set Deny Settings
- Production: Use `denyDelete` or `denyWriteAndDelete`
- Development: Can use `none` for flexibility
- Never leave unprotected in production

### 3. Plan ActionOnUnmanage Carefully
- `detach`: Safe but leaves orphaned resources
- `delete`: Clean but can be destructive
- Choose based on environment and resource criticality

### 4. Use Resource Group Scope When Possible
- Simpler permissions model
- Easier to manage and troubleshoot
- Better for team-specific resources

### 5. Tag Your Stacks
```json
{
  "tags": {
    "environment": "production",
    "owner": "platform-team",
    "cost-center": "engineering",
    "managed-by": "deployment-stack"
  }
}
```

### 6. Export Templates for Backup
- Regularly export templates before major changes
- Store in version control
- Use for disaster recovery

### 7. Test in Non-Production First
- Always validate templates in dev/test environments
- Use smaller scopes initially (resource group vs subscription)
- Gradually expand scope and restrictions

## Troubleshooting

### Stack Creation Hangs
- Check async operation URL for detailed status
- Verify template syntax is valid ARM/Bicep JSON
- Ensure all referenced resources are accessible

### Resources Not Protected
- Verify deny settings mode is set (not 'none')
- Check if principal is in excludedPrincipals list
- Confirm applyToChildScopes is enabled if needed

### Cannot Delete Managed Resource
- This is expected behavior with deny settings!
- Update the stack template to remove the resource
- Or delete the entire stack with appropriate unmanageAction

### Template Export Fails
- Ensure stack exists and is in succeeded state
- Check permissions on the stack resource
- Try refreshing the stack list first

## Related Documentation

- [Azure Deployment Stacks REST API](https://learn.microsoft.com/en-us/rest/api/resources/deployment-stacks)
- [Deployment Stacks Overview](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/deployment-stacks)
- [ARM Template Reference](https://learn.microsoft.com/en-us/azure/templates/)
- [Azure RBAC for Deployment Stacks](https://learn.microsoft.com/en-us/azure/role-based-access-control/built-in-roles#deployment-stacks-contributor)

## Support

For issues or questions:
1. Check console logs for detailed error messages
2. Review Azure Portal for deployment stack status
3. Verify permissions and authentication
4. Test with minimal template first
5. Consult Azure documentation for template syntax

---

**Last Updated**: January 29, 2025  
**API Version**: 2022-08-01-preview  
**Status**: ✅ Fully Implemented and Operational
