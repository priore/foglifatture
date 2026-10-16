# Known Issues

Confidence: 🟢 confermato da codice · 🟡 inferito · 🔴 ipotesi

Limiti e incoerenze osservati. Solo documentazione: nulla qui viene corretto da questo workspace.

## Acconti INPS stimati dall'anno precedente

🟢 In `forfettarioService.js` gli acconti INPS sono stimati all'80% dell'INPS dell'anno N-1, perché i versamenti INPS non hanno codice tributo distinguibile. L'app emette un avviso nel risultato.

## Solo la gestione separata è calcolata

🟢 Artigiani/commercianti e casse professionali non hanno calcolo: le righe INPS del piano sono omesse con avviso, mentre il calendario mostra comunque le rate fisse artigiani/commercianti. Vedi FP-007.

## Copertura test incompleta

🟢 35 file `*.test.js` (servizi di calcolo e lib), ma senza test: `configService`, `envService`, `backupService`, `mailService`, `reminderService`, `sdiScartoReminderService`, `templateService`, `timesheetService`, `updateService`, `vmsTimesheetExporter`, `xmlInvoiceImporter`, `geminiAtecoService`, `lib/auth`, `lib/jsonStore`, `lib/logger`. Il frontend non ha alcun test.

## Accessibilità minima

🟢 `aria-*`/`role=` presenti solo su alcuni elementi (card trascinabili), `alt` solo sui loghi. Nessun audit dedicato.

---

## Review Checklist

- **Completeness:** non è una caccia ai bug esaustiva, solo limiti confermati leggendo il codice.
- **Accuracy:** ogni voce verificata su `forfettarioService.js` e sui file di test (2026-10-13).
- **Consistency:** coerente con `FEATURE_PROPOSALS.md` e `ARCHITECTURE.md`.
- **TODO:** rileggere dopo ogni feature che tocca il calcolo fiscale.
- **Missing information:** nessuna storia di incidenti in produzione.
- **Open questions:** quali limiti vale la pena correggere è una decisione di prodotto.
- **Confidence level:** 🟢.
