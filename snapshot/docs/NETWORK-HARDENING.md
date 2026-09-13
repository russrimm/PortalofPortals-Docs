# Network Hardening for Corporate Deployments

How to progressively lock down the network path to Portal 360° when it runs on Azure
App Service, without changing a line of application code.

Portal 360° is already hardened at the application layer — every API route authenticates
first, tokens never leave the server, and errors are sanitized through `toClientError`.
This document covers the layer *below* that: who can reach the app at all, and what the
app can reach outbound.

> **Every setting, flag, property name, and CLI command in this document is taken from
> current Microsoft Learn documentation.** Links to the source page are given per
> section. Prices are US East retail list prices from the Azure retail price API at the
> time of writing and are for **relative comparison only** — confirm current figures for
> your region and agreement in the
> [Azure pricing calculator](https://azure.microsoft.com/pricing/calculator).

---

## Contents

- [Deployment tiers at a glance](#deployment-tiers-at-a-glance)
- [Control 1 — App Service access restrictions and IP allowlists](#control-1--app-service-access-restrictions-and-ip-allowlists)
- [Control 2 — Virtual network integration (outbound)](#control-2--virtual-network-integration-outbound)
- [Control 3 — Private endpoints for Cosmos DB and Redis](#control-3--private-endpoints-for-cosmos-db-and-redis)
- [Control 4 — Front Door and WAF fronting](#control-4--front-door-and-waf-fronting)
- [Cost summary](#cost-summary)
- [Rollout order](#rollout-order)
- [Verification](#verification)

---

## Deployment tiers at a glance

The three tiers below are cumulative — "Mid" includes everything in "Small".

| | **Small** | **Mid** | **Large** |
|---|---|---|---|
| **Profile** | Pilot, single team, internal users only | Departmental rollout, corporate network + VPN | Enterprise / regulated, internet-facing |
| **App Service plan** | B1–B2 Linux | P0v3–P1v3 Linux | P1v3–P2v3 Linux, zone redundant |
| **Inbound access** | IP allowlist on main + SCM site | IP allowlist + service tag rules | Public access disabled; Front Door Premium via Private Link |
| **Outbound** | Public egress | Regional VNet integration | VNet integration + `vnetRouteAllEnabled`, NAT gateway, egress firewall |
| **Cosmos DB** | IP firewall | Private endpoint, public access disabled | Private endpoint + private DNS zone in hub |
| **Redis** | Firewall rules | Private endpoint, public access disabled | Private endpoint + private DNS zone in hub |
| **Edge** | None | None (or Front Door Standard) | Front Door Premium + WAF managed rules |
| **Added network spend/mo** | ~$0 | ~$50–70 | ~$400+ |

---

## Control 1 — App Service access restrictions and IP allowlists

Access restrictions are an ordered allow/deny list evaluated by the App Service front
end, before your app runs. They cost nothing and are the highest-value first step.

**Source:** [Azure App Service access restrictions](https://learn.microsoft.com/azure/app-service/overview-access-restrictions)
· [Set up access restrictions](https://learn.microsoft.com/azure/app-service/app-service-ip-restrictions)
· [`az webapp config access-restriction`](https://learn.microsoft.com/cli/azure/webapp/config/access-restriction)

### How the rules actually evaluate

These behaviors are the ones teams most often get wrong:

- **Rules are evaluated in priority order, lowest number first.**
- **The unmatched rule is implicit until you set it.** With no rules at all, the default
  is *allow all*. The moment you add one rule, it implicitly becomes *deny all*. You can
  set it explicitly to `Allow` or `Deny` regardless of the rules present.
- **The SCM (Kudu / advanced tools) site has its own separate rule collection** and its
  own unmatched rule. A setting lets it inherit the main site's rules instead. You cannot
  selectively allow individual SCM features.
- **IP rules do not match private VNet ranges on multitenant App Service.** IP-based
  rules only handle virtual network address ranges when the app runs in an App Service
  Environment. On multitenant App Service you must use a **service endpoint** rule
  (`--vnet-name` / `--subnet`) to allow a subnet.
- **HTTP header filters are limited to four header names:** `X-Forwarded-For`,
  `X-Forwarded-Host`, `X-Azure-FDID`, and `X-FD-HealthProbe`. Each accepts up to eight
  comma-separated values. Header filters are evaluated *after* the rule itself; both must
  match for the rule to apply.
- **Multi-source rules** combine up to eight IP ranges or eight service tags in one rule.
  Use them if you exceed 512 IP ranges or want one logical rule.
- **The `AppService` service tag cannot be used to restrict access between App Service
  apps** — it contains only inbound IPs of multitenant apps, and Microsoft explicitly
  notes a service tag is a list of IP addresses, not a security control.

### Commands

```bash
# Allow the corporate egress range to the main site
az webapp config access-restriction add \
  --resource-group <rg> --name <app> \
  --rule-name 'corp-egress' --action Allow \
  --ip-address 203.0.113.0/24 --priority 100

# Allow only the build agent subnet to reach the SCM/Kudu site
az webapp config access-restriction add \
  --resource-group <rg> --name <app> \
  --rule-name 'build-agents' --action Allow \
  --vnet-name <vnet> --subnet <agents-subnet> \
  --priority 200 --scm-site true
```

Set the unmatched rule explicitly rather than relying on the implicit behavior. The
property lives on `siteConfig`, so it is set with `az resource update`, not
`az webapp config`:

```bash
# Deny everything not explicitly allowed on the main site
az resource update --resource-group <rg> --name <app> \
  --resource-type "Microsoft.Web/sites" \
  --set properties.siteConfig.ipSecurityRestrictionsDefaultAction=Deny

# Same for the SCM site
az resource update --resource-group <rg> --name <app> \
  --resource-type "Microsoft.Web/sites" \
  --set properties.siteConfig.scmIpSecurityRestrictionsDefaultAction=Deny
```

Accepted values for both properties are `Allow` and `Deny`. In Bicep, set
`ipSecurityRestrictionsDefaultAction` inside the site's `siteConfig` block.

### Recommendation

| Size | Recommendation | Cost impact |
|---|---|---|
| **Small** | Allowlist the corporate egress ranges and the CI/CD agent ranges. Set both unmatched rule actions to `Deny`. | **$0** — included in all plans |
| **Mid** | As Small, plus a service endpoint rule for the VNet-integrated management subnet, and separate stricter rules on the SCM site. | **$0** |
| **Large** | Access restrictions become a defense-in-depth backstop. The primary control is `publicNetworkAccess: 'Disabled'` plus a private endpoint, with a single service tag rule for `AzureFrontDoor.Backend` filtered on `X-Azure-FDID`. | **$0** |

> **Gotcha:** Setting `publicNetworkAccess` to `Disabled` **restarts Linux sites**. Plan
> it into a maintenance window — Portal 360° runs on Linux App Service.

---

## Control 2 — Virtual network integration (outbound)

Regional VNet integration gives the app a route into your virtual network so it can reach
private resources — which is the prerequisite for private endpoints on Cosmos DB and
Redis. It controls **outbound** traffic only; it does not restrict who can reach the app.

**Source:** [Enable virtual network integration in Azure App Service](https://learn.microsoft.com/azure/app-service/configure-vnet-integration-enable)
· [Integrate your app with a virtual network](https://learn.microsoft.com/azure/app-service/overview-vnet-integration)

### Requirements

- A **dedicated compute pricing tier**. There is no added cost for regional VNet
  integration in the Basic, Standard, Premium v2, Premium v3, and Isolated v2 App Service
  plans, and in Azure Functions Premium plans.
- The virtual network and subnet must be **in the same region** as the app.
- The subnet must be **empty** — no NICs, VMs, or private endpoints in it.
- The subnet must be **delegated to `Microsoft.Web/serverFarms`**. If you do not delegate
  it beforehand, the provisioning process applies the delegation for you.
- Minimum subnet size is an IPv4 **`/28`** (16 addresses). Microsoft recommends a minimum
  of 64 addresses (**`/26`**) to allow for horizontal scale.
- If the VNet is in a different subscription than the app, that subscription must be
  registered with the `Microsoft.Web` resource provider.

```bash
az webapp vnet-integration add \
  --resource-group <app-rg> --name <app> \
  --vnet <vnet> --subnet <integration-subnet>
```

The command checks the delegation and applies it if missing. Use
`--skip-delegation-check` when you lack permission to read the subnet or the VNet is in
another subscription.

### Route All

By default only RFC 1918 private traffic is routed into the VNet. To send *all* outbound
traffic through the VNet — required if you want an egress firewall or a NAT gateway with
a stable outbound IP — enable **Route All** (`vnetRouteAllEnabled`). Note the
troubleshooting implication: if your destination is a non-RFC 1918 address and Route All
is off, traffic will not traverse the VNet.

Portal 360° calls Microsoft Graph, ARM, Power Platform, and Dataverse over the public
internet. Turning on Route All means those calls now transit your egress path, so the
firewall must permit them or the portal breaks.

### Recommendation

| Size | Recommendation | Cost impact |
|---|---|---|
| **Small** | Skip. Use Cosmos DB and Redis firewall rules instead. | **$0** |
| **Mid** | Enable regional VNet integration on a dedicated `/26` subnet delegated to `Microsoft.Web/serverFarms`. Leave Route All **off** so Microsoft API egress is unaffected. | **$0** for the feature; requires Basic or higher. B1 Linux ≈ $12/mo, P1v3 Linux ≈ $113/mo |
| **Large** | VNet integration plus `vnetRouteAllEnabled`, a NAT gateway for a stable outbound IP, and an egress firewall allowlisting the Microsoft endpoints Portal 360° calls. | NAT gateway and firewall are the real cost here — typically **$35–45/mo** for NAT gateway plus data processing, far more for Azure Firewall |

> **Sizing note:** a `/28` is the documented minimum but leaves only 16 addresses. Use a
> `/26` — you cannot resize the subnet later without tearing down the integration.

---

## Control 3 — Private endpoints for Cosmos DB and Redis

Portal 360° stores audit logs, user settings, KPI snapshots, and drift snapshots in
Cosmos DB (see `infra/main.bicep`), and uses Redis for caching and session state. Both
are reachable from the public internet by default. Private endpoints remove that exposure.

Private endpoints require Control 2 — the app must be VNet-integrated to resolve and
reach a private endpoint.

### Cosmos DB

**Source:** [Configure Azure Private Link for an Azure Cosmos DB account](https://learn.microsoft.com/azure/cosmos-db/how-to-configure-private-endpoints)
· [Private Endpoint DNS zone values](https://learn.microsoft.com/azure/private-link/private-endpoint-dns)

| Setting | Value |
|---|---|
| Resource type | `Microsoft.DocumentDB/databaseAccounts` |
| Subresource (group ID) | `Sql` |
| Private DNS zone | `privatelink.documents.azure.com` |
| Public DNS forwarder | `documents.azure.com` |

The critical ordering detail: **adding a private endpoint alone leaves a public exposure
window.** Unless firewall rules are set, an account is reachable publicly between creation
and the private endpoint being added. Set `publicNetworkAccess` to `Disabled` **at account
creation** to close it. That flag takes precedence over every IP and VNet rule — all
public and virtual network traffic is blocked when it is `Disabled`, even for a source IP
that the firewall allows.

Equally important: if you configure no public traffic rules and no service endpoint, then
after all approved private endpoints are rejected or deleted, **the account reopens to the
entire network** unless `publicNetworkAccess` is `Disabled`. Treat that flag as the
control, not the private endpoint.

The Bicep in `infra/main.bicep` already exposes `cosmosPublicNetworkAccessEnabled`,
`cosmosAllowedIpRanges`, and `cosmosAllowAzureServices` — set
`cosmosPublicNetworkAccessEnabled: false` for the Mid and Large tiers.

### Redis

**Source:** [Azure Cache for Redis with Azure Private Link](https://learn.microsoft.com/azure/azure-cache-for-redis/cache-private-link)

| Setting | Value |
|---|---|
| Resource type | `Microsoft.Cache/Redis` |
| Subresource (group ID) | `redisCache` |
| Private DNS zone | `privatelink.redis.cache.windows.net` |
| Connection target | `<cachename>.redis.cache.windows.net` on port `6380` |

- Private Link is supported on **all tiers** — Basic, Standard, Premium, Enterprise, and
  Enterprise Flash.
- Once a private endpoint exists on a Basic, Standard, or Premium cache,
  `publicNetworkAccess` is **`Disabled` by default**, allowing only private link access.
  Enterprise and Enterprise Flash do not support the flag at all.
- The `privatelink.redis.cache.windows.net` private DNS zone is created automatically in
  your subscription and is required for the TLS connection to work. **Keep your connection
  string pointed at `<cachename>.redis.cache.windows.net`** — Microsoft recommends against
  using the `privatelink.` hostname in configuration. Portal 360°'s `REDIS_URL` needs no
  change when you add a private endpoint.
- Firewall rules only apply when public network access is **enabled**. A private-endpoint
  cache with public access enabled and no firewall rules accepts all public traffic.
- Basic, Standard, and Premium caches are limited to 100 private links.
- Microsoft does not recommend VNet injection; use private endpoints.

> **Retirement — plan for this now.** Azure Cache for Redis **Basic, Standard, and Premium
> tiers retire on September 30, 2028**, and all workloads must move to
> [Azure Managed Redis](https://learn.microsoft.com/azure/redis/migrate/migrate-basic-standard-premium-overview)
> by then. Since April 1, 2026 new customers cannot create these tiers; existing customers
> (any subscription in the tenant had a cache before April 1, 2026) can keep creating them
> until retirement — Microsoft removed the previously announced October 2026 creation block
> for existing customers. Azure Managed Redis uses a different private DNS zone,
> `privatelink.redis.azure.net`, with subresource `redisEnterprise` on
> `Microsoft.Cache/RedisEnterprise`. **New Portal 360° deployments should start on Azure
> Managed Redis** rather than migrate later.

### Recommendation

| Size | Recommendation | Cost impact |
|---|---|---|
| **Small** | No private endpoints. Use the Cosmos DB IP firewall (`cosmosAllowedIpRanges`) and Redis firewall rules, scoped to App Service outbound IPs. Accept that outbound IPs change on scale operations. | **$0** |
| **Mid** | Private endpoint on Cosmos DB with `publicNetworkAccess: Disabled`; private endpoint on Redis (public access defaults to disabled). Two private endpoints plus two private DNS zones. | **~$15–25/mo** for two endpoints plus data processing; private DNS zones are a few cents/mo |
| **Large** | As Mid, with private DNS zones hosted centrally in the hub VNet and linked to the spoke, so name resolution is governed once. Add endpoints for Key Vault and Storage on the same pattern. | **~$8–12/mo per additional endpoint** |

> Private endpoint pricing is billed per endpoint-hour plus inbound/outbound data
> processed. The figures above are order-of-magnitude only — confirm against
> [Private Link pricing](https://azure.microsoft.com/pricing/details/private-link/) before
> you budget.

---

## Control 4 — Front Door and WAF fronting

Front Door adds a global edge in front of Portal 360°: TLS termination, WAF, and — on
Premium only — a private path to the origin so the app needs no public exposure at all.

**Source:** [Compare pricing between Azure Front Door tiers](https://learn.microsoft.com/azure/frontdoor/understanding-pricing)
· [Connect Azure Front Door Premium to an App Service origin with Private Link](https://learn.microsoft.com/azure/frontdoor/standard-premium/how-to-enable-private-link-web-app)

### Standard vs Premium

| Capability | Standard | Premium |
|---|---|---|
| Base fee | **$35/month** | **$330/month** |
| WAF custom rules | Free | Free |
| WAF **managed** rules | **Not supported** | Free |
| Bot protection | Not supported | Included |
| **Private Link to origin** | **Not supported** | Free |
| First 100 custom domains | Free | Free |

Requests and egress are metered on top of the base fee in both tiers. Managed rule sets,
bot protection, and Private Link to origin are all Premium-only — if you need any one of
them, the base fee is $330/month.

### Locking the origin to Front Door

Two options, in increasing order of strength.

**Option A — service tag plus header filter (works with Standard).** Front Door traffic
originates from the `AzureFrontDoor.Backend` service tag. That tag alone only proves the
request came from *some* Front Door instance, so you must also filter on the `X-Azure-FDID`
header, which carries your unique Front Door ID:

```bash
az webapp config access-restriction add \
  --resource-group <rg> --name <app> --priority 100 \
  --service-tag AzureFrontDoor.Backend \
  --http-header x-azure-fdid=<your-front-door-id>
```

Then set `ipSecurityRestrictionsDefaultAction=Deny` so nothing else gets through. Find the
Front Door ID in the portal.

**Option B — Private Link origin (Premium only).** Front Door creates a private endpoint
into your origin from its own managed regional network. The request lands at the origin
pending your approval, and **no traffic flows until you approve it**:

```bash
az network private-endpoint-connection list \
  --name <app> --resource-group <rg> --type 'Microsoft.Web/sites'

az network private-endpoint-connection approve --id <connection-resource-id>
```

Expect a few minutes after approval before the connection establishes — requests return a
Front Door error message until it does. With Option B you can set the app's
`publicNetworkAccess` to `Disabled` entirely.

### Recommendation

| Size | Recommendation | Cost impact |
|---|---|---|
| **Small** | Skip Front Door. Access restrictions on an internal-only app are sufficient. | **$0** |
| **Mid** | Front Door Standard with WAF **custom** rules only (rate limiting, geo-filtering), origin locked with `AzureFrontDoor.Backend` + `X-Azure-FDID`. | **$35/mo** base + requests + egress |
| **Large** | Front Door Premium with WAF **managed** rule sets and bot protection, Private Link to the App Service origin, and `publicNetworkAccess: 'Disabled'` on the app. | **$330/mo** base + requests + egress. Managed rules and Private Link are included at no extra charge in Premium |

> The jump from $35 to $330 is the single largest line item in this document. Justify it
> on managed rule sets and Private Link — not on TLS or caching, which Standard also does.

---

## Cost summary

Monthly, US East retail list, App Service on Linux. Compute is shown for context; the
"added" column is what network hardening itself costs.

| Item | Small | Mid | Large |
|---|---|---|---|
| App Service plan | B1 ≈ **$12** | P1v3 ≈ **$113** | P2v3 ≈ **$226** |
| Access restrictions | $0 | $0 | $0 |
| VNet integration | — | $0 | $0 |
| NAT gateway / egress firewall | — | — | **$35+** |
| Private endpoints | — | ~**$15–25** (2) | ~**$30–50** (4+) |
| Private DNS zones | — | ~**$1** | ~**$1** |
| Front Door | — | **$35** | **$330** |
| **Added network spend** | **~$0** | **~$50–70** | **~$400+** |

App Service Linux hourly rates used above (US East retail, ×730 h): B1 $0.017, B2 $0.034,
B3 $0.067, S1 $0.095, S2 $0.19, P0v3 $0.0775, P1v3 $0.155, P2v3 $0.31, P3v3 $0.62.

Front Door base fees are from Microsoft Learn. Private endpoint, NAT gateway, and DNS
figures are approximate and **must be confirmed** in the pricing calculator.

---

## Rollout order

Sequence matters — several of these will cut off access if applied out of order.

1. **Access restrictions on the SCM site first.** Lowest blast radius; validates your
   allowlist is correct before you apply it to the main site.
2. **Access restrictions on the main site**, with the unmatched rule set explicitly to
   `Deny`. Verify from an allowed and a non-allowed network.
3. **VNet integration.** Requires an empty, correctly sized, delegated subnet. Confirm the
   app still starts and can still reach Microsoft Graph.
4. **Redis private endpoint.** Verify cache reads and writes before proceeding — Portal
   360° degrades to in-memory session storage if Redis is unreachable, which is easy to
   miss in a smoke test.
5. **Cosmos DB private endpoint**, then set `publicNetworkAccess` to `Disabled`. Verify
   audit log writes, user settings, and KPI/drift snapshots.
6. **Front Door**, with the origin still publicly reachable. Confirm traffic flows through
   the edge.
7. **Lock the origin** — service tag + `X-Azure-FDID`, or approve the Private Link
   connection. Only then set the app's `publicNetworkAccess` to `Disabled`.

Steps 5 and 7 are the ones that lock you out if the preceding step was not verified. Keep
a break-glass path: an allowlisted admin IP rule, or the ability to re-enable
`publicNetworkAccess` from the portal.

---

## Verification

After each tier, confirm the controls actually hold:

```bash
# Should return 403 from a non-allowlisted network once restrictions are live
curl -i https://<app>.azurewebsites.net/

# Should return 401, not 200, and not a timeout — proves API auth still fires
curl -i https://<app>.azurewebsites.net/api/users

# Confirm the effective access restriction rules and default actions
az webapp config access-restriction show --resource-group <rg> --name <app>

# Confirm Cosmos DB is not publicly reachable
az cosmosdb show --resource-group <rg> --name <account> \
  --query "publicNetworkAccess"

# Confirm Redis is not publicly reachable
az redis show --resource-group <rg> --name <cache> \
  --query "publicNetworkAccess"
```

From a VM inside the integrated VNet, confirm private DNS resolution returns a private
address rather than a public one:

```bash
nslookup <account>.documents.azure.com     # expect a 10.x/private address
nslookup <cachename>.redis.cache.windows.net
```

Portal 360°'s own checks are unaffected by network hardening and should still pass:

```bash
node scripts/test-api-auth.js   # every route returns 401 unauthenticated
pnpm run check:raw-errors       # no raw error messages in responses
```

---

## Related documentation

- [Deployment Checklist](./DEPLOYMENT-CHECKLIST.md) — production deployment steps
- [Azure Standalone Deployment](./AZURE-STANDALONE-DEPLOYMENT.md) — App Service deployment
- [Managed Identity Setup](./MANAGED-IDENTITY-SETUP.md) — retiring client secrets
- [Redis Setup Guide](./redis-setup-guide.md) — cache sizing and configuration
- [Administrator Guide](./admin-guide.md) — day-2 operations
