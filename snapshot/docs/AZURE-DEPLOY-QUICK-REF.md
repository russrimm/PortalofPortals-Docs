# Azure Deployment Quick Reference

> [!NOTE]
> **Scope:** a fast orientation on *why* the Oryx build is skipped and what the
> moving parts are. It is not a deployment procedure.
> For production deployment, **[`DEPLOYMENT-CHECKLIST.md`](./DEPLOYMENT-CHECKLIST.md)
> is authoritative** — it covers app registration, permissions, secrets, slots,
> health checks, scheduled jobs, and rollback.

## To answer your question: Skip Oryx Build

**YES, you should skip the Oryx build process.**

Your Next.js app should be **built before deployment**, not during the Oryx build step.

## What was changed:

1. **`.deployment`** - Tells Azure: `SCM_DO_BUILD_DURING_DEPLOYMENT = false`
2. **`package.json`** - Start script wraps Next.js so the port and Node options are set consistently: `node scripts/run-next.mjs start --default-port 8080`
3. **`next.config.ts`** - Added `output: 'standalone'` for optimized Azure deployment
4. **`startup.sh`** - Custom startup script with proper environment variables

## Quick Deploy Steps:

```bash
# 1. Build locally
pnpm run build

# 2. Verify build worked
ls -la .next/

# 3. Deploy via Azure CLI (or zip upload in Portal)
az webapp deployment source config-zip \
  --resource-group <your-rg> \
  --name <your-app-name> \
  --src deployment.zip

# 4. Set startup command in Azure Portal
# Configuration → General Settings → Startup Command:
bash startup.sh
```

## Why skip Oryx build?

- ❌ Oryx runs `npm install --production` (missing devDependencies for build)
- ❌ Environment variables might not be available during Oryx build
- ❌ Can timeout on large Next.js builds
- ✅ Better to build in controlled CI/CD environment
- ✅ Faster deployments with pre-built artifacts
- ✅ More reliable and predictable

## What Oryx does when you DON'T skip:

1. Detects Node.js via package.json
2. Runs `npm install --production`
3. Runs `pnpm run build` (if exists)
4. This often FAILS for Next.js because:
   - Missing devDependencies (like `@types/*`)
   - Environment variables not set
   - Build timeouts

## What happens when you skip Oryx build:

1. Azure just extracts your zip
2. Runs your startup command (`bash startup.sh`)
3. Your pre-built `.next/` folder is used
4. App starts immediately with `pnpm start`

## Troubleshooting:

**Build fails locally?**
- Check devDependencies are installed
- Verify environment variables in .env.local
- Run `pnpm run build` to see exact error

**App won't start on Azure?**
- Check logs: `az webapp log tail --name <app> --resource-group <rg>`
- Verify startup.sh has Unix line endings (LF not CRLF)
- Ensure PORT is being used: `startup.sh` exports `PORT` (default 8080) and the standalone `server.js` respects it

**Still getting Oryx build?**
- Verify `.deployment` file exists in root
- Check file has correct content: `SCM_DO_BUILD_DURING_DEPLOYMENT = false`
- Redeploy after adding the file

## See full guide:
→ `docs/AZURE-DEPLOYMENT-GUIDE.md`
