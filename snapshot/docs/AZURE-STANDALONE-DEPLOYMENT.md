# Azure App Service Standalone Deployment Guide

> [!NOTE]
> **Scope:** the deep technical reference for how `output: 'standalone'` is
> packaged and what the deployment artifact must contain. Use it when
> troubleshooting a build or packaging problem.
> For production deployment, **[`DEPLOYMENT-CHECKLIST.md`](./DEPLOYMENT-CHECKLIST.md)
> is authoritative** — start there and come back here for detail.

This guide explains how to deploy the Next.js app to Azure App Service using **standalone mode** (pre-built, no Oryx build).

## Prerequisites

✅ `output: 'standalone'` is configured in `next.config.ts`  
✅ `.deployment` file disables Oryx: `SCM_DO_BUILD_DURING_DEPLOYMENT = false`

## Build Process

### 1. Build Locally

```bash
pnpm install
pnpm run build
```

This creates:
- `.next/standalone/` - Minimal Node.js server + dependencies
- `.next/static/` - Static assets (JS, CSS, images)
- `public/` - Public static files

### 2. Prepare Deployment Package

After build completes, you need to deploy these files to Azure:

```
.next/standalone/          → Deploy to /home/site/wwwroot/
.next/static/              → Deploy to /home/site/wwwroot/.next/static/
public/                    → Deploy to /home/site/wwwroot/public/
```

**Important:** The standalone folder contains a minimal `node_modules` with only production dependencies.

## Deployment Options

### Option A: Manual Deployment via Azure Portal

1. **Zip the files:**
   ```powershell
   # Create deployment package
   Compress-Archive -Path .\.next\standalone\*, .\.next\static, .\public -DestinationPath deploy.zip -Force
   ```

2. **Upload via Kudu:**
   - Go to: `https://<your-app>.scm.azurewebsites.net/ZipDeployUI`
   - Drag and drop `deploy.zip`

### Option B: Azure CLI Deployment

```bash
# Build
pnpm run build

# Create deployment structure
New-Item -ItemType Directory -Force -Path .\deploy
Copy-Item -Recurse .\.next\standalone\* .\deploy\
Copy-Item -Recurse .\.next\static .\deploy\.next\static
Copy-Item -Recurse .\public .\deploy\public

# Zip and deploy
Compress-Archive -Path .\deploy\* -DestinationPath deploy.zip -Force
az webapp deployment source config-zip --resource-group <rg-name> --name <app-name> --src deploy.zip
```

### Option C: GitHub Actions CI/CD

Create `.github/workflows/azure-deploy.yml`:

```yaml
name: Deploy to Azure App Service

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Build Next.js
        run: pnpm run build
        env:
          # Build-time env vars (if needed)
          NEXT_PUBLIC_AZURE_TENANT_ID: ${{ secrets.AZURE_TENANT_ID }}
      
      - name: Prepare deployment package
        run: |
          mkdir -p deploy
          cp -r .next/standalone/* deploy/
          cp -r .next/static deploy/.next/static
          cp -r public deploy/public
      
      - name: Deploy to Azure Web App
        uses: azure/webapps-deploy@v2
        with:
          app-name: '<your-app-name>'
          publish-profile: ${{ secrets.AZURE_WEBAPP_PUBLISH_PROFILE }}
          package: ./deploy
```

## Azure App Service Configuration

### Application Settings (Environment Variables)

Go to **Azure Portal** → **App Service** → **Configuration** → **Application settings**:

> **Never paste real secret values into this file, a commit message, or a chat.**
> Client secrets belong in Azure Key Vault, referenced from App Service as
> `@Microsoft.KeyVault(SecretUri=https://<vault>.vault.azure.net/secrets/<name>/)`.
> Better still, drop the client secret entirely and use a
> [federated credential](https://learn.microsoft.com/entra/workload-id/workload-identity-federation)
> or the App Service managed identity so there is no long-lived secret to leak.

```
AZURE_CLIENT_ID=<app-client-id>
AZURE_CLIENT_SECRET=@Microsoft.KeyVault(SecretUri=https://<vault>.vault.azure.net/secrets/azure-client-secret/)
AZURE_TENANT_ID=<tenant-id>
AZURE_SUBSCRIPTION_ID=<subscription-id>

NEXTAUTH_URL=https://<your-app>.azurewebsites.net
AUTH_SECRET=@Microsoft.KeyVault(SecretUri=https://<vault>.vault.azure.net/secrets/auth-secret/)
NEXTAUTH_SECRET=@Microsoft.KeyVault(SecretUri=https://<vault>.vault.azure.net/secrets/auth-secret/)

AUTH_AZURE_AD_CLIENT_ID=<app-client-id>
AUTH_AZURE_AD_CLIENT_SECRET=@Microsoft.KeyVault(SecretUri=https://<vault>.vault.azure.net/secrets/azure-client-secret/)
AUTH_AZURE_AD_TENANT_ID=<tenant-id>

# Add all other required vars from .env.local
```

### Startup Command

Go to **Configuration** → **General settings** → **Startup Command**:

```bash
node server.js
```

**Note:** The standalone build creates a `server.js` file that already includes the `NODE_OPTIONS=--max-http-header-size=32768` setting.

### Stack Settings

- **Runtime Stack**: Node 20 LTS or Node 24 LTS
- **Platform**: 64-bit
- **Always On**: Enabled (recommended)

### Hosted Power Platform MCP Endpoint

Portal 360 includes a hosted Power Platform MCP endpoint at:

```text
https://<your-app>.azurewebsites.net/api/mcp/power-platform
```

This runs inside the same Next.js App Service process, so no extra MCP worker is required. The endpoint exposes environment, cloud flow, app, solution, connector, DLP policy, environment settings, Copilot governance, application package, security recommendation, and cross-tenant connection report tools using server-side credentials only.

Required App Service settings are the same Power Platform/Dataverse server credentials used by the app:

```text
AZURE_TENANT_ID=<tenant-id>
AZURE_CLIENT_ID=<app-client-id>
AZURE_CLIENT_SECRET=<app-client-secret>

# Optional if Dataverse uses a separate app registration
DATAVERSE_TENANT_ID=<tenant-id>
DATAVERSE_CLIENT_ID=<dataverse-client-id>
DATAVERSE_CLIENT_SECRET=<dataverse-client-secret>
```

The app registration needs enough Power Platform access for the tools you intend to use. For tenant-wide environment/DLP discovery, grant the service principal Power Platform Administrator or equivalent admin access. For Dataverse-backed flow, solution, and run-history tools, add the app registration as an Application User in each target environment with the appropriate Dataverse security role.

For the optional Power Platform Admin API governance tools, grant the relevant `Power Platform API` application permissions, then admin-consent them:

```text
EnvironmentManagement.Environments.Read
EnvironmentManagement.Settings.Read
EnvironmentManagement.Settings.ReadWrite
CopilotGovernance.Features.Read
CopilotGovernance.Settings.Read
CopilotGovernance.Settings.Write
Security.Recommendations.Read
Analytics.AdvisorRecommendations.Read
Governance.CrossTenantConnectionReports.Read
Connectivity.Connectors.Read
PowerApps.Apps.Read
AppManagement.ApplicationPackages.Read
AppManagement.ApplicationPackages.Install
```

State-changing MCP tools require an exact confirmation phrase in the tool input and write a sensitive-action audit record. Keep the read-only tools available broadly, but grant write permissions only to the production app registration if you intend to allow agent-assisted settings updates, Copilot governance updates, or application package installation.

The MCP route is protected by Portal 360 authentication. Do not expose OAuth access tokens to MCP clients or the browser; use the authenticated portal session and keep upstream API tokens server-side.

## Verify Deployment

1. **Check logs:**
   ```bash
   az webapp log tail --name <app-name> --resource-group <rg-name>
   ```

2. **Test the app:**
   ```bash
   curl https://<your-app>.azurewebsites.net
   ```

3. **Monitor startup:**
   - Azure Portal → **App Service** → **Log stream**
   - Should see: `Ready on http://0.0.0.0:8080`

## Troubleshooting

### Error: "Cannot find module"
- Ensure `.next/standalone/` folder was deployed
- Verify folder structure matches: `/home/site/wwwroot/server.js`

### Error: "Missing environment variables"
- Check Application Settings in Azure Portal
- Restart the app after adding settings

### Port Binding Issues
- Azure automatically sets `PORT=8080`
- Standalone server.js uses `process.env.PORT`
- No manual port configuration needed

## File Structure After Deployment

```
/home/site/wwwroot/
├── server.js                    # Main entry point
├── package.json                 # Minimal package.json
├── node_modules/                # Only production deps
├── .next/
│   ├── standalone/              # (not needed if deployed correctly)
│   └── static/                  # Static assets
├── public/                      # Public files
└── ...other server files
```

## Benefits of Standalone Mode

- ✅ **Faster deployments** - No build time on Azure
- ✅ **Smaller footprint** - Only production dependencies
- ✅ **Consistent builds** - Build once, deploy many times
- ✅ **CI/CD friendly** - Build in pipeline, deploy artifacts
- ✅ **Reduced cold starts** - No build process to wait for

## PowerShell Deployment Script

Save as `deploy-azure-standalone.ps1`:

```powershell
#!/usr/bin/env pwsh
param(
    [Parameter(Mandatory=$true)]
    [string]$ResourceGroup,
    
    [Parameter(Mandatory=$true)]
    [string]$AppName
)

Write-Host "Building Next.js application..." -ForegroundColor Cyan
pnpm run build

if ($LASTEXITCODE -ne 0) {
    Write-Error "Build failed!"
    exit 1
}

Write-Host "Preparing deployment package..." -ForegroundColor Cyan
$deployPath = ".\deploy-temp"
Remove-Item -Recurse -Force $deployPath -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $deployPath | Out-Null

# Copy standalone output
Copy-Item -Recurse .\.next\standalone\* $deployPath\

# Copy static assets
New-Item -ItemType Directory -Force -Path "$deployPath\.next\static" | Out-Null
Copy-Item -Recurse .\.next\static\* "$deployPath\.next\static\"

# Copy public files
Copy-Item -Recurse .\public $deployPath\public

Write-Host "Creating deployment archive..." -ForegroundColor Cyan
$zipPath = ".\deploy.zip"
Remove-Item -Force $zipPath -ErrorAction SilentlyContinue
Compress-Archive -Path "$deployPath\*" -DestinationPath $zipPath -Force

Write-Host "Deploying to Azure App Service..." -ForegroundColor Cyan
az webapp deployment source config-zip `
    --resource-group $ResourceGroup `
    --name $AppName `
    --src $zipPath

if ($LASTEXITCODE -eq 0) {
    Write-Host "Deployment successful!" -ForegroundColor Green
    Write-Host "App URL: https://$AppName.azurewebsites.net" -ForegroundColor Cyan
    
    # Cleanup
    Remove-Item -Recurse -Force $deployPath
    Remove-Item -Force $zipPath
} else {
    Write-Error "Deployment failed!"
    exit 1
}
```

**Usage:**
```powershell
.\deploy-azure-standalone.ps1 -ResourceGroup "my-rg" -AppName "my-app"
```
