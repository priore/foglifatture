// Dati dei grafici della dashboard ricavati da risposte API: funzioni pure, riusabili dalle viste compatte.
import { MESI_BREVI, formattaEuro } from './useFormati.js';

export function quotaIncasso(importo, quotaPct) {
  return quotaPct == null ? 0 : (Number(importo) || 0) * quotaPct / 100;
}

export function barrePianoCassa(piano = []) {
  return piano.map((p) => ({
    etichetta: `${MESI_BREVI[Number(p.data.slice(5, 7)) - 1]} ${p.data.slice(0, 4)}`,
    colore: p.scoperto ? 'var(--warn)' : 'var(--ok)',
    valore: Math.abs(p.residuo),
    valoreTesto: `${p.scoperto ? 'scoperto ' : 'resta '}${formattaEuro(Math.abs(p.residuo))}`,
  }));
}

export function barreRicaviMensili(ricaviMensili = []) {
  return ricaviMensili.map((m) => ({ etichetta: MESI_BREVI[m.mese - 1], valore: m.ricavi, valoreTesto: formattaEuro(m.ricavi) }));
}

export function fetteComposizione({ ricaviCumulati, redditoImponibile, impostaStimata }) {
  return [
    { etichetta: 'Ricavi/compensi', valore: ricaviCumulati, colore: 'var(--ok)', valoreTesto: formattaEuro(ricaviCumulati) },
    { etichetta: 'Reddito fiscale', valore: redditoImponibile, colore: 'var(--accent)', valoreTesto: formattaEuro(redditoImponibile) },
    { etichetta: 'Imposta stimata', valore: impostaStimata, colore: 'var(--warn)', valoreTesto: formattaEuro(impostaStimata) },
  ];
}

// Quota già raggiunta vs margine alla soglia; `etichetta` distingue emesso ("Ricavi cumulati") da incassato ("Incassato").
export function fetteSoglia(sogliaAnnua, ricaviCumulati, superamentoSoglia, etichetta) {
  const margineResiduo = Math.max(sogliaAnnua - ricaviCumulati, 0);
  return [
    { etichetta, valore: ricaviCumulati, colore: superamentoSoglia ? 'var(--warn)' : 'var(--accent)', valoreTesto: formattaEuro(ricaviCumulati) },
    { etichetta: 'Margine alla soglia', valore: margineResiduo, colore: 'var(--line)', valoreTesto: formattaEuro(margineResiduo) },
  ];
}

// CoinGecko dà ~720 punti orari su 30 giorni: ne resta uno al giorno (l'ultimo rilevato).
export function storicoGiornaliero(prices = []) {
  // Giorno e etichetta in ora locale: raggruppare per data UTC sfasava di un giorno vicino alla mezzanotte.
  const perGiorno = new Map();
  for (const [ts, valore] of prices) {
    const d = new Date(ts);
    perGiorno.set(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`, { d, valore });
  }
  return [...perGiorno.values()].map(({ d, valore }) => ({
    etichetta: d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }),
    valore,
    valoreTesto: formattaEuro(valore),
  }));
}
