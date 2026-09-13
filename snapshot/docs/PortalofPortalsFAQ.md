# Portal 360° — Frequently Asked Questions

**Last Updated:** May 2, 2026

---

### **What is this project?**

It's a web application called **Portal 360°** — a unified Microsoft cloud administration workspace built with modern web technologies (Next.js, React, TypeScript). It helps IT administrators and MSP teams manage Microsoft cloud services including Azure, Microsoft 365, Power Platform, Intune, Identity & Security, and more — all from a single portal that talks to Microsoft APIs securely.

---

### **How does it work?**

*   **Framework & Language:** Uses Next.js and React for the user interface. Code is TypeScript throughout for type safety.
*   **Architecture:** BFF-style (Backend For Frontend) — all privileged API calls stay server-side to protect credentials and tokens.
*   **Authentication:** Connects to Microsoft Entra ID (formerly Azure AD) for sign-in and permissions using NextAuth v5 and MSAL libraries for secure token exchange.
*   **APIs:** Pulls data from Microsoft Graph (M365 & Identity), Azure Resource Manager, Azure Resource Graph, Power Platform APIs, Dataverse, Defender for Endpoint, ServiceNow, Azure DevOps, Microsoft AI Foundry, and more.
*   **Observability:** Integrated OpenTelemetry instrumentation for telemetry and tracing.
*   **Environment:** Runs on Node.js (version 24 or higher).

---

### **What product areas does Portal 360° cover?**

*   **Microsoft 365:** Licensing, Copilot usage, agent identity & registry pages.
*   **Identity & Security:** Users (including User 360), groups, applications, service principals, PIM, entitlement management, sign-ins, conditional access, risky users, Secure Score, audit logs.
*   **Azure Infrastructure:** Organization hierarchy, resource management, networking, VMs, deployment stacks, policy & compliance, Azure Advisor, cost management, budgets, forecasts, reservations, metrics, monitoring, Log Analytics, Microsoft Sentinel.
*   **Power Platform:** Environments, Copilot Studio agents, DLP, governance, billing plans, capacity, inventory reports, Dataverse analytics, Power Automate flows.
*   **Device Management:** Intune devices, compliance & configuration, reports, Windows update catalog.
*   **Collaboration & Health:** Exchange mailboxes & folders, Teams, SharePoint, service health & announcements.
*   **Operations & Integrations:** ServiceNow incidents & knowledge base, Azure DevOps, Microsoft Fabric, reporting hub, AI Foundry projects, Graph Explorer, DOCX editor.

---

### **What's the current tech stack?**

| Technology | Version |
|---|---|
| **Next.js** | `16.2.1` |
| **React** | `19.2.3` |
| **TypeScript** | `5.x` |
| **Tailwind CSS** | `4.x` |
| **NextAuth** | `5.0.0-beta.31` |

---

### **What's inside the project?**

*   **Pages & Routes:** The app's screens live under `src/app/...`. API endpoints (server-side logic) are also defined there.
*   **Shared Libraries:** Helpers for authentication and API calls are in `src/lib/`.
*   **Tests:** Automated browser tests using Playwright are in `tests/`.
*   **Config Files:** Settings for Next.js, TypeScript, ESLint, and Playwright are in the root.
*   **Documentation:** All technical docs are in `docs/`. See [docs/README.md](./README.md) for the full documentation index.
*   **MCP Server:** An MCP-compatible server interface is available in `mcp-server/`.

---

### **What do you need to run it?**

*   Node.js **24+**
*   A Microsoft Entra ID app registration with permissions needed for your target pages.
*   A `.env.local` file with:

```bash
AZURE_TENANT_ID=<tenant-guid>
AZURE_CLIENT_ID=<app-id>
AZURE_CLIENT_SECRET=<client-secret>
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<generate-with-openssl-rand-base64-32>
```

Optional NextAuth v5 aliases also supported:

```bash
AUTH_SECRET=<same-secret>
AUTH_AZURE_AD_CLIENT_ID=<app-id>
AUTH_AZURE_AD_CLIENT_SECRET=<client-secret>
AUTH_AZURE_AD_TENANT_ID=<tenant-guid>
```

Optional for Azure-specific features:

```bash
AZURE_SUBSCRIPTION_ID=<subscription-guid>
```

See [docs/ENVIRONMENT-VARIABLES.md](./ENVIRONMENT-VARIABLES.md) for the full variable reference.

---

### **How do you start it?**

1.  **Clone the repo:** `git clone https://github.com/russrimm/PortalofPortals.git`
2.  **Install dependencies:** `pnpm install`
3.  **Run in development (webpack):** `pnpm run dev` (starts on port 3000)
4.  **Run in development (turbo):** `pnpm run dev:turbo`
5.  **Build for production:** `pnpm run build`
6.  **Start production server:** `pnpm start`
7.  **Lint:** `pnpm run lint`
8.  **Smoke tests:** Run `pnpm run test:auth-setup` first, then `pnpm run test:smoke` (authenticated project only)
9.  **Screenshot capture:** `pnpm run test:screenshots`
10. **Visual regression:** `pnpm run test:visual`

> Playwright tests require installed browser binaries and valid auth/tenant configuration.

The same prerequisite applies to `pnpm run test:a11y` (accessibility tests, authenticated
project only). Run auth setup in each new clone or worktree to create
`playwright/.auth/user.json`. Smoke and accessibility commands reuse that file and stop
before Playwright starts if it is missing, unreadable, or malformed, naming
`pnpm run test:auth-setup` as the next step. They do not sign in automatically or generate
synthetic sessions. This preflight cannot verify the server session is still valid:
rerun setup if it expires or tests land on sign-in. Keep the session file private and
never commit it.

---

### **How is authentication handled?**

Portal 360° uses a **BFF (Backend For Frontend)** pattern:

*   Users sign in via Microsoft Entra ID through NextAuth v5.
*   Access tokens for Microsoft APIs are acquired **server-side** using MSAL to prevent token exposure in the browser.
*   Different API scopes (Microsoft Graph, Azure Resource Manager, Power Platform, Dataverse, etc.) use separate token acquisition flows.
*   Token refresh and expiration handling is implemented to maintain session continuity.

See [docs/JWT-AUTH-FLOW.md](./JWT-AUTH-FLOW.md) and [docs/API-AUTH-QUICK-REFERENCE.md](./API-AUTH-QUICK-REFERENCE.md) for details.

---

### **What Azure permissions are needed?**

| API | Permission Type | Key Permissions |
|-----|----------------|-----------------|
| Microsoft Graph | Delegated | `User.Read.All`, `Directory.Read.All`, `AuditLog.Read.All` |
| Azure Resource Manager | Delegated | `user_impersonation` |
| Azure RBAC | Role Assignment | Reader, Security Reader |
| Power Platform | Role | Power Platform Administrator |
| Dataverse | Security Role | System Administrator |

See [docs/API-DOCUMENTATION.md](./API-DOCUMENTATION.md) for the full permissions reference.

---

### **What integrations does Portal 360° support?**

*   **ServiceNow** – Incident and knowledge base management with adaptive card support.
*   **Azure DevOps** – Service endpoint integration.
*   **Microsoft AI Foundry** – AI project visibility and management.
*   **Copilot Studio** – Agent management, YAML quarantine, usage and capacity.
*   **Defender for Endpoint (ATP)** – Security alert integration and device compliance.
*   **Microsoft Sentinel** – Workflow and alert management.
*   **OpenTelemetry** – Application telemetry, tracing, and Log Analytics queries.

---

### **How is the codebase structured for Next.js?**

*   **Server Components** handle data fetching and server-side API calls.
*   **Client Components** handle interactivity and browser-rendered UI.
*   **Important:** Do not mix server and client code incorrectly — this can cause infinite render loops or token scope errors.
*   Auth tokens for specific resources (e.g., Azure, Power Platform) are acquired server-side only.
*   Retry logic with graceful error handling is implemented for all Microsoft API calls.

See [docs/bugfix-infinite-render-loop.md](./bugfix-infinite-render-loop.md) and [docs/API-AUTH-AUDIT.md](./API-AUTH-AUDIT.md) for patterns to follow.

---

### **How do you deploy to Azure?**

*   Supports **Azure App Service** deployment via GitHub Actions or direct push.
*   A standalone deployment script (`deploy-azure-standalone.ps1`, in the repo root) and a quick reference ([docs/AZURE-DEPLOY-QUICK-REF.md](./AZURE-DEPLOY-QUICK-REF.md)) are available.
*   Azure Bicep templates for infrastructure automation are documented in [docs/azure-bicep-deployment-automation.md](./azure-bicep-deployment-automation.md).
*   See [docs/AZURE-DEPLOYMENT-GUIDE.md](./AZURE-DEPLOYMENT-GUIDE.md) for the full deployment guide.
*   See [docs/DEPLOYMENT-CHECKLIST.md](./DEPLOYMENT-CHECKLIST.md) for a pre-production checklist.

---

### **How do I troubleshoot common errors?**

| Error | Likely Cause | Quick Fix |
|-------|-------------|-----------|
| `401 Unauthorized` | Token missing or expired | Check session, re-authenticate |
| `403 Forbidden` | Missing permission | Grant required API permission & admin consent |
| `429 Too Many Requests` | Rate limited | Implement retry with exponential backoff |
| `AADSTS50011` | Reply URL mismatch | Add redirect URI to Entra app registration |
| `AADSTS65001` | Consent not granted | Grant admin consent in Entra admin center |
| `AADSTS9002326` | Cross-origin token issue | See [docs/AADSTS9002326-FIX.md](./AADSTS9002326-FIX.md) |
| `431 Header Too Large` | Oversized auth headers | See [docs/fixing-431-header-too-large.md](./fixing-431-header-too-large.md) |

See [docs/TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for the full troubleshooting guide.

---

### **Where is the full documentation?**

| Document | Purpose |
|----------|---------|
| [docs/README.md](./README.md) | Documentation index — start here |
| [docs/quick-start.md](./quick-start.md) | Get running in under 10 minutes |
| [docs/API-DOCUMENTATION.md](./API-DOCUMENTATION.md) | Auth setup, permissions, environment config |
| [docs/API-ENDPOINTS-REFERENCE.md](./API-ENDPOINTS-REFERENCE.md) | All API endpoints quick reference |
| [docs/ENVIRONMENT-VARIABLES.md](./ENVIRONMENT-VARIABLES.md) | Full env variable reference |
| [docs/AZURE-DEPLOYMENT-GUIDE.md](./AZURE-DEPLOYMENT-GUIDE.md) | Azure deployment guide |
| [docs/DEPLOYMENT-CHECKLIST.md](./DEPLOYMENT-CHECKLIST.md) | Pre-production checklist |
| [docs/TROUBLESHOOTING.md](./TROUBLESHOOTING.md) | Common issues and solutions |
| [docs/FEATURE-WALKTHROUGH.md](./FEATURE-WALKTHROUGH.md) | Feature tour for end users |

---


*For questions or contributions, open an issue or pull request at [github.com/russrimm/PortalofPortals](https://github.com/russrimm/PortalofPortals).