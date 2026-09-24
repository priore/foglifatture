---
name: pre-publish-check
description: Esegue in locale gli stessi controlli dei workflow CI di GitHub (gitleaks, license-check, build frontend, test backend) prima di pubblicare su GitHub. Fixa i problemi trovati, ripete finché la build non è stabile, solo allora si procede a sync-public. Usare quando l'utente chiede di "pubblicare", "fare un check pre-pubblicazione", o come primo passo di ogni piano di pubblicazione.
---

# Pre-publish check (replica CI locale)

Replica in locale i controlli che girano su GitHub Actions (`.github/workflows/`), così i problemi si trovano e si fixano PRIMA del push, non dopo. Copre solo i workflow riproducibili in locale — CodeQL, OpenSSF Scorecard e CLA Assistant richiedono infrastruttura GitHub e non sono replicabili (lo si segnala, non si salta in silenzio).

## Corrispondenza workflow → passo locale

| Workflow CI | Passo locale |
|---|---|
| `gitleaks.yml` | `gitleaks detect` |
| `license-check.yml` | `npx license-checker` backend+frontend |
| `ci.yml` (backend-test) | `npm test` in `backend/` |
| `ci.yml` (frontend-build) | `npm run build` in `frontend/` |
| `codeql.yml` | non riproducibile in locale (richiede GitHub) — solo segnalato |
| `scorecard.yml` | non riproducibile in locale (richiede GitHub) — solo segnalato |
| `cla.yml` | non applicabile (automazione PR, non build) |

## Passi

1. **Gitleaks** (replica `gitleaks.yml`):
   ```bash
   cd /Users/danilo/Documents/Prioregroup/Timesheet
   gitleaks detect --source . --verbose
   ```
   Se non installato: `brew install gitleaks`. Qualsiasi secret trovato = STOP, fix prima di continuare (mai committare il fix del secret stesso senza review).

2. **License check** (replica `license-check.yml`, stesso `--failOn` del workflow):
   ```bash
   cd /Users/danilo/Documents/Prioregroup/Timesheet/backend && npx license-checker --production --failOn "GPL-2.0;GPL-3.0;AGPL-1.0;AGPL-3.0;LGPL-2.1;LGPL-3.0;SSPL-1.0"
   cd /Users/danilo/Documents/Prioregroup/Timesheet/frontend && npx license-checker --production --failOn "GPL-2.0;GPL-3.0;AGPL-1.0;AGPL-3.0;LGPL-2.1;LGPL-3.0;SSPL-1.0"
   ```

3. **Test backend** (Node `--test` runner, vedi `.claude/rules/code-quality.md`):
   ```bash
   cd /Users/danilo/Documents/Prioregroup/Timesheet/backend && npm test
   ```

4. **Build frontend** (verifica che la build di produzione non sia rotta):
   ```bash
   cd /Users/danilo/Documents/Prioregroup/Timesheet/frontend && npm run build
   ```

5. **Segnala i non-riproducibili**: ricorda che CodeQL e Scorecard girano solo su GitHub dopo il push — questo check non li sostituisce, li integra.

## Ciclo fix

Qualsiasi passo 1-4 fallisce → fixa il problema, rilancia SOLO il passo fallito (non l'intero ciclo, a meno che il fix tocchi più aree), ripeti finché tutti e 4 passano puliti. Non proseguire al passo successivo del piano di pubblicazione (es. `sync-public`) finché il ciclo non è verde.

## Cosa NON fare mai in questa skill

- Non pusha, non committa, non tocca il repo pubblico — solo verifica e fix in locale.
- Non salta un passo fallito per "andare avanti e sistemare dopo".
- Non disattiva/allenta un check (es. rimuovere una licenza dalla blacklist `--failOn`) per farlo passare — fixa la causa (dipendenza incriminata) o chiedi conferma esplicita all'utente se il fix è discutibile.
