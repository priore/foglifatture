// Aggiorna backend/src/data/atecoSettori.json chiedendo a Gemini di ricavare l'elenco
// completo dei codici ATECO 2025 (sotto-codici inclusi) con relativo coefficiente di
// redditività forfettario, associando ogni sotto-codice al coefficiente del suo gruppo
// ATECO2007 (Allegato 4 L.190/2014) tramite la tavola di raccordo ISTAT ATECO2007→2025.
// Nessuna fonte ufficiale pubblica questi dati già uniti in JSON/CSV: entrambe le fonti
// (PDF Agenzia Entrate, xlsx ISTAT) sono documenti statici, per questo si delega il
// recupero+incrocio a Gemini invece di scrivere un parser PDF/xlsx dedicato.
import { writeFile, copyFile } from 'node:fs/promises';
import { leggiGeminiApiKey } from './envService.js';

const PERCORSO_ATECO = new URL('../data/atecoSettori.json', import.meta.url);
const MODELLO = 'gemini-2.0-flash';

const PROMPT = `Genera l'elenco completo e aggiornato dei codici ATECO 2025 (inclusi tutti i sotto-codici,
es. 62.20.10, non solo i codici a 4 cifre) con il relativo coefficiente di redditività del regime
forfettario italiano.

Fonti da usare:
1. Tabella ATECO con coefficienti di redditività, Allegato 4 Legge 190/2014, pubblicata da Agenzia
   delle Entrate: https://www.agenziaentrate.gov.it/portale/documents/20143/241180/nuovo+regime+forfetario+TabellaAteco_Nuovo+regime+forfetario_Tabella+Ateco+con+soglie+di+ricavi+e+percentuale+di+redditivit%C3%A0.pdf
2. Tavola di raccordo ATECO 2007/2022 → ATECO 2025 pubblicata da ISTAT: https://www.istat.it/classificazione/documenti-ateco/

Per ogni sotto-codice ATECO 2025, trova il gruppo ATECO 2007 corrispondente tramite la tavola di
raccordo ISTAT e applica il coefficiente di redditività di quel gruppo (fonte 1).

Rispondi SOLO con un array JSON valido (nessun testo, nessun markdown), dove ogni elemento è:
{"codice": "62.20.10", "descrizione": "...", "settore": "...", "coefficente": 67}
"coefficente" è un numero intero (percentuale, es. 67 non 0.67). "settore" è il nome del gruppo di
attività della tabella Agenzia Entrate (es. "Attività professionali, scientifiche, tecniche...").`;

// Estrae il primo array JSON presente nel testo, tollerando eventuali code fence residui.
function estraiArrayJson(testo) {
  const inizio = testo.indexOf('[');
  const fine = testo.lastIndexOf(']');
  if (inizio === -1 || fine === -1) throw new Error('Risposta Gemini senza array JSON riconoscibile');
  return JSON.parse(testo.slice(inizio, fine + 1));
}

export async function aggiornaAtecoSettoriDaGemini() {
  const apiKey = await leggiGeminiApiKey();
  if (!apiKey) throw new Error('GEMINI_API_KEY non configurata (Impostazioni → Google → Gemini)');

  const risposta = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODELLO}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT }] }],
        tools: [{ google_search: {} }],
      }),
    },
  );
  if (!risposta.ok) throw new Error(`Gemini API ha risposto ${risposta.status}: ${await risposta.text()}`);

  const dati = await risposta.json();
  const testo = dati.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
  const elenco = estraiArrayJson(testo);
  if (!Array.isArray(elenco) || elenco.length === 0) throw new Error('Elenco ATECO restituito da Gemini vuoto');

  await copyFile(PERCORSO_ATECO, `${PERCORSO_ATECO.pathname}.bak`).catch(() => {});
  await writeFile(PERCORSO_ATECO, JSON.stringify(elenco, null, 2), 'utf-8');
  return elenco.length;
}
