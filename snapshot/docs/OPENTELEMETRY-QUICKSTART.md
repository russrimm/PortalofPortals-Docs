# OpenTelemetry Quick Start Guide

The existing server integration uses `@azure/monitor-opentelemetry`, loaded by
`src/instrumentation.ts` beside `src/app`. No experimental Next.js hook flag or
additional telemetry client is required.

Before enabling telemetry in an approved environment:

1. Confirm production auth settings and any required Redis/Cosmos settings. These
   startup guards run independently of telemetry and reject invalid required
   configuration.
2. Supply `APPLICATIONINSIGHTS_CONNECTION_STRING` through the host's existing
   configuration mechanism. Do not print or commit its value.
3. Use a non-development Node server with `AZURE_TELEMETRY_DISABLED` unset or not
   equal to `true`, then restart the process. `pnpm run dev` intentionally skips
   server telemetry.

The startup message begins `[OpenTelemetry] Azure Monitor initialized` and names
the service `PortalofPortals`. It only confirms SDK initialization returned;
it does not prove successful ingestion. Verify live data separately in the
intended Application Insights resource with an approved read-only check.

Tenant-health scheduling remains off by default and is independent of telemetry.
Do not enable it merely to exercise instrumentation. Console warnings/errors and
durable audit persistence keep their existing transports.

See [startup and telemetry behavior](./OPENTELEMETRY-SETUP.md),
[environment configuration](./ENVIRONMENT-VARIABLES.md#6-application-insights--opentelemetry-optional),
and [scheduler configuration](./multi-tenant-onboarding.md#7-scheduled-health-refresh)
for the runtime matrix, opt-in requirements, and troubleshooting.
