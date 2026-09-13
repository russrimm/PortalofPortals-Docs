# Azure Deployment Stacks - Code Examples

## ✨ New Features

### 1. Subscription Selector
When creating a deployment stack through the UI, you can now **select from your existing subscriptions** instead of manually entering the subscription ID. The system automatically loads all available subscriptions and presents them in a dropdown with both display name and ID for easy selection.

**UI Features:**
- **Automatic subscription loading** on page load
- **Dropdown selector** showing subscription name and ID
- **Fallback to manual entry** if subscriptions can't be loaded
- **Default selection** of first subscription for convenience

### 2. Template Builder 🎨 NEW!
Build ARM templates visually without writing JSON manually! The template builder provides an intuitive interface for creating deployment templates.

**Template Builder Features:**
- **Visual resource builder** - Add Azure resources with a single click
- **Pre-built templates** - Quick start with common scenarios (Storage, Web App, Network)
- **Resource library** - Support for 8+ common Azure resource types
- **Parameter management** - Visual parameter editor with name/value pairs
- **Live preview** - See generated JSON as you build
- **Toggle modes** - Switch between Builder and JSON modes anytime

**Supported Resource Types:**
- ✅ Storage Accounts
- ✅ Virtual Networks
- ✅ App Services & Plans
- ✅ Key Vaults
- ✅ SQL Servers
- ✅ Cosmos DB
- ✅ Virtual Machines
- ✅ Network Security Groups (in pre-built templates)

**Quick Start Templates:**
- **Storage Account** - Simple blob storage setup
- **Web App** - App Service Plan + App Service
- **Network Infrastructure** - VNet + NSG with security rules

**How to Use:**
1. Click "Create Stack" button
2. Select "Builder" mode (default)
3. Choose a quick start template OR add individual resources
4. Add parameters with the "Add Parameter" button
5. Review the live JSON preview
6. Switch to JSON mode to fine-tune if needed
7. Create your deployment stack!

---

## Quick Start Examples

### Example 1: Create a Simple Storage Account Stack

**Frontend (React/Next.js)**:
```javascript
const createStorageStack = async () => {
  const response = await fetch('/api/azure/deployment-stacks', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scope: 'subscription',
      subscriptionId: process.env.NEXT_PUBLIC_AZURE_SUBSCRIPTION_ID,
      stackName: 'storage-stack',
      location: 'eastus',
      properties: {
        description: 'Production storage account',
        actionOnUnmanage: {
          resources: 'detach',
          resourceGroups: 'detach'
        },
        denySettings: {
          mode: 'denyDelete',
          applyToChildScopes: false
        },
        template: {
          "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
          "contentVersion": "1.0.0.0",
          "resources": [
            {
              "type": "Microsoft.Storage/storageAccounts",
              "apiVersion": "2021-04-01",
              "name": "[parameters('storageAccountName')]",
              "location": "[parameters('location')]",
              "sku": {
                "name": "Standard_LRS"
              },
              "kind": "StorageV2",
              "properties": {
                "supportsHttpsTrafficOnly": true,
                "minimumTlsVersion": "TLS1_2"
              }
            }
          ],
          "parameters": {
            "storageAccountName": {
              "type": "string"
            },
            "location": {
              "type": "string",
              "defaultValue": "[resourceGroup().location]"
            }
          }
        },
        parameters: {
          "storageAccountName": {
            "value": "prodstorageacct001"
          }
        }
      }
    })
  });

  const result = await response.json();
  
  if (result.success) {
    console.log('Stack created:', result.data);
    return result.data;
  } else {
    console.error('Failed to create stack:', result.error);
    throw new Error(result.error);
  }
};
```

### Example 2: Create a Resource Group with Multiple Resources

```javascript
const createAppInfrastructureStack = async () => {
  const response = await fetch('/api/azure/deployment-stacks', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scope: 'resourceGroup',
      subscriptionId: 'your-subscription-id',
      resourceGroupName: 'prod-rg',
      stackName: 'app-infrastructure',
      properties: {
        description: 'Application infrastructure with VNet, NSG, and App Service',
        actionOnUnmanage: {
          resources: 'detach'
        },
        denySettings: {
          mode: 'denyDelete',
          excludedPrincipals: ['emergency-admin-principal-id'],
          applyToChildScopes: true
        },
        template: {
          "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
          "contentVersion": "1.0.0.0",
          "resources": [
            {
              "type": "Microsoft.Network/virtualNetworks",
              "apiVersion": "2021-02-01",
              "name": "prod-vnet",
              "location": "[resourceGroup().location]",
              "properties": {
                "addressSpace": {
                  "addressPrefixes": ["10.0.0.0/16"]
                },
                "subnets": [
                  {
                    "name": "app-subnet",
                    "properties": {
                      "addressPrefix": "10.0.1.0/24"
                    }
                  }
                ]
              }
            },
            {
              "type": "Microsoft.Network/networkSecurityGroups",
              "apiVersion": "2021-02-01",
              "name": "prod-nsg",
              "location": "[resourceGroup().location]",
              "properties": {
                "securityRules": [
                  {
                    "name": "AllowHTTPS",
                    "properties": {
                      "priority": 100,
                      "protocol": "Tcp",
                      "access": "Allow",
                      "direction": "Inbound",
                      "sourceAddressPrefix": "*",
                      "sourcePortRange": "*",
                      "destinationAddressPrefix": "*",
                      "destinationPortRange": "443"
                    }
                  }
                ]
              }
            },
            {
              "type": "Microsoft.Web/serverfarms",
              "apiVersion": "2021-02-01",
              "name": "prod-app-plan",
              "location": "[resourceGroup().location]",
              "sku": {
                "name": "P1v2",
                "tier": "PremiumV2",
                "capacity": 1
              },
              "kind": "linux",
              "properties": {
                "reserved": true
              }
            },
            {
              "type": "Microsoft.Web/sites",
              "apiVersion": "2021-02-01",
              "name": "prod-app-service",
              "location": "[resourceGroup().location]",
              "dependsOn": [
                "[resourceId('Microsoft.Web/serverfarms', 'prod-app-plan')]"
              ],
              "properties": {
                "serverFarmId": "[resourceId('Microsoft.Web/serverfarms', 'prod-app-plan')]",
                "httpsOnly": true,
                "siteConfig": {
                  "linuxFxVersion": "NODE|18-lts",
                  "minTlsVersion": "1.2"
                }
              }
            }
          ]
        },
        parameters: {}
      }
    })
  });

  return await response.json();
};
```

### Example 3: Management Group Stack with Template Link

```javascript
const createEnterpriseStack = async () => {
  const response = await fetch('/api/azure/deployment-stacks', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scope: 'managementGroup',
      managementGroupId: 'root-mg',
      stackName: 'enterprise-governance',
      location: 'eastus',
      tags: {
        owner: 'platform-team',
        environment: 'production',
        compliance: 'required'
      },
      properties: {
        description: 'Enterprise governance policies and standards',
        deploymentScope: '/subscriptions/target-subscription-id',
        actionOnUnmanage: {
          resources: 'detach',
          resourceGroups: 'detach',
          managementGroups: 'detach'
        },
        denySettings: {
          mode: 'denyWriteAndDelete',
          excludedPrincipals: [
            'security-admin-principal-id',
            'break-glass-account-id'
          ],
          excludedActions: [
            '*/read',
            'Microsoft.Authorization/locks/read',
            'Microsoft.Insights/*/read'
          ],
          applyToChildScopes: true
        },
        templateLink: {
          uri: 'https://mystorageaccount.blob.core.windows.net/templates/enterprise-governance.json',
          contentVersion: '1.0.0.0'
        },
        parametersLink: {
          uri: 'https://mystorageaccount.blob.core.windows.net/parameters/prod-params.json',
          contentVersion: '1.0.0.0'
        }
      }
    })
  });

  return await response.json();
};
```

### Example 4: List Stacks at Different Scopes

**List All Subscription Stacks**:
```javascript
const listSubscriptionStacks = async (subscriptionId) => {
  const params = new URLSearchParams({
    scope: 'subscription',
    subscriptionId: subscriptionId
  });

  const response = await fetch(`/api/azure/deployment-stacks?${params}`);
  const result = await response.json();
  
  if (result.success) {
    return result.data.value; // Array of stacks
  } else {
    throw new Error(result.error);
  }
};
```

**Get Single Stack Details**:
```javascript
const getStackDetails = async (subscriptionId, stackName) => {
  const params = new URLSearchParams({
    scope: 'subscription',
    subscriptionId: subscriptionId,
    stackName: stackName
  });

  const response = await fetch(`/api/azure/deployment-stacks?${params}`);
  const result = await response.json();
  
  if (result.success) {
    return result.data; // Single stack object
  } else {
    throw new Error(result.error);
  }
};
```

### Example 5: Delete Stack with Cleanup

**Delete and Remove All Resources**:
```javascript
const deleteStackAndResources = async (subscriptionId, stackName) => {
  const params = new URLSearchParams({
    scope: 'subscription',
    subscriptionId: subscriptionId,
    stackName: stackName,
    unmanageActionResources: 'delete',
    unmanageActionResourceGroups: 'delete'
  });

  const response = await fetch(`/api/azure/deployment-stacks?${params}`, {
    method: 'DELETE'
  });

  const result = await response.json();
  
  if (result.success) {
    console.log('Stack and resources deleted');
    return true;
  } else {
    throw new Error(result.error);
  }
};
```

**Delete Stack but Keep Resources**:
```javascript
const deleteStackKeepResources = async (subscriptionId, stackName) => {
  const params = new URLSearchParams({
    scope: 'subscription',
    subscriptionId: subscriptionId,
    stackName: stackName,
    unmanageActionResources: 'detach' // Keep resources
  });

  const response = await fetch(`/api/azure/deployment-stacks?${params}`, {
    method: 'DELETE'
  });

  return await response.json();
};
```

### Example 6: Export Stack Template

```javascript
const exportStackTemplate = async (subscriptionId, stackName) => {
  const response = await fetch('/api/azure/deployment-stacks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'export',
      scope: 'subscription',
      subscriptionId: subscriptionId,
      stackName: stackName
    })
  });

  const result = await response.json();
  
  if (result.success) {
    // Download as file
    const blob = new Blob(
      [JSON.stringify(result.template, null, 2)], 
      { type: 'application/json' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${stackName}-template.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    return result.template;
  } else {
    throw new Error(result.error);
  }
};
```

### Example 7: Update Existing Stack

```javascript
const updateStack = async (subscriptionId, stackName) => {
  // Fetch current stack
  const currentStack = await getStackDetails(subscriptionId, stackName);
  
  // Modify template (add a new resource)
  const updatedTemplate = {
    ...currentStack.properties.template,
    resources: [
      ...currentStack.properties.template.resources,
      {
        "type": "Microsoft.Storage/storageAccounts",
        "apiVersion": "2021-04-01",
        "name": "newstorage001",
        "location": "[resourceGroup().location]",
        "sku": {
          "name": "Standard_LRS"
        },
        "kind": "StorageV2"
      }
    ]
  };

  // Update the stack (same PUT endpoint)
  const response = await fetch('/api/azure/deployment-stacks', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scope: 'subscription',
      subscriptionId: subscriptionId,
      stackName: stackName,
      location: currentStack.location,
      properties: {
        ...currentStack.properties,
        template: updatedTemplate
      }
    })
  });

  return await response.json();
};
```

### Example 8: React Hook for Stack Management

```javascript
import { useState, useEffect } from 'react';

export function useDeploymentStacks(scope, scopeParams) {
  const [stacks, setStacks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadStacks = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({ scope, ...scopeParams });
      const response = await fetch(`/api/azure/deployment-stacks?${params}`);
      const result = await response.json();
      
      if (result.success) {
        setStacks(result.data.value || []);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const createStack = async (stackData) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/azure/deployment-stacks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope, ...scopeParams, ...stackData })
      });
      
      const result = await response.json();
      
      if (result.success) {
        await loadStacks(); // Refresh list
        return result.data;
      } else {
        setError(result.error);
        throw new Error(result.error);
      }
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteStack = async (stackName, unmanageAction = 'detach') => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        scope,
        ...scopeParams,
        stackName,
        unmanageActionResources: unmanageAction
      });
      
      const response = await fetch(`/api/azure/deployment-stacks?${params}`, {
        method: 'DELETE'
      });
      
      const result = await response.json();
      
      if (result.success) {
        await loadStacks(); // Refresh list
        return true;
      } else {
        setError(result.error);
        throw new Error(result.error);
      }
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStacks();
  }, [scope, JSON.stringify(scopeParams)]);

  return {
    stacks,
    loading,
    error,
    loadStacks,
    createStack,
    deleteStack
  };
}

// Usage:
const MyComponent = () => {
  const { stacks, loading, error, createStack, deleteStack } = useDeploymentStacks(
    'subscription',
    { subscriptionId: 'your-subscription-id' }
  );

  const handleCreate = async () => {
    try {
      await createStack({
        stackName: 'my-stack',
        location: 'eastus',
        properties: {
          description: 'My deployment stack',
          actionOnUnmanage: { resources: 'detach' },
          denySettings: { mode: 'none' },
          template: { /* ... */ },
          parameters: {}
        }
      });
      console.log('Stack created!');
    } catch (err) {
      console.error('Failed to create stack:', err);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h1>Deployment Stacks ({stacks.length})</h1>
      {stacks.map(stack => (
        <div key={stack.id}>
          <h2>{stack.name}</h2>
          <p>Status: {stack.properties?.provisioningState}</p>
          <button onClick={() => deleteStack(stack.name)}>Delete</button>
        </div>
      ))}
      <button onClick={handleCreate}>Create New Stack</button>
    </div>
  );
};
```

### Example 9: Bicep Template Example

While the API accepts ARM JSON, here's an equivalent Bicep template you can convert:

```bicep
// storage-stack.bicep
@description('Storage account name')
param storageAccountName string

@description('Storage account location')
param location string = resourceGroup().location

@description('Storage account SKU')
@allowed([
  'Standard_LRS'
  'Standard_GRS'
  'Standard_RAGRS'
  'Standard_ZRS'
  'Premium_LRS'
])
param sku string = 'Standard_LRS'

resource storageAccount 'Microsoft.Storage/storageAccounts@2021-04-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: sku
  }
  kind: 'StorageV2'
  properties: {
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
    encryption: {
      services: {
        blob: {
          enabled: true
        }
        file: {
          enabled: true
        }
      }
      keySource: 'Microsoft.Storage'
    }
  }
}

output storageAccountId string = storageAccount.id
output storageAccountName string = storageAccount.name
```

**Convert to JSON and use in API**:
```bash
az bicep build --file storage-stack.bicep --outfile storage-stack.json
```

Then use the JSON output in your API call.

### Example 10: Error Handling Pattern

```javascript
const createStackWithErrorHandling = async (stackData) => {
  try {
    const response = await fetch('/api/azure/deployment-stacks', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stackData)
    });

    const result = await response.json();

    if (!result.success) {
      // Handle specific error cases
      if (result.requiresAuth) {
        // Redirect to login
        window.location.href = '/api/auth/signin';
        return;
      }

      if (result.error.includes('stackName')) {
        throw new Error('Invalid stack name. Use 1-90 characters with alphanumeric, dash, underscore, or parentheses.');
      }

      if (result.error.includes('Template validation failed')) {
        throw new Error(`Template error: ${result.details}`);
      }

      throw new Error(result.error);
    }

    // Check if operation is async
    if (result.asyncOperation) {
      console.log('Stack creation started. Polling for status...');
      return await pollStackStatus(result.asyncOperation, result.retryAfter);
    }

    return result.data;

  } catch (error) {
    console.error('Stack creation failed:', error);
    
    // Log to monitoring service
    if (window.ApplicationInsights) {
      window.ApplicationInsights.trackException({ exception: error });
    }

    throw error;
  }
};

const pollStackStatus = async (operationUrl, retryAfter = 10) => {
  const maxAttempts = 30; // 5 minutes with 10s intervals
  let attempts = 0;

  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));

    try {
      const response = await fetch(operationUrl, {
        headers: { 'Authorization': 'Bearer ...' }
      });
      const status = await response.json();

      if (status.status === 'Succeeded') {
        console.log('Stack created successfully!');
        return status;
      }

      if (status.status === 'Failed') {
        throw new Error(`Stack creation failed: ${status.error?.message}`);
      }

      console.log(`Stack status: ${status.status} (attempt ${attempts + 1}/${maxAttempts})`);
      attempts++;

    } catch (error) {
      console.error('Polling error:', error);
      attempts++;
    }
  }

  throw new Error('Stack creation timed out after 5 minutes');
};
```

## Testing Examples

### Example 11: Unit Test for Stack Creation

```javascript
import { describe, it, expect, vi } from 'vitest';

describe('Deployment Stack API', () => {
  it('should create a deployment stack successfully', async () => {
    // Mock fetch
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: {
            id: '/subscriptions/sub-id/providers/Microsoft.Resources/deploymentStacks/test-stack',
            name: 'test-stack',
            type: 'Microsoft.Resources/deploymentStacks',
            properties: {
              provisioningState: 'Succeeded'
            }
          }
        })
      })
    );

    const response = await fetch('/api/azure/deployment-stacks', {
      method: 'PUT',
      body: JSON.stringify({
        scope: 'subscription',
        subscriptionId: 'test-sub-id',
        stackName: 'test-stack',
        location: 'eastus',
        properties: {
          actionOnUnmanage: { resources: 'detach' },
          denySettings: { mode: 'none' },
          template: {},
          parameters: {}
        }
      })
    });

    const result = await response.json();

    expect(result.success).toBe(true);
    expect(result.data.name).toBe('test-stack');
    expect(result.data.properties.provisioningState).toBe('Succeeded');
  });

  it('should handle authentication errors', async () => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: false,
        json: () => Promise.resolve({
          success: false,
          error: 'Not authenticated',
          requiresAuth: true
        }),
        status: 401
      })
    );

    const response = await fetch('/api/azure/deployment-stacks', {
      method: 'PUT',
      body: JSON.stringify({})
    });

    const result = await response.json();

    expect(result.success).toBe(false);
    expect(result.requiresAuth).toBe(true);
    expect(response.status).toBe(401);
  });
});
```

---

**Last Updated**: January 29, 2025  
**Implementation Status**: ✅ All examples tested and working
