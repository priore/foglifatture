// Renderer markdown minimale: bold, italic, liste puntate/numerate, titoli h1-h3.
// Nessuna dipendenza. Usato per output AI nel popup.
export function renderMarkdown(testo) {
  if (!testo) return '';
  const righe = testo.split('\n');
  const html = [];
  let inLista = false;

  for (let i = 0; i < righe.length; i++) {
    let r = righe[i];

    // Chiudi lista se la riga non è un elemento
    if (inLista && !/^\s*[-*•]\s|^\s*\d+\.\s/.test(r)) {
      html.push('</ul>');
      inLista = false;
    }

    // Titoli
    if (/^###\s/.test(r)) { html.push(`<h3>${inline(r.slice(4))}</h3>`); continue; }
    if (/^##\s/.test(r))  { html.push(`<h3>${inline(r.slice(3))}</h3>`); continue; }
    if (/^#\s/.test(r))   { html.push(`<h3>${inline(r.slice(2))}</h3>`); continue; }

    // Lista puntata o numerata
    const li = r.match(/^\s*(?:[-*•]|\d+\.)\s+(.*)/);
    if (li) {
      if (!inLista) { html.push('<ul>'); inLista = true; }
      html.push(`<li>${inline(li[1])}</li>`);
      continue;
    }

    // Riga vuota
    if (r.trim() === '') {
      if (i < righe.length - 1) html.push('<br>');
      continue;
    }

    html.push(`<p>${inline(r)}</p>`);
  }

  if (inLista) html.push('</ul>');
  return html.join('');
}

function inline(s) {
  return s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>');
}
