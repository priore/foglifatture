// Collegamento tra i servizi di dominio (fatture, numerazione) e la sincronizzazione cloud: i servizi non
// importano il cloud, che si registra qui quando il processo lo carica (server.js, core.js). Senza cloud: no-op.
let servizio = null;
export const impostaCloud = (s) => { servizio = s; };
export const remotoPerNumerazione = async () => (servizio ? servizio.remotoPerNumerazione() : null);
export const sincronizzaPrimaDiEmettere = async () => { await servizio?.sincronizzaPrimaDiEmettere(); };
export const dopoRipristino = async () => { await servizio?.segnaTuttoDaCaricare?.(); };

// Il puntatore ai dati è cambiato (spostamento o apertura di un archivio): il cloud, se non è più collegato, smette di
// considerare la propria copia come cartella dati da ripristinare all'avvio.
let dopoCambio = null;
export const impostaDopoCambioPercorso = (f) => { dopoCambio = f; };
export const percorsoCambiato = async (percorso) => { await dopoCambio?.(percorso); };
