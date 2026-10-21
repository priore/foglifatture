# Known Issues

Confidence: 🟢 confermato da codice · 🟡 inferito · 🔴 ipotesi

Limiti e incoerenze osservati. Solo documentazione: nulla qui viene corretto da questo workspace.

## Classificazione ricevute SDI: nomi delle radici XML da confermare

**Priorità: Bassa.**

- 🟢 IMAP e import ZIP usano la stessa mappa «radice XML ⇒ tipo» (`RADICE_RICEVUTA` in `importZipService.js`) e lo stesso estrattore (`radiceXml`).
- 🟢 Le email SDI annidano email dentro email (`.eml` o content-type `message/rfc822`): l'estrazione scende fino a 10 livelli.
- 🟡 La radice della notifica di scarto compare come `RicevutaScarto` in una ricevuta reale e `NotificaScarto` nella mappa: entrambe sono accettate. Gli altri nomi vanno confermati sugli XSD ufficiali SDI.
- 🟡 Gli allegati `.xml.p7m` (firmati) non vengono letti: il filtro IMAP tiene solo i `.xml`. Se una ricevuta arriva firmata, finisce solo nel log come «senza XML tra gli allegati».

## Fatture ricevute via PEC: non archiviate

**Priorità: Media.**

- 🟢 Il SDI consegna le fatture d'acquisto dalla stessa casella `@pec.fatturapa.it`. Passano quindi dal filtro IMAP di `controllaRicevuteSdi`, che le tratta così:
  - il file fattura `.xml`, radice `FatturaElettronica`, viene scartato come «non-riconosciuto», con chiamata AI E-AI.2 se autorizzata;
  - il file fattura `.xml.p7m` non viene nemmeno considerato: il filtro tiene solo gli allegati `.xml`;
  - il file metadati `_MT_` viene scartato come metadato di trasporto.
- 🟢 Un'email con una fattura ricevuta (`.xml` con radice `FatturaElettronica` o `.xml.p7m`) viene segnata `\Seen` e il suo `Message-ID` è registrato in `fattureRicevutePec.json` (cartella dati, non versionata).
  - Se la stessa email torna non letta, viene segnata `\Seen` senza rielaborarla.
- 🟢 La fattura resta non archiviata nell'app: nel file c'è solo oggetto, nomi degli allegati e data. L'archiviazione è il tema di K5.
- 🟡 Segnate come lette nel client di posta, le fatture d'acquisto non saltano più all'occhio.
- 🟢 Il polling automatico parte solo se c'è una fattura emessa nelle ultime 72 ore ancora senza esito (`inAttesaRispostaRecente`). Le fatture ricevute vengono quindi lette solo per coincidenza o col controllo manuale.
- Vedi K5 in `Plans/CONCORRENZA_GAP_FUNZIONALITA.md` e `Plans/SPESE_ACQUISTO_DA_PEC.md`.

## Acconti INPS stimati, non letti dai versamenti

🟢 In `stimaVersamentiService.js` gli acconti INPS sono stimati (80% del reddito dell'anno N con l'aliquota N+1, `accontoInpsAnnoSuccessivo`) senza poter leggere quanto è stato versato davvero, perché i versamenti INPS non hanno codice tributo distinguibile. L'app emette un avviso nel risultato.

## Solo la gestione separata è calcolata

🟢 Artigiani/commercianti e casse professionali non hanno calcolo: le righe INPS del piano sono omesse con avviso, mentre il calendario mostra comunque le rate fisse artigiani/commercianti. Vedi FP-007.

## Copertura test incompleta

🟢 40 file `*.test.js` (servizi di calcolo e lib), ma senza test: `envService`, `backupService`, `mailService`, `reminderService`, `sdiScartoReminderService`, `scartoSuggerimenti`, `templateService`, `timesheetService`, `updateService`, `vmsTimesheetExporter`, `xmlInvoiceImporter`, `geminiAtecoService`, `lib/auth`, `lib/jsonStore`, `lib/logger`. `configService` è coperto solo per `validaConfigCripto`. Il frontend non ha alcun test.

## Regole cripto 2026: citazione aliquota 33% da completare

🟢 In `regole/2026.json` la fonte `cripto.fonti.aliquota33` ha ancora `citazione` «TODO» e `url` nullo (L. 207/2024), diversamente dalle altre fonti della sezione. Gli acconti IVCA 1728/1729 (40%/60%) seguono la regola IRPEF, non confermata da una fonte specifica (🟡).

## Accessibilità minima

🟢 `aria-*`/`role=` presenti solo su alcuni elementi (card trascinabili), `alt` solo sui loghi. Nessun audit dedicato.

---

## Review Checklist

- **Completeness:** non è una caccia ai bug esaustiva, solo limiti confermati leggendo il codice.
- **Accuracy:** ogni voce verificata su `forfettarioService.js`, `stimaVersamentiService.js`, `regole/2026.json` e sui file di test (2026-10-19). Classificazione ricevute e ciclo IMAP verificati su `importZipService.js`, `importRoutes.js` e `sdiRicevuteService.js` (2026-10-21).
- **Consistency:** coerente con `FEATURE_PROPOSALS.md` e `ARCHITECTURE.md`.
- **TODO:** rileggere dopo ogni feature che tocca il calcolo fiscale.
- **Missing information:** nessuna storia di incidenti in produzione.
- **Open questions:**
  - Quali limiti vale la pena correggere è una decisione di prodotto.
  - Nomi esatti delle radici XML SDI da confermare sugli XSD ufficiali.
- **Confidence level:** 🟢.
