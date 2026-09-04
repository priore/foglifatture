---
name: sync-public
description: Sincronizza i file tracciati dal repo di sviluppo locale (Timesheet) al repo pubblico GitHub (foglifatture), mostra diff e propone messaggio di commit. Si ferma sempre prima di commit/push per conferma esplicita. Usare quando l'utente chiede di "pubblicare le ultime modifiche", "sincronizzare col repo pubblico" o "aggiornare foglifatture su GitHub".
---

# Sync verso repo pubblico (foglifatture)

Repo locale (`/Users/danilo/Documents/Prioregroup/Timesheet`, branch `develop`, storia completa) e repo pubblico (`/Users/danilo/Documents/GitHub/foglifatture`, branch `main`) sono **due repository git separati**, senza storia condivisa (init-commit singolo, vedi `AI-Workspace/Plans/PUBBLICAZIONE_GITHUB_PUBLICO.md` §5). Questa skill copia solo i file, mai la storia git.

## Passi

1. **Elenca i file tracciati nel locale**, esclusi quelli sensibili anche se per errore finissero tracciati:
   ```bash
   cd /Users/danilo/Documents/Prioregroup/Timesheet
   git ls-files
   ```
   Verifica che non compaiano `backend/data/`, `backend/logs/`, `.env`, `*.key`, `*.pem`, `config.json` — se compaiono, FERMATI e segnala prima di procedere (non sincronizzare mai dati potenzialmente sensibili).

2. **Copia** (rsync, solo file tracciati, cancella nel target ciò che non è più tracciato nel locale ma preserva `.git/` del repo pubblico), **escludendo sempre** `.claude/skills/sync-public/` (questa skill è tooling privato, non deve mai finire nel repo pubblico — `.gitignore` del locale non basta perché sono due repository separati):
   ```bash
   cd /Users/danilo/Documents/Prioregroup/Timesheet
   git ls-files -z | rsync -av --files-from=- --from0 --exclude='.claude/skills/sync-public/' . /Users/danilo/Documents/GitHub/foglifatture/
   ```
   Non copiare `AI-Workspace/Plans/` (già escluso da `.gitignore`, contiene note di pianificazione interne non destinate al repo pubblico).

3. **Mostra diff** nel repo pubblico:
   ```bash
   cd /Users/danilo/Documents/GitHub/foglifatture
   git add -A
   git status
   git diff --cached --stat
   ```
   Presenta il diff all'utente in sintesi (file cambiati, aggiunti, rimossi).

4. **Proponi messaggio di commit**: guarda i commit recenti nel locale non ancora riflessi (confronta a occhio con l'ultimo sync noto o chiedi all'utente cosa cambia), scrivi un messaggio sensato in italiano, stile Keep a Changelog coerente col resto del progetto — mai un messaggio generico tipo "sync" o "update".

5. **STOP — chiedi conferma esplicita** (AskUserQuestion) prima di:
   - Creare il commit nel repo pubblico.
   - Fare `git push`.

   Non procedere mai automaticamente oltre questo punto. Il repo pubblico ha init-commit singolo: ogni push successivo diventa storia pubblica permanente da subito (gitleaks gira in CI ma è un secondo livello, non sostituisce la revisione umana qui).

6. Solo dopo conferma: commit con messaggio approvato, poi chiedi separatamente conferma per il push (due conferme distinte: commit locale al repo pubblico è meno rischioso, push lo rende visibile online).

## Cosa NON fare mai in questa skill

- Non pushare mai senza conferma esplicita separata dal commit.
- Non sincronizzare mai `AI-Workspace/Plans/`, `backend/data/`, `backend/logs/`, `.env`, credenziali di alcun tipo.
- Non riscrivere la storia del repo pubblico (niente `push --force`, niente `filter-repo`) — se serve, è una decisione esplicita dell'utente, fuori da questa skill.
- Non inventare un messaggio di commit generico: se non è chiaro cosa è cambiato, chiedi all'utente.
