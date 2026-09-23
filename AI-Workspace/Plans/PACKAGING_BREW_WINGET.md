# Piano: distribuzione a comando singolo (npm, brew, winget, binari standalone)

Confidence: 🟢 confermato da codice · 🟡 inferito · 🔴 ipotesi

Nota: tracciato su Gogs (locale), escluso solo dal sync verso GitHub (skill `sync-public`) — non pubblicato.

## Obiettivo

Oggi: l'utente scarica la cartella del progetto e lancia `scripts/install.sh` (Mac) o `scripts/install.ps1` (Windows), che installano Node se manca, fanno `npm install` + build frontend, creano la config, registrano il servizio permanente.

Obiettivo: sostituire "scarica la cartella a mano" con un comando solo, lasciando dati/servizio esattamente come oggi. Quattro percorsi fattibili senza dipendere da revisione esterna o abbonamenti a pagamento, elencati dal più smart (meno sforzo, massimo riuso) al più impegnativo.

Escluso (non fattibile a costo/sforzo ragionevole): winget pubblico nel catalogo ufficiale `microsoft/winget-pkgs` (richiede revisione Microsoft + firma codice a pagamento per evitare l'avviso "editore sconosciuto").

## Cosa c'è già (riusabile, niente da reinventare)

🟢 `scripts/install.sh` / `scripts/uninstall.sh` — setup/servizio Mac (launchd), gestisce Node mancante via brew.
🟢 `scripts/install.ps1` / `scripts/uninstall.ps1` — equivalente Windows (Scheduled Task), gestisce Node mancante via winget.
🟢 `backend/.env.example` — template config senza segreti, copiato automaticamente al primo avvio.
🟢 App 100% locale, nessun servizio cloud da provisionare.

---

## 1. Pacchetto npm (il più smart)

`npx foglifatture` o `npm i -g foglifatture`. Nessun build nativo, nessuna firma, nessuna review. Riuso totale: lo script `bin` del pacchetto npm richiama la stessa logica di `install.sh`/`install.ps1` (o le sostituisce, girando su Node già presente per definizione).

Requisito: Node lato utente — non è un problema nuovo, gli script attuali già lo richiedono/installano.

Sforzo: pubblicare su npm registry (account npm, `npm publish`), aggiungere `bin` in `package.json`.

🟡 Compatibile con GitHub Packages come alternativa a npm registry pubblico: stesso `npm publish`, ma verso il registry npm di GitHub (`npm.pkg.github.com`), pacchetto scoped (`@priore/foglifatture`). Richiede che l'utente configuri `.npmrc` con quel registry — meno comodo per `npx` diretto, utile solo se si vuole tenere tutto dentro GitHub invece che su npm pubblico.

## 2. Homebrew tap proprio

```
brew tap priore/foglifatture
brew install foglifatture
```

Tap = repository GitHub proprio (`priore/homebrew-foglifatture`), nessun permesso di terzi. La formula punta a `github.com/priore/foglifatture` (repo confermato pubblico) o a un suo tag di release, e lancia `scripts/install.sh` come passo finale (build a install-time, non binario pre-costruito).

🟡 Da verificare: `backend/package.json` include `keytar` (modulo nativo, richiede compilatore C++) — di norma non crea attriti con Node già installato, ma va testato nella formula.

## 3. winget sorgente locale

```
winget source add --name FoglifattureLocal <url-o-path-repo-manifest>
winget install foglifatture
```

Manifest YAML proprio, nessuna sottomissione a `microsoft/winget-pkgs`, nessuna review, nessuna firma. winget si aspetta un file scaricabile pronto (zip con progetto + `install.ps1`), non un repo Git da clonare. Limite accettato: comando disponibile solo su chi ha aggiunto la sorgente.

## 4. Installer grafico 1-click (`.pkg` mac, Inno Setup Windows)

**Non un binario compilato** — vedi `BINARI_STANDALONE_1CLICK.md` per il piano di dettaglio completo. L'installer è un piccolo bootstrapper che clona il repository sorgente sulla macchina dell'utente (con `.git/` intatto) e lancia `scripts/install.sh`/`install.ps1` esistenti, invece di richiedere a chi lo usa di aprire un terminale. Nessun bundling di codice in un eseguibile — Node/npm/keytar restano gestiti dagli script già esistenti esattamente come oggi.

`keytar` (modulo nativo, deprecato upstream) **non è un rischio** con questo approccio — `npm install` gira sulla macchina utente come già fa oggi, nessun bundler deve saperlo impacchettare. E l'aggiornamento in-app già esistente (`updateService.js`, basato su `git fetch`/checkout) **resta riusabile senza modifiche**, perché l'utente ha un vero repo Git clonato, non un binario opaco.

Il più completo lato esperienza utente (nessun terminale mai visibile), ma il più impegnativo da costruire:

- 🟢 `backend/data/` già spostabile: `DATA_DIR` configurabile a runtime — punta a una cartella utente persistente senza modifiche al codice.
- 🟢 `backend/logs/`: `LOG_DIR` hardcoded, ma qui non è un blocco come lo sarebbe per un binario — il repo clonato vive comunque in una cartella scrivibile dall'utente (`~/Applications/FogliFatture` mac, `%LocalAppData%\FogliFatture` Windows), non in una posizione a sola lettura.
- 🟢 Firma e notarizzazione mac fattibili: abbonamento Apple Developer già attivo. Flusso: `codesign` sul `.pkg` con certificato "Developer ID Installer" → `xcrun notarytool submit --wait` → `xcrun stapler staple`. Elimina il warning Gatekeeper, niente bypass manuale richiesto all'utente.
- 🔴 Firma codice Windows non coperta dall'abbonamento Apple — certificato Authenticode separato (costo/provider da decidere) per evitare l'avviso SmartScreen.
- Icona applicativa (`.icns`/`.ico`) da creare, non esiste oggi — formati e pixel esatti dettagliati in `BINARI_STANDALONE_1CLICK.md` §6.

🟢 Compatibile con GitHub Releases come host dell'installer stesso (non di binari compilati): la CI (quando si arriverà a costruirla) pubblica `.pkg`/`.exe` come asset di una release, referenziabile da un link diretto nel README o da un futuro step di formula/manifest.

---

## Versioni, aggiornamenti, disinstallazione (comune a 1-3)

Per npm/brew/winget: `upgrade`/`update` devono tracciare un tag Git di versione e **non toccare mai** `backend/data/`, `backend/.env`, `backend/logs/` — gli script attuali già li rispettano, va verificato che resti vero anche nel flusso di reinstallazione via pacchetto. La disinstallazione (`npm uninstall -g`, `brew uninstall`, `winget uninstall`) deve richiamare `scripts/uninstall.sh`/`.ps1` esistenti, non limitarsi a cancellare i file del pacchetto.

## Prossimi passi

1. ✅ Repository GitHub pubblico confermato: `github.com/priore/foglifatture`.
2. Pubblicare il pacchetto npm (punto 1) — percorso a minor sforzo, farlo per primo.
3. Creare e testare formula Homebrew (punto 2), verificare `keytar` in build.
4. Creare e testare manifest winget locale (punto 3).
5. Solo se serve un'esperienza doppio-click senza terminale: costruire l'installer grafico (punto 4) — piano di dettaglio in `BINARI_STANDALONE_1CLICK.md`.
6. Aggiornare `README.md` con i nuovi comandi, mantenendo gli script attuali come fallback.
7. Aggiornare `CHANGELOG.md` quando un nuovo metodo di installazione va in uso.

## Review Checklist

- Completeness: 🟢 copre i 4 percorsi fattibili, ordinati per sforzo/riuso.
- Accuracy: 🟢 basata su lettura diretta di `scripts/*.sh`, `scripts/*.ps1`, `package.json`, `.env.example`.
- Consistency: 🟢 coerente con vincolo "single-user, dati locali, niente cloud" del `CLAUDE.md`.
- TODO: verifica `keytar` in formula Homebrew; scelta se/quando fare il punto 4.
- Missing information: nessuna — repo pubblico confermato (`priore/foglifatture`).
- Open questions: nessuna bloccante sui percorsi 1-3; punto 4 resta opzionale/futuro.
- Confidence level: 🟢 piano attuabile, 4 percorsi reali senza dipendenze a pagamento o review esterne bloccanti.
