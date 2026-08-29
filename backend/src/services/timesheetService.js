// Gestione del timesheet mensile: creazione griglia giorni, salvataggio, lettura.
import { readJson, writeJson, listKeys } from '../lib/jsonStore.js';
import { calcolaOreGiorno, calcolaTotaleMensile, contaGiorniPerStato } from './timeCalculator.js';

const GIORNI_SETTIMANA = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

function chiaveMese(anno, mese) {
  return `${anno}-${String(mese).padStart(2, '0')}`;
}

function percorsoFile(anno, mese) {
  return `timesheets/${chiaveMese(anno, mese)}.json`;
}

// Genera la griglia vuota di un mese: un giorno per ogni data, nessun orario/stato precompilato.
function generaGrigliaVuota(anno, mese) {
  const numeroGiorni = new Date(anno, mese, 0).getDate();
  const giorni = [];
  for (let giorno = 1; giorno <= numeroGiorni; giorno++) {
    const data = new Date(anno, mese - 1, giorno);
    const nomeGiorno = GIORNI_SETTIMANA[data.getDay()];
    giorni.push({
      giorno,
      nomeGiorno,
      inizioMattina: '',
      fineMattina: '',
      inizioPomeriggio: '',
      finePomeriggio: '',
      stato: '',
      note: '',
    });
  }
  return giorni;
}

export async function getTimesheet(anno, mese) {
  const esistente = await readJson(percorsoFile(anno, mese), null);
  if (esistente) return esistente;
  return { anno, mese, giorni: generaGrigliaVuota(anno, mese) };
}

export async function saveTimesheet(anno, mese, giorni) {
  const timesheet = { anno, mese, giorni };
  await writeJson(percorsoFile(anno, mese), timesheet);
  return timesheet;
}

// Riepilogo mensile: totale ore, formattazione, conteggio giorni per stato.
export function calcolaRiepilogo(timesheet) {
  const totaleOre = calcolaTotaleMensile(timesheet.giorni);
  const giorniPerGiorno = timesheet.giorni.map(g => ({
    giorno: g.giorno,
    ore: calcolaOreGiorno(g),
  }));
  return {
    totaleOreDecimale: totaleOre,
    giorniLavorati: timesheet.giorni.filter(g => calcolaOreGiorno(g) > 0).length,
    conteggioStati: contaGiorniPerStato(timesheet.giorni),
    oreGiornaliere: giorniPerGiorno,
  };
}

export async function listMesiDisponibili() {
  const chiavi = await listKeys('timesheets');
  return chiavi.sort();
}
