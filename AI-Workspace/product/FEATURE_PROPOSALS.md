# Feature Proposals

Confidence: 🟢 confermato da codice · 🟡 inferito · 🔴 ipotesi

Backlog numerato delle proposte **ancora da realizzare**. Il numero è stabile e non si riusa mai: i buchi nella numerazione sono voci già implementate e rimosse da questo file (la storia sta in `CHANGELOG.md` alla radice e in `git log`).

Quando una proposta viene implementata, rimuovere la voce da qui come ultimo passo del lavoro.

Stati: 💡 proposta · 🔍 in analisi (piano interno di dettaglio) · 🚧 in corso · ❌ scartato

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

**Stato:** 🔍 parte 1 (filtro rate fisse nel calendario) ✅ 2026-11-10; parte 2 (calcolo altre gestioni) 💡 proposta · **Impatto:** Medio · **Sforzo:** M

🟢 Oggi il calcolo INPS copre solo la gestione separata: `stimaVersamentiService.js` produce righe INPS solo se `config.forfettario.gestionePrevidenziale === 'gestioneSeparata'` e altrimenti emette l'avviso «Gestione previdenziale non configurata: righe INPS non incluse». `altraCoperturaPrevidenziale` riduce l'aliquota della gestione separata, non è un'altra gestione.

🟢 `scadenzeFiscaliService.js` (`scadenzeBaseAnno`, righe 91-100) mostra comunque le rate fisse artigiani/commercianti nel calendario, anche a chi non ne è soggetto: `gestionePrevidenziale` permetterebbe di filtrarle, beneficio immediato senza alcun calcolo nuovo.

🟡 Per artigiani e commercianti il minimale è già recuperato via AI: serve applicarlo più la percentuale sull'eccedenza. Per le casse professionali (Inarcassa, ENPAM, Cassa Forense…) le regole variano da cassa a cassa e non sono generalizzabili: la via ragionevole è un importo annuo configurato a mano, non un calcolo automatico che darebbe un numero sbagliato con l'aria di essere giusto.

**Perché non è urgente**: l'utente corrente è in gestione separata. Serve se l'app viene usata da qualcun altro o se la posizione previdenziale cambia.

**Riferimenti:** `backend/src/services/stimaVersamentiService.js`, `backend/src/services/scadenzeFiscaliService.js:91-100`, `backend/src/services/configService.js` (`forfettario.gestionePrevidenziale`), `backend/src/services/forfettarioService.js`
**Piano di dettaglio:** — (da redigere quando passa a 🔍)

---

## FP-008 — Avviso su numero fattura duplicato nell'import dello ZIP del Cassetto Fiscale

**Stato:** ✅ implementata 2026-11-10 (avviso in anteprima, l'import resta consentito) · **Impatto:** Medio · **Sforzo:** S

🟢 L'import dello ZIP accetta una fattura storica con un numero già usato nello stesso anno (verificato con un archivio di prova). Dopo l'import ogni nuova emissione risponde 409 «numeri duplicati».
- decisione di prodotto: l'import deve avvisare, rifiutare la fattura o accettarla come oggi
- un avviso in anteprima (colonna «Dettaglio» della tabella) basterebbe a evitare la sorpresa all'emissione

**Riferimenti:** `frontend/src/views/ImportaStoricoView.vue` (anteprima ZIP), `backend/src/services/invoiceService.js`

---

## FP-009 — Creare ed eliminare F24 dalla dashboard

**Stato:** 💡 proposta · **Impatto:** Medio · **Sforzo:** M

🟢 Le rotte `POST /f24` e `DELETE /f24/:id` esistono ma il frontend non le usa: nel tab F24 della dashboard non c'è modo di creare o eliminare un F24, solo di registrare versamenti e crediti.
- decisione di prodotto: è una scelta voluta (F24 solo stimati) o una mancanza

**Riferimenti:** `frontend/src/views/DashboardView.vue`, `frontend/src/views/VersamentiF24View.vue`, `backend/src/routes/forfettarioRoutes.js`

---

## FP-010 — Valori di mercato nei movimenti Bitcoin

**Stato:** 💡 proposta · **Impatto:** Basso · **Sforzo:** S

🟢 `GET /api/forfettario/btc/movimenti` non restituisce `valoriMercato`, che stanno in `btc/rw`. Chi consuma solo i movimenti deve fare una seconda chiamata.
- decidere se unificare le due risposte o lasciare la separazione

**Riferimenti:** `backend/src/routes/forfettarioRoutes.js`

---

## FP-011 — Campo data vuoto: aprire il calendario sul mese corrente

**Stato:** ✅ implementata 2026-11-10 (il calendario si apriva già sul mese corrente; aggiunta la griglia di anni) · **Impatto:** Basso · **Sforzo:** S

🟡 Con un `DateField` vuoto il calendario si apre sul mese di default; scegliere una data lontana richiede molti passaggi di mese.
- aprire sul mese corrente e permettere la scelta rapida dell'anno

**Riferimenti:** `frontend/src/components/common/DateField.vue`, `frontend/src/components/common/CalendarioPopup.vue`

---

## FP-012 — Riordino delle card della dashboard

**Stato:** 💡 proposta · **Impatto:** Basso · **Sforzo:** M

🔴 L'ordine delle card è fisso. Un riordino scelto dall'utente, ricordato per dispositivo (preferenza di visualizzazione, non dato fiscale), adatterebbe la dashboard all'uso.

**Riferimenti:** `frontend/src/views/DashboardView.vue`

---

## FP-013 — Test UI dei pagamenti da CSV con Gemini simulato

**Stato:** 💡 proposta · **Impatto:** Basso · **Sforzo:** S

🟢 Il riconoscimento delle colonne del CSV bancario passa da Gemini, richiesta esterna bloccata nei test UI: oggi la sezione «Pagamenti fatture» è provata solo all'apertura.
- simulare la risposta con una route di test e coprire proposte, abbinamento e conferma

**Riferimenti:** `frontend/src/views/ImportaStoricoView.vue`, `backend/src/services/`

---

## Review Checklist

- **Completeness:** solo le proposte non ancora implementate. Le voci realizzate sono state rimosse, la numerazione resta stabile.
- **Accuracy:** ogni riferimento `file:riga` verificato sul codice il 2026-10-13.
- **Consistency:** numerazione stabile, nessuna dipendenza aperta tra le voci rimaste.
- **TODO:** rileggere FP-007 quando cambiano le aliquote o le gestioni INPS dell'anno (fonte da versionare in `regole/<anno>.json`).
- **Missing information:** le stime di Impatto e Sforzo non sono validate con un prototipo o con l'utente finale.
- **Open questions:** se e quando FP-004 passa a 🔍 è una decisione di prodotto.
- **Confidence level:** misto 🟢/🟡/🔴, taggato per singola affermazione.
