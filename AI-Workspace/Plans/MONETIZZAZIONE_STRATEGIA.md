# Piano: strategia di monetizzazione — confronto e raccomandazione

Confidence: 🟢 confermato da codice · 🟡 inferito · 🔴 ipotesi

Nota: tracciato su Gogs (locale), escluso solo dal sync verso GitHub (skill `sync-public`) — non pubblicato. Input: `STRATEGIE.md` (4 modelli proposti dall'utente/analisi esterna), incrociato con `PUBBLICAZIONE_GITHUB_PUBLICO.md` (licenza già decisa: PolyForm Noncommercial 1.0.0), `PACKAGING_BREW_WINGET.md`, `CONSERVAZIONE_SOSTITUTIVA_FATTURE.md`.

---

## Punto di partenza già deciso (non riaperto qui)

🟢 `PUBBLICAZIONE_GITHUB_PUBLICO.md` §5 ha già fissato: licenza **PolyForm Noncommercial 1.0.0**. Significa: uso commerciale (incluso rivendita/SaaS) già vietato senza accordo separato con l'autore — la leva di monetizzazione "licenza" esiste già a livello legale, manca solo il **meccanismo pratico** per venderla.

🟢 Modello attuale: single-user (`ALLOWED_EMAIL` whitelist unica, `auth.js`), nessuna infrastruttura di licensing/attivazione nel codice (`grep license|activation|key backend/src` → vuoto).

---

## I 4 modelli proposti in `strategie.md` — valutazione contro questo progetto specifico

### 1. Binari precompilati notarizzati (stile Aseprite/Blender)
🟢 **Aggiornamento**: abbonamento Apple Developer già posseduto dall'utente — il costo $99/anno non è più una barriera d'ingresso, è già pagato. Riduce sensibilmente il costo reale di questa opzione: resta solo il lavoro di pipeline (build → firma → notarizzazione, `xcrun notarytool`) e la scelta canale vendita (LemonSqueezy/Gumroad, non serve Mac App Store che aggiunge 30% fee e review Apple più severa sui contenuti).

Contro residuo: pipeline di notarizzazione/firma va comunque costruita e mantenuta ad ogni release (non è un costo una tantum), e resta comunque da validare se c'è domanda pagante — ma la barriera economica non c'è più, solo quella di ingegneria/processo.

### 2. Open-core (Community vs Pro)
Costo reale: **il più alto in ingegneria**. Richiede separare codice in due repository/build, gestire feature flag o licenza runtime per PEC/SDI automatico, dashboard avanzata, AI — tutte funzionalità oggi profondamente integrate nel codice unico (`pecService.js`, `sdiRicevuteService.js`, `forfettarioService.js`, `geminiAtecoService.js` non sono moduli disaccoppiati, sono il cuore del flusso end-to-end descritto in `PROJECT_CONTEXT.md`).

Contro: refactoring invasivo di codice che oggi funziona, solo per abilitare un modello di business non ancora validato. Working code trasformato in due prodotti prima di sapere se il secondo si vende.

### 3. Servizi a valore aggiunto (conservazione, cloud sync, portale clienti)
Già analizzato in dettaglio in `CONSERVAZIONE_SOSTITUTIVA_FATTURE.md`: gap normativo reale confermato, ma automatizzarlo (Opzione C di quel piano) significa diventare intermediari di un servizio legale/fiscale verso un conservatore terzo — responsabilità e costi ricorrenti sproporzionati rispetto allo stadio attuale del progetto (0 utenti paganti oggi).

Contro: costruire un'integrazione a pagamento con un conservatore commerciale prima di sapere se anche un solo utente esterno esiste è il rischio più alto dei 4 in termini di responsabilità (dati fiscali di terzi).

### 4. B2B white-label per commercialisti
Contro: non è un problema di codice, è vendita/relazioni commerciali — fuori portata per validazione rapida in solitaria, richiede export XML/XLSX compatibile con gestionali di terzi (Teamsystem, Zucchetti, Datev) mai scritto né richiesto oggi.

---

## Cosa manca ai 4 modelli: nessuno parte da "abbiamo già deciso la licenza, serve solo il meccanismo per venderla"

La domanda reale non è "quale dei 4 modelli enterprise implementare" — è: **la licenza PolyForm Noncommercial è già la leva di monetizzazione. Cosa manca per farla fruttare?** Risposta: un modo per un utente business di pagare e ottenere il permesso d'uso commerciale, senza costruire nessuna delle 4 architetture sopra.

---

## Raccomandazione: partire minimale, non dai 4 modelli

**Fase 0 (subito, costo ~zero)**: pubblicare il repo (piano già pronto in `PUBBLICAZIONE_GITHUB_PUBLICO.md`) con licenza PolyForm Noncommercial + una riga README "uso commerciale: contattami". Nessun codice di licensing. Questo È già un modello di monetizzazione (licenza duale manuale) — richiede zero lavoro tecnico aggiuntivo, solo eseguire il piano già scritto.

**Fase 1 (solo se arriva almeno 1 richiesta commerciale reale)**: gestire la vendita manualmente (fattura, invio zip/link release) — niente automazione, niente app-store, niente licensing runtime. Valida se il mercato esiste prima di costruire qualunque pipeline.

**Fase 2 (solo se il volume giustifica automazione, es. >5-10 richieste/anno)**: a quel punto scegliere tra i 4 modelli con dati reali in mano invece di ipotesi — con Apple Developer già attivo, **Opzione 1 (LemonSqueezy/Gumroad + build firmata/notarizzata, non store)** diventa più conveniente di prima e resta comunque quella con minor accoppiamento al codice esistente rispetto a Open-core (opzione 2, la più costosa e invasiva). Windows via winget/manifest firmato resta separato (`PACKAGING_BREW_WINGET.md` già copre l'analisi, certificato code-signing Windows non incluso nell'abbonamento Apple).

**Da evitare ora**: Opzione 2 (open-core) e Opzione 3-C (conservazione via API terza a pagamento) — entrambe richiedono investimento ingegneristico/legale rilevante per un mercato non ancora validato. Opzione 4 fuori scope tecnico.

---

## Confronto sintetico

| Modello | Costo ingegneria | Costo esterno | Rischio principale | Quando ha senso |
|---|---|---|---|---|
| 0. Licenza duale manuale (raccomandato ora) | ~zero (già deciso) | zero | nessuno | Subito |
| 1. Binari notarizzati (no store, Apple Dev già attivo) | medio (pipeline firma/notarizzazione) | zero aggiuntivo (già pagato) | costruire prima di validare domanda | Dopo Fase 1, se richieste ricorrenti |
| 2. Open-core | alto (refactor architetturale) | zero | working code spaccato in due prodotti senza mercato provato | Solo con base utenti consistente già paganti |
| 3. Servizi a valore aggiunto (conservazione) | medio-alto | ricorrente (provider terzo) | responsabilità legale su dati fiscali di terzi, 0 utenti oggi | Solo su richiesta esplicita utente esterno pagante |
| 4. B2B white-label | alto (export compatibilità gestionali terzi) | vendita diretta | fuori portata solo-dev | Solo con relazione commerciale già avviata |

---

## Prossimi passi proposti

1. Eseguire `PUBBLICAZIONE_GITHUB_PUBLICO.md` (pubblicazione con licenza già decisa) — prerequisito di ogni modello, incluso questo.
2. Nessuna azione tecnica di licensing/packaging finché non arriva una richiesta commerciale reale (Fase 1).
3. Se/quando arriva: rivalutare questo piano con dati reali, non ipotesi.

## Domande aperte per l'utente

- Conferma: si procede con Fase 0 (solo pubblicazione + licenza, nessun meccanismo di vendita automatizzato) come primo passo, rimandando i 4 modelli a dopo la validazione?

---

## Review Checklist

- **Completezza**: confrontati tutti e 4 i modelli di `strategie.md` contro lo stato reale del codice (`auth.js`, licenza già decisa, gap conservazione già mappato). 🟢
- **Accuratezza**: claim su assenza di infrastruttura di licensing verificato via grep; licenza già decisa verificata leggendo `PUBBLICAZIONE_GITHUB_PUBLICO.md` §5. 🟢
- **Coerenza**: allineato a `CLAUDE.md` (nessuna nuova dipendenza/persistenza non necessaria) e ai piani esistenti (non li duplica, li referenzia). 🟢
- **TODO**: nessuno tecnico — solo la decisione utente su Fase 0.
- **Missing information**: nessuna.
- **Open questions**: vedi sopra.
- **Confidence level**: 🟢 alto sull'analisi comparativa, 🟡 sulla raccomandazione di fasatura (dipende da quanto l'utente vuole investire subito vs validare prima).
