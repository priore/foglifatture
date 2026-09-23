# Piano (step 2): calcolo e compilazione autonoma F24

Confidence: 🟢 confermato da codice · 🟡 inferito · 🔴 ipotesi

Collegato a: [F24_STEP1_RICOGNIZIONE.md](F24_STEP1_RICOGNIZIONE.md) (presupposto), [EXPORT_COMMERCIALISTA.md](EXPORT_COMMERCIALISTA.md).

Tracciato su Gogs (locale), escluso solo dal sync verso GitHub (skill `sync-public`) — non pubblicato.

⚠️ Questo step dipende dall'esito dello Step 1: se lo Step 1 conclude che i versamenti reali si tracciano a mano (scenario più probabile, vedi quel documento), questo step si riduce a "calcolare quanto versare" — non tocca mai dati esterni, solo output. Se invece un domani esistesse un'integrazione automatica con AE/banca (scartata nello Step 1 come non praticabile oggi), questo step si complicherebbe con riconciliazione stimato/importato — scenario non trattato qui perché lo Step 1 lo esclude.

## Obiettivo

Valutare se l'app può, in autonomia, calcolare gli importi F24 dovuti (imposta sostitutiva + eventuale INPS) e produrre un F24 compilato (o i dati pronti per compilarlo), con scelta tra pagamento in unica soluzione o rateizzato.

## Cosa già esiste da riusare

🟢 `forfettarioService.js` già calcola, per anno:
- `redditoImponibile` (ricavi × coefficiente redditività)
- `aliquota` (5% primi 5 anni, 15% dopo — logica già corretta e testata)
- `impostaStimata` (reddito imponibile × aliquota)

Questo è esattamente la base imponibile e l'imposta lorda annua che serve per compilare la sezione Erario dell'F24. **Nessun nuovo calcolo fiscale da inventare per l'imposta sostitutiva** — il motore di calcolo c'è già, manca solo la trasformazione in "importi da versare per scadenza".

## Cosa manca (analisi, non ancora implementazione)

### 1. Logica acconto/saldo — non presente

🟢 Oggi `forfettarioService.js` calcola solo l'imposta sull'anno corrente (consuntivo). Il sistema fiscale italiano richiede:
- **Saldo** anno N (imposta sull'anno appena chiuso) entro il 30 giugno (o 30 luglio con maggiorazione) dell'anno N+1.
- **Acconto** anno N+1 (stimato sul metodo storico: 100% dell'imposta anno N, salvo eccezioni) in 1 rata (se sotto una soglia) o 2 rate (giugno + novembre).
- 🔴 Regole di soglie/percentuali acconto possono cambiare per legge di bilancio anno per anno — un calcolo "automatico" rischia di essere sbagliato se non aggiornato ogni anno fiscale. Questo è un rischio reale, non teorico: un errore qui ha conseguenza economica diretta per l'utente (sanzioni AE), a differenza di un bug nell'export CSV.

### 2. Codici tributo F24 — dominio nuovo, nessun dato in config

🟢 `config.forfettario` oggi non contiene nessun codice tributo. Servirebbero (dati statici, non calcolati):
- `1790`/`1791`/`1792`/`1793` (saldo/acconto imposta sostitutiva forfettari, il codice esatto dipende dall'anno e dal tipo rata — da verificare ogni anno su normativa AE).
- Codice INPS gestione separata (se applicabile — dipende dalla situazione previdenziale specifica dell'utente, che l'app non traccia oggi: nessun campo "regime previdenziale" in `config.js`).
- 🔴 L'INPS gestione separata/artigiani ha regole di calcolo indipendenti dal reddito imponibile forfettario (aliquote INPS diverse, minimali contributivi) — l'app oggi non ha NESSUN dato su questo (non c'è iscrizione INPS in config). Calcolarlo "in autonomia" richiederebbe aggiungere tutto un sotto-dominio previdenziale che oggi non esiste per niente nel prodotto.

### 3. Produzione del file F24 — non è un'operazione di sola lettura

🟢 A differenza dell'export CSV per il commercialista (Step precedente, sola lettura/aggregazione di dati già corretti), qui l'output è un **documento fiscale che l'utente userà per pagare denaro reale**. Un bug produce un versamento sbagliato (importo, codice tributo, scadenza) con conseguenze dirette: sanzioni, interessi, o mancato versamento.

🟡 Non esiste in Italia un formato "F24 XML" standard equivalente a FatturaPA che un privato possa generare e mandare a un sistema — l'F24 si presenta fisicamente in banca/home banking/Entratel, non via canale telematico diretto per il singolo contribuente forfettario (a differenza delle fatture via SDI, qui non c'è un "sistema di interscambio" verso cui l'app possa inviare qualcosa). Quindi "compilazione autonoma" realisticamente significa: **generare un riepilogo stampabile/compilabile a mano o da copiare nell'home banking**, non un invio automatico — è un'operazione diversa nella natura da tutto il resto dell'app (che genera e *invia* XML FatturaPA via PEC).

## Valutazione rischio vs beneficio

- Beneficio: evita all'utente di ricalcolare a mano acconto/saldo/rate — dato che il motore di calcolo imposta esiste già, l'incremento di codice per "quanto versare in totale" è piccolo.
- Rischio: le regole acconto/rateizzazione/codici tributo cambiano ogni anno fiscale e non sono nel dominio che l'app già modella bene (il forfettario stesso, coefficiente redditività, sono stabili — le regole di *versamento* non lo sono altrettanto). Un errore qui costa soldi veri all'utente, categoria di rischio ben diversa da un bug nella dashboard o nell'export.
- 🔴 Mantenere aggiornate le regole acconto/codici tributo anno per anno è un carico di manutenzione ricorrente che il resto dell'app non ha (FatturaPA cambia schema raramente, le regole fiscali di versamento cambiano quasi ogni legge di bilancio).

## Raccomandazione (da confermare con l'utente)

🔴 Ipotesi di scope minimo, se si procede: limitarsi a un **calcolo di supporto, mai un F24 "pronto all'uso"**:
- Mostrare in dashboard: "imposta stimata anno corrente: € X — acconto anno prossimo suggerito: € Y (metodo storico, verificare con commercialista)".
- Nessuna compilazione di modulo F24 vero, nessun codice tributo hard-coded che possa invecchiare silenziosamente.
- Il testo deve esplicitamente indicare "stima, verificare con il commercialista" — l'app non deve mai presentarsi come autorità sul quanto versare.

Full automation (F24 compilato pronto, importi finali, rate incluse) è sconsigliata per rischio/manutenzione sproporzionati rispetto al resto del progetto, a meno che l'utente non accetti esplicitamente l'onere di verificare/aggiornare le regole ogni anno.

## Beneficio possibile da Gemini (già integrato nel progetto)

🟢 `geminiAtecoService.js` è il precedente diretto: usa Gemini (`gemini-2.0-flash` + tool `google_search`) **non per calcolare**, ma per recuperare/aggiornare una tabella normativa pubblica (ATECO → coefficiente redditività) che non esiste in nessun formato strutturato scaricabile, e la salva come JSON statico locale (`atecoSettori.json`) tramite `aggiornaAtecoSettoriDaGemini()`, chiamata manualmente dal wizard (`StepGemini.vue`), non ad ogni richiesta.

Questo pattern si applica bene a un pezzo dello Step 2, non a tutto:

- **Buon uso (stesso pattern di ATECO)**: recuperare/aggiornare annualmente i **codici tributo F24** (`1790`/`1791`/…) e le **soglie/percentuali acconto** correnti, che oggi non sono in `config.forfettario` e cambiano ogni legge di bilancio (il rischio "manutenzione annua" segnalato sopra). Stesso schema: prompt con `google_search`, risposta JSON validata, salvata in un file statico (es. `backend/src/data/f24Regole.json`), aggiornabile manualmente da un pulsante "Aggiorna regole F24" — non un calcolo automatico invisibile, un refresh dati esplicito e ispezionabile come già avviene per ATECO.
- **Cattivo uso (da evitare)**: chiedere a Gemini di calcolare l'importo finale da versare per l'utente specifico. L'aritmetica (imponibile × aliquota, riparto acconto/saldo) è già ferma e corretta in `forfettarioService.js` — non ha senso delegare un calcolo deterministico a un LLM, che aggiunge solo rischio di errore/allucinazione su un dato con conseguenza economica diretta. Gemini resta uno strumento per **recuperare fatti normativi pubblici che cambiano nel tempo**, mai per fare i conti dell'utente.

Riduce quindi il rischio principale segnalato sopra (mantenere aggiornati codici tributo/soglie ogni anno) senza introdurre il rischio peggiore (un LLM che calcola quanto l'utente deve pagare). Resta comunque un dato "recuperato da AI, verificare" — la raccomandazione di non produrre un F24 pronto-uso senza verifica umana resta valida anche con questo aiuto.

## Domande aperte per l'utente

1. Sei iscritto a INPS gestione separata (oltre all'imposta sostitutiva)? Se sì, quell'aliquota/calcolo non è oggi in `config.forfettario` e andrebbe aggiunto come dominio nuovo — impatta molto lo scope.
2. Accetteresti un output "stima acconto/saldo, verifica con commercialista" (basso rischio) o serve davvero un F24 pronto a importo definitivo (alto rischio, manutenzione annua delle regole)?
3. Chi si impegna ad aggiornare i codici tributo/soglie acconto ogni anno fiscale, se si costruisce questa feature?
