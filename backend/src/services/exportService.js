// Export CSV per il commercialista: elenco fatture emesse nell'anno + riepilogo forfettario
// (ricavi, imposta stimata, soglia). Riusa listMesiFatturati/getInvoice e
// calcolaDashboardForfettario esistenti — nessun nuovo dato persistito, tutto calcolato
// on-the-fly (vedi AI-Workspace/Plans/EXPORT_COMMERCIALISTA.md).
import { listMesiFatturati, getInvoice, arricchisciStatoPagamento } from './invoiceService.js';
import { calcolaDashboardForfettario, tutteLeFattureRisolte, ricaviAnnoCassa } from './forfettarioService.js';

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
    ].join(',');
  };

  const righe = [
    `Fatture emesse nel ${anno} (competenza)`,
    'Numero,Data,Cliente,Partita IVA,Imponibile,Bollo,Netto a pagare,Data Pagamento',
    ...fattureEmesse.map(rigaFattura),
    '',
    `Fatture incassate nel ${anno} (cassa — rilevanti ai fini fiscali per il forfettario)`,
    'Numero,Data,Cliente,Partita IVA,Imponibile,Bollo,Netto a pagare,Data Pagamento',
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

  return righe.join('\n');
}
