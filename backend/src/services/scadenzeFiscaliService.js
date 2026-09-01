// Scadenze fiscali (imposta sostitutiva, INPS) del regime forfettario: nessuna fonte ufficiale
// espone un JSON di queste date, e cambiano da un anno all'altro con la legge di bilancio
// (proroghe, nuove scadenze). Si delega a Gemini con ricerca web, come già fa geminiAtecoService,
// invece di hardcodare date che il prossimo decreto fiscale può spostare. Cache su disco
// (scadenzeFiscali.json) riusata finché ha meno di 90 giorni: risparmia chiamate Gemini per ogni
// apertura della dashboard, mantenendo comunque le date aggiornate nel tempo.
import { readJson, writeJson } from '../lib/jsonStore.js';
import { leggiGeminiApiKey, leggiGeminiModello } from './envService.js';

const FILE = 'scadenzeFiscali.json';
const MODELLO_DEFAULT = 'gemini-2.0-flash';
const GIORNI_VALIDITA_CACHE = 90;

const PROMPT = `Elenca le scadenze fiscali ${new Date().getFullYear()} per un libero professionista italiano in
regime forfettario (persona fisica, partita IVA, no dipendenti): versamento imposta sostitutiva
(saldo e acconti) e contributi INPS gestione separata o artigiani/commercianti (acconti e saldo),
comprese eventuali proroghe già ufficialmente annunciate per l'anno corrente.

Rispondi SOLO con un array JSON valido (nessun testo, nessun markdown), dove ogni elemento è:
{"data": "YYYY-MM-DD", "tipo": "Saldo imposta sostitutiva", "descrizione": "..."}
Ordina l'array per data crescente.`;

function estraiArrayJson(testo) {
  const inizio = testo.indexOf('[');
  const fine = testo.lastIndexOf(']');
  if (inizio === -1 || fine === -1) throw new Error('Risposta Gemini senza array JSON riconoscibile');
  return JSON.parse(testo.slice(inizio, fine + 1));
}

function cacheValida(cache) {
  if (!cache?.aggiornatoIl || !Array.isArray(cache.scadenze)) return false;
  const giorni = (Date.now() - new Date(cache.aggiornatoIl).getTime()) / 86_400_000;
  return giorni < GIORNI_VALIDITA_CACHE;
}

async function interrogaGemini() {
  const apiKey = await leggiGeminiApiKey();
  if (!apiKey) throw new Error('GEMINI_API_KEY non configurata (Impostazioni → Google → Gemini)');
  const modello = (await leggiGeminiModello()) || MODELLO_DEFAULT;

  const risposta = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modello}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT }] }],
        tools: [{ google_search: {} }],
      }),
    },
  );
  if (!risposta.ok) {
    const testoErrore = await risposta.text();
    if (risposta.status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(testoErrore)) {
      throw new Error('Quota Gemini esaurita per oggi (free tier): riprova più tardi.');
    }
    throw new Error(`Gemini API ha risposto ${risposta.status}`);
  }

  const dati = await risposta.json();
  const testo = dati.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
  const scadenze = estraiArrayJson(testo);
  if (!Array.isArray(scadenze) || scadenze.length === 0) throw new Error('Elenco scadenze restituito da Gemini vuoto');
  return scadenze;
}

// Scadenze future (oggi incluso) note, aggiornando la cache se scaduta o assente.
// Se Gemini non è configurato o la chiamata fallisce, ricade sulla cache anche se scaduta
// (meglio date vecchie che nessuna scadenza mostrata in dashboard).
export async function prossimeScadenzeFiscali() {
  let cache = await readJson(FILE, null);
  if (!cacheValida(cache)) {
    try {
      const scadenze = await interrogaGemini();
      cache = { aggiornatoIl: new Date().toISOString(), scadenze };
      await writeJson(FILE, cache);
    } catch (err) {
      if (!cache) throw err;
    }
  }

  const oggi = new Date().toISOString().slice(0, 10);
  return {
    aggiornatoIl: cache.aggiornatoIl,
    scadenze: cache.scadenze.filter((s) => s.data >= oggi),
  };
}
