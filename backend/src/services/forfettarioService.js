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
  const chiavi = (await listMesiFatturati()).filter((c) => c.startsWith(`${anno}-`));
  const fatture = await Promise.all(
    chiavi.map((chiave) => {
      const [a, m] = chiave.split('-').map(Number);
      return getInvoice(a, m);
    })
  );
  // "chiave.length" contava le entry, non i mesi civili: con più fatture nello stesso
  // mese (multi-cliente) va contato il mese una sola volta, altrimenti la proiezione
  // fine anno (ricaviCumulati / mesiFatturati * 12) risulta sballata per eccesso di mesi.
  // slice(0,7) = "YYYY-MM" resta corretto sia su chiave "2026-08" sia su "2026-08-<clienteId>".
  const mesiDistinti = new Set(chiavi.map((c) => c.slice(0, 7)));
  return { fatture: fatture.filter(Boolean), mesiFatturati: mesiDistinti.size };
}

export async function calcolaDashboardForfettario(config, { anno = new Date().getFullYear(), meseCorrente = new Date().getMonth() + 1 } = {}) {
  const { sogliaAnnua, coefficenteRedditivita, dataInizioAttivita } = config.forfettario;

  const { fatture, mesiFatturati } = await ricaviAnno(anno);
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

  return {
    anno,
    sogliaAnnua,
    coefficenteRedditivita,
    aliquota,
    ricaviCumulati,
    redditoImponibile,
    impostaStimata,
    nettoStimato,
    mesiFatturati,
    ricaviProiettati,
    percentualeSoglia,
    percentualeSogliaProiettata,
    superamentoSoglia: ricaviCumulati > sogliaAnnua,
    superamentoSogliaProiettato: ricaviProiettati > sogliaAnnua,
  };
}
