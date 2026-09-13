# Azure App Service Deployment Guide - Solution Analysis

**Status:** The current implementation is Azure App Service ready.

## Current Architecture

The solution analysis route at `src/app/api/power-platform/solutions/analyze/route.js` uses:

- Delegated tokens for Dataverse access
- API key for Azure OpenAI access
- Pure Node.js runtime with no platform-specific dependencies

No platform-specific code changes are required for Azure App Service hosting.

## Optional Enhancement: Managed Identity for Azure OpenAI

To remove `AI_API_KEY` from app settings, use Managed Identity.

### Benefits

- No API key management in application settings
- Automatic credential rotation handled by Azure
- Improved auditing through Entra identity
- Works with private networking patterns

### Setup Steps

1. Enable system-assigned managed identity on the Azure Web App.
2. Grant the identity the appropriate role on the Azure OpenAI resource (for example, `Cognitive Services OpenAI User`).
3. Update application settings:
   - Keep `AI_ENDPOINT`
   - Remove `AI_API_KEY` after validation
4. Deploy and validate solution analysis end-to-end.

## Validation Checklist

- [ ] `POST /api/power-platform/solutions/analyze` returns a successful analysis
- [ ] Token acquisition and Dataverse export complete successfully
- [ ] Azure OpenAI call succeeds with managed identity (if enabled)
- [ ] Application logs contain no secret leakage

## Notes

- Keep existing timeout controls (`maxDuration`) based on expected export size.
- Keep authentication and authorization checks at the start of route handlers.
- Continue using server-side token acquisition paths (`getServerTokens`, delegated token helpers).
