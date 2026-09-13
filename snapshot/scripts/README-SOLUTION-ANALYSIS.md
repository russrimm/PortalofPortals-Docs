# Power Platform Solution Analysis Scripts

## Problem Statement

When analyzing Power Platform solutions with AI reasoning models (like grok-4-reasoning), timeouts occur due to:

1. **Large flow definition JSON files** (30k-100k+ characters each)
2. **.msapp files** (compressed archives with 100+ files inside)
3. **Cumulative token count** exceeding model limits or causing slow inference

## Solution: Token Reduction Pipeline

These scripts reduce solution size by **80-95%** while preserving critical information for AI analysis.

---

## Scripts Overview

### 1. `extract-flow-summary.cjs`
**Purpose:** Extract metadata + intelligent security/performance analysis from Power Automate flows

**Reduces:** 30KB flow JSON → 2-3KB smart summary (~90% reduction)

**Features:**
- ✅ Metadata extraction (action counts, connections, parameters)
- ✅ SQL injection detection (concat with SELECT/INSERT/UPDATE/DELETE)
- ✅ Hardcoded credential detection (secrets without @parameters)
- ✅ Insecure HTTP endpoint detection
- ✅ Performance anti-pattern detection (Patch in ForAll, delegation issues)
- ✅ Code samples of risky expressions only

**Usage:**
```bash
# Balanced mode (RECOMMENDED): Metadata + security risks
node scripts/extract-flow-summary.cjs path/to/flow.json balanced

# Fast mode: Metadata only (maximum size reduction)
node scripts/extract-flow-summary.cjs path/to/flow.json fast

# Security mode: Same as balanced with extended patterns
node scripts/extract-flow-summary.cjs path/to/flow.json security
```

**Output Example (Balanced Mode):**
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
      }
    ]
  }
}
```

---

### 2. `extract-msapp-summary.cjs`
**Purpose:** Extract metadata from .msapp files WITHOUT extracting full source code

**Reduces:** 5MB .msapp → 1KB summary (~99.98% reduction)

**Usage:**
```bash
# Single .msapp file
node scripts/extract-msapp-summary.cjs path/to/app.msapp

# All .msapp files in directory
node scripts/extract-msapp-summary.cjs path/to/solution-folder
```

**Output Example:**
```json
{
  "fileName": "MyCanvasApp.msapp",
  "fileSize": 5242880,
  "screensCount": 12,
  "connections": ["Office365Users", "SharePoint"],
  "totalFiles": 247,
  "fileTypes": {
    ".json": 125,
    ".png": 45,
    ".xml": 32
  }
}
```

---

### 3. `process-solution.cjs` ⭐ **Main Script**
**Purpose:** Orchestrate full solution processing with intelligent analysis modes

**Reduces:** 50MB solution → 50KB summary (~99.9% reduction)

**Usage:**
```bash
# Balanced mode (RECOMMENDED): Metadata + security risks
node scripts/process-solution.cjs ./MySolution prompt balanced > ai-prompt.txt

# Fast mode: Maximum size reduction, no expression analysis
node scripts/process-solution.cjs ./MySolution prompt fast > ai-prompt.txt

# Deep mode: Full analysis (may timeout on large solutions)
node scripts/process-solution.cjs ./MySolution prompt deep > ai-prompt.txt

# JSON output for programmatic use
node scripts/process-solution.cjs ./MySolution json balanced > solution-summary.json
```

**Mode Comparison:**

| Mode | Expression Analysis | Size Reduction | Security Findings | Best For |
|------|---------------------|----------------|-------------------|----------|
| **balanced** ⭐ | Risk detection only | 90-95% | ✅ SQL injection, hardcoded secrets, insecure HTTP | Security audits, comprehensive analysis |
| **fast** | None | 95-99% | ❌ None | Token limit emergencies, quick overviews |
| **deep** | All expressions | 70-85% | ✅ Plus full expression context | Detailed code review (may timeout) |

**Options in script:**
```javascript
const modeConfig = {
  balanced: {
    includeExpressions: true,          // Analyze for risks
    includeSecurityReview: true,       // Sensitive param detection
    maxFlowActionCount: 50             // Skip flows with >50 actions
  }
}
```

---

## Security & Performance Pattern Detection

### 🔒 Security Patterns Detected (Balanced/Security Modes)

The intelligent analysis engine automatically detects these security risks:

#### SQL Injection
- **Pattern:** `concat()` function with SQL keywords (SELECT, INSERT, UPDATE, DELETE)
- **Risk:** User input concatenated into SQL queries
- **Example:** `@{concat('SELECT * FROM users WHERE email = ', triggerBody()['email'])}`
- **Recommendation:** Use parameterized queries or Dataverse query expressions

#### Hardcoded Credentials
- **Pattern:** Strings containing "secret", "password", "key" without `@parameters()`
- **Risk:** Credentials stored in flow definition instead of secure parameters
- **Example:** `"Bearer hardcoded-secret-123"`
- **Recommendation:** Use secure environment variables or Key Vault references

#### Insecure HTTP Endpoints
- **Pattern:** URLs starting with `http://` instead of `https://`
- **Risk:** Unencrypted data transmission
- **Example:** `"http://insecure-api.com/data"`
- **Recommendation:** Use HTTPS for all external API calls

#### Base64 Encoded Secrets
- **Pattern:** `base64()` function with "secret", "password", or "key" keywords
- **Risk:** Secrets obfuscated but not securely stored
- **Example:** `@{base64(variables('apiKey'))}`
- **Recommendation:** Use Key Vault or secure parameters

### ⚡ Performance Patterns Detected

#### Delegation Issues
- **Pattern:** Complex filters with multiple `&&` operators
- **Risk:** Filter operations may not delegate to data source (returns only first 500 records)
- **Recommendation:** Simplify filters or use server-side filtering

#### Inefficient Loop Patterns
- **Pattern:** `Set(variable, variable + 1)` inside loops
- **Risk:** Variable increment in loops can cause performance issues
- **Recommendation:** Use `Select()` or aggregate functions

#### Patch in ForAll
- **Pattern:** `Patch()` function inside `ForAll()` loop
- **Risk:** Multiple individual database writes instead of batch operation
- **Recommendation:** Use `Collect()` to build array, then single `Patch()` with array

### 📊 Expression Analysis Output

When risks are detected, you get:

```json
{
  "expressionAnalysis": {
    "totalAnalyzed": 45,        // Total expressions scanned
    "riskyCount": 3,            // How many have risks
    "risks": [
      {
        "action": "SQL_Query.inputs.body.query",
        "length": 71,
        "risks": [
          "Potential SQL injection - string concatenation in SQL query"
        ],
        "patterns": [
          "Dynamic content reference"
        ],
        "sample": "@{concat('SELECT * FROM users WHERE email = ', triggerBody()['email'])}"
      }
    ]
  }
}
```

**Key Benefits:**
- ✅ Automatic detection - no manual code review needed
- ✅ Code samples included for quick verification
- ✅ Actionable recommendations for each risk type
- ✅ Still achieves 90%+ size reduction while preserving security insights

---

## Complete Workflow

### Step 1: Extract your Power Platform solution
```bash
# If you have a .zip solution file
unzip MySolution.zip -d ./MySolution
```

### Step 2: Pre-process the solution with security analysis
```bash
# Generate compact summary with security findings (RECOMMENDED)
node scripts/process-solution.cjs ./MySolution prompt balanced > ai-analysis-prompt.txt
```

### Step 3: Review the generated prompt
```bash
# Check the file size (should be <100KB for most solutions)
ls -lh ai-analysis-prompt.txt

# Preview the content
cat ai-analysis-prompt.txt
```

### Step 4: Send to AI model
```bash
# Example using your AI CLI tool
ai-cli analyze --model grok-4-reasoning --prompt ai-analysis-prompt.txt
```

---

## What Gets Extracted vs. Skipped

### ✅ **Extracted (Kept)**
- Flow metadata (action counts, trigger types, connection names)
- **NEW:** Security risks (SQL injection, hardcoded secrets, insecure HTTP)
- **NEW:** Performance anti-patterns (delegation issues, inefficient loops)
- **NEW:** Code samples of risky expressions only
- Sensitive parameters (secrets, keys, tokens) - names only, NOT values
- Canvas app screen counts, connection references
- File structure and sizes
- External URLs called by flows

### ❌ **Skipped (Removed)**
- Full flow action definitions (only risky ones preserved)
- Non-risky expressions and conditions
- Canvas app source code (.fx files)
- Images, icons, themes
- Default parameter values
- Detailed connection configuration
- Full JSON schemas
- Loop bodies and complex nested logic (unless security risk detected)

---

## Advanced: Customize Processing

### Skip Very Large Flows
Edit `process-solution.cjs`:
```javascript
const processed = processSolution(solutionPath, {
  maxFlowActionCount: 30  // Change from 50 to 30
})
```

### Include Flow Details for Small Flows
Edit `extract-flow-summary.cjs` to include action names:
```javascript
// Already included by default:
actionNames: Object.keys(actions)
```

### Extract Specific Action Details
```javascript
// Add to extractFlowSummary function:
const criticalActions = {}
Object.entries(actions).forEach(([key, action]) => {
  if (action.type === 'Http' || action.type === 'ApiConnection') {
    criticalActions[key] = {
      type: action.type,
      host: action.inputs?.host?.connection?.name
    }
  }
})
return { ...summary, criticalActions }
```

---

## Integration with AI Workflows

### Example: Automated Analysis Pipeline
```bash
#!/bin/bash
# analyze-solution.sh

SOLUTION_PATH=$1
OUTPUT_DIR="./analysis-results"

mkdir -p $OUTPUT_DIR

# Step 1: Pre-process solution
echo "📦 Processing solution..."
node scripts/process-solution.cjs "$SOLUTION_PATH" json > "$OUTPUT_DIR/summary.json"
node scripts/process-solution.cjs "$SOLUTION_PATH" prompt > "$OUTPUT_DIR/prompt.txt"

# Step 2: Run AI analysis
echo "🤖 Running AI analysis..."
ai-cli analyze \
  --model grok-4-reasoning \
  --prompt "$OUTPUT_DIR/prompt.txt" \
  --output "$OUTPUT_DIR/analysis-report.md"

# Step 3: Generate compliance report
echo "📋 Generating compliance report..."
node scripts/generate-compliance-report.js "$OUTPUT_DIR/summary.json" > "$OUTPUT_DIR/compliance.md"

echo "✅ Analysis complete! Results in $OUTPUT_DIR/"
```

---

## Troubleshooting

### "Cannot find module 'adm-zip'"
```bash
pnpm add adm-zip
```

### "Module not found: extract-flow-summary"
Ensure you run scripts from repo root:
```bash
cd /path/to/PortalofPortals
node scripts/process-solution.cjs ./MySolution prompt
```

### Still timing out?
1. **Reduce maxFlowActionCount** further (to 20 or 10)
2. **Split solution** into multiple batches (analyze 5 flows at a time)
3. **Use streaming API** if your AI model supports it
4. **Switch to a faster model** for initial triage, then use reasoning model on specific areas

---

## Token Count Estimates

| Solution Type | Original | Processed | Reduction |
|---------------|----------|-----------|-----------|
| Small (1-5 flows, no apps) | 150KB | 5KB | 97% |
| Medium (10-20 flows, 2-3 apps) | 2MB | 50KB | 97.5% |
| Large (50+ flows, 10+ apps) | 50MB | 200KB | 99.6% |
| Enterprise (hundreds of flows) | 500MB | 2MB | 99.6% |

**Typical grok-4-reasoning limit:** ~100K tokens (~400KB text)
**These scripts keep you under:** 50-200KB (well within limits)

---

## Next Steps

1. Run `process-solution.cjs` on your test solution
2. Verify the output is under 100KB
3. Test with your AI model
4. Adjust `maxFlowActionCount` if needed
5. Automate with CI/CD pipelines

Need help? Check the inline comments in each script for more details.
