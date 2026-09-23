# Piano: recupero date effettive pagamento fatture da home banking

Confidence: 🟢 confermato da codice · 🟡 inferito · 🔴 ipotesi

Nota: tracciato su Gogs (locale), escluso solo dal sync verso GitHub (skill `sync-public`) — non pubblicato.

## Obiettivo

Oggi il CSV per il commercialista ([EXPORT_COMMERCIALISTA.md](EXPORT_COMMERCIALISTA.md), implementato in `exportService.js`) espone solo la **data di emissione** fattura (`f.data`). Non esiste in nessun punto del codice un campo data-incasso: 🟢 `grep` su `invoiceService.js` per `dataPagamento|pagato|stato.*pagament` non trova nulla. Obiettivo: aggiungere, per ogni fattura emessa, quando è stata effettivamente incassata, leggendo movimenti da export home banking — che varia struttura per banca.

## Approccio: mapping colonne via Gemini, zero dati sensibili inviati

Invece di scrivere/mantenere regex o profili per banca (rigido, uno per formato), inviare a Gemini **solo l'intestazione colonne** del file esportato dalla banca (es. `"Data operazione","Data valuta","Descrizione operazione","Importo","Divisa"`) — mai righe, mai importi, mai causali reali, mai IBAN. Gemini restituisce quale indice colonna corrisponde a `data`/`importo`/`descrizione`. Il parsing dei valori resta locale, in codice, sul file originale: Gemini non vede mai un dato reale.

Infrastruttura già pronta e riusabile 1:1: 🟢 `envService.js` (`leggiGeminiApiKey`/`leggiGeminiModello`), 🟢 pattern chiamata REST già scritto in `geminiAtecoService.js` (`chiamaGemini`, gestione modello non valido/quota esaurita, `estraiArrayJson`/JSON estratto dal testo). Nessuna nuova dipendenza, nessuna nuova gestione API key.

Perché generalizza bene: risolve "ogni banca ha colonne diverse" (CSV/XLSX nativi, qualunque banca, presente e futura) senza profilo per banca a mano — il mapping lo determina Gemini leggendo l'intestazione. Copre anche formati più esotici (CAMT.053/MT940, se mai servissero) con lo stesso principio: struttura→significato delegato a Gemini invece di un parser dedicato per standard.

Limite: richiede `GEMINI_API_KEY` configurata e una chiamata di rete per ogni intestazione mai vista prima — mitigato salvando il mapping su disco (non solo in memoria) per "firma" intestazione: stessa banca → stesso export → stesso mapping riusato da file, Gemini richiamato solo se l'elenco colonne cambia (nuovo formato mai visto, o la banca aggiorna il layout export).

## Nota privacy — importante

Anche se il prompt a Gemini contiene **solo nomi colonna** (mai valori, importi, IBAN, causali reali), resta comunque un invio di dati a un servizio esterno (Google), fuori dal perimetro locale dell'app. Da rendere esplicito all'utente, non silenzioso:

- Il testo inviato è composto unicamente dalle stringhe di intestazione (es. `"Data operazione"`, `"Importo"`) — mai una riga di movimento, mai un valore. Va garantito nel codice: costruire il payload Gemini esplicitamente solo dall'array di intestazioni, mai passare l'intero file o righe dati alla funzione che chiama Gemini.
- La UI deve mostrare un avviso visibile (non un tooltip nascosto) prima del primo invio, tipo: *"I nomi delle colonne del file (non i dati) saranno inviati a Google Gemini per riconoscere automaticamente la struttura del file."* — coerente con come l'app già tratta l'uso di Gemini per ATECO (chiamata esplicita, azione scelta dall'utente in Impostazioni, non automatica in background).
- Nessuna riga di movimento, importo o descrizione reale deve mai comparire nei log applicativo lato chiamata Gemini (verificare che eventuali log di debug della richiesta non stampino accidentalmente l'intero body se in futuro il payload viene esteso oltre le sole intestazioni).

## Nota UI — Gemini non configurato

Se `GEMINI_API_KEY` non è configurata (`leggiGeminiApiKey()` restituisce vuoto, stesso controllo già fatto in `geminiAtecoService.js:60,67,107`), la funzione di mapping automatico non è disponibile. La UI deve:

- Rilevare l'assenza della key **prima** di mostrare l'azione di upload/mapping automatico (stesso pattern del punto Impostazioni → Google → Gemini già usato per ATECO), non fallire a metà flusso con un errore di rete.
- Mostrare un messaggio chiaro con link/rimando a Impostazioni per configurare la key, invece di nascondere la funzionalità senza spiegazione.
- Non bloccare l'intero import: l'utente deve poter comunque scegliere manualmente a mano quale colonna è data/importo/descrizione come fallback (una piccola select per colonna sopra l'anteprima del file), cosicché l'assenza della key degradi la UX invece di azzerarla.

## Piano di implementazione minimo (nessuna nuova dipendenza)

1. **Estendere lo schema fattura** (`invoiceService.js`): aggiungere campo opzionale `dataPagamento` (string YYYY-MM-DD, null se non ancora incassata) al record fattura salvato. Nessuna migrazione dati necessaria — campo assente = non incassata.
2. **Nuovo servizio** `backend/src/services/pagamentiFattureService.js`:
   - `rilevaMappingColonne(intestazioni)` → calcola una firma stabile dell'elenco colonne (es. hash dell'array intestazioni normalizzato), cerca il mapping già salvato in `pagamentiMappingColonne.json` (via `jsonStore.js`, stesso pattern di `f24Versamenti.json`); se trovato lo riusa senza chiamare Gemini. Solo se l'elenco colonne (la firma) non è mai stato visto, chiama Gemini (riuso pattern `chiamaGemini` di `geminiAtecoService.js`, prompt: restituire `{colonnaData: 0, colonnaImporto: 2, colonnaDescrizione: 1}`) e salva il risultato su file per i prossimi import con la stessa intestazione.
   - `estraiMovimentiDaFile(righe, mapping)` → parsing locale (CSV split o `xlsx` già installato per `.xlsx`) usando il mapping — nessun dato reale va a Gemini.
   - `abbinaMovimentiAFatture(movimenti, fattureAperte)` → match per importo esatto su `nettoAPagare` delle fatture con `dataPagamento` ancora nullo; ambiguità lasciate a scelta manuale utente.
   - `confermaPagamento(anno, mese, clienteId, dataPagamento)` → scrive il campo su invoice via `saveInvoice` esistente (riuso, no nuovo store).
3. **Route** `backend/src/routes/pagamentiFattureRoutes.js`, sottile: endpoint upload file → rileva mapping (Gemini, con fallback manuale se key assente) → estrae movimenti → propone abbinamenti; endpoint conferma → salva.
4. **Frontend**: nuova sezione (upload file → avviso privacy prima del primo invio → tabella risultati con conferma, o select manuale colonne se Gemini non configurato).
5. **Export CSV commercialista** (`exportService.js:24` colonne): aggiungere colonna `Data Pagamento` (vuota se non incassata).

Stima: 1 campo nuovo su schema esistente, 1 service nuovo (riuso diretto della chiamata Gemini già scritta per ATECO), 1 route, 1 colonna CSV, frontend con avviso privacy e fallback manuale. Nessuna nuova dipendenza, nessuna nuova gestione API key.

## Domande aperte per l'utente

- Il match fattura↔movimento deve essere solo per importo esatto o serve tolleranza (es. bonifico con commissione trattenuta, importo leggermente diverso da `nettoAPagare`)?
- Vale la pena tracciare anche fatture **non ancora incassate** come vista separata ("scaduto/insoluto"), oltre al solo campo data sul CSV?
- `GEMINI_API_KEY` è già configurata in questo ambiente (usata per ATECO)? Se sì, zero setup aggiuntivo.
