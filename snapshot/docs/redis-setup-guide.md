# Redis Token Storage Setup Guide

## Overview

This application stores OAuth tokens server-side using Redis to prevent "431 Request Header Fields Too Large" errors. The implementation:
- **Uses Microsoft Entra ID authentication (recommended)** - passwordless, managed identity via official `@redis/entraid` package
- **Falls back to access keys** - legacy connection string method
- **Uses in-memory storage** - automatic fallback for development

**Redis Client Library**: Uses official `@redis/client` (node-redis v4) with `@redis/entraid` for Azure Managed Redis authentication, following [Redis.io best practices](https://redis.io/docs/latest/develop/clients/nodejs/amr/).

## Development (In-Memory Storage)

No configuration needed! The application automatically uses in-memory storage when Redis is not available.

**Limitations of In-Memory Storage:**
- Tokens are lost on server restart
- Not suitable for multiple server instances
- No automatic TTL (cleanup runs manually)

## Production (Azure Cache for Redis with Entra ID)

### Why Entra ID Authentication?

**Security Benefits:**
- ✅ **No passwords** - Uses managed identity tokens
- ✅ **Automatic rotation** - Tokens refresh automatically
- ✅ **Zero secrets** - No connection strings in config
- ✅ **Audit trail** - All access logged in Entra ID
- ✅ **RBAC** - Fine-grained role-based access control

**Comparison:**

| Feature | Entra ID | Access Keys |
|---------|----------|-------------|
| Password Required | ❌ No | ✅ Yes |
| Key Rotation | ❌ Not needed | ✅ Manual every 90 days |
| Secrets in Config | ❌ No | ✅ Yes (in connection string) |
| Managed Identity | ✅ Yes | ❌ No |
| Audit Logging | ✅ Comprehensive | ⚠️ Limited |
| Best Practice | ✅ **Recommended** | ⚠️ Legacy |

### Step 1: Create Azure Cache for Redis

```bash
# Login to Azure
az login

# Create resource group (if needed)
az group create --name rg-portal360-prod --location eastus

# Create Azure Cache for Redis with Entra ID enabled
az redis create \
  --resource-group rg-portal360-prod \
  --name portal360-redis \
  --location eastus \
  --sku Basic \
  --vm-size c0 \
  --enable-non-ssl-port false \
  --redis-version 6 \
  --minimum-tls-version 1.2

# Enable Microsoft Entra ID authentication (required for passwordless)
az redis update \
  --resource-group rg-portal360-prod \
  --name portal360-redis \
  --set redisConfiguration.aad-enabled=true
```

**Required Packages** (already installed):
```bash
pnpm add @redis/client @redis/entraid
```

**Pricing:**
- **Basic C0 (250MB)**: ~$15/month - Good for < 1000 active users
- **Basic C1 (1GB)**: ~$40/month - Good for 1000-5000 users
- **Standard C0 (250MB)**: ~$30/month - Includes replication/SLA
- **Standard C1 (1GB)**: ~$75/month - Production recommended

### Step 2: Enable Managed Identity on App Service

Your App Service needs a managed identity to authenticate to Redis:

```bash
# Enable system-assigned managed identity
az webapp identity assign \
  --resource-group rg-portal360-prod \
  --name portal360-app

# Get the principal ID (save this for next step)
PRINCIPAL_ID=$(az webapp identity show \
  --resource-group rg-portal360-prod \
  --name portal360-app \
  --query principalId -o tsv)

echo "Managed Identity Principal ID: $PRINCIPAL_ID"
```

### Step 3: Assign Redis Data Contributor Role

Grant the App Service managed identity permission to access Redis:

```bash
# Get Redis resource ID
REDIS_ID=$(az redis show \
  --resource-group rg-portal360-prod \
  --name portal360-redis \
  --query id -o tsv)

# Assign "Redis Cache Contributor" role
az role assignment create \
  --assignee $PRINCIPAL_ID \
  --role "Redis Cache Contributor" \
  --scope $REDIS_ID

# Assign "Redis Cache Data Owner" role (for read/write access)
az role assignment create \
  --assignee $PRINCIPAL_ID \
  --role "Redis Cache Data Owner" \
  --scope $REDIS_ID
```

**Available Roles:**
- **Redis Cache Data Owner** - Full read/write access (recommended for app)
- **Redis Cache Data Contributor** - Read/write data operations
- **Redis Cache Data Reader** - Read-only access
- **Redis Cache Contributor** - Manage Redis resource settings

### Step 4: Configure App Service Environment Variables

```bash
# Get Redis hostname
REDIS_HOST=$(az redis show \
  --resource-group rg-portal360-prod \
  --name portal360-redis \
  --query hostName -o tsv)

# Set environment variables
az webapp config appsettings set \
  --resource-group rg-portal360-prod \
  --name portal360-app \
  --settings \
    AZURE_REDIS_HOST="$REDIS_HOST" \
    AZURE_REDIS_USE_ENTRA_ID="true" \
    AZURE_REDIS_USERNAME="default"
```

**Or via Azure Portal:**
1. Navigate to App Service
2. Go to **Configuration** > **Application settings**
3. Add these settings:
   - **Name**: `AZURE_REDIS_HOST`, **Value**: `portal360-redis.redis.cache.windows.net`
   - **Name**: `AZURE_REDIS_USE_ENTRA_ID`, **Value**: `true`
   - **Name**: `AZURE_REDIS_USERNAME`, **Value**: `default`
4. Click **Save**

### Step 5: Test Locally (Optional)

To test Entra ID authentication locally, use Azure CLI credentials:

```bash
# Login with Azure CLI (uses your user account)
az login

# Set environment variables in .env.local
AZURE_REDIS_HOST=portal360-redis.redis.cache.windows.net
AZURE_REDIS_USE_ENTRA_ID=true
AZURE_REDIS_USERNAME=default

# Your user account needs "Redis Cache Data Owner" role
az role assignment create \
  --assignee your-email@example.com \
  --role "Redis Cache Data Owner" \
  --scope $REDIS_ID

# Run dev server
pnpm run dev
```

**Note**: `DefaultAzureCredential` will automatically use:
1. Environment variables (service principal)
2. Managed identity (in Azure)
3. Azure CLI credentials (local development)

### Step 6: Verify Configuration

Check that the environment variables are set:

```bash
az webapp config appsettings list \
  --resource-group rg-portal360-prod \
  --name portal360-app \
  --query "[?name=='AZURE_REDIS_HOST' || name=='AZURE_REDIS_USE_ENTRA_ID']"
```

## Legacy Setup (Access Keys - Not Recommended)

The TokenStore checks for Redis configuration in this order:

1. **`REDIS_URL`** - Standard Redis connection string
2. **`AZURE_REDIS_CONNECTION_STRING`** - Azure-specific connection string

## Environment Variables

The TokenStore checks for Redis configuration in this order:

1. **Entra ID Authentication (Recommended)** - Uses official `@redis/entraid` package:
   ```bash
   AZURE_REDIS_HOST=your-redis.redis.cache.windows.net
   AZURE_REDIS_USE_ENTRA_ID=true
   AZURE_REDIS_USERNAME=default
   ```
   
   **How it works**:
   - Uses `DefaultAzureCredential` from `@azure/identity`
   - Automatically refreshes tokens at 80% of lifetime (~50 minutes)
   - Retry policy: 3 attempts with exponential backoff
   - Scope: `https://redis.azure.com/.default` (via `REDIS_SCOPE_DEFAULT`)

2. **Connection String (Legacy)** - Still uses `@redis/client` but with password:
   ```bash
   # Development (local Redis)
   REDIS_URL=redis://localhost:6379

   # Production (Azure Cache for Redis with SSL and access keys)
   AZURE_REDIS_CONNECTION_STRING=rediss://:PASSWORD@your-redis.redis.cache.windows.net:6380
   ```

**Format:**

## Token Storage Details

### What Gets Stored

Each session stores:
```typescript
{
  accessToken: string,    // Microsoft Graph/Azure access token (~2-4KB)
  idToken: string,        // OpenID Connect ID token (~1-2KB)
  refreshToken: string,   // OAuth refresh token (~200 bytes)
  expiresAt: number       // Token expiration timestamp
}
```

**Total size per session**: ~4-7KB

### Storage Keys

- **Key format**: `token:{sessionId}`
- **Session ID**: UUID v4 (128-bit random)
- **TTL**: 24 hours (86400 seconds)

### Automatic Cleanup

**Redis mode:**
- Tokens automatically expire after 24 hours (handled by Redis TTL)
- No manual cleanup needed

**In-memory mode:**
- Cleanup runs every 10 minutes
- Removes tokens older than 24 hours
- Happens automatically in background

## Monitoring

### Check Redis Health

```bash
# Via Azure CLI
az redis show \
  --resource-group rg-portal360-prod \
  --name portal360-redis \
  --query "{name:name,provisioningState:provisioningState,redisVersion:redisVersion,sslPort:sslPort}"

# Test connection
redis-cli -h portal360-redis.redis.cache.windows.net -p 6380 --tls --pass YOUR_PASSWORD ping
# Expected output: PONG
```

### Monitor Metrics

**Via Azure Portal:**
1. Navigate to Redis resource
2. Go to **Metrics** blade
3. Monitor:
   - Connected Clients
   - Used Memory
   - Cache Hits/Misses
   - Operations per Second

**Via Azure CLI:**
```bash
# Get current memory usage
az redis show \
  --resource-group rg-portal360-prod \
  --name portal360-redis \
  --query "redisConfiguration.maxmemory"
```

### Application Logs

The TokenStore logs important events:

```typescript
// Check App Service logs
az webapp log tail \
  --resource-group rg-portal360-prod \
  --name portal360-app

// Look for:
// "✅ Redis client connected successfully"
// "⚠️ Redis unavailable, using in-memory storage"
// "❌ Redis operation failed: [error]"
```

## Troubleshooting

### "Redis unavailable, using in-memory storage"

**Causes:**
- Entra ID: Managed identity not configured or missing role assignment
- Entra ID: `DefaultAzureCredential` cannot find credentials
- Connection string: Redis server unreachable
- Network connectivity issues
- Redis credentials invalid (connection string mode)

**Solutions for Entra ID:**
1. Verify managed identity is enabled: `az webapp identity show ...`
2. Verify role assignment: `az role assignment list --assignee $PRINCIPAL_ID --scope $REDIS_ID`
3. Check Redis has Entra ID enabled: `az redis show ... --query redisConfiguration.aad-enabled`
4. Verify App Service logs for authentication errors
5. Test locally with `az login` and your user account

**Solutions for Connection String:**
1. Verify environment variable is set correctly
2. Check Redis is running: `az redis show ...`
3. Test connection: `redis-cli ... ping`
4. Verify firewall rules allow App Service access

### "ECONNREFUSED" or "ETIMEDOUT"

**Network connectivity issue:**
1. Verify Redis is in same region as App Service
2. Check Redis firewall rules (Azure Portal > Firewall)
3. Add App Service outbound IPs to Redis firewall
4. Enable **Public network access** in Redis settings

### "NOAUTH Authentication required"

**Entra ID mode:**
- Token refresh failed or credential not found
- Check App Service logs: `az webapp log tail ...`
- Verify managed identity has correct role

**Connection string mode:**
- Missing or incorrect password in connection string
- Regenerate Redis keys and update connection string
- Restart App Service

### Tokens Not Persisting

**In-memory mode issue:**
1. Verify Redis connection string is set
2. Check App Service logs for Redis connection errors
3. Restart App Service after setting environment variable

### Memory Usage Growing

**Too many sessions:**
1. Check Redis memory metrics
2. Verify TTL is set correctly (24 hours)
3. Consider scaling to larger Redis instance
4. Implement session cleanup on logout

## Security Best Practices

### 1. Use Microsoft Entra ID (Primary Recommendation)

✅ **Always prefer Entra ID over access keys:**
```bash
# ✅ Correct (Entra ID, no passwords)
AZURE_REDIS_HOST=portal360-redis.redis.cache.windows.net
AZURE_REDIS_USE_ENTRA_ID=true

# ❌ Avoid (access keys, passwords in config)
AZURE_REDIS_CONNECTION_STRING=rediss://:password@host:6380
```

### 2. Use SSL/TLS (Required)

Redis connections always use SSL (port 6380):
- Entra ID: Automatic via ioredis TLS config
- Connection string: Use `rediss://` (double 's')

### 3. Managed Identity Best Practices

**Use system-assigned identity** (simpler, automatic cleanup):
```bash
az webapp identity assign --resource-group rg --name app
```

**Assign least-privilege role**:
- App needs data access: `Redis Cache Data Owner` or `Redis Cache Data Contributor`
- App only reads: `Redis Cache Data Reader`

### 4. Rotate Credentials (Entra ID Only)

**No manual rotation needed!** Entra ID tokens:
- Refresh automatically every ~1 hour
- Expire after 24 hours
- Managed by Azure platform

**For access keys (legacy)**:
Rotate every 90 days:
```bash
# Regenerate secondary key first
az redis regenerate-keys --resource-group rg --name redis --key-type secondary
# Update app to use secondary key
# Wait 24 hours for old tokens to expire
# Regenerate primary key
az redis regenerate-keys --resource-group rg --name redis --key-type primary
```

### 5. Restrict Network Access

**Option 1: Firewall Rules**
```bash
# Add App Service outbound IPs
az redis firewall-rules create \
  --resource-group rg-portal360-prod \
  --name portal360-redis \
  --rule-name "AppService-Outbound" \
  --start-ip 1.2.3.4 \
  --end-ip 1.2.3.4
```

**Option 2: Private Endpoint**
1. Create VNet and subnet
2. Enable VNet integration on App Service
3. Create Redis private endpoint in same VNet
4. Disable public access on Redis

### 6. Monitor Access Logs

Enable Redis diagnostic logs:
```bash
az monitor diagnostic-settings create \
  --resource $(az redis show --resource-group rg-portal360-prod --name portal360-redis --query id -o tsv) \
  --name redis-diagnostics \
  --logs '[{"category": "ConnectedClientList", "enabled": true}]' \
  --workspace $(az monitor log-analytics workspace show --resource-group rg-portal360-prod --workspace-name portal360-logs --query id -o tsv)
```

**For Entra ID, also enable**:
- Sign-in logs in Entra ID (tracks token requests)
- Activity logs in Redis (tracks RBAC changes)

## Cost Optimization

### Right-Size Your Instance

**Estimate sessions:**
- Average session size: ~5KB
- 250MB cache = ~50,000 sessions
- With 24hr TTL = ~2,000 active users (assuming 1 session/user/day)

**Choose tier based on:**
- **< 1,000 users**: Basic C0 (250MB) - $15/month
- **1,000-5,000 users**: Basic C1 (1GB) - $40/month
- **5,000-10,000 users**: Standard C1 (1GB) - $75/month + HA
- **> 10,000 users**: Standard C2 (2.5GB) - $150/month

### Enable Cost Alerts

```bash
# Create cost alert
az consumption budget create \
  --budget-name redis-budget \
  --amount 50 \
  --resource-group rg-portal360-prod \
  --category Cost \
  --time-grain Monthly \
  --time-period-start-date "2025-01-01" \
  --threshold 80 \
  --notification-email your-email@example.com
```

## Migration Checklist

- [ ] Create Azure Cache for Redis
- [ ] Enable Entra ID authentication on Redis
- [ ] Enable system-assigned managed identity on App Service
- [ ] Assign "Redis Cache Data Owner" role to managed identity
- [ ] Add environment variables to App Service (`AZURE_REDIS_HOST`, `AZURE_REDIS_USE_ENTRA_ID=true`)
- [ ] Deploy updated code with TokenStore implementation
- [ ] Test login and verify tokens are stored
- [ ] Monitor Redis metrics for 24 hours
- [ ] Verify no 431 errors in logs
- [ ] Set up cost alerts
- [ ] Configure firewall rules (if needed)
- [ ] Enable diagnostic logging
- [ ] Document configuration in team wiki
- [ ] Remove legacy connection strings (if migrating from access keys)

## Rollback Plan

If Redis causes issues:

1. **Remove environment variables:**
   ```bash
   # For Entra ID setup
   az webapp config appsettings delete \
     --resource-group rg-portal360-prod \
     --name portal360-app \
     --setting-names AZURE_REDIS_HOST AZURE_REDIS_USE_ENTRA_ID AZURE_REDIS_USERNAME
   
   # For connection string setup
   az webapp config appsettings delete \
     --resource-group rg-portal360-prod \
     --name portal360-app \
     --setting-names AZURE_REDIS_CONNECTION_STRING
   ```

2. **Restart App Service:**
   ```bash
   az webapp restart \
     --resource-group rg-portal360-prod \
     --name portal360-app
   ```

3. Application automatically falls back to in-memory storage

**Note**: Sessions will be lost on rollback (users need to re-login)

## References

- **Official Redis Documentation**:
  - [Azure Managed Redis with Node.js](https://redis.io/docs/latest/develop/clients/nodejs/amr/) ⭐ **Primary reference**
  - [node-redis (Redis client)](https://redis.io/docs/latest/develop/clients/nodejs/)
  - [@redis/entraid Package](https://github.com/redis/node-redis/tree/master/packages/entraid)
- **Microsoft Azure**:
  - [Azure Cache for Redis with Entra ID](https://learn.microsoft.com/azure/azure-cache-for-redis/cache-azure-active-directory-for-authentication)
  - [Managed Identities for Azure Resources](https://learn.microsoft.com/azure/active-directory/managed-identities-azure-resources/overview)
  - [DefaultAzureCredential Documentation](https://learn.microsoft.com/javascript/api/@azure/identity/defaultazurecredential)
- **Other**:
  - [NextAuth.js JWT Strategy](https://next-auth.js.org/configuration/options#jwt)
