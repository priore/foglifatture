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

### 4. Dashboard compenso annuale/trimestrale vs soglia forfettario ✅ implementato
🟢 Fatto (2026-08-30): nuova `DashboardView.vue` (voce sidebar "Dashboard forfettario") con 4 stat tile (ricavi cumulati, reddito imponibile, imposta stimata, proiezione fine anno) e due grafici a ciambella separati (`DonutChart.vue`, SVG puro, nessuna libreria) stile Flat-Tax: "Composizione compenso" (ricavi/compensi, reddito fiscale, imposta stimata — proporzionati tra loro) e "Soglia forfettario" (ricavi cumulati vs margine residuo agli 85.000€, con % al centro).
- Backend: nuova sezione `config.forfettario` (`sogliaAnnua` default 85.000€ configurabile, `codiceAteco`, `settoreAteco`, `coefficenteRedditivita`, `dataInizioAttivita`) in `configService.js`; nuovo `forfettarioService.js` (`calcolaDashboardForfettario`: somma `imponibile` di tutte le fatture dell'anno via `invoiceService.listMesiFatturati`/`getInvoice`, calcola reddito imponibile = ricavi × coefficiente, imposta = reddito × aliquota, proiezione lineare fine anno); nuova route `GET /api/forfettario/dashboard` e `GET /api/forfettario/settori-ateco`.
- Aliquota 5%/15%: 5% nei primi 5 anni solari dall'inizio attività (`dataInizioAttivita`), 15% dal sesto anno — logica in `aliquotaImposta()`.
- Codici ATECO: dati sorgente da repo Gitea locale `danilo/Flat-Tax` (progetto iOS Flat-Tax, stesso autore) — estratti 520 codici unici (codice, descrizione, settore, coefficiente di redditività) da `Resources/codici_ateco.json` in `backend/src/data/atecoSettori.json`. Selezione in Impostazioni → step "Forfettario" (`StepForfettario.vue`): campo di ricerca libera che filtra per codice/descrizione/settore (nessuna libreria, filtro client-side su elenco già scaricato), selezione auto-compila settore e coefficiente, resta modificabile.
- Verificato con Playwright: build frontend, riavvio backend, ricerca codice "62.01" → selezione "62.01.00 — Produzione di software non connesso all'edizione" (Informatica e Web, 67%) + data inizio 2024-01-15 → aliquota 5% applicata, imposta ricalcolata, entrambi i donut aggiornati, config.json verificato persistito.

### 5. Supporto multi-cliente ✅ implementato
🟢 Fatto (2026-08-30, branch `feature/multi-cliente`): supporto a clienti concorrenti — più clienti attivi in parallelo, ciascuno con proprio timesheet, propria fattura, propria tariffa oraria. Analisi di fattibilità dettagliata in `AI-Workspace/documentation/MULTI_CLIENTE_ANALISI.md`.
- Backend: `config.cliente` singolo → `config.clienti[]` (id `crypto.randomUUID()`, `attivo` per cancellazione logica — mai rimozione fisica, le fatture/timesheet storici di un cliente disattivato restano risolvibili). `tariffaOraria` spostata da `fatturazione` (globale) a per-cliente. Chiave di persistenza timesheet/fatture `anno-mese.json` → `anno-mese-clienteId.json` (nessuna migrazione dati, confermato accettabile perdere il singolo record preesistente sotto la vecchia chiave). `invoiceService.verificaIntegritaNumerazione`/`tutteLeFatture` riscritte per leggere `clienteId` dal contenuto della fattura deserializzata (mai dalla chiave file) — la numerazione progressiva resta **un'unica sequenza cross-cliente**, vincolo legale legato alla P.IVA fornitore, non al cliente. `fatturaPaXmlGenerator.js` invariato (riceveva già `cliente` come parametro esplicito). Import storico XML risolve `clienteId` dalla partita IVA nel `CessionarioCommittente`, con fallback esplicito richiesto se il match non è univoco.
- Bug scoperti e corretti durante il testing end-to-end: `forfettarioService.ricaviAnno` faceva `c.startsWith`/`c.split('-')` su chiavi ormai diventate oggetti parsati (TypeError a runtime sulla dashboard); `verificaIntegritaNumerazione` rifiutava la rigenerazione di una fattura che non era più "l'ultima della sequenza globale" (scenario possibile solo con più clienti, dove un altro cliente può aver fatturato dopo nello stesso mese) — corretto riconoscendo esplicitamente il caso "riusa il proprio numero esistente" prima del controllo sequenza.
- Frontend: `StepClienti.vue` (nuovo) sostituisce `StepCliente.vue` singolo in Impostazioni — elenco con ricerca (visibile sopra 1 cliente), aggiunta, disattivazione a doppia conferma, sezione "Clienti disattivati" per riattivare. `ClienteSwitcher.vue` (nuovo) sostituisce lo `<select>` nativo in Timesheet/Fattura con un dropdown custom (un `<select>` non permette al testo del bottone selezionato di andare a capo su nomi lunghi) con ricerca propria (visibile sopra 5 clienti), larghezza fissa 260px per non spingere gli altri bottoni della riga azioni a capo. Selezione persistita in `localStorage`.
- Rifinitura correlata: wizard Impostazioni spostato da tab orizzontali (`WizardSteps.vue`, eliminato) a submenu verticale in `AppSidebar.vue` sotto la voce "Impostazioni", stato del passo nella query string (`?passo=N`) invece che in un ref locale.
- Esplicitamente fuori scope (YAGNI): cancellazione fisica dello storico cliente, vista dashboard forfettario per-cliente (resta aggregata su tutti i clienti, corretto perché la soglia €85.000 è per P.IVA fornitore, non per cliente).
- Verificato end-to-end via curl e Playwright: 2 clienti nello stesso mese → numerazione fattura progressiva consecutiva (1, 2) distinta, rigenerazione corretta, XML con anagrafica del cliente giusto, dashboard forfettario aggregata correttamente sui ricavi di entrambi. Suite `node --test` backend 23/23 verde (inclusi nuovi test cross-cliente in `invoiceService.test.js`, nuovo `forfettarioService.test.js`).

### 6. Promemoria timesheet ✅ implementato
🟢 Fatto (2026-08-30): notifica desktop (riuso `macNotifier.js`, stesso meccanismo delle ricevute SDI) con toggle abilita/disabilita da Impostazioni → step "Promemoria". Nessun avviso giornaliero: la notifica arriva solo l'ultimo giorno lavorativo del mese (esclude sabato/domenica, nessun calendario festività italiane), con l'elenco dei giorni feriali senza ore registrate e senza stato di assenza. Dedup su `reminder.ultimaNotifica` (data ISO) per evitare doppio avviso nello stesso giorno se il server resta attivo.
- Backend: `configService.js` (blocco `reminder`), `timesheetService.js` (`getGiorniMancanti`), nuovo `reminderService.js` (scheduler orario `setInterval`, stesso pattern di `sdiRicevuteService.js`/`backupService.js`), nuovo `reminderRoutes.js` (`PUT /api/reminder/impostazioni`, riavvia lo scheduler a runtime).
- Frontend: nuovo `StepPromemoria.vue`, wizard Impostazioni esteso con step "Promemoria".

### 7. Esportazione CSV/PDF del riepilogo annuale per il commercialista
🟢 Esiste l'esportazione PDF per il timesheet mensile (`usePdfExport.js`) ma nulla produce un report annuale consolidato (tutti i mesi + totali compenso) da consegnare al commercialista in periodo fiscale.
- Aggiungere: "esporta riepilogo annuale" — PDF o XLSX che combina ore mensili + compenso + stato fatture di tutti i mesi.
- Sforzo: basso-medio (riusa `usePdfExport.js` + dipendenza `xlsx` già installata per l'import). Valore: alto — attività ricorrente reale (una volta l'anno, in dichiarazione).

---

### 11. Fattura a importo libero (senza timesheet) ✅ implementato
🟢 Fatto (2026-08-30): nuova modalità "Importo libero" in `FatturaView.vue` (radio Da timesheet / Importo libero), alternativa al calcolo ore×tariffa per chi deve fatturare un importo e una dicitura arbitrari senza passare dal timesheet mensile.
- Backend: `invoiceService.js` — `calcolaCompenso` (ore×tariffa) ora delega a nuova `calcolaBollo(imponibile, sogliaBolloVirtuale, importoBollo)`, estratta per essere riusata anche con un imponibile diretto. `invoiceRoutes.js` — `POST /:anno/:mese/genera` ramifica su `req.body.importo` presente (manuale, richiede anche `descrizione` esplicita, niente default) vs assente (comportamento invariato, legge timesheet); nuova `GET /:anno/:mese/anteprima-manuale?importo=` per anteprima bollo/netto senza salvare. `oreTotali`/`tariffaOraria` diventano `null` sulla fattura manuale salvata.
- `fatturaPaXmlGenerator.js`: riga XML `Quantita`/`PrezzoUnitario` usa fallback quantità 1 / prezzo unitario = imponibile quando `oreTotali`/`tariffaOraria` sono `null` — nessun altro campo XML toccato, FatturaPA resta valida.
- Numerazione progressiva, PEC, ricevute SDI, dashboard forfettario: **nessuna modifica** — leggono solo `imponibile`/`numero`, indifferenti alla provenienza della fattura.
- Bug preesistente scoperto testando (non causato da questa feature, non corretto qui): `verificaIntegritaNumerazione` fa `Number(f.numero)` su tutte le fatture per calcolare il progressivo atteso; la fattura reale `2026-08.json` ha `numero: "08/2026"` (formato con barra, non il "progressivo puro" che il codice stesso dichiara nei commenti) → `Number("08/2026")` = `NaN` → blocca la generazione di **qualsiasi** fattura successiva, manuale o da timesheet. Da sistemare separatamente prima di generare la prossima fattura reale.

## Priorità 3 — rifinitura, non essenziale

### 8. Toggle manuale dark-mode ✅ implementato
🟢 Fatto (2026-08-30, commit `8960f30`): bottone toggle in `AppSidebar.vue` (footer sidebar), collega il selettore `data-theme` già presente in `style.css` (prima morto). Persistenza `localStorage('theme')`; applicazione del tema salvato in `frontend/index.html` prima del mount Vue per evitare flash.

### 9. Vista cronologia/timeline ricevute SDI ✅ implementato
🟢 Fatto (2026-08-30): nuova funzione `listaRicevutePerFattura()` in `sdiRicevuteService.js` che legge la cartella archivio e filtra i file XML per prefisso `IT<piva>_<progressivoInvio>` (stesso nome generato da `generaNomeFileXml`), riusando `riconosciTipo()` già esistente. Nuova route `GET /api/invoice/:anno/:mese/ricevute-sdi`. `FatturaView.vue` mostra l'elenco ricevute (tipo + data) nella card "Ricevute SDI" esistente, aggiornato dopo generazione fattura, invio PEC e controllo manuale/automatico. Nessuno stato nuovo persistito: il filesystem archivio resta l'unica fonte di verità.

### 10. Validazione configurazione al salvataggio Impostazioni ✅ implementato
🟢 Fatto (2026-08-30). Nota: IBAN non esiste nel modello dati (`configService.js` non ha mai avuto un campo IBAN in nessuna sezione) — nessuna fattura/pagamento lo richiede oggi, quindi non c'era nulla da validare per quel campo, rimosso dallo scope.
- Frontend: aggiunta `pecValida()` (regex formato email) in `useValidazioneFiscale.js`, applicata a `StepPec.vue` (campo `casellaMittente`) con lo stesso pattern visivo già usato per partita IVA/codice fiscale/codice SDI (classe `campo-non-valido` + `nota-errore`).
- Backend (rete di sicurezza indipendente dal client, dove prima non c'era alcun controllo): nuova `validaConfig()` in `configService.js` con le stesse regex del frontend (partita IVA 11 cifre, codice fiscale, codice SDI 7 caratteri, PEC formato email), richiamata in `configRoutes.js` PUT `/api/config` — risponde `400 { errore }` e non scrive `config.json` se un campo presente nel payload non è valido. Pattern coerente con la gestione errori già in uso in `invoiceRoutes.js` (validazione esplicita in route, non throw).
- Verificato via curl: payload con `partitaIva` non numerica o `casellaMittente` non email → 400 con messaggio, config non scritta; payload valido → 200, salvataggio normale invariato.

### 12. Sicurezza codifica dati sensibili e password in `backend/data/`
🔴 Rischio residuo: `config.json` (in `backend/data/`, escluso da `.gitignore` ma leggibile in chiaro sul filesystem locale) contiene credenziali in chiaro: `pec.passwordMittente` (password PEC/SMTP), `backup.password` (chiave cifratura backup AES-256). Nessun meccanismo di protezione a riposo attualmente.
- **Superfici di rischio concrete:**
  - `config.json` leggibile da qualsiasi processo con accesso al filesystem utente (nessun permesso restrittivo applicato).
  - Backup automatico scrive `config.json` non cifrato nell'archivio backup — la password di cifratura AES-256 è nello stesso file che protegge.
  - `backend/data/` sul disco in chiaro se FileVault disabilitato su Mac o BitLocker disabilitato su Windows (non verificati né forzati dall'installer).
- **Soluzione scelta: `keytar` — Keychain nativo OS, cross-platform.**
  - `keytar` è una libreria npm nativa che wrappa trasparentemente: Mac Keychain, Windows Credential Manager, Linux libsecret. Un'unica implementazione Node.js copre entrambe le piattaforme target (Mac e Windows).
  - I campi `pec.passwordMittente` e `backup.password` vengono rimossi da `config.json` e salvati nel Keychain OS al primo salvataggio da Impostazioni — mai più scritti su disco in chiaro.
  - A runtime `configService.js` li legge dal Keychain via `keytar.getPassword(service, account)` e li inietta in memoria nella config attiva — `config.json` non contiene mai le password, nemmeno vuote.
- **UX — come e quando vengono richieste le password all'utente:**
  - **Primo inserimento:** le password vengono inserite dall'utente nei campi già esistenti in Impostazioni (`StepPec.vue` → campo `passwordMittente`, step backup → campo `password`). Al salvataggio, invece di scrivere in `config.json`, vengono passate a `keytar.setPassword()`. Dal punto di vista dell'utente l'interfaccia non cambia — stessi campi, stesso flusso.
  - **Modifica:** l'utente torna in Impostazioni, inserisce la nuova password nel campo (che mostra `●●●●●●●●` come placeholder se una password è già nel Keychain), salva — `keytar.setPassword()` sovrascrive la voce precedente.
  - **Prima apertura su Mac/Windows senza Keychain configurato:** nessun prompt OS aggiuntivo da parte del backend — il Keychain nativo non richiede autenticazione separata se la sessione utente è già aperta.
  - **Da valutare:** se mostrare in Impostazioni un banner/avviso "Password salvata nel Keychain OS" vs "Password non ancora configurata" (stato leggibile via `keytar.getPassword() !== null`) — utile per onboarding ma non strettamente necessario; alternativa: popup di conferma solo al primo salvataggio con keytar.
- **Installazione dipendenza:**
  - `keytar` è una dipendenza nativa (richiede `node-gyp` e build tools). Aggiungere `npm install keytar` al passo `npm install` già presente in `scripts/install.sh` e `scripts/install.ps1`. Su Mac `node-gyp` richiede Xcode Command Line Tools (già necessari per Homebrew, probabile già presenti); su Windows richiede `windows-build-tools` o Visual Studio Build Tools — da aggiungere come prerequisito esplicito in `install.ps1` (es. `winget install Microsoft.VisualStudio.2022.BuildTools` con workload C++ minimo) o usando il preset `npm install --global windows-build-tools` se si vuole automatizzarlo.
- Sforzo: basso-medio (dipendenza nativa, ricompilazione `node-gyp`, migrazione valori esistenti da `config.json` a Keychain al primo avvio dopo l'aggiornamento). Valore: alto — elimina definitivamente le credenziali in chiaro su disco su Mac e Windows con un'unica implementazione.

---

### 13. Path `backend/data/` configurabile da Impostazioni
🟡 Il percorso della cartella dati (`backend/data/`) è hardcoded in `jsonStore.js` come path relativo alla root del progetto. Non è modificabile dall'utente senza intervento sul codice — né da Impostazioni UI né da variabile d'ambiente.
- **Use case concreto:** spostare `backend/data/` su una cartella sincronizzata (Dropbox, iCloud Drive, OneDrive su Windows, cartella di rete) per avere timesheet e fatture sempre disponibili su più Mac/PC o come backup passivo automatico via sync cloud, senza dipendere dal backup schedulato (#3).
- **Proposta:** aggiungere `DATA_PATH` come variabile d'ambiente in `backend/.env` (già escluso da `.gitignore`, già copiato da `.env.example` in install) letta da `jsonStore.js` come override del path base. Default invariato a `path.join(import.meta.dirname, '../../data')` se `DATA_PATH` non impostata — zero breaking change per chi non la configura.
- **Rischi — accessi concorrenti:**
  - `jsonStore.js` usa `fs.readFileSync`/`fs.writeFileSync` sincroni senza alcun meccanismo di lock. Con `backend/data/` locale e un solo processo Node.js attivo, le scritture sono serializzate dall'event loop — nessun conflitto possibile. Con `DATA_PATH` su cartella condivisa o di rete questo non vale più.
  - **Scenario 1 — due istanze del backend sullo stesso path** (es. Mac + PC con Dropbox condiviso, entrambi online contemporaneamente): scritture concorrenti su `config.json` o `anno-mese-clienteId.json` senza lock → file corrotto o sovrascrittura silenziosa. Rischio concreto e non recuperabile silenziosamente.
  - **Scenario 2 — sync cloud con conflict copy** (Dropbox/iCloud/OneDrive): se un file viene modificato mentre il sync è in corso, il client cloud genera un "conflict copy" (es. `file (Danilo's conflicted copy ...).json`, `file.sync-conflict-...`, `file 2.json`). `jsonStore.js` legge solo il nome canonico ignorando i file di conflitto → i dati salvati dall'altra istanza rimangono isolati nel file di conflitto e non vengono mai caricati, causando disallineamento e potenziale perdita dati se non gestiti.
  - **Scenario 3 — iCloud Drive con file evicted** ⚠️ (solo Mac): file "ottimizzato per iCloud" non presente fisicamente su disco → `fs.readFileSync` lancia `ENOENT`. `jsonStore.js` interpreta `ENOENT` come "file non esiste ancora" e restituisce `null`/default — timesheet o fattura del mese letta come vuota, poi sovrascritta al salvataggio successivo → **perdita dati silenziosa e non recuperabile**. Rischio più grave: si attiva automaticamente se "Ottimizza archiviazione Mac" è abilitato in Impostazioni iCloud.
- **Mitigazione adottata e gestione attiva dei Conflict Copy (zero perdita dati):**
  - **File locking:** aggiungere `proper-lockfile` (`npm install proper-lockfile`, ~5KB, zero dipendenze transitive) in `jsonStore.js` per tutte le operazioni di scrittura: acquisisce un lock (`nomefile.json.lock`) prima di `writeFileSync` e lo rilascia al termine. Previene scritture concorrenti sovrapposte (Scenario 1).
  - **Rilevamento e riconciliazione automatica Conflict Copy (Scenario 2):**
    - `jsonStore.js` scansiona periodicamente o a ogni lettura la cartella per file che matchano pattern di conflitto (`*conflicted copy*`, `*.sync-conflict-*`, `* (1).json`, `*(conflitto)*`).
    - **Per i Timesheet (`timesheets/`):** merge additivo automatico dei giorni registrati (se i giorni non collidono unisce le ore; se collidono, tiene il record con timestamp più recente e traccia la discrepanza).
    - **Per le Fatture e XML (`invoices/`):** le fatture sono documenti fiscali immutabili; se viene rilevato un conflict file su una fattura, il sistema non sovrascrive, segnala in UI con badge di warning ("Rilevata versione di conflitto da sync") e permette di visualizzare il confronto senza cancellare nulla.
    - **Per `config.json`:** adotta la versione con mtime più recente e sposta il file di conflitto in `backend/data/conflicts_archive/` conservando lo storico completo (nessun file viene mai cancellato fisicamente).
    - **Banner di notifica UI:** se sono presenti file di conflitto in sospeso, viene mostrato un avviso in top bar / Impostazioni informando l'utente del file riconciliato o archiviato.
  - ⚠️ **Avviso esplicito in UI per iCloud:** se `DATA_PATH` contiene `iCloud` o `Mobile Documents` nel path, mostrare in Impostazioni un banner di avviso prominente: *"iCloud Drive non è supportato come cartella dati se 'Ottimizza archiviazione Mac' è attivo — rischio perdita dati. Usare Dropbox o OneDrive, oppure disabilitare l'ottimizzazione iCloud per questa cartella."*
- Sforzo: medio (`DATA_PATH` env + `proper-lockfile` + modulo scan/reconciliation conflict copy + avviso UI). Valore: alto se si usa cloud sync su più macchine — garantisce integrità ed evita perdite di ore o fatture.

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
3. ~~Dashboard soglia compenso annuale (#4)~~ ✅ fatto.
4. Esportazione annuale per commercialista (#7) — valore ricorrente reale.
5. Hardening stato-invio/retry PEC (#1) — più grande, ma chiude il rischio #1 dichiarato dal progetto stesso.
6. Il resto in modo opportunistico.

---

## Analisi di fattibilità — Export codice su GitHub

🟢 Richiesta esplicita utente: pubblicare il codice su repository GitHub, senza esporre dati sensibili (database, config, path locali, password), con auto-generazione dei file mancanti al primo avvio, script di installazione che installa tutti i tool necessari come su una macchina nuova, e avvio come servizio sempre attivo, sia su Mac che su Windows.

### Stato attuale (base di partenza, confermato dal codice)

🟢 `.gitignore` in root esclude già `node_modules/`, `dist/`, `.env` (con `.env.example` come eccezione esplicita), `logs/`, `backend/data/` (contiene `config.json` con credenziali PEC/OAuth, più `invoices/` e `timesheets/`). Nessun altro file con segreti risulta fuori da questi path.

🟢 `git log --all --full-history -- backend/data/config.json backend/.env` restituisce vuoto (verificato 2026-08-30) — nessun commit passato ha mai incluso questi file, nessuna riscrittura di storia necessaria prima della pubblicazione.

🟢 `configService.js` fa già merge con `DEFAULT_CONFIG` se `config.json` manca — auto-generazione della config coperta, nessun crash.

🟢 `scripts/install.sh` esiste già (solo macOS): installa dipendenze npm frontend+backend, builda il frontend, copia `.env.example` → `.env` se mancante, registra un LaunchAgent (`launchctl`) con `KeepAlive` (riavvio su crash) e `RunAtLoad` (avvio al boot). Assume Node già presente nel PATH — non lo installa.

### Cosa servirebbe (in ordine di complessità crescente)

1. **`.gitignore`** — nessuna modifica: già sufficiente da solo per questo progetto. Azione unica: `git ls-files | grep -E "config\.json|\.env$"` prima del primo commit pubblico, deve restituire vuoto (esclude `.env.example`). Regola permanente aggiunta in `CLAUDE.md` (versionata, arriva anche a chi forka il repo): ogni nuovo file/cartella con potenziali dati sensibili va valutato e aggiunto a `.gitignore` nello stesso commit, non dopo — non basta il controllo iniziale.
2. **Auto-generazione directory dati** — confermare che `backend/data/invoices/` e `backend/data/timesheets/` vengano create al primo scritture (probabile già gestito da `jsonStore.js`, da verificare leggendo il file).
3. **`SESSION_SECRET` debole** — `scripts/install.sh:21-24` copia `.env.example` → `.env` ma lascia il placeholder `SESSION_SECRET=cambia-questo-segreto` invariato. Da generare casuale (`openssl rand -hex 32` o equivalente Node) durante l'installazione, non lasciato a scelta manuale dell'utente.
4. ✅ **Node.js non auto-installato** — implementato 2026-08-30: `scripts/install.sh` prova `brew install node` se `node` manca dal PATH e `brew` è disponibile.
5. ✅ **Script Windows mancanti** — implementato 2026-08-30: aggiunti `scripts/install.ps1`/`scripts/uninstall.ps1`. Install: installa Node via `winget` se mancante, `npm install`/`npm run build`, copia `.env.example`, genera `SESSION_SECRET` casuale, registra Scheduled Task ("at logon" + `RestartCount`/`RestartInterval`), apre `http://localhost:1969` nel browser di default. `scripts/install.sh` ora fa lo stesso (apre il browser a fine installazione su Mac).
6. **README pubblico** — se il repo diventa pubblico/condiviso, aggiornare con requisiti, comando di installazione per Mac e Windows, nota esplicita che `backend/.env` va compilato con credenziali proprie al primo avvio (mai committato), e che `backend/data/` è locale e auto-generata.

### Stima complessiva

🟡 Sforzo: basso-medio — nessun cambio architetturale, script Mac già esistenti da replicare su Windows con lo stesso pattern. Valore: alto se l'obiettivo è versionamento/backup del codice o collaborazione futura.

### Raccomandazione

🟢 Repository privato per un primo giro; valutare pubblico solo dopo aver applicato i punti 2-5 sopra (directory dati, secret casuale, installazione Node, script Windows).

### Ordine consigliato se l'utente vuole procedere

1. Fix `SESSION_SECRET` placeholder → generazione casuale in `scripts/install.sh`.
2. Conferma/aggiungi auto-creazione `backend/data/invoices/` e `backend/data/timesheets/` in `jsonStore.js` se mancante.
3. Aggiungi installazione automatica Node in `scripts/install.sh` (Mac).
4. Scrivi `scripts/install.ps1` e `scripts/uninstall.ps1` per Windows.
5. Aggiorna README con istruzioni di installazione multipiattaforma.
6. Primo push su repository GitHub privato.

---

## Analisi di fattibilità — Supporto altri regimi fiscali (oltre forfettario)

🟢 Richiesta esplicita utente: valutare aggiunta, oltre alla gestione regime forfettario già implementata (#4), del supporto agli altri regimi fiscali previsti per un libero professionista in Italia.

### Stato attuale (confermato dal codice)

🟢 `configService.js`: `fornitore.regimeFiscale` esiste già come campo libero (default `'RF19'`, il codice FatturaPA per il forfettario) — usato solo per lo XML FatturaPA (`fatturaPaXmlGenerator.js`), non guida alcuna logica di calcolo.

🟢 `forfettarioService.js` (`calcolaDashboardForfettario`, `aliquotaImposta`) è scritto **specificamente e unicamente** per il forfettario: coefficiente di redditività, aliquota 5%/15% sostitutiva, soglia €85.000. Nessuna astrazione di "regime fiscale" — la dashboard e il calcolo imposta sono monolitici su questa logica.

🟢 `DashboardView.vue` + `StepForfettario.vue` sono nominati e costruiti solo per il forfettario (donut "Soglia forfettario", selezione ATECO/coefficiente).

### Regimi rilevanti per libero professionista (persona fisica) in Italia

🟡 Oltre al forfettario (L. 190/2014), un libero professionista persona fisica ricade tipicamente in:
1. **Regime ordinario/semplificato** (contabilità semplificata, artt. 66/67 TUIR) — reddito = ricavi − costi documentati (non coefficiente forfettario), tassazione IRPEF a scaglioni progressivi + addizionali regionale/comunale, **soggetto a IVA** (aliquota su fattura, liquidazione periodica), **contributi INPS Gestione Separata o Cassa professionale** calcolati sul reddito netto, non assorbiti in un'unica imposta sostitutiva.
2. **Regime forfettario con superamento soglia in corso d'anno** (>€100.000 dal 2023 → uscita immediata con IVA dal mese successivo; tra €85.000 e €100.000 → uscita l'anno dopo) — è una transizione dal forfettario al semplificato, non un regime a sé, ma va gestita come evento (oggi `forfettarioService.js` segnala solo `superamentoSoglia` come booleano, nessuna distinzione tra le due soglie né azione conseguente).
3. **Regime forfettario per attività diverse con coefficienti multipli** (già in parte coperto: `atecoSettori.json` ha coefficiente per codice ATECO, ma un professionista con più attività/codici contemporaneamente non è modellato — oggi il config ha un solo `codiceAteco`/`coefficenteRedditivita`).

🔴 Fuori scope realistico per un tool personale: regime di vantaggio (L. 398/98, ormai residuale/enti sportivi), regimi società (SRL/SNC — il progetto è esplicitamente single-tenant persona fisica, vedi `PROJECT_CONTEXT.md`).

### Cosa servirebbe (in ordine di complessità crescente)

1. **Selettore regime fiscale in config** — sostituire il campo libero `regimeFiscale` (oggi solo stringa per XML) con un valore controllato che pilota anche la logica di calcolo: `'forfettario' | 'semplificato'`. Basso sforzo, ma è la base architetturale di tutto il resto: introduce per la prima volta un branch di comportamento sul regime.
2. **Astrazione del calcolo imposta** — `forfettarioService.js` andrebbe scisso: la parte "raccolta ricavi anno da fatture" (`ricaviAnno`) è già regime-agnostica e riusabile; la parte "calcolo imposta/aliquota" (`aliquotaImposta`, coefficiente, soglia) è forfettario-specifica. Servirebbe un nuovo modulo `regimeOrdinarioService.js` con la sua logica (scaglioni IRPEF, gestione costi deducibili) dietro la stessa interfaccia (`calcolaDashboard(config, opzioni)`), selezionato in base a `regimeFiscale`. Sforzo: medio — non è solo un nuovo file, è la prima volta che serve un'interfaccia comune tra due implementazioni.
3. **Tracciamento costi deducibili** — il regime ordinario richiede reddito = ricavi − costi, ma **oggi il modello dati non ha alcun concetto di "costo/spesa"** (`backend/data/` contiene solo timesheet e fatture emesse, mai spese sostenute). Servirebbe un nuovo store (`spese-<anno>.json` o simile, via `jsonStore.js` come da convenzione) e relativa UI di inserimento. Sforzo: medio-alto — è la lacuna più grande, un intero dominio dati nuovo, non un'estensione di uno esistente.
4. **Gestione IVA in fattura** — `fatturaPaXmlGenerator.js` oggi genera XML per regime senza IVA esposta in fattura (forfettario, natura N2.2 tipicamente). Il regime ordinario richiede aliquota IVA reale sulla riga, calcolo imponibile+IVA, e — se si vuole supporto completo — liquidazione periodica (mensile/trimestrale) che oggi non esiste in nessuna forma nel progetto. Sforzo: medio (aliquota su riga XML) fino ad alto (liquidazione periodica, se richiesta).
5. **Contributi previdenziali (INPS Gestione Separata / Cassa)** — nessun modello esiste oggi (il forfettario non separa contributi da imposta, essendo sostitutiva unica). Servirebbe aliquota configurabile e calcolo sul reddito netto, mostrato in dashboard. Sforzo: medio.
6. **Dashboard multi-regime** — `DashboardView.vue`/`StepForfettario.vue` andrebbero generalizzati (rinominare concettualmente, non necessariamente i file) per mostrare la card giusta in base al regime attivo, invece di essere hardcoded sul forfettario. Sforzo: medio, soprattutto per non rompere la UX già validata (#4 sopra).

### Stima complessiva

🔴 Sforzo: **medio-alto** — non paragonabile a una funzionalità incrementale come le altre di questa lista. Il forfettario è stato implementabile in un giorno perché è un calcolo chiuso (ricavi × coefficiente × aliquota fissa, soglia unica). Il regime ordinario introduce due domini dati mai esistiti nel progetto (spese/costi, IVA) più una logica di scaglioni IRPEF reale (5 fasce progressive aggiornate periodicamente da normativa, non un valore fisso come 5%/15%). Ordine di grandezza: giorni, non ore, anche in versione minima.

🔴 Rischio-chiave: a differenza del forfettario (dati già tutti presenti: solo fatture emesse), il regime ordinario è **incompleto senza il tracciamento spese** — un tool che calcola l'IRPEF ordinaria solo sui ricavi (senza costi deducibili) darebbe una stima grossolanamente sbagliata per eccesso, peggio che non avere la funzione.

### Raccomandazione

🔴 Prima di investire: confermare se l'utente reale di questo tool ha effettivamente bisogno del regime ordinario (cioè: prevede di uscire dal forfettario, per superamento soglia o scelta) o se resta ipotesi teorica di "completezza". Se è solo teorica, è YAGNI puro — il forfettario copre il 100% dell'uso reale attuale (vedi dashboard #4 già tarata su soglia €85.000 per questo utente specifico). Se invece è concreto (es. proiezione ricavi vicina/oltre soglia), l'ordine minimo sensato è: (1) selettore regime in config, senza logica ancora, solo per iniziare a distinguere; (2) tracciamento spese come funzione a sé (utile comunque anche restando forfettari, per controllo di gestione personale); (3) solo dopo, calcolo IRPEF ordinaria completo.

### Ordine consigliato se l'utente vuole procedere

1. Confermare use case reale (uscita da forfettario prevista/probabile vs. teorica).
2. Selettore `regimeFiscale` controllato in config (base per tutto il resto, sforzo basso).
3. Modulo spese/costi deducibili (valore anche standalone, prerequisito per calcolo ordinario corretto).
4. `regimeOrdinarioService.js`: scaglioni IRPEF + aliquota INPS configurabile.
5. Estensione IVA in `fatturaPaXmlGenerator.js` (solo se il regime ordinario diventa operativo, non prima).
6. Generalizzazione dashboard per mostrare la card corretta in base al regime.

---

## Checklist di Revisione

- **Completezza:** le proposte coprono fasce chiusura-rischio, valore quotidiano e rifinitura; esclude esplicitamente idee fuori scope con motivazione.
- **Accuratezza:** ogni proposta è tracciata a una lacuna confermata specifica o a un file; elementi speculativi marcati 🔴/🟡.
- **Coerenza:** terminologia allineata a `GLOSSARY.md`; i problemi rimandano a `KNOWN_ISSUES.md`/`ROADMAP.md`.
- **TODO:** confermare use case reale della multi-utenza (persone multiple su un fornitore vs. più fornitori fiscali indipendenti) prima di stimare la multi-utenza/admin; confermare se il repository GitHub va reso pubblico o resta privato prima di applicare i punti 2-5 dell'export codice.
- **Informazioni mancanti:** nessun dato di utilizzo/punto di frustrazione reale dall'utente esiste nel repo per ordinare per attrito reale invece che rischio dedotto.
- **Domande aperte:** la soglia forfettario attuale è €85.000 per la situazione fiscale di questo utente — confermare la regola dell'anno fiscale corrente prima di costruire la logica di avviso del punto #4.
- **Livello di confidenza:** misto 🟢/🟡/🔴, taggato individualmente per voce.
