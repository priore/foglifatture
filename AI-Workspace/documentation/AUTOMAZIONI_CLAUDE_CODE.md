# Automazioni Claude Code — raccomandazioni e rimozioni

Data analisi: 2026-09-30 · Ambito: progetto Timesheet/Fatturazione (repo `Timesheet`, pubblico come `foglifatture`)

> Documento di sola analisi. Nessuna modifica è stata applicata a configurazione, hook, skill o agenti.

## 1. Profilo del progetto

- **Runtime/stack**: Node ESM, Express 5, frontend Vue 3.5 + Vite 8, test con `node --test` (nessun framework).
- **Librerie chiave**: `imapflow`, `nodemailer`, `mailparser` (PEC/SDI), `fast-xml-parser` (FatturaPA), `passport-google-oauth20`, `express-session`, `keytar`, `multer`, `xlsx`, `html2pdf.js`.
- **Dati**: JSON su disco (`backend/data/`, ignorato da git) via `jsonStore.js`.
- **CI/CD**: GitHub Actions (ci, codeql, gitleaks, license-check, scorecard, cla, dependabot-auto-merge, dependabot-major-review).
- **Automazioni già presenti**:
  - Hook `SessionStart`: controlla workflow falliti e PR aperte su `foglifatture`.
  - Hook `PreToolUse` su Bash: blocca `git commit/push` se sono tracciati file sensibili.
  - Skill `pre-publish-check` e `sync-public`.
  - Agente `dependabot-triage`.
  - Regole e memoria versionate in `.claude/rules/` e `.claude/memory/`.
  - Playwright MCP.
  - Plugin utente: `ponytail`, `caveman`, `claude-code-setup`, `firebase`.

## 2. Raccomandazioni

### 2.1 Hook (`.claude/settings.json`)

**H1 — Test mirato dopo modifica a un service** (priorità alta)
- Evento: `PostToolUse` su `Edit|Write` con path `backend/src/(services|lib)/*.js`.
- Azione: se esiste `<file>.test.js` accanto al file, eseguire `node --test <file>.test.js` e mostrare solo le righe di errore.
- Perché: la regola di progetto richiede test dopo ogni modifica di logica backend. L'hook la rende automatica e costa pochi token, perché esegue solo il test vicino e non l'intera suite.

**H2 — Blocco scrittura su dati e segreti** (priorità alta)
- Evento: `PreToolUse` su `Edit|Write`.
- Azione: rifiutare i path `backend/data/**`, `.env` (non `.env.example`), `*.key`, `*.pem`, `config.json`.
- Perché: l'hook esistente protegge solo commit e push. Questo protegge anche la scrittura, in linea con `sensitive-data.md` e con la regola di passare sempre da `jsonStore.js`.

**H3 — Promemoria riavvio backend** (priorità media)
- Evento: `PostToolUse` su `Edit|Write` in `backend/src/**` (non `*.test.js`).
- Azione: emettere un `systemMessage` non bloccante: "Backend modificato: richiede riavvio (chiedere conferma via AskUserQuestion)".
- Perché: il backend non ha hot-reload, quindi dimenticare il riavvio è l'errore più facile da fare. L'hook non riavvia nulla, in coerenza con la regola di conferma.

**H4 — Avviso CHANGELOG su commit** (priorità media)
- Evento: `PreToolUse` su Bash con `git commit` il cui messaggio inizia per `feat` o `fix`.
- Azione: avvisare (non bloccare) se `CHANGELOG.md` non è nello staging.
- Perché: `dev-workflow.md` impone la voce sotto `[Unreleased]` nello stesso commit.

### 2.2 Skill (`.claude/skills/<nome>/SKILL.md`)

**S1 — `riavvia-backend`** (user-only, `disable-model-invocation: true`)
- Incapsula la procedura: `lsof -i :1969 -sTCP:LISTEN -t`, kill, `nohup node src/server.js &`, verifica porta.
- Include la conferma via AskUserQuestion, con la deroga "riavvia/riavvio" già in memoria.
- Oggi la procedura è sparsa tra regola e memoria. La skill la rende un comando unico e ripetibile.

**S2 — `ui-shot-diff`** (user-only)
- Workflow Playwright prima/dopo: light e dark, 2 viewport, `browser_snapshot` per la struttura e screenshot solo per il confronto visivo. Salva in `shots/` (già in `.gitignore`).
- Rende eseguibile la memoria `ui_changes_pre_post_screenshot.md`.

**S3 — `chiudi-feature`** (user-only)
- Checklist di chiusura:
  1. Test backend.
  2. Voce `CHANGELOG.md` in italiano sotto `[Unreleased]`.
  3. Aggiornamento dell'entry in `FEATURE_PROPOSALS.md` / `KNOWN_ISSUES.md` (✅, data, commit).
  4. Promemoria riavvio.
- Sostituisce regole oggi distribuite su 3 file. Il commit resta comunque soggetto a OK esplicito.

**S4 — `release`** (user-only, opzionale)
- Sposta `[Unreleased]` sotto un'intestazione datata quando l'utente dichiara una release, e propone il tag.
- Da creare solo se le release diventano frequenti.

### 2.3 Subagenti (`.claude/agents/`)

**A1 — `fatturapa-reviewer`**
- Rivede le modifiche a `fatturaPaXmlGenerator.js`, `fatturaPaXmlValidator.js` e ai template: conformità allo schema FatturaPA, natura IVA/forfettario, bollo, numerazione progressiva condivisa.
- Sola lettura (Read, Grep, Bash).
- Il dominio è fiscale e un errore produce scarti SDI. Serve una revisione specializzata.

**A2 — `security-reviewer`**
- Area: OAuth con whitelist `ALLOWED_EMAIL`, `express-session`, upload `multer`, credenziali PEC/IMAP in `keytar`, `.gitignore`.
- Il repo è pubblico, quindi ogni regressione è esposta. Lo strumento riduce il rischio prima di `sync-public`.

**A3 — `ui-reviewer`** (opzionale)
- Controlla le convenzioni: solo variabili CSS, niente hex o px hard-coded, bottoni condizionali sempre visibili e disabilitati con spiegazione (mai nascosti), `<script setup>`.

### 2.4 MCP server

**M1 — context7** (priorità alta)
- Documentazione aggiornata per Express 5, Vue 3.5, Vite 8, `imapflow`, `nodemailer` 9, `fast-xml-parser` 5. Sono versioni recenti dove la conoscenza del modello può essere obsoleta.
- Installazione: `claude mcp add context7 -- npx -y @upstash/context7-mcp`. Va registrato nello scope progetto (`.mcp.json`) solo se non contiene segreti.

Già coperti, nessuna aggiunta necessaria:
- Playwright MCP (presente).
- GitHub: basta la CLI `gh`, già usata da hook e agente. Il server MCP non aggiunge valore.

### 2.5 Permessi

- Eseguire `/fewer-permission-prompts` sul progetto per ottenere una allowlist mirata. Candidati: `Bash(node --test *)`, `Bash(npm test*)`, `Bash(npm run build*)`, `Bash(gh run *)`, `Bash(gh pr list*)`, `Bash(lsof -i :1969*)`.
- Unificare i permessi Playwright oggi duplicati tra `settings.json` e `settings.local.json` (vedi sezione 3).

### 2.6 Plugin

Nessun plugin aggiuntivo raccomandato.
- `commit-commands` va in conflitto con la regola "niente commit senza OK esplicito".
- `frontend-design` spinge verso nuovi pattern visivi, mentre il progetto ha già un design system con token CSS.

## 3. Raccomandazioni di rimozione / pulizia

| # | Elemento | Motivo | Rischio |
|---|---|---|---|
| R1 | `.claude/token-savings/` (`install.sh`, `rules.md`, cartella `hooks/` vuota) | `install.sh` è uno stub che stampa solo un messaggio. `hooks/` è vuota. `rules.md` dichiara un hook di filtro build "enforced by settings.json" che **non esiste**. Gli esempi sono C#/iOS/Python, non pertinenti. Il contenuto utile (leggere mirato, test stretti, niente polling) è già coperto da RTK e dalle regole del progetto. Sono file tracciati che finiscono nel repo pubblico. | Basso |
| R2 | `AI-Workspace/scripts/setup-token-kit.sh` (modificato, non committato) e relativo commit `5a29ab6` | È il generatore di R1. Va rimosso insieme a R1 o ripulito. | Basso |
| R3 | `.claude/worktrees/` (vuota) | Cartella residua, nessun contenuto. | Nullo |
| R4 | Plugin `firebase` (scope utente) | Il progetto non usa Firebase (JSON su disco, OAuth Google senza Firebase). Aggiunge circa 12 skill e 40 tool MCP al contesto di ogni sessione. Lasciarlo solo per i progetti che lo usano (Accenture/MSC). | Basso, riattivabile |
| R5 | Sovrapposizione `caveman` + `ponytail` | Entrambi iniettano regole di stile a ogni sessione. Sono compatibili ma ridondanti, e pesano sul contesto. Tenerne uno attivo, o attivarli per singolo progetto. | Basso |
| R6 | Duplicati in `.claude/settings.local.json` e `.claude/settings.json` | Stessa allowlist Playwright e stesso `WebFetch(domain:www.inps.it)` in entrambi. Fondere in un solo file. Il file locale dovrebbe contenere solo gli override personali. | Nullo |
| R7 | `mcp__playwright__browser_run_code_unsafe` e `browser_evaluate` in allowlist | Permettono esecuzione arbitraria di JS senza prompt. Rimuoverli dall'allow e approvarli caso per caso. Bastano `snapshot`, `click` e `take_screenshot`. | Basso, sicurezza |
| R8 | `~/.claude/settings.json`: `Bash(*)` più molte voci `Bash(...)` ridondanti, `autoApproveCommands` con `awk` duplicato | `Bash(*)` rende inutili tutte le altre voci. Con `curl *`, `chmod *`, `chown *` il rischio è reale. Scegliere: o `Bash(*)` esplicito e consapevole, o la sola lista specifica. | Medio, da valutare |
| R9 | `~/.claude/settings.json`: `additionalDirectories` con `/Users/danilo` e path Accenture | Concede accesso all'intera home anche dal progetto fiscale. Limitare al necessario. | Medio, sicurezza |
| R10 | `customPrompt`/`watchFiles` che puntano a `/Users/danilo/AI-Rules/master.md` | Regole globali che possono essere in conflitto con `CLAUDE.md` di progetto (per esempio lingua e stile). Verificare che il file esista e non contraddica le regole del repo. | Basso |
| R11 | Hook `SessionStart` (chiamate `gh` con timeout 15 s) | Utile, ma rallenta ogni avvio e ripete a ogni sessione ciò che fanno già i workflow con notifica email. Valutare di spostarlo su `/loop` o schedule periodico, oppure di ridurre il timeout a 5 s. Non è da eliminare. | Nullo |
| R12 | Agente `dependabot-triage` vs workflow `dependabot-auto-merge.yml` / `dependabot-major-review.yml` | Due meccanismi fanno lo stesso lavoro (merge patch/minor). Tenere il workflow come automatismo e l'agente solo per i casi major. Oppure documentare chiaramente la divisione. | Basso |

## 4. Ordine di implementazione suggerito

1. Pulizia a rischio nullo: R3, R6, R7.
2. Pulizia token-kit: R1 + R2.
3. Hook H2 e H1 (massimo valore, minimo sforzo), poi H3 e H4.
4. Skill S1 e S3, poi S2.
5. MCP context7 (M1).
6. Revisione permessi globali R8 e R9, e plugin R4 e R5, in una sessione dedicata. Sono impostazioni utente e non di progetto.
7. Subagenti A1 e A2 quando serve una revisione pre-pubblicazione.

## 5. Note

- Le skill e gli hook di progetto sono versionati e finiscono nel repo pubblico. Prima di aggiungerne, applicare `sensitive-data.md`: niente path locali né segreti negli script.
- Per ogni categoria si possono chiedere ulteriori opzioni (per esempio altri hook o altri MCP).
