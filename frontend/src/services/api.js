// Client API centralizzato: tutte le chiamate al backend passano da qui,
// così ogni componente resta ignaro di URL, header e gestione errori HTTP.
const BASE_URL = '/api';

async function richiesta(percorso, opzioni = {}) {
  const risposta = await fetch(`${BASE_URL}${percorso}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opzioni,
  });
  if (!risposta.ok) {
    const corpo = await risposta.json().catch(() => ({}));
    const messaggio = corpo.dettagli?.length ? `${corpo.errore}: ${corpo.dettagli.join('; ')}` : corpo.errore;
    throw new Error(messaggio || `Errore HTTP ${risposta.status}`);
  }
  const tipo = risposta.headers.get('content-type') || '';
  return tipo.includes('application/json') ? risposta.json() : risposta.text();
}

export const api = {
  // Configurazione (anagrafica fornitore/cliente, tariffa, PEC)
  getConfig: () => richiesta('/config'),
  saveConfig: (config) => richiesta('/config', { method: 'PUT', body: JSON.stringify(config) }),
  spostaPercorsoDati: (percorso) => richiesta('/config/percorso-dati', { method: 'PUT', body: JSON.stringify({ percorso }) }),

  // Timesheet mensile
  listMesiTimesheet: () => richiesta('/timesheet'),
  getTimesheet: (anno, mese, clienteId) => richiesta(`/timesheet/${anno}/${mese}/${clienteId}`),
  saveTimesheet: (anno, mese, clienteId, giorni) =>
    richiesta(`/timesheet/${anno}/${mese}/${clienteId}`, { method: 'PUT', body: JSON.stringify({ giorni }) }),
  urlExportVms: (anno, mese, clienteId) => `${BASE_URL}/timesheet/${anno}/${mese}/${clienteId}/export-vms`,

  // Fattura Pro-Forma
  anteprimaFattura: (anno, mese, clienteId) => richiesta(`/invoice/${anno}/${mese}/${clienteId}/anteprima`),
  anteprimaFatturaManuale: (anno, mese, clienteId, importo) => richiesta(`/invoice/${anno}/${mese}/${clienteId}/anteprima-manuale?importo=${importo}`),
  getFattura: (anno, mese, clienteId) => richiesta(`/invoice/${anno}/${mese}/${clienteId}`).catch(() => null),
  listMesiFatturati: () => richiesta('/invoice'),
  generaFattura: (anno, mese, clienteId, dati = {}) =>
    richiesta(`/invoice/${anno}/${mese}/${clienteId}/genera`, { method: 'POST', body: JSON.stringify(dati) }),

  // XML FatturaPA e invio PEC
  urlDownloadXml: (anno, mese, clienteId) => `${BASE_URL}/invoice/${anno}/${mese}/${clienteId}/xml`,
  inviaPec: (anno, mese, clienteId) => richiesta(`/invoice/${anno}/${mese}/${clienteId}/invia-pec`, { method: 'POST' }),
  ricevuteSdiFattura: (anno, mese, clienteId) => richiesta(`/invoice/${anno}/${mese}/${clienteId}/ricevute-sdi`),

  // Credenziali Google OAuth (whitelist singolo utente)
  getOAuthConfig: () => richiesta('/oauth-config'),
  saveOAuthConfig: (dati) => richiesta('/oauth-config', { method: 'PUT', body: JSON.stringify(dati) }),

  // Ricevute/notifiche SDI (ricezione via PEC, ping manuale oltre al polling automatico)
  controllaRicevuteSdi: () => richiesta('/sdi/controlla', { method: 'POST' }),
  cronologiaPec: () => richiesta('/sdi/cronologia'),

  // Import storico pregresso (timesheet da xls originale, fatture da XML FatturaPA già emesse)
  importaTimesheet: (anno, mese, clienteId, file) => {
    const form = new FormData();
    form.append('file', file);
    return fetch(`${BASE_URL}/import/timesheet/${anno}/${mese}/${clienteId}`, { method: 'POST', body: form })
      .then(async r => { if (!r.ok) throw new Error((await r.json().catch(() => ({}))).errore || `Errore HTTP ${r.status}`); return r.json(); });
  },
  importaFattura: (file, clienteId) => {
    const form = new FormData();
    form.append('file', file);
    if (clienteId) form.append('clienteId', clienteId);
    return fetch(`${BASE_URL}/import/fattura`, { method: 'POST', body: form })
      .then(async r => { if (!r.ok) throw new Error((await r.json().catch(() => ({}))).errore || `Errore HTTP ${r.status}`); return r.json(); });
  },
  importaTimesheetBatch: (clienteId, files) => {
    const form = new FormData();
    for (const file of files) form.append('file', file);
    return fetch(`${BASE_URL}/import/timesheet-batch/${clienteId}`, { method: 'POST', body: form })
      .then(async r => { if (!r.ok) throw new Error((await r.json().catch(() => ({}))).errore || `Errore HTTP ${r.status}`); return r.json(); });
  },
  importaFatturaBatch: (files, clienteId) => {
    const form = new FormData();
    for (const file of files) form.append('file', file);
    if (clienteId) form.append('clienteId', clienteId);
    return fetch(`${BASE_URL}/import/fattura-batch`, { method: 'POST', body: form })
      .then(async r => { if (!r.ok) throw new Error((await r.json().catch(() => ({}))).errore || `Errore HTTP ${r.status}`); return r.json(); });
  },

  // Backup/restore cifrato di backend/data/
  salvaImpostazioniBackup: (dati) => richiesta('/backup/impostazioni', { method: 'PUT', body: JSON.stringify(dati) }),
  esportaBackup: async (password) => {
    const r = await fetch(`${BASE_URL}/backup/esporta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).errore || `Errore HTTP ${r.status}`);
    const nomeFile = (r.headers.get('content-disposition') || '').match(/filename="(.+)"/)?.[1] || 'backup.tsbk';
    return { blob: await r.blob(), nomeFile };
  },
  ripristinaBackup: (file, password) => {
    const form = new FormData();
    form.append('file', file);
    form.append('password', password);
    return fetch(`${BASE_URL}/backup/ripristina`, { method: 'POST', body: form })
      .then(async r => { if (!r.ok) throw new Error((await r.json().catch(() => ({}))).errore || `Errore HTTP ${r.status}`); return r.json(); });
  },

  // Promemoria timesheet fine mese
  salvaImpostazioniReminder: (dati) => richiesta('/reminder/impostazioni', { method: 'PUT', body: JSON.stringify(dati) }),

  // Dashboard regime forfettario (soglia, imposta stimata, settori ATECO)
  settoriAteco: () => richiesta('/forfettario/settori-ateco'),
  aggiornaSettoriAteco: () => richiesta('/forfettario/settori-ateco/aggiorna', { method: 'POST' }),
  dashboardForfettario: (anno) => richiesta(`/forfettario/dashboard${anno ? `?anno=${anno}` : ''}`),
  modelliGemini: () => richiesta('/forfettario/gemini/modelli'),
  verificaModelloGemini: (modello) => richiesta('/forfettario/gemini/modelli/verifica', { method: 'POST', body: JSON.stringify({ modello }) }),
};

export const authApi = {
  stato: () => fetch('/auth/stato').then(r => r.json()),
  logout: () => fetch('/auth/logout', { method: 'POST' }),
};
