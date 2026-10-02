// Dashboard regime forfettario: compenso cumulato annuo vs soglia, previsione imposta/INPS.
import { listMesiFatturati, getInvoice, arricchisciStatoPagamento } from './invoiceService.js';
import { regoleAnno } from './regoleFiscaliService.js';

// Aliquota agevolata nei primi N anni solari (anno di inizio incluso), poi ordinaria.
// requisitiAliquotaRidotta: L. 190/2014 c. 65 (nessuna attività nei 3 anni precedenti,
// attività non in prosecuzione di lavoro dipendente). Default false = aliquota ordinaria
// (scelta prudente se i requisiti non sono stati verificati).
export async function aliquotaImposta(dataInizioAttivita, anno, requisitiAliquotaRidotta = false) {
  let aliquotaOrd = 15, aliquotaRid = 5, anniRid = 5;
  try {
    const regole = await regoleAnno(anno);
    aliquotaOrd = regole.forfettario.aliquotaOrdinaria ?? 15;
    aliquotaRid = regole.forfettario.aliquotaRidotta ?? 5;
    anniRid = regole.forfettario.anniAliquotaRidotta ?? 5;
  } catch { /* usa fallback */ }
  if (!dataInizioAttivita || !requisitiAliquotaRidotta) return aliquotaOrd;
  const annoInizio = new Date(dataInizioAttivita).getFullYear();
  return (anno - annoInizio < anniRid) ? aliquotaRid : aliquotaOrd;
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
// `tutte` deve arrivare già arricchita (arricchisciStatoPagamento applicato dal
// chiamante, vedi calcolaDashboardForfettario) — ogni f ha già .pagamenti/.residuo.
export async function ricaviAnnoCassa(anno, tutte) {
  // Ogni rata di ogni fattura pesa per l'anno della PROPRIA data, non dell'ultima rata:
  // una fattura con rata gennaio-2026 e rata marzo-2027 contribuisce a entrambi gli anni.
  const rateAnno = [];
  for (const f of tutte) {
    for (const p of f.pagamenti) {
      if (p.data.slice(0, 4) === String(anno)) rateAnno.push({ fattura: f, pagamento: p });
    }
  }
  const ricaviCumulati = Number(rateAnno.reduce((tot, r) => tot + r.pagamento.importo, 0).toFixed(2));
  // incassateAnno: usato da exportService per la sezione CSV "incassate" — un elenco di
  // RATE (una entry per rata), non di fatture. Ogni entry porta i dati fattura necessari
  // per la riga CSV più data/importo della singola rata.
  const incassateAnno = rateAnno.map((r) => ({ ...r.fattura, dataPagamento: r.pagamento.data, nettoAPagare: r.pagamento.importo, btc: r.pagamento.btc }));

  // Fatture emesse nell'anno con residuo ancora da incassare: rischiano di slittare
  // sul fatturato-cassa dell'anno successivo — utili per l'avviso "a cavallo d'anno".
  const nonIncassateEmesseAnno = tutte.filter((f) => f.anno === anno && f.residuo > 0);

  return { ricaviCumulati, incassateAnno, nonIncassateEmesseAnno };
}

// Fatture emesse in un anno e incassate (in tutto o in parte) in un altro (sempre
// successivo, essendo l'incasso posteriore all'emissione): segnala la parte già chiusa,
// un record per rata (non per fattura), per far capire quanto del fatturato "per
// competenza" dell'anno emissione è in realtà slittato su un altro anno-cassa.
// Richiede `tutte` arricchita (stessa precondizione di ricaviAnnoCassa).
function fattureACavalloAnno(tutte) {
  const righe = [];
  for (const f of tutte) {
    for (const p of f.pagamenti) {
      const annoIncasso = Number(p.data.slice(0, 4));
      if (annoIncasso !== f.anno) {
        righe.push({ anno: f.anno, mese: f.mese, clienteId: f.clienteId, numero: f.numero, annoIncasso, nettoAPagare: p.importo });
      }
    }
  }
  return righe;
}

// Riepilogo incassi BTC (FP-011) a partire dalle rate cassa dell'anno: filtra le rate
// con `.btc` valorizzato e aggrega totali/cambio medio/elenco per la card dashboard.
export function riepilogoBtc(incassateAnno) {
  const rateBtc = incassateAnno.filter((r) => r.btc);
  const eur = Number(rateBtc.reduce((tot, r) => tot + r.nettoAPagare, 0).toFixed(2));
  const satoshi = rateBtc.reduce((tot, r) => tot + r.btc.satoshi, 0);
  const cambioMedio = satoshi > 0 ? Number((eur / (satoshi / 1e8)).toFixed(2)) : 0;
  const elenco = rateBtc
    .map((r) => ({
      numero: r.numero, anno: r.anno, mese: r.mese, clienteId: r.clienteId,
      data: r.dataPagamento, satoshi: r.btc.satoshi, cambioEurBtc: r.btc.cambioEurBtc,
      eur: r.nettoAPagare, txid: r.btc.txid, indirizzoDestinatario: r.btc.indirizzoDestinatario,
    }))
    .sort((a, b) => b.data.localeCompare(a.data));
  return { rate: rateBtc.length, eur, satoshi, cambioMedio, elenco };
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

// Stima previsionale della soglia prima di emettere una nuova fattura (FP-028).
// Funzione pura: non legge dati, lavora solo sui valori passati.
// Ritorna: { livelloSoglia: 'ok'|'vicino'|'oltre', livelloUscita: 'ok'|'uscitaAnnoSuccessivo'|'uscitaImmediata', livelloLimitePersonale: 'ok'|'vicino'|'oltre' }
export function previsioneSoglia({ incassato, daIncassare, importoFattura, sogliaAnnua, sogliaUscitaImmediata, limitePersonale }) {
  const totale = incassato + daIncassare + importoFattura;
  const SOGLIA_VICINO_PCT = 0.80;
  const livelloSoglia = totale > sogliaAnnua ? 'oltre' : (totale >= sogliaAnnua * SOGLIA_VICINO_PCT ? 'vicino' : 'ok');
  const livelloUscita = totale > sogliaUscitaImmediata
    ? 'uscitaImmediata'
    : (totale > sogliaAnnua ? 'uscitaAnnoSuccessivo' : 'ok');
  const lim = limitePersonale > 0 ? limitePersonale : null;
  const livelloLimitePersonale = lim
    ? (totale > lim ? 'oltre' : (totale >= lim * SOGLIA_VICINO_PCT ? 'vicino' : 'ok'))
    : 'ok';
  return { livelloSoglia, livelloUscita, livelloLimitePersonale };
}

// Stato soglia FP-002: da booleano a tre stati, basato sul cumulato per competenza.
function statoSogliaCompetenza(ricaviCumulati, sogliaAnnua, sogliaUscitaImmediata) {
  if (ricaviCumulati > sogliaUscitaImmediata) return 'uscitaImmediata';
  if (ricaviCumulati > sogliaAnnua) return 'uscitaAnnoSuccessivo';
  return 'ok';
}

export async function calcolaDashboardForfettario(config, { anno = new Date().getFullYear(), meseCorrente = new Date().getMonth() + 1 } = {}) {
  const { sogliaAnnua, coefficenteRedditivita, dataInizioAttivita, requisitiAliquotaRidotta = false, soggettoIsa = true, limitePersonale = 0 } = config.forfettario;

  let sogliaUscitaImmediata = 100000;
  try {
    const regole = await regoleAnno(anno);
    sogliaUscitaImmediata = regole.forfettario.sogliaUscitaImmediata ?? 100000;
  } catch { /* usa fallback */ }

  const { fatture, mesiFatturati, risolteValide } = await ricaviAnno(anno);
  // L. 662/96 c. 212: la rivalsa INPS addebitata al cliente è compenso a tutti gli effetti.
  const ricaviCumulati = Number(fatture.reduce((tot, f) => tot + f.imponibile + (f.rivalsaInps ?? 0), 0).toFixed(2));

  const redditoImponibile = Number((ricaviCumulati * coefficenteRedditivita / 100).toFixed(2));
  const aliquota = await aliquotaImposta(dataInizioAttivita, anno, requisitiAliquotaRidotta);
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
  const tutte = (await tutteLeFattureRisolte()).map(arricchisciStatoPagamento);
  const { ricaviCumulati: ricaviCumulatiCassa, incassateAnno, nonIncassateEmesseAnno } = await ricaviAnnoCassa(anno, tutte);
  const redditoImponibileCassa = Number((ricaviCumulatiCassa * coefficenteRedditivita / 100).toFixed(2));
  const impostaStimataCassa = Number((redditoImponibileCassa * aliquota / 100).toFixed(2));
  const percentualeSogliaCassa = sogliaAnnua > 0 ? Number((ricaviCumulatiCassa / sogliaAnnua * 100).toFixed(1)) : 0;

  const cassa = {
    ricaviCumulati: ricaviCumulatiCassa,
    redditoImponibile: redditoImponibileCassa,
    impostaStimata: impostaStimataCassa,
    percentualeSoglia: percentualeSogliaCassa,
    superamentoSoglia: ricaviCumulatiCassa > sogliaAnnua,
    statoSoglia: statoSogliaCompetenza(ricaviCumulatiCassa, sogliaAnnua, sogliaUscitaImmediata),
    // Fatture emesse quest'anno ma ancora da incassare: rischiano di pesare sulla soglia
    // dell'anno prossimo se incassate dopo il 31/12, o su quella corrente se incassate entro.
    nonIncassateEmesseAnno: nonIncassateEmesseAnno.map((f) => ({
      anno: f.anno, mese: f.mese, clienteId: f.clienteId, numero: f.numero, nettoAPagare: f.nettoAPagare, residuo: f.residuo,
    })),
    fattureACavalloAnno: fattureACavalloAnno(tutte).filter((f) => f.anno === anno || f.annoIncasso === anno),
    btc: (() => {
      const riepilogo = riepilogoBtc(incassateAnno);
      const percentualeSuIncassato = ricaviCumulatiCassa > 0
        ? Number((riepilogo.eur / ricaviCumulatiCassa * 100).toFixed(1))
        : 0;
      return { ...riepilogo, percentualeSuIncassato, walletConfigurati: (config.walletBtc?.length ?? 0) > 0 };
    })(),
  };

  return {
    anno,
    sogliaAnnua,
    coefficenteRedditivita,
    aliquota,
    soggettoIsa,
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
    statoSoglia: statoSogliaCompetenza(ricaviCumulati, sogliaAnnua, sogliaUscitaImmediata),
    sogliaUscitaImmediata,
    limitePersonale,
    cassa,
  };
}
