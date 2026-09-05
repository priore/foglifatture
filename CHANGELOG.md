# Changelog

Le modifiche rilevanti al progetto, a partire dalla prima release pubblica, sono documentate in questo file.

Formato basato su [Keep a Changelog](https://keepachangelog.com/it/1.1.0/).

## [1.0.0] - 2026-09-04

Prima release pubblica. Cosa include:

- Timesheet mensile multi-cliente con griglia giornaliera, formattazione live del tempo, copia/incolla riga, export CSV per VMS ed export PDF.
- Fatturazione elettronica FatturaPA: generazione da timesheet (ore × tariffa) o a importo libero, invio via PEC al Sistema di Interscambio, polling automatico ricevute SDI con notifica desktop.
- Invio email al cliente via `mailto` con allegato PDF reale.
- Dashboard forfettario: ricavi cumulati, soglia annua, previsione imposta sostitutiva e acconto anno successivo, andamento mensile, fatture da incassare, prossime scadenze fiscali (calcolate localmente, con verifica periodica di eventuali proroghe via AI).
- Sezione "Versamenti F24": registrazione manuale versamenti, confronto con imposta stimata, import da testo copiato dal Cassetto Fiscale, export CSV per anno.
- Sezione "Pagamenti fatture": riconoscimento automatico data di incasso da import CSV movimenti bancari, abbinamento alle fatture per importo.
- Export CSV "per il commercialista": elenco fatture emesse nell'anno più riepilogo ricavi/imposta/soglia.
- Import storico multi-file: timesheet pregressi (.xls/.xlsx) e fatture già emesse (XML FatturaPA), selezione singola o intera cartella.
- Template di stampa personalizzabili per Timesheet e Fattura Pro-Forma, selezionabili per singolo cliente, con anteprima a griglia.
- Backup/restore cifrato, backup automatico programmabile, percorso cartella dati configurabile (es. cartella sincronizzata Dropbox/iCloud/OneDrive).
- Login opzionale con Google OAuth, whitelist multi-email.
- Aggiornamento codici ATECO assistito da AI (Gemini), con fallback automatico su Claude/Groq se la quota è esaurita.
- Promemoria desktop: fine mese per il timesheet, fattura scartata da SDI non ancora reinviata (rischio sanzione dopo 5 giorni).
- Blocco alla rigenerazione di una fattura già accettata dallo SDI (va corretta con nota di variazione, come da normativa).
- Pagina "Privacy e trattamento dati": titolare, dati trattati, comunicazione a terzi (SDI, PEC, Google, AI), conservazione, sicurezza, diritti dell'interessato.
- Dark mode, aggiornamento app da UI con un click (download, build, riavvio).
- Script di installazione/disinstallazione multi-piattaforma (macOS `launchd`, Windows Task Scheduler), avvio path-indipendente.
- Generazione XML FatturaPA conforme allo schema ufficiale (IdTrasmittente con codice fiscale, progressivo SDI alfanumerico).
- Esportazione PDF Timesheet/Fattura impaginata su una sola pagina, anche con mese pieno (31 giorni).
- Notifiche desktop multi-piattaforma (Mac/Windows/Linux).
- Import CSV pagamenti con riconoscimento automatico del separatore, colonne Entrate/Uscite separate, esclusione righe di saldo iniziale/finale.

### Sicurezza
- Credenziali sensibili (password PEC/backup, client secret Google OAuth, API key AI) salvate nel Keychain del sistema operativo, mai in chiaro su file.
- Libreria di lettura file Excel per l'import storico su versione priva di vulnerabilità note (denial of service, prototype pollution).
- Validazione campi configurazione (P.IVA, PEC, codice destinatario SDI).
- Controllo integrità numerazione fatture (sequenza unica, obbligo di legge, condivisa correttamente tra più clienti).
