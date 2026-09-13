# Power Platform Environment Properties Investigation & Fix

**Date**: November 2, 2025  
**Issue**: Incorrect properties used for Managed Environment and Release Cycle detection  
**Status**: ✅ FIXED

## Problem Summary

The Power Platform environments page was showing inaccurate "Managed" and "Release Cycle" badges because it was using incorrect API properties for detection.

### Incorrect Properties (Before Fix)

| Feature | Property Used | Issue |
|---------|--------------|-------|
| Managed Environment | `states.management.id` | This property doesn't exist or doesn't indicate managed status |
| Release Cycle | `updateCadence.id` | This property only shows "Frequent" for all environments |

## Investigation Process

### Step 1: API Response Analysis
Created test scripts to fetch actual Power Platform environment data from the BAP API and inspected all returned properties.

### Step 2: Property Mapping Discovery

#### Managed Environment Detection
```json
{
  "properties": {
    "governanceConfiguration": {
      "protectionLevel": "Standard",  // ← This indicates Managed Environment
      "settings": {
        "extendedSettings": { ... }
      }
    }
  }
}
```

**Values**:
- `"Standard"` = Managed Environment (Enhanced Governance)
- `"Basic"` = Not a Managed Environment

**Verification**: Tested against all 13 environments in the tenant:
- **Managed** (Protection Level = "Standard"): Production, Pipeline Host, System Administrator's Environment, Test User, Russ, Prod2, Russ Rimmerman
- **Not Managed** (Protection Level = "Basic"): test123, test1234, DynamicsProjectTest, Microsoft 365 Copilot Chat, PowerPagesDeveloper, Contoso (default)

#### Release Cycle Detection
```json
{
  "properties": {
    "cluster": {
      "category": "FirstRelease",  // ← This indicates Early release
      "number": "301",
      "geoShortName": "US",
      "environment": "Prod"
    }
  }
}
```

**Values**:
- `"FirstRelease"` = Early (First Release) - Gets updates first
- `"Prod"` = Standard - Gets updates on standard schedule

**Verification**:
- **Early** (cluster.category = "FirstRelease"): Production environment only
- **Standard** (cluster.category = "Prod"): All other 12 environments

## Solution Implemented

### Code Changes

#### 1. Badge Rendering (`src/app/power-platform/environments/page.jsx` - Lines 525-547)

**Before**:
```jsx
{props.states?.management?.id && (
  <span className="...">🛡️ Managed</span>
)}
{props.updateCadence?.id && (
  <span className="...">🔄 {props.updateCadence.id}</span>
)}
```

**After**:
```jsx
{props.governanceConfiguration?.protectionLevel === 'Standard' && (
  <span className="..." title="Managed Environment with enhanced governance (Protection Level: Standard)">
    🛡️ Managed
  </span>
)}
{props.cluster?.category && (
  <span className="..." title={`Release Cycle: ${props.cluster.category === 'FirstRelease' ? 'Early (First Release)' : 'Standard'}`}>
    🔄 {props.cluster.category === 'FirstRelease' ? 'Early' : 'Standard'}
  </span>
)}
```

#### 2. Governance & Protection Section (`src/app/power-platform/environments/page.jsx` - Lines 692-747)

**Updated conditional**:
```jsx
{(props.governanceConfiguration?.protectionLevel === 'Standard' || 
  props.protectionStatus || 
  props.retentionDetails || 
  props.cluster?.category) && (
```

**Updated display**:
```jsx
{props.governanceConfiguration?.protectionLevel === 'Standard' && (
  <div>
    <div className="...">Managed Environment</div>
    <div className="...">✓ Enabled (Protection Level: Standard)</div>
    <div className="...">Features: Sharing limits, usage insights, data policies, maker welcome content</div>
  </div>
)}

{props.cluster?.category && (
  <div>
    <div className="...">Release Cycle</div>
    <div className="...">
      {props.cluster.category === 'FirstRelease' ? (
        <span className="...">Early (First Release)</span>
      ) : (
        <span>Standard</span>
      )}
    </div>
    <div className="...">
      Cluster: {props.cluster.number || 'N/A'}, Region: {props.cluster.geoShortName || 'N/A'}
    </div>
  </div>
)}
```

### Documentation Updates

#### 1. `docs/power-platform-api-features.md`
- Updated Managed Environment property from `states.management.id` to `properties.governanceConfiguration.protectionLevel`
- Updated Release Cycle property from `updateCadence.id` to `properties.cluster.category`
- Added value mappings and examples

#### 2. `docs/power-platform-badges-reference.md`
- Updated badge property reference table
- Updated conditional rendering code examples
- Updated PowerShell equivalents note
- Fixed all property paths to include correct nested structure

## Testing & Verification

### Build Verification
```bash
pnpm run build
```
**Result**: ✅ Compiled successfully with zero errors

### Expected Behavior After Fix

#### Managed Environment Badge
- **Show**: When `properties.governanceConfiguration.protectionLevel === 'Standard'`
- **Environments**: Production, Pipeline Host, System Administrator's Environment, Test User, Russ, Prod2, Russ Rimmerman (7 environments)

#### Release Cycle Badge
- **"Early"**: When `properties.cluster.category === 'FirstRelease'`
  - **Environments**: Production (1 environment)
- **"Standard"**: When `properties.cluster.category === 'Prod'`
  - **Environments**: All others (12 environments)

## Property Reference Table

| Display | Correct Property Path | Possible Values | Meaning |
|---------|----------------------|-----------------|---------|
| Managed Environment | `properties.governanceConfiguration.protectionLevel` | `"Standard"`, `"Basic"` | Standard = Managed, Basic = Not managed |
| Release Cycle | `properties.cluster.category` | `"FirstRelease"`, `"Prod"` | FirstRelease = Early, Prod = Standard |
| Environment Type | `properties.environmentSku` | `"Production"`, `"Sandbox"`, `"Trial"`, `"Developer"`, `"Teams"` | Type of environment |
| CMK Status | `properties.protectionStatus.keyManagedBy` | `"Customer"`, `"Microsoft"` | Who manages encryption keys |
| Creator | `properties.createdBy.displayName` | String | User who created environment |
| Provisioning State | `properties.provisioningState` | `"Succeeded"`, `"Creating"`, `"Failed"` | Current state |
| Backup Retention | `properties.retentionDetails.retentionPeriod` | ISO 8601 duration (e.g., `"P7D"`) | Backup retention period |
| Connected Groups | `properties.connectedGroups[]` | Array of objects | Microsoft 365 groups |

## PowerShell vs API Terminology Differences

| Feature | PowerShell Term | API Property | API Value |
|---------|----------------|--------------|-----------|
| Managed Environment | "Protected Environment" | `governanceConfiguration.protectionLevel` | `"Standard"` |
| Release Cycle | N/A (not exposed in PowerShell) | `cluster.category` | `"FirstRelease"` or `"Prod"` |

**PowerShell Example**:
```powershell
# Get Managed Environments
Get-AdminPowerAppEnvironment -GetProtectedEnvironment $true
```

**API Equivalent**:
Filter environments where `properties.governanceConfiguration.protectionLevel === "Standard"`

## Related Files

### Modified Files
1. `src/app/power-platform/environments/page.jsx` - Badge and section rendering
2. `docs/power-platform-api-features.md` - API property documentation
3. `docs/power-platform-badges-reference.md` - Badge reference guide

### Investigation Files (Temporary, Removed)
- `investigate-env-properties.mjs` - Script to fetch and analyze API responses
- `investigate-production.mjs` - Script to get full Production environment object
- `check-cluster-categories.mjs` - Script to compare all environment properties
- `production-env.json` - Full API response dump

## Commit Details

**Commit**: `297c969`  
**Message**: "Fix Managed Environment and Release Cycle detection properties"  
**Files Changed**: 3  
**Lines Changed**: +62 / -43

## References

- **Power Platform BAP API**: https://learn.microsoft.com/en-us/rest/api/power-platform/
- **Managed Environments**: https://learn.microsoft.com/en-us/power-platform/admin/managed-environment-overview
- **Environment Properties**: https://learn.microsoft.com/en-us/rest/api/power-platform/environmentmanagement/environments/get-environments

## Key Learnings

1. **Always verify API properties with actual responses** - Documentation may be incomplete or outdated
2. **PowerShell cmdlet parameters can provide clues** - `-GetProtectedEnvironment` hinted at "protection" terminology
3. **Property paths are deeply nested** - Must use full path like `properties.governanceConfiguration.protectionLevel`
4. **Terminology varies across interfaces** - PowerShell "Protected", API "governanceConfiguration.protectionLevel", UI "Managed"
5. **Cluster metadata provides release cycle information** - Not obvious from documentation alone

## Status

✅ **FIXED** - All changes tested, built successfully, and pushed to main branch  
✅ **DOCUMENTED** - Updated all relevant documentation files  
✅ **VERIFIED** - Tested against 13 real environments in tenant

---

**Last Updated**: November 2, 2025  
**Build Status**: ✅ Passing  
**Deployment**: Committed to main branch
