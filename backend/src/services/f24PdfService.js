// Stesura F24 Ordinario sul modello ufficiale AdE (PDF fillabile).
// FP-023 · FEATURES_GAP_ANALISI_ESTERNA.md voce 7.
//
// Il modello PDF non si ridistribuisce: viene scaricato dal sito AdE al primo uso
// in backend/data/modelli/f24-ordinario.pdf e verificato con SHA-256.
// Se l'AdE pubblica una nuova edizione (impronta diversa), la stampa si blocca
// con un messaggio esplicito — meglio un errore chiaro che numeri nelle caselle sbagliate.
//
// COORDINATE: misurate sui rettangoli di riempimento del modello AdE (pdf2json, pagina 1,
// A4 portrait 595.3×841.9 pt) e sulle virgole pre-stampate che separano intero/decimali
// in ogni casella importo. Ogni campo è { x, y, size } dove y è dal basso (convenzione pdf-lib).
// Versione modello: "F24 ordinario" (aggiornamento 2019, sha256 in MODELLO_SHA256).
// Se cambiano le coordinate: aggiornare LAYOUT e MODELLO_SHA256.
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from '../lib/jsonStore.js';

// URL ufficiale del modello F24 ordinario (Agenzia delle Entrate).
// ponytail: URL fisso — se l'AdE sposta la pagina, aggiornare qui e MODELLO_SHA256.
const MODELLO_URL = 'https://www.agenziaentrate.gov.it/portale/documents/20143/250689/Modello+di+versamento+unificato+-+F24+Ordinario_i+Modello+F24+%282%29.pdf';

// SHA-256 del modello AdE scaricato (aggiornare se l'AdE pubblica nuova edizione).
const MODELLO_SHA256 = 'a5429ca42c7330fdd514a4143734342b1e29dbe66edb27185e3be36a6d51712a';

// Dimensioni pagina del modello (A4 portrait, 210×297 mm → 595.3×841.9 pt).
const H = 841.89;

// LAYOUT — coordinate ricavate dai rettangoli di riempimento del modello AdE via pdf2json.
// Modello: F24 Ordinario AdE (A4 portrait, 595.3×841.9 pt).
// y = dal basso (pdf-lib). Ogni campo: {x, y, size} dove y è la baseline del testo.
// Formula usata: y_text = fill.y_bottom + 2  (2pt sopra il fondo della casella).
// SCALE pdf2json: 16pt/unità (Width_raw=37.205 → 595.3pt; Height_raw=52.618 → 841.9pt).
// Ogni importo nel modello ha una virgola PRE-STAMPATA: i 2 decimali vanno scritti
// SUBITO dopo di essa, uno adiacente all'altro (non in un box lontano dalla virgola
// né come stringa unica centrata in uno spazio — sono 2 cifre singole a ridosso
// della virgola stessa, il modello non ha caselle separate visibili lì, lo spazio
// è libero). Gap fissi piccoli e proporzionali al font.
const GAP_PRIMA_VIRGOLA_EM = 0.4;   // em tra fine intero e virgola stampata
const GAP_DOPO_VIRGOLA_EM = 1.1;    // em tra virgola stampata e prima cifra decimale
const GAP_TRA_DECIMALI_EM = 0.75;   // em tra le due cifre decimali (larghezza 1a cifra + margine)

const LAYOUT = {
  // Intestazione contribuente (fill i=4,5,8,9,6,7 — pagina 1, A4 portrait 595.3×841.9pt)
  // Codice fiscale: 16 caselle a carattere singolo (vlines separatori, passo 14.4pt).
  codiceFiscale: {
    y: 724,
    size: 9,
    xCifre: [120.6, 135.0, 149.4, 163.8, 178.2, 192.6, 207.0, 221.4, 235.8, 250.2, 264.6, 279.0, 293.4, 307.8, 322.2, 336.6],
  },
  cognome:           { x: 117, y: 700, size: 9 },
  nome:              { x: 420, y: 700, size: 9 },
  dataNascita:       { x: 146, y: 676, size: 9 },
  // "comune (o Stato estero) di nascita" (i=10) resta vuoto: non abbiamo questo dato,
  // solo il comune di domicilio fiscale (riga sotto).
  domicilioComune:   { x: 117, y: 652, size: 9 },   // fill i=6
  // Provincia domicilio: 2 caselle a carattere singolo (vlines separatori a
  // x=329.44, 343.84, 358.24), tra il box comune e il box via.
  domicilioProvincia:{ y: 652, size: 9, xCifre: [336.64, 351.04] },
  domicilioVia:      { x: 367, y: 652, size: 9 },   // fill i=7

  // Sezione ERARIO — 5 righe (fills i=11..15). Righe vere misurate dalle linee
  // interne della griglia (non dall'altezza del box/5, che dà un passo sbagliato):
  // yBottom riga 589.87, 577.87, 565.87, 553.87, 541.87 → passo reale 12pt.
  erario: {
    firstY: 591.9,   // yBottom riga1 (589.87) + 2pt sopra la linea
    step:   12.0,
    xCodiceTributo:   158,
    xRateazione:      223,
    xAnnoRiferimento: 274,
    xVirgolaImporto:  380.5,
  },

  // Sezione INPS — 4 righe (fills i=17,18,19,63,20), passo 12pt, virgola importo a x=380.5
  // Righe vere misurate dalle linee interne (yBottom 481.63, 469.63, 457.63,
  // 445.63 bordo box) — stesso criterio di erario, non dall'altezza box/4.
  inps: {
    firstY: 483.6,   // yBottom riga1 (481.63) + 2pt sopra la linea
    step:   12.0,
    xCodiceSede:      21,
    xCausale:         57,
    xMatricola:       93,
    // Periodo "da/a mm/aaaa": casella mese unica + 4 caselle anno a cifra
    // singola (vlines separatori), non un campo "mm/aaaa" libero.
    periodoDaMeseCentro: 228.1,
    periodoDaAnnoCifre:  [238.6, 246.0, 253.5, 260.9],
    periodoAMeseCentro:  279.2,
    periodoAAnnoCifre:   [290.1, 297.2, 304.3, 311.5],
    xVirgolaImporto: 380.5,
  },

  // Totale A erario — stesso box decimali delle righe normali (XCIFRE_DECIMALI_ERARIO_INPS).
  totaleErario:      { y: 519, xVirgolaImporto: 380.5, size: 8 },
  // Totale C INPS (stesso box decimali)
  totaleInps:        { y: 436, xVirgolaImporto: 380.5, size: 8 },

  // Saldo finale EURO (virgola pre-stampata a x=553.3, box decimali proprio: XCIFRE_DECIMALI_SALDO_FINALE)
  saldoFinale:       { y: 124, xVirgolaImporto: 553.3, size: 9 },

  // Data del versamento — caselle a cifra singola (vlines i separatori), non un
  // campo libero: xCifre sono i centri di ogni casella, in ordine GG MM AAAA.
  dataVersamento: {
    y: 52,
    size: 9,
    xCifre: [32.4, 48.6, 63.0, 77.4, 91.8, 106.2, 120.6, 135.0],
  },
};

// Limite righe per sezione (struttura del modello ufficiale).
const MAX_RIGHE_ERARIO = 6;
const MAX_RIGHE_INPS = 4;

// Percorso del modello scaricato (dato locale, escluso da git con backend/data/).
function percorsoModello() {
  return path.join(DATA_DIR, 'modelli', 'f24-ordinario.pdf');
}

// Scarica il modello AdE se non presente.
async function assicuraModello() {
  const dest = percorsoModello();
  if (!existsSync(dest)) {
    await mkdir(path.dirname(dest), { recursive: true });
    const res = await fetch(MODELLO_URL);
    if (!res.ok) throw new Error(`Impossibile scaricare il modello F24 da AdE (${res.status}). Scaricarlo manualmente da agenziaentrate.gov.it e salvarlo in backend/data/modelli/f24-ordinario.pdf`);
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(dest, buf);
  }
}

// Verifica integrità del modello (solo se MODELLO_SHA256 è impostata).
async function verificaIntegrita(buf) {
  if (!MODELLO_SHA256) return; // ponytail: nessuna verifica se impronta non configurata
  const hash = createHash('sha256').update(buf).digest('hex');
  if (hash !== MODELLO_SHA256) {
    throw new Error(
      `Il modello F24 AdE ha un\'impronta SHA-256 diversa da quella attesa.\n` +
      `Attesa: ${MODELLO_SHA256}\n` +
      `Trovata: ${hash}\n` +
      `L'AdE potrebbe aver pubblicato una nuova edizione: le coordinate potrebbero non corrispondere più alle caselle.\n` +
      `Aggiornare MODELLO_SHA256 in f24PdfService.js dopo aver ricalibrato le coordinate.`
    );
  }
}

// Formatta un importo come { intero: '1.234', decimali: '56' }.
function formattaImporto(importo) {
  const str = importo.toFixed(2);
  const [intera, dec] = str.split('.');
  // Separatore migliaia con punto (convenzione italiana) — non usa toLocaleString (ICU non garantita)
  const intFormatted = intera.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return { intero: intFormatted, decimali: dec };
}

// Genera il PDF F24 compilato a partire da una scadenza del piano versamenti.
// `scadenza` è un elemento di `stimaVersamenti().scadenze`.
// `config` è la configurazione fornitore/forfettario.
// Restituisce un Buffer con il PDF.
export async function generaF24Pdf(scadenza, config) {
  await assicuraModello();
  const modelloBuf = await readFile(percorsoModello());
  await verificaIntegrita(modelloBuf);

  // Separa righe per sezione
  const righeErario = scadenza.righe.filter((r) => r.sezione === 'erario');
  const righeInps   = scadenza.righe.filter((r) => r.sezione === 'inps');

  if (righeErario.length > MAX_RIGHE_ERARIO) {
    throw new Error(`Troppe righe nella sezione Erario: ${righeErario.length} (massimo ${MAX_RIGHE_ERARIO}). Verificare il piano F24.`);
  }
  if (righeInps.length > MAX_RIGHE_INPS) {
    throw new Error(`Troppe righe nella sezione INPS: ${righeInps.length} (massimo ${MAX_RIGHE_INPS}). Verificare il piano F24.`);
  }

  const pdfDoc = await PDFDocument.load(modelloBuf);
  const font   = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const page   = pdfDoc.getPages()[0];
  const nero   = rgb(0, 0, 0);

  function scrivi({ x, y, size }, testo) {
    if (!testo) return;
    page.drawText(String(testo), { x, y, size: size ?? 9, font, color: nero });
  }

  // Scrive un testo centrato su un singolo punto x (es. mese "mm" dentro un'unica
  // casella larga, a differenza delle caselle a carattere singolo).
  function scriviCentrato(xCentro, y, size, testo) {
    if (!testo) return;
    const w = font.widthOfTextAtSize(testo, size);
    page.drawText(testo, { x: xCentro - w / 2, y, size, font, color: nero });
  }

  // Scrive una stringa carattere per carattere, uno per casella, centrato su ogni
  // xCifre (es. data GGMMAAAA su 8 caselle, codice fiscale su 16) — non un campo
  // di testo libero.
  function scriviCaratteriInCaselle({ xCifre, y, size }, caratteri) {
    for (let i = 0; i < caratteri.length && i < xCifre.length; i++) {
      const w = font.widthOfTextAtSize(caratteri[i], size);
      page.drawText(caratteri[i], { x: xCifre[i] - w / 2, y, size, font, color: nero });
    }
  }

  // Scrive un importo: intero right-allineato contro la virgola già stampata sul
  // modello, i 2 decimali subito dopo la virgola, uno adiacente all'altro (non in
  // un box lontano né come stringa unica).
  function scriviImporto(xVirgola, y, importo, size) {
    const { intero, decimali } = formattaImporto(importo);
    const wIntero = font.widthOfTextAtSize(intero, size);
    page.drawText(intero, { x: xVirgola - GAP_PRIMA_VIRGOLA_EM * size - wIntero, y, size, font, color: nero });
    const x1 = xVirgola + GAP_DOPO_VIRGOLA_EM * size;
    const x2 = x1 + GAP_TRA_DECIMALI_EM * size;
    page.drawText(decimali[0], { x: x1, y, size, font, color: nero });
    page.drawText(decimali[1], { x: x2, y, size, font, color: nero });
  }

  // --- Intestazione contribuente ---
  // Il fornitore in questo gestionale ha solo `denominazione` (persona fisica con
  // partita IVA o ditta individuale) — va nella riga "cognome, denominazione o
  // ragione sociale"; non esiste uno split cognome/nome né una data di nascita.
  const f = config.fornitore ?? {};
  if (f.codiceFiscale) scriviCaratteriInCaselle(LAYOUT.codiceFiscale, f.codiceFiscale.toUpperCase().split(''));
  scrivi(LAYOUT.cognome, f.denominazione ?? '');
  scrivi(LAYOUT.domicilioVia, f.indirizzo ? `${f.indirizzo}${f.numeroCivico ? ' ' + f.numeroCivico : ''}` : '');
  scrivi(LAYOUT.domicilioComune, f.comune ?? '');
  if (f.provincia) scriviCaratteriInCaselle(LAYOUT.domicilioProvincia, f.provincia.toUpperCase().split(''));

  // --- Sezione ERARIO ---
  const le = LAYOUT.erario;
  for (let i = 0; i < righeErario.length; i++) {
    const r = righeErario[i];
    const y = le.firstY - i * le.step;
    const sz = 8;
    page.drawText(r.codice ?? '',                  { x: le.xCodiceTributo,   y, size: sz, font, color: nero });
    page.drawText(r.rateazione ?? '',              { x: le.xRateazione,      y, size: sz, font, color: nero });
    page.drawText(String(r.annoRiferimento ?? ''), { x: le.xAnnoRiferimento, y, size: sz, font, color: nero });
    scriviImporto(le.xVirgolaImporto, y, r.importo, sz);
  }

  // --- Sezione INPS ---
  // Periodo "mm/aaaa" (stringa) → mese in casella unica, anno in 4 caselle singole.
  function scriviPeriodo(xMeseCentro, xAnnoCifre, y, size, periodo) {
    if (!periodo) return;
    const [mese, anno] = periodo.split('/');
    scriviCentrato(xMeseCentro, y, size, mese);
    if (anno) scriviCaratteriInCaselle({ xCifre: xAnnoCifre, y, size }, anno.split(''));
  }

  const li = LAYOUT.inps;
  for (let i = 0; i < righeInps.length; i++) {
    const r = righeInps[i];
    const y = li.firstY - i * li.step;
    const sz = 8;
    page.drawText(r.codice ?? '', { x: li.xCausale, y, size: sz, font, color: nero });
    scriviPeriodo(li.periodoDaMeseCentro, li.periodoDaAnnoCifre, y, sz, r.periodoDa);
    scriviPeriodo(li.periodoAMeseCentro,  li.periodoAAnnoCifre,  y, sz, r.periodoA);
    scriviImporto(li.xVirgolaImporto, y, r.importo, sz);
  }

  // --- Totali ---
  const totaleErario = righeErario.reduce((s, r) => s + r.importo, 0);
  const totaleInps   = righeInps.reduce((s, r) => s + r.importo, 0);
  const totaleSaldo  = Number((totaleErario + totaleInps).toFixed(2));

  if (totaleErario > 0) {
    scriviImporto(LAYOUT.totaleErario.xVirgolaImporto, LAYOUT.totaleErario.y, totaleErario, LAYOUT.totaleErario.size);
  }
  if (totaleInps > 0) {
    scriviImporto(LAYOUT.totaleInps.xVirgolaImporto, LAYOUT.totaleInps.y, totaleInps, LAYOUT.totaleInps.size);
  }
  if (totaleSaldo > 0) {
    scriviImporto(LAYOUT.saldoFinale.xVirgolaImporto, LAYOUT.saldoFinale.y, totaleSaldo, LAYOUT.saldoFinale.size);
  }

  // --- Data versamento (GG MM AAAA, una cifra per casella) ---
  const dataIso = scadenza.data?.slice(0, 10); // "AAAA-MM-GG"
  if (dataIso) {
    const [aaaa, mm, gg] = dataIso.split('-');
    scriviCaratteriInCaselle(LAYOUT.dataVersamento, (gg + mm + aaaa).split(''));
  }

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
