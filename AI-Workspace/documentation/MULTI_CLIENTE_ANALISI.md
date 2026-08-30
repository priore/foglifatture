# Analisi di fattibilità — Supporto multi-cliente (clienti concorrenti)

Confidenza: 🟢 confermato dal codice · 🟡 dedotto · 🔴 ipotesi

Riferimento: `FEATURE_PROPOSALS.md` → Priorità 2, voce #5. Scope confermato dall'utente: più clienti **attivi in parallelo nello stesso mese**, ciascuno con proprio timesheet, propria tariffa oraria, propria fattura. Nessun impegno di roadmap — solo analisi, nessun codice toccato qui.

---

## 1. Stato attuale (confermato dal codice)

### 1.1 Config — `backend/src/services/configService.js`

🟢 `DEFAULT_CONFIG.cliente` è un **oggetto singolo**, non un elenco:
```js
cliente: { denominazione: '', indirizzo: '', cap: '', comune: '', provincia: '',
  partitaIva: '', codiceDestinatarioSdi: '', logoDataUrl: '' }
```
`getConfig()`/`saveConfig()` fanno merge shallow (`fondiSezione`) su questo unico oggetto.

🟢 `fatturazione.tariffaOraria` è **un valore unico globale** — nessuna tariffa per cliente. `fatturazione.progressivoInvio` è il contatore progressivo SDI, condiviso (corretto: vedi §4).

### 1.2 Timesheet — `backend/src/services/timesheetService.js`

🟢 Persistenza: `timesheets/<anno>-<mese>.json` (`chiaveMese`/`percorsoFile`, righe 7-13). **Un solo timesheet per mese**, chiave `anno-mese`. Nessun campo cliente nella griglia giorni (`generaGrigliaVuota`, righe 16-34).

🟢 `listMesiDisponibili()` (riga 63-66) restituisce le chiavi `anno-mese` ordinate — assume una entry per mese.

🟢 `getGiorniMancanti()` (riga 70-79, usata dal promemoria) opera su **un** timesheet per mese.

### 1.3 Fatture — `backend/src/services/invoiceService.js`

🟢 Stessa chiave `invoices/<anno>-<mese>.json` (righe 4-10) — una sola fattura per mese.

🟢 `verificaIntegritaNumerazione()` (righe 68-95) legge **tutte** le fatture di tutti i mesi con `tutteLeFatture()` (righe 54-63, `listMesiFatturati()` + `getInvoice` su ogni chiave) e verifica sequenza `Number(f.numero)` senza salti/duplicati — è una sequenza unica su tutta la cartella `invoices/`.

🟢 `calcolaCompenso()` (riga 24-27) prende `tariffaOraria` come parametro esplicito (non legge config internamente) — punto favorevole: già disaccoppiato, pronto a ricevere una tariffa per cliente senza modifiche.

### 1.4 XML FatturaPA — `backend/src/services/fatturaPaXmlGenerator.js`

🟢 `generaXml({ fornitore, cliente, fattura })` (riga ~24) accetta **`cliente` come parametro esplicito**, non legge `config.json` internamente. `CessionarioCommittente` (righe 78-96) è popolato da questo parametro. Punto molto favorevole: il generatore XML è già multi-cliente-ready, non serve toccarlo — basta che chi lo chiama gli passi il cliente giusto invece di sempre `config.cliente`.

### 1.5 Dashboard forfettario — `backend/src/services/forfettarioService.js`

🟢 `ricaviAnno()` (righe 14-23) somma `imponibile` di **tutte** le fatture dell'anno via `listMesiFatturati()` filtrate per prefisso anno — oggi assume una fattura per chiave `anno-mese`.

🟢 **Bug strutturale già presente, aggravato da multi-cliente**: `ricaviProiettati` (righe 38-40) proietta `ricaviCumulati / mesiFatturati * 12`, dove `mesiFatturati = chiavi.length` (riga 22) — cioè conta **entry**, non mesi civili distinti. Con chiave composita `anno-mese-clienteId`, due clienti fatturati nello stesso mese produrrebbero 2 chiavi per lo stesso mese civile: `mesiFatturati` si gonfierebbe (es. 6 fatture in 4 mesi civili → proiezione calcolata su "6 mesi" invece di 4), sballando la proiezione fine anno verso il basso. Va corretto contando **mesi civili distinti** (`Set` su `anno-mese` estratto dalla chiave), non il numero di fatture.

🟢 La soglia forfettario (€85.000) è **per partita IVA del fornitore**, non per cliente — sommare `imponibile` su tutti i clienti resta comportamento fiscalmente corretto e non richiede altra modifica oltre al fix di cui sopra.

### 1.6 Frontend

🟢 `StepCliente.vue` è già generico: riceve `modelValue` come oggetto e fa `v-model` sui suoi campi — riusabile in un `v-for` su un elenco clienti senza riscriverlo, cambia solo chi lo istanzia (oggi `SettingsView`/wizard passa `config.cliente`, dovrebbe passare `config.clienti[i]`).

🟡 `TimesheetView.vue`/`FatturaView.vue`: nessun concetto di cliente oggi (da confermare leggendo le view per intero se si procede) — vanno estese con un selettore cliente attivo.

---

## 2. Cosa cambia strutturalmente con clienti concorrenti

Il nodo centrale: **la chiave di persistenza `anno-mese` non basta più**, perché oggi identifica univocamente sia il timesheet che la fattura di un mese, ma con clienti paralleli un mese civile ha N timesheet e N fatture (una per cliente).

### 2.1 Nuova chiave: `anno-mese-clienteId`

🟡 `timesheets/<anno>-<mese>-<clienteId>.json`, `invoices/<anno>-<mese>-<clienteId>.json`. `clienteId` va generato lato server al momento della creazione cliente (`crypto.randomUUID()`, stdlib, nessuna dipendenza nuova) e mai riusato/rigenerato — è la chiave esterna che lega timesheet, fattura, e XML allo stesso cliente nel tempo.

Impatto diretto:
- `timesheetService.chiaveMese`/`percorsoFile`, `invoiceService.chiaveMese`/`percorsoFile` — firma cambia da `(anno, mese)` a `(anno, mese, clienteId)`. Tocca ogni chiamante (route, PDF export, dashboard).
- `listMesiDisponibili()`/`listMesiFatturati()` — oggi restituiscono `string[]` di chiavi `anno-mese`; con la nuova chiave restituiscono `anno-mese-clienteId`. Ogni consumatore che fa `chiave.split('-').map(Number)` (es. `forfettarioService.ricaviAnno` riga 18, `invoiceService.tutteLeFatture` riga 58) si rompe silenziosamente se non aggiornato — **grep obbligatorio su `split('-')` prima di toccare il formato chiave**, per non lasciare un chiamante a leggere `clienteId` come se fosse parte del mese.

### 2.2 Dati esistenti — nessuna migrazione richiesta

🟢 Confermato dall'utente: il singolo dato reale già presente sotto la chiave vecchia (`invoices/2026-08.json` e timesheet corrispondente) è perdibile — **nessuna migrazione automatica da scrivere**. Basta rinominare/ricreare a mano quel file col nuovo formato `anno-mese-clienteId.json` una volta introdotto il cambio di chiave, oppure lasciarlo perdere e ripartire pulito. Questo elimina il punto più rischioso del piano (script di migrazione one-shot su dati fiscali) — il cambio di chiave diventa una modifica di codice pura, senza passo dati da eseguire con cautela.

### 2.3 Numerazione fattura — resta invariata, non partizionare

🟢 **Vincolo legale non negoziabile**: `verificaIntegritaNumerazione` deve continuare a operare su **tutte** le fatture di tutti i clienti insieme (stessa P.IVA fornitore = stessa sequenza). Con la nuova chiave `tutteLeFatture()` deve solo ignorare il segmento `clienteId` nel calcolo del progressivo, non filtrare per cliente. Questo è l'unico punto dove multi-cliente **non** introduce un branch per cliente — resta lineare com'è oggi, cambia solo come si legge la chiave del file.

### 2.4 Tariffa oraria per cliente

🟢 `calcolaCompenso()` già riceve `tariffaOraria` come parametro — spostare `fatturazione.tariffaOraria` (globale) dentro ogni oggetto `config.clienti[i].tariffaOraria` e passare quella del cliente selezionato. Nessuna modifica alla funzione di calcolo stessa.

### 2.5 Dashboard forfettario — aggregazione corretta

🟢 Oltre al fix di `mesiFatturati` (§1.5), la dashboard resta **aggregata su tutti i clienti** per il calcolo soglia/imposta (corretto fiscalmente). Se si vuole anche una vista "per cliente" (facoltativo, non richiesto dal vincolo fiscale), è un'aggregazione aggiuntiva sopra gli stessi dati, non un cambio di calcolo — da considerare "nice to have", non parte del nucleo multi-cliente.

### 2.6 Selettore cliente in UI

🟡 Serve un punto unico da cui l'utente sceglie il cliente attivo prima di aprire timesheet/fattura di un mese — es. dropdown in sidebar o in cima a `TimesheetView`/`FatturaView`, che determina quale file `anno-mese-clienteId` viene letto/scritto. Con un solo cliente configurato, il selettore può restare nascosto (comportamento identico a oggi, zero attrito per l'uso attuale single-cliente) — mostrarlo solo se `config.clienti.length > 1`.

🟡 Gestione elenco clienti: nuovo step "Clienti" in Impostazioni (sostituisce l'attuale `StepCliente.vue` singolo) con aggiungi/rimuovi/modifica, riusando `StepCliente.vue` esistente per il form del singolo cliente dentro un `v-for`.

### 2.7 Promemoria timesheet

🟡 `getGiorniMancanti()` oggi opera su un timesheet per mese; con multi-cliente deve iterare su tutti i `clienteId` attivi per quel mese e produrre un avviso per cliente (o un avviso aggregato che elenca i clienti con giorni mancanti) — decisione di prodotto minore, da chiarire se si procede, non blocca il resto.

---

## 3. Elenco modifiche per file (riepilogo tecnico)

| File | Modifica | Sforzo |
|---|---|---|
| `configService.js` | `cliente` singolo → `clienti[]` con `id`; `tariffaOraria` globale → per cliente | medio |
| `timesheetService.js` | `chiaveMese`/`percorsoFile` prendono `clienteId`; `listMesiDisponibili` restituisce anche il cliente; `getGiorniMancanti` per cliente | medio |
| `invoiceService.js` | stesse modifiche di chiave; `tutteLeFatture`/`verificaIntegritaNumerazione` ignorano `clienteId` nel parsing (sequenza resta unica) | medio-alto (punto più delicato, tocca numerazione fiscale) |
| `forfettarioService.js` | fix `mesiFatturati` (contare mesi civili distinti, non entry); adattare `ricaviAnno` alla nuova chiave | basso-medio |
| `fatturaPaXmlGenerator.js` | nessuna modifica — già riceve `cliente` come parametro | nessuno |
| `StepCliente.vue` | riuso in `v-for`, nuovo wrapper elenco clienti in Impostazioni | medio |
| `TimesheetView.vue`, `FatturaView.vue` | selettore cliente attivo, propagato a chiamate API | medio-alto |
| Route (`timesheetRoutes.js`, `invoiceRoutes.js`, ecc.) | aggiungere `clienteId` a path/query params | basso-medio |

---

## 4. Stima complessiva

🔴 Sforzo: **alto**. Non è una feature incrementale: cambia la chiave di persistenza di due collezioni esistenti e tocca il punto più sensibile del sistema (numerazione fattura) — anche se lì la modifica è "solo" di parsing, un errore lì blocca la generazione di qualunque fattura futura (come già successo, non correlato, con `Number("08/2026")` in #11 di `FEATURE_PROPOSALS.md`). Ordine di grandezza: giorni, non ore. Nessun rischio di migrazione dati: il singolo record reale esistente sotto la chiave vecchia è perdibile per decisione esplicita dell'utente (§2.2), quindi il cambio di chiave è puro lavoro di codice.

---

## 5. Raccomandazione

🟡 Ordine di implementazione consigliato:
1. `config.clienti[]` (elenco invece di oggetto singolo).
2. Fix `mesiFatturati` in `forfettarioService.js` (bug indipendente, va comunque corretto prima di aggravarlo con multi-cliente).
3. Cambio chiave `anno-mese` → `anno-mese-clienteId` per timesheet e fatture (nessuna migrazione, si riparte puliti sui dati esistenti).
4. Aggiornare `verificaIntegritaNumerazione`/`tutteLeFatture` per il nuovo formato chiave, verificando che la sequenza resti unica cross-cliente (test manuale: generare fatture per 2 clienti nello stesso mese, verificare numerazione progressiva continua tra loro).
5. Tariffa per cliente, selettore UI, XML (quest'ultimo senza modifiche al generatore, solo al chiamante).
6. Promemoria/dashboard per-cliente come rifinitura finale, non bloccante.

---

## Checklist di Revisione

- **Completezza:** copre stato attuale per ogni file toccato, cosa cambia strutturalmente, elenco modifiche per file, stima, ordine di implementazione con rischio.
- **Accuratezza:** ogni claim tracciato a file/riga specifica; bug `mesiFatturati` verificato leggendo `forfettarioService.js` righe 14-23 e 38-40.
- **Coerenza:** numerazione fattura e soglia forfettario trattate come vincoli per-fornitore (mai partizionati per cliente), coerente con `FEATURE_PROPOSALS.md` #2 e #4 già implementate.
- **TODO:** verificare `TimesheetView.vue`/`FatturaView.vue`/route per intero riga per riga se si procede (qui dedotto da convenzioni note, non riletto interamente).
- **Informazioni mancanti:** nessuna nota, la migrazione dati non è più in scope (confermato dall'utente, §2.2).
- **Domande aperte:** vista dashboard "per cliente" oltre a quella aggregata (facoltativa); comportamento promemoria con più clienti nello stesso mese.
- **Livello di confidenza:** misto 🟢 (stato codice attuale, XML generator, StepCliente) / 🟡 (impatto su view frontend non rilette per intero) / 🔴 (stima sforzo, raccomandazione).
