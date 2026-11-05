// Ingressi manuali (BTC non da fatture) e uscite BTC, persistiti in data/movimentiBtc.json
// (gitignored con backend/data/). I lotti da fatture non passano di qui: sono derivati a runtime
// da pagamenti[].btc (AI-Workspace/Plans/REGISTRO_LOTTI_BTC.md §4.1, §5).
import { randomUUID } from 'node:crypto';
import { readJson, writeJson } from '../lib/jsonStore.js';

const FILE = 'movimentiBtc.json';
const TIPI_INGRESSO = ['acquisto', 'ricevuto', 'mining'];
const TIPO_GIACENZA = 'saldo-iniziale';
const TIPI_USCITA = ['vendita', 'spesa', 'trasferimento'];
const FONTI_USCITA = ['manuale', 'import-polling', 'import-file'];

const vuoto = () => ({ ingressi: [], uscite: [], valoriMercato: {} });

export async function leggiMovimenti() {
  return { ...vuoto(), ...(await readJson(FILE, {})) };
}

function nuovoId(prefisso) {
  return `${prefisso}-${Date.now()}-${randomUUID().slice(0, 6)}`;
}

function errore(msg) {
  throw new Error(msg);
}

function validaComune(d, tipi) {
  if (!tipi.includes(d.tipo)) errore(`Tipo non valido: ${d.tipo}`);
  const dataOk = /^\d{4}-\d{2}-\d{2}$/.test(d.data ?? '') && !Number.isNaN(Date.parse(d.data))
    && new Date(d.data).toISOString().slice(0, 10) === d.data;
  if (!dataOk) errore('Data non valida (AAAA-MM-GG)');
  if (!Number.isInteger(d.satoshi) || d.satoshi <= 0) errore('Satoshi: intero > 0');
  if (d.txid != null && d.txid !== '' && !/^[0-9a-fA-F]{64}$/.test(d.txid)) errore('TXID: 64 caratteri esadecimali');
}

const numeroNonNegativo = (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0;

// Avviso (non blocco, domanda aperta n.5 del piano 🟡): un movimento di un anno già chiuso
// potrebbe alterare cifre già dichiarate nei quadri RT/RW.
function avvisiAnno(data) {
  const anno = Number(data.slice(0, 4));
  if (anno >= new Date().getFullYear()) return [];
  return [`Movimento del ${anno}: se la dichiarazione ${anno} è già compilata o l'imposta versata, plusvalenze e IVCA già dichiarate potrebbero cambiare.`];
}

function campiOpzionali(d, campi) {
  return Object.fromEntries(campi.filter((c) => d[c] != null && d[c] !== '').map((c) => [c, d[c]]));
}

export async function aggiungiIngresso(d) {
  validaComune(d, TIPI_INGRESSO);
  if (!numeroNonNegativo(d.costoEur)) errore('Costo EUR: numero >= 0');
  const ingresso = {
    id: nuovoId('IN-MAN'),
    tipo: d.tipo,
    data: d.data,
    satoshi: d.satoshi,
    costoEur: d.costoEur,
    ...campiOpzionali(d, ['txid', 'indirizzo', 'custodia', 'note']),
    fonte: 'manuale',
  };
  const mov = await leggiMovimenti();
  mov.ingressi.push(ingresso);
  await writeJson(FILE, mov);
  return { movimento: ingresso, avvisi: avvisiAnno(ingresso.data) };
}

// Giacenza dichiarata a mano (senza storico): un solo `saldo-iniziale` per wallet (`custodia`, senza
// distinzione di maiuscole; vuota = wallet non specificato). Se esiste già serve `modalita`:
// 'somma' (quantità e costo si sommano, vale la data più recente) o 'sovrascrivi'. Senza `modalita`
// restituisce `{ esistente }` e non scrive: la route risponde 409 e la UI chiede all'utente.
// Costo assente = 0 con `costoNonDocumentato`: le plusvalenze su questi BTC risultano piene.
const chiaveWallet = (c) => (c ?? '').trim().toLowerCase();

export async function dichiaraGiacenza(d, modalita) {
  validaComune({ ...d, tipo: TIPO_GIACENZA }, [TIPO_GIACENZA]);
  if (d.costoEur != null && d.costoEur !== '' && !numeroNonNegativo(d.costoEur)) errore('Costo EUR: numero >= 0');
  if (modalita != null && !['somma', 'sovrascrivi'].includes(modalita)) errore(`Modalità non valida: ${modalita}`);
  const mov = await leggiMovimenti();
  const esistente = mov.ingressi.find((i) => i.tipo === TIPO_GIACENZA && chiaveWallet(i.custodia) === chiaveWallet(d.custodia));
  if (esistente && !modalita) return { esistente };
  const somma = esistente && modalita === 'somma';
  const costoEur = (d.costoEur || 0) + (somma ? esistente.costoEur : 0);
  const nuovo = {
    id: esistente?.id ?? nuovoId('IN-MAN'),
    tipo: TIPO_GIACENZA,
    data: somma && esistente.data > d.data ? esistente.data : d.data,
    satoshi: d.satoshi + (somma ? esistente.satoshi : 0),
    costoEur,
    ...(costoEur === 0 ? { costoNonDocumentato: true } : {}),
    ...campiOpzionali(d, ['custodia', 'note']),
    fonte: 'manuale',
  };
  mov.ingressi = esistente ? mov.ingressi.map((i) => (i.id === esistente.id ? nuovo : i)) : [...mov.ingressi, nuovo];
  await writeJson(FILE, mov);
  const avvisi = avvisiAnno(nuovo.data);
  if (costoEur === 0) avvisi.push('Costo non documentato: vendendo questi BTC la plusvalenza risulta pari all\'intero ricavo.');
  return { movimento: nuovo, avvisi };
}

// Data della giacenza dichiarata più recente: le transazioni importate fino a quel giorno
// potrebbero essere già comprese nella giacenza.
export async function dataUltimaGiacenza() {
  const { ingressi } = await leggiMovimenti();
  return ingressi.filter((i) => i.tipo === TIPO_GIACENZA).map((i) => i.data).sort().pop() ?? null;
}

export function validaUscita(d) {
  validaComune(d, TIPI_USCITA);
  if (d.tipo === 'trasferimento') {
    if (d.ricavoEur != null && d.ricavoEur !== 0) errore('Un trasferimento non ha ricavo (ricavoEur = 0)');
  } else if (!(typeof d.ricavoEur === 'number' && d.ricavoEur > 0)) {
    errore('Ricavo EUR: numero > 0 per vendita/spesa');
  }
  if (d.feeSatoshi != null && !(Number.isInteger(d.feeSatoshi) && d.feeSatoshi >= 0)) errore('Fee: intero >= 0');
  if (d.cambioEurBtc != null && !(typeof d.cambioEurBtc === 'number' && d.cambioEurBtc > 0)) errore('Cambio: numero > 0');
  const fonte = d.fonte ?? 'manuale';
  if (!FONTI_USCITA.includes(fonte)) errore(`Fonte non valida: ${fonte}`);
  return fonte;
}

export async function aggiungiUscita(d) {
  const fonte = validaUscita(d);
  const uscita = {
    id: nuovoId('OUT'),
    tipo: d.tipo,
    data: d.data,
    satoshi: d.satoshi,
    ricavoEur: d.tipo === 'trasferimento' ? 0 : d.ricavoEur,
    ...campiOpzionali(d, ['feeSatoshi', 'cambioEurBtc', 'fonteCambio', 'custodia', 'txid', 'indirizzo', 'note']),
    fonte,
  };
  const mov = await leggiMovimenti();
  mov.uscite.push(uscita);
  await writeJson(FILE, mov);
  return { movimento: uscita, avvisi: avvisiAnno(uscita.data) };
}

async function elimina(lista, id) {
  const mov = await leggiMovimenti();
  const trovato = mov[lista].find((m) => m.id === id);
  if (!trovato) errore(`Movimento non trovato: ${id}`);
  mov[lista] = mov[lista].filter((m) => m.id !== id);
  await writeJson(FILE, mov);
  return { avvisi: avvisiAnno(trovato.data) };
}

export const eliminaIngresso = (id) => elimina('ingressi', id);
export const eliminaUscita = (id) => elimina('uscite', id);

// Prezzo EUR/BTC al 31/12, base dell'IVCA sui lotti ancora detenuti (inserito dall'utente, §4d).
export async function impostaValoreMercato(anno, prezzo) {
  if (!Number.isInteger(anno) || anno < 2000 || anno > 2100) errore('Anno non valido');
  if (!(typeof prezzo === 'number' && Number.isFinite(prezzo) && prezzo > 0)) errore('Valore EUR/BTC: numero > 0');
  const mov = await leggiMovimenti();
  mov.valoriMercato[anno] = prezzo;
  await writeJson(FILE, mov);
  return mov.valoriMercato;
}
