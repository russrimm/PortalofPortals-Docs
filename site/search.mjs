export function normalize(value) {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
}

export function searchDocuments(documents, query, category = '') {
  const words = normalize(query).trim().split(/\s+/).filter(Boolean);
  return documents
    .filter(doc => !category || doc.category === category)
    .map(doc => {
      const title = normalize(doc.title);
      const content = normalize(`${doc.title} ${doc.path} ${doc.text}`);
      if (!words.every(word => content.includes(word))) return null;
      const score = words.reduce((sum, word) => sum + (title.includes(word) ? 10 : 1), 0)
        + (words.length && title === words.join(' ') ? 100 : 0);
      return { ...doc, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

export function excerpt(text, query, length = 180) {
  const word = normalize(query).trim().split(/\s+/).find(Boolean);
  const match = word ? normalize(text).indexOf(word) : 0;
  const start = Math.max(0, match - 55);
  return `${start ? '...' : ''}${text.slice(start, start + length).trim()}${text.length > start + length ? '...' : ''}`;
}
