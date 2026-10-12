// Cambio ufficiale Banca d'Italia per valute tradizionali.
// Convenzione: quantità di valuta per 1 euro (es. USD 1,08 = 1 € = 1,08 $).
// Cache su disco in backend/data/cambi/<data>.json — già escluso da git.
// Ripiego fino a 7 giorni indietro (weekend/festivi senza quotazione).
import { readJson, writeJson } from '../lib/jsonStore.js';

const BI_URL = 'https://tassidicambio.bancaditalia.it/terzevalute-wf-web/rest/v1.0/dailyRates';
const MAX_GIORNI_INDIETRO = 7;

function aggiungiGiorni(dataIso, delta) {
  const d = new Date(`${dataIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

// Restituisce { cambio, data, fonte } per la valuta richiesta alla data indicata.
// Ripiego automatico ai giorni precedenti se non c'è quotazione (weekend/festivi).
// Lancia errore se non trova nulla in MAX_GIORNI_INDIETRO giorni o se senza rete.
// deps è usato solo nei test per iniettare fetch/cache finti.
export async function cambioPer(codiceIso, dataIso, deps = {}) {
  if (!dataIso || !/^\d{4}-\d{2}-\d{2}$/.test(dataIso)) throw new Error('Data non valida');
  const codice = codiceIso.toUpperCase();
  if (codice === 'EUR') return { cambio: 1, data: dataIso, fonte: 'EUR base' };

  const fetchFn = deps.fetch ?? ((...a) => fetch(...a));
  const readFn = deps.readJson ?? readJson;
  const writeFn = deps.writeJson ?? writeJson;

  async function fetchBIDeps(data) {
    // currencyIsoCode=EUR = EUR come valuta base → restituisce "quantità di valuta estera per 1 euro"
    const url = `${BI_URL}?referenceDate=${data}&currencyIsoCode=EUR&lang=it`;
    const risposta = await fetchFn(url, { signal: AbortSignal.timeout(10000), headers: { Accept: 'application/json' } });
    if (!risposta.ok) throw new Error(`Banca d\'Italia ha risposto ${risposta.status}`);
    const dati = await risposta.json();
    return dati.rates ?? dati.dailyRates ?? [];
  }

  for (let delta = 0; delta <= MAX_GIORNI_INDIETRO; delta++) {
    const data = aggiungiGiorni(dataIso, -delta);
    const chiaveCache = `cambi/${data}`;
    let rates = await readFn(chiaveCache, null);

    if (!rates) {
      try {
        rates = await fetchBIDeps(data);
        if (rates.length) await writeFn(chiaveCache, rates);
      } catch (err) {
        if (delta === 0) throw new Error(`Banca d\'Italia non raggiungibile: ${err.message}. Inserisci il cambio a mano.`);
        continue;
      }
    }

    const riga = rates.find(
      (r) => (r.isoCode ?? r.currencyIsoCode ?? '').toUpperCase() === codice
        && r.exchangeConventionCode === 'C', // convenzione "quantità di valuta per 1 euro"
    );
    if (riga) {
      const cambio = Number(riga.avgRate ?? riga.averageRate ?? riga.rate);
      if (!Number.isFinite(cambio) || cambio <= 0) continue;
      return { cambio, data, fonte: 'Banca d\'Italia' };
    }
  }

  throw new Error(`Nessuna quotazione disponibile per ${codice} nei ${MAX_GIORNI_INDIETRO} giorni precedenti. Inserisci il cambio a mano.`);
}

// Lista delle valute supportate (hardcoded, specifica FatturaPA + più comuni).
export function valuteSupportate() {
  return [
    { codice: 'USD', nome: 'Dollaro USA' },
    { codice: 'GBP', nome: 'Sterlina britannica' },
    { codice: 'CHF', nome: 'Franco svizzero' },
    { codice: 'JPY', nome: 'Yen giapponese' },
    { codice: 'CAD', nome: 'Dollaro canadese' },
    { codice: 'AUD', nome: 'Dollaro australiano' },
    { codice: 'SEK', nome: 'Corona svedese' },
    { codice: 'NOK', nome: 'Corona norvegese' },
    { codice: 'DKK', nome: 'Corona danese' },
    { codice: 'PLN', nome: 'Zloty polacco' },
    { codice: 'CZK', nome: 'Corona ceca' },
    { codice: 'HUF', nome: 'Fiorino ungherese' },
    { codice: 'RON', nome: 'Leu romeno' },
    { codice: 'TRY', nome: 'Lira turca' },
    { codice: 'CNY', nome: 'Renminbi cinese' },
    { codice: 'SGD', nome: 'Dollaro di Singapore' },
    { codice: 'HKD', nome: 'Dollaro di Hong Kong' },
    { codice: 'NZD', nome: 'Dollaro neozelandese' },
  ];
}
