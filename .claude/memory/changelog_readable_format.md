---
name: changelog_readable_format
description: voci CHANGELOG/Release con più aspetti vanno spezzate in bullet, non un unico paragrafo lungo
---

Una voce del CHANGELOG (o delle note di una GitHub Release) che copre più aspetti della stessa feature non va scritta come un unico paragrafo lungo. Formato: **titolo breve in grassetto** sulla riga principale, seguito da un sotto-elenco puntato con un aspetto per riga.

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

**Come applicare:** vale sia per `CHANGELOG.md` (regola esistente "una riga per cambiamento" resta per cambiamenti distinti tra loro; questo si applica dentro una singola voce complessa) sia per il corpo di `gh release create --notes`. Una voce semplice a una sola frase resta su una riga, non serve spezzarla artificialmente.
