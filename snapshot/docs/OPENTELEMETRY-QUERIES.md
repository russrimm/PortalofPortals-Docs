# OpenTelemetry Queries Reference

This document lists all the new OpenTelemetry queries added to the Application Insights AI Analysis and Log Analytics Explorer pages.

## Application Insights AI Analysis Page

Location: `/application-insights-exceptions`

### New Query Options:

#### 1. **OpenTelemetry Traces**
- **Description**: Distributed traces from OpenTelemetry instrumentation
- **Use case**: View all recent API requests traced by OpenTelemetry
- **Query**:
```kql
requests
| where timestamp > ago(7d)
| where cloud_RoleName == "pulse-360-portal"
| project timestamp, name, url, duration, resultCode, operation_Id, cloud_RoleName
| order by timestamp desc
| top 25 by timestamp desc
```

#### 2. **Slow OpenTelemetry Requests**
- **Description**: API requests taking longer than 1 second
- **Use case**: Identify performance bottlenecks
- **Query**:
```kql
requests
| where timestamp > ago(7d)
| where cloud_RoleName == "pulse-360-portal"
| where duration > 1000
| project timestamp, name, url, duration, resultCode, operation_Id
| order by duration desc
| top 25 by duration desc
```

#### 3. **OpenTelemetry Dependencies**
- **Description**: External API calls tracked by OpenTelemetry
- **Use case**: Analyze external service dependencies and their performance
- **Query**:
```kql
dependencies
| where timestamp > ago(7d)
| where cloud_RoleName == "pulse-360-portal"
| summarize Count=count(), AvgDuration=avg(duration), MaxDuration=max(duration) by target, type, name
| order by Count desc
| top 25 by Count desc
```

**Shows**:
- Microsoft Graph API calls
- Power Platform API calls
- Azure Resource Manager calls
- Any other external HTTP/HTTPS requests

#### 4. **OpenTelemetry Errors**
- **Description**: Failed requests and dependencies from OpenTelemetry
- **Use case**: Identify errors in your API routes and external calls
- **Query**:
```kql
union requests, dependencies
| where timestamp > ago(7d)
| where cloud_RoleName == "pulse-360-portal"
| where success == false
| project timestamp, itemType, name, target, duration, resultCode, problemId
| order by timestamp desc
| top 25 by timestamp desc
```

#### 5. **API Performance Summary**
- **Description**: Performance metrics by API endpoint
- **Use case**: Get a comprehensive performance overview with percentiles
- **Query**:
```kql
requests
| where timestamp > ago(7d)
| where cloud_RoleName == "pulse-360-portal"
| summarize 
    Count=count(), 
    AvgDuration=avg(duration), 
    P50=percentile(duration, 50), 
    P95=percentile(duration, 95), 
    P99=percentile(duration, 99), 
    Failures=countif(success == false) 
    by name
| extend FailureRate=round(Failures * 100.0 / Count, 2)
| order by Count desc
| top 25 by Count desc
```

**Metrics provided**:
- Request count
- Average duration
- P50, P95, P99 percentiles
- Failure count and rate

---

## Log Analytics Explorer Page

Location: `/log-analytics`

### New Query Options:

#### 1. **Application Insights - All Requests**
- **Description**: View all API requests from Application Insights
- **Use case**: General request monitoring
- **Query**:
```kql
AppRequests
| where TimeGenerated > ago(7d)
| project TimeGenerated, Name, Url, DurationMs, ResultCode, Success, OperationId
| order by TimeGenerated desc
| take 100
```

#### 2. **Application Insights - Slow Requests**
- **Description**: Requests taking longer than 1 second
- **Use case**: Performance troubleshooting
- **Query**:
```kql
AppRequests
| where TimeGenerated > ago(7d)
| where DurationMs > 1000
| project TimeGenerated, Name, Url, DurationMs, ResultCode, OperationId
| order by DurationMs desc
| take 50
```

#### 3. **Application Insights - Dependencies**
- **Description**: External API calls and dependencies
- **Use case**: Analyze integration points and external service performance
- **Query**:
```kql
AppDependencies
| where TimeGenerated > ago(7d)
| summarize Count=count(), AvgDuration=avg(DurationMs), MaxDuration=max(DurationMs) by Target, Type, Name
| order by Count desc
```

#### 4. **Application Insights - Exceptions**
- **Description**: Application exceptions and errors
- **Use case**: Error tracking and debugging
- **Query**:
```kql
AppExceptions
| where TimeGenerated > ago(7d)
| project TimeGenerated, ProblemId, ExceptionType, OuterMessage, OperationName, OperationId
| order by TimeGenerated desc
| take 100
```

#### 5. **Application Insights - Performance Summary**
- **Description**: Performance metrics by endpoint
- **Use case**: Comprehensive performance analysis
- **Query**:
```kql
AppRequests
| where TimeGenerated > ago(7d)
| summarize 
    Count=count(), 
    AvgDuration=avg(DurationMs), 
    P50=percentile(DurationMs, 50), 
    P95=percentile(DurationMs, 95), 
    P99=percentile(DurationMs, 99),
    Failures=countif(Success == false) 
    by Name
| extend FailureRate=round(Failures * 100.0 / Count, 2)
| order by Count desc
```

#### 6. **Application Insights - Failed Requests**
- **Description**: Failed API requests and error patterns
- **Use case**: Identify problematic endpoints
- **Query**:
```kql
AppRequests
| where TimeGenerated > ago(7d)
| where Success == false
| summarize Count=count(), AvgDuration=avg(DurationMs), ResultCodes=make_set(ResultCode) by Name, Url
| order by Count desc
```

#### 7. **OpenTelemetry - Distributed Traces**
- **Description**: End-to-end request traces from OpenTelemetry
- **Use case**: Trace requests through your application and external dependencies
- **Query**:
```kql
AppRequests
| where TimeGenerated > ago(7d)
| where AppRoleName == "pulse-360-portal"
| join kind=leftouter (
    AppDependencies
    | where TimeGenerated > ago(7d)
    | where AppRoleName == "pulse-360-portal"
) on OperationId
| project TimeGenerated, RequestName=Name, RequestUrl=Url, RequestDuration=DurationMs, DependencyName=Name1, DependencyTarget=Target, DependencyDuration=DurationMs1, OperationId
| order by TimeGenerated desc
| take 50
```

---

## Key Differences: Application Insights vs Log Analytics Tables

### Application Insights (Direct API)
Uses these table names:
- `requests` - HTTP requests
- `dependencies` - External calls
- `exceptions` - Errors
- `traces` - Log messages

### Log Analytics (Workspace)
Uses these table names:
- `AppRequests` - HTTP requests
- `AppDependencies` - External calls
- `AppExceptions` - Errors
- `AppTraces` - Log messages

Both contain the same data, just different access methods!

---

## Common Query Patterns

### Filter by Time Range
```kql
| where timestamp > ago(1h)    // Last hour
| where timestamp > ago(24h)   // Last 24 hours
| where timestamp > ago(7d)    // Last 7 days
| where timestamp > ago(30d)   // Last 30 days
```

### Filter by Service
```kql
| where cloud_RoleName == "pulse-360-portal"
| where AppRoleName == "pulse-360-portal"
```

### Aggregate Metrics
```kql
| summarize count() by name                          // Count by endpoint
| summarize avg(duration) by name                    // Average duration
| summarize percentile(duration, 95) by name         // P95 latency
| summarize countif(success == false) by name        // Count failures
```

### Join Requests with Dependencies
```kql
requests
| join kind=leftouter (dependencies) on operation_Id
| project timestamp, request_name=name, dependency_name=name1, dependency_target=target
```

---

## Useful Filters

### API Route Patterns
```kql
| where url contains "/api/power-platform"
| where url contains "/api/users"
| where url contains "/api/azure"
| where name startswith "GET /api/"
| where name startswith "POST /api/"
```

### Performance Thresholds
```kql
| where duration > 1000      // > 1 second
| where duration > 5000      // > 5 seconds
| where duration < 100       // < 100ms (very fast)
```

### Error Conditions
```kql
| where success == false
| where resultCode >= 400
| where resultCode == "500"
| where resultCode in ("401", "403", "404")
```

### External Services
```kql
| where target contains "graph.microsoft.com"
| where target contains "api.powerplatform.com"
| where target contains "management.azure.com"
| where type == "Http"
```

---

## Tips for Using the Queries

### 1. Adjust Time Range
Both pages have a time range selector. Common values:
- `1h` - Last hour
- `24h` - Last day
- `7d` - Last week (default)
- `30d` - Last month

### 2. Adjust Result Limit
The `{top}` parameter controls how many results to show (default: 25).

### 3. Combine Queries
You can edit the queries to combine filters:
```kql
requests
| where timestamp > ago(7d)
| where cloud_RoleName == "pulse-360-portal"
| where duration > 1000
| where url contains "/api/power-platform"
| order by duration desc
```

### 4. Export Results
Both pages support exporting query results for further analysis.

### 5. AI Analysis (Application Insights page only)
The Application Insights AI Analysis page can send results to Azure OpenAI for:
- Root cause analysis
- Fix recommendations
- Pattern detection
- Best practice suggestions

---

## Next Steps

1. ✅ Connection string configured in `.env.local`
2. ✅ OpenTelemetry instrumentation active
3. ⏳ Wait 5-10 minutes for first data
4. 📊 Try the queries!
5. 🔍 Customize queries for your needs
6. 📈 Create dashboards in Azure Portal

## Troubleshooting

**No results?**
- Check connection string is configured
- Verify app is running and receiving requests
- Wait 2-5 minutes for data pipeline
- Ensure `cloud_RoleName` matches "pulse-360-portal"

**Wrong service name?**
If your data shows a different service name, update the queries:
```kql
| where cloud_RoleName == "your-actual-service-name"
```

---

## Learn More

- [KQL Quick Reference](https://learn.microsoft.com/en-us/azure/data-explorer/kql-quick-reference)
- [Application Insights Schema](https://learn.microsoft.com/en-us/azure/azure-monitor/app/data-model-complete)
- [Log Analytics Schema](https://learn.microsoft.com/en-us/azure/azure-monitor/reference/tables/tables-category)
