# Portal 360° – Step‑by‑Step Application Walkthrough (Dark Mode)

This walkthrough highlights the current (updated) Portal 360° portal experience, navigation structure (GraphExplorerNav), dark‑mode rendering pipeline, and key user journeys. All screenshots are assumed captured in dark mode.

> Tagline (Home Hero): **“Your complete tenant administration and monitoring solution.”**

---
## 1. Runtime Overview
| Aspect | Implementation |
|--------|----------------|
| Framework | Next.js (App Router) + React 19 |
| Styling | Tailwind (dark class enforced SSR) |
| Auth (demo) | Lightweight cookie gate (`russdemo` / `russdemo`) – replace before production |
| Theme Persistence | `pulseTheme` (localStorage + cookie) and SSR `<html class="dark">` default |
| Navigation | `GraphExplorerNav.jsx` (collapsible areas, localStorage collapse state) |
| Screenshots | Playwright (`tests/dark-mode-screenshots.spec.ts`) forcing dark color scheme |

---
## 2. Dark Mode Mechanics
1. **SSR Default:** `layout.tsx` sets `<html class="dark" suppressHydrationWarning>`.
2. **Early Script:** Runs `beforeInteractive` – logic order:
   - Query param `?theme=` overrides (dark/light) and persists.
   - Falls back to `localStorage.pulseTheme` or `pulseTheme` cookie.
   - Defaults to dark and seeds both if unset.
3. **Client Provider:** `ThemeProvider` reads the same key (no flicker / mismatch).
4. **Playwright:** Config sets `colorScheme: 'dark'`; tests also call `forceDarkMode(page)` (helper) to ensure `<html.dark>`.

---
## 3. Demo Authentication Layer
File: `src/app/page.tsx`
- Minimal form (username + password) → sets `demoAuth=1` cookie on success.
- Credentials: `russdemo` / `russdemo`.
- Not production‑ready (no MSAL / NextAuth handshake yet). Replace prior to any real deployment.

Logout button appears in the top‑right of the authenticated shell overlaying dashboard content.

---
## 4. Primary Navigation (GraphExplorerNav)
Collapsible areas (state persisted in `localStorage.graphNavCollapsed` and open sections tracked in component state):
- Microsoft Entra ID
- Audit & Security
- Service Health
- Billing & Licensing
- Azure Resources
- Device Management
- Power Platform
- Teams
- SharePoint
- Microsoft Learn
- Reports
- Product News & Release Plans (external – opens https://www.msportal360.app)

Each area expands to subpages; external links include an outbound icon and `target="_blank" rel="noopener noreferrer"`.

---
## 5. Key Pages & Flows
| Page | Route | Highlights / Actions | Screenshot (suggested filename) |
|------|-------|----------------------|---------------------------------|
| Home / Hero | `/` | Tagline, three feature cards (Log Analytics, Security Insights, Power Platform) | `home-dark.png` |
| Dashboard (if separate) | `/dashboard` | High‑level KPIs / health (if implemented) | `dashboard-dark.png` |
| Azure Resources | `/azure` | Run Resource Graph queries; links to Advisor Score & Recommendations | `azure-resources-dark.png` |
| Advisor Score | `/azure/advisor-score` | Displays Azure Advisor score & categories | `advisor-score-dark.png` |
| Advisor Recs | `/azure/list-recommendations` | Enumerates recommendations with filters | `advisor-recommendations-dark.png` |
| App Insights AI Analysis | `/application-insights-exceptions` | Exception query selection + AI summary | `exceptions-dark.png` |
| Audit Logs | `/audit-logs` | Mode toggle (Compact vs Resizable), grouping & resizing | `audit-logs-dark.png` |
| Secure Score | `/secure-score` | Azure Secure Score (Defender separated) | `secure-score-dark.png` |
| Defender Cloud Secure Score | `/secure-score/defender` | Defender‑specific secure scores (hydration‑safe cookie read) | `defender-secure-score-dark.png` |
| Conditional Access | `/conditional-access` | Policy listing | `conditional-access-dark.png` |
| User Sign‑Ins | `/user-signins` | Sign‑in log analytics | `user-signins-dark.png` |
| Service Health | `/service-health` | Current incidents | `service-health-dark.png` |
| Service Announcements | `/service-announcements` | Advisory messages | `service-announcements-dark.png` |
| Windows Updates Catalog | `/windows-updates/catalog` | Update + vulnerability data | `windows-updates-catalog-dark.png` |
| Known Issues | `/known-issues` | Windows Update known issues | `known-issues-dark.png` |
| Power Platform Environments | `/power-platform/admin-centers` | Environment overview | `power-platform-environments-dark.png` |
| Solution Analysis | `/power-platform/solutions/analyze` | Upload a solution `.zip` for inventory, flow lint, Canvas App Power Fx, and secret scan | `power-platform-solution-analyze-dark.png` |
| Tenant Capacity | `/power-platform/tenant-capacity` | Capacity usage metrics | `power-platform-capacity-dark.png` |
| SharePoint Sites | `/sharepoint-sites` | Site inventory | `sharepoint-sites-dark.png` |
| Microsoft Learn Catalog | `/learn-catalog` | Filterable training content (enhanced dark select styling) | `learn-catalog-dark.png` |
| Product News & Release Plans | External | Redirect to product roadmap site | (external) |

> Capture only pages present/enabled in your build. If a route 404s, omit until implemented.

---
## 6. Screenshot Capture Flow
1. Start dev server (or rely on Playwright `webServer`):
   ```powershell
   pnpm run dev
   ```
2. (First time) Install browsers:
   ```powershell
   pnpm exec playwright install
   ```
3. Run screenshot spec:
   ```powershell
   pnpm exec playwright test tests/dark-mode-screenshots.spec.ts --reporter=line
   ```
4. Files land in: `artifacts/screenshots/`.

`dark-mode-screenshots.spec.ts` logic:
- Ensures dark persists via `/?theme=dark` + `localStorage.pulseTheme`.
- Uses a helper `snap()` to navigate, assert dark state, and save full‑page screenshot.

---
## 7. Audit Logs Table Modes
- **Compact Mode (default):** Wrapped cells, no horizontal scroll, resizing disabled.
- **Resizable Mode:** Horizontal scroll enabled, drag handles show, widths adjustable.
- Toggle persists per session (if later enhanced with localStorage—currently ephemeral state only; add persistence if needed).

---
## 8. Hydration & Client Safety
- Any browser‑only APIs (cookies, localStorage) gated in `useEffect` (e.g., Defender secure score page & demo auth home) to prevent hydration mismatches.
- `<html suppressHydrationWarning>` avoids noise from initial dark class differences.

---
## 9. Troubleshooting Quick Reference
| Issue | Likely Cause | Resolution |
|-------|--------------|-----------|
| Light flash before dark | Early theme script removed/errored | Revert portion of `layout.tsx` theme snippet |
| Missing Product News menu | Area not appended in `AREAS` or stale build | Check `GraphExplorerNav.jsx` for final area item |
| Audit resize handles absent in Resizable mode | Mode toggle not activated or code regression | Switch modes; inspect conditional rendering logic |
| Demo login never succeeds | Wrong credentials or cookie blocked | Use `russdemo` / `russdemo`; verify cookies enabled |
| Playwright screenshot in light mode | Force helper not invoked or theme param missing | Ensure initial navigation uses `/?theme=dark` and helper call |

---
## 10. Extending Coverage
Add pages to screenshot spec:
```ts
await snap(page, `${BASE_URL}/new-feature`, 'new-feature-dark.png');
```
Add a new navigation area: modify `AREAS` in `GraphExplorerNav.jsx` with `{ name, icon, description, subpages: [...] }`.

---
## 11. Next Improvements (Suggested)
- Persist audit table mode & column widths to `localStorage`.
- Replace demo auth with MSAL + NextAuth; enforce per‑route protection.
- Add role/claim‑based UI gating (e.g., hide security pages for non‑admins).
- Introduce API response caching (etags / in‑memory / edge).
- Add health endpoints + synthetic monitoring.

---
## 12. Reference Scripts
| Script | Purpose |
|--------|---------|
| `scripts/generate-azure-cert.js` | Creates RSA key pair for certificate‑based auth (Power Platform / Azure) |
| Playwright config | Forces dark mode / auto dev server for screenshots |

---
**Portal 360°** – Your complete tenant administration and monitoring solution.
