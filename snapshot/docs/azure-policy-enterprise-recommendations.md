# Azure Policy Enterprise Recommendations

This document tracks high-value Azure Policy and Entra-aware governance capabilities that large corporations would likely value in Portal 360. These recommendations came from comparing the existing Portal 360 Azure Policy surface with the Azure Policy tutorial for creating and managing policies, assignments, initiatives, compliance, remediation, and exclusions.

Use this as the reference backlog when asking for top recommendations, roadmap planning, or implementation prioritization.

## Current Baseline

Portal 360 already includes these Azure Policy capabilities:

- Policy and compliance page under Azure Governance and Security.
- Compliance summary and resource-level compliance details.
- Policy assignment listing and assignment detail loading.
- Policy definition listing and filtering.
- Custom allowed-locations policy definition creation through the Azure Policy REST API.
- Optional assignment creation for that custom policy.
- Remediation task listing and creation.
- Regulatory compliance view through Defender/Security compliance data.
- Unified remediation workbench elsewhere in Azure Governance and Security.

## Tracking Status

Status values:

- `Not Started` - No dedicated implementation yet.
- `Planned` - Design or implementation has been scheduled.
- `In Progress` - Work has started.
- `Blocked` - Requires dependency, permission, decision, or design resolution.
- `Done` - Implemented, documented, and verified.

## Top Recommendations

| Priority | Capability | Status | Why It Matters | Resolution Criteria |
|----------|------------|--------|----------------|---------------------|
| P0 | Enterprise Exception Center | Not Started | Large enterprises need governed Azure Policy exemptions and exclusions with business justification, expiry, approval, and audit trail. | Users can create, review, approve, expire, and audit exemptions/exclusions by scope, policy assignment, owner, reason, and expiry date. |
| P0 | Initiative and Baseline Builder | Not Started | Enterprises govern with reusable initiatives for landing zones, regulated workloads, production subscriptions, sandbox subscriptions, and acquisitions. | Users can compose initiatives from built-in/custom policies, configure initiative parameters/groups, version baselines, and assign them to management groups/subscriptions. |
| P0 | Denied Deployment Investigator | Not Started | Azure Policy denial errors are hard to diagnose at scale; admins need to know exactly which assignment blocked deployment and why. | Users can inspect failed deployments, identify denying assignment/initiative/definition, view actor and policy rule context, and choose a fix path. |
| P1 | Remediation Campaign Workbench | Not Started | Modify and deployIfNotExists policies need safe rollout controls across large fleets. | Users can preview blast radius, validate managed identity permissions, schedule remediation, set concurrency/failure thresholds, and track campaign progress. |
| P1 | Policy-as-Code Export | Not Started | Large corporations need source-controlled governance baselines and reviewable change management. | Users can export definitions, initiatives, assignments, parameters, exemptions, and exclusions as Bicep/Terraform/JSON with repeatable deployment instructions. |
| P1 | Policy Drift Detection | Not Started | Central teams need to catch unauthorized changes, disabled enforcement, missing assignments, and parameter drift. | App compares live Azure Policy state against approved baselines and flags drift with owner, scope, severity, and recommended correction. |
| P1 | Built-In Policy Recommendation Engine | Not Started | Admins need help choosing relevant built-in policies from observed Azure inventory, Defender findings, cost posture, tags, and regulatory needs. | App recommends policies/initiatives with rationale, impacted scopes, required permissions, expected effect, and deploy/audit options. |
| P1 | Entra-Aware Governance Delegation | Not Started | Policy operations depend on Entra groups, PIM, RBAC, and managed identity permissions; enterprises need least-privilege guidance. | App maps required Azure RBAC roles, Entra groups, PIM eligibility, and managed identities for policy assignment, exemption approval, and remediation. |
| P2 | Exception Risk Scoring | Not Started | Exceptions can silently undermine governance; risk scoring helps teams focus on broad, old, or high-impact exceptions. | App scores exemptions/exclusions by scope breadth, expiry, criticality, policy severity, resource sensitivity, and business owner completeness. |
| P2 | Policy Version and Change Management | Not Started | Enterprises need controlled updates, auditability, and impact preview before rollout. | App tracks policy/initiative versions, assignment changes, author, approver, impact preview, and rollback/export path. |
| P2 | Compliance Campaigns | Not Started | Governance often happens as programs like tag cleanup, regional compliance, or public access reduction. | Users can create time-bound campaigns that package initiatives, assignments, exemptions, remediation, owners, milestones, and reporting. |

## Recommended Implementation Order

1. Enterprise Exception Center.
2. Initiative and Baseline Builder.
3. Denied Deployment Investigator.
4. Remediation Campaign Workbench.
5. Policy Drift Detection.

This order prioritizes enterprise pain points that build naturally on existing Portal 360 Azure Policy APIs and UI: compliance state, assignments, definitions, and remediation.

## Notes for Future Work

- Keep policy operations behind authenticated API routes and server-side token handling.
- Prefer management group support where possible; large corporations commonly assign governance at management group scope.
- Include Entra and Azure RBAC context in each workflow so users understand who can approve, assign, remediate, or exempt.
- Use audit-friendly models for all write operations: actor, target scope, affected policy object, request payload summary, outcome, timestamp, and correlation ID.
- Avoid treating exemptions as simple skips; model them as governed risk acceptances with owners and expiry.