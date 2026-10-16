# Workspace Manifest

Indice della knowledge base AI Workspace. Fonte di verità su cosa esiste, in che ordine e quando un documento è completo.

Livelli di confidenza: 🟢 confermato da codice · 🟡 inferito · 🔴 ipotesi

---

## Registro documenti

| Documento | Percorso | Scopo | Dipende da | Stato | Priorità | Modello consigliato |
|---|---|---|---|---|---|---|
| README | [README.md](AI-Workspace/README.md) | Punto di ingresso: cos'è il workspace e come navigarlo | — | 🟢 completo | Alta | Qualsiasi |
| PROJECT_CONTEXT | [architecture/PROJECT_CONTEXT.md](AI-Workspace/architecture/PROJECT_CONTEXT.md) | Scopo del prodotto, utenti, dominio (fatturazione e fiscale forfettario), flusso | — | 🟢 completo | Critica | Claude Opus |
| PROJECT_ANALYSIS | [architecture/PROJECT_ANALYSIS.md](AI-Workspace/architecture/PROJECT_ANALYSIS.md) | Inventario del codice: stack, cartelle, entry point, script, config, storage, test | PROJECT_CONTEXT | 🟢 completo | Critica | Claude Opus |
| ARCHITECTURE | [architecture/ARCHITECTURE.md](AI-Workspace/architecture/ARCHITECTURE.md) | Architettura: pipeline, job, flusso fattura, AI/MCP, integrazioni | PROJECT_ANALYSIS | 🟢 completo | Critica | Claude Opus |
| UI_ANALYSIS | [architecture/UI_ANALYSIS.md](AI-Workspace/architecture/UI_ANALYSIS.md) | Viste, rotte, navigazione, passi dei wizard, tema | ARCHITECTURE | 🟢 completo | Alta | Claude Sonnet |
| DESIGN_SYSTEM | [design/DESIGN_SYSTEM.md](AI-Workspace/design/DESIGN_SYSTEM.md) | Linguaggio visivo come implementato, dark mode, template di stampa | UI_ANALYSIS | 🟢 completo | Media | Claude Sonnet |
| DESIGN_TOKENS | [design/DESIGN_TOKENS.md](AI-Workspace/design/DESIGN_TOKENS.md) | Token CSS con valori esatti | DESIGN_SYSTEM | 🟢 completo | Media | Claude Sonnet |
| COMPONENT_LIBRARY | [design/COMPONENT_LIBRARY.md](AI-Workspace/design/COMPONENT_LIBRARY.md) | Catalogo componenti Vue, primitive globali, composables | DESIGN_TOKENS, UI_ANALYSIS | 🟢 completo | Media | Claude Sonnet |
| DECISIONS | [product/DECISIONS.md](AI-Workspace/product/DECISIONS.md) | Decisioni architetturali e di prodotto | ARCHITECTURE | 🟢 completo | Bassa | Qualsiasi |
| KNOWN_ISSUES | [product/KNOWN_ISSUES.md](AI-Workspace/product/KNOWN_ISSUES.md) | Limiti e incoerenze osservati, solo documentati | ARCHITECTURE, UI_ANALYSIS | 🟢 completo | Media | Qualsiasi |
| GLOSSARY | [product/GLOSSARY.md](AI-Workspace/product/GLOSSARY.md) | Termini di dominio e nomi del codice | PROJECT_CONTEXT | 🟢 completo | Bassa | Qualsiasi |
| FEATURE_PROPOSALS | [product/FEATURE_PROPOSALS.md](AI-Workspace/product/FEATURE_PROPOSALS.md) | Backlog numerato delle proposte non ancora realizzate | ARCHITECTURE, KNOWN_ISSUES | 🟡 bozza (backlog vivo) | Alta | Qualsiasi |
| DESIGN_PATTERNS_AS_IS | [documentation/DESIGN_PATTERNS_AS_IS.md](AI-Workspace/documentation/DESIGN_PATTERNS_AS_IS.md) | Inventario fattuale dei pattern (backend + frontend) | PROJECT_ANALYSIS | 🟢 completo | Media | Claude Sonnet |

Cartelle di supporto:

| Cartella | Scopo |
|---|---|
| [Plans/](AI-Workspace/Plans/) | Piani di dettaglio e analisi, una nota per tema; non seguono le regole dei documenti sopra |
| [Output/](AI-Workspace/Output/) | Export locali di debug (per esempio CSV bancari), ignorati da git |
| prompts/, templates/, workflows/, reviews/, tasks/ | Vuote, segnaposto per materiale futuro |

---

## Ordine di generazione consigliato

```
Fase 1  PROJECT_CONTEXT
   ↓
Fase 2  PROJECT_ANALYSIS
   ↓
Fase 3  ARCHITECTURE
   ↓
Fase 4  UI_ANALYSIS
   ↓
Fase 5  DESIGN_SYSTEM
   ↓
Fase 6  DESIGN_TOKENS
   ↓
Fase 7  COMPONENT_LIBRARY
   ↓
Fase 8  DECISIONS, KNOWN_ISSUES, GLOSSARY (in parallelo, qualsiasi ordine)
   ↓
Fase 8b FEATURE_PROPOSALS (dipende da ARCHITECTURE e KNOWN_ISSUES)
```

Ogni fase legge solo documenti prodotti dalle fasi precedenti, mai il contrario.

---

## Regole per ogni documento

- Un documento per task. Mai generazione in blocco.
- Ogni affermazione taggata 🟢/🟡/🔴.
- Nessuna modifica al codice, nessun fix, nessun refactor: solo analisi e documentazione.
- I documenti descrivono lo stato attuale e si aggiornano sul posto: niente storia, niente voci su ciò che non esiste più.
- Ogni documento termina con la Review Checklist: Completeness, Accuracy, Consistency, TODO, Missing information, Open questions, Confidence level.

## Criteri di completezza (per documento)

Un documento è «fatto» per il passaggio corrente quando:
1. Ogni sezione del suo template è compilata o marcata TODO.
2. Ogni affermazione fattuale ha un tag di confidenza.
3. La Review Checklist è compilata.
4. Nessuna dipendenza da un documento che non esiste ancora.

## Legenda stato

🔴 vuoto · 🟡 bozza (parziale o da verificare) · 🟢 completo (compilato, riletto, confidenze assegnate)
