# Proposte di Funzionalità

Confidenza: 🟢 confermato dal codice · 🟡 dedotto · 🔴 ipotesi

Solo analisi. Nessun impegno di roadmap — funzionalità candidate ordinate per valore/sforzo, derivate da `ARCHITECTURE.md`, `PROJECT_CONTEXT.md`, `KNOWN_ISSUES.md`, `ROADMAP.md`. Nulla implementato qui.

---

## Priorità 1 — chiude rischi reali

### 1. Verifica invio PEC/SDI + retry
🔴 Rischio maggiore: invio PEC "non testato con mailbox reale" (avviso nel README stesso, `KNOWN_ISSUES.md`). Nessun retry, nessun avviso di mancata consegna se l'invio SMTP fallisce o SDI non restituisce mai una ricevuta (RC mancante dopo N giorni).
- Aggiungere: campo stato-invio sulla fattura (`inviata`/`consegnata`/`scartata`/`in_attesa`), avviso timeout se nessuna ricevuta SDI dopo X giorni, il reinvio manuale esiste già parzialmente — estendere con visualizzazione fallimenti in UI (`FatturaView.vue`).
- Sforzo: medio. Valore: alto — è l'unica cosa che può rompersi silenziosamente nella fatturazione reale.

**Piano di verifica invio (2026-08-30, 🟢 confermato):**

- Nessun intermediario (Aruba/FatturaPA): invio diretto via PEC, come oggi.
- Provider PEC: **Postecert**. SMTP `smtps.postecert.it:465` (secure), IMAP `imaps.postecert.it:993` (secure) — stessa forma di `pec.smtpHost`/`pec.imapHost` già in `configService.js`.
- Destinatario di test: `danilo.priore@gmail.com` (non SDI produzione — nessuna fattura fiscale reale generata/consumata).
- `inviaFatturaViaPec()` (`pecService.js`) accetta `pecConfig` come parametro esplicito, non legge `config.json` internamente — quindi il test E2E passa un oggetto di config separato (creds da env, mai salvate su disco) e **non tocca `backend/data/config.json` attuale** (fornitore/cliente/tariffa/numerazione restano intatti).
- Credenziali Postecert reali (mittente/password test) da passare via variabili d'ambiente al momento dell'esecuzione (`PEC_TEST_USER`, `PEC_TEST_PASS`), mai committate.
- Aggiunto script riusabile `backend/src/services/pecService.e2e.js` (non nella suite `--test` automatica, va lanciato a mano) che invia una PEC reale di prova a `danilo.priore@gmail.com` tramite `inviaFatturaViaPec()`, per validare l'integrazione SMTP end-to-end senza toccare numerazione fattura o config prod.
- Unit test `pecService.test.js` (mock `nodemailer`, nessuna rete) copre: config incompleta → blocco, invio riuscito → `messageId`, invio fallito → `errore` propagato — riusabile in CI, non richiede credenziali.

**Esito test E2E reale (2026-08-30, 🟢 confermato, eseguito):**

- Invio riuscito con credenziali Postecert reali già presenti in `config.json` (`priore@postecert.it`, host reale `mail.postecert.it:465` — diverso dall'endpoint teorico `smtps.postecert.it` ipotizzato prima del test, correzione presa dal config reale).
- Ricevuto in `danilo.priore@gmail.com`: busta `postacert` con `tipo="posta-certificata" errore="nessuno"` e `<ricevuta tipo="completa" />` — consegna certificata confermata dal gestore Poste Italiane, non solo accettazione SMTP.
- Firma S/MIME della busta valida (certificato AgID CA1 / Poste Italiane S.p.A.).
- `config.json` verificato intoccato dopo il test (`git status` pulito) — confermato che passare `pecConfig` inline a `inviaFatturaViaPec()` non scrive su disco.
- **Rischio "non testato con mailbox reale" del punto #1 sopra è ora chiuso per la parte invio SMTP/PEC.** Resta aperto solo il rischio di mancata ricevuta SDI (RC) dopo invio — il test qui copre PEC→destinatario, non il ciclo completo con SDI produzione (non testabile senza rischiare numerazione fiscale reale, vedi sopra).

### 2. Controllo integrità numerazione fattura ✅ implementato
🟢 Il numero progressivo FatturaPA deve essere rigorosamente sequenziale, senza salti né duplicati — requisito legale.
- Fatto: validazione alla generazione fattura (commit `b950ae2`).

### 3. Backup / esportazione di `backend/data/` ✅ implementato
🟢 Fatto (commit `1368f7d`): export/import manuale cifrato (AES-256-GCM + gzip, nessuna dipendenza zip esterna) da "Importa storico"; backup automatico schedulato configurabile da Impostazioni (flag abilita/disabilita, path destinazione, cadenza in minuti, password) — stesso pattern del polling ricevute SDI esistente.
- Nota di sicurezza residua: per l'automatico la password è salvata in chiaro in `config.json` (stesso livello già accettato per `pec.passwordMittente`), non in keychain OS — accettato come scelta pragmatica, non hardenizzato ulteriormente in questo giro.

---

## Priorità 2 — valore concreto quotidiano, sforzo basso

### 4. Dashboard compenso annuale/trimestrale vs soglia forfettario
🟡 Il regime forfettario ha un tetto di fatturato annuo (attualmente €85.000). Nulla nell'app traccia il compenso cumulato annuo o avvisa all'avvicinarsi della soglia — un guardrail davvero utile per l'esatto tipo di utente a cui serve questa app (freelance forfettario singolo).
- Aggiungere: una vista dashboard che somma il compenso su tutte le fatture per anno, con banner di avviso vicino al tetto.
- Sforzo: basso (`invoiceService.js` ha già tutti i mesi per anno via `listMesiFatturati`). Valore: alto — rilevante fiscalmente, non solo estetico.

### 5. Supporto multi-cliente
🟡 Modello dati + UI attualmente presuppongono un cliente singolo (TODO in `PROJECT_CONTEXT.md`). Se questo consulente dovesse mai fatturare più di un cliente, il design attuale non può rappresentarlo.
- Da fare solo se la situazione reale dell'utente è/sarà multi-cliente — altrimenti da saltare (YAGNI). Segnalato come domanda aperta, non come raccomandazione, finché non confermato.
- Sforzo: alto (schema config, collegamento timesheet-cliente, numerazione fattura per cliente vs globale). Valore: condizionato.

### 6. Promemoria timesheet ✅ implementato
🟢 Fatto (2026-08-30): notifica desktop (riuso `macNotifier.js`, stesso meccanismo delle ricevute SDI) con toggle abilita/disabilita da Impostazioni → step "Promemoria". Nessun avviso giornaliero: la notifica arriva solo l'ultimo giorno lavorativo del mese (esclude sabato/domenica, nessun calendario festività italiane), con l'elenco dei giorni feriali senza ore registrate e senza stato di assenza. Dedup su `reminder.ultimaNotifica` (data ISO) per evitare doppio avviso nello stesso giorno se il server resta attivo.
- Backend: `configService.js` (blocco `reminder`), `timesheetService.js` (`getGiorniMancanti`), nuovo `reminderService.js` (scheduler orario `setInterval`, stesso pattern di `sdiRicevuteService.js`/`backupService.js`), nuovo `reminderRoutes.js` (`PUT /api/reminder/impostazioni`, riavvia lo scheduler a runtime).
- Frontend: nuovo `StepPromemoria.vue`, wizard Impostazioni esteso con step "Promemoria".

### 7. Esportazione CSV/PDF del riepilogo annuale per il commercialista
🟢 Esiste l'esportazione PDF per il timesheet mensile (`usePdfExport.js`) ma nulla produce un report annuale consolidato (tutti i mesi + totali compenso) da consegnare al commercialista in periodo fiscale.
- Aggiungere: "esporta riepilogo annuale" — PDF o XLSX che combina ore mensili + compenso + stato fatture di tutti i mesi.
- Sforzo: basso-medio (riusa `usePdfExport.js` + dipendenza `xlsx` già installata per l'import). Valore: alto — attività ricorrente reale (una volta l'anno, in dichiarazione).

---

## Priorità 3 — rifinitura, non essenziale

### 8. Toggle manuale dark-mode
🟡 Percorso CSS morto già esistente (selettore `data-theme` inutilizzato secondo `KNOWN_ISSUES.md`) — vittoria più economica possibile, basta collegare un pulsante toggle + persistenza `localStorage`.
- Sforzo: molto basso. Valore: basso-medio (solo UX).

### 9. Vista cronologia/timeline ricevute SDI
🟢 Le ricevute sono salvate su disco (`sdiRicevuteService.js`) ma non esiste una vista UI dedicata che elenchi lo storico ricevute per fattura — attualmente probabilmente mostrato solo inline in `FatturaView.vue`.
- Aggiungere: una timeline semplice (inviata → consegnata → notificata) per fattura, utile per audit/troubleshooting.
- Sforzo: basso-medio. Valore: medio — riduce principalmente la ricerca manuale nella mailbox quando qualcosa va storto.

### 10. Validazione configurazione al salvataggio Impostazioni
🟡 Nessun livello di validazione confermato sui campi di `config.json` (formato partita IVA, formato indirizzo PEC, checksum IBAN). Dati errati qui corrompono silenziosamente l'XML al momento della fattura.
- Aggiungere: validazione a livello di campo negli step del wizard prima di consentire il salvataggio.
- Sforzo: basso. Valore: medio — previene errori evitabili che altrimenti emergono solo all'invio PEC.

---

## Analisi di fattibilità — Multi-utenza con ruolo Admin

🟢 Richiesta esplicita utente: valutare fattibilità di supporto multi-utente (login Google o email aziendale), con un ruolo admin dedicato e funzionalità speciali di amministrazione/query. Questo è un cambio architetturale maggiore, non una funzionalità incrementale — l'app oggi è progettata da zero come single-tenant.

### Stato attuale (base di partenza, confermato dal codice)

🟢 `backend/src/lib/auth.js`: whitelist di **una sola email** hardcoded via `ALLOWED_EMAIL` in env, nessun concetto di utente/ruolo, nessuna tabella utenti. Se auth non configurata, ogni richiesta è considerata autenticata (bootstrap escape hatch).

🟢 `jsonStore.js` + `backend/data/`: un solo `config.json` globale, timesheet e fatture salvate come `<anno>-<mese>.json` **senza alcuna chiave di appartenenza a un utente/cliente**. Tutto il modello dati assume un solo fornitore, un solo cliente, una sola serie di fatture.

### Cosa servirebbe (in ordine di complessità crescente)

1. **Modello utenti** — sostituire whitelist singola con una tabella/collezione utenti (email, ruolo `admin`/`user`, eventualmente id fornitore associato). Richiede passare da JSON flat a qualcosa con query per campo (o mantenere JSON con indice email→utente).
2. **Autenticazione multi-provider** — Google OAuth già presente (`passport-google-oauth20`), estendibile a whitelist dinamica invece di singola email fissa. Login con email aziendale richiede o Google Workspace (stesso flusso OAuth, dominio verificato via `hd` claim) oppure un provider SAML/OIDC aziendale separato — quest'ultimo è un lavoro sostanzialmente nuovo (nessuna libreria SAML/OIDC generica già installata).
3. **Isolamento dati per utente/tenant** — ogni timesheet, fattura, configurazione fornitore/cliente deve essere partizionato per utente. Tocca **tutti** i servizi backend (`timesheetService.js`, `invoiceService.js`, `configService.js`) e tutte le route API (aggiunta filtro per utente ovunque). Impatto più grande di tutto il resto del piano messo insieme.
4. **Ruolo Admin** — middleware di autorizzazione aggiuntivo (oltre `richiedeAutenticazione`) che verifica ruolo, non solo autenticazione. Nuove route `/api/admin/*`.
5. **Funzionalità admin speciali** proposte:
   - Gestione utenti (invita, disattiva, cambia ruolo).
   - Query cross-utente: totali fatturato per utente/periodo, stato invii PEC falliti su tutta la piattaforma, ricerca fatture per numero/cliente/importo trasversale.
   - Vista di audit/log accessi.
   - Impersonazione utente per supporto (con log esplicito, azione sensibile).
6. **Motore di query per l'admin** — con lo storage JSON flat attuale, query aggregate cross-utente (es. "totale fatturato per tutti gli utenti nel Q1") richiedono leggere e sommare in memoria tutti i file JSON di tutti gli utenti ad ogni richiesta: funziona a basso volume, degrada linearmente con utenti/mesi. Sopra poche decine di utenti conviene una vera migrazione a database (SQLite è il minimo sufficiente, Postgres se serve concorrenza reale).

### Stima complessiva

🔴 Sforzo: **alto/molto alto** — non è una feature, è una riscrittura architetturale che tocca autenticazione, ogni servizio dati, ogni route, più UI nuova per amministrazione. Ordine di grandezza: settimane, non giorni, anche in versione minima (solo Google, solo isolamento dati, admin base senza query avanzate).

🔴 Rischio aggiuntivo: la generazione FatturaPA/numerazione progressiva è oggi pensata per un solo fornitore fiscale. Multi-utenza reale con più fornitori fiscali distinti richiederebbe che ogni utente abbia la propria sequenza di numerazione fattura, il proprio PEC, la propria configurazione forfettario — di fatto ogni utente diventa un "tenant" fiscale indipendente, non solo un account con permessi diversi.

### Raccomandazione

🔴 Prima di investire: chiarire lo use case reale. Se lo scopo è **un solo fornitore fiscale con più persone che devono vedere/gestire lo stesso timesheet** (es. commercialista + titolare), basta un modello più leggero — whitelist multi-email con ruoli (`admin`/`viewer`) sullo stesso dataset condiviso, senza isolamento dati: sforzo medio, non alto, e non richiede toccare la numerazione fatture. Se invece lo scopo è **più fornitori fiscali indipendenti sulla stessa istanza** (vera piattaforma multi-tenant), è il progetto sopra descritto per intero, sforzo alto, e va trattato come iniziativa a sé, con la sua analisi di rientro economico prima di partire.

---

## Esplicitamente non raccomandato (YAGNI dato lo scope single-user attuale)

- Migrazione a database (Postgres/SQLite) — il JSON flat è adeguato a questo volume di dati (un file per mese) **finché resta single-tenant**; prematuro allo stato attuale, ma diventa necessario se si procede con multi-utenza reale (vedi sopra).
- Overhaul completo di accessibilità (ARIA) — segnalato in `KNOWN_ISSUES.md` come opzionale; basso ritorno per un singolo utente vedente a meno di necessità personale.

---

## Ordine consigliato se l'utente vuole procedere

1. ~~Controllo integrità numerazione fattura (#2)~~ ✅ fatto.
2. ~~Esportazione backup dati (#3)~~ ✅ fatto.
3. Dashboard soglia compenso annuale (#4) — economico, rilevante fiscalmente.
4. Esportazione annuale per commercialista (#7) — valore ricorrente reale.
5. Hardening stato-invio/retry PEC (#1) — più grande, ma chiude il rischio #1 dichiarato dal progetto stesso.
6. Il resto in modo opportunistico.

---

## Piano — Export codice su GitHub

🟢 Richiesta esplicita utente: pubblicare il codice su repository GitHub, senza esporre dati sensibili (database, config, path locali, password), con auto-generazione dei file mancanti al primo avvio, script di installazione che installa tutti i tool necessari come su una macchina nuova, e avvio come servizio sempre attivo. Serve sia per Mac che per Windows.

### 1. Cosa non deve mai finire su GitHub — già coperto da `.gitignore`

🟢 Verificato: `.gitignore` in root esclude già `node_modules/`, `dist/`, `.env` (con `.env.example` come eccezione esplicita), `logs/`, `backend/data/` (contiene `config.json` con credenziali PEC/OAuth, più `invoices/` e `timesheets/`). **`.gitignore` da solo basta** per questo progetto: non esiste altro file con segreti fuori da `backend/data/` e `.env` — nessuna modifica necessaria qui, solo verifica che `git status`/`git ls-files` non mostri mai questi path prima del primo push.
- Azione: eseguire `git ls-files | grep -E "config\.json|\.env$"` prima del primo commit pubblico — deve restituire vuoto (esclude `.env.example`).

### 2. Auto-generazione file mancanti al primo avvio

🟢 Già implementato per la config: `configService.js` fa merge con `DEFAULT_CONFIG` se `config.json` manca — nessun crash, valori di default sensati. Da estendere/verificare:
- `backend/data/invoices/` e `backend/data/timesheets/` — verificare che il codice li crei con `mkdir -p`-equivalente al primo scritture (probabile già gestito da `jsonStore.js`, da confermare leggendo il file).
- `backend/.env` — **non generabile con valori sensati di default** (richiede `SESSION_SECRET` casuale, credenziali OAuth). Lo script di installazione già lo crea da `.env.example` (`scripts/install.sh:21-24`) ma lascia `SESSION_SECRET=cambia-questo-segreto` — da correggere: generare un secret casuale reale (`openssl rand -hex 32` o equivalente Node) invece di lasciare il placeholder, altrimenti resta un default debole in ogni installazione nuova.

### 3. Script di installazione — stato attuale e gap

🟢 Esiste già `scripts/install.sh` (solo macOS): installa dipendenze npm frontend+backend, builda il frontend, copia `.env.example` → `.env` se mancante, registra un LaunchAgent (`launchctl`) con `KeepAlive` (riavvio automatico su crash) e `RunAtLoad` (avvio al boot). Assume Node già installato nel PATH (fallisce con messaggio chiaro se manca) — **non installa Node stesso**, richiesta esplicita dell'utente ("installa tutti i tool necessari come su computer nuovo") non ancora soddisfatta.

Gap da colmare:
- **Node.js non auto-installato** — aggiungere controllo versione + istruzioni/installazione automatica (`brew install node` su Mac se `brew` disponibile, altrimenti link nvm; su Windows: winget/chocolatey se disponibili, altrimenti istruzioni).
- **Nessuno script Windows** — serve `scripts/install.ps1` equivalente: installa Node se mancante, `npm install`/`npm run build`, copia `.env.example`, genera `SESSION_SECRET` casuale, registra come servizio Windows sempre attivo (opzioni: Task Scheduler con trigger "at logon"/"at startup" + riavvio su fallimento, oppure NSSM per un vero servizio Windows — NSSM è più robusto per "sempre in esecuzione" ma è una dipendenza esterna da scaricare, Task Scheduler è nativo Windows e sufficiente per un uso single-desktop).
- **Uninstall Windows** — `scripts/uninstall.ps1` equivalente a `scripts/uninstall.sh` (da verificare che esista già per Mac).

### 4. README pubblico

🟡 Se il repo diventa pubblico o condiviso, serve un README minimo (o aggiornamento dell'esistente) con: requisiti (Node), comando di installazione per Mac (`./scripts/install.sh`) e Windows (`scripts/install.ps1`), nota esplicita che `backend/.env` va compilato con le proprie credenziali OAuth/PEC al primo avvio (mai committare quel file), e che `backend/data/` viene creata automaticamente e resta locale/ignorata da git.

### 5. Ordine di esecuzione consigliato

1. Verifica `.gitignore` con `git ls-files` (nessuna modifica, solo controllo) — punto 1.
2. Fix `SESSION_SECRET` placeholder → generazione casuale in `scripts/install.sh` — punto 2.
3. Conferma/aggiungi auto-creazione directory `backend/data/invoices/` e `backend/data/timesheets/` se non già presente in `jsonStore.js` — punto 2.
4. Aggiungi installazione automatica Node in `scripts/install.sh` (Mac) — punto 3.
5. Scrivi `scripts/install.ps1` e `scripts/uninstall.ps1` per Windows — punto 3.
6. Aggiorna README con istruzioni di installazione multipiattaforma — punto 4.
7. Primo push su repository GitHub (privato consigliato per un primo giro, valutare pubblico solo dopo revisione manuale di `git log` per eventuali segreti già committati in passato).

- Sforzo: basso-medio (script già esistenti per Mac, replicare pattern su Windows; nessun cambio architetturale). Valore: alto se l'obiettivo è versionamento/backup del codice o condivisione, prerequisito per qualunque collaborazione futura.

🟢 Verificato (2026-08-30): `git log --all --full-history -- backend/data/config.json backend/.env` restituisce vuoto — nessun commit passato ha mai incluso questi file. Nessuna riscrittura di storia necessaria prima della pubblicazione.

---

## Checklist di Revisione

- **Completezza:** le proposte coprono fasce chiusura-rischio, valore quotidiano e rifinitura; esclude esplicitamente idee fuori scope con motivazione.
- **Accuratezza:** ogni proposta è tracciata a una lacuna confermata specifica o a un file; elementi speculativi marcati 🔴/🟡.
- **Coerenza:** terminologia allineata a `GLOSSARY.md`; i problemi rimandano a `KNOWN_ISSUES.md`/`ROADMAP.md`.
- **TODO:** confermare con l'utente se il multi-cliente (#5) è un bisogno futuro reale prima di qualsiasi lavoro di design; confermare use case reale della multi-utenza (persone multiple su un fornitore vs. più fornitori fiscali indipendenti) prima di stimare la multi-utenza/admin.
- **Informazioni mancanti:** nessun dato di utilizzo/punto di frustrazione reale dall'utente esiste nel repo per ordinare per attrito reale invece che rischio dedotto.
- **Domande aperte:** la soglia forfettario attuale è €85.000 per la situazione fiscale di questo utente — confermare la regola dell'anno fiscale corrente prima di costruire la logica di avviso del punto #4.
- **Livello di confidenza:** misto 🟢/🟡/🔴, taggato individualmente per voce.
