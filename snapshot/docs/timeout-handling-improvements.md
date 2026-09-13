# Timeout Handling Improvements for Solution Analysis

## Problem
The solution analysis API was experiencing `UND_ERR_HEADERS_TIMEOUT` errors when analyzing large Power Platform solutions. This meant the fetch request's headers were timing out before the AI could complete its analysis.

## Solution
Implemented comprehensive timeout handling improvements based on LLM API timeout best practices from [markaicode.com](https://markaicode.com/api-timeout-handling-llm-applications/).

## Key Improvements

### 1. Adaptive Timeout Calculation
Instead of a fixed 10-minute timeout, we now calculate timeout dynamically based on solution complexity:

```javascript
Base timeout: 2 minutes
+ 30 seconds per MB of solution size
+ 10 seconds per 1,000 files
+ 1 minute per 100 complex components (flows/apps)
Maximum: 15 minutes
```

**Example:**
- 5 MB solution with 2,000 files and 50 flows
- Timeout = 120s + (5 × 30s) + (2 × 10s) + (0.5 × 60s) = 120 + 150 + 20 + 30 = **320 seconds (5.3 minutes)**

### 2. Retry Logic with Exponential Backoff
Implemented smart retry mechanism:
- **Max retries:** 3 attempts
- **Base delay:** 2 seconds
- **Exponential backoff:** delay × 2^attempt
- **Jitter:** Random 0.5-1.0x multiplier to prevent thundering herd

**Retry delays:**
- Attempt 1: Immediate
- Attempt 2: 2-4 seconds
- Attempt 3: 4-8 seconds

### 3. Smart Retry Decision Making
Only retry on specific network/timeout errors:
- `UND_ERR_HEADERS_TIMEOUT` - Headers timeout (our original issue)
- `ETIMEDOUT` - Connection timeout
- `ECONNRESET` - Connection reset
- `ENOTFOUND` - DNS resolution failure
- `AbortError` - Fetch abort signal triggered
- `TimeoutError` - Generic timeout

Non-retryable errors (4xx client errors) fail immediately.

### 4. Enhanced Error Handling
Better error messages with actionable guidance:

**Timeout error response:**
```json
{
  "success": false,
  "error": "AI analysis timed out after 320 seconds. The solution may be too large or complex. Consider:\n• Analyzing smaller solutions\n• Reducing the number of components\n• Checking AI service availability",
  "details": {
    "timeout": 320000,
    "attempts": 3,
    "errorCode": "UND_ERR_HEADERS_TIMEOUT"
  }
}
```

### 5. Comprehensive Logging
Added detailed logging at each stage:
- Adaptive timeout calculation breakdown
- Retry attempt tracking
- Response time measurement
- Error code identification

**Example log output:**
```
[Solution Analyze] Adaptive timeout calculation:
  - Base: 120s
  - Size (5.2 MB): +150s
  - Files (2134): +20s
  - Complex components (48): +30s
  - Total timeout: 320s (5.3 minutes)
[Solution Analyze] Attempt 1/3: Calling AI API...
[Solution Analyze] AI API response received in 287456ms
```

## Implementation Details

### File: `src/app/api/power-platform/solutions/analyze/route.js`

**Before:**
```javascript
let aiResponse
try {
  aiResponse = await fetch(aiUrl, {
    // ...
    signal: AbortSignal.timeout(600000)  // Fixed 10 minutes
  })
} catch (fetchError) {
  // Simple error handling
}
```

**After:**
```javascript
const adaptiveTimeout = calculateAdaptiveTimeout(
  solutionSize, 
  totalFiles, 
  complexComponentCount
)

const maxRetries = 3
for (let attempt = 0; attempt < maxRetries; attempt++) {
  try {
    if (attempt > 0) {
      // Exponential backoff with jitter
      const delay = baseDelay * Math.pow(2, attempt) * (0.5 + Math.random() * 0.5)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
    
    aiResponse = await fetch(aiUrl, {
      // ...
      signal: AbortSignal.timeout(adaptiveTimeout)
    })
    
    break // Success
  } catch (fetchError) {
    // Smart retry logic
    if (isRetryable(fetchError) && attempt < maxRetries - 1) {
      continue // Retry
    }
    // Return detailed error
  }
}
```

## Benefits

1. **Reduced Timeout Failures**: Adaptive timeout matches solution complexity
2. **Improved Reliability**: Automatic retries handle transient network issues
3. **Better User Experience**: Clear error messages with actionable guidance
4. **Resource Efficiency**: Jitter prevents thundering herd on retries
5. **Better Monitoring**: Detailed logs help diagnose issues

## Testing Recommendations

1. **Small solution (< 1 MB, < 500 files)**
   - Expected timeout: ~2 minutes
   - Should complete quickly

2. **Medium solution (2-5 MB, 1000-2000 files)**
   - Expected timeout: 3-5 minutes
   - Test retry logic by simulating network issues

3. **Large solution (> 10 MB, > 5000 files)**
   - Expected timeout: 10-15 minutes
   - Verify timeout calculation is appropriate

4. **Failure scenarios**
   - Network interruption during request
   - AI service temporarily unavailable
   - Genuine timeout (solution too complex)

## Related Documentation
- [API Timeout Handling for LLM Applications](https://markaicode.com/api-timeout-handling-llm-applications/)
- [Error Handling Best Practices for Production LLM Applications](https://markaicode.com/llm-error-handling-production-guide/)

## Future Improvements
Consider implementing:
- Circuit breaker pattern for service health monitoring
- Request queuing for rate limiting
- Streaming responses for real-time feedback
- Fallback to cached/simplified analysis on timeout
