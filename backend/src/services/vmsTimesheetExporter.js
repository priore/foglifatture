// Export CSV generico (data,ore) per import diretto in portali VMS di timesheet
// esterni (es. Beeline): una riga per giorno con ore > 0, nessun riferimento al
// cliente specifico nel formato, solo Data (YYYY-MM-DD) e Ore (decimale).
import { calcolaOreGiorno } from './timeCalculator.js';

export function esportaTimesheetVms(anno, mese, giorni) {
  const righe = ['Data,Ore'];
  for (const giorno of giorni) {
    const ore = calcolaOreGiorno(giorno);
    if (ore <= 0) continue;
    const data = `${anno}-${String(mese).padStart(2, '0')}-${String(giorno.giorno).padStart(2, '0')}`;
    righe.push(`${data},${ore.toFixed(2)}`);
  }
  return righe.join('\n');
}
