// Importazione di una fattura elettronica storica da un file XML FatturaPA già emesso,
// per popolare l'archivio locale (invoices/) con lo storico pregresso.
import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({ removeNSPrefix: true, ignoreAttributes: true });

// Estrae i soli campi rilevanti per il nostro modello Invoice; il resto dell'XML
// (dati fiscali di fornitore/cliente) resta nella config, non viene reimportato qui.
export function importaFatturaDaXml(contenutoXml) {
  const documento = parser.parse(contenutoXml);
  const fattura = documento.FatturaElettronica;
  if (!fattura) throw new Error('XML non riconosciuto: manca il nodo FatturaElettronica');

  const header = fattura.FatturaElettronicaHeader;
  const corpo = Array.isArray(fattura.FatturaElettronicaBody) ? fattura.FatturaElettronicaBody[0] : fattura.FatturaElettronicaBody;
  const datiGenerali = corpo.DatiGenerali.DatiGeneraliDocumento;
  const dettaglio = Array.isArray(corpo.DatiBeniServizi.DettaglioLinee)
    ? corpo.DatiBeniServizi.DettaglioLinee[0]
    : corpo.DatiBeniServizi.DettaglioLinee;

  const data = String(datiGenerali.Data); // formato ISO YYYY-MM-DD nel tracciato FatturaPA
  const [anno, mese] = data.split('-').map(Number);

  const bollo = datiGenerali.DatiBollo ? Number(datiGenerali.DatiBollo.ImportoBollo) : 0;

  // parseFloat tollera eventuali suffissi testuali residui (es. "60.00 (ORE)") in file storici.
  const numeroDa = valore => parseFloat(String(valore ?? '0').replace(',', '.')) || 0;

  return {
    anno, mese,
    numero: String(datiGenerali.Numero),
    data,
    descrizione: String(dettaglio.Descrizione || ''),
    oreTotali: numeroDa(dettaglio.Quantita),
    tariffaOraria: numeroDa(dettaglio.PrezzoUnitario),
    imponibile: Number(dettaglio.PrezzoTotale) || 0,
    bolloApplicabile: Boolean(datiGenerali.DatiBollo),
    bollo,
    nettoAPagare: Number(datiGenerali.ImportoTotaleDocumento) || 0,
    progressivoInvio: Number(header.DatiTrasmissione.ProgressivoInvio) || 1,
  };
}
