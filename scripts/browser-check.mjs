import { spawn, execFile } from 'node:child_process';
import { mkdtemp, readFile, writeFile, access, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { once } from 'node:events';
import { promisify } from 'node:util';
import assert from 'node:assert/strict';

const args = process.argv.slice(2);
const argument = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const base = new URL(argument('--url', 'http://127.0.0.1:4173'));
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname), 'Browser checks must target a local site');
const browserPath = argument('--browser', process.env.BROWSER_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe');
await access(browserPath);
const artifactArgument = argument('--artifacts', '');
const artifacts = artifactArgument ? path.resolve(artifactArgument) : await mkdtemp(path.join(process.cwd(), '.browser-artifacts-'));
await mkdir(artifacts, { recursive: true });
console.log(`Browser artifacts: ${artifacts}`);
const documentCount = (await (await fetch(new URL('/search-index.json', base))).json()).length;
const galleryIndex = await (await fetch(new URL('/gallery-index.json', base))).json();
const jpgCount = galleryIndex.filter(item => item.format === 'JPG').length;
const webpCount = galleryIndex.filter(item => item.format === 'WEBP').length;
assert.ok(jpgCount > 0 && webpCount > 0, 'Both retained JPG and current WEBP filters must be exercised');
const profile = await mkdtemp(path.join(process.cwd(), '.browser-profile-'));
const browser = spawn(browserPath, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--disable-background-networking', '--disable-extensions', '--disable-crashpad-for-testing', '--remote-debugging-port=0',
  `--user-data-dir=${profile}`, 'about:blank'
], { stdio: 'ignore' });
browser.on('error', error => { console.error(error.message); });

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let socket;
let nextId = 0;
const pending = new Map();
const exceptions = [];
const requests = new Set();
function send(method, params = {}) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out`)); }, 20000);
    pending.set(id, {
      resolve: result => { clearTimeout(timer); resolve(result); },
      reject: error => { clearTimeout(timer); reject(error); }
    });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}
async function waitFor(expression) {
  for (let attempt = 0; attempt < 120; attempt++) {
    if (await evaluate(expression)) return;
    await delay(100);
  }
  throw new Error(`Page condition timed out: ${expression}`);
}
async function navigate(route) {
  const url = new URL(route, base).href;
  await send('Page.navigate', { url });
  await waitFor(`location.href === ${JSON.stringify(url)} && document.readyState === 'complete' && document.documentElement.dataset.js === 'true'`);
}
const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
async function field(selector, value, event = 'input') {
  await evaluate(`{ const el = document.querySelector(${JSON.stringify(selector)}); el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event(${JSON.stringify(event)}, { bubbles: true })); }`);
}
async function key(key, code, text = undefined) {
  const keyCode = { Enter: 13, Escape: 27, ArrowLeft: 37, ArrowRight: 39, '/': 191 }[key];
  const properties = { key, code, ...(keyCode ? { windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode } : {}) };
  await send('Input.dispatchKeyEvent', { type: 'keyDown', ...properties, ...(text || key === 'Enter' ? { text: text || '\r' } : {}) });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', ...properties });
}
async function screenshot(name) {
  const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(path.join(artifacts, name), Buffer.from(result.data, 'base64'));
}
async function noOverflow(label) {
  const dimensions = await evaluate(`({ viewport: innerWidth, content: document.documentElement.scrollWidth })`);
  assert.ok(dimensions.content <= dimensions.viewport + 1, `${label}: horizontal overflow ${JSON.stringify(dimensions)}`);
}
const report = [];

try {
  let port;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      port = Number((await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split(/\r?\n/)[0]);
      break;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      if (browser.exitCode !== null && browser.exitCode !== 0) throw new Error(`Browser exited: ${browser.exitCode}`);
      await delay(150);
    }
  }
  if (!port) throw new Error('Browser did not expose a debugging port');
  const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
  await once(socket, 'open');
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const operation = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) operation?.reject(new Error(message.error.message));
      else operation?.resolve(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails);
    if (message.method === 'Network.requestWillBeSent') requests.add(message.params.request.url);
  });
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await navigate('/');
  await waitFor(`document.querySelector('.welcome-image img').naturalWidth > 0`);
  await noOverflow('Desktop home');
  await screenshot('desktop-home.png');
  await key('/', 'Slash', '/');
  assert.equal(await evaluate('document.activeElement.id'), 'global-search');
  await field('#global-search', 'withDelegatedAuth');
  await key('Enter', 'Enter');
  await waitFor(`location.pathname === '/library.html' && document.querySelector('#result-count') && !document.querySelector('#result-count').textContent.includes('Loading') && document.querySelector('#document-results mark') !== null`);
  assert.ok((await evaluate(`document.querySelectorAll('.document-result').length`)) > 0);
  report.push('Keyboard header search finds full-body code terms');
  await field('#library-query', 'this-query-cannot-exist-913747');
  await waitFor(`document.querySelector('.empty-state') !== null`);
  await click('#library-filter button[type="reset"]');
  await waitFor(`document.querySelectorAll('.document-result').length === ${documentCount}`);
  await field('#library-category', 'Identity & security', 'change');
  assert.ok(await evaluate(`[...document.querySelectorAll('.topic-label')].every(el => el.textContent === 'Identity & security')`));
  await noOverflow('Desktop library');
  await screenshot('desktop-library.png');
  report.push('Library filtering, empty state and reset work');

  await navigate('/gallery.html');
  assert.equal(await evaluate(`document.querySelectorAll('[data-gallery-card]').length`), galleryIndex.length);
  await field('#gallery-format', 'WEBP', 'change');
  assert.equal(await evaluate(`document.querySelectorAll('[data-gallery-card]:not([hidden])').length`), webpCount);
  await field('#gallery-format', 'JPG', 'change');
  assert.equal(await evaluate(`document.querySelectorAll('[data-gallery-card]:not([hidden])').length`), jpgCount);
  await click('[data-gallery-card]:not([hidden]) [data-lightbox]');
  assert.ok(await evaluate(`document.querySelector('#image-viewer').open`));
  await waitFor(`document.querySelector('#viewer-image').naturalWidth > 0`);
  assert.equal(await evaluate('document.activeElement.id'), 'viewer-close');
  assert.equal(await evaluate(`document.querySelector('#viewer-description').textContent`), galleryIndex.find(item => item.format === 'JPG').privacy);
  await key('ArrowRight', 'ArrowRight');
  assert.equal(await evaluate(`document.querySelector('#viewer-position').textContent`), `2 of ${jpgCount}`);
  await key('Escape', 'Escape');
  assert.equal(await evaluate(`document.querySelector('#image-viewer').open`), false);
  await waitFor(`document.activeElement.hasAttribute('data-lightbox')`);
  await field('#gallery-query', 'nothing-will-match-19393');
  assert.equal(await evaluate(`document.querySelector('#gallery-empty').hidden`), false);
  await click('#gallery-filter button[type="reset"]');
  await waitFor(`document.querySelectorAll('[data-gallery-card]:not([hidden])').length === ${galleryIndex.length}`);
  await noOverflow('Desktop gallery');
  await screenshot('desktop-gallery.png');
  report.push(`All ${galleryIndex.length} images, ${jpgCount} JPG and ${webpCount} WEBP filters, full-size navigation, Escape and focus return work`);

  await navigate('/library/docs/README.html');
  assert.ok(await evaluate(`document.querySelectorAll('.prose table').length > 0`));
  await click('.prose a[href="/library/docs/admin-guide.html"]');
  await waitFor(`location.pathname === '/library/docs/admin-guide.html' && document.readyState === 'complete'`);
  await navigate('/library/docs/ux/agent-analyzer-flow.html');
  await noOverflow('Nested document');
  report.push('Rendered GFM tables and nested document navigation work');
  await navigate('/library/docs/API-DOCUMENTATION.html');
  await noOverflow('Long reference');
  await screenshot('desktop-document.png');

  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await navigate('/');
  await noOverflow('Mobile home');
  await screenshot('mobile-home.png');
  await click('#menu-toggle');
  assert.equal(await evaluate(`document.querySelector('#menu-toggle').getAttribute('aria-expanded')`), 'true');
  await noOverflow('Mobile expanded navigation');
  await screenshot('mobile-navigation.png');
  await click('#menu-toggle');
  await click('#theme-toggle');
  assert.equal(await evaluate('document.documentElement.dataset.theme'), 'dark');
  await navigate('/gallery.html');
  assert.equal(await evaluate('document.documentElement.dataset.theme'), 'dark');
  await noOverflow('Mobile dark gallery');
  await screenshot('mobile-gallery-dark.png');
  await click('[data-lightbox]');
  await waitFor(`document.querySelector('#viewer-image').naturalWidth > 0`);
  await screenshot('mobile-viewer.png');
  await key('Escape', 'Escape');
  await click('#theme-toggle');
  await navigate('/library/docs/API-DOCUMENTATION.html');
  await noOverflow('Mobile long reference');
  await screenshot('mobile-document.png');
  await send('Emulation.setDeviceMetricsOverride', { width: 320, height: 740, deviceScaleFactor: 1, mobile: true });
  await navigate('/library.html');
  await noOverflow('Narrow mobile library');
  await navigate('/gallery.html');
  await noOverflow('Narrow mobile gallery');
  report.push('390px and 320px layouts, mobile navigation, long tables/code and persisted theme work');
  assert.equal(exceptions.length, 0, JSON.stringify(exceptions));
  const external = [...requests].filter(url => !url.startsWith(base.origin) && !url.startsWith('data:'));
  assert.deepEqual(external, [], 'No remote page assets or API calls');
  report.push('Zero browser runtime exceptions; every page network request remained local');
  await writeFile(path.join(artifacts, 'results.json'), JSON.stringify({ base: base.href, report, requestCount: requests.size, exceptions, externalRequests: external }, null, 2));
  console.log(report.map(line => `PASS ${line}`).join('\n'));
  console.log(`Screenshots and results: ${artifacts}`);
} catch (error) {
  console.error(`Browser check failed: ${error.message}`);
  if (socket?.readyState === WebSocket.OPEN) {
    await screenshot('failure.png');
    const state = await evaluate(`({ url: location.href, active: document.activeElement?.outerHTML, main: document.querySelector('main')?.innerText.slice(0, 6000) })`);
    await writeFile(path.join(artifacts, 'failure.json'), JSON.stringify({ error: error.message, state, exceptions }, null, 2));
  }
  throw error;
} finally {
  if (socket?.readyState === WebSocket.OPEN) {
    await send('Browser.close').catch(error => console.error(`Browser cleanup: ${error.message}`));
    socket.close();
  }
  if (browser.exitCode === null && browser.signalCode === null) {
    const exited = once(browser, 'exit');
    browser.kill();
    await exited;
  }
  // On Windows Edge can relaunch and leave its crash handler outside the launcher
  // process tree. Select only this run's unique temporary profile, then stop by PID.
  if (process.platform === 'win32') {
    await promisify(execFile)('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      '$ErrorActionPreference = "Stop"; Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($env:PORTAL_DOCS_TEST_PROFILE) -and $_.Name -ne "powershell.exe" } | ForEach-Object { $p = Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue; if ($p) { Stop-Process -Id $p.Id -Force } }'
    ], { env: { ...process.env, PORTAL_DOCS_TEST_PROFILE: profile }, windowsHide: true });
  }
  await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
