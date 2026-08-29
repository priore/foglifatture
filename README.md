# Timesheet & Fatturazione

App locale per gestione timesheet mensile e fatturazione elettronica in regime forfettario.

## Struttura

- `backend/` — API Express, generatore XML FatturaPA, invio PEC, storage JSON flat file, login Google OAuth opzionale.
- `frontend/` — SPA Vue 3 (Composition API, `<script setup>`): Timesheet, Fattura Pro-Forma, Impostazioni (wizard).
- `Templates/` — file originali (xls/doc/xml) usati come riferimento di stile e formato.

## Esecuzione permanente (avvio automatico, sopravvive al riavvio del Mac)

```bash
scripts/install.sh     # build + installa come servizio launchd, avvia subito
scripts/uninstall.sh   # ferma e rimuove il servizio (non tocca dati/config)
```

Dopo l'installazione l'app è sempre raggiungibile su `http://localhost:1969`,
si riavvia da sola se va in crash e riparte automaticamente ad ogni accensione
del Mac.

## Log

- `logs/out.log`, `logs/error.log` — output grezzo del processo (stdout/stderr), gestito da launchd.
- `backend/logs/app.log` — log applicativo strutturato (una riga JSON per evento): richieste API, errori non gestiti, avvio server.
- `backend/logs/pec.log` — log dedicato all'invio PEC (tentativi, successi, errori SMTP): è il primo posto da controllare se un invio non va a buon fine.

## Primo avvio (sviluppo, senza installarlo come servizio)

```bash
cd backend
npm install
cp .env.example .env   # lascia le credenziali Google vuote per ora
npm start               # http://localhost:1969
```

In un altro terminale, per build del frontend:

```bash
cd frontend
npm install
npm run build
```

Il backend serve automaticamente `frontend/dist/` su `http://localhost:1969`.

Per sviluppo con hot-reload frontend (porta separata, proxy verso il backend):

```bash
cd frontend
npm run dev             # http://localhost:5173
```

## Prima configurazione

Con `.env` senza credenziali Google, il login è disattivato: apri l'app e vai
subito su **Impostazioni** per inserire anagrafica fornitore/cliente, tariffa
oraria e (facoltativo) dati PEC.

## Attivare il login Google (opzionale)

1. Crea un progetto su [Google Cloud Console](https://console.cloud.google.com/) > Credenziali > ID client OAuth 2.0.
2. Redirect URI: `http://localhost:1969/auth/google/callback`.
3. Compila `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ALLOWED_EMAIL` in `backend/.env`.
4. Riavvia il backend: solo quell'email potrà accedere.

## Invio PEC

Il modulo è predisposto (`backend/src/services/pecService.js`) ma non testato
con invio reale. Configura i dati della tua casella PEC in Impostazioni prima
di usarlo.

## Test

```bash
cd backend
npm test
```
