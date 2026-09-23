# Piano: prima pubblicazione pubblica su GitHub

Stato: 🟡 piano, nessuna modifica codice ancora fatta salvo dove indicato. Elenco fix da fare.

Confidenza: 🟢 confermato da codice/comandi eseguiti in sessione · 🟡 dedotto · 🔴 ipotesi/da verificare a mano.

---

## 1. Verifica dati sensibili

Controlli eseguiti (repo `develop`, HEAD pulito):

- `git ls-files | grep -E "config\.json|\.env$|\.key$|\.pem$"` → **vuoto** 🟢. Nessun file sensibile mai tracciato.
- `git log --all --full-history --diff-filter=A --name-only` filtrato su `.env|config.json|\.key|\.pem|credentials|data/|logs/` → **vuoto** 🟢. Mai aggiunto in nessun commit passato, su nessun branch locale.
- `.gitignore` copre correttamente: `.env` (con eccezione `.env.example`), `logs/`, `*.log`, `backend/data/`, `backend/logs/`, `AI-Workspace/Plans/`, `AI-Workspace/Output/` 🟢.
- Grep pattern chiave API (`AIzaSy`, `sk-...`, `api_key=`, `password=`) su tutto il sorgente applicativo (`backend/src`, `frontend/src`, doc) → **nessun hit reale**, solo falsi positivi in `node_modules/` (fixture test di librerie terze) 🟢.
- `backend/src/services/envService.js`: Gemini API key e Google Client Secret letti solo da `.env` via `leggiGeminiApiKey()`, **mai restituiti al frontend** (solo un booleano) 🟢. Route consumatrici (`scadenzeFiscaliService.js`, `pagamentiFattureService.js`, `geminiAtecoService.js`) li usano solo per l'URL di chiamata a `generativelanguage.googleapis.com`, mai in log 🟢.
- `backend/logs/*.log` (locali, ignorati da git) → grep `password|secret|apikey|key=` → **vuoto** 🟢.
- `install.sh`/`install.ps1` risolvono `PROJECT_DIR` via path dello script, non da `pwd`/cwd 🟢. `server.js`, `jsonStore.js`, `logger.js` risolvono i propri path via `import.meta.dirname` → **avvio path-indipendente confermato** 🟢.

**Conclusione: nessuna fuga di dati sensibili rilevata.** Il rischio residuo è nel "d'ora in poi" (nuove feature che aggiungono persistenza) e nella pulizia del README/repo per la pubblicazione (path locali, screenshot con dati fittizi).

### Rischio residuo da tenere sotto controllo (processo, non un fix)

`CLAUDE.md` già impone: prima di aggiungere un file/servizio che scrive su disco, valutare se è sensibile e aggiornare `.gitignore` nello stesso commit. Ribadita come gate esplicito pre-pubblicazione, vedi §5.

---

## 2. Fix/modifiche da fare

### 2.1 Pre-pubblicazione, blocking

- [x] **Verifica manuale finale prima del primo push pubblico** — fatta ✅ (doppio controllo, due passate indipendenti): entrambi i grep vuoti, `git log` vuoto, gitleaks 0 leak, `.env.example` solo placeholder, path locali rimossi (skill `sync-public` tolta dal commit pubblico), permessi workflow verificati minimi.
- [x] **Creare `LICENSE`** in root — fatto ✅ (testo integrale PolyForm Noncommercial 1.0.0, committato).
- [x] **Aggiungere riga in README** che rimanda a `LICENSE` — fatto ✅ (sezione Licenza in fondo al README).
- [x] **Creare `SECURITY.md`** in root — **fatto** ✅ (vedi `SECURITY.md`, committato): versioni supportate, canale di segnalazione privato (GitHub Security Advisories), tempistiche indicative 7-14 giorni, scope del modello di sicurezza (single-user/local-first), disclaimer no-warranty, dipendenze di terze parti fuori scope.
- [x] **Creare `CONTRIBUTING.md`** in root — fatto ✅ (committato), valido per qualunque forma di contributo:
  - Pull Request via fork (caso principale, §2.6)
  - Patch/codice inviato fuori GitHub (email, chat, altro canale)
  - Collaboratori con accesso push diretto (non tramite fork)
  - Contributi non-codice con copyright proprio: documentazione, traduzioni, screenshot, icone/asset grafici

  Contribuendo, l'autore del contributo accetta che il proprio apporto sia rilasciato sotto la licenza del progetto (PolyForm Noncommercial) e concede all'autore del repo (danilo priore) licenza a usarlo/rilicenziarlo, incluso per eventuali accordi commerciali futuri. Copertura per ogni canale e ogni tipo di contributor, individuale o aziendale, senza distinzione caso per caso:
  - Clausola scritta in `CONTRIBUTING.md`, valida per ogni canale.
  - **CLA-assistant attivato sul repo fin dal primo giorno**, applicato automaticamente a ogni PR.

  **Setup tecnico CLA-assistant** (automatico, blocca merge finché non firmato):
  - Tool: [CLA Assistant Lite](https://github.com/marketplace/actions/cla-assistant-lite) (GitHub Action, gratuito).
  - [x] `CLA.md` in root col testo del CLA — fatto ✅ (committato).
  - [x] `.github/workflows/cla.yml` — fatto ✅ (committato): si attiva su `pull_request_target`/commento; il bot commenta chiedendo la firma, registra firma (account GitHub + timestamp).
  - [x] **Branch protection rule** su `main` — fatto ✅: ruleset `main-protection` (Settings → Rulesets, non più "Branches"), PR obbligatoria + 1 review richiesta + status check obbligatori (`cla`, `scan`/gitleaks, `CodeQL`, `analyze`/Scorecard, `license-check`) tutti aggiunti dopo il primo push pubblico. Owner (`priore`) aggiunto alla Bypass list — necessario perché un singolo maintainer non può auto-approvare la propria PR, altrimenti ogni merge proprio resterebbe bloccato.
  - Chi firma una volta non rifirma per PR successive.

  **Casi limite coperti esplicitamente nel testo del CLA/`CONTRIBUTING.md`**:
  - **Dipendenti/lavoratori** (work-for-hire): dichiarazione che il contributor ha diritto di sottomettere il contributo, non vincolato da un datore di lavoro che ne rivendica il copyright.
  - **Minorenni**: richiesta conferma di maggiore età (o consenso di un tutore legale).
  - **Contributor anonimo/pseudonimo**: CLA-assistant registra l'account GitHub associato, sufficiente per tracciabilità tecnica; identità reale non richiesta.
  - **Contributo generato/assistito da AI**: il CLA si applica sempre alla persona/entità umana che apre la PR, mai al tool — chi sottomette resta responsabile del contenuto.
  - **Fork/riuso di terzi che non contribuiscono indietro**: non richiedono CLA, ma restano vincolati dalla licenza PolyForm Noncommercial sul codice preso — reso esplicito in `LICENSE`/README.
- [x] Pubblicare sotto `github.com/priore`, non come "Prioregroup" — fatto ✅: repo `priore/foglifatture`, README non presenta il progetto come prodotto aziendale (identificatori tecnici interni come label plist/task name restano invariati, non visibili all'utente finale).
- [x] **Disabilitare esplicitamente il Wiki di GitHub** (repo Settings → Features → Wikis: off) — fatto ✅. Motivo: superficie scrivibile senza revisione da chiunque abbia permessi, contenuto che apparirebbe comunque sotto il repo/nome dell'autore. Documentazione resta centralizzata in README + `AI-Workspace/`.

### 2.2 README.md — modernizzazione

Stato attuale: README funzionale, in italiano, istruzioni Mac/Win già corrette per path-indipendenza. Manca la parte "presentazione prodotto".

- [x] **Sezione hero/intro in cima** — fatto ✅: badge (licenza, Node, piattaforma, Security, Contributing), frase di posizionamento, elenco feature principali.
- [x] **App presentata come primo prodotto pubblicato** — fatto ✅: nessun accenno a storia/iterazioni pregresse.
- [x] **Sezione Features** dedicata ed estesa — fatto ✅: timesheet multi-cliente, FatturaPA, PEC, ricevute SDI, dashboard forfettario, numerazione unica, import storico, backup, promemoria, scadenze fiscali AI, login Google OAuth, multi-piattaforma.
- [x] **Sezione Security/Sicurezza** dedicata — fatto ✅: riassunto no-secret-hardcoded, API key mai esposta, avvio path-indipendente, scansioni CI (gitleaks/CodeQL/licenze/Socket.dev/Dependabot), link a `SECURITY.md`.
- [x] **Screenshot con dati fittizi** in `docs/screenshots/` — chiuso ✅ (decisione utente: 3 pubblicati bastano, `timesheet-mensile.png`, `dashboard.png`, `fattura-proforma.png`; wizard clienti e vista mobile/dark mode scartati, non necessari).
- [x] **Riorganizzare in sezioni con anchor/TOC** — fatto ✅: Features → Sicurezza → Screenshot → Installazione → Primo utilizzo → FAQ → Note per chi programma → Licenza → Support Development.
- [x] **Sezione Licenza** esplicita in fondo — fatto ✅: rimando a `LICENSE`, invito a contattare per uso commerciale/SaaS.
- [x] Resto del README (installazione, FAQ, "Note per chi programma") — fatto ✅: restyling/riordino attorno alle nuove sezioni, rename Timesheet→FogliFatture nei path d'esempio.

**Contenuti cautelativi/legali aggiuntivi**:

- [x] **Disclaimer no-warranty visibile nel README stesso** — fatto ✅ (sezione Licenza, in grassetto).
- [x] **Nota su dati fiscali/contabili** — fatto ✅ (FAQ "L'app sostituisce il mio commercialista?", in grassetto su richiesta utente).
- [x] **Nota trasparenza dati verso servizi AI esterni** — fatto ✅ (sezione Sicurezza, cosa viene inviato a Gemini).
- [x] **Badge/link visibili a `SECURITY.md` e `CONTRIBUTING.md`**, in cima al README — fatto ✅.
- [x] **Nota licenza commerciale**: solo in fondo (sezione Licenza), non duplicata in cima — decisione utente, badge licenza in cima già sufficiente come segnale immediato.
- [x] **Requisiti minimi/compatibilità dichiarati esplicitamente** — fatto ✅ (Node ≥18, macOS/Windows, sezione Installazione).
- [x] **Stato del progetto dichiarato** — fatto ✅ ("attivo, mantenuto da una sola persona nel tempo libero — nessuno SLA").

### 2.3 Verifica avvio da path diversa

Confermato con lettura codice (§1): `server.js`, `jsonStore.js`, `logger.js` usano `import.meta.dirname`; `install.sh`/`install.ps1` usano lo script path, non il cwd; il plist/scheduled-task generato incorpora il path assoluto risolto a install-time. Nessun fix di codice richiesto — resta un test pratico consigliato:

- [x] Test avvio da path con spazi — chiuso ✅ (decisione utente: non testare, si accetta il rischio residuo in base alla lettura del codice già fatta — variabili quotate correttamente in `install.sh`/`install.ps1`).

### 2.4 Dataset demo per screenshot

- [x] Dataset fittizio generato da Claude — fatto ✅: `backend/data/config.json` sostituito con fornitore "Studio Demo di Mario Rossi" (P.IVA `01234567890`) + cliente "Cliente Demo S.r.l." (tariffa 35€/h), timesheet demo agosto 2026 (168 ore, 21 giorni lavorativi). Dati reali originali salvati in backup locale (scratchpad, fuori repo) prima della sostituzione. Non committato (coperto da `backend/data/` in `.gitignore`).
- [x] **Test funzionale end-to-end** — fatto ✅: backend riavviato coi dati demo, verificato via browser: timesheet agosto (168h calcolate correttamente), Fattura Pro-Forma generata da timesheet (imponibile 5880€, bollo virtuale applicato sopra soglia 77,47€), fattura definitiva generata (n. 1, XML/PEC/email abilitati dopo generazione), dashboard forfettario popolata correttamente (ricavi cumulati 5880€, reddito imponibile 3939,60€, soglia 6,9%, grafico andamento mensile, scadenze fiscali). Nessun bug riscontrato. Console browser: solo 404 attesi per mese senza dati, nessun errore reale.
- [~] **Cattura screenshot grezzi** — 3/5 fatti (dashboard forfettario, timesheet mensile, fattura Pro-Forma), catturati via browser tool a 1440×900. Mancano: wizard clienti, vista mobile/dark mode.
- [x] **Rielaborazione grafica via ChatGPT** — 3/3 completata: `timesheet-mensile.png`, `dashboard.png`, `fattura-proforma.png` rielaborati (mockup finestra browser, ombra morbida) e pubblicati in `docs/screenshots/`, collegati nel README con didascalie. Mancano ancora da catturare/rielaborare: wizard clienti, vista mobile/dark mode (voci extra facoltative, non bloccanti).

### 2.5 Automazione preventiva

- [x] **GitHub Actions con `gitleaks`** — fatto ✅ (`.github/workflows/gitleaks.yml`, committato), eseguito su ogni push/PR. Si attiva effettivamente solo dopo push su repo GitHub reale (Actions non gira su repo locale).

### 2.6 Workflow post-pubblicazione: sync locale ↔ GitHub

Repo locale (`develop`, storia completa) e repo GitHub pubblico (init-commit singolo) sono **due repository separati** con storie diverse fin dall'inizio. Non vanno "riallineati" in storia — il locale resta sorgente di verità per lo sviluppo, il pubblico riceve push quando si decide di pubblicare un avanzamento.

- [ ] **Caso semplice — solo push locale → GitHub** (nessuna PR esterna nel frattempo):
  ```
  git push origin main
  ```
  Dopo l'init-commit la storia pubblica cresce con commit normali, non più squashata.
- [ ] **Caso con contributor esterni (fork + Pull Request) — merge accettato direttamente su GitHub**: se nel frattempo il locale ha ricevuto altri commit non ancora pushati, serve merge bidirezionale:
  ```
  git fetch origin
  git merge origin/main
  ```
  (equivalente a `git pull origin main`). Risolvere eventuali conflitti, poi `git push origin main`. Se si tenta `git push` senza pull prima, git lo rifiuta comunque (remote più avanti) — il pull-prima-di-push è forzato dal flusso normale.
- [ ] **Checkout di una PR esterna per review/test locale**, prima di accettarla:
  ```
  gh pr checkout <numero>
  ```
  oppure
  ```
  git fetch origin pull/<numero>/head:pr-<numero>
  git checkout pr-<numero>
  ```
  Poi review/test/merge normale (`gh pr merge` via CLI o UI GitHub).
- [ ] **Licenza e contributor esterni**: coperto integralmente da `CONTRIBUTING.md` + CLA-assistant (§2.1) — nessuna distinzione caso per caso tra contributor individuali e aziendali.
- [ ] **Skill/automazione dedicate: non necessarie** — flusso git/gh standard (`fetch`, `merge`, `push`, `gh pr checkout`). Eventuale skill-wrapper "prima di push, fai sempre `git fetch && git status`" resta idea facoltativa futura.

### 2.7 `CHANGELOG.md` pubblico — trattamento confermato

Il `CHANGELOG.md` di root (GitHub-facing) ha oggi 104 righe, tutte sotto `## [Unreleased]`, nessuna versione ancora taggata.

- [ ] **Riscrivere come prima release** (opzione confermata): le voci attuali — che descrivono funzionalità reali, oggi presenti nel prodotto — vengono raggruppate sotto `## [1.0.0] - <data pubblicazione>` invece di restare sparse come iterazioni. Si presenta come "cosa include la prima release", coerente con il README che presenta l'app come primo prodotto (§2.2).
- [ ] Il `CHANGELOG.md` del repo locale/di sviluppo (`develop`) **non viene toccato**: resta con tutta la sua storia. La riscrittura riguarda solo il file che finisce nel repo pubblico separato.
- [x] Verificare se esistono già tag di versione (`git tag`) sul repo locale — fatto ✅: nessun tag presente, numerazione pubblica parte pulita da v1.0.0.

### 2.8 Governance, dipendenze, review

- [x] **Dependabot** — fatto ✅ (`.github/dependabot.yml`, committato): `package-ecosystem: npm` su `backend/`, `frontend/`, più `github-actions` su root, schedule settimanale.
- [x] **`.github/CODEOWNERS`** — fatto ✅ (committato): `* @priore`. Branch protection "richiedi review approvata" su `main` — fatto ✅ (ruleset `main-protection`, 1 required approval; CODEOWNERS scatta automaticamente sui path in review, nessuna spunta separata nella UI attuale).
- [x] **`CODE_OF_CONDUCT.md`** — fatto ✅ (committato): template Contributor Covenant 2.1.
- [x] **Verifica licenze delle dipendenze (manuale, snapshot pre-pubblicazione)** — fatta ✅: `npx license-checker --production --summary` su `backend/` e `frontend/`. Nessuna dipendenza con licenza copyleft forte (GPL/AGPL); tutte MIT/Apache-2.0/BSD/ISC, compatibili con distribuzione sotto PolyForm Noncommercial. `backend/package.json` aveva `"license": "ISC"` (residuo scaffolding) → corretto a `"license": "SEE LICENSE IN LICENSE"`; `frontend/package.json` non aveva il campo → aggiunto.
- [x] **Automazione: check licenze dipendenze su ogni PR** — fatto ✅ (`.github/workflows/license-check.yml`, committato): `npx license-checker --production --failOn "GPL-2.0;GPL-3.0;AGPL-1.0;AGPL-3.0;LGPL-2.1;LGPL-3.0;SSPL-1.0"` su `pull_request` che tocca i package.json/lockfile. Manca ancora la branch protection rule su `main` — azione GitHub UI, tua.
- [x] **CodeQL** — fatto ✅ (`.github/workflows/codeql.yml`, committato): analisi `javascript-typescript` su push/PR verso `main` + schedule settimanale. Verificato in produzione ✅ (run `success` dopo il passaggio del repo a pubblico — su repo privato falliva con "Code scanning is not enabled", risolto da solo senza intervento sul codice).
- [x] **Socket.dev GitHub App** — scartato ✅ (verificato in sessione): l'app richiede installazione su un **account organization**, non su account personale GitHub (`priore`). Creare un'org solo per questo contrasta con la decisione §5 di restare su account personale, non "Prioregroup". Non bloccante (§2.8 già lo segnava opzionale) — copertura supply-chain resta comunque su Dependabot + CodeQL + OpenSSF Scorecard + gitleaks.
- [x] **OpenSSF Scorecard** — fatto ✅ (`.github/workflows/scorecard.yml`, committato). Verificato in produzione ✅ (run `success` dopo due fix: pin `ossf/scorecard-action@v2.4.4` — il tag mobile `@v2` non era più risolvibile — e passaggio del repo a pubblico, richiesto dall'azione stessa).
- [x] **Verifica permessi `GITHUB_TOKEN` nei workflow** — fatta ✅: tutti i 5 workflow dichiarano permessi minimi (nessun `write-all`); CodeQL li dichiara a livello job (`security-events: write`, `contents: read`, `actions: read`) invece che a livello file, formato equivalente. `gitleaks.yml` necessitava anche `pull-requests: read` (mancava, causava 403 sulle PR di Dependabot) — aggiunto.
- [x] **`gitleaks detect` locale su tutta la storia** — fatto ✅: installato via brew, eseguito su repo locale (133 commit scansionati) e sul repo pubblico dopo il commit-init (1 commit). Nessun leak in entrambi i casi.
- [x] **Backup mirror del repo locale** — fatto ✅: `git clone --mirror` in `/Users/danilo/Documents/GitHub-backups/Timesheet-mirror-20260905.git`, verificato con `git log --oneline`.
- [x] **Verificare che la copia/creazione del commit-init pubblico non porti dentro `AI-Workspace/Plans/` e `AI-Workspace/Output/`** — fatto ✅: popolato `foglifatture/` via `git archive HEAD` sul locale (rispetta `.gitignore` automaticamente, a differenza di una copia manuale), poi verificato con `find`/`ls` che nessuna delle due cartelle fosse presente.
- [x] **Case-sensitivity import path** — verificato ✅: CodeQL (runner Linux, case-sensitive) ha girato con successo sul repo pubblico senza errori di import/case, nessun problema emerso.
- [x] **Issue template** — fatto ✅ (`.github/ISSUE_TEMPLATE/bug_report.md`, `feature_request.md`, committati).
- [x] **`.github/FUNDING.yml`** — fatto ✅ (committato): custom link ad ancora `#support-development` nel README (sezione donazione BTC, stesso QR/indirizzo di SOAPEngine). Attivazione "Sponsorships" nelle Settings del repo GitHub: fatta dall'utente.

---

## 3. Cosa NON serve toccare (verificato, già a posto)

- `.gitignore` copre già tutte le fonti dati sensibili note.
- `configService.js`/`jsonStore.js` seguono già il pattern corretto (path relativo al modulo, non hardcoded).
- Nessuna chiave/credenziale hardcoded nel sorgente applicativo.
- Gemini API key mai esposta al frontend né loggata.
- Path-indipendenza dell'avvio già implementata correttamente su Mac e Windows.

---

## 4. Ordine di esecuzione consigliato

1. Decisioni utente (§5) — licenza, nome repo/org, strategia storia, CHANGELOG.
2. Fix/hardening (gitleaks Action, Dependabot, CODEOWNERS, `SECURITY.md`, `CODE_OF_CONDUCT.md`, verifica licenze dipendenze — §2.5, §2.8).
3. Dataset demo fittizio (§2.4) → screenshot grezzi → rielaborazione via ChatGPT (prompt+immagine da utente, file rielaborato riconsegnato a Claude) → posizionamento finale in `docs/screenshots/` (§2.2, §2.4).
4. Riscrittura README con sezioni moderne + screenshot + Features + Security, presentato come primo prodotto; riscrittura `CHANGELOG.md` pubblico come prima release (§2.7).
5. Test pratico avvio da path diversa (§2.3).
6. Verifica finale pre-push (§2.1, ripetere i due comandi git).
7. **Backup del repo locale** (`git clone --mirror` in una cartella separata, fuori dal progetto) come rete di sicurezza prima di qualunque operazione di creazione del repo pubblico.
8. **Creare repo GitHub pubblico separato**, un solo commit iniziale (snapshot dello stato attuale) — non `filter-repo` sul repo di sviluppo locale, che resta intatto e separato.
9. Push / rendere pubblico il repo — fatto ✅ (2026-09-05, commit `7b71cd5`, push su `origin main` riuscito dopo rigenerazione PAT fine-grained con scope Workflows: Read/write). Resta da verificare/completare: visibilità repo effettivamente pubblica (Settings → General → Danger Zone), esito primo run dei 5 workflow, aggiunta status check CLA/license-check al ruleset `main-protection` ora che sono selezionabili.
10. Da lì in avanti: workflow ordinario locale↔GitHub (§2.6) — push per avanzamenti propri, fetch+merge se arrivano PR esterne accettate direttamente su GitHub.

---

## 5. Decisioni prese

- **Licenza**: [PolyForm Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0). Codice liberamente visibile/usabile/modificabile per scopi non commerciali; qualsiasi uso commerciale — incluso rivendita e offerta come servizio SaaS — richiede accordo preventivo separato con l'autore. File `LICENSE` in root con testo standard, più riga in README che rimanda lì.
- **Repo/organizzazione GitHub**: `github.com/priore` (personale, non "Prioregroup"). Identificatori tecnici interni (label plist `com.prioregroup.fatturazione`, task name `PrioreGroupFatturazione`) restano invariati, non visibili all'utente finale; il README non presenta il progetto come prodotto aziendale Prioregroup.
- **Nome app/repo**: **FogliFatture** (repo GitHub `github.com/priore/foglifatture`, dominio `foglifatture.com` verificato libero). Repo GitHub creato (privato per ora, Wiki disabilitato), clonato localmente in `/Users/danilo/Documents/GitHub/foglifatture` (auth HTTPS via SourceTree, risolto problema Personal Access Token vs password account). Sostituisce il nome generico "Timesheet" — copre entrambi i domini applicativi (fogli ore + fatture), non solo la fatturazione. Titolo README ✅ fatto (§2.2). `frontend/index.html` `<title>` ✅ fatto: "Fogli & Fatture" (sidebar `AppSidebar.vue` già usava questo display name). `backend/package.json`/`frontend/package.json` (`name`): lasciati invariati (`backend`/`frontend`, generici, non pacchetti npm pubblicati) — decisione utente. Identificatori tecnici interni (plist/task name) restano invariati come sopra.
- **Storia commit**: repo GitHub pubblico creato come **repository separato dal locale**, con un **solo commit iniziale** che rappresenta uno snapshot pulito dello stato attuale del codice (`git init` nuovo, o commit singolo su branch orfano). Nessuna storia pregressa visibile su GitHub. Il repo locale (`develop`, storia completa) resta invariato e separato, continua per lo sviluppo quotidiano. L'app è presentata nel README come primo prodotto pubblicato, coerente con l'assenza di storia commit pubblica. Dopo il primo push, la storia pubblica cresce con commit normali. Vedi §2.6 per il workflow di sincronizzazione post-pubblicazione.
- **`CHANGELOG.md` pubblico**: le voci attuali (104 righe sotto `[Unreleased]`) vengono riscritte come prima release `## [1.0.0] - <data pubblicazione>`, coerente con la presentazione come primo prodotto. Il changelog del repo locale non viene toccato. Dettaglio in §2.7.
- **Wiki GitHub**: disabilitato esplicitamente (Settings → Features → Wikis: off), non lasciato default-on-vuoto. Motivo: superficie scrivibile senza revisione, contenuto che apparirebbe comunque sotto il repo/nome dell'autore senza controllo editoriale. Documentazione resta centralizzata in README + `AI-Workspace/`. Riattivazione possibile in futuro se serve.
- **Protezione automatica secret**: GitHub Action con **gitleaks** sul repo, eseguita ad ogni push/PR. Un solo meccanismo, lato CI. Importanza aumentata dalla strategia init-commit: dopo il primo push, ogni nuovo push è storia pubblica permanente da subito.
- **Contributor esterni (fork/PR), qualunque genere — individuali e aziendali**: accettati, preventivato integralmente da subito. Flusso: contributor forka, apre PR; review/test locale opzionale via `gh pr checkout <numero>`; merge via `gh pr merge` o UI GitHub; poi `git fetch && git merge origin/main` in locale, risoluzione conflitti, poi `git push`. Nessuna skill/automazione dedicata necessaria — flusso git/gh standard.
  - **Copyright/licenza dei contributi — qualunque canale, qualunque tipo di contributor**: `CONTRIBUTING.md` (§2.1) con clausola di cessione/licenza per ogni forma di contributo (PR, patch fuori GitHub, accesso push diretto, doc/traduzioni/asset non-codice) **più** CLA-assistant attivato sul repo per il flusso PR, individuale o aziendale — stesso gate per tutti, nessuna distinzione caso per caso. Casi limite coperti esplicitamente: dipendenti/work-for-hire, minorenni, contributor anonimo, contributo assistito da AI, fork di terzi che non contribuiscono indietro (vincolati dalla licenza via `LICENSE`/README, non serve CLA).
  - **Governance aggiuntiva**: `CODE_OF_CONDUCT.md` (Contributor Covenant), `CODEOWNERS` con review obbligatoria dell'autore, branch protection su `main` (CLA check + review approvata come status check richiesti).
- **Sicurezza dipendenze**: Dependabot attivato dal primo giorno (§2.8), oltre a gitleaks — coprono superfici diverse (vulnerabilità note vs. secret nuovi).
- **Compatibilità licenza dipendenze, verificata su ogni PR**: oltre al check manuale una tantum (§2.8), gate automatico (`license-check.yml`, §2.8) che rifiuta il merge se una PR introduce una dipendenza (diretta o transitiva) con licenza copyleft forte/network-copyleft incompatibile con PolyForm Noncommercial. Stesso meccanismo di branch protection già usato per CLA e review obbligatoria — un solo punto di applicazione, non un controllo manuale ripetuto ogni volta.
- **Rilevamento codice malevolo/supply-chain**: CodeQL (pattern pericolosi nel codice, injection/eval/chiamate di rete sospette), OpenSSF Scorecard (igiene di configurazione del repo) — attivati dal primo giorno, gratuiti, complementari a Dependabot (CVE note) e gitleaks (secret). Socket.dev **scartato**: richiede account GitHub organization, non compatibile con la scelta di restare su account personale (§5). Nessuno di questi sostituisce la review umana obbligatoria (`CODEOWNERS`) per codice "logicamente corretto ma dannoso" che uno scanner statico non intercetta.

---

## Review Checklist

- **Completezza**: coperti tutti i punti richiesti (dati sensibili incl. Gemini, README modernizzato con screenshot fittizi + sezioni Features/Security, istruzioni Win/Mac, avvio path-indipendente, strategia storia commit, CHANGELOG pubblico, workflow sync locale↔GitHub, governance/contributor di ogni genere). 🟢
- **Accuratezza**: ogni claim tecnico verificato con comando reale in sessione (grep, git log, npx license-checker, lettura file), non per memoria. 🟢
- **Coerenza**: allineato a `CLAUDE.md` (regola `.gitignore`) e a `WORKSPACE_MANIFEST.md` (nessuna modifica codice nei documenti di analisi/piano, salvo i fix minimi di metadata già applicati e tracciati in §2.8). 🟢
- **TODO**: vedi §2 per elenco completo. Residuo principale: 4/5 screenshot ancora da completare (§2.4), verifica finale pre-push (§2.1), test path con spazi (§2.3), riscrittura CHANGELOG pubblico come v1.0.0 (§2.7), azioni solo-utente su GitHub UI (branch protection, Wiki off, Socket.dev App, backup mirror, creazione repo pubblico).
- **Informazioni mancanti**: nessuna.
- **Domande aperte**: nessuna, decisioni prese in §5.
- **Livello di confidenza complessivo**: 🟢 alto.
- **Ultimo aggiornamento stato**: 2026-09-04, dopo commit `038dbd4` (governance), `e555bc3` (CI), `a79cfa7` (README), `5145d9f` (primo screenshot).
