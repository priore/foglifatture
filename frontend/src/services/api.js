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
    throw new Error(corpo.errore || `Errore HTTP ${risposta.status}`);
  }
  const tipo = risposta.headers.get('content-type') || '';
  return tipo.includes('application/json') ? risposta.json() : risposta.text();
}

export const api = {
  // Configurazione (anagrafica fornitore/cliente, tariffa, PEC)
  getConfig: () => richiesta('/config'),
  saveConfig: (config) => richiesta('/config', { method: 'PUT', body: JSON.stringify(config) }),

  // Timesheet mensile
  listMesiTimesheet: () => richiesta('/timesheet'),
  getTimesheet: (anno, mese) => richiesta(`/timesheet/${anno}/${mese}`),
  saveTimesheet: (anno, mese, giorni) =>
    richiesta(`/timesheet/${anno}/${mese}`, { method: 'PUT', body: JSON.stringify({ giorni }) }),

  // Fattura Pro-Forma
  anteprimaFattura: (anno, mese) => richiesta(`/invoice/${anno}/${mese}/anteprima`),
  getFattura: (anno, mese) => richiesta(`/invoice/${anno}/${mese}`).catch(() => null),
  generaFattura: (anno, mese, dati = {}) =>
    richiesta(`/invoice/${anno}/${mese}/genera`, { method: 'POST', body: JSON.stringify(dati) }),

  // XML FatturaPA e invio PEC
  urlDownloadXml: (anno, mese) => `${BASE_URL}/invoice/${anno}/${mese}/xml`,
  inviaPec: (anno, mese) => richiesta(`/invoice/${anno}/${mese}/invia-pec`, { method: 'POST' }),

  // Credenziali Google OAuth (whitelist singolo utente)
  getOAuthConfig: () => richiesta('/oauth-config'),
  saveOAuthConfig: (dati) => richiesta('/oauth-config', { method: 'PUT', body: JSON.stringify(dati) }),

  // Ricevute/notifiche SDI (ricezione via PEC, ping manuale oltre al polling automatico)
  controllaRicevuteSdi: () => richiesta('/sdi/controlla', { method: 'POST' }),

  // Import storico pregresso (timesheet da xls originale, fatture da XML FatturaPA già emesse)
  importaTimesheet: (anno, mese, file) => {
    const form = new FormData();
    form.append('file', file);
    return fetch(`${BASE_URL}/import/timesheet/${anno}/${mese}`, { method: 'POST', body: form })
      .then(async r => { if (!r.ok) throw new Error((await r.json().catch(() => ({}))).errore || `Errore HTTP ${r.status}`); return r.json(); });
  },
  importaFattura: (file) => {
    const form = new FormData();
    form.append('file', file);
    return fetch(`${BASE_URL}/import/fattura`, { method: 'POST', body: form })
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
};

export const authApi = {
  stato: () => fetch('/auth/stato').then(r => r.json()),
  logout: () => fetch('/auth/logout', { method: 'POST' }),
};
