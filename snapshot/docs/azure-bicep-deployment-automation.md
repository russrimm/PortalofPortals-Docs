# Azure Bicep Deployment Automation - Implementation Guide

> **Historical proposal, not current deployment support.** Direct Bicep deployment
> is unavailable; the wizard is export only. The compiler service and deployment
> code below are not an approved implementation or recovery procedure. Do not add
> credentials or grant roles to enable this path. See the
> [current API contract and export guidance](azure-bicep-sdk-migration.md).

## Overview

This document outlines the implementation of Azure Bicep template deployment automation, including template library integration from Microsoft Learn, ARM/Bicep conversion utilities, and required Azure permissions.

## Table of Contents

1. [Required Azure Permissions](#required-azure-permissions)
2. [Bicep CLI Integration](#bicep-cli-integration)
3. [Template Library Structure](#template-library-structure)
4. [Conversion Utilities](#conversion-utilities)
5. [API Endpoints](#api-endpoints)
6. [Frontend Components](#frontend-components)
7. [Implementation Checklist](#implementation-checklist)

---

## Required Azure Permissions

### Minimum RBAC Roles Required

#### For Template Deployment
```
Subscription Level:
├── Contributor (Required)
│   └── Allows creation/modification of all resource types
├── OR Resource-specific Contributor roles:
    ├── Network Contributor (for VNets, NSGs, etc.)
    ├── Virtual Machine Contributor (for VMs)
    ├── Storage Account Contributor (for storage)
    ├── Web Plan Contributor (for App Services)
    └── [etc. per resource type]

Resource Group Level:
├── Contributor (Required for RG deployments)
└── OR specific resource contributors

Management Group Level (if applicable):
└── Management Group Contributor
```

#### For Template Validation & Dry Run
```
Reader + Deployment Operations permissions:
├── Microsoft.Resources/deployments/read
├── Microsoft.Resources/deployments/write
├── Microsoft.Resources/deployments/validate/action
└── Microsoft.Resources/subscriptions/resourceGroups/read
```

#### For Bicep/ARM Operations
```
Microsoft.Resources permissions:
├── Microsoft.Resources/deployments/*
├── Microsoft.Resources/subscriptions/resourceGroups/*
└── Microsoft.Resources/subscriptions/providers/read
```

### Required API Permissions (Microsoft Graph)

```json
{
  "applicationPermissions": [],
  "delegatedPermissions": [
    "User.Read"
  ]
}
```

### Azure CLI/SDK Authentication

**Service Principal Requirements:**
```bash
# Create Service Principal for automation
az ad sp create-for-rbac --name "bicep-deployment-sp" \
  --role Contributor \
  --scopes /subscriptions/{subscription-id}
```

**Required Environment Variables:**
```env
AZURE_SUBSCRIPTION_ID=<your-subscription-id>
AZURE_TENANT_ID=<your-tenant-id>
AZURE_CLIENT_ID=<service-principal-client-id>
AZURE_CLIENT_SECRET=<service-principal-secret>
```

---

## Bicep CLI Integration

### Installation & Setup

```bash
# Azure CLI (includes Bicep)
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# Or standalone Bicep CLI
curl -Lo bicep https://github.com/Azure/bicep/releases/latest/download/bicep-linux-x64
chmod +x ./bicep
sudo mv ./bicep /usr/local/bin/bicep

# Verify installation
bicep --version
az bicep version
```

### Bicep CLI Operations

#### 1. Build (Bicep → ARM JSON)
```bash
bicep build template.bicep --outfile template.json
```

#### 2. Decompile (ARM JSON → Bicep)
```bash
bicep decompile template.json --outfile template.bicep
```

#### 3. Validate
```bash
az deployment group validate \
  --resource-group <rg-name> \
  --template-file template.bicep \
  --parameters @parameters.json
```

#### 4. What-If Analysis
```bash
az deployment group what-if \
  --resource-group <rg-name> \
  --template-file template.bicep \
  --parameters @parameters.json
```

#### 5. Deploy
```bash
az deployment group create \
  --resource-group <rg-name> \
  --template-file template.bicep \
  --parameters @parameters.json
```

---

## Template Library Structure

### Database Schema

```typescript
// MongoDB/PostgreSQL Schema
interface BicepTemplate {
  id: string
  name: string
  displayName: string
  category: string // 'storage', 'compute', 'networking', 'database', etc.
  description: string
  templateType: 'bicep' | 'arm' | 'both'
  
  // Template content
  bicepContent?: string
  armJsonContent?: string
  
  // Metadata
  msLearnUrl: string
  version: string
  tags: string[]
  complexity: 'beginner' | 'intermediate' | 'advanced'
  
  // Parameters
  parameters: TemplateParameter[]
  
  // Validation
  isValidated: boolean
  lastValidated: Date
  
  // Usage tracking
  deploymentCount: number
  favoriteCount: number
  
  createdAt: Date
  updatedAt: Date
}

interface TemplateParameter {
  name: string
  type: 'string' | 'int' | 'bool' | 'object' | 'array'
  description: string
  defaultValue?: any
  allowedValues?: any[]
  required: boolean
}
```

### File System Structure

```
/app/azure/bicep/
├── page.tsx                           # Main Bicep templates page
├── components/
│   ├── TemplateLibrary.tsx           # Browse/search templates
│   ├── TemplatePreview.tsx           # View template details
│   ├── TemplateEditor.tsx            # Edit Bicep/ARM
│   ├── ParameterBuilder.tsx          # Build parameter file
│   ├── DeploymentWizard.tsx          # Step-by-step deployment
│   ├── ConversionTool.tsx            # Bicep ↔ ARM converter
│   ├── ValidationResults.tsx         # Show validation output
│   └── DeploymentHistory.tsx         # Past deployments

/lib/azure/
├── bicep/
│   ├── templates.ts                  # Template CRUD operations
│   ├── converter.ts                  # Bicep ↔ ARM conversion
│   ├── validator.ts                  # Template validation
│   ├── deployer.ts                   # Deployment execution
│   └── scraper.ts                    # MS Learn template scraper

/api/azure/bicep/
├── templates/
│   ├── route.ts                      # GET/POST templates
│   └── [id]/route.ts                 # GET/PUT/DELETE specific template
├── convert/
│   ├── to-bicep/route.ts            # ARM → Bicep
│   └── to-arm/route.ts              # Bicep → ARM
├── validate/route.ts                 # Validate template
├── deploy/route.ts                   # Deploy template
└── scrape/route.ts                   # Scrape MS Learn templates
```

---

## Conversion Utilities

### Server-Side Implementation

```typescript
// lib/azure/bicep/converter.ts
import 'server-only'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'
import path from 'path'

const execAsync = promisify(exec)

export interface ConversionResult {
  success: boolean
  output?: string
  error?: string
  warnings?: string[]
}

/**
 * Convert ARM JSON to Bicep
 */
export async function armToBicep(armJson: string): Promise<ConversionResult> {
  const tempDir = path.join('/tmp', `bicep-${Date.now()}`)
  await fs.mkdir(tempDir, { recursive: true })
  
  const armFile = path.join(tempDir, 'template.json')
  const bicepFile = path.join(tempDir, 'template.bicep')
  
  try {
    // Write ARM JSON to temp file
    await fs.writeFile(armFile, armJson, 'utf-8')
    
    // Decompile using Bicep CLI
    const { stdout, stderr } = await execAsync(
      `bicep decompile "${armFile}" --outfile "${bicepFile}"`,
      { timeout: 30000 }
    )
    
    // Read generated Bicep
    const bicepContent = await fs.readFile(bicepFile, 'utf-8')
    
    // Clean up
    await fs.rm(tempDir, { recursive: true, force: true })
    
    return {
      success: true,
      output: bicepContent,
      warnings: stderr ? [stderr] : []
    }
  } catch (error: any) {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Convert Bicep to ARM JSON
 */
export async function bicepToArm(bicepContent: string): Promise<ConversionResult> {
  const tempDir = path.join('/tmp', `bicep-${Date.now()}`)
  await fs.mkdir(tempDir, { recursive: true })
  
  const bicepFile = path.join(tempDir, 'template.bicep')
  const armFile = path.join(tempDir, 'template.json')
  
  try {
    // Write Bicep to temp file
    await fs.writeFile(bicepFile, bicepContent, 'utf-8')
    
    // Build using Bicep CLI
    const { stdout, stderr } = await execAsync(
      `bicep build "${bicepFile}" --outfile "${armFile}"`,
      { timeout: 30000 }
    )
    
    // Read generated ARM JSON
    const armJson = await fs.readFile(armFile, 'utf-8')
    
    // Clean up
    await fs.rm(tempDir, { recursive: true, force: true })
    
    return {
      success: true,
      output: armJson,
      warnings: stderr ? [stderr] : []
    }
  } catch (error: any) {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
    return {
      success: false,
      error: error.message
    }
  }
}

/**
 * Validate Bicep template
 */
export async function validateBicep(
  bicepContent: string,
  subscriptionId: string,
  resourceGroup: string
): Promise<ConversionResult> {
  const tempDir = path.join('/tmp', `bicep-${Date.now()}`)
  await fs.mkdir(tempDir, { recursive: true })
  
  const bicepFile = path.join(tempDir, 'template.bicep')
  
  try {
    await fs.writeFile(bicepFile, bicepContent, 'utf-8')
    
    const { stdout, stderr } = await execAsync(
      `az deployment group validate ` +
      `--subscription "${subscriptionId}" ` +
      `--resource-group "${resourceGroup}" ` +
      `--template-file "${bicepFile}"`,
      { timeout: 60000 }
    )
    
    await fs.rm(tempDir, { recursive: true, force: true })
    
    return {
      success: true,
      output: stdout,
      warnings: stderr ? [stderr] : []
    }
  } catch (error: any) {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
    return {
      success: false,
      error: error.message
    }
  }
}
```

---

## API Endpoints

### 1. Template Management

```typescript
// app/api/azure/bicep/templates/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getTemplates, createTemplate } from '@/lib/azure/bicep/templates'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category')
  const search = searchParams.get('search')
  
  const templates = await getTemplates({ category, search })
  return NextResponse.json(templates)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const template = await createTemplate(body)
  return NextResponse.json(template)
}
```

### 2. Conversion Endpoints

```typescript
// app/api/azure/bicep/convert/to-bicep/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { armToBicep } from '@/lib/azure/bicep/converter'

export async function POST(request: NextRequest) {
  const { armJson } = await request.json()
  
  if (!armJson) {
    return NextResponse.json(
      { error: 'ARM JSON content required' },
      { status: 400 }
    )
  }
  
  const result = await armToBicep(armJson)
  return NextResponse.json(result)
}
```

```typescript
// app/api/azure/bicep/convert/to-arm/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { bicepToArm } from '@/lib/azure/bicep/converter'

export async function POST(request: NextRequest) {
  const { bicepContent } = await request.json()
  
  if (!bicepContent) {
    return NextResponse.json(
      { error: 'Bicep content required' },
      { status: 400 }
    )
  }
  
  const result = await bicepToArm(bicepContent)
  return NextResponse.json(result)
}
```

### 3. Deployment Endpoint

```typescript
// app/api/azure/bicep/deploy/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { deployTemplate } from '@/lib/azure/bicep/deployer'

export async function POST(request: NextRequest) {
  const session = await getServerSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const { 
    templateContent, 
    parameters, 
    subscriptionId, 
    resourceGroup,
    deploymentName 
  } = await request.json()
  
  const result = await deployTemplate({
    templateContent,
    parameters,
    subscriptionId,
    resourceGroup,
    deploymentName
  })
  
  return NextResponse.json(result)
}
```

---

## Frontend Components

### Template Library Component

```typescript
// app/azure/bicep/components/TemplateLibrary.tsx
'use client'

import { useState, useEffect } from 'react'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'

interface Template {
  id: string
  name: string
  displayName: string
  category: string
  description: string
  complexity: string
}

export function TemplateLibrary() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  
  useEffect(() => {
    fetchTemplates()
  }, [selectedCategory, search])
  
  const fetchTemplates = async () => {
    const params = new URLSearchParams()
    if (selectedCategory !== 'all') params.set('category', selectedCategory)
    if (search) params.set('search', search)
    
    const response = await fetch(`/api/azure/bicep/templates?${params}`)
    const data = await response.json()
    setTemplates(data)
  }
  
  return (
    <div className="space-y-6">
      {/* Search & Filters */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
          <input
            type="text"
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg"
          />
        </div>
        
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg"
        >
          <option value="all">All Categories</option>
          <option value="storage">Storage</option>
          <option value="compute">Compute</option>
          <option value="networking">Networking</option>
          <option value="database">Database</option>
          <option value="security">Security</option>
        </select>
      </div>
      
      {/* Template Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template) => (
          <TemplateCard key={template.id} template={template} />
        ))}
      </div>
    </div>
  )
}
```

### Conversion Tool Component

```typescript
// app/azure/bicep/components/ConversionTool.tsx
'use client'

import { useState } from 'react'
import { ArrowsRightLeftIcon } from '@heroicons/react/24/outline'

export function ConversionTool() {
  const [inputFormat, setInputFormat] = useState<'arm' | 'bicep'>('arm')
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [loading, setLoading] = useState(false)
  
  const handleConvert = async () => {
    setLoading(true)
    
    const endpoint = inputFormat === 'arm' 
      ? '/api/azure/bicep/convert/to-bicep'
      : '/api/azure/bicep/convert/to-arm'
    
    const body = inputFormat === 'arm' 
      ? { armJson: input }
      : { bicepContent: input }
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    
    const result = await response.json()
    
    if (result.success) {
      setOutput(result.output)
    } else {
      setOutput(`Error: ${result.error}`)
    }
    
    setLoading(false)
  }
  
  const handleSwap = () => {
    setInputFormat(inputFormat === 'arm' ? 'bicep' : 'arm')
    setInput(output)
    setOutput(input)
  }
  
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">
            {inputFormat === 'arm' ? 'ARM JSON' : 'Bicep'}
          </h3>
        </div>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="w-full h-96 p-4 bg-neutral-900 border border-neutral-800 rounded-lg font-mono text-sm"
          placeholder={`Paste your ${inputFormat === 'arm' ? 'ARM JSON' : 'Bicep'} template here...`}
        />
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">
            {inputFormat === 'arm' ? 'Bicep' : 'ARM JSON'}
          </h3>
          <button
            onClick={handleSwap}
            className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <ArrowsRightLeftIcon className="w-5 h-5" />
          </button>
        </div>
        <textarea
          value={output}
          readOnly
          className="w-full h-96 p-4 bg-neutral-900 border border-neutral-800 rounded-lg font-mono text-sm"
          placeholder="Converted output will appear here..."
        />
      </div>
      
      <div className="col-span-2 flex justify-center">
        <button
          onClick={handleConvert}
          disabled={!input || loading}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-neutral-800 disabled:cursor-not-allowed rounded-lg transition-colors"
        >
          {loading ? 'Converting...' : 'Convert'}
        </button>
      </div>
    </div>
  )
}
```

---

## Implementation Checklist

### Phase 1: Foundation (Week 1)
- [ ] Install and configure Bicep CLI on server
- [ ] Set up Azure authentication (Service Principal)
- [ ] Create database schema for templates
- [ ] Implement basic CRUD operations for templates
- [ ] Document required Azure permissions

### Phase 2: Core Features (Week 2)
- [ ] Implement Bicep → ARM conversion
- [ ] Implement ARM → Bicep conversion
- [ ] Create template validation endpoint
- [ ] Build template library UI
- [ ] Create conversion tool UI

### Phase 3: Deployment (Week 3)
- [ ] Implement template deployment logic
- [ ] Create parameter builder UI
- [ ] Build deployment wizard
- [ ] Add what-if analysis
- [ ] Implement deployment history

### Phase 4: Template Library (Week 4)
- [ ] Scrape Microsoft Learn templates
- [ ] Categorize and tag templates
- [ ] Add search and filtering
- [ ] Implement favorites/bookmarks
- [ ] Add usage analytics

### Phase 5: Advanced Features (Week 5)
- [ ] Template versioning
- [ ] Custom template creation
- [ ] Template sharing
- [ ] Deployment monitoring
- [ ] Cost estimation integration

---

## Security Considerations

### 1. Input Validation
- Sanitize all template inputs
- Validate JSON/Bicep syntax before processing
- Limit file sizes (max 10MB)
- Prevent code injection in parameters

### 2. Authentication & Authorization
- Require authentication for all operations
- Verify Azure permissions before deployment
- Implement rate limiting
- Log all deployment operations

### 3. Credential Management
- Never expose Azure credentials to client
- Use Service Principal with minimum required permissions
- Rotate secrets regularly
- Store credentials in Azure Key Vault

### 4. Deployment Safety
- Always validate templates before deployment
- Implement what-if analysis
- Require confirmation for destructive changes
- Set resource locks where appropriate

---

## Performance Optimization

### 1. Caching Strategy
```typescript
// Cache compiled templates for 1 hour
const templateCache = new Map<string, { compiled: string, timestamp: number }>()

function getCachedCompilation(bicepHash: string) {
  const cached = templateCache.get(bicepHash)
  if (cached && Date.now() - cached.timestamp < 3600000) {
    return cached.compiled
  }
  return null
}
```

### 2. Async Processing
- Use job queues for large deployments
- Implement progress tracking
- Send notifications on completion

### 3. Resource Limits
- Limit concurrent deployments per user
- Set timeout thresholds
- Implement graceful degradation

---

## Monitoring & Logging

### Required Telemetry
```typescript
interface DeploymentTelemetry {
  deploymentId: string
  userId: string
  templateName: string
  subscriptionId: string
  resourceGroup: string
  status: 'pending' | 'running' | 'succeeded' | 'failed'
  duration: number
  resourcesCreated: number
  errors?: string[]
  timestamp: Date
}
```

### Log Collection
- Azure Application Insights integration
- Structured logging for all operations
- Audit trail for deployments
- Error tracking and alerting

---

## Testing Strategy

### Unit Tests
- Template conversion accuracy
- Validation logic
- Parameter parsing
- Error handling

### Integration Tests
- Bicep CLI integration
- Azure SDK operations
- End-to-end deployments (test subscription)

### E2E Tests
- Template library workflows
- Deployment wizard
- Conversion tool UI
- Permission validation

---

## Additional Resources

- [Azure Bicep Documentation](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/)
- [Bicep GitHub Repository](https://github.com/Azure/bicep)
- [ARM Template Reference](https://learn.microsoft.com/en-us/azure/templates/)
- [Azure Resource Manager APIs](https://learn.microsoft.com/en-us/rest/api/resources/)
- [Bicep CLI Reference](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/bicep-cli)

---

## Next Steps

1. Review and approve this implementation plan
2. Set up Azure Service Principal with required permissions
3. Create initial database migrations
4. Begin Phase 1 implementation
5. Set up CI/CD pipeline for Bicep validation
