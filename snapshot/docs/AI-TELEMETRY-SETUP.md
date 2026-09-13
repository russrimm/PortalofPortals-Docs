# AI Telemetry Implementation Guide

This document describes the AI/LLM telemetry implementation in Portal 360° using OpenTelemetry GenAI semantic conventions to track all AI operations, token usage, prompts, completions, and errors.

## Overview

We use OpenTelemetry GenAI semantic conventions (instead of Microsoft Agent Framework which only supports Python/.NET) to instrument AI/LLM operations. This provides:

- **Operation tracking**: All AI API calls with duration, model, and system
- **Token usage**: Prompt tokens, completion tokens, and total tokens consumed
- **Cost estimation**: Calculated cost based on token usage
- **Prompt/completion analysis**: Input and output content patterns
- **Error tracking**: Failed AI operations with error details
- **Finish reasons**: Why completions ended (stop, length, content_filter, etc.)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js Application                      │
├─────────────────────────────────────────────────────────────┤
│  API Routes (instrumented)                                  │
│  ├─ /api/azure-ai-chat (Azure OpenAI chat)                 │
│  └─ /api/ai-recommendations (Azure OpenAI recommendations) │
├─────────────────────────────────────────────────────────────┤
│  src/lib/ai-telemetry.ts                                    │
│  ├─ createGenAISpan() - Create spans with GenAI attributes │
│  ├─ recordPrompt() - Record input messages                 │
│  ├─ recordCompletion() - Record output content             │
│  ├─ recordTokenUsage() - Record token metrics              │
│  └─ recordError() - Record failures                        │
├─────────────────────────────────────────────────────────────┤
│  instrumentation.ts (OpenTelemetry base config)            │
│  └─ Azure Monitor Exporter                                 │
└─────────────────────────────────────────────────────────────┘
                            ▼
                   Application Insights
                   (Azure Monitor)
```

## GenAI Semantic Conventions

We follow OpenTelemetry GenAI semantic conventions:
https://opentelemetry.io/docs/specs/semconv/gen-ai/

### Span Attributes

| Attribute | Description | Example |
|-----------|-------------|---------|
| `gen_ai.system` | AI provider | `azure_openai`, `openai`, `anthropic` |
| `gen_ai.request.model` | Model requested | `gpt-4`, `gpt-4o-mini` |
| `gen_ai.request.max_tokens` | Max tokens | `3000` |
| `gen_ai.request.temperature` | Temperature | `0.5` |
| `gen_ai.response.model` | Actual model used | `gpt-4-0613` |
| `gen_ai.usage.prompt_tokens` | Input tokens | `150` |
| `gen_ai.usage.completion_tokens` | Output tokens | `450` |
| `gen_ai.response.finish_reasons` | Why stopped | `["stop"]`, `["length"]` |
| `gen_ai.prompt.{i}.role` | Message role | `system`, `user`, `assistant` |
| `gen_ai.prompt.{i}.content` | Message content | Prompt text |
| `gen_ai.completion.0.content` | Response content | Completion text |

## Implementation

### 1. Helper Functions (src/lib/ai-telemetry.ts)

```typescript
import { trace, SpanStatusCode } from '@opentelemetry/api'

const tracer = trace.getTracer('pulse-360-ai')

// Create a GenAI span with required attributes
export function createGenAISpan(operationName, system, model) {
  const span = tracer.startSpan(operationName)
  span.setAttribute('gen_ai.system', system)
  span.setAttribute('gen_ai.request.model', model)
  return span
}

// Record prompt messages
export function recordPrompt(span, messages) {
  messages.forEach((msg, i) => {
    span.setAttribute(`gen_ai.prompt.${i}.role`, msg.role)
    span.setAttribute(`gen_ai.prompt.${i}.content`, msg.content)
  })
}

// Record completion content
export function recordCompletion(span, content, finishReason) {
  span.setAttribute('gen_ai.completion.0.content', content)
  if (finishReason) {
    span.setAttribute('gen_ai.response.finish_reasons', [finishReason])
  }
}

// Record token usage
export function recordTokenUsage(span, promptTokens, completionTokens, totalTokens) {
  if (promptTokens) span.setAttribute('gen_ai.usage.prompt_tokens', promptTokens)
  if (completionTokens) span.setAttribute('gen_ai.usage.completion_tokens', completionTokens)
  if (totalTokens) span.setAttribute('gen_ai.usage.total_tokens', totalTokens)
}

// Record errors
export function recordError(span, error) {
  span.recordException(error)
  span.setStatus({ code: SpanStatusCode.ERROR, message: error.message })
}
```

### 2. Instrumenting Azure OpenAI Endpoints

#### Azure AI Chat Endpoint (/api/azure-ai-chat)

```javascript
import { createGenAISpan, recordPrompt, recordCompletion, recordTokenUsage, recordError } from '@/lib/ai-telemetry'

export async function POST(request) {
  const body = await request.json()
  const { messages, model = 'gpt-4o-mini', max_tokens = 1000, temperature = 0.7 } = body

  // Create GenAI span
  const span = createGenAISpan('azure_openai_chat', 'azure_openai', model)
  span.setAttribute('gen_ai.request.max_tokens', max_tokens)
  span.setAttribute('gen_ai.request.temperature', temperature)

  // Record prompt messages
  recordPrompt(span, messages)

  try {
    // Call Azure OpenAI
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': apiKey },
      body: JSON.stringify({ messages, max_tokens, temperature })
    })

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`)
    }

    const data = await response.json()
    const completion = data.choices[0].message.content
    const finishReason = data.choices[0].finish_reason
    const usage = data.usage

    // Record completion and tokens
    recordCompletion(span, completion, finishReason)
    recordTokenUsage(span, usage.prompt_tokens, usage.completion_tokens, usage.total_tokens)

    span.end()

    return NextResponse.json({ success: true, data })
  } catch (error) {
    recordError(span, error)
    span.end()
    throw error
  }
}
```

#### AI Recommendations Endpoint (/api/ai-recommendations)

```javascript
import { createGenAISpan, recordPrompt, recordCompletion, recordTokenUsage, recordError } from '@/lib/ai-telemetry'

const span = createGenAISpan('azure_openai_recommendations', 'azure_openai', 'default')
span.setAttribute('gen_ai.request.max_tokens', 3000)
span.setAttribute('gen_ai.request.temperature', 0.5)

const messages = [
  { role: 'system', content: 'You are a senior software engineer...' },
  { role: 'user', content: prompt }
]

recordPrompt(span, messages)

try {
  const aiResponse = await fetch(aiEndpoint, { /* ... */ })
  
  if (aiResponse.ok) {
    const aiData = await aiResponse.json()
    const completion = aiData.choices[0].message.content
    const finishReason = aiData.choices[0].finish_reason
    const usage = aiData.usage

    recordCompletion(span, completion, finishReason)
    if (usage) {
      recordTokenUsage(span, usage.prompt_tokens, usage.completion_tokens, usage.total_tokens)
    }
    span.end()
    
    // Process recommendations...
  } else {
    const error = new Error(`AI service failed: ${aiResponse.status}`)
    recordError(span, error)
    span.end()
    throw error
  }
} catch (aiError) {
  if (span) {
    recordError(span, aiError)
    span.end()
  }
  // Fall back to rule-based recommendations...
}
```

## Monitoring and Queries

## Portal Activity Logging (User Actions)

Portal user actions are now emitted as OpenTelemetry spans using `src/lib/activity-telemetry.ts`.
When `instrumentation.ts` is active (non-development runtime with a valid
`APPLICATIONINSIGHTS_CONNECTION_STRING`), these activity events flow to Azure Monitor and are queryable from Log Analytics.

Current instrumented actions include:

- `environment_settings_list`
- `environment_settings_create`
- `environment_settings_update`
- `environment_operations_list`

Key activity attributes:

- `portal.activity.action`
- `portal.activity.area`
- `portal.activity.outcome` (`success`, `failure`, `unauthorized`, `validation_error`)
- `portal.activity.user_id`
- `portal.activity.resource_type`
- `portal.activity.resource_id`
- `http.method`, `http.route`, `http.status_code`

### KQL: Recent Portal Activities

```kql
traces
| where timestamp > ago(24h)
| where tostring(customDimensions.['portal.activity.action']) != ''
| extend Action = tostring(customDimensions.['portal.activity.action'])
| extend Area = tostring(customDimensions.['portal.activity.area'])
| extend Outcome = tostring(customDimensions.['portal.activity.outcome'])
| extend UserId = tostring(customDimensions.['portal.activity.user_id'])
| extend ResourceType = tostring(customDimensions.['portal.activity.resource_type'])
| extend ResourceId = tostring(customDimensions.['portal.activity.resource_id'])
| extend StatusCode = tostring(customDimensions.['http.status_code'])
| project timestamp, Action, Area, Outcome, UserId, ResourceType, ResourceId, StatusCode, message
| order by timestamp desc
```

### KQL: Activity Outcome Summary

```kql
traces
| where timestamp > ago(7d)
| where tostring(customDimensions.['portal.activity.action']) != ''
| extend Action = tostring(customDimensions.['portal.activity.action'])
| extend Outcome = tostring(customDimensions.['portal.activity.outcome'])
| summarize Count = count() by Action, Outcome
| order by Count desc
```

### Application Insights AI Analysis Page

The App Insights AI Analysis page (`/application-insights-exceptions`) includes these GenAI queries:

1. **GenAI Operations Overview** - All AI operations by system, model, and operation name
2. **GenAI Token Usage** - Token consumption with cost estimates
3. **GenAI Operation Errors** - Failed AI operations and error patterns
4. **GenAI Prompt Analysis** - Prompt patterns and input characteristics

### Log Analytics Explorer Page

The Log Analytics Explorer page (`/log-analytics`) includes these GenAI queries:

1. **GenAI - Operations Overview** - All AI operations via GenAI conventions
2. **GenAI - Token Usage Analysis** - Token consumption with cost estimates
3. **GenAI - Operation Errors** - Failed AI operations and error patterns
4. **GenAI - Prompt Analysis** - Prompt patterns and input analysis
5. **GenAI - Completion Finish Reasons** - Why AI completions ended

### Sample KQL Queries

#### 1. GenAI Operations Overview (Application Insights)

```kql
traces
| where timestamp > ago(24h)
| extend genAISystem = tostring(customDimensions.['gen_ai.system'])
| extend genAIModel = tostring(customDimensions.['gen_ai.request.model'])
| extend operationName = tostring(customDimensions.operationName)
| where isnotempty(genAISystem)
| summarize 
    TotalCalls = count(),
    AvgDuration = round(avg(duration), 2),
    P95Duration = round(percentile(duration, 95), 2)
    by genAISystem, genAIModel, operationName
| order by TotalCalls desc
```

#### 2. GenAI Token Usage with Cost Estimates (Application Insights)

```kql
traces
| where timestamp > ago(24h)
| extend genAIModel = tostring(customDimensions.['gen_ai.request.model'])
| extend promptTokens = toint(customDimensions.['gen_ai.usage.prompt_tokens'])
| extend completionTokens = toint(customDimensions.['gen_ai.usage.completion_tokens'])
| where isnotempty(genAIModel)
| summarize 
    TotalCalls = count(),
    TotalPromptTokens = sum(promptTokens),
    TotalCompletionTokens = sum(completionTokens),
    TotalTokens = sum(promptTokens) + sum(completionTokens),
    AvgPromptTokens = round(avg(promptTokens), 0),
    AvgCompletionTokens = round(avg(completionTokens), 0)
    by genAIModel
| extend EstimatedCostUSD = round(TotalTokens / 1000000.0 * 5, 4)
| order by TotalTokens desc
```

**Note**: Cost calculation uses `$5 per 1M tokens` as an example. Update based on your actual Azure OpenAI pricing:
- GPT-4: ~$30/1M input tokens, ~$60/1M output tokens
- GPT-4o: ~$5/1M input tokens, ~$15/1M output tokens
- GPT-4o-mini: ~$0.15/1M input tokens, ~$0.60/1M output tokens

#### 3. GenAI Errors (Application Insights)

```kql
traces
| where timestamp > ago(24h)
| extend genAISystem = tostring(customDimensions.['gen_ai.system'])
| extend statusCode = tostring(customDimensions.statusCode)
| extend errorType = tostring(customDimensions.errorType)
| where isnotempty(genAISystem) and (statusCode != "UNSET" or isnotempty(errorType))
| summarize 
    ErrorCount = count(),
    UniqueErrors = dcount(errorType)
    by genAISystem, errorType, statusCode
| order by ErrorCount desc
```

#### 4. GenAI Prompt Analysis (Application Insights)

```kql
traces
| where timestamp > ago(24h)
| extend genAIModel = tostring(customDimensions.['gen_ai.request.model'])
| extend prompt0Role = tostring(customDimensions.['gen_ai.prompt.0.role'])
| extend prompt0Content = tostring(customDimensions.['gen_ai.prompt.0.content'])
| where isnotempty(genAIModel)
| extend promptLength = strlen(prompt0Content)
| summarize 
    Count = count(),
    AvgPromptLength = round(avg(promptLength), 0),
    MaxPromptLength = max(promptLength)
    by genAIModel, prompt0Role
| order by Count desc
```

#### 5. GenAI Token Usage (Log Analytics)

```kql
AppTraces
| where TimeGenerated > ago(7d)
| extend genAIModel = tostring(Properties.['gen_ai.request.model'])
| extend promptTokens = toint(Properties.['gen_ai.usage.prompt_tokens'])
| extend completionTokens = toint(Properties.['gen_ai.usage.completion_tokens'])
| where isnotempty(genAIModel) and isnotempty(promptTokens)
| summarize 
    TotalCalls = count(),
    TotalPromptTokens = sum(promptTokens),
    TotalCompletionTokens = sum(completionTokens),
    TotalTokens = sum(promptTokens) + sum(completionTokens),
    AvgPromptTokens = round(avg(promptTokens), 0),
    AvgCompletionTokens = round(avg(completionTokens), 0)
    by genAIModel
| extend EstimatedCostUSD = round(TotalTokens / 1000000.0 * 5, 4)
| order by TotalTokens desc
```

#### 6. GenAI Completion Finish Reasons (Log Analytics)

```kql
AppTraces
| where TimeGenerated > ago(7d)
| extend genAIModel = tostring(Properties.['gen_ai.request.model'])
| extend finishReason = tostring(Properties.['gen_ai.response.finish_reasons'])
| where isnotempty(genAIModel) and isnotempty(finishReason)
| summarize Count = count() by genAIModel, finishReason
| extend Percentage = round(Count * 100.0 / toscalar(sum(Count)), 2)
| order by Count desc
```

## Finish Reasons

Common finish reasons returned by Azure OpenAI:

| Finish Reason | Description | Action |
|---------------|-------------|--------|
| `stop` | Completion finished naturally | Normal - no action needed |
| `length` | Hit max_tokens limit | Increase max_tokens if response truncated |
| `content_filter` | Content filtered by Azure content policy | Review prompt/content policy |
| `function_call` | Model called a function | Handle function call response |
| `tool_calls` | Model called tools | Handle tool calls response |

## Best Practices

### 1. Always Use Telemetry for AI Calls

```javascript
// ✅ GOOD: Always instrument AI calls
const span = createGenAISpan('operation', 'azure_openai', model)
try {
  // AI call
  recordCompletion(span, completion, finishReason)
  span.end()
} catch (error) {
  recordError(span, error)
  span.end()
}

// ❌ BAD: No telemetry
const response = await fetch(endpoint)
```

### 2. Record All Token Usage

```javascript
// ✅ GOOD: Record all tokens for cost tracking
recordTokenUsage(span, usage.prompt_tokens, usage.completion_tokens, usage.total_tokens)

// ❌ BAD: Missing token tracking
// (no recordTokenUsage call)
```

### 3. Always End Spans

```javascript
// ✅ GOOD: Always end spans in finally
try {
  // AI call
  span.end()
} catch (error) {
  recordError(span, error)
  span.end()  // Still end on error
}

// ❌ BAD: Span never ends
const span = createGenAISpan(...)
// forgot span.end()
```

### 4. Record Prompts Before Calls

```javascript
// ✅ GOOD: Record prompts before the call
recordPrompt(span, messages)
const response = await fetch(...)

// ❌ BAD: Record prompts after (may not capture on error)
const response = await fetch(...)
recordPrompt(span, messages)
```

### 5. Use Specific Operation Names

```javascript
// ✅ GOOD: Descriptive operation names
createGenAISpan('azure_openai_chat', 'azure_openai', model)
createGenAISpan('azure_openai_recommendations', 'azure_openai', model)

// ❌ BAD: Generic names
createGenAISpan('ai_call', 'azure_openai', model)
```

## Troubleshooting

### No AI Telemetry in Application Insights

1. **Check instrumentation is running**: Verify `instrumentation.ts` is being loaded
   ```bash
   # Check Next.js logs on startup for OpenTelemetry initialization
   pnpm run dev
   # Should see: "Azure Monitor OpenTelemetry initialized"
   ```

2. **Verify connection string**: Check `APPLICATIONINSIGHTS_CONNECTION_STRING` in `.env.local`
   ```bash
   # Format: InstrumentationKey=xxx;IngestionEndpoint=https://...
   ```

3. **Check AI endpoints are being called**: Test the AI endpoints
   ```bash
   # Test Azure AI chat
   curl -X POST http://localhost:3000/api/azure-ai-chat \
     -H "Content-Type: application/json" \
     -d '{"messages":[{"role":"user","content":"test"}]}'
   ```

4. **Query Application Insights**: Wait 1-5 minutes for data ingestion
   ```kql
   traces
   | where timestamp > ago(1h)
   | extend genAISystem = tostring(customDimensions.['gen_ai.system'])
   | where isnotempty(genAISystem)
   | take 10
   ```

### Token Usage Not Appearing

- Verify Azure OpenAI response includes `usage` object
- Check `recordTokenUsage()` is being called
- Ensure tokens are integers: `toint(customDimensions.['gen_ai.usage.prompt_tokens'])`

### Prompts/Completions Truncated

Application Insights has a 64KB limit per custom dimension. For large prompts/completions:

```javascript
// Truncate long content
const truncatedContent = content.length > 8000 
  ? content.substring(0, 8000) + '...[truncated]' 
  : content
recordCompletion(span, truncatedContent, finishReason)
```

## Cost Optimization

### 1. Monitor Token Usage

Set up alerts in Application Insights:

```kql
traces
| where timestamp > ago(1h)
| extend totalTokens = toint(customDimensions.['gen_ai.usage.total_tokens'])
| where isnotempty(totalTokens)
| summarize TotalTokens = sum(totalTokens)
| extend EstimatedCostUSD = TotalTokens / 1000000.0 * 5
| where EstimatedCostUSD > 10  // Alert if >$10/hour
```

### 2. Track High-Cost Operations

```kql
traces
| where timestamp > ago(24h)
| extend 
    model = tostring(customDimensions.['gen_ai.request.model']),
    totalTokens = toint(customDimensions.['gen_ai.usage.total_tokens'])
| where isnotempty(totalTokens)
| order by totalTokens desc
| take 20
```

### 3. Optimize Prompts

- Monitor `AvgPromptTokens` - reduce system prompts if high
- Check `gen_ai.response.finish_reasons` - if many "length", prompts may be too long
- Review `MaxPromptLength` to find outliers

## Related Documentation

- [OpenTelemetry Setup Guide](./OPENTELEMETRY-SETUP.md)
- [OpenTelemetry Queries Reference](./OPENTELEMETRY-QUERIES.md)
- [OpenTelemetry GenAI Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/)
- [Azure Monitor OpenTelemetry](https://learn.microsoft.com/en-us/azure/azure-monitor/app/opentelemetry-enable?tabs=nodejs)

## Next Steps

1. **Add more AI endpoints**: Instrument any additional AI/LLM API calls
2. **Create dashboards**: Build Application Insights dashboards for AI metrics
3. **Set up alerts**: Configure alerts for high costs, errors, or slow operations
4. **Track user feedback**: Correlate AI operations with user ratings/feedback
5. **A/B testing**: Compare different models, temperatures, or prompts
