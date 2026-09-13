# Azure Policy Implementation

## Overview

The Azure Policy implementation in Portal 360° provides comprehensive governance, compliance monitoring, and automated remediation capabilities for Azure resources. This feature enables IT administrators to enforce organizational standards, assess compliance posture, and automatically fix non-compliant resources.

**Key Features:**
- Real-time compliance monitoring and reporting
- Policy assignment management (create, update, delete)
- Browse 500+ built-in Azure policies
- Automated remediation for non-compliant resources
- Multi-scope support (subscription, resource group, management group)
- Enforcement mode configuration
- Detailed compliance state tracking

**Primary Use Cases:**
1. **Security Compliance**: Enforce security baselines (PCI-DSS, ISO 27001, HIPAA)
2. **Cost Optimization**: Restrict expensive VM SKUs, enforce auto-shutdown
3. **Naming Conventions**: Standardize resource naming patterns
4. **Tagging Requirements**: Enforce cost allocation tags
5. **Configuration Management**: Ensure resources follow corporate standards
6. **Audit & Reporting**: Track compliance for regulatory requirements

---

## API Routes

### 1. Policy Assignments API (`/api/azure/policy/assignments`)

Manages policy assignments at subscription, resource group, or management group scope.

#### **GET** - List or Get Assignment

**Query Parameters:**
- `scope` (required): Scope path (e.g., `/subscriptions/{id}` or `/subscriptions/{id}/resourceGroups/{name}`)
- `assignmentId` (optional): Specific assignment ID to retrieve

**Example Request:**
```javascript
// List all assignments
const response = await fetch(
  `/api/azure/policy/assignments?scope=/subscriptions/${subscriptionId}`
);

// Get specific assignment
const response = await fetch(
  `/api/azure/policy/assignments?scope=/subscriptions/${subscriptionId}&assignmentId=require-tags-assignment`
);
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "value": [
      {
        "id": "/subscriptions/{id}/providers/Microsoft.Authorization/policyAssignments/require-tags",
        "name": "require-tags",
        "properties": {
          "displayName": "Require tags on resources",
          "description": "Enforces required tags on all resources",
          "policyDefinitionId": "/providers/Microsoft.Authorization/policyDefinitions/...",
          "enforcementMode": "Default",
          "parameters": {
            "tagName": {
              "value": "CostCenter"
            }
          }
        }
      }
    ]
  }
}
```

#### **PUT** - Create or Update Assignment

**Request Body:**
```json
{
  "scope": "/subscriptions/{subscriptionId}",
  "assignmentName": "require-cost-center-tag",
  "properties": {
    "policyDefinitionId": "/providers/Microsoft.Authorization/policyDefinitions/{definitionId}",
    "displayName": "Require Cost Center Tag",
    "description": "All resources must have a CostCenter tag",
    "enforcementMode": "Default",
    "parameters": {
      "tagName": {
        "value": "CostCenter"
      }
    },
    "nonComplianceMessages": [
      {
        "message": "Resources must have a CostCenter tag for billing purposes"
      }
    ]
  }
}
```

**Enforcement Modes:**
- `Default`: Policy is actively enforced (deny/audit/deploy actions)
- `DoNotEnforce`: Policy is evaluated but not enforced (audit-only mode)

**Example Implementation:**
```javascript
async function createPolicyAssignment(definitionId, displayName, parameters) {
  const response = await fetch('/api/azure/policy/assignments', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scope: `/subscriptions/${subscriptionId}`,
      assignmentName: `${displayName.toLowerCase().replace(/\s+/g, '-')}`,
      properties: {
        policyDefinitionId: definitionId,
        displayName: displayName,
        enforcementMode: 'Default',
        parameters: parameters
      }
    })
  });
  
  return response.json();
}
```

#### **DELETE** - Remove Assignment

**Request Body:**
```json
{
  "scope": "/subscriptions/{subscriptionId}",
  "assignmentName": "require-cost-center-tag"
}
```

---

### 2. Policy Definitions API (`/api/azure/policy/definitions`)

Browse built-in and custom policy definitions.

#### **GET** - List Definitions

**Query Parameters:**
- `scope` (required): Scope path
- `builtInOnly` (optional): Filter to built-in policies only (`true`/`false`)
- `definitionName` (optional): Specific definition name to retrieve

**Example Request:**
```javascript
// Get built-in policies
const response = await fetch(
  `/api/azure/policy/definitions?scope=/subscriptions/${subscriptionId}&builtInOnly=true`
);

// Get specific definition
const response = await fetch(
  `/api/azure/policy/definitions?scope=/subscriptions/${subscriptionId}&definitionName=allowed-locations`
);
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "value": [
      {
        "id": "/providers/Microsoft.Authorization/policyDefinitions/e56962a6-4747-49cd-b67b-bf8b01975c4c",
        "name": "e56962a6-4747-49cd-b67b-bf8b01975c4c",
        "properties": {
          "displayName": "Allowed locations",
          "description": "This policy enables you to restrict the locations your organization can specify when deploying resources.",
          "policyType": "BuiltIn",
          "mode": "Indexed",
          "parameters": {
            "listOfAllowedLocations": {
              "type": "Array",
              "metadata": {
                "displayName": "Allowed locations",
                "description": "The list of locations that can be specified when deploying resources"
              }
            }
          },
          "policyRule": {
            "if": {
              "not": {
                "field": "location",
                "in": "[parameters('listOfAllowedLocations')]"
              }
            },
            "then": {
              "effect": "deny"
            }
          }
        }
      }
    ]
  }
}
```

**Common Built-in Policy Categories:**
1. **Security**: Require HTTPS, encryption, secure transport
2. **Networking**: NSG rules, subnet requirements, public IP restrictions
3. **Compute**: VM SKU restrictions, disk encryption, extension requirements
4. **Storage**: Secure transfer, encryption at rest, firewall rules
5. **Data**: SQL TDE, Cosmos DB encryption, backup requirements
6. **Monitoring**: Diagnostic settings, Log Analytics workspace
7. **Tagging**: Required tags, tag inheritance
8. **Cost Management**: VM size restrictions, region limitations

---

### 3. Policy Compliance API (`/api/azure/policy/compliance`)

Query policy compliance states and resource compliance.

#### **POST** - Get Compliance Summary or Detailed States

**Request Body (Summarize):**
```json
{
  "scope": "/subscriptions/{subscriptionId}",
  "summarize": true,
  "policyAssignmentId": "/subscriptions/{id}/providers/Microsoft.Authorization/policyAssignments/require-tags"
}
```

**Example Response (Summarize):**
```json
{
  "success": true,
  "data": {
    "value": [
      {
        "results": {
          "resourceDetails": {
            "compliantCount": 485,
            "nonCompliantCount": 23,
            "conflictCount": 0,
            "exemptCount": 2
          },
          "policyDetails": [
            {
              "policyDefinitionId": "/providers/Microsoft.Authorization/policyDefinitions/{id}",
              "compliantCount": 485,
              "nonCompliantCount": 23
            }
          ]
        },
        "policyAssignments": [
          {
            "policyAssignmentId": "/subscriptions/{id}/providers/Microsoft.Authorization/policyAssignments/require-tags",
            "results": {
              "resourceDetails": {
                "compliantCount": 485,
                "nonCompliantCount": 23
              }
            }
          }
        ]
      }
    ]
  }
}
```

**Request Body (Detailed States):**
```json
{
  "scope": "/subscriptions/{subscriptionId}",
  "summarize": false,
  "top": 100,
  "filter": "PolicyAssignmentId eq '/subscriptions/{id}/providers/Microsoft.Authorization/policyAssignments/require-tags' and ComplianceState eq 'NonCompliant'"
}
```

**Example Response (Detailed):**
```json
{
  "success": true,
  "data": {
    "value": [
      {
        "policyAssignmentId": "/subscriptions/{id}/providers/Microsoft.Authorization/policyAssignments/require-tags",
        "policyDefinitionId": "/providers/Microsoft.Authorization/policyDefinitions/{id}",
        "resourceId": "/subscriptions/{id}/resourceGroups/rg-prod/providers/Microsoft.Compute/virtualMachines/vm-web-01",
        "complianceState": "NonCompliant",
        "timestamp": "2025-01-15T10:30:00Z",
        "resourceType": "Microsoft.Compute/virtualMachines",
        "resourceLocation": "eastus"
      }
    ]
  }
}
```

#### **GET** - Get Resource Compliance

**Query Parameters:**
- `resourceId`: Full resource ID

**Example Request:**
```javascript
const response = await fetch(
  `/api/azure/policy/compliance?resourceId=/subscriptions/${subscriptionId}/resourceGroups/rg-prod/providers/Microsoft.Compute/virtualMachines/vm-web-01`
);
```

**OData Filter Examples:**
```
// Non-compliant resources only
ComplianceState eq 'NonCompliant'

// Specific resource type
ResourceType eq 'Microsoft.Compute/virtualMachines'

// Specific policy assignment
PolicyAssignmentId eq '/subscriptions/{id}/providers/Microsoft.Authorization/policyAssignments/require-tags'

// Combined filters
ComplianceState eq 'NonCompliant' and ResourceType eq 'Microsoft.Compute/virtualMachines'
```

---

### 4. Policy Remediation API (`/api/azure/policy/remediation`)

Create and manage remediation tasks for non-compliant resources.

#### **GET** - List or Get Remediation Task

**Query Parameters:**
- `scope` (required): Scope path
- `remediationName` (optional): Specific remediation name

**Example Request:**
```javascript
const response = await fetch(
  `/api/azure/policy/remediation?scope=/subscriptions/${subscriptionId}`
);
```

**Example Response:**
```json
{
  "success": true,
  "data": {
    "value": [
      {
        "id": "/subscriptions/{id}/providers/Microsoft.PolicyInsights/remediations/remediation-123",
        "name": "remediation-123",
        "properties": {
          "provisioningState": "Succeeded",
          "policyAssignmentId": "/subscriptions/{id}/providers/Microsoft.Authorization/policyAssignments/deploy-backup",
          "createdOn": "2025-01-15T09:00:00Z",
          "lastUpdatedOn": "2025-01-15T09:30:00Z",
          "deploymentStatus": {
            "totalDeployments": 15,
            "successfulDeployments": 14,
            "failedDeployments": 1
          }
        }
      }
    ]
  }
}
```

#### **PUT** - Create Remediation Task

**Request Body:**
```json
{
  "scope": "/subscriptions/{subscriptionId}",
  "remediationName": "remediation-enable-backup",
  "policyAssignmentId": "/subscriptions/{id}/providers/Microsoft.Authorization/policyAssignments/deploy-backup",
  "resourceCount": 50,
  "parallelDeployments": 10,
  "failureThreshold": {
    "percentage": 0.1
  }
}
```

**Configuration Options:**
- `resourceCount`: Maximum number of resources to remediate
- `parallelDeployments`: Number of concurrent deployments (default: 10, max: 30)
- `failureThreshold.percentage`: Stop remediation if failure rate exceeds this (0.1 = 10%)
- `policyDefinitionReferenceId`: For policy initiatives, specify which definition to remediate

**Example Implementation:**
```javascript
async function createRemediation(assignmentId) {
  const remediationName = `remediation-${Date.now()}`;
  
  const response = await fetch('/api/azure/policy/remediation', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scope: `/subscriptions/${subscriptionId}`,
      remediationName,
      policyAssignmentId: assignmentId,
      resourceCount: 100,
      parallelDeployments: 10,
      failureThreshold: { percentage: 0.1 }
    })
  });
  
  return response.json();
}
```

#### **DELETE** - Cancel Remediation Task

**Request Body:**
```json
{
  "scope": "/subscriptions/{subscriptionId}",
  "remediationName": "remediation-enable-backup"
}
```

**Use Cases:**
- Cancel long-running remediation tasks
- Stop remediation after reviewing deployment failures
- Interrupt remediation to adjust configuration

---

## UI Implementation

### Page Structure (`/azure/policy/page.jsx`)

The Azure Policy page is a comprehensive dashboard with 4 main tabs:

#### 1. **Compliance Tab**
- Displays compliance summary cards (score, compliant count, non-compliant count, assignments)
- Shows compliance breakdown by policy assignment
- Quick remediation button for non-compliant assignments
- Real-time compliance percentage calculation

**Key Features:**
- Visual compliance score (color-coded: green ≥90%, yellow ≥70%, red <70%)
- Per-assignment compliance details
- One-click remediation initiation

#### 2. **Assignments Tab**
- Lists all active policy assignments at the selected scope
- Expandable rows showing assignment details:
  - Enforcement mode
  - Policy definition ID
  - Parameters
  - Non-compliance messages
- Future: Create/edit/delete functionality

**Visual Indicators:**
- Green badge: Enforcement mode = Default (enforced)
- Gray badge: Enforcement mode = DoNotEnforce (audit only)

#### 3. **Definitions Tab**
- Searchable catalog of built-in Azure policies
- Filter by name or description
- Display policy type (BuiltIn, Custom)
- Shows policy metadata and descriptions

**Key Features:**
- "Load Built-in Definitions" button (fetches 500+ policies)
- Search field for quick filtering
- Policy category badges
- Future: View policy rules, create custom policies

#### 4. **Remediations Tab**
- Lists active and completed remediation tasks
- Shows remediation status and progress
- Displays deployment counts (total, successful, failed)
- Links back to source policy assignment

**Status Indicators:**
- Provisioning state (Creating, Running, Succeeded, Failed)
- Deployment summary with success/failure counts
- Creation and last updated timestamps

### Scope Configuration

Users can configure the scope for policy operations:

**Scope Types:**
1. **Subscription**: `/subscriptions/{subscriptionId}`
2. **Resource Group**: `/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}`
3. **Management Group** (future): `/providers/Microsoft.Management/managementGroups/{groupId}`

**Behavior:**
- Changing scope reloads all data (compliance, assignments, remediations)
- Subscription ID defaults to `NEXT_PUBLIC_AZURE_SUBSCRIPTION_ID` if not specified
- Resource group scope requires both subscription ID and resource group name

---

## Common Workflows

### Workflow 1: Monitor Compliance Posture

```javascript
// 1. Load compliance summary
const complianceResponse = await fetch('/api/azure/policy/compliance', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    scope: `/subscriptions/${subscriptionId}`,
    summarize: true
  })
});

const complianceData = await complianceResponse.json();

// 2. Calculate compliance percentage
const results = complianceData.data.value[0].results;
const total = results.resourceDetails.compliantCount + results.resourceDetails.nonCompliantCount;
const compliancePercentage = (results.resourceDetails.compliantCount / total) * 100;

console.log(`Compliance Score: ${compliancePercentage.toFixed(1)}%`);
console.log(`Compliant Resources: ${results.resourceDetails.compliantCount}`);
console.log(`Non-Compliant Resources: ${results.resourceDetails.nonCompliantCount}`);
```

### Workflow 2: Deploy Security Baseline Policy

```javascript
// 1. Find the "Require HTTPS for storage accounts" policy definition
const definitionsResponse = await fetch(
  `/api/azure/policy/definitions?scope=/subscriptions/${subscriptionId}&builtInOnly=true`
);
const definitions = await definitionsResponse.json();

const httpsPolicy = definitions.data.value.find(
  def => def.properties.displayName === "Secure transfer to storage accounts should be enabled"
);

// 2. Assign the policy
const assignmentResponse = await fetch('/api/azure/policy/assignments', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    scope: `/subscriptions/${subscriptionId}`,
    assignmentName: 'require-storage-https',
    properties: {
      policyDefinitionId: httpsPolicy.id,
      displayName: 'Require HTTPS for Storage',
      description: 'Enforce secure transfer for all storage accounts',
      enforcementMode: 'Default'
    }
  })
});

console.log('Policy assigned successfully');

// 3. Wait for compliance evaluation (typically 15-30 minutes)
// Then check compliance
setTimeout(async () => {
  const complianceResponse = await fetch('/api/azure/policy/compliance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scope: `/subscriptions/${subscriptionId}`,
      summarize: false,
      filter: `PolicyAssignmentId eq '${assignmentResponse.data.id}' and ComplianceState eq 'NonCompliant'`
    })
  });
  
  const nonCompliantResources = await complianceResponse.json();
  console.log(`Non-compliant storage accounts: ${nonCompliantResources.data.value.length}`);
}, 30 * 60 * 1000); // 30 minutes
```

### Workflow 3: Automated Remediation

```javascript
// 1. Find non-compliant resources
const complianceResponse = await fetch('/api/azure/policy/compliance', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    scope: `/subscriptions/${subscriptionId}`,
    summarize: false,
    filter: `PolicyAssignmentId eq '/subscriptions/${subscriptionId}/providers/Microsoft.Authorization/policyAssignments/deploy-backup' and ComplianceState eq 'NonCompliant'`,
    top: 10
  })
});

const nonCompliant = await complianceResponse.json();
console.log(`Found ${nonCompliant.data.value.length} non-compliant VMs without backup`);

// 2. Create remediation task
const remediationResponse = await fetch('/api/azure/policy/remediation', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    scope: `/subscriptions/${subscriptionId}`,
    remediationName: `backup-remediation-${Date.now()}`,
    policyAssignmentId: `/subscriptions/${subscriptionId}/providers/Microsoft.Authorization/policyAssignments/deploy-backup`,
    resourceCount: 50,
    parallelDeployments: 10,
    failureThreshold: { percentage: 0.1 }
  })
});

const remediation = await remediationResponse.json();
console.log(`Remediation task created: ${remediation.data.name}`);

// 3. Monitor remediation progress
const checkProgress = setInterval(async () => {
  const statusResponse = await fetch(
    `/api/azure/policy/remediation?scope=/subscriptions/${subscriptionId}&remediationName=${remediation.data.name}`
  );
  
  const status = await statusResponse.json();
  const deploymentStatus = status.data.properties.deploymentStatus;
  
  console.log(`Progress: ${deploymentStatus.successfulDeployments}/${deploymentStatus.totalDeployments} successful`);
  
  if (status.data.properties.provisioningState === 'Succeeded' || 
      status.data.properties.provisioningState === 'Failed') {
    clearInterval(checkProgress);
    console.log(`Remediation completed with state: ${status.data.properties.provisioningState}`);
  }
}, 60000); // Check every minute
```

### Workflow 4: Cost Optimization Policies

```javascript
// Assign policy to restrict expensive VM SKUs
const assignmentResponse = await fetch('/api/azure/policy/assignments', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    scope: `/subscriptions/${subscriptionId}`,
    assignmentName: 'restrict-expensive-vms',
    properties: {
      policyDefinitionId: '/providers/Microsoft.Authorization/policyDefinitions/cccc23c7-8427-4f53-ad12-b6a63eb452b3',
      displayName: 'Restrict VM SKUs to Cost-Effective Options',
      description: 'Deny creation of expensive VM SKUs to control costs',
      enforcementMode: 'Default',
      parameters: {
        listOfAllowedSKUs: {
          value: [
            "Standard_B2s",
            "Standard_D2s_v3",
            "Standard_D4s_v3",
            "Standard_E2s_v3"
          ]
        }
      },
      nonComplianceMessages: [
        {
          message: "Only cost-optimized VM SKUs are allowed. Contact IT for exceptions."
        }
      ]
    }
  })
});

console.log('Cost optimization policy deployed');
```

---

## Policy Effect Types

Azure Policy supports different effect types that determine what happens when policy conditions are met:

1. **Deny**: Prevents resource creation/modification if conditions are not met
   - Use case: Block expensive VM SKUs, restrict regions
   - Example: "Deny VMs in non-approved regions"

2. **Audit**: Logs non-compliant resources without blocking
   - Use case: Compliance reporting, gradual rollout
   - Example: "Audit VMs without backup enabled"

3. **AuditIfNotExists**: Checks for related resources
   - Use case: Verify dependent resources exist
   - Example: "Audit VMs without monitoring agent"

4. **DeployIfNotExists**: Automatically creates missing resources
   - Use case: Automated configuration, self-healing
   - Example: "Deploy backup configuration if not present"
   - **Requires**: Managed identity with appropriate permissions

5. **Modify**: Changes resource properties during creation/update
   - Use case: Tag inheritance, property enforcement
   - Example: "Add CostCenter tag from resource group"

6. **Disabled**: Policy is assigned but not evaluated
   - Use case: Temporarily disable without deleting assignment

---

## Best Practices

### 1. Policy Deployment Strategy

**Phased Rollout:**
1. **Test in Non-Production**: Deploy to dev/test subscriptions first
2. **Audit Mode**: Start with `enforcementMode: 'DoNotEnforce'` to assess impact
3. **Review Compliance**: Analyze non-compliant resources and identify exceptions
4. **Enable Enforcement**: Switch to `enforcementMode: 'Default'` after validation
5. **Monitor Continuously**: Track compliance trends and adjust as needed

**Example:**
```javascript
// Phase 1: Deploy in audit mode
await fetch('/api/azure/policy/assignments', {
  method: 'PUT',
  body: JSON.stringify({
    scope: `/subscriptions/${devSubscriptionId}`,
    assignmentName: 'require-tags',
    properties: {
      policyDefinitionId: tagPolicyId,
      enforcementMode: 'DoNotEnforce' // Audit only
    }
  })
});

// Phase 2: After 2 weeks, enable enforcement
await fetch('/api/azure/policy/assignments', {
  method: 'PUT',
  body: JSON.stringify({
    scope: `/subscriptions/${devSubscriptionId}`,
    assignmentName: 'require-tags',
    properties: {
      policyDefinitionId: tagPolicyId,
      enforcementMode: 'Default' // Now enforced
    }
  })
});
```

### 2. Remediation Best Practices

**Configuration Guidelines:**
- **Small Batches**: Start with `resourceCount: 10-20` to test remediation
- **Conservative Parallelism**: Use `parallelDeployments: 5-10` initially
- **Failure Threshold**: Set `failureThreshold.percentage: 0.1` (10%) to stop on errors
- **Off-Hours**: Schedule large remediations during maintenance windows
- **Review Failures**: Always check `failedDeployments` before retrying

**Example Safe Remediation:**
```javascript
{
  "resourceCount": 10,
  "parallelDeployments": 5,
  "failureThreshold": { "percentage": 0.1 }
}
```

### 3. Scope Management

**Scope Hierarchy:**
- **Management Group**: Policies apply to all child subscriptions (broadest)
- **Subscription**: Policies apply to all resource groups and resources
- **Resource Group**: Policies apply only to resources in that group (narrowest)

**Best Practices:**
- Use management groups for organization-wide standards (security baselines)
- Use subscriptions for environment-specific policies (prod vs non-prod)
- Use resource groups for project-specific policies (temporary exceptions)

### 4. Parameter Management

**Reusable Parameters:**
```javascript
// Define parameters once
const commonParameters = {
  tagName: { value: "CostCenter" },
  allowedLocations: { value: ["eastus", "westus2"] },
  effect: { value: "Deny" }
};

// Reuse across multiple assignments
await fetch('/api/azure/policy/assignments', {
  method: 'PUT',
  body: JSON.stringify({
    scope: scope1,
    assignmentName: 'policy-1',
    properties: {
      policyDefinitionId: definitionId,
      parameters: commonParameters
    }
  })
});
```

### 5. Monitoring and Alerting

**Key Metrics to Track:**
- Compliance percentage trend (target: >95%)
- Non-compliant resource count
- Policy evaluation failures
- Remediation success rate

**Alert Thresholds:**
```javascript
// Alert if compliance drops below 90%
if (compliancePercentage < 90) {
  console.warn('Compliance Alert: Score dropped to', compliancePercentage);
  // Send notification
}

// Alert on large number of non-compliant resources
if (nonCompliantCount > 50) {
  console.error('Critical: More than 50 non-compliant resources detected');
  // Escalate to security team
}
```

---

## Troubleshooting

### Common Issues

#### 1. **Policy Not Evaluating**

**Symptoms:**
- Resources created but compliance state not updated
- Policy assignment shows no compliance data

**Solutions:**
- Wait 15-30 minutes for initial evaluation
- Force evaluation: Create/update a resource in scope
- Check policy assignment scope matches resource location
- Verify policy mode (Indexed vs All) matches resource type

#### 2. **Remediation Fails**

**Symptoms:**
- High failure count in remediation task
- `provisioningState: 'Failed'`

**Solutions:**
- Check managed identity has required permissions (DeployIfNotExists policies)
- Review `failedDeployments` details in remediation properties
- Verify policy definition supports remediation (must have deployIfNotExists effect)
- Check resource locks preventing modification
- Review Azure Activity Log for deployment errors

#### 3. **Token Expired Errors**

**Symptoms:**
- 401 Unauthorized responses
- "ExpiredAuthenticationToken" error

**Solutions:**
- Token refresh is automatic via `getAzureManagementToken` helper
- Check session validity: `const session = await auth();`
- Verify refresh token is present in session
- Re-authenticate if refresh token expired (>90 days)

#### 4. **Compliance Data Mismatch**

**Symptoms:**
- Compliance counts don't match Azure Portal
- Stale compliance data

**Solutions:**
- Compliance evaluation can lag by 15-30 minutes
- Use "Refresh" button to reload data
- Check if policy was recently assigned (initial evaluation pending)
- Verify scope filter matches Portal view

---

## API Versions

All Azure Policy APIs use the latest GA (General Availability) versions:

- **Policy Assignments**: `2024-04-01`
- **Policy Definitions**: `2024-04-01`
- **Policy Compliance (Policy States)**: `2019-10-01` (latest GA for PolicyInsights)
- **Policy Remediation**: `2021-10-01`

**Version Compatibility:**
- Preview API versions (e.g., `2024-08-01-preview`) are **not used** for stability
- All APIs are GA and production-ready
- Breaking changes are rare in GA versions

---

## Permissions Required

### Required Azure RBAC Roles

**Read-Only Access:**
- **Reader**: View policy assignments, definitions, and compliance
- **Policy Insights Reader**: View compliance data only

**Full Access:**
- **Resource Policy Contributor**: Create/modify/delete policy assignments
- **Policy Contributor**: Manage policy definitions (custom policies)

**Remediation:**
- **Contributor** (or resource-specific contributor role): Required for remediation tasks that deploy resources

### Microsoft Entra ID Permissions

**Application Registration:**
```json
{
  "requiredResourceAccess": [
    {
      "resourceAppId": "https://management.azure.com",
      "resourceAccess": [
        {
          "id": "user_impersonation",
          "type": "Scope"
        }
      ]
    }
  ]
}
```

**Delegated Permissions:**
- `https://management.azure.com/user_impersonation` (Azure Management API)

---

## Integration Examples

### Export Compliance Report to CSV

```javascript
async function exportComplianceReport() {
  // 1. Get detailed compliance states
  const response = await fetch('/api/azure/policy/compliance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scope: `/subscriptions/${subscriptionId}`,
      summarize: false,
      top: 1000
    })
  });
  
  const data = await response.json();
  
  // 2. Convert to CSV
  const csv = [
    ['Resource ID', 'Resource Type', 'Compliance State', 'Policy Assignment', 'Timestamp'],
    ...data.data.value.map(state => [
      state.resourceId,
      state.resourceType,
      state.complianceState,
      state.policyAssignmentId.split('/').pop(),
      state.timestamp
    ])
  ].map(row => row.join(',')).join('\n');
  
  // 3. Download
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `compliance-report-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
}
```

### Scheduled Compliance Check

```javascript
// Check compliance daily and send alert if below threshold
setInterval(async () => {
  const response = await fetch('/api/azure/policy/compliance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      scope: `/subscriptions/${subscriptionId}`,
      summarize: true
    })
  });
  
  const data = await response.json();
  const results = data.data.value[0].results;
  const total = results.resourceDetails.compliantCount + results.resourceDetails.nonCompliantCount;
  const percentage = (results.resourceDetails.compliantCount / total) * 100;
  
  if (percentage < 95) {
    // Send alert (email, Teams, Slack, etc.)
    await fetch('/api/notifications/send', {
      method: 'POST',
      body: JSON.stringify({
        message: `⚠️ Azure Policy Compliance Alert: ${percentage.toFixed(1)}% (Target: 95%)`,
        nonCompliantCount: results.resourceDetails.nonCompliantCount
      })
    });
  }
}, 24 * 60 * 60 * 1000); // Daily
```

---

## Related Documentation

- [Azure Cost Management APIs](./azure-cost-management-apis.md) - Cost optimization and budgeting
- [Power Platform Governance](./power-platform-implementation-summary.md) - DLP policies and recommendations
- [API Endpoints Reference](./API-ENDPOINTS-REFERENCE.md) - Complete API catalog
- [Deployment Checklist](./DEPLOYMENT-CHECKLIST.md) - Production deployment guide

---

## Future Enhancements

**Planned Features:**
1. **Policy Initiatives (Set Definitions)**: Group multiple policies for easier management
2. **Policy Exemptions**: Create exceptions for specific resources with justification
3. **Custom Policy Builder**: UI for creating custom policy definitions
4. **Advanced Filtering**: Multi-dimensional compliance filtering (by resource type, location, tag)
5. **Compliance Trend Charts**: Historical compliance data visualization
6. **Batch Operations**: Bulk policy assignment across multiple scopes
7. **Policy Templates**: Pre-configured policy sets for common scenarios (PCI-DSS, HIPAA, ISO)
8. **Remediation Scheduling**: Schedule remediation tasks for maintenance windows
9. **Policy Impact Analysis**: Preview policy effects before assignment

**Contributions:**
If you'd like to contribute to these features, follow the conventions in [`.github/copilot-instructions.md`](../.github/copilot-instructions.md).

---

## Support

For issues or questions:
- **GitHub Issues**: [Submit an issue](https://github.com/your-repo/issues)
- **Documentation**: [Full documentation](./README.md)
- **Azure Policy Docs**: [Microsoft Learn - Azure Policy](https://learn.microsoft.com/azure/governance/policy/)
