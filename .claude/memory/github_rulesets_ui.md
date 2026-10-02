---
name: github-rulesets-ui
description: GitHub ha spostato branch protection da "Settings > Branches" a "Settings > Rulesets" — percorso UI aggiornato 2026
metadata:
  type: project
---

GitHub non mostra più "Branches" come voce separata in repo Settings. Branch protection (require PR, required reviews, required status checks) ora vive sotto **Settings → Rulesets → Rulesets → New ruleset → New branch ruleset**.

Steps per proteggere `main`:
1. New branch ruleset
2. Ruleset Name (es. `main-protection`), Enforcement status: `Active`
3. Target branches → Add target → Include default branch
4. Rules: spunta "Require a pull request before merging" (Required approvals 1, Require review from Code Owners), spunta "Require status checks to pass" (Add checks — vuoto finché nessun workflow non ha ancora girato almeno una volta)
5. Bypass list: vuoto o solo owner
6. Create

**Why**: relativo a [[pubblicazione_github_pubblico]] (foglifatture) — istruzioni scritte a mano nel piano puntavano al vecchio percorso "Branches", causando confusione nello step-by-step.

**Importante**: su repo **privato**, GitHub mostra warning "rulesets won't be enforced ... until you move to GitHub Team organization account" — richiede upgrade a un **account organization su piano Team** (a pagamento) per applicarli su privato, non basta un piano superiore sull'account personale. Su repo **pubblico**, secondo doc GitHub, i ruleset sono gratuiti anche su account personale — ma non ancora verificato empiricamente in questo progetto (foglifatture è ancora privato al momento della creazione del ruleset). Se repo nasce privato, il ruleset si può creare comunque in anticipo (resta salvato, dormiente); **verificare che il warning sparisca appena il repo passa a pubblico**, prima di considerare la protezione attiva.

**How to apply**: quando l'utente chiede di configurare branch protection su un repo GitHub, usare questo percorso UI, non "Branches".
