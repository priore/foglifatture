---
name: publish-confirm-separately
description: pubblicazione GitHub pubblica (push su foglifatture) — sempre chiedere conferma esplicita separata prima di procedere, mai bundlata con altri step
metadata:
  type: feedback
---

Prima di eseguire il push effettivo del repo pubblico `foglifatture` (o qualsiasi azione che renda il repo/i suoi contenuti visibili pubblicamente), chiedere sempre conferma con una domanda dedicata (AskUserQuestion o equivalente), separata da altre domande/step del flusso di pubblicazione — non accorpare "procedo col controllo E col push" in un'unica conferma.

**Why**: azione irreversibile (storia pubblica permanente da quel momento, vedi §2.6/§5 di `AI-Workspace/Plans/PUBBLICAZIONE_GITHUB_PUBLICO.md`). L'utente ha chiesto esplicitamente un ultimo controllo approfondito con doppia verifica prima di procedere, segnalando di volerlo come step a sé, non implicito in un "via libera" generico dato prima.

**How to apply**: quando il piano di pubblicazione arriva allo step "verifica finale pre-push" (§2.1 del piano), farla, riportare l'esito, e SOLO DOPO chiedere separatamente "procedo col push?" — non dare per scontato che l'ok alla verifica implichi anche l'ok al push.
