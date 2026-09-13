try {
  const saved = localStorage.getItem('portal-docs-theme');
  document.documentElement.dataset.theme = saved === 'dark' ? 'dark' : 'light';
} catch {
  // Storage can be disabled in private or managed browser sessions.
  document.documentElement.dataset.theme = 'light';
}
