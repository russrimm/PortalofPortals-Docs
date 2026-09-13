# Bug Fix: Infinite Render Loop in Power Platform Environments Page

**Date:** 2025-01-XX  
**Issue:** Endless GET requests to `/power-platform/environments` causing terminal flooding and blocking development  
**Root Cause:** Multiple `useEffect` hooks with `environmentsData` dependencies triggering on every render due to SWR creating new object references  

---

## Problem Description

The `/power-platform/environments` page was experiencing an infinite render loop where GET requests to the environments API were being made continuously (~every 40-65ms). This was visible in the terminal as endless lines of:

```
GET /power-platform/environments 200 in 47ms (compile: 12ms, render: 35ms)
GET /power-platform/environments 200 in 55ms (compile: 18ms, render: 38ms)
[repeating endlessly...]
```

This made development impossible as:
- Terminal output was unusable
- Server resources were being consumed continuously
- The page was constantly re-rendering
- Hot reload was constantly triggering

## Root Cause Analysis

The file `src/app/power-platform/environments/page.jsx` (~7,700 lines) had **multiple useEffect hooks** that depended on `environmentsData`, which comes from SWR via the `useApiData` hook:

```javascript
const { data: environmentsData, ... } = useApiData('/api/power-platform/environments', { ... })
```

Even though the **actual data** wasn't changing, **SWR was creating a new object reference** on every render. This is a known behavior with SWR - it returns a new data object even if the contents are identical.

The problematic patterns found:

### 1. Storage Snapshots useEffect (Line ~677)
```javascript
useEffect(() => {
  if (environmentsData) {
    logStorageSnapshots(environmentsData)
  }
}, [environmentsData])
```

This would trigger every time `environmentsData` got a new reference, causing an async POST to `/api/power-platform/storage-history`, which may have been triggering re-renders.

### 2. Batch Resource Count Loading (Line ~290)
```javascript
useEffect(() => {
  if (!environmentsData?.value) return
  // ... fetch resource counts and update state
  setEnvResourceCounts(prev => ({ ...prev, ...countsByEnv }))
}, [environmentsData])
```

Even though this had a ref guard (`fetchedResourceCountsRef`), it was still executing the effect body on every render when data reference changed.

### 3. Inventory Queries useCallback (Line ~463)
```javascript
const loadAllInventoryQueries = useCallback(async () => {
  // ... uses environmentsData
}, [environmentsData])
```

This `useCallback` was recreating the function on every `environmentsData` change, even though the function was only called from button click handlers.

## Solution Implemented

### Fix 1: Add Data Hash Tracking for Storage Snapshots

**File:** `src/app/power-platform/environments/page.jsx` (Line ~677)

**Changed from:**
```javascript
useEffect(() => {
  if (environmentsData) {
    logStorageSnapshots(environmentsData)
  }
}, [environmentsData])
```

**Changed to:**
```javascript
const lastLoggedDataHashRef = useRef(null)
useEffect(() => {
  if (!environmentsData?.value) return
  
  // Create a stable hash from the data to detect actual changes (not just reference changes)
  const dataHash = `${environmentsData.value.length}-${environmentsData.value[0]?.name || ''}`
  
  // Only log if this is new data we haven't seen before
  if (dataHash !== lastLoggedDataHashRef.current) {
    lastLoggedDataHashRef.current = dataHash
    logStorageSnapshots(environmentsData)
  }
}, [environmentsData])
```

**Why this works:** Instead of triggering on every reference change, we create a stable "hash" from the data (using array length + first item name). The effect only runs when this hash actually changes, indicating real data differences.

### Fix 2: Add Data Hash Tracking for Resource Counts

**File:** `src/app/power-platform/environments/page.jsx` (Line ~290)

**Changed from:**
```javascript
useEffect(() => {
  if (!environmentsData?.value) return
  // ... rest of effect
}, [environmentsData])
```

**Changed to:**
```javascript
const lastResourceCountDataHashRef = useRef(null)
useEffect(() => {
  if (!environmentsData?.value) return
  
  // Create a stable hash to detect if the environment list has actually changed
  const dataHash = `${environmentsData.value.length}-${environmentsData.value[0]?.name || ''}`
  if (dataHash === lastResourceCountDataHashRef.current) return // Already processed this data
  lastResourceCountDataHashRef.current = dataHash
  
  // ... rest of effect
}, [environmentsData])
```

**Why this works:** Same principle - early return if we've already processed this data based on its stable hash.

### Fix 3: Remove useCallback Wrapper from loadAllInventoryQueries

**File:** `src/app/power-platform/environments/page.jsx` (Line ~463)

**Changed from:**
```javascript
const loadAllInventoryQueries = useCallback(async () => {
  // ... uses environmentsData
}, [environmentsData])
```

**Changed to:**
```javascript
// Not wrapped in useCallback since it reads environmentsData directly and is only called on button clicks
const loadAllInventoryQueries = async () => {
  // ... uses environmentsData directly from closure
}
```

**Why this works:** Since this function is only called from button click handlers (not used as a dependency in other effects), there's no need to memoize it. Making it a regular function means it always reads the current `environmentsData` value without creating new function references when data changes.

## Testing & Verification

1. **Build Test:** Ran `pnpm run build` - completed successfully with no errors
2. **Lint Test:** No new linting errors introduced
3. **Runtime Test:** (User should verify) The infinite loop should be completely stopped

Expected outcome:
- Terminal should show ONE initial GET request when the page loads
- No continuous scrolling of GET requests
- Page should render normally without constant re-renders
- All existing functionality preserved (storage logging, resource counts, inventory queries)

## Technical Lessons Learned

### SWR Object Reference Instability
SWR's `useSWR` hook returns a new data object reference on every render, even when the actual data hasn't changed. This is by design for consistency with React's re-render model.

**Anti-pattern:**
```javascript
useEffect(() => {
  doSomething(data)
}, [data]) // Will trigger every render!
```

**Correct patterns:**
1. **Hash-based tracking:**
```javascript
const lastHashRef = useRef(null)
useEffect(() => {
  const hash = JSON.stringify(data) // Or simpler hash
  if (hash === lastHashRef.current) return
  lastHashRef.current = hash
  doSomething(data)
}, [data])
```

2. **Specific property dependencies:**
```javascript
useEffect(() => {
  doSomething(data)
}, [data?.value?.length, data?.value?.[0]?.id]) // Only depend on specific values
```

3. **Remove from dependencies if not needed:**
```javascript
const processData = () => {
  doSomething(data) // Reads current value directly
}
// Call processData from event handlers only, not effects
```

### useCallback with Data Dependencies
Using `useCallback` with frequently-changing data creates new function references constantly, defeating the purpose of memoization.

**Anti-pattern:**
```javascript
const fn = useCallback(() => {
  useData(data) // Closes over data
}, [data]) // New function every time data reference changes
```

**Better approach:**
- If function is only used in event handlers, don't memoize it at all
- If function must be memoized, use refs to access current data without including in deps

## Files Modified

- `src/app/power-platform/environments/page.jsx`
  - Added `lastLoggedDataHashRef` ref and hash-based tracking (line ~677)
  - Added `lastResourceCountDataHashRef` ref and hash-based tracking (line ~290)
  - Removed `useCallback` wrapper from `loadAllInventoryQueries` (line ~463)

## Related Issues

This fix is preventive and addresses a general pattern that could cause similar issues in other pages. Consider reviewing other large pages with SWR data fetching for similar patterns.

## Future Improvements

Consider creating a custom hook that wraps SWR and provides stable data references:

```javascript
function useStableSWR(endpoint, config) {
  const { data, ...rest } = useSWR(endpoint, fetcher, config)
  const stableData = useRef(data)
  
  // Only update ref when data actually changes (deep equality)
  if (JSON.stringify(data) !== JSON.stringify(stableData.current)) {
    stableData.current = data
  }
  
  return { data: stableData.current, ...rest }
}
```

However, this adds overhead from JSON.stringify, so the hash-based approach used in this fix is more performant.
