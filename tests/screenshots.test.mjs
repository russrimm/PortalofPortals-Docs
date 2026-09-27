import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { importScreenshots, parseArguments } from '../scripts/import-screenshots.mjs';
import { imageDimensions, normalizeScreenshotDocument, PROVENANCE, SCREENSHOT_DOCUMENTS, validateSnapshot } from '../scripts/screenshots.mjs';
import { prepareOutput, removeStaleOutput } from '../scripts/build-output.mjs';
import { sha256, syncDocs } from '../scripts/sync-docs.mjs';

const OLD = '5'.repeat(40);
const CURRENT = 'c'.repeat(40);
const webp = Buffer.from('UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAUAmJaQAA3AA/v02aAA=', 'base64');
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0, 11, 8, 0, 2, 0, 3, 1, 1, 0x11, 0, 0xff, 0xda, 0, 8, 1, 1, 0, 0, 63, 0, 0, 0xff, 0xd9]);
const native = (root, relative) => path.join(root, ...relative.split('/'));
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const execute = promisify(execFile);
async function write(root, relative, content) {
  const filename = native(root, relative);
  await fs.mkdir(path.dirname(filename), { recursive: true });
  await fs.writeFile(filename, content);
}
async function saveIndex(f) {
  await write(f.input, 'screenshot-import.json', JSON.stringify(f.index));
}
async function tree(root) {
  const result = [];
  for (const item of await fs.readdir(root, { withFileTypes: true })) {
    if (item.isDirectory()) result.push([item.name, await tree(path.join(root, item.name))]);
    else result.push([item.name, sha256(await fs.readFile(path.join(root, item.name)))]);
  }
  return result;
}
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(process.cwd(), '.screenshot-fixture-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const project = path.join(root, 'project');
  const destination = path.join(project, 'snapshot');
  const input = path.join(root, 'prepared');
  const original = new Map([
    ['README.md', Buffer.from('# Original overview\n')],
    ['docs/screenshots/README.md', Buffer.from('# Original captions\n')],
    ['docs/screenshots/TOUR.md', Buffer.from('# Original tour\n')],
    ['docs/screenshots/home.jpg', Buffer.from('original unprocessed fixture image')],
    ['LICENSE', Buffer.from('Fixture license\n')],
  ]);
  for (const [relative, bytes] of original) await write(destination, relative, bytes);
  const manifest = {
    version: 1, source: { repository: 'russrimm/PortalofPortals', commit: OLD, importedAt: '2026-01-01T00:00:00.000Z' },
    rules: {}, excluded: [], counts: { documents: 3, images: 1, attachments: 0, files: 5 },
    files: [...original].map(([relative, bytes]) => ({ path: relative, bytes: bytes.length, sha256: sha256(bytes), kind: relative === 'LICENSE' ? 'license' : relative.endsWith('.md') ? 'document' : 'image' })),
  };
  await write(destination, 'manifest.json', JSON.stringify(manifest));
  const index = {
    version: 1, source: { repository: 'russrimm/PortalofPortals', commit: CURRENT },
    processedAt: '2026-09-12T22:00:00.000Z',
    methodology: 'Reviewed GUID-shaped text; solid pixel masking and image metadata removal. Not a guarantee of absence of sensitive information.',
    files: [{
      path: 'docs/screenshots/home.webp', sourcePath: 'docs/screenshots/home.webp', sourceCommit: CURRENT,
      sourceSha256: 'd'.repeat(64), sha256: sha256(webp), bytes: webp.length,
      width: 1, height: 1, maskCount: 1, status: 'guid-masked', capture: 'current', aliases: ['docs/screenshots/home.jpg'],
    }],
    documents: ['docs/screenshots/README.md', 'docs/screenshots/TOUR.md'].map(relative => {
      const bytes = Buffer.from('# Current captions\n\n![Home](home.jpg)\n');
      return { path: relative, sha256: sha256(bytes), bytes: bytes.length };
    }),
  };
  await write(input, index.files[0].path, webp);
  for (const file of index.documents) await write(input, file.path, '# Current captions\n\n![Home](home.jpg)\n');
  const f = { root, project, destination, input, index, manifest, original };
  await saveIndex(f);
  return f;
}

test('screenshot CLI has an explicit input-only contract', () => {
  assert.deepEqual(parseArguments(['--input', 'C:\\prepared']), { input: 'C:\\prepared' });
  assert.deepEqual(parseArguments(['--help']), { help: true });
  for (const args of [[], ['--input'], ['--input', '--force'], ['--input', 'x', '--force'], ['--input', 'x', '--input', 'y']]) {
    assert.throws(() => parseArguments(args));
  }
});

test('import replaces images and preserves immutable original document provenance', async t => {
  const f = await fixture(t);
  assert.deepEqual(imageDimensions(webp, 'a.webp'), { width: 1, height: 1 });
  const before = await tree(f.input);
  const manifest = await importScreenshots(f);
  assert.deepEqual(await tree(f.input), before, 'Prepared input is never modified');
  assert.deepEqual(manifest.source, f.manifest.source);
  assert.deepEqual(manifest.files.find(file => file.path === 'README.md'), f.manifest.files[0]);
  assert.deepEqual(await fs.readFile(native(f.destination, 'README.md')), f.original.get('README.md'));
  await assert.rejects(fs.access(native(f.destination, 'docs/screenshots/home.jpg')), { code: 'ENOENT' });
  const image = manifest.files.find(file => file.kind === 'image');
  assert.equal(image.sha256, sha256(await fs.readFile(native(f.destination, image.path))));
  assert.notEqual(image.sha256, image.sourceSha256);
  assert.equal(manifest.files.find(file => file.path === 'docs/screenshots/TOUR.md').sourceCommit, CURRENT);
  const provenance = JSON.parse(await fs.readFile(native(f.destination, PROVENANCE)));
  for (const source of f.index.documents) {
    const published = await fs.readFile(native(f.destination, source.path));
    assert.equal(published.toString(), '# Current captions\n\n![Home](home.webp)\n');
    const document = manifest.files.find(file => file.path === source.path);
    assert.equal(document.sourceSha256, source.sha256);
    assert.equal(document.sha256, sha256(published));
    assert.notEqual(document.sha256, document.sourceSha256);
    assert.equal(provenance.documents.find(file => file.path === source.path).sourceSha256, source.sha256);
  }
  assert.equal(manifest.screenshots.counts.masked, 1);
  await validateSnapshot(f.destination, manifest, { exact: true });
  assert.deepEqual((await fs.readdir(f.project)).sort(), ['snapshot'], 'No raw backup or staging files remain');
  await importScreenshots(f);
  assert.deepEqual(JSON.parse(await fs.readFile(native(f.destination, PROVENANCE))), provenance);
  await assert.rejects(syncDocs({ source: f.input, destination: f.destination, force: true }), /Privacy-processed screenshots cannot be replaced/);
});

test('caption normalization only replaces indexed local JPG aliases and is idempotent', () => {
  const files = [{ path: 'docs/screenshots/home.webp', aliases: ['docs/screenshots/home.jpg'] }];
  const markdown = Buffer.from([
    '![Home](home.jpg)',
    '[View](./home.jpg?raw=true#preview "Home")',
    '![Home](<home.jpg>)',
    '![Legacy](legacy.jpg)',
    '![External](https://example.com/home.jpg)',
    '![Current](home.webp)',
  ].join('\n'));
  const expected = Buffer.from(markdown.toString()
    .replace('(home.jpg)', '(home.webp)')
    .replace('./home.jpg?', 'home.webp?')
    .replace('<home.jpg>', '<home.webp>'));
  const normalized = normalizeScreenshotDocument(markdown, SCREENSHOT_DOCUMENTS[1], files);
  assert.deepEqual(normalized, expected);
  assert.deepEqual(normalizeScreenshotDocument(normalized, SCREENSHOT_DOCUMENTS[1], files), expected);
});

test('already-normalized caption input retains its original upstream hash', async t => {
  const f = await fixture(t);
  for (const file of f.index.documents) {
    const bytes = normalizeScreenshotDocument(await fs.readFile(native(f.input, file.path)), file.path, f.index.files);
    file.sourceSha256 = file.sha256;
    file.sha256 = sha256(bytes);
    file.bytes = bytes.length;
    await write(f.input, file.path, bytes);
  }
  await saveIndex(f);
  const manifest = await importScreenshots(f);
  for (const file of f.index.documents) {
    assert.equal(manifest.files.find(item => item.path === file.path).sourceSha256, file.sourceSha256);
  }
  await validateSnapshot(f.destination, manifest, { exact: true });
});

test('committed tour and gallery image links resolve without the site alias resolver', async () => {
  const root = path.join(repositoryRoot, 'snapshot');
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'manifest.json')));
  const images = new Set(manifest.files.filter(file => file.kind === 'image').map(file => file.path));
  for (const document of SCREENSHOT_DOCUMENTS) {
    const markdown = await fs.readFile(native(root, document), 'utf8');
    const links = [...markdown.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)];
    assert.ok(links.length > 0, `${document} must retain its images`);
    for (const [, href] of links) {
      const relative = path.posix.join(path.posix.dirname(document), href);
      assert.ok(images.has(relative), `${document}: ${href} must be a real image, not an alias`);
      await fs.access(native(root, relative));
    }
  }
});

test('invalid prepared imports leave the entire snapshot unchanged', async t => {
  const cases = [
    ['traversal', f => { f.index.files[0].path = '../raw.webp'; }],
    ['backslashes', f => { f.index.files[0].path = 'docs\\screenshots\\home.webp'; }],
    ['source branch', f => { f.index.source.commit = 'main'; }],
    ['wrong current pin', f => { f.index.files[0].sourceCommit = OLD; }],
    ['bad original hash', f => { f.index.files[0].sourceSha256 = 'bad'; }],
    ['bad sanitized hash', f => { f.index.files[0].sha256 = 'e'.repeat(64); }],
    ['wrong bytes', f => { f.index.files[0].bytes++; }],
    ['wrong dimensions', f => { f.index.files[0].width = 2; }],
    ['missing dimensions', f => { delete f.index.files[0].height; }],
    ['invalid status/count', f => { f.index.files[0].maskCount = 0; }],
    ['duplicate path', f => { f.index.files.push(structuredClone(f.index.files[0])); }],
    ['alias collision', f => { f.index.files[0].aliases.push('docs/screenshots/home.jpg'); }],
    ['non-stem alias', f => { f.index.files[0].aliases = ['docs/screenshots/other.jpg']; }],
    ['omitted old path', f => { f.index.files[0].aliases = []; }],
    ['unindexed raw image', f => write(f.input, 'raw.jpg', 'unprocessed fixture')],
    ['raw OCR field', f => { f.index.files[0].ocrText = 'must not be recorded'; }],
    ['identifier in methodology', f => { f.index.methodology += ' 12345678-1234-1234-1234-123456789abc'; }],
    ['missing caption', f => { f.index.documents.pop(); }],
    ['invalid caption source hash', f => { f.index.documents[0].sourceSha256 = 'invalid'; }],
    ['invalid timestamp', f => { f.index.processedAt = 'yesterday'; }],
  ];
  for (const [name, mutate] of cases) await t.test(name, async st => {
    const f = await fixture(st);
    const before = await tree(f.project);
    await mutate(f);
    await saveIndex(f);
    await assert.rejects(importScreenshots(f));
    assert.deepEqual(await tree(f.project), before);
  });
});

test('legacy JPG uses original source provenance and no-guid review remains distinct from masking', async t => {
    const f = await fixture(t);
    const relative = 'docs/screenshots/legacy.jpg';
    const original = Buffer.from('original legacy fixture bytes');
    await write(f.destination, relative, original);
    f.manifest.files.push({ path: relative, bytes: original.length, sha256: sha256(original), kind: 'image' });
    f.manifest.counts.images++;
    f.manifest.counts.files++;
    await write(f.destination, 'manifest.json', JSON.stringify(f.manifest));
    f.index.files.push({
      path: relative, sourcePath: relative, sourceCommit: OLD,
      sourceSha256: sha256(original), sha256: sha256(jpeg), bytes: jpeg.length, width: 3, height: 2,
      maskCount: 0, status: 'reviewed-no-guid', capture: 'legacy', aliases: [],
    });
    await write(f.input, relative, jpeg);
    await saveIndex(f);
    const manifest = await importScreenshots(f);
    assert.deepEqual(manifest.screenshots.counts, { current: 1, legacy: 1, masked: 1, reviewedNoGuid: 1, masks: 1 });
    const legacy = manifest.files.find(file => file.path === relative);
    assert.equal(legacy.sourceCommit, OLD);
    assert.equal(legacy.sourceSha256, sha256(original));
    assert.notEqual(legacy.sha256, legacy.sourceSha256);
    await validateSnapshot(f.destination, manifest);
    f.index.files[1].sourceSha256 = 'a'.repeat(64);
    await saveIndex(f);
    const before = await tree(f.project);
    await assert.rejects(importScreenshots(f), /Legacy source provenance/);
    assert.deepEqual(await tree(f.project), before);
});

async function retirementFixture(t) {
  const f = await fixture(t);
  const relative = 'docs/screenshots/removed-page.webp';
  const original = Buffer.from('previously published page that no longer exists upstream');
  await write(f.destination, relative, original);
  f.manifest.files.push({ path: relative, bytes: original.length, sha256: sha256(original), kind: 'image' });
  f.manifest.counts.images++;
  f.manifest.counts.files++;
  await write(f.destination, 'manifest.json', JSON.stringify(f.manifest));
  f.retiredPath = relative;
  return f;
}

test('an existing current screenshot is removed only through an explicit retirement', async t => {
  const f = await retirementFixture(t);
  for (const relative of ['docs/application-walkthrough.md', 'docs/README.md', 'docs/admin-guide.md']) {
    const bytes = Buffer.from('# Guide\n');
    await write(f.destination, relative, bytes);
    f.manifest.files.push({ path: relative, bytes: bytes.length, sha256: sha256(bytes), kind: 'document' });
    f.manifest.counts.documents++;
    f.manifest.counts.files++;
  }
  await write(f.destination, 'manifest.json', JSON.stringify(f.manifest));
  for (const name of ['dashboard.webp', 'users--user-details.webp', 'azure-daily-costs.webp']) {
    const relative = `docs/screenshots/${name}`;
    f.index.files.push({ ...f.index.files[0], path: relative, sourcePath: relative, aliases: [] });
    await write(f.input, relative, webp);
  }
  await saveIndex(f);
  const before = await tree(f.project);
  await assert.rejects(importScreenshots(f), /without a replacement or retirement/);
  assert.deepEqual(await tree(f.project), before);
  f.index.retired = [{ path: f.retiredPath, reason: 'page-removed-upstream' }];
  await saveIndex(f);
  const manifest = await importScreenshots(f);
  assert.ok(!manifest.files.some(file => file.path === f.retiredPath));
  await assert.rejects(fs.access(native(f.destination, f.retiredPath)), { code: 'ENOENT' });
  const provenance = JSON.parse(await fs.readFile(native(f.destination, PROVENANCE)));
  assert.deepEqual(provenance.retired, f.index.retired);
  await validateSnapshot(f.destination, manifest, { exact: true });
  const stale = structuredClone(manifest);
  stale.files.push({ ...manifest.files.find(file => file.kind === 'image'), path: f.retiredPath, sourcePath: f.retiredPath, aliases: [] });
  await assert.rejects(validateSnapshot(f.destination, stale), /cover every image|Retired screenshot remains/);
  for (const name of ['build.mjs', 'build-output.mjs', 'content.mjs', 'scope.mjs', 'screenshots.mjs', 'sync-docs.mjs']) {
    await write(f.project, `scripts/${name}`, await fs.readFile(path.join(repositoryRoot, 'scripts', name)));
  }
  await fs.cp(path.join(repositoryRoot, 'site'), path.join(f.project, 'site'), { recursive: true });
  await execute(process.execPath, [path.join(f.project, 'scripts', 'build.mjs')], { cwd: f.project, windowsHide: true });
  const gallery = JSON.parse(await fs.readFile(path.join(f.project, 'dist', 'gallery-index.json')));
  assert.ok(!gallery.some(file => file.path === f.retiredPath));
  assert.match(await fs.readFile(path.join(f.project, 'dist', 'about.html'), 'utf8'), /1 retired because their pages were removed upstream/);
});

test('invalid screenshot retirements leave the entire snapshot unchanged', async t => {
  const retire = (f, entry) => { f.index.retired = [{ path: f.retiredPath, reason: 'page-removed-upstream', ...entry }]; };
  const cases = [
    ['empty list', f => { f.index.retired = []; }, /non-empty list/],
    ['not a list', f => { f.index.retired = f.retiredPath; }, /non-empty list/],
    ['unknown reason', f => retire(f, { reason: 'looked-stale' }), /Invalid retired screenshot/],
    ['extra field', f => retire(f, { route: '/removed-page' }), /Invalid retired screenshot fields/],
    ['traversal', f => retire(f, { path: '../removed-page.webp' }), /Invalid retired screenshot/],
    ['legacy JPG', f => retire(f, { path: 'docs/screenshots/home.jpg' }), /Invalid retired screenshot/],
    ['not in snapshot', f => retire(f, { path: 'docs/screenshots/never-published.webp' }), /not a current image in the existing snapshot/],
    ['also replaced', f => retire(f, { path: 'docs/screenshots/home.webp' }), /Duplicate screenshot path/],
    ['duplicate', f => { retire(f); f.index.retired.push(structuredClone(f.index.retired[0])); }, /Duplicate screenshot path/],
    ['linked by caption', async f => {
      retire(f);
      const bytes = Buffer.from('# Current captions\n\n![Removed](./removed-page.webp?raw=true)\n');
      for (const document of f.index.documents) {
        document.sha256 = sha256(bytes);
        document.bytes = bytes.length;
        await write(f.input, document.path, bytes);
      }
    }, /links a retired screenshot/],
  ];
  for (const [name, mutate, expected] of cases) await t.test(name, async st => {
    const f = await retirementFixture(st);
    const before = await tree(f.project);
    await mutate(f);
    await saveIndex(f);
    await assert.rejects(importScreenshots(f), expected);
    assert.deepEqual(await tree(f.project), before);
  });
});

test('input overlap, hardlinks and directory symlinks are rejected without mutation', async t => {
  const f = await fixture(t);
  const before = await tree(f.project);
  await assert.rejects(importScreenshots({ input: f.project, destination: f.destination }), /overlap/);
  await assert.rejects(importScreenshots({ input: f.destination, destination: f.destination }), /overlap/);
  const image = native(f.input, f.index.files[0].path);
  const linked = path.join(f.root, 'linked.webp');
  await fs.link(image, linked);
  await assert.rejects(importScreenshots(f), /Hardlinked/);
  await fs.unlink(linked);
  const junction = path.join(f.root, 'prepared-link');
  await fs.symlink(f.input, junction, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(importScreenshots({ input: junction, destination: f.destination }), /Symlink/);
  assert.deepEqual(await tree(f.project), before);
});

test('build validation fails closed on broken provenance and incomplete image coverage', async t => {
  const f = await fixture(t);
  const manifest = await importScreenshots(f);
  const broken = structuredClone(manifest);
  broken.files.find(file => file.kind === 'image').sourceSha256 = 'e'.repeat(64);
  await assert.rejects(validateSnapshot(f.destination, broken), /manifest\/provenance mismatch/);
  const count = structuredClone(manifest);
  count.screenshots.counts.current++;
  await assert.rejects(validateSnapshot(f.destination, count), /counts mismatch/);
  const stripped = structuredClone(manifest);
  delete stripped.screenshots;
  await assert.rejects(validateSnapshot(f.destination, stripped), /privacy provenance is missing/);
  const incomplete = structuredClone(manifest);
  incomplete.files = incomplete.files.filter(file => file.kind !== 'image');
  await assert.rejects(validateSnapshot(f.destination, incomplete), /cover every image/);
  await write(f.destination, 'docs/screenshots/untracked.jpg', 'raw fixture');
  await assert.rejects(validateSnapshot(f.destination, manifest), /Unowned snapshot file/);
  await fs.unlink(native(f.destination, 'docs/screenshots/untracked.jpg'));
  await write(f.destination, 'docs/hidden-original.png', 'raw fixture');
  await assert.rejects(validateSnapshot(f.destination, manifest), /Unowned snapshot file/);
  await fs.unlink(native(f.destination, 'docs/hidden-original.png'));
  const provenance = native(f.destination, PROVENANCE);
  await fs.appendFile(provenance, '\n');
  await assert.rejects(validateSnapshot(f.destination, manifest), /provenance hash mismatch/);
});

test('processed sync guard rejects even an orphaned provenance marker', async t => {
  const f = await fixture(t);
  await write(f.destination, PROVENANCE, '{}');
  await assert.rejects(syncDocs({ source: f.input, destination: f.destination, force: true }), /Privacy-processed/);
});

test('encoded metadata is rejected and dimensions/status must be meaningful', () => {
  const chunk = Buffer.concat([Buffer.from('EXIF'), Buffer.from([2, 0, 0, 0]), Buffer.from('xx')]);
  const metadata = Buffer.concat([webp, chunk]);
  metadata.writeUInt32LE(metadata.length - 8, 4);
  assert.throws(() => imageDimensions(metadata, 'x.webp'), /metadata-bearing/);
  assert.throws(() => imageDimensions(webp.subarray(0, 10), 'x.webp'), /encoding/);
  assert.deepEqual(imageDimensions(jpeg, 'x.jpg'), { width: 3, height: 2 });
  const exif = Buffer.concat([jpeg.subarray(0, 2), Buffer.from([0xff, 0xe1, 0, 4, 0, 0]), jpeg.subarray(2)]);
  assert.throws(() => imageDimensions(exif, 'x.jpg'), /metadata-bearing/);
});

test('stale output cleanup removes only generator-owned copies and protects unrelated files', async t => {
  const f = await fixture(t);
  const output = path.join(f.project, 'dist');
  await write(output, 'source/manifest.json', JSON.stringify(f.manifest));
  await write(output, 'source/docs/screenshots/home.jpg', 'old raw fixture');
  await write(output, 'my-notes.txt', 'keep');
  const manifest = await importScreenshots(f);
  const stale = await prepareOutput(output, manifest);
  assert.deepEqual(stale, ['source/docs/screenshots/home.jpg']);
  await removeStaleOutput(output, stale);
  assert.equal(await fs.readFile(path.join(output, 'my-notes.txt'), 'utf8'), 'keep');
  await assert.rejects(fs.access(native(output, 'source/docs/screenshots/home.jpg')), { code: 'ENOENT' });
  await write(output, 'source/docs/screenshots/unknown.jpg', 'unowned fixture');
  await assert.rejects(prepareOutput(output, manifest), /Unowned screenshot/);
  await fs.unlink(native(output, 'source/docs/screenshots/unknown.jpg'));
  await write(output, 'duplicate-raw.png', 'unowned fixture');
  await assert.rejects(prepareOutput(output, manifest), /Unowned screenshot/);
});

test('processed fixture builds with current captions, aliased links, truthful provenance and no stale JPG', async t => {
  const f = await fixture(t);
  for (const relative of ['docs/application-walkthrough.md', 'docs/README.md', 'docs/admin-guide.md']) {
    const bytes = Buffer.from('# Guide\n\n![Home](screenshots/home.jpg)\n');
    await write(f.destination, relative, bytes);
    f.manifest.files.push({ path: relative, bytes: bytes.length, sha256: sha256(bytes), kind: 'document' });
    f.manifest.counts.documents++;
    f.manifest.counts.files++;
  }
  await write(f.destination, 'manifest.json', JSON.stringify(f.manifest));
  for (const name of ['dashboard.webp', 'users--user-details.webp', 'azure-daily-costs.webp']) {
    const relative = `docs/screenshots/${name}`;
    f.index.files.push({ ...f.index.files[0], path: relative, sourcePath: relative, aliases: [] });
    await write(f.input, relative, webp);
  }
  await saveIndex(f);
  const output = path.join(f.project, 'dist');
  await write(output, 'source/manifest.json', JSON.stringify(f.manifest));
  await write(output, 'source/docs/screenshots/home.jpg', 'old raw fixture');
  await write(output, 'my-notes.txt', 'keep');
  await importScreenshots(f);
  for (const name of ['build.mjs', 'build-output.mjs', 'content.mjs', 'scope.mjs', 'screenshots.mjs', 'sync-docs.mjs']) {
    await write(f.project, `scripts/${name}`, await fs.readFile(path.join(repositoryRoot, 'scripts', name)));
  }
  await fs.cp(path.join(repositoryRoot, 'site'), path.join(f.project, 'site'), { recursive: true });
  await execute(process.execPath, [path.join(f.project, 'scripts', 'build.mjs')], { cwd: f.project, windowsHide: true });
  const gallery = JSON.parse(await fs.readFile(path.join(output, 'gallery-index.json')));
  assert.equal(gallery.length, 4);
  assert.ok(gallery.every(file => file.sourceCommit === CURRENT && file.capture === 'current'));
  assert.equal(await fs.readFile(path.join(output, 'my-notes.txt'), 'utf8'), 'keep');
  await assert.rejects(fs.access(native(output, 'source/docs/screenshots/home.jpg')), { code: 'ENOENT' });
  const tour = await fs.readFile(native(output, 'library/docs/screenshots/TOUR.html'), 'utf8');
  assert.match(tour, /src="\/source\/docs\/screenshots\/home.webp"/);
  assert.ok(tour.includes(`/blob/${CURRENT}/docs/screenshots/TOUR.md`));
  const overview = await fs.readFile(native(output, 'library/README.html'), 'utf8');
  assert.ok(overview.includes(`/blob/${OLD}/README.md`));
  const about = await fs.readFile(path.join(output, 'about.html'), 'utf8');
  assert.match(about, /4 current-upstream WEBP, 0 retained legacy JPG/);
  assert.match(about, /4 images with privacy masks/);
  assert.match(about, /Mask counts include all opaque privacy regions, not only GUIDs/);
  assert.match(about, /does not establish that all personal or sensitive information is absent/);
  assert.match(about, /history and other content require a separate publication review/);
  const before = await tree(output);
  const missing = Buffer.from('# Caption\n\n[Missing](absent.webp)\n');
  const document = f.index.documents[0];
  document.sha256 = sha256(missing);
  document.bytes = missing.length;
  await write(f.input, document.path, missing);
  await saveIndex(f);
  await importScreenshots(f);
  await assert.rejects(execute(process.execPath, [path.join(f.project, 'scripts', 'build.mjs')], { cwd: f.project, windowsHide: true }), /unresolved local screenshot references/);
  assert.deepEqual(await tree(output), before, 'Broken references fail before modifying the previous build');
});
