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

🟢 Estensione UI (2026-09-26): dashboard forfettario mostra 4 card dedicate (riepilogo, rate con TXID, quadro RW, valore attuale con grafico andamento cambio) — `backend/src/services/forfettarioService.js` (`riepilogoBtc`), `frontend/src/views/DashboardView.vue`.

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

## FP-015 — Piano F24 automatico (saldo, acconti, rateazione, interessi)

**Stato:** 🔍 in analisi · **Impatto:** Alto · **Sforzo:** L

🟢 `versamentiF24Service.js` registra solo i versamenti già effettuati (import da testo del Cassetto Fiscale): oggi Timesheet non calcola né genera un F24 da pagare, solo la stima grezza di imposta/acconto in dashboard.

🟡 Un piano che calcola saldo dell'anno chiuso e primo/secondo acconto dell'anno in corso, per l'imposta sostitutiva e per l'INPS gestione separata. Rateazione mensile opzionale con gli interessi secondo le regole ufficiali: tasso annuo sulla seconda rata con conteggio a giorni commerciali, più un incremento fisso per ogni rata successiva. Pagamento differito di 30 giorni con maggiorazione: per l'imposta si somma all'importo prima di dividere in rate, per l'INPS va su una riga separata. Raccoglie FP-001 e FP-003.

🟡 Punti di precisione già individuati (base INPS lorda arrotondata all'euro, acconti INPS con l'aliquota dell'anno a cui si riferiscono, arrotondamento all'euro dei righi della dichiarazione, minimo 1,03 € per riga, 40/60 o 50/50 per gli acconti, blocco del piano sopra 100.000 €): elencati nella sezione A del piano di massima.

**Riferimenti:** `backend/src/services/versamentiF24Service.js`, `forfettarioService.js`, `scadenzeFiscaliService.js`
**Piano di dettaglio:** [F24_STEP3_SVILUPPO_STIMA.md](../Plans/F24_STEP3_SVILUPPO_STIMA.md) (in corso, Step 0-8 tracciati) · precisazioni: [FEATURES_GAP_ANALISI_ESTERNA.md](../Plans/FEATURES_GAP_ANALISI_ESTERNA.md) §A

---

## FP-016 — Compensazione crediti fiscali nell'F24

**Stato:** 💡 proposta · **Impatto:** Medio · **Sforzo:** M

🟡 Un credito fiscale residuo da un anno precedente (IRPEF, IVA) oggi non ha modo di essere usato a scomputo di un debito nell'F24: va gestito interamente a mano/dal commercialista. Serve un registro dei crediti disponibili, la loro applicazione automatica a copertura dei debiti (imposta sostitutiva, INPS), e un avviso quando l'uso nell'anno supera la soglia di 5.000€, oltre la quale serve il visto di conformità prima di poter compensare — usarlo oltre soglia senza visto è sanzionabile.

**Perché non è urgente**: dipende da FP-015 (il piano F24 va prima generato, poi eventualmente compensato).

🟡 Precisazioni: il limite dei 5.000 € conta solo la compensazione fra tributi diversi (non quella sullo stesso tributo) e non riguarda i crediti INPS; oltre il limite il credito si usa solo dal decimo giorno dopo la dichiarazione; se il credito copre tutto va presentato comunque un F24 a saldo zero, solo per via telematica.

**Riferimenti:** dipende da FP-015, FP-023, FP-024
**Piano di dettaglio:** — (da redigere quando passa a 🔍) · piano di massima: [FEATURES_GAP_ANALISI_ESTERNA.md](../Plans/FEATURES_GAP_ANALISI_ESTERNA.md) voce 9

---

## FP-017 — Import massivo da archivio ZIP del Cassetto Fiscale

**Stato:** ✅ implementata 2026-09-30 (commit: fe603ba) · **Impatto:** Medio · **Sforzo:** M

🟢 `xmlInvoiceImporter.js` importa file XML di fatture uno alla volta o più file XML sciolti; un archivio ZIP scaricato dal Cassetto Fiscale (portale Fatture e Corrispettivi), che contiene insieme fatture e ricevute di consegna/scarto dello SDI, oggi va prima scompattato ed i file smistati a mano.

🟡 Riconoscere e importare l'archivio ZIP così com'è: apertura dello ZIP con limiti contro gli archivi malevoli (dimensione per file, numero di file, totale estratto), riconoscimento di ogni file dal contenuto (fattura o ricevuta RC/NS/MC), smistamento al punto giusto dell'applicazione, e anteprima di cosa verrà importato prima di confermare. Le ricevute si agganciano alla fattura dal nome del file.

**Riferimenti:** `backend/src/services/xmlInvoiceImporter.js`, `sdiRicevuteService.js`
**Piano di dettaglio:** — (da redigere quando passa a 🔍) · piano di massima: [FEATURES_GAP_ANALISI_ESTERNA.md](../Plans/FEATURES_GAP_ANALISI_ESTERNA.md) voce 17

---

## FP-018 — Clienti esteri: trattamento IVA corretto in fattura (Natura, Intrastat)

**Stato:** 💡 proposta · **Impatto:** Medio · **Sforzo:** M

🟢 `fatturaPaXmlGenerator.js:125,129` scrive sempre `Natura N2.2` (operazione non soggetta del regime forfettario): corretto solo per clienti italiani. Un cliente estero (UE o extra-UE, azienda o privato) richiede una Natura diversa per legge: N2.1 (fuori campo IVA) per aziende UE/extra-UE, con obbligo di elenco Intrastat trimestrale per le sole aziende UE; i clienti privati restano di norma trattati come italiani, salvo alcuni servizi specifici (consulenza, elaborazione dati) verso privati extra-UE.

🟡 Serve il campo "paese del cliente" in anagrafica (oggi assente) e la classificazione del tipo di cliente (azienda o privato), da cui dipendono Natura, annotazione obbligatoria in fattura ("inversione contabile" / "operazione non soggetta") e obbligo Intrastat. Per i clienti esteri: `CodiceDestinatario` `XXXXXXX`, CAP `00000`, termine di emissione al 15 del mese successivo, avviso se manca l'iscrizione VIES per le aziende UE. Scadenze Intrastat nel calendario solo se nell'anno ci sono fatture ad aziende UE.

**Riferimenti:** `backend/src/services/fatturaPaXmlGenerator.js:56-129`, anagrafica clienti in `configService.js` (`CLIENTE_VUOTO`)
**Piano di dettaglio:** — (da redigere quando passa a 🔍) · piano di massima: [FEATURES_GAP_ANALISI_ESTERNA.md](../Plans/FEATURES_GAP_ANALISI_ESTERNA.md) voce 15

---

## FP-019 — Registro delle fonti normative con testo archiviato

**Stato:** 💡 proposta · **Impatto:** Medio · **Sforzo:** M

🟡 Estende FP-006 (fonte come URL): oltre al link, archiviare nel progetto il testo esatto della norma (circolare, decreto, provvedimento) e la frase precisa da cui deriva ogni valore usato nei calcoli (aliquota INPS, scadenza, importo minimo F24). Un link può rompersi o essere aggiornato senza preavviso dall'ente; un testo salvato in locale resta la prova verificabile di cosa dicesse la norma nel momento del calcolo, e rende visibile subito quando una norma cambia da un anno all'altro.

🟡 Si archivia solo il testo estratto, non il PDF, per tenere il repository leggero; l'impronta del file originale resta nel registro. Un test automatico controlla che ogni citazione compaia davvero nel testo archiviato: una citazione "a memoria" non passa.

**Perché non è urgente da solo**: ha senso soprattutto insieme a FP-021 (regole versionate per anno) e come fondamento di FP-015, per non avere aliquote/scadenze sparse nel codice senza una fonte verificabile allegata.

**Riferimenti:** dipende in parte da FP-006; propedeutico a FP-015, FP-021, FP-022
**Piano di dettaglio:** — (da redigere quando passa a 🔍) · piano di massima: [FEATURES_GAP_ANALISI_ESTERNA.md](../Plans/FEATURES_GAP_ANALISI_ESTERNA.md) voce 2

---

## FP-020 — Fatture e incassi in valuta estera, con cambio ufficiale

**Stato:** 💡 proposta · **Impatto:** Basso · **Sforzo:** S-M

🟢 Per gli incassi in BTC (FP-011) lo schema c'è già tutto: in `FatturaView.vue:203-248` un pulsante recupera i dati della transazione da mempool.space, dal TXID oppure, senza TXID, dall'ultima ricevuta sull'indirizzo di destinazione (`api.js:157-166`). Un altro pulsante prende il cambio storico EUR/BTC da CoinGecko alla data del pagamento (`api.js:167-174`). Il valore resta sempre modificabile a mano e c'è una nota privacy su cosa viene inviato al servizio esterno.

🟢 Per le valute tradizionali (USD, GBP, CHF…) invece non c'è niente: `fatturaPaXmlGenerator.js:108` ha `Divisa` fissa a `EUR`.

🟡 Stesso schema dei pulsanti BTC, applicato alle valute:
- la fattura porta valuta e cambio, obbligatorio per legge;
- la rata registra l'importo in EUR al cambio ufficiale del giorno dell'incasso, con valuta, cambio, fonte e data accanto (stesso modello del campo `btc` di FP-011, quindi dashboard, soglia ed export non cambiano);
- il cambio ufficiale giornaliero si scarica una volta per data e si riusa (cache);
- se il giorno non ha quotazione (weekend, festivo) si usa il giorno lavorativo precedente più vicino, come prevede la norma sul reddito;
- il valore resta sempre modificabile a mano.

🟡 Da verificare: la soglia del bollo sulle fatture in valuta (calcolata sul controvalore in euro).

**Perché non è urgente**: oggi nessun incasso è in valute diverse da EUR/BTC. Serve se e quando un cliente estero paga in un'altra valuta. Dipende da FP-018.

**Riferimenti:** `frontend/src/views/FatturaView.vue:203-248`, `frontend/src/services/api.js:157-174`, `backend/src/services/pagamentiFattureService.js:307-340`, `fatturaPaXmlGenerator.js:108`
**Piano di dettaglio:** — (da redigere quando passa a 🔍) · piano di massima: [FEATURES_GAP_ANALISI_ESTERNA.md](../Plans/FEATURES_GAP_ANALISI_ESTERNA.md) voce 16

---

## FP-021 — Regole fiscali versionate per anno, con confronto e conferma

**Stato:** 💡 proposta · **Impatto:** Alto · **Sforzo:** M

🟢 Oggi i valori fiscali sono sparsi: aliquote 5/15 in `forfettarioService.js` (`aliquotaImposta`), soglia e importo del bollo e soglia di fatturato in `configService.js`, date fisse in `scadenzeFiscaliService.js` (`scadenzeBaseAnno`). Le proroghe arrivano solo da una ricerca AI.

🟡 Un "pacchetto di regole" per ogni anno (`backend/src/data/regole/<anno>.json`: soglie, aliquote, acconti, scadenze con l'eventuale proroga, rate, INPS, bollo, codici tributo, causali INPS, diciture FatturaPA), ogni valore con la sua fonte. Il pacchetto in uso è una copia **confermata dall'utente**. Quando ne arriva uno nuovo (aggiornamento dell'app o proposta di FP-022), l'app mostra cosa cambia rispetto a quello in uso e lo applica solo dopo la conferma. Senza regole per l'anno: ultimo anno confermato, con un avviso ben visibile, mai un ripiego silenzioso.

🟡 Assorbe lo Step 1 di F24_STEP3 (`regoleVersamenti.json`): stesso file, forma più completa, un solo loader condiviso da F24, bollo, soglie e fatture.

**Riferimenti:** `forfettarioService.js`, `configService.js`, `scadenzeFiscaliService.js`, [F24_STEP3_SVILUPPO_STIMA.md](../Plans/F24_STEP3_SVILUPPO_STIMA.md) Step 1
**Piano di dettaglio:** — (da redigere quando passa a 🔍) · piano di massima: [FEATURES_GAP_ANALISI_ESTERNA.md](../Plans/FEATURES_GAP_ANALISI_ESTERNA.md) voce 1

---

## FP-022 — Controllo periodico delle fonti ufficiali, con proposta e conferma

**Stato:** 💡 proposta · **Impatto:** Medio · **Sforzo:** M

🟢 `scadenzeFiscaliService.js` cerca le proroghe via AI una volta l'anno, ma non conserva la fonte e non verifica la risposta.

🟡 Il controllo:
- una volta a settimana, più spesso nei periodi caldi, l'app riscarica i documenti del registro fonti (FP-019), **solo da domini ufficiali**, e ne confronta l'impronta. Se un documento è cambiato lo segnala;
- se è configurata un'AI, questa legge il documento nuovo e propone i valori aggiornati, ognuno con la frase esatta;
- **l'app scarta ogni proposta la cui frase non compare davvero nel testo** (difesa dall'allucinazione);
- le proposte valide passano dal confronto e dalla conferma di FP-021: mai un'attivazione automatica;
- stesso schema di polling `setInterval` di `backupService.js`/`sdiRicevuteService.js`, più un pulsante "Controlla ora" e un promemoria fisso nei mesi in cui escono le novità.

🟡 Limite: un atto nuovo (es. una proroga appena uscita) non è nel registro. Lo copre la ricerca AI esistente, che diventa una proposta con citazione invece di un dato mostrato come certo (risolve FP-006).

**Riferimenti:** `scadenzeFiscaliService.js:93-166`, `envService.js`, `backupService.js` (pattern di polling), `reminderService.js`
**Piano di dettaglio:** — (da redigere quando passa a 🔍) · piano di massima: [FEATURES_GAP_ANALISI_ESTERNA.md](../Plans/FEATURES_GAP_ANALISI_ESTERNA.md) voce 3

---

## FP-023 — Stesura F24 sul modello ufficiale (PDF)

**Stato:** 💡 proposta · **Impatto:** Alto · **Sforzo:** M

🟢 F24_STEP3 calcola quanto versare, ma esclude esplicitamente la produzione di un modulo F24.

🟡 L'F24 **già compilato sul modello ufficiale dell'Agenzia delle Entrate**, da scaricare in PDF: da portare in banca o in posta, o da usare come guida per l'home banking o per F24 web. Contiene:
- intestazione con i dati anagrafici;
- sezione Erario (codice tributo, rateazione `0101`/`NNRR`, anno);
- sezione INPS (codice sede, causale, periodo);
- totali per sezione, saldo finale e data.

🟡 Come si ottiene:
- il modello non si ridistribuisce: si scarica dal sito AdE al primo uso e se ne verifica l'impronta. Una nuova edizione blocca la stampa invece di produrre un modulo con i numeri nelle caselle sbagliate;
- servono i dati anagrafici oggi assenti (cognome, nome, data/luogo di nascita, sesso) e il codice sede INPS;
- una sola nuova dipendenza backend, `pdf-lib`: scrivere su un PDF esistente non si fa né con la stdlib né con `html2pdf.js`.

**Riferimenti:** dipende da FP-015; `configService.js` (`fornitore`), `frontend/src/components/wizard/StepFornitore.vue`
**Piano di dettaglio:** — (da redigere quando passa a 🔍) · piano di massima: [FEATURES_GAP_ANALISI_ESTERNA.md](../Plans/FEATURES_GAP_ANALISI_ESTERNA.md) voce 7

---

## FP-024 — Stato degli F24 e versamenti registrati in automatico

**Stato:** 💡 proposta · **Impatto:** Medio · **Sforzo:** S-M

🟢 `versamentiF24Service.js` registra i versamenti a mano o dal testo del Cassetto Fiscale, senza codice tributo. F24_STEP3 Step 3 aggiunge un codice opzionale, sempre da inserire a mano.

🟡 Ogni F24 preparato (FP-023) ha uno stato: da pagare → programmato (addebito a data futura) → pagato, oppure annullato. Quando lo segni pagato, le sue righe finiscono da sole nei versamenti con codice tributo, anno di riferimento e quota di maggiorazione separata (la maggiorazione non conta come acconto versato). Tornare indietro le rimuove. Per un F24 programmato l'app mostra l'ultimo giorno utile per annullarlo: 3 giorni lavorativi prima dell'addebito.

**Riferimenti:** `versamentiF24Service.js`, [F24_STEP3_SVILUPPO_STIMA.md](../Plans/F24_STEP3_SVILUPPO_STIMA.md) Step 3; dipende da FP-023
**Piano di dettaglio:** — (da redigere quando passa a 🔍) · piano di massima: [FEATURES_GAP_ANALISI_ESTERNA.md](../Plans/FEATURES_GAP_ANALISI_ESTERNA.md) voce 8

---

## FP-025 — Imposta di bollo trimestrale: scadenze e F24

**Stato:** 💡 proposta · **Impatto:** Medio · **Sforzo:** S-M

🟢 Il bollo da 2 € viene applicato alle fatture sopra 77,47 € (`fatturaPaXmlGenerator.js:36-40`), ma il suo versamento trimestrale non è in calendario: `scadenzeBaseAnno` non ha le scadenze del bollo.

🟡 Come funziona:
- totale dei bolli per trimestre;
- scadenze nel calendario: 31/5, 30/9, 30/11, 28/2 dell'anno dopo, codici 2521-2524;
- rinvii di legge applicati da soli per importi piccoli: 1° trimestre fino a 5.000 € ⇒ insieme al 2°; 1° + 2° fino a 5.000 € ⇒ insieme al 3°;
- F24 del bollo con il motore di FP-023.

🟡 La norma lega il trimestre alla data di consegna SDI: nella prima versione si usa la data della fattura, segnata come stima, poi la data della ricevuta di consegna già disponibile. Fatture scartate escluse.

**Riferimenti:** `fatturaPaXmlGenerator.js:36-40`, `configService.js` (`fatturazione`), `scadenzeFiscaliService.js`, `sdiRicevuteService.js`
**Piano di dettaglio:** — (da redigere quando passa a 🔍) · piano di massima: [FEATURES_GAP_ANALISI_ESTERNA.md](../Plans/FEATURES_GAP_ANALISI_ESTERNA.md) voce 10

---

## FP-026 — Calendario fiscale: festività e slittamenti di legge

**Stato:** 💡 proposta · **Impatto:** Basso · **Sforzo:** S

🟢 `scadenzeFiscaliService.js` (`FESTIVITA_FISSE`) non contiene il 4 ottobre, festa nazionale dal 2026 (L. 151/2025). `primoGiornoLavorativo` non applica lo slittamento al 20 agosto delle scadenze dall'1 al 20 agosto (D.Lgs. 33/2025 art. 11).

🟡 Oggi l'impatto è nullo, perché nessuna delle scadenze mostrate cade in quei giorni. Diventa concreto con le rate mensili (16 agosto) e con il bollo. È la correzione di un bug trovato durante un'analisi: prima di toccare il codice va confermata a parte.

**Riferimenti:** `backend/src/services/scadenzeFiscaliService.js:24-67`
**Piano di dettaglio:** — (da redigere quando passa a 🔍) · piano di massima: [FEATURES_GAP_ANALISI_ESTERNA.md](../Plans/FEATURES_GAP_ANALISI_ESTERNA.md) voce 4

---

## FP-027 — Requisiti aliquota 5% e ripartizione acconti

**Stato:** 💡 proposta · **Impatto:** Medio · **Sforzo:** S

🟢 `forfettarioService.js` (`aliquotaImposta`) applica il 5% nei primi 5 anni a chiunque abbia una data di inizio attività. La legge lo concede solo con requisiti precisi (L. 190/2014 c. 65: per esempio nessuna attività nei 3 anni precedenti, e l'attività non deve proseguire un lavoro dipendente precedente). F24_STEP3 dà per scontata la ripartizione 50/50 degli acconti.

🟡 Due spunte in "Regime forfettario":
- "ho i requisiti per il 5%": default no, cioè 15%, la scelta prudente;
- "attività con ISA": default sì, acconti 50/50; senza, 40/60.

⚠️ I numeri in dashboard cambiano per chi oggi ha il 5% senza aver dichiarato i requisiti: è una correzione, da confermare a parte e da scrivere nel CHANGELOG.

**Riferimenti:** `backend/src/services/forfettarioService.js:4-12`, `frontend/src/components/wizard/StepFornitore.vue`
**Piano di dettaglio:** — (da redigere quando passa a 🔍) · piano di massima: [FEATURES_GAP_ANALISI_ESTERNA.md](../Plans/FEATURES_GAP_ANALISI_ESTERNA.md) voce 5

---

## FP-028 — Avviso soglia prima di emettere e limite personale

**Stato:** 💡 proposta · **Impatto:** Medio · **Sforzo:** S

🟢 La soglia si vede solo in dashboard (`forfettarioService.js`): all'emissione (`FatturaView.vue`, `invoiceRoutes.js`) non c'è nessun controllo.

🟡 Prima di emettere: incassato dell'anno + fatture non ancora incassate + questa fattura.
- All'80% di 85.000 o 100.000 € ⇒ avviso. L'80% è una scelta dell'app, non un valore di legge.
- Oltre 100.000 € ⇒ conferma esplicita: se incassati nell'anno, il regime cessa subito e l'IVA è dovuta già da quella fattura.
- Un limite personale facoltativo (es. 80.000 €) ⇒ oltre, conferma esplicita.

Si fa insieme a FP-002, con la stessa funzione.

**Riferimenti:** `forfettarioService.js`, `backend/src/routes/invoiceRoutes.js`, `frontend/src/views/FatturaView.vue`; collegata a FP-002
**Piano di dettaglio:** — (da redigere quando passa a 🔍) · piano di massima: [FEATURES_GAP_ANALISI_ESTERNA.md](../Plans/FEATURES_GAP_ANALISI_ESTERNA.md) voce 11

---

## FP-029 — Blocco della data fattura nel futuro

**Stato:** ✅ implementata 2026-09-30 (commit: 561fc8a; validazione in `fatturaPaXmlValidator.js`, non sull'import XML: sono fatture già emesse) · ex 💡 proposta · **Impatto:** Basso · **Sforzo:** S

🟢 Nessun controllo sulla data in `fatturaPaXmlValidator.js`/`invoiceService.js`. Lo SDI scarta una fattura con data successiva alla ricezione (errore 00403).

🟡 Un controllo pre-invio (fuso Europe/Rome) nel validator esistente, con il suggerimento di `scartoSuggerimenti.js`. Vale anche per l'import XML.

**Riferimenti:** `backend/src/services/fatturaPaXmlValidator.js`, `scartoSuggerimenti.js`
**Piano di dettaglio:** — (da redigere quando passa a 🔍) · piano di massima: [FEATURES_GAP_ANALISI_ESTERNA.md](../Plans/FEATURES_GAP_ANALISI_ESTERNA.md) voce 12

---

## FP-030 — Dati di pagamento in fattura

**Stato:** ✅ implementata 2026-09-30 (commit: 2c28f8c; XML, UI impostazioni/cliente, riquadro PDF con QR, modalità Bitcoin) · ex 💡 proposta · **Impatto:** Medio · **Sforzo:** S-M

🟢 `fatturaPaXmlGenerator.js` non scrive il blocco `DatiPagamento` e non esiste un campo IBAN.

🟡 Nella fattura elettronica: modalità di pagamento (bonifico, carta, contanti, addebito SEPA…), IBAN solo per le modalità che lo usano, data di scadenza calcolata dai giorni configurati. Valori predefiniti in configurazione, sovrascrivibili per cliente, con controllo di validità dell'IBAN. Stessi dati nell'anteprima e nel PDF. Senza configurazione, l'XML resta identico a oggi.

**Riferimenti:** `backend/src/services/fatturaPaXmlGenerator.js`, `configService.js` (`CLIENTE_VUOTO`)
**Piano di dettaglio:** — (da redigere quando passa a 🔍) · piano di massima: [FEATURES_GAP_ANALISI_ESTERNA.md](../Plans/FEATURES_GAP_ANALISI_ESTERNA.md) voce 13

---

## FP-031 — Rivalsa INPS 4% facoltativa

**Stato:** 💡 proposta · **Impatto:** Medio · **Sforzo:** S-M

🟢 Oggi è esclusa per scelta (`fatturaPaXmlGenerator.js:6`, `FatturaView.vue:405` "Rivalsa INPS: assente").

🟡 Chi è iscritto alla gestione separata può aggiungere in fattura il 4% di rivalsa a carico del cliente (L. 662/96 art. 1 c. 212). È facoltativa, attivabile in generale e per cliente. In XML va il blocco `DatiCassaPrevidenziale` (`TC22`). La rivalsa **è ricavo**: entra in fatturato, soglia e imposta. Senza flag, l'XML resta identico.

🟡 Da verificare prima di implementare: se la rivalsa entra nella base dei 77,47 € del bollo.

**Riferimenti:** `backend/src/services/fatturaPaXmlGenerator.js`, `forfettarioService.js`, `frontend/src/views/FatturaView.vue:405`
**Piano di dettaglio:** — (da redigere quando passa a 🔍) · piano di massima: [FEATURES_GAP_ANALISI_ESTERNA.md](../Plans/FEATURES_GAP_ANALISI_ESTERNA.md) voce 14

---

## FP-032 — PEC guidata: gestori preconfigurati, prova passo-passo, PEC di prova allo SDI

**Stato:** ✅ implementata 2026-09-30 (commit: e96d46a; host dei gestori da rileggere sulle pagine ufficiali, `verificatoIl` ancora null) · ex 💡 proposta · **Impatto:** Medio · **Sforzo:** M

🟢 `StepPec.vue` chiede host e porte a mano. `pecService.js` non ha una prova di connessione.

🟡 Tre aiuti:
1. **Gestori preconfigurati** (Aruba, Poste, Postel, InfoCert…, più "Altro"): basta indirizzo e password. Un avviso spiega quando serve una password apposita per i programmi di posta, per esempio con la verifica in due passaggi.
2. **Prova passo-passo** senza inviare nulla: collegamento e accesso SMTP, poi collegamento e accesso IMAP, ognuno con l'esito e un messaggio chiaro.
3. **PEC di prova allo SDI**: una PEC senza allegato, a cui lo SDI risponde con un "messaggio di cortesia". Verifica il canale senza un invio vero, visto che per chi usa la PEC non esiste un ambiente di prova. Richiede conferma. Le risposte si leggono in sola lettura e non si mescolano alle ricevute delle fatture.

Nessuna dipendenza nuova (`nodemailer`, `imapflow` già presenti).

**Riferimenti:** `frontend/src/components/wizard/StepPec.vue`, `backend/src/services/pecService.js`, `sdiRicevuteService.js`
**Piano di dettaglio:** — (da redigere quando passa a 🔍) · piano di massima: [FEATURES_GAP_ANALISI_ESTERNA.md](../Plans/FEATURES_GAP_ANALISI_ESTERNA.md) voce 18

---

## Review Checklist

- **Completeness:** copre i gap fiscali/operativi individuati in questa revisione del prodotto. Non è un elenco esaustivo di ogni possibile miglioramento — solo le voci con impatto Alto/Medio ritenute concrete.
- **Accuracy:** ogni voce cita `file:riga` verificato sul codice al momento della stesura (2026-09-18; FP-011…FP-014 aggiunte 2026-09-23; FP-015…FP-032 aggiunte 2026-09-26 da un'analisi comparativa di un progetto esterno dello stesso dominio, descritte qui come funzionalità as-is per Timesheet).
- **Consistency:** confidence tag assegnati per singola affermazione, non per intera voce; le dipendenze dichiarate (FP-003 → FP-001, FP-007 → FP-001, FP-009 → FP-008, FP-012 → FP-011, FP-013 → FP-012, FP-014 → FP-011, FP-016 → FP-015/FP-023/FP-024, FP-019 → FP-006, FP-020 → FP-011/FP-018, FP-022 → FP-019/FP-021, FP-023 → FP-015, FP-024 → FP-023, FP-025 → FP-021/FP-023, FP-028 → FP-002) sono coerenti con l'ordine dei numeri. FP-015 raccoglie FP-001 e FP-003; FP-022 risolve FP-006.
- **TODO:** rileggere FP-001 e FP-007 quando cambiano le aliquote INPS dell'anno (fonte da versionare, vedi FP-006/FP-019); ridiscutere FP-008/FP-009 se emerge una richiesta esplicita di integrazione AI esterna; verificare se il flag di FP-010 debba estendersi anche a FP-008/FP-009 una volta implementate.
- **Missing information:** le stime di Impatto/Sforzo sono giudizi non validati con un prototipo o con l'utente finale oltre all'autore della revisione.
- **Open questions:** se e quando FP-008/FP-009 passano da proposta a analisi è una decisione di prodotto, non presa qui.
- **Confidence level:** misto 🟢/🟡/🔴, taggato per singola affermazione in ogni voce.
