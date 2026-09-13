# Microsoft Defender for Endpoint (ATP) Integration

## Overview

This integration provides access to Microsoft Defender for Endpoint (formerly Windows Defender ATP) data through a Next.js application. It displays security alerts, enrolled devices, vulnerabilities, recommendations, and software inventory.

## Features

✅ **Security Alerts** - View and filter security alerts by severity and status  
✅ **Device Inventory** - See all enrolled devices with health status and risk scores  
✅ **Security Recommendations** - Get actionable security recommendations  
✅ **Vulnerability Management** - View device security states and threats  
✅ **Software Inventory** - Track installed software across your organization  

## Setup Instructions

### Step 1: Register Application in Microsoft Entra ID (Azure AD)

1. **Navigate to Azure Portal**
   - Go to [portal.azure.com](https://portal.azure.com)
   - Search for "Microsoft Entra ID" or "Azure Active Directory"

2. **Register a New Application**
   - In the left menu, click **App registrations**
   - Click **+ New registration**
   - Enter application details:
     - **Name**: `Portal360-DefenderATP` (or your preferred name)
     - **Supported account types**: Select "Accounts in this organizational directory only"
     - **Redirect URI**: Leave blank for now
   - Click **Register**

3. **Copy Application (Client) ID**
   - On the application overview page, copy the **Application (client) ID**
   - Save this as `DEFENDER_ATP_CLIENT_ID`

4. **Copy Directory (Tenant) ID**
   - Also on the overview page, copy the **Directory (tenant) ID**
   - Save this as `DEFENDER_ATP_TENANT_ID`

### Step 2: Create Client Secret

1. **Navigate to Certificates & secrets**
   - In your app registration, click **Certificates & secrets** in the left menu

2. **Create New Client Secret**
   - Click **+ New client secret**
   - Add a description: `Portal360 Defender ATP Secret`
   - Select expiration: Choose based on your security policy (6 months, 12 months, 24 months, or custom)
   - Click **Add**

3. **Copy the Secret Value**
   - **IMPORTANT**: Copy the secret **Value** immediately (not the Secret ID)
   - You cannot view this again after leaving the page
   - Save this as `DEFENDER_ATP_CLIENT_SECRET`

### Step 3: Grant API Permissions

1. **Navigate to API permissions**
   - In your app registration, click **API permissions** in the left menu

2. **Add Defender for Endpoint Permissions**
   - Click **+ Add a permission**
   - Select **APIs my organization uses**
   - Search for **"Microsoft Defender for Endpoint"** or **"WindowsDefenderATP"**
   - Click on **Microsoft Defender for Endpoint**

3. **Select Application Permissions** (not Delegated)
   - Click **Application permissions**
   - Select the permissions you need:

   **Recommended Permissions:**
   - `Alert.Read.All` - Read all alerts
   - `Machine.Read.All` - Read all machine information
   - `Vulnerability.Read.All` - Read vulnerability information
   - `SecurityRecommendation.Read.All` - Read security recommendations
   - `Software.Read.All` - Read software inventory

   **Optional Additional Permissions:**
   - `Alert.ReadWrite.All` - Read and update alerts
   - `Machine.ReadWrite.All` - Read and update machine information
   - `AdvancedQuery.Read.All` - Run advanced queries
   - `Ti.Read.All` - Read threat intelligence information
   - `File.Read.All` - Read file information
   - `Ip.Read.All` - Read IP information
   - `Url.Read.All` - Read URL information
   - `Score.Read.All` - Read exposure and security scores

4. **Grant Admin Consent**
   - Click **✔ Grant admin consent for [Your Organization]**
   - Confirm by clicking **Yes**
   - Status should change to "Granted for [Your Organization]"

### Step 4: Configure Environment Variables

1. **Open `.env.local` file** in your project root
   - If it doesn't exist, create it

2. **Add the following variables:**

```bash
# Microsoft Defender for Endpoint (ATP) Configuration
DEFENDER_ATP_TENANT_ID=your-tenant-id-here
DEFENDER_ATP_CLIENT_ID=your-application-client-id-here
DEFENDER_ATP_CLIENT_SECRET=your-client-secret-value-here
```

3. **Replace the placeholder values:**
   - `your-tenant-id-here` → Your Directory (tenant) ID from Step 1
   - `your-application-client-id-here` → Your Application (client) ID from Step 1
   - `your-client-secret-value-here` → Your client secret value from Step 2

4. **Save the file**

### Step 5: Restart Development Server

```bash
# Stop the current dev server (Ctrl+C)

# Restart the dev server
pnpm run dev
```

### Step 6: Access the Defender ATP Dashboard

1. Navigate to: `http://localhost:3000/defender-atp`
2. Sign in with your account
3. You should now see Defender for Endpoint data

## API Endpoints Available

The integration supports the following Defender for Endpoint API endpoints:

### 1. Alerts
**Endpoint:** `/api/alerts`  
**Description:** Retrieve security alerts  
**Filters:** Severity (High, Medium, Low, Informational), Status (New, InProgress, Resolved)

### 2. Machines
**Endpoint:** `/api/machines`  
**Description:** List all enrolled devices  
**Data:** Device name, OS, health status, risk score, last seen time

### 3. Recommendations
**Endpoint:** `/api/recommendations`  
**Description:** Security recommendations based on vulnerability assessments  
**Data:** Recommendation name, exposed devices count, product name

### 4. Vulnerabilities
**Endpoint:** `/api/machinesSecurityStates`  
**Description:** Device security states and detected threats  
**Data:** Device ID, malware execution state, last scan time

### 5. Software Inventory
**Endpoint:** `/api/Software`  
**Description:** Software installed across devices  
**Data:** Software name, vendor, version, device count, vulnerabilities

## Usage Examples

### Filtering Alerts

The Alerts tab includes filters:
- **Severity**: High, Medium, Low, Informational
- **Status**: New, In Progress, Resolved

Select filter options and click to apply. Results update automatically.

### Viewing Device Information

Click the **Devices** tab to see:
- Device names and IDs
- Operating system
- Health status (Active/Inactive)
- Risk score
- Last seen timestamp

### Security Recommendations

The **Security Recommendations** tab shows:
- Actionable recommendations
- Number of exposed devices
- Affected products

## Architecture

### Backend API Route
**File:** `src/app/api/defender-atp/route.js`

**Authentication Flow:**
1. Receives request with endpoint and parameters
2. Obtains access token using client credentials flow
3. Calls Defender for Endpoint API with Bearer token
4. Returns JSON response

**Token Scope:** `https://securitycenter.onmicrosoft.com/windowsatpservice/.default`

### Frontend Page
**File:** `src/app/defender-atp/page.jsx`

**Features:**
- Tab-based navigation for different data types
- Real-time filtering for alerts
- Responsive tables with color-coded status indicators
- Loading states and error handling
- Dark mode support

## OData Query Parameters

The API supports OData query parameters:

- `$top` - Limit number of results (default: 50)
- `$skip` - Skip N results for pagination
- `$filter` - Filter results (e.g., `severity eq 'High'`)
- `$orderby` - Sort results (e.g., `lastUpdateTime desc`)
- `$select` - Select specific fields
- `$expand` - Expand related entities

**Example API Call:**
```javascript
await fetch('/api/defender-atp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    endpoint: '/alerts',
    params: {
      $top: 20,
      $filter: "severity eq 'High'",
      $orderby: 'lastUpdateTime desc'
    }
  })
})
```

## Security Best Practices

### Application Permissions vs Delegated Permissions

This integration uses **Application Permissions** (client credentials flow):
- ✅ Suitable for background services and server-to-server communication
- ✅ No user interaction required
- ✅ Access granted at the organization level
- ⚠️ Requires admin consent

**Do NOT use Delegated Permissions** for this integration - they require user sign-in.

### Secret Management

- ✅ Store secrets in `.env.local` (never commit to Git)
- ✅ Add `.env.local` to `.gitignore`
- ✅ Rotate secrets regularly (every 6-12 months)
- ✅ Use Azure Key Vault for production deployments
- ❌ Never hardcode secrets in source code
- ❌ Never expose secrets in client-side code

### Principle of Least Privilege

- Only request permissions you actually need
- Start with read-only permissions
- Add write permissions only if required
- Regularly review and audit permissions

## Troubleshooting

### Error: "credentials not configured"

**Cause:** Environment variables are missing or incorrect

**Solution:**
1. Verify `.env.local` exists in project root
2. Check variable names are exactly:
   - `DEFENDER_ATP_TENANT_ID`
   - `DEFENDER_ATP_CLIENT_ID`
   - `DEFENDER_ATP_CLIENT_SECRET`
3. Restart dev server after adding variables

### Error: "Failed to obtain access token"

**Possible Causes:**
- Incorrect tenant ID
- Incorrect client ID
- Incorrect client secret
- Secret has expired

**Solution:**
1. Verify tenant ID matches your Azure AD tenant
2. Verify client ID matches your app registration
3. Generate a new client secret if expired
4. Ensure no extra spaces in environment variables

### Error: 403 Forbidden

**Cause:** Missing or insufficient API permissions

**Solution:**
1. Go to Azure Portal → App registrations → Your app
2. Click **API permissions**
3. Verify Microsoft Defender for Endpoint permissions are granted
4. Click **Grant admin consent** if not already granted
5. Wait 5-10 minutes for permission changes to propagate

### Error: No data returned

**Possible Causes:**
- No data available in Defender for Endpoint
- Filters too restrictive
- API permissions not granted

**Solution:**
1. Clear all filters
2. Check if you have devices enrolled in Defender for Endpoint
3. Verify API permissions are granted with admin consent
4. Check browser console for detailed error messages

## API Rate Limits

Microsoft Defender for Endpoint API has rate limits:

- **Resource limits:** 100 API calls per minute
- **HTTP 429 response:** Too many requests - back off and retry

The application automatically limits results to 50 items per request to stay within limits.

## Additional Resources

### Official Documentation
- [Defender for Endpoint API Overview](https://learn.microsoft.com/en-us/defender-endpoint/api/apis-intro)
- [Create App to Access API](https://learn.microsoft.com/en-us/defender-endpoint/api/exposed-apis-create-app-webapp)
- [API Reference](https://learn.microsoft.com/en-us/defender-endpoint/api/exposed-apis-list)
- [Alert Methods and Properties](https://learn.microsoft.com/en-us/defender-endpoint/api/alerts)
- [Machine Methods and Properties](https://learn.microsoft.com/en-us/defender-endpoint/api/machine)

### Authentication
- [OAuth 2.0 Client Credentials Flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-client-creds-grant-flow)
- [Get Access with Application Context](https://learn.microsoft.com/en-us/defender-endpoint/api/exposed-apis-create-app-webapp)

### Microsoft Defender Portal
- [Defender Portal](https://security.microsoft.com) - View alerts and devices in web UI
- [Defender for Endpoint](https://security.microsoft.com/machines) - Device inventory

## File Structure

```
src/
├── app/
│   ├── api/
│   │   └── defender-atp/
│   │       └── route.js          # Backend API route
│   └── defender-atp/
│       └── page.jsx               # Frontend dashboard page
docs/
└── defender-atp-integration.md    # This documentation
.env.local                          # Environment variables (create this)
```

## Next Steps

1. ✅ Complete setup steps above
2. ✅ Test the integration by navigating to `/defender-atp`
3. ✅ Customize UI to match your needs
4. ✅ Add additional API endpoints as required
5. ✅ Implement pagination for large datasets
6. ✅ Add export functionality (CSV/PDF)
7. ✅ Set up automated alerts or notifications

## Support

For issues or questions:
1. Check this documentation first
2. Review Microsoft Defender API documentation
3. Check Azure Portal for permission issues
4. Verify environment variables are set correctly
5. Check browser console for detailed error messages

---

**Last Updated:** November 29, 2025  
**Version:** 1.0  
**Status:** ✅ Production Ready
