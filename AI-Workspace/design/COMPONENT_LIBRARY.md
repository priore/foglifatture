# Component Library — As Implemented

Confidence: 🟢 confirmed by code · 🟡 inferred · 🔴 hypothesis

## Reusable Vue components (`frontend/src/components/`)

| Component | Path | Purpose | Props |
|---|---|---|---|
| AppSidebar | `common/AppSidebar.vue` | App nav sidebar: brand + route links to all views, wizard sub-nav breadcrumb, dark-mode toggle; fetches config on mount to show fornitore name | none |
| ClienteSwitcher | `common/ClienteSwitcher.vue` | Custom dropdown (not native `<select>`) to pick the active client, with search filter | `clienti:Array` (req, `[{id, denominazione}]`), `modelValue:String=null` |
| LogoPlaceholder | `common/LogoPlaceholder.vue` | Renders uploaded logo image or placeholder SVG | `width:Number=90`, `height:Number=46`, `mostraNome:Boolean=true`, `logoDataUrl:String=''` |
| MonthSwitcher | `common/MonthSwitcher.vue` | Prev/next month navigation + month/year picker | `anno:Number` (req), `mese:Number` (req), `meseMinimo:String=null` |
| DonutChart | `DonutChart.vue` | Generic SVG donut chart with centered value/label, used by the forfettario dashboard | `fette:Array` (req, `[{valore, colore, etichetta}]`), `centroValore:String=''`, `centroLabel:String=''` |
| FatturaPrintPreview | `fattura/FatturaPrintPreview.vue` | Printable A4 invoice layout | `fornitore:Object` (req), `cliente:Object` (req), `numero:String` (req), `data:String` (req), `descrizione:String` (req), `imponibile:Number` (req), `bollo:Number` (req), `bolloApplicabile:Boolean` (req), `nettoAPagare:Number` (req) |
| TimesheetGrid | `timesheet/TimesheetGrid.vue` | Editable monthly timesheet table (hours/notes/status per day) | `giorni:Array` (req) |
| TimesheetPrintPreview | `timesheet/TimesheetPrintPreview.vue` | Printable Excel-replica timesheet | `anno:Number` (req), `mese:Number` (req), `giorni:Array` (req), `consulente:String=''`, `localita:String=''`, `logoDataUrl:String=''` |
| LogoUpload | `wizard/LogoUpload.vue` | File input for logo upload (500KB limit), v-model | `modelValue:String=''`, `etichetta:String='Logo'` |
| StepClienti | `wizard/StepClienti.vue` | Wizard step: manage the client list (add/edit/soft-delete, each with own rate) | `modelValue:Array` (req) |
| StepFatturazione | `wizard/StepFatturazione.vue` | Wizard step: billing/fiscal settings form | `modelValue:Object` (req) |
| StepForfettario | `wizard/StepForfettario.vue` | Wizard step: ATECO code + forfettario coefficient selection | `modelValue:Object` (req, `config.forfettario`) |
| StepFornitore | `wizard/StepFornitore.vue` | Wizard step: supplier data form, inline P.IVA/codice fiscale validation | `modelValue:Object` (req) |
| StepGemini | `wizard/StepGemini.vue` | Wizard step: optional Gemini API key setup for ATECO lookup (stored in `backend/.env`, not `config.json`) | none |
| StepGoogleAuth | `wizard/StepGoogleAuth.vue` | Wizard step: Google OAuth login info | none |
| StepPec | `wizard/StepPec.vue` | Wizard step: PEC/SDI credentials form | `modelValue:Object` (req), `sdi:Object` (req) |
| StepBackup | `wizard/StepBackup.vue` | Wizard step: automatic backup schedule settings | `modelValue:Object` (req, `config.backup`) |
| StepPromemoria | `wizard/StepPromemoria.vue` | Wizard step: end-of-month timesheet reminder settings | `modelValue:Object` (req, `config.reminder`) |
| WizardSteps | `wizard/WizardSteps.vue` | Step-indicator/breadcrumb; purely presentational, emits `vai` on click | `passi:Array` (req), `passoAttivo:Number` (req) |

🟢 All components use `defineProps` (Composition API `<script setup>`), consistent with `DESIGN_PATTERNS_AS_IS.md`. None declare a `<style>` block — all visuals come from global classes in `style.css`. 🟢 `wizard/StepCliente.vue` (singular) exists on disk but is unreferenced anywhere in the app — superseded by `StepClienti.vue` (plural, multi-client), dead file.

## Shared UI primitives (defined once in `frontend/src/style.css`, reused everywhere)

- 🟢 **Buttons** — `.btn` base + `.btn-primary`/`.btn-ghost` modifiers. Used by MonthSwitcher, wizard nav, page actions.
- 🟢 **Cards/panels** — `.card` / `.card-head` / `.card-body`, and `.stat` (summary tiles). Shared across views.
- 🟢 **Form fields** — `.field` / `.field label` / `.field input,select`, with validation states `.campo-non-valido` / `.nota-errore`. Identical usage across all Step*.vue wizard forms.
- 🟢 **Tables** — `.data-table`, shared by grid views. Print tables (`.doc-table`, `.xls-grid`) are deliberately separate (different, fixed-document design system — see `DESIGN_TOKENS.md`).
- 🟢 **Pills/badges** — `.pill`, `.pill-work`, `.pill-absence`, `.badge-mono`.

🟢 No duplicate/inline overrides found for any primitive — single source of truth confirmed by absence of `<style>` blocks in components/views.

### Checkbox — `.checkbox-app`

Pattern obbligatorio per tutte le checkbox nel wizard e nelle impostazioni. `input` e `label` **sempre separati** (non wrappati), collegati via `id`/`for`.

```html
<div style="display:flex;align-items:center;gap:8px">
  <input id="my-flag" type="checkbox" v-model="obj.flag" class="checkbox-app">
  <label for="my-flag" style="margin:0">Testo della checkbox</label>
</div>
<small class="note-legal" style="margin-top:6px">Spiegazione normativa opzionale.</small>
```

- **Non** usare `<label>` come wrapper del `<input>` — rompe lo stile.
- **Non** usare `style="width:auto"` inline — la larghezza fissa (18 px) è nello stile.
- `.checkbox-app` è scoped: va definito nel `<style scoped>` del componente che lo usa (non è in `style.css` globale). Copiare dal blocco `<style scoped>` di `StepClienti.vue` o `StepFornitore.vue`.
- Due checkbox logicamente correlate che devono stare sulla stessa riga vanno in un `div.field.full` (span intera riga nella `form-grid`) con un div interno `.checkbox-row` (grid 1fr 1fr), e ogni checkbox in un `.field` figlio. **Importante:** la classe span-riga è `.full`, non `.field-full` — in `style.css` la regola è `.field.full { grid-column: 1/-1 }`. Non usare due `.field` separati nella grid esterna: la `note-legal` di altezza variabile li spinge su righe diverse.
- Esempi: `StepClienti.vue` (flag `pagamentoBtc`), `StepFornitore.vue` (flag `requisitiAliquotaRidotta`, `soggettoIsa`).

## Composables (not components, but shared logic units — `frontend/src/composables/`)

- 🟢 `useTimeCalculator.js` — wraps hour-calculation logic (used by TimesheetView).
- 🟢 `usePdfExport.js` — client-side PDF export via `html2pdf.js` (used by TimesheetView, FatturaView print previews).
- 🟢 `useValidazioneFiscale.js` — Italian fiscal-data validation (used by wizard Step components).
- 🟢 `useMailto.js` — builds `mailto:` links, used for user-triggered email actions outside the PEC/SDI flow.

---

## Review Checklist

- **Completeness:** all reusable components (including new dashboard/multi-client/wizard additions) and shared primitive classes catalogued with props.
- **Accuracy:** props read directly from each `defineProps` call; primitive classes confirmed via `style.css` line ranges cited in `DESIGN_TOKENS.md`.
- **Consistency:** matches `UI_ANALYSIS.md` view-to-component usage and `DESIGN_SYSTEM.md` componentization philosophy.
- **TODO:** confirm whether unreferenced `StepCliente.vue` should be deleted from the codebase (documentation-only workspace, not actioned here — see `KNOWN_ISSUES.md`).
- **Missing information:** no Storybook or isolated component demo exists — this catalog is derived from source reading only.
- **Open questions:** none blocking.
- **Confidence level:** entirely 🟢.
