import * as fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { assertNoCredentials, assertNoSymlinkComponents, isWithin, readRegularFile, sha256 } from './sync-docs.mjs';
import { PROVENANCE, SCREENSHOT_DOCUMENTS, listRegularFiles, normalizeScreenshotDocument, readCheckedFile, referencedScreenshots, screenshotCounts, validateScreenshotIndex, validateSnapshot } from './screenshots.mjs';

export async function importScreenshots({ input, destination = path.resolve('snapshot') } = {}) {
  if (typeof input !== 'string' || !input.trim()) throw new Error('--input is required');
  const inputRoot = path.resolve(input);
  const snapshotRoot = path.resolve(destination);
  const projectRoot = path.dirname(snapshotRoot);
  await assertNoSymlinkComponents(inputRoot);
  await assertNoSymlinkComponents(snapshotRoot);
  if (isWithin(inputRoot, snapshotRoot) || isWithin(projectRoot, inputRoot)) {
    throw new Error('Prepared input and destination project must not overlap');
  }
  const inputPaths = await listRegularFiles(inputRoot);
  const index = validateScreenshotIndex(JSON.parse(await readRegularFile(path.join(inputRoot, 'screenshot-import.json'), 'screenshot-import.json')));
  const expectedInput = new Set(['screenshot-import.json', ...index.files.map(file => file.path), ...index.documents.map(file => file.path)]);
  if (inputPaths.length !== expectedInput.size || inputPaths.some(relative => !expectedInput.has(relative))) {
    throw new Error('Prepared folder must contain exactly the indexed files and screenshot-import.json; omit OCR text and originals');
  }
  const contents = new Map();
  for (const file of [...index.files, ...index.documents]) {
    const bytes = await readCheckedFile(inputRoot, file, { image: index.files.includes(file) });
    if (index.documents.includes(file)) assertNoCredentials(bytes, file.path);
    contents.set(file.path, bytes);
  }
  const manifestPath = path.join(snapshotRoot, 'manifest.json');
  const originalManifest = await readRegularFile(manifestPath, 'manifest.json');
  const previous = JSON.parse(originalManifest);
  await validateSnapshot(snapshotRoot, previous, { exact: true });
  const images = previous.files.filter(file => file.kind === 'image');
  const replacementPaths = new Set(index.files.flatMap(file => [file.path, ...file.aliases]));
  const retired = new Set((index.retired ?? []).map(file => file.path));
  for (const relative of retired) {
    const original = images.find(image => image.path === relative);
    if (!original || original.capture === 'legacy') throw new Error(`Retired screenshot is not a current image in the existing snapshot: ${relative}`);
  }
  if (images.some(file => !retired.has(file.path)
    && [file.path, ...(file.aliases ?? [])].some(relative => !replacementPaths.has(relative)))) {
    throw new Error('Prepared set omits an existing image or alias without a replacement or retirement');
  }
  for (const file of index.files.filter(file => file.capture === 'legacy')) {
    const original = images.find(image => image.path === file.path);
    if (!original || file.sourceCommit !== (original.sourceCommit ?? previous.source.commit)
      || file.sourceSha256 !== (original.sourceSha256 ?? original.sha256)) {
      throw new Error(`Legacy source provenance does not match the retained snapshot: ${file.path}`);
    }
  }
  for (const file of index.documents) {
    if (!previous.files.some(item => item.path === file.path && item.kind === 'document')) throw new Error(`Missing original caption document: ${file.path}`);
    const bytes = normalizeScreenshotDocument(contents.get(file.path), file.path, index.files);
    if ([...referencedScreenshots(bytes, file.path)].some(relative => retired.has(relative))) {
      throw new Error(`Caption document links a retired screenshot: ${file.path}`);
    }
    if (!bytes.equals(contents.get(file.path))) {
      file.sourceSha256 ??= file.sha256;
      file.sha256 = sha256(bytes);
      file.bytes = bytes.length;
      contents.set(file.path, bytes);
    }
  }
  const preserved = previous.files.filter(file => file.kind !== 'image' && !SCREENSHOT_DOCUMENTS.includes(file.path));
  for (const file of preserved) contents.set(file.path, await readCheckedFile(snapshotRoot, file));
  const provenance = Buffer.from(`${JSON.stringify(index, null, 2)}\n`);
  const files = [
    ...preserved,
    ...index.files.map(file => ({ ...file, kind: 'image' })),
    ...index.documents.map(file => ({ ...file, kind: 'document', sourceCommit: index.source.commit, sourceSha256: file.sourceSha256 ?? file.sha256 })),
  ].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const manifest = {
    ...previous,
    files,
    counts: { ...previous.counts, images: index.files.length, files: files.length },
    screenshots: { version: 1, provenance: PROVENANCE, sha256: sha256(provenance), counts: screenshotCounts(index) },
  };
  const nonce = randomUUID();
  const stage = path.join(projectRoot, `.screenshots-stage-${nonce}`);
  const backup = path.join(projectRoot, `.screenshots-previous-${nonce}`);
  let movedOriginal = false;
  let installed = false;
  try {
    await fs.mkdir(stage);
    for (const [relative, bytes] of contents) {
      const filename = path.join(stage, ...relative.split('/'));
      await fs.mkdir(path.dirname(filename), { recursive: true });
      await fs.writeFile(filename, bytes, { flag: 'wx' });
    }
    await fs.writeFile(path.join(stage, PROVENANCE), provenance, { flag: 'wx' });
    await fs.writeFile(path.join(stage, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' });
    await validateSnapshot(stage, manifest, { exact: true });
    if (!originalManifest.equals(await readRegularFile(manifestPath, 'manifest.json'))) throw new Error('Snapshot manifest changed during screenshot import');
    await validateSnapshot(snapshotRoot, previous, { exact: true });
    await fs.rename(snapshotRoot, backup);
    movedOriginal = true;
    await fs.rename(stage, snapshotRoot);
    installed = true;
  } catch (error) {
    if (movedOriginal && !installed) await fs.rename(backup, snapshotRoot);
    throw error;
  } finally {
    if (!installed) await fs.rm(stage, { recursive: true, force: true });
  }
  // The previous directory is the original snapshot moved aside, never an extra copy of raw images.
  await fs.rm(backup, { recursive: true });
  return manifest;
}

export function parseArguments(args) {
  const options = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--help' || args[i] === '-h') options.help = true;
    else if (args[i] === '--input' && options.input === undefined && args[i + 1] && !args[i + 1].startsWith('--')) options.input = args[++i];
    else throw new Error(`Unknown, duplicate, or incomplete argument: ${args[i]}`);
  }
  if (!options.help && !options.input) throw new Error('--input is required');
  return options;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) console.log('Usage: npm run screenshots:import -- --input "C:\\path\\to\\prepared-screenshots"\nRequires screenshot-import.json and exactly its indexed, reviewed image/document files. No downloading, OCR, or masking is performed by this importer.');
    else {
      const manifest = await importScreenshots(options);
      console.log(`Imported ${manifest.counts.images} privacy-processed screenshots (${manifest.screenshots.counts.current} current, ${manifest.screenshots.counts.legacy} legacy). Non-caption document provenance is unchanged. Run npm test before serving; Git history still requires separate review.`);
    }
  } catch (error) {
    console.error(`Screenshot import failed: ${error.message}`);
    process.exitCode = 1;
  }
}
