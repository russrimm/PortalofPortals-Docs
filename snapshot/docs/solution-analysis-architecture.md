# Power Platform Solution Analysis - Production Architecture

> 📦 **Historical.** Superseded by
> [Power Platform solution analysis](./power-platform-solution-analysis.md),
> which documents the current shared pipeline and both analyze routes.

## Current Implementation Status

**Location:** `/api/power-platform/solutions/analyze`

**Current Approach:**
- Server-side Next.js API route
- In-memory ZIP extraction using `adm-zip`
- Direct Azure AI analysis
- Works for small-to-medium solutions (<50MB)

**Limitations:**
1. **Memory constraints** - Large solutions can exceed Node.js heap limits
2. **Timeout issues** - Long-running operations may timeout on hosting platforms
3. **Scalability** - Cannot handle concurrent large solution analyses efficiently
4. **No progress tracking** - Users wait with no visibility into status

---

## Recommended Production Architecture

### **Option 1: Azure Durable Functions with Blob Storage (RECOMMENDED)**

```
┌─────────────────────────────────────────────────────────────────┐
│                         Next.js Web App                          │
│  /api/power-platform/solutions/analyze (Orchestration Starter)  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │ HTTP POST
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              Azure Function App - HTTP Starter                   │
│  Returns: { instanceId, statusQueryGetUri, ... }                │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           │ Starts Orchestration
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│           Durable Orchestrator Function                          │
│  Coordinates workflow, manages state, handles retries           │
└───────┬──────────┬──────────┬──────────┬──────────┬─────────────┘
        │          │          │          │          │
        ▼          ▼          ▼          ▼          ▼
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│Activity 1│ │Activity 2│ │Activity 3│ │Activity 4│ │Activity 5│
│ Download │ │ Upload   │ │ Extract  │ │   AI     │ │ Cleanup  │
│ Solution │ │ to Blob  │ │ & Parse  │ │ Analysis │ │   Blob   │
└────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘
     │            │            │            │            │
     ▼            ▼            ▼            ▼            ▼
┌──────────────────────────────────────────────────────────────────┐
│                     Azure Blob Storage                            │
│           Container: solution-analysis-temp                       │
│           Lifecycle: Auto-delete after 24 hours                   │
└──────────────────────────────────────────────────────────────────┘
```

### **Benefits:**

1. **Handles any size** - No memory limits, streams directly to/from Blob Storage
2. **Long-running** - Supports operations up to 7 days (vs 300s API route limit)
3. **Progress tracking** - Built-in status queries for real-time progress
4. **Automatic retries** - Durable Functions handle transient failures
5. **Scalable** - Can process multiple solutions concurrently
6. **Cost-effective** - Pay only for execution time, not idle time
7. **Resilient** - Automatically recovers from crashes/restarts

### **Implementation Components:**

#### 1. **Azure Resources Needed:**
```bash
# Resource Group
az group create --name rg-solution-analysis --location eastus

# Storage Account (for Durable Functions state + temp blobs)
az storage account create \
  --name stsolutionanalysis \
  --resource-group rg-solution-analysis \
  --location eastus \
  --sku Standard_LRS

# Container for temporary solution files
az storage container create \
  --name solution-analysis-temp \
  --account-name stsolutionanalysis

# Function App (Consumption or Premium plan)
az functionapp create \
  --name func-solution-analysis \
  --resource-group rg-solution-analysis \
  --storage-account stsolutionanalysis \
  --consumption-plan-location eastus \
  --runtime node \
  --runtime-version 18 \
  --functions-version 4
```

#### 2. **Function App Structure:**

```
solution-analysis-functions/
├── host.json                    # Function app configuration
├── package.json                 # Dependencies
├── .funcignore                  # Files to exclude
├── local.settings.json          # Local development settings
├── HttpStarter/                 # HTTP endpoint to start orchestration
│   ├── function.json
│   └── index.js
├── SolutionAnalysisOrchestrator/  # Main orchestrator
│   ├── function.json
│   └── index.js
├── Activities/
│   ├── DownloadSolution/        # Download from Power Platform
│   │   ├── function.json
│   │   └── index.js
│   ├── UploadToBlob/            # Upload ZIP to Blob Storage
│   │   ├── function.json
│   │   └── index.js
│   ├── ExtractAndAnalyze/       # Parse solution contents
│   │   ├── function.json
│   │   └── index.js
│   ├── RunAIAnalysis/           # Call Azure OpenAI
│   │   ├── function.json
│   │   └── index.js
│   └── CleanupBlob/             # Delete temporary files
│       ├── function.json
│       └── index.js
└── CheckStatus/                 # HTTP endpoint to check progress
    ├── function.json
    └── index.js
```

#### 3. **Orchestrator Pseudo-code:**

```javascript
// SolutionAnalysisOrchestrator/index.js
const df = require('durable-functions');

module.exports = df.orchestrator(function* (context) {
  const input = context.df.getInput();
  
  try {
    // Activity 1: Download solution from Power Platform
    const downloadResult = yield context.df.callActivity(
      'DownloadSolution', 
      {
        instanceUrl: input.instanceUrl,
        solutionName: input.solutionName,
        managed: input.managed
      }
    );
    
    // Activity 2: Upload ZIP to Blob Storage
    const blobInfo = yield context.df.callActivity(
      'UploadToBlob',
      {
        zipData: downloadResult.zipData,
        solutionName: input.solutionName,
        containerName: 'solution-analysis-temp'
      }
    );
    
    // Activity 3: Extract and analyze ZIP contents from Blob
    const extractedData = yield context.df.callActivity(
      'ExtractAndAnalyze',
      {
        blobUrl: blobInfo.blobUrl,
        containerName: blobInfo.containerName,
        blobName: blobInfo.blobName
      }
    );
    
    // Activity 4: Run AI analysis
    const analysis = yield context.df.callActivity(
      'RunAIAnalysis',
      {
        solutionContents: extractedData,
        solutionName: input.solutionName,
        solutionDisplayName: input.solutionDisplayName
      }
    );
    
    // Activity 5: Cleanup temporary blob
    yield context.df.callActivity(
      'CleanupBlob',
      {
        containerName: blobInfo.containerName,
        blobName: blobInfo.blobName
      }
    );
    
    return {
      success: true,
      analysis: analysis.text,
      metadata: {
        ...extractedData.metadata,
        tokensUsed: analysis.tokensUsed
      }
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});
```

#### 4. **Next.js Integration:**

Update `/api/power-platform/solutions/analyze/route.js`:

```javascript
export async function POST(request) {
  try {
    const body = await request.json();
    const functionAppUrl = process.env.SOLUTION_ANALYSIS_FUNCTION_URL;
    
    // Start the orchestration
    const startRes = await fetch(`${functionAppUrl}/api/orchestrators/SolutionAnalysisOrchestrator`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-functions-key': process.env.SOLUTION_ANALYSIS_FUNCTION_KEY
      },
      body: JSON.stringify(body)
    });
    
    const orchestrationInfo = await startRes.json();
    
    // Poll for completion (or return instanceId for client-side polling)
    const statusUrl = orchestrationInfo.statusQueryGetUri;
    let isComplete = false;
    let attempts = 0;
    
    while (!isComplete && attempts < 60) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const statusRes = await fetch(statusUrl, {
        headers: {
          'x-functions-key': process.env.SOLUTION_ANALYSIS_FUNCTION_KEY
        }
      });
      const status = await statusRes.json();
      
      if (status.runtimeStatus === 'Completed') {
        return NextResponse.json({
          success: true,
          ...status.output
        });
      } else if (status.runtimeStatus === 'Failed') {
        throw new Error(status.output?.error || 'Orchestration failed');
      }
      
      attempts++;
    }
    
    // Return instance ID for client-side polling if not complete
    return NextResponse.json({
      pending: true,
      instanceId: orchestrationInfo.instanceId,
      statusQueryGetUri: statusUrl
    });
    
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
```

#### 5. **Environment Variables:**

Add to `.env.local`:
```bash
# Azure Function App
SOLUTION_ANALYSIS_FUNCTION_URL=https://func-solution-analysis.azurewebsites.net
SOLUTION_ANALYSIS_FUNCTION_KEY=your-function-key-here

# Blob Storage (also needed by Function App)
AZURE_STORAGE_CONNECTION_STRING=your-connection-string
AZURE_STORAGE_CONTAINER_NAME=solution-analysis-temp
```

---

## Option 2: Immediate Quick Fix (Current Architecture)

If you need to unblock immediately without Azure Functions:

### **Diagnosis Steps:**

1. **Check the actual error:**
```javascript
// In page.jsx handleAnalyzeSolution
console.log('Analysis error details:', analyzeData);
```

2. **Common issues:**
   - Missing `adm-zip` package: `pnpm add adm-zip`
   - Node.js memory limit: Increase with `NODE_OPTIONS=--max-old-space-size=4096`
   - Timeout: Increase in hosting platform settings

3. **Temporary workarounds:**
```javascript
// In next.config.ts
export default {
  experimental: {
    serverComponentsExternalPackages: ['adm-zip']
  }
}
```

### **Updated Route with Better Error Handling:**

Already implemented in your codebase with:
- Size warnings for solutions >50MB
- Detailed logging of ZIP extraction steps
- Specific error recommendations
- Timeout configuration (`maxDuration = 300`)

---

## Cost Comparison

### **Current (Next.js API Routes):**
- **Azure App Service Free/Shared:** Free tier limited, timeouts at 10s
- **Azure App Service Standard/Premium:** $20/month, 300s timeout (sufficient for small solutions)
- **Azure App Service Isolated:** Custom pricing, no timeout limits

### **Azure Functions (Recommended):**
- **Consumption Plan:** 
  - First 1M executions free/month
  - $0.20 per million executions after
  - $0.000016/GB-s for memory
  - Typical 2-minute analysis: ~$0.0001 per run
- **Premium Plan (if needed for VNet):**
  - ~$180/month for EP1 (always-warm, faster cold starts)

---

## Migration Steps

### Phase 1: Setup Azure Resources (30 minutes)
1. Create Resource Group
2. Create Storage Account
3. Create Function App
4. Deploy function code

### Phase 2: Test Orchestration (1 hour)
1. Test with small solution
2. Test with large solution
3. Verify blob cleanup

### Phase 3: Integrate with Next.js (30 minutes)
1. Update API route
2. Add status polling UI
3. Test end-to-end

### Phase 4: Production Deploy (15 minutes)
1. Set environment variables
2. Deploy to production
3. Monitor first few runs

**Total Time:** ~2.5 hours for full migration

---

## Decision Matrix

| Criteria | Current (API Route) | Azure Functions |
|----------|-------------------|-----------------|
| **Size Limit** | ~50MB | Unlimited |
| **Timeout** | 300s (Azure App Service Standard/Premium) | 7 days |
| **Scalability** | Limited | Excellent |
| **Cost (100 analyses/month)** | $0 (in plan) | ~$0.01 |
| **Reliability** | Medium | High |
| **Progress Tracking** | No | Yes |
| **Setup Time** | 0 (done) | 2.5 hours |
| **Maintenance** | Low | Low |

---

## Recommendation

**For your current stage:**
1. **Immediate:** Use the current implementation with added error handling (already done)
2. **Monitor:** Track solution sizes and failure rates
3. **Migrate when:** 
   - You need to analyze solutions >50MB regularly
   - Users report frequent timeouts
   - You need progress tracking for better UX
   - You have 2-3 hours to implement the Azure Functions approach

**The Azure Functions approach is the "right" way for production**, but your current implementation will work fine for most solutions <50MB.

---

## Need Help Implementing?

Let me know if you want me to:
1. ✅ **Debug the current ZIP extraction issue** (add more logging to see exactly where it fails)
2. 🚀 **Scaffold the complete Azure Functions solution** (all code + deployment scripts)
3. 📊 **Add progress tracking UI** to the existing implementation
4. 🔧 **Other improvements** you have in mind
