# Piano — Funzionalità da integrare dopo il confronto con un progetto esterno

Confidence: 🟢 confermato da codice o fonte ufficiale · 🟡 inferito / da riconfermare · 🔴 ipotesi

**Origine.** Ho letto file per file tutto il codice sorgente di [kouga00/opentax-it](https://github.com/kouga00/opentax-it) (clonato il 2026-09-26, librerie escluse): pacchetti `fiscal-rules` e `fatturapa`, API NestJS, web Next.js, `docs/`, `TODO.md`. Il progetto copre lo stesso dominio di Timesheet: forfettario, FatturaPA, SDI via PEC, F24. Qui si citano i suoi `file:riga` **solo come riferimento tecnico interno**. `FEATURE_PROPOSALS.md` descrive le stesse funzioni as-is per Timesheet e non nomina il progetto esterno.

**Scope escluso:** multi-tenant, e con lui login/ruoli/sessioni per più utenti. Timesheet resta mono-operatore e multi-cliente (`.claude/rules/code-quality.md`).

**Piani collegati:** [F24_STEP3_SVILUPPO_STIMA.md](F24_STEP3_SVILUPPO_STIMA.md) (in corso: stima saldo e acconti), [F24_STEP2_CALCOLO_AUTOMATICO.md](F24_STEP2_CALCOLO_AUTOMATICO.md) (regole verificate). Questo piano **non duplica** F24_STEP3. La sezione A precisa i suoi punti ancora 🟡. Le sezioni B-C aggiungono quello che viene dopo.

Tracciato su Gogs (locale), escluso dal sync verso GitHub (skill `sync-public`), come gli altri piani F24.

---

## ⚠️ Vincolo di licenza: niente codice copiato

🟢 opentax-it è rilasciato con licenza **AGPL-3.0-only** (`LICENSE`). Timesheet usa **PolyForm Noncommercial 1.0.0** con CLA ed è pensato anche per un uso commerciale futuro (`MONETIZZAZIONE_STRATEGIA.md`). Codice AGPL copiato dentro Timesheet imporrebbe l'AGPL all'intero progetto. Quindi:

- **Si riscrive tutto da zero**, nello stile di Timesheet (JS ESM, nomi di dominio in italiano, `jsonStore`, `node --test`). opentax-it serve solo come mappa di *cosa* fare e di *quale norma* lo prevede.
- **Norme e fatti si possono riusare**: aliquote, codici tributo, date, citazioni di legge, host dei gestori PEC. Non sono tutelati dal diritto d'autore (L. 633/1941 art. 5 per gli atti ufficiali). Vanno però **riverificati sulla fonte ufficiale**, non ricopiati dal loro repository.
- **Dati compilati da loro, da non copiare così come sono**: `docs/fonti/registro.json`, le coordinate del modello F24 in `f24-pdf.service.ts`, l'elenco sedi INPS `inps-offices.ts`. Si ricostruiscono dalle fonti primarie: documenti AdE/INPS, e misura delle coordinate sul PDF AdE.

---

## Come leggere questo piano

Ogni voce ha la stessa struttura:
- **In parole semplici**: cosa cambia per te che usi l'app.
- **Oggi in Timesheet**: cosa esiste già (verificato nel codice).
- **Cosa fare**: la parte tecnica, con i file coinvolti.
- **Riferimento esterno**: dove guardare in opentax-it per i dettagli.
- **FP**: il numero della voce in `FEATURE_PROPOSALS.md`.

### Riepilogo

| # | Funzione | FP | Sforzo | Dipende da | Ordine (sez. G) |
|---|---|---|---|---|---|
| A | Precisazioni a F24_STEP3 (risolvono i 🟡) | FP-001/003/015 | — | — | — |
| 1 | Regole fiscali versionate per anno, con confronto e conferma | FP-021 | M | — | 3° |
| 2 | Registro delle fonti archiviate con citazione verificata | FP-019 | M | 1 | 10° |
| 3 | Controllo periodico delle fonti ufficiali, con proposta e conferma | FP-022 | M | 1, 2 | 15° |
| 4 | Calendario fiscale: festività e slittamenti di legge | FP-026 | S | 1 | 6° |
| 5 | Requisiti aliquota 5% e ripartizione acconti | FP-027 | S | 1 | 7° |
| 6 | Piano F24: saldo, acconti, rate, interessi | FP-015 | L | F24_STEP3 | 12° |
| 7 | Stesura F24 sul modello ufficiale AdE (PDF) | FP-023 | M | 6 | 14° |
| 8 | Stato degli F24 e versamenti registrati in automatico | FP-024 | S-M | 7 | 16° |
| 9 | Compensazione crediti nell'F24 | FP-016 | M | 7, 8 | 18° |
| 10 | Imposta di bollo trimestrale: scadenze e F24 | FP-025 | S-M | 1, 7 | 17° |
| 11 | Avviso soglia prima di emettere e limite personale | FP-028 | S | 1 | 8° |
| 12 | Blocco della data fattura nel futuro | FP-029 | S | — | 1° |
| 13 | Dati di pagamento in fattura | FP-030 | S-M | — | 2° |
| 14 | Rivalsa INPS 4% facoltativa | FP-031 | S-M | 1 | 9° |
| 15 | Clienti esteri: Natura IVA, diciture, Intrastat | FP-018 | M | 1 | 11° |
| 16 | Fatture e incassi in valuta, cambio Banca d'Italia | FP-020 | S-M | 15 | 13° |
| 17 | Import di archivi ZIP (fatture + ricevute SDI) | FP-017 | M | — | 5° |
| 18 | PEC guidata: gestori preconfigurati, prova passo-passo, PEC di prova allo SDI | FP-032 | M | — | 4° |

Sforzo: S = qualche ora · M = 1-3 giorni · L = oltre.

---

## A. Precisazioni per F24_STEP3 (dal confronto esterno)

Sono risposte, con la fonte, ai punti che F24_STEP3 segna come 🟡 o lascia aperti. Vanno recepite **dentro** F24_STEP3 quando si arriva allo step indicato. Nessun lavoro nuovo: evitano di rifare i conti due volte.

| # | Punto | Cosa dice la fonte | Impatto su F24_STEP3 | Riferimento esterno |
|---|---|---|---|---|
| A1 | Base imponibile INPS (🟡 Step 1) | Base = reddito forfettario **lordo** (rigo LM34 col. 2, meno LM37 col. 2), prima della deduzione dei contributi; tetto al massimale. Arrotondata all'euro, e contributo (RR5 col. 15) in euro interi | Conferma la base lorda. Aggiungere l'arrotondamento all'euro di base e contributo | 🟢 Circ. INPS 62/2026 §2.2, citata in `packages/fiscal-rules/src/tax-computation.ts` (commento iniziale) |
| A2 | Aliquota degli acconti INPS | Gli acconti per l'anno N+1 (40% + 40%) si calcolano sul reddito di N **con l'aliquota di N+1** | Step 5: `accontoINPS(N+1) = 80% × min(reddito(N), massimale) × aliquotaGS(N+1)`, non `80% × INPS(N)`. Coincidono solo se l'aliquota non cambia | 🟢 Circ. INPS 8/2026 §4.2; `apps/api/src/taxes/services/taxes.service.ts` (`nextYearInpsRatePct`), `tax-computation.ts` `inpsAdvance` |
| A3 | Causali INPS (🟡 Step 1 e Step 7) | `PXX` unica soluzione, `P10` aliquota ridotta; con le rate `PXXR`/`P10R`; interessi da rateazione e maggiorazione su riga separata `DPPI` | Chiude il 🟡 dello Step 7 ("codice degli interessi INPS") | 🟢 Scheda INPS "F24 per professionisti iscritti alla Gestione Separata"; `rule-sets/2026.ts` `inpsReasons` |
| A4 | Maggiorazione 0,40% del differimento | Erario: si aggiunge all'importo **prima** di dividerlo in rate, dentro il codice tributo. INPS: la maggiorazione **non** va sulla riga `PXX`, va su `DPPI` insieme agli interessi | Step 5 (totale con maggiorazione) e Step 7 | 🟢 Istr. Redditi PF 2026 fasc. 1 §7; Circ. INPS 62/2026 §3-4; `f24-schedule.ts` `buildPaymentSchedule` (`planFor`, `inpsShare`) |
| A5 | Acconti versati da scalare nel saldo | La maggiorazione pagata **non** conta come acconto versato | Step 3/5: sommare i versati senza la quota di maggiorazione (serve tenerla separata sulla riga, vedi voce 8) | 🟢 Istr. Redditi PF 2026 fasc. 3, rigo LM45; `taxes.service.ts` `paidFromF24` (`surchargeAmount`) |
| A6 | Arrotondamenti | I righi della dichiarazione (reddito, imposta, saldo) vanno in **euro interi**, con arrotondamento per eccesso da 50 centesimi. Acconti e rate si calcolano **al centesimo** | Step 4-5: oggi tutto è arrotondato al centesimo | 🟢 Istr. Redditi PF 2026 fasc. 1, "Modalità di arrotondamento" e §7; `tax-computation.ts` `roundEuro` |
| A7 | Acconto imposta: 40/60 o 50/50 | 50/50 per chi svolge un'attività con ISA approvato (quasi tutti i forfettari), altrimenti 40/60. Unica soluzione a novembre se la prima rata non supera 103 € (con il 50/50 vuol dire acconto ≤ 206 €, come in F24_STEP3) | F24_STEP3 assume sempre 50/50: serve un flag (voce 5) | 🟢 DL 124/2019 art. 58; Ris. AdE 93/E/2019; DPR 435/2001 art. 17 c. 3; `tax-computation.ts` `substituteTaxAdvance` |
| A8 | Fonte della rateazione | Dal 1/1/2026 la norma vigente è il **D.Lgs. 33/2025 art. 10** (testo unico versamenti), non più l'art. 20 del D.Lgs. 241/97 citato in F24_STEP2. L'art. 11 sposta al 20 agosto le scadenze dall'1 al 20 agosto | Aggiornare la fonte nella tabella di F24_STEP2; Step 7 | 🟢 `installment-plan.ts` (commento iniziale, `applyAugustDeferral`) |
| A9 | Interessi delle rate (🟡 Step 7 "4% annuo pro rata") | Seconda rata: 4% × giorni commerciali (mesi di 30 giorni) dal giorno dopo la prima scadenza alla data nominale della seconda, diviso 360, arrotondato a 2 decimali. Ogni rata successiva: +0,33 punti fissi. Gli interessi vanno su una riga a parte (`1668` Erario, `DPPI` INPS). Il **numero massimo di rate** dipende dalla data di partenza: si chiude sempre entro il 16 dicembre | Chiude il 🟡 dello Step 7 con la formula esatta, verificata sulla tabella ufficiale AdE (partenza 30/6 → 0,18%, 0,51%, …) | 🟢 DM 21/5/2009 art. 5; Istr. Redditi PF 2026 fasc. 1 "Rateazione"; `installment-plan.ts` `commercialDays`, `secondInstallmentInterestPct`, `maxInstallmentDates` |
| A10 | Importo minimo per riga F24 | Sotto 1,03 € per codice tributo non si versa | Step 5: scartare la riga e dare un avviso | 🟢 Istr. Redditi PF 2026 fasc. 1 §7; `f24-schedule.ts` `F24_MIN_LINE_AMOUNT` |
| A11 | Proroga 2026 | DL 89/2026 art. 6: forfettari/ISA pagano entro il **20/07/2026**; differimento al **20/08/2026** con +0,80% | Da mettere nelle regole versionate (voce 1), non nella risposta AI: oggi `scadenzeFiscaliService.js` la cerca solo via AI | 🟢 `rule-sets/2026.ts` `deadlines.balanceAndFirstAdvanceExtended`, `deferredExtended` |
| A12 | Oltre 100.000 € | Il regime cessa **nello stesso anno**: il piano F24 forfettario non va generato, al suo posto un avviso bloccante | Step 5: controllo in testa (collegato a FP-002) | 🟢 L. 190/2014 c. 71; `apps/api/src/f24/services/f24.service.ts` `compute` |
| A13 | Step 0 (data INPS al 30/06) | Conferma indipendente: l'INPS gestione separata segue le **stesse date** dell'imposta (in `deadlines.ts` INPS_BALANCE e TAX_BALANCE usano la stessa data) | Rafforza lo Step 0, che resta comunque da confermare a parte | 🟢 `packages/fiscal-rules/src/deadlines.ts` `buildDeadlines` |

**Proposta strutturale per lo Step 1 di F24_STEP3.** Il file `regoleVersamenti.json` previsto lì diventa il primo blocco del **set di regole per anno** della voce 1, perché gli stessi valori servono anche a bollo, calendario, soglie e rivalsa. Conviene nascere già con la forma giusta: `backend/src/data/regole/2026.json` con valori e `fonti`, e un loader condiviso `regoleFiscaliService.js` al posto del loader dentro `stimaVersamentiService.js`. Costo in più rispetto allo Step 1 attuale: praticamente zero. Evita una migrazione più avanti.

---

## B. Norme e calendario (fondamenta)

### 1. Regole fiscali versionate per anno, con confronto e conferma — FP-021

**In parole semplici.** Aliquote, soglie, codici tributo e scadenze cambiano quasi ogni anno. Oggi alcuni sono scritti dentro il codice (15%/5%, 77,47 € del bollo, date di giugno/novembre), altri li cerca l'AI. Con questa funzione ogni anno ha un suo "pacchetto di regole", ogni valore con la sua fonte. Quando arriva un pacchetto nuovo (aggiornamento dell'app, oppure proposta dal controllo della voce 3), l'app **ti mostra cosa cambia** rispetto a quello in uso e lo applica **solo dopo la tua conferma**.

**Oggi in Timesheet.** 🟢 Valori sparsi: `forfettarioService.js` `aliquotaImposta` (5/15), `configService.js` `fatturazione.sogliaBolloVirtuale`/`importoBollo`, `forfettario.sogliaAnnua`, `scadenzeFiscaliService.js` `scadenzeBaseAnno` (date fisse). Le proroghe arrivano solo dall'AI (cache di un anno).

**Cosa fare.**
- `backend/src/data/regole/<anno>.json`, versionato in git (dati pubblici, nessun segreto, quindi niente `.gitignore`), con le sezioni: `forfettario` (soglie 85k/100k, aliquote, anni ridotti), `acconti`, `scadenze` (inclusa la proroga dell'anno), `rate`, `inpsGestioneSeparata`, `bollo`, `codiciTributo`, `causaliInps`, `fatturaPa` (diciture, nature), e `fonti` (per ogni campo: `url`, `titolo`, `citazione` testuale, `verificatoIl`, `idFonte` della voce 2).
- `backend/src/services/regoleFiscaliService.js`:
  - `regoleAnno(anno)` restituisce la copia **confermata** in `backend/data/regole-attive/<anno>.json` (dato utente, già escluso da git con `backend/data/`). Se l'anno manca: ultimo anno confermato ≤ anno, con `aggiornate: false` e un banner in UI. Nessun ripiego silenzioso;
  - `differenze(anno)` confronta il pacchetto disponibile (nuovo file nel codice, oppure proposta della voce 3) con quello confermato: campi cambiati, valore vecchio e nuovo, fonte vecchia e nuova;
  - `conferma(anno)` copia il pacchetto disponibile in `regole-attive/`.
- UI: sezione "Regole fiscali" in Impostazioni, con l'elenco degli anni e lo stato (confermato / aggiornamento disponibile / proposta). Per ogni campo si vedono valore, fonte e citazione. Il pulsante "Conferma" mostra prima le differenze. Stile: solo variabili CSS esistenti.
- I consumatori passano a `regoleAnno()`: `forfettarioService`, `scadenzeFiscaliService`, poi F24/bollo/fatture man mano che arrivano.
- Test `regoleFiscaliService.test.js`: fallback all'anno precedente; differenze; ogni campo di ogni pacchetto ha una voce in `fonti` (come il test di copertura esterno).

**Riferimento esterno.** `packages/fiscal-rules/src/rule-set.ts` (schema Zod `FiscalRuleSetSchema` + `SourceRefSchema`), `rule-sets/2026.ts` (valori 2026 con fonti), `apps/api/src/fiscal-rules/fiscal-rules.service.ts` (`seedBundled`: carica i set forniti come bozza senza attivarli; `activate`: attivazione solo in avanti; `describe`: valori + fonte + confronto), `packages/fiscal-rules/src/sources.ts` `diffRuleSets`, `ruleFieldPaths`, `refKeyFor`.

**Semplificazione rispetto all'esterno.** Nessuno schema Zod (non è una dipendenza di Timesheet): basta una validazione a mano delle chiavi obbligatorie nel loader, con un test. Nessun database: la "versione attiva" è il file copiato in `backend/data/`.

### 2. Registro delle fonti archiviate, con citazione verificata — FP-019

**In parole semplici.** Accanto a ogni valore l'app conserva la **frase esatta** della legge o della circolare da cui viene, più una copia del testo ufficiale salvata dentro il progetto. Se il sito dell'ente sposta la pagina, la prova resta. Un test automatico controlla che ogni frase citata compaia davvero nel testo salvato: se qualcuno scrive una citazione "a memoria", il test la blocca.

**Oggi in Timesheet.** 🟡 FP-006 prevede solo un link come fonte.

**Cosa fare.**
- `backend/src/data/fonti/registro.json`: `id`, `ente`, `titolo`, `tipo`, `url`, `urlDownload`, `formato`, `selettoreContenuto` (per le pagine HTML), `file`, `consultatoIl`, `sha256`.
- `backend/src/data/fonti/testi/<id>.txt`: **solo il testo estratto**, non il PDF. Motivo: l'archivio esterno pesa 22 MB con i PDF e 3,4 MB con i soli testi, e a Timesheet serve circa la metà delle fonti. L'impronta del PDF originale resta nel registro, così la voce 3 riconosce se il documento è cambiato.
- Testo estratto a mano dallo sviluppatore (`pdftotext`, solo in fase di sviluppo). Nessuna dipendenza in runtime: i binari standalone non devono richiedere poppler.
- Test `fontiNormative.test.js` (`node --test`): ogni `fonti[campo].citazione` del pacchetto regole si trova nel testo archiviato dopo la normalizzazione (accenti, apostrofi, virgolette, a capo, `((…))` di Normattiva). Stessa idea di `sources.test.ts` esterno.
- Primo gruppo di fonti, solo quelle usate davvero da Timesheet: L. 190/2014 art. 1; Circ. INPS 8/2026 e 62/2026; scheda INPS F24 gestione separata; Istr. Redditi PF 2026 fasc. 1 e 3; D.Lgs. 33/2025 art. 10-11 e 72; DPR 435/2001 art. 17; DL 124/2019 art. 58 + Ris. 93/E/2019; DL 89/2026 art. 6; guida AdE bollo FE (giugno 2026); DM 21/5/2009 art. 5; DPR 633/72 art. 7-ter, 7-septies, 21; tabella causali INPS AdE.
- UI: nella pagina "Regole fiscali" (voce 1), un clic su una fonte mostra il brano del testo archiviato con la citazione evidenziata.
- Aggancio a FP-006: la card "Versamenti stimati" di F24_STEP3 (Step 6) mostra la fonte dal pacchetto regole invece di un URL fisso.

**Riferimento esterno.** `docs/fonti/README.md` (struttura della voce, regole per la citazione), `scripts/fonti.mjs` (`download` con whitelist dei domini ufficiali `OFFICIAL_HOSTS`, `selectElement` per ritagliare l'HTML), `packages/fiscal-rules/src/sources.ts` (`normalizeForQuote`, `quoteFragments`, `missingQuoteFragments`), `apps/api/src/sources/sources.service.ts` `excerpts`.

### 3. Controllo periodico delle fonti ufficiali, con proposta e conferma — FP-022

**In parole semplici.** Una volta a settimana (più spesso nei periodi caldi: dicembre-febbraio per la circolare INPS, maggio-luglio per le proroghe) l'app ricontrolla i documenti ufficiali del registro. Se uno è cambiato te lo segnala. Se hai un'AI configurata, questa legge **solo le parti cambiate** e propone i nuovi valori, ognuno con la frase esatta del documento. L'app controlla da sola che la frase esista davvero nel testo: se non c'è, la proposta viene scartata. Niente cambia finché non guardi le differenze e confermi (voce 1).

**Oggi in Timesheet.** 🟢 `scadenzeFiscaliService.js` interroga Gemini/Claude con ricerca web, una volta l'anno, per proroghe e minimale INPS. Non conserva la fonte (FP-006) e non verifica la citazione.

**Cosa fare.**
- `monitoraggioFontiService.js` con lo stesso schema `setInterval` di `backupService.js`/`sdiRicevuteService.js`/`reminderService.js` (regola del progetto: non reinventarlo):
  - per ogni fonte del registro scarica **solo da domini ufficiali** (whitelist: `agenziaentrate.gov.it`, `normattiva.it`, `gazzettaufficiale.it`, `inps.it`, `adm.gov.it`, `fatturapa.gov.it`, `agid.gov.it`) e calcola `sha256`. Per l'HTML usa il testo ritagliato con `selettoreContenuto`, così un menu cambiato non fa scattare un falso allarme; per PDF/XLS i byte del file;
  - impronta diversa ⇒ scrive `backend/data/fonti-cambiate.json` (`id`, `rilevatoIl`, impronta vecchia e nuova) e mostra un avviso in dashboard;
  - con un'AI configurata (provider esistenti in `envService.js`, e flag di FP-010 se implementata) invia **il documento nuovo** (Gemini e Claude accettano i PDF direttamente, quindi niente `pdftotext` in runtime) insieme all'elenco dei campi che citano quella fonte. Risposta JSON `{campo, valoreProposto, citazione}`;
  - **controllo anti-allucinazione**: una proposta la cui `citazione` non si trova nel testo del documento nuovo viene scartata e segnalata come "non verificata";
  - le proposte valide finiscono in `backend/data/regole-proposte/<anno>.json` e la UI della voce 1 le mostra come qualsiasi altro aggiornamento: differenze, poi conferma.
- **Mai attivazione automatica**, nemmeno con confidenza alta. Tutto quello che arriva dal web è un dato, non un'istruzione (prompt injection).
- Il pulsante "Controlla ora" in "Regole fiscali" esegue lo stesso giro a mano.
- La ricerca AI annuale delle proroghe già esistente resta, ma produce una **proposta** con citazione invece di un dato mostrato come certo. Risolve anche FP-006.
- Promemoria fisso indipendente dai cambiamenti rilevati (gennaio, aprile, giugno, novembre): "controlla se ci sono novità per l'anno". Riusa `reminderService.js`.
- Limite noto: un **nuovo** atto (una proroga uscita in Gazzetta) non è nel registro, quindi il controllo per impronta non lo vede. Lo copre la ricerca AI con proposta. 🟡 Da documentare in UI.

**Riferimento esterno.** `docs/monitoraggio-normativo.md` (design completo: fonti da monitorare con il metodo per ciascuna, pipeline in 8 passi, regole di sicurezza, calendario dei promemoria), `scripts/fonti.mjs check` (controllo manuale per impronta, già funzionante). Il job periodico e le proposte **non sono implementati** nemmeno lì (`TODO.md`, "Monitoraggio normativo"): per questa parte Timesheet sarebbe più avanti.

### 4. Calendario fiscale: festività e slittamenti di legge — FP-026

**In parole semplici.** Le scadenze che cadono di sabato, domenica o festivo slittano al primo giorno lavorativo. Il 4 ottobre è festa nazionale dal 2026 e l'app non lo sa ancora. Inoltre le scadenze dall'1 al 20 agosto slittano per legge al 20 agosto. Oggi nessuna delle scadenze mostrate cade in quei giorni, quindi l'impatto attuale è nullo. Diventa concreto con le rate mensili (16 agosto) e con il bollo.

**Oggi in Timesheet.** 🟢 `scadenzeFiscaliService.js` `FESTIVITA_FISSE` non contiene il 4 ottobre. `primoGiornoLavorativo` non applica lo slittamento di agosto.

**Cosa fare.** ⚠️ È una correzione di un bug trovato durante questa analisi, fuori scope: **va confermata a parte** con AskUserQuestion prima di toccare il codice (regola "conferma fix side-effect").
- Aggiungere `[10, 4]` dal 2026 (L. 151/2025), con controllo sull'anno: prima del 2026 non era festa.
- `slittamentoAgosto(data)`: dall'1 al 20 agosto ⇒ 20 agosto (D.Lgs. 33/2025 art. 11), applicato alle rate e al bollo.
- Test in `scadenzeFiscaliService.test.js`: 4/10/2026 non lavorativo e 4/10/2025 lavorativo; 16/08 ⇒ 20/08.

**Riferimento esterno.** `packages/fiscal-rules/src/calendar.ts` `italianPublicHolidays` (4 ottobre con anno di inizio), `installment-plan.ts` `applyAugustDeferral`.

### 5. Requisiti aliquota 5% e ripartizione acconti — FP-027

**In parole semplici.** Oggi l'app dà l'aliquota del 5% per i primi 5 anni a chiunque inserisca la data di inizio attività. La legge la concede solo a chi rispetta alcuni requisiti: per esempio, nessuna attività d'impresa o professionale nei 3 anni prima, e l'attività non deve proseguire un lavoro dipendente precedente. Una spunta "ho i requisiti per il 5%" evita un'imposta stimata a un terzo di quella vera. Nello stesso punto, la spunta "attività con ISA" decide se gli acconti sono 50/50 o 40/60.

**Oggi in Timesheet.** 🟢 `forfettarioService.js` `aliquotaImposta(dataInizioAttivita, anno)` controlla solo gli anni. F24_STEP3 dà il 50/50 per scontato.

**Cosa fare.** `config.forfettario.requisitiAliquotaRidotta` (default `false`: la scelta prudente è il 15%) e `config.forfettario.soggettoIsa` (default `true`, il caso tipico del forfettario, Ris. 93/E/2019). Due checkbox in `StepFornitore.vue`, pannello "Regime forfettario", con una spiegazione breve e il link alla fonte. `aliquotaImposta` riceve il flag. Test di `forfettarioService.test.js` aggiornato.

⚠️ **Cambia i numeri in dashboard** per chi ha una data di inizio recente: di default si passa dal 5% al 15% finché non spunti i requisiti. È una correzione (si stimava un'imposta più bassa del reale), ma va scritta nel CHANGELOG e va chiesta conferma prima, come la voce 4.

**Riferimento esterno.** `apps/api/prisma/schema.prisma` `TenantProfile.reducedRate`, `isaSubject`; `tax-computation.ts` `reducedRateApplies`, `substituteTaxAdvance`.

---

## C. F24

### 6. Piano F24: saldo, acconti, rate, interessi — FP-015

**Pianificato in dettaglio in [F24_STEP3_SVILUPPO_STIMA.md](F24_STEP3_SVILUPPO_STIMA.md)**, Step 0-8. Qui solo le integrazioni: sezione A, più il fatto che l'output dello Step 5 (`scadenze[].righe[]` con `sezione`, `codice`, `annoRiferimento`, `importo`) sia **esattamente** l'input della voce 7. Conviene aggiungere a ogni riga fin dallo Step 5: `rateazione` (`0101` unica soluzione, `NNRR` rata N di R, vuoto per 1791/1668), `codiceSede` e `periodoDa`/`periodoA` (`MM/AAAA`) per l'INPS, `maggiorazione` (quota del differimento, per A5).

**Riferimento esterno.** `packages/fiscal-rules/src/f24-schedule.ts` `buildPaymentSchedule` (righe per rata, interessi raggruppati per anno di riferimento, secondo acconto separato, avvisi sotto 1,03 €), `F24LineDraft` (campi della riga).

### 7. Stesura F24 sul modello ufficiale AdE (PDF) — FP-023

**In parole semplici.** Oggi l'app (con F24_STEP3) ti dirà *quanto* pagare. Con questa voce ti prepara **il modulo F24 già compilato**, sul modello ufficiale dell'Agenzia delle Entrate. Lo scarichi in PDF: lo porti in banca o in posta, oppure lo usi come guida per ricopiare i dati nell'home banking o in F24 web. Dentro ci sono i tuoi dati anagrafici, le righe Erario (imposta sostitutiva) e INPS con codici, anni e importi, i totali e il saldo finale.

**Oggi in Timesheet.** 🟢 Niente. F24_STEP3 esclude esplicitamente PDF e file F24 ("Esplicitamente escluso"): questa voce è la fase successiva, richiesta ora.

**Cosa fare.**
- **Dati anagrafici mancanti** per l'intestazione F24 (`config.fornitore` ha `denominazione` e `codiceFiscale`, non il resto): `cognome`, `nome`, `dataNascita`, `sesso`, `comuneNascita`, `provinciaNascita`, più il domicilio fiscale (già presente: `indirizzo`, `comune`, `provincia`). Campi opzionali in `StepFornitore.vue`: se mancano, l'intestazione resta vuota da compilare a mano, come fa l'esterno.
- **Codice sede INPS** (4 cifre, la sede della tua residenza): obbligatorio nella sezione INPS. Campo `config.forfettario.codiceSedeInps` con un link alla tabella ufficiale INPS. 🟡 Scelta lazy: campo a mano più link, niente elenco completo delle sedi da mantenere. L'esterno ne ha uno (`inps-offices.ts`, circa 220 righe), da non copiare (vedi il vincolo di licenza).
- `backend/src/services/f24PdfService.js`:
  - il modello PDF **non si ridistribuisce**: si scarica dal sito AdE al primo uso in `backend/data/modelli/f24-ordinario.pdf` (dato locale, già escluso da git) e si controlla il suo `sha256`. Se l'AdE pubblica una nuova edizione, l'impronta non coincide: stampa bloccata con il messaggio "nuovo modello, coordinate da ricalibrare", invece di un F24 con i numeri nelle caselle sbagliate;
  - scrittura dei valori alle coordinate delle caselle: fino a 6 righe Erario, 4 INPS, 4 Regioni, 4 tributi locali; totali per sezione; saldo finale; data. Importi con la parte intera allineata a destra prima della virgola stampata e 2 decimali dopo ("Gli importi devono sempre essere indicati con le prime due cifre decimali", AdE, Avvertenze per la compilazione);
  - **coordinate misurate da noi** sul PDF AdE (`pdftotext -bbox` in fase di sviluppo), in una tabella costante documentata nel file;
  - più righe di quelle disponibili in una sezione ⇒ errore esplicito, mai troncamento silenzioso.
- **Nuova dipendenza backend: `pdf-lib`**. Motivazione (regola "no new dependencies"): scrivere su un PDF **esistente** non si fa con la stdlib né con `html2pdf.js` (nel frontend, genera PDF da HTML e non modifica un PDF dato). `pdf-lib` è JS puro, senza dipendenze native, compatibile con i binari standalone. Alternativa scartata: ricostruire il modulo in HTML. Più lavoro e un modulo non ufficiale.
- Route `GET /api/f24/:id/pdf` (sottile, logica nel service), pulsante "Scarica F24" su ogni scadenza della card "Versamenti stimati" (F24_STEP3 Step 6).
- Test `f24PdfService.test.js`: formattazione degli importi (parte intera e decimali), righe oltre il limite ⇒ errore, impronta diversa ⇒ errore. Il PDF prodotto si controlla **a occhio una volta** con un F24 reale già pagato.
- Avviso in UI: "F24 precompilato da verificare: non è consulenza fiscale".

**Riferimento esterno.** `apps/api/src/f24/services/f24-pdf.service.ts` (modello scaricato e verificato con `F24_MODEL_URL` + `F24_MODEL_SHA256`, struttura di `LAYOUT` per sezioni, righe distanti 12 pt, caselle a due celle per i centesimi, `totals`), `apps/api/src/f24/controllers/f24.controller.ts` (`GET :id/pdf`).

### 8. Stato degli F24 e versamenti registrati in automatico — FP-024

**In parole semplici.** Ogni F24 preparato ha uno stato: **da pagare** → **programmato** (hai impostato l'addebito a una data futura dall'home banking o da F24 web) → **pagato**, oppure **annullato**. Quando lo segni pagato, le sue righe finiscono da sole tra i versamenti, già con il codice tributo giusto. Così non c'è più niente da ricopiare, e il calcolo di saldo e acconti dell'anno dopo (F24_STEP3) usa numeri esatti. Per un F24 programmato l'app ti ricorda anche l'**ultimo giorno utile per annullarlo** (3 giorni lavorativi prima dell'addebito).

**Oggi in Timesheet.** 🟢 `versamentiF24Service.js`: versamenti inseriti a mano o importati dal testo del Cassetto Fiscale (senza codice tributo). F24_STEP3 Step 3 aggiunge un `codice` opzionale inserito a mano, con un ripiego sulla stima quando manca.

**Cosa fare.**
- `backend/data/f24.json` (tramite `jsonStore`, già escluso da git): `{ id, tipo, dataPagamento, stato, rata, righe[], annullabileEntro, pagatoIl }`.
- Al passaggio a `pagato`: per ogni riga si crea un record in `f24Versamenti.json` con `codice`, `annoRiferimento`, `maggiorazione`, `origine: f24Id`. Tornare indietro da `pagato` ⇒ i record con quell'`origine` si cancellano. Idempotente.
- `accontiImpostaVersati`/`contributiInpsVersati` (F24_STEP3 Step 3) leggono questi record: il ripiego "acconti non registrati, usata la stima" scatta solo per gli anni precedenti all'uso della funzione.
- Import dal Cassetto Fiscale: se un versamento importato ha la stessa data e lo stesso totale di un F24 `pagato`, viene riconosciuto come lo stesso e non duplicato (upsert già esistente su data+importo).
- `annullabileEntro` = 3 giorni lavorativi prima di `dataPagamento`, con il calendario della voce 4. Test sul calcolo.

**Riferimento esterno.** `apps/api/prisma/schema.prisma` `enum F24Status` (`PLANNED`, `SCHEDULED_I24`, `PAID`, `CANCELLED`), `F24.i24CancelBy`, `F24Line.surchargeAmount`; `f24-schedule.ts` `i24CancelBy` (Provv. AdE 313945/2024 §5.3); `apps/api/src/taxes/services/taxes.service.ts` `paidFromF24` (versati = F24 pagati + rettifiche manuali).

### 9. Compensazione crediti nell'F24 — FP-016

**In parole semplici.** Se hai un credito verso il fisco (per esempio IRPEF di un anno in cui avevi un altro lavoro, o un saldo pagato in eccesso), puoi usarlo per pagare meno nell'F24. L'app tiene l'elenco dei crediti con il residuo e li usa per coprire i debiti. Se il credito copre tutto, prepara l'F24 **a saldo zero** (che va presentato comunque, solo per via telematica). Ti avvisa se superi **5.000 € in un anno** per lo stesso credito: sopra quella soglia serve il visto di conformità del commercialista e il credito si può usare solo dal decimo giorno dopo la dichiarazione.

**Oggi in Timesheet.** 🟢 Niente. F24_STEP3 Step 5 mette un saldo a credito in `crediti[]` "senza logica di compensazione".

**Cosa fare.**
- `backend/data/crediti.json`: `{ id, sezione, codice, annoRiferimento, importo, utilizzabileDal, descrizione }`. Il residuo si calcola dagli utilizzi nelle righe F24, non si salva.
- Un credito già usato in un F24 non si modifica né si cancella: le righe non tornerebbero più.
- Compensazione come funzione pura in `f24Service.js`: ordine dei debiti a scelta (INPS prima o imposta prima: la norma non fissa un ordine), F24 a saldo zero + residuo da pagare o rateizzare.
- Limite dei 5.000 €: conta solo la compensazione **orizzontale** (tributi diversi) e non i crediti INPS. Quella **verticale** (stesso tributo, per esempio 1792 su 1790/1791/1792) non conta (Ris. AdE 110/E/2019).
- La maggiorazione del differimento si applica solo alla differenza tra debiti e crediti, se positiva: niente maggiorazione sui debiti compensati.
- Utilizzi "esterni" (credito usato dal commercialista in un altro F24): registrazione a mano, contano nel limite. L'esterno non l'ha ancora fatto (`TODO.md`).
- Test su: copertura totale e parziale, soglia 5.000 con il verticale escluso, credito non ancora utilizzabile escluso.

**Riferimento esterno.** `f24-schedule.ts` `buildCompensation` (commenti con le fonti: istruzioni F24 "Compensazione e rateazione", Redditi PF fasc. 1 §8), `packages/fiscal-rules/src/compensation-limits.ts` (`COMPENSATION_LIMIT`, `VERTICAL_COMPENSATION`, `horizontalUses`, `creditsAboveLimit`), `apps/api/src/tax-credits/services/tax-credits.service.ts` (`available` con il filtro `usableFrom`, blocco di modifica e cancellazione se usato).

### 10. Imposta di bollo trimestrale: scadenze e F24 — FP-025

**In parole semplici.** Sulle fatture sopra 77,47 € l'app aggiunge già il bollo da 2 €, ma poi non ti ricorda di **pagarlo**: va versato ogni trimestre. Questa voce calcola quanto hai accumulato per trimestre, mette le scadenze nel calendario e prepara l'F24 del bollo. Per importi piccoli la legge permette di pagare più trimestri insieme: primo trimestre fino a 5.000 € ⇒ insieme al secondo; primo + secondo fino a 5.000 € ⇒ insieme al terzo. L'app applica questi rinvii da sola.

**Oggi in Timesheet.** 🟢 `fatturaPaXmlGenerator.js:36-40` scrive `DatiBollo`, `configService.js` ha soglia e importo. `scadenzeBaseAnno` non ha le scadenze del bollo.

**Cosa fare.**
- Valori e scadenze nel pacchetto regole (voce 1): 31/5 (1° trim., codice 2521), 30/9 (2°, 2522), 30/11 (3°, 2523), 28/2 dell'anno dopo (4°, 2524); soglia di rinvio 5.000 €.
- `bolloPerTrimestre(anno)` somma `bollo` delle fatture con `bolloApplicabile` per trimestre. 🟡 Base: data della fattura. La guida AdE parla della data di **consegna** SDI: nella prima versione si segna "stima", poi si passa alla data della ricevuta RC che `sdiRicevuteService` conosce già. Fatture scartate escluse.
- Scadenze del bollo in `scadenzeBaseAnno`, con importo e rinvio.
- F24 del bollo con il motore della voce 7: una riga Erario, codice del trimestre, anno. L'esterno non l'ha ancora fatto (`TODO.md`, "F24 per il bollo trimestrale"), ma con il motore già pronto costa poco.
- Test: i tre casi di rinvio; fatture sotto soglia escluse.

**Riferimento esterno.** `packages/fiscal-rules/src/deadlines.ts` `buildDeadlines` (blocco `stampDeadlines`, note (*) e (**) della guida AdE sul rinvio), `apps/api/src/fiscal-rules/fiscal-rules.service.ts` `stampDutyByQuarter`, `schema.prisma` `StampDutyPeriod`.

---

## D. Fatture

### 11. Avviso soglia prima di emettere e limite personale — FP-028

**In parole semplici.** Prima di emettere una fattura l'app fa il conto: incassato dell'anno + fatture emesse e non ancora incassate + questa fattura. Se arrivi all'80% di 85.000 o 100.000 € ti avvisa. Sopra 100.000 € ti chiede una **conferma esplicita**: se quegli importi li incassi nell'anno, il forfettario finisce subito e l'IVA è dovuta già da quella fattura. Puoi anche fissare un **tuo limite** (per esempio 80.000 €, per stare tranquillo): superarlo richiede conferma.

**Oggi in Timesheet.** 🟢 La soglia si vede solo in dashboard (`forfettarioService.js`, `percentualeSoglia`, proiezione). `FatturaView.vue` non controlla nulla all'emissione. FP-002 copre la distinzione 85k/100k in dashboard.

**Cosa fare.**
- Funzione pura `previsioneSoglia({ incassato, daIncassare, importoFattura, limitePersonale }, regole)` ⇒ livello `ok/vicino/oltre` per ogni soglia, più `oltreUscita` e `oltreLimitePersonale`. "Vicino" all'80% è una scelta dell'app, non un valore di legge: va detto in UI.
- `config.forfettario.limitePersonale` (vuoto = nessun limite).
- In `invoiceRoutes.js` (generazione XML/invio) un 409 con il messaggio. Il frontend mostra la conferma e rimanda con `confermaSoglia: true`, riusando il pattern errori delle route.
- Si fa **insieme a FP-002**: stessa funzione, stesso test.

**Riferimento esterno.** `tax-computation.ts` `thresholdOutlook`, `THRESHOLD_NEAR_PCT`; `apps/api/src/invoices/services/invoices.service.ts:216-238` (messaggi e conferma); `schema.prisma` `TenantProfile.revenueLimit`.

### 12. Blocco della data fattura nel futuro — FP-029

**In parole semplici.** Una fattura con data futura verrebbe scartata dallo SDI (errore 00403). L'app te lo dice subito, prima dell'invio.

**Oggi in Timesheet.** 🟢 Nessun controllo (`fatturaPaXmlValidator.js`, `invoiceService.js`).

**Cosa fare.** Controllo in `fatturaPaXmlValidator.js` (è già il punto delle verifiche pre-invio): `data > oggi` (fuso Europe/Rome) ⇒ errore con il suggerimento del codice 00403, riusando `scartoSuggerimenti.js`. Vale anche per l'import XML. Un test.

**Riferimento esterno.** `invoices.service.ts:31, 232`.

### 13. Dati di pagamento in fattura — FP-030

**In parole semplici.** Nella fattura elettronica compaiono **come** pagarti (bonifico, carta, contanti, addebito SEPA…), il tuo **IBAN** e **entro quando**. Il cliente lo trova nel suo gestionale senza doverlo chiedere, e per te è più facile riconciliare gli incassi.

**Oggi in Timesheet.** 🟢 `fatturaPaXmlGenerator.js` non scrive il blocco `DatiPagamento`. Non esiste un campo IBAN.

**Cosa fare.**
- (Implementato come campi di `config.fatturazione`, non sezione `config.pagamento`: evita un nuovo step UI; blocco `pagamento` congelato nella fattura alla generazione; BTC = modalità aggiuntiva senza codice FatturaPA (niente `DatiPagamento`, vale la Causale BTC); riquadro pagamento + QR nel PDF di tutti i 5 template fattura.) `config.pagamento`: `iban`, `intestatario`, `istitutoFinanziario` (facoltativo), `modalitaDefault` (`MP05`), `giorniScadenzaDefault` (es. 30). Sovrascrivibili per cliente (`CLIENTE_VUOTO`: `modalitaPagamento`, `giorniScadenza`). L'IBAN non è un segreto come la password PEC, ma è un dato personale: resta in `config.json`, già escluso da git (regola dati sensibili rispettata senza nuovi file).
- XML: `DatiPagamento` → `CondizioniPagamento` `TP02` (pagamento completo), `DettaglioPagamento` con `ModalitaPagamento`, `DataScadenzaPagamento`, `ImportoPagamento`, e `IBAN` solo per le modalità che lo usano (bonifico, SEPA). Validazione IBAN (lunghezza per paese + controllo mod-97, poche righe di stdlib).
- Anteprima fattura e template PDF: stessi dati.
- Fatture senza configurazione ⇒ XML identico a oggi (retrocompatibile, come per FP-011).
- Test in `fatturaPaXmlGenerator.test.js`: con/senza IBAN, contanti senza IBAN, IBAN non valido rifiutato.

**Implementato (2026-09-30), scostamenti dal piano.**
- 🟢 Campi in `config.fatturazione` (non `config.pagamento`); override per cliente `modalitaPagamento`/`giorniScadenza`. Un solo IBAN (risolve la domanda aperta 2).
- 🟢 Blocco `pagamento` congelato nella fattura alla generazione (`backend/src/lib/pagamento.js`), come la clausola BTC. IBAN validato mod-97 (`backend/src/lib/iban.js`), in Impostazioni e prima dell'invio.
- 🟢 **Bitcoin come modalità**: FatturaPA non ha un codice per BTC, quindi niente `DatiPagamento` in XML (vale la Causale BTC, che imposta da sola `pagamentoBtc`). L'indirizzo è il primo di `config.walletBtc`.
- 🟢 **PDF**: riquadro «Dati per il pagamento» (IBAN e/o indirizzo BTC, modalità, scadenza) in fondo, prima del piè pagina, in tutti e 5 i template fattura, con mini QR dipendente dalla modalità: EPC QR per bonifico/SEPA, URI `bitcoin:` per BTC. La Causale BTC, prima presente solo in `fattura-default`, è ora in tutti i template.
- 🟢 Nuova dipendenza frontend `qrcode-generator` (QR non realizzabile con la stdlib).
- 🟡 Solo contanti/assegno senza IBAN: nessun blocco pagamento (la condizione è IBAN o indirizzo BTC). Screenshot PDF reale ancora da fare.

**Riferimento esterno.** `packages/fatturapa/src/payment-methods.ts` (codici MP01-MP23 dalle specifiche 1.9.1), `packages/fatturapa/src/builder.ts:202-209`, `schema.prisma` `BankAccount`, `PaymentTerms` (profili "30 giorni bonifico"). 🟡 Semplificazione: un solo conto in config invece di una tabella di conti. Più conti solo se servono davvero.

### 14. Rivalsa INPS 4% facoltativa — FP-031

**In parole semplici.** Chi è iscritto alla gestione separata INPS **può** aggiungere in fattura un 4% di rivalsa, che paga il cliente. Non è obbligatoria e di solito si concorda col cliente. Se la attivi, quel 4% **conta come ricavo**: aumenta fatturato, soglia e imposta. In fattura elettronica ha un blocco dedicato.

**Oggi in Timesheet.** 🟢 Scelta esplicita di non gestirla: `fatturaPaXmlGenerator.js:6` "Nessuna rivalsa INPS", `FatturaView.vue:405` "Rivalsa INPS: assente".

**Cosa fare.**
- Flag `config.forfettario.rivalsaInps` (default `false`) e override per cliente. Percentuale dal pacchetto regole (4%).
- XML: `DatiCassaPrevidenziale` con `TipoCassa` `TC22` (INPS), `AlCassa` 4.00, `ImportoContributoCassa`, `ImponibileCassa`, `AliquotaIVA` 0.00 e `Natura` come le righe (N2.2 o N2.1, voce 15). Totale documento = imponibile + rivalsa (+ bollo solo se esposto).
- 🟡 Da verificare prima di scrivere: se la rivalsa entra nella base dei 77,47 € del bollo. L'esterno lo segna "da verificare" (`TODO.md`, punto 13).
- `invoice.imponibile` resta il compenso; nuovo campo `rivalsaInps`. `forfettarioService` somma la rivalsa ai ricavi (L. 662/96 art. 1 c. 212: è compenso a tutti gli effetti).
- Fatture esistenti e clienti senza flag ⇒ XML identico (retrocompatibile).
- Test: calcolo, XML con e senza, ricavi dashboard con rivalsa.

**Riferimento esterno.** `invoices.service.ts:28, 118-126` (`applyInpsSurcharge`, `inpsSurcharge`), `builder.ts:159` (`DatiCassaPrevidenziale`), `rule-sets/2026.ts` `inps.surchargePct`, `eInvoice.inpsFundType: 'TC22'`.

### 15. Clienti esteri: Natura IVA, diciture, Intrastat — FP-018

**In parole semplici.** Se fatturi a un cliente fuori Italia, cambiano le regole di legge sulla fattura: codice destinatario `XXXXXXX`, CAP `00000`, paese del cliente, **Natura IVA** e una **dicitura obbligatoria**. A un'azienda UE si scrive "inversione contabile", e c'è anche l'elenco Intrastat trimestrale da presentare. A un'azienda extra-UE si scrive "operazione non soggetta". Ai privati si fattura di solito come a un cliente italiano, tranne alcuni servizi (consulenza, elaborazione dati) verso privati extra-UE. In più, per le aziende estere c'è tempo fino al **15 del mese dopo** per emettere, e senza iscrizione al VIES non si fattura correttamente a un'azienda UE.

**Oggi in Timesheet.** 🟢 `fatturaPaXmlGenerator.js:56-129`: `IdPaese` e `Nazione` fissi a `IT`, `Natura` fissa a `N2.2`. Il cliente non ha un campo paese.

**Cosa fare.**
- `CLIENTE_VUOTO`: `paese` (ISO, default `IT`), `tipo` (`azienda`/`privato`), `servizi7Septies` (checkbox con spiegazione). Elenco dei paesi UE con UK e Irlanda del Nord esclusi per i servizi (UK extra-UE dal 2021; per i servizi XI non è UE).
- `trattamentoCliente(cliente, regole)`, funzione pura ⇒ `{ estero, natura, dicitura, riferimentoNormativo, intrastat }`: UE azienda ⇒ N2.1 + "inversione contabile" + Intrastat; extra-UE azienda ⇒ N2.1 + "operazione non soggetta"; privato UE ⇒ N2.2; privato extra-UE ⇒ N2.1 solo con `servizi7Septies`, altrimenti N2.2.
- XML: `IdPaese`/`Nazione` del cliente, `CodiceDestinatario` `XXXXXXX`, `CAP` `00000`, niente `Provincia`, `RiferimentoNormativo` e dicitura in `Causale`. Per le aziende UE, `AltriDatiGestionali` "INVCONT" su ogni riga (guida AdE alla compilazione).
- `config.fornitore.iscrittoVies` + avviso (non blocco) in bozza per azienda UE senza VIES.
- Scadenzario: Intrastat servizi resi trimestrale (25 del mese dopo il trimestre) **solo** se ci sono fatture ad aziende UE nell'anno.
- Fuori scope, come nell'esterno: servizi elettronici a privati UE (art. 7-octies, OSS). 🔴 Da verificare se mai servisse.
- Test: tutte le combinazioni tipo × paese.

**Riferimento esterno.** `packages/fiscal-rules/src/customer-treatment.ts` `customerTreatment` (switch con le fonti art. 7-ter/7-septies/21 c. 6-bis), `packages/fiscal-rules/src/eu.ts` `EU_MEMBER_STATES` (con la nota su GB/XI), `deadlines.ts` (blocco `quarterlyIntrastat`), `fiscal-rules.service.ts` `deadlines` (Intrastat solo con VIES o fatture UE).

### 16. Fatture e incassi in valuta, cambio Banca d'Italia — FP-020

**In parole semplici.** Se un cliente estero vuole la fattura in dollari (o altra valuta), la fattura riporta la valuta e il **cambio**, che per legge va indicato. Quando incassi, conta il cambio **del giorno dell'incasso** per calcolare reddito e soglia. L'app prende il cambio ufficiale della Banca d'Italia da sola. Se quel giorno non c'è quotazione (weekend, festivi) usa quella del giorno lavorativo precedente, come prevede la norma. Resta sempre possibile inserirlo a mano.

**Oggi in Timesheet.** 🟢 `Divisa` fissa a `EUR` (`fatturaPaXmlGenerator.js:108`): le fatture in altre valute non si possono fare. Per gli incassi **in BTC** (FP-011) esiste già tutto lo schema da riusare. In `FatturaView.vue:203-248` il pulsante "leggi da blockchain" recupera da mempool.space i dati della transazione, dal **TXID** oppure, senza TXID, dall'ultima ricevuta sull'**indirizzo di destinazione** (`api.js:157-166`). Il pulsante "recupera cambio" prende il **cambio storico EUR/BTC da CoinGecko** alla data del pagamento (`api.js:167-174`). Il valore resta modificabile a mano (prevale il criterio concordato col cliente), con una nota privacy su cosa viene inviato al servizio esterno. Manca lo stesso per le valute tradizionali (USD, GBP, CHF…), dove per legge il riferimento è il cambio ufficiale della Banca d'Italia/BCE.

**Cosa fare.** Stesso schema dei pulsanti BTC: pulsante "Recupera cambio", valore sempre modificabile, fonte e data salvate accanto, nota privacy.
- `cambiValutaService.js`: chiamata REST alla Banca d'Italia (endpoint `dailyRates`, convenzione "quantità di valuta per 1 euro"), tutte le valute del giorno scaricate **una sola volta** in `backend/data/cambi/<data>.json` (dato pubblico, ma nella cartella dati già esclusa da git). Ripiego fino a 7 giorni indietro. Niente data futura. Senza rete ⇒ "inserisci il cambio a mano". 🟡 Chiamata dal **backend**, non dal browser come per CoinGecko/mempool: non è verificato che l'API della Banca d'Italia permetta chiamate dirette dal browser (CORS), e dal backend la cache su disco funziona comunque.
- Fattura: `valuta` + `cambio` (+ fonte e data della quotazione). XML con `Divisa` e gli importi nella valuta. Controvalore in euro nella causale. 🟡 Bollo nelle fatture in valuta (soglia sul controvalore) da verificare, come nell'esterno.
- Rata: `importo` resta **sempre in EUR**, calcolato al cambio del giorno dell'incasso, con `valuta: { codice, importoValuta, cambio, fonte, dataQuotazione }` accanto. Stesso schema del campo `btc` di FP-011: dashboard, soglia e export non cambiano.
- Test con `fetch` finto: ripiego nel weekend, cache, errore di rete.

**Riferimento esterno.** `apps/api/src/exchange-rates/exchange-rates.service.ts` (`EXCHANGE_RATES_URL`, `rate`, `ensureDay`, `MAX_LOOKBACK_DAYS`, filtro `exchangeConventionCode === 'C'`; fonti: DPR 633/72 art. 13 c. 4, TUIR art. 9 c. 2).

### 17. Import di archivi ZIP (fatture + ricevute SDI) — FP-017

**In parole semplici.** Dal portale Fatture e Corrispettivi scarichi un unico ZIP con fatture e ricevute SDI mescolate. Lo carichi così com'è: l'app riconosce ogni file dal contenuto (fattura? ricevuta di consegna? scarto?), ti mostra un'anteprima di cosa importerà e poi importa solo quello che scegli. Le ricevute si agganciano da sole alla fattura giusta (dal nome del file).

**Oggi in Timesheet.** 🟢 `xmlInvoiceImporter.js` importa un XML di fattura alla volta. Le ricevute arrivano solo via PEC (`sdiRicevuteService.js`).

**Cosa fare.**
- Apertura dello ZIP: 🟡 nessuna libreria ZIP tra le dipendenze attuali. `xlsx` (SheetJS) ne contiene una interna non pensata per l'uso esterno. Verificare prima se basta `zlib` della stdlib, che però non legge l'indice ZIP da solo (sono circa 60 righe per leggere la central directory). In alternativa una dipendenza piccola. Decisione da prendere al passaggio in analisi, nel rispetto della regola "no new dependencies".
- **Limiti contro gli zip bomb**: 5 MB per file (limite SDI), 2.000 file, 200 MB estratti in totale.
- Riconoscimento dall'elemento radice: `FatturaElettronica` ⇒ `xmlInvoiceImporter`; `RicevutaConsegna`/`NotificaScarto`/`NotificaMancataConsegna` ⇒ salvataggio nell'archivio ricevute con lo stesso formato di `sdiRicevuteService` (così stato SDI e badge funzionano); altro ⇒ "ignorato" con il motivo.
- Anteprima (`POST /api/import/anteprima`) e import dei soli file scelti. Stesso nome file ⇒ niente doppioni.
- Test sugli esempi ufficiali di ricevute RC/NS/MC (da fatturapa.gov.it, da scaricare noi).

**Riferimento esterno.** `apps/api/src/common/import/archive-reader.ts` (limiti), `apps/api/src/imports/services/document-import.service.ts` (`preview`, `importFiles`, un gestore per tipo), `packages/fatturapa/src/xml-document-kind.ts`, `apps/api/src/sdi/services/sdi-receipts-import.service.ts`.

---

## E. PEC e SDI

### 18. PEC guidata: gestori preconfigurati, prova passo-passo, PEC di prova allo SDI — FP-032

**In parole semplici.** Tre aiuti per configurare la PEC senza errori:
1. **Gestori già pronti**: scegli Aruba, Poste, Postel, InfoCert… e inserisci solo indirizzo e password. I server si compilano da soli. Accanto compare un avviso quando serve una password apposita: con Aruba, se hai la verifica in due passaggi, la password della webmail non funziona nei programmi di posta. Ne serve una generata a parte, che scade dopo 6 mesi.
2. **Prova passo-passo**: un pulsante controlla quattro passi (collegamento invio, accesso invio, collegamento ricezione, accesso ricezione) e ti mostra quale fallisce e perché, **senza inviare nulla**.
3. **PEC di prova allo SDI**: manda allo SDI una PEC **vuota**, senza fattura. Lo SDI risponde con un "messaggio di cortesia": così sai che il canale funziona senza rischiare un invio vero, visto che per chi usa la PEC non esiste un ambiente di prova.

**Oggi in Timesheet.** 🟢 `StepPec.vue` con host e porte a mano. Nessuna prova di connessione (nessun `verify` in `pecService.js`). Ricevute via `sdiRicevuteService.js` (IMAP, `imapflow`).

**Cosa fare.**
- `backend/src/data/gestoriPec.json` (versionato): `id`, `nome`, `smtpHost`, `imapHost`, porte (465/993, TLS implicito), `suggerimentoPassword`, `guidaUrl`, `fonteUrl`, `verificatoIl`. **Parametri riletti da noi** sulle pagine ufficiali dei gestori (vincolo di licenza), più "Altro gestore" con inserimento a mano. `StepPec.vue`: select che precompila i campi, che restano modificabili.
- `POST /api/pec/prova`: `nodemailer.verify()` (connessione + login SMTP) e `ImapFlow.connect()`/`logout()`, un passo alla volta, con un messaggio in italiano per gli errori tipici (autenticazione, timeout, certificato). Risposta con i 4 passi e l'esito. Nessuno streaming: bastano 4 esiti in una risposta (l'esterno usa uno stream, qui non serve).
- `POST /api/pec/prova-sdi`: invio **con conferma esplicita** di una PEC senza allegato a `sdi01@pec.fatturapa.it` (o all'indirizzo SDI assegnato), oggetto "Prova del canale PEC". Le risposte si leggono dalla casella in **sola lettura** e si mostrano, ma non si salvano tra le ricevute (`sdiRicevuteService` deve ignorarle). Una nota invita ad aspettare le risposte prima di riprovare.
- Nessuna dipendenza nuova: `nodemailer` e `imapflow` ci sono già.
- Test: messaggi d'errore per codice/tipo di errore (funzione pura), come `pec-errors.spec.ts` esterno.

**Riferimento esterno.** `packages/fatturapa/src/sdi-pec.ts` `PEC_PROVIDERS` (campi, note su 2FA e password per i client), `apps/api/src/sdi/services/pec-connection-test.service.ts` (`testSmtp`, `testImap`, passi `SMTP_CONNECT`, `SMTP_LOGIN`, `IMAP_CONNECT`, `IMAP_LOGIN`), `pec-errors.ts`, `pec-sdi-probe.service.ts` (Spec. FatturaPA 1.9.1 §1.3.1: "a fronte dell'invio di una PEC priva di allegato … il SdI invia un messaggio di cortesia"), `TODO.md` "Invio allo SDI via PEC" punto 8 (ordine delle prove reali).

---

## F. Cosa resta fuori, e perché

| Cosa | Perché |
|---|---|
| Multi-tenant, login con più utenti, ruoli, sessioni | Escluso dalla richiesta; Timesheet è mono-operatore (`code-quality.md`) |
| Architettura NestJS/Prisma/PostgreSQL/Next.js, DTO, Swagger | Stack diverso, nessun beneficio per un'app locale con `jsonStore` |
| Fatture alla PA con firma qualificata | Bloccate anche nell'esterno. Nessun cliente PA oggi |
| Correzione e reinvio fatture scartate | Timesheet ha già `sdiScartoReminderService.js` + `scartoSuggerimenti.js` + progressivo casuale contro l'errore 00002. Nell'esterno è ancora da fare |
| Note di credito TD04 | Già in FP-004 |
| Uscita immediata oltre 100.000 € in dashboard | Già in FP-002 (collegata alla voce 11) |
| **Non implementate nemmeno nell'esterno** (solo in `TODO.md` o come valori nelle regole): avvisi bonari e CIVIS con rate, ravvedimento operoso, prospetto righi LM/RR per la dichiarazione, fatture ricevute (acquisti), servizi elettronici a privati UE (OSS), pagina analytics | Non c'è niente di verificato da cui partire: se servono, sono proposte nuove a parte |

Timesheet ha invece funzioni che l'esterno non ha: timesheet e ore, multi-cliente con template PDF, incassi BTC (FP-011), backup cifrato, promemoria, auto-update, provider AI multipli, dashboard con card riordinabili.

---

## G. Ordine di realizzazione

**Regola: a fine di ogni voce implementata, aggiornare subito la colonna «Stato» di questa tabella** (⬜ da fare · 🚧 in corso · ✅ data + commit), come ultimo passo del task.

Criterio: si parte dalle voci **indipendenti** (livello 0), poi quelle che dipendono solo da voci già fatte (livello 1, 2…). Il livello è la lunghezza della catena di dipendenze più lunga. Dentro ogni livello si va dallo **sforzo più basso al più alto**. Dove due voci hanno lo stesso sforzo, prima quella che ne sblocca altre.

| Ordine | Voce | Sforzo | Dipende da | Stato |
|---|---|---|---|---|
| **Livello 0: indipendenti** | | | | |
| 1° | 12 Data fattura nel futuro (FP-029) | S | — | ✅ 2026-09-30 (commit: 561fc8a) |
| 2° | 13 Dati di pagamento in fattura (FP-030) | S-M | — | ✅ 2026-09-30 (commit: da fare) |
| 3° | 1 Regole fiscali versionate (FP-021) | M | — | ⬜ |
| 4° | 18 PEC guidata (FP-032) | M | — | ⬜ |
| 5° | 17 Import ZIP (FP-017) | M | — | ⬜ |
| **Livello 1: dipendono solo da voci di livello 0** | | | | |
| 6° | 4 Calendario fiscale (FP-026), conferma a parte | S | 1 | ⬜ |
| 7° | 5 Requisiti 5% / ISA (FP-027), conferma a parte | S | 1 | ⬜ |
| 8° | 11 Avviso soglia + FP-002 (FP-028) | S | 1 | ⬜ |
| 9° | 14 Rivalsa INPS 4% (FP-031) | S-M | 1 | ⬜ |
| 10° | 2 Registro fonti (FP-019) | M | 1 | ⬜ |
| 11° | 15 Clienti esteri (FP-018) | M | 1 | ⬜ |
| 12° | 6 Piano F24 = F24_STEP3 Step 1-7 (FP-015) | L | F24_STEP3 | ⬜ |
| **Livello 2** | | | | |
| 13° | 16 Valuta e cambio (FP-020) | S-M | 15 | ⬜ |
| 14° | 7 Stesura F24 PDF (FP-023) | M | 6 | ⬜ |
| 15° | 3 Controllo periodico fonti (FP-022) | M | 1, 2 | ⬜ |
| **Livello 3** | | | | |
| 16° | 8 Stato F24 + versati automatici (FP-024) | S-M | 7 | ⬜ |
| 17° | 10 Bollo trimestrale + F24 (FP-025) | S-M | 1, 7 | ⬜ |
| **Livello 4** | | | | |
| 18° | 9 Compensazione crediti (FP-016) | M | 7, 8 | ⬜ |

La sezione A non è una voce: le precisazioni si recepiscono **dentro** F24_STEP3 quando si arriva allo step indicato (voce 6).

Note sull'ordine:
- **Voce 6 e voce 1.** La voce 6 dipende formalmente solo da F24_STEP3, ma il suo Step 1 (`regoleVersamenti.json`) nasce come primo blocco del pacchetto regole della voce 1 (vedi "Proposta strutturale" in A). Facendo la 1 prima, lo Step 1 nasce già con la forma giusta. Se F24_STEP3 è già avanti su quello step, si migra il file nel pacchetto regole.
- **Regole versionate prima di tutto il resto fiscale**: F24, bollo, soglie e rivalsa leggono tutti da lì. Farle dopo vorrebbe dire toccare due volte ogni service.
- **Livello 0 senza attese**: 12, 13, 17 e 18 non toccano le regole fiscali e si possono fare in qualsiasi momento, anche in parallelo al lavoro su F24_STEP3.
- **Voci 4 e 5**: correzioni fuori scope, ognuna richiede AskUserQuestion prima di toccare il codice.
- **Voce 16 dopo la 15**: la 16 riusa il trattamento cliente estero, quindi va dopo anche se costa meno.
- **Voce 8 subito dopo la 7**: lo stato "pagato" risolve il problema dei versamenti senza codice di F24_STEP3 Step 3.
- **Voce 9 per ultima**: dipende dalla più lunga catena (6, 7, 8), ed è quella con più rischio fiscale (soglia 5.000 €, visto di conformità).

Esecuzione, come per F24_STEP3: una voce alla volta, test verdi, **stop** in attesa di conferma, nessun commit senza OK esplicito, riavvio del backend solo dopo AskUserQuestion. Ogni modifica UI con screenshot prima/dopo (light + dark, 2 viewport). Una voce passa da 💡 a 🔍 in `FEATURE_PROPOSALS.md` quando se ne scrive il piano di dettaglio.

---

## H. Dati e file nuovi (controllo dati sensibili)

| Percorso | Contenuto | Versionato? |
|---|---|---|
| `backend/src/data/regole/<anno>.json` | Valori fiscali pubblici + fonti | ✅ sì (nessun segreto) |
| `backend/src/data/fonti/registro.json`, `fonti/testi/*.txt` | Testi di atti ufficiali (L. 633/1941 art. 5) | ✅ sì |
| `backend/src/data/gestoriPec.json` | Host pubblici dei gestori | ✅ sì |
| `backend/data/regole-attive/`, `regole-proposte/`, `fonti-cambiate.json` | Stato delle conferme dell'utente | ❌ già escluso (`backend/data/`) |
| `backend/data/f24.json`, `crediti.json` | Importi personali | ❌ già escluso |
| `backend/data/modelli/f24-ordinario.pdf` | Modello AdE scaricato al primo uso | ❌ già escluso (non si ridistribuisce) |
| `backend/data/cambi/*.json` | Cache dei cambi | ❌ già escluso |
| `config.json`: anagrafica per F24, codice sede INPS, IBAN, flag forfettario | Dati personali | ❌ già escluso |

Nessuna nuova voce in `.gitignore`: tutti i dati utente finiscono sotto `backend/data/` o in `config.json`, già esclusi. Da verificare comunque con `git ls-files` a ogni voce (regola `sensitive-data.md`).

Nuove dipendenze: `pdf-lib` (voce 7, motivata sopra) e `qrcode-generator` (frontend, già aggiunta con la voce 13). Per lo ZIP (voce 17) la decisione è rimandata al passaggio in analisi.

---

## I. Rischi

- 🟢 **I numeri in dashboard cambiano** con la sezione A (arrotondamenti, aliquota INPS degli acconti) e con la voce 5 (15% di default senza la spunta dei requisiti). Si tratta di correzioni, da scrivere nel CHANGELOG.
- 🟡 **Coordinate del modello F24**: se l'AdE pubblica una nuova edizione, il controllo dell'impronta blocca la stampa. È voluto, ma per ricalibrare serve lavoro manuale.
- 🟡 **Proposte AI (voce 3)**: il controllo "la citazione esiste nel testo" scarta le invenzioni, ma non garantisce che il valore sia quello giusto. Per questo la conferma resta sempre umana.
- 🟡 **Voci 4 e 5 sono correzioni fuori scope**: vanno confermate una per una prima di toccare il codice.
- 🔴 **Nessuna verifica col commercialista**: prima delle voci 7, 9, 14 e 15 conviene una conferma, come già stabilito per le voci fiscali del progetto (vedi FP-011).
- 🟡 **L'esterno dichiara di non aver mai provato PEC e SDI su una casella reale** (`README.md`, "Limiti noti"). Timesheet invece la PEC la usa già: per la voce 18 le nostre prove reali valgono più del loro codice.

## J. Domande aperte

1. Codice sede INPS: basta un campo a mano con link alla tabella INPS (proposta), o serve l'elenco completo selezionabile?
2. ~~Dati di pagamento: un solo IBAN~~ Risolta: un solo IBAN in config (voce 13 implementata).
3. Import ZIP: lettore ZIP con la stdlib (circa 60 righe) o una piccola dipendenza? Da decidere quando la voce passa in analisi.
4. Rivalsa 4%: da verificare, anche col commercialista, se entra nella base della soglia del bollo (77,47 €).

---

## Review Checklist

- **Completeness:** tutte le funzioni **implementate** nell'esterno e assenti in Timesheet sono coperte (voci 1-18) o escluse con un motivo (sezione F). Quelle solo pianificate nell'esterno sono elencate a parte. Incluse, come richiesto, stesura F24 (voce 7) e recupero/aggiornamento delle norme (voci 1-3). Le voci 4, 5, 11-14 e 18 sono state aggiunte dopo conferma esplicita dell'utente (2026-09-26).
- **Accuracy:** ogni riferimento esterno è letto sul codice clonato il 2026-09-26; ogni affermazione su Timesheet è verificata sul codice nella stessa data (`scadenzeFiscaliService.js`, `forfettarioService.js`, `versamentiF24Service.js`, `configService.js`, `fatturaPaXmlGenerator.js`, `invoiceService.js`, `package.json`).
- **Consistency:** numerazione allineata a `FEATURE_PROPOSALS.md` (FP-015…FP-032). La sezione A si aggancia agli step di F24_STEP3 senza cambiarne lo scope. Stesso pattern del progetto per test (`node --test`), dati (`jsonStore`), polling (`setInterval`).
- **TODO:** recepire la sezione A in F24_STEP3 quando si arriva agli step 1, 3, 5 e 7; aggiornare in F24_STEP2 la fonte della rateazione (A8).
- **Missing information:** nessuna prova del PDF F24 su un modulo reale; nessuna conferma del commercialista (vedi Rischi).
- **Open questions:** sezione J.
- **Confidence level:** 🟢 su cosa fa l'esterno e cosa manca in Timesheet (verificato sul codice); 🟢 sulle regole fiscali citate con la fonte; 🟡 su sforzi e scelte di semplificazione, non validati con un prototipo.
