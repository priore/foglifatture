// Nota di credito TD04: storna (tutta o in parte) una fattura già accettata dallo SDI.
// Salvata dentro la fattura stornata (`fattura.notaCredito`), una sola per fattura: lo
// storno parziale ripetuto non è gestito. Condivide la sequenza numerica delle fatture.
import { getInvoice, saveInvoice, prossimoNumeroInSequenza, verificaSequenzaPerEmissione } from './invoiceService.js';
import { registraNumero } from './numerazioneService.js';

// Dati nel formato atteso da generaXmlFatturaPA/validaDatiFatturaPA per la nota di credito.
// Bollo e pagamento omessi: la nota non ha scadenza né IBAN, il bollo resta sulla fattura.
export function fatturaDaNotaCredito(invoice) {
  const n = invoice.notaCredito;
  return {
    numero: n.numero, data: n.data, descrizione: n.descrizione,
    oreTotali: 1, tariffaOraria: n.imponibile, imponibile: n.imponibile,
    rivalsaInps: n.rivalsaInps, bollo: 0, bolloApplicabile: false,
    tipoDocumento: 'TD04',
    fatturaOrigine: { numero: invoice.numero, data: invoice.data },
    trattamentoEstero: invoice.trattamentoEstero ?? null,
    valutaFattura: invoice.valutaFattura ?? null,
  };
}

// L'accettazione SDI è verificata dal chiamante (route): qui solo le regole sui dati.
export async function emettiNotaCredito(anno, mese, clienteId, { importo, descrizione, data }) {
  const invoice = await getInvoice(anno, mese, clienteId);
  if (!invoice) throw new Error('Fattura non trovata');
  if (invoice.notaCredito) throw new Error('Nota di credito già emessa per questa fattura');
  const imponibile = importo == null ? invoice.imponibile : Number(Number(importo).toFixed(2));
  if (!Number.isFinite(imponibile) || imponibile <= 0 || imponibile > invoice.imponibile) {
    throw new Error(`Importo non valido: deve essere tra 0,01 e ${invoice.imponibile.toFixed(2)} €`);
  }
  // Rivalsa INPS proporzionale a quanto si storna.
  const rivalsaInps = invoice.rivalsaInps ? Number((invoice.rivalsaInps * imponibile / invoice.imponibile).toFixed(2)) : 0;
  const sequenza = await verificaSequenzaPerEmissione();
  if (!sequenza.ok) throw new Error(sequenza.errore);
  const numero = await prossimoNumeroInSequenza();
  await registraNumero(numero, { anno, mese, clienteId, nota: true });
  const adesso = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' });
  invoice.notaCredito = {
    numero,
    data: data ?? adesso,
    descrizione: descrizione || `Nota di credito a storno della fattura n. ${invoice.numero} del ${invoice.data}.`,
    imponibile,
    rivalsaInps,
    nettoAPagare: Number((imponibile + rivalsaInps).toFixed(2)),
    invii: [],
  };
  await saveInvoice(anno, mese, clienteId, invoice);
  return invoice;
}
