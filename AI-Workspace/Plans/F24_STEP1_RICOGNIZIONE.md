# Piano (step 1): ricognizione versamenti F24 effettivi

Confidence: 🟢 confermato da codice · 🟡 inferito · 🔴 ipotesi

Collegato a: [EXPORT_COMMERCIALISTA.md](EXPORT_COMMERCIALISTA.md) (sezione "dati mancanti fuori dominio app").
Vedi anche: [F24_STEP2_CALCOLO_AUTOMATICO.md](F24_STEP2_CALCOLO_AUTOMATICO.md) — dipende dai risultati di questo documento.

Tracciato su Gogs (locale), escluso solo dal sync verso GitHub (skill `sync-public`) — non pubblicato.

## Obiettivo

Capire se e come i versamenti F24 effettivamente pagati (imposta sostitutiva, contributi INPS gestione separata/artigiani-commercianti) sono recuperabili automaticamente, per confrontarli con l'imposta stimata che l'app già calcola (`forfettarioService.js`) invece di lasciarli solo su carta/commercialista.

🟢 Stato attuale: **zero codice** in questo repo tocca F24, scadenze fiscali, o dati Agenzia delle Entrate. Grep su tutto `backend/src`, `frontend/src` non trova nulla di pertinente (solo falsi positivi su ATECO/validazione P.IVA/XML FatturaPA). Questo è un dominio completamente nuovo per l'app, non un'estensione di qualcosa di esistente.

## Due fonti possibili, verificate per fattibilità reale (non solo teorica)

### A. Sito/portale Agenzia delle Entrate (Cassetto Fiscale / F24 telematico)

🔴 Ipotesi, da verificare con l'utente prima di investire tempo:

- L'AE **non espone una API pubblica** per i contribuenti privati/forfettari per leggere i propri F24 versati. Il "Cassetto fiscale" è un portale web con autenticazione SPID/CIE/CNS — pensato per consultazione umana, non per integrazione automatica.
- Per un'app locale single-user, l'unica via tecnica sarebbe web-scraping autenticato del Cassetto Fiscale: fragile (rotture ad ogni redesign del portale AE), richiede gestione credenziali SPID (livello di sicurezza alto, MFA quasi sempre attivo — non automatizzabile senza intervento umano ad ogni accesso), e probabilmente in violazione dei termini di servizio del portale.
- 🔴 Non risulta un'API ufficiale "Agenzia Entrate Developer" pubblica per consultazione F24 versati da parte di soggetti privati (esistono servizi B2B per intermediari/CAF con convenzione, fuori scope per un'app single-operator).

**Conclusione A**: da scartare come fonte automatica. Nessuna via pulita, manutenibile, dentro lo scope "app locale single-utente" di questo progetto.

### B. Ricevute di pagamento (PDF banca / home banking)

🟡 Più realistico, ma con limiti:

- Le ricevute F24 pagate da home banking sono PDF non standardizzati: il formato cambia per ogni banca (Intesa, Unicredit, Poste, Fineco, ecc.), spesso è uno screenshot/stampa della conferma, non un modulo strutturato.
- 🟡 Il modello F24 stesso ha una struttura nota (sezione Erario/INPS, codici tributo standard: `1790`/`1792`/`1793` per imposta sostitutiva forfettari, `AF` per INPS gestione separata, ecc.) — se il PDF della banca *incorpora* il modulo F24 compilato (non tutte le banche lo fanno, dipende se il pagamento è stato fatto compilando l'F24 in home banking o tramite modulo esterno F24 pre-compilato), l'estrazione testo/OCR potrebbe individuare codice tributo + importo + data.
- Il progetto ha già un pattern di import da PDF/file? 🟢 No — l'unico import esistente è XLS timesheet e XML fatture (`xmlInvoiceImporter.js`, `xlsTimesheetImporter.js`), entrambi formati strutturati (XML/XLSX), non PDF con parsing di testo libero. Un parser PDF F24 sarebbe un genere di importer mai fatto in questo codebase — non c'è riuso possibile da un pattern esistente.
- Costo tecnico: servirebbe una libreria di estrazione testo da PDF (nessuna attualmente in `package.json`) più regex sui codici tributo — fattibile ma fragile quanto lo scraping AE, solo con failure mode diverso (formato PDF che cambia banca per banca invece di redesign del portale).

**Conclusione B**: tecnicamente più abbordabile di A (nessuna autenticazione terzi, nessun scraping di portali istituzionali), ma fragile e ad alto costo di manutenzione per un guadagno limitato (l'utente dovrebbe comunque caricare manualmente ogni PDF ricevuta).

## Alternativa più lazy, non ancora scartata

🟡 Invece di leggere automaticamente F24 da AE o PDF banca, un input manuale minimo coprirebbe lo stesso bisogno con una frazione dello sforzo:
- Un piccolo form "Versamenti effettuati" (data, codice tributo o etichetta libera, importo) salvato come JSON via `jsonStore.js` (pattern già esistente, nessuna nuova infrastruttura).
- L'utente inserisce a mano i 2-4 versamenti F24 che fa in un anno (imposta sostitutiva in unica soluzione o 2 rate + eventuale acconto) — sforzo utente minimo, zero fragilità di parsing/scraping.
- Questo copre l'unico vero bisogno: **confrontare stimato (già calcolato da `forfettarioService.js`) vs versato (inserito a mano)** nell'export per il commercialista.

Questa alternativa non richiede nessuna delle due fonti automatiche sopra ed è coerente con la filosofia dell'app (single-operator, JSON locali, nessuna dipendenza nuova).

## Domande aperte per l'utente

1. Vale la pena investire in un parser PDF ricevute banca (fragile, costo manutenzione) o è sufficiente un input manuale dei versamenti F24 (5 minuti/anno di data-entry)?
2. Se input manuale: basta importo + data + tipo (imposta/INPS), o serve tracciare anche acconto vs saldo separatamente?
3. Questo dato "versamenti effettivi" deve solo comparire nell'export per il commercialista, o deve alimentare anche la dashboard forfettario (es. "residuo da versare")?

Le risposte a queste domande determinano se lo Step 2 ([F24_STEP2_CALCOLO_AUTOMATICO.md](F24_STEP2_CALCOLO_AUTOMATICO.md)) ha senso costruirlo sopra dati importati automaticamente o sopra dati inseriti manualmente — cambia lo scope di quel documento.
