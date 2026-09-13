# Code Review Report: Portal 360°

> **Historical record.** Findings 1.1 and the app-only observation in §44 were
> resolved: every API route now calls `verifyAuth()` first, and every
> user-triggered route acquires a **delegated (OBO)** token. See
> [`api-authentication-security-fix.md`](./api-authentication-security-fix.md)
> and [`DELEGATED-AUTH-MIGRATION.md`](./DELEGATED-AUTH-MIGRATION.md).

## Executive Summary
**Portal 360°** is a comprehensive and ambitious Next.js application. While the feature set is impressive, the codebase currently has **critical security vulnerabilities**, **functional bugs**, and **architectural inconsistencies** that should be addressed before production use.

## 1. 🚨 Critical Findings (High Priority)

### 1.1 Unprotected API Routes (Security Hole)
**Severity: Critical**
API routes (e.g., `src/app/api/users/route.ts`) do not verify the user's authentication session.
*   **Issue**: While the Frontend (`src/app/page.tsx`) forces login, the Backend API routes are publicly accessible to anyone who knows the URL.
*   **Mechanism**: The `GET /api/users` handler calls `getGraphClient()`, which uses **App-Only (Client Credentials)** authentication. It bypasses user context.
*   **Risk**: An attacker can scrape your entire directory, user list, and Azure resources without logging in.
*   **Recommendation**: Implement `auth()` check in every API route or use `middleware.ts` to protect `/api/*` routes.
    ```typescript
    // Example fix in route.ts
    import { auth } from '@/lib/auth';
    export async function GET(req) {
      const session = await auth();
      if (!session) return new NextResponse('Unauthorized', { status: 401 });
      // ...
    }
    ```

### 1.2 Undefined Variables (Runtime Crashes)
**Severity: Critical**
ESLint identified multiple undefined variables that will cause the application to crash at runtime when those code paths are hit.
*   `src/app/api/azure/ai/explain-flow/route.js`: `getAzureAIToken` is undefined.
*   `src/app/api/power-platform/storage-history/route.js`: `saveData` is undefined.
*   `src/app/applications/ApplicationsTable.jsx`: `setCredentialDetails` and `setCredentialErrors` are undefined.
*   `src/lib/azureToken.js`: `confidentialClient` is undefined.

### 1.3 Missing Environment Handling
**Severity: High**
The application crashes immediately if environment variables are missing (as seen in smoke tests).
*   **Issue**: `auth.ts` and `tokenStore.ts` logic assumes variables exist or fails with obscure errors.
*   **Recommendation**: Add a `check-env.js` script or Zod validation for `process.env` at startup to fail fast with clear messages.

## 2. 🏗 Architecture & Code Quality

### 2.1 "App-Only" vs. "Delegated" Auth Confusion
**Severity: Medium**
The application uses a mix of "App-Only" (Application Permissions) and attempts at "Delegated" (User Permissions).
*   **Observation**: Most API routes use `getGraphClient()` which defaults to App-Only. This means audit logs will show "Portal 360 App" as the actor, not the actual user.
*   **Recommendation**:
    1.  Decide if this is an "Admin Tool" (App Permissions okay) or a "User Portal" (Delegated preferred).
    2.  If Delegated, use the OBO (On-Behalf-Of) flow implemented in `getGraphDelegatedToken` and pass the user's token.

### 2.2 Custom Graph Client
**Severity: Low**
`src/lib/graphClient.ts` implements a custom fetch wrapper for Microsoft Graph instead of using the official `@microsoft/microsoft-graph-client` SDK (which is installed).
*   **Risk**: Maintenance burden. The custom wrapper is less robust (retries, types, batching) than the SDK.
*   **Recommendation**: Refactor to use the official SDK.

### 2.3 Duplicate Keys in Maps
**Severity: Medium**
`src/app/lib/cwe-mapping.js` contains duplicate keys (e.g., `128`, `129`, `523`). This means some values are being silently overwritten.

## 3. 🛡 Security & Performance

### 3.1 In-Memory Rate Limiting
**Severity: Medium**
`src/app/lib/validation.ts` implements `RateLimiter` using an in-memory `Map`.
*   **Issue**: In a serverless environment (Azure App Service, Azure Functions), memory is not shared between instances. The rate limiter will be ineffective.
*   **Recommendation**: Use Redis (already used for `tokenStore`) for distributed rate limiting.

### 3.2 High Privilege Scope
**Severity: Warning**
The app requires `Directory.Read.All`, `User.ReadWrite.All`, `RoleManagement.ReadWrite.Directory`, etc.
*   **Risk**: If the App Secret is compromised, the attacker has full admin control over the tenant.
*   **Recommendation**: Use Managed Identities if deploying to Azure. Rotate Client Secrets frequently.

## 4. ✅ Action Plan

1.  **Fix Runtime Bugs**: Immediately fix the undefined variables found by ESLint.
2.  **Secure API Routes**: Add authentication checks to all `/api/` routes.
3.  **Refactor Auth**: Standardize on either App-Only or Delegated auth for API calls.
4.  **Fix Lint Errors**: Address the duplicate keys and logic errors.
