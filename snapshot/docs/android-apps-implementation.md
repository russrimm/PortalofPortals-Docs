# Android Apps Implementation Summary

## Overview
This document describes the implementation of Android app support in the Intune Apps page, as requested per Microsoft documentation: https://learn.microsoft.com/en-us/graph/api/intune-apps-androidstoreapp-list

## Date
January 14, 2025

## Important Note: Graph API SELECT Clause Limitation

**Issue Discovered:** Microsoft Graph API does not support including platform-specific properties (like `packageId`, `appStoreUrl`, `versionName`, `versionCode`) in the `$select` clause when querying the base `/deviceAppManagement/mobileApps` endpoint. These properties only exist on derived types like `androidStoreApp`, `iosStoreApp`, etc.

**Error Example:**
```
Graph API error 400: Could not find a property named 'packageId' on type 'microsoft.graph.mobileApp'
```

**Solution:** Remove the `$select` clause entirely. When you query without `$select`, Microsoft Graph automatically returns all properties appropriate to each app's specific type, including platform-specific properties like:
- Android: `packageId`, `appStoreUrl`, `versionName`, `versionCode`, `minimumSupportedOperatingSystem`
- iOS: `bundleId`, `buildNumber`, `versionNumber`, `appStoreUrl`, `minimumSupportedOperatingSystem`
- Windows: `fileName`, `productCode`, `installCommandLine`, `uninstallCommandLine`

## Changes Made

### 1. API Route Enhancement (`src/app/api/intune/managed-apps/route.js`)

#### Removed SELECT Clause
**Critical Fix:** Removed the `$select` parameter from the Graph API query to allow automatic inclusion of platform-specific properties. The endpoint now queries:
```javascript
let url = `${BASE_V1}?$top=999`
```

Instead of attempting to explicitly select Android properties, we let Microsoft Graph return all properties based on each app's specific type (`@odata.type`).

**Why This Works:**
- Each app in the response has a different `@odata.type` (e.g., `#microsoft.graph.androidStoreApp`, `#microsoft.graph.iosVppApp`)
- Graph API automatically includes type-specific properties when no `$select` is specified
- Android apps automatically include: `packageId`, `appStoreUrl`, `versionName`, `versionCode`, `minimumSupportedOperatingSystem`
- iOS apps automatically include: `bundleId`, `buildNumber`, `versionNumber`
- Windows apps automatically include: `fileName`, `productCode`, `installCommandLine`

#### Enhanced mapApp Function
Updated the app mapping function to:
- Better detect Android app types (Store App, Managed Store, For Work, LOB)
- Set specific `appType` values for different Android variants
- Properly extract Android-specific fields (packageId, appStoreUrl, versionName, versionCode, minimumSupportedOperatingSystem)
- Use `versionName` or `versionCode` as fallback for the version field

**Android App Types Detected:**
- `androidStoreApp` → "Android Store App"
- `androidManagedStoreApp` → "Android Managed Store"
- `androidForWorkApp` → "Android for Work"
- `androidLobApp` → "Android LOB App"

### 2. UI Enhancement (`src/app/application-management/intune-apps/page.jsx`)

#### Table View Updates
- Added new "Type" column after Platform column to display app type (e.g., "Android Store App", "iOS Store App")
- Updated table header and data rows
- Updated empty state colspan from 6 to 7

#### Android Details Section
Enhanced the Android-specific details modal section to display:
- **Package ID** - Android package identifier (e.g., `com.example.app`)
- **Version Name** - Human-readable version (e.g., "1.2.3")
- **Version Code** - Internal version number
- **Min OS Version** - Minimum supported Android version with smart version detection (4.0+ through 11.0+)
- **Play Store URL** - Direct link to Google Play Store with external link indicator

#### Modal Header Enhancement
Added app type badge to the details modal header alongside platform badge for quick identification.

### 3. Details Endpoint (`src/app/api/intune/managed-apps/[id]/route.js`)

The individual app details endpoint already supported Android-specific fields:
- `packageId`
- `minimumSupportedOperatingSystem`
- `versionName`
- `versionCode`
- `appStoreUrl`

No changes were required to this endpoint.

## Technical Implementation Notes

### Graph API Endpoint
Uses the existing `/deviceAppManagement/mobileApps` endpoint which returns ALL mobile app types including:
- iOS apps (Store, VPP, LOB)
- Android apps (Store, Managed Store, For Work, LOB)
- Windows apps (LOB, Office Suite, MSI)
- macOS apps (LOB)
- Web apps

### Platform Detection
Platform is detected via `@odata.type` field pattern matching:
```javascript
if (/ios/i.test(type)) platform = 'iOS'
else if (/android/i.test(type)) platform = 'Android'
else if (/windows/i.test(type)) platform = 'Windows'
else if (/mac/i.test(type)) platform = 'macOS'
else if (/web/i.test(type)) platform = 'Web'
```

### App Type Detection
More granular app type detection for Android:
```javascript
if (type.includes('androidStoreApp')) appType = 'Android Store App'
else if (type.includes('androidManagedStoreApp')) appType = 'Android Managed Store'
else if (type.includes('androidForWorkApp')) appType = 'Android for Work'
else if (type.includes('androidLobApp')) appType = 'Android LOB App'
```

### Minimum OS Version Display
The `minimumSupportedOperatingSystem` field is an object with version properties like:
```json
{
  "v4_0": true,
  "v5_0": false,
  "v6_0": false,
  // ...
}
```

The UI checks each version flag and displays the highest supported version (e.g., "Android 4.0+" if only v4_0 is true).

## Permissions Required

### Microsoft Graph API Permission
- **DeviceManagementApps.Read.All** (Application permission)

This permission is already configured in the app registration and is required to access the `/deviceAppManagement/mobileApps` endpoint.

## Testing Recommendations

1. **Verify Android Apps Display**
   - Navigate to `/application-management/intune-apps`
   - Confirm Android apps appear with green platform badge
   - Verify "Type" column shows specific Android app types

2. **Test Details Modal**
   - Click on an Android app row
   - Verify "Android App Details" section appears
   - Confirm Package ID, Version Name, Version Code, Min OS Version, and Play Store URL display correctly

3. **Test Play Store Link**
   - Click Play Store URL link
   - Confirm it opens in new tab with Google Play Store page

4. **Verify No Regressions**
   - Confirm iOS apps still display iOS-specific fields
   - Confirm Windows apps still display Windows-specific fields
   - Verify all other app platforms display correctly

## Future Enhancements (Potential)

- Add filter by platform/app type
- Add search by package ID
- Show app icon if available from Play Store metadata
- Display app ratings/reviews from Play Store
- Add bulk operations for Android apps
- Show app installation statistics by Android version

## References

- [Microsoft Graph - List Android Store Apps](https://learn.microsoft.com/en-us/graph/api/intune-apps-androidstoreapp-list)
- [Android Store App Resource Type](https://learn.microsoft.com/en-us/graph/api/resources/intune-apps-androidstoreapp)
- [Mobile App Resource Type](https://learn.microsoft.com/en-us/graph/api/resources/intune-apps-mobileapp)
