// Calcolo ore lato client, speculare a backend/src/services/timeCalculator.js.
// Serve per aggiornare la UI istantaneamente mentre l'utente digita, senza
// dover attendere una chiamata al server ad ogni singola modifica.
// Lo stato è solo un'etichetta/motivo del giorno: il calcolo si basa sempre sugli orari inseriti.
export const STATI_ASSENZA = ['Malattia', 'Ferie', 'Festività', 'Recupero', 'Sciopero', 'Altro'];

function toMinuti(orario) {
  if (!orario) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(orario.trim());
  if (!match) return null;
  const ore = Number(match[1]);
  const minuti = Number(match[2]);
  if (ore < 0 || ore > 23 || minuti < 0 || minuti > 59) return null;
  return ore * 60 + minuti;
}

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

export function calcolaTotaleMensile(giorni) {
  return giorni.reduce((totale, giorno) => totale + calcolaOreGiorno(giorno), 0);
}

export function decimaleAHHmm(oreDecimali) {
  const minutiTotali = Math.round(oreDecimali * 60);
  const ore = Math.floor(minutiTotali / 60);
  const minuti = minutiTotali % 60;
  return `${String(ore).padStart(2, '0')}:${String(minuti).padStart(2, '0')}`;
}
