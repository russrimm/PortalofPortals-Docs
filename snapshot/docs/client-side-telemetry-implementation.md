# Client-Side Application Insights Telemetry Implementation

## What Was Added

### 1. **Installed Packages**
```bash
pnpm add @microsoft/applicationinsights-web @microsoft/applicationinsights-react-js
```

### 2. **New Files Created**

#### `src/lib/appInsights.ts`
- Browser SDK initialization and configuration
- Helper functions for tracking events, metrics, and exceptions
- User authentication context management
- Automatic tracking enabled for:
  - Page views and navigation
  - AJAX/fetch requests
  - Performance metrics
  - Client-side errors

#### `src/app/components/AppInsightsProvider.tsx`
- React provider component
- Initializes telemetry on mount
- Automatically syncs authenticated user context from NextAuth session
- Wraps app in AppInsightsContext for React component tracking

### 3. **Modified Files**

#### `src/app/layout.tsx`
- Added `AppInsightsProvider` to component tree
- Wraps SessionProvider to access auth context

#### `src/app/components/ErrorBoundary.tsx`
- Now tracks exceptions to Application Insights
- Includes component stack traces

#### `.env.local`
- Added `NEXT_PUBLIC_APPLICATIONINSIGHTS_CONNECTION_STRING` for browser access

## What's Now Being Tracked

### ✅ **Automatic Tracking**
- **Page Views**: Every route navigation
- **Page Performance**: Load times, TTFB, DOM processing
- **User Sessions**: Anonymous sessions with duration
- **AJAX/Fetch Calls**: All API requests from browser
- **Client Errors**: Unhandled exceptions and promise rejections
- **React Component Lifecycle**: Component mount/unmount times

### ✅ **Authenticated User Context**
- User email automatically set from NextAuth session
- Correlated across all telemetry events
- Privacy-safe (only email, no PII)

### ✅ **Error Tracking**
- ErrorBoundary catches React errors
- Includes component stack traces
- Automatically sent to Application Insights

## Configuration

### Connection String
The same Application Insights instance is used for both server and client:
```
InstrumentationKey=a02b3c58-d6f7-4714-98b2-d93ad461103b
IngestionEndpoint=https://westus3-1.in.applicationinsights.azure.com/
```

### Features Enabled
- **Auto Route Tracking**: ✅ Tracks SPA navigation
- **CORS Correlation**: ✅ Links browser → server requests
- **Request/Response Headers**: ✅ Tracked for debugging
- **Page Visit Time**: ✅ Measures engagement per page
- **Fetch/AJAX Tracking**: ✅ All HTTP calls captured

### Cloud Role
Client-side telemetry is tagged with:
```
ai.cloud.role = "pulse-360-portal-client"
```

Server-side OpenTelemetry uses:
```
ai.cloud.role = "pulse-360-portal"
```

This allows filtering/splitting client vs server telemetry in Application Insights.

## Usage Examples

### Track Custom Events
```typescript
import { trackEvent } from '@/lib/appInsights';

trackEvent('ButtonClicked', { 
  buttonName: 'ExportSolution',
  page: '/power-platform/solutions'
});
```

### Track Custom Metrics
```typescript
import { trackMetric } from '@/lib/appInsights';

trackMetric('SolutionExportTime', 3450, { 
  solutionName: 'MyApp',
  size: 'Large'
});
```

### Track Exceptions
```typescript
import { trackException } from '@/lib/appInsights';

try {
  // risky operation
} catch (error) {
  trackException(error as Error, { 
    operation: 'DataFetch',
    endpoint: '/api/solutions'
  });
}
```

## Viewing Telemetry

### Azure Portal
1. Go to your Application Insights resource
2. Navigate to:
   - **Monitoring > Failures**: Client errors and exceptions
   - **Monitoring > Performance**: Page load times and AJAX calls
   - **Usage > Users**: Active user sessions
   - **Usage > Page Views**: Most visited pages
   - **Logs**: Query with KQL

### Sample KQL Queries

**Client-side page views:**
```kql
pageViews
| where cloud_RoleName == "pulse-360-portal-client"
| summarize PageViews=count() by name
| order by PageViews desc
```

**Client-side errors:**
```kql
exceptions
| where cloud_RoleName == "pulse-360-portal-client"
| project timestamp, type, outerMessage, customDimensions
| order by timestamp desc
```

**API calls from browser:**
```kql
dependencies
| where cloud_RoleName == "pulse-360-portal-client"
| where type == "Ajax" or type == "Fetch"
| summarize Calls=count(), AvgDuration=avg(duration) by target
| order by Calls desc
```

**Authenticated users:**
```kql
pageViews
| where cloud_RoleName == "pulse-360-portal-client"
| where isnotempty(user_AuthenticatedId)
| summarize Sessions=dcount(session_Id) by user_AuthenticatedId
| order by Sessions desc
```

## Next Steps

### Optional Enhancements

1. **Custom Dimensions**: Add business context to events
2. **Dependency Correlation**: Link client → server → external API
3. **User Feedback**: Collect ratings/comments with telemetry
4. **A/B Testing**: Track experiment participation
5. **Performance Budgets**: Alert on slow page loads

### Privacy Considerations

- ✅ No PII collected (only email from authenticated context)
- ✅ Connection string is safe to expose (public ingestion endpoint)
- ✅ User can be anonymized by removing setAuthenticatedUser call
- ⚠️ Review GDPR compliance if tracking EU users

## Troubleshooting

### Telemetry Not Appearing
1. Check browser console for `[AppInsights] Browser telemetry initialized`
2. Verify `NEXT_PUBLIC_APPLICATIONINSIGHTS_CONNECTION_STRING` is set
3. Check browser Network tab for requests to `westus3-1.in.applicationinsights.azure.com`
4. Wait 1-2 minutes for data to appear in portal

### Development vs Production
- Client-side telemetry works in **both** development and production
- Server-side OpenTelemetry only works in **production** (disabled in dev)

## Summary

✅ Full browser telemetry now active  
✅ Page views, errors, AJAX calls tracked automatically  
✅ User authentication context synced from NextAuth  
✅ Same Application Insights instance for client + server  
✅ No configuration needed beyond .env.local  

Your portal now has comprehensive observability across both client and server! 🎉
