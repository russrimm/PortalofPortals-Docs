# URGENT: Azure AD Permission Fix Required

## The Issue
Your application is getting a **500 Internal Server Error** from the Power Automate API. This is a classic symptom of missing API permissions in your Azure AD app registration.

## Root Cause
The Azure AD app (Client ID: `32c72b33-a331-4545-ad5a-6d2fdf961c4c`) is missing the **Power Automate Service** API permission that allows it to read flows.

## Step-by-Step Fix (5-10 minutes)

### Step 1: Access Azure Portal
1. Go to https://portal.azure.com
2. Sign in with your **admin account** (must have permission to grant admin consent)

### Step 2: Find Your App Registration
1. In the search bar at top, type: `App registrations`
2. Click on **App registrations** service
3. Find your app by Client ID: `32c72b33-a331-4545-ad5a-6d2fdf961c4c`
   - OR search by the app name you gave it

### Step 3: Navigate to API Permissions
1. Click on your app registration to open it
2. In the left sidebar, click **API permissions**
3. You'll see a list of currently configured permissions

### Step 4: Check if Power Automate Service Already Exists
Look through the list for "Power Automate Service" or "Flow":
- **If found**: Check if it has a green checkmark under "Status" (admin consent granted)
  - If NO green checkmark: Jump to Step 6 (Grant Admin Consent)
  - If YES green checkmark: The permission exists but you need to sign out/in (jump to Step 7)
- **If NOT found**: Continue to Step 5

### Step 5: Add Power Automate Service Permission

#### 5a. Start Adding Permission
1. Click the **"+ Add a permission"** button (top of the list)
2. A side panel will open titled "Request API permissions"

#### 5b. Find Power Automate Service
1. Click the **"APIs my organization uses"** tab
2. In the search box, type: `Power Automate Service`
   - Alternative searches if not found: `Flow Service` or just `Flow`
3. Click on **"Power Automate Service"** when it appears in results

> **Important Note**: If "Power Automate Service" doesn't appear:
> - Someone in your tenant must first sign in to https://make.powerautomate.com
> - This registers the Power Automate service principal in your tenant
> - Have a user (or yourself) visit that URL, sign in, then try searching again

#### 5c. Select Delegated Permissions
1. You'll see two tabs: "Delegated permissions" and "Application permissions"
2. Make sure **"Delegated permissions"** tab is selected
3. Expand the permission groups if needed
4. Check the box next to: **Flows.Read.All**
   - This is the minimum permission needed to view flows
   - Optional: Also check **Flows.Manage.All** if you want to create/edit flows later

#### 5d. Complete Adding Permission
1. Click the **"Add permissions"** button at the bottom
2. You'll return to the API permissions list
3. You should now see "Power Automate Service" in the list with status "Not granted"

### Step 6: Grant Admin Consent
This is the critical step that makes the permission actually work:

1. Find the **"Grant admin consent for [Your Tenant Name]"** button
   - It's usually at the top of the permissions list
2. Click that button
3. A confirmation dialog will appear:
   - Title: "Grant admin consent confirmation"
   - Message: "The requested permissions will be granted to this application..."
4. Click **"Yes"** to confirm

5. Wait a few seconds for the process to complete
6. The Status column should change from "Not granted" to a **green checkmark ✅** with text "Granted for [tenant]"

> **If you don't see "Grant admin consent" button:**
> - You don't have admin privileges
> - Contact your Azure AD administrator
> - Send them this document and ask them to grant consent for app ID `32c72b33-a331-4545-ad5a-6d2fdf961c4c`

### Step 7: Refresh Your Authentication
The existing tokens in your session don't have the new permissions. You must:

1. **In Portal 360° application:**
   - Click your profile/user icon (usually top right)
   - Click **"Sign out"**
   - Wait for sign out to complete

2. **Sign back in:**
   - Click "Sign in" or go to https://portal360.yourdomain.com
   - Complete the Microsoft sign-in flow
   - **Important**: You may see a NEW consent screen asking to approve the new permissions
   - Click **"Accept"** if prompted

3. **Test the flows:**
   - Navigate to: Power Platform → Environments
   - Click on any environment (e.g., "Production")
   - Click the **"Flows"** button
   - **Expected**: Should now show your flows! 🎉

## Verification

### In Azure Portal
After granting consent, your API permissions list should show:
```
API / Permission name                          Type        Status
────────────────────────────────────────────────────────────────────
Power Automate Service / Flows.Read.All       Delegated   ✅ Granted for [tenant]
```

### In Your Application
After signing out and back in:
1. The flows button should work
2. Browser console should show: `[Flows API] Successfully parsed response. Flow count: [number]`
3. No 500 errors in Network tab

## Troubleshooting

### "Power Automate Service" not appearing in search
**Solution**: 
1. Open a new browser tab
2. Go to https://make.powerautomate.com
3. Sign in with your account
4. This registers the service principal
5. Go back to Azure Portal and search again

### Still getting 500 error after adding permission
**Checklist**:
- [ ] Did you click "Grant admin consent"?
- [ ] Is there a green checkmark next to the permission?
- [ ] Did you sign OUT of Portal 360°?
- [ ] Did you sign back IN to get a new token?
- [ ] Check browser console - does it show the new token audience?

### "Insufficient privileges" when granting consent
**Solution**:
- You need **Global Administrator** or **Privileged Role Administrator** role
- Contact your Azure AD admin to grant consent
- Give them this Client ID: `32c72b33-a331-4545-ad5a-6d2fdf961c4c`

### Error: "AADSTS65001: The user or administrator has not consented"
**Solution**:
- The consent wasn't properly granted
- Repeat Step 6 (Grant admin consent)
- Ensure you see the green checkmark

## Quick Reference: What You're Adding

| Setting | Value |
|---------|-------|
| **API Name** | Power Automate Service |
| **Resource App ID** | `7df0a125-d3be-4c96-aa54-591f83ff541c` |
| **Permission Name** | Flows.Read.All |
| **Permission Type** | Delegated |
| **Admin Consent Required** | Yes ✅ |
| **Description** | Allows the app to read flows on behalf of the signed-in user |

## Expected Timeline
- **Azure Portal changes**: Immediate (after clicking "Grant admin consent")
- **Token refresh**: Immediate (after signing out and back in)
- **Application working**: Within 1 minute of new sign-in

## Next Steps After Fix
Once flows are working:
1. Test with multiple environments
2. Verify flow details modal opens correctly
3. Consider adding `Flows.Manage.All` if you need to create/edit flows
4. Document this permission in your deployment guide

## Support
If you're still stuck after following all steps:
1. Check the browser console (F12) for detailed error messages
2. Check the Network tab → `/api/power-platform/flows` request
3. Look for the token payload logged in server console
4. The token `aud` (audience) should be: `https://service.flow.microsoft.com/`

---

**Remember**: The key is **Grant admin consent** + **Sign out/in**. Without both, it won't work!
