# Azure SRE Agent investigations in the Portal 360 queue

Portal 360 surfaces Azure SRE Agent investigation threads at
`/azure/sre-agent/investigations`, next to the Defender queues
(`/security-dashboard`, `/security-alerts`) and the ITSM queue
(`/servicenow/incidents`), so an administrator reviews one list instead of
opening the Azure portal separately.

Read-only. Sending a message to an agent (`POST /threads/{id}/messages`) is
deliberately not implemented here — it is a mutating operation that needs its
own request schema and write-authorization check.

> `/azure/sre` is the rule-based **Reliability Scanner** and is unrelated to the
> Azure SRE Agent service (`Microsoft.App/agents`).

## Upstream API

Data plane, pinned to `api-version=2025-05-01-preview`:

| Operation | Used for |
| --- | --- |
| `GET /api/v1/threads` | The queue list. Each thread carries `id`, `title`, `startMessage`, and `lastMessage`, so the list renders from one call per agent with no per-thread fetch. |
| `GET /api/v1/threads/{threadId}` | Thread detail. |
| `GET /api/v1/threads/{threadId}/messages` | The investigation timeline. |

Base URL is per agent, read from the control-plane property
`properties.agentEndpoint` and cached under a **caller-scoped** key
(`src/lib/sre-agent/endpoint.ts`). The agent list is produced by the caller's own
Azure RBAC, so a tenant-wide cache would leak the existence of agents the
operator cannot read.

## Auth

`getSreAgentTokenForUser()` in `@/lib/graphClient` acquires a delegated token for
the `https://azuresre.dev` audience. It is *not* an ARM token — ARM tokens are
rejected by the data plane. Like every other `*ForUser` helper it throws
`DelegatedAuthRequiredError`, which `toClientError` maps to
`401 { error: 'reauth_required' }`, so a missing consent surfaces as a re-auth
prompt rather than an opaque 500.

## SignalR: decided — server-side polling

The API reference describes real-time streaming over a SignalR `AgentHub` at
`/agentHub`, connected with "the same bearer token".

**That is not usable from Portal 360's browser.** A browser-side SignalR client
would have to hold an `azuresre.dev` access token, and the BFF rule is absolute:
the browser never sees an access token.

The options considered:

1. **Server-side polling** — the browser polls Portal 360's own
   `/api/azure/sre-agent/threads`, and only the server talks to the agent.
2. **Server-side SignalR client** in the BFF, relayed to the browser over a
   separate channel carrying no upstream token.
3. Browser-side SignalR — **rejected**, violates the token rule.

**Option 1 is implemented.** An incident queue does not need sub-second updates,
and polling adds no long-lived server-side connection state to manage. The client
refreshes every 60 seconds (`POLL_INTERVAL_MS` in
`SreAgentInvestigationsClient.tsx`). Option 2 remains available if a demonstrated
need for faster updates appears; nothing in the current UI assumes streaming.

## Handling the undocumented message schema

A message object carries a wide set of nullable execution-result fields —
`azCliExecution`, `kubectlExecution`, `psqlExecution`, `mcpToolExecution`,
`readFileResult`, `fileWriteResult`, `terminalResult`, `approval`, and more —
none of which appear in the published reference. Consequently:

- **Only an allow-list is normalized.** `normalizeMessage()` in
  `src/lib/sre-agent/threads.ts` types the handful of fields the timeline renders
  and drops everything else, so a new preview field cannot break parsing and
  cannot leak by accident.
- **Raw message objects are never returned.** Execution results carry command
  output and file contents. The UI shows only the *names* of the fields that were
  present, e.g. "Tools used: azCliExecution".
- **Approval payloads are not forwarded.** Approval objects were observed to
  embed an `oboToken`. A message that carries one is reduced to a
  `hasApproval: true` flag. The dedicated approvals endpoint remains the source of
  truth for acting on an approval.
- **Agent-relative links are stripped.** `text` contains markdown links such as
  `/api/files/tmp/ThreadFiles/{threadId}/…` which resolve against the agent
  endpoint, not the portal origin. `stripAgentRelativeLinks()` reduces them to
  their label so the UI never emits a link that 404s. Absolute `http(s)` links
  are left intact.
- **Message text is rendered as plain text**, never as HTML.

`author.displayName` was observed to contain a full UPN, so it is rendered but
never written to the server log. No thread bearer material, token, or author
identity appears in log output.

## Follow-up: ServiceNow correlation

When an agent's `properties.incidentManagementConfiguration.type` is
`ServiceNow`, its threads can be joined to the incident records Portal 360
already holds under `/servicenow/incidents`. The type is captured on every thread
summary (`incidentManagementType`) and shown as a badge; the join itself is
deliberately left as follow-up work now that the base queue exists.
