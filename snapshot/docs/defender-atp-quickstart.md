# Defender ATP Integration - Quick Start

## What Was Created

✅ **Backend API Route** (`src/app/api/defender-atp/route.js`)
- Handles OAuth authentication with client credentials flow
- Fetches data from Microsoft Defender for Endpoint API
- Supports all major endpoints (alerts, machines, vulnerabilities, etc.)

✅ **Frontend Dashboard** (`src/app/defender-atp/page.jsx`)
- Tab-based UI for different data types
- Filtering for alerts (severity, status)
- Responsive tables with color-coded indicators
- Dark mode support

✅ **Documentation** (`docs/defender-atp-integration.md`)
- Complete setup instructions
- API endpoint reference
- Troubleshooting guide
- Security best practices

✅ **Environment Template** (`.env.defender-atp.template`)
- Template for required environment variables

## Setup Steps (5 Minutes)

### 1. Register App in Azure AD

Go to [Azure Portal](https://portal.azure.com) → **Microsoft Entra ID** → **App registrations** → **New registration**

**Copy these values:**
- Application (client) ID
- Directory (tenant) ID

### 2. Create Client Secret

In your app → **Certificates & secrets** → **New client secret**

**Copy:** Secret **Value** (not Secret ID)

### 3. Grant Permissions

In your app → **API permissions** → **Add a permission** → **Microsoft Defender for Endpoint**

**Select Application permissions:**
- `Alert.Read.All`
- `Machine.Read.All`
- `Vulnerability.Read.All`
- `SecurityRecommendation.Read.All`
- `Software.Read.All`

**Click:** ✔ Grant admin consent

### 4. Add to `.env.local`

```bash
DEFENDER_ATP_TENANT_ID=your-tenant-id-here
DEFENDER_ATP_CLIENT_ID=your-client-id-here
DEFENDER_ATP_CLIENT_SECRET=your-secret-here
```

### 5. Restart Server & Visit

```bash
pnpm run dev
```

Navigate to: `http://localhost:3000/defender-atp`

## Features

- 🚨 **Security Alerts** - Filter by severity and status
- 💻 **Devices** - View all enrolled devices with health status
- 💡 **Recommendations** - Get security recommendations
- 🔓 **Vulnerabilities** - View device security states
- 📦 **Software Inventory** - Track installed software

## Key Files

| File | Purpose |
|------|---------|
| `src/app/api/defender-atp/route.js` | Backend API handler |
| `src/app/defender-atp/page.jsx` | Frontend dashboard |
| `docs/defender-atp-integration.md` | Full documentation |
| `.env.local` | Configuration (create this) |

## API Usage

```javascript
// Call from frontend
const response = await fetch('/api/defender-atp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    endpoint: '/alerts',
    params: {
      $top: 50,
      $filter: "severity eq 'High'",
      $orderby: 'lastUpdateTime desc'
    }
  })
})
```

## Supported Endpoints

- `/alerts` - Security alerts
- `/machines` - Enrolled devices
- `/recommendations` - Security recommendations
- `/machinesSecurityStates` - Device vulnerabilities
- `/Software` - Software inventory
- [Full API list](https://learn.microsoft.com/en-us/defender-endpoint/api/exposed-apis-list)

## Troubleshooting

**No data showing?**
1. Check environment variables are set
2. Verify admin consent was granted
3. Ensure devices are enrolled in Defender
4. Check browser console for errors

**403 Forbidden?**
- Grant admin consent for API permissions
- Wait 5-10 minutes for changes to propagate

**401 Unauthorized?**
- Verify client ID, tenant ID, and secret are correct
- Check secret hasn't expired

## Security Notes

- Uses **Application permissions** (not delegated)
- Requires **admin consent**
- Store secrets in `.env.local` only
- Never commit secrets to Git
- Rotate secrets every 6-12 months

## Next Steps

1. Complete setup above
2. Test with your Defender data
3. Customize UI as needed
4. Add more endpoints
5. Implement pagination
6. Add export functionality

---

For detailed information, see: `docs/defender-atp-integration.md`
