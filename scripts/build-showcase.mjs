import { readFile, writeFile, mkdir, cp, rm, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'pages-dist');
const shots = path.join(root, 'snapshot', 'docs', 'screenshots');
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const data = JSON.parse(await readFile(path.join(root, 'showcase', 'pages.json'), 'utf8'));
const provenance = JSON.parse(await readFile(path.join(root, 'snapshot', 'screenshots-provenance.json'), 'utf8'));
const sizes = new Map(provenance.files.flatMap(f => [[f.path, f], ...f.aliases.map(a => [a, f])]));

const pages = [];
for (const page of data.pages) {
  const file = ['webp', 'jpg'].map(ext => `${page.stem}.${ext}`).find(name => sizes.has(`docs/screenshots/${name}`));
  if (!file) throw new Error(`No screenshot for ${page.stem}`);
  await access(path.join(shots, file)).catch(() => { throw new Error(`Missing image file ${file}`); });
  const meta = sizes.get(`docs/screenshots/${file}`);
  pages.push({ ...page, file, width: meta.width, height: meta.height });
}

const categories = [...new Set(pages.map(p => p.category))];
const card = p => `<article class="card" id="${esc(p.stem)}" data-category="${esc(p.category)}" data-search="${esc([p.title, p.route, p.category, p.description].join(' ').toLowerCase())}">
  <a class="shot" href="screenshots/${esc(p.file)}" data-full aria-label="Open full-size screenshot: ${esc(p.title)}">
    <img src="screenshots/${esc(p.file)}" width="${p.width}" height="${p.height}" loading="lazy" decoding="async" alt="Screenshot of the ${esc(p.title)} page in Portal 360">
  </a>
  <div class="body">
    <p class="meta"><span class="cat">${esc(p.category)}</span><code>${esc(p.route)}</code></p>
    <h3><a href="#${esc(p.stem)}">${esc(p.title)}</a></h3>
    <p>${esc(p.description)}</p>
    <h4>What an admin can do here</h4>
    <ul>${p.adminActions.map(a => `<li>${esc(a)}</li>`).join('')}</ul>
  </div>
</article>`;

const html = `<!doctype html>
<html lang="en-US" data-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Portal 360 screenshot showcase</title>
<meta name="description" content="${pages.length} annotated screenshots of Portal 360, a unified admin portal for Microsoft Entra ID, Microsoft 365, Intune, Azure, Power Platform, Fabric and Azure DevOps. All tenant data is redacted.">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="styles.css">
</head>
<body>
<header class="hero">
  <h1>Portal 360 screenshot showcase</h1>
  <p>${pages.length} annotated pages from Portal 360, a unified administration portal for Microsoft Entra ID, Microsoft 365, Intune, Azure, Power Platform, Microsoft Fabric and Azure DevOps. Captured in dark mode.</p>
  <p class="note">All tenant data is redacted or replaced with fictional stand-ins. Screenshots are from upstream commit <code>${esc(provenance.source.commit.slice(0, 7))}</code> for refreshed pages; a few pages keep earlier captures.</p>
  <div class="tools">
    <label class="sr" for="q">Search pages</label>
    <input id="q" type="search" placeholder="Search pages, routes, or descriptions" autocomplete="off">
    <span id="count" role="status" aria-live="polite"></span>
  </div>
  <nav class="chips" aria-label="Filter by product area">
    <button type="button" class="chip" data-cat="" aria-pressed="true">All</button>
    ${categories.map(c => `<button type="button" class="chip" data-cat="${esc(c)}" aria-pressed="false">${esc(c)}</button>`).join('\n    ')}
  </nav>
</header>
<main id="grid">
${categories.map(c => `<section class="group" data-group="${esc(c)}">
<h2>${esc(c)}</h2>
<div class="cards">
${pages.filter(p => p.category === c).map(card).join('\n')}
</div>
</section>`).join('\n')}
<p id="empty" hidden>No pages match your search.</p>
</main>
<footer>
  <p>Source: <a href="https://github.com/russrimm/PortalofPortals-Docs">russrimm/PortalofPortals-Docs</a>. Descriptions come from the Portal 360 in-app gallery or were written from its source code; they describe the page, not a completed operation.</p>
</footer>
<dialog id="lightbox" aria-label="Full-size screenshot"><form method="dialog"><button class="close" aria-label="Close">Close</button></form><img alt=""></dialog>
<script src="app.js"></script>
</body>
</html>
`;

await rm(out, { recursive: true, force: true });
await mkdir(path.join(out, 'screenshots'), { recursive: true });
for (const p of pages) await cp(path.join(shots, p.file), path.join(out, 'screenshots', p.file));
for (const name of ['styles.css', 'app.js', 'favicon.svg']) await cp(path.join(root, 'showcase', name), path.join(out, name));
await writeFile(path.join(out, 'index.html'), html);
await writeFile(path.join(out, '.nojekyll'), '');
console.log(`Built ${pages.length} pages in ${categories.length} groups -> ${path.relative(root, out)}`);
