// Imposta di bollo trimestrale sulle fatture elettroniche.
// FP-025 · FEATURES_GAP_ANALISI_ESTERNA.md voce 10 / sezione G 18°.
//
// Calcola il bollo accumulato per trimestre nell'anno, applica i rinvii previsti dalla guida
// AdE (importo Q1 ≤ 5.000 € → versa con Q2; importo Q1+Q2 ≤ 5.000 € → versa con Q3),
// e produce scadenze compatibili con generaF24Pdf (righe[] con sezione 'erario').
//
// Data di riferimento: data della FATTURA (anno + mese dal percorso file). La guida AdE
// indica la data di "consegna SDI", ma nella prima versione si usa la data fattura come stima.
import { tutteLeFattureRisolte } from './forfettarioService.js';
import { regoleAnno } from './regoleFiscaliService.js';
import { primoGiornoLavorativo } from './scadenzeFiscaliService.js';

// Restituisce il trimestre (1-4) per un mese (1-12).
function trimestre(mese) {
  return Math.ceil(mese / 3);
}

// Somma il bollo per trimestre dell'anno dato, a partire dalle fatture già risolte.
// Funzione pura (fatture in input, niente I/O).
export function bolloPerTrimestre(anno, fatture) {
  const totali = [0, 0, 0, 0]; // indice 0 = Q1, ..., 3 = Q4
  for (const f of fatture) {
    if (f.anno !== anno) continue;
    if (!f.bolloApplicabile || !f.bollo) continue;
    totali[trimestre(f.mese) - 1] = Number((totali[trimestre(f.mese) - 1] + f.bollo).toFixed(2));
  }
  return totali; // [Q1, Q2, Q3, Q4]
}

// Applica i rinvii previsti dalla guida AdE giugno 2026:
//   Q1 ≤ sogliaRinvio → importo Q1 si somma a Q2
//   Q1+Q2 (dopo eventuale rinvio) ≤ sogliaRinvio → importo si somma a Q3
// Restituisce un array di 4 importi finali da versare (0 = trimestre non dovuto).
export function applicaRinviBollo(totali, sogliaRinvio) {
  const [q1, q2, q3, q4] = totali;
  let r1 = q1, r2 = q2, r3 = q3, r4 = q4;

  const q1RinviatoAQ2 = q1 > 0 && q1 <= sogliaRinvio;
  if (q1RinviatoAQ2) {
    r2 = Number((r2 + r1).toFixed(2));
    r1 = 0;
  }
  // Secondo rinvio: si applica solo se Q1 è già stato rinviato E la somma originale Q1+Q2 ≤ soglia.
  if (q1RinviatoAQ2 && Number((q1 + q2).toFixed(2)) <= sogliaRinvio) {
    r3 = Number((r3 + r2).toFixed(2));
    r2 = 0;
  }

  return [r1, r2, r3, r4];
}

const NOMI_TRIM = ['', 'I', 'II', 'III', 'IV'];
const CHIAVI_SCADENZE = ['primoTrimestre', 'secondoTrimestre', 'terzoTrimestre', 'quartoTrimestre'];
const CHIAVI_CODICI = ['primoTrimestre', 'secondoTrimestre', 'terzoTrimestre', 'quartoTrimestre'];

// Calcola le scadenze bollo per l'anno con rinvii applicati.
// Ogni scadenza ha `.righe[]` compatibile con generaF24Pdf (sezione 'erario').
// Scadenze con importo 0 (per via del rinvio o assenza fatture) non vengono incluse.
export async function scadenzeBollo(anno) {
  const regole = await regoleAnno(anno);
  const fatture = await tutteLeFattureRisolte();

  const totaliBase = bolloPerTrimestre(anno, fatture);
  const sogliaRinvio = regole.bollo?.sogliaRinvio ?? 5000;
  const importiFinali = applicaRinviBollo(totaliBase, sogliaRinvio);

  const scad = regole.bollo?.scadenze ?? {};
  const codici = regole.bollo?.codiciTributo ?? {};

  const risultati = [];
  for (let i = 0; i < 4; i++) {
    const importo = importiFinali[i];
    if (importo <= 0) continue;

    const chiave = CHIAVI_SCADENZE[i];
    const sc = scad[chiave];
    if (!sc) continue;

    const annoScadenza = sc.annoSuccessivo ? anno + 1 : anno;
    let mese = sc.mese;
    let giorno = sc.giorno;
    // Febbraio: adatta all'anno effettivo (28 o 29 gg)
    if (mese === 2) {
      const ultFeb = new Date(annoScadenza, 2, 0).getDate(); // ultimo giorno di febbraio
      giorno = Math.min(giorno, ultFeb);
    }
    const data = primoGiornoLavorativo(annoScadenza, mese, giorno);

    const codice = codici[CHIAVI_CODICI[i]];
    // Accumula le quote originali incluse in questo pagamento (per descrizione)
    const trimestri = [];
    if (i === 0) trimestri.push(1);
    if (i === 1) { if (totaliBase[0] <= sogliaRinvio) trimestri.push(1); trimestri.push(2); }
    if (i === 2) { if (totaliBase[0] <= sogliaRinvio && totaliBase[0] + totaliBase[1] <= sogliaRinvio) trimestri.push(1, 2); trimestri.push(3); }
    if (i === 3) trimestri.push(4);

    const descrizione = trimestri.length === 1
      ? `Bollo fatture ${NOMI_TRIM[trimestri[0]]} trim. ${anno}`
      : `Bollo fatture ${trimestri.map((t) => NOMI_TRIM[t]).join('+')} trim. ${anno} (rinvio)`;

    risultati.push({
      trimestre: i + 1,
      data,
      importo,
      totaliBase: totali2obj(totaliBase),
      righe: [{
        sezione: 'erario',
        codice,
        annoRiferimento: anno,
        importo,
        descrizione,
      }],
      totale: importo,
      totaleConMaggiorazione: importo,
    });
  }

  return {
    anno,
    totaliBase: totali2obj(totaliBase),
    sogliaRinvio,
    scadenze: risultati,
    nota: 'Importi stimati: data di riferimento = data fattura (non data consegna SDI).',
  };
}

function totali2obj(arr) {
  return { Q1: arr[0], Q2: arr[1], Q3: arr[2], Q4: arr[3] };
}
