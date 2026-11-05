// Conferme/avvisi come popup dell'app al posto di confirm()/alert() nativi.
// `chiediConferma(...)` risolve true (OK) o false (Annulla, tap fuori, Esc); `avvisa(...)` ha il solo OK.
import { ref } from 'vue';

export const richiesta = ref(null);

function apri(opzioni) {
  return new Promise((risolvi) => {
    richiesta.value = { ...opzioni, risolvi };
  });
}

export function chiediConferma(messaggio, { titolo = 'Conferma', ok = 'OK', annulla = 'Annulla' } = {}) {
  return apri({ titolo, messaggio, ok, annulla });
}

// Tre scelte: risolve 'ok' (sinistra, verde), 'alternativa' (centro, blu) o null (Annulla, tap fuori, Esc).
export function chiediScelta(messaggio, { titolo = 'Conferma', ok, alternativa, annulla = 'Annulla' }) {
  return apri({ titolo, messaggio, ok, alternativa, annulla, tre: true });
}

export function avvisa(messaggio, { titolo = 'Attenzione', ok = 'Ho capito' } = {}) {
  return apri({ titolo, messaggio, ok });
}

export function chiudiRichiesta(esito) {
  const r = richiesta.value;
  richiesta.value = null;
  r?.risolvi(esito);
}
