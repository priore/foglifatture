# Piano: risoluzione issue in KNOWN_ISSUES.md

Confidence: 🟢 confermato da codice · 🟡 inferito · 🔴 ipotesi

Nota: tracciato su Gogs (locale), escluso solo dal sync verso GitHub (skill `sync-public`) — non pubblicato.

## Obiettivo

`AI-Workspace/product/KNOWN_ISSUES.md` elenca le issue ancora aperte. Obiettivo: risolvere ciascuna nel codice, poi **rimuovere la voce da KNOWN_ISSUES.md** (non archiviarla, non spostarla in uno storico — il documento resta pulito, riflette solo issue ancora aperte).

Esecuzione **uno step alla volta**, non in batch — ogni step chiude con: fix → verifica manuale/test → commit dedicato → rimozione voce da KNOWN_ISSUES.md nello stesso commit.

---

## Step 5 — Scala di design token per spacing/radius/font-size

🟢 `style.css:6-21,26-38` tokenizza solo colori/ombre (`--ink`, `--card`, `--shadow`, ecc). Spacing/border-radius/font-size sono hardcoded per-regola (es. `style.css:52` `padding: 28px 20px`; `:56-57` `font-size: 1.3rem/.68rem`; `:60,63,66,70` `border-radius: 8px/50%/7px/6px`), ripetuti anche in `DonutChart.vue`, `BarChart.vue`, `wizard/StepClienti.vue`, `wizard/LogoUpload.vue`, `wizard/StepFornitore.vue`.

Questo è il fix più esteso e a più alto rischio di regressione visiva: tocca CSS in almeno 6 file.

**Azione (in sotto-step, uno alla volta, MAI tutti insieme):**
1. ✅ (2026-09-03) Estrarre i valori ricorrenti osservati in `style.css` e definire token in `:root` (es. `--space-xs/sm/md/lg`, `--radius-sm/md/pill`, `--font-size-xs/sm/base/lg`) — solo aggiunta, nessuna sostituzione ancora. Zero rischio visivo. Token aggiunti: `--radius-sm/md/lg/pill/circle`, `--font-size-2xs/xs/sm/base/md/lg/xl`, `--gap-sm/md`. `padding`/`margin` restano hardcoded (vedi inventario riga 30/32 — poca ripetizione, valore contestuale). Nessun uso ancora sostituito in `style.css`, quindi nessuna verifica visiva richiesta per questo sotto-step.

   **Inventario (completato 2026-09-03, solo lettura, `style.css` = 153 righe):**

   `border-radius` (8 valori distinti, 18 occorrenze) — candidati chiari a scala: `50%`(1, cerchi/dot) · `99px`(1, pill) · `6px`(4) · `7px`(3) · `8px`(5) · `10px`(2) · `12px`(2) · `14px`(1, card).

   `font-size` (16 valori distinti, 28 occorrenze) — scala rem non uniforme, nessuna progressione pulita: `.68rem`(3) `.7rem`(1) `.72rem`(4) `.75rem`(1) `.76rem`(1) `.78rem`(2) `.8rem`(1) `.82rem`(4) `.84rem`(1) `.86rem`(4) `.88rem`(1) `.92rem`(2) `1rem`(1) `1.3rem`(2) `1.5rem`(1) `1.7rem`(1). Mappare a token rischia di accorpare valori oggi diversi (es. `.82` vs `.84` vs `.86` sono 3 righe diverse, non uno "sbaglio di battitura") — verificare ognuno visivamente.

   `padding` (quasi tutti valori unici, 20 righe, poca ripetizione) — solo `9px 16px`(2, bottoni) e `8px 10px`(2) ricorrono; il resto (`28px 20px` sidebar, `32px 40px` main, `24px` modal, `16px 20px` card-head, `14px 16px` note-legal, ecc.) sono valori singoli legati al contesto — token qui rende meno evidente il "perché" di ogni valore, valutare se ne vale la pena o se restano hardcoded intenzionalmente.

   `gap`/`margin` — `gap: 8px`(4) `gap: 10px`(3) sono gli unici ricorrenti; margin quasi tutti valori singoli/compound (es. `margin: 2px 0 4px 22px`) non tokenizzabili in uno scalare semplice.

   Componenti con CSS ripetuto (da AI-Workspace/Plans doc originale) — verificato via lettura diretta:
   - `components/DonutChart.vue` (`<style>` scoped): `border-radius: 50%`(1, `.dot`), `font-size` 3 valori (`1.7rem`, `.68rem`, `.88rem`, `.78rem`), `gap: 24px`/`10px`, `padding: 0`.
   - `components/BarChart.vue` (`<style>` scoped): `border-radius: 6px`(2), `font-size` (`.72rem`, `.78rem`), `gap: 8px`/`10px`.
   - `components/wizard/StepFornitore.vue` (`<style>` scoped): `border-radius: 6px`(2)/`8px`(1), `font-size: .95rem`/`.85rem`/`.74rem`, `margin: 4px 0 0`, `padding: 4px`/`8px 10px`.
   - `components/wizard/StepClienti.vue` — **nessun `<style>` block**, tutto **inline `style="..."`** nel template (righe 58,63,69-71,76,80,85-86,90,98,100): `border-radius:8px`, `padding:9px 11px`/`8px 0`, `margin:0`/`12px`/`20px`, `gap:10px`/`20px`. Inline style non è toccabile con normali regole CSS in `style.css` — servirebbe migrare a classi prima, o lasciare hardcoded (fuori scope dichiarato dello step se si vuole restare "solo `style.css` + i file esplicitamente elencati nel doc originale").
   - `components/wizard/LogoUpload.vue` — **nessun `<style>` block**, solo 3 inline `style="..."` (righe 34-35,40): `border-radius:6px`, `padding:4px`, `gap:12px`. Stesso caveat di StepClienti.vue.

   **Nota per l'esecuzione:** StepClienti.vue e LogoUpload.vue, a differenza di DonutChart/BarChart/StepFornitore, non hanno CSS scoped da rimappare — hanno stili inline nel template. Il piano originale (riga 17 del documento) li cita insieme agli altri assumendo `<style>` block; da chiarire se il sotto-step 3 include la migrazione da inline a classi (rischio maggiore, tocca markup oltre che stile) o se questi due file restano hardcoded fuori scope.
2. ✅ (2026-09-03) Sostituire gli usi in `style.css` un blocco alla volta, verificando visivamente dopo ogni blocco. Blocco `border-radius` completato e committato (commit `02250ba`): sostituiti 13 usi che matchano esattamente un token (6px→`--radius-sm`, 8px→`--radius-md`, 12px→`--radius-lg`, 50%→`--radius-circle`, 99px→`--radius-pill`); lasciati hardcoded i valori senza token dedicato (7px×3, 10px×2, 14px×1) per non alterare il layout. Verifica: screenshot pre/post dashboard + timesheet via Playwright MCP (porta vite dev 5173, proxy verso backend 1969), diff pixel-per-pixel via PIL — timesheet 0 diff, dashboard diff solo su testo dinamico (countdown minuti "riprova tra N min" nel box scadenze fiscali), zero diff strutturale/spaziatura. Screenshot cancellati dopo verifica (contenevano dati reali: nome utente, importi fatture). Blocco `gap` completato e committato (commit `2dfd8d4`): sostituiti 7 usi (8px→`--gap-sm`, 10px→`--gap-md`), lasciati hardcoded i valori non ricorrenti. Verifica: 0 diff timesheet, diff trascurabile (12px, testo dinamico) su dashboard. Blocco `font-size` completato e committato (commit `b2e3831`): sostituiti 20 usi esatti (.68→`--font-size-2xs`, .72→`--font-size-xs`, .82→`--font-size-sm`, .86→`--font-size-base`, .92→`--font-size-md`, 1.3→`--font-size-lg`, 1.7rem→`--font-size-xl`), lasciati hardcoded i valori senza token dedicato (.7/.75/.76/.78/.8/.84/.88rem, 1rem) per non accorpare valori oggi distinti. Verifica: screenshot pre/post dashboard+timesheet via Playwright MCP, diff pixel-per-pixel via PIL — **0 diff bbox su entrambe le viste**. Screenshot cancellati dopo verifica (dati reali). Sotto-step 2 concluso, `style.css` interamente tokenizzato per spacing/radius/font-size dove sensato.
3. ✅ (2026-09-03) Ripetuto per i singoli componenti Vue, un componente per commit. `DonutChart.vue` (commit `ea98569`): font-size/gap/border-radius su `<style scoped>`. `BarChart.vue` (commit `02dce3e`): gap/font-size/border-radius su `<style scoped>`. `StepFornitore.vue` (commit `a2f1629`): border-radius su `<style scoped>` (font-size senza token dedicato, lasciati hardcoded). `StepClienti.vue` (commit `796843a`) e `LogoUpload.vue` (commit `ca011e7`): non avevano `<style>` block, solo inline `style="..."` — migrato l'unico inline con valori a match esatto di un token (border-radius/font-size) a una classe scoped dedicata, resto degli inline (gap/margin/padding/flex, senza token corrispondente) lasciato invariato. Verifica: screenshot pre/post via Playwright MCP per ogni file, diff pixel-per-pixel via PIL — **0 diff bbox su tutti e 5 i componenti** (incluso pannello dropdown ATECO aperto e logo caricato). Screenshot cancellati dopo verifica (dati reali: partita IVA, ragione sociale, logo cliente).

**Rischio:** medio — errore di mappatura valore→token può alterare spaziature/dimensioni percepibili. Ogni sotto-step verificato a vista prima del successivo.

**Protocollo di verifica (ogni sotto-step, obbligatorio, uguaglianza visiva totale richiesta):**
1. **Pre-mod:** avviare l'app, screenshot delle viste toccate dal sotto-step (dashboard, wizard, o vista con il componente in questione) — baseline "as is".
2. **Mod:** applicare il sotto-step.
3. **Post-mod:** stesse viste, stessa risoluzione/finestra, stesso stato dati — nuovo screenshot.
4. **Confronto:** sovrapporre/diff pixel-per-pixel pre vs post (non solo "sembra uguale a occhio"). Qualunque differenza di spaziatura/dimensione non intenzionale → correggere il valore token scelto finché il confronto torna a zero differenze, prima di passare al sotto-step successivo o committare.
5. Solo a confronto pulito (zero diff) si procede: commit del sotto-step, poi sotto-step successivo.

**Verifica:** confronto visivo prima/dopo per ogni file toccato secondo il protocollo sopra, sezioni con più densità di card/testo (dashboard, wizard).

**Commit (per ogni sotto-step):** `refactor: introduce token --space-*/--radius-*/--font-size-* in style.css` poi `refactor: applica token spacing/radius/font-size a style.css` poi uno per componente, es. `refactor: applica token design a DonutChart.vue`.

**Nota:** rimuovere la voce da KNOWN_ISSUES.md solo a sotto-step 3 completato per tutti i file elencati, non a metà.

---

## Cosa NON fare

- Non eseguire più step in un solo commit/sessione, anche se sembrano piccoli — la regola del task è step-by-step.
- Non riscrivere `KNOWN_ISSUES.md` in blocco a fine piano: ogni step la aggiorna incrementalmente, il file resta sempre coerente con lo stato reale del codice in ogni momento.
- Non aggiungere una sezione "storico issue risolte" nel documento — issue chiusa = riga rimossa, punto. La storia resta nei commit/CHANGELOG, non duplicata nel doc.
