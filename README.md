# Fogli & Fatture

[![Licenza](https://img.shields.io/badge/licenza-PolyForm%20Noncommercial%201.0.0-blue)](LICENSE)
[![Node](https://img.shields.io/badge/node-%E2%89%A518-brightgreen)](https://nodejs.org)
![Piattaforma](https://img.shields.io/badge/piattaforma-macOS%20%7C%20Windows-lightgrey)
![FatturaPA XML](https://img.shields.io/badge/FatturaPA%20XML-conforme-blue)
![Invio SDI](https://img.shields.io/badge/SDI-invio%20diretto-blue)
![Incasso Bitcoin](https://img.shields.io/badge/Bitcoin-incasso%20fatture-orange?logo=bitcoin)
[![Security Policy](https://img.shields.io/badge/security-policy-orange)](SECURITY.md)
[![Contributing](https://img.shields.io/badge/contributing-guide-informational)](CONTRIBUTING.md)
[![Donate with PayPal](https://img.shields.io/badge/PayPal-donate-blue?logo=paypal)](https://paypal.me/prioregroup)
[![Donate with BITCOIN](https://img.shields.io/badge/BITCOIN-donate-green?logo=bitcoin)](https://github.com/priore/foglifatture#support-development)
[![Star History](https://img.shields.io/badge/⭐-Star%20History-blue)](https://star-history.com/#priore/foglifatture&Date)


App per chi lavora in regime forfettario, con due funzioni indipendenti:
- **Timesheet mensile** — registra le ore lavorate giorno per giorno, per uno o più clienti.
- **Fatturazione elettronica** — genera fatture calcolate da timesheet (ore × tariffa) oppure a importo e descrizione liberi, senza bisogno del timesheet.

Gira sul tuo computer: nessun dato va su internet, nessun abbonamento.

**Stato del progetto**: attivo, mantenuto da una sola persona nel tempo libero — nessuno SLA. Segnalazioni prese sul serio, vedi [SECURITY.md](SECURITY.md).

## Indice

- [Features](#features)
- [Sicurezza](#sicurezza)
- [Screenshot](#screenshot)
- [Installazione](#installazione)
- [Primo utilizzo](#primo-utilizzo)
- [Domande frequenti](#domande-frequenti)
- [Note per chi programma](#note-per-chi-programma)
- [Licenza](#licenza)
- [Support Development](#support-development)

## Features

- **Incasso fatture in Bitcoin** — nessun altro gestionale forfettario italiano noto lo offre.
  - Registra un incasso in BTC (datio in solutum) con TXID, cambio EUR/BTC applicato (fonte e ora) e indirizzo di destinazione.
  - Dati pronti per un eventuale controllo fiscale.
  - Dicitura opzionale in fattura/XML per i clienti abilitati.
  - Lettura opzionale dati transazione da blockchain e cambio storico.
  - Colonne dedicate nell'export per il commercialista.
- **Timesheet multi-cliente** — ore giornaliere per cliente, con tariffa oraria propria per ciascuno.
- **Fatturazione elettronica FatturaPA** — XML conforme allo schema ufficiale, validato prima dell'invio.
  - Regime forfettario: `RegimeFiscale RF19`, IVA esente `N2.2`, bollo virtuale sopra soglia.
- **Clienti esteri** — gestione IVA automatica per clienti UE e extra-UE.
  - Inversione contabile N2.1 (art. 7-ter/7-septies DPR 633/72).
  - XML FatturaPA adattivo: CodiceDestinatario, CAP, IdPaese dal paese del cliente.
  - Scadenze Intrastat trimestrali se iscritto al VIES.
- **Rivalsa INPS 4% facoltativa** — addebito al cliente del contributo INPS (L. 662/96 art. 1 c. 212).
  - Blocco `DatiCassaPrevidenziale TC22` aggiunto nell'XML FatturaPA quando attiva.
  - Configurabile globalmente o per singolo cliente.
- **Avviso soglia forfettaria** — conferma obbligatoria prima di emettere una fattura che supera le soglie del regime.
  - Oltre 85.000 €: conferma richiesta (uscita dal regime l'anno prossimo).
  - Oltre 100.000 €: conferma richiesta (uscita immediata dal regime).
  - Limite personale configurabile per una conferma anticipata.
- **Email separata per timesheet e fattura** — ogni cliente può avere indirizzi email distinti per l'invio del timesheet e della fattura, con supporto più destinatari per indirizzo.
- **Invio PEC automatico** — fattura inviata al Sistema di Interscambio (SDI) direttamente dall'app, via la tua casella PEC.
- **Ricezione ricevute SDI automatica**:
  - Polling della casella PEC via IMAP.
  - Riconoscimento e archiviazione delle ricevute (accettazione, scarto, consegna, mancata consegna...).
  - Notifica desktop.
- **Fatturazione a importo libero** — anche senza passare dal timesheet, per fatture a corpo o extra.
- **Dashboard regime forfettario** — totali e soglie del regime aggiornati in tempo reale.
- **Numerazione fatture unica e progressiva** — condivisa correttamente tra tutti i clienti, come richiesto dalla normativa (legata alla partita IVA, non al singolo cliente).
- **Import storico** — importazione di timesheet pregressi (XLS) e fatture già emesse (XML FatturaPA), per partire senza perdere lo storico.
- **Backup automatico ed esportazione cifrata**:
  - Copia periodica programmabile.
  - Esportazione manuale protetta da password.
- **Promemoria fine mese** — notifica opzionale per non dimenticare di compilare il timesheet.
- **Regole fiscali versionate** — aliquote, soglie, codici tributo e causali INPS del regime forfettario raccolti in un pacchetto per anno.
  - Fonte normativa e link al documento ufficiale per ogni valore.
  - La dashboard mostra il tab "Regole fiscali" con le variazioni rispetto all'anno precedente in tabella.
  - Il bottone "Spiega con AI" genera una spiegazione in linguaggio semplice delle differenze.
- **Regime forfettario avanzato** — flag aliquota agevolata 5% (con verifica automatica dei requisiti d'età dell'attività) e flag ISA per la ripartizione degli acconti (50/50 o 40/60).
- **Scadenze fiscali con AI** — calcolo locale delle scadenze del regime forfettario, con supporto AI (Gemini) solo per casi particolari come le proroghe.
- **Dashboard F24** — tab dedicata con:
  - Bollo trimestrale con rinvii di legge automatici per importi ≤ 5.000 €.
  - Stima versamenti saldo/acconti imposta e INPS con scadenze calcolate.
  - Rateizzazione INPS con interessi (D.Lgs. 33/2025).
  - Piano versamenti con stati: da pagare, programmato, pagato, annullato.
  - Righe F24 inserite automaticamente al pagamento.
  - PDF F24 precompilato su modello ufficiale AdE.
  - **Rateizzazione saldo F24** — da 1 a 7 rate con date, interessi (codice 1668) e causali INPS rateizzate calcolati automaticamente.
  - **Compensazione crediti fiscali** — registrazione crediti con codice tributo e compensazione verticale/orizzontale con avvisi sui limiti di legge (DL 124/2019).
- **Fatture in valuta estera** — USD, GBP, CHF e altre valute Banca d'Italia; cambio ufficiale recuperato automaticamente e congelato nell'XML FatturaPA.
- **Registro fonti normative** — ogni valore nelle Regole fiscali mostra il testo di legge archiviato localmente, con la citazione evidenziata e link a Normattiva.
- **Monitoraggio fonti normative** — controllo periodico automatico delle fonti; proposte AI applicabili o scartabili selettivamente dalle Impostazioni.
- **Toggle notifiche desktop** — abilita/disabilita tutte le notifiche dell'app da un'unica impostazione; deduplicazione automatica (stessa notifica silenziata per 24 ore).
- **AI ausilio normativo** — spiegazioni in linguaggio semplice dei requisiti dell'aliquota agevolata 5% e dell'art. 7-septies per clienti extra-UE (richiede provider AI configurato).
- **Router AI a cascata** — supporto AI senza configurazione obbligatoria: 6 provider con fallback automatico.
  - Gemini API
  - Google Antigravity CLI
  - GitHub Copilot CLI
  - Claude API
  - Groq API
  - LLM locale (Ollama/LM Studio)
  - Chi ha un account Google o GitHub non deve configurare nulla.
- **Login opzionale con Google OAuth** — accesso protetto per singolo utente, o app libera in rete locale se non configurato.
- **Multi-piattaforma** — installazione come servizio persistente su macOS (`launchd`) e Windows (Task Scheduler).

## Sicurezza

- Nessuna credenziale hardcoded: chiavi API, secret OAuth e dati PEC vivono solo in `backend/.env` locale, mai versionato né distribuito.
- La chiave API Gemini non viene mai esposta al frontend né scritta nei log — usata server-side solo per la chiamata a `generativelanguage.googleapis.com`.
- Avvio path-indipendente: l'app funziona da qualsiasi cartella, su Mac e Windows.
- Repository sotto scansione automatica continua:
  - Secret scanning (gitleaks).
  - Analisi statica del codice (CodeQL).
  - Controllo licenze delle dipendenze.
  - Monitoraggio CVE note (Dependabot).
- Dettagli completi e canale di segnalazione responsabile: [SECURITY.md](SECURITY.md).

**Trasparenza dati verso servizi AI esterni**: la funzione di lookup codice ATECO e il calcolo di alcune scadenze fiscali con proroga usano l'API Gemini (Google). Solo i dati strettamente necessari a quella specifica elaborazione (es. descrizione attività, date di scadenza) vengono inviati a Google — mai l'intero storico fatture/timesheet. La funzione è opzionale e disattivabile.

## Screenshot

### Tieni sotto controllo il regime forfettario

Ricavi cumulati, reddito imponibile, proiezione fine anno e distanza dalla soglia degli 85.000€: tutto in una sola schermata, aggiornato in tempo reale mentre fatturi. Scadenze fiscali comprese, con avviso per la prossima in arrivo.

![Dashboard forfettario](docs/screenshots/dashboard.png)

### Dalle ore lavorate alla fattura, senza calcolatrice

Scegli il mese, l'app somma le ore dal timesheet e calcola il compenso in automatico — bollo virtuale incluso quando serve. Anteprima della fattura pronta a fianco, generazione definitiva con un click.

![Fattura Pro-Forma](docs/screenshots/fattura-proforma.png)

### Un foglio ore che conosci già

Compila le ore giorno per giorno, cliente per cliente, con la stessa logica di un foglio ore aziendale — nessuna curva di apprendimento. Più clienti attivi insieme, ognuno con la propria tariffa oraria.

![Timesheet mensile](docs/screenshots/timesheet-mensile.png)

## Installazione

### Installer 1-click (consigliato)

Il modo più semplice: scarica l'installer per il tuo sistema, aprilo e segui la procedura guidata. Non servono terminale né Node.js — l'installer scarica e installa automaticamente l'ultima versione disponibile.

| Sistema | Download |
|---|---|
| macOS (Universal) | [FogliFatture-mac-universal.pkg](https://github.com/priore/foglifatture/raw/main/installer/FogliFatture-mac-universal.pkg) |
| Windows 10/11 (64-bit) | [FogliFatture-win-x64.exe](https://github.com/priore/foglifatture/raw/main/installer/FogliFatture-win-x64.exe) |

**macOS**: apri il `.pkg` e segui il wizard. Se macOS avvisa che il file è di uno sviluppatore non identificato, vai in **Impostazioni di sistema → Privacy e sicurezza** e clicca "Apri comunque".

**Windows**: esegui il `.exe` e segui il wizard. Se Windows Defender SmartScreen mostra un avviso, clicca "Ulteriori informazioni" → "Esegui comunque".

> **Versione specifica** (avanzato): per installare una versione precisa anziché l'ultima, lancia l'installer da terminale con il numero di versione:
> - macOS: `FOGLIFATTURE_VERSION=1.5.0 installer -pkg FogliFatture-mac-universal.pkg -target CurrentUserHomeDirectory`
> - Windows: `FogliFatture-win-x64.exe /Version=1.5.0`

Al termine dell'installazione l'app:
- parte da sola ad ogni avvio del computer,
- si riavvia da sola se dovesse bloccarsi,
- è raggiungibile all'indirizzo `http://localhost:1969`.

---

### Installazione da terminale (alternativa)

Serve solo la prima volta. Lo script fa tutto da solo: installa Node.js se manca, scarica le librerie necessarie, prepara la configurazione, avvia l'app come servizio permanente e apre il browser sulla pagina iniziale.

Requisiti minimi: Node.js ≥ 18 (installato automaticamente dallo script se assente), macOS o Windows 10/11.

#### Mac

1. Apri l'app **Terminale** (Applicazioni → Utility → Terminale).
2. Scarica il progetto ed entra nella cartella:
   ```bash
   git clone https://github.com/priore/foglifatture.git
   cd foglifatture
   ```
3. Lancia l'installazione:
   ```bash
   scripts/install.sh
   ```

Da quel momento l'app:
- parte da sola ogni volta che accendi il Mac,
- si riavvia da sola se dovesse bloccarsi,
- resta sempre raggiungibile all'indirizzo `http://localhost:1969` (apri quel link con qualsiasi browser).

Per disinstallarla (ferma il servizio, **non tocca** i tuoi dati):
```bash
scripts/uninstall.sh
```

#### Windows

1. Apri **PowerShell** (cerca "PowerShell" nel menu Start).
2. Scarica il progetto ed entra nella cartella:
   ```powershell
   git clone https://github.com/priore/foglifatture.git
   cd foglifatture
   ```
3. Lancia l'installazione:
   ```powershell
   .\scripts\install.ps1
   ```
   Se PowerShell blocca lo script ("esecuzione script disabilitata"), esegui prima una volta:
   ```powershell
   Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
   ```

Da quel momento l'app:
- parte da sola ad ogni accesso a Windows,
- si riavvia da sola se dovesse bloccarsi,
- resta sempre raggiungibile all'indirizzo `http://localhost:1969` (apri quel link con qualsiasi browser).

Per disinstallarla (ferma il servizio, **non tocca** i tuoi dati):
```powershell
.\scripts\uninstall.ps1
```

## Primo utilizzo

1. Apri il browser su `http://localhost:1969`.
2. Vai su **Impostazioni** e compila la procedura guidata: i tuoi dati (partita IVA, ecc.), i dati del cliente (o dei clienti — puoi aggiungerne quanti ne servono, ognuno con la propria tariffa oraria), i dati PEC.
3. Da **Timesheet** registra le ore lavorate giorno per giorno. Se hai più clienti, scegli quale con il selettore in alto.
4. Da **Fattura Pro-Forma** genera la fattura del mese quando sei pronto (per il cliente scelto): scegli "Da timesheet" (calcolo automatico ore × tariffa) oppure "Importo libero" se vuoi fatturare un importo e una descrizione a piacere senza passare dal timesheet.

Tutto qui — non serve altro per iniziare a usarla.

## Domande frequenti

### Dove sono salvati i miei dati?

Nella cartella `backend/data/` del progetto, in semplici file. Non escono mai dal tuo computer. Fai un backup ogni tanto: in **Impostazioni** trovi la funzione "Esporta storico" che crea una copia cifrata con password, e puoi anche attivare un backup automatico periodico.

### Posso proteggere l'accesso con un login?

Sì, è facoltativo. Se non lo configuri, l'app è liberamente accessibile a chiunque abbia accesso al tuo computer/rete locale — va bene per uso personale su un solo Mac. Se vuoi il login con il tuo account Google:

1. Vai su [Google Cloud Console](https://console.cloud.google.com/) e crea delle credenziali "OAuth 2.0" (è una procedura di Google, gratuita, pensata anche per chi non è sviluppatore — cerca "Credenziali" nel menu).
2. Come "Redirect URI" indica: `http://localhost:1969/auth/google/callback`.
3. Apri il file `backend/.env` con un editor di testo qualsiasi (es. TextEdit) e incolla i due codici che Google ti dà (`GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`), più la tua email in `ALLOWED_EMAIL`.
4. Riavvia l'app (`scripts/uninstall.sh` seguito da `scripts/install.sh`, oppure su Windows `.\scripts\uninstall.ps1` seguito da `.\scripts\install.ps1`): da ora solo quella email potrà entrare.

### Posso fatturare a più clienti?

Sì. In Impostazioni → Clienti puoi aggiungerne quanti ne servono, ognuno con la propria anagrafica e tariffa oraria. Il timesheet e la fattura di ogni mese sono separati per cliente. La numerazione delle fatture resta però unica e progressiva su tutti i clienti insieme (è un obbligo di legge legato alla tua partita IVA, non al cliente).

### Come invio le fatture?

Dalla schermata della fattura puoi inviarla via PEC direttamente, se in Impostazioni hai inserito i dati della tua casella PEC (indirizzo, password, server del tuo gestore). Se qualcosa non va nell'invio, il file `backend/logs/pec.log` registra ogni tentativo — è il primo posto da controllare.

### Qualcosa non funziona, dove guardo?

- `logs/error.log` — errori generali del programma.
- `backend/logs/app.log` — registro dettagliato di ogni operazione.
- `backend/logs/pec.log` — solo per problemi di invio PEC.

Se vuoi ricontrollare che l'app sia davvero attiva:
```bash
launchctl list | grep com.prioregroup.fatturazione   # Mac
```
```powershell
Get-ScheduledTask -TaskName PrioreGroupFatturazione   # Windows
```

### L'app sostituisce il mio commercialista?

**No. FogliFatture è uno strumento di supporto operativo per la gestione di timesheet e fatturazione elettronica: non sostituisce la consulenza di un commercialista o consulente fiscale.** La correttezza dei dati fiscali inviati e conservati resta responsabilità di chi usa l'app.

## Note per chi programma

- `backend/` — API Express, generatore/validatore XML FatturaPA, invio PEC, storage su file JSON, login Google OAuth opzionale.
- `frontend/` — SPA Vue 3 (Composition API, `<script setup>`).

Avvio in modalità sviluppo (senza installarlo come servizio):

```bash
cd backend
npm install
cp .env.example .env
npm start               # http://localhost:1969
```

```bash
cd frontend
npm install
npm run build            # oppure: npm run dev (hot-reload su :5173, proxy verso il backend)
```

Test:
```bash
cd backend
npm test
```

Vuoi contribuire? Leggi [CONTRIBUTING.md](CONTRIBUTING.md) e il [Codice di Condotta](CODE_OF_CONDUCT.md).

## Licenza

Distribuito sotto [PolyForm Noncommercial 1.0.0](LICENSE). Uso libero per scopi non commerciali (visione, uso, modifica). Qualsiasi uso commerciale — inclusi rivendita e offerta come servizio SaaS — richiede un accordo preventivo separato con l'autore: contatta [@priore](https://github.com/priore) su GitHub.

***Nessuna garanzia***: il software è fornito così com'è, senza garanzie esplicite o implicite. Vedi [LICENSE](LICENSE) e [SECURITY.md](SECURITY.md).

## Support Development

Se questo progetto ti è stato utile, considera una piccola donazione. Ogni contributo aiuta a finanziare nuove funzionalità e mantenere il progetto attivo.

Scansiona il codice qui sotto con il tuo wallet, oppure copia l'indirizzo. In alternativa puoi donare via [PayPal](https://paypal.me/prioregroup).

|Donate with BTC (Bitcoin)|
|:------------:|
|![](https://www.prioregroup.com/images/priore_btc_segwit_binance.jpg)|
|`BTC Address (SegWit) : bc1q6rj0uuwu9k2fvs5n5elmqy9v4ljazhexejykjm`|
