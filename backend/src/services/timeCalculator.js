// Calcolo delle ore lavorate a partire dagli orari HH:mm inseriti nel timesheet.
// Isolato dal resto perché è pura logica di calcolo, facile da testare da sola.

// Lo stato è solo un'etichetta/motivo del giorno (es. assenza parziale con permesso a ore):
// non azzera mai il calcolo, che si basa sempre e solo sugli orari effettivamente inseriti.
export const STATI_ASSENZA = ['Malattia', 'Ferie', 'Festività', 'Recupero', 'Sciopero', 'Altro'];

// Converte "HH:mm" in minuti dalla mezzanotte. Stringa vuota/non valida -> null.
function toMinuti(orario) {
  if (!orario) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(orario.trim());
  if (!match) return null;
  const ore = Number(match[1]);
  const minuti = Number(match[2]);
  if (ore < 0 || ore > 23 || minuti < 0 || minuti > 59) return null;
  return ore * 60 + minuti;
}

// Ore giornaliere (decimale) di un singolo giorno del timesheet, calcolate sempre dagli
// orari inseriti: lo stato è solo un'etichetta e non influisce sul conteggio (permette
// di registrare assenze parziali, es. mezza giornata di permesso e mezza lavorata).
export function calcolaOreGiorno(giorno) {
  const inizioMattina = toMinuti(giorno.inizioMattina);
  const fineMattina = toMinuti(giorno.fineMattina);
  const inizioPomeriggio = toMinuti(giorno.inizioPomeriggio);
  const finePomeriggio = toMinuti(giorno.finePomeriggio);

  let minutiTotali = 0;
  if (inizioMattina !== null && fineMattina !== null && fineMattina > inizioMattina) {
    minutiTotali += fineMattina - inizioMattina;
  }
  if (inizioPomeriggio !== null && finePomeriggio !== null && finePomeriggio > inizioPomeriggio) {
    minutiTotali += finePomeriggio - inizioPomeriggio;
  }
  return minutiTotali / 60;
}

// Somma le ore di tutti i giorni del mese (decimale, es. 160.5).
export function calcolaTotaleMensile(giorni) {
  return giorni.reduce((totale, giorno) => totale + calcolaOreGiorno(giorno), 0);
}

// Converte ore decimali (es. 8.5) in formato sessagesimale "HH:mm" (es. "08:30").
export function decimaleAHHmm(oreDecimali) {
  const minutiTotali = Math.round(oreDecimali * 60);
  const ore = Math.floor(minutiTotali / 60);
  const minuti = minutiTotali % 60;
  return `${String(ore).padStart(2, '0')}:${String(minuti).padStart(2, '0')}`;
}

// Conta i giorni per ciascuno stato di assenza/lavoro (per il riepilogo mensile).
export function contaGiorniPerStato(giorni) {
  const conteggio = Object.fromEntries(STATI_ASSENZA.map(s => [s, 0]));
  for (const giorno of giorni) {
    if (giorno.stato in conteggio) conteggio[giorno.stato] += 1;
  }
  return conteggio;
}
