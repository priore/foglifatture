# Project Context

Confidence: 🟢 confermato da codice · 🟡 inferito · 🔴 ipotesi

## Scopo

🟢 App locale (singola macchina, macOS/Windows) per timesheet mensile e fatturazione elettronica italiana in regime forfettario. Nome pubblico: **Fogli & Fatture**.

🟢 Due flussi di fatturazione indipendenti:
- da timesheet (ore × tariffa oraria del cliente)
- a importo e descrizione liberi, senza timesheet (`invoiceRoutes.js`)

🟢 Multi-cliente concorrente: `config.clienti[]`, ogni cliente con id stabile, tariffa, template e dati di pagamento propri. Numerazione fattura unica e progressiva sull'intera partita IVA.

🟢 Oltre alla fatturazione, l'app copre il ciclo fiscale del forfettario:
- dashboard soglie (85.000 € / 100.000 €), imposta sostitutiva e INPS stimate
- piano versamenti F24 con PDF sul modello AdE, bollo trimestrale, crediti compensabili
- incassi (anche in Bitcoin e valuta estera), regole fiscali versionate per anno con fonti normative
- registro lotti BTC: costo di carico LIFO, plusvalenze da redditi diversi, imposta sulle cripto-attività (quadro RW) e righe F24 dedicate
- assistente AI in sola lettura (chat in dashboard, server MCP)

## Utenti

🟢 Un solo operatore (freelancer/consulente) con più clienti. Gira su `localhost:1969`.

🟢 Accesso: login Google OAuth con whitelist `ALLOWED_EMAIL` (una o più email separate da virgola, `lib/auth.js`). Se `GOOGLE_CLIENT_ID`/secret mancano, il login è disattivato (`isAuthConfigurato()` false): scelta voluta per raggiungere Impostazioni al primo avvio.

## Concetti di dominio

- 🟢 **FatturaPA** — XML v1.2.2, `TipoDocumento TD01`, `RegimeFiscale RF19`, Natura `N2.2` (italiani) o `N2.1` (clienti esteri B2B), `DatiBollo` sopra soglia, `DatiPagamento` se configurato, `DatiCassaPrevidenziale TC22` per la rivalsa INPS opzionale. Generatore: `fatturaPaXmlGenerator.js`, validatore: `fatturaPaXmlValidator.js`.
- 🟢 **SDI / PEC** — invio via SMTP (`pecService.js`), ricezione ricevute via IMAP in sola lettura (`sdiRicevuteService.js`, tipi RC/NS/MC/NE/EC/DT/AT). Aiuti di configurazione e PEC di prova in `pecProvaService.js`.
- 🟢 **Regime forfettario** — `forfettarioService.js` (soglie, imposta 5%/15%, INPS gestione separata, competenza vs cassa), `stimaVersamentiService.js` (saldo/acconti/rate).
- 🟢 **Regole fiscali** — pacchetto per anno in `backend/src/data/regole/<anno>.json`, copia confermata dall'utente in `data/regole-attive/`, proposte da monitoraggio fonti in `data/regole-proposte/` (`regoleFiscaliService.js`, `monitoraggioFontiService.js`).
- 🟢 **Cripto-attività** — `lottiBtcService.js` (lotti da rate BTC delle fatture e ingressi manuali, uscite con consumo LIFO, plusvalenze con riporto minusvalenze, IVCA 0,2% proporzionale ai giorni), `movimentiBtcService.js` (movimenti manuali), `importBtcService.js` e `importFileBtcService.js` (proposte di import da blockchain e da file, mai registrate in automatico). Aliquote e codici tributo nella sezione `cripto` di `regole/<anno>.json`; calcolo attivo dal 2026.
- 🟢 **Clienti esteri** — `clienteEsteroService.js`: Natura IVA, diciture, dati anagrafici esteri, Intrastat; valuta e cambio Banca d'Italia in `cambiValutaService.js`.

## Flusso end-to-end

1. 🟢 Configurazione in Impostazioni (fornitore, PEC, percorso dati, backup, promemoria, login, AI) e anagrafica clienti in `/clienti`.
2. 🟢 Timesheet del mese per il cliente attivo, stampa PDF da template (`TimesheetView.vue`).
3. 🟢 Fattura Pro-Forma da timesheet o importo libero, XML validato, invio PEC allo SDI (`FatturaView.vue`).
4. 🟢 Polling IMAP delle ricevute SDI con notifica desktop e promemoria sugli scarti (`sdiRicevuteService.js`, `sdiScartoReminderService.js`).
5. 🟢 Registrazione incassi: manuale, da CSV home banking (mapping colonne via AI), BTC o valuta estera (`pagamentiFattureService.js`). Le rate incassate in BTC alimentano il registro lotti; altri ingressi e uscite si registrano nella vista Bitcoin o si importano da blockchain e file.
6. 🟢 Dashboard: soglie, imposta, INPS, netto; piano F24 con stato (da pagare, pagato) e PDF compilato; bollo trimestrale.
7. 🟢 Import storico: timesheet XLS, fatture XML, archivi ZIP del Cassetto Fiscale, pagamenti CSV, ripristino backup (`ImportaStoricoView.vue`).
8. 🟢 Backup cifrato manuale e automatico, aggiornamento app via tag Git (`backupService.js`, `updateService.js`).

## Obiettivi di prodotto

🟡 Ridurre il lavoro manuale di un forfettario multi-cliente: fatture conformi, chiusura del ciclo SDI, stima di imposta e scadenze con fonti verificabili, dati sempre sulla macchina dell'utente. Dedotto da design e README, nessuna dichiarazione esplicita in repo.

---

## Review Checklist

- **Completeness:** scopo, utenti, dominio, flusso coperti.
- **Accuracy:** verificato su `server.js`, `configService.js`, `fatturaPaXmlGenerator.js`, servizi e viste (2026-10-19).
- **Consistency:** allineato agli altri documenti di `architecture/`.
- **TODO:** nessuno.
- **Missing information:** nessuna.
- **Open questions:** nessuna.
- **Confidence level:** prevalentemente 🟢, un 🟡 sugli obiettivi.
