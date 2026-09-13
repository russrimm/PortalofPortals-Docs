# JWT Authentication Token Flow - Portal 360°

This document explains the JWT authentication and token management architecture.

## 1. Initial Authentication Flow (OAuth Login)

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Browser
    participant NextAuth
    participant EntraID as Microsoft Entra ID
    participant TokenStore as Token Store<br/>(Redis/Memory)
    participant JWT as JWT Cookie
    
    User->>Browser: Click "Sign In"
    Browser->>NextAuth: GET /api/auth/signin
    NextAuth->>EntraID: OAuth Authorization Request
    EntraID-->>User: Login Prompt
    User->>EntraID: Enter Credentials
    EntraID-->>NextAuth: Authorization Code
    
    Note over NextAuth: JWT Callback (account present)
    NextAuth->>EntraID: Exchange code for tokens
    EntraID-->>NextAuth: access_token, id_token, refresh_token
    
    NextAuth->>NextAuth: Generate JTI (session ID)
    Note over NextAuth: Encode Callback
    NextAuth->>TokenStore: Store tokens with JTI
    TokenStore-->>NextAuth: ✓ Stored
    
    NextAuth->>JWT: Create minimal JWT<br/>(email, name, role, jti)
    JWT-->>Browser: Set HttpOnly Cookie
    Browser->>User: Redirect to /power-platform/environments
```

## 2. API Request with Token Retrieval

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Browser
    participant API as API Route<br/>(elastic-table)
    participant Auth as auth()
    participant JWT as JWT Cookie
    participant TokenStore as Token Store<br/>(Redis/Memory)
    participant Dataverse
    
    User->>Browser: Click "View Elastic Table"
    Browser->>API: GET /api/.../elastic-table
    
    Note over API: Need Dataverse token
    API->>Auth: getServerTokens()
    Auth->>JWT: Read JWT from cookie
    JWT-->>Auth: Decode JWT → jti
    
    Auth->>TokenStore: get(jti)
    TokenStore-->>Auth: { accessToken, idToken, refreshToken }
    Auth-->>API: Return tokens
    
    Note over API: On-Behalf-Of Flow
    API->>API: getDataverseDelegatedToken()
    API->>EntraID: OBO request with user token
    EntraID-->>API: Dataverse-scoped token
    
    API->>Dataverse: Query with Dataverse token
    Dataverse-->>API: Return data
    API-->>Browser: JSON response
    Browser->>User: Display table data
```

## 3. Token Storage Architecture

```mermaid
flowchart TB
    subgraph "Encode Callback"
        A[JWT Callback<br/>Triggered] --> B{Has OAuth tokens?}
        B -->|Yes| C[Store in TokenStore<br/>with JTI key]
        B -->|No existing session| D[Retrieve from store<br/>using JTI]
        D --> E{Tokens found?}
        E -->|Yes| F[Keep session alive]
        E -->|No| F
        C --> G[Create minimal JWT<br/>email, name, role, jti]
        F --> G
        G --> H[Return encoded JWT]
    end
    
    subgraph "Token Store (Dual-Write Pattern)"
        I[set operation] --> J[Write to Memory Store]
        J --> K{Redis enabled?}
        K -->|Yes| L[Also write to Redis]
        K -->|No| M[Memory only]
        L --> N[Success]
        M --> N
        
        O[get operation] --> P{Redis enabled?}
        P -->|Yes| Q[Try Redis first]
        P -->|No| R[Read Memory Store]
        Q --> S{Found in Redis?}
        S -->|Yes| T[Update Memory Store]
        S -->|No| R
        T --> U[Return tokens]
        R --> U
    end
    
    style C fill:#90EE90
    style J fill:#90EE90
    style L fill:#FFD700
    style R fill:#87CEEB
```

## 4. Dev Server Restart Scenario

```mermaid
sequenceDiagram
    autonumber
    participant Memory as Memory Store<br/>(cleared)
    participant Redis as Redis<br/>(connection timeout)
    participant JWT as JWT Cookie<br/>(still valid)
    participant Auth as auth()
    participant API as API Route
    participant User
    
    Note over Memory,Redis: Dev server restarts
    Memory->>Memory: ❌ Store cleared
    Redis->>Redis: ❌ Connection timeout
    
    User->>API: Request /api/elastic-table
    API->>Auth: getServerTokens()
    Auth->>JWT: Read JWT cookie
    JWT-->>Auth: { email, name, jti }
    
    Auth->>Memory: get(jti)
    Memory-->>Auth: ❌ null (not found)
    
    Auth->>Redis: get(jti)
    Redis-->>Auth: ❌ timeout
    
    Note over Auth: No tokens available
    Auth-->>API: { accessToken: null }
    API-->>User: 401 Unauthorized
    
    Note over User: Client-side handles 401
    User->>User: apiClient detects 401
    User->>User: Redirect to /api/auth/signout
    User->>User: Fresh login required
```

## 5. Dual-Write Pattern (Resilient Token Storage)

```mermaid
flowchart TD
    A[API needs token] --> B[getServerTokens]
    B --> C[Read JWT cookie]
    C --> D{Has jti?}
    D -->|No| E[Return null]
    D -->|Yes| F[tokenStore.get jti]
    
    subgraph TokenStore[Token Store - Dual Read]
        F --> G{Redis enabled?}
        G -->|Yes| H[Try Redis.get]
        G -->|No| I[Memory.get]
        
        H --> J{Found?}
        J -->|Yes| K[Sync to Memory]
        J -->|No| I
        
        K --> L[Return tokens]
        I --> L
    end
    
    L --> M{Has tokens?}
    M -->|Yes| N[Return to API]
    M -->|No| O[Log warning]
    O --> E
    
    style K fill:#90EE90
    style I fill:#87CEEB
    style L fill:#FFD700
```

## 6. Error Scenarios and Recovery

```mermaid
flowchart TD
    A[API Request] --> B{Session exists?}
    B -->|No| C[Redirect to signin]
    B -->|Yes| D{Tokens in store?}
    
    D -->|Yes| E{Token expired?}
    D -->|No| F[Session alive<br/>but no tokens]
    
    E -->|No| G[Use token]
    E -->|Yes| H{Has refresh token?}
    
    H -->|Yes| I[Refresh access token]
    H -->|No| J[401 → Signout]
    
    F --> K[First API call fails]
    K --> L[Client-side 401 handler]
    L --> M{Already in auth flow?}
    M -->|Yes| N[Stop - prevent loop]
    M -->|No| O[Redirect to signout]
    
    I --> P{Refresh success?}
    P -->|Yes| Q[Update token store]
    P -->|No| J
    
    Q --> G
    O --> C
    
    style G fill:#90EE90
    style J fill:#FF6B6B
    style N fill:#FFD700
    style Q fill:#87CEEB
```

## Key Design Decisions

### 1. **Server-Side Token Storage**
- **Why**: JWT cookies have 4KB size limit; OAuth tokens exceed this
- **Implementation**: Store tokens in Redis (prod) or Memory (dev) with JTI as key
- **Benefit**: Prevents 431 (Request Header Too Large) errors

### 2. **Dual-Write Pattern**
- **Why**: Redis connections can be unstable in dev environment
- **Implementation**: 
  - Write to Memory Store first (guaranteed)
  - Also write to Redis if available (bonus)
  - Read from both (Redis → Memory fallback)
- **Benefit**: Tokens never lost even with Redis failures

### 3. **Minimal JWT Payload**
- **Contents**: `email`, `name`, `role`, `jti` only
- **Why**: Reduce cookie size, avoid token exposure to client
- **Benefit**: Security + performance

### 4. **Session Resilience**
- **Behavior**: Keep session alive even when tokens missing from store
- **Why**: Prevents infinite signout loops after dev restart
- **Outcome**: First API call fails gracefully → client-side signout

### 5. **On-Behalf-Of (OBO) Flow**
- **When**: Any user-triggered call to Graph, Dataverse, or other upstream APIs.
- **How**: Exchange the user's access token for a resource-scoped token. For
  Microsoft Graph this is wrapped by
  [`getDelegatedGraphClient()`](../src/lib/delegatedGraph.ts) — the default
  Graph client used across `src/app/api/**` and `src/app/**/page.tsx`. The
  client auto-refreshes on `401` and throws `DelegatedAuthError` if no session
  tokens are available (caller returns 401 → user re-signs-in).
- **Benefit**: Maintains user security context, proper audience scoping,
  per-user RBAC, accurate audit attribution.
- **App-only**: `getAppOnlyGraphClient({ reason, jobId })` from
  `src/lib/auth/appOnly.ts` is reserved for the declared background jobs in
  [`APP-ONLY-JOBS.md`](./APP-ONLY-JOBS.md). It is **not** a fallback — never
  retry an OBO 401/403 with an app-only token. `pnpm run verify:auth-mode:strict`
  fails on any user-triggered route that uses it.

## Common Issues and Solutions

| Issue | Symptom | Solution |
|-------|---------|----------|
| **Infinite Signout Loop** | Page reloads endlessly | Don't force signout in JWT callback when tokens missing |
| **401 on All Requests** | "Tokens missing from store" | Dual-write pattern ensures Memory fallback works |
| **Token Signature Error** | AADSTS50013 | OBO automatically falls back to refresh token |
| **Child Table Error** | 0x80097259 | Elastic child tables need parent record reference |
| **Dev Restart** | Session broken | Expected - requires fresh login due to memory cleared |

## Token Lifecycle States

```mermaid
stateDiagram-v2
    [*] --> NoSession: Page Load
    NoSession --> LoggingIn: Click Sign In
    LoggingIn --> TokensStored: OAuth Success
    TokensStored --> Active: Tokens in Store
    
    Active --> Expired: Time Passes
    Expired --> Refreshing: Has Refresh Token
    Refreshing --> Active: Refresh Success
    Refreshing --> Invalid: Refresh Fails
    
    Active --> Missing: Dev Restart
    Missing --> Retry: API Call
    Retry --> SignOut: 401 Error
    
    Invalid --> SignOut
    SignOut --> [*]
    
    note right of TokensStored
        Encode: Store tokens
        Decode: Retrieve tokens
        Memory + Redis
    end note
    
    note right of Missing
        Session alive but
        tokens lost from store.
        First API call will fail.
    end note
```

## Production vs Development Behavior

### Production (with Redis)
- ✅ Tokens persist across server restarts
- ✅ High availability with Redis clustering
- ✅ Shared sessions across multiple app instances
- ✅ No session loss on deployment

### Development (Memory Store)
- ⚠️ Tokens cleared on server restart
- ⚠️ Redis connection timeouts common
- ✅ Dual-write ensures Memory fallback works
- ✅ First API call after restart triggers re-login
- ℹ️ Expected behavior - not a bug

## References

- [NextAuth.js JWT Documentation](https://next-auth.js.org/configuration/options#jwt)
- [Microsoft Entra ID OAuth 2.0 On-Behalf-Of Flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-on-behalf-of-flow)
- [Dataverse Web API Authentication](https://learn.microsoft.com/power-apps/developer/data-platform/webapi/authenticate-web-api)
- [Redis Client for Node.js](https://github.com/redis/node-redis)
