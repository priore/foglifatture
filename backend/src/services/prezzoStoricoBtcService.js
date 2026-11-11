// Prezzo di chiusura BTC/EUR del 31/12 di un anno (candela giornaliera UTC) sull'exchange di riferimento.
// Serve a precompilare il valore del Quadro RW: l'utente lo conferma o lo corregge a mano.
// Exchange senza API storica pubblica (es. onetrading): errore, il prezzo si inserisce dal sito dell'exchange.
const GIORNO = 86400000;

const FONTI = {
  binance: {
    nome: 'Binance',
    url: (t) => `https://api.binance.com/api/v3/klines?symbol=BTCEUR&interval=1d&startTime=${t}&limit=1`,
    chiusura: (corpo, t) => { const c = corpo?.[0]; return c && c[0] === t ? Number(c[4]) : NaN; },
  },
  kraken: {
    nome: 'Kraken',
    url: (t) => `https://api.kraken.com/0/public/OHLC?pair=XBTEUR&interval=1440&since=${Math.floor(t / 1000) - 1}`,
    chiusura: (corpo, t) => Number(Object.values(corpo?.result ?? {}).find(Array.isArray)?.find((c) => c[0] === t / 1000)?.[4]),
  },
  coinbase: {
    nome: 'Coinbase',
    url: (t) => { const d = new Date(t).toISOString(); return `https://api.exchange.coinbase.com/products/BTC-EUR/candles?granularity=86400&start=${d}&end=${d}`; },
    chiusura: (corpo, t) => Number(Array.isArray(corpo) ? corpo.find((c) => c[0] === t / 1000)?.[4] : NaN), // [time, low, high, open, close, volume]
  },
};

export const exchangeSupportati = () => Object.keys(FONTI);

export async function prezzoChiusura3112(anno, exchange = 'binance', fetchFn = fetch) {
  if (!Number.isInteger(anno) || anno < 2017) throw new Error('Anno non valido');
  const fonte = FONTI[exchange];
  if (!fonte) throw new Error(`Prezzo automatico non disponibile per «${exchange}»: inseriscilo dal sito dell'exchange`);
  const inizio = Date.UTC(anno, 11, 31);
  if (Date.now() < inizio + GIORNO) throw new Error(`Il prezzo al 31/12/${anno} non esiste ancora`);
  const r = await fetchFn(fonte.url(inizio));
  if (!r.ok) throw new Error(`${fonte.nome} non raggiungibile (${r.status})`);
  const chiusura = fonte.chiusura(await r.json(), inizio);
  if (!(chiusura > 0)) throw new Error(`Prezzo al 31/12/${anno} non disponibile su ${fonte.nome}`);
  return { prezzoEurBtc: chiusura, fonte: `${fonte.nome}, chiusura UTC 31/12/${anno}` };
}
