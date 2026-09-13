# Human Review Queue

Portal 360 includes a first-slice human-in-the-loop review queue for Copilot Studio connector-risk workflows.

## Purpose

Copilot Studio and Power Automate can pause a workflow by calling a custom connector webhook action. Portal 360 stores the Power Platform callback URL server-side, shows the request in a governance queue, and resumes the workflow only after an authenticated reviewer submits a decision.

## Portal route

- `/power-platform/governance/human-review`

The page shows pending and completed connector-risk review requests, connector context supplied by the workflow, and reviewer responses.

## API endpoints

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/hitl/requests/$subscriptions` | Custom connector webhook action endpoint. Stores `notificationUrl` and returns `201`. |
| `GET` | `/api/hitl/requests` | Lists review requests for authenticated Portal 360 users. Optional `status` query. |
| `POST` | `/api/hitl/requests/{id}/respond` | Posts the reviewer response to Power Platform and marks the request complete. |
| `DELETE` | `/api/hitl/requests/{id}` | Webhook unsubscribe/cancel endpoint. |

## Custom connector shape

The subscription request body follows the Power Platform webhook action pattern:

```json
{
  "notificationUrl": "https://prod-00.logic.azure.com/...",
  "body": {
    "title": "Review connector risk before publishing",
    "message": "The agent uses connectors that require admin review.",
    "assignedTo": "admin@contoso.com",
    "metadata": {
      "scenario": "copilot-connector-risk-review",
      "agentName": "Contoso Support Agent",
      "environmentName": "Production",
      "riskLevel": "High",
      "connectors": [
        {
          "name": "shared_http",
          "displayName": "HTTP",
          "risk": "High",
          "reason": "Can call arbitrary external endpoints"
        }
      ]
    }
  }
}
```

The connector action should include `x-ms-notification-url: true` for `notificationUrl` and `x-ms-notification-content` for the resume payload. Do not mark the action as `x-ms-trigger`; webhook actions pause the current flow, while triggers start new runs.

## Security notes

- Portal 360 never returns the Power Platform `notificationUrl` to the browser.
- Browser review actions require an authenticated Portal 360 session and CSRF protection.
- Connector calls can use the optional `PORTAL360_HITL_CONNECTOR_SECRET` server-side shared secret through `x-portal360-hitl-secret` or `Authorization: Bearer <secret>`.
- The current store is process-local and intended for a first slice. Production deployments should move review records to durable storage such as Cosmos DB, SQL, or Redis.