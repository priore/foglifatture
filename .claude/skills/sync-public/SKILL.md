---
name: sync-public
description: Sincronizza i file tracciati dal repo di sviluppo locale (Timesheet) al repo pubblico GitHub (foglifatture), mostra diff e propone messaggio di commit. Si ferma sempre prima di commit/push per conferma esplicita. Usare quando l'utente chiede di "pubblicare le ultime modifiche", "sincronizzare col repo pubblico" o "aggiornare foglifatture su GitHub".
---

# Sync verso repo pubblico (foglifatture)

Repo locale (`/Users/danilo/Documents/Prioregroup/Timesheet`, branch `develop`, storia completa) e repo pubblico (`/Users/danilo/Documents/GitHub/foglifatture`, branch `main`) sono **due repository git separati**, senza storia condivisa (init-commit singolo, vedi `AI-Workspace/Plans/PUBBLICAZIONE_GITHUB_PUBLICO.md` §5). Questa skill copia solo i file, mai la storia git.

## Passi

0. **Check pre-pubblicazione**: esegui la skill `pre-publish-check` (gitleaks, license-check, test backend, build frontend) e fixa in locale finché non è tutto verde. Non procedere al passo 1 finché il ciclo di fix non è concluso.

1. **Elenca i file tracciati nel locale**, esclusi quelli sensibili anche se per errore finissero tracciati:
   ```bash
   cd /Users/danilo/Documents/Prioregroup/Timesheet
   git ls-files
   ```
   Verifica che non compaiano `backend/data/`, `backend/logs/`, `.env`, `*.key`, `*.pem`, `config.json` — se compaiono, FERMATI e segnala prima di procedere (non sincronizzare mai dati potenzialmente sensibili).

2. **Copia** (rsync, solo file tracciati, cancella nel target ciò che non è più tracciato nel locale ma preserva `.git/` del repo pubblico):
   ```bash
   cd /Users/danilo/Documents/Prioregroup/Timesheet
   git ls-files -z | rsync -av --files-from=- --from0 . /Users/danilo/Documents/GitHub/foglifatture/
   ```
   ⚠️ **`--exclude` con `rsync --files-from` NON filtra i path passati esplicitamente da stdin** (comportamento noto di rsync, verificato il 2026-09-25: `.claude/skills/sync-public/`, `.claude/skills/pre-publish-check/` e `AI-Workspace/Plans/` sono finiti copiati nonostante l'`--exclude` in un sync precedente). Dopo la copia, **rimuovi sempre esplicitamente** questi path dal repo pubblico prima di `git add`:
   ```bash
   cd /Users/danilo/Documents/GitHub/foglifatture
   rm -rf AI-Workspace/Plans .claude/skills/sync-public .claude/skills/pre-publish-check
   ```
   (tooling privato e note di pianificazione interne: tracciati su Gogs locale — `AI-Workspace/Plans/` non è più in `.gitignore` da quando serve anche lì — ma non devono mai finire nel repo pubblico).

3. **Mostra diff** nel repo pubblico:
   ```bash
   cd /Users/danilo/Documents/GitHub/foglifatture
   git add -A
   git status
   git diff --cached --stat
   ```
   Presenta il diff all'utente in sintesi (file cambiati, aggiunti, rimossi).

   ⚠️ **Controlla anche il contenuto dei diff su `.github/workflows/*`, `backend/package.json`, `frontend/package.json` e i relativi `package-lock.json`**: essendo due repository separati, il pubblico può aver ricevuto bump Dependabot mai recepiti nel locale (verificato il 2026-09-25: `actions/checkout` v7→v4, `imapflow` 2.0.5→1.7.6, `nodemailer` 10.0.10→9.0.6 sarebbero stati un downgrade). Se il diff su questi file va nella direzione "versione più vecchia sostituisce una più recente", **non sincronizzarlo**: `git checkout HEAD -- <file>` per ripristinare la versione pubblica più aggiornata, oppure merge manuale se ci sono anche modifiche locali legittime da preservare.

4. **Proponi messaggio di commit**: guarda i commit recenti nel locale non ancora riflessi (confronta a occhio con l'ultimo sync noto o chiedi all'utente cosa cambia), scrivi un messaggio sensato in italiano, stile Keep a Changelog coerente col resto del progetto — mai un messaggio generico tipo "sync" o "update".

5. **STOP — chiedi conferma esplicita** (AskUserQuestion) prima di:
   - Creare il commit nel repo pubblico.
   - Fare `git push`.

   Non procedere mai automaticamente oltre questo punto. Il repo pubblico ha init-commit singolo: ogni push successivo diventa storia pubblica permanente da subito (gitleaks gira in CI ma è un secondo livello, non sostituisce la revisione umana qui).

6. Solo dopo conferma: commit con messaggio approvato, poi chiedi separatamente conferma per il push (due conferme distinte: commit locale al repo pubblico è meno rischioso, push lo rende visibile online).

7. **Dopo il push, verifica l'esito reale dei workflow** con `gh` CLI invece di aspettare le email di notifica (troncate, poco utili per debug):
   ```bash
   gh run list --repo priore/foglifatture --limit 10 --json databaseId,name,status,conclusion,headBranch,createdAt
   ```
   Per ogni run con `"conclusion":"failure"`, recupera il motivo:
   ```bash
   gh run view <databaseId> --repo priore/foglifatture --log-failed
   ```
   Segnala all'utente eventuali fallimenti reali (non i soliti PR-Dependabot già gestiti) prima di considerare il sync concluso.

8. **Se il CHANGELOG.md sincronizzato taglia una nuova versione** (sezione `## [X.Y.Z] - data` sotto `[Unreleased]`), il sync non è completo finché non esiste anche la **GitHub Release** corrispondente — sono due cose distinte, il CHANGELOG da solo non la crea. Chiedi conferma, poi:
   ```bash
   cd /Users/danilo/Documents/GitHub/foglifatture
   git tag vX.Y.Z
   git push origin vX.Y.Z
   gh release create vX.Y.Z --repo priore/foglifatture --title "vX.Y.Z" --notes "<sezione Added/Fixed/Changed del CHANGELOG per questa versione>"
   ```
   Non toccare `backend/VERSION`: quel file rappresenta la versione dell'installazione **locale di ciascun utente**, viene scritto da `scripts/update.sh` quando l'utente esegue davvero l'auto-update, non è un dato di release e resta legittimamente indietro nel repo — l'auto-update (`updateService.js`) legge il tag più recente raggiungibile da `origin/main`, non questo file.

## Nota: rendering README, Gogs (locale) vs GitHub (pubblico)

Il motore Git del repo locale è **Gogs**, non Gitea/GitHub — sanifica aggressivamente markup HTML nel markdown: `style=`, `border=`, `align=`/`float` sugli `<img>` vengono spogliati (mostra sempre stack verticale, mai affiancato), e un `<img src="/percorso/assoluto">` dentro un tag HTML puro (non dentro `![]()` markdown) viene doppiato dal resolver di path. Per questo il README usa path relativi semplici (`docs/screenshots/...`, niente slash iniziale) e markup HTML standard (`align`, `width`, link `<a>` di ingrandimento) che su Gogs appare solo verticale ma è valido e viene reso correttamente affiancato una volta su GitHub — nessuna riscrittura di path richiesta in fase di sync verso il repo pubblico.

## Cosa NON fare mai in questa skill

- Non pushare mai senza conferma esplicita separata dal commit.
- Non sincronizzare mai `AI-Workspace/Plans/`, `backend/data/`, `backend/logs/`, `.env`, credenziali di alcun tipo.
- Non riscrivere la storia del repo pubblico (niente `push --force`, niente `filter-repo`) — se serve, è una decisione esplicita dell'utente, fuori da questa skill.
- Non inventare un messaggio di commit generico: se non è chiaro cosa è cambiato, chiedi all'utente.
- Non modificare mai `backend/VERSION` durante il sync o il cut di una release: si aggiorna da solo lato client, non è un dato di repo.
- Non dare per scontato che l'`--exclude` di rsync abbia funzionato: verificare sempre col `git status` al passo 3 prima di committare.
