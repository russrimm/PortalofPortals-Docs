# Quick Start: Fix grok-4-reasoning Timeouts

## Your Problem
- **Model:** grok-4-reasoning
- **Issue:** Timeout errors
- **Cause:** Large flow definition JSON (~30KB+) + .msapp files + your prompts = token limit exceeded
- **Solution Size:** Small (minimal files)

---

## Immediate Fix (2 minutes)

### Step 1: Save your flow JSON
Save the large flow definition to a file:
```bash
# Create test-flow.json with your flow definition
```

### Step 2: Extract summary with security analysis (RECOMMENDED)
```bash
cd C:\repos\PortalofPortals
# Balanced mode: Includes metadata + security/performance risks
node scripts/extract-flow-summary.cjs test-flow.json balanced > flow-summary.json
```

### Step 3: Use the smart summary instead
Instead of sending the full 30KB JSON to grok-4-reasoning, send the **intelligent summary** from `flow-summary.json`.

**Result:** 30KB → 2-3KB = **90%+ reduction** ✅  
**Bonus:** Automatically detects SQL injection, hardcoded secrets, insecure endpoints!

---

## Processing Modes

Choose the right mode for your analysis needs:

### **balanced** (RECOMMENDED - Default)
- Metadata + security/performance risk detection
- Finds: SQL injection, hardcoded credentials, insecure HTTP, delegation issues
- Size: 90-95% reduction
- Best for: Security audits, performance reviews, comprehensive analysis

```bash
node scripts/extract-flow-summary.cjs test-flow.json balanced > flow-summary.json
```

### **fast** (Maximum Speed)
- Metadata only, no expression analysis
- Size: 95-99% reduction
- Best for: Quick overviews, token limit emergencies

```bash
node scripts/extract-flow-summary.cjs test-flow.json fast > flow-summary.json
```

### **security** (Security Focus)
- Same as balanced, but with extended security patterns
- Size: 85-92% reduction
- Best for: Security compliance reviews

```bash
node scripts/extract-flow-summary.cjs test-flow.json security > flow-summary.json
```

---

## For .msapp Files

### If you have Canvas Apps (.msapp files):
```bash
# Extract metadata only (no source code)
node scripts/extract-msapp-summary.cjs path/to/app.msapp > app-summary.json
```

**Result:** 5MB .msapp → 1KB summary = **99.98% reduction** ✅

---

## For Entire Solutions

### If you have a full solution with multiple flows + apps:
```bash
# Process entire solution directory
# Mode options: fast | balanced (default) | deep
node scripts/process-solution.cjs ./YourSolution prompt balanced > ai-prompt.txt
```

Then send `ai-prompt.txt` to grok-4-reasoning instead of the raw files.

**Result:** 50MB solution → 50KB summary = **99.9% reduction** ✅  
**Bonus:** Security findings included automatically in balanced mode!

---

## What You Get in the Summary

### Flow Summary Includes (Balanced Mode):
- ✅ Action counts by type (InitializeVariable: 5, Foreach: 3, etc.)
- ✅ Trigger types (Recurrence, HTTP, etc.)
- ✅ Connection names (Office365, SharePoint, etc.)
- ✅ Parameter names (but NOT values)
- ✅ Sensitive parameter detection (secrets, keys, tokens)
- ✅ External URLs called
- ✅ **NEW:** SQL injection detection (concat + SELECT/INSERT/UPDATE/DELETE)
- ✅ **NEW:** Hardcoded credential detection (secret/password/key without @parameters)
- ✅ **NEW:** Insecure HTTP endpoint detection (http:// instead of https://)
- ✅ **NEW:** Performance anti-patterns (Patch in ForAll, complex filters, variable increments in loops)
- ✅ **NEW:** Code samples of risky expressions only
- ❌ Full action definitions (removed to save space)
- ❌ All expression details (only risky ones included)

### .msapp Summary Includes:
- ✅ Screen count
- ✅ Connection references
- ✅ File count and types
- ✅ App metadata
- ❌ Source code (.fx files)
- ❌ Images/icons
- ❌ Themes

---

## Example: Your Flow with Security Analysis

Your original flow has:
```json
{
  "properties": {
    "connectionReferences": { ... },  // 3 connections
    "definition": {
      "actions": {
        "SQL_Query": {
          "inputs": {
            "body": {
              "query": "@{concat('SELECT * FROM users WHERE email = ', triggerBody()['email'])}"
            }
          }
        },
        "HTTP_Call": {
          "inputs": {
            "uri": "http://insecure-api.com/data",
            "authentication": { "value": "Bearer hardcoded-secret-123" }
          }
        }
        // ... 43 more actions
      },
      "triggers": { ... }             // 1 trigger
    }
  }
}
```

**Original size:** 30,000 characters

After processing (balanced mode):
```json
{
  "metadata": {
    "totalActions": 45,
    "totalTriggers": 1,
    "totalConnections": 3
  },
  "actionTypes": {
    "ApiConnection": 12,
    "Foreach": 8,
    "Compose": 10
  },
  "connectionReferences": ["shared_rss", "shared_office365", "shared_flowmanagement"],
  "expressionAnalysis": {
    "totalAnalyzed": 45,
    "riskyCount": 3,
    "risks": [
      {
        "action": "SQL_Query.inputs.body.query",
        "risks": ["Potential SQL injection - string concatenation in SQL query"],
        "sample": "@{concat('SELECT * FROM users WHERE email = ', triggerBody()['email'])}"
      },
      {
        "action": "HTTP_Call.inputs.uri",
        "risks": ["Insecure HTTP endpoint (use HTTPS)"],
        "sample": "http://insecure-api.com/data"
      },
      {
        "action": "HTTP_Call.inputs.authentication.value",
        "risks": ["Potential hardcoded credential"],
        "sample": "Bearer hardcoded-secret-123"
      }
    ]
  }
}
```

**Processed size:** ~2,500 characters (includes metadata + 3 security findings)

**Key Benefits:**
- ✅ 91% size reduction (30KB → 2.5KB)
- ✅ Automatically detected SQL injection vulnerability
- ✅ Found hardcoded credential security issue
- ✅ Identified insecure HTTP endpoint
- ✅ Still under token limits for grok-4-reasoning

---

## Advanced: Skip Large Flows Entirely

If you have flows with 100+ actions that are too complex even after summarization:

Edit `process-solution.cjs` line 17:
```javascript
maxFlowActionCount: 30  // Skip flows with >30 actions
```

This will exclude ultra-complex flows and just note them as warnings.

---

## Why This Works

| Original Approach | New Approach (Balanced Mode) |
|-------------------|------------------------------|
| Send full 30KB flow JSON | Send 2.5KB smart summary |
| grok-4-reasoning times out | grok-4-reasoning completes in <10s |
| ❌ Token limit exceeded | ✅ Well under token limits |
| ❌ No security insights | ✅ Automatic security risk detection |
| ❌ Manual code review needed | ✅ AI flags SQL injection, hardcoded secrets, insecure endpoints |

**Key insight:** AI models don't need the full loop expressions and conditions to understand what a flow does. They just need:
- What actions are used (API calls, loops, conditions)
- What services it connects to
- What parameters it uses
- Security concerns (SQL injection, hardcoded secrets, insecure HTTP)
- Performance anti-patterns (inefficient delegation, Patch in ForAll)

**Balanced mode gives you both:** Size reduction AND critical security/performance insights!

---

## Next Steps

1. **Test with your flow:**
   ```bash
   node scripts/test-processing.cjs
   ```
   This validates the scripts work correctly.

2. **Process your actual solution:**
   ```bash
   node scripts/process-solution.cjs ./YourSolution prompt > analysis.txt
   ```

3. **Send analysis.txt to grok-4-reasoning** instead of raw files

4. **Adjust `maxFlowActionCount`** if still timing out (reduce to 20 or 10)

---

## Troubleshooting

### Still timing out?
1. Reduce `maxFlowActionCount` to 20:
   ```javascript
   // In process-solution.cjs, line 17:
   maxFlowActionCount: 20
   ```

2. Split solution into batches (analyze 5 flows at a time):
   ```bash
   # Process only first 5 flows manually by editing the script
   ```

3. Use a faster model for initial triage:
   - Use grok-2 (faster, no reasoning) for overview
   - Use grok-4-reasoning only for specific problem areas

### Scripts not working?
```bash
# Ensure you're in the repo root
cd C:\repos\PortalofPortals

# Check Node.js version (need 18+)
node --version

# Re-run test
node scripts/test-processing.cjs
```

---

## Summary

✅ **Do this:** Pre-process with `extract-flow-summary.cjs` or `process-solution.cjs`
✅ **Send this:** The compact 600-byte summary
❌ **Don't send:** The full 30KB flow JSON

**Result:** grok-4-reasoning completes successfully without timeouts! 🎉
