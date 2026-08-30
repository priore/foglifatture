# Timesheet & Fatturazione

App per chi lavora in regime forfettario, con due funzioni indipendenti:
- **Timesheet mensile** — registra le ore lavorate giorno per giorno.
- **Fatturazione elettronica** — genera fatture calcolate da timesheet (ore × tariffa) oppure a importo e descrizione liberi, senza bisogno del timesheet.

Gira sul tuo computer: nessun dato va su internet, nessun abbonamento.

## Installazione

Serve solo la prima volta. Lo script fa tutto da solo: installa Node.js se manca, scarica le librerie necessarie, prepara la configurazione, avvia l'app come servizio permanente e apre il browser sulla pagina iniziale.

### Mac

1. Apri l'app **Terminale** (Applicazioni → Utility → Terminale).
2. Trascina la cartella del progetto nella finestra del Terminale per scriverne il percorso, poi premi Invio per entrarci:
   ```bash
   cd /percorso/della/cartella/Timesheet
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

### Windows

1. Apri **PowerShell** (cerca "PowerShell" nel menu Start).
2. Trascina la cartella del progetto nella finestra di PowerShell per scriverne il percorso, poi premi Invio per entrarci:
   ```powershell
   cd C:\percorso\della\cartella\Timesheet
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
2. Vai su **Impostazioni** e compila la procedura guidata: i tuoi dati (partita IVA, ecc.), i dati del cliente, la tariffa oraria.
3. Da **Timesheet** registra le ore lavorate giorno per giorno.
4. Da **Fattura Pro-Forma** genera la fattura del mese quando sei pronto: scegli "Da timesheet" (calcolo automatico ore × tariffa) oppure "Importo libero" se vuoi fatturare un importo e una descrizione a piacere senza passare dal timesheet.

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

## Note per chi programma

- `backend/` — API Express, generatore XML FatturaPA, invio PEC, storage su file JSON, login Google OAuth opzionale.
- `frontend/` — SPA Vue 3 (Composition API, `<script setup>`).
- `Templates/` — file originali (xls/doc/xml) usati come riferimento di stile e formato.

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
