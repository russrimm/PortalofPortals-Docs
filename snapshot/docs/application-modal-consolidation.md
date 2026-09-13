# Application Management Modal Consolidation

**Date:** 2025-02-02  
**Component:** `/applications` page - ApplicationsTable.jsx  
**Objective:** Consolidate all application management features into a single tabbed modal interface

## Summary

This update consolidates the application registration management UI by moving **API Permissions** and **Secrets management** functionality into the main Edit Application modal using a clean tabbed interface. This improves UX by reducing clutter and providing a single entry point for all app management tasks.

## Changes Made

### 1. Enhanced Edit Modal Structure

**Before:**
- Simple modal with only basic app details (displayName, signInAudience, description, identifierUris)
- Separate standalone buttons for "API Permissions" and "+New Secret"
- Three different modals: Edit App, New Secret, API Permissions

**After:**
- **Tabbed modal** with three sections:
  - **Details Tab:** Basic app info (same as before)
  - **Secrets Tab:** View existing secrets/certificates + create new secrets
  - **Permissions Tab:** View all API permissions with grouped display
- Single "Manage App" button replaces previous "Edit App", "API Permissions", "+New Secret" buttons

### 2. Modal State Updates

```javascript
// Updated editModal state to include activeTab and appId
const [editModal, setEditModal] = useState(null) 
// Structure: {id, appId, displayName, signInAudience, description, identifierUris, loading, error, success, activeTab}
```

**activeTab values:**
- `'details'` - Application details form
- `'secrets'` - Secrets and certificates management
- `'permissions'` - API permissions view

### 3. Pre-Fetching Optimization

The `openEditModal()` function now pre-fetches:
- **API Permissions** (if not cached)
- **Credentials** (secrets and certificates, if not already loaded)

This ensures data is ready when the user switches to those tabs.

### 4. Secrets Tab Features

- **Display existing secrets** with status indicators:
  - Green: Active
  - Orange: Expiring soon (< 30 days)
  - Red: Expired
- **Display certificates** with same status logic
- **"+ New Secret" button** integrated into tab
- **Inline table view** of all credentials

### 5. Permissions Tab Features

- **Grouped display** by resource (e.g., Microsoft Graph, SharePoint)
- **Further grouped by namespace** (e.g., User, Mail, Calendar)
- **Type badges:**
  - Purple: Application permissions (Role)
  - Blue: Delegated permissions (Scope)
- **Full permission details:** Value, name, description

### 6. Removed Components

**Deleted:**
- Standalone `API Permissions Modal` (300+ lines) - functionality moved to Permissions tab
- "API Permissions" button from expanded row
- "+New Secret" button from expanded row (now in Secrets tab)

**Retained:**
- New Secret Modal (separate modal for creating secrets with success state and copy functionality)
- Sign-In Logs Modal (separate feature, not part of app management)

### 7. Button Changes in Expanded Row

**Before:**
```jsx
✏️ Edit App
📋 View Sign-In Logs
🔑 API Permissions
+ New Secret (inline, below Secrets table)
```

**After:**
```jsx
✏️ Manage App  (opens tabbed modal)
📋 View Sign-In Logs
```

**Simplified UI:** Only 2 buttons instead of 4 (3 buttons + inline New Secret)

## Benefits

### User Experience
1. **Single entry point** for all app management tasks
2. **Reduced cognitive load** - related features grouped logically
3. **Cleaner expanded row view** with fewer buttons
4. **Better mobile experience** - larger modal with organized tabs

### Performance
1. **Pre-fetching** ensures data is ready when switching tabs
2. **Caching** prevents redundant API calls
3. **Lazy loading** of credentials only when needed

### Maintainability
1. **Reduced code duplication** - single modal handles multiple features
2. **Consistent UI patterns** across all tabs
3. **Easier to extend** with new tabs in the future (e.g., Redirect URIs, Owners)

## Technical Details

### Tab Implementation

```jsx
{/* Tab Navigation */}
<div className="border-b border-gray-200 dark:border-neutral-700 mb-4">
  <div className="flex space-x-1">
    <button onClick={() => setEditModal(prev => ({ ...prev, activeTab: 'details' }))}>
      Details
    </button>
    <button onClick={() => setEditModal(prev => ({ ...prev, activeTab: 'secrets' }))}>
      Secrets & Certificates
    </button>
    <button onClick={() => setEditModal(prev => ({ ...prev, activeTab: 'permissions' }))}>
      API Permissions
    </button>
  </div>
</div>

{/* Conditional Tab Content */}
{editModal.activeTab === 'details' && <DetailsForm />}
{editModal.activeTab === 'secrets' && <SecretsView />}
{editModal.activeTab === 'permissions' && <PermissionsView />}
```

### Credential Loading Logic

```javascript
// Fetch credentials when modal opens if not already cached
if (!credentialDetails[app.id]) {
  fetch(`/api/applications/${app.id}/credentials`)
    .then(response => response.json())
    .then(data => setCredentialDetails(prev => ({ ...prev, [app.id]: data })))
    .catch(error => setCredentialErrors(prev => ({ ...prev, [app.id]: error.message })))
}
```

## Testing Checklist

- [x] Modal opens with Details tab active by default
- [x] Switching tabs preserves modal state
- [x] Secrets tab displays existing credentials correctly
- [x] "+ New Secret" button opens secret creation modal
- [x] Permissions tab shows grouped API permissions
- [x] Pre-fetching works for permissions and credentials
- [x] Mobile responsiveness maintained
- [x] Dark mode styling consistent across all tabs
- [x] Error states display properly in each tab
- [x] Loading states show appropriate spinners
- [x] "Manage App" button in expanded row opens modal
- [x] Closing modal clears state properly

## Future Enhancements

Potential additional tabs:
1. **Redirect URIs** - Manage authentication redirect URLs
2. **Owners** - Add/remove app owners
3. **Branding** - Logo, publisher info, terms of service URLs
4. **Authentication** - Token configuration, implicit grant settings
5. **Expose API** - Configure scopes for API protection

## Files Modified

- `src/app/applications/ApplicationsTable.jsx`
  - Lines ~740-790: Enhanced `openEditModal()` function
  - Lines ~1470-1850: Replaced edit modal JSX with tabbed version
  - Lines ~1200-1230: Updated expanded row buttons
  - Removed: Lines 2148-2450 (standalone API Permissions Modal)

## Dependencies

No new dependencies added. Uses existing:
- React hooks: `useState`, `useEffect`, `useCallback`, `useRef`, `useMemo`
- Tailwind CSS for styling
- Microsoft Graph API endpoints (no changes)
- NextAuth v5 session management (no changes)

## Performance Impact

**Positive:**
- Reduced DOM nodes (removed duplicate permission display code)
- Better caching strategy (pre-fetch on modal open)
- Fewer API calls due to improved cache usage

**Neutral:**
- Modal size increased (max-w-2xl → max-w-5xl) but only when open
- Tab switching is instant (client-side rendering)

## Migration Notes

**No breaking changes for users** - all functionality preserved, just reorganized.

**For developers:**
- `apiPermissionsModal` state still exists for backward compatibility (not removed)
- `handleFetchApiPermissions()` function unchanged
- API routes unchanged (`/api/applications/{id}/credentials`, `/api/applications/{id}/permissions`)

## Screenshots

### Before
```
[Expanded Row]
✏️ Edit App  📋 View Sign-In Logs  🔑 API Permissions

[Secrets Section]
+ New Secret

[Edit Modal - Simple]
- Display Name
- Sign-in Audience
- Description
- App ID URIs
[Update] [Cancel]
```

### After
```
[Expanded Row]
✏️ Manage App  📋 View Sign-In Logs

[Manage App Modal - Tabbed]
Details | Secrets & Certificates | API Permissions
─────────────────────────────────────────────────

[Active Tab Content Here]

[Close]
```

## Related Issues/PRs

- Initial request: User wanted cleaner layout with consolidated functionality
- Previous work: Edit modal implementation, API permissions display, secret creation
- Future work: Additional tabs for redirect URIs, owners, branding

---

**Implementation Status:** ✅ Complete  
**Testing Status:** ✅ Verified  
**Documentation Status:** ✅ Complete
