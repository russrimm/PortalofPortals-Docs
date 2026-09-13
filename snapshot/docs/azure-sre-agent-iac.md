# Azure SRE Agent — Infrastructure as Code

Portal 360°'s Bicep template can provision an [Azure SRE Agent](https://learn.microsoft.com/azure/sre-agent/overview)
alongside the rest of the stack. The agent watches the resource groups you point it
at, diagnoses incidents, and — depending on how you configure it — proposes or
applies remediations.

It is **off by default**. The agent is billable and continuously reads the
resources it monitors, so you turn it on deliberately.

> Microsoft also ships a standalone CLI for this at
> [`microsoft/sre-agent`](https://github.com/microsoft/sre-agent), documented in
> [Deploy Azure SRE Agent using IaC](https://learn.microsoft.com/azure/sre-agent/deploy-iac).
> Use that repository when you want an agent unrelated to Portal 360°. Use the
> template described here when you want one deployed and versioned with Portal 360°.

---

## What gets deployed

| Resource | Purpose |
|---|---|
| `Microsoft.App/agents` | The SRE Agent itself. |
| `Microsoft.Insights/components` | Application Insights holding agent telemetry, wired to the template's existing Log Analytics workspace. Skipped if you supply your own. |
| `Microsoft.ManagedIdentity/userAssignedIdentities` | The identity the agent's knowledge graph and actions run as. Skipped if you supply your own. |
| Role assignments | Reader + Log Analytics Reader on each monitored resource group (plus Contributor at `High` access), Monitoring Reader on the agent's own resource group, and SRE Agent Administrator on the agent. |

The agent reuses the Log Analytics workspace this template already creates, so
agent telemetry lands next to the existing diagnostics rather than in a second
workspace.

Both the agent's **system-assigned** and **user-assigned** identities are granted
access to the monitored resource groups. The user-assigned identity backs the
knowledge graph and action configuration; the system-assigned identity is what the
agent uses for connector queries. Granting only one leaves the agent half-blind.

---

## Prerequisites

- The `Microsoft.App` resource provider registered in the target subscription:
  ```bash
  az provider register --namespace Microsoft.App
  ```
- **Permissions.** This template creates role assignments, so the deploying
  principal needs either:
  - **Owner** on the target scope, or
  - **Contributor** *and* **User Access Administrator**.

  If you cannot get `User Access Administrator`, set
  `SRE_AGENT_SKIP_ROLE_ASSIGNMENTS=true`. The agent will deploy, but it cannot read
  the monitored resource groups until someone makes those grants out of band, and
  nobody will hold SRE Agent Administrator to approve its proposals.

---

## Quick start

```bash
azd env set DEPLOY_SRE_AGENT true
azd env set SRE_AGENT_LOCATION eastus2
azd env set SRE_AGENT_TARGET_RESOURCE_GROUPS_JSON '["rg-portal360-prod"]'

azd provision
```

Leaving `SRE_AGENT_TARGET_RESOURCE_GROUPS_JSON` unset makes the agent monitor the
resource group Portal 360° deploys into.

Preview the change before committing to it:

```bash
az deployment group what-if \
  --resource-group <rg> \
  --template-file infra/main.bicep \
  --parameters infra/main.bicepparam
```

`what-if` reports role assignments whose names depend on a principal ID as
`Unsupported` rather than `Create`. That is expected — ARM cannot compute those
names until the identities exist. See
[Unidentifiable resources](https://aka.ms/WhatIfUnidentifiableResource).

---

## Configuration reference

All variables are optional except `DEPLOY_SRE_AGENT`.

| Variable | Default | Notes |
|---|---|---|
| `DEPLOY_SRE_AGENT` | `false` | Master switch. |
| `SRE_AGENT_NAME` | `sre-portal360-<token>` | 2–32 chars, starts with a letter, ends alphanumeric. |
| `SRE_AGENT_LOCATION` | `eastus2` | See [Regions](#regions) — narrower than Portal 360°'s own region list. |
| `SRE_AGENT_TARGET_RESOURCE_GROUPS_JSON` | `[]` → this resource group | JSON array of resource group names to monitor. |
| `SRE_AGENT_TARGET_SUBSCRIPTION_ID` | deployment subscription | Set when the monitored groups live elsewhere. |
| `SRE_AGENT_ACCESS_LEVEL` | `Low` | `Low` or `High`. See [Safety matrix](#safety-matrix). |
| `SRE_AGENT_ACTION_MODE` | `Review` | `ReadOnly`, `Review`, or `Autonomous`. |
| `SRE_AGENT_UPGRADE_CHANNEL` | `Stable` | `Stable` or `Preview`. |
| `SRE_AGENT_MODEL_PROVIDER` | `MicrosoftFoundry` | Model provider backing the agent. |
| `SRE_AGENT_MODEL_NAME` | `Automatic` | `Automatic` tracks the current recommended model. |
| `SRE_AGENT_APP_INSIGHTS_RESOURCE_ID` | *(create one)* | Resource ID of an existing Application Insights component to reuse. |
| `SRE_AGENT_MANAGED_IDENTITY_RESOURCE_ID` | *(create one)* | Resource ID of an existing user-assigned identity to reuse. |
| `SRE_AGENT_SKIP_ROLE_ASSIGNMENTS` | `false` | Deploy the agent without creating any role assignments. |
| `SRE_AGENT_ADMIN_PRINCIPAL_ID` | deploying principal | Who gets SRE Agent Administrator. |
| `SRE_AGENT_ADMIN_PRINCIPAL_TYPE` | `User` | Set `ServicePrincipal` in CI. |

### Deploying from CI

The admin role assignment defaults to the deploying principal. In a pipeline that
resolves to a service principal, and the assignment fails unless you say so
explicitly:

```bash
azd env set SRE_AGENT_ADMIN_PRINCIPAL_ID <object-id>
azd env set SRE_AGENT_ADMIN_PRINCIPAL_TYPE ServicePrincipal
```

Creating an agent through ARM does **not** grant the deployer data-plane rights the
way creating one interactively in the portal does. Without an SRE Agent
Administrator assignment, nobody can approve the agent's proposed actions. See
[SRE Agent user roles](https://learn.microsoft.com/azure/sre-agent/user-roles).

---

## Safety matrix

Two independent settings decide what the agent can do. `access level` decides what
it *may* touch; `action mode` decides whether a human sees the change first.

| | `ReadOnly` | `Review` | `Autonomous` |
|---|---|---|---|
| **`Low`** (Reader + Log Analytics Reader) | Diagnoses only. | Proposes read-only findings for approval. **Default.** | Nothing to execute — the agent has no write rights. |
| **`High`** (adds Contributor) | Diagnoses only; write rights unused. | Proposes changes; a human approves each one. | **Agent modifies your resources unattended.** |

Start at `Low` + `Review`. Move to `High` only once you trust the proposals, and
keep `Review` when you do. `High` + `Autonomous` together hand the agent
unsupervised write access to every monitored resource group — treat enabling it as
a deliberate decision with a named owner, not a default.

---

## Regions

The SRE Agent is available in fewer regions than Portal 360° itself, which is why
`SRE_AGENT_LOCATION` is separate from the template's `location`:

`australiaeast`, `canadacentral`, `centralus`, `eastasia`, `eastus2`,
`francecentral`, `italynorth`, `japaneast`, `koreacentral`, `northcentralus`,
`southafricanorth`, `southeastasia`, `spaincentral`, `swedencentral`, `uksouth`,
`westcentralus`, `westus2`, `westus3`

The agent does not have to sit in the same region as the resources it monitors.
Check [the product docs](https://learn.microsoft.com/azure/sre-agent/overview) for
the current list before assuming this one is still complete.

---

## API version: GA vs preview

These modules target the GA API `Microsoft.App/agents@2026-01-01`. Microsoft's own
reference templates still use `2025-05-01-preview`. GA is the right default, but it
is not a strict superset — the preview API exposes four things GA does not:

| Preview-only capability | Consequence of using GA |
|---|---|
| `monthlyAgentUnitLimit` | **No per-agent monthly spend cap.** Control cost with Azure Budgets instead. |
| `sandboxConfiguration` | No egress mode, allowed-host, or allowed-registry controls on the agent sandbox. |
| `vnetConfiguration` | The agent cannot be joined to a VNet. |
| `experimentalSettings` | No opt-in to workspace tools, HTTP triggers, or the v2 agent loop. |

GA also renames action mode `Automatic` to `Autonomous`.

**If the missing monthly unit cap or the sandbox egress controls matter to you**,
use the preview API instead — change the `Microsoft.App/agents` API version in
`infra/modules/sre-agent.bicep` and add the properties back. Otherwise stay on GA,
which carries a stability guarantee the preview does not.

---

## What this template does not configure

ARM models the agent resource, not its data plane. The following are configured
after deployment through the portal or the
[`microsoft/sre-agent`](https://github.com/microsoft/sre-agent) CLI:

- Connected code repositories
- Incident/webhook hooks and HTTP triggers
- Knowledge files and runbooks
- Chat and prompt history

Deploying with this template and then layering that configuration on top is
supported; the template will not overwrite it on a later `azd provision`.

---

## Verifying the deployment

```bash
# Confirm the agent exists and is provisioned
az resource show \
  --resource-type Microsoft.App/agents \
  --name <agent-name> \
  --resource-group <rg> \
  --query "{state:properties.provisioningState, mode:properties.actionConfiguration.mode, access:properties.actionConfiguration.accessLevel}"

# Confirm the monitored groups were granted to both identities
az role assignment list --resource-group <monitored-rg> --query "[].{role:roleDefinitionName, principal:principalId}" -o table
```

The template also emits outputs you can read back with `azd env get-values` or
`az deployment group show`:

| Output | Use |
|---|---|
| `sreAgentResourceId` | The agent's resource ID. |
| `sreAgentName` | Resolved agent name. |
| `sreAgentPortalUrl` | Deep link to the agent in the SRE Agent portal. |
| `sreAgentSystemAssignedPrincipalId` | Grant the agent access to resources outside the monitored groups. |
| `sreAgentManagedIdentityResourceId` | The user-assigned identity the agent runs as. |

All five return an empty string when `DEPLOY_SRE_AGENT` is `false`.

---

## Troubleshooting

**`RoleAssignmentUpdateNotPermitted`**
A role assignment with the same deterministic name already exists with a different
role. Delete the stale assignment, or set `SRE_AGENT_SKIP_ROLE_ASSIGNMENTS=true` and
manage grants yourself.

**`AuthorizationFailed` on a role assignment**
The deploying principal lacks `Microsoft.Authorization/roleAssignments/write`. Grant
it Owner or User Access Administrator, or skip role assignments.

**`PrincipalNotFound`**
Entra ID replication lag on a freshly created identity. Re-run `azd provision`; the
deployment is idempotent.

**The agent deploys but reports no resources**
Either `SRE_AGENT_SKIP_ROLE_ASSIGNMENTS` was set, or the monitored resource groups
are in a different subscription than `SRE_AGENT_TARGET_SUBSCRIPTION_ID` names.

**`InvalidTemplateDeployment` naming the agent name**
The name must match `^[A-Za-z]([-A-Za-z0-9]{0,30}[A-Za-z0-9])$` — 2–32 characters,
starting with a letter and ending alphanumeric.

---

## Related documentation

- [Azure SRE Agent overview](https://learn.microsoft.com/azure/sre-agent/overview)
- [Deploy Azure SRE Agent using IaC](https://learn.microsoft.com/azure/sre-agent/deploy-iac)
- [SRE Agent user roles](https://learn.microsoft.com/azure/sre-agent/user-roles)
- [Managed Identity Setup](./MANAGED-IDENTITY-SETUP.md)
- [Deployment Checklist](./DEPLOYMENT-CHECKLIST.md)
