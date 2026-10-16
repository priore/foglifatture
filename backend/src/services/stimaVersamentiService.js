// Stima delle scadenze F24 (imposta sostitutiva + INPS gestione separata) per l'anno fiscale N.
// Funzioni pure: nessuna lettura da disco, tutti gli input arrivano dal chiamante (step 5 F24_STEP3).
import { scadenzeBaseAnno, primoGiornoLavorativo } from './scadenzeFiscaliService.js';
import { impostaCassaAnno, roundEuro, accontoInpsAnnoSuccessivo } from './forfettarioService.js';
import { listVersamenti, accontiImpostaVersati } from './versamentiF24Service.js';
import { tutteLeFattureRisolte } from './forfettarioService.js';
import { arricchisciStatoPagamento } from './invoiceService.js';
import { regoleAnno } from './regoleFiscaliService.js';

// A10: importo minimo per riga F24 (Istr. Redditi PF 2026 fasc. 1 §7).
const F24_MIN_RIGA = 1.03;

// Giorni commerciali tra due Date (mesi di 30 gg, convenzione 30/360).
// DM 21/5/2009 art. 5; A9 piano FEATURES_GAP_ANALISI_ESTERNA.
function giorniCommerciali(da, a) {
  const d1 = da instanceof Date ? da : new Date(da);
  const d2 = a instanceof Date ? a : new Date(a);
  return (d2.getFullYear() - d1.getFullYear()) * 360
    + (d2.getMonth() - d1.getMonth()) * 30
    + (d2.getDate() - d1.getDate());
}

// Percentuale interessi per la rata `i` (1-based).
// P2 = round2(4 × gg_comm(base, nominale rata 2) / 360); Pk = P2 + (k-2) × 0.33.
// DM 21/5/2009 art. 5 + tabella AdE: 30/6 → 0.18%, 0.51%, 0.84%, 1.17%, 1.50%, 1.83%.
function percentualeInteressi(i, dataBase) {
  if (i <= 1) return 0;
  // Data nominale rata 2 = 16 del mese successivo alla data base.
  const base = typeof dataBase === 'string' ? new Date(dataBase) : new Date(dataBase);
  const r2 = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 16));
  const p2 = Number((4 * giorniCommerciali(base, r2) / 360).toFixed(2));
  return Number((p2 + (i - 2) * 0.33).toFixed(2));
}

// A4: maggiorazione 0,40% — Erario: importo riga += maggiorazione; INPS: riga DPPI separata.
// Circ. INPS 62/2026 §3-4; Istr. Redditi PF 2026 fasc. 1 §7.
// `maggiorazionePct` in punti percentuali (es. 0.40). `causaleInteressiInps` = 'DPPI'.
export function applicaMaggiorazioneRighe(righe, maggiorazionePct, causaleInteressiInps = 'DPPI') {
  const nuove = [];
  let totaleMaggiorazioneInps = 0;
  let annoRifInps = null;
  for (const r of righe) {
    if (r.sezione === 'erario') {
      const maggiorazione = Number((r.importo * maggiorazionePct / 100).toFixed(2));
      nuove.push({ ...r, importo: Number((r.importo + maggiorazione).toFixed(2)), maggiorazione });
    } else {
      nuove.push(r);
      const maggiorazione = Number((r.importo * maggiorazionePct / 100).toFixed(2));
      totaleMaggiorazioneInps = Number((totaleMaggiorazioneInps + maggiorazione).toFixed(2));
      annoRifInps = r.annoRiferimento;
    }
  }
  if (totaleMaggiorazioneInps >= 1.03) {
    nuove.push({
      sezione: 'inps',
      codice: causaleInteressiInps,
      annoRiferimento: annoRifInps,
      importo: totaleMaggiorazioneInps,
      descrizione: 'Maggiorazione differimento INPS (0,40%)',
      maggiorazione: true,
    });
  }
  return nuove;
}

// Rateizza una scadenza F24 in `n` rate mensili a partire da `dataBase`.
// Input: scadenza dal piano (con campo `.righe`), regole anno, config forfettario.
// Output: array di scadenze con righe splittate, causali INPS aggiornate (PXXR/P10R),
//         interessi erario su 1668, interessi INPS su DPPI (pre-req A3 / A9).
// Limite: ultima rata ≤ 16 dicembre dell'anno di pagamento (A9).
// `rateizzaScadenza` riceve le righe PRIMA della maggiorazione (righeGiugno, non righeMagg).
// Le date nominali usano UTC per evitare il timezone bug (advisor fix 3).
// Il pagamento passa per primoGiornoLavorativo; gli interessi si calcolano sulle date nominali (A9).
export function rateizzaScadenza(scadenza, n, regole, config) {
  if (n <= 1) return [scadenza];

  const codiciErario = regole.codiciTributo ?? {};
  const causaliInps = regole.causaliInps ?? {};
  const altraCoperturaPrevidenziale = config?.forfettario?.altraCoperturaPrevidenziale ?? false;
  const causaleRateInps = altraCoperturaPrevidenziale
    ? (causaliInps.rateazioneRidotta ?? 'P10R')
    : (causaliInps.rateazioneOrdinaria ?? 'PXXR');
  const codiceInteressiErario = codiciErario.interessiRateazione ?? '1668';
  const causaleInteressiInps = causaliInps.interessi ?? 'DPPI';

  // Date nominali in UTC (rata 1 = data base, rata k = 16 del mese k-1 successivo).
  const baseStr = scadenza.data; // 'AAAA-MM-GG'
  const [ay, am, ad] = baseStr.split('-').map(Number);
  const baseUtc = new Date(Date.UTC(ay, am - 1, ad));

  const dateNominali = [baseStr];
  const datePagamento = [baseStr]; // rata 1: non serve spostamento (già giorno lavorativo)
  for (let i = 1; i < n; i++) {
    const d = new Date(Date.UTC(ay, am - 1 + i, 16));
    const nomStr = d.toISOString().slice(0, 10); // 'AAAA-MM-16'
    dateNominali.push(nomStr);
    const [ny, nm, nd] = nomStr.split('-').map(Number);
    datePagamento.push(primoGiornoLavorativo(ny, nm, nd));
  }

  // A9: tronca al 16 dicembre (confronto su stringhe, come maxRateConsentite).
  const limiteStr = `${ay}-12-16`;
  const nEffettivo = dateNominali.filter((d) => d <= limiteStr).length;

  const result = [];
  for (let i = 0; i < nEffettivo; i++) {
    // Format NNRR (es. prima di 3 rate = '0103'), come il modello F24.
    const label = String(i + 1).padStart(2, '0') + String(nEffettivo).padStart(2, '0');
    const pctInteressi = percentualeInteressi(i + 1, baseUtc);
    const righe = [];

    // Quota base: le prime nEffettivo-1 rate sono uguali, l'ultima prende il resto.
    for (const riga of scadenza.righe) {
      const quotaBase = Number((riga.importo / nEffettivo).toFixed(2));
      const isUltima = i === nEffettivo - 1;
      const sommaAltre = Number((quotaBase * (nEffettivo - 1)).toFixed(2));
      const quota = isUltima ? Number((riga.importo - sommaAltre).toFixed(2)) : quotaBase;

      if (riga.sezione === 'inps') {
        righe.push({ ...riga, codice: causaleRateInps, importo: quota, rateazione: label });
        if (pctInteressi > 0) {
          const interessi = Number((quota * pctInteressi / 100).toFixed(2));
          if (interessi >= F24_MIN_RIGA) {
            righe.push({
              sezione: 'inps',
              codice: causaleInteressiInps,
              annoRiferimento: riga.annoRiferimento,
              importo: interessi,
              descrizione: `Interessi rateazione INPS rata ${i + 1}/${nEffettivo}`,
              rateazione: label,
            });
          }
        }
      } else {
        righe.push({ ...riga, importo: quota, rateazione: label });
        if (pctInteressi > 0) {
          const interessi = Number((quota * pctInteressi / 100).toFixed(2));
          if (interessi >= F24_MIN_RIGA) {
            righe.push({
              sezione: 'erario',
              codice: codiceInteressiErario,
              annoRiferimento: riga.annoRiferimento,
              importo: interessi,
              descrizione: `Interessi rateazione erario rata ${i + 1}/${nEffettivo}`,
              rateazione: label,
            });
          }
        }
      }
    }

    const totale = Number(righe.reduce((t, r) => t + r.importo, 0).toFixed(2));
    result.push({ ...scadenza, data: datePagamento[i], dataNominale: dateNominali[i], righe, totale, totaleConMaggiorazione: totale });
  }

  return result;
}

// Numero massimo di rate consentite partendo da `dataBase` (ultima ≤ 16 dicembre stesso anno).
// A9: DM 21/5/2009 art. 5; Istr. Redditi PF 2026 fasc. 1 "Rateazione".
export function maxRateConsentite(dataBase) {
  const d = dataBase instanceof Date ? dataBase : new Date(dataBase);
  // Confronto solo su YYYY-MM-DD evita problemi di timezone (limite è sempre 16/12 dell'anno di partenza).
  const annoLimite = d.getFullYear();
  const limiteStr = `${annoLimite}-12-16`;
  let n = 1;
  while (true) {
    const prossima = new Date(d);
    prossima.setUTCMonth(d.getUTCMonth() + n);
    prossima.setUTCDate(16);
    if (prossima.toISOString().slice(0, 10) > limiteStr) break;
    n++;
  }
  return n;
}

// Calcola il piano F24 per l'anno fiscale `anno`.
// Restituisce { annoFiscale, regole, scadenze, crediti, avvisi }.
export async function stimaVersamenti(config, anno) {
  const regole = await regoleAnno(anno);
  const tutteF = (await tutteLeFattureRisolte()).map(arricchisciStatoPagamento);
  const versamentiAnno = await listVersamenti(anno);
  const versamentiAnnoPrecedente = await listVersamenti(anno - 1);

  const annoPrecedente = anno - 1;
  const [datiN, datiNm1] = await Promise.all([
    impostaCassaAnno(anno, tutteF, config, versamentiAnno, regole),
    impostaCassaAnno(annoPrecedente, tutteF, config, versamentiAnnoPrecedente, regole),
  ]);

  const avvisi = [];
  const crediti = [];

  // Soglia: oltre 100.000 € il regime cessa nell'anno stesso, F24 forfettario non applicabile.
  const sogliaUscita = regole.forfettario.sogliaUscitaImmediata ?? 100000;
  // La soglia vale sui ricavi/compensi incassati (L. 190/2014 c. 71), non sul reddito.
  if (datiN.ricavi > sogliaUscita) {
    return {
      annoFiscale: anno,
      regole: { anno: regole.anno, verificatoIl: regole.verificatoIl, aggiornate: regole.aggiornate ?? true, banner: regole.banner ?? null },
      scadenze: [],
      crediti: [],
      avvisi: ['Ricavi oltre 100.000 €: il regime forfettario cessa nell\'anno stesso. F24 forfettario non applicabile — consultare un commercialista.'],
    };
  }

  const sogliaNonDovuto = regole.acconti?.sogliaUnicaSoluzione ?? 103;
  const sogliaUnicaSoluzione = regole.acconti?.sogliaUnicaSoluzione ?? 103;
  const percentualeAccontoN = regole.acconti?.percentualeAcconto ?? 100;
  const soggettoIsa = config.forfettario?.soggettoIsa ?? true;
  const ripartizione = soggettoIsa
    ? (regole.acconti?.ripartizioneSoggettoIsa ?? { prima: 50, seconda: 50 })
    : (regole.acconti?.ripartizioneNoIsa ?? { prima: 40, seconda: 60 });
  const maggiorazionePct = regole.scadenze?.proroga2026?.maggiorazione ?? 0.40;

  const codiciErario = regole.codiciTributo ?? {};
  const causaliInps = regole.causaliInps ?? {};
  const gestionePrevidenziale = config.forfettario?.gestionePrevidenziale ?? '';
  const altraCoperturaPrevidenziale = config.forfettario?.altraCoperturaPrevidenziale ?? false;

  // --- Imposta sostitutiva ---
  const impostaN = datiN.imposta;
  const impostaNm1 = datiNm1.imposta;

  // Saldo anno N
  const accontiVersatiN = accontiImpostaVersati(versamentiAnno, anno);
  const accontoCalcolatoNm1 = impostaNm1; // 100% dell'imposta anno precedente come stima acconti
  const accontiEffettiviN = accontiVersatiN ?? accontoCalcolatoNm1;
  if (accontiVersatiN === null) {
    avvisi.push('Acconti imposta 2026 non registrati con codice tributo: usata la stima dell\'anno precedente.');
  }
  const saldoImposta = roundEuro(impostaN - accontiEffettiviN);

  // Acconto anno N+1
  const accontoTotaleN1 = impostaN <= sogliaNonDovuto ? 0 : Number((impostaN * percentualeAccontoN / 100).toFixed(2));

  // --- INPS gestione separata ---
  let saldoInps = null, accontoInpsTotaleN1 = null;
  if (gestionePrevidenziale === 'gestioneSeparata') {
    const inpsN = datiN.inps ?? 0;
    const inpsNm1 = datiNm1.inps ?? 0;
    // Acconti INPS = 80% dell'INPS anno N-1 (stima; i versamenti INPS non hanno codice separato)
    const percentualeAccontoInps = regole.inpsGestioneSeparata ? 80 : 80;
    const accontiInpsNm1 = Number((inpsNm1 * percentualeAccontoInps / 100).toFixed(2));
    saldoInps = roundEuro(inpsN - accontiInpsNm1);
    // Acconti N+1: reddito di N con l'aliquota di N+1 (Circ. INPS 8/2026 §4.2).
    const regoleN1 = await regoleAnno(anno + 1);
    accontoInpsTotaleN1 = accontoInpsAnnoSuccessivo(datiN.redditoForfettario, regoleN1, altraCoperturaPrevidenziale);
    if (regoleN1.aggiornate === false) {
      avvisi.push(`Regole ${anno + 1} non ancora disponibili: acconti INPS ${anno + 1} calcolati con l'aliquota ${regoleN1.anno}.`);
    }
    avvisi.push('Acconti INPS stimati dall\'anno precedente (non è possibile distinguere i versamenti INPS senza il codice tributo).');
  }

  // --- Costruzione scadenze ---
  const scadenzeBase = scadenzeBaseAnno(anno + 1);
  const dataGiugno = scadenzeBase.find((s) => s.tipo === 'Saldo + I acconto imposta sostitutiva')?.data;
  const dataNovembre = scadenzeBase.find((s) => s.tipo === 'II acconto imposta sostitutiva')?.data;
  const dataInpsGiugno = scadenzeBase.find((s) => s.tipo === 'INPS gestione separata' && s.data <= dataNovembre)?.data ?? dataGiugno;
  const dataInpsNovembre = scadenzeBase.find((s) => s.tipo === 'INPS gestione separata' && s.data > dataInpsGiugno)?.data ?? dataNovembre;

  const causaleInteressiInps = causaliInps.interessi ?? 'DPPI';

  // Scadenza giugno: saldo + primo acconto
  const righeGiugno = [];
  if (saldoImposta > 0) {
    if (saldoImposta >= F24_MIN_RIGA) {
      righeGiugno.push({ sezione: 'erario', codice: codiciErario.impostaSostitutivaSaldo ?? '1792', annoRiferimento: anno, importo: saldoImposta, descrizione: `Saldo imposta sostitutiva ${anno}` });
    } else {
      avvisi.push(`Saldo imposta sostitutiva ${anno} (${saldoImposta} €) sotto la soglia minima di 1,03 €: riga F24 non dovuta.`);
    }
  } else if (saldoImposta < 0) {
    crediti.push({ sezione: 'erario', importo: Math.abs(saldoImposta), descrizione: `Saldo ${anno} a credito (acconti > imposta)` });
  }
  if (accontoTotaleN1 > 0 && accontoTotaleN1 <= sogliaUnicaSoluzione * 2) {
    // Unica soluzione a novembre
  } else if (accontoTotaleN1 > 0) {
    const prima = Number((accontoTotaleN1 * ripartizione.prima / 100).toFixed(2));
    if (prima >= F24_MIN_RIGA) {
      righeGiugno.push({ sezione: 'erario', codice: codiciErario.impostaSostitutiva ?? '1790', annoRiferimento: anno + 1, importo: prima, descrizione: `I acconto imposta sostitutiva ${anno + 1}` });
    } else {
      avvisi.push(`I acconto imposta sostitutiva ${anno + 1} (${prima} €) sotto la soglia minima di 1,03 €: riga F24 non dovuta.`);
    }
  }
  if (saldoInps !== null) {
    const causaleInps = altraCoperturaPrevidenziale ? (causaliInps.aliquotaRidotta ?? 'P10') : (causaliInps.ordinaria ?? 'PXX');
    if (saldoInps > 0) {
      if (saldoInps >= F24_MIN_RIGA) {
        righeGiugno.push({ sezione: 'inps', codice: causaleInps, annoRiferimento: anno, importo: saldoInps, descrizione: `Saldo contributi GS ${anno}` });
      } else {
        avvisi.push(`Saldo contributi GS ${anno} (${saldoInps} €) sotto la soglia minima di 1,03 €: riga F24 non dovuta.`);
      }
    } else if (saldoInps < 0) {
      crediti.push({ sezione: 'inps', importo: Math.abs(saldoInps), descrizione: `Saldo INPS ${anno} a credito` });
    }
    if (accontoInpsTotaleN1 > 0) {
      const primaInps = Number((accontoInpsTotaleN1 * 0.40).toFixed(2));
      if (primaInps >= F24_MIN_RIGA) {
        righeGiugno.push({ sezione: 'inps', codice: causaleInps, annoRiferimento: anno + 1, importo: primaInps, descrizione: `I acconto contributi GS ${anno + 1}` });
      } else {
        avvisi.push(`I acconto contributi GS ${anno + 1} (${primaInps} €) sotto la soglia minima di 1,03 €: riga F24 non dovuta.`);
      }
    }
  }

  // Scadenza novembre: secondo acconto
  const righeNovembre = [];
  if (accontoTotaleN1 > 0) {
    const seconda = accontoTotaleN1 <= sogliaUnicaSoluzione * 2
      ? accontoTotaleN1 // unica soluzione
      : Number((accontoTotaleN1 * ripartizione.seconda / 100).toFixed(2));
    if (seconda >= F24_MIN_RIGA) {
      righeNovembre.push({ sezione: 'erario', codice: codiciErario.impostaSostitutivaAcconto ?? '1791', annoRiferimento: anno + 1, importo: seconda, descrizione: `II acconto imposta sostitutiva ${anno + 1}` });
    } else {
      avvisi.push(`II acconto imposta sostitutiva ${anno + 1} (${seconda} €) sotto la soglia minima di 1,03 €: riga F24 non dovuta.`);
    }
  }
  if (saldoInps !== null && accontoInpsTotaleN1 > 0) {
    const causaleInps = altraCoperturaPrevidenziale ? (causaliInps.aliquotaRidotta ?? 'P10') : (causaliInps.ordinaria ?? 'PXX');
    const secondaInps = Number((accontoInpsTotaleN1 * 0.60).toFixed(2));
    if (secondaInps >= F24_MIN_RIGA) {
      righeNovembre.push({ sezione: 'inps', codice: causaleInps, annoRiferimento: anno + 1, importo: secondaInps, descrizione: `II acconto contributi GS ${anno + 1}` });
    } else {
      avvisi.push(`II acconto contributi GS ${anno + 1} (${secondaInps} €) sotto la soglia minima di 1,03 €: riga F24 non dovuta.`);
    }
  }

  // --- Rateizzazione saldo + I acconto (Step 7) ---
  // nRate letto da config (persistente tra route GET, PDF e POST /f24).
  const nRateRichieste = config.forfettario?.rateSaldo ?? 1;
  const maxRate = dataGiugno ? maxRateConsentite(dataGiugno) : 1;
  const nRate = Math.min(Math.max(1, nRateRichieste), maxRate);
  if (nRate < nRateRichieste) {
    avvisi.push(`Numero di rate richiesto (${nRateRichieste}) supera il massimo consentito (${maxRate}) con scadenza ${dataGiugno}: applicate ${maxRate} rate.`);
  }

  const scadenze = [];
  if (righeGiugno.length) {
    // Rateizzazione PRIMA della maggiorazione: ogni rata ha la propria maggiorazione.
    const scadenzeGiugno = rateizzaScadenza(
      { data: dataGiugno, dataInps: dataInpsGiugno, righe: righeGiugno, totale: Number(righeGiugno.reduce((t, r) => t + r.importo, 0).toFixed(2)), totaleConMaggiorazione: 0 },
      nRate,
      regole,
      config,
    );
    for (const sc of scadenzeGiugno) {
      const righeMagg = applicaMaggiorazioneRighe(sc.righe, maggiorazionePct, causaleInteressiInps);
      const totale = Number(sc.righe.reduce((t, r) => t + r.importo, 0).toFixed(2));
      const totaleConMaggiorazione = Number(righeMagg.reduce((t, r) => t + r.importo, 0).toFixed(2));
      scadenze.push({ ...sc, righe: righeMagg, totale, totaleConMaggiorazione });
    }
  }
  if (righeNovembre.length) {
    const totale = Number(righeNovembre.reduce((t, r) => t + r.importo, 0).toFixed(2));
    scadenze.push({
      data: dataNovembre,
      dataInps: dataInpsNovembre,
      righe: righeNovembre,
      totale,
      totaleConMaggiorazione: totale,
      isNovembre: true,
    });
  }

  if (gestionePrevidenziale !== 'gestioneSeparata') {
    avvisi.push('Gestione previdenziale non configurata: righe INPS non incluse. Configura in Impostazioni → Regime forfettario.');
  }
  if (regole.aggiornate === false) avvisi.push(regole.banner);

  return {
    annoFiscale: anno,
    regole: { anno: regole.anno, verificatoIl: regole.verificatoIl, aggiornate: regole.aggiornate ?? true, banner: regole.banner ?? null },
    scadenze,
    crediti,
    avvisi: avvisi.filter(Boolean),
    _dettagli: { impostaN, impostaNm1, saldoImposta, accontoTotaleN1, saldoInps, accontoInpsTotaleN1, nRate, maxRate },
  };
}
