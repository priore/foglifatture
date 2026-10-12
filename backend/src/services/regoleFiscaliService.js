// Regole fiscali versionate per anno (aliquote, soglie, scadenze, codici tributo).
// Ogni anno ha un pacchetto versionato in src/data/regole/<anno>.json (dati pubblici, in git).
// L'utente "attiva" un pacchetto copiandolo in data/regole-attive/<anno>.json (dati utente,
// escluso da git). finché non ne attiva uno, si usa l'ultimo anno disponibile con banner.
import { readJson, writeJson } from '../lib/jsonStore.js';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const REGOLE_SRC = path.join(import.meta.dirname, '..', 'data', 'regole');

// Legge il pacchetto versionato per anno da src/data/regole/<anno>.json.
// Esportata per monitoraggioFontiService (ricerca campi che citano una fonte).
export async function leggiPacchettoVersionato(anno) {
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
// Include anche le proposte da monitoraggioFontiService (regole-proposte/<anno>.json).
// Restituisce array di { campo, vecchio, nuovo, origine } dove origine è 'versionato' o 'proposta'.
export async function differenze(anno) {
  const disponibile = await leggiPacchettoVersionato(anno);
  if (!disponibile) return [];
  const attivo = await readJson(`regole-attive/${anno}.json`);
  if (!attivo) {
    return [{ campo: 'stato', vecchio: null, nuovo: 'non confermato', messaggio: `Pacchetto ${anno} disponibile, non ancora confermato`, origine: 'versionato' }];
  }
  const diff = confrontaOggetti('', attivo, disponibile).map(d => ({ ...d, origine: 'versionato' }));

  // Aggiunge le proposte del monitoraggio fonti che divergono dall'attivo
  const proposte = await readJson(`regole-proposte/${anno}.json`) ?? {};
  for (const [campo, p] of Object.entries(proposte)) {
    const parti = campo.split('.');
    let valoreAttivo = attivo;
    for (const parte of parti) valoreAttivo = valoreAttivo?.[parte];
    if (JSON.stringify(valoreAttivo) !== JSON.stringify(p.valoreProposto)) {
      diff.push({ campo, vecchio: valoreAttivo, nuovo: p.valoreProposto, citazione: p.citazione, idFonte: p.idFonte, origine: 'proposta' });
    }
  }
  return diff;
}

function confrontaOggetti(prefisso, vecchio, nuovo) {
  const diff = [];
  const chiavi = new Set([...Object.keys(vecchio ?? {}), ...Object.keys(nuovo ?? {})]);
  for (const k of chiavi) {
    if (k === 'fonti' || k === 'confermatoIl') continue;
    const percorso = prefisso ? `${prefisso}.${k}` : k;
    const v = vecchio?.[k], n = nuovo?.[k];
    const vObj = typeof v === 'object' && v !== null && !Array.isArray(v);
    const nObj = typeof n === 'object' && n !== null && !Array.isArray(n);
    if (vObj || nObj) {
      diff.push(...confrontaOggetti(percorso, v ?? {}, n ?? {}));
    } else if (JSON.stringify(v) !== JSON.stringify(n)) {
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

// Applica le proposte AI all'attivo per anno, campo per campo.
// Ogni proposta è un override puntuale — non sovrascrive l'intero pacchetto.
export async function confermaProposte(anno) {
  const proposte = await readJson(`regole-proposte/${anno}.json`);
  if (!proposte || !Object.keys(proposte).length) return { applicate: 0 };
  const attivo = await readJson(`regole-attive/${anno}.json`);
  if (!attivo) throw new Error(`Regole ${anno} non ancora confermate — conferma prima il pacchetto`);

  let applicate = 0;
  for (const [campo, p] of Object.entries(proposte)) {
    const parti = campo.split('.');
    let nodo = attivo;
    for (let i = 0; i < parti.length - 1; i++) {
      if (!nodo[parti[i]] || typeof nodo[parti[i]] !== 'object') break;
      nodo = nodo[parti[i]];
    }
    const ultima = parti[parti.length - 1];
    if (ultima in nodo) {
      nodo[ultima] = p.valoreProposto;
      applicate++;
    }
  }

  await writeJson(`regole-attive/${anno}.json`, { ...attivo, confermatoIl: new Date().toISOString() });
  await writeJson(`regole-proposte/${anno}.json`, {}); // svuota dopo conferma
  return { applicate };
}

// Scarta tutte le proposte AI per anno senza applicarle.
export async function scartaProposte(anno) {
  const proposte = await readJson(`regole-proposte/${anno}.json`) ?? {};
  const scartate = Object.keys(proposte).length;
  await writeJson(`regole-proposte/${anno}.json`, {});
  return { scartate };
}

// Spiega i requisiti per l'aliquota ridotta del 5% (L. 190/2014 c. 65) con citazione dal testo archiviato.
// Dato inviato all'AI: solo testo di legge pubblico — nessun dato fiscale personale.
export async function spiegaRequisitiAliquotaRidotta() {
  const { chiamaAI } = await import('./aiRouterService.js');
  const prompt = `Sei un consulente fiscale italiano. Spiega in modo semplice e chiaro (massimo 5 punti, un punto per requisito) i requisiti per accedere all'aliquota agevolata del 5% nel regime forfettario, previsti dalla Legge 190/2014 art. 1 comma 65:
1. Nessuna attività d'impresa, artistica o professionale esercitata nei tre anni precedenti l'inizio (anche in forma associata o familiare).
2. L'attività non costituisce mera prosecuzione di altra attività precedentemente svolta come lavoro dipendente o autonomo (salvo obbligo di pratica professionale).
3. Se si prosegue un'attività d'impresa di un'altra persona, i ricavi di quell'impresa non devono aver superato 85.000 euro nell'anno precedente.

Spiega ogni punto in italiano semplice, senza tecnicismi, indicando le conseguenze pratiche (es. "se hai lavorato come dipendente nel settore simile, controlla con il commercialista"). Termina con una nota: "In caso di dubbio, consulta un commercialista prima di spuntare l'opzione."`;
  const { testo } = await chiamaAI(prompt);
  if (!testo) throw new Error('Risposta AI non valida');
  return { spiegazione: testo };
}

// Spiega se le prestazioni rientrano nell'art. 7-septies DPR 633/72 per clienti privati extra-UE.
// Dato inviato all'AI: solo testo di legge pubblico + descrizione attività dall'utente (non dato fiscale).
export async function spiegaSepties(descrizioneAttivita) {
  const { chiamaAI } = await import('./aiRouterService.js');
  const descr = descrizioneAttivita?.trim()
    ? `Il tipo di attività svolta è: "${descrizioneAttivita.trim()}".`
    : 'Il tipo di attività svolta non è stato specificato.';
  const prompt = `Sei un consulente fiscale italiano specializzato in IVA internazionale.
${descr}
L'art. 7-septies del DPR 633/72 elenca prestazioni specifiche verso privati extra-UE che non sono soggette a IVA italiana (operazione non soggetta, Natura N2.1): consulenza e assistenza tecnica o legale, elaborazione e fornitura di dati, operazioni bancarie finanziarie e assicurative, messa a disposizione di personale, locazione di beni mobili (eccetto mezzi di trasporto), concessione di accesso a sistemi di distribuzione di gas/energia, pubblicità, telecomunicazioni, radiodiffusione, servizi di telecomunicazione, servizi prestati per via elettronica.
Spiega in italiano semplice (massimo 4 righe):
1. Se il tipo di attività descritto rientra o meno in questo elenco.
2. Cosa comporta praticamente per la fatturazione a privati extra-UE.
3. In caso di dubbio, suggerisci di consultare un commercialista.
Rispondi senza tecnicismi e in modo diretto.`;
  const { testo } = await chiamaAI(prompt);
  if (!testo) throw new Error('Risposta AI non valida');
  return { spiegazione: testo };
}

// Spiega le differenze usando il router AI (Gemini → agy → gh copilot → Claude → Groq → locale).
export async function spiegaDiff(anno) {
  const diff = await differenze(anno);
  const scalari = diff.filter(d => d.campo !== 'stato' && d.nuovo !== undefined);
  if (!scalari.length) throw new Error('Nessuna differenza da spiegare');

  const { chiamaAI } = await import('./aiRouterService.js');
  const righe = scalari.map(d => `- ${d.campo}: ${d.vecchio ?? '—'} → ${d.nuovo}`).join('\n');
  const prompt = `Sei un consulente fiscale italiano. Spiega in modo semplice e conciso (massimo 3 righe per punto) le seguenti variazioni nelle regole fiscali per il regime forfettario ${anno}:\n${righe}\n\nRispondi in italiano, con elenco puntato, senza tecnicismi inutili.`;

  const { testo } = await chiamaAI(prompt);
  if (!testo) throw new Error('Risposta AI non valida');
  return { spiegazione: testo };
}

// Stato sintetico per il banner in dashboard e per il monitoraggio.
// { aggiornamentoDisponibile, annoDisponibile, annoAttivo, fonteCambiate, proposte }
export async function statoRegole() {
  const ultimoDisp = await ultimoAnnoDisponibile();
  if (!ultimoDisp) return { aggiornamentoDisponibile: false, annoDisponibile: null, annoAttivo: null, fonteCambiate: 0, proposte: 0 };
  const attivo = await readJson(`regole-attive/${ultimoDisp}.json`);
  const cambiate = await readJson('fonti-cambiate.json') ?? {};
  const proposte = await readJson(`regole-proposte/${ultimoDisp}.json`) ?? {};
  return {
    aggiornamentoDisponibile: !attivo,
    annoDisponibile: ultimoDisp,
    annoAttivo: attivo?.anno ?? null,
    fonteCambiate: Object.keys(cambiate).length,
    proposte: Object.keys(proposte).length,
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
