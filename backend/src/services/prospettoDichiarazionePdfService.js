// K3: compila le pagine del quadro LM del fascicolo 3 sul modello ufficiale Redditi PF.
// Id, URL di download, impronta SHA-256 e pagine del modello sono dati versionati (registro fonti e
// regole fiscali dell'anno), non costanti nel codice; download e verifica in lib/modelloPdf.js. Il PDF AdE non ha campi compilabili:
// i valori si scrivono per coordinate. Il modello cambia ogni anno: nuova edizione, nuove coordinate.
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { caricaModelloPdf } from '../lib/modelloPdf.js';

const H = 841.89;

// Coordinate da pdf2json sulle virgole ",00" pre-stampate (x = inizio della virgola, y = dall'alto).
// Gli importi si scrivono allineati a destra subito prima della virgola.
const DX = 3, DY = 10.5; // calibrazione tra pdf2json e disegno
const RIGO_LM22 = 383.3;
// chiave prospetto -> { p: pagina (0 = prima del quadro), x, y, tipo }
export const CAMPI = {
  'LM22.1': { p: 0, tipo: 'testo', x: 136, y: RIGO_LM22 },
  'LM22.2': { p: 0, tipo: 'testo', x: 224, y: RIGO_LM22 },
  'LM22.3': { p: 0, x: 322.5, y: RIGO_LM22 },
  'LM22.5': { p: 0, x: 480.9, y: RIGO_LM22 },
  'LM22.6': { p: 0, tipo: 'testo', x: 519, y: RIGO_LM22 },
  'LM34.2': { p: 0, x: 452.1, y: 466.2 },
  'LM34.3': { p: 0, x: 545.7, y: 466.3 },
  'LM35.1': { p: 0, x: 452.1, y: 478.2 },
  'LM35.2': { p: 0, x: 545.7, y: 478.8 },
  'LM36': { p: 0, x: 545.7, y: 490.2 },
  'LM37.5': { p: 0, x: 545.7, y: 538.3 },
  'LM38': { p: 0, x: 545.7, y: 550.2 },
  'LM39': { p: 0, x: 547.1, y: 573.9 },
  'LM40': { p: 1, x: 545.9, y: 201.7 },
  'LM42': { p: 1, x: 545.7, y: 226.2 },
  'LM43': { p: 1, x: 545.7, y: 238.2 },
  'LM44': { p: 1, x: 545.7, y: 250.2 },
  'LM45.2': { p: 1, x: 545.7, y: 263.4 },
  'LM46.1': { p: 1, x: 547.8, y: 274.4 },
  'LM47.1': { p: 1, x: 547.9, y: 286.4 },
  'LM49': { p: 1, x: 545.7, y: 310.2 },
};

// Restituisce un Buffer con le due pagine del quadro LM compilate.
export async function generaProspettoPdf(prospetto, config = {}) {
  // Le pagine del modello si incorporano come oggetti isolati: scrivendo direttamente sul loro contenuto
  // il testo risultava invisibile (stato grafico del modello non bilanciato).
  const modello = await PDFDocument.load(await caricaModelloPdf(prospetto.modelloPdf.id));
  const doc = await PDFDocument.create();
  const incorporate = await doc.embedPdf(modello, prospetto.modelloPdf.pagineQuadroLm.map((n) => n - 1));
  const pagine = incorporate.map((inc) => {
    const page = doc.addPage([595.276, 841.89]);
    page.drawPage(inc);
    return page;
  });
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const nero = rgb(0, 0, 0);

  for (const r of prospetto.righe) {
    const c = CAMPI[r.rigo];
    if (!c || r.valore === null) continue;
    const page = pagine[c.p];
    if (c.tipo === 'testo') {
      // codice attività: solo cifre; forma di esercizio 2 (autonomo): si barra anche la casella a sinistra
      if (r.rigo === 'LM22.6' && r.valore === 2) page.drawText('X', { x: 57.5, y: H - 424.5, size: 11, font, color: nero });
      page.drawText(r.rigo === 'LM22.1' ? String(r.valore).replace(/\D/g, '') : String(r.valore), { x: c.x, y: H - (c.y + DY), size: 9, font, color: nero });
    } else if (r.valore !== 0) { // zero: il modello vuole la casella vuota
      const testo = Math.round(r.valore).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
      page.drawText(testo, { x: c.x + DX - font.widthOfTextAtSize(testo, 9), y: H - (c.y + DY), size: 9, font, color: nero });
    }
  }
  // Intestazione di ogni pagina: codice fiscale (16 caselle a pagina 1, riquadro unico a pagina 2) e Mod. N. 01.
  const cf = (config.fornitore?.codiceFiscale ?? '').toUpperCase();
  const scriviCaselle = (page, testo, x0, passo, yTop) => [...testo].forEach((ch, i) => {
    page.drawText(ch, { x: x0 + passo * (i + 0.5) - font.widthOfTextAtSize(ch, 10) / 2, y: H - yTop, size: 10, font, color: nero });
  });
  if (cf) {
    scriviCaselle(pagine[0], cf, 254, 14.5, 68);
    pagine[1].drawText(cf, { x: 110, y: H - 34, size: 10, font, color: nero });
  }
  scriviCaselle(pagine[0], '01', 455.5, 14.5, 116.5);
  scriviCaselle(pagine[1], '01', 341.5, 13.8, 34);
  for (const page of pagine) {
    page.drawText('Bozza FogliFatture: verificare i valori prima della dichiarazione', { x: 40, y: H - 14, size: 8, font, color: rgb(0.7, 0.1, 0.1) });
  }
  return Buffer.from(await doc.save());
}
