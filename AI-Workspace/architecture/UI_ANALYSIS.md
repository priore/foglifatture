# UI Analysis

Confidence: 🟢 confirmed by code · 🟡 inferred · 🔴 hypothesis

## Routing (`frontend/src/router/index.js`)

🟢 `createWebHistory()`, flat table, no meta fields, no guards:
- `/` → redirect to `/timesheet`.
- `/timesheet` (name `timesheet`) → `TimesheetView`.
- `/fattura` (name `fattura`) → `FatturaView`.
- `/importa-storico` (name `importa-storico`) → `ImportaStoricoView`.
- `/impostazioni` (name `impostazioni`) → `ImpostazioniView`.

## Views

🟢 **TimesheetView.vue** — monthly timesheet editor + summary + PDF print preview. Uses `MonthSwitcher`, `TimesheetGrid`, `TimesheetPrintPreview`. State (`ref`): `anno`, `mese`, `giorni`, `config`, `salvando`, `messaggioSalvataggio`, `anteprimaRef`, `meseMinimo`; computed `totaleMensile`, `giorniLavorati`, `assenze`. API: `getTimesheet`, `saveTimesheet`, `getConfig`, `listMesiTimesheet`. Composables: `useTimeCalculator`, `usePdfExport` (client-side, no backend call).

🟢 **FatturaView.vue** — pro-forma invoice screen: calc from timesheet, FatturaPA XML generation, PEC send, SDI receipt polling. Uses `MonthSwitcher`, `FatturaPrintPreview`. State: `anno`, `mese`, `config`, `anteprima`, `fatturaGenerata`, `anteprimaRef`, `inviandoPec`, `esitoPec`, `meseMinimo`, `controllandoSdi`, `esitoSdi`. API: `getConfig`, `anteprimaFattura`, `getFattura`, `generaFattura`, `urlDownloadXml` (URL open, not fetch), `inviaPec`, `controllaRicevuteSdi`, `listMesiTimesheet`.

🟢 **ImpostazioniView.vue** — multi-step settings wizard (fornitore/cliente/tariffa/PEC/Google login); autosaves on each step advance except the Google-auth step. Uses `WizardSteps`, `StepFornitore`, `StepCliente`, `StepFatturazione`, `StepPec`, `StepGoogleAuth`. State: `passoAttivo`, `config`, `messaggio` (plus non-reactive constants `PASSI`, `PASSI_AUTOSALVANTI`). API: `getConfig`, `saveConfig`.

🟢 **ImportaStoricoView.vue** — one-off historical import: legacy XLS timesheet, FatturaPA XML invoice. No child view components beyond native file inputs. State: `annoTimesheet`, `meseTimesheet`, `fileTimesheet`, `importandoTimesheet`, `esitoTimesheet`, `fileFattura`, `importandoFattura`, `esitoFattura`. API: `importaTimesheet`, `importaFattura`.

## Wizard step navigation (`WizardSteps.vue`)

🟢 Purely presentational: `passoAttivo` (active step index) and step labels are props from `ImpostazioniView`, no local step state. Clicking a step emits `vai` with the clicked index; `ImpostazioniView.vaiAlPasso` handles navigation (saves current step first unless autosaving, then reassigns `passoAttivo`). Next/prev buttons live in the parent view, not in `WizardSteps` itself.

## Sidebar navigation (`AppSidebar.vue`)

🟢 4 `router-link`s to the 4 real routes: `/timesheet` ("Timesheet mensile"), `/fattura` ("Fattura Pro-Forma"), `/importa-storico` ("Importa storico"), `/impostazioni` ("Impostazioni"). Fetches `api.getConfig()` on mount to show the fornitore's name in the footer (falls back to "Consulente" on error).

## Root layout (`App.vue`)

🟢 `.app-shell` div containing `AppSidebar` + `.main` div wrapping `<router-view />`. No header, no dark-mode toggle, no other global chrome.

## Dark mode / theme

🟢 No JS-driven theme toggle anywhere in `frontend/src` — no toggle component, no `localStorage` theme key, no code setting `data-theme`. `style.css` defines dark rules via `@media (prefers-color-scheme: dark)` combined with `:root:not([data-theme="light"])`, plus a `:root[data-theme="dark"]` override selector. 🟡 Inferred: the `data-theme` override hooks are unused CSS attribute selectors (dead code) since nothing in the app ever sets that attribute — theme is OS-driven only in practice.

## Accessibility

🟢 Minimal: only 2 `alt=` attributes in the entire `frontend/src` (`LogoUpload.vue`, `LogoPlaceholder.vue`, both `alt="Logo"`). No `aria-*` or explicit `role=` attributes found anywhere. Buttons, nav links, and form inputs rely entirely on native HTML semantics, no ARIA enhancement.

---

## Review Checklist

- **Completeness:** routing, all 4 views, wizard mechanics, sidebar, root layout, theme, and a11y covered.
- **Accuracy:** all 🟢 claims read directly from router/index.js, view files, WizardSteps.vue, AppSidebar.vue, App.vue, style.css, and repo-wide grep for aria-/role-/data-theme.
- **Consistency:** view/component names match `DESIGN_PATTERNS_AS_IS.md` and `PROJECT_ANALYSIS.md` folder map.
- **TODO:** none outstanding for this pass.
- **Missing information:** per-field validation rules inside Step*.vue components not itemized (candidate for `COMPONENT_LIBRARY.md`).
- **Open questions:** is the unused `data-theme` CSS override intentional forward-prep for a future manual toggle, or leftover from an earlier design? Flagged for `KNOWN_ISSUES.md`.
- **Confidence level:** predominantly 🟢, one 🟡 inference (dead `data-theme` CSS hooks).
