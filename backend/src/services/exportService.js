// Export CSV per il commercialista: elenco fatture emesse nell'anno + riepilogo forfettario
// (ricavi, imposta stimata, soglia). Riusa listMesiFatturati/getInvoice e
// calcolaDashboardForfettario esistenti — nessun nuovo dato persistito, tutto calcolato
// on-the-fly (vedi AI-Workspace/Plans/EXPORT_COMMERCIALISTA.md).
import { listMesiFatturati, getInvoice, arricchisciStatoPagamento } from './invoiceService.js';
import { calcolaDashboardForfettario, tutteLeFattureRisolte, ricaviAnnoCassa } from './forfettarioService.js';
import { lottiConStato, riepilogoAnnuale } from './lottiBtcService.js';
import { leggiMovimenti } from './movimentiBtcService.js';

function escapiCsv(valore) {
  const testo = String(valore ?? '');
  return /[",\n]/.test(testo) ? `"${testo.replace(/"/g, '""')}"` : testo;
}

async function fattureAnno(anno) {
  const chiavi = (await listMesiFatturati()).filter((c) => c.anno === anno);
  const risolte = await Promise.all(chiavi.map((c) => getInvoice(c.anno, c.mese, c.clienteId)));
  return risolte.filter(Boolean).sort((a, b) => a.data.localeCompare(b.data));
}

// Elenco fatture rilevanti ai fini fiscali per l'anno richiesto: quelle INCASSATE
// nell'anno (principio di cassa del forfettario), non quelle emesse — una fattura
// emessa nel 2026 e incassata nel 2027 compare nell'export 2027, non nel 2026.
async function fattureIncassateAnno(anno) {
  const tutte = (await tutteLeFattureRisolte()).map(arricchisciStatoPagamento);
  const { incassateAnno } = await ricaviAnnoCassa(anno, tutte);
  return incassateAnno.sort((a, b) => a.dataPagamento.localeCompare(b.dataPagamento));
}

export async function esportaReportCommercialistaCsv(config, anno) {
  const fattureEmesse = await fattureAnno(anno);
  const fattureCassa = await fattureIncassateAnno(anno);
  const dashboard = await calcolaDashboardForfettario(config, { anno });
  const clientiPerId = new Map(config.clienti.map((c) => [c.id, c]));

  const rigaFattura = (f) => {
    const cliente = clientiPerId.get(f.clienteId);
    return [
      f.numero,
      f.data,
      escapiCsv(cliente?.denominazione ?? f.clienteId),
      cliente?.partitaIva ?? '',
      f.imponibile.toFixed(2),
      f.bollo.toFixed(2),
      f.nettoAPagare.toFixed(2),
      f.dataPagamento ?? '',
    ].join(',');
  };

  // Sezione cassa: una riga per RATA (fattureCassa già rimappata a rata da
  // ricaviAnnoCassa), imponibile della riga = importo della singola rata — evita
  // il doppio conteggio fiscale di una fattura con rate a cavallo di più anni.
  // Colonne BTC (F6, AI-Workspace/Plans/PAGAMENTI_BTC.md) in coda, vuote sulle rate non BTC.
  const rigaFatturaCassa = (f) => {
    const cliente = clientiPerId.get(f.clienteId);
    return [
      f.numero,
      f.data,
      escapiCsv(cliente?.denominazione ?? f.clienteId),
      cliente?.partitaIva ?? '',
      f.nettoAPagare.toFixed(2),
      f.bollo.toFixed(2),
      f.nettoAPagare.toFixed(2),
      f.dataPagamento ?? '',
      f.btc ? 'BTC' : 'bonifico',
      f.btc?.txid ?? '',
      f.btc ? (f.btc.satoshi / 1e8).toFixed(8) : '',
      f.btc?.cambioEurBtc?.toFixed(2) ?? '',
      escapiCsv(f.btc?.fonteCambio ?? ''),
    ].join(',');
  };

  const righe = [
    `Fatture emesse nel ${anno} (competenza)`,
    'Numero,Data,Cliente,Partita IVA,Imponibile,Bollo,Netto a pagare,Data Pagamento',
    ...fattureEmesse.map(rigaFattura),
    '',
    `Fatture incassate nel ${anno} (cassa — rilevanti ai fini fiscali per il forfettario)`,
    'Numero,Data,Cliente,Partita IVA,Imponibile,Bollo,Netto a pagare,Data Pagamento,Metodo,TXID,BTC,Cambio EUR/BTC,Fonte cambio',
    ...fattureCassa.map(rigaFatturaCassa),
  ];

  const riepilogo = [
    ['Riepilogo regime forfettario — competenza (anno emissione)', ''],
    ['Ricavi cumulati', dashboard.ricaviCumulati.toFixed(2)],
    ['Reddito imponibile', dashboard.redditoImponibile.toFixed(2)],
    ['Aliquota imposta sostitutiva', `${dashboard.aliquota}%`],
    ['Imposta stimata', dashboard.impostaStimata.toFixed(2)],
    ['Netto stimato', dashboard.nettoStimato.toFixed(2)],
    ['Soglia regime forfettario', dashboard.sogliaAnnua.toFixed(2)],
    ['% soglia raggiunta', `${dashboard.percentualeSoglia}%`],
    ['', ''],
    ['Riepilogo regime forfettario — cassa (anno incasso, rilevante ai fini fiscali)', ''],
    ['Ricavi cumulati', dashboard.cassa.ricaviCumulati.toFixed(2)],
    ['Reddito imponibile', dashboard.cassa.redditoImponibile.toFixed(2)],
    ['Aliquota imposta sostitutiva', `${dashboard.aliquota}%`],
    ['Imposta stimata', dashboard.cassa.impostaStimata.toFixed(2)],
    ['Soglia regime forfettario', dashboard.sogliaAnnua.toFixed(2)],
    ['% soglia raggiunta', `${dashboard.cassa.percentualeSoglia}%`],
  ];
  righe.push(`,,,,,,,`);
  for (const [etichetta, valore] of riepilogo) {
    righe.push(`${etichetta},${valore},,,,,,`);
  }

  righe.push(...await sezioniCripto(anno));

  return righe.join('\n');
}

const btc = (satoshi) => (satoshi / 1e8).toFixed(8);
const eur = (n) => (n == null ? '' : n.toFixed(2));

// Sezioni cripto (FP-012/013, AI-Workspace/Plans/REGISTRO_LOTTI_BTC.md Step 7), in coda al CSV:
// senza lotti né uscite non produce nulla e l'export resta identico a prima.
async function sezioniCripto(anno) {
  const [lotti, { uscite }] = await Promise.all([lottiConStato(anno), leggiMovimenti()]);
  const usciteAnno = uscite.filter((u) => u.data.startsWith(`${anno}-`)).sort((a, b) => a.data.localeCompare(b.data));
  if (!lotti.length && !usciteAnno.length) return [];

  const { plusvalenze, saldo, ivca, rw8 } = await riepilogoAnnuale(anno);
  const plusPerUscita = new Map(plusvalenze.cessioni.map((c) => [c.uscita.id, c.plusvalenza]));

  const righe = [
    '',
    `Registro lotti BTC al 31/12/${anno}`,
    'Data,Tipo,BTC,Costo EUR,TXID,BTC residui',
    ...lotti.map((l) => [l.data, l.tipo, btc(l.satoshi), eur(l.costoEur), l.txid ?? '', btc(l.residui)].join(',')),
    '',
    `Uscite BTC ${anno}`,
    'Data,Tipo,BTC,Ricavo EUR,Plusvalenza EUR,TXID',
    ...usciteAnno.map((u) => [u.data, u.tipo, btc(u.satoshi), eur(u.ricavoEur), eur(plusPerUscita.get(u.id)), u.txid ?? ''].join(',')),
    '',
    `Riepilogo cripto ${anno}`,
  ];
  const voci = [['Saldo BTC al 31/12', btc(saldo.satoshi)], ['Costo di carico saldo EUR', eur(saldo.costoTotaleEur)], ['Valore saldo al 31/12 EUR', eur(saldo.valoreEur)]];
  if (plusvalenze.applicabile) {
    voci.push(
      ['Plusvalenze nette EUR', eur(plusvalenze.netto)],
      ['Minusvalenze compensate EUR', eur(plusvalenze.compensate)],
      ['Base imponibile EUR', eur(plusvalenze.baseImponibile)],
      [`Imposta sostitutiva ${plusvalenze.aliquota}% EUR`, eur(plusvalenze.imposta)],
      ...plusvalenze.minusvalenzeRiportabili.map((r) => [`Minusvalenza riportabile ${r.anno} EUR`, eur(r.residuo)]),
    );
  } else {
    voci.push(['Plusvalenze', 'regole cripto non attive per l\'anno']);
  }
  if (rw8) {
    voci.push(
      ['IVCA lorda EUR', eur(ivca.impostaLorda)],
      ['RW8 totale imposta EUR', eur(rw8.totaleImposta)],
      ['RW8 acconti versati EUR', eur(rw8.accontiVersati)],
      ['RW8 saldo EUR', eur(rw8.saldo)],
    );
    if (ivca.mancaValoreMercato) voci.push(['IVCA', 'valore EUR/BTC al 31/12 mancante: importo parziale']);
  }
  return [...righe, ...voci.map(([etichetta, valore]) => `${etichetta},${valore}`)];
}
