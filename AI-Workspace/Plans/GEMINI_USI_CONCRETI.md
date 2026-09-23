# Piano: usi concreti di Gemini per feature del progetto

Confidence: 🟢 confermato da codice · 🟡 inferito · 🔴 ipotesi

Collegato a: [F24_STEP2_CALCOLO_AUTOMATICO.md](F24_STEP2_CALCOLO_AUTOMATICO.md) (sezione Gemini), [F24_STEP1_RICOGNIZIONE.md](F24_STEP1_RICOGNIZIONE.md), [EXPORT_COMMERCIALISTA.md](EXPORT_COMMERCIALISTA.md).

Tracciato su Gogs (locale), escluso solo dal sync verso GitHub (skill `sync-public`) — non pubblicato.

## Pattern già in uso (unico precedente reale)

🟢 `geminiAtecoService.js` + `forfettarioRoutes.js` (`POST` che chiama `aggiornaAtecoSettoriDaGemini`) + `StepGemini.vue`:
- Chiamata `fetch` diretta a `generateContent` (`gemini-2.0-flash`), tool `google_search` abilitato.
- Trigger **manuale** (pulsante "aggiorna" in Impostazioni), mai automatico/per-richiesta.
- Prompt chiede **fatti pubblici statici** (tabella normativa), non un calcolo sui dati dell'utente.
- Output validato (array JSON parsificato, controllo non-vuoto) e scritto su file statico locale (`atecoSettori.json`), con backup `.bak` prima di sovrascrivere.
- API key opzionale (`envService.js` → `leggiGeminiApiKey()`), feature degrada a "assente" se non configurata — non è mai un requisito per il funzionamento base dell'app.

Questo è il criterio guida per ogni nuovo uso proposto sotto: **buon uso di Gemini in questo progetto = recuperare/spiegare fatti pubblici che cambiano nel tempo o sono difficili da tabellare a mano, mai calcolare/decidere qualcosa che riguarda i soldi/dati fiscali specifici dell'utente.**

## Criteri di selezione applicati

Uno spunto entra in questa lista solo se:
1. Risolve un problema reale già visibile nel codice/dati as-is (non una feature immaginata da zero).
2. Il compito è "recupero/spiegazione di informazione pubblica variabile nel tempo", non aritmetica o decisione sui dati dell'utente (l'aritmetica c'è già ed è corretta: `forfettarioService.js`, `invoiceService.js`).
3. Segue lo stesso pattern di `geminiAtecoService.js`: trigger manuale, output validato, salvato/mostrato come "verifica", mai auto-applicato silenziosamente.

## Verdetto utente

### 1. Codici tributo e soglie acconto F24 — sospeso, da decidere

🟡 Non respinto, non approvato: resta aperto. Stesso schema di `aggiornaAtecoSettoriDaGemini` (vedi [F24_STEP2_CALCOLO_AUTOMATICO.md](F24_STEP2_CALCOLO_AUTOMATICO.md#beneficio-possibile-da-gemini-già-integrato-nel-progetto)) — nuovo file `f24Regole.json`, refresh manuale, mai calcolo dell'importo finale. Decisione rimandata a quando lo Step 2 F24 verrà eventualmente ripreso.

Le altre 2 proposte iniziali sono state **bocciate dall'utente** dopo revisione:

### 2. Spiegazione codici di scarto/notifica SDI non mappati — respinto, verificato infondato

🟢 Verifica su `sdiRicevuteService.js`: il parsing della notifica SDI estrae **già** `<Descrizione>` e `<Suggerimento>` ufficiali dal payload XML (righe 98-100, campi `descrizione`/`dettaglio` nel risultato), non solo il codice numerico. `scartoSuggerimenti.js` aggiunge solo un dettaglio *extra* su 5 codici particolarmente ricorrenti, sopra un messaggio ufficiale SDI già presente e già sufficientemente esplicativo. Non c'è un vuoto informativo da colmare con AI: il gap ipotizzato non esiste nei dati reali.

### 3. Riconciliazione descrizione/causale fattura da timesheet importato — respinto

Era già segnalato come il candidato più debole (generazione di testo su dati utente, beneficio non verificato); confermato non valido.

## Altri servizi controllati, nessun gap trovato

🟢 Riletti anche `xmlInvoiceImporter.js`, `backupService.js`, `reminderService.js`, `mailService.js`, `timesheetService.js`: operano tutti su dati privati dell'utente (import fatture proprie, backup, promemoria, invio mail, ore lavorate) — nessuno tratta un "fatto pubblico variabile nel tempo" candidabile secondo il criterio 2. Applicare Gemini lì significherebbe far generare/interpretare a un LLM dati fiscali o personali propri dell'utente, esattamente il caso da evitare (vedi sezione "Cosa NON fare" sotto).

## Conclusione

🟢 Con questo criterio, l'unico spunto restante è il punto 1 (F24), lasciato sospeso. Nessun'altra proposta valida emerge dal codice as-is: gli altri punti di frizione individuati (scarto SDI, descrizione fattura, e ora anche import/backup/reminder/mail/timesheet) sono o già coperti a sufficienza dai dati nativi, o fuori criterio perché toccano dati privati/fiscali dell'utente invece di fatti pubblici.

### Lookup ATECO — unico uso valido, già fatto

🟢 `geminiAtecoService.js` copre già bene il proprio scope (intero elenco ATECO + coefficienti). Nessuna estensione necessaria.

## Cosa esplicitamente NON fare con Gemini in questo progetto

Per evitare derive verso usi rischiosi, coerente con quanto già scartato in [F24_STEP2_CALCOLO_AUTOMATICO.md](F24_STEP2_CALCOLO_AUTOMATICO.md):

- 🔴 Non calcolare imposte, acconti, o importi da versare — è aritmetica deterministica già corretta in `forfettarioService.js`; un LLM aggiunge solo rischio di errore su un dato con impatto economico diretto.
- 🔴 Non generare o correggere automaticamente XML FatturaPA — dominio a zero tolleranza errore, già coperto da generatore+validatore deterministici (`fatturaPaXmlGenerator.js`, `fatturaPaXmlValidator.js`).
- 🔴 Non decidere/validare numerazione fattura o dati fiscali (P.IVA, codice destinatario SDI) — `invoiceService.js` ha già logica di validazione sequenza esplicita e testata; sostituirla con un giudizio LLM introdurrebbe non-determinismo in un controllo legale.
- 🔴 Non usare Gemini per operazioni che devono avvenire senza connessione esterna o senza consenso esplicito dell'utente (l'app oggi è utilizzabile interamente offline se non si usa la feature Gemini/ATECO — mantenere questo invariante).

## ⚠️ Nota urgente: modello attuale a rischio sul piano free

🔴 Verifica web (31/08/2026): Google ha rimosso `gemini-2.0-flash` — il modello usato oggi da `geminiAtecoService.js` (`MODELLO = 'gemini-2.0-flash'`) — dal free tier API il 9 giugno 2026. Se non ancora aggiornato, il pulsante "aggiorna ATECO" in Impostazioni potrebbe già fallire con una chiave API free. Sostituto diretto indicato da Google: `gemini-2.5-flash` (stessi limiti free: 15 richieste/minuto, 1500/giorno, 1M token/giorno). Da verificare/correggere indipendentemente dalle nuove feature sotto.

Fonti: [TinkerLLM](https://tinkerllm.com/blog/gemini-api-free-tier-limits-rate-quotas/), [Free AI News](https://freeainews.com/news/gemini-20-flash-shutdown-free-api-june-2026/), [TokenMix](https://tokenmix.ai/blog/gemini-api-free-tier-limits)

## Nuove feature (non gap-filling), compatibili con uso free/limitato

Richiesta esplicita: non "colmare buchi", ma proposte di funzionalità nuove che userebbero Gemini, purché restino dentro un uso gratuito realistico (15 RPM, 1500 richieste/giorno con `gemini-2.5-flash`). Per un'app single-operator con poche azioni al giorno, qualunque feature **innescata manualmente da un click** (non per-ogni-richiesta-HTTP, non in un loop `setInterval`) resta comodamente nel free tier.

### A. Riepilogo/commento mensile del timesheet

🟢 `timeCalculator.js` produce già `calcolaTotaleMensile`, `contaGiorniPerStato` (ore totali, giorni di malattia/ferie/festività/recupero/sciopero per mese). Oggi questi numeri sono mostrati come sono, senza narrazione.

Proposta: un pulsante opzionale in `TimesheetView.vue` "Genera nota mensile" che passa a Gemini i numeri già calcolati (non i dati grezzi orario-per-orario, solo i totali/conteggi aggregati) e chiede una frase riassuntiva in italiano da poter incollare in una mail al cliente o in una nota interna (es. "Ad agosto sono state lavorate 176 ore su 22 giorni lavorativi, con 2 giorni di ferie"). Un click per mese, volume trascurabile.

### B. Analisi del testo libero descrizione fattura (correzione/coerenza)

🟢 `FatturaView.vue`/`invoiceService.js` hanno un campo `descrizione` libero per la fattura. Proposta: pulsante opzionale "Rivedi testo" che chiede a Gemini un controllo di forma (grammatica/coerenza professionale) sulla descrizione scritta dall'utente prima di generare l'XML — mai una sostituzione automatica, solo un suggerimento che l'utente accetta o ignora. Un click per fattura (già oggi al massimo 1/mese per cliente), volume irrilevante per il free tier.

### C. Riepilogo annuale narrativo per il commercialista

🟢 Collegato a [EXPORT_COMMERCIALISTA.md](EXPORT_COMMERCIALISTA.md): oltre all'export CSV/XLSX tabellare già pianificato, un pulsante "Genera nota di accompagnamento" che passa a Gemini i totali già calcolati da `calcolaDashboardForfettario` (ricavi, imposta stimata, % soglia) e produce un paragrafo introduttivo in italiano da allegare all'export, per contestualizzare i numeri senza che l'utente debba scriverlo a mano ogni anno. Un click/anno.

### D. Assistente ricerca voce ATECO in linguaggio naturale

🟢 Oggi la ricerca ATECO in Impostazioni presumibilmente cerca per codice/testo esatto nella tabella già scaricata (`atecoSettori.json`, dati locali — nessuna nuova chiamata Gemini necessaria per la ricerca in sé, il file è già scaricato). 🟡 Se la ricerca testuale attuale è debole su sinonimi ("faccio siti web" → non trova "62.01.00 Produzione di software"), un fallback opzionale — solo quando la ricerca locale non trova nulla — potrebbe chiedere a Gemini di mappare una descrizione libera dell'attività al codice ATECO più vicino tra quelli già presenti nel file locale (nessuna nuova ricerca web, solo classificazione su dati già scaricati). Uso saltuario (una tantum in fase di setup/wizard), non per-richiesta.

Nota comune a tutte e 4: seguono lo stesso principio già fissato ("Cosa NON fare" sopra) — mai calcoli fiscali, mai output auto-applicato senza revisione umana, sempre trigger manuale a basso volume. Sono proposte di comodità/qualità-della-vita, non correzioni di gap funzionali.

## Domande aperte per l'utente

1. Va corretto subito `gemini-2.0-flash` → `gemini-2.5-flash` in `geminiAtecoService.js` indipendentemente da tutto il resto (rischio di rottura silenziosa sul piano free)?
2. Tra le proposte A-D, quali interessano davvero? Sono indipendenti tra loro, si possono scegliere singolarmente.
3. Punto 1 (F24, sospeso) — quando riprenderlo in considerazione?
