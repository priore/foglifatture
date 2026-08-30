// Gestione del timesheet mensile: creazione griglia giorni, salvataggio, lettura.
import { readJson, writeJson, listKeys } from '../lib/jsonStore.js';
import { calcolaOreGiorno, calcolaTotaleMensile, contaGiorniPerStato } from './timeCalculator.js';

const GIORNI_SETTIMANA = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

function chiaveMese(anno, mese, clienteId) {
  return `${anno}-${String(mese).padStart(2, '0')}-${clienteId}`;
}

function percorsoFile(anno, mese, clienteId) {
  return `timesheets/${chiaveMese(anno, mese, clienteId)}.json`;
}

// Spacca una chiave "anno-mese-clienteId" nelle sue parti. clienteId può contenere
// trattini (uuid), quindi si spacca solo sui primi due segmenti, il resto è l'id.
function parseChiave(chiave) {
  const [anno, mese, ...restoId] = chiave.split('-');
  return { chiave, anno: Number(anno), mese: Number(mese), clienteId: restoId.join('-') };
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

export async function getTimesheet(anno, mese, clienteId) {
  const esistente = await readJson(percorsoFile(anno, mese, clienteId), null);
  if (esistente) return esistente;
  return { anno, mese, clienteId, giorni: generaGrigliaVuota(anno, mese) };
}

export async function saveTimesheet(anno, mese, clienteId, giorni) {
  const timesheet = { anno, mese, clienteId, giorni };
  await writeJson(percorsoFile(anno, mese, clienteId), timesheet);
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

// Restituisce le chiavi già parsate ({ chiave, anno, mese, clienteId }), non stringhe
// grezze: evita che ogni consumatore debba rifare split('-') su un formato composito.
export async function listMesiDisponibili() {
  const chiavi = await listKeys('timesheets');
  return chiavi.map(parseChiave).sort((a, b) => a.chiave.localeCompare(b.chiave));
}

// Giorni feriali (lun-ven) del mese senza ore registrate e senza uno stato di assenza:
// usato dal promemoria di fine mese per segnalare cosa manca ancora da compilare.
export async function getGiorniMancanti(anno, mese, clienteId) {
  const timesheet = await getTimesheet(anno, mese, clienteId);
  return timesheet.giorni
    .filter(g => {
      const data = new Date(anno, mese - 1, g.giorno);
      const feriale = data.getDay() !== 0 && data.getDay() !== 6;
      return feriale && calcolaOreGiorno(g) === 0 && !g.stato;
    })
    .map(g => g.giorno);
}
