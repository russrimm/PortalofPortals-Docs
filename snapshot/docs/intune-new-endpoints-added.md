# New Intune Graph API Endpoints Added

## Overview

Based on analysis of the [Microsoft Graph PowerShell Intune samples repository](https://github.com/microsoftgraph/powershell-intune-samples), I've identified and implemented 9 popular missing API endpoints that are frequently used by Intune administrators but were not yet available in your application.

---

## 📋 All New Endpoints

### 1. **App Configuration Policies**
**File**: `/src/app/api/intune/app-configuration-policies/route.js`
**Endpoint**: `GET /api/intune/app-configuration-policies`

Fetches both MAM (Mobile Application Management) and MDM (Mobile Device Management) app configuration policies:
- **Targeted Managed App Configurations** - For apps without device enrollment
- **Mobile App Configurations** - For enrolled devices

**Features**:
- Returns both policy types
- Includes app assignments and policy assignments
- Summary statistics

**Required Permission**: `DeviceManagementApps.Read.All`

**PowerShell Sample References**:
- `Applications/MobileAppConfiguration_Get.ps1`
- `AppConfigurationPolicy/AppConfigurationPolicy_Export.ps1`

---

### 2. **Managed App Registrations**
**File**: `/src/app/api/intune/managed-app-registrations/route.js`
**Endpoint**: `GET /api/intune/managed-app-registrations`

Tracks which users and devices have MAM policies applied and their compliance status.

**Features**:
- Query by specific user or get all registrations
- Shows applied and intended policies per registration
- Platform breakdown (iOS, Android, Windows)
- Protection status statistics

**Required Permission**: `DeviceManagementApps.Read.All`

**PowerShell Sample References**:
- `AppProtectionPolicy/ManagedAppPolicy_AppRegistrationSummary.ps1`
- `UserPolicyReport/User_MAM_Report_Get.ps1`

---

### 3. **Remote Device Actions**
**File**: `/src/app/api/intune/device-actions/route.ts`
**Endpoint**: `POST /api/intune/device-actions`

Invokes remote management actions on devices.

**Supported Actions**:
- `remoteLock` - Lock device remotely
- `wipe` - Factory reset device
- `retire` - Remove company data
- `delete` - Remove from management
- `sync` - Force sync with Intune
- `rebootNow` - Restart device
- `shutDown` - Shut down (Windows only)
- `resetPasscode` - Reset device passcode
- `windowsDefenderScan` - Run Defender scan
- `windowsDefenderUpdateSignatures` - Update signatures
- `enableLostMode`/`disableLostMode` - iOS supervised
- `locateDevice` - iOS/macOS location
- `bypassActivationLock` - iOS supervised

The public action names remain `sync` and `delete`. Both the generic route and
the bespoke `/api/device-management/devices/{id}/syncDevice` route use the shared
dispatcher. The browser still sends POST requests to the portal, protected by
the existing session, `portal.write`, device-ID validation, and CSRF checks.

| Public action | Delegated Microsoft Graph request | Request body | Required permission |
| --- | --- | --- | --- |
| `sync` | `POST /deviceManagement/managedDevices/{id}/syncDevice` | None | `DeviceManagementManagedDevices.PrivilegedOperations.All` |
| `delete` | `DELETE /deviceManagement/managedDevices/{id}` | None | `DeviceManagementManagedDevices.ReadWrite.All` |

These follow the [syncDevice contract](https://learn.microsoft.com/en-us/graph/api/intune-devices-manageddevice-syncdevice?view=graph-rest-1.0)
and [managedDevice deletion contract](https://learn.microsoft.com/en-us/graph/api/intune-devices-manageddevice-delete?view=graph-rest-1.0).
Deletion removes the managed-device record; it is not a substitute for retire
or wipe. The dispatcher retains its existing Graph beta client selection and
the other actions' payloads.

Successful remote-action responses mean the command was dispatched, not that
the device finished it. Success audit details record `status: dispatched`;
provider failures record failure instead and return a sanitized production
error. Platform action availability in the device UI is unchanged.

**Response compatibility:** Success response fields and command-sent wording
are unchanged. Production errors no longer expose upstream diagnostic text;
403 uses an action-neutral permission message because delete and sync require
different permissions. Provider error statuses are retained, missing delegated
session tokens return 401, and consent failures retain the shared
`reauth_required` response and required scopes. Development diagnostics still
come from the shared error helper.

**PowerShell Sample References**:
- `ManagedDevices/Invoke_DeviceAction_Set.ps1`

---

### 4. **Enrollment Restrictions**
**File**: `/src/app/api/intune/enrollment-restrictions/route.js`
**Endpoint**: `GET /api/intune/enrollment-restrictions`

Controls which devices can enroll and what platforms are allowed.

**Features**:
- Platform restrictions (iOS, Android, Windows, macOS)
- Device type restrictions (personal vs corporate)
- Device enrollment limits
- Windows Hello for Business configuration
- Apple-specific restrictions
- Assignment details

**Required Permission**: `DeviceManagementServiceConfig.Read.All`

**PowerShell Sample References**:
- `EnrollmentRestrictions/DeviceEnrollmentRestrictions_Get.ps1`

---

### 5. **RBAC Roles**
**File**: `/src/app/api/intune/rbac-roles/route.js`
**Endpoint**: `GET /api/intune/rbac-roles`

Manages Intune role-based access control.

**Features**:
- Built-in and custom role definitions
- Role permissions breakdown
- Optional role assignments with expansion
- Categorization by type

**Required Permission**: `DeviceManagementRBAC.Read.All`

**PowerShell Sample References**:
- `RBAC/RBAC_Get.ps1`
- `RBAC/RBAC_Export.ps1`

---

### 6. **Terms and Conditions**
**File**: `/src/app/api/intune/terms-and-conditions/route.ts`
**Endpoints**:
- `GET /api/intune/terms-and-conditions`
- `POST /api/intune/terms-and-conditions`
- `PATCH /api/intune/terms-and-conditions`
- `DELETE /api/intune/terms-and-conditions?id={id}`

Enrollment terms that users must accept.

**Features**:
- All T&C policies
- User acceptance status (optional)
- Version tracking
- Assignment details
- Acceptance statistics
- Full create / update / delete authoring from `/device-management/terms-and-conditions`
- Optional version bump on update to force users to re-accept modified terms

**Required Permission**: `DeviceManagementServiceConfig.Read.All` for `GET`,
`DeviceManagementServiceConfig.ReadWrite.All` for `POST` / `PATCH` / `DELETE`.
Write operations additionally require the `portal.write` portal permission and
emit `IntuneTermsAndConditions{Create,Update,Delete}` audit events.

**PowerShell Sample References**:
- `TermsAndConditions/TermsAndConditions_Get.ps1`
- `TermsAndConditions/TermsAndConditions_Add.ps1`

---

### 7. **Primary User Management**
**File**: `/src/app/api/intune/devices/[deviceId]/primary-user/route.js`
**Methods**: `GET`, `POST`, `DELETE`

Manages the primary user assignment for managed devices.

**Operations**:
- **GET** - Retrieve current primary user
- **POST** - Set/update primary user
- **DELETE** - Remove primary user assignment

**Required Permissions**: 
- Read: `DeviceManagementManagedDevices.Read.All`
- Write: `DeviceManagementManagedDevices.ReadWrite.All`

**PowerShell Sample References**:
- `ManagedDevices/Win10_PrimaryUser_Get.ps1`
- `ManagedDevices/Win10_PrimaryUser_Set.ps1`
- `ManagedDevices/Win10_PrimaryUser_Delete.ps1`

---

### 8. **Android Enterprise**
**File**: `/src/app/api/intune/android-enterprise/route.js`
**Endpoint**: `GET /api/intune/android-enterprise`

Android Enterprise (work profile and fully managed) settings.

**Features**:
- Enterprise binding status
- Device Owner enrollment profiles (dedicated devices)
- Android For Work settings
- App sync status
- Configuration validation

**Required Permission**: `DeviceManagementConfiguration.Read.All`

**PowerShell Sample References**:
- `AndroidEnterprise/Get-AndroidDedicatedDeviceProfiles.ps1`
- `AndroidEnterprise/Get-AndroidWorkProfileConfiguration.ps1`

---

### 9. **Apple Enrollment**
**File**: `/src/app/api/intune/apple-enrollment/route.js`
**Endpoint**: `GET /api/intune/apple-enrollment`

Apple Device Enrollment Program and related services.

**Features**:
- DEP/ABM onboarding settings
- VPP (Volume Purchase Program) tokens
- APNs certificate status
- Token expiration warnings (30-day threshold)
- Apple ID associations
- Sync status

**Required Permission**: `DeviceManagementServiceConfig.Read.All`

**PowerShell Sample References**:
- `AppleEnrollment/APNS_Get.ps1`
- `AppleEnrollment/AppleDEP_Sync.ps1`
- `AppleEnrollment/AppleDEPProfile_Assign.ps1`

---

## 🗺️ Navigation Updates

All new endpoints have been added to the navigation menu under **Intune** with appropriate categorization:

### **Applications** (Updated)
- App Configuration Policies *(new)*
- Managed App Registrations *(new)*

### **Enrollment & Provisioning** (New Category)
- Enrollment Restrictions
- Terms and Conditions
- Apple Enrollment (DEP/ABM/VPP/APNs)
- Android Enterprise

### **Security & Access** (New Category)
- RBAC Roles

---

## 📚 Missing Endpoints Still Available in PowerShell Samples

The following are available in the PowerShell repo but not implemented (less commonly used):

1. **Corporate Device Enrollment** - Bulk device identifiers
2. **Notification Messages** - Custom enrollment notifications
3. **Company Portal Branding** - Portal customization settings
4. **Windows Defender Advanced Threat Protection** - WDATP onboarding
5. **Telecom Expense Management** - TEM connectors
6. **Remote Action Audit** - Detailed action history (already have general audit logs)
7. **Software Update Policies** - macOS/iOS update policies (have Windows)
8. **Certificate Profiles** - SCEP/PKCS certificates
9. **VPN/Wi-Fi Profiles** - Network configuration
10. **Email Profiles** - Email configuration

---

## ✅ Implementation Details

### Code Quality
- ✅ All endpoints use proper error handling
- ✅ Permission requirements documented
- ✅ JSDoc comments with Microsoft Learn references
- ✅ Consistent response format
- ✅ Beta API usage where appropriate
- ✅ Parallel data fetching with Promise.all() where beneficial

### Security
- ✅ Server-side only (no client token exposure)
- ✅ Uses existing `getDelegatedGraphClient()` helper
- ✅ Proper permission checks
- ✅ 403/404 error handling

### Documentation
- ✅ Each endpoint has inline documentation
- ✅ API reference links to Microsoft Learn
- ✅ Required permissions listed
- ✅ Request/response examples in comments
- ✅ Updated README.md with new routes

---

## 🎯 Usage Examples

### Get App Configuration Policies
```bash
curl http://localhost:3000/api/intune/app-configuration-policies
```

### Invoke Remote Device Action
```bash
curl -X POST http://localhost:3000/api/intune/device-actions \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"device-guid","action":"remoteLock"}'
```

### Get Enrollment Restrictions
```bash
curl http://localhost:3000/api/intune/enrollment-restrictions
```

### Get RBAC Roles with Assignments
```bash
curl http://localhost:3000/api/intune/rbac-roles?includeAssignments=true
```

### Set Primary User
```bash
curl -X POST http://localhost:3000/api/intune/devices/device-id/primary-user \
  -H "Content-Type: application/json" \
  -d '{"userId":"user-guid"}'
```

### Get Apple Enrollment Status
```bash
curl http://localhost:3000/api/intune/apple-enrollment
```

---

## 📖 Reference

All implementations are based on popular scripts from the official repository:
**https://github.com/microsoftgraph/powershell-intune-samples**

The implementations follow Microsoft Graph API best practices and use the same endpoints as the PowerShell samples, ensuring compatibility and consistency with Microsoft's recommendations.
