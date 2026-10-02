# Changelog

Tutte le modifiche rilevanti al progetto sono documentate in questo file.

Formato basato su [Keep a Changelog](https://keepachangelog.com/it/1.1.0/).

## [Unreleased]

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
  - Conferma pacchetto con un click; banner avvisa quando aggiornamento non è confermato.
  - Bottone "Spiega con AI" (Gemini) apre popup con spiegazione variazioni.

- **Clienti esteri: IVA, diciture legali e Intrastat**:
  - Ogni cliente ha ora i campi "Paese" (ISO 3166-1, es. IT/DE/US) e "Tipo soggetto" (azienda / privato).
  - Wizard impostazioni clienti adattivo: Provincia nascosta per esteri, codice SDI fisso "XXXXXXX", campo P.IVA accetta identificativi UE fino a 28 caratteri.
  - Trattamento IVA automatico al momento della generazione: N2.1 inversione contabile per aziende UE (art. 7-ter DPR 633/72), N2.1 non soggetta per aziende extra-UE, N2.1 art. 7-septies per privati extra-UE con servizi specifici, N2.2 per tutti gli altri casi.
  - XML FatturaPA: CodiceDestinatario XXXXXXX, CAP 00000, nessuna Provincia, IdPaese/Nazione dal paese del cliente, blocco AltriDatiGestionali INVCONT per B2B UE.
  - Dicitura legale corrispondente aggiunta come `<Causale>` nell'XML.
  - Scadenze Intrastat trimestrali (25 del mese successivo a ogni trimestre) aggiunte al pannello scadenze fiscali se il fornitore è iscritto al VIES e ha clienti azienda UE attivi.
  - Checkbox "Iscritto al VIES" in Impostazioni → Anagrafica fornitore.
  - Campo Paese come lista a discesa (paesi UE e principali extra-UE) invece di campo libero; default IT per clienti preesistenti.
- **Rivalsa INPS 4% facoltativa**: opzione per addebitare al cliente il 4% del compenso a titolo di rivalsa INPS (L. 662/96 art. 1 c. 212):
  - Attivabile globalmente in Impostazioni → Regime forfettario, sovrascrivibile per singolo cliente.
  - Blocco `DatiCassaPrevidenziale TC22` aggiunto nell'XML FatturaPA quando attiva.
  - La rivalsa entra nel totale fattura e nei ricavi ai fini della soglia forfettaria.

### Fixed
- Requisiti aliquota agevolata 5%: l'aliquota ridotta non viene più applicata automaticamente per chi ha una data di inizio attività recente. È necessario spuntare esplicitamente "Ho i requisiti per l'aliquota agevolata del 5%" nelle Impostazioni → Regime forfettario (L. 190/2014 c. 65). Chi non ha i requisiti vedeva l'imposta stimata a un terzo del valore reale.
- Scadenze fiscali: 4 ottobre aggiunto come festa nazionale dal 2026 (L. 151/2025); scadenze dall'1 al 19 agosto slittano al 20 agosto (D.Lgs. 33/2025 art. 11).
- Controllo aggiornamenti: `git fetch --tags origin main` falliva sempre con "couldn't find remote ref main" quando il processo gira sul branch `develop`; corretto in `git fetch --tags origin`.
- Wizard impostazioni: aggiunto pulsante "Salva" nella barra in basso di ogni schermata (era assente — il salvataggio avveniva solo premendo "Avanti").

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
  - 4 card Incassi Bitcoin (riepilogo per anno, rate con TXID, quadro RW, valore attuale con grafico andamento cambio EUR/BTC).
  - Card "Valore BTC di mercato" (prezzo attuale, variazione 24h, andamento ultimi 30gg).
  - Card riordinabili con trascinamento (ordine salvato nel browser), sia in Dashboard che in Bitcoin.
- **Importa storico da ZIP** — archivio ZIP del portale Fatture e Corrispettivi (o SDI) caricabile così com'è, con anteprima dei file riconosciuti (fatture e ricevute SDI) e import dei soli file scelti.
- **Fatture: blocco data nel futuro** — la data di emissione nel futuro viene bloccata prima della generazione/invio XML, con avviso preciso sul rifiuto SDI 00403.
- **PEC guidata** (Impostazioni > PEC):
  - Gestori preconfigurati (Aruba, Poste, InfoCert, Namirial) che compilano server/porte, con avviso sulla password dedicata quando serve.
  - "Prova connessione": controlla invio/ricezione passo per passo, senza inviare nulla, con messaggi chiari sugli errori (utile anche per debug di timeout/DNS).
  - "PEC di prova allo SDI": invia una PEC vuota (con conferma) e mostra la risposta di cortesia, senza toccare le ricevute.
- **Dati di pagamento in fattura**:
  - IBAN, modalità pagamento e scadenza dichiarati in XML (FatturaPA).
  - IBAN e giorni scadenza predefiniti in Impostazioni, sovrascrivibili per cliente; IBAN validato via IBAN check digit.
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
  - TXID, cambio EUR/BTC applicato (fonte e ora) e indirizzo di destinazione registrati (pronti per controllo fiscale).
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
  - Griglia giornaliera multi-cliente, formattazione live del tempo, copia/incolla riga.
  - Export CSV per VMS ed export PDF.
- **Fatturazione FatturaPA**:
  - Generazione da timesheet (ore × tariffa) o a importo libero.
  - Invio via PEC al Sistema di Interscambio con polling automatico ricevute SDI.
  - Notifica desktop per ricevute, invio email al cliente via `mailto` con allegato PDF reale.
- **Dashboard forfettario**:
  - Ricavi cumulati, soglia annua, previsione imposta sostitutiva e acconto anno successivo.
  - Andamento mensile, fatture da incassare, prossime scadenze fiscali (calcolate localmente, con verifica periodica proroghe via AI).
- **Gestione pagamenti e versamenti**:
  - Sezione "Versamenti F24": registrazione manuale, confronto con imposta stimata, import da Cassetto Fiscale, export CSV per anno.
  - Sezione "Pagamenti fatture": riconoscimento automatico incasso da CSV movimenti bancari, abbinamento per importo.
- **Export dati**:
  - CSV "per il commercialista": elenco fatture emesse nell'anno più riepilogo ricavi/imposta/soglia.
- **Import storico**:
  - Timesheet pregressi (.xls/.xlsx) e fatture già emesse (XML FatturaPA).
  - Selezione singola o intera cartella.
- **Template di stampa**:
  - Personalizzabili per Timesheet e Fattura Pro-Forma, selezionabili per singolo cliente.
  - Anteprima a griglia.
- **Backup e ripristino**:
  - Backup/restore cifrato, backup automatico programmabile.
  - Percorso cartella dati configurabile (Dropbox/iCloud/OneDrive).
- **Autenticazione e sicurezza**:
  - Login opzionale con Google OAuth, whitelist multi-email.
  - Dark mode, aggiornamento app da UI con un click (download, build, riavvio).
- **Intelligenza artificiale**:
  - Aggiornamento codici ATECO assistito da AI (Gemini), fallback su Claude/Groq se quota esaurita.
  - Promemoria desktop: fine mese per timesheet, fattura scartata da SDI non ancora reinviata (rischio sanzione dopo 5 giorni).
- **Conformità normativa**:
  - Blocco rigenerazione fattura già accettata dallo SDI (va corretta con nota di variazione).
  - Pagina "Privacy e trattamento dati": titolare, dati trattati, comunicazione a terzi (SDI, PEC, Google, AI), conservazione, sicurezza, diritti interessato.
- **Installazione**:
  - Script multi-piattaforma (macOS `launchd`, Windows Task Scheduler), avvio path-indipendente.

### Security
- Credenziali sensibili (password PEC/backup, client secret Google OAuth, API key AI) salvate nel Keychain del sistema operativo, mai in chiaro su file.
- Libreria di lettura file Excel per l'import storico aggiornata, risolte vulnerabilità note (denial of service, prototype pollution).
- Validazione campi configurazione (P.IVA, PEC, codice destinatario SDI).
- Controllo integrità numerazione fatture (sequenza unica, obbligo di legge, condivisa correttamente tra più clienti).

### Fixed
- Conformità XML FatturaPA: IdTrasmittente con codice fiscale invece di P.IVA, progressivo SDI alfanumerico conforme.
- Esportazione PDF Timesheet/Fattura: rimossa pagina bianca superflua; timesheet con mese pieno (31 giorni) non sconfina più su una seconda pagina.
- Notifiche desktop: su Windows/Linux non tentano più comandi macOS-only.
- Import CSV pagamenti: riconoscimento automatico separatore, colonne Entrate/Uscite separate, esclusione righe di saldo iniziale/finale.
- Vari fix minori su import XML FatturaPA, polling ricevute SDI, PDF timesheet.
