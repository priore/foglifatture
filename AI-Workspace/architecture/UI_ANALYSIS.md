# UI Analysis

Confidence: 🟢 confermato da codice · 🟡 inferito · 🔴 ipotesi

## Routing (`frontend/src/router/index.js`)

🟢 `createWebHistory()`, tabella piatta, nessuna guard:
- `/` → redirect a `/dashboard`
- `/dashboard` → `DashboardView`
- `/timesheet` → `TimesheetView`
- `/fattura` → `FatturaView`
- `/versamenti-f24` → `VersamentiF24View`
- `/bitcoin` → `BitcoinView`
- `/clienti` → `ClientiView`
- `/pec-cronologia` → `CronologiaPecView`
- `/importa-storico` → `ImportaStoricoView`
- `/impostazioni` → `ImpostazioniView`
- `/impostazioni/pec-cronologia` → redirect a `/pec-cronologia`
- `/privacy` → `PrivacyView`

## Viste

🟢 **DashboardView.vue** — cinque tab (`Dashboard`, `Bitcoin`, `F24`, `Regole fiscali`, `AI`), tab attivo persistito in `localStorage`.
- Dashboard: card su griglia riordinabile (drag, `aria-label="Sposta card"`) con soglie, imposta, INPS, netto, scadenze, fatture aperte
- Bitcoin (sola visualizzazione): card «Valore BTC detenuti», «Riepilogo Bitcoin», «Rate incassate in BTC» (TXID), «Plusvalenze» (costo LIFO), «Quadro RW» (con inserimento del valore EUR/BTC al 31/12), «Valore attuale» con grafico cambio, «Valore BTC di mercato»
- F24: piano versamenti stimati, F24 con stato, bollo trimestrale, crediti compensabili
- Regole fiscali: monta `StepRegoleFiscali.vue` (pacchetto per anno, differenze, conferma, fonti)
- AI: monta `ChatAi.vue`
- Mostra anche `UpdateModal` quando `useUpdateCheck` rileva una versione nuova

🟢 **TimesheetView.vue** — editor mensile per il cliente attivo (`ClienteSwitcher`, `MonthSwitcher`, `TimesheetGrid`), anteprima/stampa da template (`TemplateStampa`), export CSV per portali VMS, invio al cliente.

🟢 **FatturaView.vue** — pro-forma da timesheet o importo libero, avviso soglia prima dell'emissione, dati di pagamento, rivalsa, valuta, incasso BTC con recupero dati da mempool.space e cambio storico, generazione XML, invio PEC, ricevute SDI, anteprima da template.

🟢 **BitcoinView.vue** — selettore anno e tre card: `BtcValoreLive` (prezzo in tempo reale e BTC detenuti), `BtcRegistro` (movimenti con colonna «Tipo» per origine, ingresso e uscita manuali, anteprima plusvalenza prima di salvare, eliminazione), `BtcImport` (proposte da confermare o scartare, controllo manuale, import da file con scelta provider, mapping AI per formati sconosciuti). È la sede delle azioni che modificano i dati; la dashboard resta di sola lettura.

🟢 **VersamentiF24View.vue** — elenco versamenti F24 registrati, inserimento manuale, import da testo del Cassetto Fiscale con anteprima, export.

🟢 **ClientiView.vue** — gestione clienti: monta `StepClienti` (lista e form per cliente).

🟢 **CronologiaPecView.vue** — invii PEC e ricevute SDI aggregati su tutti i clienti (`api.cronologiaPec()`).

🟢 **ImportaStoricoView.vue** — cinque sezioni, selezionate da `?passo=N`: `Timesheet da Excel`, `Fattura da XML` (anche batch e ZIP del Cassetto Fiscale), `Pagamenti fatture` (CSV home banking), `Esporta backup`, `Ripristina backup`. Usa `FileDrop`.

🟢 **ImpostazioniView.vue** — wizard a sette passi: `Fornitore`, `PEC`, `Percorso dati`, `Backup Automatico`, `Promemoria`, `Login`, `AI`. Il passo attivo vive in `?passo=N`. `Login`, `AI` e `Percorso dati` si salvano da sé (`PASSI_AUTOSALVANTI`), gli altri con il salvataggio generico.

🟢 **PrivacyView.vue** — informativa privacy.

## Navigazione e layout

🟢 `App.vue`: `.app-shell` con `AppSidebar` + `.main` con `<router-view />`.

🟢 `AppSidebar.vue` — voci: Dashboard forfettario, Timesheet mensile, Fattura Pro-Forma, Versamenti F24, Bitcoin, Clienti, Cronologia PEC, Impostazioni. Sotto Impostazioni, le sotto-voci dei sette passi e la voce `Importa storico` con le sue cinque sezioni. Footer: toggle tema, link Privacy, versione app.

🟢 Gli elenchi dei passi sono centralizzati in `wizardImpostazioniPassi.js` (`PASSI_IMPOSTAZIONI`, `PASSI_AUTOSALVANTI`, `DESCRIZIONI_PASSI`) e `wizardImportaStoricoPassi.js`, condivisi tra sidebar e viste.

## Impostazioni — dettaglio passi

- 🟢 **Fornitore** (`StepFornitore.vue`): tre schede `Anagrafica`, `Fiscale`, `Fatturazione` (bollo, dati di pagamento, wallet BTC e import automatico delle transazioni con avviso privacy, intervallo, conferme minime, URL provider). Sezione ATECO con aggiornamento via AI, sede INPS da elenco, flag `requisitiAliquotaRidotta` e `soggettoIsa`.
- 🟢 **PEC** (`StepPec.vue`): gestori preconfigurati, prova passo-passo, PEC di prova allo SDI.
- 🟢 **Percorso dati** (`StepPercorsoDati.vue`): spostamento fisico dei dati in altra cartella.
- 🟢 **Backup Automatico** (`StepBackup.vue`), **Promemoria** (`StepPromemoria.vue`, include notifiche desktop).
- 🟢 **Login** (`StepGoogleAuth.vue`): credenziali OAuth.
- 🟢 **AI** (`StepAI.vue`): schede Gemini, Copilot, Claude, Groq, LLM locale e pannello MCP (`StepMcp.vue`).

## Tema

🟢 Toggle manuale in `AppSidebar.vue`: scrive `data-theme` su `document.documentElement` e lo persiste in `localStorage['theme']`. `style.css` applica il dark con `@media (prefers-color-scheme: dark)` + `:root:not([data-theme="light"])` e con `:root[data-theme="dark"]`.

## Scoping per cliente

🟢 `ClienteSwitcher.vue`: dropdown custom (il valore selezionato deve poter andare a capo) con ricerca su `denominazione`. Usato da `TimesheetView` e `FatturaView`.

## Accessibilità

🟢 Minima: 71 occorrenze di `aria-*`/`role=` e una di `alt=` (`LogoUpload.vue`) in `frontend/src`, concentrate su card trascinabili, selettori e logo. Il resto usa la semantica HTML nativa.

---

## Review Checklist

- **Completeness:** routing, viste, navigazione, passi impostazioni, tema, scoping, accessibilità.
- **Accuracy:** verificato su `router/index.js`, viste, `AppSidebar.vue`, `wizardImpostazioniPassi.js` (2026-10-19).
- **Consistency:** nomi coerenti con `COMPONENT_LIBRARY.md`.
- **TODO:** nessuno.
- **Missing information:** regole di validazione campo per campo dei `Step*.vue`.
- **Open questions:** nessuna.
- **Confidence level:** 🟢.
