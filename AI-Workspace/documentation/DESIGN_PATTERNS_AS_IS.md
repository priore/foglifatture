# Design Patterns — As Is

Inventario fattuale dei pattern presenti nel codice. Non è una raccomandazione né un target di refactor.

Confidence: 🟢 confermato da codice · 🟡 inferito · 🔴 ipotesi

---

## Backend (`backend/src/**`)

- 🟢 **Routing → service → data access.** Le route (`routes/*Routes.js`) restano sottili: validazione e chiamata al servizio. La logica sta in `services/*Service.js`, la persistenza passa da `lib/jsonStore.js`. Niente controller a classi, niente ORM.
- 🟢 **Un router per risorsa**, montato in `server.js`. Auth con `richiedeAutenticazione` per mount. `/mcp` è l'eccezione e usa `richiedeToken`.
- 🟢 **Auth a degradazione controllata.** Senza credenziali Google, `isAuthConfigurato()` è false e il middleware lascia passare (primo avvio).
- 🟢 **Sessione**: `express-session` con store in memoria, whitelist email (`ALLOWED_EMAIL`).
- 🟢 **Store a file JSON.** `jsonStore.js` espone `readJson`/`writeJson`/`listKeys` su `DATA_DIR`, mutabile a runtime con `setDataDir` (percorso dati configurabile). Record chiave `<anno>-<mese>-<clienteId>`.
- 🟢 **Merge difensivo della config.** `configService.getConfig()` fonde ogni sezione coi default (`fondiSezione`, `fondiClienti`), così i campi nuovi arrivano anche nei `config.json` già su disco, con normalizzazione in lettura del vecchio formato a cliente singolo.
- 🟢 **Segreti fuori dal JSON.** Password e API key nel Keychain via `keytar`, iniettate in memoria da `getConfig()`. Al client arriva un placeholder mascherato.
- 🟢 **Logger singleton con file dedicato** (`logger`, `pecLogger`, `sdiLogger`).
- 🟢 **Polling `setInterval` condiviso.** SDI, backup, promemoria, scarti SDI, monitoraggio fonti, notifiche fiscali e controllo blockchain BTC rileggono la config a ogni tick, senza scheduler astratto.
- 🟢 **Funzioni pure per i calcoli fiscali.** `stimaVersamentiService.js`, `bolloTrimestrale.js`, `clienteEsteroService.js`, `timeCalculator.js`, il nucleo di `lottiBtcService.js` (LIFO, plusvalenze, IVCA) e `righeCripto` in `stimaVersamentiService.js`: nessuna lettura da disco, input dal chiamante, coperte da test.
- 🟢 **Dipendenze iniettabili nei test.** Servizi come `cambiValutaService.cambioPer(codice, data, deps)` accettano `deps` per sostituire la rete.
- 🟢 **Router AI a cascata** (`aiRouterService.js`): provider in ordine di priorità con fallback su quota esaurita, mai errore se almeno uno risponde.
- 🟢 **Allowlist, non blacklist, per i dati esposti all'AI.** I tool MCP e la chat restituiscono solo i campi elencati nelle funzioni `proietta*`.
- 🟢 **Fonti normative verificabili.** Ogni valore delle regole fiscali porta fonte e citazione, un test verifica che la citazione compaia nel testo archiviato.
- 🟢 **Proposte da confermare, mai scritture automatiche.** L'import BTC (blockchain e file) salva solo proposte in `btcImportProposte.json`; il registro cambia con una conferma esplicita dell'utente.
- 🟢 **Error handler globale** a 4 argomenti: log completo, risposta `500` generica.
- 🟢 **Fallback SPA** su `frontend/dist`.

## Frontend (`frontend/src/**`)

- 🟢 **Composition API e `<script setup>` ovunque.** Nessuna Options API.
- 🟢 **Nessuna libreria di stato globale.** Stato locale per vista, rifetch dal backend. Cliente e mese selezionati vivono nella vista.
- 🟢 **Stato nella query string.** Il passo attivo dei wizard è `?passo=N`, così la sidebar linka direttamente ai passi.
- 🟢 **Facade API.** `services/api.js` raggruppa le chiamate per dominio sopra `richiesta()` con `fetch` nativo.
- 🟢 **Composables per logica condivisa** (`use*.js`).
- 🟢 **Template di stampa dichiarativi.** Handlebars compila `layout.html`/`layout.css` caricati dal backend, montati in un iframe sandboxato senza `allow-scripts`.
- 🟢 **Primitive CSS globali + token.** Stili `scoped` solo per layout locale.
- 🟢 **Persistenza UI in `localStorage`**: tema, tab della dashboard, ordine delle card.
- 🟢 **Wizard come composizione di step**, con elenchi dei passi centralizzati in `wizardImpostazioniPassi.js` e `wizardImportaStoricoPassi.js`.
- 🟢 **Router piatto**, `createWebHistory`, nessuna guard.

---

## Review Checklist

- **Completeness:** backend e frontend, pattern strutturali e di dominio.
- **Accuracy:** verificato su `server.js`, `configService.js`, `jsonStore.js`, `aiRouterService.js`, `mcpService.js`, viste e composables (2026-10-19).
- **Consistency:** coerente con `ARCHITECTURE.md` e `.claude/rules/code-quality.md`.
- **TODO:** nessuno.
- **Missing information:** nessuna.
- **Open questions:** nessuna.
- **Confidence level:** 🟢.
