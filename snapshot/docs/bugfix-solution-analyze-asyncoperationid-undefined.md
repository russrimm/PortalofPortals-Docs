# Bug Fix: Solution Analysis - AsyncOperationId & AI Endpoint Issues

## Problems

### Problem 1: AsyncOperationId Undefined
The solution analysis feature was failing with 400 Bad Request errors when trying to poll for async operation status. The logs showed:
```
[Solution Analyze] Export initiated, operation ID: undefined
[Solution Analyze] Status check failed: 400 Bad Request (attempt 1)
```

### Problem 2: AI API 404 Error
After fixing the export issue, the AI analysis step was failing with:
```
[Solution Analyze] AI API error: {"error":{"code":"404","message": "Resource not found"}}
POST /api/power-platform/solutions/analyze 404 in 22.1s
```

## Root Causes

### Issue 1: Export Response Handling
The code assumed the Dataverse `ExportSolution` API always returns an `AsyncOperationId` for polling, but according to Microsoft's documentation, the API can operate in two modes:

1. **Synchronous Mode**: Returns the solution file directly in the response via the `ExportSolutionFile` field
2. **Asynchronous Mode**: Returns an `AsyncOperationId` for polling the export status

The original implementation only handled the asynchronous mode, causing it to fail when the API returned the file synchronously.

### Issue 2: AI Endpoint URL Format
The code was using a generic `/chat/completions` endpoint format, which works for GitHub Models and OpenAI-compatible APIs, but Azure OpenAI Service requires a different URL format:

- **Azure OpenAI**: `https://{resource}.openai.azure.com/openai/deployments/{model}/chat/completions?api-version=2024-08-01-preview`
- **GitHub Models**: `https://models.inference.ai.azure.com/chat/completions`
- **OpenAI**: `https://api.openai.com/v1/chat/completions`

The environment was configured with an Azure Cognitive Services endpoint but the code wasn't building the correct Azure OpenAI URL format.

## Solutions Implemented

### Fix 1: Dual-Mode Export Handling
### Fix 1: Dual-Mode Export Handling
Refactored the export handling code to support both synchronous and asynchronous modes:

#### Key Changes

1. **Response Inspection**: Log the full export response to understand what fields are returned
2. **Synchronous Path**: If `ExportSolutionFile` is present, extract and use the solution file directly
3. **Asynchronous Path**: If `AsyncOperationId` is present, poll for completion as before
4. **Error Handling**: If neither field is present, return a clear error message

#### Code Structure

```javascript
const exportData = await exportRes.json()
console.log('[Solution Analyze] Export response:', JSON.stringify(exportData, null, 2))

let solutionBuffer, solutionSize, filename

if (exportData.ExportSolutionFile) {
  // Synchronous mode - solution returned immediately
  console.log('[Solution Analyze] Solution export returned directly (synchronous mode)')
  solutionBuffer = Buffer.from(exportData.ExportSolutionFile, 'base64')
  solutionSize = solutionBuffer.length
  filename = `${solutionName}${managed ? '_managed' : ''}.zip`
} else {
  // Asynchronous mode - poll for completion
  const asyncOperationId = exportData.AsyncOperationId || exportData.asyncoperationid || exportData.operationid
  
  if (!asyncOperationId) {
    return NextResponse.json({
      success: false,
      error: 'Export response did not contain AsyncOperationId or solution file'
    }, { status: 500 })
  }
  
  // Poll and download logic...
}

// Continue with AI analysis using solutionBuffer
```

### Fix 2: Azure OpenAI URL Format Support

Added intelligent endpoint URL building that detects the AI provider and constructs the appropriate URL format:

#### Key Changes

1. **Endpoint Detection**: Detect if using Azure OpenAI, GitHub Models, or other providers
2. **Azure OpenAI URL**: Build the correct deployment-based URL with API version
3. **Request Body**: Only include `model` parameter for non-Azure endpoints (Azure uses deployment name in URL)
4. **Dual Authentication**: Support both `Authorization: Bearer` and `api-key` headers for Azure compatibility

#### Code Structure

```javascript
// Build the correct AI endpoint URL
let aiUrl
if (aiEndpoint.includes('openai.azure.com') || aiEndpoint.includes('cognitiveservices.azure.com')) {
  // Azure OpenAI format
  const apiVersion = '2024-08-01-preview'
  if (aiEndpoint.includes('/chat/completions')) {
    aiUrl = aiEndpoint
  } else {
    aiUrl = `${aiEndpoint}/openai/deployments/${modelName}/chat/completions?api-version=${apiVersion}`
  }
} else {
  // GitHub Models or OpenAI-compatible format
  aiUrl = `${aiEndpoint}/chat/completions`
}

// Only include model for non-Azure endpoints
const aiRequestBody = {
  messages: [...],
  max_tokens: 2000,
  temperature: 0.7
}

if (!aiUrl.includes('openai.azure.com') && !aiUrl.includes('cognitiveservices.azure.com')) {
  aiRequestBody.model = modelName
}

// Support both authentication methods
const aiResponse = await fetch(aiUrl, {
  headers: {
    'Authorization': `Bearer ${aiApiKey}`,
    'api-key': aiApiKey  // Azure OpenAI also accepts api-key header
  },
  body: JSON.stringify(aiRequestBody)
})
```

## Files Modified
- `src/app/api/power-platform/solutions/analyze/route.js`
  - Added synchronous export handling
  - Added response logging for debugging
  - Added Azure OpenAI URL format support
  - Added intelligent endpoint detection
  - Improved error messages
  - Unified solution file handling for both paths
  - Added dual authentication header support

## Environment Configuration

The fix now supports multiple AI provider configurations:

### Azure OpenAI Service
```env
AI_ENDPOINT=https://{resource}.cognitiveservices.azure.com
AI_API_KEY={your-azure-api-key}
AI_MODEL={deployment-name}  # e.g., o4-mini, gpt-4o, gpt-35-turbo
```

### GitHub Models
```env
AI_ENDPOINT=https://models.inference.ai.azure.com
AI_API_KEY={your-github-token}
AI_MODEL=gpt-4o  # or other supported models
```

### OpenAI
```env
AI_ENDPOINT=https://api.openai.com/v1
AI_API_KEY={your-openai-api-key}
AI_MODEL=gpt-4o  # or gpt-4, gpt-3.5-turbo, etc.
```

## Testing
To verify both fixes:

### Test 1: Small Solution Export (Synchronous Mode)
**Expected Logs:**
```
[Solution Analyze] Export response: {"ExportSolutionFile":"...base64..."}
[Solution Analyze] Solution export returned directly (synchronous mode)
[Solution Analyze] Downloaded solution: MySolution.zip (0.5 MB)
[Solution Analyze] Step 4: Analyzing solution with AI...
[Solution Analyze] AI endpoint: https://messagecenterai.cognitiveservices.azure.com/openai/deployments/o4-mini/chat/completions?api-version=2024-08-01-preview
[Solution Analyze] Model: o4-mini
[Solution Analyze] Calling AI API...
[Solution Analyze] Analysis complete. Tokens used: 1234
```

### Test 2: Large Solution Export (Asynchronous Mode)
**Expected Logs:**
```
[Solution Analyze] Export response: {"AsyncOperationId":"..."}
[Solution Analyze] Export initiated in async mode, operation ID: ...
[Solution Analyze] Step 2: Polling for export completion...
[Solution Analyze] Export in progress... (30 seconds elapsed, status: 20)
[Solution Analyze] Export completed successfully after 120 seconds
[Solution Analyze] Step 3: Downloading solution file...
[Solution Analyze] Downloaded solution: MySolution.zip (15.2 MB)
[Solution Analyze] Step 4: Analyzing solution with AI...
[Solution Analyze] AI endpoint: https://messagecenterai.cognitiveservices.azure.com/openai/deployments/o4-mini/chat/completions?api-version=2024-08-01-preview
[Solution Analyze] Model: o4-mini
[Solution Analyze] Calling AI API...
[Solution Analyze] Analysis complete. Tokens used: 1856
```

### Test 3: GitHub Models Provider
**Configuration:**
```env
AI_ENDPOINT=https://models.inference.ai.azure.com
AI_MODEL=gpt-4o
```

**Expected Logs:**
```
[Solution Analyze] AI endpoint: https://models.inference.ai.azure.com/chat/completions
[Solution Analyze] Model: gpt-4o
[Solution Analyze] Calling AI API...
```

## Related Documentation
- Microsoft Dataverse ExportSolution API: https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/reference/exportsolution
- ExportSolutionResponse ComplexType: https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/reference/exportsolutionresponse
- Async Operations: https://learn.microsoft.com/en-us/power-apps/developer/data-platform/asynchronous-service
- Azure OpenAI REST API: https://learn.microsoft.com/en-us/azure/ai-services/openai/reference
- GitHub Models: https://github.com/marketplace/models

## Impact
- ✅ Fixes 400 Bad Request errors during solution export
- ✅ Fixes 404 Not Found errors during AI analysis
- ✅ Supports both synchronous and asynchronous export modes
- ✅ Supports Azure OpenAI, GitHub Models, and OpenAI providers
- ✅ Improves debugging with detailed response and endpoint logging
- ✅ No changes required to frontend code
- ✅ Backwards compatible with existing functionality
- ✅ Automatically detects and adapts to different AI providers

## Deployment
No special deployment steps required. The fixes are backwards compatible and will automatically:
- Handle both export modes based on API response
- Detect and use the correct AI provider URL format
- Support multiple authentication methods

## Summary
This comprehensive fix resolves two critical issues in the solution analysis pipeline:

1. **Export Handling**: Now supports both synchronous (immediate file return) and asynchronous (polling) export modes from the Dataverse API
2. **AI Integration**: Properly constructs endpoint URLs for Azure OpenAI Service, GitHub Models, and OpenAI, ensuring 404 errors are eliminated

The implementation is provider-agnostic and will work with any OpenAI-compatible API by automatically detecting the endpoint format and adjusting the request accordingly.
