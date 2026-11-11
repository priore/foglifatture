---
paths:
  - "frontend/src/**"
---

# UI design rules (popups and dialogs)

- **Confirm/cancel button pair**: the confirm action (OK, Aggiorna, Sì…) is on the LEFT of the popup, green (`btn btn-ok`). Cancel is on the RIGHT, soft red (`btn btn-warn`, the muted token, never a saturated red). Intermediate/secondary choices (e.g. "Sovrascrivi", "Sì, sempre") sit in the middle as `btn btn-blue` (or another filled colored variant): never a transparent/plain ghost button inside a popup, it must have a proper app-style background. Use `chiediScelta` from `composables/useConferma.js` for the three-button case.
- **Same size**: the buttons of a pair have identical width and height. Use the `.modal-actions` container in `frontend/src/style.css` (equal-width flex children); don't size them inline.
- **Single-button popups** (informational, "Chiudi" / "Ho capito") are not a pair: the button stays right-aligned at natural width.
- **Dismiss**: tap outside the popup (`@click.self` on the overlay) and Esc close it with no selection and no side effect, same as Cancel.
- **Title and sub-description**: a popup that edits a field is titled with that field's name and may carry a one-line description.
- **Icons beside inputs**: use the `--calendar-icon` token (grey in light mode, white in dark mode) for the calendar icon; don't hard-code colors.
- **Lists / selections**: never use a native `<select>` (or a custom inline dropdown). Use `SelectField` (`components/common/SelectField.vue`, same `<option>`/`<optgroup>` slot and `v-model`; pass `titolo` and `descrizione`) or `ListaPopup` directly. The popup is centered with title, sub-description and OK/Cancel as above. Lists longer than 8 selectable items get a search box automatically.
- **Dates**: never use `<input type="date|month">`; use `DateField` (`components/common/DateField.vue`) or `CalendarioPopup` directly.
- **Confirmations and alerts**: never `confirm()`/`alert()`. Use `chiediConferma(msg, {titolo, ok})` / `avvisa(msg)` from `composables/useConferma.js` (single `ConfermaPopup` mounted in `App.vue`, `await` the boolean). Name the confirm button after the action ("Elimina", "Emetti"), not a generic OK.
- **URLs in texts**: any address mentioned in a text (e.g. "get an API key at console.example.com") is a tappable `<a href="https://…" target="_blank" rel="noopener">`. It opens in the external browser, never in an in-app sheet. Never leave a bare URL as plain text or `<strong>`.
- **Modules that insert data** (payment forms, manual entries): never inline in the page. Use `ModuloPopup` (`components/common/ModuloPopup.vue`; `come-form` + `@invia` for a `<form>`, body in the default slot, buttons in the `azioni` slot). Same popup rules as above. In compact shells it becomes a full-screen modal view automatically when the content does not fit the screen.
