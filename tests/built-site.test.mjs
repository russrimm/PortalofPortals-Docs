import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { searchDocuments } from '../site/search.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const manifest = JSON.parse(await readFile(path.join(root, 'snapshot', 'manifest.json'), 'utf8'));
const index = JSON.parse(await readFile(path.join(dist, 'search-index.json'), 'utf8'));
const gallery = JSON.parse(await readFile(path.join(dist, 'gallery-index.json'), 'utf8'));
async function walk(directory) {
  const result = [];
  for (const item of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, item.name);
    if (item.isDirectory()) result.push(...await walk(full));
    else result.push(full);
  }
  return result;
}

test('all imported source files retain their hashes in the built site', async () => {
  for (const item of manifest.files) {
    const buffer = await readFile(path.join(dist, 'source', ...item.path.split('/')));
    assert.equal(createHash('sha256').update(buffer).digest('hex'), item.sha256, item.path);
  }
});

test('all documents are searchable and all images are reachable from the gallery', async () => {
  assert.equal(index.length, manifest.files.filter(item => item.kind === 'document').length);
  assert.equal(gallery.length, manifest.files.filter(item => item.kind === 'image').length);
  assert.equal(new Set(gallery.map(item => item.path)).size, gallery.length);
  const html = await readFile(path.join(dist, 'gallery.html'), 'utf8');
  for (const item of gallery) {
    assert.ok(html.includes(`href="${item.url}"`), item.path);
    assert.ok(item.title && item.category && item.caption && item.privacy, item.path);
  }
  assert.equal(gallery.filter(item => item.format === 'WEBP').length, manifest.files.filter(item => item.path.endsWith('.webp')).length);
  assert.equal(gallery.filter(item => item.format === 'JPG').length, manifest.files.filter(item => item.path.endsWith('.jpg')).length);
  if (manifest.screenshots) {
    assert.equal(gallery.filter(item => item.capture === 'current').length, manifest.screenshots.counts.current);
    assert.equal(gallery.filter(item => item.capture === 'legacy').length, manifest.screenshots.counts.legacy);
    assert.match(html, /GUID-shaped text masking\/review/);
    for (const item of gallery) {
      assert.ok(item.sourceCommit && item.sourceSha256 && item.sha256 && item.status);
      assert.match(item.privacy, /not proof/);
    }
    const builtImages = (await walk(path.join(dist, 'source', 'docs', 'screenshots')))
      .filter(file => /\.(webp|jpg)$/i.test(file)).map(file => path.basename(file)).sort();
    assert.deepEqual(builtImages, gallery.map(item => path.basename(item.path)).sort(), 'No stale original or alias image copies remain');
  }
  const found = searchDocuments(index, 'withDelegatedAuth');
  assert.ok(found.length > 0, 'Can find terms inside the full original document body');
  assert.ok(index.some(item => item.path.startsWith('docs/audits/')));
  assert.ok(index.some(item => item.path.startsWith('docs/ux/')));
  assert.ok(index.some(item => item.path.startsWith('src/')));
});

test('every generated local page link and image/script/style asset exists', async () => {
  const htmlFiles = (await walk(dist)).filter(file => file.endsWith('.html'));
  const seen = new Set();
  const anchors = new Map();
  for (const filename of htmlFiles) {
    const html = await readFile(filename, 'utf8');
    anchors.set(filename, new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1])));
  }
  for (const filename of htmlFiles) {
    const html = await readFile(filename, 'utf8');
    for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      const href = match[1].replace(/&amp;/g, '&');
      if (/^https?:|mailto:/.test(href)) continue;
      const url = new URL(href, `http://local/${path.relative(dist, filename).split(path.sep).join('/')}`);
      const target = path.join(dist, ...decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname).slice(1).split('/'));
      if (url.hash && anchors.has(target)) {
        assert.ok(anchors.get(target).has(decodeURIComponent(url.hash.slice(1))), `Missing section ${href} from ${filename}`);
      }
      if (seen.has(target)) continue;
      assert.ok((await stat(target)).isFile(), `Missing destination ${href} from ${filename}`);
      seen.add(target);
    }
    assert.doesNotMatch(html, /<(?:iframe|object|embed)\b/i, filename);
    assert.doesNotMatch(html, /<(?:script|img|link)\b[^>]*(?:src|href)="https?:/i, filename);
  }
});

test('source scope excludes application code, editor workspace and credentials', () => {
  for (const item of manifest.files) {
    assert.doesNotMatch(item.path, /(?:^|\/)(?:\.obsidian|\.github|\.copilot|node_modules|\.env)(?:\/|$)/);
    assert.doesNotMatch(item.path, /\.(?:tsx?|jsx?|mjs|css|ps1|bicep|tf)$/i);
  }
});

test('local server serves static pages and rejects writes and application routes', async t => {
  const child = spawn(process.execPath, [path.join(root, 'scripts', 'serve.mjs'), '--port', '0'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(async () => {
    if (child.exitCode === null) {
      child.kill();
      await once(child, 'exit');
    }
  });
  const url = await new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error('Server did not start')), 10000);
    child.stdout.on('data', chunk => {
      output += chunk;
      const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) { clearTimeout(timer); resolve(match[0]); }
    });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Server exited early: ${code}`)); });
  });
  const home = await fetch(url);
  assert.equal(home.status, 200);
  assert.match(home.headers.get('content-security-policy'), /script-src 'self'/);
  assert.match(await home.text(), /Your guide to/);
  assert.equal((await fetch(`${url}/api/users`)).status, 404);
  assert.equal((await fetch(`${url}/.git/config`)).status, 400);
  assert.equal((await fetch(`${url}/library.html`, { method: 'POST' })).status, 405);
  const raw = await fetch(`${url}/source/README.md`);
  assert.match(raw.headers.get('content-type'), /text\/plain/);
  const legacy = gallery.find(item => item.format === 'JPG');
  assert.equal((await fetch(new URL(legacy.url, url))).status, 200);
  if (manifest.screenshots) assert.equal((await fetch(`${url}/source/docs/screenshots/home.jpg`)).status, 404);
});
