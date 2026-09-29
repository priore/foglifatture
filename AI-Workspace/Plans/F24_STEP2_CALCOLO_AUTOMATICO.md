# Piano (step 2): stima versamenti F24 (imposta sostitutiva + INPS)

Confidence: 🟢 confermato da codice o fonte ufficiale · 🟡 inferito / da riconfermare · 🔴 ipotesi

Collegato a: [F24_STEP1_RICOGNIZIONE.md](F24_STEP1_RICOGNIZIONE.md) (presupposto), [EXPORT_COMMERCIALISTA.md](EXPORT_COMMERCIALISTA.md).

Tracciato su Gogs (locale), escluso solo dal sync verso GitHub (skill `sync-public`) — non pubblicato.

⚠️ Questo step dipende dall'esito dello Step 1: i versamenti reali si tracciano a mano, quindi questo step produce solo output ("quanto versare, quando, con quale codice"), non tocca mai dati esterni.

Revisione 2026-09-26: verifica su fonti ufficiali (AdE, INPS, Normattiva) di un documento esterno generato da Gemini sulle fonti F24; correzioni al piano originale; decisione di scope = **stima**, non F24 pronto all'uso.

## Obiettivo

Mostrare all'utente, per ogni anno fiscale, una **stima** dei versamenti dovuti (imposta sostitutiva + contributi INPS gestione separata), divisa per scadenza (giugno / novembre), con codice tributo/causale e importo — dati pronti da ricopiare in F24 web / home banking. Sempre etichettata "stima, verificare con il commercialista". Nessun F24 generato come file/PDF.

## Nota su IRPEF

🟢 Nel regime forfettario l'imposta sostitutiva **sostituisce** IRPEF, addizionali regionale/comunale e IRAP (L. 190/2014, art. 1, c. 64). Sul reddito forfettario quindi **non si versa IRPEF**: la voce "IRPEF" della stima è l'imposta sostitutiva (codici 1790/1791/1792). Le regole di acconto/saldo/rateizzazione sono però le stesse dell'IRPEF (stesse scadenze, stesse soglie), per questo le fonti AdE le trattano insieme.

🔴 Fuori scope: IRPEF su *altri* redditi dell'utente (lavoro dipendente, immobili, ecc.) — l'app non li conosce e non deve stimarli.

## Stato attuale del codice

🟢 `forfettarioService.js` (`calcolaDashboardForfettario`) calcola già: `redditoImponibile`, `aliquota` (5%/15%, `aliquotaImposta`), `impostaStimata`, `accontoStimato`, e in parallelo il blocco `cassa` (`ricaviCumulati`, `redditoImponibile`, `impostaStimata`) basato sulle rate incassate.

### Problemi da correggere prima di qualsiasi stima F24

1. 🟢 **Acconto calcolato per competenza.** `accontoStimato` ([forfettarioService.js:138-139](../../backend/src/services/forfettarioService.js)) usa `ricaviProiettati`, che derivano dalle fatture *emesse*. Il forfettario è tassato **per cassa** (il codice stesso lo dice alle righe 35-38). La base corretta è il fatturato incassato (`ricaviAnnoCassa`), non quello emesso.
2. 🟢 **Contributi INPS non dedotti.** L. 190/2014, art. 1, c. 64: i contributi previdenziali versati nell'anno si deducono dal reddito forfettario. Oggi `impostaStimata` è `ricavi × coefficiente × aliquota` senza deduzione ⇒ **sovrastima sistematica** dell'imposta.
3. 🟢 **Nessun dato previdenziale in config.** `config.forfettario` ha solo `sogliaAnnua`, `codiceAteco`, `settoreAteco`, `coefficenteRedditivita`, `dataInizioAttivita`.

## Regole verificate su fonti ufficiali

### Imposta sostitutiva (sezione Erario F24)

| Regola | Valore | Fonte |
|---|---|---|
| Codice saldo | `1792` | 🟢 AdE ricerca codici; Ris. 59/E/2015 |
| Codice acconto prima rata | `1790` | 🟢 idem |
| Codice acconto seconda rata o unica soluzione | `1791` | 🟢 idem |
| ~~`1793`~~ | **non è del forfettario** — regime di vantaggio (minimi, art. 27 DL 98/2011). Errore del piano originale | 🟢 AdE ricerca codici |
| Metodo storico acconto | 100% dell'imposta dell'anno precedente | 🟢 AdE "Come si paga l'Irpef" |
| Acconto non dovuto | imposta anno precedente ≤ 51,65 € | 🟢 idem |
| Ripartizione acconto forfettari/ISA | 50% + 50% (non 40/60) | 🟢 Ris. 93/E/2019; AdE "Come si paga l'Irpef" |
| Unica soluzione a novembre | acconto ≤ 206 € (forfettari/ISA) | 🟢 AdE "Come si paga l'Irpef" |
| Scadenza saldo + primo acconto | 30 giugno (slitta al primo giorno lavorativo) | 🟢 idem |
| Differimento | +30 giorni con maggiorazione 0,40% | 🟢 idem |
| Scadenza secondo acconto | 30 novembre (slitta al primo giorno lavorativo) | 🟢 scadenzario AdE |
| Rateizzazione | solo saldo + primo acconto; rate mensili al 16 del mese; ultima **entro il 16 dicembre**; interessi 4% annuo sulle rate successive alla prima (codice `1668`) | 🟢 D.Lgs. 241/1997 art. 20 come modificato da D.Lgs. 1/2024 art. 8; Circ. 9/E/2024 |
| Secondo acconto in 5 rate gennaio–maggio (P.IVA con ricavi ≤ 170.000 €) | norma a termine, rinnovata anno per anno | 🟡 esisteva per 2023 (DL 145/2023) e 2024 (scadenzario 16/01/2025) — **da riverificare ogni anno**, esempio concreto del rischio "regole che cambiano" |

### Contributi INPS gestione separata (sezione INPS F24)

| Regola | Valore 2026 | Fonte |
|---|---|---|
| Aliquota professionisti senza altra copertura | 26,07% (25 IVS + 0,72 + 0,35 ISCRO) | 🟢 INPS Circ. 8 del 03/02/2026 |
| Aliquota pensionati / altra copertura obbligatoria | 24% | 🟢 idem |
| Massimale reddito | 122.295,00 € | 🟢 idem |
| Minimale (solo accredito contributivo, non obbligo di versamento) | 18.808,00 € | 🟢 idem |
| Base imponibile | reddito forfettario (ricavi × coefficiente), **al lordo** dei contributi | 🟡 prassi consolidata, da confermare su Circ. INPS annuale Quadro RR |
| Scadenze | stesse dell'imposta (saldo + primo acconto giugno, secondo acconto novembre), stesso 0,40%, stessa rateizzazione | 🟢 INPS scheda F24 GS; comunicato INPS 07/07/2025 |
| Misura acconto | 80% dei contributi dell'anno precedente, in due rate da 40% | 🟡 prassi nota, non trovata in forma testuale nelle pagine INPS consultate (renderizzate lato client) — da confermare su Circ. INPS Quadro RR |
| Causali F24 | `PXX` (aliquota piena) / `P10` (aliquota ridotta); suffisso `R` per rateizzazione; interessi esposti a parte | 🟡 mappatura PXX/P10 da confermare su tabella AdE causali INPS |

🔴 Fuori scope: gestione artigiani/commercianti (minimale obbligatorio, contributi fissi trimestrali, riduzione 35% per forfettari) e casse professionali. Modello di calcolo diverso; da aggiungere solo se servirà.

## Cosa implementare (stima)

### 1. Correzioni al calcolo esistente — `forfettarioService.js`

- `accontoStimato`: base cassa (`ricaviCumulatiCassa` proiettati), non competenza. Lasciare la proiezione per competenza come informazione separata se serve alla dashboard, ma non chiamarla acconto.
- `impostaStimata` e `cassa.impostaStimata`: dedurre i contributi INPS versati nell'anno (vedi punto 3) prima di applicare l'aliquota, con minimo 0.

### 2. Config — `config.forfettario` (in `configService.js` `DEFAULT_CONFIG`)

Nuovi campi, con default che non cambiano il comportamento attuale:

```js
gestionePrevidenziale: '',        // '' | 'gestioneSeparata' | 'altro' (artigiani/commercianti/cassa: non stimato)
altraCoperturaPrevidenziale: false, // true ⇒ aliquota ridotta (24%) invece di quella piena (26,07%)
contributiVersati: {},             // { "2026": 1234.56 } contributi INPS versati per cassa nell'anno, inseriti a mano
accontiVersati: {},                // { "2026": { imposta: 0, inps: 0 } } acconti effettivamente versati per l'anno, a mano
```

- `contributiVersati` / `accontiVersati` sono inseriti a mano: l'app non vede i pagamenti F24 (Step 1). Se mancano, si usa la stima dell'anno precedente e la UI lo dichiara ("stimato, non dichiarato").
- ⚠️ **Superato**: esiste già `versamentiF24Service.js` (`f24Versamenti.json`) con i versamenti effettivi. I due campi non servono: si riusa quel service con un campo `codice` opzionale. Vedi [F24_STEP3_SVILUPPO_STIMA.md](F24_STEP3_SVILUPPO_STIMA.md), Step 3.
- 🟢 Nessun dato sensibile nuovo fuori da `config.json` (già gitignored): gli importi restano lì.

### 3. Regole versionate — `backend/src/data/regoleVersamenti.json`

Nuovo file statico, **versionato** (dati pubblici, nessun segreto), stesso posto di `atecoSettori.json`:

```json
{
  "2026": {
    "verificatoIl": "2026-09-26",
    "impostaSostitutiva": {
      "codici": { "saldo": "1792", "accontoPrimaRata": "1790", "accontoSecondaRata": "1791", "interessiRate": "1668" },
      "sogliaAccontoNonDovuto": 51.65, "sogliaUnicaSoluzione": 206, "percentualePrimaRata": 50
    },
    "inpsGestioneSeparata": {
      "aliquotaPiena": 26.07, "aliquotaRidotta": 24, "massimale": 122295,
      "percentualeAcconto": 80, "causali": { "piena": "PXX", "ridotta": "P10" }
    },
    "scadenze": { "saldoPrimoAcconto": "06-30", "secondoAcconto": "11-30", "maggiorazioneDifferimento": 0.40 },
    "fonti": ["https://www.agenziaentrate.gov.it/portale/come-si-paga-l-irpef6", "https://www.inps.it/…/Circolare-numero-8-del-03-02-2026.pdf"]
  }
}
```

- Un blocco per anno fiscale, aggiornato a mano una volta l'anno (febbraio, dopo la circolare INPS sulle aliquote). Se l'anno richiesto manca, si usa l'ultimo disponibile e la UI mostra "regole non aggiornate per l'anno X".
- Letto con `readJson`/import statico come `atecoSettori.json`, non via `jsonStore` (è dato di prodotto, non dato utente).
- ⛔ Niente cronjob, niente scraping di tabelle AdE (sono PDF e i codici forfettario non cambiano dal 2015), niente refresh automatico via Gemini. Il costo di un aggiornamento annuo a mano di ~10 numeri è minore di qualsiasi pipeline. Il refresh via Gemini (pattern `geminiAtecoService.js`) resta un'opzione **futura**, solo se l'aggiornamento manuale si rivelasse un peso.

### 4. Calcolo — nuovo `backend/src/services/versamentiService.js`

Funzioni **pure** (nessun I/O), input = dati già calcolati da `forfettarioService` + config + regole dell'anno. Per l'anno fiscale N (versamenti nell'anno N+1):

```
redditoForfettario(N)  = ricaviCassa(N) × coefficiente
INPS(N)                = min(redditoForfettario, massimale) × aliquotaINPS         (se gestioneSeparata)
imponibileImposta(N)   = max(0, redditoForfettario − contributiVersati(N))
imposta(N)             = imponibileImposta × aliquota (5/15)

saldoImposta(N)        = imposta(N) − accontiVersati(N).imposta
saldoINPS(N)           = INPS(N) − accontiVersati(N).inps

accontoImposta(N+1)    = imposta(N) se > 51,65, altrimenti 0
  ≤ 206 € ⇒ tutto a novembre (1791); altrimenti 50% giugno (1790) + 50% novembre (1791)
accontoINPS(N+1)       = 80% × INPS(N), 40% giugno + 40% novembre
```

Output: elenco righe F24 raggruppate per scadenza:

```js
{ scadenza: '2027-06-30', sezione: 'erario', codice: '1792', annoRiferimento: 2026, importo: 1234.56, descrizione: 'Saldo imposta sostitutiva 2026' }
```

più totale per scadenza e l'importo con maggiorazione 0,40% se si paga entro 30 giorni.

- Il saldo può venire negativo (acconti > imposta) ⇒ mostrarlo come **credito** ("a credito, compensabile"), non come importo da versare. Niente logica di compensazione.
- Arrotondamenti: al centesimo, come il resto del service.
- 🟡 Una scadenza che cade di sabato o domenica slitta al primo giorno lavorativo: funzione minima (solo weekend). Le festività non si gestiscono: l'unica rilevante sarebbe l'8 dicembre, che non tocca queste scadenze.

### 5. Rateizzazione (opzionale, fase 2)

Input: numero di rate (1..n, con l'ultima entro il 16 dicembre). Output: rate mensili al 16 del mese con interessi 4% annuo pro rata sulle rate dopo la prima, riga separata per gli interessi (`1668`; per l'INPS causale con suffisso `R`). Solo su saldo + primo acconto. Da fare solo dopo che la stima base è stata validata su un anno reale.

### 6. Route e UI

- Estendere la risposta di `calcolaDashboardForfettario` con `versamenti` (nessuna nuova route: la dashboard è già l'unico consumatore).
- `DashboardView.vue`: nuova card "Versamenti stimati" riordinabile come le altre (drag/drop esistente). Contiene la tabella per scadenza: sezione, codice, anno di riferimento, importo, totale. Disclaimer fisso: "Stima basata su regole verificate il {verificatoIl}. Verificare con il commercialista prima di pagare."
- `gestionePrevidenziale` vuoto o `'altro'` ⇒ la parte INPS resta **visibile ma disabilitata**, con un link alle impostazioni per configurarla (regola "mai nascondere, sempre disabilitare con azione").
- Impostazioni (sezione forfettario): i campi del punto 2, più l'inserimento per anno di contributi e acconti versati.

### 7. Test — `versamentiService.test.js` (Node `--test`)

Casi minimi:
- acconto ≤ 51,65 ⇒ nessun acconto;
- acconto tra 51,65 e 206 ⇒ unica soluzione a novembre;
- acconto > 206 ⇒ 50/50;
- deduzione INPS che azzera l'imponibile;
- massimale INPS;
- saldo negativo ⇒ credito;
- scadenza nel weekend ⇒ slitta;
- anno assente in `regoleVersamenti.json` ⇒ fallback con flag.

Aggiornare `forfettarioService.test.js` per la base cassa dell'acconto.

## Esplicitamente escluso

- Generazione PDF/file F24 o invio telematico. 🟢 Chi ha partita IVA paga l'F24 per forza in via telematica, ma lo fa da solo con F24 web / home banking: non esiste un canale tipo SDI da cui l'app possa inviarlo.
- Artigiani/commercianti, casse professionali, concordato preventivo biennale (CPB), secondo acconto rateizzato gennaio–maggio (norma a termine), metodo previsionale dell'acconto.
- Qualsiasi calcolo fatto da un LLM.

## Valutazione del documento esterno (fonti F24 generate da Gemini)

- 🟢 Corretti: codici 1790/1791/1792/1668; si rateizzano solo saldo e primo acconto; l'API Normattiva esiste (`dati.normattiva.it`, endpoint `api.normattiva.it`); il principio "LLM solo per strutturare testo, calcoli nel backend".
- 🔴 Errati o non verificabili: link `google.com/search?q=` e `utm_source=gemini` (non sono fonti reali); "feed RSS dello scadenzario" (gli RSS AdE coprono solo notizie e prassi); "endpoint di ricerca" DeF Finanze (nessuna API documentata); tabelle codici "CSV/TXT" (sono PDF o HTML).
- 🔴 Mancano: 50/50 per i forfettari, soglie 51,65 / 206, 0,40%, 4%, 16 dicembre, tutta la parte INPS.
- Conclusione: utile come indice delle fonti, **non** come base per una pipeline automatica.

## Ordine di implementazione proposto

Piano di sviluppo dettagliato, con step e checkbox: [F24_STEP3_SVILUPPO_STIMA.md](F24_STEP3_SVILUPPO_STIMA.md).

1. Correzioni al punto 1 (base cassa + deduzione INPS) con test — ha valore anche da solo, perché la dashboard attuale sovrastima.
2. Config (punto 2) + `regoleVersamenti.json` (punto 3).
3. `versamentiService.js` + test (punti 4 e 7).
4. Card dashboard + impostazioni (punto 6), verificata con screenshot prima/dopo.
5. Rateizzazione (punto 5), solo se serve.
6. Aggiornare `CHANGELOG.md` (voce `[Unreleased]`).

## Domande aperte per l'utente

1. ~~Conferma: iscritto alla gestione separata INPS, senza altra copertura previdenziale (aliquota 26,07%)?~~ ✅ 2026-09-26: sì, gestione separata. Artigiani/commercianti e casse restano fuori scope.
2. Per gli anni già chiusi, hai gli importi degli F24 effettivamente pagati (contributi e acconti) da inserire? Senza, la stima del saldo si basa su acconti stimati.
3. La rateizzazione (punto 5) serve davvero o basta l'unica soluzione?

## Fonti ufficiali

- [AdE – Codici tributo 1790](https://www1.agenziaentrate.gov.it/servizi/codici/ricerca/compilaf24_erario.php?CT=1790), [1791](https://www1.agenziaentrate.gov.it/documentazione/versamenti/codici/ricerca/compilaf24_erario.php?CT=1791), [1792](https://www1.agenziaentrate.gov.it/servizi/codici/ricerca/compilaf24_erario.php?CT=1792), [elenco imposte sostitutive](https://www1.agenziaentrate.gov.it/servizi/codici/ricerca/elencoTributi.php?Q1=&Q2=&Q3=IMPOSTE+SOSTITUTIVE)
- [AdE – Risoluzioni codici 2015 (59/E)](https://www.agenziaentrate.gov.it/portale/it/web/guest/archivio/normativa-prassi-archivio-documentazione/istituzione-codici-tributo-archivio-risoluzioni/2015-ris-codici-ist)
- [AdE – Risoluzione 93/E/2019](https://www.agenziaentrate.gov.it/portale/documents/20143/2139920/Risoluzione+n.+93+del+12+novembre+2019.pdf/731cf395-788b-06d4-4d6b-f8f69be11928)
- [AdE – Circolare 9/E/2024](https://www.agenziaentrate.gov.it/portale/documents/20143/6101200/Circolare+n.+9_02_05_2024.pdf/c5932a62-5b45-179a-adbe-ccdb3db9b0b8)
- [AdE – Come si paga l'Irpef (professionisti)](https://www.agenziaentrate.gov.it/portale/come-si-paga-l-irpef6)
- [AdE – Secondo acconto ricavi ≤ 170mila](https://www.agenziaentrate.gov.it/portale/-/autonomi-e-imprenditori-individuali-con-ricavi-fino-a-170mila-euro-il-secondo-acconto-irpef-va-al-2024), [scadenzario 16/01/2025](https://www1.agenziaentrate.gov.it/servizi/scadenzario/main.php?op=4&chi=3790&cosa=10825&come=504&entroil=16-01-2025)
- [AdE – Tabelle causali INPS per F24](https://www.agenziaentrate.gov.it/portale/web/guest/strumenti/codici-attivita-e-tributo/f24-codici-tributo-per-i-versamenti/tabelle-dei-codici-tributo-e-altri-codici-per-il-modello-f24/tabelle-codici-inps-e-enti-previdenziali-ed-assicurativi)
- [INPS – Circolare 8 del 03/02/2026 (aliquote GS 2026)](https://www.inps.it/content/dam/inps-site/it/scorporati/circolari-e-messaggi/2026/02/Circolare_15153/Allegati/16573_Circolare-numero-8-del-03-02-2026.pdf)
- [INPS – F24 professionisti Gestione Separata](https://www.inps.it/it/it/dettaglio-approfondimento.schede-informative.49920.F24-per-professionisti-iscritti-alla-Gestione-Separata.html), [comunicato 07/07/2025 (Circ. 105/2025)](https://www.inps.it/content/dam/inps-site/it/scorporati/comunicati-stampa/2025/07/Allegati/3820_CS_Istruzioni-compilazione-Quadro-RR-art_com-e-gestione-separata.pdf)
- [Normattiva OpenData](https://dati.normattiva.it/)

## Review Checklist

- **Completezza**: calcolo imposta, INPS gestione separata, scadenze, codici, config, test e UI coperti. Rateizzazione rimandata a fase 2. Artigiani/casse esclusi.
- **Accuratezza**: codici, soglie, 50/50, aliquote INPS 2026 e regole di rateizzazione verificati su AdE/INPS (🟢). Acconto INPS all'80%, causali PXX/P10 e base INPS al lordo dei contributi: 🟡.
- **Coerenza**: riusa `forfettarioService`, il pattern `atecoSettori.json` e il drag/drop della dashboard. Nessuna nuova route. Test con `--test`.
- **TODO**: riconfermare le voci 🟡 su Circ. INPS Quadro RR 2026 e sulla tabella AdE delle causali INPS prima di implementare il punto 4.
- **Informazioni mancanti**: F24 storici effettivamente pagati. La posizione previdenziale è confermata: gestione separata.
- **Domande aperte**: vedi sezione dedicata.
- **Livello di confidenza**: alto sulla parte imposta sostitutiva, medio-alto sulla parte INPS.
