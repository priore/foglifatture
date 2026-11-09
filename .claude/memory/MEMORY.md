# Project memory (versioned)

Index of project-specific rules kept in the repo so a checkout on any machine carries them. Referenced from `CLAUDE.md`.

- [Inline shell/external scripts from JS](shell_inline_scripts.md) — one-line ok inline, multi-line goes to a dedicated file (win/mac)
- [Markdown readable format](changelog_readable_format.md) — all Markdown docs (CHANGELOG, README, Release notes, AI-Workspace): bold title + bullet sub-list for multi-aspect entries; explode semicolons, inline lists, dual conditions, container/child hierarchies into separate bullets; numbered list for ordered sequences (routing, fallback, steps)
- [Plan docs: no history](docs_no_history_drafts.md) — AI-Workspace plans are drafts rewritten in place, no "replaces/corrects" notes
- [UI changes need pre/post screenshot](ui_changes_pre_post_screenshot.md) — grid/layout edits verified with Playwright screenshots before/after, light+dark, 2 viewports; unexplained diffs root-caused first
- [Plans self-contained](plans_self_contained.md) — no outside refs to plan docs; root = live plans only, done → completati/, dropped → scartati/
- [Plans: keep status](plans_keep_status.md) — never prune plan content; move files and update status marks only
