# Power Platform Environment Badges - Quick Reference

## Badge Legend

| Badge | Icon | Color | Property | Meaning | Governance Impact |
|-------|------|-------|----------|---------|-------------------|
| **Managed** | 🛡️ | Green (`emerald-500`) | `properties.governanceConfiguration.protectionLevel === 'Standard'` | Environment has enhanced governance features enabled | High - Automated compliance, limited customization |
| **CMK** | 🔐 | Purple (`purple-500`) | `properties.protectionStatus.keyManagedBy === 'Customer'` | Customer-managed encryption keys active | High - Regulatory compliance (HIPAA, FedRAMP) |
| **Release Cycle** | 🔄 | Blue (`blue-500`) | `properties.cluster.category` | Shows release wave (Early/Standard) | Medium - Change management planning |
| **Environment Type** | - | Sky blue (`sky-500`) | `properties.environmentSku` | Production / Sandbox / Trial / Developer / Teams | Medium - Determines available features |

## Governance & Protection Section Properties

| Property | Display Name | Example Value | Purpose |
|----------|--------------|---------------|---------|
| `properties.governanceConfiguration.protectionLevel` | Managed Environment | Standard / Basic | "Standard" = Managed, "Basic" = Not managed |
| `properties.protectionStatus.keyManagedBy` | Encryption Type | Customer / Microsoft | Shows who manages encryption keys |
| `properties.cluster.category` | Release Cycle | FirstRelease / Prod | FirstRelease = Early, Prod = Standard |
| `properties.retentionDetails.retentionPeriod` | Backup Retention | P7D (7 days) | ISO 8601 duration format |
| `properties.retentionDetails.backupsAvailableFromDateTime` | Oldest Backup | 2025-10-26T00:00:00Z | UTC timestamp of earliest backup |
| `properties.createdBy.displayName` | Created By | John Smith | User who created environment |
| `properties.provisioningState` | Provisioning State | Succeeded / Creating / Failed | Current provisioning status |
| `properties.connectedGroups[]` | Connected Groups | [{id, name}] | Associated Microsoft 365 groups |

## When to Use Each Badge

### Managed Environment Badge (Green Shield 🛡️)
**Display When**: `properties.governanceConfiguration.protectionLevel === 'Standard'`
**Use Cases**:
- Compliance reporting
- Identifying governed environments
- Filtering for automated policy enforcement
- Finding environments with enhanced security

**PowerShell Equivalent**:
```powershell
Get-AdminPowerAppEnvironment -GetProtectedEnvironment $true
```
**Note**: PowerShell uses different terminology ("Protected") than the API ("governanceConfiguration.protectionLevel")

### CMK Badge (Purple Lock 🔐)
**Display When**: `protectionStatus.keyManagedBy === 'Customer'`
**Use Cases**:
- HIPAA compliance audits
- FedRAMP certification requirements
- Data sovereignty verification
- Encryption key rotation tracking

**Compliance Requirements**:
- Healthcare (HIPAA)
- Government (FedRAMP, DoD)
- Financial services (PCI-DSS)
- European data protection (GDPR)

### Update Ring Badge (Blue Refresh 🔄)
**Display When**: `updateCadence.name` property exists
**Use Cases**:
- Change management planning
- Maintenance window scheduling
- Feature availability tracking
- Risk assessment (frequent updates = earlier features + more risk)

**Ring Meanings**:
- **Frequent**: Early adopter, latest features first
- **Standard**: Balanced approach, most common
- **Delayed**: Conservative, stability prioritized

## Property Availability by Environment Type

| Property | Production | Sandbox | Trial | Developer | Teams |
|----------|-----------|---------|-------|-----------|-------|
| `states.management.id` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `protectionStatus.keyManagedBy` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `updateCadence.name` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `retentionDetails` | ✅ | ✅ | ⚠️ Limited | ❌ | ❌ |
| `connectedGroups` | ❌ | ❌ | ❌ | ❌ | ✅ |

✅ = Fully supported | ⚠️ = Partially supported | ❌ = Not available

## Conditional Rendering Patterns

### Badge Display Logic
```jsx
{/* Managed Environment - check for Standard protection level */}
{env.properties?.governanceConfiguration?.protectionLevel === 'Standard' && (
  <span className="badge-managed">🛡️ Managed</span>
)}

{/* Customer-Managed Key - check if Customer managed */}
{env.properties?.protectionStatus?.keyManagedBy === 'Customer' && (
  <span className="badge-cmk">🔐 CMK</span>
)}

{/* Release Cycle - map cluster category to display value */}
{env.properties?.cluster?.category && (
  <span className="badge-ring">
    🔄 {env.properties.cluster.category === 'FirstRelease' ? 'Early' : 'Standard'}
  </span>
)}
```

### Section Display Logic
```jsx
{/* Show section only if any governance property exists */}
{(env.properties?.governanceConfiguration?.protectionLevel === 'Standard' || 
  env.properties?.protectionStatus ||
  env.properties?.retentionDetails ||
  env.properties?.cluster?.category) && (
  <div className="governance-section">
    {/* Section content */}
  </div>
)}
```

## API Endpoints

### List All Environments
```
GET https://api.bap.microsoft.com/providers/Microsoft.BusinessAppPlatform/scopes/admin/environments
  ?api-version=2020-10-01
  &$expand=properties.capacity,properties.addons,properties.linkedEnvironmentMetadata
```

### Get Single Environment (Full Details)
```
GET https://api.bap.microsoft.com/providers/Microsoft.BusinessAppPlatform/scopes/admin/environments/{environmentId}
  ?api-version=2020-10-01
  &$expand=properties.capacity,properties.addons,properties.linkedEnvironmentMetadata
```

## Caching Strategy

| Query Type | TTL | Rationale |
|------------|-----|-----------|
| Environment List | 60s | Frequently accessed, changes rare |
| Single Environment | 120s | More stable, detailed view |
| Storage History | 300s | Historical data, rarely changes |

## Common Issues and Solutions

### Issue: Managed badge not showing
**Possible Causes**:
- Environment is not a Managed Environment
- Insufficient permissions (requires admin role)
- API not returning `states.management.id` property

**Solution**:
```javascript
console.log('Environment states:', env.states);
// Check if states.management.id exists
```

### Issue: CMK badge showing "undefined"
**Possible Causes**:
- Property path incorrect (`protectionStatus` might be null)
- Environment doesn't have CMK enabled

**Solution**:
```javascript
console.log('Protection status:', env.protectionStatus);
// Should show: { keyManagedBy: 'Customer' } or { keyManagedBy: 'Microsoft' }
```

### Issue: Update ring badge missing
**Possible Causes**:
- Trial/Developer environments may not have update cadence configured
- Property not returned by API

**Solution**:
```javascript
console.log('Update cadence:', env.updateCadence);
// Check if name property exists
```

## Color Scheme (Tailwind CSS)

```css
/* Managed Environment Badge */
bg-emerald-500/90 text-white
/* Gradient: from-emerald-50 to-blue-50 */

/* Customer-Managed Key Badge */
bg-purple-500/90 text-white

/* Update Ring Badge */
bg-blue-500/90 text-white

/* Environment Type Badge */
bg-sky-500/90 text-white

/* Governance Section Background */
bg-gradient-to-br from-emerald-50 to-blue-50
border-emerald-200
```

## Accessibility

All badges include:
- **Title attributes** for hover tooltips
- **Semantic HTML** (`<span>` with descriptive classes)
- **Sufficient color contrast** (WCAG AA compliant)
- **Icon + Text combination** for screen readers

Example:
```jsx
<span 
  className="badge-managed" 
  title="Managed Environment - Enhanced governance and automation enabled"
  aria-label="Managed Environment"
>
  🛡️ Managed
</span>
```

## Testing Checklist

### Visual Testing
- [ ] All badges align vertically
- [ ] Icons render correctly on all browsers
- [ ] Colors match design system
- [ ] Responsive layout works on mobile
- [ ] Gradient backgrounds render smoothly

### Functional Testing
- [ ] Badges only show when properties exist
- [ ] Hover tooltips display correctly
- [ ] No JavaScript errors in console
- [ ] Properties update when environment changes
- [ ] Cache invalidation works correctly

### Cross-Browser Testing
- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari (macOS/iOS)
- [ ] Mobile browsers

## Quick Search Patterns

### Find all Managed Environments
```javascript
environments.filter(env => env.states?.management?.id)
```

### Find all CMK Environments
```javascript
environments.filter(env => 
  env.protectionStatus?.keyManagedBy === 'Customer'
)
```

### Find environments by Update Ring
```javascript
// Frequent ring
environments.filter(env => env.updateCadence?.name === 'Frequent')

// Standard ring
environments.filter(env => env.updateCadence?.name === 'Standard')

// Delayed ring
environments.filter(env => env.updateCadence?.name === 'Delayed')
```

### Find Production environments with CMK
```javascript
environments.filter(env => 
  env.properties?.type === 'Production' &&
  env.protectionStatus?.keyManagedBy === 'Customer'
)
```

## Related Documentation

- [Power Platform API Features](./power-platform-api-features.md) - Complete API documentation
- [Implementation Summary](./power-platform-implementation-summary.md) - Implementation details
- [Sentinel Workflow Fix](./sentinel-workflow-fix.md) - CI/CD configuration

## Version History

- **v1.0** (Nov 2, 2025): Initial implementation with 8 governance properties
- Property set may expand as new BAP API features are added

---

**Last Updated**: November 2, 2025  
**API Version**: 2020-10-01  
**Compatibility**: Power Platform BAP API
