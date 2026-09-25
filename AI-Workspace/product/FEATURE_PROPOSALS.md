# Feature Proposals

Confidence: 🟢 confermato da codice · 🟡 inferito · 🔴 ipotesi

Backlog numerato delle proposte di funzionalità. Il numero è stabile e non si riusa mai.
Quando una proposta viene implementata, aggiornare la voce in place
(✅ implementato, data, commit) — regola in `.claude/rules/dev-workflow.md`.

Stati: 💡 proposta · 🔍 in analisi (piano interno di dettaglio) · 🚧 in corso · ✅ implementato · ❌ scartato

---

## FP-001 — Contributi previdenziali nella stima del netto

**Stato:** 💡 proposta · **Impatto:** Alto · **Sforzo:** M

🟢 `forfettarioService.js:102` calcola `nettoStimato` sottraendo la sola imposta sostitutiva: i contributi previdenziali non entrano nel conto, quindi il netto mostrato in dashboard è più alto di quello reale. Le date di scadenza ci sono già (`scadenzeFiscaliService.js:72-73`) e il minimale artigiani/commercianti viene già recuperato via AI (`scadenzeFiscaliService.js:98-99`): manca il collegamento fra contributi e stima del netto.

🟡 Ambito: gestione separata INPS — il caso del professionista senza albo né cassa, la configurazione d'uso corrente dell'app. Il contributo è una percentuale sul reddito imponibile, e `calcolaDashboardForfettario` il `redditoImponibile` ce l'ha già in mano (`forfettarioService.js:99`): il calcolo è una funzione pura, senza nuove entità dati. Le scadenze sono già a calendario, con gli stessi termini dell'imposta — saldo più I acconto a giugno, II acconto a novembre.

🟡 Serve un campo `gestionePrevidenziale` in `config.forfettario` (accanto a `coefficenteRedditivita`), perché la stima non deve applicarsi a chi è in una gestione diversa. Le altre gestioni sono trattate in FP-007.

**Attenzione**: l'aliquota cambia ogni anno. Va versionata per anno con la fonte (circolare INPS) accanto al valore, mai hardcoded a un numero solo — altrimenti a gennaio il dato è silenziosamente sbagliato. Vedi FP-006.

**Riferimenti:** `backend/src/services/forfettarioService.js:93-166`, `scadenzeFiscaliService.js:68-99`, `configService.js`, `frontend/src/components/wizard/StepFornitore.vue`
**Piano di dettaglio:** — (da redigere quando passa a 🔍)

---

## FP-002 — Soglia 100.000 €, uscita immediata dal regime

**Stato:** 💡 proposta · **Impatto:** Alto · **Sforzo:** S

🟢 La soglia 85.000 è gestita con proiezione (`forfettarioService.js:110-115`, `percentualeSogliaProiettata`, `superamentoSogliaProiettato` a riga 163), ma superare i 100.000 in corso d'anno ha una conseguenza diversa e più grave: uscita immediata dal regime, con IVA dovuta sulle operazioni dell'anno in corso. Oggi l'app non distingue i due casi — solo un booleano `superamentoSoglia`, sia sul ramo competenza (riga 162) sia sul ramo cassa (riga 138).

🟡 Una costante e un ramo: da booleano a tre stati (sotto soglia / uscita l'anno prossimo / uscita immediata), applicato a entrambi i rami. Costo minimo, rischio segnalato alto.

**Riferimenti:** `backend/src/services/forfettarioService.js:110-115, 131-163`, `frontend/src/views/DashboardView.vue`
**Piano di dettaglio:** — (da redigere quando passa a 🔍)

---

## FP-003 — Acconto e saldo con scomputo dei versamenti già effettuati

**Stato:** 💡 proposta · **Impatto:** Alto · **Sforzo:** M

🟢 `accontoStimato` (`forfettarioService.js:122`) calcola l'acconto col metodo storico, ma al lordo: non sottrae quanto già versato. `versamentiF24Service.js` ha già i versamenti registrati, con import da testo del Cassetto Fiscale — il dato è in casa e non viene usato per questo.

🟡 Collegare i due servizi: acconto e saldo mostrano quanto resta davvero da pagare, verificato contro i versamenti reali e non contro la memoria dell'utente. Dipende da FP-001 per la parte contributiva: stessa PR o subito dopo.

**Riferimenti:** `backend/src/services/forfettarioService.js:117-122`, `versamentiF24Service.js`, `frontend/src/views/VersamentiF24View.vue`
**Piano di dettaglio:** — (da redigere quando passa a 🔍)

---

## FP-004 — Nota di variazione TD04 con invio a SDI

**Stato:** 💡 proposta · **Impatto:** Alto · **Sforzo:** M

🟢 `invoiceRoutes.js` blocca la rigenerazione di una fattura accettata dallo SDI e rimanda a una nota di variazione (Circolare Agenzia Entrate 13/E/2018; principio di diritto n. 17/2020) — che però l'app non sa emettere. L'utente viene lasciato a metà: gli si dice cosa fare e non gli si dà lo strumento (stesso messaggio duplicato in `frontend/src/views/FatturaView.vue:316`).

🟢 `fatturaPaXmlGenerator.js:101` ha `TipoDocumento` hardcoded a `TD01`: servono il parametro e il blocco `DatiFattureCollegate`. L'invio riusa `pecService.js` e la ricezione ricevute `sdiRicevuteService.js` senza modifiche — una TD04 è una fattura come le altre, cambia il tipo documento. È il pezzo che chiude il ciclo attivo in entrambe le direzioni, emissione e storno.

**Collocazione UI — decisa: dentro `FatturaView.vue`.** Il contesto della fattura da stornare è già tutto lì (numero, data, cliente, importi, quindi `DatiFattureCollegate` si compila da sé) e validazione e invio sono già cablati nella stessa vista. Niente screen separata: duplicherebbe quel blocco senza aggiungere nulla. Resta il vincolo: azione umana con conferma esplicita, mai innescabile da un automatismo o da un agente (vedi FP-008).

**Riferimenti:** `backend/src/services/fatturaPaXmlGenerator.js:101`, `backend/src/routes/invoiceRoutes.js:134-140`, `frontend/src/views/FatturaView.vue:313-317`
**Piano di dettaglio:** — (da redigere quando passa a 🔍)

---

## FP-005 — Simulatore del fatturato residuo

**Stato:** 💡 proposta · **Impatto:** Alto · **Sforzo:** M

🟡 La dashboard dice dove sei; non dice quanto puoi ancora fatturare prima di cambiare scenario fiscale. Tutti i dati servono già a `calcolaDashboardForfettario`: ricavi cumulati (competenza e cassa), coefficiente, aliquota, soglia. Manca l'inversione del calcolo — dato un obiettivo di fatturato, che imposta e che contributi ne derivano; e viceversa, quanto manca alla soglia.

🟡 Solo calcolo su dati esistenti più una vista Vue, nessuna persistenza. È la domanda che un forfettario si pone più spesso negli ultimi mesi dell'anno, quando decide se accettare un ultimo incarico.

**Il test va scritto prima della UI**: è una funzione che produce numeri su cui l'utente prende decisioni fiscali, e un errore qui è silenzioso. Pattern `node --test` come `forfettarioService.test.js`.

**Riferimenti:** `backend/src/services/forfettarioService.js:93-166`, `forfettarioService.test.js`
**Piano di dettaglio:** — (da redigere quando passa a 🔍)

---

## FP-006 — Fonte normativa citata su scadenze e importi

**Stato:** 💡 proposta · **Impatto:** Medio · **Sforzo:** S-M

🟢 Le scadenze mostrate sono corrette ma non verificabili: l'utente vede una data e un importo senza sapere da dove vengono. `scadenzeFiscaliService.js` già interroga un modello AI con ricerca web per proroghe e minimale INPS (righe 93-106) — la fonte la incontra, non la conserva.

🟡 Aggiungere un campo `fonte` (URL Agenzia Entrate / INPS / Normattiva) sulle scadenze e sugli importi stimati, chiedendolo nel prompt che già esiste e mostrandolo in UI. In un dominio dove sbagliare costa sanzioni, ogni numero tracciabile alla sua norma è la differenza fra uno strumento che si usa e uno di cui ci si fida.

Utile anche come difesa dall'allucinazione: un dato AI senza fonte verificabile non dovrebbe essere mostrato come certo.

**Riferimenti:** `backend/src/services/scadenzeFiscaliService.js:93-106`, `frontend/src/views/DashboardView.vue`
**Piano di dettaglio:** — (da redigere quando passa a 🔍)

---

## FP-007 — Supporto alle altre gestioni previdenziali

**Stato:** 💡 proposta · **Impatto:** Medio · **Sforzo:** M

🟡 FP-001 copre la gestione separata. Ma un forfettario può stare in una gestione diversa — artigiani o commercianti (rate fisse più percentuale sull'eccedenza del minimale), oppure una cassa professionale se iscritto a un albo (Inarcassa, ENPAM, Cassa Forense e altre, ciascuna con regole proprie). Il regime fiscale è lo stesso, la previdenza no.

🟢 Oggi l'app non distingue: `scadenzeFiscaliService.js:68-78` mostra tutte le gestioni in calendario, comprese quelle che non riguardano chi la sta usando. Il campo `gestionePrevidenziale` introdotto da FP-001 rende possibile filtrare — beneficio immediato anche senza alcun calcolo aggiuntivo.

🟡 Per artigiani e commercianti il minimale è già recuperato via AI (`scadenzeFiscaliService.js:98-99`): serve applicarlo, più la percentuale sull'eccedenza. Per le casse professionali le regole variano da cassa a cassa e non sono generalizzabili: la via ragionevole è un importo annuo configurato a mano dall'utente, non un calcolo automatico che darebbe un numero sbagliato con l'aria di essere giusto.

**Perché non è urgente**: l'utente corrente è in gestione separata (FP-001). Questa voce serve se l'app viene usata da qualcun altro, o se la posizione previdenziale cambia. Da fare dopo FP-001, riusandone la struttura.

**Riferimenti:** `backend/src/services/scadenzeFiscaliService.js:68-99`, `configService.js`, `forfettarioService.js`
**Piano di dettaglio:** — (da redigere quando passa a 🔍)

---

## FP-008 — Server MCP in sola lettura

**Stato:** 💡 proposta 🔴 · **Impatto:** Medio · **Sforzo:** M

🔴 Esporre i dati di Timesheet a un assistente AI esterno tramite Model Context Protocol, in sola lettura: riepilogo anno, scadenze, stato incassi, esito SDI di una fattura.

**Confine invalicabile**: nessuna scrittura, nessun invio. Un invio a SDI errato non è annullabile — si ripara solo con una TD04 (FP-004), che resta un'azione umana in UI. L'assistente può segnalare che una fattura è stata scartata, mai emettere lo storno.

Resta una proposta, non una raccomandazione né un impegno di roadmap: non passa in analisi finché non viene richiesto esplicitamente.

**Riferimenti:** `backend/src/routes/forfettarioRoutes.js`, `backend/src/routes/invoiceRoutes.js`, `backend/src/services/sdiRicevuteService.js`
**Piano di dettaglio:** — (da redigere quando passa a 🔍)

---

## FP-009 — Chat AI in-app sui propri dati

**Stato:** 💡 proposta 🔴 · **Impatto:** Medio · **Sforzo:** M

🔴 Una schermata di chat dentro Timesheet per interrogare i propri dati in linguaggio naturale, senza uscire dall'app. Riuserebbe le API key già configurate in Keychain (`envService.js`: Gemini, Groq, Claude) e i tool di sola lettura di FP-008.

🟡 Nativa, non iframe: un iframe verso un servizio esterno non può leggere i tool locali e manderebbe i dati fuori dalla macchina — contrario all'impostazione dell'app, che tiene i segreti in Keychain e i dati su disco locale. Una chat nativa riuserebbe credenziali già presenti e non farebbe uscire nulla.

Dipende da FP-008 per i tool. Stesso confine: legge, non scrive, non invia. Resta una proposta, come FP-008: nessun impegno di roadmap.

**Riferimenti:** `backend/src/services/envService.js`, `backend/src/services/geminiAtecoService.js` (pattern di chiamata AI già in uso)
**Piano di dettaglio:** — (da redigere quando passa a 🔍)

---

## FP-010 — Provider AI locale (LM Studio / Ollama) e flag di abilitazione per provider

**Stato:** 💡 proposta · **Impatto:** Medio · **Sforzo:** M

🟢 Oggi i tre provider AI (`envService.js:91,133,147` — Gemini, Groq, Claude) sono tutti servizi cloud a pagamento: ogni chiamata (aggiornamento ATECO, mapping colonne CSV pagamenti, verifica proroghe fiscali) esce dalla macchina dell'utente e consuma una quota esterna. Aggiungere un provider **locale** (LM Studio o Ollama, i due più diffusi, con API HTTP compatibile OpenAI) chiude il cerchio: chi non vuole o non può mandare dati fiscali fuori dal proprio computer ha comunque le funzioni AI, a costo zero e senza rete esterna.

🟢 Il routing esistente non è una scelta dell'utente ma un **fallback per disponibilità**: `scadenzeFiscaliService.js:121-166` prova Gemini e ripiega su Claude solo se la quota Gemini è esaurita (`ritentareDopoErrore`, riga 121); nel wizard (`StepAI.vue:14-42`) le tre schede Gemini/Claude/Groq sono indipendenti, senza un ordine di priorità che l'utente possa impostare.

🟡 Due pezzi distinti, entrambi necessari:
1. **Nuovo provider**: `envService.js` guadagna `leggiLocalAiEndpoint()`/`leggiLocalAiModello()` sullo stesso schema delle funzioni esistenti; un quarto step nel wizard (`StepLocalAI.vue`, accanto a `StepGeminiAI.vue`) chiede solo l'URL locale (default `http://localhost:1234` per LM Studio, `http://localhost:11434` per Ollama) — nessuna API key da proteggere in Keychain, perché non lascia la macchina.
2. **Flag di abilitazione per provider**: un interruttore per provider in Impostazioni ("usa Gemini: sì/no", ecc.), che oggi non esiste — la sola presenza di una API key configurata vale come "abilitato". Con un provider locale sempre disponibile e gratuito, va reso possibile disattivare esplicitamente un provider cloud (es. per chi non vuole mai che i dati escano) o preferire il locale anche quando una key cloud è presente.

🟡 Il routing resta **come oggi** (fallback per disponibilità, non selezione manuale ad ogni chiamata): il flag agisce a monte, restringendo l'insieme dei provider considerati da `ritentareDopoErrore` e dalle funzioni analoghe. Un provider disattivato viene saltato come se la sua API key non fosse configurata.

**Riferimenti:** `backend/src/services/envService.js:91-166`, `backend/src/services/scadenzeFiscaliService.js:121-166`, `frontend/src/components/wizard/StepAI.vue`, `frontend/src/components/wizard/StepGeminiAI.vue`
**Piano di dettaglio:** — (da redigere quando passa a 🔍)

---

## FP-011 — Incassi in Bitcoin con dati per il controllo

**Stato:** ✅ implementata (2026-09-25, commit 47ee611, 3c1bb58, ac27763, b306ad2) · **Impatto:** Medio · **Sforzo:** M

🟢 Oggi `pagamenti[]` (`pagamentiFattureService.js:307-317`, `invoiceService.js:37-59`) registra rate solo in EUR da bonifico. Un incasso in BTC (datio in solutum, art. 1197 c.c.) è lecito ma richiede di conservare TXID, quantità in satoshi, cambio EUR/BTC applicato con fonte e ora, e indirizzo di destinazione — dati che oggi non hanno posto nel modello.

🟡 Estende la rata esistente con un campo opzionale `btc: { txid, satoshi, cambioEurBtc, fonteCambio, dataOraCambio, indirizzoDestinatario }`; `importo` resta sempre in EUR calcolato lato server, così dashboard, soglia e cassa forfettario non cambiano. Nuovo endpoint `/pagamenti/conferma-btc`, indirizzi wallet in configurazione, dicitura opzionale in fattura per cliente, colonne aggiuntive nell'export commercialista.

**Vincolo di retro-compatibilità**: il campo `btc` è opzionale, le fatture e la configurazione esistenti restano lette e scritte senza migrazione; le fatture di clienti senza il nuovo flag restano identiche byte per byte.

Analisi già svolta, non pubblicata: contiene la verifica puntuale delle norme fiscali applicabili, da riconfermare col commercialista prima dell'implementazione.

**Riferimenti:** `backend/src/services/pagamentiFattureService.js:307-327`, `backend/src/services/invoiceService.js:37-59`, `backend/src/services/fatturaPaXmlGenerator.js:101-108`, `backend/src/services/exportService.js`, `backend/src/services/configService.js:119-158`, `frontend/src/views/FatturaView.vue:304-309`

---

## FP-012 — Registro lotti BTC e plusvalenze da redditi diversi

**Stato:** 💡 proposta · **Impatto:** Medio · **Sforzo:** L

🔴 Il BTC incassato (FP-011) e poi speso o venduto genera redditi diversi (art. 67 c. 1 lett. c-sexies TUIR, aliquota 33% dal 2026). Serve un registro delle uscite dal wallet e un metodo di calcolo (LIFO, FIFO o costo medio) — non codificato in modo univoco per le cripto, va confermato col commercialista prima di scegliere.

🟡 Il costo di carico di ogni lotto è il controvalore EUR già registrato all'incasso da FP-011: la dipendenza è diretta, non solo cronologica.

**Riferimenti:** dipende da FP-011
**Piano di dettaglio:** — (da redigere quando passa a 🔍)

---

## FP-013 — Quadro RW e imposta IC sulle cripto

**Stato:** 💡 proposta · **Impatto:** Medio · **Sforzo:** M

🟢 Le cripto detenute al 31/12 vanno monitorate nel quadro RW (L. 197/2022) con imposta IC dello 0,2% sul valore (art. 19 c. 18-bis DL 201/2011). 🟡 Serve il saldo e il valore del wallet al 31/12, dato che l'app non possiede finché non traccia anche le uscite — per questo dipende da FP-012, non solo da FP-011.

**Riferimenti:** dipende da FP-012
**Piano di dettaglio:** — (da redigere quando passa a 🔍)

---

## FP-014 — Import automatico incassi per indirizzo (mai xpub)

**Stato:** 💡 proposta 🔴 · **Impatto:** Basso · **Sforzo:** M

🔴 **xpub esclusa in modo permanente**: una extended public key rivela l'intero storico di indirizzi e saldi del wallet, non solo gli incassi legati a Timesheet — rischio privacy sproporzionato rispetto al beneficio. Non riconsiderare senza un cambio radicale di modello (es. wallet watch-only dedicato a un solo indirizzo).

🟡 Alternativa più stretta, coerente con F2/F4 (già in FP-011: singolo indirizzo dichiarato, singolo TXID): interrogare in sola lettura, per il/i soli indirizzi di ricezione già configurati (`config.walletBtc`), un provider **self-hostable, open source, senza account/API key legata a identità**:
- **mempool.space** (`/api/address/:addr/txs`) — stesso servizio già proposto in FP-011 §F4 per singolo TXID, estende la stessa fiducia già accettata;
- **blockstream.info** — stesso team/stack di mempool.space, come fallback/ridondanza.

Scartati di proposito: provider a pagamento con account nominativo (peggiora la tracciabilità dell'operatore), aggregatori generalisti non specializzati BTC.

Resta una proposta, non un impegno di roadmap: da valutare solo se il volume di incassi in BTC rende l'inserimento manuale (FP-011) un collo di bottiglia reale.

**Riferimenti:** dipende da FP-011 (F2 indirizzi configurati, F4 pattern chiamata mempool.space)
**Piano di dettaglio:** — (da redigere quando passa a 🔍)

---

## Review Checklist

- **Completeness:** copre i gap fiscali/operativi individuati in questa revisione del prodotto. Non è un elenco esaustivo di ogni possibile miglioramento — solo le voci con impatto Alto/Medio ritenute concrete.
- **Accuracy:** ogni voce cita `file:riga` verificato sul codice al momento della stesura (2026-09-18; FP-011…FP-014 aggiunte 2026-09-23).
- **Consistency:** confidence tag assegnati per singola affermazione, non per intera voce; le dipendenze dichiarate (FP-003 → FP-001, FP-007 → FP-001, FP-009 → FP-008, FP-012 → FP-011, FP-013 → FP-012, FP-014 → FP-011) sono coerenti con l'ordine dei numeri.
- **TODO:** rileggere FP-001 e FP-007 quando cambiano le aliquote INPS dell'anno (fonte da versionare, vedi FP-006); ridiscutere FP-008/FP-009 se emerge una richiesta esplicita di integrazione AI esterna; verificare se il flag di FP-010 debba estendersi anche a FP-008/FP-009 una volta implementate.
- **Missing information:** le stime di Impatto/Sforzo sono giudizi non validati con un prototipo o con l'utente finale oltre all'autore della revisione.
- **Open questions:** se e quando FP-008/FP-009 passano da proposta a analisi è una decisione di prodotto, non presa qui.
- **Confidence level:** misto 🟢/🟡/🔴, taggato per singola affermazione in ogni voce.
