# Azure Bicep Permissions - Quick Reference

## 🔑 Required Azure RBAC Roles

### Minimum Required for Deployments

#### Option 1: Subscription Contributor (Recommended for Development)
```bash
az role assignment create \
  --assignee <user-or-sp-object-id> \
  --role "Contributor" \
  --scope "/subscriptions/{subscription-id}"
```

**Grants:**
- ✅ Create/modify/delete all resource types
- ✅ Create/manage resource groups
- ✅ Validate and deploy templates
- ❌ Manage access control (RBAC)
- ❌ Assign roles

#### Option 2: Resource Group Contributor (Production)
```bash
az role assignment create \
  --assignee <user-or-sp-object-id> \
  --role "Contributor" \
  --scope "/subscriptions/{sub-id}/resourceGroups/{rg-name}"
```

**Grants:**
- ✅ Create/modify/delete resources within RG only
- ✅ Validate and deploy templates to RG
- ❌ Create new resource groups
- ❌ Subscription-level operations

### Custom Role for Template Operations Only

```json
{
  "Name": "Bicep Template Operator",
  "IsCustom": true,
  "Description": "Can validate and deploy Bicep/ARM templates",
  "Actions": [
    "Microsoft.Resources/deployments/*",
    "Microsoft.Resources/subscriptions/resourceGroups/read",
    "Microsoft.Resources/subscriptions/read",
    "Microsoft.Resources/subscriptions/operationresults/read"
  ],
  "NotActions": [],
  "AssignableScopes": [
    "/subscriptions/{subscription-id}"
  ]
}
```

Create custom role:
```bash
az role definition create --role-definition bicep-operator-role.json
```

---

## 🔐 Service Principal Setup

### Quick Setup (Development)

```bash
# Create Service Principal with Contributor at subscription level
az ad sp create-for-rbac \
  --name "bicep-deployment-sp-dev" \
  --role "Contributor" \
  --scopes "/subscriptions/{subscription-id}"
```

**Output (save these):**
```json
{
  "appId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "displayName": "bicep-deployment-sp-dev",
  "password": "xxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "tenant": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

### Environment Variables

```env
# Add to .env.local
AZURE_SUBSCRIPTION_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Production Setup (Least Privilege)

```bash
# 1. Create Service Principal (no role assigned)
az ad sp create-for-rbac \
  --name "bicep-deployment-sp-prod" \
  --skip-assignment

# 2. Assign to specific resource groups only
az role assignment create \
  --assignee <sp-app-id> \
  --role "Contributor" \
  --scope "/subscriptions/{sub-id}/resourceGroups/prod-rg-1"

az role assignment create \
  --assignee <sp-app-id> \
  --role "Contributor" \
  --scope "/subscriptions/{sub-id}/resourceGroups/prod-rg-2"
```

---

## 📋 Permission Checklist

### Pre-Deployment Validation

- [ ] **User has Contributor role** at appropriate scope
- [ ] **Service Principal created** with required roles
- [ ] **Environment variables set** in application
- [ ] **Azure CLI authenticated** on server
- [ ] **Bicep CLI installed** and accessible

### Verify Permissions

```bash
# Check current user's role assignments
az role assignment list --assignee <your-object-id> --output table

# Test deployment permissions (dry run)
az deployment group validate \
  --resource-group <rg-name> \
  --template-file test.bicep \
  --parameters @params.json

# Test what-if permissions
az deployment group what-if \
  --resource-group <rg-name> \
  --template-file test.bicep \
  --parameters @params.json
```

---

## 🚨 Common Permission Issues

### Issue: "Authorization failed"

**Cause:** Insufficient permissions at deployment scope

**Solution:**
```bash
# Check required permissions
az deployment group create \
  --resource-group <rg> \
  --template-file template.bicep \
  --what-if  # Shows what would be created

# If fails, assign Contributor role
az role assignment create \
  --assignee <user-or-sp> \
  --role "Contributor" \
  --scope "/subscriptions/{sub}/resourceGroups/{rg}"
```

### Issue: "The client does not have authorization to perform action"

**Cause:** Missing specific resource provider permissions

**Solution:**
```bash
# Register required resource providers
az provider register --namespace Microsoft.Storage
az provider register --namespace Microsoft.Compute
az provider register --namespace Microsoft.Network

# Check registration status
az provider list --query "[?registrationState=='Registered']" --output table
```

### Issue: "Cannot create resource group"

**Cause:** Contributor role assigned at RG level, not subscription

**Solution:**
```bash
# Elevate to subscription-level Contributor
az role assignment create \
  --assignee <user-or-sp> \
  --role "Contributor" \
  --scope "/subscriptions/{subscription-id}"
```

---

## 🎯 Resource-Specific Permissions

### Storage Account Deployment
```
Required: Storage Account Contributor
Provider: Microsoft.Storage/storageAccounts/write
```

### Virtual Machine Deployment
```
Required: 
- Virtual Machine Contributor
- Network Contributor (for NICs/VNets)
Provider: 
- Microsoft.Compute/virtualMachines/write
- Microsoft.Network/networkInterfaces/write
```

### App Service Deployment
```
Required: Web Plan Contributor
Provider: Microsoft.Web/sites/write
```

### Key Vault Deployment
```
Required: Key Vault Contributor
Provider: Microsoft.KeyVault/vaults/write
Note: Separate permissions needed for secrets/keys
```

---

## 🔍 Audit & Compliance

### View All Role Assignments

```bash
# Subscription level
az role assignment list --scope "/subscriptions/{sub-id}" --output table

# Resource group level
az role assignment list --resource-group <rg-name> --output table

# Specific user/SP
az role assignment list --assignee <object-id> --all --output table
```

### Log All Deployments

```bash
# View deployment history
az deployment group list --resource-group <rg-name>

# Get deployment details
az deployment group show \
  --resource-group <rg-name> \
  --name <deployment-name>
```

### Enable Azure Activity Logs

```bash
# Stream activity logs for deployments
az monitor activity-log list \
  --resource-group <rg-name> \
  --caller <user-email> \
  --query "[?contains(operationName.value, 'Microsoft.Resources/deployments')]"
```

---

## 📊 Permission Matrix

| Operation                    | Minimum Role Required        | Scope            |
|------------------------------|------------------------------|------------------|
| Validate template            | Reader                       | Subscription     |
| Build Bicep → ARM            | None (local only)            | N/A              |
| Decompile ARM → Bicep        | None (local only)            | N/A              |
| Deploy to new RG             | Contributor                  | Subscription     |
| Deploy to existing RG        | Contributor                  | Resource Group   |
| What-if analysis             | Reader                       | Subscription     |
| Delete resources             | Contributor                  | Resource Group   |
| Assign RBAC roles            | Owner or User Access Admin   | Appropriate scope|
| Create Service Principal     | Application Administrator    | Entra ID         |

---

## 🛡️ Security Best Practices

### 1. Principle of Least Privilege
- ✅ Use resource group scoped roles in production
- ✅ Create custom roles with only required actions
- ✅ Separate read-only and write permissions
- ❌ Don't use Owner role for automation
- ❌ Don't grant subscription-wide access unnecessarily

### 2. Service Principal Management
- ✅ Rotate client secrets every 90 days
- ✅ Use Azure Key Vault for credential storage
- ✅ Enable managed identities when possible
- ✅ Audit Service Principal usage regularly
- ❌ Don't share Service Principal credentials
- ❌ Don't store secrets in code repositories

### 3. Deployment Safety
- ✅ Always use what-if before production deployments
- ✅ Implement approval workflows for critical resources
- ✅ Enable resource locks on production resources
- ✅ Tag all deployed resources with owner/purpose
- ❌ Don't auto-deploy without validation
- ❌ Don't allow deployments without change tracking

---

## 📚 Additional Resources

- [Azure RBAC Documentation](https://learn.microsoft.com/en-us/azure/role-based-access-control/)
- [Azure Built-in Roles](https://learn.microsoft.com/en-us/azure/role-based-access-control/built-in-roles)
- [Create Custom Roles](https://learn.microsoft.com/en-us/azure/role-based-access-control/custom-roles)
- [Service Principal Best Practices](https://learn.microsoft.com/en-us/azure/active-directory/develop/howto-create-service-principal-portal)
- [Managed Identities](https://learn.microsoft.com/en-us/azure/active-directory/managed-identities-azure-resources/)
