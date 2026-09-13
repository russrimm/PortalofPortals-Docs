# Unified Remediation Workbench

The Unified Remediation Workbench is a read-only first iteration of an operations queue for Azure governance signals.

## MVP Scope

- Aggregates Azure Advisor, Azure Policy, Defender for Cloud, Cost Management, and Service Health signals.
- Normalizes findings into a common remediation item contract.
- Scores items deterministically by severity, source, impact hints, cost impact, and recency.
- Shows summary tiles, filters, source warnings, a sortable queue, and a details modal.
- Links back to existing source pages for deeper investigation.

## Current Limits

- No persistent workflow state yet. All live findings return with status `new`.
- No write actions or automatic remediation execution.
- Source failures are returned as warnings so one unavailable upstream API does not break the whole workbench.
- Ownership is inferred at a broad level until resource tags, service groups, or Entra ownership mappings are added.

## Next Iteration Candidates

- Persist acknowledgements, snoozes, accepted risk, assignments, and resolution evidence.
- Add richer owner mapping from tags, service groups, app owners, and subscription metadata.
- Add approval and audit trails before enabling any remediation action.
