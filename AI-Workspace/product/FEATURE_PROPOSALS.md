# Feature Proposals

Confidence: 🟢 confermato da codice · 🟡 inferito · 🔴 ipotesi

Backlog numerato delle proposte **ancora da realizzare**. Il numero è stabile e non si riusa mai: i buchi nella numerazione sono voci già implementate e rimosse da questo file (la storia sta in `CHANGELOG.md` alla radice e in `git log`).

Quando una proposta viene implementata, rimuovere la voce da qui come ultimo passo del lavoro.

Stati: 💡 proposta · 🔍 in analisi (piano interno di dettaglio) · 🚧 in corso · ❌ scartato

Piani di dettaglio e analisi di mercato: [`Plans/`](../Plans/).

---

## FP-004 — Nota di variazione TD04 con invio a SDI

**Stato:** 💡 proposta · **Impatto:** Alto · **Sforzo:** M

🟢 `invoiceRoutes.js` (righe 182-187) blocca la rigenerazione di una fattura accettata dallo SDI e rimanda a una nota di variazione (Circolare Agenzia Entrate 13/E/2018; principio di diritto n. 17/2020), che l'app non sa emettere. `FatturaView.vue` (riga 386) ripete lo stesso criterio e mostra la nota «Fattura accettata dallo SDI».

🟢 `fatturaPaXmlGenerator.js` scrive `TipoDocumento` fisso `TD01` (riga 189): servono il parametro e il blocco `DatiFattureCollegate`. Invio (`pecService.js`) e ricezione ricevute (`sdiRicevuteService.js`) si riusano senza modifiche, una TD04 è una fattura come le altre con un altro tipo documento.

**Collocazione UI — decisa: dentro `FatturaView.vue`.** Il contesto della fattura da stornare è già lì (numero, data, cliente, importi) e validazione e invio sono già cablati. Vincolo: azione umana con conferma esplicita, mai innescabile da un automatismo o da un agente. Il server MCP e la chat restano in sola lettura.

**Riferimenti:** `backend/src/services/fatturaPaXmlGenerator.js:189`, `backend/src/routes/invoiceRoutes.js:182-187`, `frontend/src/views/FatturaView.vue:386`
**Piano di dettaglio:** — (da redigere quando passa a 🔍)

---

## FP-005 — Simulatore del fatturato residuo

**Stato:** 💡 proposta · **Impatto:** Alto · **Sforzo:** M

🟡 La dashboard dice dove sei, non quanto puoi ancora fatturare prima di cambiare scenario fiscale. I dati ci sono già in `calcolaDashboardForfettario`: ricavi cumulati (competenza e cassa), coefficiente, aliquota, soglie, INPS. Manca l'inversione del calcolo:
- dato un obiettivo di fatturato, che imposta e che contributi ne derivano
- dato il margine, quanto manca alla soglia

🟡 Solo calcolo su dati esistenti più una vista, nessuna persistenza. È la domanda tipica degli ultimi mesi dell'anno, quando si decide se accettare un ultimo incarico.

**Il test va scritto prima della UI**: la funzione produce numeri su cui l'utente prende decisioni fiscali e un errore è silenzioso. Pattern `node --test` come `forfettarioService.test.js`.

**Riferimenti:** `backend/src/services/forfettarioService.js:183` (`calcolaDashboardForfettario`), `forfettarioService.test.js`, `frontend/src/views/DashboardView.vue`
**Piano di dettaglio:** — (da redigere quando passa a 🔍)

---

## FP-007 — Supporto alle altre gestioni previdenziali

**Stato:** 💡 proposta · **Impatto:** Medio · **Sforzo:** M

🟢 Oggi il calcolo INPS copre solo la gestione separata: `stimaVersamentiService.js` produce righe INPS solo se `config.forfettario.gestionePrevidenziale === 'gestioneSeparata'` e altrimenti emette l'avviso «Gestione previdenziale non configurata: righe INPS non incluse». `altraCoperturaPrevidenziale` riduce l'aliquota della gestione separata, non è un'altra gestione.

🟢 `scadenzeFiscaliService.js` (`scadenzeBaseAnno`, righe 91-100) mostra comunque le rate fisse artigiani/commercianti nel calendario, anche a chi non ne è soggetto: `gestionePrevidenziale` permetterebbe di filtrarle, beneficio immediato senza alcun calcolo nuovo.

🟡 Per artigiani e commercianti il minimale è già recuperato via AI: serve applicarlo più la percentuale sull'eccedenza. Per le casse professionali (Inarcassa, ENPAM, Cassa Forense…) le regole variano da cassa a cassa e non sono generalizzabili: la via ragionevole è un importo annuo configurato a mano, non un calcolo automatico che darebbe un numero sbagliato con l'aria di essere giusto.

**Perché non è urgente**: l'utente corrente è in gestione separata. Serve se l'app viene usata da qualcun altro o se la posizione previdenziale cambia.

**Riferimenti:** `backend/src/services/stimaVersamentiService.js`, `backend/src/services/scadenzeFiscaliService.js:91-100`, `backend/src/services/configService.js` (`forfettario.gestionePrevidenziale`), `backend/src/services/forfettarioService.js`
**Piano di dettaglio:** — (da redigere quando passa a 🔍)

---

## Review Checklist

- **Completeness:** solo le proposte non ancora implementate. Le voci realizzate sono state rimosse, la numerazione resta stabile.
- **Accuracy:** ogni riferimento `file:riga` verificato sul codice il 2026-10-13.
- **Consistency:** numerazione stabile, nessuna dipendenza aperta tra le voci rimaste.
- **TODO:** rileggere FP-007 quando cambiano le aliquote o le gestioni INPS dell'anno (fonte da versionare in `regole/<anno>.json`).
- **Missing information:** le stime di Impatto e Sforzo non sono validate con un prototipo o con l'utente finale.
- **Open questions:** se e quando FP-004 passa a 🔍 è una decisione di prodotto.
- **Confidence level:** misto 🟢/🟡/🔴, taggato per singola affermazione.
