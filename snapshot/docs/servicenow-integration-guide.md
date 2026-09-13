# ServiceNow Integration — Portal 360°

## Table of Contents

1. [Introduction](#1-introduction)
2. [Prerequisites](#2-prerequisites)
3. [Setup: Configure ServiceNow credentials in Portal 360°](#3-setup-configure-servicenow-credentials-in-portal-360)
   - [Option A — Environment variables (recommended for production)](#option-a--environment-variables-recommended-for-production)
   - [Option B — In-app configuration (browser-stored)](#option-b--in-app-configuration-browser-stored)
4. [Features overview](#4-features-overview)
5. [Incidents](#5-incidents)
6. [Knowledge Base](#6-knowledge-base)
7. [Creating an incident from any page](#7-creating-an-incident-from-any-page)
8. [API endpoints reference](#8-api-endpoints-reference)
9. [Custom fields and source tracking](#9-custom-fields-and-source-tracking)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Introduction

Portal 360° includes a first-class ServiceNow integration that lets Microsoft cloud administrators view, create, update, and search ServiceNow records without leaving the portal. The integration uses the **ServiceNow Table API** (REST) and does not require any ServiceNow plugin or scoped application to be installed.

> **Note:** This documentation covers Portal 360°–side configuration only. For guidance on configuring ServiceNow roles, ACLs, REST API access rules, or scripted actions you'll need a ServiceNow administrator or consultant familiar with your instance.

**Key capabilities:**

| Capability | Description |
|---|---|
| Incident list | Browse and search all incidents with KPI summary strip |
| Incident details | View full incident record with status history |
| Create incident | Submit new incidents with impact/urgency/category controls |
| Update incident | Patch any field on an existing incident |
| AI incident creator | AI-assisted incident creation with suggested fields |
| Knowledge base | Search and read knowledge articles |

---

## 2. Prerequisites

Before configuring the integration ensure you have:

- A ServiceNow instance (production, sub-production, or Personal Developer Instance)
- A ServiceNow account with:
  - **Read access** to the `incident` table (role: `itil` or `rest_service`)
  - **Write access** to the `incident` table (role: `itil`)
  - **Read access** to the `kb_knowledge` table (role: `knowledge` or `knowledge_reader`)
- The instance hostname, e.g. `your-company.service-now.com`

> **Personal Developer Instances (PDI):** PDIs hibernate after 10 days of inactivity. If Portal 360° reports the instance is hibernating, log in to your PDI directly first to wake it, then retry.

---

## 3. Setup: Configure ServiceNow credentials in Portal 360°

### Option A — Environment variables (recommended for production)

Set the following variables in your `.env.local` file (local dev) or in your hosting platform's environment settings (Azure App Service, Azure Container Apps, etc.):

```env
# ServiceNow Integration
SERVICENOW_INSTANCE=your-instance.service-now.com
SERVICENOW_USERNAME=your-username
SERVICENOW_PASSWORD=your-password
```

| Variable | Example value | Description |
|---|---|---|
| `SERVICENOW_INSTANCE` | `acmecorp.service-now.com` | Instance hostname. Accepts `https://` prefix or bare hostname — Portal 360° normalizes both. |
| `SERVICENOW_USERNAME` | `portal360.svc` | Username of the ServiceNow account used for API calls. |
| `SERVICENOW_PASSWORD` | *(secret)* | Password for the account. Never commit this to source control. |

**How it works:** The `/api/servicenow/config` endpoint reads these variables server-side and returns only the instance URL (not credentials) to the browser. All API calls to ServiceNow are made from the Next.js server, so credentials are never exposed to the client.

Once the variables are set, navigate to **ServiceNow → Incidents** in Portal 360°. The UI will display a green banner: *"ServiceNow configured via environment variables."*

### Option B — In-app configuration (browser-stored)

If environment variables are not set, Portal 360° falls back to browser-stored configuration. This is suitable for individual developer or demo use.

1. Navigate to **ServiceNow → Incidents** (or open any modal with a **Create Incident** button).
2. Click **Show ServiceNow Configuration**.
3. Enter your **Instance URL**, **Username**, and **Password**.
4. Click **Save Configuration**.

The credentials are stored in `localStorage` under the key `servicenow-config` and are used only within your browser session on that device.

> **Security note:** Browser-stored credentials are not encrypted and are accessible by JavaScript within the same origin. For shared or production deployments always use environment variables (Option A).

---

## 4. Features overview

Once configured, ServiceNow features are available at:

| Route | Description |
|---|---|
| `/servicenow/incidents` | Full incident management workspace |
| `/servicenow/knowledge` | Knowledge base article search |

Both routes require Portal 360° authentication (Microsoft Entra ID sign-in).

---

## 5. Incidents

### Viewing incidents

The incidents page (`/servicenow/incidents`) displays a live list of incidents from your ServiceNow instance:

- **KPI strip** — Shows total, open, in-progress, and resolved incident counts.
- **Table** — Columns: Number, Description, State, Priority, Assigned To, Created.
- **Search / filter** — Filter by state (open, in progress, resolved, closed) or search by keyword.
- **Sort** — Incidents are sorted newest-first by default.

The page fetches up to 100 incidents per request using the ServiceNow Table API with `sysparm_limit=100` and `ORDERBYDESCsys_created_on`.

### Incident states

| ServiceNow value | Display label |
|---|---|
| `1` | New |
| `2` | In Progress |
| `3` | On Hold |
| `6` | Resolved |
| `7` | Closed |
| `8` | Cancelled |

### Incident priority

Priority is represented by a color-coded pill. ServiceNow calculates priority from the combination of **Impact** and **Urgency**:

| Priority value | Label | Color |
|---|---|---|
| `1` | Critical | Red |
| `2` | High | Orange |
| `3` | Moderate | Yellow |
| `4` | Low | Blue |
| `5` | Planning | Gray |

### Creating an incident

1. On the Incidents page click **Create Incident** (top-right toolbar button).
2. Complete the form:
   - **Short Description** *(required)* — Summary of the issue.
   - **Description** — Full details.
   - **Category** — `inquiry`, `software`, `hardware`, `network`, or `database`.
   - **Impact** — `1 High`, `2 Medium`, `3 Low`.
   - **Urgency** — `1 High`, `2 Medium`, `3 Low`.
   - **Comments** — Any additional notes added to the incident.
3. Click **Create Incident**. On success the portal shows the new incident number and a direct link to it in ServiceNow.

### Updating an incident

Open an incident row to view the details modal. From there you can:

- Change the **state** (e.g. move from In Progress → Resolved).
- Add **work notes**.
- Update **assignment group** or **assigned to**.

Changes are submitted via `PATCH /api/servicenow/incidents/[sys_id]`.

---

## 6. Knowledge Base

The knowledge base page (`/servicenow/knowledge`) lets users search published articles in your ServiceNow instance.

### Searching

- Type a search term in the search box and press Enter or click **Search**.
- Portal 360° queries the ServiceNow Knowledge Management API first, falling back to the `kb_knowledge` Table API if the Knowledge API is unavailable.
- Only articles with `workflow_state = published` are returned.

### Viewing an article

Click any article title to open the full article content in a detail view. The article is fetched from `/api/servicenow/knowledge/[id]`.

---

## 7. Creating an incident from any page

The `ServiceNowIncidentModal` component can be dropped into any page in Portal 360° to give contextual incident creation.

```tsx
import { useState } from 'react'
import { ServiceNowIncidentModal } from '@/components/ServiceNowIncidentModal'

export default function SomePage() {
  const [showModal, setShowModal] = useState(false)

  return (
    <>
      <button onClick={() => setShowModal(true)}>
        Report Issue
      </button>

      <ServiceNowIncidentModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        initialData={{
          short_description: 'Issue on this page',
          description: 'Describe what went wrong…',
          impact: 2,
          urgency: 2,
          u_source_url: typeof window !== 'undefined' ? window.location.href : ''
        }}
      />
    </>
  )
}
```

**Props:**

| Prop | Type | Required | Description |
|---|---|---|---|
| `isOpen` | `boolean` | Yes | Controls modal visibility. |
| `onClose` | `() => void` | Yes | Called when the modal is dismissed. |
| `initialData` | `IncidentData` | No | Pre-populates form fields. |

**`IncidentData` fields:**

| Field | Type | Default | Description |
|---|---|---|---|
| `short_description` | `string` | `''` | Required incident title. |
| `description` | `string` | `''` | Full description. |
| `category` | `string` | `'inquiry'` | `inquiry`, `software`, `hardware`, `network`, `database` |
| `impact` | `1\|2\|3` | `3` | 1=High, 2=Medium, 3=Low |
| `urgency` | `1\|2\|3` | `3` | 1=High, 2=Medium, 3=Low |
| `comments` | `string` | `''` | Additional comments. |
| `u_source_url` | `string` | current page URL | Populates the custom source URL field. |

---

## 8. API endpoints reference

All API routes require Portal 360° authentication (valid Entra ID session cookie). Unauthenticated requests receive `401 Unauthorized`.

### `GET /api/servicenow/config`

Returns whether ServiceNow is configured via environment variables.

**Response:**
```json
{
  "instance": "acmecorp.service-now.com",
  "configured": true
}
```

> Credentials (`SERVICENOW_USERNAME`, `SERVICENOW_PASSWORD`) are never included in the response.

---

### `GET /api/servicenow/incidents`

Fetches the most recent 100 incidents from ServiceNow.

**Response:**
```json
{
  "success": true,
  "incidents": [ ... ]
}
```

**Error responses:**

| HTTP status | Meaning |
|---|---|
| `400` | Missing environment variable configuration |
| `401` | ServiceNow credentials rejected |
| `503` | ServiceNow instance is hibernating (PDI) |

---

### `POST /api/servicenow/incidents/create`

Creates a new incident.

**Request body:**
```json
{
  "short_description": "Required — brief issue summary",
  "description": "Optional — full details",
  "category": "inquiry",
  "impact": 3,
  "urgency": 3,
  "comments": "",
  "u_source_url": "https://portal360.example.com/azure/subscriptions"
}
```

**Success response (`201`):**
```json
{
  "success": true,
  "incident": {
    "number": "INC0010042",
    "sys_id": "abc123...",
    "link": "https://acmecorp.service-now.com/incident.do?sys_id=abc123..."
  }
}
```

---

### `PATCH /api/servicenow/incidents/[sys_id]`

Updates fields on an existing incident.

**URL example:** `PATCH /api/servicenow/incidents/abc123def456`

**Request body:** any valid ServiceNow incident fields, e.g.:
```json
{
  "state": "6",
  "work_notes": "Resolved after restarting the service."
}
```

---

### `GET /api/servicenow/knowledge`

Searches published knowledge articles.

**Query parameters:**

| Parameter | Description | Default |
|---|---|---|
| `q` | Search term | *(empty — returns recent articles)* |
| `limit` | Max results | `20` |
| `offset` | Pagination offset | `0` |

**Response:**
```json
{
  "success": true,
  "articles": [ ... ],
  "total": 42
}
```

---

### `GET /api/servicenow/knowledge/[id]`

Fetches a single knowledge article by `sys_id`.

---

## 9. Custom fields and source tracking

When Portal 360° creates an incident it populates three custom fields that help ServiceNow administrators identify where the incident originated:

| ServiceNow field | Value set by Portal 360° | Notes |
|---|---|---|
| `u_source` | `"Portal 360°"` | Static label. Configure in your ServiceNow instance if using a custom field. |
| `u_source_url` | Current page URL passed via `initialData` | Useful for deep-linking back to the exact page that triggered the report. |
| `u_source_user` | Signed-in user's email address | Set from the server-side session; cannot be spoofed. |

> **ServiceNow instance setup:** These three fields (`u_source`, `u_source_url`, `u_source_user`) must exist on the `incident` table in your ServiceNow instance for the values to be saved. If they don't exist, ServiceNow will silently ignore them. A ServiceNow administrator can add them as **String** fields via **System Definition → Tables**.

---

## 10. Troubleshooting

### "ServiceNow not configured" banner

The environment variables `SERVICENOW_INSTANCE`, `SERVICENOW_USERNAME`, and `SERVICENOW_PASSWORD` are not set. See [Option A](#option-a--environment-variables-recommended-for-production) above.

### "Authentication failed. Please check your credentials." (401)

The `SERVICENOW_USERNAME` / `SERVICENOW_PASSWORD` are incorrect or the account is locked. Verify them by logging in to your ServiceNow instance directly.

### "ServiceNow instance is hibernating" (503)

Your Personal Developer Instance has been inactive and entered hibernation. Visit `https://your-instance.service-now.com` in browser, acknowledge the wake-up prompt, wait ~2 minutes, then retry Portal 360°.

### HTML error page received instead of JSON

ServiceNow returned an HTML error page — this usually means the instance URL is wrong or the instance is unreachable. Double-check `SERVICENOW_INSTANCE` and verify the instance is accessible from your server's network (no firewall blocking outbound HTTPS to `*.service-now.com`).

### Knowledge base search returns no results

- Confirm the ServiceNow account has the `knowledge` or `knowledge_reader` role.
- Confirm there are published articles (`workflow_state = published`) in your instance.
- The Table API fallback searches `short_description` and `text` fields — ensure articles have content in those fields.

### Custom fields (`u_source`, `u_source_url`, `u_source_user`) not populated

These fields do not exist on the `incident` table in your instance. Ask a ServiceNow administrator to add them as String fields. Until they exist, the fields are silently ignored by ServiceNow and incidents are still created successfully.

### CSRF / 403 errors when creating incidents

Portal 360° uses global CSRF middleware. Ensure the page calling `ServiceNowIncidentModal` includes the CSRF token in the request. The standard `fetch` calls made by the modal component automatically include the CSRF cookie header — if you are building a custom integration outside the modal ensure you include the `x-csrf-token` header matching the CSRF cookie value.
