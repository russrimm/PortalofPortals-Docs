# AI Solution Analysis Implementation

> 📦 **Historical record of the original implementation.** The current pipeline,
> rule set, limits, and API contract are documented in
> [Power Platform solution analysis](./power-platform-solution-analysis.md).

## Overview
Added AI-powered analysis capability for Power Platform solutions in the environments page. Users can now analyze both managed and unmanaged solutions using Azure OpenAI to get insights about solution composition, size, best practices, potential issues, and recommendations.

**Enhanced with Priority 1 Security Scanning (2025-12-26)**: Added comprehensive security analysis including exposed secret detection, environment variable validation, connection reference security, and hardcoded credential scanning.

## Implementation Dates
- Initial Implementation: 2025-02-01
- Security Scanning Enhancement: 2025-12-26

## Components Added

### 1. API Endpoint
**File**: `src/app/api/power-platform/solutions/analyze/route.ts`

**Purpose**: Export a Power Platform solution and send it to Azure AI for analysis

**Features**:
- Reuses existing export infrastructure (initiate → poll → download)
- Integrates with Azure OpenAI endpoint via `process.env.AZURE_ENDPOINT` and `process.env.AZURE_API_KEY`
- Implements full AI telemetry tracking using `@/lib/ai-telemetry`
- Returns structured analysis with metadata (solution name, size, tokens used)
- **Security Scanning (Added 2025-12-26)**:
  - Detects exposed secrets in workflow parameters (Azure client secrets, API keys, passwords)
  - Identifies hardcoded credentials (ClientId, TenantId, AppId GUIDs)
  - Validates environment variable secret storage configuration (secretstore flag)
  - Analyzes connection references for embedded runtime sources (portability issues)
  - Scans for weak security configurations and best practice violations

**Request Body**:
```json
{
  "instanceUrl": "string",
  "solutionName": "string",
  "solutionDisplayName": "string",
  "managed": boolean
}
```

**Response**:
```json
{
  "success": true,
  "analysis": "string (markdown formatted AI analysis)",
  "metadata": {
    "solutionName": "string",
    "solutionDisplayName": "string",
    "managed": boolean,
    "filename": "string",
    "size": number,
    "tokensUsed": number
  }
}
```

**AI Prompt Structure**:
- **System Prompt**: Expert Power Platform solution analyst persona
- **User Prompt**: Includes solution name, type (managed/unmanaged), file info, and security scan results
- **Security Scan Results (Added 2025-12-26)**: Pre-analysis security findings including:
  - Exposed secrets with severity levels and remediation steps
  - Hardcoded credentials requiring environment variables
  - Weak secret storage configurations
  - Connection reference portability issues
  - Environment variable inventory (with secret/plain text flags)
- **Response Format**: 5+ structured sections:
  1. Solution Overview
  2. Size Assessment  
  3. **Critical Issues (Security-focused if secrets detected)**
  4. Best Practices
  5. Potential Issues
  6. Recommendations (including security remediation when applicable)

### 2. Frontend UI Changes
**File**: `src/app/power-platform/environments/page.tsx`

**State Management**:
```javascript
const [analyzingStates, setAnalyzingStates] = useState({})
const [analysisModal, setAnalysisModal] = useState({ 
  open: false, 
  analysis: '', 
  metadata: null, 
  loading: false, 
  error: null 
})
```

**Handler Function**: `handleAnalyzeSolution(solution, managed)`
- Tracks analysis progress per solution
- Calls `/api/power-platform/solutions/analyze` endpoint
- Opens analysis modal with results
- Implements error handling and cleanup

**UI Components**:

#### AI Analyze Buttons (Solutions Table)
- **Unmanaged Analysis Button**: Purple border, "AI Analyze" label
- **Managed Analysis Button**: Orange border, "AI Analyze (M)" label
- Loading states with spinner animation
- Disabled states while analysis is running
- Icons: Book icon from Heroicons

#### Analysis Results Modal
- Full-screen overlay (z-50) with 85vh height
- Responsive layout with scrollable content area
- **Header**: Title + Close button
- **Content Sections**:
  - **Error State**: Red alert box with error icon and message
  - **Loading State**: Centered spinner with progress message
  - **Success State**: 
    - Solution metadata card (name, type, size, tokens used)
    - AI analysis content with markdown rendering
    - Custom HTML conversion for formatting (bold, headings, lists)

**Actions Column Width**: Increased from `w-52` to `w-96` to accommodate 4 buttons

### 3. Styling
- **Unmanaged AI Button**: `border-purple-500 text-purple-600 hover:bg-purple-50`
- **Managed AI Button**: `border-orange-500 text-orange-600 hover:bg-orange-50`
- **Modal**: `bg-black/90` overlay with `max-w-4xl` white card
- **Loading Spinner**: Purple theme matching AI analysis branding
- **Prose Styles**: Dark mode compatible with proper contrast

## User Workflow
1. User navigates to Power Platform → Environments
2. Opens solutions modal for an environment
3. Sees 4 buttons per solution:
   - Export Unmanaged (blue)
   - Export Managed (green)
   - **AI Analyze** (purple) ← NEW
   - **AI Analyze (M)** (orange) ← NEW
4. Clicks AI Analyze button
5. Button shows spinner: "Analyzing..."
6. System:
   - Exports solution (5-300 seconds depending on size)
   - Sends to Azure AI for analysis (~5-15 seconds)
   - Opens modal with results
7. User reviews analysis with:
   - Solution metadata (name, size, tokens)
   - 5 structured analysis sections
   - Markdown formatted content
8. User closes modal or clicks Escape

## Error Handling
- **Missing Azure Config**: Returns 500 with "Azure AI not configured" error
- **Export Failure**: Propagates error from export API with context
- **Export Timeout**: 5 minute timeout (same as manual export)
- **AI API Errors**: Captured and displayed in modal with error message
- **State Cleanup**: Error states cleared after 5 seconds
- **Telemetry**: All errors recorded in AI telemetry spans

## Performance Considerations
- **Export Time**: 5 seconds to 5 minutes (depends on solution complexity)
- **AI Processing**: ~5-15 seconds for analysis
- **Token Usage**: ~500-2000 tokens per analysis (tracked in metadata)
- **Concurrent Analyses**: Supported (each tracked with unique key)
- **Cleanup**: States auto-cleared 3 seconds after completion/error

## Dependencies
- **Existing**: Power Platform export APIs (initiate, poll, download)
- **Existing**: Azure AI endpoint configuration (`AZURE_ENDPOINT`, `AZURE_API_KEY`)
- **Existing**: AI telemetry library (`@/lib/ai-telemetry`)
- **No new npm packages required**

## Testing Recommendations
1. **Happy Path**: Click "AI Analyze" on a small solution, verify modal shows analysis
2. **Large Solution**: Test with 50+ MB solution, verify progress tracking
3. **Error Cases**: 
   - Test without Azure AI credentials (should show config error)
   - Test with invalid solution name (should show export error)
4. **Concurrent**: Click multiple AI Analyze buttons, verify independent tracking
5. **Dark Mode**: Verify modal renders correctly in dark theme
6. **Responsive**: Test modal on mobile/tablet viewports
7. **Keyboard**: Verify Escape key closes modal

## Known Limitations
- AI receives solution metadata (name, size) but not actual ZIP contents for analysis
  - Future enhancement: Extract XML from ZIP and include in AI prompt for deeper analysis
- Analysis is English-only (system prompt in English)
- No caching: Each click triggers full export + analysis
  - Future enhancement: Cache analyses for 24 hours by solution version
- Token usage counted but not quota-checked
  - Future enhancement: Check tenant token quota before initiating

## Configuration Required
Ensure `.env.local` has:
```bash
AZURE_ENDPOINT=https://your-endpoint.openai.azure.com/
AZURE_API_KEY=your-api-key
```

## Files Changed
- `src/app/api/power-platform/solutions/analyze/route.ts` (NEW)
- `src/app/power-platform/environments/page.tsx` (MODIFIED)

## Lines of Code
- API Route: ~180 lines
- Page Updates: ~150 lines
- **Total**: ~330 lines

## Build Status
✅ Build successful
✅ No TypeScript errors
✅ No ESLint errors
✅ All routes compiled successfully

## Next Steps (Optional Enhancements)
1. Add ZIP extraction to include solution XML in AI prompt for deeper analysis
2. Implement analysis caching by solution version + managed flag
3. Add export to PDF/markdown for analysis results
4. Add comparison mode: Analyze 2 solutions side-by-side
5. Add follow-up questions: User can ask AI to elaborate on specific points
6. Add quota checking before initiating analysis
