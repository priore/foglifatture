# Component Library — As Implemented

Confidence: 🟢 confirmed by code · 🟡 inferred · 🔴 hypothesis

## Reusable Vue components (`frontend/src/components/`)

| Component | Path | Purpose | Props |
|---|---|---|---|
| AppSidebar | `common/AppSidebar.vue` | App nav sidebar: brand + route links to the 4 views; fetches config on mount to show fornitore name | none |
| LogoPlaceholder | `common/LogoPlaceholder.vue` | Renders uploaded logo image or placeholder SVG | `width:Number=90`, `height:Number=46`, `mostraNome:Boolean=true`, `logoDataUrl:String=''` |
| MonthSwitcher | `common/MonthSwitcher.vue` | Prev/next month navigation + month/year picker | `anno:Number` (req), `mese:Number` (req), `meseMinimo:String=null` |
| FatturaPrintPreview | `fattura/FatturaPrintPreview.vue` | Printable A4 invoice layout | `fornitore:Object` (req), `cliente:Object` (req), `numero:String` (req), `data:String` (req), `descrizione:String` (req), `imponibile:Number` (req), `bollo:Number` (req), `bolloApplicabile:Boolean` (req), `nettoAPagare:Number` (req) |
| TimesheetGrid | `timesheet/TimesheetGrid.vue` | Editable monthly timesheet table (hours/notes/status per day) | `giorni:Array` (req) |
| TimesheetPrintPreview | `timesheet/TimesheetPrintPreview.vue` | Printable Excel-replica timesheet | `anno:Number` (req), `mese:Number` (req), `giorni:Array` (req), `consulente:String=''`, `localita:String=''`, `logoDataUrl:String=''` |
| LogoUpload | `wizard/LogoUpload.vue` | File input for logo upload (500KB limit), v-model | `modelValue:String=''`, `etichetta:String='Logo'` |
| StepCliente | `wizard/StepCliente.vue` | Wizard step: client data form | `modelValue:Object` (req) |
| StepFatturazione | `wizard/StepFatturazione.vue` | Wizard step: billing/fiscal settings form | `modelValue:Object` (req) |
| StepFornitore | `wizard/StepFornitore.vue` | Wizard step: supplier data form | `modelValue:Object` (req) |
| StepGoogleAuth | `wizard/StepGoogleAuth.vue` | Wizard step: Google OAuth login info | none |
| StepPec | `wizard/StepPec.vue` | Wizard step: PEC/SDI credentials form | `modelValue:Object` (req), `sdi:Object` (req) |
| WizardSteps | `wizard/WizardSteps.vue` | Step-indicator/breadcrumb; purely presentational, emits `vai` on click | `passi:Array` (req), `passoAttivo:Number` (req) |

🟢 All 13 components use `defineProps` (Composition API `<script setup>`), consistent with `DESIGN_PATTERNS_AS_IS.md`. None declare a `<style>` block — all visuals come from global classes in `style.css`.

## Shared UI primitives (defined once in `frontend/src/style.css`, reused everywhere)

- 🟢 **Buttons** — `.btn` base + `.btn-primary`/`.btn-ghost` modifiers. Used by MonthSwitcher, wizard nav, page actions.
- 🟢 **Cards/panels** — `.card` / `.card-head` / `.card-body`, and `.stat` (summary tiles). Shared across views.
- 🟢 **Form fields** — `.field` / `.field label` / `.field input,select`, with validation states `.campo-non-valido` / `.nota-errore`. Identical usage across all Step*.vue wizard forms.
- 🟢 **Tables** — `.data-table`, shared by grid views. Print tables (`.doc-table`, `.xls-grid`) are deliberately separate (different, fixed-document design system — see `DESIGN_TOKENS.md`).
- 🟢 **Pills/badges** — `.pill`, `.pill-work`, `.pill-absence`, `.badge-mono`.

🟢 No duplicate/inline overrides found for any primitive — single source of truth confirmed by absence of `<style>` blocks in components/views.

## Composables (not components, but shared logic units — `frontend/src/composables/`)

- 🟢 `useTimeCalculator.js` — wraps hour-calculation logic (used by TimesheetView).
- 🟢 `usePdfExport.js` — client-side PDF export via `html2pdf.js` (used by TimesheetView, FatturaView print previews).
- 🟢 `useValidazioneFiscale.js` — Italian fiscal-data validation (used by wizard Step components, per naming — not verified line-by-line in this pass).

---

## Review Checklist

- **Completeness:** all 13 components and 5 shared primitive classes catalogued with props.
- **Accuracy:** props read directly from each `defineProps` call; primitive classes confirmed via `style.css` line ranges cited in `DESIGN_TOKENS.md`.
- **Consistency:** matches `UI_ANALYSIS.md` view-to-component usage and `DESIGN_SYSTEM.md` componentization philosophy.
- **TODO:** verify `useValidazioneFiscale.js` internals and confirm exactly which Step components consume it.
- **Missing information:** no Storybook or isolated component demo exists — this catalog is derived from source reading only.
- **Open questions:** none blocking.
- **Confidence level:** predominantly 🟢; one composable's usage (🟡) not fully line-verified.
