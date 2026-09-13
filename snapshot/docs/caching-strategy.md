# API Response Caching Strategy

## Overview

Centralized caching system using Next.js `unstable_cache` for automatic revalidation and cache management.

## Cache Utility (`src/lib/cache.ts`)

### Available Functions

| Function | TTL | Use Case |
|----------|-----|----------|
| `cache1min` | 1 minute | Security alerts, real-time monitoring |
| `cache2min` | 2 minutes | Service health, sign-in logs |
| `cache5min` | 5 minutes | Users, groups, devices |
| `cache10min` | 10 minutes | Azure resources, Power Platform environments |
| `cache1hour` | 1 hour | Licensing, service principals, app registrations |
| `cacheCustom` | Custom | Any custom TTL needed |

### Helper Functions

- `generateCacheKey(prefix, params)` - Generate consistent cache keys from request parameters

## Implementation Examples

### Basic Usage

```typescript
import { cache5min, generateCacheKey } from '@/lib/cache'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const top = searchParams.get('$top') || '50'
  
  // Generate cache key from parameters
  const cacheKey = generateCacheKey('users', { top })
  
  // Cache the API call
  const data = await cache5min(cacheKey, async () => {
    const client = await getDelegatedGraphClient()
    return await client.api(`/users?$top=${top}`).get()
  })
  
  return NextResponse.json(data)
}
```

### With Query Parameters

```typescript
const cacheKey = generateCacheKey('users', {
  top: $top,
  skip: $skip,
  filter: $filter,
  search: search
})

const data = await cache5min(cacheKey, async () => {
  // Your API call here
})
```

### With Additional Tags

```typescript
// Add tags for targeted invalidation
const data = await cache5min(
  cacheKey,
  async () => { /* API call */ },
  ['users', 'graph-api'] // Additional tags
)
```

## Caching Recommendations by Route

### Microsoft Graph API

| Route | TTL | Reasoning |
|-------|-----|-----------|
| `/api/users` | 5 min | User data changes infrequently |
| `/api/groups` | 5 min | Group membership stable |
| `/api/devices` | 5 min | Device inventory doesn't change often |
| `/api/users/sign-in-logs` | 2 min | Recent activity, need freshness |
| `/api/security-alerts` | 1 min | Security requires real-time monitoring |
| `/api/service-health` | 2 min | Service status changes occasionally |
| `/api/applications` | 1 hour | App registrations stable |
| `/api/licensing` | 1 hour | License assignments change rarely |

### Azure Management API

| Route | TTL | Reasoning |
|-------|-----|-----------|
| `/api/azure/resources` | 10 min | Infrastructure changes slowly |
| `/api/azure/subscriptions` | 1 hour | Subscription list rarely changes |
| `/api/azure/cost-management` | 10 min | Cost data updates periodically |
| `/api/azure/advisor` | 10 min | Recommendations don't change often |
| `/api/azure/policy` | 10 min | Policy assignments stable |

### Power Platform API

| Route | TTL | Reasoning |
|-------|-----|-----------|
| `/api/power-platform/environments` | 10 min | Environments created/deleted infrequently |
| `/api/power-platform/apps` | 10 min | App deployments are occasional |
| `/api/power-platform/flows` | 10 min | Flows don't change frequently |
| `/api/power-platform/connectors` | 1 hour | Connector list very stable |

## Cache Invalidation

### Manual Invalidation

```typescript
import { revalidateTag } from 'next/cache'

// Invalidate specific cache tag
revalidateTag('users')

// Invalidate multiple tags
revalidateTag('graph-api')
```

### On-Demand Revalidation

Add `?nocache=1` query parameter to bypass cache for specific requests:

```typescript
const noCache = searchParams.get('nocache') === '1'

if (noCache) {
  // Skip cache, fetch fresh data
} else {
  // Use cached data
}
```

## Benefits

### Performance
- **5-10x faster page loads** - Data served from cache instead of waiting for API calls
- **Reduced latency** - No network round-trip to external APIs

### Cost Optimization
- **Lower API costs** - Fewer calls to Microsoft Graph/Azure (costs money at scale)
- **Bandwidth savings** - Reduced data transfer

### Rate Limiting
- **Prevent 429 errors** - Stay under API throttling limits
- **Better quota management** - Efficient use of Graph API quotas

### User Experience
- **Instant data display** - No loading spinners for cached data
- **Smoother navigation** - Consistent performance across pages

### Scalability
- **Handle more users** - Cache shared across requests
- **Lower backend load** - APIs called less frequently

## Migration Strategy

### Phase 1: High-Impact Routes (Immediate)
1. `/api/users` - Most frequently accessed, high API cost
2. `/api/azure/resources` - Slow queries on large subscriptions
3. `/api/power-platform/environments` - Called on every PP page load

### Phase 2: Medium-Impact Routes (Week 1)
1. All Graph list endpoints (groups, devices, applications)
2. Azure cost management and advisor
3. Power Platform apps and flows

### Phase 3: Low-Impact Routes (Week 2)
1. Service health and announcements
2. Licensing and subscriptions
3. Security alerts (short TTL)

## Testing

### Verify Caching Works

1. Check response headers:
```
X-Cache: HIT  // Cache hit
X-Cache: MISS // Cache miss
```

2. Monitor cache performance in Next.js:
```bash
# Development mode shows cache hits/misses
pnpm run dev
```

3. Test cache invalidation:
```typescript
// Force fresh data
fetch('/api/users?nocache=1')

// Normal cached request
fetch('/api/users')
```

## Best Practices

1. **Always use generateCacheKey** - Ensures consistent cache keys
2. **Include all relevant parameters** - Top, skip, filter, search, etc.
3. **Choose appropriate TTL** - Balance freshness vs performance
4. **Add cache tags** - Enable targeted invalidation
5. **Handle cache misses gracefully** - Always have fallback logic
6. **Monitor cache hit rate** - Optimize TTL based on usage patterns
7. **Document cache strategy** - Update this file when adding new routes

## Troubleshooting

### Cache Not Working

1. Check if `force-dynamic` is set on page:
```typescript
// Remove this to enable caching
export const dynamic = 'force-dynamic'
```

2. Verify cache key is consistent:
```typescript
console.log('Cache key:', cacheKey)
```

3. Check revalidate time:
```typescript
// Ensure revalidate is set
{ revalidate: 300 }
```

### Stale Data

1. Reduce TTL for that route
2. Add manual invalidation after mutations
3. Consider using `?nocache=1` for admin operations

### Memory Usage

1. Monitor Next.js cache size
2. Reduce TTL for low-value routes
3. Consider Redis for very large datasets

## Future Enhancements

1. **Redis integration** - For distributed caching across instances
2. **Cache warming** - Pre-populate cache on deployment
3. **Dynamic TTL** - Adjust based on data change frequency
4. **Cache analytics** - Track hit/miss rates and optimize
5. **Conditional requests** - Use ETag/If-None-Match headers
