# UI Analysis

Confidence: 🟢 confirmed by code · 🟡 inferred · 🔴 hypothesis

## Routing (`frontend/src/router/index.js`)

🟢 `createWebHistory()`, flat table, no meta fields, no guards:
- `/` → redirect to `/timesheet`.
- `/timesheet` (name `timesheet`) → `TimesheetView`.
- `/fattura` (name `fattura`) → `FatturaView`.
- `/dashboard` (name `dashboard`) → `DashboardView`.
- `/importa-storico` (name `importa-storico`) → `ImportaStoricoView`.
- `/impostazioni` (name `impostazioni`) → `ImpostazioniView`.
- `/impostazioni/pec-cronologia` (name `pec-cronologia`) → `CronologiaPecView`.

## Views

🟢 **TimesheetView.vue** — monthly timesheet editor + summary + PDF print preview, scoped to the active client (`ClienteSwitcher`). Uses `MonthSwitcher`, `ClienteSwitcher`, `TimesheetGrid`, `TimesheetPrintPreview`. Composables: `useTimeCalculator`, `usePdfExport` (client-side, no backend call).

🟢 **FatturaView.vue** — pro-forma invoice screen: calc from timesheet or free amount/description, FatturaPA XML generation + validation, PEC send, SDI receipt polling, scoped to the active client. Uses `MonthSwitcher`, `ClienteSwitcher`, `FatturaPrintPreview`.

🟢 **DashboardView.vue** — regime forfettario dashboard: cumulative yearly income vs. the forfettario threshold, estimated tax, two donut charts (`DonutChart.vue`) — income/taxable-income/estimated-tax split, and threshold-consumed vs. remaining margin. Year picker, calls `api.dashboardForfettario(anno)` (backed by `forfettarioService.js`).

🟢 **ImpostazioniView.vue** — multi-step settings wizard (fornitore/clienti/tariffa/forfettario/PEC/Gemini/Google login/backup/promemoria); step order driven by `wizardImpostazioniPassi.js`; autosaves on each step advance except the Google-auth step. Uses `WizardSteps`, `StepFornitore`, `StepClienti`, `StepFatturazione`, `StepForfettario`, `StepPec`, `StepGemini`, `StepGoogleAuth`, `StepBackup`, `StepPromemoria`.

🟢 **CronologiaPecView.vue** — sub-view of Settings (`/impostazioni/pec-cronologia`): PEC sends to SDI and received SDI receipts/notifications, aggregated across all clients and invoices. Calls `api.cronologiaPec()`.

🟢 **ImportaStoricoView.vue** — one-off historical import: legacy XLS timesheet, FatturaPA XML invoice; step order driven by `wizardImportaStoricoPassi.js`. No child view components beyond native file inputs.

## Wizard step navigation (`WizardSteps.vue`)

🟢 Purely presentational: `passoAttivo` (active step index) and step labels are props from the parent view, no local step state. Clicking a step emits `vai` with the clicked index; the parent's `vaiAlPasso` handles navigation (saves current step first unless autosaving, then reassigns `passoAttivo`). Next/prev buttons live in the parent view, not in `WizardSteps` itself. Step lists for both wizards are centralized in `wizardImpostazioniPassi.js` / `wizardImportaStoricoPassi.js`, also consulted by `AppSidebar.vue` to render the sub-nav breadcrumb.

## Sidebar navigation (`AppSidebar.vue`)

🟢 Top-level links: `/timesheet`, `/fattura`, `/dashboard`, `/importa-storico` (with a step sub-nav when active), `/impostazioni` (with a step sub-nav when active, including a `Cronologia` link to `/impostazioni/pec-cronologia`). Fetches `api.getConfig()` on mount to show the fornitore's name in the footer (falls back to "Consulente" on error). Footer also hosts the dark-mode toggle button.

## Root layout (`App.vue`)

🟢 `.app-shell` div containing `AppSidebar` + `.main` div wrapping `<router-view />`. No separate header — theme toggle lives in the sidebar footer.

## Dark mode / theme

🟢 JS-driven manual toggle exists: `AppSidebar.vue` reads/writes `document.documentElement`'s `data-theme` attribute and persists the choice to `localStorage['theme']`. `style.css` applies dark rules via `@media (prefers-color-scheme: dark)` combined with `:root:not([data-theme="light"])` (OS-driven default), plus a `:root[data-theme="dark"]` override selector that the toggle now actively drives. Not dead code.

## Client scoping (`ClienteSwitcher.vue`)

🟢 Custom dropdown (not a native `<select>`) so the selected client's name can wrap onto multiple lines — a native `<select>` can't wrap its displayed value. Props: `clienti` (`[{ id, denominazione }]`, required), `modelValue` (selected id). Includes a search filter over `denominazione`. Used by `TimesheetView` and `FatturaView` to scope data to one client at a time.

## Accessibility

🟢 Minimal: only 2 `alt=` attributes in the entire `frontend/src` (`LogoUpload.vue`, `LogoPlaceholder.vue`, both `alt="Logo"`). No `aria-*` or explicit `role=` attributes found anywhere. Buttons, nav links, and form inputs rely entirely on native HTML semantics, no ARIA enhancement.

---

## Review Checklist

- **Completeness:** routing, all 6 views, wizard mechanics, sidebar, root layout, theme, client scoping, and a11y covered.
- **Accuracy:** all 🟢 claims read directly from router/index.js, view files, WizardSteps.vue, AppSidebar.vue, ClienteSwitcher.vue, App.vue, style.css.
- **Consistency:** view/component names match `DESIGN_PATTERNS_AS_IS.md` and `PROJECT_ANALYSIS.md` folder map.
- **TODO:** none outstanding.
- **Missing information:** per-field validation rules inside Step*.vue components not itemized (candidate for `COMPONENT_LIBRARY.md`).
- **Open questions:** none.
- **Confidence level:** entirely 🟢.
