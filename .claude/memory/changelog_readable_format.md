---
name: changelog_readable_format
description: voci CHANGELOG/Release/README e qualsiasi doc Markdown con più aspetti vanno spezzate in bullet, non un unico paragrafo lungo
---

Una voce del CHANGELOG, del README, delle note di una GitHub Release, o di qualsiasi documento Markdown del progetto che copre più aspetti della stessa feature non va scritta come un unico paragrafo lungo. Formato: **titolo breve in grassetto** sulla riga principale, seguito da un sotto-elenco puntato con un aspetto per riga.

Esempio (da com'era a come deve essere):

Prima (illeggibile):
```
- Incasso fatture in Bitcoin: una rata può essere registrata come incasso BTC (datio in solutum) invece che a bonifico, con TXID, cambio EUR/BTC applicato (fonte e ora) e indirizzo di destinazione — dati pronti per un eventuale controllo fiscale. L'importo in EUR è sempre calcolato dal cambio dichiarato. Dicitura opzionale in fattura per i clienti abilitati, lettura opzionale dei dati transazione da mempool.space e del cambio storico da CoinGecko, colonne dedicate nell'export per il commercialista.
```

Dopo (leggibile):
```
- **Incasso fatture in Bitcoin** — una rata può essere registrata come incasso BTC (datio in solutum) invece che a bonifico:
  - TXID, cambio EUR/BTC applicato (fonte e ora) e indirizzo di destinazione, dati pronti per un eventuale controllo fiscale
  - importo in EUR sempre calcolato dal cambio dichiarato
  - dicitura opzionale in fattura per i clienti abilitati
  - lettura opzionale dei dati transazione da mempool.space e del cambio storico da CoinGecko
  - colonne dedicate nell'export per il commercialista
```

**Perché:** un paragrafo unico con più frasi concatenate da virgole/punti è difficile da scansionare velocemente; un elenco puntato si legge a colpo d'occhio.

**Come applicare:** vale per tutti i documenti Markdown del progetto:
- `CHANGELOG.md` — regola "una riga per cambiamento" resta per voci distinte; questo si applica dentro una singola voce complessa.
- `README.md` — sezione `## Features` e qualsiasi altra sezione con elenchi di funzionalità.
- Note di `gh release create --notes`.
- Qualsiasi altro `.md` scritto o aggiornato nel progetto (AI-Workspace, docs/, ecc.).

Una voce semplice a una sola frase resta su una riga, non serve spezzarla artificialmente.

**Esplosione obbligatoria — casi specifici:** ogni volta che si scrive o modifica una voce, controllare e spezzare con stile ricco (sotto-titolo bold + bullet figli indentati):
- **Frase con `;`** che unisce due concetti distinti → due bullet separati.
- **Elenco inline con virgole** (es. "N2.1 per UE, N2.1 per extra-UE, N2.2 per altri") → bullet puntati figli, uno per caso, con titolo padre che introduce con `:`.
- **Due condizioni unite da "o se" / "e"** nella stessa frase → bullet separati sotto titolo padre.
- **Due comportamenti opposti nella stessa frase** (es. "al pagamento X; annullando Y") → bullet separati.
- **Gerarchia contenitore/contenuto**: se una feature è un sottoinsieme di un'altra (es. card dentro una tab, sezione con sotto-voci), indentare come figlia con **bold** sul sotto-titolo e `:` finale.
- **Lista ordinata per routing/fallback/step**: lista numerata con titolo padre, non frecce inline (`1. A  2. B` non `A → B → C`).
- **Elenco con 3+ elementi omogenei in una riga** (es. "registrazione manuale, confronto, import, export"): sempre esplodere in bullet figli.

**Stile ricco — esempio corretto:**
```
- **Gestione pagamenti**:
  - Sezione "Versamenti F24":
    - Registrazione manuale.
    - Confronto con imposta stimata.
    - Import da Cassetto Fiscale.
    - Export CSV per anno.
  - Sezione "Pagamenti fatture":
    - Riconoscimento automatico incasso da CSV movimenti bancari.
    - Abbinamento per importo.
```

**Stile sbagliato (da evitare):**
```
- Gestione pagamenti: Versamenti F24 con registrazione manuale, confronto con imposta stimata, import da Cassetto Fiscale, export CSV per anno; Pagamenti fatture con riconoscimento automatico e abbinamento per importo.
```

**Niente riferimenti a documenti interni non pubblici:** il CHANGELOG è pubblico (GitHub-facing). Non citare `FP-XXX`, nomi di file di piano (`FEATURES_GAP_ANALISI_ESTERNA.md`), o qualsiasi altro identificatore interno che non ha significato per un lettore esterno. Descrivere la funzione con parole, non con il ticket.
