# Changelog

Tutte le modifiche rilevanti al progetto sono documentate in questo file.

Formato basato su [Keep a Changelog](https://keepachangelog.com/it-IT/1.1.0/).

## [Unreleased]

## [1.10.0] - 2026-10-21

### Added
- **Da accantonare** — nella dashboard, quanto mettere da parte per imposta e contributi
  - Quota prudente costante sugli incassi, mostrata nelle fatture da incassare, nella registrazione di incassi in BTC o valuta estera e nell'import CSV dei pagamenti
  - Totale accantonato dell'anno e cassa residua dopo ogni scadenza F24, con avviso di scoperto
- **Nota di credito (TD04)** — nella pagina Fattura, per una fattura già accettata dallo SDI
  - Storno totale o parziale, con conferma esplicita; una nota per fattura
  - Prende il prossimo numero della sequenza, con XML collegato alla fattura stornata, download e invio PEC
  - La fattura stornata esce dal dovuto e dai ricavi per competenza; se era già stata pagata, l'app segnala la somma da rimborsare
- **Prospetto per la dichiarazione dei redditi** — nel tab F24 una card a larghezza piena con i valori da riportare nel modello Redditi PF
  - Quadro LM (ricavi, reddito, contributi, imposta sostitutiva, acconti, saldo o credito), quadro RR per la gestione separata e rigo RX31
  - Caselle disposte come nel modello ufficiale, con colonna e titolo, come nel quadro RW: un clic copia il valore
  - Le caselle a zero non si mostrano
  - Perdite pregresse, crediti d'imposta ed eccedenze della dichiarazione precedente non sono noti all'app: le caselle sono evidenziate «da controllare» e rimandano alla nota
  - PDF del quadro LM compilato sul modello ufficiale dell'Agenzia delle Entrate, con codice fiscale, numero modulo e dicitura «bozza da verificare»
  - Il modello si scarica dal sito dell'Agenzia al primo uso: se esce una nuova edizione la stampa si blocca con un messaggio chiaro
- **Card Quadro RW come il modello ufficiale** — le caselle replicano colonne e righi del Redditi PF
  - RW1 con colonne 1-34 e RW8 con colonne 1-6, ciascuna con numero e titolo
  - Clic su una casella per copiarne il valore, importi in euro interi
  - Valore iniziale (colonna 7) calcolato anche per i lotti acquistati nell'anno, con campo per il prezzo al 31/12 dell'anno precedente
- **Avviso coefficiente unico** — spunta «Ho altre attività con coefficiente di redditività diverso» nel passo Fornitore
  - Segnala in dashboard e nel piano versamenti che l'app calcola con un solo coefficiente
- **Stime provvisorie e trasparenza** — le stime fiscali sono marcate come provvisorie se le regole dell'anno non sono confermate o non sono state verificate da oltre 12 mesi
  - Badge "provvisorio" sui versamenti stimati F24
  - Sotto il piano: anno delle regole, data di verifica, data di conferma e link alle fonti
- **PDF F24 con dicitura "bozza da verificare"** — riga a margine, senza coprire i campi del modello; con regole provvisorie riporta anche l'anno
  - Pulsante di scaricamento attivo solo dopo aver spuntato "Ho verificato gli importi"
- **Avvisi di verifica** — prima dell'emissione della fattura, nel riepilogo delle plusvalenze BTC e accanto all'export per il commercialista
  - Le note non entrano mai nel PDF, nell'XML né nel CSV
- **Termini d'uso** — accettazione esplicita al primo avvio e dopo ogni aggiornamento dei termini
  - Approvazione specifica separata della clausola di limitazione di responsabilità
- **Gestione cliente** — nuovo selettore per cliente in Clienti
  - Timesheet e fatture: fatture a importo calcolato o libero
  - Solo fatture: importo sempre libero, senza scelta calcolato/libero né tariffa oraria
  - Con un cliente "solo fatture" selezionato la voce Timesheet sparisce dal menu, dinamicamente al cambio cliente
  - Se tutti i clienti attivi sono "solo fatture", Timesheet resta sempre nascosto

### Changed
- **Colori dei pulsanti uniformati** in tutte le viste e i popup
  - Palette pastello per categoria di azione (avanzamento, salva/conferma, esporta/scarica, AI, elimina/scarta), identica per tutte le azioni della stessa categoria
  - Tonalità distinguibili anche da chi ha difficoltà con i colori, leggibili in tema chiaro e scuro
- **Clienti per categoria** — le informazioni di ogni cliente sono suddivise in sotto-card
  - Anagrafica, sede, regime IVA estero, dati PDF timesheet, gestione, email, pagamento, template
- **Checkbox in tema scuro** — bordo delle caselle non spuntate più visibile
- **Pagamenti registrati in Fattura** — ogni incasso è una card con data, importo e pulsante Elimina
  - Transazione BTC come chip con icona ₿ e TXID abbreviato, che apre mempool.space
  - Incasso in valuta estera con importo, cambio e fonte in un badge sotto la riga

### Fixed
- **Fatture ricevute via PEC** — il controllo ricevute SDI ne registra l'email e non le rielabora se tornano non lette
- **Ricevute SDI da PEC** — riconosciute anche quando arrivano in email annidate dentro altre email, e con le radici XML ufficiali
  - Le fatture ricevute nella casella non vengono più scambiate per ricevute
- **Percorso dati** — chi aveva spostato i dati con la versione precedente può ricollegarli indicando la stessa cartella in Impostazioni, senza spostare nulla
- **Import fatture XML e ZIP** — le fatture ricevute (cedente diverso dall'operatore) non vengono più importate come emesse né creano clienti fittizi; nell'anteprima ZIP risultano ignorate
- **F24 cripto** — il campo rateazione delle righe 1727 e 1728 riporta 0101 per il pagamento in unica soluzione, come da Risoluzione 10/E del 2024
- **Nota import BTC in Impostazioni → Fornitore** — indica la vista Bitcoin (Importa BTC) come posizione delle proposte da confermare, al posto della dashboard
- **Percorso dati spostato** — dopo «Sposta dati qui» e un riavvio l'app ritrova la cartella scelta invece di ripartire vuota
  - Il percorso scelto è salvato in un file locale fuori dalla cartella dati, quindi non si perde più
  - Se la cartella non è raggiungibile (disco scollegato) l'avvio si ferma con un messaggio chiaro, senza creare un archivio vuoto
  - Chi aveva già spostato i dati con la versione precedente deve ripristinare il percorso a mano: i dati sono intatti nella cartella scelta
    1. Individua la cartella dei dati
       - È la cartella che avevi scelto in Impostazioni → Percorso dati
       - Dentro c'è il file `config.json`
       - Copia il suo percorso completo
    2. Crea il file di collegamento nella cartella `backend` dell'app
       - macOS: apri il Terminale e incolla, sostituendo il percorso:
         `echo '{"percorso":"/percorso/della/cartella/dati"}' > ~/Library/Application\ Support/FogliFatture/backend/.percorso-dati.json`
       - Windows: apri `%LOCALAPPDATA%\FogliFatture\backend` e crea con il Blocco note un file chiamato `.percorso-dati.json` (salva come «Tutti i file»)
       - Contenuto del file su Windows, con i percorsi scritti con `/` oppure con `\\`: `{"percorso":"D:/Dati/FogliFatture"}`
    3. Riavvia l'app
       - Riavvia il computer, oppure esci e rientra dall'account di sistema
       - All'apertura ritrovi fornitore, clienti, fatture e timesheet
- **Installazione da terminale** — Git mancante non blocca più l'installazione
  - Gli script installano Git e Node.js se assenti: winget su Windows, Homebrew o Command Line Tools su Mac
  - README: istruzioni Windows 11 riviste (Sicurezza di Windows, Smart App Control) e passo di installazione Git

## [1.9.0] - 2026-10-19

### Added
- **Registro BTC e plusvalenze** — tracciamento di ingressi e uscite di bitcoin con calcolo delle plusvalenze da redditi diversi:
  - lotti di carico ricavati dalle rate incassate in BTC, più ingressi manuali per BTC acquistati o ricevuti altrove
  - uscite (vendita, spesa, trasferimento) con costo di carico LIFO e anteprima della plusvalenza prima di salvare
  - tabella movimenti con colonna «Tipo» che indica l'origine di ogni riga (fattura, manuale, import da file o automatico)
  - minusvalenze riportate negli anni successivi, aliquota e regole lette dalle regole fiscali dell'anno
  - nuova voce «Bitcoin» nel menu con Registro BTC e Importa BTC; card «Plusvalenze» e riepilogo nella tab Bitcoin della dashboard
  - valore in tempo reale di 1 BTC e dei BTC detenuti: card in cima alla vista Bitcoin; nella tab Bitcoin della dashboard «Valore BTC di mercato», «Valore BTC detenuti» e «Valore attuale» sono le prime card
- **Quadro RW e imposta sulle cripto-attività** — calcolo dell'imposta dello 0,2% proporzionale ai giorni di detenzione:
  - card «Quadro RW» con saldo, valore al 31/12 inserito dall'utente, giorni di possesso e imposta dovuta
  - righe 1715, 1727, 1728 e 1729 nel piano F24, con acconti già versati sottratti dal saldo
  - nuove sezioni nell'export per il commercialista: registro lotti, uscite e riepilogo cripto
- **Import automatico transazioni BTC** — proposte di import da confermare o scartare, mai registrate in automatico:
  - controllo periodico degli indirizzi configurati, con doppio provider e conferme minime
  - import da file CSV/JSON (Sparrow, Electrum, Kraken, Binance, Coinbase, One Trading) con mappatura colonne proposta dall'AI per i formati sconosciuti
  - disattivato di default, si abilita in Impostazioni → Fornitore dopo aver accettato l'avviso privacy

## [1.8.0] - 2026-10-16

### Added
- **Rivalsa INPS nei template fattura** — la riga «Rivalsa INPS 4%» compare nel PDF quando la rivalsa è attiva:
  - presente in tutti e 5 i template fattura
  - nota accanto all'impostazione che spiega l'effetto sul bollo
- **Suggerimento AI sull'ordine dei crediti F24** — pulsante "Suggerisci ordine con AI" nella card Crediti compensabili:
  - propone in che ordine usare i crediti (prima i verticali, poi gli orizzontali) con una motivazione breve, tenendo conto delle scadenze e della soglia di 5.000 €
  - invia all'AI importi e codici tributo: chiede conferma a ogni richiesta ("Sì, questa volta" / "Sì, sempre")
  - consenso permanente attivabile in Impostazioni → AI
- **Codice sede INPS nell'F24** — scelta della sede da un elenco ufficiale con ricerca:
  - disponibile in Impostazioni → Fornitore con gestione separata
  - il codice viene stampato nella sezione INPS dell'F24 in PDF
- **Card regole fiscali dell'anno in dashboard** — riepilogo di aliquote, soglie, scadenze di saldo e acconti e aliquota gestione separata, in cima alla tab Regole fiscali
- **Avvisi in dashboard sulle regole fiscali** — il banner segnala anche una proposta di aggiornamento normativo da verificare e la modifica di una fonte ufficiale
- **Notifiche fiscali in background** — il backend notifica automaticamente gli eventi fiscali rilevanti mentre l'app è in esecuzione:
  - F24 in scadenza entro 7 giorni o già scaduto senza pagamento
  - F24 programmato: ultimo giorno per annullare l'addebito bancario
  - Bollo trimestrale in scadenza entro 7 giorni (con rinvii già applicati)
  - Credito F24 che raggiunge la data di utilizzo
  - Regole fiscali: nessuna regola confermata per l'anno corrente, oppure aggiornamento disponibile
  - Intrastat trimestrale in scadenza entro 7 giorni (solo se VIES attivo e clienti UE presenti)
  - Errori IMAP/PEC: notifica una sola volta dopo 3 cicli consecutivi falliti, non ad ogni giro
  - Tutte le notifiche rispettano il toggle "Notifiche desktop abilitate" e la deduplicazione 24 ore
- **Chat AI nella dashboard** — nuova tab «AI» per interrogare i tuoi dati in linguaggio naturale, senza uscire dall'app:
  - legge gli stessi dati aggregati del server MCP (fatturato, incassi, scadenze, F24, bollo, crediti, fatture)
  - sola lettura: non emette fatture, non modifica dati e non invia nulla
  - anagrafica, codice fiscale, IBAN e credenziali non sono accessibili
  - domande suggerite sotto la casella di inserimento, cliccabili
  - chiede il consenso prima di inviare dati fiscali al provider AI (per questa volta o sempre)
- **Server MCP in sola lettura** — interroga i tuoi dati fiscali dal client AI (Claude Desktop, Claude Code, ChatGPT, Gemini):
  - esposti solo dati aggregati: riepilogo anno, scadenze, F24, bollo trimestrale, crediti, elenco fatture, regole fiscali
  - mai esposti anagrafica, codice fiscale, IBAN, password e token
  - non può emettere fatture, modificare impostazioni né inviare PEC
  - disattivato di default: si abilita in Impostazioni → AI, che mostra i comandi pronti da incollare

### Fixed
- **Stima F24: arrotondamenti e acconti INPS** — la stima dei versamenti segue le regole della dichiarazione:
  - reddito, imposta, saldi e contributo INPS in euro interi
  - acconti INPS dell'anno successivo calcolati con l'aliquota dell'anno successivo
- **Acconto suggerito in dashboard coerente con il piano F24** — l'acconto dell'anno successivo usa ora la stessa base del piano:
  - imposta per cassa (incassi proiettati a fine anno), al netto dei contributi INPS versati
  - nessun acconto se l'imposta è sotto la soglia di non dovuto
- **Uscita dal forfettario oltre 100.000 €** — l'avviso e il blocco del piano F24 scattano ora quando i ricavi incassati superano 100.000 €, non quando il reddito calcolato supera quella cifra
- **Bollo con rivalsa INPS** — la rivalsa concorre ora alla soglia di 77,47 € per l'imposta di bollo, come indicato nelle impostazioni (prima contava solo il compenso)
- **Checkbox con stile uniforme** — in Impostazioni (backup, polling SDI) e nella selezione dei file ZIP le checkbox ora hanno lo stesso aspetto dell'app
- **Descrizione delle notifiche desktop** — il testo del toggle in Impostazioni → Promemoria e la nota di rilascio 1.7.0 elencavano anche notifiche di scadenze F24, bollo e aggiornamenti regole fiscali, non ancora attive. Ora descrivono solo le notifiche realmente presenti: promemoria timesheet, backup, ricevute SDI e monitoraggio fonti normative.

### Changed
- **Bollo e dati di pagamento nel Fornitore** — il passo «Tariffa & fiscali» di Impostazioni non esiste più:
  - soglia/importo bollo virtuale e dati di pagamento in fattura (IBAN, modalità, scadenza) sono card separate in Impostazioni → Fornitore
  - le card del Fornitore sono suddivise in tab (Anagrafica, Fiscale, Fatturazione) con un unico Salva
- **Card INPS in Impostazioni** — le impostazioni previdenziali (gestione, sede, altra copertura, rivalsa 4%) sono raccolte in una card separata
- **Monitoraggio fonti: testo dei PDF** — le fonti normative in PDF vengono ora lette come testo:
  - le modifiche si rilevano sul contenuto, non sui byte del file
  - le proposte di aggiornamento delle regole fiscali funzionano anche per le fonti PDF con testo archiviato
  - ora monitorati anche Circolare INPS 8/2026, Risoluzione AdE 110/E/2019, Specifiche tecniche FatturaPA 1.9.1 e D.Lgs. 33/2025 (da fonti ufficiali)

## [1.7.0] - 2026-10-12

### Added
- **Monitoraggio fonti normative completo** — il controllo periodico delle fonti ora supporta:
  - Strategia "finestra di testo" per le proposte AI: i campi con citazioni oltre i primi 8.000 caratteri del documento vengono analizzati con una finestra centrata sulla posizione della citazione (risolve il limite per L. 190/2014 e L. 662/1996).
  - Conferma/scarto proposte AI: nuovi pulsanti "Applica proposte AI" e "Scarta proposte" in Impostazioni → Regole fiscali applicano o eliminano selettivamente i valori proposti dall'AI, senza toccare il pacchetto versionato.
  - Nota limite UI: avviso in fondo al pannello che un atto normativo non ancora nel registro non viene rilevato dal monitoraggio (per questo esiste la ricerca AI dedicata).
- **Toggle globale notifiche desktop** — nuovo campo in Impostazioni → Promemoria: disabilitando "Notifiche desktop abilitate" nessuna notifica viene mostrata (promemoria timesheet, backup, ricevute SDI, monitoraggio fonti normative). Il promemoria fine mese è subordinato al toggle principale. Notifiche cross-platform via `node-notifier` (macOS, Windows, Linux).
- **Compensazione crediti fiscali nell'F24** — nuova card "Crediti compensabili F24" nella tab F24 della dashboard:
  - Registrazione manuale di crediti fiscali (es. imposta sostitutiva pagata in eccesso, saldo a credito) con codice tributo, anno di riferimento, importo e data di disponibilità.
  - La compensazione si applica al momento di creare un F24 (non modifica la stima): riduce le righe debitorie e traccia gli utilizzi nelle righe F24.
  - Compensazione verticale (stesso codice tributo, es. 1792 su 1790/1791): esente dal limite dei 5.000 € e dal visto di conformità (Ris. AdE 110/E/2019).
  - Compensazione orizzontale: limitata a 5.000 €/anno; l'app avvisa che è richiesta la presentazione della dichiarazione almeno 10 giorni prima e, oltre la soglia, il visto di conformità (DL 124/2019 art. 3).
  - F24 a saldo zero: avviso che deve essere presentato esclusivamente per via telematica (D.L. 66/2014).
- **Rateizzazione saldo F24** — nella card "Versamenti stimati F24" è possibile scegliere il numero di rate per saldo + I acconto (da 1 a 7, fino al 16 dicembre):
  - Il selettore calcola automaticamente le date di pagamento (primo giorno lavorativo, con slittamento di agosto), gli interessi erario (codice `1668`) e INPS (causale `DPPI`), le causali INPS rateizzate (`PXXR`/`P10R`), secondo il DM 21/5/2009 art. 5 e la tabella AdE.
  - La scelta viene salvata e vale anche per il PDF F24 e la creazione degli F24 programmati.
- **Fatture in valuta estera** — è possibile emettere fatture in USD, GBP, CHF e altre valute riconosciute dalla Banca d'Italia:
  - Il campo *Valuta fattura* in Fattura Pro-Forma imposta la divisa della fattura (default EUR); il pulsante *Recupera cambio* ottiene il tasso ufficiale Banca d'Italia per la data della fattura, con ripiego automatico ai giorni precedenti in caso di festività.
  - Il cambio viene congelato alla generazione e incluso nell'XML FatturaPA come `<Divisa>` e `<Causale>` con il controvalore in EUR (art. 13 c. 4 DPR 633/72).
  - Il pulsante *€ Registra incasso in valuta estera* registra l'incasso con importo, cambio e fonte; l'EUR equivalente è calcolato dal backend (`importo / cambio`).
- **Registro fonti normative** — ogni valore nelle Regole fiscali mostra ora un pulsante 📄 accanto al riferimento normativo:
  - Cliccando si apre un popup con l'estratto del testo di legge archiviato, con la citazione pertinente evidenziata in giallo e contesto circostante.
  - Il popup include il link "Apri testo integrale" a Normattiva.
  - I testi sono archiviati localmente in `backend/src/data/fonti/testi/` (verificati e corretti rispetto al testo ufficiale).
  - Se il testo non è ancora archiviato per quella fonte, il pulsante è silenzioso (nessun errore visibile).
- **AI ausilio normativo** — pulsanti opzionali (richiedono un provider AI configurato in Impostazioni → AI):
  - **"Spiega con AI"** accanto alla checkbox *requisiti aliquota agevolata 5%* (Impostazioni → Fornitore): spiega in italiano semplice i requisiti di L. 190/2014 c. 65.
  - **"Spiega con AI"** accanto alla checkbox *art. 7-septies* nel wizard cliente (visibile solo per privati extra-UE): spiega se le prestazioni rientrano nell'art. 7-septies DPR 633/72.
  - Risposta in popup con formattazione markdown (titoli, elenchi, grassetto).
- **Interpretazione AI messaggi SDI non strutturati** — attiva solo con `sdi.autorizzaAiPec: true` in config (default disattivato; i contenuti PEC non vengono mai inviati all'AI senza consenso esplicito):
  - NE con rifiuto committente (EC02): interpreta il testo libero di `<Descrizione>` e propone un'azione correttiva in notifica desktop.
  - Allegati XML non classificabili dallo SDI: identifica il tipo di documento e se richiede attenzione.
  - Email SDI senza allegati XML: valuta la rilevanza e mostra un sommario in notifica desktop se informativa o urgente.

### Fixed
- **Regole fiscali — pannello aggiornamento**: valori non leggibili nel confronto tra versione attiva e nuova; ora mostrati correttamente.
- **Bottoni poco visibili in dark mode** — molti bottoni secondari risultavano invisibili o quasi su sfondo scuro in tutta l'app (Clienti, Fattura Pro-Forma, Versamenti F24, Impostazioni e wizard). Ora hanno uno sfondo leggero che li rende riconoscibili come elementi cliccabili.

### Changed
- **Impostazioni PEC — link conservazione AE trasformato in bottone** — il link "Attiva la conservazione su Agenzia Entrate" è ora un pulsante separato dal testo.
- **Installer versionless**: `.pkg` e `.exe` diventano file fissi `FogliFatture-*`, senza versione nel nome:
  - Scaricano automaticamente l'ultima release disponibile su GitHub; nessuna nuova build necessaria ad ogni rilascio.
  - Versione specifica installabile da terminale:
    - macOS: `FOGLIFATTURE_VERSION=1.5.0 installer -pkg FogliFatture-mac-universal.pkg -target CurrentUserHomeDirectory`
    - Windows: `FogliFatture-win-x64.exe /Version=1.5.0`

## [1.6.0] - 2026-10-08

### Added
- **Dashboard: tab F24** — nuova tab dedicata con ordine cards riordinabile e persistito indipendentemente.
  - **Bollo trimestrale**:
    - Card dashboard con scadenze e importi del bollo virtuale per trimestre.
    - Rinvii di legge automatici:
      - Bollo 1° trimestre ≤ 5.000 € → versa con il 2°.
      - Bollo 1°+2° trimestre ≤ 5.000 € → versa con il 3°.
    - F24 precompilato scaricabile per ogni trimestre (codici 2521–2524).
    - Importi stimati dalla data fattura.
  - **Stato F24 e versamenti automatici**:
    - Piano versamenti con stati:
      - da pagare
      - programmato
      - pagato
      - annullato
    - Al pagamento, righe inserite automaticamente con codice tributo corretto.
    - Annullando il pagamento, le righe vengono cancellate.
    - Calcolo automatico ultimo giorno per annullare addebito (3 giorni lavorativi prima).
    - Import Cassetto Fiscale non duplica versamenti già coperti da F24 pagato.
  - **F24 precompilato scaricabile**: PDF su modello ufficiale AdE con dati contribuente e righe Erario/INPS precompilate.
  - **Stima versamenti F24**:
    - Card dashboard con scadenze calcolate per l'anno fiscale:
      - Saldo e acconti imposta sostitutiva.
      - Contributi INPS gestione separata.
    - Gestione previdenziale configurabile nelle impostazioni forfettario.
    - Deduzione automatica contributi INPS dalla base tassabile.
    - Campo codice tributo opzionale nei versamenti F24.
    - Rateizzazione INPS con interessi calcolati automaticamente (D.Lgs. 33/2025 art. 10):
      - Causale PXXR per prima rata.
      - Causale P10R per rate successive.
    - Avvisi in card:
      - Regole fiscali non confermate per l'anno.
      - Gestione previdenziale non configurata.
- **Router AI a cascata** (5 provider):
  - Fallback automatico in cascata:
    1. Gemini API key
    2. Google Antigravity CLI (OAuth Google)
    3. GitHub Copilot CLI (OAuth GitHub)
    4. Claude API key
    5. Groq API key
    6. LLM locale (Ollama/LM Studio)
  - Nessuna configurazione obbligatoria per chi ha un account Google o GitHub.
  - Impostazioni → AI: tab per ogni provider con stato e pulsanti di login OAuth.
  - Verifica stato provider su richiesta esplicita.
  - LLM locale: URL custom con porta per server remoti o porte non standard.

### Fixed
- **Scadenza INPS gestione separata**: saldo + 1° acconto era 16 giugno anziché 30 giugno (Circ. INPS 8/2026).
- **Stima versamenti F24 — soglia minima 1,03 €**: righe sotto soglia escluse dal piano con avviso (Istr. Redditi PF 2026 §7).
- **Stima versamenti F24 — maggiorazione**: la maggiorazione +0,40% non veniva più conteggiata come acconto versato nel calcolo del saldo.

### Changed
- **Ristrutturazione menu laterale**: Clienti e Cronologia PEC ora voci dirette nel menu principale, non più in Impostazioni.

## [1.5.0] - 2026-10-02

### Added
- **Avviso soglia alla generazione fattura**:
  - Prima di generare una fattura, l'app calcola se il totale (incassato + da incassare + nuova fattura) supera le soglie del regime forfettario.
  - Avviso con conferma obbligatoria se si supera la soglia 85.000 € (uscita dal regime l'anno prossimo).
  - Avviso con conferma obbligatoria se si supera la soglia 100.000 € (uscita immediata dal regime, IVA dovuta già da quella fattura).
  - Limite personale opzionale configurabile (es. 80.000 €) per una conferma anticipata rispetto alla soglia di legge.
  - Dashboard: tre stati distinti ("ok", "uscita anno prossimo", "uscita immediata") con messaggi differenziati nelle card soglia per cassa e per competenza.
- **Email separata per timesheet e per fattura**:
  - Ogni cliente può avere indirizzi email distinti per l'invio del timesheet e per l'invio della fattura.
  - Ciascun indirizzo accetta più destinatari separati da virgola.
- **Regime forfettario — flag aliquota 5% e ISA** (Impostazioni → Regime forfettario):
  - Checkbox "Ho i requisiti per l'aliquota agevolata del 5%": disabilitata automaticamente se l'attività ha più di 5 anni o la data di inizio non è impostata.
  - Checkbox "Soggetto a ISA": determina la ripartizione degli acconti (50/50 o 40/60).
- **Regole fiscali versionate**:
  - Aliquote, soglie, scadenze e codici tributo del regime forfettario raccolti in pacchetto per anno (`regole/2026.json`).
  - Fonte normativa e link al documento ufficiale per ogni valore.
  - Tab "Regole fiscali" in Dashboard mostra stato anno per anno, differenze rispetto al pacchetto attivo in tabella inline.
  - Conferma pacchetto con un click.
  - Banner avvisa quando l'aggiornamento non è confermato.
  - Bottone "Spiega con AI" (Gemini) apre popup con spiegazione variazioni.

- **Clienti esteri: IVA, diciture legali e Intrastat**:
  - Ogni cliente ha ora i campi "Paese" (ISO 3166-1, es. IT/DE/US) e "Tipo soggetto" (azienda / privato).
  - **Wizard impostazioni clienti adattivo**:
    - Provincia nascosta per clienti esteri.
    - Codice SDI fisso "XXXXXXX".
    - Campo P.IVA accetta identificativi UE fino a 28 caratteri.
  - Trattamento IVA automatico al momento della generazione:
    - N2.1 inversione contabile per aziende UE (art. 7-ter DPR 633/72).
    - N2.1 non soggetta per aziende extra-UE.
    - N2.1 art. 7-septies per privati extra-UE con servizi specifici.
    - N2.2 per tutti gli altri casi.
  - XML FatturaPA:
    - CodiceDestinatario XXXXXXX.
    - CAP 00000.
    - Nessuna Provincia.
    - IdPaese/Nazione dal paese del cliente.
    - Blocco AltriDatiGestionali INVCONT per B2B UE.
  - Dicitura legale corrispondente aggiunta come `<Causale>` nell'XML.
  - Scadenze Intrastat trimestrali (25 del mese successivo a ogni trimestre) aggiunte al pannello scadenze fiscali se il fornitore è iscritto al VIES e ha clienti azienda UE attivi.
  - Checkbox "Iscritto al VIES" in Impostazioni → Anagrafica fornitore.
  - Campo Paese come lista a discesa (paesi UE e principali extra-UE) invece di campo libero.
  - Default IT per clienti preesistenti.
- **Rivalsa INPS 4% facoltativa**: opzione per addebitare al cliente il 4% del compenso a titolo di rivalsa INPS (L. 662/96 art. 1 c. 212):
  - Attivabile globalmente in Impostazioni → Regime forfettario, sovrascrivibile per singolo cliente.
  - Blocco `DatiCassaPrevidenziale TC22` aggiunto nell'XML FatturaPA quando attiva.
  - La rivalsa entra nel totale fattura e nei ricavi ai fini della soglia forfettaria.

### Fixed
- **Requisiti aliquota agevolata 5%**: l'aliquota ridotta non viene più applicata automaticamente per chi ha una data di inizio attività recente.
  - Necessario spuntare esplicitamente "Ho i requisiti per l'aliquota agevolata del 5%" in Impostazioni → Regime forfettario (L. 190/2014 c. 65).
  - Chi non aveva i requisiti vedeva l'imposta stimata a un terzo del valore reale.
- Scadenze fiscali:
  - 4 ottobre aggiunto come festa nazionale dal 2026 (L. 151/2025).
  - Scadenze dall'1 al 19 agosto slittano al 20 agosto (D.Lgs. 33/2025 art. 11).
- Controllo aggiornamenti: `git fetch --tags origin main` falliva con "couldn't find remote ref main" sul branch `develop`; corretto in `git fetch --tags origin`.
- Wizard impostazioni: aggiunto pulsante "Salva" nella barra in basso di ogni schermata.
  - Prima era assente; il salvataggio avveniva solo premendo "Avanti".

## [1.4.1] - 2026-09-30

### Added
- **Installer 1-click**:
  - Pacchetto `.pkg` per macOS (Universal) scaricabile dalla pagina Release.
  - Pacchetto `.exe` per Windows 10/11 (64-bit).
  - Nessun terminale né Node.js richiesti; procedura guidata installa e avvia l'app come servizio automaticamente.

### Fixed
- **Parsing ricevute SDI**:
  - Metadati di trasporto (FileMetadati XML, daticert) e allegati SDI malformati non vengono più archiviati come "non classificati".
  - Supporto per matrioske EML (nidificazioni Aruba/Legalmail).
  - Whitelist esplicita dei 7 tipi di ricevuta SDI.

## [1.4.0] - 2026-09-30

### Added
- **Dashboard Bitcoin** — vista dedicata con toggle Dashboard/Bitcoin:
  - 4 card Incassi Bitcoin:
    - Riepilogo per anno.
    - Rate con TXID.
    - Quadro RW.
    - Valore attuale con grafico andamento cambio EUR/BTC.
  - **Card "Valore BTC di mercato"**:
    - Prezzo attuale.
    - Variazione 24h.
    - Andamento ultimi 30 giorni.
  - Card riordinabili con trascinamento (ordine salvato nel browser), sia in Dashboard che in Bitcoin.
- **Importa storico da ZIP** — archivio ZIP del portale Fatture e Corrispettivi (o SDI) caricabile così com'è, con anteprima dei file riconosciuti (fatture e ricevute SDI) e import dei soli file scelti.
- **Fatture: blocco data nel futuro** — la data di emissione nel futuro viene bloccata prima della generazione/invio XML, con avviso preciso sul rifiuto SDI 00403.
- **PEC guidata** (Impostazioni > PEC):
  - Gestori preconfigurati (Aruba, Poste, InfoCert, Namirial) che compilano server/porte, con avviso sulla password dedicata quando serve.
  - "Prova connessione": controlla invio/ricezione passo per passo, senza inviare nulla, con messaggi chiari sugli errori (utile anche per debug di timeout/DNS).
  - "PEC di prova allo SDI": invia una PEC vuota (con conferma) e mostra la risposta di cortesia, senza toccare le ricevute.
- **Dati di pagamento in fattura**:
  - IBAN, modalità pagamento e scadenza dichiarati in XML (FatturaPA).
  - IBAN e giorni scadenza predefiniti in Impostazioni, sovrascrivibili per cliente.
  - IBAN validato via IBAN check digit.
  - Fattura PDF: riquadro «Dati per il pagamento» con IBAN e/o indirizzo Bitcoin, scadenza e mini QR (bonifico EPC o bitcoin:) in tutti i template fattura.
  - Bitcoin selezionabile come modalità di pagamento (con indirizzo SegWit visualizzato).

### Fixed
- Wizard Impostazioni: ordine step corretto (Tariffa & fiscali prima di Clienti).
- Passo Login nel wizard ora autosalva in background (non richiede click esplicito per andare avanti).
- Sottotitoli mancanti nei vari passo del wizard.

## [1.3.0] - 2026-09-25

### Added
- **Incasso fatture in Bitcoin**:
  - Una rata può essere registrata come incasso BTC (datio in solutum) invece che a bonifico.
  - TXID, cambio EUR/BTC applicato (fonte e ora) e indirizzo di destinazione registrati.
  - Dati pronti per controllo fiscale.
  - Importo in EUR sempre calcolato dal cambio dichiarato.
  - Dicitura opzionale in fattura per i clienti abilitati.
  - Lettura opzionale dati transazione da mempool.space e cambio storico da CoinGecko.
  - Colonne dedicate nell'export per il commercialista.

## [1.2.0] - 2026-09-18

### Added
- **Pagamenti parziali/a rate**:
  - Una fattura può essere incassata in più rate con date e importi diversi.
  - Residuo, stato (aperta/parziale/pagata) e storico pagamenti visibili in dashboard e nella fattura.
  - Possibilità di eliminare un pagamento registrato.
  - Export per il commercialista e calcolo cassa forfettario tengono conto della singola rata.

### Fixed
- Rigenerando una fattura (es. dopo modifica ore/importo) la scadenza di pagamento impostata in precedenza non viene più persa.
- Colonna data spezzata su più righe nelle tabelle (es. importazione storico pagamenti da CSV bancario).

### Changed
- Pagamenti fatture: l'abbinamento CSV↔fattura è sempre un suggerimento da confermare a mano scegliendo fattura e cliente da un menu, mai un'associazione automatica — evita di assegnare per errore la data di incasso alla fattura sbagliata quando più fatture hanno lo stesso importo.

## [1.1.0] - 2026-09-16

### Added
- **Dashboard forfettario — principio di cassa**:
  - Calcolo fatturato/soglia/imposta stimata anche per principio di cassa (anno di incasso, non di emissione).
  - Avviso fatture a cavallo d'anno con inserimento manuale della data di incasso.
- **Export CSV per il commercialista**:
  - Elenco fatture e riepilogo aggiornati per criterio di cassa (fatture incassate nell'anno, ricavi/imposta/soglia per cassa).
  - Criterio per competenza rimane già presente.

### Changed
- Sidebar: icona a freccia per le voci di menu con sottovoci apribili (Impostazioni, Importa storico).

## [1.0.0] - 2026-09-04

Prima release pubblica.

### Added
- **Timesheet**:
  - Griglia giornaliera multi-cliente con formattazione live del tempo e copia/incolla riga.
  - Export CSV per VMS.
  - Export PDF.
- **Fatturazione FatturaPA**:
  - Generazione da timesheet (ore × tariffa) o a importo libero.
  - Invio via PEC al Sistema di Interscambio con polling automatico ricevute SDI.
  - Notifica desktop per ricevute SDI.
  - Invio email al cliente via `mailto` con allegato PDF reale.
- **Dashboard forfettario**:
  - Ricavi cumulati, soglia annua, previsione imposta sostitutiva e acconto anno successivo.
  - Andamento mensile e fatture da incassare.
  - Prossime scadenze fiscali calcolate localmente, con verifica periodica proroghe via AI.
- **Gestione pagamenti e versamenti**:
  - Sezione "Versamenti F24":
    - Registrazione manuale.
    - Confronto con imposta stimata.
    - Import da Cassetto Fiscale.
    - Export CSV per anno.
  - Sezione "Pagamenti fatture":
    - Riconoscimento automatico incasso da CSV movimenti bancari.
    - Abbinamento per importo.
- **Export dati**:
  - CSV "per il commercialista": elenco fatture emesse nell'anno più riepilogo ricavi/imposta/soglia.
- **Import storico**:
  - Timesheet pregressi (.xls/.xlsx) e fatture già emesse (XML FatturaPA).
  - Selezione singola o intera cartella.
- **Template di stampa**:
  - Personalizzabili per Timesheet e Fattura Pro-Forma, selezionabili per singolo cliente.
  - Anteprima a griglia.
- **Backup e ripristino**:
  - Backup e restore cifrato.
  - Backup automatico programmabile.
  - Percorso cartella dati configurabile (Dropbox/iCloud/OneDrive).
- **Autenticazione e sicurezza**:
  - Login opzionale con Google OAuth con whitelist multi-email.
  - Dark mode.
  - Aggiornamento app da UI con un click (download, build, riavvio).
- **Intelligenza artificiale**:
  - Aggiornamento codici ATECO assistito da AI (Gemini).
  - Fallback su Claude/Groq se quota Gemini esaurita.
  - Promemoria desktop:
    - Fine mese per timesheet.
    - Fattura scartata da SDI non ancora reinviata (rischio sanzione dopo 5 giorni).
- **Conformità normativa**:
  - Blocco rigenerazione fattura già accettata dallo SDI (va corretta con nota di variazione).
  - **Pagina "Privacy e trattamento dati"**:
    - Titolare del trattamento.
    - Dati trattati.
    - Comunicazione a terzi (SDI, PEC, Google, AI).
    - Conservazione.
    - Sicurezza.
    - Diritti dell'interessato.
- **Installazione**:
  - Script multi-piattaforma (macOS `launchd`, Windows Task Scheduler), avvio path-indipendente.

### Security
- Credenziali sensibili (password PEC/backup, client secret Google OAuth, API key AI) salvate nel Keychain del sistema operativo, mai in chiaro su file.
- **Libreria di lettura file Excel per l'import storico aggiornata**:
  - Risolta vulnerabilità denial of service.
  - Risolta vulnerabilità prototype pollution.
- Validazione campi configurazione (P.IVA, PEC, codice destinatario SDI).
- Controllo integrità numerazione fatture (sequenza unica, obbligo di legge, condivisa correttamente tra più clienti).
