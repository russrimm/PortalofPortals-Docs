# Copilot Agent Kit integration — Agent Review

Portal 360° includes an **Agent Review** tool that checks exported Copilot Studio
agents against a set of design anti-patterns. The detection logic is ported from
Microsoft's **Copilot Agent Kit** (formerly the Copilot Studio Kit).

- **Page:** `/power-platform/copilot-studio/agent-review`
- **Library:** `src/lib/copilot-studio/agent-review/`
- **Routes:** `POST /api/power-platform/copilot-studio/agent-review`,
  `POST /api/power-platform/copilot-studio/agent-review/instructions`

## Why only part of the Kit was ported

The Copilot Agent Kit ships as a Dataverse **managed solution** — model-driven
apps, cloud flows, and AI Builder prompts. It is not an npm package or a library
you can import. Installing it means importing a solution into a Power Platform
environment, creating ~30 `cat_*` tables, and consuming AI Builder credits per
run.

The Kit's `agent-review-pipeline/` folder is the exception: a self-contained,
MIT-licensed TypeScript GitHub Action. Its first stage is fully deterministic —
it parses a solution `.zip` and produces findings with no Dataverse and no AI
calls at all. That stage is what Portal 360° vendors.

| Kit stage | What it does | Ported? |
|---|---|---|
| Stage A | Deterministic structural analysis of the solution `.zip` → 10 patterns | **Yes** |
| Stage B | AI Builder prompt producing 8 extra "Unclear …" patterns | No |
| Stage C | AI Builder prompt grading agent instructions against 15 criteria | No — replaced |

Stages B and C call `POST /api/data/v9.2/msdyn_aimodels({modelId})/Microsoft.Dynamics.CRM.Predict`
against hardcoded AI Builder model GUIDs. Those GUIDs only resolve once the
Kit's managed solution is installed in the tenant, and each call bills AI Builder
credits. Portal 360° replaces Stage C with its own Azure OpenAI–backed route
using the same 15 criteria, so the rubric is available without the Kit.

**Net result:** the tool works against any exported Copilot Studio solution with
no Kit install, no Dataverse calls, and no AI Builder credits.

## Attribution

The ported code is derived from
[`microsoft/Power-CAT-Copilot-Studio-Kit`](https://github.com/microsoft/Power-CAT-Copilot-Studio-Kit),
MIT License, © Microsoft Corporation. Full attribution and per-file provenance
lives in `src/lib/copilot-studio/agent-review/NOTICE`. Do not remove that file.

## Exporting a solution to review

The tool needs the agent's **solution `.zip`**, not a chat transcript or a
published bot ID.

1. In Copilot Studio, open the agent → **Settings** → **Advanced** → **Metadata**.
   Note the **Solution** the agent belongs to.
2. Go to the Power Apps maker portal (`make.powerapps.com`) → **Solutions**.
3. Select that solution → **Export solution** → **Unmanaged** → download the `.zip`.
4. Drop the `.zip` on the Agent Review page.

Unmanaged exports are required. Managed exports strip the component YAML the
analyzer reads. Maximum upload size is 25 MB.

## The 10 deterministic checks (Stage A)

All ten run server-side with no external calls. Severity is fixed per pattern.

| # | Pattern ID | Pattern | Severity | Fails when |
|---|---|---|---|---|
| 1 | `local-pattern-1` | Missing Model Name | High | Any non-system topic has no `modelDisplayName` |
| 2 | `local-pattern-2` | Missing Model Description | High | Any non-system topic has no `modelDescription` |
| 3 | `local-pattern-3` | Missing Input Variable Name | Medium | Any input variable has no display name |
| 4 | `local-pattern-4` | Missing Input Variable Description | Medium | Any input variable has no description |
| 5 | `local-pattern-5` | Missing Output Variable Name | Medium | Any output variable has no display name |
| 6 | `local-pattern-6` | Missing Output Variable Description | Medium | Any output variable has no description |
| 7 | `local-pattern-7` | Excessive Tools Usage | High | Tool count exceeds the thresholds below |
| 8 | `local-pattern-8` | Inadequate Test Cases | Medium | Fewer than 10 test cases are defined |
| 9 | `local-pattern-9` | Missing Child Agent Description | High | Any child agent has no description |
| 10 | `local-pattern-10` | Child Agent Architecture Sprawl | Medium | Child agent count exceeds the threshold |

Patterns 9 and 10 are only emitted when the agent actually has child agents, so
a single-agent solution reports eight checks rather than ten.

Findings are grouped in the UI by category — Model Naming, Model Description,
Input Variables, Output Variables, Architecture, Orchestration, Evaluation —
with failing checks shown first.

Thresholds (`patterns.ts`):

| Threshold | Value |
|---|---|
| `toolCountHigh` | 25 tools |
| `toolCountMedium` | 15 tools |
| `testCaseMinimum` | 10 test cases |
| `childAgentSprawl` | 5 child agents |

> **Note on pattern count.** The upstream `patternUtils.ts` severity map lists 18
> pattern names, but 8 of those are produced only by Stage B (the AI Builder
> prompt). Stage A emits **10**. Portal 360° runs Stage A only, so the correct
> number for this tool is always 10.

### System and default topics

Ten Copilot Studio system topics (Conversation Start, Conversational boosting,
End of Conversation, Fallback, Multiple Topics Matched, On Error, Reset
Conversation, Escalate, Sign in, Sign out) and four default topics (Goodbye,
Greeting, Start Over, Thank you) are excluded from the missing-field checks.
They are Microsoft-authored and their metadata is not the maker's
responsibility. They still count toward the reported topic total. Components
whose `statecode` is not `0` (deactivated) are skipped entirely.

## The 15 instruction criteria (optional AI check)

The instruction rubric is **opt-in per agent** — nothing is sent to a model
unless you click the check. It grades the agent's instruction text against the
Kit's 15 criteria, grouped into five categories: scope definition, tone and
persona, task guidance, guardrails, and output formatting.

Scoring is severity-weighted:

| Severity | Points deducted |
|---|---|
| High | 3 |
| Medium | 2 |
| Low | 1 |

Maximum instruction points is **35** (7 high + 6 medium + 2 low criteria). A criterion counts as failed if any
returned issue ID starts with the criterion ID, so `scope-definition-1` fails the
`scope-definition` criterion. An agent with no instructions at all fails
automatically.

### Overall score

```
patternScore     = passingPatterns / totalPatterns × 100
instructionScore = (35 − deductions) / 35 × 100
overallScore     = 0.5 × patternScore + 0.5 × instructionScore
```

If only one stage ran, the overall score is that stage's score. The pass gate is
**60**.

### Configuration

The instruction check needs one of:

- `AZURE_ENDPOINT` **and** `AZURE_AI_DEPLOYMENT` (Azure OpenAI, preferred), or
- `GITHUB_AI_PAT` (GitHub Models fallback)

With neither configured the route returns **503** and a message explaining what
to set. The rest of the page — the 10 deterministic checks — works regardless.

The instruction text is wrapped in `BEGIN INSTRUCTIONS` / `END INSTRUCTIONS`
fence markers before being sent to the model, and any criterion ID the model
returns that is not in the known set is discarded. A hostile or hallucinating
model cannot inflate or deflate the score.

## Deliberate deviations from upstream

All are recorded in `NOTICE` as well. Everything from item 3 down came out of
running the tool against real exported agents.

1. **Orchestration mode is read, not assumed.** Upstream hardcodes
   `orchestrationMode: 'generative'`. Portal 360° derives it from
   `settings.GenerativeActionsEnabled` in the bot's `configuration.json`, so a
   classic-orchestration agent is labeled correctly.
2. **Archive hardening.** Upstream has no limits on untrusted input. Portal 360°
   adds a 2 MB per-YAML cap, a 20,000-entry ZIP cap, a 256 MB total-uncompressed
   budget, and a 16 MB per-entry cap, so a zip bomb cannot exhaust server memory.
3. **Block scalars are repaired before parsing.** Copilot Studio tolerates
   ragged indentation inside a `key: |-` block, and maker-authored instructions
   routinely contain it. A strict YAML parser does not — one stray line makes it
   reject the whole document, which silently drops the entire component and
   every check that depends on it. `repairBlockScalars()` rewrites the block
   header with an explicit indentation indicator (`|2-`) so the document parses
   and relative indentation inside the block survives.
4. **`PublicSiteSearchSource` is recognized.** That is the kind Copilot Studio
   actually emits for a website knowledge source, and it carries `site` rather
   than `url`. Upstream only knows `WebSearchSource` and `WebSource`, so real
   exports classify as `Unknown`. Any unrecognised kind carrying a `site` or
   `url` is now treated as Web.
5. **Cloud flows are listed in the inventory.** A flow invoked inline from a
   topic (`kind: InvokeFlowAction`) is not exported as a tool component, so the
   component walk cannot see it and the inventory reported "Tools: none" for
   agents that clearly call flows. They are read from
   `Assets/botcomponent_workflowset.xml` and named from `customizations.xml`.
   They are **not** counted toward `toolCount`, so the Excessive Tools Usage
   verdict stays identical to upstream.
6. **Knowledge source descriptions are read from `botcomponent.xml`.** A
   knowledge source's YAML payload has no description field — the description
   lives in the component XML alongside `<name>`. Upstream never reads it, so
   every knowledge source displayed without one.
7. **Tools and cloud flows report their connectors.** Which connector an agent
   can reach matters more for review than the tool's own name. Tool connectors
   come from `Assets/botcomponent_connectionreferenceset.xml`, flow connectors
   from `properties.connectionReferences` in the `Workflows/*.json` definitions,
   and both resolve to a connector name through the `<connectionreferences>`
   block in `customizations.xml`.

## What the inventory shows

Expanding **Component inventory** on an agent card lists its tools, knowledge
sources, cloud flows, child agents, and test cases.

"Cloud flows" is Portal 360°'s addition. A flow the agent calls inline from a
topic never appears as a tool component, so it is invisible to the checks — but
it is exactly what you need to see when reviewing what an agent can reach. Those
flows are listed with the topic that invokes them, and they do not affect any
pattern verdict.

Tools and cloud flows also list the connectors they depend on, so a review can
answer "what can this agent actually touch?" without opening each flow. A tool
line reads `mcp — shared_microsoftlearndocsmcpserver — MCP Server to search
Microsoft Learn content`; a flow line reads `Invoked by PasswordReset —
Connectors: shared_keyvault`.

Knowledge sources show their type, URL, and the maker-authored description from
the solution — useful for spotting a source nobody meant to ship, such as a
public shopping site sitting next to `learn.microsoft.com`.

## Architecture notes

- `src/lib/copilot-studio/agent-review/index.ts` is the only module that imports
  `server-only`. Everything it re-exports is server-side.
- `types.ts`, `patterns.ts`, and `criteria.ts` are deliberately **client-safe**
  and are imported directly by the React components. Never add `server-only` to
  them.
- The upload route sets `runtime = 'nodejs'` — JSZip needs Node buffers.
- Both routes follow the standard order: `verifyAuth()` → `requireCsrf()` →
  `requirePermission(session, 'portal.read')`.
- CSRF tokens are injected automatically by `installCsrfFetchInterceptor()`; the
  client code sends a bare `FormData` so the browser sets the multipart boundary.

## If you later want the full Kit

Tier 2 — reading the Kit's own Dataverse tables so Portal 360° can surface the
Agent Inventory, test results, and CoE-style governance data — is possible but
requires the managed solution installed in the target environment. If you go
there, **discover entity set names at runtime**:

```
GET /api/data/v9.2/EntityDefinitions?$filter=startswith(LogicalName,'cat_')&$select=LogicalName,EntitySetName
```

The Kit's solution source is not published in the repo (only a `.cdsproj`), so
several logical names — including the central Agent Details table — are not
documented anywhere. Hardcoding them will break.
