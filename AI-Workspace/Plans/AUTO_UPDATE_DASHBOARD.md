# Piano: pulsante aggiornamento app in Dashboard

Stato: 🟢 implementato (Opzione B). Vedi `backend/src/services/updateService.js`, `backend/src/routes/updateRoutes.js`, `scripts/update.sh`/`update.ps1`, `frontend/src/composables/useUpdateCheck.js`, `frontend/src/components/UpdateModal.vue`.

## Requisito

- Pulsante in Dashboard, prima del pulsante "Esporta" esistente.
- Nascosto se nessun aggiornamento remoto disponibile.
- Visibile e vistoso (sfondo blu, testo bianco) se c'è un aggiornamento.
- Al click: scarica, installa, builda il frontend, riavvia il servizio backend — tutto automatico.
- Serve versioning locale/remoto e procedura di update affidabile.
- Rilevamento basato su **release** (tag semver `vX.Y.Z`), non su ogni singolo commit — coerente col modello di release GitHub. Un push su `main` senza tag non deve far comparire il bottone.

## Contesto rilevante 🟢

- Repo Git locale, remote `origin` **oggi** = Gitea self-hosted (`http://localhost:3000/danilo/Timesheet.git`). **Destinazione finale**: repo pubblicato su GitHub. Il meccanismo va progettato provider-agnostico fin da subito — solo comandi `git` puri (`fetch`, `ls-remote`, `rev-parse`), mai GitHub API/Releases/Gitea API. Così funziona identico su entrambi e il giorno del cambio remote basta `git remote set-url origin <url-github>`, zero modifiche a `updateService.js`.
- Backend Express (ESM) gira come processo persistente su porta 1969, serve `frontend/dist/` staticamente. Nessun hot-reload.
- **Riavvio già risolto**: il servizio gira sotto **launchd con KeepAlive** (`scripts/install.sh`) — uscire con `process.exit(0)` basta, launchd rilancia da solo. Pattern già in uso in `backend/src/routes/sistemaRoutes.js` (`POST /api/sistema/riavvia`): risponde `200`, poi `setTimeout(() => process.exit(0), 200)`. Niente kill+spawn manuale di un nuovo processo: lo script di update deve solo terminare il processo Node a fine sequenza (o l'endpoint fa `process.exit(0)` dopo che lo script è terminato con successo), launchd fa il resto. Questo elimina la parte più delicata originariamente ipotizzata in questo piano.
- Pattern di polling già esistente e riusabile: `backupService.js` / `sdiRicevuteService.js` — `setInterval` che rilegge config ad ogni giro, nessuna dipendenza nuova.
- Persistenza dati: solo tramite `backend/src/lib/jsonStore.js` (`readJson`/`writeJson`), mai file diretti.
- Nessuna dipendenza nuova senza reale necessità (regola progetto): niente `simple-git`, niente librerie di auto-update — `child_process.execFile('git', […])` con stdlib basta.

## Cosa serve concettualmente

1. **Versioning**: tag Git semver (`vX.Y.Z`) come unica fonte di verità, sia locale che remota.
2. **Rilevamento aggiornamento**: endpoint backend che confronta il tag più recente raggiungibile in locale col tag più recente sul remote — via `git`, non API REST (vedi domanda utente: scelta esplicita di restare git-only anche per le release, provider-agnostico).
3. **Esecuzione update**: sequenza fetch tag → checkout tag → npm install (se serve) → build frontend → riavvio backend.
4. **UI**: bottone condizionale in Dashboard che chiama l'endpoint di check e poi quello di update.

Il riavvio del *processo che sta eseguendo l'update* è la parte delicata: il processo non può "aspettare se stesso" in modo pulito da dentro Express. Le due opzioni sotto risolvono questo punto in modo diverso.

---

## Opzione A — Git pull + restart via script shell generato inline in JS

**Versioning**: tag Git annotati semver (`vX.Y.Z`) come fonte di verità per il *remoto*; per il *locale* un file `VERSION` scritto al momento dell'update, non `git describe`.
- Locale: legge `backend/VERSION` (o campo `version` in `backend/package.json`, già esiste come file — evita un file in più). Scritto una volta ad ogni update riuscito (vedi step esecuzione sotto), letto senza mai toccare Git. **Perché non `git describe --tags`**: quel comando dipende dai tag già scaricati nel repo locale (`git fetch --tags` deve essere girato prima, altrimenti risultato stale) ed è fragile su clone shallow — un file letto con `readFile` è immune a stato dei refs Git, coerente col resto del progetto che legge dati via `jsonStore.js`/file piatti, non via comandi esterni.
- Remoto: `git ls-remote --tags --refs origin` → lista `refs/tags/vX.Y.Z`, prendere il max per confronto semver (split `.`/confronto numerico, poche righe, no libreria `semver`). Questo resta via Git perché è l'unica fonte affidabile per "cosa esiste sul remote" — non c'è un file locale che possa saperlo.
- **Vincolo: tag valido solo se raggiungibile dal branch di produzione (`main`/`master`)**. `ls-remote` da solo non lo garantisce (un tag può essere stato creato su un branch feature). Verifica: dopo `git fetch --tags origin` e `git fetch origin main`, controllare `git merge-base --is-ancestor <tag> origin/main` (exit code 0 = il tag è un antenato di `main`, quindi valido). Un tag che fallisce questo check viene ignorato nel calcolo del "più recente" — evita che un tag di test/hotfix su un altro branch faccia comparire il bottone per errore.
- Aggiornamento disponibile se `tagRemotoPiùRecente > tagLocale` (confronto semver, non stringa — `v10.0.0 > v9.0.0` andrebbe letto male come stringa).
- Se il repo non ha ancora nessun tag (caso oggi su Gitea, prima della prima release): bottone resta nascosto, nessun errore.

**Check periodico** (nuovo `updateService.js`, stesso pattern `setInterval` di `backupService.js`):
```js
setInterval(async () => {
  await eseguiGit(['fetch', '--tags', 'origin', 'main']); // aggiorna refs locali, no merge
  const tagRemoti = await eseguiGit(['ls-remote', '--tags', '--refs', 'origin']);
  const candidati = parseSemver(tagRemoti).sort(confrontaSemver).reverse();
  const remoto = candidati.find(tag =>
    eseguiGitSync(['merge-base', '--is-ancestor', tag, 'origin/main']).exitCode === 0
  ); // scarta tag non raggiungibili da main (branch feature/hotfix)
  const locale = await readFile('backend/VERSION', 'utf-8').catch(() => null); // no chiamata git
  statoAggiornamento = { disponibile: remoto && confrontaSemver(remoto, locale) > 0, remoto, locale };
}, 5 * 60 * 1000); // ogni 5 minuti, no dipendenza nuova
```
- `GET /api/update/stato` → `{ disponibile, versioneLocale, versioneRemota }`. Route sottile in `updateRoutes.js`, logica in `updateService.js`.

**Esecuzione update** (`POST /api/update/esegui`):
1. `git fetch --tags origin && git checkout <tagRemoto>` (checkout dell'esatto tag di release, non del branch — coerente col modello "aggiorna a una release", non "aggiorna all'ultimo commit". Se ci sono modifiche locali non committate, bloccare come da rischio sotto).
2. `npm install --prefix backend` e `npm install --prefix frontend` sempre — `npm install` è no-op veloce se il lockfile non è cambiato, non serve diff manuale per deciderlo (YAGNI).
3. `npm run build --prefix frontend`.
3bis. Scrivere `backend/VERSION` col tag appena installato (`writeFile('backend/VERSION', tagRemoto)`), **solo dopo che checkout+build sono andati a buon fine** — questo è il file che il check periodico legge come "locale", quindi va aggiornato per ultimo, mai prima, altrimenti un build fallito lascerebbe il file a dire "aggiornato" mentre l'app è rimasta alla versione vecchia.
4. Riavvio: **launchd KeepAlive già rilancia il processo alla sua uscita** (vedi Contesto rilevante) — basta `process.exit(0)` a fine sequenza riuscita, stesso pattern di `sistemaRoutes.js`. Nessuno script di kill+relaunch manuale necessario. Il frontend polla `GET /api/update/stato` (o un semplice health-check) ogni paio di secondi finché il nuovo processo risponde, poi mostra "aggiornato" e ricarica.

**Limite di questa opzione**: la sequenza fetch/checkout/install/build/kill/restart è logica shell scritta come stringa dentro JS (template letterale) — codice di un linguaggio "stubbato" dentro un altro, difficile da testare isolatamente, senza syntax highlighting/lint dedicato, senza poterla rilanciare a mano se qualcosa va storto durante il debug. Non è la scelta preferita quando esiste l'alternativa di uno script dedicato (Opzione B) — vedi raccomandazione sotto.

**Rischi/mitigazioni**:
- Build fallisce a metà → il vecchio `frontend/dist/` resta intatto finché `vite build` non sovrascrive con successo (Vite scrive l'intera dist solo a build riuscita, ma va verificato: eventualmente buildare in dir temporanea e fare swap atomico `mv` solo se exit code 0).
- Se `git checkout <tag>` e ci sono modifiche locali non committate su questa macchina (improbabile essendo l'ambiente di produzione, ma va verificato) → **da bloccare**: controllare `git status --porcelain` prima e abortire l'update con errore visibile se sporco, mai scartare silenziosamente.
- Checkout di un tag mette il repo in "detached HEAD": nessun problema in questo scenario — l'unico utilizzatore della macchina di produzione è consumer dell'app, non fa mai commit/push lì; chi vuole contribuire allo sviluppo lavora su un fork con PR, flusso completamente separato e fuori scope di questo piano.
- Autenticazione verso il remote (Gitea oggi, GitHub dopo) per `fetch`: se richiede credenziali, serve che siano già configurate (credential helper / SSH key / PAT in URL) sulla macchina che fa girare il backend — nessuna gestione credenziali nell'app stessa. Un repo GitHub pubblico in sola lettura (`fetch`/`ls-remote`) non richiede nemmeno credenziali.
- Cambio provider (Gitea → GitHub): l'unico impatto è l'URL di `origin` (`git remote set-url`) e il nome del branch di default se diverso da `main`. Nessun comando nel piano è specifico di un provider, quindi nessuna riga di `updateService.js` richiede modifiche.

---

## Opzione B — Script shell dedicato, versionato nel repo (consigliata)

**Cross-platform**: il progetto punta anche a Windows (`AI-Workspace/Plans/PACKAGING_BREW_WINGET.md`, `scripts/install.sh` avrà un gemello per winget) — quindi serve una coppia di script nativi, non solo bash:
- `scripts/update.sh` (Mac/Linux — usato anche in dev).
- `scripts/update.ps1` (Windows — PowerShell, già presente sul sistema, nessuna dipendenza aggiuntiva).

Stessa sequenza logica in entrambi (fetch tag, checkout, install, build, scrittura `VERSION`, kill+restart), ognuno nel proprio linguaggio nativo — niente traduzione riga-per-riga forzata, ognuno usa gli idiomi giusti per la propria piattaforma (es. `taskkill` su Windows vs `kill` su Unix per terminare il processo).

Il backend sceglie in base a `process.platform`, lancia lo script in background e — **grazie a launchd KeepAlive** (vedi Contesto rilevante) — non deve gestire lui stesso il "rilancio": basta terminare il processo a fine script riuscito, launchd lo rifà partire da solo con il nuovo codice/build già in `frontend/dist/`:

```js
const script = process.platform === 'win32'
  ? { cmd: 'powershell', args: ['-File', 'scripts/update.ps1', tagRemoto] }
  : { cmd: 'bash', args: ['scripts/update.sh', tagRemoto] };
const proc = spawn(script.cmd, script.args, { detached: true, stdio: 'ignore' }).unref();
res.json({ avviato: true }); // frontend inizia il polling di /api/update/stato
// Lo script fa fetch+checkout+build+scrittura VERSION; l'ultima riga dello script
// termina il processo Node (kill del PID passato come argomento, o lo script scrive
// un file "fatto"/"errore" che un piccolo watcher in updateService.js legge e poi
// chiama process.exit(0)) — launchd lo fa ripartire, nessuno spawn manuale del nuovo processo.
```

Stesso meccanismo di versioning/check di A (tag semver remoto via `git ls-remote`, versione locale letta da `backend/VERSION`).

**Perché è la scelta giusta**: uno script dedicato in un file `.sh` è codice scritto nel suo linguaggio nativo — syntax highlighting, lint (`shellcheck`), eseguibile e testabile da terminale in isolamento (`./scripts/update.sh v1.2.3`) senza passare dall'app. Un template-string JS che genera shell è invece codice di un linguaggio stubbato dentro un altro: nessun tool lo capisce come shell, un errore di quoting si scopre solo in produzione. Log su file separato (`scripts/update.log`), semplice da tail.

**Costo accettato**: tre linguaggi nel repo invece di uno (JS backend + bash + PowerShell in `scripts/`). Accettabile per lo stesso motivo per cui `scripts/install.sh`/`install.ps1` esistono già in coppia nel piano di packaging: è la responsabilità naturale di uno script di sistema (fetch, build, restart processo, kill di un PID) — ogni piattaforma ha il proprio modo idiomatico di farlo, e forzarlo dentro un unico JS cross-platform (via `child_process` con comandi diversi per branch `if win32`) sposterebbe la complessità nel posto sbagliato senza eliminarla.

---

## Raccomandazione

**Opzione B**: coppia di script dedicati `scripts/update.sh` (Mac/Linux) + `scripts/update.ps1` (Windows), scelti da `process.platform` e chiamati dal backend con `spawn`. Il rilevamento (`GET /api/update/stato`, confronto tag/VERSION) resta in JS in `updateService.js` — è logica di dati, non di sistema, e lì il riuso di `logger.js`/pattern esistente resta valido. Solo l'esecuzione (fetch/checkout/build/restart) va agli script nativi: quella parte è manipolazione di processi e filesystem che ogni piattaforma esprime meglio nel proprio linguaggio, e si testa più facilmente in isolamento da terminale.

## UI (comune a entrambe le opzioni)

- Nuovo composable o riuso di quello esistente per polling stato (pattern già presente per notifiche PEC/ricevute, verificare `frontend/src/composables/`).
- Bottone in `Dashboard.vue`, prima di quello "Esporta", testo **"Aggiornamento disponibile"**:
  ```html
  <button v-if="aggiornamentoDisponibile" class="btn-aggiornamento" @click="mostraPopupAggiornamento = true">
    Aggiornamento disponibile
  </button>
  ```
  - `v-if`, non `v-show`: quando non c'è aggiornamento il bottone non deve esistere nel DOM.
  - Stile: nuovo token CSS coerente con richiesta ("bg blu, testo bianco") aggiunto al blocco `:root` esistente in `DESIGN_TOKENS`, non colore hardcoded inline.
- **Popup al click** (riuso pattern modale esistente in `frontend/src/components/`, non nuovo sistema di modali): mostra versione locale, versione remota, changelog della/e release intermedie, due pulsanti **Aggiorna** / **Annulla**.
  - Changelog: `GET /api/update/stato` include anche il testo delle note di rilascio. Fonte: messaggio del tag annotato Git (`git tag -l --format='%(contents)' <tag>`) — nessuna dipendenza da API GitHub Releases, coerente con la scelta provider-agnostica già fatta. Se il tag non è annotato o senza messaggio, sezione changelog vuota (nessun errore).
  - **Aggiorna**: chiude popup, chiama `POST /api/update/esegui`, stato di loading (disabilita pulsanti, testo "Aggiornamento in corso…"), poi polling health-check finché il nuovo processo risponde, poi reload pagina.
  - **Annulla**: chiude popup, nessuna azione.
- **Footer**: dove già presente il link Privacy, aggiungere versione corrente app (letta da `backend/VERSION`, stesso valore esposto da `GET /api/update/stato`), testo allineato a destra. Sempre visibile, non condizionato ad aggiornamenti disponibili.

## Cosa NON fare

- Nessuna libreria di auto-update (electron-updater, ecc.) — non è un'app Electron, è git checkout tag + build.
- Nessuna libreria semver esterna — confronto `vX.Y.Z` è poche righe di split/confronto numerico.
- Nessuna chiamata a GitHub Releases API — restare su `git ls-remote --tags`, decisione esplicita dell'utente per restare provider-agnostico (Gitea oggi, GitHub domani, stesso codice).
- Nessuna gestione multi-branch/rollback automatico in questa prima iterazione — solo l'ultimo tag semver, YAGNI finché non serve.

## Prossimi passi

1. ✅ Implementato `updateService.js` + `updateRoutes.js` + `scripts/update.sh`/`update.ps1` + composable/popup/bottone frontend + versione a piè pagina.
2. ✅ Voce aggiunta a `CHANGELOG.md`.
3. Da fare quando il repo verrà pubblicato su GitHub e taggato con la prima release semver reale (`vX.Y.Z`): verificare `git ls-remote`/`merge-base` contro il remote pubblico, confermare che sulla macchina di produzione non ci siano mai modifiche locali non committate (il checkout tag richiede working tree pulito).
