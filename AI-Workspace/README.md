# AI Workspace

Knowledge base evolutiva del progetto **Fogli & Fatture** (timesheet e fatturazione elettronica italiana per il regime forfettario). Fonte di verità per ogni agente AI o persona che lavora sul codice.

Regole che governano il workspace: [`CLAUDE.md`](../CLAUDE.md) nella root del repo.

## Da dove partire

- [`WORKSPACE_MANIFEST.md`](WORKSPACE_MANIFEST.md) — registro dei documenti, ordine di dipendenza, stato.
- [`architecture/PROJECT_CONTEXT.md`](architecture/PROJECT_CONTEXT.md) — cos'è l'app, per chi, flusso end-to-end.

## Struttura

```
architecture/
  PROJECT_CONTEXT.md           — scopo, utenti, dominio, flusso
  PROJECT_ANALYSIS.md          — stack, entry point, script, config, cartelle, storage, test
  ARCHITECTURE.md              — pipeline richieste, job, flusso fattura, AI/MCP, integrazioni
  UI_ANALYSIS.md               — rotte, viste, navigazione, passi impostazioni, tema
design/
  DESIGN_SYSTEM.md             — linguaggio visivo, dark mode, template di stampa, accessibilità
  DESIGN_TOKENS.md             — valori esatti dei token CSS
  COMPONENT_LIBRARY.md         — componenti Vue, primitive globali, composables
product/
  DECISIONS.md                 — decisioni architetturali e di prodotto
  KNOWN_ISSUES.md              — limiti e incoerenze osservati
  GLOSSARY.md                  — termini di dominio e nomi del codice
  FEATURE_PROPOSALS.md         — backlog numerato delle proposte non ancora realizzate
documentation/
  DESIGN_PATTERNS_AS_IS.md     — inventario dei pattern (backend + frontend)
  BE_SWIFT_MAPPING.md          — registro di mapping backend Node → Swift (documento a sé)
Plans/                         — piani di dettaglio e analisi (una nota per tema)
Output/                        — export locali di debug, ignorati da git
prompts/ templates/ workflows/ reviews/ tasks/  — cartelle vuote, segnaposto
```

## Legenda confidenza

🟢 confermato da codice · 🟡 inferito · 🔴 ipotesi. Ogni affermazione nei documenti è taggata.

## Manutenzione

- Un documento per task: niente modifiche in blocco se non richieste.
- Ogni documento termina con la Review Checklist (Completeness, Accuracy, Consistency, TODO, Missing information, Open questions, Confidence level).
- I documenti riflettono lo stato attuale del codice: si aggiornano sul posto, non accumulano storia. La storia sta in `CHANGELOG.md` alla radice e in `git log`.
- Una voce di `FEATURE_PROPOSALS.md` realizzata si rimuove, la numerazione resta stabile.

---

## Review Checklist

- **Completeness:** collega ogni documento presente nel workspace.
- **Accuracy:** struttura uguale all'albero reale di `AI-Workspace/` (2026-10-13).
- **Consistency:** coerente con `WORKSPACE_MANIFEST.md`.
- **TODO:** aggiornare la mappa se si aggiungono documenti.
- **Missing information:** nessuna.
- **Open questions:** nessuna.
- **Confidence level:** 🟢, solo fatti strutturali.
