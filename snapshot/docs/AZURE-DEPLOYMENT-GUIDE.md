# Azure App Service Deployment Guide

> [!NOTE]
> **Scope:** a conceptual walkthrough of how the App Service deployment fits
> together. Read it to understand the shape of the deployment.
> For production deployment, **[`DEPLOYMENT-CHECKLIST.md`](./DEPLOYMENT-CHECKLIST.md)
> is authoritative** — it is the only document kept in step with the deploy
> workflow, and it covers slots, health checks, scheduled jobs, and rollback.

## Configuration Summary

Your Next.js app is now configured for Azure App Service deployment with the following changes:

### 1. Files Created/Modified

#### `.deployment`
Tells Azure to **skip Oryx build** since Next.js should be built before deployment:
```
[config]
SCM_DO_BUILD_DURING_DEPLOYMENT = false
```

#### `startup.sh`
Custom startup command for Azure Linux App Service:
```bash
#!/bin/bash
export NODE_OPTIONS=--max-http-header-size=32768
pnpm start
```

#### `package.json` - Updated start script
Wrapped so the port and Node options are set consistently across platforms:
```json
"start": "node scripts/run-next.mjs start --default-port 8080"
```

#### `next.config.ts` - Added standalone output
Added `output: 'standalone'` for optimized Azure deployment.

---

## Deployment Steps

### Option 1: Deploy with Pre-Built Artifacts (Recommended)

1. **Build locally:**
   ```bash
   pnpm run build
   ```

2. **Deploy to Azure using ZIP deploy:**
   ```bash
   az webapp deployment source config-zip --resource-group <resource-group> --name <app-name> --src <path-to-zip>
   ```

   Or create a zip of your project (including `.next`, `node_modules`, `public`, `package.json`, etc.) and deploy via Azure Portal.

### Option 2: Deploy via GitHub Actions (CI/CD)

Create `.github/workflows/azure-deploy.yml`:

```yaml
name: Deploy to Azure App Service

on:
  push:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '24'
          
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
        
      - name: Build Next.js app
        run: pnpm run build
        
      - name: Deploy to Azure
        uses: azure/webapps-deploy@v2
        with:
          app-name: ${{ secrets.AZURE_WEBAPP_NAME }}
          publish-profile: ${{ secrets.AZURE_WEBAPP_PUBLISH_PROFILE }}
```

---

## Azure App Service Configuration

Set these **Application Settings** in Azure Portal:

```bash
# Required
NEXTAUTH_URL=https://your-app.azurewebsites.net
NEXTAUTH_SECRET=<your-secret>
AZURE_CLIENT_ID=<your-client-id>
AZURE_CLIENT_SECRET=<your-client-secret>
AZURE_TENANT_ID=<your-tenant-id>

# Optional - if different from package.json
WEBSITE_NODE_DEFAULT_VERSION=~22
```

### Startup Command (Azure Portal → Configuration → General Settings)

Set the startup command to:
```bash
bash startup.sh
```

Or directly:
```bash
NODE_OPTIONS=--max-http-header-size=32768 pnpm start
```

---

## Why This Approach?

### ❌ Problem: Oryx build fails for Next.js

Azure's Oryx build system:
- Runs `npm install --production` (missing devDependencies needed for build)
- Tries to run `pnpm run build` but environment variables may not be available
- Can timeout on large Next.js builds
- May not properly handle Next.js standalone builds

### ✅ Solution: Pre-build and deploy

1. **Build locally or in CI/CD** where you control the environment
2. **Skip Oryx build** with `.deployment` config
3. **Use standalone output** for smaller, faster deployments
4. **Simple startup** - just run the pre-built app

---

## Troubleshooting

### Check logs:
```bash
az webapp log tail --resource-group <resource-group> --name <app-name>
```

### Enable container logging:
```bash
az webapp log config --name <app-name> --resource-group <resource-group> --docker-container-logging filesystem
```

### Common issues:

1. **Port binding error**: Ensure your app listens on `process.env.PORT || 8080`
2. **Environment variables missing**: Set them in Azure Portal → Configuration
3. **App won't start**: Check startup.sh has Unix line endings (LF, not CRLF)
4. **404 errors**: Ensure `.next` folder is included in deployment

---

## File Checklist for Deployment

✅ Include in deployment:
- `.next/` (build output)
- `node_modules/` (or run `pnpm install --prod --frozen-lockfile` on Azure)
- `public/`
- `package.json`
- `pnpm-lock.yaml`
- `.deployment`
- `startup.sh`
- All environment-specific configs

❌ Exclude (add to `.gitignore`):
- `.env.local` (use Azure App Settings instead)
- `dev-*.log`
- `.vscode/`
- `tests/`
- `docs/`

---

## Performance Tips

1. **Use standalone output**: Already configured in `next.config.ts`
2. **Set NODE_ENV=production**: Azure sets this automatically
3. **Enable gzip compression**: Next.js handles this
4. **Use Azure CDN**: For static assets from `/public`
5. **Scale up**: Consider P1V2 or higher for production workloads

---

## Next Steps

1. Run `pnpm run build` to verify build works locally
2. Deploy to Azure using one of the methods above
3. Configure Application Settings in Azure Portal
4. Set startup command to `bash startup.sh`
5. Restart the app and check logs

For more details, see:
- [Azure App Service Node.js docs](https://learn.microsoft.com/en-us/azure/app-service/configure-language-nodejs)
- [Next.js deployment docs](https://nextjs.org/docs/deployment)
