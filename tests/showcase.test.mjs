import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const execute = promisify(execFile);

async function fixture(t) {
  const project = await fs.mkdtemp(path.join(os.tmpdir(), 'portal-showcase-'));
  t.after(() => fs.rm(project, { recursive: true, force: true }));
  for (const directory of ['scripts', 'showcase', 'snapshot/docs/screenshots']) {
    await fs.mkdir(path.join(project, ...directory.split('/')), { recursive: true });
  }
  await fs.copyFile(path.join(root, 'scripts', 'build-showcase.mjs'), path.join(project, 'scripts', 'build-showcase.mjs'));
  for (const name of ['styles.css', 'app.js', 'favicon.svg']) {
    await fs.copyFile(path.join(root, 'showcase', name), path.join(project, 'showcase', name));
  }
  const captured = {
    stem: 'home', title: 'Home', route: '/', category: 'Overview',
    description: 'Home page', adminActions: ['Review the overview'], origin: 'curated',
  };
  const pending = {
    stem: 'servicenow-incidents', title: 'ServiceNow Incidents',
    route: '/servicenow/incidents', category: 'ServiceNow',
    description: 'Review incidents', adminActions: ['Filter incidents'],
    origin: 'generated', screenshotStatus: 'pending',
  };
  const pages = [captured, pending];
  const files = [{ path: 'docs/screenshots/home.webp', aliases: [], width: 1400, height: 875 }];
  const save = async () => {
    await fs.writeFile(path.join(project, 'showcase', 'pages.json'), JSON.stringify({ pages }));
    await fs.writeFile(path.join(project, 'snapshot', 'screenshots-provenance.json'), JSON.stringify({
      source: { commit: 'a'.repeat(40) }, files,
    }));
  };
  await fs.writeFile(path.join(project, 'snapshot', 'docs', 'screenshots', 'home.webp'), 'fixture');
  await save();
  const build = () => execute(process.execPath, [path.join(project, 'scripts', 'build-showcase.mjs')], { cwd: project });
  return { project, pages, files, save, build };
}

test('pending showcase pages have searchable descriptions but no broken image or lightbox link', async t => {
  const f = await fixture(t);
  await f.build();
  const html = await fs.readFile(path.join(f.project, 'pages-dist', 'index.html'), 'utf8');
  assert.match(html, /2 annotated pages/);
  assert.match(html, /1 screenshots captured in dark mode; 1 screenshots pending/);
  const card = html.match(/<article[^>]*id="servicenow-incidents"[\s\S]*?<\/article>/)?.[0];
  assert.ok(card);
  assert.match(card, /Screenshot pending/);
  assert.match(card, /data-search="[^"]*screenshot pending/);
  assert.match(card, /Review incidents/);
  assert.match(card, /Filter incidents/);
  assert.doesNotMatch(card, /<img|data-full|href="screenshots\//);
  assert.deepEqual(await fs.readdir(path.join(f.project, 'pages-dist', 'screenshots')), ['home.webp']);
});

test('showcase still rejects unmarked missing screenshots and missing indexed image files', async t => {
  const f = await fixture(t);
  delete f.pages[1].screenshotStatus;
  await f.save();
  await assert.rejects(f.build(), /No screenshot for servicenow-incidents/);
  f.pages[1].screenshotStatus = 'pending';
  f.files.push({ path: 'docs/screenshots/servicenow-incidents.webp', aliases: [], width: 1400, height: 875 });
  await f.save();
  await assert.rejects(f.build(), /Missing image file servicenow-incidents.webp/);
});

test('an approved matching screenshot replaces a pending placeholder automatically', async t => {
  const f = await fixture(t);
  f.files.push({ path: 'docs/screenshots/servicenow-incidents.webp', aliases: [], width: 1400, height: 875 });
  await fs.writeFile(path.join(f.project, 'snapshot', 'docs', 'screenshots', 'servicenow-incidents.webp'), 'fixture');
  await f.save();
  await f.build();
  const html = await fs.readFile(path.join(f.project, 'pages-dist', 'index.html'), 'utf8');
  assert.match(html, /2 screenshots captured in dark mode; 0 screenshots pending/);
  assert.doesNotMatch(html, /class="shot-pending"/);
  assert.match(html, /src="screenshots\/servicenow-incidents.webp"/);
});
