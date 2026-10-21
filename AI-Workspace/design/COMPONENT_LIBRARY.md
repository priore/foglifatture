# Component Library — As Implemented

Confidence: 🟢 confermato da codice · 🟡 inferito · 🔴 ipotesi

## Componenti (`frontend/src/components/`)

### Condivisi

| Componente | Percorso | Scopo | Props |
|---|---|---|---|
| AppSidebar | `common/AppSidebar.vue` | Navigazione, sotto-voci Impostazioni/Importa storico, toggle tema, link Privacy, versione | nessuna |
| ClienteSwitcher | `common/ClienteSwitcher.vue` | Dropdown custom con ricerca per scegliere il cliente attivo | `clienti:Array` (req, `[{id, denominazione}]`), `modelValue:String=null` |
| MonthSwitcher | `common/MonthSwitcher.vue` | Mese precedente/successivo e selettore mese/anno | `anno:Number` (req), `mese:Number` (req), `meseMinimo:String=null` |
| TemplateStampa | `common/TemplateStampa.vue` | Rende un template di stampa (fattura/timesheet) risolto da id in un iframe sandboxato, scalato su A4 | `templateId:String` (req), `dati:Object` (req), `adatta:Boolean=true` |
| FileDrop | `common/FileDrop.vue` | Dropzone per file (click o drag and drop), emette sempre un array di `File` | `accept:String=''`, `multiple:Boolean=false`, `directory:Boolean=false`, `label:String`, `disabled:Boolean=false` |
| DonutChart | `DonutChart.vue` | Grafico SVG ad anello con valore centrale | `fette:Array` (req, `[{valore, colore, etichetta}]`), `centroValore:String=''`, `centroLabel:String=''` |
| BarChart | `BarChart.vue` | Grafico a barre | `barre:Array` (req, `[{etichetta, valore}]`) |
| LineChart | `LineChart.vue` | Grafico a linee, anche in modalità sparkline | `punti:Array` (req, `[{etichetta, valore, valoreTesto}]`), `scalaRelativa:Boolean=false`, `sparkline:Boolean=false` |
| BtcRegistro | `BtcRegistro.vue` | Registro BTC: movimenti dell'anno con colonna «Tipo», form ingresso/uscita con anteprima plusvalenza, eliminazione; emette `cambiato` | `anno:Number` (req) |
| BtcImport | `BtcImport.vue` | Import BTC: stato polling, proposte (conferma/scarta/ripristina), import da file con mapping AI; emette `cambiato` | nessuna |
| BtcValoreLive | `BtcValoreLive.vue` | Card prezzo di 1 BTC e valore dei BTC detenuti (usa `useBtcLive`) | nessuna |
| ChatAi | `ChatAi.vue` | Chat AI in sola lettura sui dati dell'app, con domande suggerite e consenso invio dati | nessuna |
| UpdateModal | `UpdateModal.vue` | Modale di aggiornamento app, emette `aggiorna` / `annulla` | `versioneLocale`, `versioneRemota`, `changelog:String`, `inCorso:Boolean` |

### Timesheet

| Componente | Percorso | Scopo | Props |
|---|---|---|---|
| TimesheetGrid | `timesheet/TimesheetGrid.vue` | Tabella editabile del mese (ore, note, stato per giorno) | `giorni:Array` (req) |

### Wizard e impostazioni (`wizard/`)

| Componente | Scopo | Props |
|---|---|---|
| StepFornitore | Anagrafica, fiscale, fatturazione (bollo, pagamento, wallet BTC) in tre schede | `modelValue` (`config.fornitore`), `forfettario`, `fatturazione`, `walletBtc`, `importBtc` (tutte req) |
| StepClienti | Elenco clienti: aggiunta, modifica, cancellazione logica | `modelValue:Array` (req) |
| StepCliente | Form di un singolo cliente, usato da `StepClienti` | `modelValue:Object` (req) |
| StepPec | Credenziali PEC, gestori preconfigurati, prove | `modelValue` (`config.pec`), `sdi` (`config.sdi`) |
| StepPercorsoDati | Spostamento della cartella dati | `modelValue` (`config.dati`) |
| StepBackup | Pianificazione backup automatico | `modelValue` (`config.backup`) |
| StepPromemoria | Promemoria fine mese e notifiche desktop | `modelValue` (`config.reminder`), `notifiche` (`config.notifiche`) |
| StepGoogleAuth | Credenziali OAuth Google | nessuna |
| StepAI | Contenitore delle schede provider AI e del pannello MCP | nessuna |
| StepGeminiAI / StepCopilotAI / StepLocaleLLM | Scheda provider (stato router, login, modello) | `routerDati:Object=null` |
| StepClaudeAI / StepGroqAI | Scheda provider con API key e modello | nessuna |
| StepMcp | Abilitazione server MCP, token, comandi pronti da incollare | nessuna |
| StepRegoleFiscali | Regole fiscali per anno: stato, differenze, conferma, proposte, fonti (montato dalla dashboard) | nessuna |
| TemplateGrid | Selettore template di stampa a griglia | `modelValue:String=null`, `tipo:String` (req, `fattura`/`timesheet`), `fallbackId:String` (req) |
| LogoUpload | Upload logo (v-model, data URL) | `modelValue:String=''`, `etichetta:String='Logo'` |

🟢 Tutti i componenti usano `<script setup>` con `defineProps`. 19 componenti dichiarano `<style scoped>` per il layout locale.

## Primitive globali (`frontend/src/style.css`)

- 🟢 **Bottoni**: `.btn` + modificatori `.btn-primary`, `.btn-ghost`, `.btn-blue`, `.btn-violet`, `.btn-amber`
- 🟢 **Card e riquadri**: `.card` con `.card-head` e `.card-body`, `.stat` per le tessere riepilogo
- 🟢 **Form**: `.form-grid`, `.field` (con `.field.full` per occupare l'intera riga), stati `.campo-non-valido` e `.nota-errore`, testo normativo `.note-legal`
- 🟢 **Tabelle**: `.data-table`
- 🟢 **Pill e badge**: `.pill`, `.pill-work`, `.pill-absence`, `.badge-mono`
- 🟢 **Modali**: `.modal-overlay` / `.modal-box` / `.modal-actions`, popup AI `.ai-overlay` / `.ai-popup`
- 🟢 **Layout**: `.app-shell`, `.sidebar`, `.main`, `.page-head`, `.nav` / `.nav-sub`

### Checkbox — `.checkbox-app`

🟢 Definita globalmente in `style.css`. Pattern obbligatorio per ogni checkbox: `input` e `label` separati, collegati da `id`/`for`, mai la label come wrapper.

```html
<div style="display:flex;align-items:center;gap:8px">
  <input id="my-flag" type="checkbox" v-model="obj.flag" class="checkbox-app">
  <label for="my-flag" style="margin:0">Testo della checkbox</label>
</div>
<small class="note-legal" style="margin-top:6px">Spiegazione normativa opzionale.</small>
```

- Larghezza e stile arrivano dalla classe: niente `style="width:auto"`.
- Due checkbox correlate sulla stessa riga vanno in un `div.field.full` con un `.checkbox-row` interno (griglia a 2 colonne, definita in `StepFornitore.vue`), ognuna in un `.field` figlio.
- La classe di span-riga è `.field.full`, non `.field-full`.

## Composables (`frontend/src/composables/`)

- 🟢 `useTimeCalculator.js` — `calcolaOreGiorno`, `calcolaTotaleMensile`, `decimaleAHHmm`, `STATI_ASSENZA`
- 🟢 `usePdfExport.js` — `esportaPdf`, `generaPdfBlob` (html2pdf.js, lato client)
- 🟢 `useTemplateRenderer.js` — `compilaTemplate` (Handlebars), `montaInIframe`
- 🟢 `useTemplateData.js` — `preparaDatiFattura`, `preparaDatiTimesheet`, `pagamentoDaConfig`: costruiscono il contesto dati dei template
- 🟢 `useValidazioneFiscale.js` — `pivaValida`, `codiceFiscaleValido`, `codiceSdiValido`, `pecValida`
- 🟢 `useMailto.js` — `inviaPdfEmail`: salva il PDF e apre il client di posta
- 🟢 `useMarkdown.js` — `renderMarkdown`: rendering minimale di testo AI e changelog
- 🟢 `useBtcLive.js` — `useBtcLive`: prezzo BTC/EUR (CoinGecko) e BTC detenuti, stato condiviso tra vista Bitcoin e dashboard, aggiornamento ogni 60 s
- 🟢 `useUpdateCheck.js` — polling stato aggiornamento ogni 10 minuti

---

## Review Checklist

- **Completeness:** tutti i componenti e le primitive in uso, con props.
- **Accuracy:** props lette da ogni `defineProps`; classi verificate su `style.css` (2026-10-19).
- **Consistency:** coerente con `UI_ANALYSIS.md` e `DESIGN_SYSTEM.md`.
- **TODO:** nessuno.
- **Missing information:** nessun catalogo interattivo (Storybook): catalogo derivato dalla lettura del sorgente.
- **Open questions:** nessuna.
- **Confidence level:** 🟢.
