# Solution Analysis Architecture - Final Design
**Date:** December 6, 2025  
**Status:** 📦 Historical — superseded by [Power Platform solution analysis](./power-platform-solution-analysis.md)

> The direct Next.js API → AI pattern described here is still correct, but the
> analysis pipeline has since moved into the shared
> `src/lib/power-platform/solution-analysis/` library and gained a second entry
> point for uploaded `.zip` files. See the current doc for the live contract.

## Executive Summary

The solution analysis feature uses a **direct Next.js API → AI** pattern, not Azure Functions. This is the cleanest, simplest, and most secure approach for Azure App Service deployments.

## Architecture Comparison

### ✅ IMPLEMENTED: Direct AI Analysis (Recommended)
```
┌─────────────┐
│   Browser   │
│   (User)    │
└──────┬──────┘
       │ NextAuth Session Cookie
       ↓
┌─────────────────────────────────────────┐
│  Next.js API Route                      │
│  /api/power-platform/solutions/analyze  │
│                                          │
│  1. Get session token                   │
│  2. Exchange for PP delegated token     │
│  3. Export solution from Dataverse      │
│  4. Call Azure OpenAI directly          │
│  5. Return analysis + metadata          │
└──────┬──────────────────────────────────┘
       │ Delegated Token (user context)
       ↓
┌─────────────────────┐
│  Dataverse API      │
│  (Power Platform)   │
│                     │
│  ExportSolution     │
│  → asyncoperations  │
│  → ExportSolutionFile│
└──────┬──────────────┘
       │ Solution ZIP file
       ↓
┌─────────────────────┐
│  Azure OpenAI API   │
│                     │
│  Analyze solution   │
│  metadata & size    │
└──────┬──────────────┘
       │ AI Analysis (markdown)
       ↓
┌─────────────┐
│   Browser   │
│   (Modal)   │
└─────────────┘
```

**Benefits:**
- ✅ **Simplest:** One API route, no background jobs
- ✅ **Cleanest:** No polling, webhooks, or blob storage needed
- ✅ **Most Secure:** Uses delegated tokens (user permissions)
- ✅ **Azure App Service Compatible:** Pure Node.js, no Azure-specific dependencies
- ✅ **Fast:** Direct AI call, no function cold starts
- ✅ **Auditable:** All actions logged under user identity

### ❌ NOT USED: Durable Functions Orchestration

```
Browser → Next.js → OAuth Token → Function App → Blob Storage
                                       ↓
                                  Orchestration
                                       ↓
                            Activity: Download → Blob
                            Activity: Analyze → Blob
                            Activity: Upload → Blob
                                       ↓
Browser ← Next.js ← Poll Status ← Function App
```

**Why NOT this?**
- ❌ **Complex:** Requires Function App, Durable Functions, Blob Storage, OAuth setup
- ❌ **Slow:** Cold starts, orchestration overhead, polling delays
- ❌ **Azure App Service Incompatible:** Can't easily integrate serverless functions with Azure Durable Functions
- ❌ **More Secrets:** Requires client credentials (PPSolutionAnalyzer app registration)
- ❌ **Less Secure:** Client credentials flow instead of delegated tokens
- ❌ **Overkill:** Solution analysis doesn't need background processing

## Environment Variables - Simplified

### Required (Graph API + NextAuth)
```bash
# Core Azure / Entra ID Credentials
# Used by: NextAuth, Graph API, Azure Resource Manager, Power Platform (OBO exchange)
AZURE_CLIENT_ID=<your-client-id>
AZURE_CLIENT_SECRET=<your-client-secret>
AZURE_TENANT_ID=<your-tenant-id>
```

**Single app registration** with these API permissions:
- Microsoft Graph: `User.Read`, `Directory.Read.All`, `Organization.Read.All`, etc.
- Dynamics CRM (Power Platform): Delegated access via OBO token exchange
- Azure Resource Manager: Delegated access for subscription queries

### Required (Azure OpenAI)
```bash
# Azure OpenAI / AI Analysis
# Used by: Solution Analysis, Flow Analysis, AI Chat
AI_API_KEY=<your-azure-openai-key>
AI_ENDPOINT=https://<your-resource>.cognitiveservices.azure.com
AI_MODEL=o4-mini

# Legacy aliases (kept for backward compatibility)
AZURE_API_KEY=<your-azure-openai-key>
AZURE_ENDPOINT=https://<your-resource>.cognitiveservices.azure.com/openai/deployments/o4-mini/chat/completions?api-version=2025-01-01-preview
```

### NOT Required (Deprecated)
```bash
# DEPRECATED: PPSolutionAnalyzer Function App (not used)
#CLIENT_ID=<legacy-function-client-id>
#CLIENT_SECRET=<legacy-function-client-secret>
#AZURE_FUNCTIONS_URL=https://ppsolutionanalyzer.azurewebsites.net
```

## Security Model

### Token Flow (Delegated Access)
1. **User logs in** via NextAuth (Azure AD provider)
2. **NextAuth stores access token** in session (encrypted cookie)
3. **API route retrieves session token**
4. **OBO exchange** → Power Platform delegated token (via `getDelegatedPowerPlatformToken`)
5. **Dataverse API call** with user's delegated token
6. **Azure OpenAI call** with service key (AI_API_KEY)

### Why Delegated Tokens?
- **User permissions enforced:** User can only export solutions they have access to
- **Audit trail:** All Dataverse actions logged under user identity
- **No elevated privileges:** No client credentials stored in browser
- **Secure by default:** Token exchange happens server-side only

### API Key Protection
- **AI_API_KEY never exposed to browser:** Only used in Next.js API routes (server-side)
- **No CORS issues:** AI calls happen server-to-server
- **Rate limiting:** Controlled by server, not client
- **Key rotation:** Change in `.env.local`, no code changes needed

## Deployment Considerations

### Azure App Service Deployment
✅ **Fully Compatible:**
- Next.js API routes are Edge/Node functions
- No Azure-specific runtime dependencies
- Environment variables set in Azure App Service dashboard
- Automatic HTTPS and CDN

**Setup:**
1. Push code to GitHub
2. Connect Azure App Service project
3. Add environment variables:
   - `AZURE_CLIENT_ID`
   - `AZURE_CLIENT_SECRET`
   - `AZURE_TENANT_ID`
   - `AI_API_KEY`
   - `AI_ENDPOINT`
   - `AI_MODEL`
   - `AUTH_SECRET`
   - `NEXTAUTH_URL` (your application domain)
4. Deploy!

### Azure App Service Deployment
✅ **Fully Compatible:**
- Next.js runs on Node.js runtime
- Environment variables in App Service Configuration
- VNet integration possible (if needed)
- App Insights integration for monitoring

**Setup:**
1. Create App Service (Node 18+ runtime)
2. Configure environment variables in App Service → Configuration
3. Deploy via GitHub Actions or Azure DevOps
4. Enable App Insights for telemetry (optional)

## Performance Characteristics

### Typical Request Timeline
```
User clicks "AI Analyze" button
  ↓
0-2s: Get session, exchange token
  ↓
5-300s: Export solution from Dataverse (depends on solution size)
  ├─ Small solution (<1 MB): 5-30 seconds
  ├─ Medium solution (1-10 MB): 30-120 seconds
  └─ Large solution (>10 MB): 120-300 seconds
  ↓
0-1s: Download solution file
  ↓
5-15s: AI analysis (Azure OpenAI GPT-4o)
  ↓
0.5s: Return result to browser
  ↓
Modal opens with analysis
```

**Total: 10-320 seconds** (mostly Dataverse export time, not controllable)

### Why Not Background Processing?
- **Export is synchronous:** Dataverse async operations must be polled anyway
- **User expects immediate result:** Opening modal with "check back later" is poor UX
- **No benefit:** Background job would still take same 10-320 seconds
- **Simpler is better:** No polling, no status checks, no extra complexity

## Cost Analysis

### Current Architecture (Direct AI)
- **Next.js API Route:** Included in Azure App Service hosting
- **Azure OpenAI:** ~$0.03 per analysis (500-2000 tokens @ GPT-4o pricing)
- **Dataverse API:** Included in Power Platform license
- **Total per analysis:** ~$0.03

### Alternative (Durable Functions)
- **Next.js API Route:** Included in hosting
- **Azure Function App:** ~$0.20/million executions (Consumption plan)
- **Blob Storage:** ~$0.02/GB/month + transactions
- **Azure OpenAI:** ~$0.03 per analysis
- **Total per analysis:** ~$0.04-0.05 (20-67% more expensive)

**Savings:** $0.01-0.02 per analysis × 1000 analyses/month = **$10-20/month saved**

## Monitoring & Debugging

### Application Insights (Already Configured)
Your `.env.local` has:
```bash
APPLICATIONINSIGHTS_CONNECTION_STRING=InstrumentationKey=a02b3c58-d6f7-4714-98b2-d93ad461103b;...
```

### Log Messages (Check Browser Console)
```
[Solution Analyze] Starting analysis for MySolution (unmanaged)
[Solution Analyze] Step 1: Initiating solution export...
[Solution Analyze] Export initiated, operation ID: abc123...
[Solution Analyze] Step 2: Polling for export completion...
[Solution Analyze] Export completed successfully after 12 attempts
[Solution Analyze] Step 3: Downloading solution file...
[Solution Analyze] Downloaded solution: MySolution.zip (2.34 MB)
[Solution Analyze] Step 4: Analyzing solution with AI...
[Solution Analyze] Analysis complete. Tokens used: 1234
```

### Error Tracking
All errors logged with context:
- `[Solution Analyze] Export initiation failed: 401 Unauthorized`
- `[Solution Analyze] Download failed: 404 Not Found`
- `[Solution Analyze] AI API error: 429 Too Many Requests`

## Migration Path (If You Want to Keep Function App)

If you already deployed the Function App and want to keep it for other purposes:

### Option 1: Keep Function App for Other Features
- Solution analysis: Uses direct AI (current implementation)
- Other batch processing: Uses Function App (if needed in future)

### Option 2: Decommission Function App
1. ✅ Remove/comment environment variables (already done)
2. ✅ Delete Function App in Azure Portal (optional cost savings)
3. ✅ Delete `0fd5f2f9-bc4c-460d-ba89-299e8d8ab279` app registration (optional cleanup)
4. ✅ Keep `azure-functions/` directory (for reference/future use)

**Recommendation:** Keep Function App infrastructure for now (already provisioned), but don't use it for solution analysis. Decommission later if no other use cases emerge.

## Summary: Why This Architecture Wins

| Criteria | Direct AI (✅ Current) | Durable Functions (❌ Rejected) |
|----------|----------------------|--------------------------------|
| **Simplicity** | 1 API route | 5+ components |
| **Lines of Code** | ~330 | ~1500+ |
| **Environment Variables** | 6 | 10+ |
| **Azure Resources** | 1 (OpenAI) | 4+ (Functions, Storage, App Insights, OpenAI) |
| **Azure App Service Compatible** | ✅ Yes | ❌ No (requires custom integration) |
| **User Experience** | Immediate result | Poll for result |
| **Security** | Delegated tokens | Client credentials |
| **Audit Trail** | User identity | Service principal |
| **Cost per Analysis** | $0.03 | $0.04-0.05 |
| **Cold Start** | None | 2-5 seconds |
| **Maintenance** | Low | High |

## Final Recommendation

**Keep the current implementation** (direct AI analysis). It's:
1. ✅ Already working
2. ✅ Simpler to maintain
3. ✅ More secure (delegated tokens)
4. ✅ Cheaper to run
5. ✅ Faster for users
6. ✅ Azure App Service compatible
7. ✅ Easier to debug

**Do NOT migrate to Durable Functions** unless you have a specific requirement for:
- True background processing (user doesn't wait)
- Massive solutions (>100 MB, taking >5 minutes)
- Complex multi-step workflows with retries
- Blob storage integration for other features

For 99% of solution analysis use cases, **direct AI analysis is the optimal choice**.
