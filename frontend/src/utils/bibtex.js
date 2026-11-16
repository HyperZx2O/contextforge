export function generateBibtex(node) {
  const p = node.properties || {};
  const key = p.arxiv_id || node.id || 'unknown';
  const authors = (p.authors || [])
    .map((a) => (typeof a === 'string' ? a : a?.name))
    .filter(Boolean)
    .join(' and ');
  const year = p.publish_date ? String(p.publish_date).slice(0, 4) : '';

  return `@article{${key},
  title = {${p.title || ''}},
  author = {${authors}},
  year = {${year}},
  url = {${p.url || ''}}
}`;
}

export async function copyBibtex(node) {
  const bibtex = generateBibtex(node);
  try {
    await navigator.clipboard.writeText(bibtex);
  } catch {
    // Fallback for insecure contexts (HTTP non-localhost)
    const ta = document.createElement('textarea');
    ta.value = bibtex;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
  return bibtex;
}
