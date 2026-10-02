# Project memory (versioned)

Index of project-specific rules kept in the repo so a checkout on any machine carries them. Referenced from `CLAUDE.md`.

- [Inline shell/external scripts from JS](shell_inline_scripts.md) — one-line ok inline, multi-line goes to a dedicated file (win/mac)
- [GitHub Rulesets UI path](github_rulesets_ui.md) — branch protection moved from Settings>Branches to Settings>Rulesets, ruleset dormant on private repo until made public
- [Confirm publish separately](publish_confirm_separately.md) — pre-push confirmation always its own question, never bundled with the final verification step
- [GitHub Actions log check](github_actions_log_check.md) — after a public-repo push, use `gh run list`/`gh run view --log-failed` to check real workflow outcomes instead of relying on truncated notification emails
- [No commit without explicit OK](no_commit_without_explicit_ok.md) — never auto-commit after a green step, wait for explicit user go-ahead
- [Local first, push last](local_first_push_last.md) — reproduce and verify CI fixes locally (matching Node/tool version) before pushing, never iterate via remote pushes
- [Changelog readable format](changelog_readable_format.md) — multi-aspect CHANGELOG/Release entries: bold title + bullet sub-list, not one long paragraph
- [UI changes need pre/post screenshot](ui_changes_pre_post_screenshot.md) — grid/layout edits verified with Playwright screenshots before/after, light+dark, 2 viewports; unexplained diffs root-caused first
- [GitHub Actions real log check](github_actions_log_check.md) — after push to public repo, always check real workflow outcomes with `gh run list`/`--log-failed` before trusting truncated emails
