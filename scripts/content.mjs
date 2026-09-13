import path from 'node:path';
import { Marked } from 'marked';
import GithubSlugger from 'github-slugger';

export const repository = 'https://github.com/russrimm/PortalofPortals';
export const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));
export const encodePath = value => value.split('/').map(encodeURIComponent).join('/');
export const docUrl = file => `/library/${encodePath(file.replace(/\.md$/i, ''))}.html`;
export const sourceUrl = file => `/source/${encodePath(file)}`;

export function plainText(markdown, { preserveHtml = false } = {}) {
  const text = markdown
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  return (preserveHtml ? text : text.replace(/<[^>]*>/g, ' '))
    .replace(/[`#*_~|]/g, '')
    .replace(/\s+/g, ' ').trim();
}

export function titleFor(file, markdown) {
  if (file === 'README.md') return 'About Portal 360';
  if (file === 'docs/README.md') return 'Documentation index';
  if (file === 'docs/screenshots/README.md') return 'Screenshot reference';
  if (file === 'docs/screenshots/TOUR.md') return 'Product tour';
  const heading = markdown.match(/^#\s+(.+)$/m);
  return heading ? plainText(heading[1]) : path.posix.basename(file, '.md').replace(/[-_]/g, ' ');
}

export function categoryFor(file) {
  const name = file.toLowerCase();
  if (name === 'readme.md' || /^docs\/(?:readme|quick-start|feature-walkthrough|application-walkthrough|development|portalofportalsfaq)\.md$/.test(name)) return 'Getting started';
  if (name.startsWith('docs/screenshots/')) return 'Product tours';
  if (name.startsWith('docs/audits/') || name.startsWith('docs/code-review/')) return 'Audits & reviews';
  if (name.startsWith('docs/ux/')) return 'Design & accessibility';
  if (/^scripts\/|^tests\/|^src\/|todo\.md|refactor|performance|cach|memoization|dependency|recharts|build-fix/.test(name)) return 'Engineering';
  if (/power-platform|power-automate|dataverse|copilot-studio|copilot-agent|solution-analy|flow|elastic-table|erd-generator|canvas/.test(name)) return 'Power Platform & agents';
  if (/azure|bicep|deployment-stack|virtual-machine|vm-|billing|cost|fabric|pax/.test(name)) return 'Azure & data';
  if (/auth|security|rbac|permission|token|session|entra|pim|access-package|aadsts|oauth|groups/.test(name)) return 'Identity & security';
  if (/intune|device|android|windows-update/.test(name)) return 'Devices & Intune';
  if (/servicenow|teams|copilot|service-health|reports|user-presence/.test(name)) return 'Microsoft 365 & integrations';
  if (/theme|color|mobile|ui-ux|responsive|table-data|modal/.test(name)) return 'Design & accessibility';
  if (/deploy|install|environment-variable|network|telemetry|admin-guide|redis|troubleshoot/.test(name)) return 'Setup & operations';
  if (/api-documentation|api-endpoints-reference|api-integration|api-architecture/.test(name)) return 'API reference';
  return 'Product guides & reference';
}

export function createResolver(files, commit, diagnostics = []) {
  const byPath = new Map(files.map(file => [file.path, file]));
  const casePaths = new Map(files.map(file => [file.path.toLowerCase(), file.path]));
  for (const file of files) {
    for (const alias of file.aliases ?? []) {
      if (casePaths.has(alias.toLowerCase())) throw new Error(`Duplicate local image alias: ${alias}`);
      byPath.set(alias, file);
      casePaths.set(alias.toLowerCase(), alias);
    }
  }
  return function resolve(href, from, { image = false } = {}) {
    if (!href) return { kind: 'blocked', reason: 'Empty destination' };
    const raw = href.trim().replace(/\\/g, '/');
    if (raw.startsWith('#')) return { kind: 'local', url: raw };
    if (/^(https?:|mailto:)/i.test(raw)) {
      const match = raw.match(/^https:\/\/github\.com\/russrimm\/PortalofPortals\/(?:blob|tree)\/(?:main|master|[a-f0-9]{7,40})\/(.+)$/i);
      if (match) return resolve(`/${match[1]}`, from, { image });
      return image ? { kind: 'remote-image', url: raw } : { kind: 'external', url: raw };
    }
    if (/^[a-z][a-z\d+.-]*:|^\/\//i.test(raw)) return { kind: 'blocked', reason: 'Unsupported URL protocol' };
    let decoded;
    try { decoded = decodeURI(raw); } catch { return { kind: 'blocked', reason: 'Invalid URL encoding' }; }
    const cut = decoded.search(/[?#]/);
    const target = cut < 0 ? decoded : decoded.slice(0, cut);
    const suffix = cut < 0 ? '' : decoded.slice(cut);
    const candidate = path.posix.normalize(!target ? from : target.startsWith('/') ? target.slice(1) : path.posix.join(path.posix.dirname(from), target)).replace(/\/$/, '');
    if (candidate.startsWith('../')) return { kind: 'blocked', reason: 'Destination is outside the source repository' };
    const possibilities = [candidate, `${candidate}/README.md`, `${candidate}.md`];
    // Some source guides use repository-root paths even from inside docs.
    if (!target.startsWith('/') && /^(docs|src|scripts|tests)\//.test(target)) possibilities.push(target);
    let found;
    for (const possible of possibilities) {
      found = byPath.get(possible) || byPath.get(casePaths.get(possible.toLowerCase()));
      if (found) break;
    }
    if (found) {
      return { kind: 'local', url: `${found.kind === 'document' ? docUrl(found.path) : sourceUrl(found.path)}${suffix}`, path: found.path };
    }
    if (target.startsWith('/') && !/^(docs|src|scripts|tests|public|\.github)\//.test(candidate) && (!path.posix.extname(candidate) || /^api\//.test(candidate))) {
      diagnostics.push({ from, href, kind: 'product-route' });
      return { kind: 'product-route', route: decoded };
    }
    const sourceCandidate = /^(src|scripts|tests|public|\.github)\//.test(target) ? target : candidate;
    const sourceCommit = byPath.get(from)?.sourceCommit ?? commit;
    const url = `${repository}/blob/${sourceCommit}/${encodePath(sourceCandidate)}${suffix}`;
    diagnostics.push({ from, href, kind: image || /^docs\/screenshots\/.+\.(?:webp|jpe?g|png)$/i.test(sourceCandidate) ? 'missing-image' : 'source-reference', target: sourceCandidate });
    return image ? { kind: 'missing-image', url } : { kind: 'source-reference', url };
  };
}

export function renderMarkdown(markdown, file, resolve) {
  const slugger = new GithubSlugger();
  const headings = [];
  const parser = new Marked({ gfm: true, breaks: false });
  parser.use({ renderer: {
    html({ text }) {
      return `<span class="literal-html">${escapeHtml(text)}</span>`;
    },
    heading({ tokens, depth }) {
      const text = this.parser.parseInline(tokens);
      const title = plainText(text).replace(/&amp;/g, '&').replace(/&#39;/g, "'");
      const id = slugger.slug(title);
      headings.push({ depth, title, id });
      return `<h${depth} id="${escapeHtml(id)}">${text}<a class="heading-anchor" href="#${encodeURIComponent(id)}" aria-label="Link to ${escapeHtml(title)}">#</a></h${depth}>`;
    },
    code({ text, lang }) {
      const language = (lang || 'text').split(/\s/)[0];
      const diagram = language === 'mermaid';
      return `<figure class="code-block${diagram ? ' diagram-source' : ''}"><figcaption><span>${diagram ? 'Mermaid diagram definition' : escapeHtml(language)}</span><button type="button" class="copy-code" data-copy-code>Copy code</button></figcaption><pre tabindex="0" aria-label="${escapeHtml(language)} code"><code>${escapeHtml(text)}</code></pre>${diagram ? '<p class="diagram-note">Diagram source is preserved as text. Rendering is intentionally disabled so imported definitions cannot execute code or load remote resources.</p>' : ''}</figure>`;
    },
    link({ href, title, tokens }) {
      const label = this.parser.parseInline(tokens);
      const target = resolve(href, file);
      if (target.kind === 'blocked') return `<span title="${escapeHtml(target.reason)}">${label} <small>(link disabled)</small></span>`;
      if (target.kind === 'product-route') return `<span class="product-route" title="Route in the Portal 360 application, not this documentation site">${label}<small> portal route</small></span>`;
      const external = target.kind !== 'local';
      return `<a href="${escapeHtml(target.url)}"${external ? ' rel="noopener noreferrer" data-external="true"' : ''}${title ? ` title="${escapeHtml(title)}"` : ''}>${label}${target.kind === 'source-reference' ? '<span class="source-hint"> (source)</span>' : ''}</a>`;
    },
    image({ href, text }) {
      const target = resolve(href, file, { image: true });
      if (target.kind !== 'local' || !target.path || !/\.(webp|jpe?g|png|gif|avif|bmp|ico)$/i.test(target.path)) {
        if (target.url && /^https:\/\//.test(target.url)) return `<span class="image-placeholder">${escapeHtml(text || 'Image')} <a href="${escapeHtml(target.url)}" rel="noopener noreferrer">View external source</a> <small>(not loaded automatically)</small></span>`;
        return `<span class="image-placeholder">${escapeHtml(text || 'Image')} (not available in this snapshot)</span>`;
      }
      return `<a class="doc-image" href="${escapeHtml(target.url)}" data-lightbox data-title="${escapeHtml(text)}"><img src="${escapeHtml(target.url)}" alt="${escapeHtml(text)}" loading="lazy" decoding="async"></a>`;
    },
    table(token) {
      const header = token.header.map((cell, i) => `<th scope="col"${token.align[i] ? ` class="align-${token.align[i]}"` : ''}>${this.parser.parseInline(cell.tokens)}</th>`).join('');
      const body = token.rows.map(row => `<tr>${row.map((cell, i) => `<td${token.align[i] ? ` class="align-${token.align[i]}"` : ''}>${this.parser.parseInline(cell.tokens)}</td>`).join('')}</tr>`).join('');
      return `<div class="table-scroll" role="region" aria-label="Documentation table" tabindex="0"><table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table></div>`;
    }
  } });
  return { html: parser.parse(markdown), headings };
}

export function repairLocalFragments(html, currentUrl, headingSets, diagnostics = []) {
  const comparable = value => value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  return html.replace(/<a\b([^>]*?)href="([^"]+)"([^>]*)>([\s\S]*?)<\/a>/g, (original, before, href, after, label) => {
    if (!href.startsWith('#') && !href.startsWith('/library/')) return original;
    const url = new URL(href.replace(/&amp;/g, '&'), `https://local.invalid${currentUrl}`);
    if (!url.hash) return original;
    const headings = headingSets.get(url.pathname);
    if (!headings) return original;
    let id;
    try { id = decodeURIComponent(url.hash.slice(1)); }
    catch { id = url.hash.slice(1); }
    if (headings.has(id)) return original;
    const aliases = [...headings].filter(heading => comparable(heading) === comparable(id));
    const resolved = aliases.length === 1 ? aliases[0] : '';
    diagnostics.push({ from: currentUrl, href, kind: resolved ? 'fragment-alias' : 'missing-source-fragment', resolved: resolved || null });
    url.hash = resolved ? `#${encodeURIComponent(resolved)}` : '';
    const destination = href.startsWith('#') && resolved ? url.hash : `${url.pathname}${url.search}${url.hash}`;
    return `<a${before}href="${escapeHtml(destination)}"${after}>${label}${resolved ? '' : '<span class="source-hint"> (section absent in source)</span>'}</a>`;
  });
}

export function galleryMetadata(files, readme, tour) {
  const captions = new Map();
  let category = 'Overview';
  for (const line of readme.split(/\r?\n/)) {
    if (line.startsWith('### ')) category = line.slice(4).trim();
    const row = line.match(/^\|\s*(.+?)\s*\|\s*`([^`]+)`\s*\|\s*\[View\]\(([^)]+)\)\s*\|/);
    if (row) captions.set(row[3], { title: row[1], route: row[2], category, caption: `The ${row[1]} page, as captured in the source screenshot reference.`, provenance: 'Screenshot reference' });
  }
  for (const block of tour.split(/^## /m).slice(1)) {
    const image = block.match(/!\[([^\]]+)\]\(([^)]+)\)/);
    if (!image) continue;
    const after = block.slice(image.index + image[0].length).replace(/---[\s\S]*$/, '').trim();
    const stem = path.posix.basename(image[2], path.posix.extname(image[2]));
    const reference = captions.get(`${stem}.webp`);
    captions.set(image[2], {
      title: image[1], route: reference?.route || '', category: reference?.category || inferImageCategory(stem),
      caption: plainText(after), provenance: 'Product tour'
    });
  }
  return files.filter(file => file.kind === 'image').map(file => {
    const name = path.posix.basename(file.path);
    const extension = path.posix.extname(name).slice(1).toUpperCase();
    const data = (file.aliases ?? []).map(alias => captions.get(path.posix.basename(alias))).find(Boolean) ?? captions.get(name);
    return {
      path: file.path, url: sourceUrl(file.path), format: extension, bytes: file.bytes,
      ...(file.status ? {
        sourceCommit: file.sourceCommit, sourceSha256: file.sourceSha256, sha256: file.sha256,
        capture: file.capture, status: file.status, maskCount: file.maskCount,
        width: file.width, height: file.height,
      } : {}),
      ...(data || { title: name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '), route: '', category: 'Additional images', caption: 'Included source image. No authored caption was found.', provenance: 'Filename' }),
      privacy: file.status
        ? `${file.capture === 'legacy' ? 'Retained legacy' : 'Current upstream set'} capture from ${file.sourceCommit.slice(0, 8)}. ${file.status === 'guid-masked' ? `${file.maskCount} opaque privacy-mask region(s) applied; counts can include GUID-shaped text, profiles and other personal data.` : 'Reviewed; no GUID-shaped text regions reported and no masks applied.'} Image metadata stripped. Upstream claims pseudonymization; this processing is not proof that all personal or sensitive information is absent. Review before publication.`
        : extension === 'JPG' || extension === 'JPEG'
        ? 'Legacy JPG capture. Redaction has not been independently verified; review before sharing.'
        : 'Source README describes this capture set as redacted. This site has not independently verified that claim.'
    };
  }).sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title) || a.format.localeCompare(b.format));
}

function inferImageCategory(stem) {
  if (/azure/.test(stem)) return 'Azure';
  if (/device|intune/.test(stem)) return 'Device Management & Intune';
  if (/power-platform/.test(stem)) return 'Power Platform';
  if (/fabric|reports/.test(stem)) return 'Reports & Analytics';
  if (/secure|security|defender|insights/.test(stem)) return 'Security & Risk';
  if (/conditional/.test(stem)) return 'Conditional Access & Policy';
  if (/entra|enterprise|user|group/.test(stem)) return 'Identity & Access';
  return 'Microsoft 365 & Collaboration';
}
