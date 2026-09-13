# Template Builder Guide

## Overview
The Template Builder provides a visual, no-code interface for creating Azure Resource Manager (ARM) templates for Deployment Stacks. Instead of manually writing JSON, you can click buttons to add resources and parameters, then see the generated template in real-time.

## Features

### 1. Two Modes: Builder vs JSON

**Builder Mode (Visual)**
- Add resources with buttons
- Manage parameters visually
- Live preview of generated JSON
- Perfect for beginners and quick prototyping

**JSON Mode (Manual)**
- Direct JSON editing
- Full control over template structure
- Syntax highlighting
- For advanced users who prefer code

**Tip:** You can switch between modes at any time without losing your work!

---

## Quick Start Templates

Click any pre-built template to instantly populate your deployment stack:

### 🗄️ Storage Account Template
**Includes:**
- Standard LRS Storage Account
- HTTPS-only traffic enforced
- TLS 1.2 minimum version
- StorageV2 (general purpose v2)

**Parameters:**
- `storageAccountName` - Name for your storage account

**Use Case:** Simple blob storage, file shares, or queue storage

---

### 🌐 Web App Template
**Includes:**
- App Service Plan (Basic B1, Linux)
- App Service (Web App)
- HTTPS enforced
- TLS 1.2 minimum version

**Parameters:**
- `appServicePlanName` - Name for the hosting plan
- `appServiceName` - Name for the web application

**Use Case:** Hosting Node.js, Python, .NET, or PHP web applications

---

### 🔗 Network Infrastructure Template
**Includes:**
- Virtual Network (10.0.0.0/16)
  - Subnet 1 (10.0.1.0/24)
  - Subnet 2 (10.0.2.0/24)
- Network Security Group
  - HTTPS inbound rule (port 443)

**Parameters:**
- `vnetName` - Name for the virtual network
- `nsgName` - Name for the network security group

**Use Case:** Foundation for VM deployments, VPN gateways, or application networks

---

## Individual Resources

### Available Resource Types

#### 1. **Storage Account**
```
Microsoft.Storage/storageAccounts
```
- Standard LRS SKU
- StorageV2 kind
- Secure by default (HTTPS only, TLS 1.2)

**Parameter Required:** `storageAccountName`

---

#### 2. **Virtual Network**
```
Microsoft.Network/virtualNetworks
```
- 10.0.0.0/16 address space
- Default subnet (10.0.1.0/24)

**Parameter Required:** `vnetName`

---

#### 3. **App Service**
```
Microsoft.Web/sites
```
- HTTPS enforced
- Requires App Service Plan
- TLS 1.2 minimum

**Parameters Required:** `appServiceName`, `appServicePlanName`

---

#### 4. **App Service Plan**
```
Microsoft.Web/serverfarms
```
- Basic B1 tier (Linux)
- 1 worker capacity

**Parameter Required:** `appServicePlanName`

---

#### 5. **Key Vault**
```
Microsoft.KeyVault/vaults
```
- RBAC authorization enabled
- Template deployment enabled
- Standard SKU

**Parameter Required:** `keyVaultName`

---

#### 6. **SQL Server**
```
Microsoft.Sql/servers
```
- Version 12.0
- TLS 1.2 minimum
- SQL authentication

**Parameters Required:** `sqlServerName`, `sqlAdminUsername`, `sqlAdminPassword`

---

#### 7. **Cosmos DB**
```
Microsoft.DocumentDB/databaseAccounts
```
- GlobalDocumentDB kind
- Session consistency level
- Single region deployment

**Parameter Required:** `cosmosDbAccountName`

---

#### 8. **Virtual Machine**
```
Microsoft.Compute/virtualMachines
```
- Standard B2s size
- Ubuntu Server 18.04 LTS
- Standard LRS managed disk

**Parameters Required:** `vmName`, `adminUsername`, `adminPassword`, `nicName`

---

## How to Use the Template Builder

### Step-by-Step Walkthrough

#### **Step 1: Open Create Stack Modal**
1. Navigate to **Azure** → **Deployment Stacks**
2. Click the **"Create Stack"** button
3. The modal opens with Builder mode active by default

#### **Step 2: Choose Your Approach**

**Option A: Use a Quick Start Template**
1. Click one of the three quick start buttons:
   - **Storage Account** - Simple storage setup
   - **Web App** - Complete web hosting stack
   - **Network Infrastructure** - VNet + NSG foundation
2. Resources and parameters are automatically added
3. Review the generated template preview
4. Proceed to Step 4

**Option B: Build Custom Template**
1. Skip the quick start templates
2. Click individual resource buttons to add them
3. Add multiple resources as needed
4. Proceed to Step 3

#### **Step 3: Add Resources (Custom Approach)**
1. In the **"Add Resources"** section, click any resource type:
   - Storage Account
   - Virtual Network
   - App Service
   - App Service Plan
   - Key Vault
   - SQL Server
   - Cosmos DB
   - Virtual Machine

2. Each click adds a resource to your template

3. Resources appear in the **"Resources"** list with:
   - Resource type (e.g., Microsoft.Storage/storageAccounts)
   - Resource name expression (e.g., [parameters('storageAccountName')])
   - Remove button (X) to delete

#### **Step 4: Configure Parameters**
1. Click **"Add Parameter"** button
2. Enter **Parameter Name** (e.g., `storageAccountName`)
3. Enter **Parameter Value** (e.g., `mystorageacct001`)
4. Repeat for all parameters your resources need
5. Click X to remove unwanted parameters

**Tip:** The template builder auto-detects parameter names used in resources!

#### **Step 5: Review Generated Template**
1. Scroll to **"Generated Template Preview"**
2. See the complete ARM template JSON
3. Verify all resources are included
4. Check parameter definitions

#### **Step 6: Fine-Tune (Optional)**
1. Switch to **JSON Mode** if needed
2. Edit the template JSON directly
3. Modify resource properties
4. Add advanced configurations
5. Switch back to Builder mode anytime

#### **Step 7: Complete Stack Creation**
1. Fill in stack metadata:
   - Stack Name
   - Location
   - Description (optional)
2. Configure unmanage actions
3. Set deny settings
4. Click **"Create Stack"**

---

## Example Workflows

### Scenario 1: Simple Storage Deployment

**Goal:** Deploy a storage account for backups

**Steps:**
1. Click "Create Stack"
2. Click **"Storage Account"** quick start
3. Parameter `storageAccountName` is auto-added
4. Change value to `companybackupstorage`
5. Enter stack name: `backup-storage-stack`
6. Select location: `East US`
7. Create!

**Time:** ~30 seconds

---

### Scenario 2: Web Application Infrastructure

**Goal:** Deploy complete web app hosting environment

**Steps:**
1. Click "Create Stack"
2. Click **"Web App"** quick start
3. Two parameters auto-added:
   - `appServicePlanName` → change to `prod-app-plan`
   - `appServiceName` → change to `company-website`
4. **Add more resources manually:**
   - Click "Storage Account" (for static assets)
   - Click "Add Parameter"
   - Add `storageAccountName` → `companystatic001`
5. Review generated template (3 resources total)
6. Enter stack name: `web-app-infrastructure`
7. Select location: `West Europe`
8. Set deny mode: `denyDelete` (protect production)
9. Create!

**Time:** ~2 minutes

---

### Scenario 3: Complex Multi-Resource Stack

**Goal:** Custom stack with database, storage, and networking

**Steps:**
1. Click "Create Stack"
2. Start with **"Network Infrastructure"** template
3. Add individual resources:
   - Click "SQL Server"
   - Click "Storage Account"
   - Click "Key Vault"
4. Add parameters:
   - `vnetName` → `prod-vnet`
   - `nsgName` → `prod-nsg`
   - `sqlServerName` → `companydb`
   - `sqlAdminUsername` → `sqladmin`
   - `sqlAdminPassword` → `SecureP@ssw0rd!`
   - `storageAccountName` → `companydatastorage`
   - `keyVaultName` → `company-keyvault`
5. Switch to **JSON Mode**
6. Add custom SQL firewall rules in template
7. Switch back to **Builder Mode**
8. Review 6 resources total
9. Create stack!

**Time:** ~5 minutes

---

## Best Practices

### ✅ DO:
- **Start with quick start templates** - They follow Azure best practices
- **Use meaningful parameter names** - `prodStorageAccount` not `storage1`
- **Add descriptions** - Help your team understand the stack purpose
- **Review the preview** - Always check generated JSON before deploying
- **Test in non-production first** - Deploy to dev/test subscriptions
- **Use deny settings wisely** - Protect critical resources from accidental deletion

### ❌ DON'T:
- **Don't hardcode values** - Use parameters for flexibility
- **Don't skip parameter values** - Stack creation will fail
- **Don't ignore resource dependencies** - Some resources need others (App Service needs Plan)
- **Don't forget naming rules** - Storage accounts: lowercase, 3-24 chars, alphanumeric only
- **Don't mix modes confusingly** - Finish in Builder OR JSON, not halfway

---

## Advanced Tips

### 1. **Resource Dependencies**
When adding App Service, also add App Service Plan first. The template handles `resourceId()` references automatically.

### 2. **Parameter Validation**
Switch to JSON mode to add parameter constraints:
```json
"parameters": {
  "storageAccountName": {
    "type": "string",
    "minLength": 3,
    "maxLength": 24,
    "metadata": {
      "description": "Storage account name (3-24 chars, lowercase)"
    }
  }
}
```

### 3. **Resource Naming**
Use ARM template functions in resource names:
- `[parameters('name')]` - Use parameter value
- `[resourceGroup().location]` - Use resource group location
- `[subscription().tenantId]` - Use subscription tenant ID
- `[concat('prefix-', parameters('name'))]` - Concatenate strings

### 4. **Exporting Existing Stacks**
1. Navigate to existing stack
2. Click **Export** button (download icon)
3. Import JSON into new stack
4. Switch to Builder mode
5. Modify visually

### 5. **Version Control**
- Export templates as JSON files
- Store in Git repository
- Track changes over time
- Reuse across environments

---

## Troubleshooting

### Issue: "Invalid template JSON"
**Solution:** Switch to JSON mode and check for syntax errors. Common issues:
- Missing commas
- Unclosed brackets
- Invalid parameter references

### Issue: "Parameter not defined"
**Solution:** Resource references a parameter that doesn't exist. Add it in parameters section or remove the reference.

### Issue: "Resource already exists"
**Solution:** Resource names must be unique within Azure. Change parameter values to unique names.

### Issue: "Template too complex"
**Solution:** Break into multiple smaller stacks. Deploy infrastructure first, then applications.

### Issue: "Cannot remove resource"
**Solution:** Refresh the page if remove button doesn't work. This resets the builder state.

---

## Resource Naming Conventions

### Storage Accounts
- **Length:** 3-24 characters
- **Format:** Lowercase letters and numbers only
- **Example:** `companydata001`, `backupstorage2024`

### App Services
- **Length:** 2-60 characters
- **Format:** Alphanumeric and hyphens
- **Example:** `company-web-app`, `api-production`

### Virtual Networks
- **Length:** 2-64 characters
- **Format:** Alphanumeric, hyphens, underscores, periods
- **Example:** `prod-vnet`, `hub_network`

### Key Vaults
- **Length:** 3-24 characters
- **Format:** Alphanumeric and hyphens (start with letter)
- **Example:** `company-keyvault`, `prod-secrets`

### SQL Servers
- **Length:** 1-63 characters
- **Format:** Lowercase letters, numbers, hyphens (no hyphen at start/end)
- **Example:** `company-sql-prod`, `database-server01`

---

## Keyboard Shortcuts

When in Builder mode:
- **Ctrl + B** - Toggle between Builder and JSON modes (coming soon)
- **Ctrl + S** - Save/create stack (coming soon)
- **Escape** - Close modal

---

## Frequently Asked Questions

### Q: Can I import an existing ARM template?
**A:** Yes! Switch to JSON mode, paste your template, then switch to Builder mode to see resources visually.

### Q: What happens if I switch modes?
**A:** Your work is preserved! Template JSON is synchronized between both modes.

### Q: Can I edit resource properties?
**A:** In Builder mode, properties use best-practice defaults. Switch to JSON mode for full customization.

### Q: How many resources can I add?
**A:** No hard limit, but deployment stacks work best with 10-20 resources. For larger deployments, use multiple stacks.

### Q: Can I duplicate a resource?
**A:** Yes! Add the same resource type multiple times. Make sure to change parameter names to keep them unique.

### Q: What if I make a mistake?
**A:** Click the X button next to any resource or parameter to remove it. Or close the modal and start over.

---

## What's Next?

After mastering the Template Builder:

1. **Learn about Deny Settings** - Protect resources from unauthorized changes
2. **Explore Management Groups** - Deploy stacks at scale across subscriptions
3. **Try Template Links** - Reference templates stored in Azure Blob Storage
4. **Set up CI/CD** - Automate stack deployments with Azure DevOps or GitHub Actions

---

**Last Updated:** January 29, 2025  
**Version:** 1.0  
**Status:** ✅ Production Ready
