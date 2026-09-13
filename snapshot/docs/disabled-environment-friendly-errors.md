# Disabled Environment Friendly Error Messages

**Date**: 2025-11-19  
**Purpose**: Display user-friendly error messages when Power Platform environments are disabled

## Problem

When a Power Platform environment is disabled, API calls to Dataverse and Power Automate return cryptic XRM API error codes (`0x8004a104`) instead of actionable guidance for users.

### Example Error (Before)
```json
{
  "error": {
    "code": "XrmApiRequestFailed",
    "message": "Request to XRM API failed with error: 'Message: The Dynamics 365 organization you are attempting to access is currently disabled. Please contact your system administrator\nCode: 0x8004a104\nInnerError: '.",
    "extendedData": {
      "code": "0x8004a104",
      "message": "The Dynamics 365 organization you are attempting to access is currently disabled. Please contact your system administrator"
    }
  }
}
```

## Solution

### 1. Flows API Error Detection

**File**: `src/app/api/power-platform/flows/route.js`  
**Lines**: 265-293

Added detection logic after JSON parsing to identify disabled environment errors:

```javascript
// Check for disabled environment error (404 with XRM API error code)
if (response.status === 404 && errorJson) {
  const errorCode = errorJson.error?.code;
  const extendedCode = errorJson.error?.extendedData?.code;
  const errorMessage = errorJson.error?.message || '';
  
  // Detect disabled environment by:
  // 1. XrmApiRequestFailed error code
  // 2. Extended data code 0x8004a104 (disabled organization)
  // 3. Message containing "currently disabled"
  const isDisabledEnvironment = 
    errorCode === 'XrmApiRequestFailed' &&
    (extendedCode === '0x8004a104' || errorMessage.includes('currently disabled'));
  
  if (isDisabledEnvironment) {
    console.log('[Flows API] Detected disabled environment, returning friendly error');
    return Response.json({
      error: 'This environment is currently disabled',
      details: 'The environment cannot be accessed because it has been disabled. Flows and other Dataverse resources are unavailable while the environment is in a disabled state.',
      isDisabledEnvironment: true,
      action: 'enableEnvironment',
      helpText: 'To restore access to flows:\n\n' +
               '1. Go to the environment\'s "Governance & Protection" section\n' +
               '2. Look for "Environment State Controls"\n' +
               '3. Click the "Enable Environment" button\n' +
               '4. Wait for the environment to become active\n' +
               '5. Refresh this page to view flows\n\n' +
               'Note: Only administrators can enable environments. Contact your administrator if you don\'t have permission.'
    }, { status: 503 }); // Service Unavailable
  }
}
```

### 2. Frontend Error Display

**File**: `src/app/power-platform/environments/page.jsx`  
**Lines**: 2687-2711

Updated flows button onClick handler to detect `isDisabledEnvironment` flag:

```javascript
if (!flowsResponse.ok) {
  if (flowsJson.requiresAuth) {
    // Redirect to sign-in
  } else if (flowsJson.isDisabledEnvironment) {
    // Show friendly disabled environment error
    setFlowsModal({ 
      open: true, 
      items: [], 
      title: 'Flows', 
      loading: false, 
      error: flowsJson.error || 'Environment is disabled',
      errorDetails: flowsJson.details,
      helpText: flowsJson.helpText,
      isDisabledEnvironment: true,
      requiresAuth: false, 
      environmentId: envId, 
      connectors: [] 
    })
  } else {
    // Generic error
  }
}
```

### 3. Modal Help Text Display

**File**: `src/app/power-platform/environments/page.jsx`  
**Lines**: 4925-4941

Updated flows modal error rendering to show help text:

```javascript
) : flowsModal.error ? (
  <div className="text-sm text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-900/40 border border-red-200 dark:border-red-800 rounded p-3">
    <div className="font-medium mb-1">Error loading flows</div>
    <div className="mb-1">{flowsModal.error}</div>
    {flowsModal.errorDetails && (
      <div className="text-xs opacity-80 mt-2 mb-2">{flowsModal.errorDetails}</div>
    )}
    {flowsModal.isDisabledEnvironment && flowsModal.helpText ? (
      <div className="mt-3 text-xs bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded p-2">
        <div className="font-medium mb-1 text-yellow-800 dark:text-yellow-200">How to enable this environment:</div>
        <pre className="whitespace-pre-wrap font-mono text-xs text-yellow-900 dark:text-yellow-100">{flowsModal.helpText}</pre>
      </div>
    ) : // ... other error types
  </div>
```

## User Experience

### Before
- User clicks "Flows" button on disabled environment
- Sees technical error: `XrmApiRequestFailed` with code `0x8004a104`
- No guidance on how to resolve

### After
- User clicks "Flows" button on disabled environment
- Sees friendly error: "This environment is currently disabled"
- Gets clear explanation of the issue
- Sees step-by-step instructions in a yellow help box:
  1. Go to Governance & Protection section
  2. Look for Environment State Controls
  3. Click "Enable Environment" button
  4. Wait for environment to become active
  5. Refresh page
- Notes that only administrators can enable environments

## Error Detection Criteria

The API checks for disabled environment using three indicators:

1. **Error Code**: `XrmApiRequestFailed`
2. **Extended Code**: `0x8004a104` (disabled organization)
3. **Message Pattern**: Contains text "currently disabled"

All three must be true for the friendly error to display.

## HTTP Status Codes

- **Before**: Returns 404 (Not Found)
- **After**: Returns 503 (Service Unavailable) for disabled environments
  - More semantically correct (resource exists but temporarily unavailable)
  - Indicates the issue is temporary and can be resolved

## Related Work

This follows the same pattern as the Environment State Controls feature, which allows administrators to enable/disable environments directly from the Governance & Protection section:

- Enable/Disable buttons added in lines 2286-2380
- Environment state API route: `src/app/api/power-platform/environment-state/route.js`
- Runtime state display: Shows "Disabled" (red) or "Running" (green)

## Testing

1. **Test with disabled environment**:
   - Navigate to Power Platform Environments page
   - Expand a disabled environment
   - Click "Flows" button
   - Verify friendly error appears with help text

2. **Test enable flow**:
   - In same environment, go to Governance & Protection
   - Click "Enable Environment"
   - Wait for 202 Accepted response
   - Refresh page
   - Environment should show "Running" state
   - Flows button should now work

3. **Build verification**:
   ```powershell
   pnpm run build
   ```
   - Should complete successfully in ~36 seconds
   - All routes should compile without errors

## Future Enhancements

1. **Proactive Detection**: Disable flows button when environment state is "Disabled" (before user clicks)
2. **Organization API**: Apply same pattern to organization API errors
3. **Connectors API**: Extend to connector queries for disabled environments
4. **Other Dataverse APIs**: Apply to bots, tables, solutions, etc.

## References

- Microsoft Docs: [Dataverse Error Codes](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/reference/error-codes)
- Error Code `0x8004a104`: Organization disabled
- Power Platform API: [Environment Management](https://learn.microsoft.com/en-us/power-platform/admin/programmability-authentication-v2)
