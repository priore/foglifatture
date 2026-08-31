// Validazione conformità dati fattura contro le regole minime dello schema FatturaPA v1.2.2
// prima della generazione/invio XML, per evitare scarti SDI dovuti a dati malformati
// (es. campo troncato, CAP/P.IVA con lunghezza sbagliata) e restituire un errore specifico
// invece di far fallire in modo generico il parsing a valle.

const RE_PIVA = /^\d{11}$/;
const RE_CF = /^[0-9A-Za-z]{11,16}$/;
const RE_CAP = /^\d{5}$/;
const RE_PROVINCIA = /^[A-Za-z]{2}$/;
const RE_CODICE_DESTINATARIO = /^[0-9A-Za-z]{6,7}$/;
const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;

function requireCampo(errori, valore, etichetta) {
  if (valore == null || String(valore).trim() === '') errori.push(`${etichetta} mancante`);
}

function requireMatch(errori, valore, regex, etichetta) {
  if (valore != null && String(valore).trim() !== '' && !regex.test(String(valore).trim())) {
    errori.push(`${etichetta} non valido: "${valore}"`);
  }
}

/**
 * Verifica i dati di fornitore/cliente/fattura contro i vincoli minimi FatturaPA
 * prima di generare l'XML. Non sostituisce la validazione ufficiale SDI, ma intercetta
 * gli errori di formato più comuni (lunghezza P.IVA/CF/CAP, provincia, codice destinatario).
 * @returns {{ valido: boolean, errori: string[] }}
 */
export function validaDatiFatturaPA({ fornitore, cliente, fattura }) {
  const errori = [];

  requireCampo(errori, fornitore?.denominazione, 'Denominazione fornitore');
  requireCampo(errori, fornitore?.partitaIva, 'Partita IVA fornitore');
  requireMatch(errori, fornitore?.partitaIva, RE_PIVA, 'Partita IVA fornitore (11 cifre)');
  requireCampo(errori, fornitore?.codiceFiscale, 'Codice Fiscale fornitore');
  requireMatch(errori, fornitore?.codiceFiscale, RE_CF, 'Codice Fiscale fornitore');
  requireCampo(errori, fornitore?.indirizzo, 'Indirizzo fornitore');
  requireMatch(errori, fornitore?.cap, RE_CAP, 'CAP fornitore (5 cifre)');
  requireCampo(errori, fornitore?.cap, 'CAP fornitore');
  requireCampo(errori, fornitore?.comune, 'Comune fornitore');
  requireMatch(errori, fornitore?.provincia, RE_PROVINCIA, 'Provincia fornitore (sigla 2 lettere)');
  requireCampo(errori, fornitore?.provincia, 'Provincia fornitore');

  requireCampo(errori, cliente?.denominazione, 'Denominazione cliente');
  requireCampo(errori, cliente?.partitaIva, 'Partita IVA cliente');
  requireMatch(errori, cliente?.partitaIva, RE_PIVA, 'Partita IVA cliente (11 cifre)');
  requireCampo(errori, cliente?.indirizzo, 'Indirizzo cliente');
  requireMatch(errori, cliente?.cap, RE_CAP, 'CAP cliente (5 cifre)');
  requireCampo(errori, cliente?.cap, 'CAP cliente');
  requireCampo(errori, cliente?.comune, 'Comune cliente');
  requireMatch(errori, cliente?.provincia, RE_PROVINCIA, 'Provincia cliente (sigla 2 lettere)');
  requireCampo(errori, cliente?.provincia, 'Provincia cliente');
  requireCampo(errori, cliente?.codiceDestinatarioSdi, 'Codice Destinatario SDI cliente');
  requireMatch(errori, cliente?.codiceDestinatarioSdi, RE_CODICE_DESTINATARIO, 'Codice Destinatario SDI cliente (6-7 caratteri)');

  requireCampo(errori, fattura?.numero, 'Numero fattura');
  requireCampo(errori, fattura?.data, 'Data fattura');
  requireMatch(errori, fattura?.data, RE_DATA, 'Data fattura (formato AAAA-MM-GG)');
  requireCampo(errori, fattura?.descrizione, 'Descrizione fattura');
  if (fattura?.imponibile == null || !Number.isFinite(Number(fattura.imponibile)) || Number(fattura.imponibile) <= 0) {
    errori.push('Imponibile fattura non valido');
  }

  return { valido: errori.length === 0, errori };
}
