# Playwright Screenshot Tests

This directory contains automated screenshot tests for all pages in the Portal 360° application, including authenticated pages.

## 📁 Files

- **`screenshot-gallery.spec.ts`** - Captures every navigable route with **mocked** API data (fast, deterministic, safe for CI)
- **`screenshot-tenant-data.spec.ts`** - Captures every navigable route with **real tenant data** from the live APIs; auto-triggers "Load X" buttons where needed
- **`ci-auth-setup.ts`** - CI/local automation setup that creates a synthetic screenshot session without browser OAuth or real tokens
- **`auth.setup.ts`** - Authentication setup for saving login state
- **`helpers.ts`** - Shared helper functions (dark mode, etc.)
- **`playwright-global-setup.ts`** - Global Playwright configuration

### Which spec should I run?

| Goal | Spec | NPM script |
|------|------|-----------|
| CI: fast, deterministic, no live tenant | `screenshot-gallery.spec.ts` | `pnpm run test:screenshots-ci` |
| Marketing/docs: real data, dark theme only | `screenshot-tenant-data.spec.ts` | `pnpm run test:screenshots-tenant-all` |
| Marketing/docs: light theme only | `screenshot-tenant-data.spec.ts` | `pnpm run test:screenshots-tenant-light` |
| Marketing/docs: dark theme only | `screenshot-tenant-data.spec.ts` | `pnpm run test:screenshots-tenant-dark` |
| Marketing/docs: **both** themes (reuses saved auth) | `screenshot-tenant-data.spec.ts` | `pnpm run test:screenshots-tenant-both` |
| Marketing/docs: auth + **both** themes end-to-end | `screenshot-tenant-data.spec.ts` | `pnpm run test:screenshots-tenant-both-all` |

### Tenant-data spec behavior

`screenshot-tenant-data.spec.ts`:

1. Verifies the stored session is a **real** Azure AD session (rejects synthetic CI sessions).
2. Pre-seeds `localStorage` with `portal360_selected_subscription` (override with `PORTAL360_DEFAULT_SUBSCRIPTION_ID`).
3. Navigates to each route and waits for: `<main>` → `networkidle` → all `animate-spin`/`animate-pulse` loaders cleared → 600ms settle.
4. **If the route is in `ROUTE_ACTIONS`** (e.g. `/secure-score/defender`, `/users/360`), runs the explicit action (button click / search input fill) and waits again.
5. **Otherwise**, if the page still looks empty, falls back to clicking any visible `Load …`, `Run …`, `Fetch …`, `Refresh`, or `Show All` primary button.
6. Saves the screenshot to `artifacts/screenshots/` and records the result in `artifacts/screenshot-tenant-report.md` (also `.json`).

#### Adding a route-specific action

Edit the `ROUTE_ACTIONS` map in `screenshot-tenant-data.spec.ts`:

```ts
const ROUTE_ACTIONS: Record<string, (page: Page) => Promise<void>> = {
  '/my-page': async (page) => {
    await page.getByRole('button', { name: /^Load Everything$/i }).click()
  },
}
```

#### Filtering to a subset

```bash
ROUTES_FILTER=/azure/,/power-platform/ pnpm run test:screenshots-tenant
```

#### Refreshing the auth session

Sessions in `playwright/.auth/user.json` are session cookies — they expire when the browser closes the upstream Entra session (usually within 24h). Refresh with:

```bash
export AZURE_USER_EMAIL=...
export AZURE_USER_PASSWORD=...
pnpm run test:auth-setup
```

## 🔐 Authentication Setup

### Option 1: Automated Authentication (Recommended)

Set environment variables with your test account credentials:

```bash
export AZURE_USER_EMAIL="testuser@yourdomain.com"
export AZURE_USER_PASSWORD="YourPassword123!"
```

Then run the auth setup:

```bash
pnpm exec playwright test tests/auth.setup.ts --project=setup
```

This will:
- Sign in to Azure AD/Entra ID automatically
- Save the authenticated session to `playwright/.auth/user.json`
- Allow other tests to reuse this authentication state

### Option 2: Synthetic Screenshot Authentication for CI or Local Automation

For screenshot generation where live upstream API tokens are not required, use the synthetic session flow. It signs a minimal NextAuth session cookie using `AUTH_SECRET`; it does not put access tokens in the browser.

```bash
pnpm run test:screenshots-ci
```

`AUTH_SECRET` (or `NEXTAUTH_SECRET`) must be exported before running the script — the fallback development secret has been removed. Set the same value used by the running app in CI (GitHub secret) or export it locally.

### Option 3: Manual Authentication

If you prefer manual authentication or have MFA enabled:

```bash
pnpm exec playwright codegen http://127.0.0.1:3000
```

1. This will open a browser with Playwright Inspector
2. Sign in through the Azure AD flow
3. Once authenticated, click "Save storage state" in the inspector
4. Save to `playwright/.auth/user.json`

## 📸 Taking Screenshots

### Screenshot All Pages (Authenticated)

Pick a theme workflow:

```bash
# Both themes end-to-end (auth + light + dark) — recommended for docs refresh
pnpm run test:screenshots-tenant-both-all

# Both themes, reusing an already-saved auth session
pnpm run test:screenshots-tenant-both

# Single theme (auth already saved)
pnpm run test:screenshots-tenant-light
pnpm run test:screenshots-tenant-dark

# Legacy dark-only alias (kept for compatibility)
pnpm run test:screenshots-tenant-all
```

Any of the above will:
- Verify `playwright/.auth/user.json` produces a real authenticated `/api/auth/session`
- Visit every non-dynamic navigable route in `src/lib/route-registry.ts`
- Emulate the selected theme (`SCREENSHOT_THEME=light|dark`) — sets `pulseTheme` in `localStorage`, toggles the `dark` class on `<html>`, and switches `prefers-color-scheme`
- Take full-page screenshots
- Save screenshots to `artifacts/screenshots/`
- Generate JSON and Markdown health reports in `artifacts/`

### Screenshot Specific Pages

To add pages to the screenshot run, register the page in `src/lib/route-registry.ts` with `navigable: true`. Dynamic routes with `[param]` segments are skipped because they need valid IDs.

## 📊 Output

### Screenshots
All screenshots are saved to: `artifacts/screenshots/`

Files are named based on the route **and the current theme**. The light theme uses the bare filename; the dark theme adds a `-dark` suffix:

- `/` → `home.png` (light), `home-dark.png` (dark)
- `/azure/resources` → `azure-resources.png`, `azure-resources-dark.png`
- `/power-platform/environments` → `power-platform-environments.png`, `power-platform-environments-dark.png`

Copy the pair you need into `docs/screenshots/` — every documented page should carry both.

### Report
A detailed JSON report is generated: `artifacts/screenshots/screenshot-report.json`

The report includes:
- Total routes attempted
- Success/failure counts
- Status codes
- Timestamps
- Error messages for failed screenshots

## 🎨 Light & Dark Themes

Every documented page should ship with **both** a light and a dark screenshot. Theme is controlled by the `SCREENSHOT_THEME` environment variable read by `screenshot-tenant-data.spec.ts`:

| `SCREENSHOT_THEME` | Filename suffix | What the spec does |
| --- | --- | --- |
| `light` (default) | _(none)_ — `home.png` | Sets `pulseTheme: 'light'`, removes the `dark` class from `<html>`, sets `prefers-color-scheme: light` |
| `dark` | `-dark` — `home-dark.png` | Sets `pulseTheme: 'dark'`, adds the `dark` class to `<html>`, sets `prefers-color-scheme: dark` |

Use `pnpm run test:screenshots-tenant-both` (or `…-both-all` to also refresh auth) to capture both in one go — it runs the spec twice with the appropriate env var. Docs pages under `docs/screenshots/` are organized as `| Light theme | Dark theme |` tables; keep every entry paired.

## ⚙️ Configuration

### Update Routes

Edit `src/lib/route-registry.ts`:

```ts
'/your-new-page': {
  title: 'Your New Page',
  navigable: true,
}
```

### Viewport Size

Default: 1366x900 (configured in `playwright.config.ts`)

To change, update the config:

```typescript
use: {
  viewport: { width: 1920, height: 1080 },
}
```

### Timeouts

Adjust timeouts in `screenshot-gallery.spec.ts`:

```typescript
test.setTimeout(900000); // Overall test timeout (15 min)

await screenshotPage(page, url, filename, {
  timeout: 30000, // Per-page timeout (30 sec)
});
```

## 🚀 Running in CI/CD

### GitHub Actions Example

```yaml
- name: Install Playwright
  run: pnpm exec playwright install --with-deps chromium

- name: Setup authentication
  run: pnpm run test:auth-ci
  env:
    AUTH_SECRET: ${{ secrets.AUTH_SECRET }}
    PORTAL360_ALLOW_SYNTHETIC_AUTH: '1'

- name: Take screenshots
  run: pnpm run test:screenshots-tenant-both
  env:
    AUTH_SECRET: ${{ secrets.AUTH_SECRET }}
    PORTAL360_ALLOW_SYNTHETIC_AUTH: '1'

- name: Upload screenshots
  uses: actions/upload-artifact@v3
  if: always()
  with:
    name: screenshots
    path: artifacts/screenshots/
```

## 🐛 Troubleshooting

### "Authentication required" error
- Ensure `playwright/.auth/user.json` exists
- Re-run auth setup if the session expired
- Check that credentials are correct

### Screenshots are blank
- Increase timeout values
- Check if the page requires specific data/API responses
- Verify dark mode is applied correctly

### Some pages fail
- Check the `screenshot-report.json` for error details
- Some pages may require specific URL parameters
- Dynamic routes with `[id]` need valid IDs

### Authentication keeps expiring
- Azure AD sessions typically last 24 hours
- Re-run auth setup daily in CI/CD
- Consider using a dedicated test account without MFA

## 📝 Notes

- Screenshots are full-page by default
- Each screenshot includes a 500ms delay to avoid overwhelming the server
- Failed routes don't fail the entire test suite by default
- All authenticated requests use NextAuth session cookies
