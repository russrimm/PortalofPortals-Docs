# Copilot Studio Agent YAML Display and Quarantine Implementation

**Date**: February 2025  
**Status**: ✅ Complete  
**Feature**: Display YAML from Copilot Studio agents and add quarantine/unquarantine functionality

## Overview

This implementation adds two key features to the Power Platform Environments page:
1. **YAML Display**: Shows the YAML content and adaptive cards from Copilot Studio agent components
2. **Quarantine Management**: Allows admins to quarantine or unquarantine agents directly from the UI

## Architecture

### Data Flow

```
User clicks Agent badge
    ↓
Fetch bots from Dataverse API
    ↓
For each bot, fetch bot components (includes YAML content)
    ↓
Display in BotsModal with:
    - YAML/JSON content rendering
    - Adaptive card preview
    - Quarantine status badge
    - Quarantine/Unquarantine buttons
```

### API Endpoints

#### 1. Bot Components Fetching
**File**: `src/app/api/power-platform/dataverse/bots/route.js`

Enhanced the existing endpoint to fetch bot components for each bot:

```javascript
// After fetching bots, fetch components for each
for (const bot of json.value) {
  if (bot.botid) {
    const componentUrl = `${base}/api/data/v9.2/botcomponents?$select=...&$filter=_parentbotid_value eq ${bot.botid}`;
    const compRes = await fetch(componentUrl, { headers: {...} });
    bot.components = compData.value || [];
  }
}
```

**Fields Fetched**:
- `botcomponentid` - Component ID
- `name` - Component name
- `componenttype` - Type of component
- `category` - Component category
- `language` - Language code
- `description` - Component description
- **`content`** - YAML/JSON content (KEY for display)
- **`data`** - Additional data (KEY for display)

#### 2. Quarantine Status Check
**File**: `src/app/api/power-platform/bots/quarantine-status/route.ts` (NEW)

```typescript
GET /api/power-platform/bots/quarantine-status?botId={botId}&environmentId={environmentId}

Response: { isQuarantined: boolean }
```

**Power Platform API Called**:
```
GET https://api.powerplatform.com/copilotstudio/environments/{environmentId}/bots/{botId}/api/botQuarantine?api-version=2024-10-01
```

A `404 BotNotFound` from this endpoint is expected rather than exceptional: the
Dataverse `bots` table also holds rows Copilot Studio does not manage, and the
agents modal probes every row when it opens. The route answers those with
`{ isQuarantined: false, quarantineStatusUnavailable: true }` and logs at debug.

#### 3. Quarantine Action
**File**: `src/app/api/power-platform/bots/quarantine/route.ts` (NEW)

```typescript
POST /api/power-platform/bots/quarantine
Body: { botId: string, environmentId: string, quarantine: boolean }

Response: 204 No Content or { success: true }
```

**Power Platform APIs Called**:
- **Quarantine**: `POST .../bots/{botId}/api/botQuarantine/SetAsQuarantined?api-version=2024-10-01`
- **Unquarantine**: `POST .../bots/{botId}/api/botQuarantine/SetAsUnquarantined?api-version=2024-10-01`

## UI Components

### BotsModal Component
**File**: `src/app/power-platform/environments/modals/BotsModal.tsx`

#### New Props
```typescript
interface BotsModalProps {
  isOpen: boolean
  onClose: () => void
  bots: Bot[]
  title: string
  error: string | null
  environmentId?: string  // NEW
}
```

#### New State
```typescript
const [quarantineStatuses, setQuarantineStatuses] = useState<Record<string, { isQuarantined: boolean, loading: boolean }>>({})
const [quarantineActionLoading, setQuarantineActionLoading] = useState<string | null>(null)
const [quarantineError, setQuarantineError] = useState<string | null>(null)
const [quarantineSuccess, setQuarantineSuccess] = useState<string | null>(null)
```

#### New useEffect Hook
Automatically fetches quarantine status when a bot is expanded:

```typescript
React.useEffect(() => {
  if (!selectedBotId || !environmentId) return
  if (quarantineStatuses[selectedBotId] !== undefined) return
  
  // Fetch quarantine status from API
  fetchStatus()
}, [selectedBotId, environmentId])
```

#### Quarantine UI Section
Added after basic bot information:

```tsx
{/* Quarantine Status and Actions */}
{environmentId && b.botid && (
  <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <h4>Quarantine Status</h4>
        <span className={status badge}>
          {isQuarantined ? '🚫 Quarantined' : '✅ Active'}
        </span>
      </div>
      <button onClick={handleQuarantineAction}>
        {isQuarantined ? 'Unquarantine Agent' : 'Quarantine Agent'}
      </button>
    </div>
  </div>
)}
```

**Features**:
- Status badge (red for quarantined, green for active)
- Loading spinner while fetching status
- Action button with confirmation dialog
- Success/error message display
- Disabled state during API call

### Parent Page Updates
**File**: `src/app/power-platform/environments/page.jsx`

#### Modal State Update
```javascript
setBotsModal({ 
  open: true, 
  items: sorted, 
  title: 'Copilot Studio Agents', 
  error: null,
  environmentId: envId  // NEW
})
```

#### Modal Component Props
```jsx
<BotsModal
  isOpen={botsModal.open}
  onClose={() => setBotsModal({ 
    open: false, 
    items: [], 
    title: '', 
    error: null, 
    environmentId: undefined 
  })}
  bots={botsModal.items}
  title={botsModal.title}
  error={botsModal.error}
  environmentId={botsModal.environmentId}  // NEW
/>
```

## YAML Display Features

The existing UI already supported YAML/JSON display and adaptive card rendering. With the bot components now being fetched, these features are automatically enabled:

### Component Rendering
**Location**: Lines 620-660 in BotsModal.tsx

For each component:
1. **Adaptive Card Preview**: Parses YAML/JSON and renders card visually
2. **Raw Definition**: Collapsible section showing raw YAML/JSON content
3. **Component Metadata**: Name, type, category, language

### Adaptive Card Parser
**Function**: `parseYAMLForAdaptiveCards()`  
**Location**: Lines 175-200 in BotsModal.tsx

Parses bot component `content` and `data` fields to extract adaptive card definitions:
- Handles YAML format
- Handles JSON format
- Handles multiple cards in array format

### Adaptive Card Renderer
**Component**: `AdaptiveCardRenderer`  
**Location**: Lines 55-160 in BotsModal.tsx

Renders the following card elements:
- `TextBlock` - Text with size, weight, color styling
- `Image` - Images with size options
- `FactSet` - Key-value tables
- `ActionSet` - Button groups
- `Container` - Nested containers

## Security & Permissions

### Required Permissions

#### Dataverse API (Bot Components)
- **Entity**: `botcomponents`
- **Permission**: Read
- **Role**: System Administrator or custom role with bot table access

#### Power Platform API (Quarantine)
- **Scope**: `https://api.powerplatform.com/.default`
- **Authentication**: Delegated (On-Behalf-Of flow)
- **Permissions**: Copilot Studio management permissions

### User Confirmation
All quarantine actions require explicit user confirmation:

```javascript
const confirmed = window.confirm(
  `Are you sure you want to ${action} this agent? This action will ${quarantine ? 'disable' : 'enable'} the agent.`
)
```

## Error Handling

### API Errors
```typescript
try {
  // API call
} catch (err) {
  console.error('[Quarantine] Error:', err)
  setQuarantineError(`Failed to ${action} agent: ${err.message}`)
}
```

### User Feedback
- ✅ **Success**: Green banner with "Agent quarantined/unquarantined successfully" (auto-dismisses after 3s)
- ❌ **Error**: Red banner with error message (persists until dismissed or new action)
- ⏳ **Loading**: Spinner in button with "Processing..." text
- 🔄 **Status Loading**: "Loading..." text next to status badge

### Fallback Behavior
- If `environmentId` is missing, quarantine section is not displayed
- If status fetch fails, quarantine section shows but with default "Active" state
- If quarantine action fails, local state is NOT updated (server is source of truth)

## Testing Checklist

### YAML Display
- [x] Click agent badge from environment resources
- [x] Verify bot components section appears
- [x] Verify "View Raw Definition" shows YAML/JSON content
- [x] Verify adaptive cards render correctly
- [x] Test with multiple component types (dialog, topic, etc.)

### Quarantine Functionality
- [x] Expand a bot and verify quarantine status loads
- [x] Verify status badge shows correct state (active/quarantined)
- [x] Click "Quarantine Agent" and confirm action
- [x] Verify success message appears
- [x] Verify status badge updates to "🚫 Quarantined"
- [x] Click "Unquarantine Agent" and confirm
- [x] Verify status updates back to "✅ Active"
- [x] Test with missing environmentId (should hide section)
- [x] Test with API errors (should show error message)

### Edge Cases
- [x] Bot with no components (should show empty state)
- [x] Bot with invalid YAML in content (should handle gracefully)
- [x] Multiple bots expanded simultaneously (each has independent status)
- [x] Rapid clicks on quarantine button (should be disabled during processing)

## Known Limitations

1. **Batch Operations**: Quarantine actions are per-bot only (no bulk operations)
2. **Real-time Updates**: Status does not auto-refresh (requires re-expanding bot)
3. **Audit Trail**: Quarantine actions are not logged in the UI (only in backend)
4. **Permissions**: If user lacks permissions, API returns 403 but no specific UI guidance

## Future Enhancements

1. **Auto-refresh**: Poll for status changes every 30 seconds when bot is expanded
2. **Bulk Actions**: Add checkbox selection for multi-bot quarantine operations
3. **Audit Log**: Display recent quarantine actions in bot details
4. **Permissions Check**: Pre-flight check for quarantine permissions with helpful error messages
5. **Component Filtering**: Add search/filter for bot components by type or name
6. **YAML Editing**: Allow inline editing of component YAML (with validation)

## API References

### Power Platform Copilot Studio API
- **Base URL**: `https://api.powerplatform.com/copilotstudio`
- **API Version**: `2024-10-01`
- **Authentication**: Delegated via On-Behalf-Of (OBO) flow
- **Documentation**: [Microsoft Learn - Copilot Studio bot quarantine APIs](https://learn.microsoft.com/en-us/rest/api/power-platform/copilotstudio/bots/get-bot-quarantine-status)

### Dataverse Web API
- **Base URL**: `{instanceUrl}/api/data/v9.2`
- **Entity Sets**: `bots`, `botcomponents`
- **Authentication**: App-only via client credentials
- **Documentation**: [Microsoft Learn - Dataverse Web API](https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/overview)

## Files Modified

### New Files Created
1. `src/app/api/power-platform/bots/quarantine-status/route.ts` (96 lines)
2. `src/app/api/power-platform/bots/quarantine/route.ts` (103 lines)

### Files Modified
1. `src/app/api/power-platform/dataverse/bots/route.js`
   - Added bot components fetching loop
   - Includes error handling for component fetch failures

2. `src/app/power-platform/environments/modals/BotsModal.tsx`
   - Added environmentId prop
   - Added quarantine state management
   - Added useEffect for status fetching
   - Added quarantine UI section (65 lines)
   - Added handleQuarantineAction function

3. `src/app/power-platform/environments/page.jsx`
   - Updated botsModal state to include environmentId
   - Updated BotsModal component call to pass environmentId prop

## Deployment Notes

### Environment Variables
No new environment variables required. Existing variables are reused:
- `DATAVERSE_CLIENT_ID` / `AZURE_CLIENT_ID`
- `DATAVERSE_CLIENT_SECRET` / `AZURE_CLIENT_SECRET`
- `DATAVERSE_TENANT_ID` / `AZURE_TENANT_ID`

### Dependencies
No new npm packages required. Uses existing dependencies:
- `next` (16.x)
- `react` (19.x)
- `next-auth` (for authentication)
- `msal-node` (for OBO flow)

### Rollout Strategy
1. **Phase 1**: Deploy API routes only (test with Postman/curl)
2. **Phase 2**: Deploy UI changes (beta testing with admins)
3. **Phase 3**: Monitor logs for 403/404 errors (adjust permissions)
4. **Phase 4**: General availability

### Rollback Plan
If issues arise:
1. Remove environmentId prop from BotsModal calls
2. Comment out quarantine UI section in BotsModal.tsx
3. Keep API routes deployed (no side effects)

## Support

### Troubleshooting

**Issue**: Quarantine section not appearing  
**Cause**: Missing environmentId prop  
**Fix**: Verify environmentId is passed from parent page

**Issue**: "Failed to fetch quarantine status"  
**Cause**: Invalid API endpoint or missing permissions  
**Fix**: Check console for 403/404 errors, verify Copilot Studio permissions

**Issue**: YAML content not displaying  
**Cause**: Bot components not fetched or `content` field empty  
**Fix**: Check network tab for botcomponents API call, verify response includes content field

**Issue**: Adaptive cards not rendering  
**Cause**: Invalid YAML/JSON in content field  
**Fix**: Check browser console for parsing errors, verify content format

### Contact
For issues or questions, refer to:
- Power Platform documentation: https://learn.microsoft.com/power-platform
- Project repository issues tracker
- Internal support channel

---

**Implementation Status**: ✅ Complete and tested  
**Last Updated**: February 2025
