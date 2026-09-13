# Power Platform schema sync

Portal 360° keeps two Power Platform integration surfaces aligned with their upstream Microsoft sources automatically, via a single weekly GitHub Actions workflow that auto-opens a PR whenever either source drifts.

| What | Upstream source | File that gets updated |
| --- | --- | --- |
| Tenant settings registry | [`terraform-provider-power-platform` — `tenant_settings`](https://microsoft.github.io/terraform-provider-power-platform/resources/tenant_settings/) | [`src/app/power-platform/tenant-settings/page.tsx`](../src/app/power-platform/tenant-settings/page.tsx) |
| Inventory API version | [`MicrosoftDocs/power-platform` — `inventory-api.md`](https://github.com/MicrosoftDocs/power-platform/blob/main/power-platform/admin/inventory-api.md) | [`src/lib/power-platform-inventory-api.ts`](../src/lib/power-platform-inventory-api.ts) |

Both sources are checked together by the **Sync Power Platform schemas** workflow ([`.github/workflows/sync-tenant-settings.yml`](../.github/workflows/sync-tenant-settings.yml)).

---

## Why this exists

- **Tenant settings drift quickly.** Microsoft adds attributes to the BAP `listtenantsettings` payload several times a year. The Terraform provider tracks them earlier and more accurately than `learn.microsoft.com`. Without sync, the in-portal tenant-settings page silently goes stale.
- **Inventory API versions roll forward.** The Resource Query endpoint (`POST {host}/resourcequery/resources/query?api-version=YYYY-MM-DD`) ships new supported versions every few quarters. Hardcoding the version in each caller meant we missed those rollovers.

---

## Weekly workflow

Schedule: **Mondays 13:00 UTC** (`0 13 * * 1`). Also available manually via **Run workflow** in the Actions tab.

Steps inside the `sync` job:

1. **Sync tenant settings schema (`--write`)** — runs [`scripts/sync-tenant-settings.mjs --write`](../scripts/sync-tenant-settings.mjs). Parses the Terraform provider docs, diffs against the in-portal `SETTINGS_INFO` registry, and inserts stub entries (with default Learn links) for new attributes.
2. **Sync inventory API version (`--write`)** — runs [`scripts/sync-inventory-api-version.mjs --write`](../scripts/sync-inventory-api-version.mjs). Fetches the raw `inventory-api.md` markdown and rewrites `INVENTORY_API_VERSION` in [`power-platform-inventory-api.ts`](../src/lib/power-platform-inventory-api.ts) if the upstream `api-version=YYYY-MM-DD` has changed.
3. **Detect changes** — `git status --porcelain` on both target files; exposes `tenant_changed` and `inventory_changed` outputs.
4. **Upload drift reports** — both `artifacts/tenant-settings-drift.{json,md}` and `artifacts/inventory-api-version-drift.{json,md}` are uploaded as the `power-platform-schema-drift-report` artifact (always, even on no-op runs).
5. **Open pull request** — when either file changed, a single PR is opened on the `chore/sync-power-platform-schemas` branch with both drift reports embedded in the body. Labels: `automation`, `power-platform`.
6. **Summary** — a job summary table lists which sources changed, followed by both drift reports inline.

The workflow needs `contents: write` + `pull-requests: write`; no extra secrets are required (`GITHUB_TOKEN` is used by [`peter-evans/create-pull-request`](https://github.com/peter-evans/create-pull-request)).

---

## Centralised inventory API constants

Every Resource Query caller imports from [`src/lib/power-platform-inventory-api.ts`](../src/lib/power-platform-inventory-api.ts):

```ts
import {
  INVENTORY_API_BASE,
  INVENTORY_API_VERSION,
  INVENTORY_QUERY_URL,
  buildInventoryQueryUrl,
} from '@/lib/power-platform-inventory-api'
```

- `INVENTORY_API_BASE` — the public host (`https://api.powerplatform.com`).
- `INVENTORY_API_VERSION` — the literal updated by the sync script. **Do not edit by hand** unless restoring from a regression — the sync script will overwrite it on the next run. Wrapped between sentinel comments so the regex-replace stays surgical:

```ts
// __INVENTORY_API_VERSION_BEGIN__
export const INVENTORY_API_VERSION = '2024-10-01'
// __INVENTORY_API_VERSION_END__
```

- `INVENTORY_QUERY_URL` — the full URL (`https://api.powerplatform.com/resourcequery/resources/query?api-version=...`). **Prefer this over string-concatenating** in new route handlers.
- `buildInventoryQueryUrl(baseUrl?)` — for the rare case where a regional/env-overridden host is needed; still uses the centrally tracked version.

API routes that consume the constant today: `inventory`, `inventory-query`, `inventory-reports/[reportId]`, `apps`, `copilot-studio/agents`, and `dataverse/model-driven-apps`. Adding a new caller? Import the constant — don't inline `?api-version=...`.

---

## Running the sync locally

Both scripts require Node 24+ and have no extra dependencies (they use native `fetch`).

```bash
# Report-only (exits 1 on drift, writes drift report artifacts).
pnpm run sync:tenant-settings
pnpm run sync:inventory-api

# Apply changes in place. Exits 0 on success. Idempotent.
pnpm run sync:tenant-settings:write
pnpm run sync:inventory-api:write
```

The inventory sync emits a one-line summary on stdout:

```text
[sync-inventory-api-version] current=2024-10-01 doc=2024-10-01 preferred=2024-10-01
[sync-inventory-api-version] in sync ✓
```

Both scripts write per-run reports to `artifacts/` (gitignored). The `.md` versions are what get embedded into the PR body.

---

## Drift report shape

`artifacts/inventory-api-version-drift.json`:

```json
{
  "generatedAt": "2026-05-27T13:00:00.000Z",
  "source": "https://raw.githubusercontent.com/MicrosoftDocs/power-platform/main/power-platform/admin/inventory-api.md",
  "sourceHtml": "https://github.com/MicrosoftDocs/power-platform/blob/main/power-platform/admin/inventory-api.md",
  "currentVersion": "2024-10-01",
  "docVersions": ["2024-10-01"],
  "preferred": "2024-10-01",
  "inSync": true
}
```

If the doc advertises multiple `api-version` values (e.g. a preview rollout), the script picks the most recently mentioned **non-preview** version. Preview-only situations fall through to the first match — review the PR before merging.

---

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `Could not locate version markers` | Someone hand-edited `power-platform-inventory-api.ts` and removed the `// __INVENTORY_API_VERSION_BEGIN__` / `// __INVENTORY_API_VERSION_END__` lines. Restore them around the literal. |
| `no api-version values found in the upstream doc` (exit 2) | Microsoft restructured `inventory-api.md`. Open the upstream URL, find the current `api-version=` reference, and update the regex in [`scripts/sync-inventory-api-version.mjs`](../scripts/sync-inventory-api-version.mjs). |
| Sync PR shows changes you don't want | Roll back the literal in the offending file and pin the workflow off via `workflow_dispatch` until the upstream stabilises. The script will detect drift again on the next scheduled run. |
| New Resource Query route still hardcodes `?api-version=` | Refactor to import `INVENTORY_QUERY_URL` (or `buildInventoryQueryUrl`). The sync script only updates the central constant. |

---

## Related docs

- [Tenant settings refactor summary](./tenant-settings-refactor-summary.md)
- [Power Platform API features](./power-platform-api-features.md)
- [Power Platform environment request form](./power-platform-environment-request.md)
