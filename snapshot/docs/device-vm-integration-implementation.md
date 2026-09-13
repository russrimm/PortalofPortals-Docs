# Device Management VM Integration Implementation

**Date**: February 2025  
**Feature**: Unified VM Management from Device Management Page

## Overview

Integrated Azure Virtual Machine management controls into the Device Management page, allowing IT administrators to start and stop VMs directly from the device list interface without navigating to the Azure VMs page.

## Implementation Details

### Files Modified

**src/app/device-management/devices/page.tsx**

### Features Added

1. **VM Data Fetching**
   - Added SWR hook to fetch Azure VMs: `useApiData('/api/azure/virtual-machines?expand=instanceView')`
   - Fetches VM data in parallel with device data for efficient loading

2. **Device-to-VM Matching**
   - Implemented `findVMForDevice()` function
   - Matches device computer name to VM computer name (case-insensitive)
   - Uses device.displayName === vm.properties.osProfile.computerName

3. **VM Status Detection**
   - Implemented `getVMStatus()` function
   - Detects running, stopped, deallocated, and transitioning states
   - Uses VM properties.instanceView.statuses array

4. **VM Operation Controls**
   - Added Start and Stop buttons for matched VMs
   - Buttons conditionally render based on current VM power state
   - Shows operation progress ("Starting...", "Stopping...")
   - Disables buttons during operations to prevent duplicate requests

5. **State Management**
   - Added `operatingVMs` state to track in-progress operations
   - Added `successMessage` state for operation feedback
   - Uses vmKey pattern: `${resourceGroup}/${vmName}` for unique identification

6. **UI Enhancements**
   - VM name displayed below device computer name in gray text
   - Start/Stop buttons styled with green (start) and red (stop) colors
   - Success message banner displays above table
   - Message auto-dismisses after 5 seconds

### Code Structure

```typescript
// TypeScript Interfaces
interface VirtualMachine {
  id: string
  name: string
  resourceGroup: string
  properties?: {
    instanceView?: {
      statuses?: Array<{ code: string }>
    }
    osProfile?: {
      computerName?: string
    }
  }
}

type VMOperationState = Record<string, 'starting' | 'stopping'>

// State Management
const [operatingVMs, setOperatingVMs] = useState<VMOperationState>({})
const [successMessage, setSuccessMessage] = useState<string | null>(null)
const { data: vmData, mutate: mutateVMs } = useApiData('/api/azure/virtual-machines?expand=instanceView')

// Helper Functions
const findVMForDevice = (device: Device): VirtualMachine | undefined
const getVMStatus = (vm: VirtualMachine): string | null
const handleVMOperation = async (vmName: string, resourceGroup: string, action: string): Promise<void>
const startVM = async (vmName: string, resourceGroup: string): Promise<void>
const deallocateVM = async (vmName: string, resourceGroup: string): Promise<void>
```

### Table Structure Updates

**Device Name Column**:
```tsx
<td className="px-4 py-3 text-sm">
  <Link href={`/device-management/details?id=${device.id}`}>
    {device.displayName}
  </Link>
  {matchedVM && (
    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
      VM: {matchedVM.name}
    </div>
  )}
</td>
```

**Actions Column**:
```tsx
<td className="px-4 py-3 text-sm">
  <div className="flex flex-col gap-2">
    <Link href={`/device-management/actions?id=${device.id}`}>
      Manage
    </Link>
    {matchedVM && vmStatus && (
      <div className="flex gap-2">
        {vmStatus === 'running' && (
          <button onClick={() => handleVMOperation(...)}>
            {isOperating === 'stopping' ? 'Stopping...' : 'Stop'}
          </button>
        )}
        {(vmStatus === 'stopped' || vmStatus === 'deallocated') && (
          <button onClick={() => handleVMOperation(...)}>
            {isOperating === 'starting' ? 'Starting...' : 'Start'}
          </button>
        )}
      </div>
    )}
  </div>
</td>
```

## User Experience Flow

1. **View Devices**: Navigate to Device Management > Devices
2. **Identify VMs**: Devices with matching Azure VMs show VM name below computer name
3. **Check Status**: VM status inferred from available actions (Start = stopped, Stop = running)
4. **Operate VM**: Click Start/Stop button
5. **See Progress**: Button shows "Starting..." or "Stopping..." during operation
6. **View Result**: Success message appears: "VM [name] started successfully" or "VM [name] stopped successfully"
7. **Auto-Refresh**: Page automatically refetches VM data after 2 seconds

## API Dependencies

- **GET /api/azure/virtual-machines?expand=instanceView**: Fetch all VMs with status
- **PUT /api/azure/virtual-machines**: Start or stop VM operations
  - Body: `{ vmName, resourceGroup, action: 'start' | 'deallocate' }`

## Technical Considerations

### Matching Strategy
- **Assumption**: Device displayName matches VM computer name
- **Case Handling**: Case-insensitive comparison
- **Missing Matches**: Devices without matching VMs show no VM info (graceful degradation)
- **Multiple Matches**: First match used (should be unique in practice)

### Performance
- **Parallel Fetching**: Devices and VMs fetched simultaneously
- **SWR Caching**: VM data cached and shared across components
- **Optimistic Updates**: UI updates immediately, then refetches for confirmation

### Security
- **Authentication**: Requires NextAuth session
- **Authorization**: Uses delegated Azure credentials from session
- **RBAC**: User must have VM start/stop permissions in Azure

### Error Handling
- **Network Errors**: Caught and displayed in console
- **API Errors**: Logged but operation state resets
- **Missing Data**: Null checks prevent crashes
- **Operation Timeout**: 2-second delay before refetch allows Azure to process

## Testing Checklist

- [x] TypeScript compilation passes
- [ ] Device with matching VM shows VM name
- [ ] Device without VM shows no VM info
- [ ] Running VM shows Stop button
- [ ] Stopped VM shows Start button
- [ ] Button disabled during operation
- [ ] Success message displays on completion
- [ ] Success message auto-dismisses
- [ ] VM status updates after operation
- [ ] Multiple devices with VMs handled correctly
- [ ] Dark mode styling correct

## Future Enhancements

1. **Enhanced Status Display**: Show VM status explicitly (Running, Stopped, etc.)
2. **Power State Badge**: Color-coded badge instead of inferring from buttons
3. **Restart Operation**: Add restart button for running VMs
4. **Deallocate vs Stop**: Separate buttons for stop vs deallocate
5. **VM Resource Info**: Show VM size, location, resource group on hover
6. **Batch Operations**: Select multiple devices and start/stop all VMs
7. **Operation History**: Show recent VM operations in device details
8. **Azure Portal Link**: Quick link to VM in Azure Portal

## Related Pages

- [Azure Virtual Machines](../src/app/azure/virtual-machines/page.tsx): Primary VM management interface
- [Device Details](../src/app/device-management/devices/%5BdeviceId%5D/page.tsx): Individual device management

## References

- [Azure VM Resource Graph Query](../docs/azure-resource-graph-queries-added-2025-01-29.md)
- [Virtual Machines Computer Name Implementation](../docs/complete-session-summary-2025-02-01.md)
