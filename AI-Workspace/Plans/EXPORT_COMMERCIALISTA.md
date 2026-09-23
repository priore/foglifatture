# Piano: esportazione dati utili al commercialista

Confidence: 🟢 confermato da codice · 🟡 inferito · 🔴 ipotesi

Nota: tracciato su Gogs (locale), escluso solo dal sync verso GitHub (skill `sync-public`) — non pubblicato.

## Obiettivo

Produrre un export (CSV/Excel/PDF) con i dati che un commercialista chiede tipicamente per un forfettario: elenco fatture emesse per anno/periodo, imponibile, imposta sostitutiva stimata, soglia regime, dati anagrafici fornitore. Oggi questi dati esistono ma sono sparsi in JSON per-mese-per-cliente, mai aggregati né esportabili.

## Cosa c'è già (riusabile, niente da reinventare)

🟢 `invoiceService.js`:
- `listMesiFatturati()` → tutte le chiavi fattura (anno, mese, clienteId), già parsate.
- `getInvoice(anno, mese, clienteId)` → record fattura completo.
- Ogni fattura salvata contiene già: `numero`, `data`, `descrizione`, `oreTotali`, `tariffaOraria`, `imponibile`, `bolloApplicabile`, `bollo`, `nettoAPagare`, `progressivoInvio`, `clienteId`.

🟢 `forfettarioService.js`:
- `calcolaDashboardForfettario()` già calcola per un anno: ricavi cumulati, reddito imponibile (coefficiente redditività), aliquota (5%/15%), imposta stimata, netto stimato, % soglia. Query aggregata annuale già pronta — è la base di calcolo che serve al commercialista.

🟢 `config.json`:
- `fornitore` → denominazione, P.IVA, codice fiscale, regime fiscale (RF19) — intestazione documento.
- `clienti[]` → denominazione/P.IVA per riga fattura leggibile (oggi la fattura salva solo `clienteId`, va risolto il nome).
- `forfettario` → soglia annua, coefficiente redditività, aliquota, data inizio attività.

🟢 Import storico esiste già (`xmlInvoiceImporter.js`, `xlsTimesheetImporter.js`) — le fatture importate finiscono nello stesso store, quindi l'export copre anche lo storico senza logica separata.

## Cosa manca

1. **Nessuna route/servizio di export aggregato.** Serve un endpoint tipo `GET /api/export/commercialista/:anno` che:
   - itera `listMesiFatturati()` filtrate per anno,
   - risolve `clienteId` → denominazione/P.IVA cliente da `config.clienti[]` (join in-memory, nessun nuovo store),
   - restituisce righe: numero, data, cliente, imponibile, bollo, netto, più totale anno.
2. **Nessun formato file d'export.** Va scelto CSV (più semplice, apribile in Excel, zero dipendenze nuove — Node ha tutto per scrivere CSV a mano, righe sono già piatte) vs XLSX (dipendenza `xlsx` già presente in `package.json`, usata da `xlsTimesheetImporter.js` — riuso possibile senza nuova dipendenza). PDF non necessario: il commercialista lavora su foglio di calcolo, non su PDF.
3. **Riepilogo forfettario non esposto per range libero.** `calcolaDashboardForfettario` prende un anno solo (uso dashboard corrente). Per un export "anno fiscale completo" basta chiamarla con l'anno richiesto — nessuna modifica, già adatta.
4. **Nessun collegamento row-level fattura → aliquota/imposta.** Oggi l'imposta è calcolata solo aggregata (somma anno), non riga per riga. Il commercialista in genere vuole il totale anno, non riga per riga imponibile-imposta — quindi non è un vero gap, ma va deciso in fase di formato file se includere una riga di riepilogo in fondo al CSV.
5. **Dati mancanti che il commercialista chiede spesso e che l'app non traccia affatto:**
   - Contributi INPS versati (l'app assume "nessuna rivalsa INPS separata" — commento esplicito in `forfettarioService.js:5-6` — ma i versamenti effettivi F24 non sono nel dominio app, sono gestiti altrove dal commercialista stesso). Approfondito in [F24_STEP1_RICOGNIZIONE.md](F24_STEP1_RICOGNIZIONE.md) (fonti dati versamenti) e [F24_STEP2_CALCOLO_AUTOMATICO.md](F24_STEP2_CALCOLO_AUTOMATICO.md) (calcolo/compilazione autonoma).
   - Spese deducibili/costi (il regime forfettario non le deduce analiticamente — coefficiente redditività le assorbe forfettariamente — quindi non è un gap applicativo, è come funziona il regime).
   - Anno di apertura P.IVA per verifica aliquota agevolata: c'è (`dataInizioAttivita`), già usato.

   Conclusione: gli unici dati realmente "mancanti" sono quelli fuori dominio dell'app (versamenti F24, contabilità generale) — non richiedono modifiche al codice, restano di competenza del commercialista con i propri strumenti.

## Come ricavare i dati mancanti (quelli in-app)

- **Nome/P.IVA cliente in fattura**: join a runtime `invoice.clienteId` → `config.clienti.find(c => c.id === clienteId)` nel nuovo servizio di export. Non serve denormalizzare il dato nel salvataggio fattura (rischio disallineamento se il cliente cambia denominazione dopo l'emissione) — join in lettura è sufficiente e più corretto storicamente... salvo che va deciso se la denominazione da mostrare deve essere quella *attuale* o quella *al momento della fattura*. Oggi non c'è storicizzazione: se un cliente viene rinominato, le vecchie fatture esporterebbero il nome nuovo. 🟡 Da chiarire con l'utente se è un problema reale (probabilmente no, i clienti P.IVA non cambiano ragione sociale spesso).
- **Somma anno/imposta**: riuso diretto di `calcolaDashboardForfettario(config, { anno })`.

## Piano di implementazione minimo (nessuna nuova dipendenza)

1. `backend/src/services/exportService.js` — nuovo file, segue pattern esistente (no logica in route):
   - `async function generaReportAnnuale(config, anno)` → combina `listMesiFatturati` + `getInvoice` + lookup cliente + `calcolaDashboardForfettario`.
2. `backend/src/routes/exportRoutes.js` — route sottile: valida `anno`, chiama il service, genera CSV (stringa, `join(',')`/`join('\n')` — no libreria CSV, output è tabellare semplice) o riusa `xlsx` per un foglio con 2 tab (righe fatture + riepilogo forfettario).
3. Aggiungere il router in `server.js` sotto `richiedeAutenticazione`, prefisso `/api/export`.
4. Un bottone "Esporta per commercialista" in `DashboardView.vue` (dove già vive la dashboard forfettario) che scarica il file — pattern identico a `api.urlDownloadXml` già usato per l'XML fattura.
5. Aggiornare `frontend/src/services/api.js` con la nuova chiamata, stesso stile delle altre.

Stima: 1 service nuovo, 1 route nuova, 1 bottone frontend, nessuna nuova dipendenza, nessun nuovo file dati persistito (tutto calcolato on-the-fly dai dati esistenti).

## Domande aperte per l'utente

- Formato preferito: CSV semplice o XLSX (via libreria `xlsx` già installata)?
- Serve export multi-anno in un colpo solo o un anno alla volta basta?
- Il nome cliente in fattura va storicizzato al momento dell'emissione o va bene sempre il nome attuale da config?
