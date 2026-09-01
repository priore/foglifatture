// Riconoscimento data di incasso fatture da un CSV esportato dall'home banking. Ogni banca
// ha intestazioni colonna diverse: invece di un profilo per banca, si invia a Gemini SOLO
// l'elenco dei nomi colonna (mai righe/importi/causali reali) per farsi dire quali indici
// contengono data/importo/descrizione, poi il file viene parsato in locale col mapping
// ottenuto. Il mapping è salvato su disco per intestazione (vedi createHash su nomi colonna
// normalizzati): stesso export banca → stesso mapping riusato, Gemini richiamato solo se
// l'elenco colonne non è mai stato visto prima (vedi AI-Workspace/Plans/DATE_PAGAMENTO_FATTURE.md).
import { createHash } from 'node:crypto';
import { readJson, writeJson } from '../lib/jsonStore.js';
import { leggiGeminiApiKey, leggiGeminiModello } from './envService.js';
import { listMesiFatturati, getInvoice, saveInvoice } from './invoiceService.js';

const FILE_MAPPING = 'pagamentiMappingColonne.json';
const MODELLO_DEFAULT = 'gemini-2.0-flash';

function firmaIntestazioni(intestazioni) {
  const normalizzate = intestazioni.map((i) => String(i).trim().toLowerCase()).join('|');
  return createHash('sha256').update(normalizzate).digest('hex');
}

function rilevaSeparatore(primaRiga) {
  const candidati = ['\t', ';'];
  let migliore = ';';
  let maxConteggio = 0;
  for (const sep of candidati) {
    const conteggio = primaRiga.split(sep).length;
    if (conteggio > maxConteggio) {
      maxConteggio = conteggio;
      migliore = sep;
    }
  }
  return migliore;
}

function parseCsv(testo) {
  const righe = testo.split(/\r?\n/).filter((r) => r.trim() !== '');
  if (righe.length === 0) return [];
  const separatore = rilevaSeparatore(righe[0]);
  return righe.map((riga) => riga.split(separatore).map((cella) => cella.trim().replace(/^"|"$/g, '')));
}

async function chiediMappingAGemini(intestazioni) {
  const apiKey = await leggiGeminiApiKey();
  if (!apiKey) throw new Error('GEMINI_API_KEY non configurata (Impostazioni → Google → Gemini): necessaria per riconoscere automaticamente le colonne del file.');
  const modello = (await leggiGeminiModello()) || MODELLO_DEFAULT;

  const prompt = `Queste sono le intestazioni colonna di un file CSV esportato da un home banking italiano:
${JSON.stringify(intestazioni)}

Indica l'indice (0-based) della colonna data operazione, quella descrizione/causale, e quella
dell'importo dell'ACCREDITO (incasso, denaro ricevuto — mai un addebito/uscita).

Se l'importo è su un'UNICA colonna con segno (es. "Importo": +150,00 o -50,00), rispondi con
"colonnaImporto". Se invece il file ha colonne SEPARATE per entrate e uscite (es. "Entrate"/"Uscite",
"Dare"/"Avere", "Accrediti"/"Addebiti"), rispondi con "colonnaEntrate" = indice della colonna
entrate/accrediti, e NON includere "colonnaImporto".

Rispondi SOLO con un oggetto JSON valido (nessun testo, nessun markdown), uno di questi due formati:
{"colonnaData": 0, "colonnaImporto": 2, "colonnaDescrizione": 1}
{"colonnaData": 0, "colonnaEntrate": 3, "colonnaDescrizione": 4}`;

  const risposta = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modello}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    },
  );
  if (!risposta.ok) throw new Error(`Gemini API ha risposto ${risposta.status}: ${await risposta.text()}`);

  const dati = await risposta.json();
  const testo = dati.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
  const inizio = testo.indexOf('{');
  const fine = testo.lastIndexOf('}');
  if (inizio === -1 || fine === -1) throw new Error('Risposta Gemini senza oggetto JSON riconoscibile');
  const mapping = JSON.parse(testo.slice(inizio, fine + 1));
  const importoValido = Number.isInteger(mapping.colonnaImporto) || Number.isInteger(mapping.colonnaEntrate);
  if (!Number.isInteger(mapping.colonnaData) || !Number.isInteger(mapping.colonnaDescrizione) || !importoValido) {
    throw new Error('Mapping colonne restituito da Gemini incompleto');
  }
  return mapping;
}

// Riusa il mapping già salvato per la stessa intestazione; solo se mai vista chiama Gemini
// e salva il risultato per i prossimi import con lo stesso layout file.
export async function rilevaMappingColonne(intestazioni) {
  const firma = firmaIntestazioni(intestazioni);
  const salvati = await readJson(FILE_MAPPING, {});
  if (salvati[firma]) return salvati[firma];

  const mapping = await chiediMappingAGemini(intestazioni);
  salvati[firma] = mapping;
  await writeJson(FILE_MAPPING, salvati);
  return mapping;
}

function parseImporto(valore) {
  const pulito = String(valore).replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  return Number(pulito);
}

function parseData(valore) {
  const testo = String(valore).trim();
  const italiana = testo.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (italiana) return `${italiana[3]}-${italiana[2].padStart(2, '0')}-${italiana[1].padStart(2, '0')}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(testo)) return testo.slice(0, 10);
  return null;
}

// Estrae i movimenti (solo accrediti: importo positivo, un pagamento fattura è sempre
// un accredito sul conto) da un CSV con intestazione, usando il mapping colonne rilevato.
export function estraiMovimentiDaCsv(testoCsv, mapping) {
  const [, ...righe] = parseCsv(testoCsv);
  const movimenti = [];
  const indiceImporto = Number.isInteger(mapping.colonnaEntrate) ? mapping.colonnaEntrate : mapping.colonnaImporto;
  for (const cella of righe) {
    const descrizione = cella[mapping.colonnaDescrizione] || '';
    if (/^saldo\b/i.test(descrizione.trim())) continue;
    const data = parseData(cella[mapping.colonnaData]);
    const importo = parseImporto(cella[indiceImporto]);
    if (!data || !Number.isFinite(importo) || importo <= 0) continue;
    movimenti.push({ data, importo: Number(importo.toFixed(2)), descrizione });
  }
  return movimenti;
}

// Fatture emesse ancora senza data di pagamento registrata.
export async function fattureAperte() {
  const chiavi = await listMesiFatturati();
  const fatture = await Promise.all(chiavi.map((c) => getInvoice(c.anno, c.mese, c.clienteId)));
  return fatture.filter((f) => f && !f.dataPagamento);
}

// Abbina ogni movimento a una fattura aperta con lo stesso importo esatto (nettoAPagare).
// Ambiguità (più fatture stesso importo) o nessun match restano senza proposta: la conferma
// è sempre esplicita dell'utente, nessun abbinamento viene salvato automaticamente.
export async function proponiAbbinamenti(movimenti) {
  const aperte = await fattureAperte();
  return movimenti.map((m) => {
    const corrispondenti = aperte.filter((f) => f.nettoAPagare === m.importo);
    return {
      ...m,
      fattura: corrispondenti.length === 1
        ? { anno: corrispondenti[0].anno, mese: corrispondenti[0].mese, clienteId: corrispondenti[0].clienteId, numero: corrispondenti[0].numero }
        : null,
      ambiguo: corrispondenti.length > 1,
    };
  });
}

export async function confermaPagamento(anno, mese, clienteId, dataPagamento) {
  const fattura = await getInvoice(anno, mese, clienteId);
  if (!fattura) throw new Error('Fattura non trovata');
  fattura.dataPagamento = dataPagamento;
  await saveInvoice(anno, mese, clienteId, fattura);
  return fattura;
}
