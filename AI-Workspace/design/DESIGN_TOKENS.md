# Design Tokens — As Implemented

Confidence: 🟢 confirmed by code (exact values from `frontend/src/style.css` unless noted) · 🟡 inferred · 🔴 hypothesis

## Color — light (default, `:root`)

| Token | Value | Role |
|---|---|---|
| `--ink` | `#1c2e3d` | primary text |
| `--ink-soft` | `#3d5266` | secondary text |
| `--ground` | `#f6f4ee` | page background |
| `--card` | `#ffffff` | surface/card background |
| `--line` | `#e2ddd0` | borders/dividers |
| `--accent` | `#c98a3e` | brand/accent |
| `--accent-ink` | `#5c3d14` | text on accent |
| `--ok` | `#3f7a5c` | success text |
| `--ok-bg` | `#e6f0ea` | success background |
| `--warn` | `#b5473a` | warning/error text |
| `--warn-bg` | `#f7e9e6` | warning/error background |
| `--muted` | `#7c8a97` | disabled/muted text |

## Color — dark (`prefers-color-scheme: dark` + `:root[data-theme="dark"]`)

| Token | Value |
|---|---|
| `--ink` | `#eef2f5` |
| `--ink-soft` | `#c2ccd4` |
| `--ground` | `#141b22` |
| `--card` | `#1b242d` |
| `--line` | `#2b3641` |
| `--accent` | `#e0a35e` |
| `--accent-ink` | `#2a1c0c` |
| `--ok` | `#6fbf94` |
| `--ok-bg` | `#193226` |
| `--warn` | `#e0796b` |
| `--warn-bg` | `#3a2320` |
| `--muted` | `#8a97a3` |

🟢 Sidebar gets an extra dark-mode-only override: `#0d1319` (darker than `--card`).

## Shadow

| Token | Light value | Dark value |
|---|---|---|
| `--shadow` | `0 1px 2px rgba(28,46,61,.06), 0 6px 20px -8px rgba(28,46,61,.15)` | `0 1px 2px rgba(0,0,0,.3), 0 10px 30px -10px rgba(0,0,0,.5)` |

## Typography

🟢 Families (Google Fonts): **Fraunces** (500/600/700 — headings/brand), **Inter** (400–700 — body), **IBM Plex Mono** (numeric values).

🟡 No `--font-size-*` tokens exist — sizes are hardcoded per rule: `.brand` `1.3rem`, `.page-head h1` `1.7rem`, `.stat .value` `1.5rem` (sampled, not exhaustive).

## Radius

🟡 No `--radius-*` tokens — hardcoded literals per component class: `8px` (buttons/nav), `12px` (`.stat`), `14px` (`.card`), `6px` (inputs), `99px` (`.pill`), `50%` (dots/step numbers).

## Spacing

🟡 No spacing scale tokens — padding/margin values hardcoded per rule (e.g. `.btn` padding `9px 16px`).

## "Glass" effect tokens

🟢 No `backdrop-filter`/`blur()` anywhere (grep-confirmed zero matches). Effect approximated via translucency (`rgba(255,255,255,.08)` / `.06` on nav hover/active) and `color-mix(in srgb, var(--line) 40%, transparent)` (weekend row tint), plus `--shadow`. See `DESIGN_SYSTEM.md` for the naming-mismatch note.

## Print stylesheets — separate, non-token palettes

🟢 `print-fattura.css` (`.a4`): page `21cm`, min-height `29.7cm` (A4), padding `2.5cm 2cm 2cm 2cm`, font Times New Roman/Georgia serif `12pt`, ink `#1D2129`, table borders `#d9d9d9`, header row background `#A65355`. `@media print`: `break-inside: avoid` on rows/legal notes, `box-shadow` removed.

🟢 `print-timesheet.css` (`.xls-page`): page `21cm`, min-height `29.7cm` (A4), padding `1cm 1cm 1.4cm 1cm`, font Times New Roman `10pt`, palette teal `#008080` (labels/title), blue `#0000D4` (values), grey `#C0C0C0` (headers/weekend rows), brick `#DD0806` (summary header) — replicates a legacy Excel template exactly (per file header comment). Same print-break rules as above.

These two files are intentionally isolated from the app's `:root` token system — they replicate fixed legacy document layouts, not the app theme.

---

## Review Checklist

- **Completeness:** color (light+dark), shadow, typography, radius, spacing, glass mechanism, and print palettes all captured with exact values.
- **Accuracy:** every value read directly from `style.css`, `print-fattura.css`, `print-timesheet.css`.
- **Consistency:** token names match usage described in `DESIGN_SYSTEM.md` and `COMPONENT_LIBRARY.md`.
- **TODO:** none for this pass.
- **Missing information:** no formal spacing/radius/font-size scale exists in code — noted as absent, not assumed.
- **Open questions:** should a spacing/radius token scale be introduced, or is hardcoding intentional given the app's small, stable surface? (Product decision, not answered here.)
- **Confidence level:** 🟢 for all quoted values; 🟡 only on the "no token exists" absence-claims (spacing/radius/font-size), which are negative claims by grep rather than exhaustive line-by-line proof.
