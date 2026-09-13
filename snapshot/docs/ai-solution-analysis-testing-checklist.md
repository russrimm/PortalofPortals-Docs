# AI Solution Analysis - Testing Checklist

## Prerequisites
- [ ] Ensure `.env.local` has `AZURE_ENDPOINT` and `AZURE_API_KEY` configured
- [ ] Start dev server: `pnpm run dev`
- [ ] Sign in to the application
- [ ] Navigate to Power Platform → Environments page

## Basic Functionality Tests

### Happy Path - Unmanaged Solution
- [ ] Open solutions modal for any environment (click "View Solutions")
- [ ] Locate any solution in the list
- [ ] Click the purple "AI Analyze" button (NOT "AI Analyze (M)")
- [ ] **Expected**: Button shows spinner with "Analyzing..." text
- [ ] **Expected**: After 10-60 seconds, modal opens with analysis results
- [ ] **Expected**: Modal shows:
  - Solution metadata card (name, type=Unmanaged, size, tokens)
  - AI-generated analysis with 5 sections
  - All text is readable (not cut off)
- [ ] Close modal (X button or Escape key)
- [ ] **Expected**: Modal closes, button returns to normal state

### Happy Path - Managed Solution
- [ ] Find a solution that has a managed version
- [ ] Click the orange "AI Analyze (M)" button
- [ ] **Expected**: Same flow as unmanaged, but metadata shows "Type: Managed"

### Concurrent Analysis
- [ ] Click "AI Analyze" on Solution A
- [ ] While A is analyzing, click "AI Analyze" on Solution B
- [ ] **Expected**: Both buttons show individual spinners
- [ ] **Expected**: Both analyses complete independently
- [ ] **Expected**: Modal shows whichever completes last

### Error Handling
- [ ] Stop dev server
- [ ] Remove `AZURE_ENDPOINT` from `.env.local`
- [ ] Restart dev server
- [ ] Try to analyze a solution
- [ ] **Expected**: Modal opens showing error: "Azure AI not configured"
- [ ] Restore `AZURE_ENDPOINT` and restart

### Large Solution Test
- [ ] Find a solution >10 MB (or create one with many components)
- [ ] Click "AI Analyze"
- [ ] **Expected**: Analysis takes longer (1-5 minutes) but completes successfully
- [ ] **Expected**: Progress tracked throughout export phase

### UI/UX Tests
- [ ] **Dark Mode**: Toggle dark mode, verify modal is readable
- [ ] **Responsive**: Resize browser to mobile width, verify buttons don't overflow
- [ ] **Keyboard**: Open modal, press Escape, verify it closes
- [ ] **Multiple Opens**: Analyze → Close → Analyze again on same solution
- [ ] **Button States**: Verify Export buttons still work alongside AI buttons

## API Tests (Optional - Advanced)

### Direct API Call
```bash
curl -X POST http://localhost:3000/api/power-platform/solutions/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "instanceUrl": "https://your-env.crm.dynamics.com",
    "solutionName": "YourSolutionName",
    "solutionDisplayName": "Your Solution Display Name",
    "managed": false
  }'
```
- [ ] **Expected**: Returns JSON with `success: true`, `analysis`, and `metadata`

### Telemetry Verification
- [ ] Check Application Insights for trace: "[AI Analyze] Starting export and analysis"
- [ ] Check for GenAI span with operation type "chat"
- [ ] Verify token usage is recorded

## Edge Cases
- [ ] **Empty Environment**: Try environment with 0 solutions (should just show empty table)
- [ ] **System Solutions**: Try analyzing a Microsoft system solution (should work)
- [ ] **Special Characters**: Analyze solution with spaces/special chars in name
- [ ] **Network Timeout**: Simulate slow network (DevTools → Network → Slow 3G)

## Performance Checks
- [ ] **Time to Analyze**: Small solution should complete in <30 seconds
- [ ] **Page Responsiveness**: Page remains responsive during analysis
- [ ] **Memory**: Check browser memory doesn't spike excessively
- [ ] **Concurrent Limit**: Try 5+ analyses at once, verify no crashes

## Regression Tests
- [ ] **Export Still Works**: Click "Export Unmanaged" - should download ZIP
- [ ] **Solutions Modal**: All other modal features work (search, column filter)
- [ ] **Environments Page**: Other environment features unaffected

## Known Issues / Expected Behavior
- ✅ Analysis does NOT include actual ZIP contents (only metadata)
- ✅ Each click triggers fresh export (no caching)
- ✅ AI prompt is English-only
- ✅ Long solutions (100+ MB) may timeout after 5 minutes

## Test Results Log

| Test | Status | Notes | Tester | Date |
|------|--------|-------|--------|------|
| Happy Path Unmanaged | ⏸️ Not tested | | | |
| Happy Path Managed | ⏸️ Not tested | | | |
| Concurrent Analysis | ⏸️ Not tested | | | |
| Error: No Azure Config | ⏸️ Not tested | | | |
| Large Solution | ⏸️ Not tested | | | |
| Dark Mode | ⏸️ Not tested | | | |
| Responsive Mobile | ⏸️ Not tested | | | |
| Keyboard Navigation | ⏸️ Not tested | | | |
| Export Regression | ⏸️ Not tested | | | |

---

## Bug Report Template

```markdown
### Bug: [Brief Description]
**Steps to Reproduce**:
1. 
2. 
3. 

**Expected**: 
**Actual**: 
**Environment**: 
- Browser: 
- Solution Size: 
- Error Message: 

**Screenshots**: 
```

---

## Sign-off

- [ ] All critical tests passing
- [ ] No console errors during normal operation
- [ ] Documentation updated
- [ ] Ready for production

**Tested by**: _______________  
**Date**: _______________  
**Sign-off**: _______________
