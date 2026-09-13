import * as fs from 'node:fs/promises';
import path from 'node:path';
import { docUrl } from './content.mjs';
import { IMAGE_EXTENSIONS } from './scope.mjs';
import { PROVENANCE, listRegularFiles } from './screenshots.mjs';
import { assertNoSymlinkComponents, maybeLstat, readRegularFile, validateManifest } from './sync-docs.mjs';

export const GENERATED_ASSETS = ['styles.css', 'app.mjs', 'search.mjs', 'theme.js', 'favicon.svg'];
const ROOT_PAGES = ['index.html', 'library.html', 'gallery.html', 'about.html', '404.html'];

export function generatedPaths(manifest) {
  return new Set([
    ...ROOT_PAGES,
    ...manifest.files.filter(file => file.kind === 'document').map(file => decodeURIComponent(docUrl(file.path)).slice(1)),
    ...manifest.files.map(file => `source/${file.path}`),
    'source/manifest.json', 'search-index.json', 'gallery-index.json', 'link-report.json',
    ...(manifest.screenshots ? [`source/${PROVENANCE}`] : []),
    ...GENERATED_ASSETS.map(file => `assets/${file}`),
  ]);
}

export async function prepareOutput(output, manifest) {
  await assertNoSymlinkComponents(output);
  if (!await maybeLstat(output)) return [];
  const existing = await listRegularFiles(output);
  const priorPath = path.join(output, 'source', 'manifest.json');
  const prior = await maybeLstat(priorPath)
    ? validateManifest(JSON.parse(await readRegularFile(priorPath, 'previous build manifest'))) : null;
  const previous = prior ? generatedPaths(prior) : new Set();
  const expected = generatedPaths(manifest);
  for (const relative of existing) {
    if ((relative.startsWith('source/docs/screenshots/') || IMAGE_EXTENSIONS.includes(path.posix.extname(relative).toLowerCase()))
      && !expected.has(relative) && !previous.has(relative)) {
      throw new Error(`Unowned screenshot in build output: ${relative}. Review and remove it explicitly before rebuilding.`);
    }
  }
  return existing.filter(relative => previous.has(relative) && !expected.has(relative));
}

export async function removeStaleOutput(output, stale) {
  for (const relative of stale) {
    const filename = path.join(output, ...relative.split('/'));
    await assertNoSymlinkComponents(filename);
    await fs.unlink(filename);
  }
}
