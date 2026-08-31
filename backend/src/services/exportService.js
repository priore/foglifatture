// Export CSV per il commercialista: elenco fatture emesse nell'anno + riepilogo forfettario
// (ricavi, imposta stimata, soglia). Riusa listMesiFatturati/getInvoice e
// calcolaDashboardForfettario esistenti — nessun nuovo dato persistito, tutto calcolato
// on-the-fly (vedi AI-Workspace/Plans/EXPORT_COMMERCIALISTA.md).
import { listMesiFatturati, getInvoice } from './invoiceService.js';
import { calcolaDashboardForfettario } from './forfettarioService.js';

function escapiCsv(valore) {
  const testo = String(valore ?? '');
  return /[",\n]/.test(testo) ? `"${testo.replace(/"/g, '""')}"` : testo;
}

async function fattureAnno(anno) {
  const chiavi = (await listMesiFatturati()).filter((c) => c.anno === anno);
  const risolte = await Promise.all(chiavi.map((c) => getInvoice(c.anno, c.mese, c.clienteId)));
  return risolte.filter(Boolean).sort((a, b) => a.data.localeCompare(b.data));
}

export async function esportaReportCommercialistaCsv(config, anno) {
  const fatture = await fattureAnno(anno);
  const dashboard = await calcolaDashboardForfettario(config, { anno });
  const clientiPerId = new Map(config.clienti.map((c) => [c.id, c]));

  const righe = ['Numero,Data,Cliente,Partita IVA,Imponibile,Bollo,Netto a pagare,Data Pagamento'];
  for (const f of fatture) {
    const cliente = clientiPerId.get(f.clienteId);
    righe.push([
      f.numero,
      f.data,
      escapiCsv(cliente?.denominazione ?? f.clienteId),
      cliente?.partitaIva ?? '',
      f.imponibile.toFixed(2),
      f.bollo.toFixed(2),
      f.nettoAPagare.toFixed(2),
      f.dataPagamento ?? '',
    ].join(','));
  }

  const riepilogo = [
    ['Riepilogo regime forfettario', ''],
    ['Ricavi cumulati', dashboard.ricaviCumulati.toFixed(2)],
    ['Reddito imponibile', dashboard.redditoImponibile.toFixed(2)],
    ['Aliquota imposta sostitutiva', `${dashboard.aliquota}%`],
    ['Imposta stimata', dashboard.impostaStimata.toFixed(2)],
    ['Netto stimato', dashboard.nettoStimato.toFixed(2)],
    ['Soglia regime forfettario', dashboard.sogliaAnnua.toFixed(2)],
    ['% soglia raggiunta', `${dashboard.percentualeSoglia}%`],
  ];
  righe.push(`,,,,,,,`);
  for (const [etichetta, valore] of riepilogo) {
    righe.push(`${etichetta},${valore},,,,,,`);
  }

  return righe.join('\n');
}
