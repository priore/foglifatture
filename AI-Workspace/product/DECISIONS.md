# Decisions

Confidence: 🟢 confermato da codice · 🟡 inferito · 🔴 ipotesi

Decisioni architetturali e di prodotto come emergono dal codice e dai commenti. Non esistono ADR formali: ricostruite dall'implementazione.

## Nessun database, file JSON

🟡 Tutti i dati (config, fatture, timesheet, F24, crediti) sono file JSON via `jsonStore.js`. Coerente con un'app locale a operatore singolo, dove transazioni e accessi concorrenti non servono. Il percorso dati è configurabile (`config.dati.percorso`), per esempio su una cartella sincronizzata tra più macchine. Costo: nessuna query oltre `listKeys`/`readJson`, nessuno schema imposto.

## Same-origin, nessun CORS

🟢 Express serve il frontend buildato e le API sulla stessa origine e porta. La dipendenza `cors` è stata rimossa.

## Login Google a email singola, con bypass al primo avvio

🟢 Niente sistema utente/password: OAuth Google con whitelist (`ALLOWED_EMAIL`). Senza credenziali il login è disattivato per permettere di configurarle da Impostazioni. Un solo operatore, indipendentemente dal numero di clienti fatturati: non evolvere verso multi-utente senza richiesta esplicita.

## Segreti nel Keychain, non nei file

🟢 Password PEC, password backup, client secret Google e API key AI vivono nel Keychain OS (`keytar`). `config.json` le tiene vuote, `GET /api/config` restituisce un placeholder mascherato, i backup non le includono. `.env` contiene solo valori non segreti (id client, email, nomi modello).

## Stato locale, nessuno store globale

🟢 Composition API con `<script setup>` ovunque, nessun Pinia/Vuex. Stato per vista, rifetch dal backend. Il passo dei wizard sta nella query string.

## Primitive CSS globali, template di stampa a parte

🟢 Bottoni, card, campi, tabelle e checkbox sono classi globali in `style.css` che leggono i token. Gli stili `scoped` coprono layout locale. I documenti stampati sono template Handlebars indipendenti (`templates-default/`), resi in iframe sandboxato: ogni template porta il proprio layout A4.

## Un solo schema di polling per ogni job ricorrente

🟢 Polling SDI, backup, promemoria, scarti SDI, monitoraggio fonti e notifiche fiscali usano `setInterval` rileggendo la config a ogni tick, senza scheduler astratto né webhook (lo standard PEC/SDI non ne ha).

## Multi-cliente con numerazione condivisa

🟢 `config.clienti[]` con id stabile e tariffa propria. File per `<anno>-<mese>-<clienteId>`, numerazione fattura unica sulla partita IVA. La cancellazione è logica (`attivo:false`): fatture e timesheet storici restano risolvibili.

## Regole fiscali per anno, confermate dall'utente

🟢 I valori fiscali (soglie, aliquote, scadenze, codici tributo, INPS, bollo) stanno in un pacchetto per anno versionato in git, con fonte e citazione per ogni valore. Il pacchetto in uso è una copia che l'utente conferma. Gli aggiornamenti proposti dal monitoraggio fonti non si attivano mai da soli. Senza regole per l'anno, ultimo anno confermato con avviso visibile.

## AI facoltativa, a cascata, con consenso

🟢 Nessuna funzione core dipende dall'AI. Il router prova i provider in ordine (Gemini, CLI, Claude, Groq, LLM locale) e passa al successivo su quota esaurita. I dati fiscali personali partono solo con consenso esplicito (per richiesta o permanente). Un LLM locale permette di non far uscire nulla dalla macchina.

## Assistente in sola lettura

🟢 Server MCP e chat espongono solo aggregati tramite allowlist di campi. Nessuna scrittura e nessun invio: un invio SDI errato non è annullabile e si ripara solo con una nota di variazione, che resta un'azione umana in UI.

## Dati verso servizi esterni dal browser, con avviso

🟢 Recupero transazioni BTC (mempool.space) e cambi storici partono dal frontend, con nota privacy accanto al pulsante. Il valore recuperato resta sempre modificabile a mano.

---

## Review Checklist

- **Completeness:** decisioni strutturali di architettura, sicurezza, UI, fiscale e AI.
- **Accuracy:** ognuna legata a un dettaglio verificato nel codice (2026-10-13).
- **Consistency:** coerente con `ARCHITECTURE.md` e `DESIGN_PATTERNS_AS_IS.md`.
- **TODO:** nessuno.
- **Missing information:** nessun rationale scritto in repo: ricostruito dall'implementazione.
- **Open questions:** nessuna.
- **Confidence level:** prevalentemente 🟢, 🟡 sul motivo della scelta senza database.
