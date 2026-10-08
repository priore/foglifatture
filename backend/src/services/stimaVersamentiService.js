// Stima delle scadenze F24 (imposta sostitutiva + INPS gestione separata) per l'anno fiscale N.
// Funzioni pure: nessuna lettura da disco, tutti gli input arrivano dal chiamante (step 5 F24_STEP3).
import { scadenzeBaseAnno } from './scadenzeFiscaliService.js';
import { impostaCassaAnno } from './forfettarioService.js';
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

// Percentuale interessi per la rata `i` (1-based) a partire dalla scadenza `dataBase`.
// Rata 2: 4% × giorni_comm / 360; rata k>2: percentuale rata k-1 + 0.33 pp.
function percentualeInteressi(i, dataBase, dataRata) {
  if (i <= 1) return 0;
  const base4Pct = Number((4 * giorniCommerciali(dataBase, dataRata) / 360).toFixed(4));
  return Number((base4Pct + (i - 2) * 0.33).toFixed(4));
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

  // Calcola date rate: prima alla data base, poi 16 del mese successivo per n-1 mesi.
  const dataBase = new Date(scadenza.data);
  const date = [dataBase];
  for (let i = 1; i < n; i++) {
    const d = new Date(dataBase);
    d.setMonth(d.getMonth() + i);
    d.setDate(16);
    date.push(d);
  }

  // Controllo A9: ultima rata ≤ 16 dicembre
  const anno = dataBase.getFullYear();
  const limite = new Date(anno, 11, 16); // 16 dicembre
  const dateValide = date.filter((d) => d <= limite);
  const nEffettivo = dateValide.length;
  if (nEffettivo < n) {
    // ponytail: tronca silenziosamente, il chiamante deve avvertire l'utente
  }

  const result = [];
  for (let i = 0; i < nEffettivo; i++) {
    const dataRata = dateValide[i];
    const label = `${i + 1}/${nEffettivo}`;
    const pctInteressi = percentualeInteressi(i + 1, dataBase, dataRata);
    const righe = [];

    for (const riga of scadenza.righe) {
      const quota = Number((riga.importo / nEffettivo).toFixed(2));
      if (riga.sezione === 'inps') {
        righe.push({ ...riga, codice: causaleRateInps, importo: quota, rateazione: label });
        if (pctInteressi > 0) {
          const interessi = Number((quota * pctInteressi / 100).toFixed(2));
          if (interessi >= 1.03) { // soglia minima A10
            righe.push({
              sezione: 'inps',
              codice: causaleInteressiInps,
              annoRiferimento: riga.annoRiferimento,
              importo: interessi,
              descrizione: `Interessi rateazione INPS rata ${label}`,
              rateazione: label,
            });
          }
        }
      } else {
        righe.push({ ...riga, importo: quota, rateazione: label });
        if (pctInteressi > 0) {
          const interessi = Number((quota * pctInteressi / 100).toFixed(2));
          if (interessi >= 1.03) {
            righe.push({
              sezione: 'erario',
              codice: codiceInteressiErario,
              annoRiferimento: riga.annoRiferimento,
              importo: interessi,
              descrizione: `Interessi rateazione erario rata ${label}`,
              rateazione: label,
            });
          }
        }
      }
    }

    const totale = Number(righe.reduce((t, r) => t + r.importo, 0).toFixed(2));
    result.push({ ...scadenza, data: dataRata.toISOString().slice(0, 10), righe, totale, totaleConMaggiorazione: totale });
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
  if (datiN.redditoForfettario > sogliaUscita) {
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
  const saldoImposta = Number((impostaN - accontiEffettiviN).toFixed(2));

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
    saldoInps = Number((inpsN - accontiInpsNm1).toFixed(2));
    accontoInpsTotaleN1 = Number((inpsN * percentualeAccontoInps / 100).toFixed(2));
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

  const scadenze = [];
  if (righeGiugno.length) {
    const righeMagg = applicaMaggiorazioneRighe(righeGiugno, maggiorazionePct, causaleInteressiInps);
    const totale = Number(righeGiugno.reduce((t, r) => t + r.importo, 0).toFixed(2));
    const totaleConMaggiorazione = Number(righeMagg.reduce((t, r) => t + r.importo, 0).toFixed(2));
    scadenze.push({
      data: dataGiugno,
      dataInps: dataInpsGiugno,
      righe: righeMagg,
      totale,
      totaleConMaggiorazione,
    });
  }
  if (righeNovembre.length) {
    const totale = Number(righeNovembre.reduce((t, r) => t + r.importo, 0).toFixed(2));
    scadenze.push({
      data: dataNovembre,
      dataInps: dataInpsNovembre,
      righe: righeNovembre,
      totale,
      totaleConMaggiorazione: totale, // il secondo acconto non si rateizza, nessuna maggiorazione
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
    _dettagli: { impostaN, impostaNm1, saldoImposta, accontoTotaleN1, saldoInps, accontoInpsTotaleN1 },
  };
}
