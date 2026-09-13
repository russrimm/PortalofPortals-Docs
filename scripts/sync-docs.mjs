import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { constants } from 'node:fs';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import {
  classifyPath, exclusionReason, manifestRules, OUTSIDE_DOCS,
  shouldVisitDirectory, validPortablePath,
} from './scope.mjs';

const execute = promisify(execFile);
const REPOSITORY = 'russrimm/PortalofPortals';
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

export async function maybeLstat(filename) {
  try {
    return await fs.lstat(filename);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

export function isWithin(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!path.isAbsolute(relative)
    && relative !== '..' && !relative.startsWith(`..${path.sep}`));
}

function containedPath(root, relative) {
  if (!validPortablePath(relative)) throw new Error(`Unsafe relative path: ${relative}`);
  const filename = path.resolve(root, ...relative.split('/'));
  if (!isWithin(root, filename) || filename === root) {
    throw new Error(`Path escapes its root: ${relative}`);
  }
  return filename;
}

export async function assertNoSymlinkComponents(filename) {
  const absolute = path.resolve(filename);
  const { root } = path.parse(absolute);
  const parts = absolute.slice(root.length).split(path.sep).filter(Boolean);
  let current = root;
  for (let index = 0; index < parts.length; index += 1) {
    current = path.join(current, parts[index]);
    const stat = await maybeLstat(current);
    if (!stat) return;
    if (stat.isSymbolicLink()) throw new Error(`Symlink path is not allowed: ${current}`);
    if (index < parts.length - 1 && !stat.isDirectory()) {
      throw new Error(`Expected directory: ${current}`);
    }
  }
}

function isPlaceholder(value) {
  const token = value.replace(/^(?:gh[pousr]_|github_pat_|sk-proj-)/u, '');
  return /^(.)\1{7,}$/u.test(token)
    || /placeholder|redacted|example|replace[-_]?me|your[-_](?:token|secret|key)|not[-_]?a[-_]?real/iu.test(token);
}

const credentialPatterns = [
  ['private key', /-----BEGIN (?:[A-Z0-9]+ )?PRIVATE KEY-----\s*[A-Za-z0-9+/=\r\n]{64,}/gu],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{36,255}\b/gu],
  ['GitHub personal access token', /\bgithub_pat_[A-Za-z0-9_]{60,255}\b/gu],
  ['Azure DevOps personal access token', /\b[A-Za-z0-9]{75}AZDO[A-Za-z0-9]{5}\b/gu],
  ['Azure access signature', /(?:[?&]|&amp;)sig=([A-Za-z0-9+/%=_-]{32,})/gu],
  ['Azure connection-string key', /\b(?:AccountKey|SharedAccessKey)\s*=\s*([A-Za-z0-9+/]{40,}={0,2})/gu],
  ['AWS access key', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/gu],
  ['OpenAI API key', /\bsk-(?:proj-|svcacct-)[A-Za-z0-9_-]{48,}\b/gu],
  ['Slack token', /\bxox[baprs]-[A-Za-z0-9-]{24,}\b/gu],
];

export function assertNoCredentials(bytes, relativePath) {
  let text;
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    text = bytes.subarray(2).toString('utf16le');
  } else if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    if (bytes.length % 2 !== 0) throw new Error(`Invalid UTF-16 text: ${relativePath}`);
    text = Buffer.from(bytes.subarray(2)).swap16().toString('utf16le');
  } else {
    text = bytes.toString('utf8');
  }
  for (const [label, pattern] of credentialPatterns) {
    for (const match of text.matchAll(pattern)) {
      if (!isPlaceholder(match[1] ?? match[0])) {
        throw new Error(`Credential scan rejected ${relativePath}: possible ${label}`);
      }
    }
  }
  const assignments = /\b(?:[A-Z0-9_]*(?:CLIENT_SECRET|API_KEY)|clientSecret|apiKey|AZURE_DEVOPS_PAT|GITHUB_TOKEN|ACCESS_TOKEN)["']?\s*[:=]\s*["']?([A-Za-z0-9_~+./=-]{32,})/giu;
  for (const match of text.matchAll(assignments)) {
    const value = match[1];
    if (isPlaceholder(value) || /^(?:process\.env\.|env\.|https?:|[A-Z_]+$)/u.test(value)) continue;
    const categories = [/[a-z]/u, /[A-Z]/u, /[0-9]/u, /[_~+./=-]/u]
      .filter((pattern) => pattern.test(value)).length;
    if (categories >= 3) {
      throw new Error(`Credential scan rejected ${relativePath}: possible assigned secret`);
    }
  }
}

export async function readRegularFile(filename, label) {
  await assertNoSymlinkComponents(filename);
  const handle = await fs.open(filename, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    if (!(await handle.stat()).isFile()) throw new Error(`Not a regular file: ${label}`);
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}

export async function readSourceCommit(source) {
  const { stdout } = await execute('git', ['-C', source, 'rev-parse', '--verify', 'HEAD'], {
    windowsHide: true,
    env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
  });
  const commit = stdout.trim();
  if (!/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/u.test(commit)) {
    throw new Error('Source git HEAD is not a full commit hash');
  }
  return commit;
}

export async function collectSource(source) {
  const files = [];
  const excluded = [];
  const seen = new Set();
  const found = new Set();

  async function visit(relativeDirectory = '') {
    const directory = relativeDirectory ? containedPath(source, relativeDirectory) : source;
    await assertNoSymlinkComponents(directory);
    const entries = (await fs.readdir(directory, { withFileTypes: true }))
      .sort((a, b) => compare(a.name, b.name));
    for (const entry of entries) {
      const relative = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
      found.add(relative);
      if (entry.isSymbolicLink()) {
        excluded.push({ path: relative, reason: 'symlink' });
        continue;
      }
      const reason = exclusionReason(relative, entry.isDirectory());
      if (reason) {
        excluded.push({ path: relative, reason });
        continue;
      }
      if (entry.isDirectory()) {
        if (shouldVisitDirectory(relative)) await visit(relative);
        else excluded.push({ path: relative, reason: 'outside-documentation-scope' });
        continue;
      }
      if (!entry.isFile()) {
        excluded.push({ path: relative, reason: 'non-regular-file' });
        continue;
      }
      const kind = classifyPath(relative);
      if (!kind) {
        excluded.push({
          path: relative,
          reason: relative.startsWith('docs/') ? 'unsupported-documentation-file' : 'outside-documentation-allowlist',
        });
        continue;
      }
      const collisionKey = relative.toLowerCase();
      if (seen.has(collisionKey)) throw new Error(`Case-insensitive path collision: ${relative}`);
      seen.add(collisionKey);
      const bytes = await readRegularFile(containedPath(source, relative), relative);
      if (kind !== 'image') assertNoCredentials(bytes, relative);
      files.push({ path: relative, bytes: bytes.length, sha256: sha256(bytes), kind, content: bytes });
    }
  }

  await visit();
  for (const relative of OUTSIDE_DOCS) {
    if (!found.has(relative) && !excluded.some((entry) => relative.startsWith(`${entry.path}/`))) {
      excluded.push({ path: relative, reason: 'missing-allowlisted-file' });
    }
  }
  if (!files.some((file) => file.path === 'LICENSE')) {
    throw new Error('Source LICENSE must be an importable regular file');
  }
  files.sort((a, b) => compare(a.path, b.path));
  excluded.sort((a, b) => compare(a.path, b.path));
  return { files, excluded };
}

export function validateManifest(manifest) {
  if (!manifest || manifest.version !== 1 || manifest.source?.repository !== REPOSITORY
    || !Array.isArray(manifest.files)) {
    throw new Error('Invalid prior importer manifest');
  }
  const seen = new Set();
  for (const file of manifest.files) {
    if (!file || !validPortablePath(file.path) || classifyPath(file.path) !== file.kind
      || !['document', 'image', 'attachment', 'license'].includes(file.kind)
      || !Number.isSafeInteger(file.bytes) || file.bytes < 0
      || typeof file.sha256 !== 'string' || !/^[a-f0-9]{64}$/u.test(file.sha256)) {
      throw new Error('Invalid or out-of-scope file in prior importer manifest');
    }
    if (seen.has(file.path.toLowerCase())) throw new Error('Duplicate path in prior importer manifest');
    seen.add(file.path.toLowerCase());
  }
  return manifest;
}

async function loadManifest(destination) {
  const filename = path.join(destination, 'manifest.json');
  const stat = await maybeLstat(filename);
  if (!stat) return null;
  if (stat.nlink > 1) throw new Error('Hardlinked destination file is not allowed: manifest.json');
  const bytes = await readRegularFile(filename, 'manifest.json');
  return { manifest: validateManifest(JSON.parse(bytes.toString('utf8'))), hash: sha256(bytes) };
}

async function prepareOperation(root, relative, previous, next, force) {
  const filename = containedPath(root, relative);
  await assertNoSymlinkComponents(filename);
  const stat = await maybeLstat(filename);
  let current = null;
  if (stat) {
    if (!stat.isFile()) throw new Error(`Destination is not a regular file: ${relative}`);
    if (stat.nlink > 1) throw new Error(`Hardlinked destination file is not allowed: ${relative}`);
    current = await readRegularFile(filename, relative);
    const hash = sha256(current);
    if (previous && hash !== previous.sha256 && !force) {
      throw new Error(`Locally modified importer-owned file: ${relative}; use --force to replace or remove it`);
    }
    if (!previous && (!next || hash !== next.sha256)) {
      throw new Error(`Unowned destination file would be overwritten: ${relative}`);
    }
  }
  return { filename, relative, currentHash: current === null ? null : sha256(current), next };
}

async function assertUnchanged(operation) {
  await assertNoSymlinkComponents(operation.filename);
  const stat = await maybeLstat(operation.filename);
  if (stat?.nlink > 1) {
    throw new Error(`Hardlinked destination file is not allowed: ${operation.relative}`);
  }
  const hash = stat
    ? sha256(await readRegularFile(operation.filename, operation.relative)) : null;
  if (hash !== operation.currentHash) {
    throw new Error(`Destination changed during import: ${operation.relative}`);
  }
}

export async function syncDocs({ source, destination = path.resolve('snapshot'), force = false } = {}) {
  if (typeof source !== 'string' || !source.trim()) throw new Error('--source is required');
  const sourceRoot = path.resolve(source);
  const snapshotRoot = path.resolve(destination);
  const projectRoot = path.dirname(snapshotRoot);
  await assertNoSymlinkComponents(sourceRoot);
  await assertNoSymlinkComponents(snapshotRoot);
  if (!(await fs.stat(sourceRoot)).isDirectory()) throw new Error('Source must be a directory');
  if (isWithin(sourceRoot, snapshotRoot) || isWithin(projectRoot, sourceRoot)) {
    throw new Error('Source and destination project must not overlap');
  }
  const snapshotStat = await maybeLstat(snapshotRoot);
  if (snapshotStat && !snapshotStat.isDirectory()) throw new Error('Snapshot destination must be a directory');
  const previous = await loadManifest(snapshotRoot);
  if (previous?.manifest.screenshots
    || previous?.manifest.files.some(file => file.kind === 'image' && (file.status || file.sourceSha256))
    || await maybeLstat(path.join(snapshotRoot, 'screenshots-provenance.json'))) {
    throw new Error('Privacy-processed screenshots cannot be replaced by sync, including --force. Use npm run screenshots:import -- --input "<prepared-folder>" for reviewed, metadata-stripped images. Refresh other documentation only through a separately reviewed workflow.');
  }
  const docsStat = await maybeLstat(path.join(sourceRoot, 'docs'));
  if (!docsStat || (!docsStat.isDirectory() && !docsStat.isSymbolicLink())) {
    throw new Error('Source docs directory is required');
  }

  const commit = await readSourceCommit(sourceRoot);
  const { files, excluded } = await collectSource(sourceRoot);
  const oldFiles = new Map((previous?.manifest.files ?? []).map((file) => [file.path, file]));
  const newFiles = new Map(files.map((file) => [file.path, file]));
  const paths = [...new Set([...oldFiles.keys(), ...newFiles.keys()])].sort(compare);
  const portablePaths = new Set();
  for (const relative of paths) {
    if (portablePaths.has(relative.toLowerCase())) {
      throw new Error(`Case-only imported path change requires manual reconciliation: ${relative}`);
    }
    portablePaths.add(relative.toLowerCase());
  }
  const operations = [];
  for (const relative of paths) {
    operations.push(await prepareOperation(
      snapshotRoot, relative, oldFiles.get(relative), newFiles.get(relative), force,
    ));
  }
  operations.push(await prepareOperation(
    projectRoot, 'LICENSE', oldFiles.get('LICENSE'), newFiles.get('LICENSE'), force,
  ));

  const manifest = {
    version: 1,
    source: { repository: REPOSITORY, commit, importedAt: new Date().toISOString() },
    rules: manifestRules(),
    excluded,
    files: files.map(({ content, ...file }) => file),
    counts: {
      documents: files.filter((file) => file.kind === 'document').length,
      images: files.filter((file) => file.kind === 'image').length,
      attachments: files.filter((file) => file.kind === 'attachment').length,
      files: files.length,
    },
  };
  const manifestPath = path.join(snapshotRoot, 'manifest.json');
  const manifestBefore = previous?.hash ?? null;
  const manifestOperation = { filename: manifestPath, relative: 'manifest.json', currentHash: manifestBefore };
  await assertUnchanged(manifestOperation);
  for (const operation of operations) await assertUnchanged(operation);
  for (const operation of operations) {
    await assertUnchanged(operation);
    if (operation.next) {
      if (operation.currentHash === operation.next.sha256) continue;
      await fs.mkdir(path.dirname(operation.filename), { recursive: true });
      await assertNoSymlinkComponents(operation.filename);
      await fs.writeFile(operation.filename, operation.next.content, {
        flag: operation.currentHash === null ? 'wx' : 'w',
      });
    } else if (operation.currentHash !== null) {
      await fs.unlink(operation.filename);
    }
  }
  await assertUnchanged(manifestOperation);
  await fs.mkdir(snapshotRoot, { recursive: true });
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {
    flag: manifestBefore === null ? 'wx' : 'w',
  });
  return manifest;
}

export function parseArguments(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--force' && !options.force) options.force = true;
    else if (argument === '--help' || argument === '-h') options.help = true;
    else if (argument === '--source' && options.source === undefined
      && args[index + 1] && !args[index + 1].startsWith('--')) {
      options.source = args[++index];
    } else throw new Error(`Unknown, duplicate, or incomplete argument: ${argument}`);
  }
  if (!options.help && !options.source) throw new Error('--source is required');
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    console.log('Usage: npm run sync -- --source "C:\\path\\to\\PortalofPortals" [--force]');
    console.log('Imports to ./snapshot and preserves source LICENSE at ./LICENSE. No source writes.');
    console.log('--force replaces/removes modified manifest-owned files, never unowned files.');
    return;
  }
  const manifest = await syncDocs(options);
  console.log(`Imported ${manifest.counts.files} files: ${manifest.counts.documents} documents, ${manifest.counts.images} images, ${manifest.counts.attachments} attachments, 1 license.`);
  console.log(`Source commit: ${manifest.source.commit}`);
  console.log(`Excluded ${manifest.excluded.length} paths; details in snapshot/manifest.json.`);
  for (const entry of manifest.excluded.filter((entry) => [
    'unsupported-documentation-file', 'symlink', 'non-portable-path',
  ].includes(entry.reason))) {
    console.log(`Excluded ${entry.path}: ${entry.reason}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Documentation sync failed: ${error.message}`);
    process.exitCode = 1;
  });
}
