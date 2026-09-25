# Piano: box incassi BTC in Dashboard forfettario

## Context
FP-011 (incassi BTC) implementato: ogni rata `pagamenti[]` può avere `btc: { txid, satoshi, cambioEurBtc, fonteCambio, dataOraCambio, indirizzoDestinatario }`, `importo` sempre EUR. Dashboard ([DashboardView.vue](frontend/src/views/DashboardView.vue)) oggi non distingue BTC da bonifico: nessuna visibilità su quanto incassato in BTC, quanti BTC detenuti, obblighi RW. Utente ha scelto 4 box: riepilogo anno, lista rate, promemoria RW/IC, valore attuale.

## Backend — un solo punto
[forfettarioService.js](backend/src/services/forfettarioService.js) `calcolaDashboardForfettario`: `ricaviAnnoCassa` già restituisce `incassateAnno` con `.btc` per rata (riga 54) — oggi scartato alla riga 128. Riusarlo:

- nuova funzione pura esportata `riepilogoBtc(incassateAnno)` in forfettarioService.js:
  - filtra rate con `btc`
  - `{ rate, eur, satoshi, cambioMedio, elenco }`
    - `eur` = somma `nettoAPagare` (toFixed 2), `satoshi` = somma intera
    - `cambioMedio` = `satoshi > 0 ? eur / (satoshi/1e8) : 0` (ponderato, toFixed 2)
    - `percentualeSuIncassato` = eur / ricaviCumulatiCassa * 100 (toFixed 1, 0 se base 0) — calcolata nel chiamante
    - `elenco`: `{ numero, anno, mese, clienteId, data: dataPagamento, satoshi, cambioEurBtc, eur, txid, indirizzoDestinatario }` ordinato per data desc
- `cassa.btc = riepilogoBtc(...)` + percentuale. Nessuna nuova route (arriva col payload `dashboardForfettario` esistente).
- Test: estendere [forfettarioService.test.js](backend/src/services/forfettarioService.test.js) con caso misto bonifico+BTC (totali, cambio medio, ordinamento, zero-BTC ⇒ rate 0, cambioMedio 0).

## Frontend — [DashboardView.vue](frontend/src/views/DashboardView.vue)
Nuova card "Incassi Bitcoin {anno}" nella griglia 2 colonne (dopo "Fatture da incassare"/"Scadenze fiscali"), stili riusati (`card`, `mini-stat-row`, `avviso-riga`, `badge-fonte`, `lista-scroll`, `data-table`).

1. **Riepilogo** — `mini-stat-row` 4 voci: EUR incassati in BTC, BTC totali (`satoshi/1e8` toFixed 8), n° rate, cambio medio EUR/BTC; nota "`x%` dell'incassato per cassa".
2. **Lista rate** — tabella `lista-scroll`: Fattura, data, BTC, cambio, EUR, TXID abbreviato (`abcd…wxyz`) con link `https://mempool.space/tx/{txid}` (`target=_blank rel=noopener`).
3. **Promemoria RW/IC** — se `rate > 0`: `avviso-riga avviso-info` "BTC incassati nel {anno}: se detenuti al 31/12 vanno indicati nel quadro RW (imposta IC 0,2%) — verificare col commercialista." Solo nota, nessun calcolo (FP-013 resta proposta).
4. **Valore attuale** — bottone "Mostra valore attuale" (fetch solo su click, niente chiamata automatica, per privacy IP): nuova funzione `api.cambioAttualeBtc()` in [api.js](frontend/src/services/api.js) accanto a `cambioStoricoBtc` → `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=eur`. Mostra controvalore oggi dei BTC incassati nell'anno e differenza vs EUR registrato, con `title` avviso "informativo: non è plusvalenza realizzata, BTC eventualmente già spesi non tracciati (FP-012)". Errore fetch ⇒ messaggio inline, non `errore` globale.

Stato vuoto (regola "mai nascondere"): card sempre visibile; se `rate === 0` mostra "Nessun incasso BTC nel {anno}" + riga: se `config.walletBtc` vuoto ⇒ link a Impostazioni (configura wallet), altrimenti "registra un incasso BTC dalla pagina fattura". Bottone valore attuale disabilitato con `title` spiegazione. Richiede `api.getConfig` già usato altrove (verificare nome in api.js in fase esecuzione) — oppure esporre `walletConfigurati: config.walletBtc.length > 0` in `cassa.btc` dal backend (più semplice, preferito: evita seconda fetch).

Nuovi colori: nessuno, solo token esistenti (`--accent`, `--warn`, `--ok`, `--muted`).

## Vincolo: layout/stile attuale invariato — confronto pre/post obbligatorio
**Passo 0, prima di qualsiasi modifica**: backend attuale su :1969, Playwright screenshot full-page della dashboard (anno corrente + un anno con dati), tema light e dark, viewport 1440 e 1024 ⇒ salvati in scratchpad come `pre-*.png`.
**Dopo build + riavvio**: stessi screenshot con ordine di default (localStorage pulito) ⇒ `post-*.png`. Atteso: identici pixel per pixel nella parte sopra la nuova card BTC; unica differenza ammessa = card BTC in coda + maniglia `⋮⋮` e bottone "Ripristina layout". Qualsiasi altro scostamento (altezze card, gap, allineamento, colori) ⇒ fix prima di proporre commit. Mostrare all'utente le coppie pre/post.
Motivo tecnico per cui l'unificazione griglie non deve cambiare nulla: oggi 2 griglie `1fr 1fr gap:20px` separate da `margin-top:20px` ⇒ una griglia unica con `gap:20px` produce stesse righe e stessi stretch di altezza; verificato dal confronto, non assunto.
Ai lavori finiti: salvare in `.claude/memory/` regola "modifiche UI ⇒ sempre confronto screenshot pre/post" (+ indice MEMORY.md).

## Card spostabili (tutte, non solo BTC)
Nessuna libreria: HTML5 drag & drop nativo + CSS `order`. Deps frontend attuali (vue, vue-router, handlebars, html2pdf) restano invariate.

- Unificare le due griglie attuali (righe 203 e 241) in **una sola** griglia `.griglia-card` (2 colonne, gap 20px) con le 7 card: `soglia-cassa`, `soglia-competenza`, `composizione`, `andamento`, `fatture-da-incassare`, `scadenze-fiscali`, `incassi-btc`. Righe KPI in alto (`summary-row`, `stat-gruppo-stima`) restano fisse: larghezza diversa, non sono card.
- Ogni card: `:style="{ order: ordineCard.indexOf('<id>') }"`, `draggable="true"` solo sulla `card-head` (maniglia visibile `⋮⋮`, `cursor: grab`), così input/date/tabelle dentro la card restano utilizzabili.
- Stato: `ordineCard = ref([...])` con ordine di default = layout attuale + BTC in coda. `dragstart` salva id, `dragover.prevent`, `drop` sposta id sorgente nella posizione del target (splice), poi salva.
- Persistenza: `localStorage` chiave `dashboardOrdineCard` (stesso pattern di `theme`/`clienteAttivoId`), read/write in try/catch; al caricamento tieni solo id noti e aggiungi in coda quelli mancanti (card future/nuove non spariscono).
- Accessibilità: maniglia focusabile (`tabindex=0`, `aria-label="Sposta card"`), `Alt+↑/↓` sposta di una posizione.
- Bottone `btn-ghost` "Ripristina layout" in `page-head-actions`, disabilitato quando ordine = default (regola "mai nascondere").
- Ordine per-browser, non nel backend: preferenza di vista, non dato. Spostare in `config.json` solo se serve sincronizzarlo tra macchine.

## Docs
- Root `CHANGELOG.md` `[Unreleased]`: "Dashboard: card Incassi Bitcoin (riepilogo anno, rate con TXID, promemoria quadro RW, valore attuale opzionale)".
- `FEATURE_PROPOSALS.md` FP-011: nessuna nuova voce numerata (estensione UI di FP-011); aggiungere riga riferimento dashboard.

## Verifica
1. `cd backend && npm test` (forfettarioService.test.js verde).
2. `cd frontend && npm run build`.
3. Riavvio backend (AskUserQuestion prima, regola dev-workflow).
4. Playwright su `http://localhost:1969`: dashboard anno con rata BTC ⇒ totali coerenti con export commercialista (colonne BTC); anno senza BTC ⇒ stato vuoto; click "valore attuale" ⇒ controvalore mostrato; tema dark leggibile.
5. Drag card-head su un'altra card ⇒ ordine cambia; reload ⇒ ordine mantenuto; "Ripristina layout" ⇒ default; input data incasso dentro card ancora cliccabile/editabile; Alt+↑/↓ da tastiera funziona.
6. CHANGELOG: aggiungere "card della dashboard riordinabili con trascinamento (ordine salvato nel browser)".
