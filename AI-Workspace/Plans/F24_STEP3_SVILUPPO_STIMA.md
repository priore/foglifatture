# Piano di sviluppo (step 3): stima versamenti F24 — imposta sostitutiva + INPS gestione separata

Confidence: 🟢 confermato da codice o fonte ufficiale · 🟡 inferito / da riconfermare · 🔴 ipotesi

Analisi e regole verificate: [F24_STEP2_CALCOLO_AUTOMATICO.md](F24_STEP2_CALCOLO_AUTOMATICO.md) (fonti AdE/INPS, valori 2026). Presupposto: [F24_STEP1_RICOGNIZIONE.md](F24_STEP1_RICOGNIZIONE.md).
Proposte collegate: FP-001 (contributi nella stima del netto), FP-003 (acconto/saldo con scomputo dei versamenti), FP-006 (fonte normativa citata), in [FEATURE_PROPOSALS.md](../product/FEATURE_PROPOSALS.md).

Tracciato su Gogs (locale), escluso dal sync verso GitHub (skill `sync-public`).

## Stato avanzamento

- [ ] Step 0 — Fix data INPS gestione separata (16/06 → 30/06) — *fuori scope, serve conferma esplicita*
- [ ] Step 1 — Regole versionate `regoleVersamenti.json` + loader
- [ ] Step 2 — Config previdenziale (`gestionePrevidenziale`, `altraCoperturaPrevidenziale`)
- [ ] Step 3 — Codice tributo opzionale sui versamenti F24 registrati
- [ ] Step 4 — Correzioni `forfettarioService`: acconto per cassa, deduzione INPS, netto con INPS
- [ ] Step 5 — `stimaVersamentiService.js`: righe F24 stimate per scadenza
- [ ] Step 6 — Card dashboard "Versamenti stimati" + impostazioni
- [ ] Step 7 — (opzionale, fase 2) Rateizzazione saldo + primo acconto
- [ ] Step 8 — Chiusura: CHANGELOG, FEATURE_PROPOSALS, piano Step 2

Esecuzione: uno step alla volta, in quest'ordine. Dopo ogni step: test verdi, checkbox spuntata, **stop** e attesa della conferma esplicita dell'utente prima dello step successivo. Nessun commit senza OK esplicito. Riavvio del backend (porta 1969) solo dopo conferma via AskUserQuestion, salvo "riavvia" nel prompt.

---

## Cosa esiste già e si riusa (verificato nel codice)

- 🟢 `forfettarioService.js`: `calcolaDashboardForfettario` (competenza + blocco `cassa`), `aliquotaImposta`, `ricaviAnnoCassa(anno, tutte)`, `tutteLeFattureRisolte`.
- 🟢 `versamentiF24Service.js` + `f24Versamenti.json` (via `jsonStore`): versamenti **effettivi** `{ id, data, tipo, importo }`, con `tipo ∈ 'Imposta sostitutiva' | 'INPS' | 'Altro' | 'F24 (import Cassetto Fiscale)'`, e import del testo copiato dal Cassetto Fiscale. **È la fonte dei "versati"**: non servono nuovi campi `contributiVersati` / `accontiVersati` in config (il piano Step 2 li proponeva prima che avessi visto questo service; sostituiti da questo riuso).
- 🟢 `scadenzeFiscaliService.js`: `scadenzeBaseAnno(anno)` con `primoGiornoLavorativo` (weekend + festività fisse + Pasquetta) e le proroghe via Gemini/Claude (cache 1 anno, mai bloccante). Le date della stima si prendono da qui, non si ricalcolano.
- 🟢 `DashboardView.vue`: griglia card con drag/drop (`ORDINE_DEFAULT`, `caricaOrdineSalvato` aggiunge in coda gli id nuovi), stat `accontoStimato` / `impostaStimata`.
- 🟢 `StepFornitore.vue`: pannello "Regime forfettario" (soglia, data inizio, ATECO).
- 🟢 `VersamentiF24View.vue`: CRUD dei versamenti + confronto con l'imposta stimata.
- 🟢 Pattern dei test: `node --test` con `mock.module('./invoiceService.js', …)` (vedi `forfettarioService.test.js`).

---

## Step 0 — Fix data INPS gestione separata (serve conferma separata)

🟢 Bug trovato durante l'analisi: `scadenzeBaseAnno` ([scadenzeFiscaliService.js:72](../../backend/src/services/scadenzeFiscaliService.js)) mette "INPS gestione separata — Saldo + I acconto" al **16 giugno**. Le fonti INPS (scheda F24 gestione separata, comunicato del 07/07/2025) indicano gli **stessi termini delle imposte sui redditi**, cioè il 30 giugno.

- Modifica: `primoGiornoLavorativo(anno, 6, 30)` alla riga 72.
- Test: estendere `scadenzeFiscaliService.test.js` con l'asserzione sulla data GS di giugno.
- Il prompt AI delle proroghe (righe 93-97) cita "16 giugno" tra gli standard: da allineare nella stessa modifica.

Fuori dallo scope del task ⇒ va chiesto con AskUserQuestion prima di farlo (regola "conferma fix side-effect").

## Step 1 — Regole versionate

**File nuovo:** `backend/src/data/regoleVersamenti.json` (versionato, dati pubblici, nessun segreto ⇒ niente `.gitignore`).

```json
{
  "2026": {
    "verificatoIl": "2026-09-26",
    "impostaSostitutiva": {
      "codici": { "saldo": "1792", "accontoPrimaRata": "1790", "accontoSecondaRata": "1791", "interessiRate": "1668" },
      "sogliaAccontoNonDovuto": 51.65,
      "sogliaUnicaSoluzione": 206,
      "percentualePrimaRata": 50
    },
    "inpsGestioneSeparata": {
      "aliquotaPiena": 26.07,
      "aliquotaRidotta": 24,
      "massimale": 122295,
      "percentualeAcconto": 80,
      "causali": { "piena": "PXX", "ridotta": "P10" }
    },
    "maggiorazioneDifferimento": 0.40,
    "fonti": {
      "impostaSostitutiva": "https://www.agenziaentrate.gov.it/portale/come-si-paga-l-irpef6",
      "codici": "https://www1.agenziaentrate.gov.it/servizi/codici/ricerca/elencoTributi.php?Q1=&Q2=&Q3=IMPOSTE+SOSTITUTIVE",
      "inps": "https://www.inps.it/content/dam/inps-site/it/scorporati/circolari-e-messaggi/2026/02/Circolare_15153/Allegati/16573_Circolare-numero-8-del-03-02-2026.pdf"
    }
  }
}
```

**Prima di scrivere il file**, riconfermare le 3 voci 🟡 del piano Step 2 e aggiornare la confidence lì:
- `percentualeAcconto: 80` → circolare INPS Quadro RR dell'anno;
- `causali` PXX/P10 → tabella AdE delle causali INPS;
- base INPS = reddito forfettario al lordo dei contributi → circolare INPS Quadro RR.

**Loader** in `stimaVersamentiService.js` (Step 5; qui solo la funzione e il suo test):

```js
// Regole dell'anno richiesto, o dell'ultimo anno disponibile ≤ anno con flag `aggiornate: false`.
export function regoleAnno(tutte, anno) { … } // pura, riceve il JSON già letto
```

- Il file si legge come `atecoSettori.json` (`readFile` + `new URL('../data/…', import.meta.url)`), **non** via `jsonStore`: è dato di prodotto, non dato utente.
- Test: anno presente; anno futuro ⇒ ultimo disponibile con `aggiornate: false`; anno precedente al primo ⇒ `null`.

Manutenzione: un blocco nuovo ogni febbraio, dopo la circolare INPS sulle aliquote. Niente cronjob, scraping o refresh AI (vedi piano Step 2).

## Step 2 — Config previdenziale

**`configService.js`**, `DEFAULT_CONFIG.forfettario`:

```js
gestionePrevidenziale: '', // '' = non configurata | 'gestioneSeparata' | 'altra' (artigiani/commercianti/cassa: non stimata, vedi FP-007)
altraCoperturaPrevidenziale: false, // true ⇒ aliquota GS ridotta (pensionati / altra previdenza obbligatoria)
```

- `fondiSezione` propaga già i campi nuovi ai `config.json` esistenti: nessuna migrazione.
- `validaConfig`: `gestionePrevidenziale` accetta solo i 3 valori ammessi.
- **`StepFornitore.vue`**, pannello "Regime forfettario":
  - select "Gestione previdenziale" (Non configurata / INPS gestione separata / Altra — non stimata);
  - checkbox "Pensionato o iscritto ad altra previdenza obbligatoria (aliquota ridotta)", **disabilitata** (non nascosta) se la gestione non è `gestioneSeparata`.
- Default `''` ⇒ il comportamento attuale resta identico finché l'utente non configura nulla.

## Step 3 — Codice tributo opzionale sui versamenti registrati

Serve per separare, dentro gli F24 registrati, il **saldo** dagli **acconti** (a giugno vengono pagati insieme).

- `versamentiF24Service.aggiungiVersamento`: accetta un campo opzionale `codice` (`'1790' | '1791' | '1792' | 'PXX' | 'P10' | ''`). I record esistenti senza `codice` restano validi.
- Due funzioni pure nuove, stesso file, con test:

```js
// Somma per cassa dei contributi INPS versati nell'anno (tipo 'INPS'): è la quota deducibile (L. 190/2014 c. 64).
export function contributiInpsVersati(versamenti, anno) { … }
// Acconti d'imposta versati PER l'anno N (codici 1790/1791 pagati nell'anno N). null se nessun versamento ha il codice.
export function accontiImpostaVersati(versamenti, anno) { … }
```

- **`VersamentiF24View.vue`**: select "Codice (opzionale)" nel form di inserimento + colonna in tabella. Nessun cambiamento all'import dal Cassetto Fiscale, che non riporta il codice.
- 🟡 Se `accontiImpostaVersati` restituisce `null`, lo Step 5 usa come ripiego l'acconto **stimato** dall'anno precedente e lo dichiara in UI ("acconti non registrati, usata la stima").

## Step 4 — Correzioni a `forfettarioService.js`

Il bug più grosso, e ha valore anche da solo: oggi la dashboard sovrastima l'imposta.

1. **Acconto per cassa.** `accontoStimato` va calcolato sui ricavi incassati proiettati (`ricaviCumulatiCassa`), non sulle fatture emesse (`ricaviProiettati`, righe 138-139). Stessa proiezione lineare, con i mesi di incasso. Il valore per competenza resta disponibile se la UI lo mostra ancora, ma non va chiamato "acconto".
2. **Deduzione INPS.** `cassa.impostaStimata = max(0, redditoCassa − contributiInpsVersati(anno)) × aliquota`. Il blocco competenza resta senza deduzione: è un indicatore, non la base fiscale.
3. **Netto con INPS (FP-001).** Se `gestionePrevidenziale === 'gestioneSeparata'`: `inpsStimato = min(redditoCassa, massimale) × aliquotaGS`, e `nettoStimato` sottrae anche questo. In tutti gli altri casi `inpsStimato: null` e il netto resta invariato.
4. **Helper riusabile** `impostaCassaAnno(anno, tutte, config, versamenti, regole)`, che restituisce `{ redditoForfettario, imposta, inps }`. Serve anche allo Step 5 per l'anno N−1: nessun calcolo duplicato.

Test (`forfettarioService.test.js`):
- l'acconto usa la cassa (il fixture esistente ha una fattura incassata nel 2027: deve uscire dal 2026);
- la deduzione INPS riduce l'imposta, con minimo 0;
- netto con e senza gestione separata;
- massimale INPS.

Attenzione: i numeri in dashboard **cambiano** per chi ha già dati. È voluto (è la correzione di un errore), ma va segnalato nel CHANGELOG.

## Step 5 — `stimaVersamentiService.js`

**File nuovo**, funzioni **pure** più il loader delle regole. Nessuna route nuova: il risultato viene aggiunto alla risposta di `GET /forfettario/dashboard`.

Input: l'output di `impostaCassaAnno` per N e N−1, i versamenti registrati, le regole dell'anno, `scadenzeBaseAnno(N+1)`.

Algoritmo (anno fiscale N, pagamenti nell'anno N+1):

```
imposta(N)       = impostaCassaAnno(N).imposta
saldoImposta     = imposta(N) − (accontiImpostaVersati(N) ?? accontoCalcolato(imposta(N−1)))
acconto(N+1)     = imposta(N) > 51,65 ? imposta(N) : 0
                   ≤ 206 ⇒ tutto a novembre (1791) ; altrimenti 50% giugno (1790) + 50% novembre (1791)
INPS(N)          = min(reddito(N), massimale) × aliquota          (solo se gestioneSeparata)
saldoINPS        = INPS(N) − 80% × INPS(N−1)                      (acconti INPS stimati; 🟡 vedi Step 1)
accontoINPS(N+1) = 80% × INPS(N) ⇒ 40% giugno + 40% novembre
```

Output:

```js
{
  annoFiscale: 2026,
  regole: { anno: 2026, verificatoIl: '2026-09-26', aggiornate: true, fonti: {…} },
  scadenze: [
    {
      data: '2027-06-30', // da scadenzeBaseAnno(2027), stessa data della card "Scadenze fiscali"
      righe: [
        { sezione: 'erario', codice: '1792', annoRiferimento: 2026, importo: 812.40, descrizione: 'Saldo imposta sostitutiva 2026' },
        { sezione: 'erario', codice: '1790', annoRiferimento: 2027, importo: 406.20, descrizione: 'I acconto imposta sostitutiva 2027' },
        { sezione: 'inps',   codice: 'PXX',  annoRiferimento: 2026, importo: …,      descrizione: 'Saldo contributi GS 2026' },
        { sezione: 'inps',   codice: 'PXX',  annoRiferimento: 2027, importo: …,      descrizione: 'I acconto contributi GS 2027' }
      ],
      totale: …,
      totaleConMaggiorazione: … // +0,40% entro 30 giorni
    },
    { data: '2027-11-30', righe: [ … ], totale: … }
  ],
  crediti: [ { sezione: 'erario', importo: 120.00, descrizione: 'Saldo 2026 a credito (acconti > imposta)' } ],
  avvisi: [ 'Acconti 2026 non registrati: usata la stima', … ]
}
```

Regole di dettaglio:
- saldo negativo ⇒ va in `crediti`, non tra le righe da pagare; niente logica di compensazione;
- righe a importo 0 escluse;
- arrotondamento al centesimo per ogni riga, totale = somma delle righe arrotondate;
- date: le voci 'Saldo + I acconto imposta sostitutiva' e 'II acconto imposta sostitutiva' di `scadenzeBaseAnno(N+1)`; per l'INPS le voci GS (corrette allo Step 0). Proroghe AI: non applicate in questa prima versione (`ponytail:` — la card "Scadenze fiscali" le mostra già; da unificare se le due card divergono davvero);
- `gestionePrevidenziale !== 'gestioneSeparata'` ⇒ nessuna riga INPS e un avviso "INPS non stimato".

Test (`stimaVersamentiService.test.js`):
- acconto ≤ 51,65 ⇒ nessun acconto;
- 51,65 < acconto ≤ 206 ⇒ unica soluzione a novembre;
- acconto > 206 ⇒ 50/50;
- saldo negativo ⇒ credito;
- acconti registrati vs stimati (avviso presente o assente);
- INPS con massimale;
- gestione non configurata ⇒ solo erario;
- regole dell'anno mancanti ⇒ fallback con `aggiornate: false`;
- totale = somma delle righe.

## Step 6 — UI

**Vincolo layout: confronto pre/post obbligatorio** (regola screenshot UI). Screenshot Playwright della dashboard e delle impostazioni forfettario prima e dopo, tema light + dark, viewport 1440 e 1024. Unica differenza attesa: la card nuova e i campi nuovi. Qualsiasi altro scostamento va capito e sistemato prima di proporre il commit.

- **`DashboardView.vue`**:
  - `'versamenti-stimati'` in coda a `ORDINE_DEFAULT` (`caricaOrdineSalvato` la aggiunge anche a chi ha già un ordine salvato);
  - card con la stessa struttura (card-head trascinabile, tastiera Alt+↑/↓): una tabella per scadenza con data, sezione, codice, anno di riferimento, importo, totale, totale con 0,40%; poi crediti e avvisi;
  - footer fisso: "Stima basata su regole verificate il {verificatoIl} ({fonti}). Non è un F24: verificare con il commercialista prima di pagare." (FP-006);
  - regole non aggiornate per l'anno ⇒ banner di avviso nella card;
  - gestione previdenziale non configurata ⇒ righe INPS **visibili ma disabilitate**, con un link "Configura in Impostazioni → Regime forfettario";
  - stat `accontoStimato` in alto: stessa etichetta, ma il valore ora è per cassa (Step 4); aggiungere `inpsStimato` accanto a "Imposta stimata" quando disponibile.
- Colori, spaziature e raggi solo da variabili CSS esistenti. Nessun colore hex nuovo.
- Nessuna dipendenza frontend nuova.

## Step 7 — Rateizzazione (opzionale, fase 2)

Solo dopo aver validato gli Step 1-6 su un anno reale, e solo se l'utente lo chiede.

- Input: numero di rate `n` (da 1 al massimo possibile con ultima rata ≤ 16 dicembre).
- Solo su saldo + primo acconto (imposta e INPS); il secondo acconto non si rateizza.
- Rata 1 alla scadenza di giugno, le successive al 16 di ogni mese; interessi 4% annuo pro rata sulle rate dopo la prima; interessi erario su codice `1668` in una riga a parte; per l'INPS causale con suffisso `R` e interessi esposti separatamente (🟡 riconfermare il codice degli interessi INPS).
- Funzione pura nello stesso service + test (importi delle rate, somma = totale, ultima data ≤ 16/12).

## Step 8 — Chiusura

- `CHANGELOG.md` (root, italiano, `[Unreleased]`), formato con titolo in grassetto e sotto-elenco:
  - **Stima versamenti F24** (imposta sostitutiva + INPS gestione separata, con codici e scadenze);
  - fix: acconto calcolato per cassa;
  - fix: contributi INPS dedotti dall'imposta stimata;
  - fix: data INPS gestione separata di giugno (se fatto lo Step 0).
- `FEATURE_PROPOSALS.md`: FP-001, FP-003 e (in parte) FP-006 ⇒ ✅ con data e commit.
- `F24_STEP2_CALCOLO_AUTOMATICO.md`: aggiornare la confidence delle voci 🟡 riconfermate e sostituire la proposta `contributiVersati`/`accontiVersati` con il rimando allo Step 3 di questo piano.
- Pre-publish: nessun file sensibile nuovo (`regoleVersamenti.json` è pubblico; gli importi utente restano in `f24Versamenti.json` / `config.json`, già esclusi da git — verificare con `git ls-files`).

---

## Esplicitamente escluso

- Generazione di PDF/file F24 o invio telematico.
- Artigiani/commercianti, casse professionali (FP-007), CPB, metodo previsionale dell'acconto, secondo acconto rateizzato gennaio–maggio (norma a termine).
- IRPEF su redditi diversi dal forfettario.
- Qualsiasi calcolo fatto da un LLM; nessun nuovo uso di AI in questo piano.

## Rischi

- 🟢 **I numeri in dashboard cambiano** dopo lo Step 4 (cassa + deduzione): da comunicare nel CHANGELOG.
- 🟡 **Acconti INPS all'80%, causali PXX/P10, base INPS lorda**: bloccano lo Step 1 finché non sono riconfermati.
- 🟡 **Versamenti importati dal Cassetto senza codice né tipo corretto**: saldo e deduzione dipendono da quanto l'utente classifica. Gli avvisi dello Step 5 lo rendono visibile.
- 🔴 **Aggiornamento annuale di `regoleVersamenti.json`**: se salta, il banner "regole non aggiornate" è l'unica protezione.

## Domande aperte

1. ~~Gestione separata senza altra copertura (26,07%)?~~ ✅ Risposta 2026-09-26: **sì, INPS gestione separata**, aliquota piena 26,07% (`altraCoperturaPrevidenziale: false`). È lo scenario di riferimento per test e verifica manuale degli Step 2-6.
2. Lo Step 0 (data INPS al 30/06) va fatto? È fuori scope, va confermato a parte.
3. La rateizzazione (Step 7) serve?

## Review Checklist

- **Completezza**: tutti i punti del piano Step 2 sono coperti, ciascuno legato ai file reali; lo Step 0 è stato aggiunto dopo la lettura del codice.
- **Accuratezza**: riferimenti al codice verificati (righe e funzioni esistenti al 2026-09-26); regole fiscali come da piano Step 2.
- **Coerenza**: riusa `versamentiF24Service`, `scadenzeBaseAnno`, il pattern `atecoSettori.json` e il drag/drop della dashboard; test con `node --test`; nessuna dipendenza né route nuova.
- **TODO**: riconferma delle 3 voci 🟡 prima dello Step 1.
- **Informazioni mancanti**: F24 storici classificati con il codice. La posizione previdenziale è confermata: gestione separata, 26,07%.
- **Domande aperte**: vedi sezione dedicata.
- **Livello di confidenza**: alto sul codice, medio-alto sulla parte INPS.
