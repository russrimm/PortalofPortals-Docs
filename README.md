# PortalofPortals / Portal 360 docs

A **local, read-only documentation and screenshot website** for Portal 360.
It is not the PortalofPortals application: there is no sign-in, tenant connection,
backend, cloud deployment, administration action or live API console.

The complete imported snapshot is included in this repository. The original
PortalofPortals checkout is **not required** to build, run or read this website.
The source is hosted in the private GitHub repository
[russrimm/PortalofPortals-Docs](https://github.com/russrimm/PortalofPortals-Docs).
The website itself is not deployed; use the local commands below to view it.

## Run locally

Requires **Node.js 22 or newer** and npm.

```powershell
Set-Location C:\repos\PortalofPortals-Docs
npm ci
npm start
```

Open **http://127.0.0.1:4173**. The server binds only to the loopback address.
If the port is occupied, let the operating system choose an available port:

```powershell
npm start -- --port 0
```

The actual URL is printed in the terminal. Stop the server with **Ctrl+C**.
Dependencies need npm access for the initial install; the running website uses
only local files, including fonts, scripts, styles, search data and images.

| Command | What it does |
| --- | --- |
| `npm start` | Build the included snapshot and start the local server |
| `npm run build` | Generate the complete static website in `dist` |
| `npm run preview -- --port 0` | Serve an existing build on an available loopback port |
| `npm test` | Build, then run Node's built-in importer, renderer, search, asset and server tests |
| `npm run test:browser -- --url http://127.0.0.1:4173` | Check desktop/mobile layouts and interactions in an isolated headless Edge browser |
| `npm run sync -- --source "C:\repos\PortalofPortals"` | Initial byte-preserving import; blocked once privacy-processed screenshots are present |
| `npm run screenshots:import -- --input "C:\reviewed\prepared-screenshots"` | Explicitly import the prepared, reviewed image set and screenshot caption documents |

`dist` and `node_modules` are ignored by Git; only website source, documentation
and screenshot assets are versioned.

## Website features

- A product overview grounded in the source README, with introductory reading paths.
- A complete, categorized library with **title and full-content search**. Each
  space-separated word narrows the results; title matches rank first. Search
  and topic selections are reflected in the URL.
- Static, individually linkable Markdown pages with GFM tables, task lists,
  fenced code, copy controls, heading links and an on-page contents list.
- A gallery containing **every imported image**, with product-area, format,
  page-name, route and caption filters. A replaced legacy JPG link resolves to
  its same-stem WEBP, without creating a duplicate gallery entry. Retained JPGs
  remain separate entries.
- Full-size screenshot viewing with Previous/Next, Left/Right arrow keys,
  Escape, focus return and an original-image link.
- Mobile navigation, light/dark themes, keyboard focus indicators, a skip link,
  reduced-motion support, printable articles and horizontally scrollable code/tables.
- Original Markdown downloads and supporting attachment downloads.

Press `/` to focus the header search, type a term and press Enter. All documents
and image links remain available without JavaScript; interactive search, filters,
theme switching and the full-size dialog require JavaScript.

## Exact import scope

The machine-readable authority is [`snapshot/manifest.json`](snapshot/manifest.json).
It records the source commit, import time, inclusion rules, excluded paths and
every imported file's relative path, byte count, kind and SHA-256 hash. Documents
keep their original bytes and directory structure under `snapshot`. Processed
images have separate original-source and transformed-byte hashes; their
processing record is `snapshot/screenshots-provenance.json` after import.

Source repository: **[russrimm/PortalofPortals](https://github.com/russrimm/PortalofPortals)**.
The initial snapshot is based on commit **5195ea6b**. Read the manifest or the
website's **About this snapshot** page for the full commit and exact counts.

**Current totals: 238 documents, 317 processed images, six supporting attachments
and one license (562 imported files), plus the screenshot processing record.**

### Included documentation and assets

1. All authored Markdown beneath `docs`, including `docs/audits`,
   `docs/code-review`, `docs/ux`, `docs/screenshots/README.md` and
   `docs/screenshots/TOUR.md`. Product documentation about infographic prompts
   is source reading material, not executable agent instructions.
2. The refreshed `docs/screenshots` set: **311 current-upstream WEBPs and six
   processed legacy JPGs**, with 24 former JPG paths resolving to newer WEBPs.
3. These six supporting documentation attachments:
   `docs/authorization-inventory.csv`, `docs/openapi.json`, `docs/openapi.yaml`,
   `docs/portal-walkthrough-transcript.txt`,
   `docs/servicenow-incident-adaptive-card.json` and
   `docs/servicenow-knowledge-adaptive-card.json`.
4. The source root `README.md` as a separate browsable **About Portal 360**
   document, the authored `TODO.md` as historical engineering material, and
   the original `LICENSE`.
5. This explicit allowlist of authored guides outside `docs`:

```text
scripts/ARCHITECTURE.md
scripts/CANVAS-APP-FORMULA-ANALYSIS.md
scripts/COMPLETE-SOLUTION-SUMMARY.md
scripts/QUICK-START-GROK-TIMEOUT-FIX.md
scripts/README-SOLUTION-ANALYSIS.md
tests/README-SCREENSHOTS.md
tests/README-VISUAL-REGRESSION.md
src/app/power-platform/environments/REFACTORING_LOG.md
src/app/power-platform/environments/REFACTORING_PLAN.md
```

### Deliberately excluded

- **The entire `docs/.obsidian` directory:** personal editor/workspace settings
  and an installed third-party Mermaid plugin, including its JavaScript and CSS.
- Agent instructions, skills and prompt configuration (`.github`, `.copilot`
  and similar tooling). No agents or prompts are imported for execution.
- Source application code, application scripts, infrastructure, authentication
  modules, package manifests, `.env` files, credentials and source Git history.
- `node_modules`, third-party/vendor trees (including `public/formatfx`),
  generated runtime artifacts and captures not included in source documentation.
- Symlinks and unrecognized attachment types are not blindly followed or copied.

The Node scripts in **this** repository are newly authored documentation tooling,
not copied application scripts.

## Snapshot refresh

Refresh is explicit, never automatic at startup or build time. The byte-preserving
command below is only for an initial, unprocessed snapshot:

```powershell
npm run sync -- --source "C:\repos\PortalofPortals"
npm test
npm run build
```

The importer reads the source checkout, not a remote repository. It copies only
the documented allowlist, preserves the original source bytes, updates the
manifest and removes obsolete importer-owned snapshot files. It does not write
to the source checkout. Review the new manifest and Git diff after a refresh;
the source commit alone does not describe any uncommitted source changes, so
per-file hashes are also recorded.

**After a privacy-processed screenshot import, `sync` rejects the entire refresh,
even with `--force`.** It must never silently restore unprocessed image bytes.
Use the prepared screenshot import below for image updates. Refreshing other
documentation requires a separately reviewed workflow; deleting the protection
marker or overriding hashes is not a safe refresh procedure.

If an importer-owned file was edited locally, refresh stops instead of
overwriting it. After reviewing those edits, add `--force` to explicitly replace
or remove modified importer-owned files. Unowned files are never overwritten,
even with `--force`.

The build checks imported file hashes, byte counts, complete image coverage,
processing-record consistency and encoded dimensions/metadata before rendering.
Screenshot caption imports normalize replaced JPG links to their indexed WEBP
paths so the Markdown also works directly on GitHub, recording separate source
and published hashes. Otherwise, do not edit source
Markdown in `snapshot` to fix display or links. Make website changes in `site`
or `scripts`, or update the original documentation through a separate, approved
source-repository workflow and import it again.

`dist` is generated. Rebuild after refreshing; the static server does
not watch files or generate content on requests. An already-built site can be
served from any static HTTP server at its root, without Node rendering or the
original source checkout. Opening HTML directly with `file://` is not supported.
Stale files from the previous build manifest (including replaced JPGs) are removed
individually; unrelated files are not recursively deleted. Unowned files in the
served screenshot directory block the build for explicit review.

## Rendering, links and historical context

Original Markdown is never rewritten. GFM is parsed during the build, but raw
HTML is escaped and displayed as text. MDX is not evaluated. **Mermaid blocks
are preserved as readable, copyable diagram definitions**, with an explanatory
note rather than a renderer or a remote diagram service. This intentionally
keeps the dependency surface small and avoids executing imported definitions.

Relative links between imported Markdown pages, including nested directories,
resolve to local HTML pages. Local images and attachments retain their paths.
Source-code references point to the original GitHub repository at the referencing
document's imported commit. Screenshot README/tour imports use their own newer
pin; other documents retain the original pin. Product routes such as `/users` and `/api/users` are labeled as portal
routes rather than pretending to be documentation-site pages. References to
files that were not imported remain source-repository links; their remote
existence is not guaranteed. `dist/link-report.json` records these references.
Minor heading-anchor differences are resolved when there is one unambiguous
match. A link to a section missing from the source opens that document's top
instead, visibly labeled **section absent in source**; the link report records
the original reference.

External images and badges are **not fetched automatically**; a source link
is shown instead. Ordinary external reference links only leave the local site
when selected. The included server sends a restrictive Content Security Policy,
disables MIME sniffing and accepts only GET/HEAD requests.

The library includes plans, reviews, older implementation notes and dated
screenshots. These are documentation, not a certification that every described
feature is current, complete, secure or available. Instructions for deploying
or configuring Portal 360 apply to the original product, never this website.

### Screenshot privacy

Upstream describes its captures as pseudonymized. That claim is not proof that
every image lacks personal or sensitive information. The prepared-image workflow
adds **GUID-shaped text masking/review, profile/personal-data masking and metadata
stripping**, including the retained legacy JPGs; it does not certify all PII as absent. Gallery entries,
caption-document footers, the About page and machine-readable provenance identify
the actual source and processing status, rather than calling the images “safe
for public.”

The refreshed set contains **311 current-upstream WEBPs plus six retained
legacy JPGs (317 images)**. Twenty-four original JPG paths become local aliases
to their WEBP replacements. “Current” means membership in the newer upstream
set, not a guarantee that every capture was newly taken. The manifest and gallery
index are authoritative for the set actually imported.

The documentation repository's `main` history was restarted from this processed
snapshot with the owner's approval; the earlier unprocessed image commit is not
an ancestor of the new history. Old clones, forks and GitHub cached commit views
can still retain earlier bytes. Do not merge an old clone's history back into
`main`. Before changing visibility, review other documentation and repository
metadata and resolve any remaining historical copies; GitHub Support may be
needed for cached views. See
[GitHub's sensitive-data removal guidance](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository).

The repository remains private and GitHub Pages is not enabled. The image import
command itself does not publish, push, rewrite history or change visibility.

#### Prepared screenshot import

Prepare and review images **outside this repository**. The importer performs no
download, OCR or pixel masking; it accepts already-processed files only:

```powershell
npm run screenshots:import -- --input "C:\reviewed\prepared-screenshots"
npm test
```

The input folder must contain exactly `screenshot-import.json` and the files
listed in it, each at its indexed relative path. Do not include raw captures,
OCR output, identifier values or ancillary reports. The version-1 index has:

- `source`: `{ "repository": "russrimm/PortalofPortals", "commit": "<full 40-character lowercase commit>" }`
- `processedAt`: ISO timestamp; `methodology`: factual, single-line processing
  description (20–2,000 characters, no GUID values or credentials).
- `files`: one entry per screenshot, with `path`, `sourcePath`, `sourceCommit`,
  `sourceSha256`, `sha256`, `bytes`, `width`, `height`, `maskCount`, `status`,
  `capture`, and `aliases` (use `[]` when there are none).
  Paths must be direct children of `docs/screenshots`, with lowercase `.webp`
  or `.jpg` suffixes; `sourcePath` equals `path`. Current files are WEBP with
  the index source commit; legacy files are JPG with their original snapshot
  commit/hash. `sha256`/`bytes` describe the **processed bytes**, while
  `sourceSha256` describes the unmodified upstream file. `status` is
  `guid-masked` with a positive mask count or `reviewed-no-guid` with zero.
  In this version-1 contract, `maskCount` counts **all opaque privacy masks**,
  including profile areas, known identity strings and manual personal-data boxes;
  the `guid-masked` status does not mean every region contained a GUID.
  Aliases may only name the same-stem original JPG replaced by a WEBP.
- `documents`: exactly `docs/screenshots/README.md` and
  `docs/screenshots/TOUR.md`, each with `path`, `sha256`, and `bytes`. These
  receive the index source commit. The importer rewrites inline links using
  indexed JPG aliases to their actual WEBP paths, retaining the original hash
  in optional `sourceSha256` when the published bytes differ. An already-normalized
  input may also supply that original `sourceSha256`.
- `retired` (optional, non-empty when present): `{ "path", "reason" }` entries
  for existing current WEBPs whose portal pages were removed upstream. `reason`
  must be `page-removed-upstream`. A retired path cannot also appear in `files`
  or as an alias, legacy JPGs cannot be retired, and neither caption document
  may still link to it. Retiring an image also drops its JPG aliases. The list is
  kept in the processing record.
- `version`: `1`. Unknown fields are rejected, preventing accidental OCR text
  from being copied into provenance.

The importer validates the entire input and existing snapshot before changing
the snapshot, stages only processed images plus link-normalized captions and
unchanged other documents, verifies the stage, then swaps the snapshot directory
with rollback on a failed swap.
It removes the prior directory after success. Do not interrupt the swap or run
other snapshot writers concurrently; if interrupted, stop serving and inspect
any `.screenshots-stage-*`/`.screenshots-previous-*` directories before retrying.
All existing images and aliases must be retained, replaced or explicitly retired.
Input/project overlap, symlinks, hardlinks, unowned snapshot files, bad hashes,
inconsistent counts and metadata-bearing encodings are rejected.

WEBP must be static, without EXIF/XMP/ICC metadata; JPEG may retain only a
thumbnail-free standard JFIF header, not EXIF/ICC/comments. Original source hashes
are preserved for provenance, but original image bytes are never staged into
the replacement snapshot. All non-caption documentation keeps its original
manifest provenance.

## Implementation

**Node.js static generator + vanilla HTML/CSS/JavaScript**, with two pinned
dependencies: `marked` for GFM and `github-slugger` for heading IDs.
There is no React, Next.js, MDX, backend framework or browser bundle pipeline.
Topic groupings are website navigation hints derived from filenames, not an
upstream product taxonomy.

The optional browser check uses Node's built-in WebSocket support and the
installed Microsoft Edge executable; no browser-testing dependency is added.
It starts a separate disposable profile within the checkout, closes its browser
afterward and writes screenshots/results to a checkout-local artifact directory
printed in the terminal. Use
`--browser "C:\path\to\chromium.exe"` or `BROWSER_PATH` for another Chromium
installation, and `--artifacts "C:\path\to\output"` for a chosen results folder.
Start the local preview before running it.

```text
snapshot/               Preserved source documents, images, attachments, manifest
site/                   Original website styles and browser interactions
scripts/sync-docs.mjs    Explicit safe source import
scripts/import-screenshots.mjs  Explicit prepared-image import, with sync protection
scripts/screenshots.mjs  Processing provenance, hash, coverage and encoding checks
scripts/content.mjs      Markdown rendering, link mapping and gallery metadata
scripts/build.mjs        Static HTML, search index and gallery generation
scripts/serve.mjs        Loopback-only, read-only static server
tests/                  Node built-in tests
dist/                   Generated website (ignored)
```

The visual system extends the original Portal 360 slate/cyan identity and
system-font stack for reading: persistent topic navigation, restrained accents,
comfortable article widths and actual source screenshots. It is intentionally
a documentation library, not a simulated admin dashboard.

## License

The original source license is preserved in [`LICENSE`](LICENSE) and in the
snapshot: **MIT, Copyright (c) 2025 Russ Rimmerman [MSFT]**. Source documentation
and assets retain that attribution. Microsoft product names are descriptive;
this website is not a Microsoft service.
