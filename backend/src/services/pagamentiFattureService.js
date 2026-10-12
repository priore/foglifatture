// Riconoscimento data di incasso fatture da un CSV esportato dall'home banking. Ogni banca
// ha intestazioni colonna diverse: invece di un profilo per banca, si invia a Gemini (con
// fallback automatico in cascata su Claude poi Groq se la quota Gemini è esaurita) SOLO
// l'elenco dei nomi colonna (mai righe/importi/causali reali) per farsi dire quali indici
// contengono data/importo/descrizione, poi il file viene parsato in locale col mapping ottenuto.
// Il mapping è salvato su disco per intestazione (vedi createHash su nomi colonna normalizzati):
// stesso export banca → stesso mapping riusato, AI richiamata solo se l'elenco colonne non è
// mai stato visto prima (vedi AI-Workspace/Plans/DATE_PAGAMENTO_FATTURE.md).
import { createHash } from 'node:crypto';
import { readJson, writeJson } from '../lib/jsonStore.js';
import {
  leggiGroqApiKey, leggiGroqModello, salvaGroqModello,
  leggiClaudeApiKey, leggiClaudeModello, salvaClaudeModello, leggiClaudeWorkspaceId,
} from './envService.js';
import { chiamaAI } from './aiRouterService.js';
import { listMesiFatturati, getInvoice, saveInvoice, arricchisciStatoPagamento } from './invoiceService.js';

const FILE_MAPPING = 'pagamentiMappingColonne.json';

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

function promptMapping(intestazioni) {
  return `Queste sono le intestazioni colonna di un file CSV esportato da un home banking italiano:
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
}

// Le API Gemini/Claude/Groq restituiscono errori come JSON ({error:{message:"..."}})
// o varianti simili: estrae solo il messaggio leggibile invece di mostrare il JSON grezzo.
function estraiMessaggioErrore(testoErrore) {
  try {
    const dati = JSON.parse(testoErrore);
    return dati.error?.message || testoErrore;
  } catch {
    return testoErrore;
  }
}

function estraiEValidaMapping(testo, fonte) {
  const inizio = testo.indexOf('{');
  const fine = testo.lastIndexOf('}');
  if (inizio === -1 || fine === -1) throw new Error(`Risposta ${fonte} senza oggetto JSON riconoscibile`);
  const mapping = JSON.parse(testo.slice(inizio, fine + 1));
  const importoValido = Number.isInteger(mapping.colonnaImporto) || Number.isInteger(mapping.colonnaEntrate);
  if (!Number.isInteger(mapping.colonnaData) || !Number.isInteger(mapping.colonnaDescrizione) || !importoValido) {
    throw new Error(`Mapping colonne restituito da ${fonte} incompleto`);
  }
  return mapping;
}

async function chiediMapping(intestazioni) {
  const { testo, fonte } = await chiamaAI(promptMapping(intestazioni), { reasoningEffortGroq: 'low' });
  return estraiEValidaMapping(testo, fonte);
}

// Verifica il modello Groq scelto dall'utente con una chiamata reale, e lo salva solo se funziona.
export async function verificaESalvaModelloGroq(modello) {
  const apiKey = await leggiGroqApiKey();
  if (!apiKey) throw new Error('GROQ_API_KEY non configurata (Impostazioni → AI → Groq AI)');
  const risposta = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: modello, messages: [{ role: 'user', content: 'Rispondi solo con: OK' }] }),
  });
  if (!risposta.ok) throw new Error(`Verifica fallita: ${estraiMessaggioErrore(await risposta.text())}`);
  await salvaGroqModello(modello);
}

// Verifica il modello Claude scelto dall'utente con una chiamata reale, e lo salva solo se funziona.
export async function verificaESalvaModelloClaude(modello) {
  const apiKey = await leggiClaudeApiKey();
  if (!apiKey) throw new Error('CLAUDE_API_KEY non configurata (Impostazioni → AI → Claude AI)');
  const workspaceId = await leggiClaudeWorkspaceId();
  const risposta = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      ...(workspaceId ? { 'anthropic-workspace-id': workspaceId } : {}),
    },
    body: JSON.stringify({ model: modello, max_tokens: 16, messages: [{ role: 'user', content: 'Rispondi solo con: OK' }] }),
  });
  if (!risposta.ok) throw new Error(`Verifica fallita: ${estraiMessaggioErrore(await risposta.text())}`);
  await salvaClaudeModello(modello);
}

// Riusa il mapping già salvato per la stessa intestazione; solo se mai vista chiama Gemini
// e salva il risultato per i prossimi import con lo stesso layout file.
export async function rilevaMappingColonne(intestazioni) {
  const firma = firmaIntestazioni(intestazioni);
  const salvati = await readJson(FILE_MAPPING, {});
  if (salvati[firma]) return salvati[firma];

  const mapping = await chiediMapping(intestazioni);
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

// Fatture emesse con residuo da incassare (parziale o totale).
export async function fattureAperte() {
  const chiavi = await listMesiFatturati();
  const fatture = await Promise.all(chiavi.map((c) => getInvoice(c.anno, c.mese, c.clienteId)));
  return fatture.filter(Boolean).map(arricchisciStatoPagamento).filter((f) => f.residuo > 0);
}

// Abbina ogni movimento a una fattura aperta con importo <= residuo. Ambiguità (più
// fatture con residuo sufficiente) restano senza auto-selezione: i candidati sono
// ordinati per vicinanza |residuo - importo| (il più plausibile primo), la conferma
// resta sempre esplicita dell'utente, nessun abbinamento viene salvato automaticamente.
export async function proponiAbbinamenti(movimenti) {
  const aperte = await fattureAperte(); // già arricchite con .residuo
  return movimenti.map((m) => {
    const corrispondenti = aperte
      .filter((f) => m.importo <= f.residuo + 0.01) // +0.01: tolleranza floating point, non un margine di business
      .sort((a, b) => Math.abs(a.residuo - m.importo) - Math.abs(b.residuo - m.importo));
    return {
      ...m,
      fattura: corrispondenti.length === 1
        ? { anno: corrispondenti[0].anno, mese: corrispondenti[0].mese, clienteId: corrispondenti[0].clienteId, numero: corrispondenti[0].numero }
        : null,
      ambiguo: corrispondenti.length > 1,
      candidati: corrispondenti.length > 1
        ? corrispondenti.map((f) => ({ anno: f.anno, mese: f.mese, clienteId: f.clienteId, numero: f.numero, residuo: f.residuo }))
        : undefined,
    };
  });
}

// Registra un incasso (parziale o totale) in append a pagamenti[] — mai sovrascrittura.
// dataPagamento sul disco resta il valore grezzo precedente: viene ricalcolato come
// derivato (ultima rata) solo in lettura via arricchisciStatoPagamento.
export async function confermaPagamento(anno, mese, clienteId, dataPagamento, importo) {
  const fattura = await getInvoice(anno, mese, clienteId);
  if (!fattura) throw new Error('Fattura non trovata');
  if (!Number.isFinite(importo) || importo <= 0) throw new Error('Importo pagamento non valido');
  const arricchita = arricchisciStatoPagamento(fattura);
  fattura.pagamenti = [...arricchita.pagamenti, { data: dataPagamento, importo }];
  await saveInvoice(anno, mese, clienteId, fattura);
  return arricchisciStatoPagamento(fattura);
}

// Registra un incasso in BTC come rata: l'importo EUR è SEMPRE calcolato qui dal cambio
// dichiarato, mai accettato dal client, così il prospetto di cambio e l'EUR registrato
// non possono divergere (vedi AI-Workspace/Plans/PAGAMENTI_BTC.md, F1).
export async function confermaPagamentoBtc(anno, mese, clienteId, dataPagamento, datiBtc) {
  const { txid, satoshi, cambioEurBtc, fonteCambio, dataOraCambio, indirizzoDestinatario } = datiBtc || {};
  if (!/^[0-9a-fA-F]{64}$/.test(txid || '')) throw new Error('TXID non valido (attesi 64 caratteri esadecimali)');
  if (!Number.isInteger(satoshi) || satoshi <= 0) throw new Error('Satoshi non valido');
  if (!Number.isFinite(cambioEurBtc) || cambioEurBtc <= 0) throw new Error('Cambio EUR/BTC non valido');
  if (!indirizzoDestinatario) throw new Error('Indirizzo di destinazione mancante');

  const fattura = await getInvoice(anno, mese, clienteId);
  if (!fattura) throw new Error('Fattura non trovata');
  const importo = Number(((satoshi / 1e8) * cambioEurBtc).toFixed(2));
  if (importo <= 0) throw new Error('Importo calcolato non valido');

  const arricchita = arricchisciStatoPagamento(fattura);
  fattura.pagamenti = [...arricchita.pagamenti, {
    data: dataPagamento,
    importo,
    btc: { txid, satoshi, cambioEurBtc, fonteCambio, dataOraCambio, indirizzoDestinatario },
  }];
  await saveInvoice(anno, mese, clienteId, fattura);
  return arricchisciStatoPagamento(fattura);
}

// Registra un incasso in valuta estera come rata: l'importo EUR è calcolato qui dal cambio
// dichiarato (stesso pattern di confermaPagamentoBtc). Il cambio è "quantità di valuta per 1 euro"
// (convenzione Banca d'Italia): importoValuta / cambio = euro.
export async function confermaPagamentoValuta(anno, mese, clienteId, dataPagamento, datiValuta) {
  const { codiceValuta, importoValuta, cambio, fonte, dataQuotazione } = datiValuta || {};
  const codice = (codiceValuta ?? '').toUpperCase();
  if (!codice || codice.length !== 3) throw new Error('Codice valuta non valido (attesi 3 caratteri ISO)');
  if (codice === 'EUR') throw new Error('Per incassi in EUR usa il modulo pagamento standard');
  if (!Number.isFinite(importoValuta) || importoValuta <= 0) throw new Error('Importo in valuta non valido');
  if (!Number.isFinite(cambio) || cambio <= 0) throw new Error('Cambio non valido');

  const fattura = await getInvoice(anno, mese, clienteId);
  if (!fattura) throw new Error('Fattura non trovata');
  const importo = Number((importoValuta / cambio).toFixed(2));
  if (importo <= 0) throw new Error('Importo calcolato in EUR non valido');

  const arricchita = arricchisciStatoPagamento(fattura);
  fattura.pagamenti = [...arricchita.pagamenti, {
    data: dataPagamento,
    importo,
    valuta: { codice, importoValuta, cambio, fonte, dataQuotazione },
  }];
  await saveInvoice(anno, mese, clienteId, fattura);
  return arricchisciStatoPagamento(fattura);
}

// Elimina un pagamento registrato (solo cancellazione, non editing — vedi piano §7).
export async function eliminaPagamento(anno, mese, clienteId, indice) {
  const fattura = await getInvoice(anno, mese, clienteId);
  if (!fattura) throw new Error('Fattura non trovata');
  const arricchita = arricchisciStatoPagamento(fattura);
  if (indice < 0 || indice >= arricchita.pagamenti.length) throw new Error('Pagamento non trovato');
  fattura.pagamenti = arricchita.pagamenti.filter((_, i) => i !== indice);
  await saveInvoice(anno, mese, clienteId, fattura);
  return arricchisciStatoPagamento(fattura);
}
