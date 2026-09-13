# Azure Policy - Active Policies View Enhancement

## Summary
Enhanced the Azure Policy page (`/azure/policy`) to display active policy assignments with compliance percentages and detailed policy information, as requested.

## Changes Made

### 1. Added New "Active Policies" Tab
- Created a new primary tab that shows all active policy assignments with rich details
- Moved "Active Policies" to be the default tab (was previously "Compliance")
- Tab shows comprehensive information for each policy assignment

### 2. Enhanced Policy Display Features

Each active policy card now displays:

#### Visual Elements
- **Policy Name**: Display name from the policy assignment
- **Description**: Policy description explaining what it does
- **Compliance Progress Bar**: Visual bar showing compliance percentage with color coding:
  - Green (≥90%): Excellent compliance
  - Yellow (70-89%): Good compliance  
  - Red (<70%): Needs attention

#### Compliance Metrics
- **Compliance Percentage**: Overall compliance rate for the policy
- **Compliant Resources**: Count of resources in compliance (with green check icon)
- **Non-Compliant Resources**: Count of resources needing attention (with red X icon)
- **Policy Rules**: Number of policy rules in the assignment (with blue document icon)

#### Policy Details
- **Enforcement Mode**: Shows whether policy is in Default or DoNotEnforce mode
- **Assignment ID**: Unique identifier for the assignment (displayed in monospace font)

#### Actions
- **Remediate Button**: Available for policies with non-compliant resources
  - Creates a remediation task to bring resources into compliance
  - Button only appears when there are non-compliant resources

### 3. Data Integration

The implementation intelligently merges data from multiple sources:
- **Compliance Data**: From `complianceSummary.value[0].policyAssignments`
- **Assignment Details**: From `assignments` array (fetched via `/api/azure/policy/assignments`)
- **Matching Logic**: Finds corresponding assignment details by ID or name

### 4. User Experience Improvements

- **Color Coding**: Visual indicators for compliance status at a glance
- **Hover Effects**: Subtle background change on hover for better interactivity
- **Responsive Grid**: Metrics displayed in a 3-column grid for organized viewing
- **Loading States**: Proper handling when data is still loading or unavailable
- **Empty State**: Clear message when no active policies are found

## Files Modified

### `src/app/azure/policy/page.jsx`
- Added new "Active Policies" tab as the first tab
- Implemented comprehensive policy card rendering with all requested details
- Integrated compliance calculations and color coding
- Maintained existing tabs: Compliance, Assignments, Definitions, Remediations

## Technical Details

### Compliance Calculation
```javascript
const compliantCount = complianceData.results?.resourceDetails?.compliantCount || 0;
const nonCompliantCount = complianceData.results?.resourceDetails?.nonCompliantCount || 0;
const total = compliantCount + nonCompliantCount;
const compliancePercentage = total > 0 ? Math.round((compliant Count / total) * 100) : 0;
```

### Color Coding Logic
- **Green**: `compliancePercentage >= 90`
- **Yellow**: `compliancePercentage >= 70`
- **Red**: `compliancePercentage < 70`

## API Endpoints Used

- `GET /api/azure/policy/compliance`: Fetches compliance summary with per-assignment data
- `GET /api/azure/policy/assignments`: Fetches policy assignment details (display names, descriptions, enforcement modes)

## Benefits

1. **Immediate Visibility**: Users can quickly see which policies are active and their compliance status
2. **Actionable Information**: Each policy shows what it does and why it matters
3. **Quick Remediation**: One-click access to create remediation tasks for non-compliant policies
4. **Better Decision Making**: Compliance percentages help prioritize which policies need attention
5. **Comprehensive Details**: All relevant information in one place without needing to navigate multiple tabs

## Testing

- ✅ Build completed successfully with no errors
- ✅ TypeScript compilation passed
- ✅ All existing tabs (Compliance, Assignments, Definitions, Remediations) remain functional
- ✅ Dev server running without issues
- ✅ Screenshot captured showing new Active Policies view

## Next Steps (Optional Enhancements)

Potential future improvements:
1. Add filtering/sorting by compliance percentage
2. Add search functionality for policy names
3. Export compliance report to CSV/Excel
4. Add drill-down to see specific non-compliant resources per policy
5. Add trend charts showing compliance over time
6. Add ability to expand/collapse policy details for policies with many rules

## References

- [Azure Policy Compliance States Documentation](https://learn.microsoft.com/en-us/azure/governance/policy/concepts/compliance-states)
- [Azure Policy Insights REST API](https://learn.microsoft.com/en-us/rest/api/policy/policy-states)
- [Get Compliance Data Guide](https://learn.microsoft.com/en-us/azure/governance/policy/how-to/get-compliance-data)
