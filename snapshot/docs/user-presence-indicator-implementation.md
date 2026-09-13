# User Presence Indicator - Implementation Summary

## Overview
Added real-time presence indicators (colored circles) to the expanded user details in the Users table. Presence data is fetched from Microsoft Graph API and displays the user's current availability status with appropriate color coding.

## Implementation Date
2025-02-01

## Components Added/Modified

### 1. API Endpoint
**File**: `c:\repos\PortalofPortals\src\app\api\graph\presence\route.js` (NEW)

**Purpose**: Fetch user presence information from Microsoft Graph API

**Endpoint**: `GET /api/graph/presence?userId={userId}`

**Response**:
```json
{
  "id": "user-id",
  "availability": "Available",
  "activity": "Available"
}
```

**Presence States Supported**:
- `Available` - User is available
- `AvailableIdle` - User is available but idle
- `Away` - User is away
- `BeRightBack` - User will be right back
- `Busy` - User is busy
- `BusyIdle` - User is busy but idle
- `DoNotDisturb` - User is in do not disturb mode
- `Offline` - User is offline
- `PresenceUnknown` - Presence cannot be determined

**Error Handling**:
- Returns 404 if user not found or presence not available
- Returns 403 if insufficient permissions
- Returns generic error for other failures
- Defaults to `PresenceUnknown` on errors

**Required Permissions**:
- `Presence.Read` - Read user's presence information
- `Presence.Read.All` - Read all users' presence information (for admin scenarios)

### 2. Frontend Changes
**File**: `c:\repos\PortalofPortals\src\app\users\UsersTable.jsx` (MODIFIED)

**State Management**:
```javascript
const [presenceData, setPresenceData] = useState({})
const [presenceLoading, setPresenceLoading] = useState({})
```

**Helper Functions Added**:

#### `getPresenceColor(availability)`
Maps presence availability to Tailwind CSS color classes:
- `Available` → `bg-green-500` (bright green)
- `AvailableIdle` → `bg-green-400` (lighter green)
- `Away` → `bg-yellow-500` (yellow)
- `BeRightBack` → `bg-yellow-500` (yellow)
- `Busy` → `bg-red-500` (red)
- `BusyIdle` → `bg-red-400` (lighter red)
- `DoNotDisturb` → `bg-red-600` (dark red)
- `Offline` → `bg-gray-400` (gray)
- `PresenceUnknown` → `bg-gray-300` (light gray)

#### `getPresenceLabel(availability)`
Converts API availability values to user-friendly labels:
- `available` → "Available"
- `availableidle` → "Available (Idle)"
- `away` → "Away"
- `berightback` → "Be Right Back"
- `busy` → "Busy"
- `busyidle` → "Busy (Idle)"
- `donotdisturb` → "Do Not Disturb"
- `offline` → "Offline"
- `presenceunknown` → "Unknown"

**UI Component**:
Presence indicator is displayed in the expanded user details header:
```jsx
<div className="flex items-center gap-2 px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full">
  <div className={`w-3 h-3 rounded-full ${getPresenceColor(availability)}`} />
  <span className="text-xs font-medium">{getPresenceLabel(availability)}</span>
</div>
```

### 3. Data Flow
1. User clicks on a row to expand user details
2. `handleExpand()` triggers three parallel API calls:
   - User details (existing)
   - User registration details (existing)
   - **User presence** (NEW)
3. Presence data is fetched from `/api/graph/presence?userId={id}`
4. On success, presence is stored in `presenceData` state
5. Colored circle and label are rendered next to "User Details" header
6. Presence updates on each expansion (not cached across expansions)

## Visual Design

### Presence Indicator
- **Shape**: Circular dot (12px diameter)
- **Position**: Next to "User Details" header in expanded row
- **Container**: Pill-shaped background (gray-100/gray-800)
- **Colors**: See `getPresenceColor()` mapping above
- **Label**: Displays human-readable status text
- **Tooltip**: Shows both availability and activity on hover

### Dark Mode Support
- Light mode: `bg-gray-100` container
- Dark mode: `bg-gray-800` container
- All presence colors work in both themes

## Error Handling

### API Errors
- **No permissions**: Silently fails, no indicator shown
- **User not found**: No indicator shown
- **Network error**: Logged to console, no visual error shown
- **Unknown error**: Gracefully ignored (presence is optional)

### Loading State
- Shows "Loading presence..." text while fetching
- Replaced with indicator once loaded
- Does not block user details display

## Performance Considerations

### Caching Strategy
- Presence is NOT cached between expansions (intentional)
- Fresh presence is fetched each time user expands details
- Prevents showing stale presence data

### Request Optimization
- Presence fetched in parallel with other user data
- Non-blocking (won't delay user details display)
- Failure doesn't affect other data loading

### Timing
- Presence API typically responds in 200-500ms
- Multiple expansions trigger independent requests
- No request deduplication (each expansion is fresh data)

## Configuration Required

### Microsoft Graph Permissions
Add to Azure AD app registration:
1. Navigate to Azure Portal → App Registrations
2. Select your app
3. API Permissions → Add permission
4. Microsoft Graph → Delegated permissions
5. Add `Presence.Read.All` or `Presence.Read`
6. Admin consent required for `Presence.Read.All`

### Environment Variables
No new environment variables required. Uses existing NextAuth token.

## Testing Checklist

### Happy Path
- [ ] Expand user row
- [ ] See colored presence circle appear after 1-2 seconds
- [ ] Verify color matches user's actual Teams status
- [ ] Hover over circle to see tooltip with activity
- [ ] Collapse and re-expand - presence should refresh

### Presence States
Test with users in different states:
- [ ] Available (green)
- [ ] Busy (red)
- [ ] Away (yellow)
- [ ] Do Not Disturb (dark red)
- [ ] Offline (gray)

### Error Scenarios
- [ ] User without Teams license (should show unknown/gray)
- [ ] API permissions missing (silently fails, no indicator)
- [ ] Network offline (no indicator, no error shown)

### UI/UX
- [ ] Dark mode: Indicator readable and properly styled
- [ ] Mobile: Indicator fits in expanded row
- [ ] Multiple users: Each shows independent presence
- [ ] Fast clicks: No race conditions or incorrect presence

## Known Limitations

1. **No Real-Time Updates**: Presence doesn't auto-refresh
   - User must collapse/expand to see updated presence
   - Future enhancement: Add polling or SignalR for real-time updates

2. **Teams License Required**: Users without Teams show "Unknown"
   - This is expected behavior per Microsoft Graph API

3. **Permissions**: Requires `Presence.Read.All` for all users
   - Individual users can only read their own presence with `Presence.Read`

4. **Caching**: No caching between expansions
   - Deliberate choice to show fresh data
   - Future enhancement: Add 30-second cache with auto-refresh

5. **Activity Detail**: Only availability is color-coded
   - Activity text (e.g., "In a meeting") shown in tooltip
   - Future enhancement: Show activity as subtitle

## Future Enhancements

### Short-term
1. Add tooltip with last update time
2. Show activity as subtitle (e.g., "Busy - In a meeting")
3. Add presence to collapsed row (small dot next to name)
4. Cache presence for 30 seconds

### Long-term
1. Real-time presence updates via SignalR
2. Bulk presence API for all visible users (single request)
3. Presence history/timeline
4. Custom presence message display
5. Presence-based filtering (show only available users)

## Files Changed
- `c:\repos\PortalofPortals\src\app\api\graph\presence\route.js` (NEW - 67 lines)
- `c:\repos\PortalofPortals\src\app\users\UsersTable.jsx` (MODIFIED - +65 lines)

## References
- [Microsoft Graph Presence API](https://learn.microsoft.com/en-us/graph/api/presence-get?view=graph-rest-1.0&tabs=http)
- [Presence Resource Type](https://learn.microsoft.com/en-us/graph/api/resources/presence)
- [Presence Permissions](https://learn.microsoft.com/en-us/graph/permissions-reference#presence-permissions)

## Build Status
✅ No TypeScript errors
✅ No ESLint warnings
✅ Ready for testing

## Success Criteria
- [x] Presence API endpoint created
- [x] Colored circles displayed correctly
- [x] All 9 presence states supported
- [x] Dark mode compatible
- [x] Error handling implemented
- [ ] Tested with real Teams users
- [ ] Permissions granted in Azure AD
- [ ] Verified across different browsers

---

**Next Steps**: Grant `Presence.Read.All` permission in Azure AD app registration and test with users in different presence states!
