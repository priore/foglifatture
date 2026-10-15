# Sensitive data and personal identifiers — mandatory check

This repository is published on GitHub and accepts contributions. Nothing sensitive or personally identifying may reach a published commit: credentials, config with secrets, local paths, internal hosts, databases, backups, personal names or email addresses, signing identities.

**Before adding any new file, folder, or persistence mechanism** (a new service that writes to disk, a new data folder, a new config/cache/log file, a new integration with credentials) — explicitly assess whether it contains or could contain sensitive data, and if so:

1. Add the path to `.gitignore` **in the same commit** that introduces it, not later.
2. If the file/folder is required to run but must not be versioned, make the code auto-generate it on first startup (as `configService.js` already does with `DEFAULT_CONFIG`), or provide a versioned `*.example` file with no secrets (like `backend/.env.example`) and have the install script copy it.
3. Before every push to a public remote (or any time something might have slipped through), verify no sensitive path was ever tracked:
   ```
   git ls-files | grep -E "config\.json|\.env$|\.key$|\.pem$"
   git log --all --full-history -- <suspect path>
   ```
   Both must return empty. If something shows up tracked, it must be removed from history (`git filter-repo` or equivalent) before publishing — removing it only from the working tree is not enough, it stays in past commits.

## Personal identifiers in published files

- In code, tests, fixtures, docs and file names use neutral examples: `example.com` addresses, fictitious names and tax codes, `~` or variables instead of absolute user paths. Never a real person's name, email, Team ID, hostname or IP.
- Commit author and committer must be the public identity configured for the repo (`git config user.name/user.email`, noreply address), never a personal address.
- Files that are not meant for contributors (build scripts for signed installers, maintainer-only notes, private skills, local settings) must not be tracked in the public repository.

## Automated checks

- `scripts/git-hooks/` provides opt-in `pre-commit`, `post-commit` and `pre-push` hooks (`sh scripts/git-hooks/install.sh`). They block sensitive files and personal data in staged lines and, on pushes to GitHub, check the identity of the commits.
- A maintainer can add private patterns and allowed identities in a file outside the repository (`FOGLIFATTURE_PRIVATE_PATTERNS`, default `~/.config/foglifatture/private-patterns`); that file must never be committed.
- Do not bypass the hooks with `--no-verify`. A false positive is silenced on the line with `# hooks:allow`, or with `.hooksignore` for a path.

Don't treat `.gitignore` as a one-time static guarantee: re-check it every time a new data source is introduced, not just once at project start.
