# Piano: installer 1-click (punto 4 di PACKAGING_BREW_WINGET.md)

Confidence: 🟢 confermato da codice/comandi eseguiti in sessione · 🟡 inferito · 🔴 ipotesi/da decidere

Nota: tracciato su Gogs (locale), escluso solo dal sync verso GitHub (skill `sync-public`) — non pubblicato.

Branch di lavoro: `feature/package` (già aperto).

Target utente: **zero conoscenza tecnica**. Non deve aprire un terminale, non deve sapere cos'è Node, non deve editare file. Scarica un file, fa doppio click, l'app parte e si apre nel browser. Ogni punto sotto è scritto assumendo questo, non un utente sviluppatore.

## Approccio

L'app non va compilata in un eseguibile: l'installer deve **scaricare/clonare il repository sorgente** (con `.git/` intatto) sulla macchina dell'utente e lanciare gli script già esistenti (`scripts/install.sh`/`install.ps1`), esattamente come si fa oggi a mano. L'unica cosa che cambia è che questo passo diventa un doppio-click invece di "apri terminale, clona, lancia script".

Questo evita ogni rischio di bundling di `keytar` (modulo nativo) in un eseguibile — `npm install` gira normale sulla macchina utente, compila `keytar` lì come fa oggi — e **mantiene intatto e riusabile** il meccanismo di aggiornamento in-app già esistente (`updateService.js`, basato su `git fetch`/checkout — richiede un repo Git reale, che con questo approccio l'utente ha davvero).

Destinazione finale immaginata: GitHub Packages/Releases (quando il progetto sarà pronto per distribuzione ampia). **Per ora si configura e si testa solo sul repository locale gogs** (`http://localhost:3000/danilo/Timesheet.git`) — nessuna pubblicazione esterna in questa fase.

---

## 0. Cosa significa "1-click and run", in concreto

1. **Un solo file da scaricare** per piattaforma (un `.pkg` mac, un `.exe` Windows) — non uno zip con dentro una cartella da capire dove mettere.
2. **Un solo doppio click** fa tutto: scarica/clona il codice, installa Node se manca, installa dipendenze, builda il frontend, configura, avvia.
3. **Nessun prerequisito visibile all'utente**: non deve sapere cos'è Node o Git, non deve aprire un terminale a meno che non lo scelga lui — anche se **internamente** l'installer userà Node e Git (§1).
4. **Al termine, l'app è già in esecuzione** e si apre da sola nel browser (comportamento già presente in `install.sh`, ultima riga: `open "http://localhost:1969"`).
5. **Si avvia da solo ad ogni riavvio del computer** (comportamento già presente oggi via launchd/Scheduled Task, generato da `install.sh`/`.ps1`) — nessuna modifica necessaria qui, il meccanismo esiste già.
6. **Un modo altrettanto semplice per disinstallare** (non "cancella la cartella a mano e prega").
7. **Nessun avviso di sicurezza spaventoso** che un utente non tecnico non saprebbe interpretare (Gatekeeper mac, SmartScreen Windows).
8. **Aggiornamenti**: meccanismo **già esistente e riusabile invariato** (`updateService.js` + `UpdateModal.vue`, vedi §5) — perché con questo approccio l'utente ha un vero repo Git clonato, non un binario, quindi `git fetch`/checkout funzionano esattamente come oggi.

---

## 1. Stato di partenza — cosa esiste già, verificato nel codice

🟢 `scripts/install.sh` (mac) fa, nell'ordine: verifica/installa Node via brew se manca → `npm install` + build frontend → copia `.env.example` → `.env` se assente, genera `SESSION_SECRET` casuale → crea plist launchd → carica il servizio → apre il browser. `scripts/install.ps1` fa l'equivalente Windows con winget e Scheduled Task. Entrambi risolvono `PROJECT_DIR` dal path dello script stesso, non dal cwd — funzionano da qualunque posizione (verificato in `PUBBLICAZIONE_GITHUB_PUBLICO.md` §1, §2.3).

🟢 `backend/src/lib/jsonStore.js`: `DATA_DIR` già configurabile a runtime, non hardcoded. 🟢 `backend/src/lib/logger.js`: `LOG_DIR` **hardcoded** relativo alla cartella progetto — invariato rispetto a oggi, nessun problema nuovo introdotto da questo piano (il repo clonato resta comunque in una cartella scrivibile scelta dall'utente/installer, non dentro `/Applications` a sola lettura, vedi §4).

🟢 Aggiornamento in-app già funzionante (`backend/src/services/updateService.js`, `updateRoutes.js`, `frontend/src/components/UpdateModal.vue`, disegno completo in `AI-Workspace/Plans/AUTO_UPDATE_DASHBOARD.md`): confronta tag Git semver remoti col file `backend/VERSION` locale, mostra changelog dal messaggio del tag, e su richiesta utente lancia `scripts/update.sh`/`.ps1` che fa `git checkout <tag>` + rebuild + riavvio. **Questo continua a funzionare senza modifiche** con l'approccio "installer clona repo" — è esattamente lo scenario per cui è stato progettato.

🔴 Non esiste oggi: nessun installer `.pkg`/`.exe`, nessuna icona applicativa (`.icns`/`.ico`), nessuna CI di packaging.

🟡 `backend/package.json` include `keytar` (modulo nativo) e `xlsx` da CDN diretto — **nessuno dei due è un problema con questo approccio**: sono gestiti da `npm install` sulla macchina dell'utente esattamente come oggi, nessun bundling coinvolto.

---

## 2. Cosa deve fare davvero l'installer

L'installer non è il programma — è un piccolo eseguibile "bootstrapper" che automatizza ciò che oggi fa una persona a mano seguendo il README:

1. Verificare/installare i prerequisiti: **Git** (necessario per clonare, e per gli aggiornamenti futuri via `updateService.js`) e **Node** — entrambi già gestiti concettualmente da `install.sh`/`.ps1` per Node via brew/winget; va aggiunto lo stesso automatismo anche per Git se manca (raro su mac, che lo include di serie salvo Xcode Command Line Tools da accettare al primo uso; più comune mancare su Windows).
2. Clonare il repository in una cartella stabile e scrivibile senza permessi amministratore (§4) — non `/Applications` o `%ProgramFiles%`.
3. Lanciare `scripts/install.sh`/`install.ps1` così come sono, senza duplicarne la logica nell'installer.
4. Il resto (build, `.env`, plist/Scheduled Task, apertura browser) è già gestito dagli script esistenti — l'installer non reinventa nulla di quel comportamento.

🟢 **Deciso: installer grafico.** Confronto che ha portato alla decisione:

**Leggero** (script vestito da eseguibile — `.command` mac, `.bat`/PowerShell Windows):
- Sviluppo: zero tool nuovi da imparare, nessuna firma installer separata, un file di poche righe.
- Utente: apre una finestra di terminale visibile con output testuale (comandi git/npm veri che scorrono) — chi non è tecnico vede qualcosa che "sembra da programmatori", può leggerlo come un errore anche quando tutto va bene. Nessuna barra di progresso, nessun wizard "Avanti/Fine" familiare. Nessuna voce in "App e funzionalità"/Launchpad — disinstallazione solo via `uninstall.sh`/`.ps1` esistenti, non un flusso OS-nativo.
- **Rischio diretto**: viola il requisito 3/8 di §0 ("nessun terminale visibile") già fissato in cima a questo piano.

**Grafico** (`.pkg` mac con `pkgbuild`/`productbuild`, Inno Setup Windows):
- Sviluppo: più lavoro — sintassi nuova da imparare (`.iss` Inno Setup, script `postinstall` per `.pkg`), firma installer separata (certificato "Developer ID Installer" per mac, distinto da quello app), schermate da testare.
- Utente: esperienza identica a installare una qualsiasi app — icona propria, wizard "Avanti/Avanti/Fine" standard del sistema operativo, nessun terminale mai visibile (clone+build girano in background dietro la schermata di progresso). Appare tra le app installate su mac, in "App e funzionalità" su Windows con disinstallazione OS-nativa integrata.

**Decisione presa 🟢**: grafico, nonostante il maggior lavoro — è l'unico dei due che rispetta il requisito "zero conoscenza tecnica" dichiarato in cima al piano; il leggero lo violerebbe proprio sul punto centrale (terminale visibile). Vedi §3 per i tool.

---

## 3. Tool per costruire l'installer, per piattaforma

### macOS

`.pkg` costruito con `pkgbuild`/`productbuild` (tool Apple inclusi in Xcode Command Line Tools, nessuna dipendenza esterna) che esegue uno script `postinstall` — quello script è, in sostanza, "clona il repo, lancia `install.sh`", eseguito in background dietro la schermata di installazione standard macOS, nessun terminale visibile.

### Windows

Inno Setup (gratuito, script dichiarativo `.iss`, compilabile da riga di comando — adatto a CI) che nel suo step `[Run]` post-installazione lancia `install.ps1` in background dietro il wizard "Avanti/Avanti/Fine" standard, nessun terminale visibile.

🟢 **Ambiente di test già disponibile, non serve procurarsene uno**: VM Parallels esistente e usata dal progetto `Superenalotto` (`AI-Workspace`/memoria di quel progetto), nome attuale **"Windows 11 VS 2022"** (nomi storici/chiave ancora "vs2019"). Accesso SSH pronto: alias `~/.ssh/config` **`parallels-vs2019`** (host `10.211.55.3`, utente `danilo`, chiave `~/.ssh/parallels_vs2019`). Condivisione file automatica Mac↔VM già configurata: percorsi sotto `Documents/...` sul Mac sono visibili sulla VM come `C:\Mac\Home\Documents\...`, senza sync manuale.

🟡 Da fare la prima volta: **Inno Setup non risulta installato su quella VM** (usata finora solo per build .NET/MSBuild in Visual Studio 2022, non per packaging Windows) — va scaricato e installato una tantum (`https://jrsoftware.org`, gratuito) prima di poter compilare `.iss`. Se la VM risultasse sospesa, `prlctl resume` fallisce sull'edizione Parallels Standard in uso — va ripresa manualmente dall'app Parallels Desktop (limite noto, non specifico di questo progetto).

---

## 4. Dove clonare il repo — percorso di destinazione

🟢 **Deciso: `~/Library/Application Support/FogliFatture` su macOS**, non `~/Applications`. Motivo: il repo clonato è una cartella di file sorgente (`.git/`, `backend/`, `frontend/`, `node_modules/`) — non un bundle `.app` (che richiederebbe struttura `FogliFatture.app/Contents/MacOS/…` + `Info.plist` + icona `.icns` dentro `Contents/Resources/`, con un eseguibile singolo dentro, cosa che qui non c'è). Se questa cartella finisse in `~/Applications`, Finder la mostrerebbe come una **cartella normale con icona generica**, non come un'app — un'aspettativa sbagliata per l'utente, che si aspetterebbe di vedere un'icona app cliccabile. `Application Support` è invece il posto convenzionale mac per dati/file di supporto, nascosto di default in Finder (l'utente non ci mette le mani per sbaglio), senza fingere di essere un'app. L'icona vera che l'utente vede/clicca deve venire da altrove (un collegamento nel Dock/menu bar, se previsto — non dalla cartella del codice).
- **Windows**: `%LocalAppData%\FogliFatture` (equivalente — scrivibile senza permessi amministratore, a differenza di `%ProgramFiles%`; Windows non ha lo stesso problema di percezione "icona vs cartella" di macOS, Explorer mostra comunque una cartella file, non un'app, indipendentemente da dove sta).

Evitare posizioni a sola lettura per utenti non-admin o che richiedono privilegi elevati per ogni `git checkout` successivo (un aggiornamento che chiede la password amministratore ogni volta è un'esperienza peggiore, non "1-click").

🟢 **L'icona che l'utente vede/clicca**: un `.app` bundle minimale in `~/Applications/FogliFatture.app`, separato dal codice — non contiene backend/frontend, solo la struttura minima Apple (`Contents/Info.plist`, `Contents/Resources/icon.icns` — riusa l'icona di §6 — `Contents/MacOS/FogliFatture`) dove `Contents/MacOS/FogliFatture` è un semplice script shell che fa `open http://localhost:1969` (il servizio è già in esecuzione via launchd in background, questo bundle serve solo da lanciatore/collegamento con icona propria per Dock/Launchpad — non serve compilare nulla con Xcode, solo creare questa struttura di cartelle a mano o via script durante l'installazione). Su Windows l'equivalente è lo shortcut `.lnk` che Inno Setup crea di norma in automatico nel menu Start/Desktop, puntando a un piccolo eseguibile o script `.vbs`/`.bat` silenzioso che apre il browser sull'URL — Inno Setup gestisce questo passo nativamente, nessun lavoro aggiuntivo oltre alla configurazione standard `[Icons]` del suo script `.iss`.

---

## 5. Aggiornamenti — nessun lavoro nuovo richiesto

🟢 Il meccanismo in `updateService.js` resta valido **senza modifiche**, perché l'installer produce esattamente l'ambiente per cui è stato scritto — una cartella con `.git/` reale, in cui `git fetch`/`checkout` funzionano normalmente. Nessun punto d'azione qui, solo verifica end-to-end che il flusso funzioni identico quando il repo è stato clonato dall'installer invece che a mano (§8, test).

---

## 6. Icona e identità dell'app

🔴 Non esiste oggi nessuna icona applicativa nel repo — serve prima di costruire l'installer, altrimenti appare come file generico nel Finder/Explorer.

- **Sorgente**: artwork master a **1024×1024 px**, PNG con canale alpha, derivato da `frontend/public/favicon.svg` esistente o nuovo artwork.
- **`.icns` (macOS)**, iconset con queste taglie PNG: 16×16, 16×16@2x (32), 32×32, 32×32@2x (64), 128×128, 128×128@2x (256), 256×256, 256×256@2x (512), 512×512, 512×512@2x (1024). Generazione: cartella `Icon.iconset/` nominata secondo convenzione Apple (`icon_16x16.png`, `icon_16x16@2x.png`, ecc.) poi `iconutil -c icns Icon.iconset`, oppure `sips` per i resize — entrambi inclusi in macOS, nessuna dipendenza esterna.
- **`.ico` (Windows)**, singolo file multi-risoluzione con: 16×16, 32×32, 48×48, 256×256. Nessun tool nativo Windows equivalente a `iconutil` da riga di comando — via ImageMagick (`magick convert icon-1024.png -define icon:auto-resize=256,48,32,16 icon.ico`) o libreria/tool online dedicato.
- **Immagine per la UI dell'installer stesso**: Inno Setup e `productbuild` (mac) supportano un'immagine di sfondo/header per la finestra di installazione (dettaglio estetico, dimensioni tipiche 164×314 px pannello laterale Inno Setup) — da definire in fase di costruzione dell'installer (§8), non ora.
- Nome prodotto: **FogliFatture** (già deciso per il repo pubblico, `PUBBLICAZIONE_GITHUB_PUBLICO.md`) — riusare, non reinventare.

---

## 7. Firma, notarizzazione, avvisi di sicurezza (requisito 7/8)

🟢 **macOS**: firma e notarizzazione fattibili, abbonamento Apple Developer già attivo. Flusso: `codesign` sul `.pkg` con certificato "Developer ID Installer" (distinto dal certificato "Developer ID Application" — va generato separatamente nel portale Apple Developer, non è lo stesso cert) → `xcrun notarytool submit --wait` → `xcrun stapler staple`. Senza questo, Gatekeeper blocca l'apertura con un avviso che un utente non tecnico non saprebbe superare — con questo flusso il problema è chiuso, non solo mitigato.

🔴 **Windows**: firma codice **non coperta** dall'abbonamento Apple (programma di firma separato, gestito da una Certification Authority tipo DigiCert/Sectigo per Windows Authenticode — costo e provider da valutare a parte). Senza certificato, SmartScreen mostra "Windows ha protetto il PC" al primo avvio — l'utente deve cliccare "Informazioni aggiuntive" → "Esegui comunque" (un click in più, non bloccante, ma da segnalare esplicitamente nel README/istruzioni di download per non spaventare chi non se lo aspetta).

---

## 8. Disinstallazione (requisito 6/8)

- **macOS**: nessun "Programmi e funzionalità" nativo. Il `.pkg` non fornisce disinstallazione automatica di default — va incluso un secondo script scaricabile o generato durante l'installazione stessa (es. `~/Applications/FogliFatture/Disinstalla.command`, o incluso nel repo clonato come `scripts/uninstall.sh` già esiste — basta renderlo facilmente raggiungibile/eseguibile con doppio click per un utente non tecnico, es. rinominato con estensione `.command`).
- **Windows**: Inno Setup genera automaticamente una voce in "App e funzionalità" — comportamento gratuito, collegare lo step di disinstallazione a `scripts/uninstall.ps1` già esistente (ferma la Scheduled Task).
- **Entrambi**: la disinstallazione non deve mai cancellare `backend/data/`, `.env`, `backend/logs/` per default (dati fiscali dell'utente) — comportamento già garantito da `uninstall.sh`/`.ps1` esistenti (non toccano quei percorsi), va solo preservato nel wrapper installer/disinstaller grafico, non reintrodotto come regressione.

---

## 9. Ordine di esecuzione consigliato

1. Preparare icona (§6) — indipendente dal resto, si può fare subito.
2. Decidere la cartella di destinazione clone (§4) e verificare che `install.sh`/`.ps1` funzionino invariati se lanciati da quella posizione (dovrebbero, essendo già path-indipendenti — verifica pratica comunque necessaria, non assunta).
3. Costruire il `.pkg` mac (script `postinstall` che clona + lancia `install.sh`, poi firma + notarizzazione) — percorso a minor rischio, l'utente ha già gli strumenti Apple Developer.
4. Costruire l'installer Windows (Inno Setup che clona + lancia `install.ps1`), senza firma per ora salvo decisione successiva sul certificato — installare Inno Setup una tantum sulla VM Parallels esistente (§3), non serve procurarsi/allestire una macchina Windows nuova.
5. Aggiungere/verificare disinstallazione grafica per entrambe le piattaforme (§8).
6. Test end-to-end per piattaforma — su Windows, usare la VM Parallels via SSH (`parallels-vs2019`, §3) per un ambiente quanto più simile a una macchina "pulita" (verificare comunque cosa è già installato lì da uso precedente — VS 2022/.NET presenti, non è una VM vergine); unico modo di verificare davvero il requisito "zero prerequisiti visibili" (0.3).
7. Verificare che l'aggiornamento in-app (`UpdateModal.vue`) funzioni identico sul repo clonato dall'installer (§5) — non dovrebbe richiedere modifiche, ma va confermato con un test reale, non assunto.
8. Solo dopo tutto quanto sopra, verificato e stabile: valutare CI di build automatizzata e pubblicazione GitHub Packages/Releases come fase separata, con nuova conferma esplicita dell'utente prima di eseguirla (stessa cautela già usata per la pubblicazione pubblica del repo in `PUBBLICAZIONE_GITHUB_PUBLICO.md`). Per ora, build/test restano manuali in locale su `feature/package`; se serve condividere un installer di test, si usa il repository gogs locale già configurato come `origin` (🔴 da verificare se la versione gogs installata supporta allegati/release, altrimenti condivisione solo via filesystem locale).

---

## Rischi/domande aperte

🔴 Git mancante su Windows: più comune che su mac — l'installer deve gestirlo come già fa per Node (winget), non assumerlo presente.
🔴 Certificato di firma Windows: costo/provider da scegliere se si vuole eliminare l'avviso SmartScreen.
🟡 gogs locale come destinazione "artifact di test": da verificare se supporta allegati/release.
🔴 Nome identificatori tecnici interni (plist label, Scheduled Task name) — oggi `com.prioregroup.fatturazione`/analogo: da decidere se rinominare a FogliFatture o lasciare invariato (stessa decisione già presa per la pubblicazione GitHub, dove sono rimasti invariati perché non visibili all'utente finale).

## Review Checklist

- Completeness: 🟢 copre tutti gli 8 requisiti di §0 (installer che clona repo, non binario compilato).
- Accuracy: 🟢 basata su lettura diretta di `install.sh`, `updateService.js`, `jsonStore.js`, `logger.js`, `package.json`.
- Consistency: 🟢 coerente con `PACKAGING_BREW_WINGET.md` (nome FogliFatture, GitHub Releases futuro) e `PUBBLICAZIONE_GITHUB_PUBLICO.md` (cautela su pubblicazione esterna, path-indipendenza già verificata).
- TODO: icona; gestione Git mancante su Windows; certificato Windows.
- Missing information: 🔴 se gogs locale supporta release/allegati; 🔴 rinomina identificatori tecnici interni.
- Open questions: vedi sezione Rischi sopra.
- Confidence level: 🟢 piano attuabile, nessun rischio tecnico bloccante residuo (keytar/xlsx non un problema con questo approccio).
