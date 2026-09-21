# Deployment su server/cloud

Fogli & Fatture nasce per girare in locale sul tuo computer. Questa guida copre
l'alternativa: farlo girare su un server (VPS, VM cloud, un tuo hardware sempre
acceso) con dominio proprio e HTTPS, invece che su `localhost`.

**Un'istanza per azienda.** Questa guida configura un deployment single-tenant:
un'installazione dedicata a un solo soggetto (persona o azienda), con i suoi dati,
il suo dominio, il suo certificato. Non è pensata per erogare l'app come servizio
condiviso a più clienti da un'unica installazione: quello richiederebbe multi-tenancy
(isolamento dati per cliente, autenticazione multi-organizzazione) che oggi non
esiste nel codice, oltre a non essere il modello di licenza previsto (vedi
[LICENSE](../LICENSE)).

## Cosa serve prima di iniziare

- **Un server** raggiungibile da internet, con Linux e con [Docker](https://docs.docker.com/get-docker/) già installato (una VPS va benissimo: Hetzner, DigitalOcean, OVH, ecc. — bastano poche righe di RAM/CPU)
- **Un dominio** (es. `fatture.tuaazienda.it`) che punti all'indirizzo IP di quel server — si configura dal pannello di chi ti vende il dominio, aggiungendo un "record A" con l'IP del server
- Le **porte 80 e 443** del server aperte verso internet (di norma lo sono già; sono quelle usate da qualsiasi sito web)

## Avvio

Collegati al server (es. via SSH) ed esegui questi comandi uno alla volta.

**1. Scarica il progetto:**
```bash
git clone https://github.com/priore/foglifatture.git
cd foglifatture
```

**2. Crea il file di configurazione copiando quello di esempio:**
```bash
cp backend/.env.example backend/.env
```

**3. Apri `backend/.env` con un editor di testo** (es. `nano backend/.env`) e
compila i valori seguendo i commenti già presenti nel file (porta, credenziali
Google se vuoi il login, ecc.). Salva ed esci.

**4. Apri il file `Caddyfile`** (nella cartella principale del progetto) e
sostituisci la scritta `your-domain.example.com` con il tuo dominio vero, quello
che hai puntato al server (es. `fatture.tuaazienda.it`). Salva.

**5. Avvia tutto:**
```bash
docker compose up -d --build
```

Questo comando scarica quel che serve, prepara l'app e la mette in funzione. La
prima volta richiede qualche minuto. Il certificato HTTPS viene ottenuto in
automatico ([Let's Encrypt](https://letsencrypt.org/), gestito da
[Caddy](https://caddyserver.com/)) — non devi fare nulla per quello.

Dopo qualche minuto l'app è raggiungibile all'indirizzo del tuo dominio, con
HTTPS già attivo.

## Persistenza dei dati

`backend/data/` (config, fatture, timesheet, mail-outbox — vedi
`.claude/rules/sensitive-data.md` per cosa contiene) è montato come volume Docker
(`app-data` in `docker-compose.yml`), separato dall'immagine: un rebuild
(`docker compose up -d --build`) non lo cancella. Fanne comunque backup regolari
con la funzione di backup già integrata nell'app (Impostazioni → Backup), puntando
l'export fuori dal container.

## Limite noto: credenziali salvate (PEC, chiavi API)

Le password PEC/backup e le chiavi API (Google, Gemini, Groq, Claude) vengono
normalmente salvate nel "portachiavi" del sistema operativo — lo stesso posto dove
macOS o Windows tengono le password del Wi-Fi, cifrato e protetto dal sistema.

Un container Docker su Linux, di base, **non ha questo portachiavi**. Risultato: se
non fai nulla, ogni volta che riavvii il container (`docker compose up -d --build`,
o dopo un reboot del server) devi **reinserire quelle password dalle Impostazioni
dell'app**. I tuoi dati (fatture, timesheet) non si perdono — solo le password
salvate vanno reinserite.

Due strade:

**Non ti dà fastidio reinserirle ogni tanto?** Non serve fare altro, va già bene
così.

**Vuoi che restino salvate anche dopo un riavvio?** Serve aggiungere un
"portachiavi finto" dentro il container (si chiama `gnome-keyring`, gira anche
senza interfaccia grafica). Non è già incluso in questa guida: se ti serve, apri
una [issue](https://github.com/priore/foglifatture/issues) descrivendo il caso
d'uso, così capiamo se vale la pena aggiungerlo di default all'immagine Docker.

## Aggiornamenti

```bash
git pull
docker compose up -d --build
```

Il volume `app-data` non viene toccato dal rebuild.
