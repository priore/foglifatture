// Regole fiscali versionate per anno (aliquote, soglie, scadenze, codici tributo).
// Ogni anno ha un pacchetto versionato in src/data/regole/<anno>.json (dati pubblici, in git).
// L'utente "attiva" un pacchetto copiandolo in data/regole-attive/<anno>.json (dati utente,
// escluso da git). finché non ne attiva uno, si usa l'ultimo anno disponibile con banner.
import { readJson, writeJson } from '../lib/jsonStore.js';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const REGOLE_SRC = path.join(import.meta.dirname, '..', 'data', 'regole');

// Legge il pacchetto versionato per anno da src/data/regole/<anno>.json.
async function leggiPacchettoVersionato(anno) {
  const file = path.join(REGOLE_SRC, `${anno}.json`);
  try {
    const raw = await readFile(file, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

// Anno più alto disponibile in src/data/regole/.
async function ultimoAnnoDisponibile() {
  const { readdir } = await import('node:fs/promises');
  try {
    const files = await readdir(REGOLE_SRC);
    const anni = files
      .filter(f => /^\d{4}\.json$/.test(f))
      .map(f => parseInt(f, 10))
      .sort((a, b) => b - a);
    return anni[0] ?? null;
  } catch {
    return null;
  }
}

// Valida che le chiavi obbligatorie siano presenti nel pacchetto.
const CHIAVI_OBBLIGATORIE = ['anno', 'forfettario', 'acconti', 'scadenze', 'rate', 'inpsGestioneSeparata', 'bollo', 'codiciTributo', 'causaliInps'];

function validaPacchetto(pacchetto) {
  const mancanti = CHIAVI_OBBLIGATORIE.filter(k => !(k in pacchetto));
  if (mancanti.length) throw new Error(`Pacchetto regole non valido: mancano ${mancanti.join(', ')}`);
}

// Restituisce le regole attive per anno.
// Se non confermate: usa l'ultimo anno ≤ anno con aggiornate:false + banner.
export async function regoleAnno(anno) {
  const attive = await readJson(`regole-attive/${anno}.json`);
  if (attive) return { ...attive, aggiornate: true, banner: null };

  // Fallback: ultimo anno confermato ≤ anno
  const ultimoConf = await ultimoAnnoConfermatoPerAnno(anno);
  if (ultimoConf) {
    return {
      ...ultimoConf,
      aggiornate: false,
      banner: `Regole fiscali ${anno} non ancora confermate. Si usano quelle del ${ultimoConf.anno}. Vai in Impostazioni → Regole fiscali per confermare.`,
    };
  }

  // Nessuna conferma esistente: usa il pacchetto versionato direttamente con banner
  const disponibile = await leggiPacchettoVersionato(anno) ?? await leggiPacchettoVersionato(await ultimoAnnoDisponibile());
  if (!disponibile) throw new Error('Nessun pacchetto regole disponibile');
  return {
    ...disponibile,
    aggiornate: false,
    banner: `Regole fiscali non ancora confermate. Vai in Impostazioni → Regole fiscali per confermare le regole dell'anno ${disponibile.anno}.`,
  };
}

async function ultimoAnnoConfermatoPerAnno(anno) {
  // Cerca in data/regole-attive/ l'anno più alto ≤ anno
  const { readdir } = await import('node:fs/promises');
  const { DATA_DIR } = await import('../lib/jsonStore.js');
  const dir = path.join(DATA_DIR, 'regole-attive');
  try {
    const files = await readdir(dir);
    const anni = files
      .filter(f => /^\d{4}\.json$/.test(f))
      .map(f => parseInt(f, 10))
      .filter(a => a <= anno)
      .sort((a, b) => b - a);
    if (!anni.length) return null;
    return await readJson(`regole-attive/${anni[0]}.json`);
  } catch {
    return null;
  }
}

// Confronta il pacchetto disponibile (versionato o proposto) con quello attivo.
// Restituisce array di { campo, vecchio, nuovo, fonteVecchia, fonteNuova }.
export async function differenze(anno) {
  const disponibile = await leggiPacchettoVersionato(anno);
  if (!disponibile) return [];
  const attivo = await readJson(`regole-attive/${anno}.json`);
  if (!attivo) {
    return [{ campo: 'stato', vecchio: null, nuovo: 'non confermato', messaggio: `Pacchetto ${anno} disponibile, non ancora confermato` }];
  }
  return confrontaOggetti('', attivo, disponibile);
}

function confrontaOggetti(prefisso, vecchio, nuovo) {
  const diff = [];
  const chiavi = new Set([...Object.keys(vecchio ?? {}), ...Object.keys(nuovo ?? {})]);
  for (const k of chiavi) {
    if (k === 'fonti' || k === 'confermatoIl') continue;
    const percorso = prefisso ? `${prefisso}.${k}` : k;
    const v = vecchio?.[k], n = nuovo?.[k];
    if (typeof v === 'object' && v !== null && typeof n === 'object' && n !== null) {
      diff.push(...confrontaOggetti(percorso, v, n));
    } else if (v !== n) {
      diff.push({ campo: percorso, vecchio: v, nuovo: n });
    }
  }
  return diff;
}

// Attiva il pacchetto versionato per anno (copia in data/regole-attive/<anno>.json).
export async function conferma(anno) {
  const disponibile = await leggiPacchettoVersionato(anno);
  if (!disponibile) throw new Error(`Pacchetto regole ${anno} non disponibile`);
  validaPacchetto(disponibile);
  await writeJson(`regole-attive/${anno}.json`, { ...disponibile, confermatoIl: new Date().toISOString() });
  return disponibile;
}

// Spiega le differenze usando Gemini (fallback Groq/Claude come scadenzeFiscaliService).
export async function spiegaDiff(anno) {
  const diff = await differenze(anno);
  const scalari = diff.filter(d => d.campo !== 'stato' && d.nuovo !== undefined);
  if (!scalari.length) throw new Error('Nessuna differenza da spiegare');

  const { leggiGeminiApiKey, leggiGeminiModello } = await import('./envService.js');
  const apiKey = await leggiGeminiApiKey();
  if (!apiKey) throw new Error('GEMINI_API_KEY non configurata (Impostazioni → AI)');
  const modello = (await leggiGeminiModello()) || 'gemini-2.0-flash';

  const righe = scalari.map(d => `- ${d.campo}: ${d.vecchio ?? '—'} → ${d.nuovo}`).join('\n');
  const prompt = `Sei un consulente fiscale italiano. Spiega in modo semplice e conciso (massimo 3 righe per punto) le seguenti variazioni nelle regole fiscali per il regime forfettario ${anno}:\n${righe}\n\nRispondi in italiano, con elenco puntato, senza tecnicismi inutili.`;

  const risposta = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modello}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );
  if (!risposta.ok) throw new Error(`Gemini error ${risposta.status}`);
  const dati = await risposta.json();
  const testo = dati?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!testo) throw new Error('Risposta AI non valida');
  return { spiegazione: testo };
}

// Stato sintetico per il banner in dashboard.
// { aggiornamentoDisponibile: bool, annoDisponibile, annoAttivo }
export async function statoRegole() {
  const ultimoDisp = await ultimoAnnoDisponibile();
  if (!ultimoDisp) return { aggiornamentoDisponibile: false, annoDisponibile: null, annoAttivo: null };
  const attivo = await readJson(`regole-attive/${ultimoDisp}.json`);
  return {
    aggiornamentoDisponibile: !attivo,
    annoDisponibile: ultimoDisp,
    annoAttivo: attivo?.anno ?? null,
  };
}

// Tutti gli anni con pacchetto versionato e stato conferma.
export async function elencoAnni() {
  const { readdir } = await import('node:fs/promises');
  let files = [];
  try { files = await readdir(REGOLE_SRC); } catch { return []; }
  const anni = files.filter(f => /^\d{4}\.json$/.test(f)).map(f => parseInt(f, 10)).sort((a, b) => b - a);
  return Promise.all(anni.map(async (anno) => {
    const attivo = await readJson(`regole-attive/${anno}.json`);
    return { anno, confermato: !!attivo, confermatoIl: attivo?.confermatoIl ?? null };
  }));
}
