# Changelog

Tutte le modifiche rilevanti al progetto sono documentate in questo file.

Formato basato su [Keep a Changelog](https://keepachangelog.com/it/1.1.0/).

## [Unreleased]

### Added
- Percorso della cartella dati configurabile da Impostazioni (es. cartella sincronizzata Dropbox/iCloud/OneDrive): sposta subito tutti i file esistenti senza perdita dati, senza riavvio del server.
- Import storico multi-file: selezione di più file .xls/.xml o di un'intera cartella, non solo un file alla volta.
- Selezione del modello Gemini da Impostazioni → Google → Gemini, tra quelli disponibili per la propria API key, con verifica prima del salvataggio.
- Nuova sezione "Versamenti F24": registrazione manuale dei versamenti effettivi, confronto con l'imposta stimata, import da testo copiato dal Cassetto Fiscale (Versamenti → Modello F24), export CSV per anno.

### Fixed
- Aggiornamento codici ATECO via Gemini: se il modello configurato non è più disponibile viene rilevato automaticamente quello valido; messaggio chiaro quando la quota Gemini è esaurita.

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
