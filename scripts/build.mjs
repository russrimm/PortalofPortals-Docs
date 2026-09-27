import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { escapeHtml as e, docUrl, sourceUrl, titleFor, categoryFor, plainText, createResolver, renderMarkdown, repairLocalFragments, galleryMetadata, repository } from './content.mjs';
import { PROVENANCE, validateSnapshot } from './screenshots.mjs';
import { GENERATED_ASSETS, generatedPaths, prepareOutput, removeStaleOutput } from './build-output.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'dist');
const snapshot = path.join(root, 'snapshot');
const manifest = JSON.parse(await readFile(path.join(snapshot, 'manifest.json'), 'utf8'));
const screenshotProvenance = await validateSnapshot(snapshot, manifest);
const staleOutput = await prepareOutput(output, manifest);
const diagnostics = [];
const resolve = createResolver(manifest.files, manifest.source.commit, diagnostics);
const text = file => readFile(path.join(snapshot, ...file.split('/')), 'utf8');
const docs = [];

for (const file of manifest.files) {
  const buffer = await readFile(path.join(snapshot, ...file.path.split('/')));
  if (file.kind !== 'document') continue;
  const markdown = buffer.toString('utf8');
  docs.push({
    path: file.path, url: docUrl(file.path), title: titleFor(file.path, markdown),
    category: categoryFor(file.path), text: plainText(markdown, { preserveHtml: true }), markdown,
    sourceCommit: file.sourceCommit ?? manifest.source.commit,
    importedAt: file.sourceCommit && screenshotProvenance ? screenshotProvenance.processedAt : manifest.source.importedAt,
    rendered: renderMarkdown(markdown, file.path, resolve)
  });
}
docs.sort((a, b) => a.title.localeCompare(b.title));
if (screenshotProvenance && diagnostics.some(item => item.kind === 'missing-image')) {
  throw new Error('Processed snapshot has unresolved local screenshot references. Check the prepared image set and JPG aliases before building.');
}
const headingSets = new Map(docs.map(item => [item.url, new Set(item.rendered.headings.map(heading => heading.id))]));
for (const item of docs) item.rendered.html = repairLocalFragments(item.rendered.html, item.url, headingSets, diagnostics);
const categories = [...new Set(docs.map(doc => doc.category))].sort();
const gallery = galleryMetadata(manifest.files, await text('docs/screenshots/README.md'), await text('docs/screenshots/TOUR.md'));
const date = new Date(manifest.source.importedAt).toISOString().slice(0, 10);
const shortCommit = manifest.source.commit.slice(0, 8);
const privacyNotice = screenshotProvenance
  ? `The upstream README claims pseudonymization. This copy adds GUID-shaped text masking/review, profile/personal-data masking and metadata stripping; it does not establish that all personal or sensitive information is absent. ${manifest.screenshots.counts.current} images are from the current upstream set and ${manifest.screenshots.counts.legacy} are retained legacy captures. Review before publication.`
  : 'The source describes the WEBP set as redacted. Legacy JPG redaction is not independently verified. Review all images before sharing.';
const doc = file => {
  const found = docs.find(item => item.path === file);
  if (!found) throw new Error(`Required documentation not imported: ${file}`);
  return found.url;
};
const image = file => {
  const found = gallery.find(item => item.path === `docs/screenshots/${file}`);
  if (!found) throw new Error(`Required screenshot not imported: ${file}`);
  return found;
};
const icon = (name, size = 20) => {
  const shapes = {
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4 4"/>',
    book: '<path d="M12 5c-3-2-7-2-10-1v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1Zm0 0v15"/>',
    home: '<path d="m3 10 9-7 9 7v11h-7v-7h-4v7H3Z"/>',
    gallery: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1"/><path d="m3 17 6-6 4 4 3-3 5 5"/>',
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    external: '<path d="M14 3h7v7m0-7L10 14M10 3H3v18h18v-7"/>',
    theme: '<path d="M21 13A9 9 0 0 1 11 3a9 9 0 1 0 10 10Z"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>'
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes[name] || shapes.book}</svg>`;
};
const navLink = (url, label, symbol, active) => `<a href="${url}"${active ? ' aria-current="page"' : ''}>${icon(symbol)}<span>${label}</span></a>`;
const breadcrumb = label => `<div class="breadcrumb"><a href="/">Documentation</a><span aria-hidden="true">/</span><span>${e(label)}</span></div>`;
const pageHead = (title, description, extra = '') => `<header class="page-heading"><h1>${e(title)}</h1><p class="lead">${e(description)}</p>${extra}</header>`;
const linkRow = (url, title, description, meta = '') => `<a class="reading-link" href="${url}"><div><h3>${e(title)}</h3><p>${e(description)}</p></div><span>${meta ? e(meta) : icon('arrow')}</span></a>`;

function shell(title, active, content, { toc = '', source = '' } = {}) {
  return `<!doctype html>
<!-- THESIS: A complete, readable field guide to one Microsoft administration workspace, not a working admin portal.
OWN-WORLD: Portal 360's slate, white, cyan and Segoe UI; crisp ruled navigation and generous reading surfaces.
STORY: Understand the product, find a source guide, inspect an actual captured screen.
FIRST VIEWPORT: Persistent left library rail, compact search header, reader-first title and source screenshot.
FORM: Read-mode documentation workspace fixed by the supplied brief; no new-brand exercise. -->
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="${e(title)} - local PortalofPortals documentation and screenshots. No live tenant connection.">
<meta name="color-scheme" content="light dark"><title>${e(title)} | Portal 360 docs</title>
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/assets/styles.css">
<script src="/assets/theme.js"></script><script type="module" src="/assets/app.mjs"></script></head>
<body data-page="${active}"><a class="skip-link" href="#main">Skip to content</a>
<header class="topbar">
<a class="brand" href="/" aria-label="Portal 360 documentation home"><span class="brand-mark" aria-hidden="true">P<span>360</span></span><span>Portal 360<span class="brand-degree">&deg;</span><small>PortalofPortals documentation</small></span></a>
<form class="header-search" action="/library.html" role="search"><label class="sr-only" for="global-search">Search all documentation</label>${icon('search')}<input id="global-search" type="search" name="q" placeholder="Search the documentation..." autocomplete="off"><kbd>/</kbd><button type="submit" class="sr-only">Search</button></form>
<span class="local-label">Local snapshot</span><button type="button" id="theme-toggle" class="icon-button" aria-label="Switch color theme" title="Switch color theme">${icon('theme')}</button>
<button type="button" id="menu-toggle" class="icon-button" aria-label="Open navigation" aria-expanded="false" aria-controls="sidebar">${icon('menu')}</button>
</header>
<div class="site-frame"><aside class="sidebar" id="sidebar">
<nav aria-label="Main navigation" class="primary-nav">${navLink('/', 'Overview', 'home', active === 'home')}${navLink('/library.html', 'Documentation', 'book', active === 'library')}${navLink('/gallery.html', 'Screenshot gallery', 'gallery', active === 'gallery')}</nav>
<nav aria-label="Documentation topics" class="topic-nav"><h2>Explore the library</h2>${categories.map(category => `<a href="/library.html?category=${encodeURIComponent(category)}"><span>${e(category)}</span><span class="nav-count">${docs.filter(item => item.category === category).length}</span></a>`).join('')}</nav>
<div class="sidebar-bottom"><a href="/about.html"${active === 'about' ? ' aria-current="page"' : ''}>About this snapshot ${icon('arrow', 16)}</a><a href="${repository}" rel="noopener noreferrer">Original repository ${icon('external', 14)}</a><p>Snapshot ${date}<br><span class="commit">${shortCommit}</span> &middot; MIT licensed</p></div>
</aside><div class="main-column"><main id="main" tabindex="-1"${toc ? ' class="with-toc"' : ''}>${content}${toc}</main>
<footer class="footer"><span>Portal 360&deg; / Documentation</span><span>Read-only. No sign-in. No tenant connection.</span><a href="/about.html">Snapshot details</a></footer></div></div>
<dialog id="image-viewer" aria-labelledby="viewer-title"><div class="viewer-bar"><div><h2 id="viewer-title">Screenshot</h2><p id="viewer-description"></p></div><button type="button" id="viewer-close" class="icon-button" aria-label="Close full-size screenshot">${icon('close')}</button></div><div class="viewer-stage"></div><div class="viewer-footer"><button type="button" id="viewer-previous">Previous</button><span id="viewer-position"></span><a id="viewer-original" href="/" target="_blank" rel="noopener noreferrer">Open original image ${icon('external', 14)}</a><button type="button" id="viewer-next">Next</button></div></dialog>
<div class="toast" id="toast" role="status"></div><noscript><div class="noscript-note">JavaScript is disabled. All documents and original images remain accessible; search, filters and the screenshot viewer need JavaScript.</div></noscript>
</body></html>`;
}

function homePage() {
  const hero = image('home.webp');
  return shell('Documentation & screenshots', 'home', `<div class="home-content">
<section class="welcome"><div class="welcome-copy"><h1>Your guide to<br>Portal 360<span>&deg;</span>.</h1><p class="lead">One workspace for the Microsoft cloud.<br>A complete library to help you understand it.</p><p>Explore the guides, architecture and captured screens behind PortalofPortals, the unified administration portal for IT and MSP teams.</p><div class="actions"><a class="button primary" href="/library.html">Explore documentation ${icon('arrow')}</a><a class="text-link" href="${doc('README.md')}">About the product</a></div><p class="snapshot-line">${docs.length} documents <span aria-hidden="true">&middot;</span> ${gallery.length} screenshots <span aria-hidden="true">&middot;</span> All local</p></div>
<figure class="welcome-image"><a href="${hero.url}" data-lightbox data-title="Portal 360 home" data-description="${e(hero.privacy)}"><img src="${hero.url}" alt="Portal 360 home in dark mode, with navigation for identity, Microsoft 365 and cloud platforms" width="1400" height="981" fetchpriority="high"></a><figcaption><span>Inside Portal 360</span><a href="/gallery.html">Explore the screens ${icon('arrow', 16)}</a></figcaption></figure></section>
<div class="read-only-note">${icon('book')}<p>This is a documentation site, not the portal application. Features and admin actions described here belong to the original product.</p></div>
<section class="start-section"><div class="section-intro"><h2>A good place to start</h2><p>Get the big picture, take a visual tour, or go straight to the details.</p></div><div class="reading-list">${linkRow(doc('docs/application-walkthrough.md'), 'Get to know the portal', 'A walkthrough of the product and its administration workflows.')}${linkRow(doc('docs/screenshots/TOUR.md'), 'Take the product tour', 'Captured views, with the original narrative and context.')}${linkRow(doc('docs/README.md'), 'Find the right guide', 'The original documentation index, organized around reader needs.')}${linkRow(doc('docs/admin-guide.md'), 'Read the administrator guide', 'Operations, access control, observability and incident response.')}</div></section>
<section class="product-map"><div class="section-intro"><h2>The Microsoft cloud,<br>in context.</h2><p>The source documentation covers the services and workflows brought together in Portal 360.</p><a class="text-link" href="${doc('README.md')}">Read the full product overview ${icon('arrow', 16)}</a></div><div class="product-areas">${[
  ['Identity & security', 'Users, groups, Entra ID, access policies and security posture.', 'Identity & security'],
  ['Azure & data', 'Resources, costs, governance, monitoring and Fabric.', 'Azure & data'],
  ['Power Platform & agents', 'Environments, Dataverse, Copilot Studio and solution analysis.', 'Power Platform & agents'],
  ['Microsoft 365 & devices', 'Licensing, collaboration, Intune and service health.', 'Microsoft 365 & integrations']
].map(([title, description, category]) => linkRow(`/library.html?category=${encodeURIComponent(category)}`, title, description)).join('')}</div></section>
<section class="gallery-preview"><div class="section-header"><div><h2>See it before you read it</h2><p>Real source screenshots. Both WEBP and legacy JPG captures.</p></div><a class="text-link" href="/gallery.html">All ${gallery.length} screenshots ${icon('arrow', 16)}</a></div><div class="preview-grid">${['dashboard.webp', 'users--user-details.webp', 'azure-daily-costs.webp'].map(name => galleryCard(image(name))).join('')}</div></section></div>`);
}

function galleryCard(item) {
  return `<figure class="screenshot-card" data-gallery-card data-category="${e(item.category)}" data-format="${item.format}" data-search="${e(`${item.title} ${item.route} ${item.caption}`.toLowerCase())}"><a href="${item.url}" data-lightbox data-title="${e(item.title)}" data-description="${e(item.privacy)}"><span class="screenshot-image"><img src="${item.url}" alt="${e(item.title)} - ${item.format} capture" loading="lazy" decoding="async"></span><figcaption><div><h3>${e(item.title)}</h3><span class="image-format">${item.format}</span></div><p>${e(item.category)}</p>${item.route ? `<code>${e(item.route)}</code>` : '<span class="route-missing">No route in source caption</span>'}</figcaption></a><p class="screenshot-caption">${e(item.caption)}</p></figure>`;
}

function libraryPage() {
  return shell('Documentation library', 'library', `${breadcrumb('Library')}${pageHead('The full documentation library', 'Guides, references, engineering notes and historical reviews. Search every title and the full text of every document.', `<div class="page-meta">${docs.length} documents &middot; ${categories.length} topics &middot; Source snapshot ${date}</div>`)}
<form class="filter-bar" id="library-filter" role="search"><div class="field search-field"><label for="library-query">Search documents</label><div class="input-wrap">${icon('search')}<input id="library-query" type="search" name="q" placeholder="Try permissions, deployment, Copilot..." autocomplete="off"></div></div><div class="field"><label for="library-category">Topic</label><select id="library-category" name="category"><option value="">All topics</option>${categories.map(category => `<option>${e(category)}</option>`).join('')}</select></div><button type="reset" class="button secondary">Clear filters</button></form>
<div class="result-heading"><p id="result-count" role="status">${docs.length} documents</p><span>Alphabetical &middot; relevance when searching</span></div><p class="search-error" id="search-error" role="alert" hidden></p>
<div id="document-results" class="document-results">${docs.map(item => `<a href="${item.url}" class="document-result"><div class="result-main"><h2>${e(item.title)}</h2><p>${e(item.text.slice(0, 180))}...</p><span class="document-path">${e(item.path)}</span></div><span class="topic-label">${e(item.category)}</span></a>`).join('')}</div>`);
}

function galleryPage() {
  const galleryCategories = [...new Set(gallery.map(item => item.category))].sort();
  return shell('Screenshot gallery', 'gallery', `${breadcrumb('Screenshot gallery')}${pageHead('A closer look at Portal 360', 'Browse every imported screenshot. Filter by product area or image format, then open a capture at its original size.', `<div class="page-meta">${gallery.length} images &middot; ${gallery.filter(item => item.format === 'WEBP').length} WEBP &middot; ${gallery.filter(item => item.format === 'JPG').length} legacy JPG</div>`)}
<div class="gallery-notice"><p><strong>Captured screens, not a live demo.</strong> Routes are labels for the original portal. Captures may show older UI, configuration messages or unavailable data.</p><p>${e(privacyNotice)} <a href="${doc('docs/screenshots/README.md')}">Original screenshot notes</a>${screenshotProvenance ? ` &middot; Image source <a href="${repository}/tree/${screenshotProvenance.source.commit}/docs/screenshots" class="commit">${screenshotProvenance.source.commit.slice(0, 8)}</a> &middot; <a href="/about.html">Processing provenance</a>` : ''}</p></div>
<form class="filter-bar" id="gallery-filter"><div class="field search-field"><label for="gallery-query">Find a screenshot</label><div class="input-wrap">${icon('search')}<input id="gallery-query" type="search" placeholder="Search a page, route or caption"></div></div><div class="field"><label for="gallery-category">Product area</label><select id="gallery-category"><option value="">All areas</option>${galleryCategories.map(category => `<option>${e(category)}</option>`).join('')}</select></div><div class="field"><label for="gallery-format">Format</label><select id="gallery-format"><option value="">All formats</option><option>WEBP</option><option>JPG</option></select></div><button type="reset" class="button secondary">Clear filters</button></form>
<p class="gallery-count" id="gallery-count" role="status">${gallery.length} screenshots</p><div class="gallery-grid">${gallery.map(galleryCard).join('')}</div><div id="gallery-empty" class="empty-state" hidden><h2>No screenshots match</h2><p>Try another page name, or clear the product area and format filters.</p></div>`);
}

function documentPage(item) {
  const headings = item.rendered.headings.filter(heading => heading.depth === 2 || heading.depth === 3);
  const toc = headings.length ? `<aside class="table-of-contents" aria-label="On this page"><h2>On this page</h2><nav>${headings.map(heading => `<a class="depth-${heading.depth}" href="#${encodeURIComponent(heading.id)}">${e(heading.title)}</a>`).join('')}</nav><a class="back-to-top" href="#main">Back to top &uarr;</a></aside>` : '';
  const historical = /audits|reviews|Engineering|Design/.test(item.category);
  return shell(item.title, 'document', `<div class="document-column">${breadcrumb(item.category)}<header class="document-meta"><div><a class="text-link" href="/library.html?category=${encodeURIComponent(item.category)}">${e(item.category)}</a><span>${Math.max(1, Math.ceil(item.text.split(/\s+/).length / 220))} min read</span></div><a href="${sourceUrl(item.path)}" download>Original Markdown ${icon('external', 14)}</a></header>
<div class="source-note"><p><strong>Original source document.</strong> ${historical ? 'This historical engineering material may describe plans or a past implementation. ' : ''}Instructions describe the Portal 360 application, not this local site. ${item.path.includes('screenshots') || item.path === 'README.md' ? e(privacyNotice) + ' ' : ''}<a href="/about.html">About this snapshot</a></p></div>
<article class="prose">${item.rendered.html}</article><div class="document-end"><p>Source: <code>${e(item.path)}</code><br>Imported ${e(item.importedAt.slice(0, 10))} from commit ${item.sourceCommit.slice(0, 8)}.</p><a href="${repository}/blob/${item.sourceCommit}/${item.path}" rel="noopener noreferrer">View in original repository ${icon('external', 14)}</a></div></div>${toc ? '' : ''}`, { toc, source: item.path });
}

function aboutPage() {
  const attachments = manifest.files.filter(file => file.kind === 'attachment');
  return shell('About this snapshot', 'about', `${breadcrumb('About this snapshot')}<div class="about-content">${pageHead('A local window into Portal 360', 'This independent documentation workspace preserves the source material without bringing the portal application, accounts or cloud services with it.')}
<section><h2>What Portal 360 is</h2><p>Portal 360&deg; (PortalofPortals) is a unified Microsoft cloud administration workspace for IT and MSP teams. The original repository describes identity, security, device, collaboration and platform operations across Microsoft 365, Azure and Power Platform, with integrations including ServiceNow, Azure DevOps and Fabric.</p><p><a href="${doc('README.md')}">Read the complete, unchanged product overview.</a> This website only displays that information. It cannot administer tenants, sign users in, run queries or deploy resources.</p></section>
<section><h2>Where this library came from</h2><dl class="snapshot-facts"><div><dt>Original repository</dt><dd><a href="${repository}">russrimm/PortalofPortals</a></dd></div><div><dt>Source commit</dt><dd><a href="${repository}/tree/${manifest.source.commit}" class="commit">${manifest.source.commit}</a></dd></div><div><dt>Imported</dt><dd>${e(manifest.source.importedAt)}</dd></div><div><dt>Included</dt><dd>${docs.length} documents, ${gallery.length} images, ${attachments.length} supporting attachments, MIT license</dd></div></dl><p>The full authored documentation tree includes audits, code reviews and UX notes. Additional allowlisted guides include the root README and TODO, five script guides, two testing guides and two source-tree refactoring documents.</p><p>Agent instructions, private configuration, the application runtime, infrastructure, source history, credentials and the Obsidian workspace (including its third-party plugin) are excluded. <a href="/source/manifest.json">Read the exact file manifest</a>.</p></section>
<section><h2>How to read the snapshot</h2><p>Source documents are preserved byte-for-byte. They span different dates and may contain superseded instructions, planned capabilities or unresolved findings. An included guide is not proof that a feature currently works, and a screenshot is not a live state.</p><p>Relative documentation links open the matching local page. Links to source code open the original GitHub repository at the snapshot commit. Portal routes are presented as product references, not website destinations. External images do not load automatically.</p><p>Raw HTML is displayed as text; scripts and MDX are never executed. Mermaid definitions remain readable, copyable code rather than active diagrams. No external fonts, image services, analytics or tenant APIs are used.</p></section>
<section><h2>Supporting source attachments</h2><p>These files are reference material, not executable integrations. OpenAPI schemas are static downloads; there is no live API console.</p><div class="attachment-list">${attachments.map(file => `<a href="${sourceUrl(file.path)}" download><span>${e(file.path)}</span><span>${Math.ceil(file.bytes / 1024)} KB ${icon('arrow', 16)}</span></a>`).join('')}</div></section>
<section><h2>Screenshot privacy</h2><p>${e(privacyNotice)}</p>${screenshotProvenance ? `<dl class="snapshot-facts"><div><dt>Image and caption source</dt><dd><a href="${repository}/tree/${screenshotProvenance.source.commit}" class="commit">${screenshotProvenance.source.commit}</a></dd></div><div><dt>Processed</dt><dd>${e(screenshotProvenance.processedAt)}</dd></div><div><dt>Processing totals</dt><dd>${manifest.screenshots.counts.current} current-upstream WEBP, ${manifest.screenshots.counts.legacy} retained legacy JPG; ${manifest.screenshots.counts.masked} images with privacy masks, ${manifest.screenshots.counts.reviewedNoGuid} reviewed with no GUID regions reported and no masks applied${screenshotProvenance.retired ? `; ${screenshotProvenance.retired.length} retired because their pages were removed upstream` : ''}</dd></div></dl><p>${e(screenshotProvenance.methodology)}</p><p>Mask counts include all opaque privacy regions, not only GUIDs. Only the screenshot README and tour use the newer document pin; all other documents retain the original source commit above. Per-image source commits and original/transformed hashes are recorded in the <a href="/source/${PROVENANCE}" download>processing provenance</a>. “Current” identifies the upstream image set, not a guarantee of recent capture or current UI.</p>` : ''}<p>Repository history and other content require a separate publication review. These changes do not authorize making this repository public.</p></section>
<section><h2>License & attribution</h2><p>Source documentation and images are included under the original MIT license. Copyright (c) 2025 Russ Rimmerman [MSFT]. <a href="/source/LICENSE">Read the license</a>.</p><p>Microsoft product names describe the original portal's integrations. This local documentation site is not a Microsoft service.</p></section></div>`);
}

const pages = [
  ['/index.html', homePage()], ['/library.html', libraryPage()],
  ['/gallery.html', galleryPage()], ['/about.html', aboutPage()],
  ['/404.html', shell('Page not found', 'not-found', `${pageHead('This page is not in the documentation site', 'Portal application routes and API endpoints are not served here.')}<p><a class="button primary" href="/library.html">Browse documentation ${icon('arrow')}</a></p>`)]
];
for (const item of docs) pages.push([decodeURIComponent(item.url), documentPage(item)]);
const expected = generatedPaths(manifest);
const anchors = new Map(pages.map(([url, html]) => [url, new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]))]));
for (const [page, html] of pages) {
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const href = match[1].replace(/&amp;/g, '&');
    if (/^https?:|mailto:/.test(href)) continue;
    const url = new URL(href, `https://local.invalid${page}`);
    const target = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    if (!expected.has(target.slice(1))) throw new Error(`Broken generated local link ${href} from ${page}`);
    if (url.hash && anchors.has(target) && !anchors.get(target).has(decodeURIComponent(url.hash.slice(1)))) {
      throw new Error(`Broken generated section ${href} from ${page}`);
    }
  }
}
await mkdir(output, { recursive: true });
await removeStaleOutput(output, staleOutput);
// Only importer-listed assets are served; hidden source tooling is never copied.
for (const file of manifest.files) {
  const destination = path.join(output, 'source', ...file.path.split('/'));
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(path.join(snapshot, ...file.path.split('/')), destination);
}
await cp(path.join(snapshot, 'manifest.json'), path.join(output, 'source', 'manifest.json'));
if (screenshotProvenance) await cp(path.join(snapshot, PROVENANCE), path.join(output, 'source', PROVENANCE));
await mkdir(path.join(output, 'assets'), { recursive: true });
for (const file of GENERATED_ASSETS) {
  await cp(path.join(root, 'site', file), path.join(output, 'assets', file));
}
for (const [url, html] of pages) {
  const filename = path.join(output, ...url.slice(1).split('/'));
  await mkdir(path.dirname(filename), { recursive: true });
  await writeFile(filename, html);
}
await writeFile(path.join(output, 'search-index.json'), JSON.stringify(docs.map(({ path: sourcePath, url, title, category, text }) => ({ path: sourcePath, url, title, category, text }))));
await writeFile(path.join(output, 'gallery-index.json'), JSON.stringify(gallery, null, 2));
await writeFile(path.join(output, 'link-report.json'), JSON.stringify(diagnostics, null, 2));

console.log(`Built ${docs.length} document pages, ${gallery.length} gallery images, ${manifest.files.filter(file => file.kind === 'attachment').length} attachments.`);
console.log(`Snapshot ${shortCommit} (${date}). Output: ${output}`);
console.log(`${diagnostics.filter(item => item.kind === 'source-reference').length} source references route to GitHub; ${diagnostics.filter(item => item.kind === 'product-route').length} portal routes are non-navigation labels. See dist\\link-report.json.`);
