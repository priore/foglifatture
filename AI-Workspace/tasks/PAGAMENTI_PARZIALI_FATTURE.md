# Task brief — Pagamenti parziali/a rate fatture

Confidenza: 🟢 confermato da codice · 🟡 inferito · 🔴 ipotesi/proposta di design (non ancora implementata)

Stato: ✅ implementato — 2026-09-17.

---

## 1. Problema

🟢 Il modello dati attuale è binario: una fattura ha un solo campo `dataPagamento` (stringa data o `null`). Non esiste `importoPagato`, non esiste storico incassi, non esiste concetto di residuo o fattura "parzialmente pagata".

🟢 Conseguenza diretta sull'import CSV movimenti home banking (`backend/src/services/pagamentiFattureService.js:287-299`, funzione `proponiAbbinamenti`): il matching è per **uguaglianza esatta** `fattura.nettoAPagare === movimento.importo`. Un bonifico parziale (es. acconto) non produce mai un match — né univoco né ambiguo — e cade nel caso "nessuna fattura corrispondente" (`fattura: null`). Oggi l'unico modo di gestirlo è fuori flusso, tramite la voce manuale in dashboard (`DashboardView.vue:271-277`), che però accetta solo una data, non un importo parziale — quindi nemmeno lì è gestibile correttamente.

🟢 Il principio di cassa per il regime forfettario (`forfettarioService.js:36-61`, `ricaviAnnoCassa` / `fattureACavalloAnno`) assume che l'intero importo di una fattura sia incassato in un solo anno, alla singola `dataPagamento`. Con rate a cavallo anno questo calcolo diventa sbagliato: l'imponibile andrebbe spezzato per anno di incasso di ciascuna rata, non attribuito interamente all'anno di un'unica data.

## 2. Obiettivo

Supportare N incassi per fattura, ciascuno con propria data e importo, calcolare un residuo, e considerare la fattura "aperta" finché `residuo > 0`. Il tutto **senza rompere la retro-compatibilità del database** — solo migrazione one-time a runtime, nessuna migrazione batch offline.

## 3. Nuovo modello dati proposto

Aggiungere alla fattura:

```js
{
  // ...campi esistenti invariati...
  dataPagamento: "2026-03-01",   // 🟡 MANTENUTO ma ridefinito: ultima data di incasso (derivato, sola lettura)
  pagamenti: [                    // 🔴 nuovo campo
    { data: "2026-01-15", importo: 400.00 },
    { data: "2026-03-01", importo: 219.20 }
  ]
}
```

Perché non eliminare `dataPagamento`: 🟡 troppi consumer lo leggono direttamente (§5 del report investigativo — 9 punti backend, 6 frontend). Tenerlo come **campo derivato** (ultima data di `pagamenti[]` non vuoto, `null` se `pagamenti` vuoto) mantiene retro-compatibili tutti i punti che oggi fanno `if (f.dataPagamento)` o lo stampano, a costo di ricalcolarlo a ogni scrittura invece di scriverlo direttamente.

Campi derivati da calcolare on-the-fly (mai persistiti, per evitare doppia fonte di verità):
- `totalePagato = pagamenti.reduce((s, p) => s + p.importo, 0)`
- `residuo = nettoAPagare - totalePagato`
- `stato = residuo <= 0 ? 'pagata' : (totalePagato > 0 ? 'parziale' : 'aperta')`

🔴 Proposta: helper unico in `invoiceService.js`, es. `arricchisciStatoPagamento(fattura)`, chiamato ovunque serva leggere lo stato invece di duplicare la logica nei 15 punti elencati nel report.

## 4. Migrazione one-time a runtime

🟢 `jsonStore.js` (`readJson`, righe 24-33) non fa validazione di schema — è passthrough puro. Non serve una migrazione a livello di file system.

🔴 Proposta: punto di innesto in `invoiceService.js`, dentro `getInvoice()` (righe 37-39), o in un normalizzatore condiviso chiamato da ogni funzione che legge una fattura da `readJson`:

```js
function normalizzaPagamenti(fattura) {
  if (!fattura) return fattura;
  if (!fattura.pagamenti) {
    // ponytail: migrazione one-time in lettura, mai scritta finché non c'è un nuovo pagamento
    fattura.pagamenti = fattura.dataPagamento
      ? [{ data: fattura.dataPagamento, importo: fattura.nettoAPagare }]
      : [];
  }
  return fattura;
}
```

Regole:
- **Sola lettura, non scrive mai il file automaticamente** — evita di toccare migliaia di JSON esistenti in un colpo solo o di introdurre effetti collaterali a ogni GET. Il file su disco viene aggiornato al nuovo formato solo alla prossima scrittura naturale (nuovo pagamento, rigenerazione fattura).
- Vecchie fatture senza `pagamenti` continuano a funzionare: la migrazione le arricchisce in memoria on-the-fly, deducendo un unico pagamento pieno dalla vecchia `dataPagamento` (assunzione ragionevole: se c'era una data, l'importo pieno era considerato incassato).
- Fatture mai pagate (`dataPagamento: null`) diventano `pagamenti: []`, `residuo = nettoAPagare` — comportamento identico a oggi.
- Nessun campo esistente viene rinominato o rimosso. Un rollback (tornare al codice vecchio) continua a leggere `dataPagamento` come prima, perché quel campo resta scritto e coerente (derivato dall'ultimo elemento di `pagamenti`).

## 5. Punti di codice da modificare

Riferimento diretto al report investigativo — stessa numerazione.

**Backend:**
1. `invoiceRoutes.js:148` — invariato nella forma, ma la preservazione deve includere `pagamenti` oltre a `dataPagamento`.
2. `pagamentiFattureService.js:278-282` (`fattureAperte`) — condizione da `!f.dataPagamento` a `residuo > 0` (via helper normalizzato).
3. `pagamentiFattureService.js:287-299` (`proponiAbbinamenti`) — **cambio centrale**: matching deve considerare anche `importo <= residuo` (non solo `=== nettoAPagare`). Caso ambiguo (più fatture con residuo `>= importo`): **non auto-selezionare** — resta scelta manuale come oggi, ma i candidati vanno ordinati per `|residuo - importo|` crescente (il più vicino a zero primo in lista), così l'utente vede il match più plausibile in cima invece di un ordine casuale. Nessuna euristica che decide da sola: un'auto-selezione sbagliata sposterebbe soldi sulla fattura sbagliata in silenzio, il rischio non vale il risparmio di un click.
4. `pagamentiFattureService.js:301-307` (`confermaPagamento`) — da sovrascrittura a **append**: `fattura.pagamenti.push({ data, importo })`, poi ricalcolo `dataPagamento` derivato. Firma da estendere con `importo` (oggi manca, vedi punto 15).

⚠️ **Punti 2 e 4 vanno nello stesso commit/PR.** Se `confermaPagamento` inizia a scrivere `dataPagamento` come "ultima rata" (anche su pagamento parziale) prima che `fattureAperte` smetta di usare `!f.dataPagamento` come condizione di chiusura, una fattura con un solo acconto sparirebbe dalla lista "aperte" pur avendo residuo > 0 — bug silenzioso, non un errore visibile. Stessa cautela per ogni altro consumer binario di `dataPagamento` (badge, `ricaviAnnoCassa`): finché non passano tutti all'helper `residuo`/`stato`, non toccare la semantica di scrittura di `dataPagamento`.
5. `forfettarioService.js:39-41` (`ricaviAnnoCassa`) — 🟢 verificato: oggi usa `f.imponibile` (non `nettoAPagare`) e filtra su `f.dataPagamento.slice(0,4) === anno`, sommando l'imponibile **intero** alla data unica. Deve iterare su `pagamenti[]` invece che su `fatture[]`, sommando `rata.importo` per l'anno della **singola rata**. Nota tranquillizzante: `calcolaBollo` (`invoiceService.js:25-28`) ritorna sempre `nettoAPagare === imponibile` (il bollo è a carico del professionista, mai addebitato al cliente — vedi commento righe 20-24), quindi `rata.importo` è già la quota fiscale corretta senza bisogno di proporzioni imponibile/netto.
6. `forfettarioService.js:53-61` (`fattureACavalloAnno`) — 🟢 oggi produce **un record per fattura**. Con rate deve produrre **un record per rata** (iterando `pagamenti[]`), altrimenti una fattura con 3 rate in 3 anni diversi perde o duplica informazione nel filtro `anno === X || annoIncasso === X` (`forfettarioService.js:126`).
7. `forfettarioService.js:45` (`nonIncassateEmesseAnno`, dentro `ricaviAnnoCassa`) — stessa condizione binaria `!f.dataPagamento` del punto 2, stesso rischio di bug silenzioso: va a `residuo > 0`, esposto poi in `forfettarioService.js:123-125` con `residuo` invece di `nettoAPagare` pieno.
8. `exportService.js:22-26` (`fattureIncassateAnno`) — 🔴 **rischio doppio conteggio fiscale**: oggi produce un record per fattura con `f.imponibile` pieno (riga 41 `rigaFattura`). Se una fattura ha rate in due anni diversi e la funzione resta "una riga per fattura", l'intero imponibile finirebbe conteggiato per intero sia nel CSV dell'anno 2026 sia in quello del 2027 — errore fiscale verso il commercialista, non cosmetico. Deve iterare su singole rate per l'anno richiesto, sommando solo `rata.importo` di quell'anno.
9. `exportService.js:34-46` (`rigaFattura`, riga CSV commercialista) — di conseguenza va a riga-per-rata nella sezione "incassate/cassa" (sezione "emesse/competenza" resta a riga-per-fattura, invariata). Utente ha confermato nessuna obiezione al cambio formato (§7).

⚠️ **Punti 5, 6, 7 vanno nello stesso commit di 2+4** (stessa ragione sopra, aggravata: qui il bug è fiscale, non solo di UI). Finché `ricaviAnnoCassa`/`fattureACavalloAnno` leggono `dataPagamento` come unica data anziché iterare `pagamenti[]`, una fattura con rata 2026 + rata 2027 sposterebbe *tutto* l'imponibile sull'anno dell'ultima rata (perché `dataPagamento` derivato = ultima rata), facendo sparire la quota 2026 dal cumulo cassa fiscale di quell'anno — il bug più grave della lista, impatta la base di calcolo imposta sostitutiva mostrata all'utente. **In pratica: punti 1, 2, 4, 5, 6, 7 sono un blocco atomico unico**, non separabile in PR incrementali — un sottoinsieme di questi punti applicato da solo produce numeri fiscali sbagliati silenziosamente, peggio di non avere affatto la feature.

**Frontend:**
10. `FatturaView.vue:291-294` — mostrare lista rate + residuo invece di singola data.
11. `DashboardView.vue:55-64` + `271-277` — form manuale deve accettare anche l'importo. Per non appesantire il caso comune (pagamento intero): campo importo **precompilato col residuo**, editabile. Utente che paga tutto conferma senza toccarlo (stesso numero di click di oggi); utente con parziale sovrascrive il numero.
12. `DashboardView.vue:115-116` (`fatturaScaduta`) — valutare stato "scaduta parziale" (residuo > 0 oltre scadenza).
13. `ImportaStoricoView.vue:121` (`fatturePerImporto`) — estendere il filtro a `importo <= residuo`.
14. `ImportaStoricoView.vue:143-161` (`confermaPagamento`) — inviare anche l'importo del movimento; non rimuovere la fattura dalla lista aperte se resta un residuo, solo decrementarlo.
15. `api.js:151-152` — firma `confermaPagamentoFattura` da estendere con `importo`.
16. Nuovo: azione "elimina pagamento" (dalla lista rate in FatturaView e/o Dashboard) — `pagamenti.splice(indice, 1)`, ricalcolo `dataPagamento`/residuo derivati. Route/service nuovi: `DELETE` o azione dedicata in `pagamentiFattureService.js`, non esiste oggi nemmeno per `dataPagamento` singolo.

**Test (per regola progetto, service logic non banale richiede `*.test.js`):**
17. `pagamentiFattureService.test.js` (nuovo, pattern `pecService.test.js`) — coprire: matching con residuo parziale, caso multi-match ambiguo ordinato per vicinanza, append pagamento non sovrascrive precedenti, eliminazione pagamento ricalcola residuo, residuo che arriva a 0 chiude la fattura, pagamento in eccesso → residuo negativo mostrato come credito.

## 6. Cosa NON cambia

- Formato fiscale XML (fatturaPA) — `dataPagamento` è dato commerciale, mai referenziato in generazione/validazione XML/SDI (verificato, nessun impatto).
- Struttura file JSON esistente — solo aggiunta additiva di `pagamenti[]`, nessun campo rinominato/rimosso.
- Comportamento per fatture già interamente pagate o mai pagate — invariato, la migrazione in lettura li riproduce esattamente.

## 7. Decisioni prese con l'utente

- ✅ Formato export CSV commercialista: riga per rata nella sezione "incassate/cassa" (sezione "emesse/competenza" resta invariata) — nessuna obiezione utente. Non è solo un dettaglio cosmetico: **senza questo cambio il CSV rischia doppio conteggio fiscale** su fatture con rate a cavallo anno (vedi punto 8 in §5) — priorità alta, non rimandabile a "rifinitura in coding".
- ✅ Pagamento in eccesso: **possibile e reale** (arrotondamenti cliente, commissioni bancarie a carico cliente, acconto involontario su fattura successiva). Non bloccare: registrare comunque, `residuo` può andare negativo, mostrato come credito ("pagata, +X€ in eccesso") invece di stato di errore.
- ✅ Eliminazione pagamento: **richiesta esplicitamente**, nessun'altra correzione (no editing di data/importo di un pagamento esistente — solo elimina e re-inserisci). Vedi punto 16 in §5.
- ✅ Disambiguazione multi-match: niente euristica auto-selezionante (rischio di spostare un pagamento sulla fattura sbagliata in silenzio). Soluzione scelta: ordinamento dei candidati per vicinanza `|residuo - importo|`, scelta finale resta manuale dell'utente come oggi. Vedi punto 3 in §5.
- ✅ Form manuale dashboard (punto 11 in §5): importo precompilato col residuo per non appesantire il caso comune (pagamento intero) — utente conferma senza digitare nulla in più, sovrascrive solo se parziale.

## 8. Specifica tecnica — contratti vincolanti + implementazione suggerita

Ogni sotto-sezione è un file. Il blocco **PRIMA** (stato attuale) è un fatto verificato leggendo il codice — non cambia. Il blocco **DOPO** è **un suggerimento**, non un contratto: chi implementa (Sonnet) ha più contesto pratico al momento della scrittura reale (formattazione file, helper già in scope, edge case visti solo scrivendo) e può cambiare la forma dello snippet liberamente.

Cosa invece **è vincolante** e non va cambiato senza motivo (è design deciso con l'utente, non dettaglio implementativo):
- **Contratto dati**: nomi/forma dei campi nuovi (`pagamenti[]` con `{data, importo}`, `residuo`, `stato`, `totalePagato`), quali funzioni li espongono, quali route li ricevono/restituiscono.
- **Regole di business** in §7 (eccesso→residuo negativo, niente auto-selezione ambigui, elimina-non-modifica pagamento, import precompilato col residuo).
- **Vincoli numerici**: arrotondamento a 2 decimali su ogni somma di importi (spiegato sotto, §8.1) — la ragione (floating point) non cambia in base allo stile di codice scelto.
- **Ordine di merge atomico** in §9 — quali file devono stare nello stesso commit e perché.

Tutto il resto nel "DOPO" (nomi variabili locali, se scrivere una riga o tre, dove mettere una funzione dentro il file, se riusare un pattern esistente diverso da quello suggerito) è a discrezione di chi implementa.

### 8.1 `backend/src/services/invoiceService.js` — helper condiviso

Aggiungere, vicino a `calcolaBollo` (dopo riga 29), **non** dentro `getInvoice`:

```js
// Arricchisce una fattura letta da disco con lo stato pagamento derivato da pagamenti[].
// Va chiamata da ogni funzione che legge una fattura per uso relativo al pagamento
// (fattureAperte, ricaviAnnoCassa, dashboard, export) — non serve per letture che
// riguardano solo dati fiscali/anagrafici (es. verificaIntegritaNumerazione).
export function arricchisciStatoPagamento(fattura) {
  if (!fattura) return fattura;
  // ponytail: migrazione one-time in lettura, mai scritta su disco automaticamente —
  // il file JSON passa al nuovo formato solo alla prossima scrittura naturale
  // (nuovo pagamento via confermaPagamento, o rigenerazione fattura).
  const pagamenti = fattura.pagamenti ?? (
    fattura.dataPagamento
      ? [{ data: fattura.dataPagamento, importo: fattura.nettoAPagare }]
      : []
  );
  const totalePagato = Number(pagamenti.reduce((s, p) => s + p.importo, 0).toFixed(2));
  const residuo = Number((fattura.nettoAPagare - totalePagato).toFixed(2));
  const dataPagamento = pagamenti.length ? pagamenti.at(-1).data : null;
  return {
    ...fattura,
    pagamenti,
    dataPagamento,
    totalePagato,
    residuo,
    stato: residuo <= 0 ? 'pagata' : (totalePagato > 0 ? 'parziale' : 'aperta'),
  };
}
```

Decisioni vincolanti su questo helper (non deviare):
- **`.toFixed(2)` + `Number(...)` su ogni somma/sottrazione di importi.** Floating point JS: `0.1 + 0.2 !== 0.3`. Senza arrotondamento, `residuo` può risultare `0.000000000001` invece di `0` — `residuo <= 0` fallirebbe per un pelo e la fattura resterebbe "aperta" per sempre nonostante sia saldata. Questo pattern (`.toFixed(2)` seguito da `Number()`) è già usato ovunque nel codebase esistente (`forfettarioService.js:33,41,71,79...`) — riusarlo, non inventarne uno nuovo.
- **Non muta l'oggetto in input** (`{ ...fattura, ... }`, non `fattura.pagamenti = ...`) — evita side-effect su un oggetto che il chiamante potrebbe riusare altrove (es. `esistente` in `invoiceRoutes.js:131,147-148` è letto e poi il suo `.dataPagamento`/`.invii` riusati in un nuovo oggetto: se l'helper mutasse l'originale, quel riuso leggerebbe dati derivati invece che grezzi).
- `arricchisciStatoPagamento` **non va chiamata dentro `getInvoice()`**: `getInvoice` è usato anche da `invoiceRoutes.js:131` (`esistente`) per leggere `invii`/`dataPagamento` grezzi da riusare in un nuovo oggetto fattura — arricchirlo lì scriverebbe `dataPagamento` derivato (che potrebbe differire dal valore grezzo dopo la migrazione) dentro il record persistito, introducendo una scrittura implicita non censita nel piano. Va chiamata esplicitamente nei 6 punti elencati in §8.2-8.7.

### 8.2 `backend/src/services/pagamentiFattureService.js`

**`fattureAperte` (righe 278-282), sostituzione completa:**
```js
// PRIMA
export async function fattureAperte() {
  const chiavi = await listMesiFatturati();
  const fatture = await Promise.all(chiavi.map((c) => getInvoice(c.anno, c.mese, c.clienteId)));
  return fatture.filter((f) => f && !f.dataPagamento);
}

// DOPO
export async function fattureAperte() {
  const chiavi = await listMesiFatturati();
  const fatture = await Promise.all(chiavi.map((c) => getInvoice(c.anno, c.mese, c.clienteId)));
  return fatture.filter(Boolean).map(arricchisciStatoPagamento).filter((f) => f.residuo > 0);
}
```
Import da aggiungere in cima al file: `import { listMesiFatturati, getInvoice, saveInvoice, arricchisciStatoPagamento } from './invoiceService.js';` (estende l'import esistente riga 16).

**`proponiAbbinamenti` (righe 287-299), sostituzione completa:**
```js
export async function proponiAbbinamenti(movimenti) {
  const aperte = await fattureAperte(); // già arricchite con .residuo
  return movimenti.map((m) => {
    const corrispondenti = aperte
      .filter((f) => m.importo <= f.residuo + 0.01) // +0.01: tolleranza floating point, non un margine di business
      .sort((a, b) => Math.abs(a.residuo - m.importo) - Math.abs(b.residuo - m.importo));
    return {
      ...m,
      fattura: corrispondenti.length === 1
        ? { anno: corrispondenti[0].anno, mese: corrispondenti[0].mese, clienteId: corrispondenti[0].clienteId, numero: corrispondenti[0].numero }
        : null,
      ambiguo: corrispondenti.length > 1,
      // Nuovo: quando ambiguo, il frontend deve poter mostrare i candidati ordinati
      // per plausibilità invece di ripescarli da fattureApertePagamenti in ordine sparso.
      candidati: corrispondenti.length > 1
        ? corrispondenti.map((f) => ({ anno: f.anno, mese: f.mese, clienteId: f.clienteId, numero: f.numero, residuo: f.residuo }))
        : undefined,
    };
  });
}
```
Nota sulla tolleranza `+ 0.01`: **non è un margine di business** (non permette di "pagare 1 centesimo in più del dovuto senza accorgersene") — serve solo a evitare che un residuo memorizzato come `219.19999999998` per accumulo di arrotondamenti precedenti escluda erroneamente un match esatto. Il vero controllo su pagamenti in eccesso è a valle, in `confermaPagamento` (§8.2 sotto), non qui.

**`confermaPagamento` (righe 301-307), firma e corpo cambiano:**
```js
// PRIMA
export async function confermaPagamento(anno, mese, clienteId, dataPagamento) {
  const fattura = await getInvoice(anno, mese, clienteId);
  if (!fattura) throw new Error('Fattura non trovata');
  fattura.dataPagamento = dataPagamento;
  await saveInvoice(anno, mese, clienteId, fattura);
  return fattura;
}

// DOPO — nuovo 4° parametro `importo`, obbligatorio
export async function confermaPagamento(anno, mese, clienteId, dataPagamento, importo) {
  const fattura = await getInvoice(anno, mese, clienteId);
  if (!fattura) throw new Error('Fattura non trovata');
  if (!Number.isFinite(importo) || importo <= 0) throw new Error('Importo pagamento non valido');
  const arricchita = arricchisciStatoPagamento(fattura);
  fattura.pagamenti = [...arricchita.pagamenti, { data: dataPagamento, importo }];
  await saveInvoice(anno, mese, clienteId, fattura);
  return arricchisciStatoPagamento(fattura);
}
```
Nota: `fattura.dataPagamento` **non viene più scritto direttamente** — resta il campo grezzo così com'era prima della chiamata (verrà sovrascritto solo alla prossima lettura via `arricchisciStatoPagamento`, mai persistito come valore derivato). Questo è intenzionale: il file su disco contiene `pagamenti[]` come sorgente di verità, `dataPagamento` sul disco resta quello vecchio finché non lo si rigenera esplicitamente — non è un bug, è la migrazione one-time descritta in §4 applicata anche in scrittura (scrive il nuovo formato, non tocca il vecchio campo).

**Nuova funzione `eliminaPagamento` (dopo `confermaPagamento`):**
```js
export async function eliminaPagamento(anno, mese, clienteId, indice) {
  const fattura = await getInvoice(anno, mese, clienteId);
  if (!fattura) throw new Error('Fattura non trovata');
  const arricchita = arricchisciStatoPagamento(fattura);
  if (indice < 0 || indice >= arricchita.pagamenti.length) throw new Error('Pagamento non trovato');
  fattura.pagamenti = arricchita.pagamenti.filter((_, i) => i !== indice);
  await saveInvoice(anno, mese, clienteId, fattura);
  return arricchisciStatoPagamento(fattura);
}
```
`indice` è la posizione nell'array `pagamenti[]` restituito dalla fattura arricchita — il frontend lo ottiene iterando `fattura.pagamenti` con `v-for="(p, i) in fattura.pagamenti"` e passando `i`.

### 8.3 `backend/src/routes/forfettarioRoutes.js`

**Route `/pagamenti/conferma` (righe 185-194), sostituzione:**
```js
forfettarioRoutes.post('/pagamenti/conferma', async (req, res) => {
  const { anno, mese, clienteId, dataPagamento, importo } = req.body;
  if (!anno || !mese || !clienteId || !dataPagamento || !importo) return res.status(400).json({ errore: 'Dati mancanti' });
  try {
    const fattura = await confermaPagamento(Number(anno), Number(mese), clienteId, dataPagamento, Number(importo));
    res.json({ ok: true, fattura });
  } catch (err) {
    res.status(400).json({ errore: err.message });
  }
});
```
Nota: risposta ora include `fattura` (con `residuo`/`stato` aggiornati) — il frontend può aggiornare la UI senza un round-trip aggiuntivo a `fattureAperte()`. Import da estendere riga 10: aggiungere `eliminaPagamento`.

**Nuova route `DELETE /pagamenti/:anno/:mese/:clienteId/:indice`** (dopo la route sopra):
```js
forfettarioRoutes.delete('/pagamenti/:anno/:mese/:clienteId/:indice', async (req, res) => {
  const { anno, mese, clienteId, indice } = req.params;
  try {
    const fattura = await eliminaPagamento(Number(anno), Number(mese), clienteId, Number(indice));
    res.json({ ok: true, fattura });
  } catch (err) {
    res.status(400).json({ errore: err.message });
  }
});
```

**Route `/fatture-aperte` (riga 92-94): nessuna modifica di firma** — `fattureAperte()` già ritorna oggetti arricchiti con `.residuo`/`.stato` dopo il cambio in §8.2, il frontend riceve i campi nuovi automaticamente via lo stesso endpoint.

### 8.4 `backend/src/services/forfettarioService.js`

**`ricaviAnnoCassa` (righe 39-48), sostituzione completa — cambio di firma concettuale: itera rate, non fatture:**
```js
// PRIMA (righe 39-48)
export async function ricaviAnnoCassa(anno, tutte) {
  const incassateAnno = tutte.filter((f) => f.dataPagamento && f.dataPagamento.slice(0, 4) === String(anno));
  const ricaviCumulati = Number(incassateAnno.reduce((tot, f) => tot + f.imponibile, 0).toFixed(2));
  const nonIncassateEmesseAnno = tutte.filter((f) => f.anno === anno && !f.dataPagamento);
  return { ricaviCumulati, incassateAnno, nonIncassateEmesseAnno };
}

// DOPO — `tutte` deve arrivare già arricchita (arricchisciStatoPagamento applicato dal chiamante,
// vedi nota sotto), quindi ogni f ha già .pagamenti/.residuo
export async function ricaviAnnoCassa(anno, tutte) {
  // Ogni rata di ogni fattura pesa per l'anno della PROPRIA data, non dell'ultima rata:
  // una fattura con rata gennaio-2026 e rata marzo-2027 contribuisce a entrambi gli anni.
  const rateAnno = [];
  for (const f of tutte) {
    for (const p of f.pagamenti) {
      if (p.data.slice(0, 4) === String(anno)) rateAnno.push({ fattura: f, pagamento: p });
    }
  }
  const ricaviCumulati = Number(rateAnno.reduce((tot, r) => tot + r.pagamento.importo, 0).toFixed(2));
  // incassateAnno: usato da exportService per la sezione CSV "incassate" — ora è
  // un elenco di RATE (una entry per rata), non di fatture. Ogni entry porta i dati
  // fattura necessari per la riga CSV più data/importo della singola rata.
  const incassateAnno = rateAnno.map((r) => ({ ...r.fattura, dataPagamento: r.pagamento.data, nettoAPagare: r.pagamento.importo }));
  const nonIncassateEmesseAnno = tutte.filter((f) => f.anno === anno && f.residuo > 0);
  return { ricaviCumulati, incassateAnno, nonIncassateEmesseAnno };
}
```
⚠️ **Precondizione non opzionale**: il parametro `tutte` deve essere il risultato di `tutteLeFattureRisolte()` **passato attraverso `.map(arricchisciStatoPagamento)`** prima di essere passato qui. Il chiamante attuale (`calcolaDashboardForfettario`, riga 109-110) va aggiornato di conseguenza — vedi sotto.

**`fattureACavalloAnno` (righe 53-61), sostituzione completa — un record per rata, non per fattura:**
```js
// PRIMA
function fattureACavalloAnno(tutte) {
  return tutte
    .filter((f) => f.dataPagamento && f.dataPagamento.slice(0, 4) !== String(f.anno))
    .map((f) => ({
      anno: f.anno, mese: f.mese, clienteId: f.clienteId, numero: f.numero,
      annoIncasso: Number(f.dataPagamento.slice(0, 4)),
      nettoAPagare: f.nettoAPagare,
    }));
}

// DOPO — richiede `tutte` arricchita (stessa precondizione di ricaviAnnoCassa)
function fattureACavalloAnno(tutte) {
  const righe = [];
  for (const f of tutte) {
    for (const p of f.pagamenti) {
      const annoIncasso = Number(p.data.slice(0, 4));
      if (annoIncasso !== f.anno) {
        righe.push({ anno: f.anno, mese: f.mese, clienteId: f.clienteId, numero: f.numero, annoIncasso, nettoAPagare: p.importo });
      }
    }
  }
  return righe;
}
```

**`calcolaDashboardForfettario` (righe 75-148): un'unica riga da inserire prima dell'uso di `tutte`:**
```js
// riga 109 — PRIMA
const tutte = await tutteLeFattureRisolte();

// DOPO
const tutte = (await tutteLeFattureRisolte()).map(arricchisciStatoPagamento);
```
Import da aggiungere in cima al file (riga 2): estendere `import { listMesiFatturati, getInvoice, arricchisciStatoPagamento } from './invoiceService.js';`

**Riga 123-125 (`nonIncassateEmesseAnno.map`)**: nessuna modifica di struttura necessaria — `nonIncassateEmesseAnno` ora contiene fatture arricchite, quindi `f.nettoAPagare` esiste ancora identico; opzionale ma consigliato aggiungere `residuo: f.residuo` all'oggetto mappato (riga 124) così la dashboard può mostrare "€X di cui incassabili ancora €Y" invece del solo importo pieno.

### 8.5 `backend/src/services/exportService.js`

**`fattureIncassateAnno` (righe 22-26): nessuna modifica di codice** — riceve già `incassateAnno` da `ricaviAnnoCassa`, che dopo il cambio in §8.4 è già una lista di rate (non di fatture). Il sort `a.dataPagamento.localeCompare(b.dataPagamento)` (riga 25) continua a funzionare invariato perché ogni entry ha ancora `.dataPagamento` (ora = data della singola rata, grazie al remapping fatto in `ricaviAnnoCassa`).

**`rigaFattura` (righe 34-46): nessuna modifica di codice** — riceve un oggetto con `.imponibile`... **attenzione**: `f.imponibile` (riga 41) resta l'imponibile pieno della fattura, non della rata. Con una rata parziale la riga CSV mostrerebbe imponibile pieno anche per un incasso parziale — serve decidere e implementare una delle due:

- (a) colonna "Imponibile" mostra l'imponibile della **rata** (= `f.nettoAPagare` già rimappato a `pagamento.importo` da `ricaviAnnoCassa`, riga 41 diventa coerente automaticamente se si usa quello invece di `f.imponibile`), oppure
- (b) aggiungere colonna separata "Importo rata" e lasciare "Imponibile"/"Netto a pagare" come valori pieni di riferimento.

🔴 Scelta (a) è la più semplice e coerente col resto (una riga = una rata = un incasso reale, tutte le colonne di quella riga riferite alla rata) — cambio minimo:
```js
// riga 41, dentro rigaFattura — PRIMA
f.imponibile.toFixed(2),
// DOPO (nella sola sezione "incassate/cassa"; la sezione "emesse/competenza" usa ancora f.imponibile pieno)
(f.nettoAPagare).toFixed(2),  // f.nettoAPagare qui è già l'importo della singola rata, rimappato da ricaviAnnoCassa
```
🔧 Suggerimento implementativo (non vincolante): una seconda funzione tipo `rigaFatturaCassa` separata da `rigaFattura`, per non introdurre un branch nascosto nella stessa funzione — ma la forma esatta (funzione separata, parametro flag, altro) è a discrezione di chi implementa; il vincolo reale è solo che la sezione "emesse/competenza" resti a fattura intera e la sezione "incassate/cassa" mostri l'importo della singola rata.

### 8.6 `frontend/src/services/api.js`

```js
// riga 151-152 — PRIMA
confermaPagamentoFattura: (anno, mese, clienteId, dataPagamento) =>
  richiesta('/forfettario/pagamenti/conferma', { method: 'POST', body: JSON.stringify({ anno, mese, clienteId, dataPagamento }) }),

// DOPO
confermaPagamentoFattura: (anno, mese, clienteId, dataPagamento, importo) =>
  richiesta('/forfettario/pagamenti/conferma', { method: 'POST', body: JSON.stringify({ anno, mese, clienteId, dataPagamento, importo }) }),
eliminaPagamentoFattura: (anno, mese, clienteId, indice) =>
  richiesta(`/forfettario/pagamenti/${anno}/${mese}/${clienteId}/${indice}`, { method: 'DELETE' }),
```

### 8.7 `frontend/src/views/DashboardView.vue`

**`salvaDataIncasso` (righe 55-67), firma cambia:**
```js
// PRIMA
async function salvaDataIncasso(f, dataPagamento) {
  if (!dataPagamento) return;
  salvandoIncasso.value = `${f.anno}-${f.mese}-${f.clienteId}`;
  try {
    await api.confermaPagamentoFattura(f.anno, f.mese, f.clienteId, dataPagamento);
    await caricaFattureAperte();
    await carica();
  } catch (err) {
    errore.value = err.message;
  } finally {
    salvandoIncasso.value = null;
  }
}

// DOPO — nuovo parametro importo
async function salvaDataIncasso(f, dataPagamento, importo) {
  if (!dataPagamento || !importo) return;
  salvandoIncasso.value = `${f.anno}-${f.mese}-${f.clienteId}`;
  try {
    await api.confermaPagamentoFattura(f.anno, f.mese, f.clienteId, dataPagamento, importo);
    await caricaFattureAperte();
    await carica();
  } catch (err) {
    errore.value = err.message;
  } finally {
    salvandoIncasso.value = null;
  }
}
```

**Template (righe 267-283), il blocco `<li>` cambia per aggiungere l'input importo precompilato col residuo:**
```html
<!-- PRIMA (righe 267-283) -->
<li v-for="f in fattureAperte" :key="`${f.anno}-${f.mese}-${f.clienteId}-${f.numero}`">
  <span class="riga-fattura-aperta">
    <span>
      <span class="dot-scaduta" :class="{ visibile: fatturaScaduta(f) }" :title="fatturaScaduta(f) ? `Scaduta il ${formattaData(f.dataScadenzaPagamento)}` : ''"></span>
      Fattura {{ f.numero }} — {{ formattaData(f.data) }}
    </span>
    <span v-if="f.dataScadenzaPagamento" class="scadenza-sotto">scadenza {{ formattaData(f.dataScadenzaPagamento) }}</span>
  </span>
  <span style="display:flex;align-items:center;gap:8px">
    <strong>{{ formattaEuro(f.nettoAPagare) }}</strong>
    <input
      type="date" class="input-incasso" title="Segna come incassata il..."
      :disabled="salvandoIncasso === `${f.anno}-${f.mese}-${f.clienteId}`"
      @change="salvaDataIncasso(f, $event.target.value)"
    />
  </span>
</li>

<!-- DOPO -->
<li v-for="f in fattureAperte" :key="`${f.anno}-${f.mese}-${f.clienteId}-${f.numero}`">
  <span class="riga-fattura-aperta">
    <span>
      <span class="dot-scaduta" :class="{ visibile: fatturaScaduta(f) }" :title="fatturaScaduta(f) ? `Scaduta il ${formattaData(f.dataScadenzaPagamento)}` : ''"></span>
      Fattura {{ f.numero }} — {{ formattaData(f.data) }}
      <span v-if="f.stato === 'parziale'" class="badge-parziale">parziale, residuo {{ formattaEuro(f.residuo) }}</span>
    </span>
    <span v-if="f.dataScadenzaPagamento" class="scadenza-sotto">scadenza {{ formattaData(f.dataScadenzaPagamento) }}</span>
  </span>
  <span style="display:flex;align-items:center;gap:8px">
    <strong>{{ formattaEuro(f.residuo) }}</strong>
    <input
      type="number" step="0.01" class="input-importo-incasso" title="Importo incassato"
      :value="f.residuo"
      @input="importiIncasso[`${f.anno}-${f.mese}-${f.clienteId}`] = $event.target.value"
      :disabled="salvandoIncasso === `${f.anno}-${f.mese}-${f.clienteId}`"
    />
    <input
      type="date" class="input-incasso" title="Segna come incassata il..."
      :disabled="salvandoIncasso === `${f.anno}-${f.mese}-${f.clienteId}`"
      @change="salvaDataIncasso(f, $event.target.value, Number(importiIncasso[`${f.anno}-${f.mese}-${f.clienteId}`] ?? f.residuo))"
    />
  </span>
</li>
```
Nuovo state da dichiarare vicino a `salvandoIncasso` (riga 54): `const importiIncasso = ref({});` — mappa chiave `anno-mese-clienteId` → stringa importo digitata, inizializzata implicitamente al residuo tramite `:value="f.residuo"` sul primo render (il `v-model` non si usa qui perché il valore di default deve seguire `f.residuo`, che cambia a ogni refresh della lista — un `ref` singolo condiviso da tutte le righe andrebbe in conflitto tra fatture diverse, da cui la mappa per chiave).

`badge-parziale`: nuova classe CSS, colore da variabile esistente (regola `code-quality.md` — niente hex hard-coded), es. `var(--warning)` o token equivalente già presente in `:root` (verificare nome esatto token in `frontend/src/assets/*.css` prima di scrivere il CSS — non indovinare il nome).

**`fatturaScaduta` (riga 115-116): nessuna modifica** — la logica di scadenza resta sulla data, indipendente dal residuo. Se si vuole distinguere "scaduta parziale" da "scaduta totale" in UI, è puro styling condizionale su `f.stato`, non richiede cambio alla funzione.

### 8.8 `frontend/src/views/FatturaView.vue`

**Blocco "Data incasso" (righe 291-294), sostituzione:**
```html
<!-- PRIMA -->
<div class="field" v-if="fatturaGenerata?.dataPagamento">
  <label>Data incasso</label>
  <input type="date" :value="fatturaGenerata.dataPagamento" disabled />
</div>

<!-- DOPO -->
<div class="field" v-if="fatturaGenerata?.pagamenti?.length">
  <label>Pagamenti registrati {{ fatturaGenerata.residuo > 0 ? `(residuo ${formattaEuro(fatturaGenerata.residuo)})` : '(saldata)' }}</label>
  <ul class="lista-piatta">
    <li v-for="(p, i) in fatturaGenerata.pagamenti" :key="i" style="display:flex;justify-content:space-between;align-items:center">
      <span>{{ formattaData(p.data) }} — {{ formattaEuro(p.importo) }}</span>
      <button class="btn btn-ghost btn-small" @click="eliminaPagamento(i)">Elimina</button>
    </li>
  </ul>
</div>
```
Nuova funzione da aggiungere nello `<script setup>`:
```js
async function eliminaPagamento(indice) {
  await api.eliminaPagamentoFattura(fatturaGenerata.value.anno, fatturaGenerata.value.mese, fatturaGenerata.value.clienteId, indice);
  fatturaGenerata.value = await api.getFattura(anno.value, mese.value, clienteId.value);
}
```
Verificare nome esatto delle variabili locali `anno`/`mese`/`clienteId` nello script della view prima di scrivere (non assumere, leggere il file). `formattaEuro`/`formattaData`: verificare se già esistono in questo componente o vanno importate/duplicate dal pattern usato in `DashboardView.vue`.

### 8.9 `frontend/src/views/ImportaStoricoView.vue`

**`fatturePerImporto` (riga 120-122): sostituzione:**
```js
// PRIMA
function fatturePerImporto(importo) {
  return fattureApertePagamenti.value.filter(f => f.nettoAPagare === importo);
}

// DOPO
function fatturePerImporto(importo) {
  return fattureApertePagamenti.value.filter(f => importo <= f.residuo + 0.01);
}
```

**`confermaPagamento` (righe 149-160), sostituzione:**
```js
// PRIMA
async function confermaPagamento(proposta, indice) {
  const chiave = scelteFatturaPagamenti.value[indice];
  const fattura = fattureApertePagamenti.value.find(f => chiaveFattura(f) === chiave);
  if (!fattura) return;
  try {
    await api.confermaPagamentoFattura(fattura.anno, fattura.mese, fattura.clienteId, proposta.data);
    confermatiPagamenti.value.add(indice);
    fattureApertePagamenti.value = fattureApertePagamenti.value.filter(f => chiaveFattura(f) !== chiave);
  } catch (err) {
    erroreProposte.value = err.message;
  }
}

// DOPO — non rimuove più la fattura dalla lista se resta un residuo, decrementa invece
async function confermaPagamento(proposta, indice) {
  const chiave = scelteFatturaPagamenti.value[indice];
  const fattura = fattureApertePagamenti.value.find(f => chiaveFattura(f) === chiave);
  if (!fattura) return;
  try {
    const { fattura: fatturaAggiornata } = await api.confermaPagamentoFattura(fattura.anno, fattura.mese, fattura.clienteId, proposta.data, proposta.importo);
    confermatiPagamenti.value.add(indice);
    if (fatturaAggiornata.residuo > 0) {
      // Fattura ancora aperta (pagamento parziale): aggiorna il residuo in lista invece di rimuoverla,
      // così resta selezionabile per abbinare eventuali movimenti CSV successivi nello stesso import.
      fattureApertePagamenti.value = fattureApertePagamenti.value.map(f =>
        chiaveFattura(f) === chiave ? { ...f, residuo: fatturaAggiornata.residuo } : f
      );
    } else {
      fattureApertePagamenti.value = fattureApertePagamenti.value.filter(f => chiaveFattura(f) !== chiave);
    }
  } catch (err) {
    erroreProposte.value = err.message;
  }
}
```
Nota: `proposta.importo` deve esistere — verificare che `estraiMovimentiDaCsv` (già ritorna `{ data, importo, descrizione }`, `pagamentiFattureService.js:272`) propaghi `importo` fino a `proposta` via `proponiAbbinamenti` (già lo fa: `...m` alla riga `return { ...m, fattura, ambiguo, candidati }` in §8.2 mantiene tutti i campi di `m`, incluso `importo`).

**Nuovo: UI per mostrare `proposta.candidati` quando `proposta.ambiguo`.** Il template attuale (non riletto qui riga per riga, verificare struttura esatta prima di editare) mostra probabilmente una `<select>` con opzioni da `fattureApertePagamenti` in ordine di caricamento. Va cambiato per, quando `proposta.ambiguo === true`, ordinare le opzioni secondo `proposta.candidati` (già ordinate per vicinanza residuo-importo dal backend, §8.2) invece dell'ordine grezzo di `fattureApertePagamenti` — leggere il template esistente (righe non ancora lette in questo documento) prima di implementare questa parte specifica.

## 9. Ordine di applicazione (blocco atomico)

Un solo commit/PR che include, in quest'ordine di scrittura (l'ordine di merge logico, non l'ordine di esecuzione a runtime):

1. `invoiceService.js` — helper `arricchisciStatoPagamento` (§8.1). Codice morto finché nessuno lo chiama: sicuro da solo.
2. `pagamentiFattureService.js` — `fattureAperte`, `proponiAbbinamenti`, `confermaPagamento`, `eliminaPagamento` (§8.2).
3. `forfettarioRoutes.js` — route `/pagamenti/conferma` estesa, nuova route `DELETE /pagamenti/:anno/:mese/:clienteId/:indice` (§8.3).
4. `forfettarioService.js` — `ricaviAnnoCassa`, `fattureACavalloAnno`, riga `tutte = ...map(arricchisciStatoPagamento)` in `calcolaDashboardForfettario` (§8.4). **Questo passo non è separabile dal 2**: se il 2 è mergiato senza il 4, `fattureAperte()` userebbe già `.residuo` ma `ricaviAnnoCassa` leggerebbe ancora `dataPagamento` grezzo (che dopo il passo 2 può essere `null` anche con un pagamento parziale registrato, visto che §8.2 non scrive più `fattura.dataPagamento` direttamente) — il cumulo cassa fiscale smetterebbe di vedere qualunque pagamento parziale, sottostimando il fatturato-cassa. Bug silenzioso su un numero fiscale mostrato in dashboard.
5. `exportService.js` — `rigaFatturaCassa` nuova funzione (§8.5).
6. `api.js`, `DashboardView.vue`, `FatturaView.vue`, `ImportaStoricoView.vue` (§8.6-8.9).
7. `pagamentiFattureService.test.js` (nuovo) — coprire almeno: `.residuo <= 0` con somma di due rate che in floating point grezzo darebbe `0.00000000003` (assert che `arricchisciStatoPagamento` lo arrotonda a `pagata`); `proponiAbbinamenti` con 3 fatture aperte e residui `[100, 105, 200]` per un movimento di `100.50` (assert ordine: `105` prima di `100` prima di `200`); `eliminaPagamento` su indice fuori range lancia errore; `ricaviAnnoCassa` con una fattura con rate in due anni diversi assegna la quota corretta a ciascun anno.

Nessun passo di questa lista è mergeable isolatamente in produzione — è un blocco singolo. Se serve spezzare in PR più piccole per revisione, usare feature branch con merge finale atomico, non deploy incrementali dei singoli passi.

## Review Checklist

- **Completeness**: coperti modello dati, migrazione, tutti i punti di codice noti, casi limite, e §8/§9 danno firme esatte before/after per ogni file toccato + ordine di merge atomico.
- **Accuracy**: basato su lettura diretta del codice reale in questa sessione (`invoiceService.js`, `forfettarioService.js`, `exportService.js`, `pagamentiFattureService.js`, `forfettarioRoutes.js`, `invoiceRoutes.js`, `api.js`, `DashboardView.vue`, `FatturaView.vue`, `ImportaStoricoView.vue`), non su ipotesi né su un report di sessione precedente non riverificato.
- **Consistency**: coerente con pattern esistenti (`jsonStore.js` passthrough, `.toFixed(2)`+`Number()` per arrotondamento come già fatto in `forfettarioService.js`, niente ORM/schema formale, niente Jest — test con `node --test`).
- **TODO**: implementazione non iniziata — questo è solo il piano. Due punti espliciti lasciati come "leggere il file prima di editare, non assumere" (§8.8 nomi variabili locali FatturaView, §8.9 struttura select ambigui ImportaStoricoView) — unici punti non fissati a livello di snippet esatto, deliberatamente: richiedono lettura diretta del file al momento dell'edit, non ipotesi scritte oggi che potrebbero disallinearsi.
- **Missing information**: nessuna sul design; due dettagli implementativi minori rimandati a lettura-al-momento (vedi TODO sopra).
- **Open questions**: nessuna, piano pronto per implementazione.
- **Confidence level**: 🟢 tutto il documento, incluso §8 — ogni snippet before/after è stato scritto leggendo il file reale riga per riga in questa sessione, non da un report precedente. 🔴 solo la sotto-scelta (a) vs (b) in §8.5 (formato riga CSV rata) è una proposta di design, non ancora eseguita/testata.
