# Piano: template personalizzabili per stampa Timesheet/Fattura

Confidence: 🟢 confermato da codice · 🟡 inferito · 🔴 ipotesi

Nota: tracciato su Gogs (locale), escluso solo dal sync verso GitHub (skill `sync-public`) — non pubblicato.

## Obiettivo

Il layout di stampa (timesheet e fattura pro-forma) diventa un **file di definizione importabile**, non codice Vue da editare. Serve:

- una **UI di gestione template**: elenco, import di nuovi template, eliminazione;
- **selezione del template per singolo cliente**;
- anteprima prima della stampa/PDF, riusando l'attuale pipeline PDF (`usePdfExport.js` → `html2pdf.js` su un elemento DOM).

## Cosa c'è già (riusabile)

🟢 Pipeline PDF già astratta da dominio: `esportaPdf(elemento, nomeFile)` e `generaPdfBlob(elemento)` in `usePdfExport.js` prendono un **elemento DOM qualsiasi**. Il motore di template deve solo produrre un elemento DOM equivalente a quello che oggi producono `TimesheetPrintPreview.vue`/`FatturaPrintPreview.vue`; il resto (rasterizzazione, salvataggio, invio email come blob) non cambia.

🟢 I dati da iniettare nel layout sono già oggetti piatti passati come props (vedi `FatturaPrintPreview.vue:6-16`, `TimesheetPrintPreview.vue:8-19`) — non serve una nuova query dati, solo un nuovo modo di *renderizzare* quei dati.

🟢 `LogoPlaceholder.vue` già gestisce logo/assenza logo — comportamento da preservare come helper del template.

🟢 `config.clienti[]` esiste già con id stabile per cliente (`configService.js:34-37`) — assegnare "questo cliente usa questo template" è un campo in più su ogni oggetto cliente, nessuna nuova struttura dati.

🟢 Upload file già gestito ovunque nel backend con `multer` (`memoryStorage()`, vedi `backupRoutes.js`, `importRoutes.js`, `mailRoutes.js`) — riuso diretto dello stesso pattern per l'import di un template.

## Formato template scelto

**Cartella con `layout.html` + `layout.css` + `template.json`, sintassi Handlebars (`{{campo}}`, `{{#each}}`), trasportata come ZIP per l'import via UI.**

- Handlebars, non Vue: permette di riusare temi/template HTML/CSS già pronti in giro (repository di template email/documento, stessa logica di un tema WordPress) invece di scriverli sempre da zero — è lo standard di mercato per "documento con placeholder" (email transazionali, generatori PDF tipo Carbone.io). Un tema trovato online è già nella sintassi giusta o richiede solo piccoli ritocchi di placeholder.
- ZIP come formato di trasporto import (drag&drop in dropzone, riuso `FileDrop.vue` esistente): il backend lo estrae in una cartella sotto `backend/data/templates/<id>/`. La struttura su disco resta sempre cartella — lo zip è solo il contenitore per import/export.
- Nuove dipendenze: `handlebars` (motore interpolazione) e `adm-zip` (lettura zip, pura JS, nessuna dipendenza nativa — `node:zlib` gestisce solo gzip a singolo stream, non l'archivio multi-file).

## Struttura template — due path, mai mescolate

**Path versionata (pacchetto, in git)** — i 10 template preinstallati, editabili solo da codice/commit:

```
backend/src/templates-default/
  fattura-blu-tecnico/               # fallback fattura, protetto da eliminazione
  timesheet-dashboard-riepilogo/      # fallback timesheet, protetto da eliminazione
  fattura-default/
  timesheet-default/
  fattura-classico-studio/
  fattura-ligne-minimale/
  fattura-verde-sobrio/
  timesheet-griglia-excel/
  timesheet-calendario-card/
  timesheet-alto-contrasto/
    layout.html      # markup con placeholder {{campo}} e blocchi {{#each giorni}}...{{/each}}
    layout.css
    template.json      # { "id": "...", "nome": "...", "tipo": "fattura"|"timesheet" }
```

**Path non versionata (`backend/data/templates/`, in `.gitignore`)** — SOLO template effettivamente **selezionati per almeno un cliente**, mai il catalogo intero:

```
backend/data/templates/
  fattura-blu-tecnico/                # copiato qui SOLO quando un cliente lo seleziona
  fattura-cliente-acme-a1b2c3/        # importato via UI e assegnato ad Acme
```

- `tipo` distingue i campi disponibili (timesheet ha `giorni[]`, fattura ha `imponibile`/`bollo`/...) — validato al rendering.
- `id` cartella = slug univoco (da `randomUUID()`-corto o dal nome all'import, con controllo collisione) — è il valore salvato nel legame cliente↔template.
- **Il catalogo mostrato in UI (`GET /api/templates`) è l'unione delle due path**, non solo `backend/data/templates/`: legge sempre `backend/src/templates-default/` (i 10 default, sempre visibili/selezionabili anche se mai scelti da nessun cliente) più le cartelle in `backend/data/templates/` che non duplicano un id già in `templates-default/` (i template importati custom). Questo risolve la richiesta: il pacchetto (versionato) resta la fonte del catalogo default, `data/templates/` è solo lo spazio "in uso", mai lo storage del catalogo.
- **`backend/data/templates/<id>/` esiste per un template SOLO quando serve al rendering**: o è un template importato assegnato a un cliente, o è la copia locale di un default scelto esplicitamente da un cliente in sostituzione del fallback automatico (vedi "Ciclo di vita" sotto — per i default questa copia in realtà non serve mai, il rendering legge sempre `templates-default/` per gli id noti; la copia scatta solo per gli importati). Semplificazione: **i default non vengono mai copiati in `data/templates/`** — il rendering risolve un id prima in `templates-default/`, poi in `data/templates/`. `data/templates/` contiene quindi solo template importati dall'utente.

## Ciclo di vita template importati e cleanup automatico

Problema: `backend/data/templates/` deve contenere solo template **effettivamente in uso** da almeno un cliente, per non accumulare spazio con template importati e poi abbandonati.

Regola: **un template importato vive in `data/templates/` finché è referenziato da `templateFatturaId`/`templateTimesheetId` di almeno un cliente in `config.clienti[]`.** Nessun reference-count separato da mantenere — basta scansionare `config.clienti[]` al momento del cambio, i client sono già in memoria/config.json.

Trigger che possono azzerare i riferimenti a un template importato:
1. **Cambio selezione**: cliente passa da template A (importato) a template B → dopo il salvataggio, `templateService.pulisciNonUsati()` scansiona tutti gli id importati in `data/templates/`, verifica se compaiono ancora in `clienti[].templateFatturaId`/`templateTimesheetId` di **qualsiasi** cliente (non solo quello appena modificato — un template importato può essere condiviso tra clienti), elimina la cartella se non più referenziato.
2. **Eliminazione cliente**: stesso `pulisciNonUsati()` va chiamato dopo la cancellazione di un cliente da `config.clienti[]` (i suoi `templateFatturaId`/`templateTimesheetId` sparivano con lui, potrebbero essere stati l'ultimo riferimento).
3. **Eliminazione esplicita da UI** (azione "elimina" sul template in `ImpostazioniView.vue`): resta un'azione diretta, ma deve comunque rifiutarsi (409 con messaggio) se il template è ancora assegnato a ≥1 cliente — l'utente deve prima riassegnare quei clienti a un altro template. Evita che l'eliminazione manuale rompa un cliente che lo sta usando.

Non serve un cleanup "a tempo" (cron/interval) — il trigger è sempre un evento esplicito (salvataggio config cliente, cancellazione cliente), coerente con l'assenza di stato intermedio "orfano ma non ancora ripulito" da mostrare in UI.

`pulisciNonUsati()` **non tocca mai `backend/src/templates-default/`** (path versionata, fuori dal suo perimetro) né elimina un template importato appena caricato ma non ancora assegnato — l'assegnazione avviene nello stesso flusso UI dell'import (step 7 sotto), quindi non esiste una finestra in cui un template "nuovo di zecca" risulti temporaneamente non referenziato e venga spazzato via per errore: se serve import-poi-assegna-dopo in due passaggi separati, va escluso dal cleanup un template più recente di N minuti (🟡 da confermare se serve — nel flusso minimo l'import chiede subito il cliente destinatario, un solo passaggio).

## Legame cliente → template

Ogni cliente in `config.clienti[]` guadagna un campo opzionale:

```js
{ id: 'a1b2c3', denominazione: 'Acme Srl', ..., templateFatturaId: 'fattura-cliente-acme-a1b2c3', templateTimesheetId: null }
```

`null`/assente → usa il template fallback per quel tipo (`fattura-blu-tecnico`/`timesheet-dashboard-riepilogo`, i due non eliminabili). Solo due campi in più sull'oggetto cliente esistente — coerente con `configService.js` che già fonde ogni cliente con i default (`fondiClienti`, riga 117).

## Piano di implementazione minimo

1. **Creare i 10 template come default preinstallati**, sotto `backend/src/templates-default/<id>/` (path versionata, git-tracked, mai copiata altrove — il rendering li legge da lì direttamente): i 2 as-is (`fattura-default`, `timesheet-default` — `layout.html` riscritto in sintassi Handlebars dall'attuale `<template>` di `TimesheetPrintPreview.vue`/`FatturaPrintPreview.vue`, `layout.css` è l'attuale `print-timesheet.css`/`print-fattura.css` copiato as-is) più gli 8 mockup stilistici già prodotti come artifact (vedi sezione proposte) — il loro HTML/CSS statico va riscritto in sintassi Handlebars sostituendo i dati d'esempio con i placeholder `{{campo}}` corrispondenti.
2. **`frontend/src/composables/useTemplateRenderer.js`** (unico file nuovo lato motore): dato `layoutHtml` (stringa Handlebars) + dati, `Handlebars.compile(layoutHtml)(dati)` produce l'HTML finale, iniettato in un `<iframe sandbox="allow-same-origin">` (niente `allow-scripts`) insieme a `layout.css` in uno `<style>` dentro il `<head>` dell'iframe — vedi sezione "Sicurezza import template". Sostituisce l'uso diretto di `TimesheetPrintPreview.vue`/`FatturaPrintPreview.vue` nelle view.
3. **`backend/src/services/templateService.js`**: nessuna copia al primo avvio — i default restano sul posto in `backend/src/templates-default/` (path versionata, letta in sola lettura). Funzioni:
   - `listTemplates(tipo)`: unisce `backend/src/templates-default/*` + `backend/data/templates/*`, dedup per id (default vince se stesso id), filtra per `tipo`.
   - `getTemplate(id)`: cerca prima in `templates-default/<id>`, poi in `data/templates/<id>`.
   - `importaTemplate(zipBuffer)`: estrae con `adm-zip`, valida che contenga `layout.html`+`template.json` con `tipo` valido, assegna id univoco (collisione controllata contro **entrambe** le path), scrive **solo** sotto `backend/data/templates/`.
   - `eliminaTemplate(id)`: rifiuta (404/400) se `id` è uno dei due fallback protetti o se non sta in `data/templates/` (i default non sono eliminabili, punto — non serve un flag "protetto", basta che vivano in una path diversa da quella che l'endpoint di eliminazione tocca); rifiuta (409) se ancora referenziato da `clienti[].templateFatturaId`/`templateTimesheetId` di qualsiasi cliente.
   - `pulisciNonUsati()`: scansiona `data/templates/*`, elimina le cartelle il cui id non compare in nessun `clienti[].templateFatturaId`/`templateTimesheetId` — vedi sezione "Ciclo di vita" sopra. Chiamata da `configService.saveConfig`/analogo dopo ogni scrittura di `clienti[]` (stesso punto che già valida/normalizza i clienti), non da un cron.
4. **`backend/src/routes/templateRoutes.js`**: `GET /api/templates?tipo=`, `POST /api/templates/importa` (`multer` memoryStorage, stesso pattern di `backupRoutes.js`), `DELETE /api/templates/:id`.
5. **Legame cliente↔template**: `templateFatturaId`/`templateTimesheetId` aggiunti a `DEFAULT_CONFIG.clienti[]`/`CLIENTE_VUOTO`/`fondiClienti` in `configService.js`; il punto dove `clienti[]` viene salvato chiama `templateService.pulisciNonUsati()` dopo lo scrivi-su-disco (cambio selezione o cancellazione cliente, stesso hook per entrambi).
6. **UI di gestione template** (sezione in `ImpostazioniView.vue`, dove già vivono anagrafica/wizard): elenco template per tipo con nome+badge tipo (badge "preinstallato" per quelli da `templates-default/`), dropzone import (riuso `FileDrop.vue`) che carica lo zip su `POST /api/templates/importa`, azione elimina disponibile solo sui template importati non assegnati (disabilitata con tooltip sul motivo per default o per importati ancora in uso).
7. **Selezione per cliente — griglia con anteprima e ricerca**, non una `<select>` testuale: in `ImpostazioniView.vue`/`StepCliente.vue`, per ciascun tipo (fattura/timesheet) una griglia di card cliccabili, una per template del tipo giusto, con thumbnail (render statico via `useTemplateRenderer` su dati d'esempio, scalato via CSS `transform`, stesso principio di `TimesheetPrintPreview`/`FatturaPrintPreview` già renderizzati oggi — nessun motore di screenshot nuovo) + nome; campo ricerca testuale sopra la griglia che filtra per `nome` (client-side, `Array.filter`, lista già in memoria — non serve endpoint di ricerca). Click su una card scrive `templateFatturaId`/`templateTimesheetId` sul cliente e triggera il salvataggio config esistente (che a sua volta chiama `pulisciNonUsati()`, punto 5) — nessuna chiamata cleanup separata dal frontend.
8. **Uso in stampa**: `TimesheetView.vue`/`FatturaView.vue` risolvono il template da `cliente.templateFatturaId ?? 'fattura-blu-tecnico'` (cliente attivo già noto in queste view, vedi `ClienteSwitcher.vue`), lo passano a `useTemplateRenderer`. Nessun select aggiuntivo qui: la scelta è già fatta a livello cliente.
9. **Anteprima**: il componente generico renderizzato dal motore sostituisce `<FatturaPrintPreview>`/`<TimesheetPrintPreview>` nel DOM, `esportaPdf`/`generaPdfBlob` continuano a puntare allo stesso `ref` come oggi.

## Sicurezza import template

Import zip = HTML/CSS non fidato che finisce renderizzato nell'app. Misure, in ordine di importanza:

1. **Validazione struttura zip prima di estrarre**: limite dimensione decompressa (zip bomb), reject entry con `../` o path assoluti (path traversal — rischio noto lato `adm-zip`, va controllato esplicitamente sul nome di ogni entry prima di scrivere su disco), atteso solo `layout.html`/`layout.css`/`template.json` alla radice.
2. **Rendering in `<iframe sandbox>` (senza `allow-scripts`)**: misura primaria contro codice eseguibile nel template — `useTemplateRenderer` monta l'HTML interpolato dentro un iframe sandboxato invece che nel DOM della pagina host. Anche se un `<script>` o un handler inline sfugge a un controllo testuale, l'iframe non lo esegue comunque — è l'unica misura che non dipende dall'indovinare ogni pattern malevolo possibile (una blacklist da sola è aggirabile con offuscamento: entity HTML, `@import` CSS al posto di `url()`, ecc.).

   🟡 **Rischio da verificare presto (spike, non a fine sviluppo)**: `html2pdf.js`/`html2canvas`, usati da `esportaPdf`/`generaPdfBlob`, catturano un elemento DOM passato per riferimento — con contenuto dentro un `<iframe>` non è garantito che leggano il documento interno del frame senza configurazione aggiuntiva (cross-document, anche se `sandbox="allow-same-origin"` mantiene stesso-origine). Se la cattura fallisce o rende contenuto vuoto/bianco, va passato a html2canvas il `contentDocument.body` dell'iframe invece dell'iframe stesso, oppure (fallback) va valutato se il sandboxing è comunque necessario in fase di generazione PDF finale — visto che a quel punto l'HTML è già stato validato/mostrato in anteprima — e va applicato solo in fase di anteprima/selezione template, non nel path di export.
3. **Check statico come seconda barriera, non l'unica**: reject se il markup contiene `<script`, `on\w+=` (handler inline), `javascript:` in href/src, `<iframe`/`<object`/`<embed` annidati — difesa in profondità, utile a bloccare import ovviamente malevoli prima ancora di montare l'iframe, non sostituisce il sandboxing.
4. Messaggio in UI: "importa solo template di cui ti fidi" — resta valido anche con iframe sandbox, perché il sandbox previene esecuzione di codice ma non contenuto visivo ingannevole (es. un layout fattura che mostra dati falsi).
- 🟡 Placeholder disponibili per tipo (`giorni`, `fornitore`, `cliente`, ecc.) vanno documentati (es. `README.md` dentro ogni cartella template default, incluso nello zip esportabile come esempio) altrimenti chi crea un template da zero non sa quali campi usare.
- 🟡 Export di un template esistente come zip (condivisione/backup personalizzazione) non è nel piano minimo ma è quasi gratis una volta che esiste `templateService` — valutare se aggiungerlo subito o dopo.
- 🔴 Export XML FatturaPA (`fatturaPaXmlGenerator.js`) parametrico per layout — fuori scope, è un formato fisso normato (SdI), non personalizzabile.

## Proposte template base (mockup HTML/CSS → 10 template default all'implementazione)

🟡 Non ancora implementati: mockup statici HTML/CSS (dati di esempio, non ancora sintassi Handlebars) prodotti come riferimento visivo. Alla fase di implementazione (step 1) diventano i **10 template default preinstallati** — tutti disponibili in UI al primo avvio, non solo i 2 as-is. Ognuno usa font Google Fonts + palette propria, sfondo carta bianco fisso (documento di stampa, non UI).

**Modello 1 — as-is (replica fedele del layout attuale, non una variante stilistica):**
- [Fattura As-Is](https://claude.ai/code/artifact/06b00e24-a505-48dd-b3c5-f1efa682e014) — replica pixel-fedele di `FatturaPrintPreview.vue`/`print-fattura.css` → `fattura-default`
- [Timesheet As-Is](https://claude.ai/code/artifact/2c91a98e-3dbd-4ca5-8549-7a4e37316c2d) — replica pixel-fedele di `TimesheetPrintPreview.vue`/`print-timesheet.css` → `timesheet-default`

Preinstallati come gli altri 8, ma **eliminabili** — il fallback non è più questo modello, vedi sotto.

**Fattura:**
- [Classico Studio](https://claude.ai/code/artifact/297fc310-6849-4490-a051-f0457343b475) — bordeaux/serif, vicino allo stile attuale ma raffinato — eliminabile
- [Ligne Minimale](https://claude.ai/code/artifact/fad050c7-21ce-446c-9a12-94cd43ab2440) — bianco/nero, solo hairline rules, nessun colore — eliminabile
- [Blu Tecnico](https://claude.ai/code/artifact/be32a491-afbb-49bd-8553-ad6d73f542aa) — palette blu petrolio, tabelle a griglia marcata, taglio "consulenza ingegneristica" — **fallback fattura, non eliminabile**
- [Verde Sobrio](https://claude.ai/code/artifact/ad56b44e-ddf8-494e-a1b7-b6700a38e045) — verde salvia, taglio "studio commercialista" — eliminabile

**Timesheet:**
- [Griglia Excel](https://claude.ai/code/artifact/ab5f6269-ab5b-4c3f-9e1b-b817def5b1e8) — fedele all'attuale foglio Excel aziendale (grigio/teal/mattone) — eliminabile
- [Calendario Card](https://claude.ai/code/artifact/16200168-c4ce-48fc-9ea3-88f6fc271619) — layout a card giorno per giorno invece di righe tabella lunghe — eliminabile
- [Alto Contrasto](https://claude.ai/code/artifact/b59916ad-1431-4788-8ea0-2b75486ddcfd) — bianco/nero/rosso, ottimizzato per stampa economica b/n — eliminabile
- [Dashboard Riepilogo](https://claude.ai/code/artifact/b64ca1be-fa74-4a57-8c41-1039289d21a8) — riepilogo mensile (KPI, barre distribuzione ore) in alto, dettaglio giorni sotto — **fallback timesheet, non eliminabile**

Tutti e 10 sono template default preinstallati; solo Blu Tecnico e Dashboard Riepilogo sono protetti da eliminazione (fallback per cliente senza template assegnato) — utili anche come test del motore Handlebars/iframe-sandbox su markup diversi dall'originale.

## Domande aperte per l'utente

- Conferma formato zip di import: cartella compressa con `layout.html` + `layout.css` + `template.json` alla radice dello zip?
- Un template importato senza assegnazione esplicita a un cliente resta "disponibile ma non attivo per nessuno", o deve poter diventare il nuovo default globale?
- Serve anche **export** di un template nello stesso giro, o basta l'import in questa prima versione?
- Editor del contenuto template resta esterno (l'utente prepara lo zip fuori dall'app), oppure serve un editor testuale minimo dentro l'app?
