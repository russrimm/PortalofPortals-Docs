# Virtual Machine Creation Implementation

## Overview
Added comprehensive VM creation capability to the Azure Virtual Machines page, allowing users to create new VMs directly from the UI using the Azure Management API.

## Date
December 4, 2025

## Implementation Details

### API Route Updates (`src/app/api/azure/virtual-machines/route.js`)

**New PUT Endpoint** (lines before POST endpoint):
- Handles VM creation requests
- Validates required parameters:
  - `vmName` - Name of the virtual machine
  - `resourceGroup` - Resource group to create VM in
  - `location` - Azure region (e.g., eastus, westus)
  - `vmSize` - VM size (e.g., Standard_B2s, Standard_D2s_v3)
  - `adminUsername` - Administrator username
  - `adminPassword` - Administrator password
  - `osType` - Operating system type (Windows/Linux)

**VM Configuration**:
- Automatically configures hardware profile with selected VM size
- Sets up storage profile with OS disk (Standard_LRS managed disk)
- Configures OS profile with admin credentials
- Creates network profile with:
  - Network interface configuration
  - Public IP address (dynamic allocation)
  - Network security group with default rules:
    - Windows: Allow RDP (port 3389)
    - Linux: Allow SSH (port 22)
- Uses default images:
  - Windows: Windows Server 2022 Datacenter
  - Linux: Ubuntu Server 18.04 LTS

**API Call**:
```
PUT https://management.azure.com/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Compute/virtualMachines/{vmName}?api-version=2025-04-01
```

### UI Updates (`src/app/azure/virtual-machines/page.jsx`)

**New State Variables**:
- `showCreateModal` - Controls create VM modal visibility
- `creating` - Tracks VM creation operation status
- `createFormData` - Stores form input values:
  ```javascript
  {
    vmName: '',
    resourceGroup: '',
    location: 'eastus',
    vmSize: 'Standard_B2s',
    adminUsername: '',
    adminPassword: '',
    osType: 'Linux'
  }
  ```

**New Functions**:
- `createVM()` - Handles VM creation:
  1. Sends PUT request to API endpoint with form data
  2. Displays success message on completion
  3. Refreshes VM list after 2-second delay
  4. Resets form and closes modal

**UI Components**:
1. **Create VM Button** (added to header):
   - Green button with "+ Create VM" label
   - Opens creation modal

2. **Create VM Modal**:
   - Full-screen overlay with centered modal
   - Prevents closing during creation operation
   - Form fields organized in 2-column grid:
     * **VM Name** - Text input (required)
     * **Resource Group** - Text input (required)
     * **Location** - Dropdown with 7 Azure regions
     * **VM Size** - Dropdown with 4 common VM sizes
     * **Operating System** - Dropdown (Linux/Windows)
     * **Admin Username** - Text input (required)
     * **Admin Password** - Password input with requirements hint
   - Info banner explaining creation time (5-10 minutes)
   - Action buttons:
     * Cancel - Closes modal (disabled during creation)
     * Create VM - Submits form (disabled if required fields missing)

**Available Options**:

*Locations*:
- East US
- West US
- Central US
- West Europe
- North Europe
- Southeast Asia
- East Asia

*VM Sizes*:
- Standard_B1s (1 vCPU, 1 GB RAM) - Basic
- Standard_B2s (2 vCPU, 4 GB RAM) - Basic (default)
- Standard_D2s_v3 (2 vCPU, 8 GB RAM) - General purpose
- Standard_D4s_v3 (4 vCPU, 16 GB RAM) - General purpose

*Operating Systems*:
- Linux (Ubuntu 18.04 LTS) - Default
- Windows (Windows Server 2022)

## User Experience

### Creating a VM:
1. User clicks "+ Create VM" button
2. Modal opens with creation form
3. User fills required fields:
   - VM name (alphanumeric, hyphens)
   - Resource group (existing or new)
   - Selects location, VM size, OS type
   - Enters admin credentials
4. User clicks "Create VM"
5. Form validation ensures all required fields are filled
6. API request sent with configuration
7. Success message displays
8. VM list refreshes automatically after 2 seconds

### Post-Creation:
- VM appears in list with "Creating" status initially
- After provisioning completes (5-10 minutes):
  - Status changes to "Running"
  - All management operations become available
  - Details can be viewed by clicking VM name

## Technical Implementation

### Network Configuration
The API automatically creates a full network stack:
1. **Virtual Network**: `{vmName}-vnet`
2. **Subnet**: `default` (within the vnet)
3. **Public IP**: `{vmName}-pip` (dynamic allocation)
4. **Network Interface**: `{vmName}-nic`
5. **Network Security Group**: Inline with NIC
   - Inbound rule for SSH (22) or RDP (3389)

### Security Considerations
- Password must meet Azure requirements (12+ chars, complexity)
- Network security group allows only SSH/RDP by default
- Admin username should follow Azure naming conventions
- Password is transmitted securely (HTTPS)
- Not stored in UI state after submission

### Error Handling
- Client-side validation for required fields
- Server-side validation for all parameters
- Azure API errors displayed to user
- Clear error messages for common issues:
  - Missing required fields
  - Invalid resource group
  - VM name already exists
  - Insufficient quota
  - Invalid location/size combination

## API Integration

### Request Format
```json
{
  "vmName": "my-vm",
  "resourceGroup": "my-rg",
  "location": "eastus",
  "vmSize": "Standard_B2s",
  "adminUsername": "azureuser",
  "adminPassword": "SecurePassword123!",
  "osType": "Linux"
}
```

### Response Format (Success)
```json
{
  "success": true,
  "message": "VM \"my-vm\" creation initiated successfully. This may take several minutes.",
  "vmName": "my-vm",
  "vm": { /* Full VM resource object */ }
}
```

### Response Format (Error)
```json
{
  "error": "Failed to create VM: 400 Bad Request",
  "details": "Resource group 'my-rg' could not be found."
}
```

## Testing Recommendations

### Manual Testing:
1. **Valid Creation**:
   - Fill all required fields
   - Use unique VM name
   - Verify success message
   - Wait for VM to appear in list
   - Check VM details after provisioning

2. **Validation Testing**:
   - Try creating without VM name
   - Try creating without resource group
   - Try creating without admin credentials
   - Verify Create button remains disabled

3. **Error Handling**:
   - Use duplicate VM name
   - Use non-existent resource group
   - Use invalid password (too short)

4. **UI Testing**:
   - Test modal close (X button, outside click)
   - Test modal close during creation (should be disabled)
   - Test form field interactions
   - Test dropdown selections

### Integration Testing:
1. Create VM and verify in Azure Portal
2. Test with different OS types
3. Test with different VM sizes
4. Test with different locations
5. Verify network resources created correctly

## Known Limitations
1. Uses simplified network configuration (single NIC, dynamic IP)
2. No support for:
   - Custom images
   - Multiple data disks
   - Availability sets/zones
   - Load balancers
   - Advanced networking (static IP, multiple NICs)
   - SSH keys (password auth only)
   - Boot diagnostics storage account
3. Resource group must exist (not created automatically)
4. Virtual network created with default address space

## Future Enhancements
1. **Network Options**:
   - Existing vnet/subnet selection
   - Static IP assignment
   - Multiple NIC configuration
   - Load balancer integration

2. **Storage Options**:
   - Data disk configuration
   - Premium SSD option
   - Custom disk sizes

3. **Image Options**:
   - Custom image selection
   - Marketplace image browser
   - Image version selection

4. **Advanced Features**:
   - SSH key upload for Linux
   - Availability zone selection
   - Boot diagnostics configuration
   - Tags support
   - Managed identity

5. **User Experience**:
   - Multi-step wizard
   - Cost estimation
   - Template export/import
   - Validation messages per field
   - Progress indicator during creation

## Files Modified
1. `src/app/api/azure/virtual-machines/route.js`
   - Added PUT endpoint (191 lines)
   - Before POST endpoint

2. `src/app/azure/virtual-machines/page.jsx`
   - Added state variables (9 lines)
   - Added createVM function (42 lines)
   - Added Create VM button (1 line)
   - Added Create VM modal (187 lines)

## Related Documentation
- [Azure VM Create API](https://learn.microsoft.com/en-us/rest/api/compute/virtual-machines/create-or-update)
- [VM Sizes](https://learn.microsoft.com/en-us/azure/virtual-machines/sizes)
- [Azure Regions](https://azure.microsoft.com/en-us/explore/global-infrastructure/geographies/)
- [VM Images](https://learn.microsoft.com/en-us/azure/virtual-machines/linux/cli-ps-findimage)
