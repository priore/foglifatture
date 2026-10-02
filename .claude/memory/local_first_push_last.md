---
name: local_first_push_last
description: fix e verifica sempre in locale (test/build/CI replicata) prima di ogni push, mai iterare via push remoti successivi
---

Quando un push al repo pubblico fallisce un check CI (o si sospetta possa fallirne uno), non pushare un fix e aspettare l'esito remoto per scoprire se serve un altro fix. Riprodurre il problema in locale (stessa versione Node/tool della CI, stesso comando del workflow), verificare che il fix risolva localmente, e solo allora pushare.

**Perché:** ogni push fallito è un commit pubblico permanente nella storia, uno stato rosso visibile, e un giro di attesa (30s-2min) per scoprire l'esito — iterare così è lento e rumoroso. La CI è un secondo livello di verifica, non il posto dove scoprire se un fix funziona.

**Come applicare:**
- Prima di pushare un fix per un fallimento CI, riprodurre l'errore in locale con lo stesso ambiente del workflow (es. stessa versione Node via `nvm`/`n`, non fidarsi che la versione locale coincida).
- Se non è riproducibile in locale (richiede infrastruttura GitHub, es. CodeQL/Scorecard), va segnalato esplicitamente come limite, non ignorato.
- Solo dopo che il fix è verificato in locale, si pusha — un push, non un tentativo alla volta.
- Vale per qualsiasi repo con CI remota, non solo Timesheet/foglifatture.
