# Changelog

Tutte le modifiche rilevanti al progetto sono documentate in questo file.

Formato basato su [Keep a Changelog](https://keepachangelog.com/it/1.1.0/).

## [Unreleased]

### Added
- Dashboard: pulsante "Aggiornamento disponibile" (visibile solo se c'è una nuova release), con popup di dettaglio versione/changelog e aggiornamento automatico (download, build, riavvio) con un click. Versione app corrente mostrata a piè di pagina.

### Changed
- "Pagamenti fatture" spostata da voce di menu principale a sotto-sezione di "Importa storico" (tra "Fattura da XML" ed "Esporta backup").
- Impostazioni → PEC: nota aggiornata sulla conservazione a norma delle fatture SDI, con link per attivare il servizio gratuito di Agenzia delle Entrate.
- Dashboard forfettario spostata come prima voce di menu e schermata di apertura predefinita dell'app.
- Dashboard forfettario: aggiunti andamento mensile dei ricavi, elenco fatture emesse non ancora incassate e prossime scadenze fiscali (imposta sostitutiva, INPS), aggiornate periodicamente tramite Gemini con ricerca web.
- Fattura Pro-Forma: nuovo campo "Scadenza pagamento" (termine commerciale, modificabile anche a fattura già emessa); se impostata, la dashboard la usa per evidenziare le fatture da incassare scadute.

### Fixed
- Notifiche desktop (promemoria ore, esiti SDI, backup): su Windows/Linux non tentano più di lanciare un comando macOS-only, evitando errori silenziosi nei log.
- Impostazioni → Google → Gemini: il modello selezionato ora resta visibile nella select anche uscendo/rientrando dalla pagina o riavviando l'app.
- Fattura Pro-Forma: il campo "Data fattura" non era più disabilitato dopo l'accettazione SDI (era possibile modificarlo pur non potendo rigenerare la fattura).

### Added
- Nuova pagina "Privacy e trattamento dati" (link nel piè di pagina della barra laterale): informativa su titolare, dati trattati, comunicazione a terzi (SDI, PEC, Google, Gemini), conservazione, sicurezza e diritti dell'interessato.
- Percorso della cartella dati configurabile da Impostazioni (es. cartella sincronizzata Dropbox/iCloud/OneDrive): sposta subito tutti i file esistenti senza perdita dati, senza riavvio del server.
- Import storico multi-file: selezione di più file .xls/.xml o di un'intera cartella, non solo un file alla volta.
- Selezione del modello Gemini da Impostazioni → Google → Gemini, tra quelli disponibili per la propria API key, con verifica prima del salvataggio.
- Nuova sezione "Versamenti F24": registrazione manuale dei versamenti effettivi, confronto con l'imposta stimata, import da testo copiato dal Cassetto Fiscale (Versamenti → Modello F24), export CSV per anno.
- Export CSV "per il commercialista" dalla Dashboard forfettario: elenco fatture emesse nell'anno (numero, data, cliente, imponibile, bollo, netto) più riepilogo ricavi/imposta/soglia.
- Nuova sezione "Pagamenti fatture": riconosce la data di incasso caricando un CSV di movimenti dall'home banking. Solo i nomi delle colonne del file (mai importi o dati reali) vengono inviati a Gemini per riconoscere automaticamente la struttura del file, poi i movimenti vengono abbinati alle fatture emesse per importo. La data di incasso confermata compare anche nell'export CSV per il commercialista.
- Selezione file in stile app con drag & drop (Logo, Importa storico, Ripristina backup, Pagamenti fatture), al posto del controllo standard del browser.
- Data di incasso confermata mostrata anche nella schermata Fattura Pro-Forma, accanto agli esiti email/PEC.
- Pulsante "Riavvia app" in UI (Ripristina backup, Impostazioni → Google → Login) per applicare senza comandi manuali le modifiche che richiedono il riavvio del servizio.
- Blocco alla rigenerazione di una fattura già accettata dallo SDI, comprese quelle importate da storico (emessa, non più modificabile per legge: va corretta con nota di variazione).
- Promemoria desktop giornaliero se una fattura risulta scartata da SDI e non ancora reinviata, con avviso quando supera i 5 giorni previsti per la riemissione (rischio sanzione).

### Fixed
- Aggiornamento codici ATECO via Gemini: se il modello configurato non è più disponibile viene rilevato automaticamente quello valido; messaggio chiaro quando la quota Gemini è esaurita.
- Salvataggio della Gemini API Key da Impostazioni: non mostra più l'avviso di riavvio del servizio (la key vale subito, a differenza delle credenziali Google).
- Import CSV pagamenti fatture: riconosciuto automaticamente anche il separatore punto e virgola o tabulazione, non solo la virgola.
- Import CSV pagamenti fatture: riconosciuti anche i file con colonne separate Entrate/Uscite (invece di un'unica colonna importo con segno), che risultavano in "nessun movimento riconosciuto".
- Import CSV pagamenti fatture: escluse le righe di saldo iniziale/finale (non sono movimenti); corretto lo stile del badge "nessuna fattura corrispondente" che si sovrapponeva nella tabella.
- Rigenerare una fattura già incassata non cancella più la data di pagamento registrata.

## 2026-08-31 — Sicurezza e rifiniture

### Security
- Password PEC/backup spostate da `config.json` in chiaro al Keychain del sistema operativo, con migrazione automatica dei valori pre-esistenti.

### Added
- Formattazione live del tempo e copia/incolla riga nella griglia timesheet.
- Invio email al cliente via `mailto` con allegato PDF reale.
- Export CSV timesheet per VMS.
- Cronologia PEC globale.
- Aggiornamento codici ATECO assistito da Gemini.

### Fixed
- Import XML FatturaPA: riconoscimento cliente esistente, mesi senza timesheet.
- Conformità XML FatturaPA: IdTrasmittente con codice fiscale invece di P.IVA, progressivo SDI alfanumerico conforme (max 5 char, non troncato).
- Crash nel polling ricevute SDI.
- PDF timesheet: colonna extra, campi header mancanti.

### Changed
- Colori bottoni hard-coded spostati in variabili CSS.

## 2026-08-30 — Supporto multi-cliente

### Added
- Gestione elenco clienti e dropdown selettore cliente con ricerca (Timesheet/Fattura).

### Changed
- `config.cliente` (singolo) sostituito da `config.clienti[]` (array).
- Storage timesheet/fatture rinominato con chiave `<anno>-<mese>-<clienteId>`.
- Numerazione fatture mantenuta come sequenza unica condivisa tra tutti i clienti (obbligo di legge).
- Wizard Impostazioni da tab orizzontali a submenu laterale verticale.

## 2026-08-30 — Build iniziale

### Added
- App Vue 3 + Express per fatturazione elettronica italiana: timesheet → XML FatturaPA → invio PEC → polling ricevute SDI, cliente singolo, nessun database.
- Controllo integrità numerazione fatture.
- Backup/restore cifrato.
- Script di installazione/disinstallazione Windows.
- Toggle dark mode.
- Dashboard forfettario con timeline ricevute SDI.
- Validazione campi config (P.IVA/PEC/codice SDI).
- Fatturazione a importo libero (senza timesheet).
- Promemoria timesheet fine mese.
