# Force Failover Feature Implementation

**Date:** February 2025  
**Feature:** Power Platform Environment Force Failover  
**Status:** ✅ Complete

## Overview

Implemented disaster recovery force failover functionality for Power Platform environments. This critical feature allows administrators to trigger geo-redundant failover to a secondary region during disaster recovery scenarios.

## Implementation Details

### 1. State Management
**File:** `src/app/power-platform/environments/page.jsx` (Line 247)
- Added `failoverOps` state using `useState({})`
- Tracks loading, error, and success states per environment
- Pattern follows existing backup and environment state operations

### 2. Handler Function
**File:** `src/app/power-platform/environments/page.jsx` (Lines 1066-1115)
- Implemented `handleForceFailover(environmentId, environmentName)`
- Features:
  - Comprehensive confirmation dialog with disaster recovery warnings
  - Loading state management during operation
  - Error handling with user-friendly messages
  - Success messaging with 15-second auto-clear
  - Alert dialogs for user feedback

**Key Warnings Displayed:**
- ⚠️ This is a DISRUPTIVE operation
- Environment will be temporarily unavailable
- In-progress transactions may be lost
- Failover to secondary geo-redundant region
- Should only be used in disaster recovery scenarios

### 3. User Interface
**File:** `src/app/power-platform/environments/page.jsx` (Lines ~3633-3685)
- Added Force Failover control section in Governance & Protection tab
- Positioned after Environment Backup Controls
- Design features:
  - Red/orange border theme (indicates danger/disruption)
  - Warning emoji (⚠️) for visual emphasis
  - Comprehensive description of disaster recovery implications
  - Loading spinner during operation
  - Success/error message displays
  - Button disabled during operation

**UI Layout:**
```
┌─────────────────────────────────────────────────┐
│ ⚠️ Force Failover              [Force Failover] │
│                                                  │
│ ⚠️ Disaster Recovery Only                       │
│ Force failover to secondary geo-redundant...    │
│ • Triggers failover to secondary region         │
│ • Disruptive - environment unavailable          │
│ • In-progress transactions may be lost          │
│ • Use only in disaster recovery scenarios       │
└─────────────────────────────────────────────────┘
```

### 4. API Route
**File:** `src/app/api/power-platform/environments/[id]/failover/route.js` (NEW)
- Endpoint: `POST /api/power-platform/environments/[id]/failover`
- Authentication: NextAuth session validation
- Token acquisition: Power Platform delegated token via OBO
- Microsoft API integration:
  - Endpoint: `https://api.bap.microsoft.com/providers/Microsoft.BusinessAppPlatform/environments/{environmentId}/performForceFailover?api-version=2021-04-01`
  - Method: POST
  - Headers: Authorization Bearer token, Content-Type, Accept

**Error Handling:**
- 401: Unauthorized (no session)
- 400: Missing environment ID
- 403: Insufficient permissions
- 404: Environment not found or failover not available
- 429: Rate limiting
- 500: Token acquisition failure or unexpected errors

**Response Format:**
```json
{
  "success": true,
  "message": "Force failover initiated successfully",
  "environmentId": "...",
  "operation": { /* Microsoft API response */ }
}
```

## Microsoft API Reference

**Documentation:** https://learn.microsoft.com/en-us/rest/api/power-platform/environmentmanagement/failover/perform-force-failover

**API Details:**
- **URI:** `POST https://api.bap.microsoft.com/providers/Microsoft.BusinessAppPlatform/environments/{environmentId}/performForceFailover?api-version=2021-04-01`
- **Authentication:** Bearer token with Power Platform permissions
- **Scope:** `https://api.powerplatform.com/.default`
- **Description:** Triggers a force failover to the secondary region for geo-redundant environments

## User Experience Flow

1. **Navigation:** User opens Power Platform environment details
2. **Tab Selection:** User selects "Governance & Protection" tab
3. **Action:** User clicks "Force Failover" button
4. **Confirmation:** Browser confirmation dialog appears with comprehensive warnings
5. **Operation:** If confirmed:
   - Button shows loading spinner
   - Loading message appears: "Initiating force failover..."
   - API call made to Microsoft endpoint
6. **Result:**
   - **Success:** Green success message appears for 15 seconds
   - **Error:** Red error message appears with specific error details
7. **Feedback:** Alert dialog informs user of final outcome

## Safety Features

### Multiple Confirmation Layers
1. UI warning text with red border and emoji
2. Browser confirmation dialog before operation
3. Explicit "Disaster Recovery Only" labeling
4. Clear description of disruption and data loss risks

### State Protection
- Button disabled during operation (prevents double-clicks)
- Loading state prevents multiple simultaneous operations
- Per-environment state tracking (multiple envs can operate independently)

### Error Recovery
- Comprehensive error messages guide user to resolution
- Rate limiting detection and user notification
- Permission errors clearly communicated
- Unexpected errors logged server-side with details

## Testing Checklist

- [x] UI button renders correctly in Governance & Protection tab
- [x] Warning text is prominent and clear
- [x] Confirmation dialog appears with disaster recovery warnings
- [x] Loading state displays during operation
- [x] Error handling for various failure scenarios
- [x] Success messaging appears and auto-clears after 15 seconds
- [x] API route validates session and environment ID
- [x] Token acquisition follows established OBO pattern
- [x] Microsoft API integration follows documented endpoint
- [x] Response handling for 200, 400, 401, 403, 404, 429, 500 status codes
- [x] No TypeScript/ESLint errors

## Code Quality

- Follows established patterns from backup and environment state operations
- Consistent error handling approach
- Proper TypeScript/JSX structure
- Comprehensive inline documentation
- Defensive programming (null checks, try/catch)
- User-friendly error messages
- Loading state feedback
- Accessible UI (proper semantic HTML, ARIA labels via button text)

## Files Modified

1. **src/app/power-platform/environments/page.jsx**
   - Line 247: Added failoverOps state
   - Lines 1066-1115: Added handleForceFailover function
   - Lines ~3633-3685: Added Force Failover UI section

2. **src/app/api/power-platform/environments/[id]/failover/route.js** (NEW)
   - Complete API route implementation
   - Session validation
   - Token acquisition
   - Microsoft API integration
   - Error handling

## Dependencies

- NextAuth: Session management
- `@/lib/auth`: Auth configuration
- `@/lib/ppToken`: Power Platform token acquisition
- Microsoft Business Application Platform API
- React useState: State management
- Browser fetch API: HTTP requests

## Future Considerations

1. **Monitoring:** Consider adding Application Insights tracking for failover operations
2. **Audit Logging:** Log failover operations for compliance/auditing
3. **Permissions:** Validate user has specific Power Platform admin roles
4. **Rate Limiting:** Client-side rate limiting to prevent rapid repeated attempts
5. **Status Polling:** Poll environment status after failover to show recovery progress
6. **Rollback:** Potential future feature for failover rollback
7. **Multi-region:** Support for selecting specific target region

## Related Features

- Environment Backup (Create/View)
- Managed Environment Controls (Enable/Disable)
- Environment State Controls (Enable/Disable)
- Environment Governance Configuration

## References

- [Microsoft Force Failover API Documentation](https://learn.microsoft.com/en-us/rest/api/power-platform/environmentmanagement/failover/perform-force-failover)
- [Power Platform Environment Management](https://learn.microsoft.com/en-us/power-platform/admin/environments-overview)
- [Business Continuity and Disaster Recovery](https://learn.microsoft.com/en-us/power-platform/admin/business-continuity-disaster-recovery)

---

**Implementation Complete:** February 2025  
**Feature Status:** Production Ready ✅
