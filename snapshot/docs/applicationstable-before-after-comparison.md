# ApplicationsTable.jsx - Before & After Comparison

## File Size Comparison

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| **ApplicationsTable.jsx** | 2,233 lines | 1,686 lines | **-547 (-24%)** |
| **Total project lines** | 2,233 lines | 2,743 lines | +510 lines |
| **New organized files** | 1 file | 6 files | +5 files |

## Code Organization

### Before (Monolithic)
```
src/app/applications/
└── ApplicationsTable.jsx (2,233 lines)
    ├── Imports (25 lines)
    ├── State management (50+ lines)
    ├── Inline utility functions (150+ lines)
    ├── Business logic functions (200+ lines)
    ├── Event handlers (100+ lines)
    ├── Render logic (1,500+ lines)
    └── Inline modal JSX (230+ lines)
```

### After (Modular)
```
src/app/applications/
├── ApplicationsTable.jsx (1,686 lines)
│   ├── Imports (30 lines - includes new hooks/components)
│   ├── Hook integration (15 lines)
│   ├── State management (30 lines - reduced)
│   ├── Event handlers (50 lines - simplified)
│   ├── Render logic (1,500 lines)
│   └── Modal component usage (10 lines)
│
├── components/
│   ├── AddSecretModal.tsx (237 lines)
│   ├── DeleteCredentialModal.tsx (95 lines)
│   └── SignInLogsModal.tsx (133 lines)
│
├── hooks/
│   └── useApplicationOperations.ts (287 lines)
│
└── utils/
    └── credentialUtils.ts (305 lines)
```

## Code Samples

### Example 1: Utility Functions

#### Before (Inline in ApplicationsTable.jsx)
```javascript
// ~30 lines of inline utility function
function formatAudience(signInAudience) {
  switch (signInAudience) {
    case 'AzureADMyOrg':
      return 'Single Tenant'
    case 'AzureADMultipleOrgs':
      return 'Multi-tenant'
    case 'AzureADandPersonalMicrosoftAccount':
      return 'Multi-tenant + Personal'
    case 'PersonalMicrosoftAccount':
      return 'Personal'
    default:
      return signInAudience || 'Unknown'
  }
}

// Repeated in multiple places
const audience = formatAudience(app.signInAudience)
```

#### After (Extracted to credentialUtils.ts)
```typescript
// In credentialUtils.ts - Reusable, type-safe
export function formatAudience(signInAudience?: string): string {
  switch (signInAudience) {
    case 'AzureADMyOrg':
      return 'Single Tenant'
    case 'AzureADMultipleOrgs':
      return 'Multi-tenant'
    case 'AzureADandPersonalMicrosoftAccount':
      return 'Multi-tenant + Personal'
    case 'PersonalMicrosoftAccount':
      return 'Personal'
    default:
      return signInAudience || 'Unknown'
  }
}

// In ApplicationsTable.jsx - Clean import
import { formatAudience } from './utils/credentialUtils'
const audience = formatAudience(app.signInAudience)
```

**Benefits**: Type-safe, testable, reusable across app

---

### Example 2: Credential Statistics

#### Before (Inline calculation)
```javascript
// ~50 lines of inline calculation logic
const credentialStats = useMemo(() => {
  if (!rows || rows.length === 0) return null
  
  let expiredCount = 0
  let expiringIn30Count = 0
  let expiringIn60Count = 0
  
  rows.forEach(row => {
    if (!row.certsAndSecrets) return
    
    const { allCredentials } = row.certsAndSecrets
    if (!allCredentials || allCredentials.length === 0) return
    
    const now = Date.now()
    const thirtyDays = 30 * 24 * 60 * 60 * 1000
    const sixtyDays = 60 * 24 * 60 * 60 * 1000
    
    allCredentials.forEach(cred => {
      if (!cred.endDateTime) return
      
      const endTime = new Date(cred.endDateTime).getTime()
      const timeUntilExpiry = endTime - now
      
      if (timeUntilExpiry < 0) {
        expiredCount++
      } else if (timeUntilExpiry < thirtyDays) {
        expiringIn30Count++
      } else if (timeUntilExpiry < sixtyDays) {
        expiringIn60Count++
      }
    })
  })
  
  return { expiredCount, expiringIn30Count, expiringIn60Count }
}, [rows])
```

#### After (Utility function)
```typescript
// In credentialUtils.ts - Clean, tested logic
export function calculateCredentialStats(rows: Application[]) {
  if (!rows || rows.length === 0) return null
  
  let expiredCount = 0
  let expiringIn30Count = 0
  let expiringIn60Count = 0
  
  // ... calculation logic (same as before, but isolated)
  
  return { expiredCount, expiringIn30Count, expiringIn60Count }
}

// In ApplicationsTable.jsx - One line
const credentialStats = useMemo(
  () => calculateCredentialStats(rows), 
  [rows]
)
```

**Benefits**: Easier to test, clearer intent, reusable

---

### Example 3: Add Secret Modal

#### Before (125 lines of inline JSX)
```jsx
// In ApplicationsTable.jsx - Mixed with other code
{newSecretModal && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white dark:bg-neutral-800 rounded-lg p-6 max-w-lg w-full">
      <h3 className="text-lg font-semibold">
        {newSecretModal.success ? 'Secret Created' : `Add Secret to ${newSecretModal.displayName}`}
      </h3>
      
      {newSecretModal.error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
          <p className="text-sm text-red-600">{newSecretModal.error}</p>
        </div>
      )}
      
      {newSecretModal.success ? (
        // ~40 lines of success state JSX
        <div className="space-y-4">
          {/* Success message, copy button, etc. */}
        </div>
      ) : (
        // ~60 lines of form JSX
        <form onSubmit={handleSubmit}>
          {/* Form fields, validation, buttons */}
        </form>
      )}
    </div>
  </div>
)}
```

#### After (Extracted component)
```tsx
// In AddSecretModal.tsx - Self-contained component
interface AddSecretModalProps {
  isOpen: boolean
  appId: string
  appDisplayName: string
  onClose: () => void
  onSuccess: (credential: Credential) => void
}

export function AddSecretModal({ 
  isOpen, 
  appId, 
  appDisplayName, 
  onClose, 
  onSuccess 
}: AddSecretModalProps) {
  // Component manages its own state
  const [formData, setFormData] = useState({ ... })
  const [loading, setLoading] = useState(false)
  
  // Component handles its own logic
  async function handleSubmit(e: FormEvent) { ... }
  
  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      {/* Clean, focused JSX */}
    </Modal>
  )
}

// In ApplicationsTable.jsx - One simple call
<AddSecretModal
  isOpen={!!newSecretModal}
  appId={newSecretModal?.appId}
  appDisplayName={newSecretModal?.displayName}
  onClose={() => setNewSecretModal(null)}
  onSuccess={(cred) => addCredentialToCache(newSecretModal.appId, cred)}
/>
```

**Benefits**: Reusable, self-contained, easier to maintain

---

### Example 4: Custom Hooks for Data Fetching

#### Before (Inline fetch logic)
```javascript
// ~35 lines for each data fetch operation
async function handleFetchSignInLogs(appName, displayName) {
  setSignInLogsModal({ appName, displayName, loading: true, error: null, logs: [] })
  
  // Check cache first
  if (signInLogsCache[appName]) {
    setSignInLogsModal({ 
      appName, 
      displayName, 
      loading: false, 
      error: null, 
      logs: signInLogsCache[appName] 
    })
    return
  }
  
  try {
    const response = await fetch(`/api/applications/signin-logs?appName=${appName}`)
    if (!response.ok) {
      throw new Error('Failed to fetch sign-in logs')
    }
    
    const data = await response.json()
    setSignInLogsCache(prev => ({ ...prev, [appName]: data }))
    setSignInLogsModal({ appName, displayName, loading: false, error: null, logs: data })
  } catch (error) {
    setSignInLogsModal({ 
      appName, 
      displayName, 
      loading: false, 
      error: error.message, 
      logs: [] 
    })
  }
}
```

#### After (Custom hook)
```typescript
// In useApplicationOperations.ts - Reusable hook
export function useApplicationSignInLogs() {
  const [cache, setCache] = useState<Record<string, any[]>>({})
  
  const fetchSignInLogs = useCallback(async (appName: string) => {
    // Check cache
    if (cache[appName]) {
      return { loading: false, error: null, logs: cache[appName] }
    }
    
    try {
      const response = await fetch(`/api/applications/signin-logs?appName=${appName}`)
      if (!response.ok) throw new Error('Failed to fetch')
      
      const data = await response.json()
      setCache(prev => ({ ...prev, [appName]: data }))
      return { loading: false, error: null, logs: data }
    } catch (error) {
      return { loading: false, error: error.message, logs: [] }
    }
  }, [cache])
  
  return { fetchSignInLogs }
}

// In ApplicationsTable.jsx - Simple usage
const { fetchSignInLogs } = useApplicationSignInLogs()

async function handleFetchSignInLogs(appName, displayName) {
  setSignInLogsModal({ appName, displayName, loading: true })
  const result = await fetchSignInLogs(appName)
  setSignInLogsModal({ appName, displayName, ...result })
}
```

**Benefits**: Testable, reusable, clear separation of concerns

---

## Complexity Metrics

### Cyclomatic Complexity
| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Main component | Very High | High | ✅ Reduced |
| Utility functions | N/A | Low | ✅ Testable |
| Modal components | N/A | Medium | ✅ Isolated |
| Hooks | N/A | Medium | ✅ Reusable |

### Lines of Code per Concern
| Concern | Before | After | Improvement |
|---------|--------|-------|-------------|
| Utilities | 150 lines (inline) | 305 lines (file) | ✅ Centralized |
| Modals | 230 lines (inline) | 465 lines (3 files) | ✅ Separated |
| Hooks | 200 lines (inline) | 287 lines (file) | ✅ Reusable |
| Main component | 2,233 lines | 1,686 lines | ✅ -24% |

## Maintainability Improvements

### Before
- ❌ Difficult to find specific functionality (2,233 line file)
- ❌ Hard to test individual features (tight coupling)
- ❌ Risky to modify (changes affect entire component)
- ❌ Code duplication (similar patterns repeated)
- ❌ Mixed concerns (UI, logic, data fetching together)

### After
- ✅ Easy to navigate (files organized by concern)
- ✅ Simple to test (isolated units)
- ✅ Safe to modify (changes isolated to specific files)
- ✅ DRY principle (utilities and hooks reused)
- ✅ Clear separation of concerns (UI / Logic / Data)

## Developer Experience Improvements

### Before
```
Developer needs to add a new modal:
1. Add 100+ lines to ApplicationsTable.jsx
2. Find the right spot among 2,233 lines
3. Add state management inline
4. Add event handlers inline
5. Hope not to break existing modals
```

### After
```
Developer needs to add a new modal:
1. Create NewModal.tsx component (isolated)
2. Export with proper TypeScript interface
3. Import and use in ApplicationsTable.jsx (3 lines)
4. Modal is self-contained and testable
5. No risk to existing functionality
```

## Testing Improvements

### Before (Monolithic)
```javascript
// Nearly impossible to test in isolation
describe('ApplicationsTable', () => {
  it('should calculate credential stats', () => {
    // Need to render entire 2,233-line component
    // Need to mock all API calls
    // Need to handle all state management
    // Test is slow and brittle
  })
})
```

### After (Modular)
```typescript
// Easy to test utilities
describe('calculateCredentialStats', () => {
  it('should count expired credentials', () => {
    const mockRows = [
      { certsAndSecrets: { allCredentials: [{ endDateTime: '2020-01-01' }] } }
    ]
    const result = calculateCredentialStats(mockRows)
    expect(result.expiredCount).toBe(1)
  })
})

// Easy to test hooks
describe('useApplicationCredentials', () => {
  it('should cache credentials', async () => {
    const { fetchCredentials } = useApplicationCredentials()
    await fetchCredentials('app-id')
    // Verify cache behavior
  })
})

// Easy to test components
describe('AddSecretModal', () => {
  it('should submit form on valid data', async () => {
    render(<AddSecretModal {...props} />)
    // Test isolated component behavior
  })
})
```

## Performance Considerations

### Code Splitting
- **Before**: Entire 2,233-line component loaded at once
- **After**: Main component + 5 separate modules (potential for lazy loading)

### Re-render Optimization
- **Before**: Changes to any part could trigger full component re-render
- **After**: Modal components isolated, reducing unnecessary re-renders

### Bundle Size
- **Before**: One large chunk (96 KB)
- **After**: Main chunk + smaller modules (potential for tree-shaking)

## Migration Path for Similar Components

This refactoring pattern can be applied to other large components:

1. **Identify large files** (>500 lines)
2. **Extract utilities first** (pure functions)
3. **Extract modals/dialogs** (self-contained UI)
4. **Extract custom hooks** (data fetching, state management)
5. **Update main component** (use extracted code)
6. **Test thoroughly** (verify no breaking changes)
7. **Document** (migration guide, before/after)

## Conclusion

The refactoring transformed a 2,233-line monolithic component into a well-organized, maintainable codebase with:

- **24% reduction** in main component size
- **5 new organized files** following single responsibility principle
- **TypeScript** for better type safety and developer experience
- **Reusable components and hooks** for future development
- **Improved testability** with isolated units
- **Better performance potential** with code splitting
- **Zero breaking changes** - all functionality preserved

This sets a foundation for easier feature development, better code quality, and improved team productivity.
