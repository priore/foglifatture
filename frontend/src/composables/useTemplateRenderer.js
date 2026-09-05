// Motore di rendering dei template di stampa (Handlebars): compila layout.html+layout.css
// di un template e lo monta in un iframe sandboxato (niente allow-scripts), così un
// template importato in futuro non può eseguire codice nel DOM host.
import Handlebars from 'handlebars/dist/handlebars.js';

export function compilaTemplate(layoutHtml, dati) {
  return Handlebars.compile(layoutHtml)(dati);
}

// Monta l'HTML+CSS compilati dentro l'iframe passato per riferimento (già nel DOM).
export function montaInIframe(iframeEl, html, css) {
  const doc = iframeEl.contentDocument;
  doc.open();
  // box-sizing:border-box globale: i CSS dei template dichiarano "width:21cm" intendendo
  // il foglio A4 intero, ma di default il padding si somma al width (content-box) e il
  // documento sfora il proprio contenitore — con border-box "width:21cm" resta 21cm veri.
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0}${css}</style></head><body>${html}</body></html>`);
  doc.close();
}
