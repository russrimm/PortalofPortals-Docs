# Power Automate Flow PDF Export with AI Analysis

## Overview
Export Power Automate flow documentation to PDF format with AI-powered step-by-step analysis. This feature combines flow metadata, triggers, actions, and intelligent analysis to create comprehensive flow documentation.

## Features

### PDF Export
- **One-Click Export**: Export flow documentation directly from the flow details modal
- **Comprehensive Documentation**: Includes flow name, status, type, triggers, actions, and timestamps
- **AI Analysis**: Powered by GitHub Models or Azure OpenAI (GPT-4o) for intelligent flow explanation
- **Professional Formatting**: Clean, readable PDF layout suitable for documentation and audits
- **Automatic Naming**: PDFs are named based on flow name and timestamp

### AI-Powered Analysis
The feature uses AI to analyze the complete flow definition and provides:
1. **Flow Purpose Summary**: High-level explanation of what the flow does
2. **Step-by-Step Breakdown**: Detailed walkthrough of each trigger and action
3. **Conditions & Loops**: Explanation of flow control logic
4. **Data Processing**: Description of data transformations and operations
5. **Expected Outcomes**: What the flow achieves when executed

## Implementation Details

### Frontend Component
**File**: `src/app/power-platform/flows/page.jsx`

**New Features**:
- Export button with DocumentArrowDownIcon in flow details modal header
- Loading state with spinner during PDF generation
- Error handling and user feedback
- `handleExportToPDF()` function that:
  1. Calls AI analysis API
  2. Generates PDF with jsPDF
  3. Formats flow information
  4. Saves PDF to user's device

**State Management**:
```javascript
const [pdfExporting, setPdfExporting] = useState(false)
const [pdfError, setPdfError] = useState(null)
```

**Dependencies Added**:
- `jspdf` (v2.x) - PDF generation library
- `html2canvas` (v1.x) - Canvas/screenshot support (future use)

### AI Analysis API
**File**: `src/app/api/power-platform/flows/analyze/route.js`

**Endpoint**: `POST /api/power-platform/flows/analyze`

**Request Body**:
```json
{
  "flowDefinition": { ... },
  "flowName": "Flow Name",
  "modelName": "gpt-4o"
}
```

**Response**:
```json
{
  "success": true,
  "analysis": "Step-by-step explanation...",
  "model": "gpt-4o",
  "usage": {
    "prompt_tokens": 500,
    "completion_tokens": 800,
    "total_tokens": 1300
  }
}
```

**Environment Variables Required**:
```env
# Option 1: GitHub Models (Free tier)
GITHUB_TOKEN=github_pat_xxxxxxxxxxxxx
AI_ENDPOINT=https://models.inference.ai.azure.com

# Option 2: Azure OpenAI
AI_API_KEY=your-azure-openai-key
AI_ENDPOINT=https://your-resource.openai.azure.com
```

## Configuration

### GitHub Models Setup (Recommended for Development)
1. Go to [GitHub Settings → Developer Settings → Personal Access Tokens](https://github.com/settings/tokens)
2. Create a new token (no specific permissions required)
3. Copy the token (starts with `github_pat_`)
4. Add to `.env.local`:
   ```env
   GITHUB_TOKEN=github_pat_xxxxxxxxxxxxx
   AI_ENDPOINT=https://models.inference.ai.azure.com
   ```

### Azure OpenAI Setup (Production)
1. Create an Azure OpenAI resource in Azure Portal
2. Deploy a GPT-4o model
3. Get the API key and endpoint from Azure Portal
4. Add to `.env.local`:
   ```env
   AI_API_KEY=your-azure-openai-key
   AI_ENDPOINT=https://your-resource.openai.azure.com
   ```

## Usage

### Exporting a Flow
1. Navigate to Power Platform > Flows
2. Select an environment
3. Click "View Details" on any flow
4. In the flow details modal, click the **Download Icon** (📥) in the header
5. Wait for AI analysis to complete (typically 5-15 seconds)
6. PDF will automatically download to your device

### PDF Contents
The exported PDF includes:

**Header Section**:
- Flow name (title)
- Generation timestamp
- Flow status (Published, Draft, Suspended)
- Flow type
- Description (if available)
- Created and modified dates

**Triggers Section**:
- Trigger name
- Trigger type and kind
- Schema (for Request/HTTP triggers)

**Actions Section**:
- Action name
- Action type
- Variable details (for Initialize Variable actions)

**AI Analysis Section**:
- Flow purpose summary
- Step-by-step breakdown
- Conditions and loops explanation
- Data processing details
- Expected outcomes
- Model attribution (powered by GPT-4o)

## Technical Notes

### AI Model Selection
- **Default Model**: GPT-4o (optimal balance of speed and quality)
- **Alternative Models**: Can be configured in the API route
- **Context Window**: Up to 2000 tokens for analysis output
- **Temperature**: 0.7 (balanced creativity vs. accuracy)

### Performance
- **AI Analysis**: 5-15 seconds depending on flow complexity
- **PDF Generation**: < 1 second
- **Total Export Time**: 6-20 seconds

### Error Handling
- API key validation
- AI API error handling with detailed messages
- Flow definition parsing fallbacks
- User-friendly error display in modal

### Rate Limiting
- GitHub Models: Free tier with rate limits
- Azure OpenAI: Based on your deployment quota
- Consider implementing client-side rate limiting for production

## Troubleshooting

### "AI API key not configured" Error
**Solution**: Add `AI_API_KEY` or `GITHUB_TOKEN` to `.env.local`

### AI Analysis Fails
**Possible Causes**:
1. Invalid API key
2. Rate limit exceeded
3. Network connectivity issues
4. Model not available

**Solution**: 
- Check environment variables
- Verify API key is valid
- Check console for detailed error messages
- Try again after a few minutes

### PDF Download Not Working
**Possible Causes**:
1. Browser blocking downloads
2. Insufficient permissions

**Solution**:
- Check browser download settings
- Allow popups/downloads for the site
- Check browser console for errors

### Empty or Incomplete Analysis
**Possible Causes**:
1. Flow definition is malformed
2. Flow has no triggers/actions
3. AI model failed to parse definition

**Solution**:
- Check flow definition in Power Automate portal
- Verify flow has been saved
- Check API logs for parsing errors

## Future Enhancements

Potential improvements for future iterations:
1. **Visual Flow Diagram**: Capture and include flow diagram image using html2canvas
2. **Batch Export**: Export multiple flows at once
3. **Custom Templates**: User-configurable PDF templates
4. **Export Formats**: Support for Word (.docx) and Markdown (.md)
5. **Flow History**: Include run history and performance metrics
6. **Version Comparison**: Show differences between flow versions
7. **Offline Mode**: Cache AI analysis for offline PDF generation
8. **Custom Branding**: Add company logo and branding to PDFs
9. **Multi-Language**: AI analysis in multiple languages
10. **Approval Workflow**: Built-in approval and sign-off sections

## Version History

### v1.0.0 (2025-11-24)
- Initial implementation
- PDF export with flow details, triggers, and actions
- AI-powered flow analysis using GPT-4o
- Support for GitHub Models and Azure OpenAI
- Loading states and error handling
- Professional PDF formatting
- Automatic file naming

## API Reference

### POST /api/power-platform/flows/analyze

**Description**: Analyzes a Power Automate flow definition and returns a step-by-step explanation.

**Authentication**: None (internal API, uses server-side credentials)

**Request**:
```typescript
{
  flowDefinition: object | string,  // Flow definition object or JSON string
  flowName: string,                 // Name of the flow
  modelName?: string                // AI model to use (default: "gpt-4o")
}
```

**Response (Success)**:
```typescript
{
  success: true,
  analysis: string,                 // AI-generated flow analysis
  model: string,                    // Model used for analysis
  usage: {
    prompt_tokens: number,
    completion_tokens: number,
    total_tokens: number
  }
}
```

**Response (Error)**:
```typescript
{
  success: false,
  error: string,                    // Error message
  details?: string                  // Additional error details
}
```

**Status Codes**:
- `200`: Success
- `400`: Bad request (missing flow definition)
- `500`: Server error (AI API failure, configuration error)

## Dependencies

### npm Packages
```json
{
  "jspdf": "^2.5.2",
  "html2canvas": "^1.4.1"
}
```

### API Services
- GitHub Models (https://github.com/marketplace/models)
- Azure OpenAI Service (https://azure.microsoft.com/products/ai-services/openai-service)
- Azure AI Inference API (https://learn.microsoft.com/azure/ai-foundry/model-inference/)

## Security Considerations

1. **API Keys**: Store API keys in environment variables, never in code
2. **Client-Side**: Flow definitions may contain sensitive information
3. **Rate Limiting**: Implement appropriate rate limiting for production
4. **Token Usage**: Monitor AI token consumption for cost control
5. **Data Privacy**: Ensure compliance with data handling policies
6. **Access Control**: Verify users have permission to export flows

## Best Practices

1. **Environment Variables**: Always use `.env.local` for local development
2. **Error Messages**: Provide clear, actionable error messages to users
3. **Loading States**: Always show loading indicators for async operations
4. **Logging**: Use console logging for debugging (removed in production builds)
5. **PDF Naming**: Use flow name and timestamp for unique file names
6. **Token Limits**: Configure appropriate max_tokens for AI responses
7. **Retry Logic**: Consider adding retry logic for transient failures
8. **User Feedback**: Clear success/failure feedback for export operations

## Testing Checklist

- [ ] Export PDF for a flow with triggers
- [ ] Export PDF for a flow with multiple actions
- [ ] Test with missing AI configuration
- [ ] Test with invalid API key
- [ ] Test with complex flow (10+ actions)
- [ ] Test error handling and display
- [ ] Verify PDF formatting and readability
- [ ] Check AI analysis quality and accuracy
- [ ] Test loading states and spinners
- [ ] Verify file naming convention
- [ ] Test on different browsers (Chrome, Firefox, Edge)
- [ ] Test with dark mode enabled
- [ ] Verify responsive design on mobile

## Support

For issues or questions:
1. Check console logs for detailed error messages
2. Verify environment variables are set correctly
3. Check GitHub Models or Azure OpenAI service status
4. Review API logs for detailed request/response information
5. Consult Power Automate documentation for flow definition structure
