# Solution Analyze Timeout Handling Implementation

## Problem
Large Power Platform solutions (>10 MB) take 10+ minutes to export before AI analysis can begin. The solution can time out in the following ways:
1. **Backend timeout**: Azure Function 10-minute timeout
2. **Frontend timeout**: Browser or fetch API timeout
3. **User frustration**: No clear feedback on progress

## Solution Implemented

### 1. **Backend API Timeout Handling**
**File**: `src/app/api/power-platform/solutions/analyze/route.js`

- **Polling Duration**: Set to 10 minutes (120 attempts × 5 seconds = 600 seconds)
- **Graceful Timeout Response**: Returns HTTP 408 status with detailed error message
- **Error Details**: Includes timeout duration, last known status, and any error messages
- **Progress Logging**: Logs progress every 30 seconds for large exports

```javascript
const maxAttempts = 120 // 10 minutes (5 seconds per attempt)
if (!exportComplete) {
  const timeoutMessage = `Export timed out after ${maxAttempts * 5} seconds...`
  return NextResponse.json({
    success: false,
    error: timeoutMessage
  }, { status: 408 })
}
```

### 2. **Frontend Timeout Handling**
**File**: `src/app/power-platform/environments/page.jsx`

#### Extended Fetch Timeout
- **Client-side timeout**: 12 minutes (720 seconds)
- **Rationale**: Backend times out at 10 minutes, so client waits 2 minutes longer to receive the 408 response
- **AbortController**: Properly aborts the fetch request if timeout occurs

```javascript
const controller = new AbortController()
// Set timeout to 12 minutes (720 seconds) - backend times out at 10 minutes
const timeout = setTimeout(() => controller.abort(), 720000)

const analyzeRes = await fetch(analyzeUrl, {
  method: 'POST',
  signal: controller.signal,
  // ...
})
```

#### Enhanced Error Messages
- **408 Timeout**: Clear message about large solutions taking 10+ minutes
- **401 Unauthorized**: Suggests signing out and back in to refresh session
- **Other Errors**: Generic error handling with details
- **AbortError**: Specific message when client-side timeout occurs

```javascript
const errorMsg = e.name === 'AbortError' 
  ? 'Request timed out after 12 minutes. The solution may be too large to analyze. Try a smaller solution or contact support.'
  : e.message
```

#### State Management
- **Analyzing States**: Tracks progress with `status` (analyzing/complete/error) and `progress` (0-100%)
- **Error State**: Updates analyzing state with error message
- **Success State**: Updates analysis modal with results
- **Cleanup**: Clears analyzing state after 3 seconds on success

### 3. **Testing**
**File**: `tests/solution-analyze-timeout.spec.ts`

Added test cases to verify:
- Graceful handling of 408 timeout responses
- Display of specific error messages for different HTTP status codes
- Client-side 12-minute timeout configuration
- AbortError handling from fetch timeout

## Key Improvements

1. **User Experience**: Users now understand why analysis is taking time and get clear messages if it fails
2. **Reliability**: Proper timeout handling at both backend and frontend prevents silent failures
3. **Transparency**: Detailed error messages help users understand what went wrong
4. **Maintainability**: Clear logging throughout the process aids troubleshooting

## Configuration

No additional environment variables required. The implementation uses:
- Backend: 10-minute polling timeout
- Frontend: 12-minute fetch timeout
- Polling Interval: 5 seconds per check

## Testing the Implementation

To test timeout handling:

1. **Large Solution**: Try analyzing a solution >10 MB
2. **Monitor Logs**: Check console for progress messages every 30 seconds
3. **Timeout Scenario**: If export takes >10 minutes, you'll see a 408 error with detailed timeout message
4. **User Feedback**: The UI will show error state with actionable message

## Error Messages

| Scenario | Message |
|----------|---------|
| Timeout (408) | "Export timed out. Large solutions can take 10+ minutes to export. Please try again or contact support if the issue persists." |
| Unauthorized (401) | "Authorization failed. Please sign out and sign back in to refresh your session." |
| Client-side Timeout (AbortError) | "Request timed out after 12 minutes. The solution may be too large to analyze. Try a smaller solution or contact support." |
| Other Errors | Original error message with response status |

## Files Modified

1. `src/app/api/power-platform/solutions/analyze/route.js` - Backend timeout handling (already present, verified)
2. `src/app/power-platform/environments/page.jsx` - Frontend timeout handling and error messages
3. `tests/solution-analyze-timeout.spec.ts` - Test cases for timeout scenarios (new)
