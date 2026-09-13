# Production Deployment Checklist - Flows Fix

## Changes Deployed
✅ Updated flows API to use correct token scope (`https://service.flow.microsoft.com/`)
✅ Code committed and pushed to GitHub (commit: 03e0151)
✅ Azure App Service deployment triggered automatically

## Testing Steps

### 1. Wait for Azure App Service Deployment
- Check the Azure Portal (App Services → your app → Deployment Center) for deployment status
- Should take 1-3 minutes to complete
- Look for "Production Deployment" status

### 2. Test in Production
1. Go to https://portal360.yourdomain.com
2. Navigate to Power Platform > Environments
3. Click on the "Production" environment (or any environment with flows)
4. Click the "Flows" button
5. **Expected result**: Modal should show flows list (91 flows in Production environment)

### 3. Check Browser Console (if not working)
Open browser DevTools (F12) and look for:
- Any error messages in Console tab
- Network tab: Check `/api/power-platform/flows` request
  - Should return 200 OK (not 204 No Content)
  - Response should have `value` array with flows

## If Still Not Working

### Possible Issue: Missing Azure AD Permissions
The Azure AD app registration may not have Power Automate Service API permissions configured.

### How to Add Permissions

1. **Go to Azure Portal**
   - Navigate to https://portal.azure.com
   - Sign in with admin account

2. **Find Your App Registration**
   - Go to **Microsoft Entra ID**
   - Click **App registrations** (left sidebar)
   - Find the app: `32c72b33-a331-4545-ad5a-6d2fdf961c4c`
   - Or search by name (your app name)

3. **Check Current Permissions**
   - Click on your app registration
   - Go to **API permissions** (left sidebar)
   - Look for "Power Automate Service" or "Flow" in the list
   - If missing, proceed to next step

4. **Add Power Automate Service Permission**
   - Click **+ Add a permission**
   - Select **APIs my organization uses** tab
   - Search for: `Power Automate Service` or `Flow Service` or `Microsoft Flow`
   - Click on "Power Automate Service" in results
   - Select **Delegated permissions**
   - Check at minimum:
     * ✅ **Flows.Read.All** (required for viewing flows)
   - Optional (for more features):
     * ✅ Flows.Manage.All (for creating/updating flows)
     * ✅ Approvals.Read.All (for viewing approvals)
   - Click **Add permissions**

5. **Grant Admin Consent**
   - After adding permission, you'll see "Permission requested" status
   - Click **Grant admin consent for [Your Tenant]** button
   - Confirm in popup dialog
   - Status should change to green checkmark ✅

6. **Verify Permission Configuration**
   - The permission should now show:
     * Status: ✅ Granted for [Your Tenant]
     * Type: Delegated
     * API: Power Automate Service

### Alternative: Use PowerShell to Check Permissions
```powershell
# Connect to Azure AD
Connect-AzureAD

# Get app registration
$app = Get-AzureADApplication -Filter "AppId eq '32c72b33-a331-4545-ad5a-6d2fdf961c4c'"

# Check required resource access
$app.RequiredResourceAccess | ForEach-Object {
    $resource = $_
    Write-Host "Resource: $($resource.ResourceAppId)"
    $resource.ResourceAccess | ForEach-Object {
        Write-Host "  Permission: $($_.Id) - Type: $($_.Type)"
    }
}
```

### Power Automate Service Application ID
- **Resource App ID**: `7df0a125-d3be-4c96-aa54-591f83ff541c`
- If you see this ID in the RequiredResourceAccess, the permission is configured

## After Granting Permissions

1. **Sign out and sign in again** to Portal 360°
   - This ensures you get a fresh token with new permissions
   - Old tokens don't automatically get updated permissions

2. **Test again**
   - Navigate to Environments
   - Click Flows button
   - Should now work!

## Troubleshooting

### Error: "Failed to acquire Power Automate token"
- **Cause**: User hasn't consented to new permissions
- **Fix**: Sign out and sign in again

### Still getting 204 No Content
- **Cause**: Permission granted but user doesn't have access to flows in that environment
- **Check**: 
  - Does the signed-in user have Power Automate license?
  - Does the user have Maker or Admin role in that environment?
  - Log in to https://make.powerautomate.com and verify you can see flows there

### 401 Unauthorized
- **Cause**: Admin consent not granted
- **Fix**: Follow "Grant Admin Consent" step above

### 403 Forbidden
- **Cause**: User doesn't have permission to view flows in environment
- **Fix**: Grant user appropriate role in Power Platform admin center

## Success Indicators

✅ API returns HTTP 200 OK (not 204)
✅ Response includes `value` array with flow objects
✅ Modal displays flows with names, states, and descriptions
✅ Browser console shows: "Successfully parsed response. Flow count: [number]"

## Contact
If issues persist after following all steps, check:
1. Azure App Service deployment logs for any build/runtime errors
2. Browser console for client-side errors
3. Network tab in DevTools for exact API response
