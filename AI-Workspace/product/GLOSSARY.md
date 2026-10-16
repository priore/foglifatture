# Glossary

Confidence: 🟢 confermato da codice · 🟡 inferito · 🔴 ipotesi

## Termini di dominio (fatturazione elettronica / regime forfettario)

- 🟢 **Regime forfettario** — regime fiscale agevolato per partite IVA: fatture senza IVA, senza rivalsa obbligatoria e senza ritenuta d'acconto, imposta sostitutiva sul reddito forfettario.
- 🟢 **Imposta sostitutiva** — 5% (requisiti L. 190/2014 c. 65, primi 5 anni) o 15%, calcolata su ricavi × coefficiente di redditività. Aliquota in `forfettarioService.aliquotaImposta`.
- 🟢 **Coefficiente di redditività** — percentuale legata al codice ATECO (`atecoSettori.json`) che determina il reddito forfettario.
- 🟢 **Soglia 85.000 / 100.000 €** — sopra 85.000 € di ricavi si esce dal regime dall'anno dopo, sopra 100.000 € subito, con IVA dovuta dall'operazione che supera. Valori in `regole/<anno>.json`.
- 🟢 **Competenza e cassa** — la dashboard calcola ricavi per data fattura (competenza) e per data di incasso (cassa).
- 🟢 **INPS gestione separata** — contributo previdenziale a percentuale sul reddito forfettario, con massimale. È l'unica gestione calcolata dall'app.
- 🟢 **ISA** — indici sintetici di affidabilità fiscale. `soggettoIsa` decide la ripartizione degli acconti: 50/50 se soggetto, 40/60 altrimenti.
- 🟢 **Saldo e acconti** — versamenti dell'imposta: saldo dell'anno chiuso più primo e secondo acconto dell'anno in corso.
- 🟢 **F24** — modello di versamento. L'app calcola le righe (`stimaVersamentiService`), tiene lo stato (`f24StateService`) e compila il PDF sul modello AdE (`f24PdfService`).
- 🟢 **Codice tributo / causale INPS** — identificano il versamento nelle sezioni Erario e INPS dell'F24, nel pacchetto regole.
- 🟢 **Cassetto Fiscale** — portale AdE «Fatture e Corrispettivi»: l'app importa i suoi archivi ZIP e il testo dei versamenti.
- 🟢 **FatturaPA** — formato XML della fattura elettronica italiana, v1.2.2.
- 🟢 **SDI** — Sistema di Interscambio, instrada le fatture e restituisce ricevute. Indirizzo PEC ufficiale `sdi01@pec.fatturapa.it`.
- 🟢 **PEC** — posta elettronica certificata, canale di invio al SDI e di ricezione ricevute (SMTP + IMAP).
- 🟢 **Ricevute SDI** — RC (consegna), NS (scarto), MC (mancata consegna), NE (esito committente), EC, DT (decorrenza termini), AT (attestazione).
- 🟢 **RegimeFiscale RF19** — codice del regime forfettario nell'XML.
- 🟢 **Natura N2.2 / N2.1** — natura dell'operazione senza IVA: N2.2 per forfettario con clienti italiani, N2.1 per clienti esteri B2B.
- 🟢 **Art. 7-ter / 7-septies** — territorialità IVA delle prestazioni: B2B estero e servizi specifici a privati extra-UE (`clienteEsteroService`).
- 🟢 **Intrastat** — elenchi trimestrali per cessioni/prestazioni a aziende UE, con scadenze nel calendario.
- 🟢 **Bollo virtuale** — 2 € sulle fatture sopra 77,47 €, versato per trimestre con F24 (`bolloTrimestrale.js`).
- 🟢 **Rivalsa INPS 4%** — addebito facoltativo al cliente (L. 662/96 c. 212), blocco `DatiCassaPrevidenziale` TC22. Concorre a ricavi e soglia.
- 🟢 **Nota di variazione (TD04)** — documento che corregge una fattura già accettata. Non ancora emessa dall'app.
- 🟢 **Datio in solutum** — pagamento con un bene diverso dal denaro (art. 1197 c.c.): base dell'incasso in Bitcoin.
- 🟢 **Quadro RW / imposta IC** — monitoraggio fiscale e imposta sul valore delle cripto detenute al 31/12.
- 🟢 **Credito compensabile** — credito fiscale usato a scomputo in F24, con limite di 5.000 € oltre il quale serve il visto di conformità.

## Termini del codice (nomi italiani)

- 🟢 **Fornitore** — chi emette (l'operatore). Uno per installazione, `config.fornitore`.
- 🟢 **Cliente** — destinatario fattura, `config.clienti[]`. `attivo:false` è cancellazione logica.
- 🟢 **Compenso** — importo da ore × tariffa (`calcolaCompenso`).
- 🟢 **Riepilogo** — sintesi mensile delle ore (`calcolaRiepilogo`).
- 🟢 **Fattura Pro-Forma** — anteprima/documento di fattura prima dell'XML.
- 🟢 **Timesheet** — registro ore mensile per cliente.
- 🟢 **Impostazioni / Importa storico** — wizard di configurazione e importazione di dati pregressi.
- 🟢 **Passo / Passi** — step dei wizard, `?passo=N` nella query string.
- 🟢 **Promemoria** — avvisi: fine mese per ore mancanti (`reminderService`) e scarti SDI da ritrasmettere (`sdiScartoReminderService`).
- 🟢 **Regole fiscali** — pacchetto per anno dei valori fiscali con fonti (`regoleFiscaliService`).
- 🟢 **Fonti normative** — registro di documenti ufficiali archiviati con citazione verificabile (`fontiNormativeService`).
- 🟢 **Template di stampa** — layout Handlebars per fattura o timesheet (`templates-default/`).
- 🟢 **Percorso dati** — cartella dei dati, `config.dati.percorso`.
- 🟢 **MCP** — Model Context Protocol, interfaccia in sola lettura per client AI.

---

## Review Checklist

- **Completeness:** termini normativi e nomi ricorrenti del codice.
- **Accuracy:** ogni termine ricondotto a un file o a un uso nel codice (2026-10-13).
- **Consistency:** coerente con `PROJECT_CONTEXT.md` e `ARCHITECTURE.md`.
- **TODO:** nessuno.
- **Missing information:** nessun glossario delle etichette dei campi dei form.
- **Open questions:** nessuna.
- **Confidence level:** 🟢.
