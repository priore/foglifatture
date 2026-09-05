// Appiattisce i dati di dominio (fattura/timesheet) nel formato piatto e già formattato
// che i template Handlebars si aspettano (niente logica dentro layout.html).
import { STATI_ASSENZA, calcolaOreGiorno, calcolaTotaleMensile } from './useTimeCalculator.js';

function formattaEuro(numero) {
  return numero.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formattaData(isoDate) {
  const [anno, mese, giorno] = isoDate.split('-');
  return `${giorno}/${mese}/${anno}`;
}

export function preparaDatiFattura(props) {
  return {
    ...props,
    dataFormattata: formattaData(props.data),
    imponibileFormattato: formattaEuro(props.imponibile),
    nettoAPagareFormattato: formattaEuro(props.nettoAPagare),
  };
}

const NOMI_MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

function isWeekend(nomeGiorno) {
  return nomeGiorno === 'Sabato' || nomeGiorno === 'Domenica';
}

function formattaOre(oreDecimali) {
  return oreDecimali.toFixed(2).replace('.', ',');
}

export function preparaDatiTimesheet(props) {
  const totaleOre = calcolaTotaleMensile(props.giorni);
  const giorniLavorati = props.giorni.filter((g) => calcolaOreGiorno(g) > 0).length;

  const conteggio = Object.fromEntries(STATI_ASSENZA.map((s) => [s, 0]));
  for (const g of props.giorni) if (g.stato in conteggio) conteggio[g.stato] += 1;
  const totaleAssenze = Object.values(conteggio).reduce((s, n) => s + n, 0);

  return {
    ...props,
    nomeMese: NOMI_MESI[props.mese - 1],
    giorni: props.giorni.map((g) => ({
      ...g,
      wknd: isWeekend(g.nomeGiorno),
      oreGiornoFormattate: calcolaOreGiorno(g) > 0 ? formattaOre(calcolaOreGiorno(g)) : '',
      assenzaVisibile: Boolean(g.stato) && !isWeekend(g.nomeGiorno),
    })),
    totaleOreFormattato: formattaOre(totaleOre),
    giorniLavorati,
    totaleAssenze,
    conteggioAssenze: STATI_ASSENZA.filter((s) => s !== 'Lavoro').map((stato) => ({ stato, conteggio: conteggio[stato] })),
  };
}
