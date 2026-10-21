# Design Tokens — As Implemented

Confidence: 🟢 confermato da codice (valori esatti da `frontend/src/style.css`) · 🟡 inferito · 🔴 ipotesi

## Colori — light (`:root`)

| Token | Valore | Ruolo |
|---|---|---|
| `--ink` | `#1c2e3d` | testo primario |
| `--ink-soft` | `#3d5266` | testo secondario |
| `--ground` | `#f6f4ee` | sfondo pagina |
| `--card` | `#ffffff` | superficie card |
| `--line` | `#e2ddd0` | bordi e divisori |
| `--accent` | `#c98a3e` | brand/accento |
| `--accent-ink` | `#5c3d14` | testo su accento |
| `--ok` / `--ok-bg` | `#3f7a5c` / `#e6f0ea` | successo |
| `--warn` / `--warn-bg` | `#b5473a` / `#f7e9e6` | avviso/errore |
| `--muted` | `#7c8a97` | testo disabilitato |
| `--btn-primary-*` | bg `#f6dcae` · ink `#5c3d14` · line `#e3be80` | bottone `.btn-primary` (avanzamento) |
| `--btn-ok-*` | bg `#cfe9df` · ink `#14503b` · line `#9fd0bc` | bottone `.btn-ok` (salva, aggiungi, conferma) |
| `--btn-info-*` | bg `#d3e4f6` · ink `#174a7c` · line `#a6c6e8` | bottone `.btn-blue` (esporta, scarica, aggiorna, invia) |
| `--btn-ai-*` | bg `#e9dcf3` · ink `#54307a` · line `#cfb5e3` | bottone `.btn-ai` (funzioni AI) |
| `--btn-warn-*` | bg `#f6d5c6` · ink `#8a3410` · line `#e8ad92` | bottone `.btn-warn` (elimina, scarta, riavvia) |

## Colori — dark (`prefers-color-scheme: dark` e `:root[data-theme="dark"]`)

| Token | Valore |
|---|---|
| `--ink` | `#eef2f5` |
| `--ink-soft` | `#c2ccd4` |
| `--ground` | `#141b22` |
| `--card` | `#1b242d` |
| `--line` | `#2b3641` |
| `--accent` | `#e0a35e` |
| `--accent-ink` | `#2a1c0c` |
| `--ok` / `--ok-bg` | `#6fbf94` / `#193226` |
| `--warn` / `--warn-bg` | `#e0796b` / `#3a2320` |
| `--muted` | `#8a97a3` |

🟢 La sidebar ha uno sfondo dedicato in dark: `#0d1319`.

## Ombra

| Token | Light | Dark |
|---|---|---|
| `--shadow` | `0 1px 2px rgba(28,46,61,.06), 0 6px 20px -8px rgba(28,46,61,.15)` | `0 1px 2px rgba(0,0,0,.3), 0 10px 30px -10px rgba(0,0,0,.5)` |

## Raggi

| Token | Valore |
|---|---|
| `--radius-sm` | `6px` |
| `--radius-md` | `8px` |
| `--radius-lg` | `12px` |
| `--radius-pill` | `99px` |
| `--radius-circle` | `50%` |

## Dimensioni font

| Token | Valore |
|---|---|
| `--font-size-2xs` | `.68rem` |
| `--font-size-xs` | `.72rem` |
| `--font-size-sm` | `.82rem` |
| `--font-size-base` | `.86rem` |
| `--font-size-md` | `.92rem` |
| `--font-size-lg` | `1.3rem` |
| `--font-size-xl` | `1.7rem` |

## Spaziatura

| Token | Valore |
|---|---|
| `--gap-sm` | `8px` |
| `--gap-md` | `10px` |

🟡 Non esiste una scala completa di spaziatura: padding e margin restano per lo più letterali nelle regole. I token `--gap-*` coprono solo i gap ricorrenti.

## Tipografia

🟢 Famiglie: **Fraunces** (titoli, brand), **Inter** (testo), **IBM Plex Mono** (valori numerici, `font-variant-numeric: tabular-nums` su `.stat .value`).

## Template di stampa

🟢 Fattura e timesheet stampati non usano i token dell'app: ogni template in `backend/src/templates-default/<id>/layout.css` definisce la propria palette e le proprie misure (foglio A4 `21cm`). Vedi `DESIGN_SYSTEM.md`.

---

## Review Checklist

- **Completeness:** colori light/dark, ombra, raggi, font, gap, tipografia, template.
- **Accuracy:** valori letti da `style.css` (2026-10-13).
- **Consistency:** nomi coerenti con `DESIGN_SYSTEM.md` e `COMPONENT_LIBRARY.md`.
- **TODO:** nessuno.
- **Missing information:** scala di spaziatura non presente nel codice, non assunta.
- **Open questions:** nessuna.
- **Confidence level:** 🟢 sui valori, 🟡 sull'assenza della scala di spaziatura.
