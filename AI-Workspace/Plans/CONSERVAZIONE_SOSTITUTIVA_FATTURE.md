# Piano: conservazione sostitutiva a norma delle fatture elettroniche

Confidence: 🟢 confermato da codice · 🟡 inferito · 🔴 ipotesi

Nota: tracciato su Gogs (locale), escluso solo dal sync verso GitHub (skill `sync-public`) — non pubblicato.

## Obbligo normativo (non tecnico — informazione fiscale)

🔴 La normativa italiana (CAD art. 44, DPCM 3/12/2013, provvedimenti Agenzia Entrate) impone che le fatture elettroniche siano conservate **a norma** per **10 anni** dalla data dell'ultima registrazione, su un sistema di conservazione digitale accreditato (AgID) o tramite il servizio gratuito di conservazione offerto da Agenzia delle Entrate. Un semplice salvataggio di file XML/ricevute su disco locale **non soddisfa** questo obbligo: manca la marca temporale, il pacchetto di archiviazione, l'immutabilità certificata e l'esibizione a norma in caso di controllo.

Questo non è un'opinione tecnica del progetto: è materia fiscale/legale. Il contenuto normativo qui riportato va verificato con un commercialista o consulente fiscale — questo piano descrive solo il gap tecnico e le opzioni di integrazione, non sostituisce un parere professionale.

## Gap nel codice attuale

🟢 L'app genera e invia FatturaPA via SDI (`fatturaPaXmlGenerator.js`, `pecService.js`) e riceve le ricevute SDI via IMAP, salvandole come file grezzi su una cartella locale configurabile (`sdiRicevuteService.js:121` `percorsoArchivio`, smistate in `<archivio>/<anno>/<esito>/`).

🟢 Non esiste in nessun punto del codice un'integrazione con un servizio di conservazione sostitutiva accreditato: `grep` su `conservazione|conservatore|marca temporale|accreditat` in `backend/src` non trova nulla.

🟢 `percorsoArchivio` è una cartella filesystem qualunque scelta dall'utente in Impostazioni (`config.sdi.percorsoArchivio`) — nessuna garanzia di immutabilità, nessuna marca temporale, nessun pacchetto di versamento conforme alle regole tecniche AgID.

Conclusione: oggi l'app copre emissione/invio/ricezione ma **non** l'obbligo di conservazione a norma. L'operatore deve occuparsene fuori dall'app (es. servizio gratuito Agenzia Entrate, o conservatore accreditato terzo tipo Aruba/InfoCert/Namirial), oppure l'app va estesa per automatizzare l'invio al conservatore.

## Cloud storage generico (Google Drive, Dropbox, OneDrive) — non è conservazione a norma

🟢 Verificato su fonti ufficiali (Agenzia delle Entrate, guide di settore, settembre 2026): salvare gli XML/ricevute su Google Drive, Dropbox o OneDrive **non soddisfa** l'obbligo di conservazione, a prescindere da impostazioni di sola-lettura o versioning. Il processo di conservazione a norma richiede firma digitale/marca temporale sul pacchetto di archiviazione, immutabilità certificata dal sistema, un pacchetto di versamento/archiviazione conforme alle regole tecniche AgID, e un soggetto responsabile della conservazione — nessuno di questi requisiti è coperto da uno storage cloud generico. Nessuna fonte ufficiale (AE, AgID) riconosce questi servizi come sistema di conservazione valido. Restano solo due strade legalmente valide: conservatore accreditato AgID (Aruba, InfoCert, Namirial, ecc.) o servizio gratuito di Agenzia delle Entrate.

## Servizio di conservazione gratuito Agenzia Entrate — nessuna API, solo adesione manuale

🟢 Verificato sul portale ufficiale AE (`agenziaentrate.gov.it`, sezione "Il servizio di conservazione a norma"): il servizio è accessibile solo tramite l'area riservata del portale "Fatture e Corrispettivi" (login SPID/CNS/Fisconline), con adesione manuale — consultazione del Manuale del servizio, lettura e sottoscrizione dell'Accordo di servizio. **Non esiste un'API pubblica documentata per automatizzare l'adesione o l'invio al conservatore AE da un gestionale esterno.** Copre solo fatture già transitate da SDI, con recupero retroattivo limitato al 1° gennaio del secondo anno precedente l'adesione. Nessuna esclusione trovata per il regime forfettario (RF19): il servizio è utilizzabile da qualunque soggetto IVA che vi aderisce.

Da non confondere con le **API SDI per invio/ricezione fatture** (es. Aruba `fatturazioneelettronica.aruba.it/apidoc`, OpenAPI): quelle sono un servizio diverso, a pagamento, di terze parti, e sono già coperte dal progetto via `fatturaPaXmlGenerator.js` + `pecService.js` — non riguardano la conservazione.

Conclusione pratica: l'unico modo per automatizzare via software l'invio a un conservatore è tramite un conservatore commerciale terzo con API (Opzione C sotto). Il servizio gratuito AE resta un'opzione solo ad adesione/gestione manuale dell'utente sul portale, fuori dall'app.

## Opzioni

### Opzione A — nessuna integrazione, solo promemoria/documentazione in-app
Aggiungere un avviso nella UI (es. in Impostazioni → SDI, o nella vista Cronologia PEC) che ricorda che le fatture archiviate localmente (o su cloud storage generico) **non** sono in conservazione a norma, con link al servizio gratuito di Agenzia delle Entrate (adesione manuale sul portale Fatture e Corrispettivi) o a un conservatore accreditato terzo. Zero integrazione tecnica, zero nuove dipendenze — solo consapevolezza per l'utente forfettario che probabilmente gestisce la conservazione altrove o non lo sa.

Costo: minimo (una stringa + un link in UI). Non risolve l'obbligo, lo rende visibile.

### Opzione B — export periodico del pacchetto per upload manuale al conservatore
Nuovo servizio che, su base periodica o a richiesta, prepara uno zip/pacchetto con XML fattura + ricevute SDI associate + metadati (numero, data, cliente), pronto per l'upload manuale sul portale del conservatore scelto dall'utente (Agenzia Entrate o terzo — entrambi richiedono comunque un passo manuale, l'AE non ha un'API di invio). Riusa il pattern già esistente di `backupService.js` (stesso `setInterval` di polling, vedi `DECISIONS.md` "Background polling... one shared pattern") e la struttura file già presente in `percorsoArchivio`.

Costo: un service nuovo, riuso pattern esistente, nessuna nuova dipendenza (zip via libreria già installata se presente, altrimenti valutare se serve). Non è automazione end-to-end: l'ultimo passo (upload) resta manuale in ogni caso, anche verso AE.

### Opzione C — integrazione diretta via API con un conservatore accreditato terzo
Automatizzare l'invio delle fatture al momento della generazione/ricezione ricevuta verso l'API di un conservatore commerciale (es. Aruba, InfoCert espongono API REST/SOAP a pagamento). **Il servizio gratuito di Agenzia Entrate è escluso da questa opzione**: non espone API, solo portale web ad adesione manuale. Richiederebbe: credenziali del conservatore in config (stesso trattamento sicurezza di `pec`/`oauth` già in `config.json`, va in `.gitignore` se non già coperto — verificare, `config.json` è già escluso), nuovo service `conservazioneService.js`, chiamata sincrona o in coda dopo l'invio PEC riuscito.

Costo: il più alto — dipende dal conservatore scelto (ogni provider ha API diverse, nessuno standard comune), costi ricorrenti del servizio esterno (a differenza del servizio AE che è gratuito ma manuale), gestione errori/retry per chiamate esterne fallite. Da valutare solo se l'utente ha già un conservatore con API disponibile.

## Raccomandazione

Partire da **Opzione A** (subito, a costo minimo) per chiudere il rischio di "l'utente non sa che gli manca un pezzo dell'obbligo fiscale", specificando chiaramente che cloud storage generico (Drive/Dropbox/OneDrive) non è una soluzione valida. Valutare **Opzione B** solo se l'utente conferma di voler usare il servizio gratuito di Agenzia delle Entrate manualmente ma vuole l'app che prepara il pacchetto. **Opzione C** solo su richiesta esplicita e con conservatore commerciale già scelto (l'AE non è integrabile via API, le API dei conservatori terzi non sono intercambiabili, va scritta per il provider specifico).

## Domande aperte per l'utente

- Il forfettario usa già un servizio di conservazione (Agenzia Entrate gratuito o un conservatore terzo) gestito fuori dall'app, o oggi non fa conservazione a norma affatto?
- Se sceglie Opzione C, quale conservatore commerciale ha già/vuole usare? (determina se l'API è anche disponibile e a che costo — l'AE è comunque esclusa da questa opzione)
- Verificare con il commercialista se il regime forfettario ha specificità sull'obbligo di conservazione rispetto al regime ordinario (fuori scope tecnico di questo progetto).
