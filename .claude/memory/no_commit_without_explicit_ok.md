---
name: no_commit_without_explicit_ok
description: mai committare finché l'utente non lo dice esplicitamente, anche a step/test verdi
---

Non fare `git commit` automaticamente dopo uno step completato, anche se test e build sono verdi. Preparare le modifiche (edit, test, build) e fermarsi lì: il commit parte solo quando l'utente lo chiede esplicitamente (es. "commit", "fai il commit", "ok committa").

**Perché:** l'utente vuole rivedere/testare prima che finisca nella history git, anche per modifiche piccole o già verificate in automatico.

**Come applicare:** dopo ogni step di un piano multi-step, riportare cosa è stato fatto e i risultati di test/build, ma non lanciare `git add`/`git commit` finché non arriva conferma esplicita nel messaggio dell'utente.
