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
  };
}
