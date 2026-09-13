# OpenTelemetry startup and Application Insights

The server uses the existing Azure Monitor OpenTelemetry distribution,
`@azure/monitor-opentelemetry`. Do not add a second telemetry client or a separate
console-to-Application-Insights transport.

## Framework entry point

`src/instrumentation.ts` is beside `src/app`, as required by the
[Next.js instrumentation convention](https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation).
There is no root-level hook and no `experimental.instrumentationHook` flag.
Next.js awaits `register()` before the server is ready to handle requests.

The hook validates authentication configuration in every runtime, then imports
`src/instrumentation-node.ts` only when `NEXT_RUNTIME=nodejs`. The Node module
checks Redis and Cosmos configuration before optional telemetry or scheduling.
It does not import the token store, acquire credentials, connect to those
backends, or prove their availability.

Registration shares one promise per process/global runtime, including concurrent
calls and module reloads. A required-configuration failure remains rejected;
correct the host configuration and restart. This is not distributed coordination
between workers, replicas, or deployment slots.

## Required guards versus optional work

| Condition | Startup behavior |
|---|---|
| Production missing auth signing secret or valid callback URL | Reject startup, even if telemetry is disabled or absent. |
| Production `PORTAL360_ALLOW_SYNTHETIC_AUTH=1` | Reject startup in every runtime. The independent guard in `src/lib/auth.ts` remains in place. |
| Node with `PORTAL360_REQUIRE_REDIS=1` and no Redis configuration | Reject startup in any environment. |
| Node with `PORTAL360_REQUIRE_COSMOS=1` and no Cosmos endpoint | Reject startup in any environment. |
| Production Node missing optional Redis or Cosmos configuration | Emit the existing degraded-state warning. |
| Development Node | Run guards and optional scheduler, but skip the telemetry SDK to avoid development bundler conflicts. |
| Non-development Node with `AZURE_TELEMETRY_DISABLED=true` | Skip telemetry, not required guards or the scheduler. |
| Non-development Node without `APPLICATIONINSIGHTS_CONNECTION_STRING` | Warn and skip telemetry, not required guards or the scheduler. |
| Telemetry SDK initialization throws | Emit an error without raw SDK/configuration details; still register an opted-in scheduler. |
| Edge or unspecified/unsupported `NEXT_RUNTIME` | Run auth validation only; do not import Node SDKs or register Node timers. |

Required guards have no telemetry or build-mode bypass. Before rolling out this
hook, the deployment owner must confirm the runtime auth settings and required
backend settings. If a build or test process invokes registration, it must also
satisfy those guards; never enable production synthetic auth to make it pass.
See [environment configuration](./ENVIRONMENT-VARIABLES.md).

Next.js can bind a listener and print a ready banner before asynchronous
preparation fails. In a rejected startup, requests can return `500` while the
process remains alive. Do not treat the banner or a listening socket as proof
that required guards passed; check application readiness and startup errors.

## Telemetry configuration

For a non-development Node server, supply
`APPLICATIONINSIGHTS_CONNECTION_STRING` through the host's existing configuration
mechanism and leave `AZURE_TELEMETRY_DISABLED` unset or not equal to `true`.
Changing these startup settings requires a process restart. Development does not
export server telemetry even when a connection string is supplied.

`useAzureMonitor()` receives the existing exporter configuration and enables HTTP
and Azure SDK instrumentation. Its resource attributes use:

| Attribute | Value |
|---|---|
| `service.name` / `cloud.role` | `PortalofPortals` |
| `service.version` | `npm_package_version`, falling back to `0.1.0` |
| `cloud.roleInstance` | `WEBSITE_INSTANCE_ID`, then `HOSTNAME`, then `local` |
| `deployment.environment` | `NODE_ENV`, falling back to `production` |

The initialization message begins
`[OpenTelemetry] Azure Monitor initialized` and includes the service and version,
never the connection string. It proves only that SDK initialization returned, not
that data reached Application Insights. Ingestion, permissions, resource
configuration, and live telemetry must be verified separately in an approved
environment. Do not infer them from source code or a local mocked test.

The existing browser telemetry path remains separate and unchanged. Its public
configuration is described in
[environment configuration](./ENVIRONMENT-VARIABLES.md#6-application-insights--opentelemetry-optional).

## Logging and audit separation

The distribution does not forward `console` output to Application Insights.
Console output goes to stdout/stderr and, on App Service, the log stream.
The startup hook suppresses development `console.log`, `console.info`, and
`console.debug` unless `ENABLE_API_LOGGING=true`, but never suppresses warnings
or errors. Server application logging continues through `src/lib/logger.ts`.

Audit persistence is not console logging or telemetry. Keep `logSensitiveAction`,
`logSecurityEvent`, `recordAuditEvent`, and token-audit transports independent.
Never attach tokens, cookies, secrets, session IDs, tenant IDs, or user identifiers
to diagnostic output or custom span/metric attributes.

## Optional tenant-health scheduling

`MULTITENANT_HEALTH_INTERVAL_MIN` is off by default (unset or `0`). A positive
whole number from `1` to `35791`, a configured callback origin, and the existing
`PORTAL360_CRON_SECRET` opt in to one in-process timer set. Invalid/overflowing
intervals warn and remain off rather than being truncated into rapid timers.
The timer policy is independent of telemetry in both development and production.

The first callback is delayed 30 seconds. The interval then requests the existing
health-refresh endpoint; redirects are rejected so the cron credential is not
forwarded to a redirected destination. No job runs at registration time.
Each process schedules independently. Use an external scheduler for
multi-instance deployments and leave the in-process interval at `0`; neither
mode promises distributed exactly-once execution.
See [scheduled health refresh](./multi-tenant-onboarding.md#7-scheduled-health-refresh)
for the existing endpoint and credential requirements.

## Troubleshooting

If startup fails, resolve the auth, Redis, or Cosmos guard error first. Disabling
telemetry cannot resolve a required-configuration failure.

If server telemetry is absent, confirm a non-development Node runtime, the
presence (not the printed value) of the connection string, and the telemetry
opt-out setting. Check the initialization/error signal in the host log stream.
Then verify ingestion in the intended Application Insights resource through an
approved read-only check. Do not print connection strings or raw SDK errors.

## References

- [Next.js instrumentation convention](https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation)
- [Azure Monitor OpenTelemetry for Node.js](https://learn.microsoft.com/en-us/azure/azure-monitor/app/opentelemetry-enable?tabs=nodejs)
- [OpenTelemetry JavaScript](https://opentelemetry.io/docs/languages/js/)
