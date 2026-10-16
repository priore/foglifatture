# Design System — As Implemented

Confidence: 🟢 confermato da codice · 🟡 inferito · 🔴 ipotesi

## Linguaggio visivo

🟢 Fogli di stile: `frontend/src/style.css` globale (213 righe) con token, primitive e shell, più blocchi `<style scoped>` in 21 componenti/viste per il layout specifico. Le primitive condivise (bottoni, card, campi, tabelle, pill, checkbox, modali) vivono solo in `style.css`.

🟢 Tipografia (Google Fonts, `@import` in `style.css`):
- **Fraunces** (500/600/700): titoli e brand
- **Inter** (400–700): testo
- **IBM Plex Mono** (400–600): valori numerici, importi, ore

🟢 Superfici: sfondo caldo, card bianche con bordo `--line` e ombra morbida a due strati (`--shadow`). Nessun `backdrop-filter`/`blur` in `style.css`: la sensazione di leggerezza viene da trasparenze (`rgba(255,255,255,.08)` su stati nav) e da `color-mix` per le tinte discrete.

## Dark mode

🟢 Due blocchi di override dei token: `@media (prefers-color-scheme: dark)` con `:root:not([data-theme="light"])` (default da sistema) e `:root[data-theme="dark"]` (scelta manuale). Il toggle in `AppSidebar.vue` imposta `data-theme` e persiste su `localStorage`. La sidebar ha un override dedicato (`#0d1319`).

## Token

🟢 Colori, ombra, raggi, dimensioni font e gap sono tutti variabili CSS in `:root`. I valori esatti sono in `DESIGN_TOKENS.md`. Regola di progetto: mai hex/px hardcoded nei componenti, i token nuovi vanno nel blocco `:root` esistente (`.claude/rules/code-quality.md`).

## Componentizzazione

🟢 Le primitive sono classi globali che leggono i token, quindi ogni superficie è dark-aware senza lavoro per componente. Gli stili `scoped` nei componenti coprono solo layout locale (griglie, tab, card trascinabili).

🟢 I documenti stampati (fattura, timesheet) non seguono il tema dell'app: sono template Handlebars indipendenti sotto `backend/src/templates-default/<id>/` (`layout.html`, `layout.css`, `template.json`), resi in un iframe sandboxato da `TemplateStampa.vue`. Ogni template porta la propria palette e il proprio layout A4. Il cliente sceglie il template con `templateFatturaId` / `templateTimesheetId` (fallback `fattura-default` / `timesheet-default`).

## Accessibilità

🟢 Minima: `aria-*`/`role=` presenti solo su alcuni elementi interattivi (card trascinabili) e `alt` su loghi. Il resto si affida alla semantica HTML nativa. Vedi `UI_ANALYSIS.md`.

---

## Review Checklist

- **Completeness:** linguaggio visivo, dark mode, token, componentizzazione, template di stampa, accessibilità.
- **Accuracy:** verificato su `style.css`, `TemplateStampa.vue`, `templates-default/` (2026-10-13).
- **Consistency:** coerente con `DESIGN_TOKENS.md` e `UI_ANALYSIS.md`.
- **TODO:** nessuno.
- **Missing information:** nessuna.
- **Open questions:** nessuna.
- **Confidence level:** 🟢.
