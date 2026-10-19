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
    if (corpo.tipo) errore.tipo = corpo.tipo;
    if (corpo.codice) errore.codice = corpo.codice;
    if (corpo.previsione) errore.previsione = corpo.previsione;
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

  // Stato provider CLI + LLM locale per il router AI
  aiRouterStato: () => richiesta('/oauth-config/ai-router-stato'),
  aiRouterLogin: (provider) => richiesta('/oauth-config/ai-router-login', { method: 'POST', body: JSON.stringify({ provider }) }),

  // Ricevute/notifiche SDI (ricezione via PEC, ping manuale oltre al polling automatico)
  controllaRicevuteSdi: () => richiesta('/sdi/controlla', { method: 'POST' }),
  cronologiaPec: () => richiesta('/sdi/cronologia'),

  // PEC guidata: gestori preconfigurati, prova passo-passo, PEC di prova allo SDI
  gestoriPec: () => richiesta('/pec/gestori'),
  provaPec: () => richiesta('/pec/prova', { method: 'POST' }),
  provaPecSdi: () => richiesta('/pec/prova-sdi', { method: 'POST', body: JSON.stringify({ conferma: true }) }),
  risposteProvaPecSdi: (dal) => richiesta(`/pec/prova-sdi/risposte?dal=${encodeURIComponent(dal)}`),

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

  analizzaZip: (file) => {
    const form = new FormData();
    form.append('file', file);
    return fetch(`${BASE_URL}/import/zip/anteprima`, { method: 'POST', body: form })
      .then(async r => { if (!r.ok) throw new Error((await r.json().catch(() => ({}))).errore || `Errore HTTP ${r.status}`); return r.json(); });
  },
  importaZip: (file, selezionati, clienteId) => {
    const form = new FormData();
    form.append('file', file);
    form.append('selezionati', JSON.stringify(selezionati));
    if (clienteId) form.append('clienteId', clienteId);
    return fetch(`${BASE_URL}/import/zip`, { method: 'POST', body: form })
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

  // Server MCP in sola lettura (FP-008)
  statoMcp: () => richiesta('/mcp/stato'),
  impostaMcpAbilitato: (abilitato) => richiesta('/mcp/abilitato', { method: 'PUT', body: JSON.stringify({ abilitato }) }),
  rigeneraTokenMcp: () => richiesta('/mcp/rigenera-token', { method: 'POST' }),

  // Promemoria timesheet fine mese
  salvaImpostazioniReminder: (dati) => richiesta('/reminder/impostazioni', { method: 'PUT', body: JSON.stringify(dati) }),

  // Dashboard regime forfettario (soglia, imposta stimata, settori ATECO)
  settoriAteco: () => richiesta('/forfettario/settori-ateco'),
  sediInps: () => richiesta('/forfettario/sedi-inps'),
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
  versamentiStimati: (anno) => richiesta(`/forfettario/versamenti-stimati${anno ? `?anno=${anno}` : ''}`),
  salvaRateSaldo: (rateSaldo) => richiesta('/forfettario/versamenti-stimati/rate-saldo', { method: 'PUT', body: JSON.stringify({ rateSaldo }) }),
  urlF24Pdf: (anno, indice) => `${BASE_URL}/forfettario/versamenti-stimati/${anno}/f24/${indice}/pdf`,
  bolloTrimestrale: (anno) => richiesta(`/forfettario/bollo/${anno}`),
  urlBolloF24Pdf: (anno, trim) => `${BASE_URL}/forfettario/bollo/${anno}/trim/${trim}/f24/pdf`,
  creditiResiduiF24: () => richiesta('/forfettario/crediti/residui'),
  aggiungiCreditoF24: (dati) => richiesta('/forfettario/crediti', { method: 'POST', body: JSON.stringify(dati) }),
  suggerisciOrdineCrediti: (opzioni) => richiesta('/forfettario/crediti/suggerisci-ordine', { method: 'POST', body: JSON.stringify(opzioni ?? {}) }),
  chatAi: (dati) => richiesta('/chat', { method: 'POST', body: JSON.stringify(dati) }),
  eliminaCreditoF24: (id) => richiesta(`/forfettario/crediti/${id}`, { method: 'DELETE' }),

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
  confermaPagamentoFattura: (anno, mese, clienteId, dataPagamento, importo) =>
    richiesta('/forfettario/pagamenti/conferma', { method: 'POST', body: JSON.stringify({ anno, mese, clienteId, dataPagamento, importo }) }),
  confermaPagamentoBtcFattura: (anno, mese, clienteId, dataPagamento, datiBtc) =>
    richiesta('/forfettario/pagamenti/conferma-btc', { method: 'POST', body: JSON.stringify({ anno, mese, clienteId, dataPagamento, ...datiBtc }) }),
  eliminaPagamentoFattura: (anno, mese, clienteId, indice) =>
    richiesta(`/forfettario/pagamenti/${anno}/${mese}/${clienteId}/${indice}`, { method: 'DELETE' }),
  // F4: recupero dati transazione da mempool.space (TXID, ora blocco, satoshi ricevuti) — avviso privacy: TXID e IP inviati a servizio esterno
  txBlockchain: (txid) => fetch(`https://mempool.space/api/tx/${txid}`).then(async (r) => {
    if (!r.ok) throw new Error(`mempool.space ha risposto ${r.status}`);
    return r.json();
  }),
  // F4: elenco transazioni ricevute su un indirizzo — usato quando manca il TXID ma l'indirizzo è noto. Avviso privacy: indirizzo e IP inviati a mempool.space
  txPerIndirizzo: (indirizzo) => fetch(`https://mempool.space/api/address/${indirizzo}/txs`).then(async (r) => {
    if (!r.ok) throw new Error(`mempool.space ha risposto ${r.status}`);
    return r.json();
  }),
  // F5: cambio storico EUR/BTC da CoinGecko (data in formato DD-MM-YYYY, come richiesto dall'API)
  cambioStoricoBtc: (dataIso) => {
    const [anno, mese, giorno] = dataIso.split('-');
    return fetch(`https://api.coingecko.com/api/v3/coins/bitcoin/history?date=${giorno}-${mese}-${anno}`).then(async (r) => {
      if (!r.ok) throw new Error(`CoinGecko ha risposto ${r.status}`);
      return r.json();
    });
  },
  // Dashboard: cambio EUR/BTC attuale da CoinGecko, per il controvalore odierno degli incassi BTC (fetch solo su richiesta esplicita dell'utente, per privacy IP)
  cambioAttualeBtc: () => fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=eur').then(async (r) => {
    if (!r.ok) throw new Error(`CoinGecko ha risposto ${r.status}`);
    return r.json();
  }),
  // Dashboard: prezzo di mercato BTC/EUR attuale + variazione 24h, per la card "Valore BTC di mercato" (indipendente dagli incassi)
  prezzoMercatoBtc: () => fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=eur&include_24hr_change=true').then(async (r) => {
    if (!r.ok) throw new Error(`CoinGecko ha risposto ${r.status}`);
    return r.json();
  }),
  // Dashboard: storico prezzo BTC/EUR ultimi 30gg da CoinGecko, per lo sparkline della card "Valore BTC di mercato"
  storicoPrezzoMercatoBtc: () => fetch('https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=eur&days=30').then(async (r) => {
    if (!r.ok) throw new Error(`CoinGecko ha risposto ${r.status}`);
    return r.json();
  }),
  // Registro lotti BTC (FP-012/013): movimenti manuali, lotti LIFO, plusvalenze, RW
  movimentiBtc: () => richiesta('/forfettario/btc/movimenti'),
  aggiungiIngressoBtc: (dati) => richiesta('/forfettario/btc/movimenti/ingresso', { method: 'POST', body: JSON.stringify(dati) }),
  aggiungiUscitaBtc: (dati) => richiesta('/forfettario/btc/movimenti/uscita', { method: 'POST', body: JSON.stringify(dati) }),
  eliminaMovimentoBtc: (id) => richiesta(`/forfettario/btc/movimenti/${id}`, { method: 'DELETE' }),
  lottiBtc: (anno) => richiesta(`/forfettario/btc/lotti?anno=${anno}`),
  plusvalenzeBtc: (anno) => richiesta(`/forfettario/btc/plusvalenze?anno=${anno}`),
  rwBtc: (anno) => richiesta(`/forfettario/btc/rw?anno=${anno}`),
  anteprimaUscitaBtc: (dati) => richiesta('/forfettario/btc/plusvalenze/anteprima', { method: 'POST', body: JSON.stringify(dati) }),
  impostaValoreMercatoBtc: (anno, prezzoEurBtc) => richiesta('/forfettario/btc/rw/valore-mercato', { method: 'PUT', body: JSON.stringify({ anno, prezzoEurBtc }) }),
  proposteImportBtc: () => richiesta('/forfettario/btc/import'),
  controllaImportBtc: () => richiesta('/forfettario/btc/import/controlla', { method: 'POST' }),
  azioneProposta: (id, azione, dati = {}) => richiesta(`/forfettario/btc/import/proposte/${id}/${azione}`, { method: 'POST', body: JSON.stringify(dati) }),
  importaFileBtc: (file, { formato = 'auto', mapping, conferma = false } = {}) => {
    const form = new FormData();
    form.append('file', file);
    form.append('formato', formato);
    if (mapping) form.append('mapping', JSON.stringify(mapping));
    if (conferma) form.append('conferma', 'true');
    return fetch(`${BASE_URL}/forfettario/btc/import/file`, { method: 'POST', body: form })
      .then(async (r) => {
        const corpo = await r.json().catch(() => ({}));
        if (!r.ok) throw Object.assign(new Error(corpo.errore || `Errore HTTP ${r.status}`), { codice: corpo.codice });
        return corpo;
      });
  },
  urlExportCommercialista: (anno) => `${BASE_URL}/forfettario/export-commercialista${anno ? `?anno=${anno}` : ''}`,

  // Widget dashboard: fatture non incassate, prossime scadenze fiscali
  fattureAperte: () => richiesta('/forfettario/fatture-aperte'),
  scadenzeFiscali: () => richiesta('/forfettario/scadenze-fiscali'),

  // Template di stampa (fattura/timesheet)
  listTemplates: (tipo) => richiesta(`/templates${tipo ? `?tipo=${tipo}` : ''}`),
  getTemplate: (id) => richiesta(`/templates/${id}`),

  // Regole fiscali versionate per anno
  statoRegoleFiscali: () => richiesta('/regole-fiscali/stato'),
  elencoAnniRegole: () => richiesta('/regole-fiscali'),
  regoleFiscaliAnno: (anno) => richiesta(`/regole-fiscali/${anno}`),
  differenzeRegoleFiscali: (anno) => richiesta(`/regole-fiscali/${anno}/differenze`),
  confermaRegoleFiscali: (anno) => richiesta(`/regole-fiscali/${anno}/conferma`, { method: 'POST' }),
  spiegaDiffRegoleFiscali: (anno) => richiesta(`/regole-fiscali/${anno}/spiega-diff`, { method: 'POST' }),
  spiegaRequisitiAliquotaRidotta: () => richiesta('/regole-fiscali/ai/spiega-requisiti', { method: 'POST' }),
  spiegaSepties: (descrizioneAttivita) => richiesta('/regole-fiscali/ai/spiega-7-septies', { method: 'POST', body: JSON.stringify({ descrizioneAttivita }) }),
  estrattoFonte: (id, citazione) => richiesta(`/regole-fiscali/fonti/${encodeURIComponent(id)}/estratto?citazione=${encodeURIComponent(citazione)}`),
  statoMonitoraggioFonti: () => richiesta('/regole-fiscali/monitoraggio/stato'),
  controllaFontiOra: () => richiesta('/regole-fiscali/monitoraggio/controlla-ora', { method: 'POST' }),
  confermaProposteRegoleFiscali: (anno) => richiesta(`/regole-fiscali/${anno}/conferma-proposte`, { method: 'POST' }),
  scartaProposteRegoleFiscali: (anno) => richiesta(`/regole-fiscali/${anno}/scarta-proposte`, { method: 'POST' }),

  // Cambio valuta da Banca d'Italia
  cambioValuta: (data, valuta) => richiesta(`/forfettario/cambi/${data}/${valuta}`),
  valuteSupportate: () => richiesta('/forfettario/cambi/valute'),
  confermaPagamentoValutaFattura: (anno, mese, clienteId, dataPagamento, dati) => richiesta(
    '/forfettario/pagamenti/conferma-valuta',
    { method: 'POST', body: JSON.stringify({ anno, mese, clienteId, dataPagamento, ...dati }) },
  ),
};

export const updateApi = {
  stato: () => richiesta('/update/stato'),
  esegui: () => richiesta('/update/esegui', { method: 'POST' }),
};

export const authApi = {
  stato: () => fetch('/auth/stato').then(r => r.json()),
  logout: () => fetch('/auth/logout', { method: 'POST' }),
};
