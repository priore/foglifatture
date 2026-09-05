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
    const errore = new Error(messaggio || `Errore HTTP ${risposta.status}`);
    if (corpo.prossimoRetryIl) errore.prossimoRetryIl = corpo.prossimoRetryIl;
    throw errore;
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
  impostaScadenzaPagamento: (anno, mese, clienteId, dataScadenzaPagamento) =>
    richiesta(`/invoice/${anno}/${mese}/${clienteId}/scadenza-pagamento`, { method: 'PATCH', body: JSON.stringify({ dataScadenzaPagamento }) }),

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

  // Riavvio del servizio (launchd lo rilancia subito, vedi backend/src/routes/sistemaRoutes.js).
  // Dopo la richiesta il processo muore: aspetta che torni su, poi ricarica la pagina.
  riavviaApp: async () => {
    await richiesta('/sistema/riavvia', { method: 'POST' });
    await new Promise(r => setTimeout(r, 500));
    for (;;) {
      try {
        await fetch(`${BASE_URL}/config`);
        break;
      } catch {
        await new Promise(r => setTimeout(r, 500));
      }
    }
    location.reload();
  },

  // Promemoria timesheet fine mese
  salvaImpostazioniReminder: (dati) => richiesta('/reminder/impostazioni', { method: 'PUT', body: JSON.stringify(dati) }),

  // Dashboard regime forfettario (soglia, imposta stimata, settori ATECO)
  settoriAteco: () => richiesta('/forfettario/settori-ateco'),
  aggiornaSettoriAteco: () => richiesta('/forfettario/settori-ateco/aggiorna', { method: 'POST' }),
  dashboardForfettario: (anno) => richiesta(`/forfettario/dashboard${anno ? `?anno=${anno}` : ''}`),
  modelliGemini: () => richiesta('/forfettario/gemini/modelli'),
  verificaModelloGemini: (modello) => richiesta('/forfettario/gemini/modelli/verifica', { method: 'POST', body: JSON.stringify({ modello }) }),
  verificaModelloGroq: (modello) => richiesta('/forfettario/groq/modelli/verifica', { method: 'POST', body: JSON.stringify({ modello }) }),
  verificaModelloClaude: (modello) => richiesta('/forfettario/claude/modelli/verifica', { method: 'POST', body: JSON.stringify({ modello }) }),

  // Versamenti F24 effettivi (imposta sostitutiva, INPS), inseriti a mano
  versamentiF24: (anno) => richiesta(`/forfettario/versamenti${anno ? `?anno=${anno}` : ''}`),
  aggiungiVersamentoF24: (dati) => richiesta('/forfettario/versamenti', { method: 'POST', body: JSON.stringify(dati) }),
  eliminaVersamentoF24: (id) => richiesta(`/forfettario/versamenti/${id}`, { method: 'DELETE' }),
  anteprimaImportVersamentiF24: (testo) => richiesta('/forfettario/versamenti/importa-testo/anteprima', { method: 'POST', body: JSON.stringify({ testo }) }),
  importaVersamentiF24: (testo) => richiesta('/forfettario/versamenti/importa-testo', { method: 'POST', body: JSON.stringify({ testo }) }),
  urlExportVersamentiF24: (anno) => `${BASE_URL}/forfettario/versamenti/export${anno ? `?anno=${anno}` : ''}`,

  // Data di incasso fatture da CSV home banking (mapping colonne via Gemini)
  analizzaCsvPagamenti: (file) => {
    const form = new FormData();
    form.append('file', file);
    return fetch(`${BASE_URL}/forfettario/pagamenti/analizza-csv`, { method: 'POST', body: form })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).errore || `Errore HTTP ${r.status}`);
        return r.json();
      });
  },
  confermaPagamentoFattura: (anno, mese, clienteId, dataPagamento) =>
    richiesta('/forfettario/pagamenti/conferma', { method: 'POST', body: JSON.stringify({ anno, mese, clienteId, dataPagamento }) }),
  urlExportCommercialista: (anno) => `${BASE_URL}/forfettario/export-commercialista${anno ? `?anno=${anno}` : ''}`,

  // Widget dashboard: fatture non incassate, prossime scadenze fiscali
  fattureAperte: () => richiesta('/forfettario/fatture-aperte'),
  scadenzeFiscali: () => richiesta('/forfettario/scadenze-fiscali'),

  // Template di stampa (fattura/timesheet)
  listTemplates: (tipo) => richiesta(`/templates${tipo ? `?tipo=${tipo}` : ''}`),
  getTemplate: (id) => richiesta(`/templates/${id}`),
};

export const updateApi = {
  stato: () => richiesta('/update/stato'),
  esegui: () => richiesta('/update/esegui', { method: 'POST' }),
};

export const authApi = {
  stato: () => fetch('/auth/stato').then(r => r.json()),
  logout: () => fetch('/auth/logout', { method: 'POST' }),
};
