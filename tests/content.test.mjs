import test from 'node:test';
import assert from 'node:assert/strict';
import { createResolver, renderMarkdown, repairLocalFragments, galleryMetadata, categoryFor, docUrl, plainText } from '../scripts/content.mjs';
import { searchDocuments, excerpt } from '../site/search.mjs';

const files = [
  { path: 'README.md', kind: 'document' },
  { path: 'docs/guide.md', kind: 'document' },
  { path: 'docs/ux/journey.md', kind: 'document' },
  { path: 'docs/screenshots/README.md', kind: 'document' },
  { path: 'docs/screenshots/home.webp', kind: 'image', bytes: 20 },
  { path: 'docs/screenshots/home.jpg', kind: 'image', bytes: 30 },
  { path: 'docs/screenshots/orphan.jpg', kind: 'image', bytes: 40 },
  { path: 'docs/openapi.json', kind: 'attachment' }
];
const resolve = createResolver(files, 'abc123');

test('relative links resolve from nested documents and root overview', () => {
  assert.equal(resolve('../guide.md#intro', 'docs/ux/journey.md').url, '/library/docs/guide.html#intro');
  assert.equal(resolve('../../README.md', 'docs/ux/journey.md').url, '/library/README.html');
  assert.equal(resolve('docs/guide.md', 'README.md').url, '/library/docs/guide.html');
  assert.equal(resolve('../screenshots/home.webp', 'docs/ux/journey.md', { image: true }).url, '/source/docs/screenshots/home.webp');
  assert.equal(resolve('/docs/openapi.json', 'README.md').url, '/source/docs/openapi.json');
  assert.equal(resolve('./screenshots/', 'docs/guide.md').url, '/library/docs/screenshots/README.html');
  assert.equal(resolve('GUIDE.md', 'docs/other.md').url, '/library/docs/guide.html');
  assert.equal(docUrl('docs/a b.md'), '/library/docs/a%20b.html');
});

test('source links use pinned GitHub source, not local missing app paths', () => {
  assert.equal(resolve('../src/app/page.tsx', 'docs/guide.md').url, 'https://github.com/russrimm/PortalofPortals/blob/abc123/src/app/page.tsx');
  assert.equal(resolve('src/app/page.tsx', 'docs/guide.md').url, 'https://github.com/russrimm/PortalofPortals/blob/abc123/src/app/page.tsx');
  assert.equal(resolve('/api/users', 'docs/guide.md').kind, 'product-route');
  assert.equal(resolve('/api/openapi.json', 'docs/guide.md').kind, 'product-route');
  assert.equal(resolve('/tools/portal-roadmap', 'docs/guide.md').kind, 'product-route');
  assert.equal(resolve('/', 'README.md').kind, 'product-route');
  assert.equal(resolve('https://github.com/russrimm/PortalofPortals/blob/main/docs/guide.md', 'README.md').url, '/library/docs/guide.html');
});

test('same-stem screenshot aliases resolve locally without duplicate gallery entries', () => {
  const image = {
    path: 'docs/screenshots/home.webp', kind: 'image', bytes: 100,
    aliases: ['docs/screenshots/home.jpg'], sourceCommit: 'c'.repeat(40),
    status: 'guid-masked', maskCount: 2, capture: 'current',
  };
  const entries = [{ path: 'docs/screenshots/TOUR.md', kind: 'document', sourceCommit: 'c'.repeat(40) }, image];
  const resolver = createResolver(entries, 'a'.repeat(40));
  for (const href of ['home.jpg', 'HOME.JPG', '/docs/screenshots/home.jpg', 'https://github.com/russrimm/PortalofPortals/blob/main/docs/screenshots/home.jpg']) {
    assert.equal(resolver(href, 'docs/screenshots/TOUR.md').url, '/source/docs/screenshots/home.webp');
  }
  assert.equal(resolver('home.jpg?download=1#image', 'docs/screenshots/TOUR.md').url, '/source/docs/screenshots/home.webp?download=1#image');
  assert.match(resolver('../../missing.md', 'docs/screenshots/TOUR.md').url, new RegExp(`/blob/${'c'.repeat(40)}/`));
  const gallery = galleryMetadata(entries, '### Overview\n| Home | `/` | [View](home.webp) |', '## Home\n\n![Home](home.jpg)\n\nNarrative caption.\n');
  assert.equal(gallery.length, 1);
  assert.equal(gallery[0].caption, 'Narrative caption.');
  assert.match(gallery[0].privacy, /2 opaque privacy-mask region/);
  assert.match(gallery[0].privacy, /profiles and other personal data/);
  assert.doesNotMatch(gallery[0].privacy, /2 GUID-shaped text region/);
  assert.match(gallery[0].privacy, /not proof/);
  assert.equal(gallery[0].sourceCommit, 'c'.repeat(40));
  assert.throws(() => createResolver([...entries, { path: 'docs/screenshots/home.jpg', kind: 'image' }], 'a'.repeat(40)), /Duplicate/);
});

test('unsafe protocols and outside-repository paths are non-interactive', () => {
  for (const href of ['javascript:alert(1)', 'data:text/html,payload', 'file:///C:/secret', '//evil.example', '../../../secret.txt']) {
    assert.equal(resolve(href, 'docs/guide.md').kind, 'blocked', href);
  }
});

test('GFM tables, tasks, fenced code and duplicate section anchors render', () => {
  const { html, headings } = renderMarkdown('# Example\n\n## Same\n\n## Same\n\n| A | B |\n| - | - |\n| x | y |\n\n- [x] Done\n\n```js\nconst x = "<script>";\n```', 'docs/guide.md', resolve);
  assert.match(html, /<table>/);
  assert.match(html, /<th scope="col">A/);
  assert.match(html, /type="checkbox"/);
  assert.match(html, /disabled/);
  assert.match(html, /&lt;script&gt;/);
  assert.deepEqual(headings.map(item => item.id), ['example', 'same', 'same-1']);
});

test('raw HTML, MDX-like content and Mermaid do not execute', () => {
  const markdown = '<script>alert(1)</script>\n\n<img src="https://evil.example/x" onerror="alert(1)">\n\n<Widget onClick={danger} />\n\n```mermaid\ngraph TD\nA-->B\n```';
  const { html } = renderMarkdown(markdown, 'docs/guide.md', resolve);
  assert.doesNotMatch(html, /<script|<img|<Widget|onerror="/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /Mermaid diagram definition/);
  assert.match(html, /Rendering is intentionally disabled/);
});

test('external images are links, local images open in full-size viewer', () => {
  const { html } = renderMarkdown('![Badge](https://img.shields.io/badge/x)\n\n![Home](screenshots/home.jpg)\n\n[x](javascript:alert%281%29)', 'docs/guide.md', resolve);
  assert.match(html, /View external source/);
  assert.doesNotMatch(html, /src="https:/);
  assert.match(html, /data-lightbox/);
  assert.match(html, /src="\/source\/docs\/screenshots\/home.jpg"/);
  assert.doesNotMatch(html, /href="javascript:/);
});

test('source anchor variations are repaired and missing sections have an honest fallback', () => {
  const sets = new Map([['/library/docs/guide.html', new Set(['-getting-started', 'real-section'])]]);
  const diagnostics = [];
  const html = repairLocalFragments('<a href="#getting-started">Start</a><a href="#missing">Missing</a><a href="#real-section">Real</a>', '/library/docs/guide.html', sets, diagnostics);
  assert.match(html, /href="#-getting-started"/);
  assert.match(html, /href="\/library\/docs\/guide.html">Missing<span/);
  assert.match(html, /section absent in source/);
  assert.match(html, /href="#real-section"/);
  assert.equal(diagnostics.length, 2);
});

test('gallery includes every format, metadata, uncaptained assets and honest privacy labels', () => {
  const readme = '### Overview\n| Home | `/` | [View](home.webp) |';
  const tour = '## Portal Home\n\n![Portal Home](home.jpg)\n\nA source-authored description.\n\n---';
  const gallery = galleryMetadata(files, readme, tour);
  assert.equal(gallery.length, 3);
  const jpg = gallery.find(item => item.path.endsWith('home.jpg'));
  assert.equal(jpg.caption, 'A source-authored description.');
  assert.equal(jpg.title, 'Portal Home');
  assert.equal(jpg.route, '/');
  assert.match(jpg.privacy, /not been independently verified/);
  assert.equal(gallery.find(item => item.path.endsWith('orphan.jpg')).provenance, 'Filename');
});

test('search uses title AND full document text, ranks title and supports multiple words', () => {
  const docs = [
    { title: 'Permissions', path: 'a.md', category: 'Identity', text: 'Delegated tenant permissions and setup.' },
    { title: 'Deployment guide', path: 'b.md', category: 'Setup', text: 'A long introduction. Permissions for delegated tenant setup.' },
    { title: 'Other', path: 'c.md', category: 'Setup', text: 'An unrelated topic.' }
  ];
  assert.deepEqual(searchDocuments(docs, 'permissions').map(item => item.path), ['a.md', 'b.md']);
  assert.equal(searchDocuments(docs, 'delegated tenant', 'Setup')[0].path, 'b.md');
  assert.equal(searchDocuments(docs, 'not-in-the-index').length, 0);
  assert.equal(searchDocuments(docs, '', 'Setup').length, 2);
  assert.match(excerpt('prefix '.repeat(50) + 'needle here', 'needle'), /needle/);
  assert.equal(plainText('## A **heading**'), 'A heading');
  assert.equal(categoryFor('docs/audits/review.md'), 'Audits & reviews');
});
