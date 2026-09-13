import { searchDocuments, excerpt } from './search.mjs';

document.documentElement.dataset.js = 'true';
const $ = selector => document.querySelector(selector);
let toastTimeout;
function notify(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove('visible'), 4500);
}

function updateThemeButton() {
  $('#theme-toggle').setAttribute('aria-label', `Switch to ${document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'} theme`);
}
updateThemeButton();
$('#theme-toggle').addEventListener('click', () => {
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('portal-docs-theme', theme); }
  catch { notify('Theme changed for this page. Browser storage is unavailable.'); }
  updateThemeButton();
});
$('#menu-toggle').addEventListener('click', () => {
  const open = $('#sidebar').classList.toggle('is-open');
  $('#menu-toggle').setAttribute('aria-expanded', String(open));
  $('#menu-toggle').setAttribute('aria-label', `${open ? 'Close' : 'Open'} navigation`);
});
document.addEventListener('keydown', event => {
  if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey
      && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && !document.activeElement.isContentEditable && !$('#image-viewer').open) {
    event.preventDefault();
    $('#global-search').focus();
  }
  if (event.key === 'Escape' && $('#sidebar').classList.contains('is-open') && !$('#image-viewer').open) {
    $('#menu-toggle').click();
    $('#menu-toggle').focus();
  }
});

function setQuery(values) {
  const url = new URL(location.href);
  for (const [key, value] of Object.entries(values)) {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  history.replaceState(null, '', url);
}

function highlighted(text, query) {
  const fragment = document.createDocumentFragment();
  const words = query.trim().split(/\s+/).filter(Boolean);
  if (!words.length) { fragment.append(text); return fragment; }
  const pattern = new RegExp(`(${words.map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  const parts = text.split(pattern);
  parts.forEach((part, index) => {
    if (index % 2) {
      const mark = document.createElement('mark');
      mark.textContent = part;
      fragment.append(mark);
    } else fragment.append(part);
  });
  return fragment;
}

async function initializeLibrary() {
  if (!$('#library-filter')) return;
  const input = $('#library-query');
  const category = $('#library-category');
  const params = new URLSearchParams(location.search);
  input.value = params.get('q') || '';
  category.value = params.get('category') || '';
  $('#global-search').value = input.value;
  const counter = $('#result-count');
  counter.textContent = 'Loading search index...';
  let documents;
  try {
    const response = await fetch('/search-index.json');
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    documents = await response.json();
  } catch (error) {
    $('#search-error').hidden = false;
    $('#search-error').textContent = `Search could not load (${error.message}). Reload this page to retry. The complete unfiltered library is still available below.`;
    counter.textContent = 'All documents (search unavailable)';
    return;
  }
  function render() {
    const results = searchDocuments(documents, input.value, category.value);
    const fragment = document.createDocumentFragment();
    for (const result of results) {
      const anchor = document.createElement('a');
      anchor.className = 'document-result';
      anchor.href = result.url;
      const main = document.createElement('div');
      main.className = 'result-main';
      const heading = document.createElement('h2');
      heading.append(highlighted(result.title, input.value));
      const snippet = document.createElement('p');
      snippet.append(highlighted(excerpt(result.text, input.value), input.value));
      const filename = document.createElement('span');
      filename.className = 'document-path';
      filename.textContent = result.path;
      const topic = document.createElement('span');
      topic.className = 'topic-label';
      topic.textContent = result.category;
      main.append(heading, snippet, filename);
      anchor.append(main, topic);
      fragment.append(anchor);
    }
    if (!results.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      const title = document.createElement('h2');
      title.textContent = 'No documents match';
      const hint = document.createElement('p');
      hint.textContent = 'Use fewer words or clear the topic filter to search the whole library.';
      empty.append(title, hint);
      fragment.append(empty);
    }
    $('#document-results').replaceChildren(fragment);
    counter.textContent = `${results.length} document${results.length === 1 ? '' : 's'}${input.value ? ` matching "${input.value}"` : ''}`;
    setQuery({ q: input.value, category: category.value });
  }
  let timeout;
  input.addEventListener('input', () => { clearTimeout(timeout); timeout = setTimeout(render, 120); });
  category.addEventListener('change', render);
  $('#library-filter').addEventListener('submit', event => { event.preventDefault(); clearTimeout(timeout); render(); });
  $('#library-filter').addEventListener('reset', () => { clearTimeout(timeout); setTimeout(render); });
  render();
}

function initializeGallery() {
  if (!$('#gallery-filter')) return;
  const query = $('#gallery-query');
  const category = $('#gallery-category');
  const format = $('#gallery-format');
  const params = new URLSearchParams(location.search);
  query.value = params.get('q') || '';
  category.value = params.get('category') || '';
  format.value = params.get('format') || '';
  function render() {
    const words = query.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
    let count = 0;
    document.querySelectorAll('[data-gallery-card]').forEach(card => {
      card.hidden = Boolean((category.value && card.dataset.category !== category.value)
        || (format.value && card.dataset.format !== format.value)
        || !words.every(word => card.dataset.search.includes(word)));
      if (!card.hidden) count++;
    });
    $('#gallery-count').textContent = `${count} screenshot${count === 1 ? '' : 's'}`;
    $('#gallery-empty').hidden = count !== 0;
    setQuery({ q: query.value, category: category.value, format: format.value });
  }
  query.addEventListener('input', render);
  category.addEventListener('change', render);
  format.addEventListener('change', render);
  $('#gallery-filter').addEventListener('submit', event => { event.preventDefault(); render(); });
  $('#gallery-filter').addEventListener('reset', () => setTimeout(render));
  render();
}

const viewer = $('#image-viewer');
const viewerImage = document.createElement('img');
viewerImage.id = 'viewer-image';
viewerImage.alt = '';
viewerImage.hidden = true;
$('.viewer-stage').append(viewerImage);
let imageLinks = [];
let imageIndex = 0;
let trigger;
function showImage(index) {
  imageIndex = index;
  const link = imageLinks[index];
  $('#viewer-title').textContent = link.dataset.title || 'Source screenshot';
  $('#viewer-description').textContent = link.dataset.description || 'Original source image. Review privacy and historical context before sharing.';
  $('#viewer-image').src = link.href;
  $('#viewer-image').alt = link.dataset.title || 'Source screenshot';
  $('#viewer-image').hidden = false;
  $('#viewer-original').href = link.href;
  $('#viewer-position').textContent = `${index + 1} of ${imageLinks.length}`;
  $('#viewer-previous').disabled = index === 0;
  $('#viewer-next').disabled = index === imageLinks.length - 1;
}
document.querySelectorAll('[data-lightbox]').forEach(link => {
  link.addEventListener('click', event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    trigger = link;
    imageLinks = [...document.querySelectorAll('[data-lightbox]')].filter(item => !item.closest('[hidden]'));
    showImage(imageLinks.indexOf(link));
    viewer.showModal();
    document.body.style.overflow = 'hidden';
    $('#viewer-close').focus();
  });
});
$('#viewer-close').addEventListener('click', () => viewer.close());
$('#viewer-previous').addEventListener('click', () => { if (imageIndex > 0) showImage(imageIndex - 1); });
$('#viewer-next').addEventListener('click', () => { if (imageIndex < imageLinks.length - 1) showImage(imageIndex + 1); });
viewer.addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft' && imageIndex > 0) { event.preventDefault(); showImage(imageIndex - 1); }
  if (event.key === 'ArrowRight' && imageIndex < imageLinks.length - 1) { event.preventDefault(); showImage(imageIndex + 1); }
});
viewer.addEventListener('click', event => {
  if (event.target !== viewer) return;
  const bounds = viewer.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) viewer.close();
});
viewer.addEventListener('close', () => {
  document.body.style.overflow = '';
  $('#viewer-image').hidden = true;
  $('#viewer-image').removeAttribute('src');
  trigger?.focus();
});
$('#viewer-image').addEventListener('error', () => {
  $('#viewer-description').textContent = 'This image could not load. Open the original image to retry, or rebuild the site from the snapshot.';
});
document.querySelectorAll('[data-copy-code]').forEach(button => {
  button.addEventListener('click', async () => {
    const code = button.closest('.code-block').querySelector('code').textContent;
    try {
      if (!navigator.clipboard) throw new Error('Clipboard access is unavailable');
      await navigator.clipboard.writeText(code);
      button.textContent = 'Copied';
      setTimeout(() => { button.textContent = 'Copy code'; }, 1800);
    } catch {
      notify('Could not copy automatically. Select the code and copy it using your browser.');
    }
  });
});
initializeGallery();
await initializeLibrary();
