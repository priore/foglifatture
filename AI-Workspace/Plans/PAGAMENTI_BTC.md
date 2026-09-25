# Piano: tracciamento incassi fatture in Bitcoin (BTC)

Confidenza: 🟢 confermato (dal codice o da una norma citata) · 🟡 inferito o da far confermare al commercialista · 🔴 ipotesi

Nota: tracciato su Gogs (locale), escluso solo dal sync verso GitHub (skill `sync-public`) — non pubblicato.

## Obiettivo

Consentire all'operatore (professionista in regime forfettario, emittente delle fatture) di registrare che una fattura, emessa in EUR, è stata incassata in tutto o in parte in BTC. Per ogni incasso si conservano i dati richiesti da un controllo: TXID, quantità in satoshi, cambio EUR/BTC applicato con la sua fonte e l'ora, indirizzo di destinazione. Il controvalore in EUR alimenta la logica di cassa del forfettario già esistente, che non va modificata.

Il documento di partenza (`pa_btc.md`) è scritto dal punto di vista della **S.r.l. che paga**. L'app serve invece **chi incassa**. Per questo, qui sotto le regole sono verificate da entrambi i lati, e le regole lato professionista mancanti nel documento sono aggiunte.

## 1. Verifica delle regole del documento (lato S.r.l. pagante)

| # | Affermazione del doc | Esito | Note |
|---|---|---|---|
| 1 | Pagare in BTC è lecito se la fattura è in EUR e il saldo avviene al controvalore | 🟢 corretto | È una *datio in solutum* (art. 1197 c.c.): la prestazione diversa estingue il debito solo **con il consenso del creditore**, quindi serve un accordo scritto (contratto o clausola in fattura). La fattura elettronica resta in `<Divisa>EUR</Divisa>` (🟢 già fissa in `fatturaPaXmlGenerator.js:102`). |
| 2 | Per la S.r.l., usare BTC genera una plusvalenza tassabile IRES se il BTC si è apprezzato | 🟡 corretto nella sostanza | Dal 2023 l'art. 110 c. 3-bis TUIR (L. 197/2022) esclude dall'imponibile le sole *valutazioni* di bilancio. La differenza **realizzata** con la cessione (e la datio in solutum equivale a una cessione) concorre invece al reddito d'impresa. Per la classificazione in bilancio e l'eventuale rilievo IRAP decide il commercialista della S.r.l.: il problema non riguarda l'app. |
| 3 | Il costo è deducibile a prescindere dal mezzo di pagamento | 🟡 vero come regola generale, con un'eccezione | Deducibile se inerente, certo e documentato. **Eccezione dal 2025** (L. 207/2024, art. 1 c. 81-83): i **rimborsi spese** per vitto, alloggio, viaggio e trasporto addebitati in fattura sono deducibili solo se pagati con mezzi tracciabili (art. 23 D.Lgs. 241/1997: bonifico, carte, assegni ecc.). Le cripto non sono nell'elenco. Se una fattura contiene rimborsi spese di trasferta, meglio **non** farla pagare in BTC. |
| 4 | Nessuna ritenuta d'acconto, trattandosi di un forfettario | 🟢 corretto | Art. 1 c. 67 L. 190/2014. La dicitura è già emessa nell'XML (`fatturaPaXmlGenerator.js:107`). |
| 5 | Rischio tracciabilità ex D.Lgs. 231/2007 e sanzioni se il wallet non è identificato | 🔴 impreciso | Il D.Lgs. 231/2007 impone obblighi ai **soggetti obbligati** (banche, professionisti in funzione AML, CASP/exchange). Una S.r.l. commerciale che paga un fornitore non rientra tra questi. Il limite al contante (art. 49) riguarda il contante e non le cripto. Il vincolo reale sta nel **Reg. UE 2023/1113** (travel rule, applicabile dal 30/12/2024): se il BTC transita da un exchange verso un wallet self-custody e supera 1.000 €, l'exchange può chiedere la prova che il wallet appartenga davvero al destinatario (firma di un messaggio o "Satoshi test"). Il rischio concreto per la S.r.l. è perciò **probatorio**: dimostrare che ha pagato proprio il fornitore. Non esiste una sanzione "di tracciabilità" autonoma. Il rimedio indicato dal doc resta valido: un indirizzo di destinazione dichiarato per iscritto dal professionista. |
| 6 | Il criterio di cambio va fissato in contratto o in fattura | 🟢 corretto | È buona prassi, non un obbligo di legge, ed evita contestazioni sul residuo. |
| 7 | Fascicolo documentale: fattura in EUR con dicitura, TXID e indirizzi, prospetto del cambio | 🟢 buona prassi | Coincide con i dati che l'app deve conservare (§3). |

**Punto non trattato dal doc**: nel tracciato FatturaPA il campo `ModalitaPagamento` ha i codici MP01–MP23 e **nessuno è previsto per le cripto** 🟢. L'app oggi non emette il blocco `DatiPagamento` (🟢, `grep` senza risultati nel generatore XML), quindi non c'è un codice da scegliere. Basta una `<Causale>` aggiuntiva in testo libero.

## 2. Regole lato professionista forfettario (assenti nel doc)

- **Compenso incassato e principio di cassa** 🟢: art. 1 c. 64 L. 190/2014. Il compenso concorre al reddito nell'anno in cui è **percepito**. Come data dell'incasso si usa quella della transazione confermata on-chain (🟡 prassi: la ricezione nel wallet).
- **Importo del compenso** 🟡: il valore in EUR di ciò che si riceve alla data dell'incasso (valore normale, art. 9 TUIR). Se la S.r.l. invia un numero di BTC calcolato al cambio concordato, il compenso coincide con l'importo della fattura. Se il valore ricevuto non basta, la differenza resta un **residuo aperto** della fattura, gestito dal modello a rate già esistente (§4).
- **Soglia di 85.000 €** 🟢: si conta in EUR, al controvalore dell'incasso. Con `importo` in EUR su ogni rata funziona già senza modifiche.
- **BTC detenuti dopo l'incasso** 🟡: rientrano nel patrimonio personale e non nel reddito di lavoro autonomo. Una vendita o spesa successiva genera **redditi diversi** (art. 67 c. 1 lett. c-sexies TUIR):
  - aliquota 26% per il 2025 e **33% dal 1/1/2026** (L. 207/2024);
  - franchigia di 2.000 € abolita dal 2025;
  - costo fiscale di carico pari al controvalore in EUR alla data dell'incasso, che è già stato tassato come compenso (🟡 da confermare col commercialista: è il dato chiave che l'app deve conservare).
- **Monitoraggio** 🟢/🟡: quadro RW obbligatorio per le cripto detenute al 31/12 ovunque siano custodite (dal 2023, L. 197/2022), più l'imposta IC dello 0,2% sul valore (art. 19 c. 18-bis DL 201/2011). Serve il valore al 31/12, che l'app non conosce perché non traccia le spese del wallet.
- **DAC8** 🟡: dal 1/1/2026 (Dir. UE 2023/2226) i CASP comunicano all'Agenzia delle Entrate i movimenti dei clienti. Se il BTC passa da un exchange, i dati registrati nell'app devono essere coerenti con quelli comunicati.

⚠️ Norme aggiornate a metà 2026. Prima di implementare, far confermare in particolare le 🟡 (costo di carico, aliquota 2026) al commercialista.

## 3. Funzionalità proposte

Si parte dal minimo: un solo campo nuovo sulla rata esistente e nessuna nuova dipendenza.

### F1 — Incasso BTC come rata di `pagamenti[]` (core)
Oggi una rata è `{ data, importo }` (🟢 `pagamentiFattureService.js:314`, `invoiceService.js:46`). La si estende con un campo opzionale:
```js
{ data, importo /* EUR, calcolato lato server */, btc: {
    txid, satoshi, cambioEurBtc, fonteCambio, dataOraCambio, indirizzoDestinatario } }
```
- `importo` resta in EUR, quindi `arricchisciStatoPagamento`, `ricaviAnnoCassa` (`forfettarioService.js:46`) e la soglia **non cambiano**. Le rate senza `btc` si comportano come oggi e non serve alcuna migrazione.
- Il server calcola `importo = round2(satoshi / 1e8 × cambioEurBtc)` e non accetta un importo inviato dal client, così l'EUR registrato e il prospetto di cambio non possono divergere.
- Validazione: TXID di 64 caratteri esadecimali, satoshi intero > 0, cambio > 0, indirizzo non vuoto.
- Nuovo endpoint sottile `POST /pagamenti/conferma-btc` in `forfettarioRoutes.js`, accanto a `/pagamenti/conferma` (riga 185). Chiama una nuova `confermaPagamentoBtc()` in `pagamentiFattureService.js`, che riusa `getInvoice`/`saveInvoice` come `confermaPagamento`. `eliminaPagamento` funziona già.

### F2 — Indirizzi wallet dell'operatore in configurazione
`config.walletBtc: [{ etichetta, indirizzo }]` in `config.json`, che è già gitignored. Un indirizzo è pubblico ma collegato all'identità fiscale, quindi non va nel repo. Serve a proporre l'indirizzo di destinazione in F1 e la dicitura in F3. Lo si aggiunge in Impostazioni.

### F3 — Dicitura in fattura (per cliente)
Nuovo flag `config.clienti[].pagamentoBtc`. Se attivo, aggiunge una `<Causale>` all'XML (`fatturaPaXmlGenerator.js:106-108`) e la stessa riga al PDF, per esempio: *"Pagamento ammesso anche in Bitcoin (datio in solutum, art. 1197 c.c.) al controvalore dell'importo in EUR, cambio [fonte] alla data/ora di invio, all'indirizzo [indirizzo]."* Il testo è configurabile, perché il criterio di cambio va concordato col cliente.

### F4 — Recupero automatico dei dati della transazione (opzionale)
Un pulsante "Leggi da blockchain" nel form di F1 chiama `https://mempool.space/api/tx/:txid` con il `fetch` nativo, già usato per Gemini. Da lì prende l'ora del blocco e i satoshi inviati all'indirizzo di F2. **Avviso privacy** nella UI, come per Gemini: il TXID e l'IP vengono inviati a un servizio esterno. Il fallback è l'inserimento manuale.

### F5 — Cambio storico EUR/BTC (opzionale)
Un pulsante "Recupera cambio" interroga un'API pubblica gratuita (per esempio Kraken OHLC a 1 minuto, oppure CoinGecko `/coins/bitcoin/history`) e riporta **fonte e ora** del dato. Il valore resta modificabile a mano, perché prevale il criterio concordato in F3. Si invia solo un timestamp, senza dati sensibili.

### F6 — Export commercialista
`exportService.js`: nuove colonne `Metodo` (bonifico/BTC), `TXID`, `BTC`, `Cambio EUR/BTC`, `Fonte cambio`. Insieme alla fattura, questo è già il fascicolo del punto 7 della tabella in §1.

### Esclusi di proposito (voci separate in `FEATURE_PROPOSALS.md`)
- **FP-012, registro dei lotti e calcolo delle plusvalenze da redditi diversi**: richiede di tracciare anche le **uscite** dal wallet, e la metodologia (LIFO, FIFO o costo medio) non è codificata per le cripto 🔴. L'export di F6 fornisce già al commercialista il costo di carico.
- **FP-013, quadro RW e IC**: servono il saldo e il valore al 31/12, che l'app non conosce. Dipende da FP-012.
- **FP-014, import automatico dal wallet (xpub)**: rischio privacy e complessità. Da aggiungere se il volume di incassi in BTC lo giustifica.

## 3bis. Retro-compatibilità dei dati (vincolo)

Chi aggiorna l'app con dati già esistenti non deve notare alcun cambiamento né dover migrare qualcosa.

- **Fatture/rate** 🟢: `btc` è un campo **opzionale** della rata. Le rate esistenti `{ data, importo }` restano valide così come sono, e la migrazione in lettura del vecchio `dataPagamento` (`invoiceService.js:43-49`) resta intatta. Nessuno script di migrazione, nessuna riscrittura dei file JSON all'avvio.
- **Campi preservati** 🟢: `confermaPagamento` ed `eliminaPagamento` ricopiano gli oggetti rata interi, e la rigenerazione della fattura conserva `esistente.pagamenti` (`invoiceRoutes.js:149`). Un campo `btc` non viene quindi perso da nessun percorso di scrittura esistente. Da coprire con un test.
- **Downgrade** 🟡: una versione precedente dell'app ignora il campo `btc` e continua a leggere `importo` in EUR. I totali restano corretti, si perdono solo i dettagli BTC in UI.
- **Config** 🟢: `walletBtc` e `clienti[].pagamentoBtc` si aggiungono a `DEFAULT_CONFIG` e ai default per cliente, così `fondiSezione`/`fondiClienti` (`configService.js:119-158`) li riempiono in lettura. Un `config.json` vecchio funziona senza modifiche.
- **XML/PDF** 🟢: `pagamentoBtc` vale `false` di default, quindi le fatture esistenti e quelle nuove dei clienti senza flag restano **identiche byte per byte**. La rigenerazione di una fattura già inviata non cambia.
- **Export CSV** 🟡: le nuove colonne vanno **in coda**, senza spostare quelle esistenti, per non rompere i fogli o le macro del commercialista che leggono per posizione. Sulle rate non BTC le colonne restano vuote.
- **API** 🟢: `/pagamenti/conferma` resta invariata, perché il BTC ha un endpoint separato.

## 4. Passi di implementazione

Indice avanzamento (aggiornato ad ogni step concluso):

- [x] Step 1 — `confermaPagamentoBtc` + route + test (2026-09-25)
- [x] Step 2 — `configService.js`: `walletBtc` + `clienti[].pagamentoBtc` (2026-09-25)
- [x] Step 3 — Causale condizionale XML + PDF (F3) (2026-09-25)
- [x] Step 4 — Frontend `FatturaView.vue` + `api.js` (F1 UI) (2026-09-25)
- [x] Step 5 — F4: pulsante "Leggi da blockchain" (mempool.space) + avviso privacy (2026-09-25)
- [x] Step 6 — F5: pulsante "Recupera cambio" (API storica) + avviso privacy (2026-09-25)
- [ ] Step 7 — `exportService.js`: colonne F6 + test
- [ ] Step 8 — `CHANGELOG.md` + `FEATURE_PROPOSALS.md` (FP-011 ✅)

1. `pagamentiFattureService.js`: aggiungere `confermaPagamentoBtc(anno, mese, clienteId, datiBtc)` con validazione e calcolo dell'EUR, estendendo `pagamentiFattureService.test.js` (runner `--test`). Casi da coprire:
   - calcolo e arrotondamento;
   - TXID non valido;
   - satoshi a 0;
   - rata BTC più rata a bonifico che chiude il residuo;
   - **retro-compatibilità**: una fattura col vecchio formato (solo `dataPagamento`) che riceve una rata BTC mantiene lo storico, e `eliminaPagamento` conserva il campo `btc` delle altre rate.
2. `forfettarioRoutes.js`: aggiungere la route `POST /pagamenti/conferma-btc`.
3. `configService.js`: aggiungere `walletBtc` e `clienti[].pagamentoBtc` ai default, auto-generati come `DEFAULT_CONFIG`.
4. `fatturaPaXmlGenerator.js` e il generatore PDF: aggiungere la Causale condizionale (F3).
5. Frontend `FatturaView.vue` (lista pagamenti a riga 304): aggiungere un toggle "Incasso in BTC" con i campi di F1 e i pulsanti opzionali F4/F5. Nella lista rate compaiono l'icona ₿ e il TXID troncato con link a mempool.space. In `api.js` va aggiunto il metodo corrispondente.
6. `exportService.js`: aggiungere le colonne di F6 e aggiornare `exportService.test.js`.
7. Voce nel `CHANGELOG.md` sotto `[Unreleased]` e aggiornamento di FP-011 in `FEATURE_PROPOSALS.md` a ✅ con data e commit.

Stima: 1 campo opzionale su un modello esistente, 1 funzione di service, 1 route, 2 chiavi di config, 1 Causale, UI su una vista esistente e colonne di export. Nessuna nuova dipendenza.

## 5. Verifica

- `node --test backend/src/services/pagamentiFattureService.test.js exportService.test.js`.
- Retro-compatibilità:
  - avviare la nuova versione su una copia di `backend/data/` e di `config.json` pre-aggiornamento;
  - controllare che dashboard, stati delle fatture e CSV (colonne esistenti) siano identici a prima;
  - controllare che l'XML rigenerato di una fattura esistente sia identico con `diff`.
- Manuale, dopo il riavvio del backend su :1969:
  - registrare una rata BTC su una fattura di prova e controllare che stato e residuo siano corretti;
  - controllare che la dashboard forfettario conti l'EUR nell'anno giusto;
  - controllare che nell'XML compaia la Causale per il cliente con il flag;
  - controllare le colonne nel CSV del commercialista;
  - eliminare la rata e controllare che lo stato torni `aperta`.

## Domande aperte

- F4 e F5 (chiamate a mempool.space e alle API di cambio): da includere subito o da lasciare solo manuali in prima battuta?
- Quale criterio di cambio standard usare nella dicitura F3 (exchange e orario)?
- Gli incassi BTC arrivano su un wallet self-custody o su un exchange? Nel secondo caso il TXID vale comunque, ma DAC8 e travel rule si applicano.
- Serve il registro lotti (vendite di BTC) già ora, o basta il costo di carico nell'export?

## 6. Nota strategica (posizionamento/marketing)

🟡 Nessun gestionale forfettario italiano noto (Fatture in Cloud, Debitoor, Aruba e simili) traccia incassi in cripto con dati pronti per controllo fiscale (TXID, cambio, fonte). Se implementata, è un differenziatore reale, non solo una funzione tecnica.

- **Nicchia target**: freelance/consulenti IT, sviluppatori, designer, consulenti web3 — clienti esteri o cripto-nativi che pagano in BTC. Stretta ma mal servita, coerente col pubblico developer/freelance già raggiunto nel lancio (`LINKEDIN_LANCIO.md`).
- **Coerenza col posizionamento esistente**: il claim già usato ("Locale e sicuro, nessun cloud, nessun abbonamento" — vedi `docs/screenshots/fogli-fatture.jpeg`) si rafforza con "incasso BTC tracciato senza mandare wallet o dati a un SaaS terzo" (F1-F6 restano locali salvo le chiamate opzionali F4/F5, dichiarate).
- **Uso suggerito**: una volta implementata, merita un post/aggiornamento dedicato separato dal lancio iniziale (non da aggiungere retroattivamente al post già pubblicato) — feature "flagship" per differenziazione, non per il grosso degli utenti forfettari (resta nicchia, non mainstream).
- **Rischio da non minimizzare**: pubblico di nicchia. Non sostituisce le feature ad impatto Alto del backlog (FP-001…FP-005) per priorità di sviluppo — vale come leva di visibilità/differenziazione, non come the pitch principale.
