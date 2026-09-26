# Piano: dashboard riordinabile + card incassi BTC (doppio tab)

## Stato avanzamento
- [x] Step 1 — Drag/drop dashboard as-is (7 card attuali) — completato 2026-09-26
- [ ] Step 2 — Backend `riepilogoBtc`
- [ ] Step 3 — Card "Incassi Bitcoin" in dashboard as-is
- [ ] Step 4 — Tabbar dashboard (As-is / Bitcoin)
- [ ] Step 5 — Drag/drop su tab Bitcoin

Esecuzione: uno step alla volta, in quest'ordine. Dopo ogni step: verifica passi, spuntare la checkbox sopra (`[x]`), **fermarsi** e attendere conferma esplicita dell'utente prima di iniziare lo step successivo. Non anticipare step futuri durante uno step corrente.

## Context
FP-011 (incassi BTC) implementato: ogni rata `pagamenti[]` può avere `btc: { txid, satoshi, cambioEurBtc, fonteCambio, dataOraCambio, indirizzoDestinatario }`, `importo` sempre EUR. Dashboard ([DashboardView.vue](frontend/src/views/DashboardView.vue)) oggi non distingue BTC da bonifico: nessuna visibilità su quanto incassato in BTC, quanti BTC detenuti, obblighi RW.

Layout finale: dashboard con tabbar superiore (stile pagina Impostazioni) — tab "As-is" (le 7 card attuali, riordinabili) e tab "Bitcoin" (nuova card incassi BTC + eventuali altre card BTC future, riordinabili separatamente).

---

## Step 1 — Drag/drop dashboard as-is
Nessuna libreria: HTML5 drag & drop nativo + CSS `order`. Deps frontend attuali (vue, vue-router, handlebars, html2pdf) restano invariate.

**Vincolo layout invariato — confronto pre/post obbligatorio.**
**Passo 0**: backend attuale su :1969, Playwright screenshot full-page della dashboard (anno corrente + un anno con dati), tema light e dark, viewport 1440 e 1024 ⇒ salvati in scratchpad come `pre-step1-*.png`.
**Dopo build + riavvio**: stessi screenshot con ordine di default (localStorage pulito) ⇒ `post-step1-*.png`. Atteso: identici pixel per pixel a parte maniglia `⋮⋮` e bottone "Ripristina layout". Qualsiasi altro scostamento (altezze, gap, allineamento, colori) ⇒ fix prima di proporre commit. Mostrare all'utente le coppie pre/post.

Lavoro:
- Unificare le due griglie attuali (righe 203 e 241 di DashboardView.vue) in **una sola** griglia `.griglia-card` (2 colonne, gap 20px) con le 6 card esistenti: `soglia-cassa`, `soglia-competenza`, `composizione`, `andamento`, `fatture-da-incassare`, `scadenze-fiscali`. Righe KPI in alto (`summary-row`, `stat-gruppo-stima`) restano fisse: larghezza diversa, non sono card. Motivo tecnico per cui l'unificazione non deve cambiare nulla: oggi 2 griglie `1fr 1fr gap:20px` separate da `margin-top:20px` ⇒ una griglia unica con `gap:20px` produce stesse righe e stessi stretch di altezza; verificato dal confronto, non assunto.
- Ogni card: `:style="{ order: ordineCard.indexOf('<id>') }"`, `draggable="true"` solo sulla `card-head` (maniglia visibile `⋮⋮`, `cursor: grab`), così input/date/tabelle dentro la card restano utilizzabili.
- Stato: `ordineCard = ref([...])` con ordine di default = layout attuale. `dragstart` salva id, `dragover.prevent`, `drop` sposta id sorgente nella posizione del target (splice), poi salva.
- Persistenza: `localStorage` chiave `dashboardOrdineCard` (stesso pattern di `theme`/`clienteAttivoId`), read/write in try/catch; al caricamento tieni solo id noti e aggiungi in coda quelli mancanti (card future non spariscono).
- Accessibilità: maniglia focusabile (`tabindex=0`, `aria-label="Sposta card"`), `Alt+↑/↓` sposta di una posizione.
- Bottone `btn-ghost` "Ripristina layout" in `page-head-actions`, disabilitato quando ordine = default (regola "mai nascondere").
- Ordine per-browser, non nel backend: preferenza di vista, non dato.

Verifica:
1. `cd frontend && npm run build`, riavvio backend (AskUserQuestion, regola dev-workflow).
2. Drag card-head su un'altra card ⇒ ordine cambia; reload ⇒ ordine mantenuto; "Ripristina layout" ⇒ default; input/date dentro card ancora cliccabili; Alt+↑/↓ funziona.
3. Confronto screenshot pre/post come sopra.
4. CHANGELOG `[Unreleased]`: "card della dashboard riordinabili con trascinamento (ordine salvato nel browser)".
5. Salvare in `.claude/memory/` regola "modifiche UI ⇒ sempre confronto screenshot pre/post" (+ indice MEMORY.md), se non già presente.

**Nota esecuzione**: `grid-template-columns: 1fr 1fr` semplice produce colonne diseguali quando l'unificazione fa condividere la colonna a card con contenuto a larghezza minima diversa (qui: `BarChart` con `.bar-valore { min-width: 70px }` forzava la colonna 2 più larga anche per le righe sopra, facendo andare a capo la legenda del donut a viewport stretti). Fix: `minmax(0, 1fr) minmax(0, 1fr)` invece di `1fr 1fr` — elimina l'asimmetria e, come side-effect positivo confermato con l'utente, chiude anche uno scroll orizzontale preesistente a 1024px causato dallo stesso min-width. Approvato esplicitamente dall'utente prima di applicare (side-effect fuori scope del task).

→ Spuntare Step 1, fermarsi, attendere conferma.

---

## Step 2 — Backend `riepilogoBtc`
[forfettarioService.js](backend/src/services/forfettarioService.js) `calcolaDashboardForfettario`: `ricaviAnnoCassa` già restituisce `incassateAnno` con `.btc` per rata (riga 54) — oggi scartato alla riga 128. Riusarlo:

- nuova funzione pura esportata `riepilogoBtc(incassateAnno)` in forfettarioService.js:
  - filtra rate con `btc`
  - `{ rate, eur, satoshi, cambioMedio, elenco }`
    - `eur` = somma `nettoAPagare` (toFixed 2), `satoshi` = somma intera
    - `cambioMedio` = `satoshi > 0 ? eur / (satoshi/1e8) : 0` (ponderato, toFixed 2)
    - `percentualeSuIncassato` = eur / ricaviCumulatiCassa * 100 (toFixed 1, 0 se base 0) — calcolata nel chiamante
    - `elenco`: `{ numero, anno, mese, clienteId, data: dataPagamento, satoshi, cambioEurBtc, eur, txid, indirizzoDestinatario }` ordinato per data desc
- `cassa.btc = riepilogoBtc(...)` + percentuale. Nessuna nuova route (arriva col payload `dashboardForfettario` esistente).

Verifica:
1. Estendere [forfettarioService.test.js](backend/src/services/forfettarioService.test.js) con caso misto bonifico+BTC (totali, cambio medio, ordinamento, zero-BTC ⇒ rate 0, cambioMedio 0).
2. `cd backend && npm test` verde.
3. Nessun cambiamento visibile in dashboard (campo `btc` non ancora consumato dal frontend) — nessuno screenshot necessario.

→ Spuntare Step 2, fermarsi, attendere conferma.

---

## Step 3 — Card "Incassi Bitcoin" in dashboard as-is
Nuova card temporaneamente aggiunta alla griglia unica dello Step 1 (verrà spostata nel tab Bitcoin allo Step 4), stili riusati (`card`, `mini-stat-row`, `avviso-riga`, `badge-fonte`, `lista-scroll`, `data-table`).

1. **Riepilogo** — `mini-stat-row` 4 voci: EUR incassati in BTC, BTC totali (`satoshi/1e8` toFixed 8), n° rate, cambio medio EUR/BTC; nota "`x%` dell'incassato per cassa".
2. **Lista rate** — tabella `lista-scroll`: Fattura, data, BTC, cambio, EUR, TXID abbreviato (`abcd…wxyz`) con link `https://mempool.space/tx/{txid}` (`target=_blank rel=noopener`).
3. **Promemoria RW/IC** — se `rate > 0`: `avviso-riga avviso-info` "BTC incassati nel {anno}: se detenuti al 31/12 vanno indicati nel quadro RW (imposta IC 0,2%) — verificare col commercialista." Solo nota, nessun calcolo (FP-013 resta proposta).
4. **Valore attuale** — bottone "Mostra valore attuale" (fetch solo su click, niente chiamata automatica, per privacy IP): nuova funzione `api.cambioAttualeBtc()` in [api.js](frontend/src/services/api.js) accanto a `cambioStoricoBtc` → `https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=eur`. Mostra controvalore oggi dei BTC incassati nell'anno e differenza vs EUR registrato, con `title` avviso "informativo: non è plusvalenza realizzata, BTC eventualmente già spesi non tracciati (FP-012)". Errore fetch ⇒ messaggio inline, non `errore` globale.

Stato vuoto (regola "mai nascondere"): card sempre visibile; se `rate === 0` mostra "Nessun incasso BTC nel {anno}" + riga: se `config.walletBtc` vuoto ⇒ link a Impostazioni (configura wallet), altrimenti "registra un incasso BTC dalla pagina fattura". Bottone valore attuale disabilitato con `title` spiegazione. Esporre `walletConfigurati: config.walletBtc.length > 0` in `cassa.btc` dal backend (evita seconda fetch).

Nuovi colori: nessuno, solo token esistenti (`--accent`, `--warn`, `--ok`, `--muted`).

`FEATURE_PROPOSALS.md` FP-011: nessuna nuova voce numerata (estensione UI di FP-011); aggiungere riga riferimento dashboard.

Verifica:
1. Screenshot pre (= post-Step 1) / post secondo stesso vincolo pixel-perfect: unica differenza ammessa = card BTC in coda.
2. `cd frontend && npm run build`, riavvio backend (AskUserQuestion).
3. Playwright: anno con rata BTC ⇒ totali coerenti con export commercialista; anno senza BTC ⇒ stato vuoto; click "valore attuale" ⇒ controvalore mostrato; tema dark leggibile.
4. Drag/drop dello Step 1 include correttamente la nuova card (ordine, persistenza).
5. CHANGELOG `[Unreleased]`: "Dashboard: card Incassi Bitcoin (riepilogo anno, rate con TXID, promemoria quadro RW, valore attuale opzionale)".

→ Spuntare Step 3, fermarsi, attendere conferma.

---

## Step 4 — Tabbar dashboard (As-is / Bitcoin)
Stesso pattern tabbar già usato in Impostazioni (riusare componente/markup/stile esistente, non inventarne uno nuovo — verificare nome file in Impostazioni in fase esecuzione).

- Due tab: "As-is" (le 6 card esistenti) e "Bitcoin" (la card Incassi Bitcoin dello Step 3, spostata qui).
- Righe KPI fisse (`summary-row`, `stat-gruppo-stima`) restano sopra la tabbar, visibili in entrambi i tab (sono riepilogo generale, non specifiche BTC) — salvo diverso avviso dell'utente in fase esecuzione se alcune sono BTC-specifiche.
- Ognuna delle due griglie card mantiene il proprio `ordineCard` con chiave `localStorage` distinta: `dashboardOrdineCard` (tab as-is, già esistente da Step 1) e `dashboardOrdineCardBtc` (tab Bitcoin, nuova, singolo elemento per ora ma predisposta per Step 5/card BTC future).
- Tab attivo persistito in `localStorage` (`dashboardTabAttivo`), default "As-is".

Verifica:
1. Screenshot pre (= post-Step 3) / post: tab "As-is" deve essere pixel-perfect identico al vecchio layout unico (stessa griglia, minus card BTC che è nell'altro tab); tab "Bitcoin" mostra solo la card BTC.
2. `cd frontend && npm run build`, riavvio backend (AskUserQuestion).
3. Cambio tab conserva stato scroll/filtri ragionevole, non resetta l'anno selezionato in dashboard.
4. CHANGELOG `[Unreleased]`: "Dashboard: doppia vista As-is/Bitcoin con tab dedicati".

→ Spuntare Step 4, fermarsi, attendere conferma.

---

## Step 5 — Drag/drop su tab Bitcoin
Stessa meccanica dello Step 1 (drag native, `ordineCard`/`order` CSS, maniglia `⋮⋮`, Alt+↑/↓, bottone "Ripristina layout"), applicata alle card del tab Bitcoin usando la chiave `dashboardOrdineCardBtc` già predisposta allo Step 4. Con una sola card oggi il riordino è no-op visibile ma il meccanismo deve essere pronto per card BTC future.

Verifica:
1. Screenshot pre (= post-Step 4) / post sul tab Bitcoin.
2. `cd frontend && npm run build`, riavvio backend (AskUserQuestion).
3. Maniglia e bottone "Ripristina layout" presenti anche nel tab Bitcoin, funzionanti, indipendenti da quelli del tab As-is.
4. CHANGELOG `[Unreleased]`: "Dashboard: card riordinabili anche nel tab Bitcoin".

→ Spuntare Step 5, fermarsi. Piano completato.
