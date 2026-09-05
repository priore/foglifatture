// Importazione di un timesheet storico dal file Excel originale (layout MRO Pianificazione
// Mensile): stessa struttura del template Templates/Agosto_2026_danilo_priore.xls per tutti i mesi.
// Layout celle (verificato con xlrd sul template): la riga con etichetta "GG" in colonna A è
// l'header della griglia giorni, la riga successiva è il giorno 1 del mese.
// Colonne B..E = Entrata/Uscita mattina/pomeriggio (frazione di giorno, es. 0.395833 = 09:30),
// colonna G = Motivo Assenza, colonna H = Note. Righe weekend hanno solo GG+nome giorno.
// Riga/colonna di "Mese:"/"Anno:" cercate per etichetta (non per indice fisso): il template
// può cambiare leggermente struttura tra versioni, l'etichetta resta stabile.
import * as XLSX from 'xlsx';
import { STATI_ASSENZA } from './timeCalculator.js';

const COL_ENTRATA_MATTINA = 2;
const COL_USCITA_MATTINA = 3;
const COL_ENTRATA_POMERIGGIO = 4;
const COL_USCITA_POMERIGGIO = 5;
const COL_MOTIVO_ASSENZA = 7;
const COL_NOTE = 8;

const MESI_ITALIANI = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
];

// Cerca nella matrice una cella che inizia con l'etichetta data (case-insensitive) e
// restituisce il primo valore non vuoto nelle celle successive della stessa riga.
function trovaValoreEtichetta(matrice, etichetta) {
  for (const riga of matrice) {
    const indice = riga.findIndex(cella => String(cella ?? '').trim().toLowerCase().startsWith(etichetta));
    if (indice === -1) continue;
    for (let i = indice + 1; i < riga.length; i++) {
      if (riga[i] !== '' && riga[i] !== undefined && riga[i] !== null) return riga[i];
    }
  }
  return undefined;
}

// Estrae anno/mese dal template (etichette "Anno:"/"Mese:"); il mese può essere un nome
// testuale ("Agosto") o già numerico. Torna null per il campo se non trovato/riconosciuto.
function estraiAnnoMeseDaXls(matrice) {
  const valoreAnno = trovaValoreEtichetta(matrice, 'anno');
  const valoreMese = trovaValoreEtichetta(matrice, 'mese');
  const anno = Number(valoreAnno) || null;
  let mese = null;
  if (typeof valoreMese === 'number') {
    mese = valoreMese >= 1 && valoreMese <= 12 ? valoreMese : null;
  } else if (valoreMese) {
    const indice = MESI_ITALIANI.indexOf(String(valoreMese).trim().toLowerCase());
    mese = indice === -1 ? null : indice + 1;
  }
  return { anno, mese };
}

// Fallback quando l'xls non riporta anno/mese leggibili: prova a riconoscerli dal nome
// file (es. "Agosto_2026_danilo_priore.xls" o "2026-08_qualcosa.xls").
export function estraiAnnoMeseDaNomeFile(nomeFile) {
  const testo = String(nomeFile || '').toLowerCase();
  const isoMatch = testo.match(/(\d{4})[-_](\d{1,2})(?!\d)/);
  if (isoMatch) {
    const anno = Number(isoMatch[1]);
    const mese = Number(isoMatch[2]);
    if (mese >= 1 && mese <= 12) return { anno, mese };
  }
  const meseMatch = MESI_ITALIANI.findIndex(nome => testo.includes(nome));
  const annoMatch = testo.match(/(20\d{2})/);
  if (meseMatch !== -1 && annoMatch) return { anno: Number(annoMatch[1]), mese: meseMatch + 1 };
  return { anno: null, mese: null };
}

// Trova la riga di header della griglia giorni (etichetta "GG" in colonna A) e torna
// l'indice della riga successiva, cioè il giorno 1.
function trovaRigaPrimoGiorno(matrice) {
  const indiceHeader = matrice.findIndex(riga => String(riga[0] ?? '').trim().toLowerCase() === 'gg');
  return indiceHeader === -1 ? null : indiceHeader + 1;
}

// Converte una frazione di giorno Excel (0-1) in "HH:mm". Cella vuota -> ''.
function frazioneAOrario(valore) {
  if (valore === undefined || valore === '' || typeof valore !== 'number') return '';
  const minutiTotali = Math.round(valore * 24 * 60);
  const ore = Math.floor(minutiTotali / 60);
  const minuti = minutiTotali % 60;
  return `${String(ore).padStart(2, '0')}:${String(minuti).padStart(2, '0')}`;
}

// Riconosce lo stato del giorno dal testo "Motivo Assenza": prova a far corrispondere
// uno stato noto, altrimenti "Altro" se c'è del testo, altrimenti vuoto (lavoro implicito).
function riconosciStato(motivoAssenza) {
  const testo = String(motivoAssenza || '').trim();
  if (!testo) return '';
  const trovato = STATI_ASSENZA.find(s => s.toLowerCase() === testo.toLowerCase());
  return trovato || 'Altro';
}

const GIORNI_SETTIMANA = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

/**
 * Importa un timesheet storico da buffer xls/xlsx.
 * @param {Buffer} buffer - contenuto del file Excel
 * @param {number} [anno], {number} [mese] - usati se l'xls non riporta etichette "Anno:"/"Mese:" leggibili
 * @returns {{ anno: number, mese: number, giorni: Array }}
 */
export function importaTimesheetDaXls(buffer, anno, mese) {
  const cartella = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const foglio = cartella.Sheets[cartella.SheetNames[0]];
  const matrice = XLSX.utils.sheet_to_json(foglio, { header: 1, raw: true, defval: '' });

  const dalXls = estraiAnnoMeseDaXls(matrice);
  anno = dalXls.anno ?? anno;
  mese = dalXls.mese ?? mese;
  if (!anno || !mese) throw new Error('Impossibile determinare anno/mese dal file (etichette "Anno:"/"Mese:" non trovate)');

  const rigaPrimoGiorno = trovaRigaPrimoGiorno(matrice);
  if (rigaPrimoGiorno === null) throw new Error('Impossibile determinare la griglia giorni (etichetta "GG" non trovata)');

  const numeroGiorni = new Date(anno, mese, 0).getDate();
  const giorni = [];
  for (let giorno = 1; giorno <= numeroGiorni; giorno++) {
    const riga = matrice[rigaPrimoGiorno + giorno - 1] || [];
    const inizioMattina = frazioneAOrario(riga[COL_ENTRATA_MATTINA]);
    const fineMattina = frazioneAOrario(riga[COL_USCITA_MATTINA]);
    const inizioPomeriggio = frazioneAOrario(riga[COL_ENTRATA_POMERIGGIO]);
    const finePomeriggio = frazioneAOrario(riga[COL_USCITA_POMERIGGIO]);

    giorni.push({
      giorno,
      nomeGiorno: GIORNI_SETTIMANA[new Date(anno, mese - 1, giorno).getDay()],
      inizioMattina, fineMattina, inizioPomeriggio, finePomeriggio,
      stato: riconosciStato(riga[COL_MOTIVO_ASSENZA]),
      note: String(riga[COL_NOTE] || ''),
    });
  }
  return { anno, mese, giorni };
}
