import path from 'node:path';

export const OUTSIDE_DOCS = Object.freeze([
  'README.md',
  'TODO.md',
  'scripts/ARCHITECTURE.md',
  'scripts/CANVAS-APP-FORMULA-ANALYSIS.md',
  'scripts/COMPLETE-SOLUTION-SUMMARY.md',
  'scripts/QUICK-START-GROK-TIMEOUT-FIX.md',
  'scripts/README-SOLUTION-ANALYSIS.md',
  'tests/README-SCREENSHOTS.md',
  'tests/README-VISUAL-REGRESSION.md',
  'src/app/power-platform/environments/REFACTORING_LOG.md',
  'src/app/power-platform/environments/REFACTORING_PLAN.md',
  'LICENSE',
]);

export const REQUIRED_ATTACHMENTS = Object.freeze([
  'docs/authorization-inventory.csv',
  'docs/openapi.json',
  'docs/openapi.yaml',
  'docs/portal-walkthrough-transcript.txt',
  'docs/servicenow-incident-adaptive-card.json',
  'docs/servicenow-knowledge-adaptive-card.json',
]);

export const IMAGE_EXTENSIONS = Object.freeze([
  '.avif', '.bmp', '.gif', '.ico', '.jpeg', '.jpg', '.png', '.webp',
]);
export const ATTACHMENT_EXTENSIONS = Object.freeze([
  '.csv', '.json', '.txt', '.yaml', '.yml',
]);

const excludedDirectories = new Set([
  'node_modules', 'bower_components', 'vendor', 'vendors', 'third-party',
  'third_party', 'skills', 'skill', 'agents', 'agent-prompts',
  'agent-instructions', 'prompts', 'instructions',
]);
const instructionNames = new Set([
  'agents.md', 'claude.md', 'gemini.md', 'skill.md', 'instructions.md',
  'prompt.md', 'prompts.md', 'copilot-instructions.md',
]);

export function validPortablePath(value) {
  return typeof value === 'string' && value.length > 0
    && !value.includes('\\') && !value.includes(':')
    && !/[\u0000-\u001f\u007f]/u.test(value)
    && value.split('/').every((part) => part && part !== '.' && part !== '..'
      && !/[. ]$/u.test(part)
      && !/[<>"|?*]/u.test(part)
      && !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/iu.test(part));
}

export function exclusionReason(relativePath, isDirectory = false) {
  const parts = relativePath.split('/');
  if (parts.some((part) => part.startsWith('.'))) {
    return isDirectory ? 'hidden-directory' : 'hidden-file-or-directory';
  }
  const directories = isDirectory ? parts : parts.slice(0, -1);
  if (directories.some((part) => excludedDirectories.has(part.toLowerCase()))) {
    return 'vendor-or-agent-instruction-directory';
  }
  if (!validPortablePath(relativePath)) return 'non-portable-path';
  const name = parts.at(-1).toLowerCase();
  if (!isDirectory && (instructionNames.has(name)
    || /\.(?:instructions|prompt)\.md$/u.test(name)
    || /(?:^|[-_.])(?:agent|copilot)[-_.](?:instructions?|prompts?)\.md$/u.test(name))) {
    return 'agent-instruction-file';
  }
  return null;
}

export function classifyPath(relativePath) {
  if (exclusionReason(relativePath)) return null;
  if (OUTSIDE_DOCS.includes(relativePath)) {
    return relativePath === 'LICENSE' ? 'license' : 'document';
  }
  if (!relativePath.startsWith('docs/')) return null;
  const extension = path.posix.extname(relativePath).toLowerCase();
  if (extension === '.md') return 'document';
  if (IMAGE_EXTENSIONS.includes(extension)) return 'image';
  if (ATTACHMENT_EXTENSIONS.includes(extension)) return 'attachment';
  return null;
}

export function shouldVisitDirectory(relativePath) {
  return relativePath === 'docs' || relativePath.startsWith('docs/')
    || OUTSIDE_DOCS.some((file) => file.startsWith(`${relativePath}/`));
}

export function manifestRules() {
  return {
    documents: 'All authored docs/**/*.md, including nested documentation and infographic-prompts.md',
    outsideDocs: [...OUTSIDE_DOCS],
    requiredDocumentationAttachments: [...REQUIRED_ATTACHMENTS],
    imageExtensions: [...IMAGE_EXTENSIONS],
    attachmentExtensions: [...ATTACHMENT_EXTENSIONS],
    excludedDirectories: ['all hidden directories (including docs/.obsidian)', ...excludedDirectories],
    agentInstructions: 'Agent/skill instruction directories and conventional instruction filenames excluded',
    unknownFiles: 'Reported, never copied; executable and active-content formats are not allowed',
    symlinks: 'Skipped and reported; source/destination root symlinks are rejected',
    credentials: 'Selected text scanned for high-confidence credentials before destination changes',
    ownership: 'Only prior manifest-owned stale files removed; modified files require --force',
    license: 'LICENSE preserved in snapshot and destination project root',
  };
}
