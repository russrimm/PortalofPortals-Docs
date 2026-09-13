# Quick Reference: Improved Deployment Interfaces

> [!WARNING]
> **This is not a guide to deploying Portal 360°.** Despite the filename, it
> documents the in-app **Deployment Stacks** and **Bicep** UI wizards that
> administrators use to deploy *Azure resources* from inside the portal.
>
> To deploy the portal itself, see
> **[`DEPLOYMENT-CHECKLIST.md`](./DEPLOYMENT-CHECKLIST.md)**.

## Deployment Stacks Builder - New 4-Step Wizard

### Location
- **File:** `/src/app/azure/deployment-stacks/page.tsx`
- **Modal:** `/src/app/azure/deployment-stacks/components/StackBuilderModal.tsx`

### Workflow

#### Step 1: Basic Information
- Stack name
- Azure location
- Scope configuration (Subscription/Resource Group/Management Group)
- Description (optional)
- **Validates:** Required fields before advancing

#### Step 2: Build Template
- **Quick Start Templates:**
  - Simple Storage Account
  - Web Application (App Service + Plan)
  - Network Infrastructure (VNet + NSG)
- **Resource Builder:**
  - Add individual resources (Storage, VNet, App Service, Key Vault, SQL, Cosmos DB, VM)
  - Visual resource list with type and name
  - Remove unwanted resources
- **Parameters:**
  - Add parameter name/value pairs
  - Auto-extracted from resource template
- **Validates:** At least 1 resource selected

#### Step 3: Configure Behavior
- **Lifecycle Management:**
  - Action on unmanaged resources (Detach/Delete)
  - Action on unmanaged resource groups (Detach/Delete)
- **Deny Settings:**
  - Mode: None, Deny Delete, Deny Write and Delete
  - Apply to child scopes (checkbox)
- **Purpose:** Control what happens when stack is updated or deleted

#### Step 4: Review & Create
- Summary of all settings
- Resource count
- Parameter count
- Behavior settings preview
- Download template button (preview before deployment)
- **Final Action:** Create Stack

### Key Features

✅ **Progressive Disclosure:** Only shows relevant fields per step
✅ **Visual Feedback:** Progress bar shows current step
✅ **Validation:** Can't advance without required fields
✅ **Templates:** Quick start with pre-built configurations
✅ **Download:** Export template for review/CI/CD
✅ **Dark Theme:** Matches app design system

### Usage Example
```typescript
// Open modal from main page
<Button onClick={() => setShowCreateModal(true)}>
  <PlusCircle /> Create Stack
</Button>

// Modal component
<StackBuilderModal
  isOpen={showCreateModal}
  onClose={() => setShowCreateModal(false)}
  scope="subscription"
  subscriptionId={selectedSub}
  subscriptions={subscriptions}
  onStackCreated={() => {
    loadStacks()
    setShowCreateModal(false)
  }}
/>
```

---

## Deploy Page Architecture (Documented)

### Current Structure
**Problem:** 1,598 lines, everything in one file

### Proposed Structure
**Solution:** Modular step components (~350 line main file)

### Step Components

#### Step 1: Resource Selection
```typescript
<Step1ResourceSelection
  selectedModules={selectedModules}
  onModuleToggle={handleModuleToggle}
  onNext={() => setCurrentStep(2)}
  location={config.location}
/>
```
- Resource cards with pricing
- Cost estimation
- Module dependencies (e.g., Bastion requires VNet)

#### Step 2: Configuration
```typescript
<Step2Configuration
  selectedModules={selectedModules}
  config={config}
  subscriptions={subscriptions}
  onConfigChange={handleConfigChange}
  onBack={() => setCurrentStep(1)}
  onGenerate={generateBicep}
  loading={loading}
  isValid={validateStep2()}
/>
```
- Tabbed interface (General, VNet, VMs, Load Balancer, etc.)
- Per-tab validation
- Contextual help text
- Network interface configuration

#### Step 3: Review Template
```typescript
<Step3ReviewTemplate
  generatedFiles={generatedFiles}
  onBack={() => setCurrentStep(2)}
  onDeploy={deployBicep}
  loading={loading}
  azureCliAuthenticated={azStatus?.authenticated}
/>
```
- Display generated Bicep files
- Download individual files
- Syntax preview
- Deploy button

#### Step 4: Deployment Result
```typescript
<Step4DeploymentResult
  deploymentResult={deploymentResult}
  onStartNew={resetDeployment}
/>
```
- Deployment status
- Resource list
- Output values
- Start new deployment

---

## Design Improvements

### Before
```
┌─────────────────────────────────────┐
│  [1,598 lines of mixed concerns]   │
│  ├─ Resource selection inline      │
│  ├─ Configuration forms inline     │
│  ├─ Pricing logic scattered        │
│  ├─ Validation in JSX              │
│  ├─ Network config embedded        │
│  └─ Deployment result inline       │
└─────────────────────────────────────┘
```

### After
```
┌─────────────────────────────────────┐
│     Main Page (~350 lines)          │
│                                     │
├─────────────────────────────────────┤
│  Component 1: ResourceSelection     │
│  └─ Pricing Service                │
├─────────────────────────────────────┤
│  Component 2: Configuration         │
│  └─ Form Tabs                      │
├─────────────────────────────────────┤
│  Component 3: ReviewTemplate        │
│  └─ File Downloader                │
├─────────────────────────────────────┤
│  Component 4: DeploymentResult      │
│  └─ Output Display                 │
└─────────────────────────────────────┘
```

---

## Benefits Summary

### Deployment Stacks ✅
- **Wizard Interface:** Clear 4-step process
- **Visual Progress:** Know where you are
- **Template Library:** Start quickly
- **Resource Builder:** Add/remove easily
- **Download Option:** Preview before deploy
- **Validation:** Can't proceed with invalid data

### Deploy Page (Planned) 📋
- **Modular:** Each step is independent
- **Maintainable:** Easy to modify one step
- **Testable:** Test steps individually
- **Clear Flow:** Step-by-step guidance
- **Better UX:** Focused interfaces
- **Organized:** Know where to find features

---

## Migration Guide

### For Deployment Stacks
**Status:** ✅ Complete - Ready to use!

The new modal is already integrated:
1. Navigate to `/azure/deployment-stacks`
2. Click "Create Stack" button
3. Follow the 4-step wizard
4. Review and deploy

### For Deploy Page
**Status:** 📋 Architecture documented

To implement:
1. Create step component files
2. Extract logic from main page
3. Update main page to use components
4. Test each step independently
5. Test full wizard flow

See `DEPLOY_PAGE_IMPROVEMENTS.md` for full details.

---

## Comparison Table

| Aspect | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Deployment Stacks Page** | 1,200 lines | 900 lines (split) | Better organized |
| **Deploy Page** | 1,598 lines | ~1,150 lines (split) | 30% smaller + organized |
| **Cognitive Load** | High | Low | Easier to understand |
| **Maintainability** | Difficult | Easy | Clear boundaries |
| **User Experience** | Confusing tabs | Clear steps | Guided workflow |
| **Validation** | Scattered | Per-step | Clear feedback |
| **Testing** | Hard | Easy | Independent tests |

---

## Technical Stack

### UI Components Used
- `@/components/ui/button`
- `@/components/ui/card`
- `@/components/ui/input`
- `@/components/ui/select`
- `@/components/ui/alert`
- `@/components/ui/tabs`
- `@/components/ui/checkbox`
- `lucide-react` icons

### Styling
- Tailwind CSS 4
- Dark theme optimized
- Gradient backgrounds
- Neutral color palette
- Smooth transitions

### State Management
- React useState
- Props drilling (simple, clear)
- Callback pattern
- Controlled components

---

## Next Steps

### Immediate
1. ✅ Test new deployment stacks builder
2. ✅ Gather user feedback
3. 📋 Implement deploy page components

### Future Enhancements
1. Add template validation before deploy
2. Save templates for reuse
3. Clone existing stacks
4. Deployment history
5. Cost estimation improvements
6. ARM template import

---

## Support

### Issues?
Check the component file directly:
- Deployment Stacks: `/src/app/azure/deployment-stacks/components/StackBuilderModal.tsx`
- Deploy Page Docs: `/DEPLOY_PAGE_IMPROVEMENTS.md`

### Questions?
- Review this guide
- Check inline code comments
- Refer to TypeScript interfaces for data structures
