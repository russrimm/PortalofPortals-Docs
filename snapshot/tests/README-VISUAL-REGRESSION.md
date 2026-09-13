# Visual Regression Testing

Automated visual regression testing for all Portal 360° pages. This test suite automatically compares screenshots and updates baselines when differences are detected.

## Features

- ✅ **Automatic Baseline Updates** - Detects visual changes and updates screenshots automatically
- 📊 **Detailed Reporting** - JSON report with diff percentages and status for each route
- 🎯 **Pixel-Perfect Comparison** - Uses pixelmatch for accurate visual difference detection
- ⚡ **Smart Threshold** - Only updates when difference exceeds 0.1% (configurable)
- 🌙 **Dark Mode Enforced** - All screenshots captured with dark theme

## Quick Start

### 1. Initial Setup (One-time)

First, save your authentication state:

```bash
# Start the dev server if not running
pnpm run dev

# In another terminal, run the auth setup
pnpm run test:auth-setup
```

This will open a browser where you can sign in. Your session will be saved to `playwright/.auth/user.json`.

### 2. Run Visual Regression Testing

```bash
# Run visual regression test (requires auth setup first)
pnpm run test:visual

# Or run auth setup + visual regression in one command
pnpm run test:visual-all
```

## How It Works

The visual regression test:

1. **Authenticates** using saved session from `playwright/.auth/user.json`
2. **Navigates** to each route in the ROUTES array
3. **Captures** a full-page screenshot
4. **Compares** with existing baseline (if exists)
   - If no baseline exists → Saves as **NEW** baseline
   - If visual difference > 0.1% → **UPDATES** baseline
   - If visual difference ≤ 0.1% → Marks as **UNCHANGED**
5. **Reports** all changes in console and JSON file

## Output Files

All screenshots and reports are saved to `artifacts/screenshots/`:

- **`{route-name}.png`** - Screenshot baselines (auto-updated)
- **`visual-regression-report.json`** - Detailed test results with diff percentages
- **`temp-*.png`** - Temporary files (deleted after comparison)

## Understanding the Report

### Console Output

```
[1/106] /
   ✅ UNCHANGED - Difference: 0.05%

[2/106] /about
   🔄 UPDATED - Difference: 2.34%

[3/106] /new-page
   ✨ NEW - Baseline created
```

### Status Indicators

- **✨ NEW** - No baseline existed, screenshot saved as new baseline
- **✅ UNCHANGED** - Visual difference below threshold (≤0.1%)
- **🔄 UPDATED** - Visual difference above threshold, baseline updated
- **❌ FAILED** - Screenshot capture failed (network, timeout, etc.)

### JSON Report Structure

```json
{
  "baseUrl": "http://localhost:3000",
  "diffThreshold": 0.1,
  "totalRoutes": 106,
  "summary": {
    "new": 5,
    "unchanged": 95,
    "updated": 4,
    "failed": 2
  },
  "timestamp": "2026-02-03T10:30:00.000Z",
  "results": [
    {
      "route": "/about",
      "filename": "about.png",
      "status": "updated",
      "diffPercent": 2.34,
      "timestamp": "2026-02-03T10:30:15.000Z"
    }
    // ... more results
  ]
}
```

## Configuration

### Difference Threshold

Edit `DIFF_THRESHOLD` in `tests/visual-regression.spec.ts`:

```typescript
const DIFF_THRESHOLD = 0.1; // 0.1% difference threshold
```

- **Lower threshold** (e.g., 0.05%) - More sensitive, updates more often
- **Higher threshold** (e.g., 0.5%) - Less sensitive, ignores minor changes

### Routes to Test

Edit the `ROUTES` array in `tests/visual-regression.spec.ts`:

```typescript
const ROUTES: string[] = [
  '/',
  '/about',
  // Add your routes here
];
```

### Timeout Settings

Adjust timeouts for slow pages:

```typescript
test.setTimeout(900000); // Total test timeout (15 minutes)

// Per-page screenshot timeout
const newScreenshot = await screenshotPage(page, url, 30000); // 30s
```

## Workflows

### Daily Development

```bash
# Make UI changes to your app
# Then run visual regression to update baselines
pnpm run test:visual-all
```

### CI/CD Integration

The test **never fails** - it auto-updates baselines. For CI/CD:

1. **Option A**: Run and commit updated screenshots
   ```bash
   pnpm run test:visual-all
   git add artifacts/screenshots/
   git commit -m "Update visual baselines"
   ```

2. **Option B**: Strict mode (modify test to fail on changes)
   ```typescript
   // Add this at the end of the test
   const updatedCount = results.filter((r) => r.status === 'updated').length;
   expect(updatedCount).toBe(0); // Fail if any screenshots changed
   ```

### Reviewing Changes

After running the test, check which pages changed:

```bash
# View the report
cat artifacts/screenshots/visual-regression-report.json | grep "updated"

# Or check git diff
git status artifacts/screenshots/
git diff artifacts/screenshots/
```

## Troubleshooting

### Authentication Errors

If you see "Authentication required":

```bash
# Re-save authentication
pnpm run test:auth-setup
```

### Dark Mode Not Active

If screenshots show light mode:

1. Verify `pulseTheme` is set to `dark` in localStorage
2. Check that `dark` class is on `<html>` element
3. Force dark mode is applied in helpers

### Screenshots Not Updating

If baselines aren't updating despite visible changes:

1. Check `DIFF_THRESHOLD` - may be too high
2. Verify new screenshot was captured successfully
3. Check console for comparison errors
4. Ensure `pixelmatch` is installed: `pnpm list pixelmatch`

### Timeouts

For pages that load slowly:

1. Increase timeout in `screenshotPage()` function
2. Add specific wait conditions for dynamic content
3. Increase `test.setTimeout()` for entire suite

## Advanced Usage

### Compare Specific Routes Only

Edit `ROUTES` array temporarily:

```typescript
const ROUTES: string[] = [
  '/about',
  '/billing',
  // Only test these two routes
];
```

### Manual Baseline Reset

Delete all baselines and recapture:

```bash
rm artifacts/screenshots/*.png
pnpm run test:visual-all
```

### Generate Diff Images (Optional)

Modify the `compareImages()` function to save diff images:

```typescript
// After pixelmatch in compareImages()
const diffPath = img1Path.replace('.png', '-diff.png');
fs.writeFileSync(diffPath, PNG.sync.write(diff));
```

## Best Practices

1. **Run tests after UI changes** to automatically update baselines
2. **Review updated screenshots** in git diff before committing
3. **Keep threshold low** (0.1%) to catch subtle visual regressions
4. **Add new routes** to the ROUTES array as you create them
5. **Commit baselines to git** so team shares the same reference

## Integration with Existing Tests

This visual regression test complements existing tests:

- **`route-coverage.spec.ts`** - Tests that routes are accessible
- **`screenshot-all-pages.spec.ts`** - Takes screenshots once (skips if exists)
- **`visual-regression.spec.ts`** - Compares and updates screenshots (this test)

Use visual regression for **detecting unintended UI changes** during development.

## Performance

Typical run times:
- **106 routes**: ~10-15 minutes on localhost
- **Per route**: ~5-10 seconds (navigate + wait + screenshot + compare)
- **Network idle wait**: 20s max per page

To speed up:
- Run on fewer routes during development
- Reduce `waitForLoadState` timeout
- Use `--workers=2` for parallel execution (may affect consistency)
