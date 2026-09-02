# Sensitive data and `.gitignore` — mandatory check

This repository is meant to be published/forked on GitHub. No sensitive data (credentials, config with secrets, local paths, databases, backups) must ever end up in a commit.

**Before adding any new file, folder, or persistence mechanism** (a new service that writes to disk, a new data folder, a new config/cache/log file, a new integration with credentials) — explicitly assess whether it contains or could contain sensitive data, and if so:

1. Add the path to `.gitignore` **in the same commit** that introduces it, not later.
2. If the file/folder is required to run but must not be versioned, make the code auto-generate it on first startup (as `configService.js` already does with `DEFAULT_CONFIG`), or provide a versioned `*.example` file with no secrets (like `backend/.env.example`) and have the install script copy it.
3. Before every push to a public remote (or any time something might have slipped through), verify no sensitive path was ever tracked:
   ```
   git ls-files | grep -E "config\.json|\.env$|\.key$|\.pem$"
   git log --all --full-history -- <suspect path>
   ```
   Both must return empty. If something shows up tracked, it must be removed from history (`git filter-repo` or equivalent) before publishing — removing it only from the working tree is not enough, it stays in past commits.

Don't treat `.gitignore` as a one-time static guarantee: re-check it every time a new data source is introduced, not just once at project start.
