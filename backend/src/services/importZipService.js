// Import di archivi ZIP del Cassetto Fiscale (fatture + ricevute SDI mescolate): ogni file
// viene riconosciuto dall'elemento radice dell'XML, non dal nome.
import { leggiZip } from '../lib/zipReader.js';
import { importaFatturaDaXml, eFatturaRicevuta } from './xmlInvoiceImporter.js';

// Elemento radice delle ricevute SDI ⇒ codice tipo usato da sdiRicevuteService.
export const RADICE_RICEVUTA = {
  RicevutaConsegna: 'RC',
  NotificaScarto: 'NS',
  RicevutaScarto: 'NS',
  NotificaMancataConsegna: 'MC',
  NotificaEsito: 'NE',
  NotificaEsitoCommittente: 'EC',
  NotificaDecorrenzaTermini: 'DT',
  AttestazioneTrasmissioneFattura: 'AT',
};

// Nome dell'elemento radice senza prefisso namespace (es. <ns3:RicevutaConsegna>), o null.
export function radiceXml(contenuto) {
  const testo = contenuto.subarray(0, 4096).toString('utf8').replace(/<\?[\s\S]*?\?>|<!--[\s\S]*?-->/g, '');
  return testo.match(/<(?:[\w.-]+:)?([\w.-]+)[\s>/]/)?.[1] ?? null;
}

/**
 * @returns {{ tipo: 'fattura'|'ricevuta'|'ignorato', codiceTipo?: string, motivo?: string, anteprima?: object }}
 */
export function classificaFile(nome, contenuto, pivaOperatore) {
  if (!/\.xml$/i.test(nome)) return { tipo: 'ignorato', motivo: 'Non è un file XML' };
  const radice = radiceXml(contenuto);
  if (radice === 'FatturaElettronica') {
    try {
      if (eFatturaRicevuta(contenuto.toString('utf-8'), pivaOperatore)) return { tipo: 'ignorato', motivo: 'Fattura ricevuta (il cedente non è l\'operatore)' };
      const { numero, data, nettoAPagare } = importaFatturaDaXml(contenuto.toString('utf-8'));
      return { tipo: 'fattura', anteprima: { numero, data, nettoAPagare } };
    } catch (err) {
      return { tipo: 'ignorato', motivo: `Fattura non leggibile: ${err.message}` };
    }
  }
  if (RADICE_RICEVUTA[radice]) return { tipo: 'ricevuta', codiceTipo: RADICE_RICEVUTA[radice] };
  return { tipo: 'ignorato', motivo: radice ? `XML non riconosciuto (${radice})` : 'XML non riconosciuto' };
}

// Aggiunge `avviso` alle fatture il cui numero è già in archivio o ripetuto nello stesso ZIP:
// l'import le accetta, ma poi ogni emissione risponderebbe 409 «numeri duplicati».
export function segnalaNumeriDuplicati(voci, numeriArchivio) {
  const visti = new Set();
  return voci.map((v) => {
    const n = Number(v.anteprima?.numero);
    if (v.tipo !== 'fattura' || !Number.isFinite(n)) return v;
    const avviso = numeriArchivio.has(n) ? `numero ${n} già presente in archivio` : visti.has(n) ? `numero ${n} ripetuto nello ZIP` : undefined;
    visti.add(n);
    return avviso ? { ...v, avviso } : v;
  });
}

// Legge lo ZIP e classifica ogni file. Un nome ripetuto (cartelle diverse) resta duplicato
// nella lista: è l'import, non l'anteprima, a non creare doppioni.
export function analizzaZip(buffer, pivaOperatore) {
  return leggiZip(buffer).map(({ nome, contenuto }) => ({ nome, contenuto, ...classificaFile(nome, contenuto, pivaOperatore) }));
}
