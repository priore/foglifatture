# Migrazione da `keytar` (deprecato) a `@napi-rs/keyring`

Contesto: `keytar` (Atom/GitHub) è deprecato e archiviato upstream, nessuna manutenzione, nessuna build per Node/Electron recenti garantita in futuro. Va sostituito prima che smetta di installarsi o compilare su una versione Node nuova.

## 1. Vincolo primario: zero perdita per chi ha già installato

🟢 **Verificato empiricamente** (non solo per lettura codice): su questa stessa macchina esiste già una voce reale in Keychain (`security find-generic-password -s "Timesheet-Fatturazione" -a "pec.passwordMittente"`), scritta da `keytar`. Ho letto quella stessa voce con `@napi-rs/keyring` (`Entry('Timesheet-Fatturazione', 'pec.passwordMittente').getPassword()`) e il valore torna intatto.

Motivo: entrambe le librerie, su macOS, si appoggiano alla stessa API di sistema (Keychain `kSecClassGenericPassword`) con lo stesso schema `service`/`account`. Su Windows entrambe usano Credential Manager (DPAPI) con lo stesso schema; su Linux entrambe usano Secret Service (libsecret) via D-Bus. **Non serve nessuno script di migrazione dati** — le 5 voci esistenti (`pec.passwordMittente`, `backup.password`, `oauth.googleClientSecret`, `gemini.apiKey`, `groq.apiKey`, `claude.apiKey`, tutte sotto service `Timesheet-Fatturazione`) restano leggibili cambiando solo la libreria client.

Questo è il punto che elimina il rischio principale del task: chi ha già l'app in esecuzione con password salvate non perde nulla al prossimo `git pull` + restart, perché lo storage sottostante non cambia, cambia solo chi lo legge.

## 2. Scelta libreria: perché `@napi-rs/keyring` e non alternative

Confrontate (🟢 verificato via `npm view` + GitHub API, stelle controllate 2026-09-07):

| Libreria | Stelle GitHub | Stato | Binari precompilati | API |
|---|---|---|---|---|
| `atom/node-keytar` (originale) | 1426 | 🔴 **archiviato**, nessuna manutenzione dal 2022 | node-gyp a install-time | async |
| `shiftkey/node-keytar` (fork "keytar-forked") | 7 | 🟡 vivo ma quasi non seguito, mantenuto da un solo dev per uso interno GitHub Desktop | prebuild via `prebuild-install` | async |
| `Brooooooklyn/keyring-node` (pacchetto `@napi-rs/keyring`) | 99 | 🟢 attivamente mantenuto, rilasci fino a v2.0.0, push recenti | 🟢 prebuild per darwin/win32/linux (tutte le arch rilevanti) | sync |
| `hwchen/keyring` (Rust, libreria sottostante di napi-rs) | 372 | 🟢 molto attiva, è il motore usato sotto `@napi-rs/keyring` | n/a (non è il binding Node) | — |

Punto sulle stelle: **nessuna alternativa Node viva batte le 1426 stelle di keytar originale** — ma quel numero è storico, accumulato prima dell'archiviazione (2022), non un segnale di salute attuale. Tra le librerie **non archiviate**, `@napi-rs/keyring` ha più stelle di ogni fork diretto di keytar (99 vs 7), ed eredita indirettamente la reputazione di `keyring-rs` (372 stelle, il motore Rust sotto il binding) — la libreria Rust è una delle più usate nell'ecosistema per questo scopo esatto, ben oltre le librerie Node dedicate.

`@napi-rs/keyring` vince su tutti i rami della ladder: più popolare di ogni alternativa non-morta, mantenuto, e **risolve anche un rischio già scritto nei piani di packaging esistenti** (`PACKAGING_BREW_WINGET.md`, `BINARI_STANDALONE_1CLICK.md`: "keytar richiede compilatore C++", "verificare keytar in build Homebrew") — con binari precompilati quel rischio sparisce del tutto, non va più "verificato in formula".

## 3. Differenza di API da gestire: async → sync

`keytar.getPassword/setPassword/deletePassword` sono `Promise`-based. `@napi-rs/keyring`'s `Entry` è **sincrona** (`getPassword()`/`setPassword()`/`deletePassword()` ritornano/lanciano subito, nessuna Promise).

🟢 Verificato: `getPassword()` su chiave assente ritorna `null` (non lancia) — stesso comportamento di `keytar.getPassword`. `deletePassword()` su chiave già assente non lancia — stesso comportamento idempotente.

Impatto sul codice: i call site restano `await`-abili senza cambiare firma esterna (una funzione `async` che internamente chiama una funzione sync è comunque legale e compatibile con tutti i chiamanti esistenti in `configService.js`/`envService.js`/`auth.js`, che già fanno `await leggiX()`), quindi **nessuna funzione esportata cambia firma** — l'`await` diventa a costo zero (risolve subito) ma il codice chiamante non si tocca.

## 4. Punti di modifica esatti (3 file, nessun altro)

Nessun altro file nel repo importa `keytar` (verificato: `grep -rn "keytar"` esclusi `node_modules`/lock file/doc → solo questi 3 + `package.json`).

### `backend/src/services/configService.js`
- riga 6: `import keytar from 'keytar';` → `import { Entry } from '@napi-rs/keyring';`
- righe 163, 167, 172-173, 256, 259: sostituire `keytar.setPassword(SERVICE, account, val)` → `new Entry(SERVICE, account).setPassword(val)`, `keytar.getPassword(SERVICE, account)` → `new Entry(SERVICE, account).getPassword()`, `keytar.deletePassword(SERVICE, account)` → `new Entry(SERVICE, account).deletePassword()`.
- Commenti che citano "Keychain (keytar)" (righe 9, 12, 161) → aggiornare a "Keychain OS" generico, senza nominare la libreria (il commento non deve rompersi alla prossima migrazione).

### `backend/src/services/envService.js`
- riga 10: stesso cambio import.
- righe 34-37, 67-70, 92, 97, 134, 148: stesso pattern `new Entry(SERVICE, account).getPassword()/.setPassword()`.
- commento riga 5-7 e 90: idem, genericizzare "keytar" → "Keychain OS".

### `backend/src/lib/auth.js`
- Nessuna chiamata diretta a `keytar` (usa solo `leggiGoogleClientSecret()` da `envService.js`) — **nessuna modifica di codice**, solo il commento riga 9 se cita "keytar" esplicitamente.

### `backend/package.json`
- riga 21: `"keytar": "^7.9.0"` → `"@napi-rs/keyring": "^2.0.0"`.

Nota di stile: dato che ogni account ha service fisso (`KEYTAR_SERVICE`/costanti già esistenti), conviene un piccolo helper locale per file (`const entry = (account) => new Entry(KEYTAR_SERVICE, account);`) invece di ripetere `new Entry(...)` a ogni chiamata — non un file/modulo condiviso nuovo, resta dentro il file che già possiede quelle costanti (`jsonStore.js`-style, nessuna astrazione cross-file per due soli file che già non condividono altro).

Rinominare le costanti `KEYTAR_SERVICE`/`KEYTAR_ACCOUNT_*` non è necessario (sono identificatori interni, non stringhe esposte) — lasciarle com'è evita un diff largo per zero beneficio; eventualmente rinominarle in un secondo momento se il nome infastidisce, non in questa migrazione.

## 5. Test da aggiornare/aggiungere

Nessun test esistente copre `configService`/`envService` (verificare `backend/src/services/*.test.js` — solo `pecService.test.js` esiste oggi). Per rispettare la regola "logica non banale → un check runnabile": aggiungere un test minimo `backend/src/services/configService.test.js` (Node `--test`, no framework) che verifica il roundtrip set/get/delete su un service/account di test (`Timesheet-Fatturazione-test`), usando l'API reale (i CI runner GitHub Actions macOS/Linux hanno un keychain/keyring disponibile; su Linux headless senza D-Bus session il test può fallire — guardia con `try/catch` + `t.skip()` se l'ambiente non ha un secret service disponibile, così il test non rompe CI Linux headless senza bloccare la verifica locale).

## 5bis. Test di compatibilità cross-libreria (precondizione alla sostituzione)

Verifica empirica, da eseguire una tantum prima di applicare §4, non un test automatico permanente (script usa-e-getta in `AI-Workspace/` o scratchpad, non un file sotto `backend/src`).

1. Con `keytar` ancora installato: creare voce `service="Timesheet-Fatturazione-test"`, `account="TEST"`, valore `"1234"` (`keytar.setPassword(...)`).
2. Installare `@napi-rs/keyring` (senza ancora disinstallare `keytar`, così restano entrambi disponibili per il confronto).
3. Con `@napi-rs/keyring`: `new Entry("Timesheet-Fatturazione-test", "TEST").getPassword()` e confrontare il valore letto con `"1234"`.
4. Se corrisponde → precondizione verificata, procedere con la sostituzione integrale di `keytar` con `@napi-rs/keyring` come da §4-§6. Se non corrisponde → bloccare la migrazione, il presupposto di compatibilità storage (§1) non vale su questa macchina/OS e va rianalizzato prima di continuare.
5. Pulizia: eliminare la voce di test (`deletePassword` su entrambe le librerie, o solo su quella rimasta installata) per non lasciare residui in Keychain/Credential Manager/Secret Service.

Nota: questo test è aggiuntivo e indipendente dal test automatico di §5 (quello copre il roundtrip della libreria finale nel codice di produzione; questo copre solo la compatibilità di lettura tra le due librerie, punto §1 del piano).

## 6. Sequenza di esecuzione

1. `npm install @napi-rs/keyring` in `backend/`, `npm uninstall keytar`.
2. Applicare le sostituzioni nei 3 file (§4).
3. Riavviare il backend (chiedere conferma esplicita, come da `dev-workflow.md`) e verificare a mano: GET `/api/config` mostra ancora il placeholder mascherato per PEC/backup già impostate (prova che la lettura funziona sulle voci esistenti), salvataggio di una nuova password PEC di test e verifica che compaia in Keychain con lo stesso `service`/`account` di prima.
4. Aggiungere il test minimo (§5).
5. Aggiornare `CHANGELOG.md` (radice, italiano, sotto `## [Unreleased]`) — è un cambio "interno" (nessun comportamento utente-visibile cambia: le password restano dove sono, l'app si comporta identica) quindi **non richiede voce nel changelog pubblico** per la regola "skip pure-internal changes" — a meno che si voglia comunque documentarlo perché tocca la sicurezza dei dati (giudizio dell'utente).
6. Aggiornare i due piani di packaging che citano `keytar` come rischio (`PACKAGING_BREW_WINGET.md` righe 43, 58, 80, 91; `BINARI_STANDALONE_1CLICK.md` righe 15, 44, 157): il rischio "compilatore C++ richiesto"/"verificare in formula Homebrew" non si applica più con `@napi-rs/keyring` (binari precompilati) — righe da correggere, non da cancellare, per non perdere la cronologia della decisione.

## 7. Rischi residui

- 🟡 Linux: `@napi-rs/keyring` richiede un Secret Service provider attivo (GNOME Keyring, KWallet via bridge, o `keyring-rs`'s built-in fallback) — stesso identico requisito di `keytar` su Linux, quindi non è una regressione, solo un vincolo preesistente non peggiorato.
- 🟢 macOS: nessun rischio nuovo, verificato funzionante (roundtrip + lettura voce reale scritta da keytar) su Keychain macOS reale in questa sessione.
- 🟢 Windows install: verificato su VM reale (Windows 11, Parallels, via SSH) — `npm install @napi-rs/keyring` scarica il binario prebuild `@napi-rs/keyring-win32-x64-msvc` senza compilatore, nessun errore.
- 🟡 Windows runtime — **limite scoperto, non della libreria**: il roundtrip `setPassword`/`getPassword` fallisce da sessione SSH con `Windows ERROR_NO_SUCH_LOGON_SESSION`. Causa: DPAPI (su cui si appoggia sia `@napi-rs/keyring` sia keytar su Windows) richiede una logon session interattiva con profilo utente caricato; una sessione SSH è un "network logon" (verificato: nessun `query session` disponibile, nessuna sessione console associata) e non espone la user master key DPAPI. **Questo limite è identico per keytar** (stesso backend DPAPI) — non è una regressione introdotta dalla migrazione, è un vincolo di come si è testato (SSH), non di come gira l'app in produzione (l'app reale gira come processo nella sessione interattiva dell'utente loggato, non via SSH). Da verificare con un test rapido via RDP o console locale prima di considerare il rischio Windows chiuso, ma non blocca il piano: in uso normale (utente loggato su desktop Windows, app avviata da lì) il problema non si presenta.

## Review Checklist

- Completeness: 🟢 copre tutti i call site (3 file), package.json, test, doc di packaging correlate.
- Accuracy: 🟢 basata su lettura diretta del codice sorgente + test empirico roundtrip su Keychain macOS reale (non solo lettura doc npm).
- Consistency: 🟢 coerente con `code-quality.md` (niente dipendenza nuova non necessaria — qui la sostituzione è 1:1, non un'aggiunta) e `sensitive-data.md` (nessun nuovo file/percorso da aggiungere a `.gitignore`, lo storage resta OS-level, mai su disco nel repo).
- TODO: verifica reale su Windows (§7); decidere se voce CHANGELOG pubblico.
- Missing information: nessuna bloccante.
- Open questions: nessuna.
- Confidence level: 🟢 piano attuabile, rischio principale (perdita password utenti esistenti) verificato empiricamente come non-problema.
