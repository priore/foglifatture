// Importazione di un timesheet storico dal file Excel originale (layout MRO Pianificazione
// Mensile): stessa struttura del template Templates/Agosto_2026_danilo_priore.xls per tutti i mesi.
// Layout celle (verificato con xlrd sul template): riga 8+N = giorno N del mese,
// colonne B..E = Entrata/Uscita mattina/pomeriggio (frazione di giorno, es. 0.395833 = 09:30),
// colonna G = Motivo Assenza, colonna H = Note. Righe weekend hanno solo GG+nome giorno.
import * as XLSX from 'xlsx';
import { STATI_ASSENZA } from './timeCalculator.js';

const RIGA_PRIMO_GIORNO = 9; // indice di riga 0-based nella matrice (matrice[9] = giorno 1)
const COL_ENTRATA_MATTINA = 2;
const COL_USCITA_MATTINA = 3;
const COL_ENTRATA_POMERIGGIO = 4;
const COL_USCITA_POMERIGGIO = 5;
const COL_MOTIVO_ASSENZA = 7;
const COL_NOTE = 8;

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
 * @param {number} anno, {number} mese - usati per generare i nomi giorno corretti
 * @returns {{ anno: number, mese: number, giorni: Array }}
 */
export function importaTimesheetDaXls(buffer, anno, mese) {
  const cartella = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const foglio = cartella.Sheets[cartella.SheetNames[0]];
  const matrice = XLSX.utils.sheet_to_json(foglio, { header: 1, raw: true, defval: '' });

  const numeroGiorni = new Date(anno, mese, 0).getDate();
  const giorni = [];
  for (let giorno = 1; giorno <= numeroGiorni; giorno++) {
    const riga = matrice[RIGA_PRIMO_GIORNO + giorno - 1] || [];
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
