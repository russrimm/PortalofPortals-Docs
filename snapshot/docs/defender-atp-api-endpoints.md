# WindowsDefenderATP API Endpoints

This page documents the Defender endpoints surfaced in `src/app/defender-atp/page.tsx` and proxy route `src/app/api/defender-atp/route.js`.

## Base URL and auth

- Base URL: `https://api.security.microsoft.com/api`
- OAuth token scope: `https://api.security.microsoft.com/.default`
- Auth flow: client credentials (application context)
- Primary reference: https://learn.microsoft.com/en-us/defender-xdr/api-access

## Environment variables

- `DEFENDER_ATP_CLIENT_ID`
- `DEFENDER_ATP_CLIENT_SECRET`
- `DEFENDER_ATP_TENANT_ID`
- `DEFENDER_ATP_TEANT_ID` (supported fallback for typo compatibility)
- `DEFENDER_ATP_SCOPE` (optional override, defaults to `https://api.security.microsoft.com/.default`)
- `DEFENDER_ATP_BASE_URL` (optional override, defaults to `https://api.security.microsoft.com/api`)
- `DEFENDER_CLOUD_APPS_BASE_URL` (required for Cloud Apps alerts, example: `https://<tenant>.<region>.portal.cloudappsecurity.com`)
- `DEFENDER_CLOUD_APPS_TOKEN` (required for Cloud Apps alerts, API token from Defender for Cloud Apps)

## Useful endpoints displayed

- `GET /api/alerts`
  - Use case: SOC triage dashboards by severity and status
  - Common query: `$top`, `$filter`, `$orderby`, `$expand=evidence`
  - Doc: https://learn.microsoft.com/en-us/defender-endpoint/api/get-alerts

- `GET /api/machines`
  - Use case: inventory, health, risk, and stale endpoint detection
  - Common query: `$top`, `$filter`, `$orderby`
  - Doc: https://learn.microsoft.com/en-us/defender-endpoint/api/get-machines

- `GET /api/recommendations`
  - Use case: vulnerability management and remediation backlog

- `GET /api/vulnerabilities`
  - Use case: CVE exposure tracking

- `GET /api/software`
  - Use case: software inventory and vulnerable package mapping

- `GET /api/incidents`
  - Use case: Defender XDR incident queue and response ownership
  - Common query: `$top`, `$filter`, `$skip`
  - Doc: https://learn.microsoft.com/en-us/defender-xdr/api-list-incidents

- `GET /api/investigations`
  - Use case: monitor automated investigation outcomes
  - Common query: `$top`, `$filter`, `$skip`
  - Doc: https://learn.microsoft.com/en-us/defender-endpoint/api/get-investigation-collection

- `GET /api/exposureScore`
  - Use case: executive KPI for threat and vulnerability posture
  - Doc: https://learn.microsoft.com/en-us/defender-endpoint/api/get-exposure-score

- `POST https://<tenant>.<region>.portal.cloudappsecurity.com/api/v1/alerts/`
  - Use case: list alerts from Microsoft Defender for Cloud Apps
  - Auth: `Authorization: Token <token>`
  - Implemented through local proxy route: `POST /api/defender-cloud-apps/alerts`
  - Doc: https://learn.microsoft.com/en-us/defender-cloud-apps/api-alerts-list

## Cloud Discovery (discovered apps) via Microsoft Graph

Shadow IT discovered by Defender for Cloud Apps is read through Microsoft Graph
rather than the legacy Cloud App Security REST API, so it uses the signed-in
admin's delegated token instead of a static service token. These endpoints are
in Graph **beta** and are documented by Microsoft as preview.

Required delegated permission: `CloudApp-Discovery.Read.All` (admin consent).

- `GET /security/dataDiscovery/cloudAppDiscovery/uploadedStreams`
  - Use case: enumerate Cloud Discovery streams and pick a stream id
  - Portal route: `GET /api/defender-cloud-apps/discovered-apps/streams`
  - Doc: https://learn.microsoft.com/en-us/graph/api/security-datadiscoveryreport-list-uploadedstreams?view=graph-rest-beta

- `GET .../uploadedStreams/{streamId}/microsoft.graph.security.aggregatedAppsDetails(period=duration'P30D')`
  - Use case: discovered app inventory with risk score, user count, IP count, transactions, and traffic
  - Portal route: `GET /api/defender-cloud-apps/discovered-apps?streamId=&period=&top=&skip=&minRiskScore=&maxRiskScore=&category=&nameStartsWith=`
  - Supported periods: `P7D`, `P30D`, `P90D`
  - Doc: https://learn.microsoft.com/en-us/graph/api/security-cloudappdiscoveryreport-aggregatedappsdetails?view=graph-rest-beta

- `GET .../aggregatedAppsDetails(period=duration'P30D')/{appId}/{users|ipAddresses}`
  - Use case: identify who and what accessed a single discovered app
  - Portal route: `GET /api/defender-cloud-apps/discovered-apps/{appId}?streamId=&period=&entity=users|ipAddresses`
  - Streams configured to anonymize data return pseudonymized identifiers such as `AnonymousUser`
  - Doc: https://learn.microsoft.com/en-us/defender-cloud-apps/discovered-apps-api-graph

Portal page: `/defender-cloud-apps/discovered-apps`.

## Notes

- API quotas vary by endpoint (for example, incidents: 50 calls/minute).
- The API route enforces an endpoint allowlist to avoid arbitrary upstream fetches.
- If results are truncated, follow `@odata.nextLink` for paging.
