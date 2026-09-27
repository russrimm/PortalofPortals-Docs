import * as fs from 'node:fs/promises';
import path from 'node:path';
import { IMAGE_EXTENSIONS, validPortablePath } from './scope.mjs';
import { assertNoCredentials, assertNoSymlinkComponents, maybeLstat, readRegularFile, sha256, validateManifest } from './sync-docs.mjs';

export const PROVENANCE = 'screenshots-provenance.json';
export const SCREENSHOT_DOCUMENTS = ['docs/screenshots/README.md', 'docs/screenshots/TOUR.md'];
export const RETIREMENT_REASONS = ['page-removed-upstream'];
const REPOSITORY = 'russrimm/PortalofPortals';
const INDEX_KEYS = ['version', 'source', 'processedAt', 'methodology', 'files', 'documents'];
const digest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const commit = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const integer = (value, minimum, maximum) => Number.isSafeInteger(value) && value >= minimum && value <= maximum;
const imagePath = value => validPortablePath(value) && /^docs\/screenshots\/[^/]+\.(?:webp|jpg)$/.test(value);
const guid = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;

function exactKeys(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some(key => !keys.includes(key))
    || keys.some(key => !Object.hasOwn(value, key))) throw new Error(`Invalid ${label} fields`);
}

export function validateScreenshotIndex(index) {
  const retiring = Boolean(index) && typeof index === 'object' && Object.hasOwn(index, 'retired');
  exactKeys(index, retiring ? [...INDEX_KEYS, 'retired'] : INDEX_KEYS, 'screenshot index');
  exactKeys(index.source, ['repository', 'commit'], 'screenshot source');
  if (index.version !== 1 || index.source.repository !== REPOSITORY || !commit(index.source.commit)
    || typeof index.processedAt !== 'string'
    || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)$/.test(index.processedAt)
    || !Number.isFinite(Date.parse(index.processedAt))
    || typeof index.methodology !== 'string' || index.methodology.trim().length < 20
    || index.methodology.length > 2000 || guid.test(index.methodology)
    || /[\u0000-\u001f\u007f]/.test(index.methodology)
    || !Array.isArray(index.files) || !index.files.length || !Array.isArray(index.documents)) {
    throw new Error('Invalid screenshot provenance, immutable source commit, timestamp, or methodology');
  }
  assertNoCredentials(Buffer.from(index.methodology), 'screenshot methodology');
  const paths = new Set();
  const reserve = relative => {
    const key = relative.toLowerCase();
    if (paths.has(key)) throw new Error(`Duplicate screenshot path or alias: ${relative}`);
    paths.add(key);
  };
  for (const file of index.files) {
    exactKeys(file, ['path', 'sourcePath', 'sourceCommit', 'sourceSha256', 'sha256', 'bytes', 'width', 'height', 'maskCount', 'status', 'capture', 'aliases'], 'screenshot file');
    if (!imagePath(file.path) || file.sourcePath !== file.path
      || !commit(file.sourceCommit) || !digest(file.sourceSha256) || !digest(file.sha256)
      || !integer(file.bytes, 1, 1024 * 1024 * 1024)
      || !integer(file.width, 1, 65535) || !integer(file.height, 1, 65535)
      || file.width * file.height > 1_000_000_000
      || !integer(file.maskCount, 0, 1_000_000)
      || !['guid-masked', 'reviewed-no-guid'].includes(file.status)
      || (file.status === 'guid-masked') !== (file.maskCount > 0)
      || !['current', 'legacy'].includes(file.capture) || !Array.isArray(file.aliases)
      || (file.capture === 'current' && (!file.path.endsWith('.webp') || file.sourceCommit !== index.source.commit))
      || (file.capture === 'legacy' && (!file.path.endsWith('.jpg') || file.sourceCommit === index.source.commit))) {
      throw new Error(`Invalid screenshot metadata: ${file.path}`);
    }
    reserve(file.path);
    for (const alias of file.aliases) {
      if (!imagePath(alias) || !file.path.endsWith('.webp') || alias !== file.path.replace(/\.webp$/, '.jpg')) {
        throw new Error(`Invalid same-stem JPG alias: ${alias}`);
      }
      reserve(alias);
    }
  }
  if (!index.files.some(file => file.capture === 'current')) throw new Error('A current screenshot set is required');
  if (index.documents.length !== SCREENSHOT_DOCUMENTS.length) throw new Error('Both screenshot caption documents are required');
  for (const file of index.documents) {
    exactKeys(file, ['path', 'sha256', 'bytes', ...(Object.hasOwn(file, 'sourceSha256') ? ['sourceSha256'] : [])], 'screenshot document');
    if (!SCREENSHOT_DOCUMENTS.includes(file.path) || !digest(file.sha256)
      || (Object.hasOwn(file, 'sourceSha256') && !digest(file.sourceSha256))
      || !integer(file.bytes, 1, 16 * 1024 * 1024)) throw new Error('Invalid screenshot caption document');
    reserve(file.path);
  }
  if (retiring) {
    if (!Array.isArray(index.retired) || !index.retired.length) throw new Error('Retired screenshots must be a non-empty list when present');
    for (const file of index.retired) {
      exactKeys(file, ['path', 'reason'], 'retired screenshot');
      // Only current-set WEBPs can be retired; legacy JPGs keep their own retention rules.
      if (!imagePath(file.path) || !file.path.endsWith('.webp') || !RETIREMENT_REASONS.includes(file.reason)) {
        throw new Error(`Invalid retired screenshot: ${file.path}`);
      }
      reserve(file.path);
    }
  }
  return index;
}

// Local image targets linked from a caption document, resolved relative to docs/screenshots.
export function referencedScreenshots(bytes, documentPath) {
  const directory = path.posix.dirname(documentPath);
  const targets = new Set();
  for (const [, href] of bytes.toString('utf8').matchAll(/\]\(\s*<?([^)\s>]+)/g)) {
    if (/^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(href)) continue;
    targets.add(path.posix.join(directory, href.replace(/[?#].*$/, '')));
  }
  return targets;
}

export function normalizeScreenshotDocument(bytes, documentPath, files) {
  const aliases = new Map(files.flatMap(file => file.aliases.map(alias => [alias, file.path])));
  const directory = path.posix.dirname(documentPath);
  const markdown = bytes.toString('utf8').replace(/(\]\(\s*<?)([^)\s>]+)/g, (match, prefix, href) => {
    if (/^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(href)) return match;
    const [, target, suffix] = href.match(/^([^?#]*)(.*)$/);
    const replacement = aliases.get(path.posix.join(directory, target));
    return replacement ? `${prefix}${path.posix.relative(directory, replacement)}${suffix}` : match;
  });
  return Buffer.from(markdown);
}

export function screenshotCounts(index) {
  return {
    current: index.files.filter(file => file.capture === 'current').length,
    legacy: index.files.filter(file => file.capture === 'legacy').length,
    masked: index.files.filter(file => file.status === 'guid-masked').length,
    reviewedNoGuid: index.files.filter(file => file.status === 'reviewed-no-guid').length,
    masks: index.files.reduce((sum, file) => sum + file.maskCount, 0),
  };
}

// Validate encoded dimensions and reject metadata containers; pixel review remains an explicit external step.
export function imageDimensions(bytes, relative) {
  const invalid = () => { throw new Error(`Invalid or metadata-bearing screenshot encoding: ${relative}`); };
  if (relative.endsWith('.webp')) {
    if (bytes.length < 20 || bytes.toString('ascii', 0, 4) !== 'RIFF'
      || bytes.toString('ascii', 8, 12) !== 'WEBP' || bytes.readUInt32LE(4) !== bytes.length - 8) invalid();
    let dimensions;
    let frames = 0;
    let extended = false;
    for (let offset = 12; offset < bytes.length;) {
      if (offset + 8 > bytes.length) invalid();
      const type = bytes.toString('ascii', offset, offset + 4);
      const size = bytes.readUInt32LE(offset + 4);
      const start = offset + 8;
      if (start + size + (size & 1) > bytes.length || !['VP8 ', 'VP8L', 'VP8X', 'ALPH'].includes(type)) invalid();
      if (type === 'VP8X') {
        if (extended || frames || size !== 10 || (bytes[start] & ~0x10) !== 0
          || bytes.readUIntLE(start + 1, 3) !== 0) invalid();
        extended = true;
        dimensions = { width: bytes.readUIntLE(start + 4, 3) + 1, height: bytes.readUIntLE(start + 7, 3) + 1 };
      } else if (type === 'VP8 ') {
        if (++frames !== 1 || size < 10 || (bytes[start] & 1) !== 0
          || bytes.toString('hex', start + 3, start + 6) !== '9d012a') invalid();
        const frame = { width: bytes.readUInt16LE(start + 6) & 0x3fff, height: bytes.readUInt16LE(start + 8) & 0x3fff };
        if (dimensions && (dimensions.width !== frame.width || dimensions.height !== frame.height)) invalid();
        dimensions = frame;
      } else if (type === 'VP8L') {
        if (++frames !== 1 || size < 5 || bytes[start] !== 0x2f) invalid();
        const bits = bytes.readUInt32LE(start + 1);
        if (bits >>> 29) invalid();
        const frame = { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
        if (dimensions && (dimensions.width !== frame.width || dimensions.height !== frame.height)) invalid();
        dimensions = frame;
      }
      offset = start + size + (size & 1);
    }
    if (frames !== 1 || !dimensions || !dimensions.width || !dimensions.height) invalid();
    return dimensions;
  }
  if (!relative.endsWith('.jpg') || bytes.length < 4 || bytes.readUInt16BE(0) !== 0xffd8) invalid();
  let dimensions;
  let offset = 2;
  let ended = false;
  while (offset < bytes.length) {
    if (bytes[offset++] !== 0xff) invalid();
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === 0xd9) { ended = true; break; }
    if (marker === 0xfe || (marker >= 0xe1 && marker <= 0xef)) invalid();
    if (offset + 2 > bytes.length) invalid();
    const size = bytes.readUInt16BE(offset);
    if (size < 2 || offset + size > bytes.length) invalid();
    if (marker === 0xe0 && (size !== 16 || bytes.toString('ascii', offset + 2, offset + 7) !== 'JFIF\0'
      || bytes[offset + 14] !== 0 || bytes[offset + 15] !== 0)) invalid();
    if ([0xc0, 0xc1, 0xc2].includes(marker)) {
      if (size < 8) invalid();
      dimensions = { height: bytes.readUInt16BE(offset + 3), width: bytes.readUInt16BE(offset + 5) };
    }
    offset += size;
    if (marker === 0xda) {
      while (offset < bytes.length) {
        if (bytes[offset] !== 0xff) { offset++; continue; }
        const next = bytes[offset + 1];
        if (next === 0 || (next >= 0xd0 && next <= 0xd7)) { offset += 2; continue; }
        break;
      }
    }
  }
  if (!ended || offset !== bytes.length || !dimensions?.width || !dimensions.height) invalid();
  return dimensions;
}

export async function readCheckedFile(root, file, { image = false } = {}) {
  if (!validPortablePath(file.path)) throw new Error(`Unsafe relative path: ${file.path}`);
  const filename = path.join(root, ...file.path.split('/'));
  const stat = await maybeLstat(filename);
  if (stat?.nlink > 1) throw new Error(`Hardlinked file is not allowed: ${file.path}`);
  const bytes = await readRegularFile(filename, file.path);
  if (bytes.length !== file.bytes || sha256(bytes) !== file.sha256) throw new Error(`Snapshot integrity mismatch: ${file.path}`);
  if (image) {
    const dimensions = imageDimensions(bytes, file.path);
    if (dimensions.width !== file.width || dimensions.height !== file.height) throw new Error(`Screenshot dimensions mismatch: ${file.path}`);
  }
  return bytes;
}

export async function listRegularFiles(root) {
  await assertNoSymlinkComponents(root);
  const result = [];
  async function walk(directory, prefix = '') {
    for (const item of await fs.readdir(directory, { withFileTypes: true })) {
      const relative = prefix + item.name;
      if (!validPortablePath(relative)) throw new Error(`Unsafe filesystem path: ${relative}`);
      if (item.isSymbolicLink()) throw new Error(`Symlink is not allowed: ${relative}`);
      if (item.isDirectory()) await walk(path.join(directory, item.name), `${relative}/`);
      else if (item.isFile()) {
        if ((await fs.lstat(path.join(directory, item.name))).nlink > 1) throw new Error(`Hardlinked file is not allowed: ${relative}`);
        result.push(relative);
      } else throw new Error(`Non-regular file: ${relative}`);
    }
  }
  await walk(root);
  return result.sort();
}

export async function validateSnapshot(root, manifest, { exact = false } = {}) {
  validateManifest(manifest);
  if (!commit(manifest.source.commit) || !Number.isFinite(Date.parse(manifest.source.importedAt))) {
    throw new Error('Invalid original snapshot source commit or import timestamp');
  }
  const existing = await listRegularFiles(root);
  const processed = Boolean(manifest.screenshots);
  if (!processed && (existing.includes(PROVENANCE)
    || manifest.files.some(file => file.status || file.sourceSha256 || file.aliases))) {
    throw new Error('Screenshot privacy provenance is missing from the manifest');
  }
  let index = null;
  if (processed) {
    exactKeys(manifest.screenshots, ['version', 'provenance', 'sha256', 'counts'], 'manifest screenshot provenance');
    if (manifest.screenshots.version !== 1 || manifest.screenshots.provenance !== PROVENANCE
      || !digest(manifest.screenshots.sha256)) throw new Error('Invalid screenshot provenance reference');
    const bytes = await readRegularFile(path.join(root, PROVENANCE), PROVENANCE);
    if (sha256(bytes) !== manifest.screenshots.sha256) throw new Error('Screenshot provenance hash mismatch');
    index = validateScreenshotIndex(JSON.parse(bytes.toString('utf8')));
    const counts = screenshotCounts(index);
    exactKeys(manifest.screenshots.counts, Object.keys(counts), 'screenshot counts');
    for (const key of Object.keys(counts)) {
      if (manifest.screenshots.counts[key] !== counts[key]) throw new Error('Screenshot provenance counts mismatch');
    }
    const images = manifest.files.filter(file => file.kind === 'image');
    if (images.length !== index.files.length) throw new Error('Screenshot provenance must cover every image');
    if (index.retired?.some(file => manifest.files.some(item => item.path === file.path))) {
      throw new Error('Retired screenshot remains in the snapshot manifest');
    }
    for (const file of index.files) {
      const entry = images.find(image => image.path === file.path);
      if (!entry || Object.keys(entry).length !== Object.keys(file).length + 1
        || Object.keys(file).some(key => JSON.stringify(entry[key]) !== JSON.stringify(file[key]))) {
        throw new Error(`Screenshot manifest/provenance mismatch: ${file.path}`);
      }
    }
    for (const file of index.documents) {
      const entry = manifest.files.find(item => item.path === file.path);
      if (!entry || entry.kind !== 'document' || entry.sourceCommit !== index.source.commit
        || entry.sourceSha256 !== (file.sourceSha256 ?? file.sha256) || entry.sha256 !== file.sha256 || entry.bytes !== file.bytes) {
        throw new Error(`Screenshot document provenance mismatch: ${file.path}`);
      }
    }
  }
  const expected = new Set(['manifest.json', ...(processed ? [PROVENANCE] : []), ...manifest.files.map(file => file.path)]);
  for (const relative of existing) {
    if (!expected.has(relative) && (exact || (processed && (relative.startsWith('docs/screenshots/')
      || IMAGE_EXTENSIONS.includes(path.posix.extname(relative).toLowerCase()))))) {
      throw new Error(`Unowned snapshot file: ${relative}`);
    }
  }
  const actualCounts = {
    documents: manifest.files.filter(file => file.kind === 'document').length,
    images: manifest.files.filter(file => file.kind === 'image').length,
    attachments: manifest.files.filter(file => file.kind === 'attachment').length,
    files: manifest.files.length,
  };
  if (Object.keys(actualCounts).some(key => manifest.counts?.[key] !== actualCounts[key])) throw new Error('Snapshot manifest counts mismatch');
  for (const file of manifest.files) await readCheckedFile(root, file, { image: processed && file.kind === 'image' });
  return index;
}
