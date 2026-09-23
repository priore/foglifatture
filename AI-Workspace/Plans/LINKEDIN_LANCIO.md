# Piano lancio post/articolo LinkedIn — Fogli & Fatture

Confidence: 🟢 confermato da codice/repo · 🟡 inferito · 🔴 ipotesi

## Contesto

🟢 Repo pubblicato su GitHub come `foglifatture` (sync da questo repo privato via skill `sync-public`), release 1.0.0 il 2026-09-04, licenza PolyForm Noncommercial. Target: freelance/PIVA in regime forfettario italiano. 3 screenshot già pronti in `docs/screenshots/` (dashboard, fattura-proforma, timesheet-mensile), stile light/glass, puliti, leggibili anche piccoli.

🟡 Obiettivo del post: notorietà + primi utenti/stelle GitHub, non vendita (progetto non-commerciale). Pubblico LinkedIn IT: freelance, commercialisti, developer italiani.

## Formato consigliato

**Post nativo LinkedIn (non articolo).** Un articolo (LinkedIn Article) ha reach nettamente più basso dell'algoritmo attuale e serve per contenuti long-form evergreen — questo è un annuncio-prodotto, va nel feed. Se in futuro vuoi un pezzo "come e perché l'ho costruito" più tecnico/lungo, quello sì da Article o da riuso su Substack/Medium, non ora.

## Struttura post

1. **Hook (1-2 righe)**: problema riconoscibile — "gestire timesheet + fatturazione elettronica forfettario con Excel e PEC a mano" — non nome prodotto.
2. **Cosa ho fatto**: 2-3 righe, cosa risolve (timesheet multi-cliente + FatturaPA + invio PEC/SDI automatico + dashboard soglia forfettario).
3. **Perché gratis/open**: una riga onesta — side project, uso personale, condiviso open (non-commerciale), gira in locale, nessun dato in cloud (punto forte per privacy-sensitive IT audience).
4. **Call to action**: link GitHub, "feedback benvenuti", eventualmente "a chi serve, provatelo".
5. **1 immagine** (carousel massimo 2) — non tutte e 3 le screenshot, satura il post. Vedi sotto.

Lunghezza: 800-1200 caratteri, non oltre. Niente hashtag-spam: 3-5 mirati (#forfettario #fatturaelettronica #opensource #freelance #partitaiva).

## Immagini — serve rielaborazione?

Le 3 screenshot in `docs/screenshots/` sono pensate per README (contesto pieno, mockup browser/finestra). Per LinkedIn:

- **Sì, conviene un adattamento leggero**, non ricreare da zero:
  - Formato: LinkedIn nel feed croppa a ~1.91:1 (orizzontale) o 1:1; gli screenshot attuali sono verticali (dashboard lunga) → in feed vengono tagliati o rimpiccioliti male, testo diventa illeggibile su mobile.
  - Proposta: 1 immagine "hero" 1200×627 (o 1080×1080 per mobile-first) che mostra **solo la parte alta della dashboard** (KPI + doughnut) o un collage a 2 riquadri (dashboard + fattura) affiancati, non l'intera pagina lunga.
  - Aggiungere un titolo overlay leggero (nome prodotto + claim breve) aiuta lo scroll-stop, ma non è indispensabile se il testo del post è già chiaro.
- 🟢 Decisione utente: rielaborazione immagini affidata a ChatGPT (fuori da questo repo/toolchain). Attenzione: dati nelle screenshot sono demo ("Studio Demo di Mario Rossi", cifre fittizie) — comunque verificare prima di caricare che nessuna cifra/nome reale sia rimasta in eventuali screenshot aggiornate in futuro.

## Automazione: si può, quanto conviene

Possibilità concrete, in ordine di sforzo:

1. **Nessuna automazione (consigliato per il primo post)**: post singolo, pubblicato a mano da UI LinkedIn. Zero setup, massimo controllo su tono/momento, e per un lancio one-shot non serve altro.
2. **Promemoria programmato**: uso skill `schedule`/cron di Claude Code per ricordarti "pubblica il post" a data/ora scelta — non pubblica per te (LinkedIn non ha API personale libera senza App Review + partner program), solo notifica.
3. **Pubblicazione automatica reale**: richiede LinkedIn API (Marketing Developer Platform), serve app registrata + review LinkedIn (giorni/settimane, pensata per aziende/tool di scheduling, non per un post singolo one-shot) oppure un tool terzo (Buffer/Hootsuite/Zapier) collegato al tuo account — comporta dare permessi a un servizio esterno al tuo profilo personale. Sproporzionato per un singolo annuncio di lancio.

**Non conviene automatizzare la pubblicazione per un post una-tantum.** Automatizzare ha senso solo se prevedi una cadenza (es. changelog mensile, thread di aggiornamenti) — in quel caso vale la pena valutare Buffer (gratuito fino a 3 canali) più avanti, non ora.

## Testo definitivo post

Niente cifre esplicite nel testo (es. soglia 85.000€) per evitare obsolescenza se la normativa cambia — genericamente "soglia di ricavi".

---

Il regime forfettario non dovrebbe richiedere un foglio Excel, una PEC e una collezione di strumenti diversi.

Eppure, per chi gestisce clienti, ore lavorate e fatture in autonomia, spesso è proprio così.

Per questo ho sviluppato un’app desktop pensata per riunire tutto in un unico ambiente:

→ Timesheet multi-cliente
Ore lavorate, clienti e tariffa oraria configurabile.

→ Fatturazione elettronica FatturaPA
La fattura può essere generata direttamente dal timesheet oppure creata liberamente.

→ Gestione completa dello SdI
Invio automatico tramite PEC, ricezione delle ricevute e notifiche desktop sullo stato delle fatture.

→ Dashboard per il regime forfettario
Ricavi cumulati, andamento verso la soglia e previsione dell’imposta sostitutiva, tutto a colpo d’occhio.

E soprattutto:

I dati restano in locale.
Niente cloud.
Niente abbonamento.
Niente dipendenza da un servizio esterno.

Il progetto è open source per uso non commerciale.

Il codice è disponibile su GitHub per chi vuole utilizzarlo, studiarlo, segnalare problemi o contribuire allo sviluppo.

→ Repo e istruzioni per l’installazione:
[link GitHub]

Se lavori con il regime forfettario, mi interessa soprattutto sapere quale parte di questa gestione ti fa perdere più tempo.

#forfettario #partitaiva #fatturaelettronica #opensource #software #productivity


---

Sostituire `[link GitHub]` con URL repo pubblico prima di pubblicare.

## Immagini da usare

Sorgente: `docs/screenshots/dashboard.png` + `docs/screenshots/fattura-proforma.png` (non usare `timesheet-mensile.png` — 2 immagini bastano, 3 satura il collage).

### Prompt per ChatGPT

Crea un'immagine hero per un post LinkedIn (formato 1200x627px, orizzontale) che promuove un'app desktop italiana per freelance in regime forfettario.

Base: uso due screenshot reali dell'app che ti allego (dashboard forfettario e fattura pro-forma) — non inventare l'interfaccia, ricomponi/valorizza quelle vere.

Layout: collage a 2 pannelli affiancati (dashboard a sinistra, fattura a destra), leggermente sovrapposti con ombra soft, su sfondo pulito chiaro (bianco/grigio molto chiaro, coerente con lo stile "glass" minimale delle screenshot — non aggiungere colori sgargianti).

Aggiungi in alto o a sinistra un titolo breve in overlay, font sans-serif moderno, testo in italiano: "Fogli & Fatture" come titolo, e sotto in corpo più piccolo: "Timesheet e fatturazione elettronica per il regime forfettario".

Nessun logo aziendale finto, nessun elemento inventato oltre alle due schermate fornite e al testo overlay richiesto. Deve restare leggibile anche rimpicciolita a thumbnail mobile: testo overlay grande e contrasto alto, contenuto degli screenshot può restare piccolo/decorativo.

Allegare a ChatGPT `dashboard.png` e `fattura-proforma.png` insieme al prompt.

## Checklist esecutiva

- [x] Rielaborare immagine hero su ChatGPT (collage 2 pannelli, dashboard + fattura pro-forma, titolo overlay)
- [x] Scrivere testo definitivo post
- [x] Pubblicare manualmente da LinkedIn (2026-09-06)
- [ ] Secondo post di follow-up — target 2026-09-20 (2 settimane da pubblicazione). Non un remake del lancio: angolo diverso da scegliere a ridosso della data in base a dati reali (stelle/feedback/issue ricevute, o una feature poco notata nel primo post). Testo da scrivere allora, non ora.

## Review Checklist

- **Completeness**: formato, struttura testo, immagini, automazione coperti.
- **Accuracy**: dati (versione, licenza, screenshot) letti da repo attuale.
- **Consistency**: coerente con `PUBBLICAZIONE_GITHUB_PUBBLICO.md` (non trovato — verificare se esiste sotto altro nome) e README pubblico.
- **TODO**: testo finale post da scrivere insieme all'utente; immagini da rigenerare su richiesta.
- **Missing information**: nome utente/handle LinkedIn, data preferita di pubblicazione.
- **Open questions**: automatizzare solo pubblicazione singola o prevedi cadenza ricorrente di post?
- **Confidence level**: prevalentemente 🟢/🟡, nessuna ipotesi 🔴 critica.
