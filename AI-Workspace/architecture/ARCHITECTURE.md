# Architecture

Confidence: 🟢 confermato da codice · 🟡 inferito · 🔴 ipotesi

## Forma del sistema

🟢 Backend Express monolitico + SPA Vue 3, un solo deployable: in produzione Express serve `frontend/dist` e risponde a `/api`, `/auth`, `/mcp` sulla porta `1969`. In sviluppo Vite gira a parte e fa proxy di `/api` e `/auth` su `localhost:1969` (`frontend/vite.config.js`). Nessun database: file JSON via `jsonStore.js`.

## Pipeline richieste (`backend/src/server.js`)

🟢 Ordine middleware:
1. `express.json()`
2. logger delle richieste `/api`
3. `express-session` (cookie `httpOnly`, `sameSite: lax`, store in memoria di default)
4. `passport.initialize()` e `passport.session()`
5. router
6. `express.static(frontend/dist)` e fallback SPA (`GET /{*splat}` → `index.html`)
7. error handler globale a 4 argomenti (log + `500 { errore }`)

🟢 Router montati:
- `/auth` — non protetto
- protetti da `richiedeAutenticazione`: `/api/config`, `/api/timesheet`, `/api/invoice`, `/api/oauth-config`, `/api/sdi`, `/api/pec`, `/api/import`, `/api/backup`, `/api/reminder`, `/api/forfettario`, `/api/mail`, `/api/sistema`, `/api/update`, `/api/templates`, `/api/regole-fiscali`, `/api/mcp` (configurazione), `/api/chat`
- `/mcp` — fuori dalla sessione: i client MCP non hanno cookie, autenticano con il token (`richiedeToken`)

🟢 `cors` non è più una dipendenza: architettura same-origin.

## Avvio e job in background

🟢 Dopo `listen`: `applicaPercorsoDatiAllAvvio()`, poi i job, tutti con lo stesso schema `setInterval` che rilegge la config a ogni tick:
- `avviaPollingSdi` — ricevute IMAP, intervallo `sdi.intervalloPollingMinuti`
- `avviaBackupAutomatico` — solo se `backup.abilitato`
- `avviaPromemoria` — solo se `reminder.abilitato`
- `avviaPromemoriaScartoSdi`
- `avviaMonitoraggioFonti` — confronto impronte delle fonti normative
- `avviaNotificheFiscali` — F24, bollo, crediti, regole, Intrastat

## Comunicazione frontend ↔ backend

🟢 `frontend/src/services/api.js`: `BASE_URL = '/api'`, `fetch` nativo, helper privato `richiesta()` con header JSON e estrazione uniforme dell'errore. Tre oggetti esportati: `api` (dominio), `updateApi` (`/api/update`), `authApi` (`/auth`, bypassa il wrapper).

🟢 Eccezione voluta: `txBlockchain`, `txPerIndirizzo`, `cambioStoricoBtc`, `cambioAttualeBtc` e simili chiamano direttamente servizi esterni (mempool.space, CoinGecko) dal browser, con avviso privacy in UI.

## Flusso chiave: emettere e inviare una fattura

🟢 1. `FatturaView.vue` → `api.generaFattura` → `POST /api/invoice/:anno/:mese/:clienteId/genera`.
2. `invoiceRoutes.js`: risolve cliente e config, calcola da timesheet (`calcolaCompenso`) o prende importo libero, controlla soglia, numero e data, applica trattamento estero/valuta, rivalsa e dati di pagamento, salva con `saveInvoice`.
3. `GET .../xml`: rigenera con `generaXmlFatturaPA`, valida con `fatturaPaXmlValidator`, restituisce l'allegato.
4. `POST .../invia-pec`: rigenera l'XML e invia via `inviaFatturaViaPec` (nodemailer).
5. Ricevute: `POST /api/sdi/controlla` (manuale) o polling in background → `controllaRicevuteSdi` (imapflow + mailparser), archiviazione su disco, notifica desktop. Cronologia aggregata in `/api/sdi/cronologia`.

🟢 Una fattura già accettata dallo SDI non è rigenerabile: il backend rimanda a una nota di variazione, che l'app non emette (vedi `FEATURE_PROPOSALS.md`).

## Provider AI

🟢 `aiRouterService.js` tenta i provider in cascata, ordine di priorità:
1. Gemini (API key)
2. `agy` CLI (OAuth Gemini)
3. GitHub Copilot CLI
4. Claude (API key)
5. Groq (API key)
6. LLM locale (Ollama `:11434` o LM Studio `:1234`)

🟢 `AI_PROVIDER_DISABILITATI` (`envService.js`) esclude singoli provider. I provider CLI non supportano tool use: i servizi che richiedono ricerca web usano `soloApiKey`.

🟢 Consumatori AI: aggiornamento settori ATECO (`geminiAtecoService`), mapping colonne CSV pagamenti, proroghe e minimale INPS (`scadenzeFiscaliService`), proposte di aggiornamento regole (`monitoraggioFontiService`), spiegazioni e ordine crediti (`regoleFiscaliRoutes`, `forfettarioRoutes`), chat (`chatService`). Dati fiscali personali partono solo con consenso (`config.ai.autorizzaDatiFiscali` o conferma per richiesta).

## Server MCP e chat

🟢 `mcpService.js`: JSON-RPC 2.0 scritto a mano, nessun SDK. Trasporti: stdio (`mcpStdio.js`) e HTTP/SSE (`/mcp`, token). 7 tool in sola lettura con allowlist di campi: `riepilogo_anno`, `scadenze_fiscali`, `versamenti_f24`, `bollo_trimestrale`, `crediti_f24`, `fatture_lista`, `regole_anno`. Abilitazione e token in `config.mcp`.

🟢 `chatService.js` riusa gli stessi tool tramite `callTool`, in un loop testuale JSON (max 5 passi) sopra il router AI. `POST /api/chat`.

## Integrazioni esterne

| Integrazione | Libreria | Dove | Scopo |
|---|---|---|---|
| 🟢 Google OAuth | `passport-google-oauth20` | `lib/auth.js` | Login (whitelist email) |
| 🟢 PEC SMTP | `nodemailer` | `pecService.js`, `pecProvaService.js` | Invio fattura e PEC di prova allo SDI |
| 🟢 PEC IMAP | `imapflow`, `mailparser` | `sdiRicevuteService.js` | Ricezione ricevute/notifiche |
| 🟢 XLSX | `xlsx` | `xlsTimesheetImporter.js` | Import timesheet storici |
| 🟢 XML | `fast-xml-parser` | `xmlInvoiceImporter.js`, `importZipService.js`, `fatturaPaXmlValidator.js` | Import e validazione |
| 🟢 PDF | `pdf-lib`, `pdf2json` | `f24PdfService.js`, `monitoraggioFontiService.js` | Compilazione modello F24 (`pdf-lib`), lettura testo PDF (`pdf2json`) |
| 🟢 Keychain | `keytar` | `configService.js`, `envService.js` | Segreti |
| 🟢 Notifiche | `node-notifier` | `lib/notifier.js` | Notifiche desktop |
| 🟢 Banca d'Italia | `fetch` | `cambiValutaService.js` | Cambi ufficiali (cache in `data/cambi/`) |
| 🟢 Agenzia Entrate | `fetch` | `f24PdfService.js`, `monitoraggioFontiService.js` | Modello F24, documenti fonti (solo domini ufficiali) |
| 🟢 Git | `git` CLI | `updateService.js` | Rilevamento/applicazione aggiornamenti via tag `vX.Y.Z` |

## Persistenza

🟢 Vedi layout in `PROJECT_ANALYSIS.md`. Punti rilevanti:
- numerazione fattura unica, indipendente dalla chiave per cliente dei file
- ricevute SDI e XML scaricati vanno come file grezzi sotto `sdi.percorsoArchivio`, fuori da `jsonStore.js`
- regole fiscali: pacchetto versionato in git (`src/data/regole/`) → copia confermata dall'utente (`data/regole-attive/`) → proposte da AI (`data/regole-proposte/`)

---

## Review Checklist

- **Completeness:** pipeline, router, job, flusso fattura, AI, MCP, integrazioni, persistenza.
- **Accuracy:** verificato su `server.js`, `api.js`, `aiRouterService.js`, `mcpService.js`, route e servizi (2026-10-13).
- **Consistency:** coerente con `PROJECT_ANALYSIS.md`.
- **TODO:** nessuno.
- **Missing information:** schema JSON completo di fatture e timesheet.
- **Open questions:** nessuna.
- **Confidence level:** 🟢.
