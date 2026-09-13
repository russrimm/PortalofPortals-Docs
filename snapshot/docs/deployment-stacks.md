# Azure Deployment Stacks

## Overview
Azure Deployment Stacks provide a lifecycle management solution for Azure resources with built-in deny assignments to prevent unauthorized modifications or deletions.

## Implementation

### API Route: `/api/azure/deployment-stacks`
Location: `src/app/api/azure/deployment-stacks/route.js`

Supports all deployment stack operations:
- **GET** - List stacks or get a single stack
- **PUT** - Create or update a deployment stack
- **DELETE** - Delete a deployment stack
- **POST** - Export template from a stack

### UI Page: `/azure/deployment-stacks`
Location: `src/app/azure/deployment-stacks/page.jsx`

Features:
- List deployment stacks at subscription, resource group, or management group scope
- Create new deployment stacks with full configuration
- View detailed information about each stack (resources, settings, deny assignments)
- Export ARM/Bicep templates from existing stacks
- Delete stacks with configurable unmanage actions

## API Documentation

### List Deployment Stacks
```http
GET /api/azure/deployment-stacks?scope=subscription&subscriptionId=xxx
```

Query Parameters:
- `scope`: 'subscription' | 'resourceGroup' | 'managementGroup' (default: 'subscription')
- `subscriptionId`: Required for subscription/resourceGroup scope
- `resourceGroupName`: Required for resourceGroup scope
- `managementGroupId`: Required for managementGroup scope
- `stackName`: Optional - if provided, gets single stack instead of list

### Create/Update Deployment Stack
```http
PUT /api/azure/deployment-stacks
Content-Type: application/json

{
  "scope": "subscription",
  "subscriptionId": "xxx",
  "stackName": "my-stack",
  "location": "eastus",
  "properties": {
    "description": "My deployment stack",
    "actionOnUnmanage": {
      "resources": "detach",
      "resourceGroups": "detach"
    },
    "denySettings": {
      "mode": "denyDelete",
      "applyToChildScopes": false
    },
    "template": { ... },
    "parameters": { ... }
  }
}
```

### Delete Deployment Stack
```http
DELETE /api/azure/deployment-stacks?scope=subscription&subscriptionId=xxx&stackName=my-stack&unmanageActionResources=detach
```

Query Parameters:
- `scope`: 'subscription' | 'resourceGroup' | 'managementGroup'
- `subscriptionId`: Required for subscription/resourceGroup scope
- `resourceGroupName`: Required for resourceGroup scope
- `managementGroupId`: Required for managementGroup scope
- `stackName`: Required
- `unmanageActionResources`: 'delete' | 'detach' (optional)
- `unmanageActionResourceGroups`: 'delete' | 'detach' (optional)
- `unmanageActionManagementGroups`: 'delete' | 'detach' (optional)

### Export Template
```http
POST /api/azure/deployment-stacks
Content-Type: application/json

{
  "action": "export",
  "scope": "subscription",
  "subscriptionId": "xxx",
  "stackName": "my-stack"
}
```

## Key Concepts

### Scopes
Deployment stacks can be created at three scopes:
1. **Subscription** - Manages resources across a subscription
2. **Resource Group** - Manages resources within a specific resource group
3. **Management Group** - Manages resources across multiple subscriptions

### Action on Unmanage
When resources are removed from a deployment stack, you can choose to:
- **Detach** - Keep the resources but remove them from stack management
- **Delete** - Delete the resources when they're removed from the stack

This applies to:
- Resources
- Resource Groups
- Management Groups (management group scope only)

### Deny Settings
Deployment stacks can apply Azure Policy deny assignments to prevent modifications:

#### Modes
- **none** - No deny assignments (default)
- **denyDelete** - Prevent deletion of managed resources
- **denyWriteAndDelete** - Prevent modifications and deletion of managed resources

#### Options
- **applyToChildScopes** - Apply deny settings to child resource groups and resources
- **excludedPrincipals** - List of principal IDs exempt from deny assignments (max 5)
- **excludedActions** - List of actions exempt from deny assignments (max 200)

### Template Sources
Deployment stacks support two methods for providing templates:
1. **Inline Template** - Provide the ARM/Bicep template JSON directly in the request
2. **Template Link** - Reference a template stored in a URI (storage account, GitHub, etc.)

## UI Features

### Scope Configuration
- Select between subscription, resource group, or management group scope
- Enter scope-specific identifiers (subscription ID, resource group name, etc.)
- Scope selection affects which stacks are displayed and where new stacks are created

### Stack List View
- Displays all deployment stacks in the selected scope
- Shows key information:
  - Stack name and location
  - Provisioning state (color-coded)
  - Deny mode indicator (shield/lock icons)
  - Number of managed resources
  - Action on unmanage settings

### Expanded Stack Details
Click the chevron icon to view detailed information:

#### Resources Tab
- Lists all resources managed by the stack
- Shows resource ID, status, and deny status

#### Settings Tab
- Deployment scope
- Duration
- Correlation ID

#### Deny Tab
- Deny mode and child scope application
- Excluded principals list
- Excluded actions list

### Create Stack Modal
Complete form for creating new deployment stacks:
- Stack name (1-90 characters)
- Location (for subscription/management group scopes)
- Description (optional, max 4096 characters)
- Action on unmanage for resources and resource groups
- Deny settings mode and child scope option
- ARM/Bicep template (JSON format)
- Parameters (JSON format)

### Export Template
Click the download icon to export the ARM/Bicep template from any stack. The template is downloaded as a JSON file.

### Delete Stack
Click the trash icon to delete a stack. Resources are detached (kept) by default.

## Usage Examples

### Example 1: Create a Stack with Deny Delete Protection
```javascript
const response = await fetch('/api/azure/deployment-stacks', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    scope: 'subscription',
    subscriptionId: 'xxx',
    stackName: 'protected-infrastructure',
    location: 'eastus',
    properties: {
      description: 'Core infrastructure with delete protection',
      actionOnUnmanage: {
        resources: 'detach',
        resourceGroups: 'detach'
      },
      denySettings: {
        mode: 'denyDelete',
        applyToChildScopes: true
      },
      template: {
        "$schema": "https://schema.management.azure.com/schemas/2018-05-01/subscriptionDeploymentTemplate.json#",
        "contentVersion": "1.0.0.0",
        "resources": [
          {
            "type": "Microsoft.Resources/resourceGroups",
            "apiVersion": "2021-04-01",
            "name": "rg-core",
            "location": "eastus"
          }
        ]
      }
    }
  })
});
```

### Example 2: List All Stacks in a Resource Group
```javascript
const response = await fetch('/api/azure/deployment-stacks?scope=resourceGroup&subscriptionId=xxx&resourceGroupName=my-rg');
const data = await response.json();
console.log(data.data.value); // Array of stacks
```

### Example 3: Delete a Stack and Its Resources
```javascript
const response = await fetch('/api/azure/deployment-stacks?scope=subscription&subscriptionId=xxx&stackName=my-stack&unmanageActionResources=delete', {
  method: 'DELETE'
});
```

## Best Practices

### 1. Choose Appropriate Deny Mode
- Use `none` for development environments
- Use `denyDelete` for production infrastructure
- Use `denyWriteAndDelete` for highly sensitive resources

### 2. Set Action on Unmanage Carefully
- `detach` is safer - prevents accidental deletions
- `delete` ensures clean removal but can be destructive
- Consider using `detach` by default and delete manually when needed

### 3. Scope Selection
- Use **subscription** scope for shared services across resource groups
- Use **resource group** scope for application-specific infrastructure
- Use **management group** scope for organization-wide policies

### 4. Template Management
- Store templates in source control
- Use template links for better version control
- Include detailed descriptions in stack metadata

### 5. Exclude Critical Principals
- Add break-glass accounts to `excludedPrincipals`
- Document why principals are excluded
- Regularly review and update exclusions

## Limitations

1. **API Version**: Uses preview API version `2022-08-01-preview`
2. **Maximum Values**:
   - Stack name: 1-90 characters
   - Description: 4096 characters max
   - Excluded principals: 5 max
   - Excluded actions: 200 max
3. **Scope Requirements**:
   - Subscription/Management Group stacks require `location` property
   - Resource Group stacks inherit location from parent resource group

## Troubleshooting

### Stack Creation Fails with 400 Bad Request
- Verify template JSON is valid
- Check that required properties are present:
  - `actionOnUnmanage` with `resources` and `resourceGroups`
  - `denySettings` with `mode`
- Ensure stack name is 1-90 characters and follows naming conventions

### 401 Unauthorized
- Token may be expired - the API uses automatic token refresh
- Check that you have appropriate RBAC permissions:
  - Owner or Contributor role at the target scope
  - Deployment Stack Contributor role (if available)

### Resources Not Denied
- Verify `denySettings.mode` is not `none`
- Check if the principal is in `excludedPrincipals` list
- Ensure deny assignment has propagated (can take a few minutes)

### Stack Deletion Fails
- Check for dependent resources not managed by the stack
- Try using `unmanageActionResources=detach` first
- Verify you have permissions to delete the stack

## Additional Resources

- [Azure Deployment Stacks Documentation](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/deployment-stacks)
- [REST API Reference](https://learn.microsoft.com/en-us/rest/api/resources/deployment-stacks)
- [Bicep Overview](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/overview)
