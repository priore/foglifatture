---
name: github-actions-log-check
description: dopo ogni push su repo pubblico, verificare via gh CLI l'esito reale dei workflow invece di aspettare/leggere le email (troncate, poco utili per debug)
metadata:
  type: project
---

Dopo un push su un repo GitHub pubblico con Actions configurate (foglifatture), verificare l'esito reale dei workflow con `gh` CLI invece di affidarsi alle email di notifica (Dependabot/OpenSSF/ecc. arrivano troncate, senza il log dello step fallito).

**Comandi**:
```bash
gh auth status   # verifica login attivo prima di usare l'API
gh run list --repo priore/foglifatture --limit 20 --json databaseId,name,status,conclusion,headBranch,createdAt
gh run view <databaseId> --repo priore/foglifatture --log-failed
```

`--log-failed` mostra solo i job/step falliti, evita di scaricare log interi.

**Why**: durante la prima pubblicazione di foglifatture (2026-09-05/06) sono arrivate email di errore da OpenSSF/CodeQL/gitleaks che l'email da sole non permettevano di diagnosticare. `gh run view --log-failed` ha dato la causa esatta in secondi (permessi mancanti, feature da abilitare in Settings).

**Errori reali incontrati e fix**, utili come riferimento futuro:
- CodeQL: "Code scanning is not enabled for this repository" → va abilitato manualmente in Settings → Security → Code security → Code scanning (non basta il workflow yml).
- gitleaks-action su PR di Dependabot: 403 "Resource not accessible by integration" → mancava `pull-requests: read` nei `permissions:` del workflow (aveva solo `contents: read`).
- CLA Assistant su PR di Dependabot: bloccato in attesa firma CLA che un bot non può dare → serve aggiungere `dependabot[bot]` all'`allowlist:` del workflow cla.yml.

**How to apply**: ogni volta che dopo un push arrivano email di fallimento Actions (o semplicemente per controllare lo stato dopo un push importante), usare `gh run list`/`gh run view --log-failed` come primo passo, prima di aprire il browser o chiedere all'utente di incollare log manualmente.
