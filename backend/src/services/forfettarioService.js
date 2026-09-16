// Dashboard regime forfettario: compenso cumulato annuo vs soglia, previsione imposta/INPS.
import { listMesiFatturati, getInvoice } from './invoiceService.js';

// Aliquota agevolata 5% nei primi 5 anni solari di attività (anno di inizio incluso),
// 15% dal sesto anno in poi. Nessuna rivalsa INPS separata: l'imposta sostitutiva
// già assorbe IRPEF/addizionali (semplificazione voluta del regime forfettario).
export function aliquotaImposta(dataInizioAttivita, anno) {
  if (!dataInizioAttivita) return 15;
  const annoInizio = new Date(dataInizioAttivita).getFullYear();
  const annoAgevolazione = anno - annoInizio < 5;
  return annoAgevolazione ? 5 : 15;
}

async function ricaviAnno(anno) {
  const chiavi = (await listMesiFatturati()).filter((c) => c.anno === anno);
  const risolte = await Promise.all(
    chiavi.map(async (c) => ({ mese: c.mese, invoice: await getInvoice(c.anno, c.mese, c.clienteId) }))
  );
  // Solo le chiavi che risolvono davvero a una fattura leggibile contano come "mese
  // fatturato" — una chiave orfana/corrotta su disco non deve gonfiare il conteggio.
  const risolteValide = risolte.filter((r) => r.invoice);
  // Conta i mesi civili distinti, non le entry: con più fatture nello stesso mese
  // (multi-cliente) un mese va contato una sola volta, altrimenti la proiezione fine
  // anno (ricaviCumulati / mesiFatturati * 12) risulta sballata per eccesso di mesi.
  const mesiDistinti = new Set(risolteValide.map((r) => r.mese));
  return { fatture: risolteValide.map((r) => r.invoice), mesiFatturati: mesiDistinti.size, risolteValide };
}

export async function tutteLeFattureRisolte() {
  const chiavi = await listMesiFatturati();
  const fatture = await Promise.all(chiavi.map((c) => getInvoice(c.anno, c.mese, c.clienteId)));
  return fatture.filter(Boolean);
}

// Principio di cassa (regime forfettario, art. 1 commi 54-89 L. 190/2014): una fattura fa
// cumulo nell'anno di INCASSO (dataPagamento), non nell'anno di emissione. Cerca su tutte
// le fatture di ogni anno, non solo quelle emesse nell'anno richiesto — una fattura emessa
// nel 2026 e incassata nel 2027 conta per il fatturato-cassa 2027, non 2026.
export async function ricaviAnnoCassa(anno, tutte) {
  const incassateAnno = tutte.filter((f) => f.dataPagamento && f.dataPagamento.slice(0, 4) === String(anno));
  const ricaviCumulati = Number(incassateAnno.reduce((tot, f) => tot + f.imponibile, 0).toFixed(2));

  // Fatture emesse nell'anno ma non ancora incassate (a nessuna data): rischiano di slittare
  // sul fatturato-cassa dell'anno successivo — utili per l'avviso "a cavallo d'anno".
  const nonIncassateEmesseAnno = tutte.filter((f) => f.anno === anno && !f.dataPagamento);

  return { ricaviCumulati, incassateAnno, nonIncassateEmesseAnno };
}

// Fatture emesse in un anno e incassate in un altro (sempre successivo, essendo l'incasso
// posteriore all'emissione): segnala la parte già chiusa, per far capire quanto del
// fatturato "per competenza" dell'anno emissione è in realtà slittato su un altro anno-cassa.
function fattureACavalloAnno(tutte) {
  return tutte
    .filter((f) => f.dataPagamento && f.dataPagamento.slice(0, 4) !== String(f.anno))
    .map((f) => ({
      anno: f.anno, mese: f.mese, clienteId: f.clienteId, numero: f.numero,
      annoIncasso: Number(f.dataPagamento.slice(0, 4)),
      nettoAPagare: f.nettoAPagare,
    }));
}

// Ricavi (imponibile) aggregati per mese civile, per il grafico andamento mensile in dashboard.
function ricaviPerMese(risolteValide) {
  const perMese = new Map();
  for (const { mese, invoice } of risolteValide) {
    perMese.set(mese, (perMese.get(mese) || 0) + invoice.imponibile);
  }
  return Array.from({ length: 12 }, (_, i) => ({
    mese: i + 1,
    ricavi: Number((perMese.get(i + 1) || 0).toFixed(2)),
  }));
}

export async function calcolaDashboardForfettario(config, { anno = new Date().getFullYear(), meseCorrente = new Date().getMonth() + 1 } = {}) {
  const { sogliaAnnua, coefficenteRedditivita, dataInizioAttivita } = config.forfettario;

  const { fatture, mesiFatturati, risolteValide } = await ricaviAnno(anno);
  const ricaviCumulati = Number(fatture.reduce((tot, f) => tot + f.imponibile, 0).toFixed(2));

  const redditoImponibile = Number((ricaviCumulati * coefficenteRedditivita / 100).toFixed(2));
  const aliquota = aliquotaImposta(dataInizioAttivita, anno);
  const impostaStimata = Number((redditoImponibile * aliquota / 100).toFixed(2));
  const nettoStimato = Number((ricaviCumulati - impostaStimata).toFixed(2));

  // Proiezione lineare fine anno: ricavi/mesi fatturati finora * 12. Nessuna
  // proiezione se non c'è ancora nessuna fattura (evita divisione per zero).
  const ricaviProiettati = mesiFatturati > 0
    ? Number((ricaviCumulati / mesiFatturati * 12).toFixed(2))
    : 0;

  const percentualeSoglia = sogliaAnnua > 0
    ? Number((ricaviCumulati / sogliaAnnua * 100).toFixed(1))
    : 0;
  const percentualeSogliaProiettata = sogliaAnnua > 0
    ? Number((ricaviProiettati / sogliaAnnua * 100).toFixed(1))
    : 0;

  // Acconto anno successivo, metodo storico (100% dell'imposta sull'intero anno
  // corrente): a differenza di impostaStimata (calcolata sul consuntivo parziale
  // a oggi), qui la base è il reddito imponibile proiettato a fine anno — è la stima
  // di quanto si verserà davvero come acconto, non l'imposta maturata finora.
  const redditoImponibileProiettato = Number((ricaviProiettati * coefficenteRedditivita / 100).toFixed(2));
  const accontoStimato = Number((redditoImponibileProiettato * aliquota / 100).toFixed(2));

  // Fatturato/imposta per cassa (regola fiscale reale del forfettario): affiancato al
  // calcolo per competenza sopra, mai in sua sostituzione — la numerazione/FatturaPA restano
  // per competenza, solo soglia/imposta rilevanti ai fini fiscali seguono l'incasso.
  const tutte = await tutteLeFattureRisolte();
  const { ricaviCumulati: ricaviCumulatiCassa, nonIncassateEmesseAnno } = await ricaviAnnoCassa(anno, tutte);
  const redditoImponibileCassa = Number((ricaviCumulatiCassa * coefficenteRedditivita / 100).toFixed(2));
  const impostaStimataCassa = Number((redditoImponibileCassa * aliquota / 100).toFixed(2));
  const percentualeSogliaCassa = sogliaAnnua > 0 ? Number((ricaviCumulatiCassa / sogliaAnnua * 100).toFixed(1)) : 0;

  const cassa = {
    ricaviCumulati: ricaviCumulatiCassa,
    redditoImponibile: redditoImponibileCassa,
    impostaStimata: impostaStimataCassa,
    percentualeSoglia: percentualeSogliaCassa,
    superamentoSoglia: ricaviCumulatiCassa > sogliaAnnua,
    // Fatture emesse quest'anno ma ancora da incassare: rischiano di pesare sulla soglia
    // dell'anno prossimo se incassate dopo il 31/12, o su quella corrente se incassate entro.
    nonIncassateEmesseAnno: nonIncassateEmesseAnno.map((f) => ({
      anno: f.anno, mese: f.mese, clienteId: f.clienteId, numero: f.numero, nettoAPagare: f.nettoAPagare,
    })),
    fattureACavalloAnno: fattureACavalloAnno(tutte).filter((f) => f.anno === anno || f.annoIncasso === anno),
  };

  return {
    anno,
    sogliaAnnua,
    coefficenteRedditivita,
    aliquota,
    ricaviCumulati,
    redditoImponibile,
    impostaStimata,
    accontoStimato,
    nettoStimato,
    mesiFatturati,
    ricaviMensili: ricaviPerMese(risolteValide),
    ricaviProiettati,
    percentualeSoglia,
    percentualeSogliaProiettata,
    superamentoSoglia: ricaviCumulati > sogliaAnnua,
    superamentoSogliaProiettato: ricaviProiettati > sogliaAnnua,
    cassa,
  };
}
