// Validazione formale (non di congruità) di Partita IVA e Codice Fiscale italiani.
// Il Codice Fiscale di una società coincide con la Partita IVA (11 cifre): è un caso
// valido, non un errore di battitura, quindi va accettato oltre al formato 16 caratteri
// alfanumerico delle persone fisiche.
const REGEX_PIVA = /^\d{11}$/;
const REGEX_CF_PERSONA_FISICA = /^[A-Za-z]{6}\d{2}[A-Za-z]\d{2}[A-Za-z]\d{3}[A-Za-z]$/;

export function pivaValida(valore) {
  const v = String(valore || '').trim();
  return v === '' || REGEX_PIVA.test(v);
}

export function codiceFiscaleValido(valore) {
  const v = String(valore || '').trim();
  if (v === '') return true;
  return REGEX_CF_PERSONA_FISICA.test(v) || REGEX_PIVA.test(v); // 16 caratteri, oppure PIVA per società
}

// Codice Destinatario SDI (specifiche tecniche FatturaPA, Agenzia delle Entrate):
// esattamente 7 caratteri alfanumerici. "0000000" è il valore convenzionale quando
// il destinatario non ha un codice proprio (riceve via PEC).
const REGEX_CODICE_SDI = /^[A-Za-z0-9]{7}$/;

export function codiceSdiValido(valore) {
  const v = String(valore || '').trim();
  return v === '' || REGEX_CODICE_SDI.test(v);
}

// Validazione formale (non di deliverability) di un indirizzo email/PEC.
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function pecValida(valore) {
  const v = String(valore || '').trim();
  return v === '' || REGEX_EMAIL.test(v);
}
