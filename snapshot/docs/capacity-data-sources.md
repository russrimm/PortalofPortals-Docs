# Power Platform Capacity Data Sources

## Overview
You may notice that capacity numbers differ between the **Tenant Capacity** page and the **Environments** page. This is expected behavior due to different data sources and purposes.

## Two Different APIs

### 1. Tenant Capacity API (Licensing)
**URL:** `https://api.powerplatform.com/licensing/tenantCapacity`  
**Page:** `/power-platform/licensing/tenant-capacity`  
**Data Source:** Microsoft's licensing and billing system  
**Purpose:** Shows tenant-wide allocated/licensed capacity and aggregate consumption

**What it includes:**
- Total licensed capacity across all subscriptions and add-ons
- Aggregate consumption from the licensing system's perspective
- Overflow capacity and entitlements
- Trial capacity and temporary licenses
- Rated consumption (what you'll be billed for)
- Data updated: Daily/periodic aggregate updates

**Key Fields:**
```typescript
{
  capacityType: "Database" | "File" | "Log",
  totalCapacity: number,      // Total allocated capacity
  maxCapacity: number,         // Maximum with overflow
  consumption: {
    actual: number,            // Current aggregate usage
    rated: number,             // Billable usage
    actualUpdatedOn: string,
    ratedUpdatedOn: string
  }
}
```

### 2. Environments API (BAP)
**URL:** `https://api.bap.microsoft.com/.../environments?$expand=properties.capacity`  
**Page:** `/power-platform/environments`  
**Data Source:** Business Application Platform (BAP) environment management system  
**Purpose:** Shows per-environment actual consumption in near real-time

**What it includes:**
- Actual storage consumed by each environment's database
- Real-time or near real-time usage data
- Per-environment breakdown
- Only what's currently in use (not allocated/reserved)
- Data updated: Near real-time as usage changes

**Key Fields:**
```javascript
{
  capacityType: "Database" | "File" | "Log",
  actualConsumption: number,   // Current environment usage in MB
  ratedConsumption: number,    // What this environment counts toward billing
  capacityUnit: "MB"
}
```

## Why The Numbers Don't Match

The capacity values can differ for several legitimate reasons:

### 1. **Different Data Sources**
- **Tenant Capacity API** pulls from Microsoft's licensing/billing database
- **Environments API** pulls from the platform infrastructure monitoring system
- These systems sync periodically but not in real-time

### 2. **Different Measurement Scopes**
- **Tenant Capacity**: Shows what you're **allocated** and **licensed for**
  - Includes unused reserved capacity
  - Includes capacity from all license types (paid, trial, overflow)
  - Represents your billing entitlement
- **Environments**: Shows what you're **actually consuming**
  - Only includes active storage in databases
  - Sum of per-environment usage
  - Represents real infrastructure usage

### 3. **Timing Differences**
- **Tenant Capacity**: Updated daily or on billing cycles
- **Environments**: Updated hourly or as consumption changes
- Can show temporary discrepancies during the day

### 4. **Capacity Not Yet Assigned**
- You may have licensed capacity that hasn't been allocated to any environment yet
- Trial capacity waiting to be claimed
- Add-on capacity purchased but not yet consumed

### 5. **Aggregate vs. Sum Calculations**
- **Tenant Capacity**: Microsoft's backend calculates tenant-wide totals
- **Environments**: Our UI sums up individual environment values
- Rounding differences and calculation methods may vary

## Example Scenario

**Your situation:**
```
Tenant Capacity Page:
- Database: 50 GB allocated (from licenses)
- Consumption: 45 GB (aggregate from licensing system, updated yesterday)

Environments Page:
- Production: 20 GB
- Sandbox: 15 GB  
- Dev: 8 GB
- Total: 43 GB (sum calculated just now)
```

**Why they differ (45 GB vs. 43 GB):**
1. Tenant capacity was last updated yesterday (45 GB at that time)
2. Environments show current usage (43 GB now - you deleted some data today)
3. Systems will sync again on next update cycle
4. Both numbers are correct for their respective measurement times

## Which Number Should I Trust?

**For billing and license planning:** Use **Tenant Capacity API**
- This is what Microsoft uses for billing
- Shows your entitlements and what you're paying for
- Official capacity reporting for compliance

**For operational monitoring:** Use **Environments API**
- Shows actual current usage per environment
- Better for identifying which environments are consuming storage
- Useful for cleanup and optimization decisions
- More granular and actionable

## API Documentation References

- **Tenant Capacity API**: https://learn.microsoft.com/en-us/rest/api/power-platform/licensing/tenant-capacity-details/get-tenant-capacity-details
- **Environments API**: https://learn.microsoft.com/en-us/rest/api/power-platform/licensing/environments/get-environment
- **Power Platform Capacity**: https://learn.microsoft.com/en-us/power-platform/admin/capacity-storage

## Implementation Notes

### Tenant Capacity Page
- File: `src/app/power-platform/licensing/tenant-capacity/page.tsx`
- API Route: `src/app/api/power-platform/licensing/tenant-capacity/route.ts`
- Token: Uses `getPowerPlatformDelegatedToken` with `https://api.powerplatform.com` audience

### Environments Page  
- File: `src/app/power-platform/environments/page.jsx`
- API Route: `src/app/api/power-platform/environments/route.js`
- Token: Uses `getBAPDelegatedToken` with `https://api.bap.microsoft.com` audience
- Calculates totals by summing `actualConsumption` from each environment's `properties.capacity` array

## Recommendations

1. **Don't expect exact matches** - These are different systems measuring different things
2. **Look for trends, not exact values** - Both APIs are useful for different purposes
3. **Use Tenant Capacity for billing questions** - It's the official source
4. **Use Environments for operational decisions** - It's more granular and actionable
5. **Investigate if discrepancy is >10%** - Small differences are normal, large ones may indicate sync issues

## When to Investigate Further

Contact Microsoft support if:
- Discrepancy is consistently >10% over multiple days
- Tenant capacity shows usage but you have no environments
- Environment totals far exceed tenant allocated capacity
- Consumption decreases on one system but not the other for >48 hours
