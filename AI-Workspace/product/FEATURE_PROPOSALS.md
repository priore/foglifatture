# Proposte di Funzionalità

Confidenza: 🟢 confermato dal codice · 🟡 dedotto · 🔴 ipotesi

Solo analisi. Nessun impegno di roadmap — funzionalità candidate ordinate per valore/sforzo, derivate da `ARCHITECTURE.md`, `PROJECT_CONTEXT.md`, `KNOWN_ISSUES.md`, `ROADMAP.md`. Nulla implementato qui.

---

## Priorità 1 — chiude rischi reali

### 1. Verifica invio PEC/SDI + retry
🔴 Rischio maggiore: invio PEC "non testato con mailbox reale" (avviso nel README stesso, `KNOWN_ISSUES.md`). Nessun retry, nessun avviso di mancata consegna se l'invio SMTP fallisce o SDI non restituisce mai una ricevuta (RC mancante dopo N giorni).
- Aggiungere: campo stato-invio sulla fattura (`inviata`/`consegnata`/`scartata`/`in_attesa`), avviso timeout se nessuna ricevuta SDI dopo X giorni, il reinvio manuale esiste già parzialmente — estendere con visualizzazione fallimenti in UI (`FatturaView.vue`).
- Sforzo: medio. Valore: alto — è l'unica cosa che può rompersi silenziosamente nella fatturazione reale.

### 2. Controllo integrità numerazione fattura
🔴 Il numero progressivo FatturaPA deve essere rigorosamente sequenziale, senza salti né duplicati — requisito legale. Il modello attuale è un file JSON per mese (`invoices/<anno>-<mese>.json`); nessun controllo incrociato visibile che prevenga un `numero` saltato o duplicato.
- Aggiungere: validazione al momento della generazione fattura che legge tutte le fatture precedenti e verifica l'incremento rigoroso prima di consentire la generazione XML.
- Sforzo: basso (pura validazione, nessuna modifica di schema). Valore: alto — una numerazione non valida può invalidare una fattura fiscale reale.

### 3. Backup / esportazione di `backend/data/`
🟢 Nessun database, tutto è JSON flat + allegati ricevute su disco, singola macchina, nessun percorso di backup menzionato in alcun documento.
- Aggiungere: "esporta backup" con un click (zip di `data/`) dalle Impostazioni, ripristinabile su una nuova macchina.
- Sforzo: basso. Valore: alto — oggi il rischio di perdita totale dati è un singolo guasto disco.

---

## Priorità 2 — valore concreto quotidiano, sforzo basso

### 4. Dashboard compenso annuale/trimestrale vs soglia forfettario
🟡 Il regime forfettario ha un tetto di fatturato annuo (attualmente €85.000). Nulla nell'app traccia il compenso cumulato annuo o avvisa all'avvicinarsi della soglia — un guardrail davvero utile per l'esatto tipo di utente a cui serve questa app (freelance forfettario singolo).
- Aggiungere: una vista dashboard che somma il compenso su tutte le fatture per anno, con banner di avviso vicino al tetto.
- Sforzo: basso (`invoiceService.js` ha già tutti i mesi per anno via `listMesiFatturati`). Valore: alto — rilevante fiscalmente, non solo estetico.

### 5. Supporto multi-cliente
🟡 Modello dati + UI attualmente presuppongono un cliente singolo (TODO in `PROJECT_CONTEXT.md`). Se questo consulente dovesse mai fatturare più di un cliente, il design attuale non può rappresentarlo.
- Da fare solo se la situazione reale dell'utente è/sarà multi-cliente — altrimenti da saltare (YAGNI). Segnalato come domanda aperta, non come raccomandazione, finché non confermato.
- Sforzo: alto (schema config, collegamento timesheet-cliente, numerazione fattura per cliente vs globale). Valore: condizionato.

### 6. Promemoria timesheet
🟡 Nessun meccanismo osservato che ricordi all'utente di registrare le ore giornaliere/prima della fatturazione di fine mese.
- Aggiungere: notifica desktop locale (infrastruttura già esistente via `macNotifier.js` per le ricevute SDI — stesso meccanismo riusabile) che ricorda di registrare le ore di oggi, o segnala giorni mancanti vicino a fine mese prima della generazione fattura.
- Sforzo: basso (riusa notificatore esistente). Valore: medio — riduce il problema "ho dimenticato di registrare 3 giorni" tipico dei timesheet manuali.

### 7. Esportazione CSV/PDF del riepilogo annuale per il commercialista
🟢 Esiste l'esportazione PDF per il timesheet mensile (`usePdfExport.js`) ma nulla produce un report annuale consolidato (tutti i mesi + totali compenso) da consegnare al commercialista in periodo fiscale.
- Aggiungere: "esporta riepilogo annuale" — PDF o XLSX che combina ore mensili + compenso + stato fatture di tutti i mesi.
- Sforzo: basso-medio (riusa `usePdfExport.js` + dipendenza `xlsx` già installata per l'import). Valore: alto — attività ricorrente reale (una volta l'anno, in dichiarazione).

---

## Priorità 3 — rifinitura, non essenziale

### 8. Toggle manuale dark-mode
🟡 Percorso CSS morto già esistente (selettore `data-theme` inutilizzato secondo `KNOWN_ISSUES.md`) — vittoria più economica possibile, basta collegare un pulsante toggle + persistenza `localStorage`.
- Sforzo: molto basso. Valore: basso-medio (solo UX).

### 9. Vista cronologia/timeline ricevute SDI
🟢 Le ricevute sono salvate su disco (`sdiRicevuteService.js`) ma non esiste una vista UI dedicata che elenchi lo storico ricevute per fattura — attualmente probabilmente mostrato solo inline in `FatturaView.vue`.
- Aggiungere: una timeline semplice (inviata → consegnata → notificata) per fattura, utile per audit/troubleshooting.
- Sforzo: basso-medio. Valore: medio — riduce principalmente la ricerca manuale nella mailbox quando qualcosa va storto.

### 10. Validazione configurazione al salvataggio Impostazioni
🟡 Nessun livello di validazione confermato sui campi di `config.json` (formato partita IVA, formato indirizzo PEC, checksum IBAN). Dati errati qui corrompono silenziosamente l'XML al momento della fattura.
- Aggiungere: validazione a livello di campo negli step del wizard prima di consentire il salvataggio.
- Sforzo: basso. Valore: medio — previene errori evitabili che altrimenti emergono solo all'invio PEC.

---

## Analisi di fattibilità — Multi-utenza con ruolo Admin

🟢 Richiesta esplicita utente: valutare fattibilità di supporto multi-utente (login Google o email aziendale), con un ruolo admin dedicato e funzionalità speciali di amministrazione/query. Questo è un cambio architetturale maggiore, non una funzionalità incrementale — l'app oggi è progettata da zero come single-tenant.

### Stato attuale (base di partenza, confermato dal codice)

🟢 `backend/src/lib/auth.js`: whitelist di **una sola email** hardcoded via `ALLOWED_EMAIL` in env, nessun concetto di utente/ruolo, nessuna tabella utenti. Se auth non configurata, ogni richiesta è considerata autenticata (bootstrap escape hatch).

🟢 `jsonStore.js` + `backend/data/`: un solo `config.json` globale, timesheet e fatture salvate come `<anno>-<mese>.json` **senza alcuna chiave di appartenenza a un utente/cliente**. Tutto il modello dati assume un solo fornitore, un solo cliente, una sola serie di fatture.

### Cosa servirebbe (in ordine di complessità crescente)

1. **Modello utenti** — sostituire whitelist singola con una tabella/collezione utenti (email, ruolo `admin`/`user`, eventualmente id fornitore associato). Richiede passare da JSON flat a qualcosa con query per campo (o mantenere JSON con indice email→utente).
2. **Autenticazione multi-provider** — Google OAuth già presente (`passport-google-oauth20`), estendibile a whitelist dinamica invece di singola email fissa. Login con email aziendale richiede o Google Workspace (stesso flusso OAuth, dominio verificato via `hd` claim) oppure un provider SAML/OIDC aziendale separato — quest'ultimo è un lavoro sostanzialmente nuovo (nessuna libreria SAML/OIDC generica già installata).
3. **Isolamento dati per utente/tenant** — ogni timesheet, fattura, configurazione fornitore/cliente deve essere partizionato per utente. Tocca **tutti** i servizi backend (`timesheetService.js`, `invoiceService.js`, `configService.js`) e tutte le route API (aggiunta filtro per utente ovunque). Impatto più grande di tutto il resto del piano messo insieme.
4. **Ruolo Admin** — middleware di autorizzazione aggiuntivo (oltre `richiedeAutenticazione`) che verifica ruolo, non solo autenticazione. Nuove route `/api/admin/*`.
5. **Funzionalità admin speciali** proposte:
   - Gestione utenti (invita, disattiva, cambia ruolo).
   - Query cross-utente: totali fatturato per utente/periodo, stato invii PEC falliti su tutta la piattaforma, ricerca fatture per numero/cliente/importo trasversale.
   - Vista di audit/log accessi.
   - Impersonazione utente per supporto (con log esplicito, azione sensibile).
6. **Motore di query per l'admin** — con lo storage JSON flat attuale, query aggregate cross-utente (es. "totale fatturato per tutti gli utenti nel Q1") richiedono leggere e sommare in memoria tutti i file JSON di tutti gli utenti ad ogni richiesta: funziona a basso volume, degrada linearmente con utenti/mesi. Sopra poche decine di utenti conviene una vera migrazione a database (SQLite è il minimo sufficiente, Postgres se serve concorrenza reale).

### Stima complessiva

🔴 Sforzo: **alto/molto alto** — non è una feature, è una riscrittura architetturale che tocca autenticazione, ogni servizio dati, ogni route, più UI nuova per amministrazione. Ordine di grandezza: settimane, non giorni, anche in versione minima (solo Google, solo isolamento dati, admin base senza query avanzate).

🔴 Rischio aggiuntivo: la generazione FatturaPA/numerazione progressiva è oggi pensata per un solo fornitore fiscale. Multi-utenza reale con più fornitori fiscali distinti richiederebbe che ogni utente abbia la propria sequenza di numerazione fattura, il proprio PEC, la propria configurazione forfettario — di fatto ogni utente diventa un "tenant" fiscale indipendente, non solo un account con permessi diversi.

### Raccomandazione

🔴 Prima di investire: chiarire lo use case reale. Se lo scopo è **un solo fornitore fiscale con più persone che devono vedere/gestire lo stesso timesheet** (es. commercialista + titolare), basta un modello più leggero — whitelist multi-email con ruoli (`admin`/`viewer`) sullo stesso dataset condiviso, senza isolamento dati: sforzo medio, non alto, e non richiede toccare la numerazione fatture. Se invece lo scopo è **più fornitori fiscali indipendenti sulla stessa istanza** (vera piattaforma multi-tenant), è il progetto sopra descritto per intero, sforzo alto, e va trattato come iniziativa a sé, con la sua analisi di rientro economico prima di partire.

---

## Esplicitamente non raccomandato (YAGNI dato lo scope single-user attuale)

- Migrazione a database (Postgres/SQLite) — il JSON flat è adeguato a questo volume di dati (un file per mese) **finché resta single-tenant**; prematuro allo stato attuale, ma diventa necessario se si procede con multi-utenza reale (vedi sopra).
- Overhaul completo di accessibilità (ARIA) — segnalato in `KNOWN_ISSUES.md` come opzionale; basso ritorno per un singolo utente vedente a meno di necessità personale.

---

## Ordine consigliato se l'utente vuole procedere

1. Controllo integrità numerazione fattura (#2) — economico, protegge validità legale.
2. Esportazione backup dati (#3) — economico, protegge da perdita totale.
3. Dashboard soglia compenso annuale (#4) — economico, rilevante fiscalmente.
4. Esportazione annuale per commercialista (#7) — valore ricorrente reale.
5. Hardening stato-invio/retry PEC (#1) — più grande, ma chiude il rischio #1 dichiarato dal progetto stesso.
6. Il resto in modo opportunistico.

---

## Checklist di Revisione

- **Completezza:** le proposte coprono fasce chiusura-rischio, valore quotidiano e rifinitura; esclude esplicitamente idee fuori scope con motivazione.
- **Accuratezza:** ogni proposta è tracciata a una lacuna confermata specifica o a un file; elementi speculativi marcati 🔴/🟡.
- **Coerenza:** terminologia allineata a `GLOSSARY.md`; i problemi rimandano a `KNOWN_ISSUES.md`/`ROADMAP.md`.
- **TODO:** confermare con l'utente se il multi-cliente (#5) è un bisogno futuro reale prima di qualsiasi lavoro di design; confermare use case reale della multi-utenza (persone multiple su un fornitore vs. più fornitori fiscali indipendenti) prima di stimare la multi-utenza/admin.
- **Informazioni mancanti:** nessun dato di utilizzo/punto di frustrazione reale dall'utente esiste nel repo per ordinare per attrito reale invece che rischio dedotto.
- **Domande aperte:** la soglia forfettario attuale è €85.000 per la situazione fiscale di questo utente — confermare la regola dell'anno fiscale corrente prima di costruire la logica di avviso del punto #4.
- **Livello di confidenza:** misto 🟢/🟡/🔴, taggato individualmente per voce.
