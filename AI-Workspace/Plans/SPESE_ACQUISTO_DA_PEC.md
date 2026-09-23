# Piano: archiviazione fatture d'acquisto ricevute via PEC + spese nella dashboard

Confidence: 🟢 confermato da codice · 🟡 inferito · 🔴 ipotesi

Nota: tracciato su Gogs (locale), escluso solo dal sync verso GitHub (skill `sync-public`) — non pubblicato.

## Contesto

🟢 Il progetto polla la stessa casella PEC per due scopi oggi: invio fatture attive (`pecService.js`) e ricezione ricevute SDI di esito (`sdiRicevuteService.js`, IMAP via `imapflow`). Nella stessa casella arrivano anche fatture di **acquisto** (costi/spese, es. fatturazione servizi Google, hosting, software) inviate da fornitori via PEC/SDI — non gestite oggi: `sdiRicevuteService.js` cerca solo pattern di ricevuta SDI (esito/notifica per fatture emesse dall'utente), il resto viene ignorato/non processato.

🟢 Nessuna infrastruttura di costi/spese esiste nel codice: `grep` su `spes|costi|deducib` in `backend/src`/`frontend/src` non trova nulla di rilevante. Nessuna entità dati, nessun service, nessuna view.

🟢 Dashboard e viste esistenti (`FatturaView.vue`, `CronologiaPecView.vue`, riepiloghi) mostrano solo **ricavi**: fatturato emesso, stato invio/ricezione SDI. Nessun concetto di conto economico (ricavi − costi).

## Perché non ora (RF19)

🟡 Utente in regime forfettario (RF19): i costi non sono deducibili analiticamente — l'imposta si calcola su un coefficiente di redditività forfettario applicato al fatturato, non sulle spese reali. Tracciare le spese non serve al calcolo fiscale corrente (vedi `scadenzeFiscaliService.js`, calcolo forfettario già locale). È un plus informativo, non un bisogno del regime.

## Interazione con i dati esistenti (as-is)

🟢 Punti di aggancio se il piano venisse implementato in futuro:

- **Polling PEC**: `sdiRicevuteService.js` già apre la connessione IMAP e itera i messaggi. Riconoscere una fattura d'acquisto richiederebbe un secondo classificatore sullo stesso stream (mittente ≠ SDI, oggetto/allegato differente) — non un nuovo polling, un ramo aggiuntivo nello stesso ciclo esistente (stesso pattern di `backupService.js`/`reminderService.js`, riuso del `setInterval` condiviso già in uso).
- **Persistenza**: seguirebbe lo stesso schema di `invoices/<anno>-<mese>-<clienteId>.json` — nuova collezione tipo `spese/<anno>-<mese>.json` via `jsonStore.js` (`readJson`/`writeJson`), non file grezzi come gli allegati SDI (`sdiRicevuteService.js` bypassa `jsonStore.js` per i PDF/XML ricevuta — le spese invece sarebbero record strutturati, quindi passano da `jsonStore.js`).
- **Dashboard**: un riepilogo ricavi-costi richiederebbe una nuova sezione/vista (o estensione di una vista riepilogo esistente) che legge sia `invoices/` sia la nuova `spese/`, mostrando fatturato lordo e, separatamente, spese registrate — **senza impatto sul calcolo fiscale forfettario** (che resta basato solo sul fatturato, `scadenzeFiscaliService.js` non andrebbe toccato).
- **Multi-cliente**: le spese non sono per-cliente (sono costi generali del fornitore/operatore) — a differenza di `invoices/`/`timesheets/` che sono chiavate per cliente, andrebbero probabilmente tenute a livello fornitore unico, coerente con `config.fornitore`.

## Rischi/complessità se implementato

🟡 Riconoscere "fattura d'acquisto" via parsing email è meno affidabile del riconoscimento ricevuta SDI (quello ha un formato XML strutturato e mittente noto — SDI). Le fatture fornitore arrivano in formati eterogenei (PDF allegato, XML FatturaPA passivo, semplice email) — servirebbe un parser più tollerante o un flusso semi-manuale (l'utente conferma/categorizza cosa è una spesa dalla lista email non riconosciute).

🟡 Rischio di scope creep verso una vera contabilità (categorie di spesa, IVA su acquisti, riconciliazione) — da tenere esplicitamente fuori: qui parliamo solo di archiviazione + lista, non di contabilità completa.

## Opzioni

### Opzione A — nessuna azione (stato attuale)
Le fatture d'acquisto restano nella casella PEC, gestite dall'utente fuori dall'app (client email, commercialista). Costo zero, nessun valore aggiunto.

### Opzione B — archiviazione passiva, no dashboard
Estendere `sdiRicevuteService.js` (o nuovo service gemello) per salvare su disco (non `jsonStore.js`, stesso trattamento binario degli allegati SDI) le email PEC non riconosciute come ricevuta SDI, con una vista di sola lista (mittente, oggetto, data, allegato scaricabile) — nessun calcolo, nessuna dashboard, nessun conto economico. Utile solo come archivio consultabile, sostituisce la ricerca manuale nella casella PEC.

Costo: medio-basso. Un service, una route, una view semplice. Nessun nuovo concetto contabile.

### Opzione C — spese come dato strutturato + riepilogo dashboard
Come B, ma con parsing/categorizzazione minima (importo, fornitore, data) salvata via `jsonStore.js` in `spese/`, e una sezione dashboard che mostra ricavi − costi = margine indicativo (informativo, non fiscale). Richiede l'utente a validare/correggere ogni voce importata (parsing automatico su PDF/XML eterogenei non è affidabile al 100%).

Costo: il più alto — nuova entità dati, nuovo parsing, nuova UI, nuova logica di riepilogo. Solo se l'utente vuole visibilità reale su margine, non solo fatturato.

## Raccomandazione

Non implementare ora (RF19 confermato: nessun bisogno fiscale). Se in futuro emerge interesse solo per **visibilità** (sapere quanto si spende, non calcolo fiscale), partire da **Opzione B**: valore immediato (archivio consultabile) a costo contenuto, senza impegnarsi nel parsing/contabilità di Opzione C. Passare a C solo se l'utente chiede esplicitamente un margine ricavi-costi in dashboard.

## Domande aperte per l'utente

- Cambio di regime fiscale (da forfettario a ordinario) è previsto/ipotizzabile? Cambierebbe la risposta su RF19 (costi diventano deducibili analiticamente, tracciarli diventa utile fiscalmente, non solo informativo).
- Il volume di fatture d'acquisto via PEC è alto abbastanza da giustificare automazione, o sono poche (es. solo Google Workspace) e gestibili a occhio?
- Se implementato, le spese vanno tenute private (solo tue) o è previsto un giorno un secondo operatore/commercialista che le consulta? (rilevante per lo stesso single-user auth model già in uso, `.claude/rules/code-quality.md`)
