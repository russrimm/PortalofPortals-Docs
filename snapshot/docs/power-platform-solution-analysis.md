# Power Platform Solution Analysis

Portal 360° analyzes a Power Platform solution export end to end — component
inventory, cloud flow lint, Canvas App Power Fx, and a secret scan — and then
asks Azure OpenAI to turn those deterministic findings into a review report.

Two entry points feed the same pipeline:

| Source | Route | How the archive is obtained |
| --- | --- | --- |
| Dataverse | `POST /api/power-platform/solutions/analyze` | The portal calls `ExportSolution`, polls the async operation, and downloads the `.zip` as the signed-in administrator |
| Upload | `POST /api/power-platform/solutions/analyze/upload` | The administrator drops a solution `.zip` they exported by hand |

Both return the same `SolutionAnalysisResponse`, so a solution exported through
the portal and one exported from `pac solution export` are reported identically.

> **Not the GitHub Copilot SDK.** Analysis runs on Azure OpenAI through the
> delegated `getAzureAiToken()` helper. The Copilot SDK spawns the `copilot` CLI
> per client and authenticates with a static GitHub PAT, which is incompatible
> with the delegated-Entra model this repo mandates and would drop per-user
> attribution from the Entra audit log.

---

## Where to find it

- **UI:** `/power-platform/solutions/analyze` — drag-and-drop upload, findings by
  severity, CSV export
- **In context:** the environments page runs the Dataverse-backed analysis from
  the solutions list and renders the result in `AnalysisModal`
- **Library:** `src/lib/power-platform/solution-analysis/`
- **Single entry point:** `analyzeSolutionArchive(buffer, { source, fileName })`

---

## Pipeline

```
.zip buffer
  └─ extract.ts       unzip, dedupe (SHA-256), zip-slip guard, budget caps,
  │                   retain nested .msapp buffers
  ├─ components.ts    solution.xml + customizations.xml → manifest + inventory
  ├─ flowLinter.ts    cloud flow definitions → 12 rules across 4 categories
  ├─ canvas-app.ts    nested .msapp → Power Fx formulas → 9 rules
  ├─ security.ts      deep secret scan across flows, web resources, env vars
  ├─ analyze.ts       merge, count, sort worst-first, cap for the brief
  ├─ brief.ts         → bounded text brief (~90k chars)
  └─ ai.ts            Azure OpenAI → Markdown review report
```

Everything up to `ai.ts` is deterministic and reproducible. **An AI failure is
non-fatal:** the response still carries the full deterministic analysis with
`analysisError` set, and the UI renders it.

---

## What gets analyzed

### Component inventory

Tables, forms, views, cloud flows, classic workflows, Canvas Apps, model-driven
apps, connection references, custom connectors, web resources, plugin
assemblies, security roles, and environment variables (including whether each is
secret-backed, required, and carries an exported default value).

### Cloud flow lint

Runs the existing `src/lib/power-platform/flowLinter.ts` rule set over every flow
definition in the archive. Twelve rules across `security.*`, `reliability.*`,
`performance.*`, and `maintainability.*` — for example
`security.missing-secure-data`, `reliability.missing-explicit-retry-policy`, and
`performance.nested-foreach`.

### Canvas App Power Fx

Descends into each nested `.msapp` and lints the formulas. Both source layouts
are handled:

- **classic** — `Src/<Screen>.json` with a `TopParent` control tree
- **modern** — `Src/<Screen>.fx.yaml` with Power Fx YAML

Nine rules cover injection (`Concatenate` into SQL), hardcoded credentials,
cleartext HTTP, `Patch()`/`LookUp()` inside `ForAll()` (N+1), `ClearCollect()` on
screen events, and **delegation**: a non-delegable function inside a
`Filter()`/`LookUp()` predicate is flagged `high`, because the query silently
falls back to the 500–2000 row limit and returns wrong results rather than an
error.

Positive signals are collected too, such as `Concurrent()` use.

### Security scan

Five categories — `exposed-secret`, `hardcoded-credential`,
`weak-secret-storage`, `connection-configuration`, `insecure-endpoint` — found by
walking:

- flow definitions, at any depth, for secret-named keys with literal values, plus
  JWT and `Bearer` tokens anywhere in the tree
- web resources (`.js`, `.ts`, `.html`, `.config`, `.resx`, `.txt`, `.yaml`)
- environment variable definitions carrying an exported default on a secret type
- connection references and cleartext HTTP endpoints

Logic Apps expressions (`@{...}`) and placeholders are excluded so template
syntax is not reported as a credential.

**All evidence is redacted.** A finding shows `Bear…ef (51 chars)` — never the
secret.

---

## Limits

| Limit | Value | Where |
| --- | --- | --- |
| Upload size | 100 MB | `analyze/upload/route.ts` |
| Archive entries | 25,000 | `extract.ts` |
| Per-file text read | 2 MB | `extract.ts` |
| Total text budget | 48 MB | `extract.ts` |
| Nested `.msapp` size | 64 MB | `extract.ts` |
| Flows in the brief | 60, worst-first | `analyze.ts` |
| Findings per flow | 12 | `analyze.ts` |
| Findings per Canvas App | 40 | `canvas-app.ts` |
| Brief size | ~90,000 chars | `brief.ts` |
| Model output | 8,000 tokens | `ai.ts` |
| Route duration | 300 s | both routes |

The AI request timeout scales with brief size (90 s base plus 6 s per 1k tokens,
capped at 600 s) rather than with archive size, so a large archive that reduces
to a small brief is not penalized.

---

## Security posture

- Both routes: `verifyAuth()` → `requireCsrf()` → `requirePermission('portal.read')`,
  in that order, before any body parsing or upstream call
- Dataverse export runs as the signed-in administrator through a delegated OBO
  token, so Dataverse enforces that administrator's environment security role
- Azure OpenAI is reached with `getAzureAiToken()`, never an app-only token
- Zip-slip paths are rejected during extraction
- The AI report is rendered as **text, not HTML**, so model output cannot inject
  markup into the page

---

## Response shape

```ts
{
  success: true,
  analysis: string | null,      // Markdown report; null if AI was skipped/failed
  analysisError?: string,       // set when deterministic analysis succeeded but AI did not
  metadata: {
    source: 'dataverse-export' | 'upload',
    fileName: string,
    manifest: { uniqueName, displayName, version, publisher, publisherPrefix, managed },
    inventory: ComponentInventory,
    flowLint: FlowLintEntry[],
    canvasApps: CanvasAppSummary[],
    security: SecurityFinding[],
    statistics: AnalysisStatistics,
    warnings: string[],
    tokensUsed: number,
    briefTokens: number,
    model?: string,
  }
}
```

Types live in `src/lib/power-platform/solution-analysis/types.ts`.

---

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `AZURE_ENDPOINT` | `https://models.inference.ai.azure.com` | Azure OpenAI / Foundry data-plane endpoint |
| `AZURE_AI_DEPLOYMENT` | `grok-4-fast-reasoning` | Deployment name |

Both the Responses API and Chat Completions response shapes are handled, so the
endpoint can be switched without a code change.

---

## Error responses

| Status | Cause |
| --- | --- |
| `400` | Missing `file` field, empty file, or a non-`.zip` extension; missing `instanceUrl`/`solutionName` on the Dataverse route |
| `401` | No session, or a Dataverse token could not be acquired — sign out and back in |
| `403` | Caller lacks `portal.read` |
| `413` | Upload exceeds 100 MB |
| `422` | The archive is malformed or is not a zip |

---

## Known gaps

- `.msapp` parsing (the `.fx.yaml` control regex and the classic
  `Rules[].InvariantScript` shape) is validated against a synthetic fixture.
  Run a real Canvas App export through it before relying on the canvas section.
- Model-driven app artifacts are inventoried but not linted.
- Plugin assemblies are counted, not decompiled.

---

## Related

- [Copilot Agent Kit integration](./copilot-agent-kit-integration.md) — the Agent
  Review page, which analyzes Copilot Studio agents from a solution `.zip`
- [Power Platform authentication guide](./power-platform-authentication-guide.md)
- [API Endpoints Reference](./API-ENDPOINTS-REFERENCE.md)
