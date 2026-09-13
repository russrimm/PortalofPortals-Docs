import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {
  assertNoCredentials, isWithin, parseArguments, syncDocs,
} from '../scripts/sync-docs.mjs';
import {
  classifyPath, OUTSIDE_DOCS, REQUIRED_ATTACHMENTS, validPortablePath,
} from '../scripts/scope.mjs';

const COMMIT = '1234567890abcdef1234567890abcdef12345678';
const TOKEN = `ghp_${'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8'}`;
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const native = (root, relative) => path.join(root, ...relative.split('/'));

async function write(root, relative, bytes) {
  const filename = native(root, relative);
  await fs.mkdir(path.dirname(filename), { recursive: true });
  await fs.writeFile(filename, bytes);
}

async function exists(filename) {
  try {
    await fs.lstat(filename);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function tree(root) {
  if (!(await exists(root))) return [];
  const result = [];
  async function visit(directory, prefix = '') {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    for (const entry of entries) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      const filename = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) result.push([relative, 'symlink', await fs.readlink(filename)]);
      else if (entry.isDirectory()) {
        result.push([relative, 'directory']);
        await visit(filename, relative);
      } else {
        const stat = await fs.stat(filename);
        result.push([relative, hash(await fs.readFile(filename)), stat.size, stat.mtimeMs]);
      }
    }
  }
  await visit(root);
  return result;
}

async function fixture(t) {
  // Fixtures stay inside this checkout; no OS temporary directories or git commits are used.
  const root = await fs.mkdtemp(path.join(process.cwd(), '.sync-fixture-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const source = path.join(root, 'source');
  const output = path.join(root, 'output');
  const destination = path.join(output, 'snapshot');
  await fs.mkdir(path.join(source, '.git', 'objects'), { recursive: true });
  await fs.mkdir(path.join(source, '.git', 'refs'), { recursive: true });
  await write(source, '.git/HEAD', `${COMMIT}\n`);
  await write(source, 'LICENSE', Buffer.from('\ufeffFixture license\r\nCopyright fixture\r\n'));
  await write(source, 'README.md', '# Fixture documentation\r\n');
  await write(source, 'docs/guide.md', Buffer.from('\ufeff# Guide\r\nKeep original bytes.\r\n'));
  return { root, source, output, destination };
}

test('scope includes authored documentation and excludes instructions, hidden paths, and scripts', () => {
  for (const relative of [
    'docs/guide.md', 'docs/audits/audit.md', 'docs/code-review/review.md',
    'docs/ux/agent-analyzer-jtbd.md', 'docs/screenshots/README.md',
    'docs/infographic-prompts.md', ...OUTSIDE_DOCS.filter((file) => file !== 'LICENSE'),
  ]) assert.equal(classifyPath(relative), 'document', relative);
  for (const relative of REQUIRED_ATTACHMENTS) assert.equal(classifyPath(relative), 'attachment', relative);
  for (const relative of [
    'docs/.obsidian/plugins/example/main.js', 'docs/.obsidian/README.md',
    'docs/.nested/doc.md', 'docs/.env', 'docs/skills/SKILL.md',
    'docs/AGENTS.md', 'docs/CLAUDE.md', 'docs/GEMINI.md',
    'docs/agent-instructions.md', 'docs/task.prompt.md', 'docs/task.instructions.md',
    'docs/vendor/README.md', 'docs/node_modules/README.md',
    'docs/third-party/README.md', 'docs/prompts/developer.md',
    'docs/run.js', 'docs/run.ps1', 'docs/active.svg', 'docs/active.html',
    'docs/archive.zip', 'docs/unknown.exe', 'src/app/index.ts', 'OTHER.md',
  ]) assert.equal(classifyPath(relative), null, relative);
  assert.equal(classifyPath('LICENSE'), 'license');
  assert.equal(classifyPath('docs/screenshots/a.webp'), 'image');
  assert.equal(classifyPath('docs/screenshots/a.jpg'), 'image');
  assert.equal(classifyPath('docs/screenshots/a.PNG'), 'image');
  assert.equal(classifyPath('docs/extra.yml'), 'attachment');
});

test('portable paths and containment reject traversal and Windows aliases', () => {
  for (const relative of [
    '../README.md', 'docs/../README.md', '/docs/a.md', 'docs//a.md',
    'C:/docs/a.md', 'docs\\a.md', 'docs/a.md:secret', 'docs/a.md.',
    'docs/a.md ', 'docs/NUL.md', 'docs/COM1.md', 'docs/a?.md', 'docs/a\u0000.md',
  ]) assert.equal(validPortablePath(relative), false, relative);
  assert.equal(validPortablePath('docs/nested/a.md'), true);
  const root = path.resolve('scope-root');
  assert.equal(isWithin(root, root), true);
  assert.equal(isWithin(root, path.join(root, 'child')), true);
  assert.equal(isWithin(root, `${root}-other`), false);
  assert.equal(isWithin(root, path.dirname(root)), false);
});

test('CLI accepts only its explicit contract and requires a source', () => {
  assert.deepEqual(parseArguments(['--source', 'C:\\source', '--force']), { source: 'C:\\source', force: true });
  assert.deepEqual(parseArguments(['--help']), { help: true });
  for (const args of [
    [], ['--source'], ['--source', '--force'], ['--unknown'],
    ['--source', 'one', '--source', 'two'], ['--source', 'one', '--force', '--force'],
  ]) assert.throws(() => parseArguments(args));
});

test('imports exact bytes, hashes, kinds, license and nested paths without modifying source', async (t) => {
  const f = await fixture(t);
  const expected = new Map([
    ['docs/guide.md', await fs.readFile(native(f.source, 'docs/guide.md'))],
    ['LICENSE', await fs.readFile(native(f.source, 'LICENSE'))],
  ]);
  for (const relative of OUTSIDE_DOCS.filter((file) => file !== 'LICENSE')) {
    expected.set(relative, Buffer.from(`# ${relative}\r\n`));
  }
  for (const relative of [
    'docs/audits/review.md', 'docs/code-review/review.md', 'docs/ux/journey.md',
    'docs/screenshots/README.md', 'docs/infographic-prompts.md',
  ]) expected.set(relative, Buffer.from(`# ${relative}\n`));
  expected.set('docs/screenshots/image.webp', Buffer.from([0, 255, 1, 10, 13, 128, 57]));
  expected.set('docs/screenshots/image.jpg', Buffer.from([255, 216, 0, 255, 217]));
  for (const relative of REQUIRED_ATTACHMENTS) expected.set(relative, Buffer.from('fixture content\r\n'));
  for (const [relative, bytes] of expected) await write(f.source, relative, bytes);
  for (const relative of [
    'docs/.obsidian/plugins/third-party/main.js',
    'docs/.obsidian/plugins/third-party/styles.css', 'docs/.obsidian/workspace.json',
    'docs/.env', 'docs/skills/SKILL.md', 'docs/AGENTS.md',
    'docs/vendor/README.md', 'docs/run.js', 'docs/unknown.custom',
    'docs/active.svg', '.env', 'src/app/page.ts', 'scripts/run.mjs',
  ]) await write(f.source, relative, `Do not copy or scan excluded content: ${TOKEN}`);
  const before = await tree(f.source);
  const manifest = await syncDocs(f);
  assert.deepEqual(await tree(f.source), before);
  assert.equal(manifest.version, 1);
  assert.deepEqual(manifest.counts, { documents: 17, images: 2, attachments: 6, files: 26 });
  assert.equal(manifest.source.commit, COMMIT);
  assert.equal(manifest.source.repository, 'russrimm/PortalofPortals');
  assert.equal(new Date(manifest.source.importedAt).toISOString(), manifest.source.importedAt);
  assert.equal(JSON.stringify(manifest).includes(f.source), false);
  assert.equal(manifest.files.length, expected.size);
  assert.deepEqual(manifest, JSON.parse(await fs.readFile(path.join(f.destination, 'manifest.json'), 'utf8')));
  for (const entry of manifest.files) {
    const bytes = expected.get(entry.path);
    assert.ok(bytes, entry.path);
    assert.deepEqual(await fs.readFile(native(f.destination, entry.path)), bytes);
    assert.equal(entry.sha256, hash(bytes));
    assert.equal(entry.bytes, bytes.length);
    assert.equal(entry.kind, classifyPath(entry.path));
    assert.equal(entry.path.includes('\\'), false);
  }
  assert.deepEqual(await fs.readFile(path.join(f.output, 'LICENSE')), expected.get('LICENSE'));
  assert.ok(manifest.excluded.some((entry) => entry.path === 'docs/.obsidian' && entry.reason === 'hidden-directory'));
  assert.equal(manifest.excluded.some((entry) => entry.path.startsWith('docs/.obsidian/')), false);
  assert.ok(manifest.excluded.some((entry) => entry.path === 'docs/run.js' && entry.reason === 'unsupported-documentation-file'));
  assert.ok(manifest.excluded.some((entry) => entry.path === '.env'));
  for (const entry of manifest.excluded) assert.equal(await exists(native(f.destination, entry.path)), false, entry.path);
});

test('unchanged resync preserves imported file timestamps and source bytes', async (t) => {
  const f = await fixture(t);
  await syncDocs(f);
  const sourceBefore = await tree(f.source);
  const snapshotBefore = (await tree(f.destination)).filter(([relative]) => relative !== 'manifest.json');
  const manifest = await syncDocs(f);
  assert.deepEqual((await tree(f.destination)).filter(([relative]) => relative !== 'manifest.json'), snapshotBefore);
  assert.deepEqual(await tree(f.source), sourceBefore);
  assert.deepEqual(manifest.counts, { documents: 2, images: 0, attachments: 0, files: 3 });
});

test('resync removes only stale manifest-owned files, preserving unrelated files and directories', async (t) => {
  const f = await fixture(t);
  await write(f.source, 'docs/old/note.md', '# Obsolete\n');
  await syncDocs(f);
  await fs.unlink(native(f.source, 'docs/old/note.md'));
  await write(f.destination, 'docs/old/user.txt', 'User-owned bytes\n');
  await write(f.destination, 'not-imported.md', 'Keep me\n');
  const manifest = await syncDocs(f);
  assert.equal(await exists(native(f.destination, 'docs/old/note.md')), false);
  assert.equal(await fs.readFile(native(f.destination, 'docs/old/user.txt'), 'utf8'), 'User-owned bytes\n');
  assert.equal(await fs.readFile(native(f.destination, 'not-imported.md'), 'utf8'), 'Keep me\n');
  assert.equal(manifest.files.some((entry) => entry.path === 'not-imported.md'), false);
});

test('local edits fail before any destination changes; --force repairs owned files', async (t) => {
  const f = await fixture(t);
  await syncDocs(f);
  await write(f.destination, 'docs/guide.md', 'Local edit\n');
  await write(f.source, 'docs/aaa-new.md', '# New source doc\n');
  const before = await tree(f.output);
  await assert.rejects(syncDocs(f), /Locally modified importer-owned file: docs\/guide\.md.*--force/u);
  assert.deepEqual(await tree(f.output), before);
  await syncDocs({ ...f, force: true });
  assert.deepEqual(
    await fs.readFile(native(f.destination, 'docs/guide.md')),
    await fs.readFile(native(f.source, 'docs/guide.md')),
  );
  assert.equal(await exists(native(f.destination, 'docs/aaa-new.md')), true);
});

test('local edits to stale owned files require --force before removal', async (t) => {
  const f = await fixture(t);
  await write(f.source, 'docs/stale.md', '# Stale\n');
  await syncDocs(f);
  await write(f.destination, 'docs/stale.md', 'Local stale edit\n');
  await fs.unlink(native(f.source, 'docs/stale.md'));
  const before = await tree(f.output);
  await assert.rejects(syncDocs(f), /Locally modified.*docs\/stale\.md/u);
  assert.deepEqual(await tree(f.output), before);
  await syncDocs({ ...f, force: true });
  assert.equal(await exists(native(f.destination, 'docs/stale.md')), false);
});

test('root and snapshot LICENSE edits are protected and can be repaired with --force', async (t) => {
  const f = await fixture(t);
  await syncDocs(f);
  for (const root of [f.output, f.destination]) {
    await write(root, 'LICENSE', 'Locally edited license\n');
    const before = await tree(f.output);
    await assert.rejects(syncDocs(f), /Locally modified.*LICENSE/u);
    assert.deepEqual(await tree(f.output), before);
    await syncDocs({ ...f, force: true });
    assert.deepEqual(await fs.readFile(path.join(root, 'LICENSE')), await fs.readFile(path.join(f.source, 'LICENSE')));
  }
});

test('unowned collisions are never overwritten, even with --force', async (t) => {
  const f = await fixture(t);
  await write(f.destination, 'docs/guide.md', 'Unowned user file\n');
  const before = await tree(f.output);
  for (const force of [false, true]) {
    await assert.rejects(syncDocs({ ...f, force }), /Unowned destination file.*docs\/guide\.md/u);
    assert.deepEqual(await tree(f.output), before);
  }
});

test('an identical preexisting license can be safely adopted', async (t) => {
  const f = await fixture(t);
  await write(f.output, 'LICENSE', await fs.readFile(path.join(f.source, 'LICENSE')));
  await syncDocs(f);
  assert.deepEqual(await fs.readFile(path.join(f.output, 'LICENSE')), await fs.readFile(path.join(f.source, 'LICENSE')));
});

test('high-confidence credentials are rejected without exposing the secret', () => {
  const secrets = [
    TOKEN,
    `github_pat_${'A1bc2Def3_'.repeat(8)}`,
    `-----BEGIN PRIVATE KEY-----\n${'MIIBAb1CDEfghIJKLmnoPQRstuVWXyz0123456789+/'.repeat(3)}\n-----END PRIVATE KEY-----`,
    `https://example.invalid/blob?sv=2025-01-01&sig=${'Ab1Cd2Ef3Gh4Ij5Kl6Mn7Op8Qr9St0Uv1Wx2Yz3%2B%3D'}`,
    `AccountKey=${'Ab1Cd2Ef3Gh4Ij5Kl6Mn7Op8Qr9St0Uv1Wx2Yz3'.repeat(2)}=`,
    `${'Ab1Cd'.repeat(15)}AZDOabc12`,
    'AZURE_AD_CLIENT_SECRET=Ab1C~d2Ef3Gh4Ij5Kl6Mn7Op8Qr9St0Uv1Wx2Yz3',
    '{"clientSecret":"Ab1C~d2Ef3Gh4Ij5Kl6Mn7Op8Qr9St0Uv1Wx2Yz3"}',
  ];
  for (const secret of secrets) {
    assert.throws(() => assertNoCredentials(Buffer.from(secret), 'docs/secret.md'), (error) => {
      assert.match(error.message, /Credential scan rejected docs\/secret\.md/u);
      assert.equal(error.message.includes(secret), false);
      return true;
    });
  }
  const utf16 = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(TOKEN, 'utf16le')]);
  assert.throws(() => assertNoCredentials(utf16, 'docs/utf16.txt'), /Credential scan rejected/u);
});

test('documentation placeholders are not false positives', () => {
  const placeholders = [
    'GITHUB_TOKEN=<your-github-token>',
    'CLIENT_SECRET=${CLIENT_SECRET}',
    'AZURE_AD_CLIENT_SECRET="your-client-secret-here"',
    `ghp_${'x'.repeat(36)}`,
    `github_pat_${'YOUR_TOKEN_PLACEHOLDER_'.repeat(5)}`,
    '-----BEGIN PRIVATE KEY-----\n<redacted>\n-----END PRIVATE KEY-----',
    'https://example.invalid/blob?sv=2025-01-01&sig=<signature>',
    'AccountKey=YOUR_STORAGE_ACCOUNT_KEY_PLACEHOLDER',
    'CLIENT_SECRET=process.env.AZURE_AD_CLIENT_SECRET',
    'API_KEY=THIS_IS_A_DOCUMENTATION_PLACEHOLDER_VALUE',
  ];
  for (const value of placeholders) {
    assert.doesNotThrow(() => assertNoCredentials(Buffer.from(value), 'docs/guide.md'));
  }
});

test('a source credential aborts staging before creating any destination files', async (t) => {
  const f = await fixture(t);
  await write(f.source, 'docs/zzz-secret.md', `# Secret\n${TOKEN}\n`);
  const before = await tree(f.source);
  await assert.rejects(syncDocs(f), (error) => {
    assert.match(error.message, /docs\/zzz-secret\.md/u);
    assert.equal(error.message.includes(TOKEN), false);
    return true;
  });
  assert.equal(await exists(f.output), false);
  assert.deepEqual(await tree(f.source), before);
});

test('a credential in an attachment aborts resync without changing a prior snapshot', async (t) => {
  const f = await fixture(t);
  await syncDocs(f);
  await write(f.source, 'docs/zzz-secret.json', JSON.stringify({ token: TOKEN }));
  await write(f.source, 'docs/aaa-new.md', '# Do not write this yet\n');
  const before = await tree(f.output);
  await assert.rejects(syncDocs(f), /docs\/zzz-secret\.json/u);
  assert.deepEqual(await tree(f.output), before);
});

test('source and destination overlap is rejected without source writes', async (t) => {
  const f = await fixture(t);
  const before = await tree(f.source);
  for (const destination of [
    f.source, path.join(f.source, 'snapshot'), path.join(f.root, 'snapshot'),
  ]) await assert.rejects(syncDocs({ source: f.source, destination }), /must not overlap/u);
  await assert.rejects(syncDocs({ source: f.source, destination: path.dirname(f.source) }), /must not overlap/u);
  assert.deepEqual(await tree(f.source), before);
});

test('source directory symlinks are skipped and reported; source root symlinks are rejected', async (t) => {
  const f = await fixture(t);
  const external = path.join(f.root, 'external');
  await write(external, 'outside.md', `Not part of the source ${TOKEN}`);
  await fs.symlink(external, native(f.source, 'docs/linked'), process.platform === 'win32' ? 'junction' : 'dir');
  const manifest = await syncDocs(f);
  assert.ok(manifest.excluded.some((entry) => entry.path === 'docs/linked' && entry.reason === 'symlink'));
  assert.equal(await exists(native(f.destination, 'docs/linked')), false);
  const link = path.join(f.root, 'source-link');
  await fs.symlink(f.source, link, process.platform === 'win32' ? 'junction' : 'dir');
  await assert.rejects(syncDocs({ ...f, source: link }), /Symlink path is not allowed/u);
});

test('source file symlinks are skipped when supported by the host', async (t) => {
  const f = await fixture(t);
  const target = path.join(f.root, 'external.md');
  await fs.writeFile(target, `Must not read this ${TOKEN}`);
  try {
    await fs.symlink(target, native(f.source, 'docs/link.md'), 'file');
  } catch (error) {
    if (['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) {
      t.skip(`Host does not permit file symlinks (${error.code}); directory symlinks tested separately`);
      return;
    }
    throw error;
  }
  const manifest = await syncDocs(f);
  assert.ok(manifest.excluded.some((entry) => entry.path === 'docs/link.md' && entry.reason === 'symlink'));
  assert.equal(await exists(native(f.destination, 'docs/link.md')), false);
});

test('destination symlink ancestors are rejected without touching their targets', async (t) => {
  const f = await fixture(t);
  const external = path.join(f.root, 'external');
  await write(external, 'user.txt', 'Keep external content\n');
  await fs.mkdir(f.destination, { recursive: true });
  await fs.symlink(external, path.join(f.destination, 'docs'), process.platform === 'win32' ? 'junction' : 'dir');
  const before = await tree(external);
  await assert.rejects(syncDocs(f), /Symlink path is not allowed/u);
  assert.deepEqual(await tree(external), before);
  assert.equal(await exists(path.join(f.destination, 'LICENSE')), false);
  assert.equal(await exists(path.join(f.output, 'LICENSE')), false);
});

test('hardlinked destination files cannot cause writes through to the source', async (t) => {
  const f = await fixture(t);
  await syncDocs(f);
  await fs.unlink(native(f.destination, 'docs/guide.md'));
  await fs.link(native(f.source, 'docs/guide.md'), native(f.destination, 'docs/guide.md'));
  const before = await tree(f.source);
  for (const force of [false, true]) {
    await assert.rejects(syncDocs({ ...f, force }), /Hardlinked destination file.*docs\/guide\.md/u);
    assert.deepEqual(await tree(f.source), before);
  }
});

test('case-only renames fail before changes instead of colliding on Windows', async (t) => {
  const f = await fixture(t);
  await syncDocs(f);
  await fs.rename(native(f.source, 'docs/guide.md'), native(f.source, 'docs/GUIDE.md'));
  const before = await tree(f.output);
  await assert.rejects(syncDocs(f), /Case-only imported path change/u);
  assert.deepEqual(await tree(f.output), before);
});

test('a tampered prior manifest cannot claim out-of-scope or escaping files', async (t) => {
  const f = await fixture(t);
  const original = await syncDocs(f);
  await write(f.output, 'user.md', 'Never delete me\n');
  for (const maliciousPath of ['../user.md', 'docs/../../user.md', 'app.js', 'docs/.obsidian/workspace.json']) {
    const manifest = structuredClone(original);
    manifest.files.push({ path: maliciousPath, kind: 'document', bytes: 16, sha256: hash(Buffer.from('Never delete me\n')) });
    await write(f.destination, 'manifest.json', JSON.stringify(manifest));
    const before = await tree(f.output);
    await assert.rejects(syncDocs({ ...f, force: true }), /Invalid or out-of-scope/u);
    assert.deepEqual(await tree(f.output), before);
  }
});

test('malformed manifests and unavailable source commits fail instead of silently resetting ownership', async (t) => {
  const f = await fixture(t);
  const manifest = await syncDocs(f);
  await write(f.destination, 'manifest.json', '{not json');
  const before = await tree(f.output);
  await assert.rejects(syncDocs(f), SyntaxError);
  assert.deepEqual(await tree(f.output), before);
  await write(f.destination, 'manifest.json', JSON.stringify(manifest));
  const validBefore = await tree(f.output);
  await write(f.source, '.git/HEAD', 'ref: refs/heads/missing\n');
  await assert.rejects(syncDocs(f), /rev-parse/u);
  assert.deepEqual(await tree(f.output), validBefore);
});
