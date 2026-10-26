// Collegamento tra i servizi di dominio (fatture, numerazione) e la sincronizzazione cloud: i servizi non
// importano il cloud, che si registra qui quando il processo lo carica (server.js, core.js). Senza cloud: no-op.
let servizio = null;
export const impostaCloud = (s) => { servizio = s; };
export const remotoPerNumerazione = async () => (servizio ? servizio.remotoPerNumerazione() : null);
export const sincronizzaPrimaDiEmettere = async () => { await servizio?.sincronizzaPrimaDiEmettere(); };
