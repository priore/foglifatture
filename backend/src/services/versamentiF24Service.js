// Versamenti F24 inseriti manualmente (imposta sostitutiva, INPS): input minimo per
// confrontare stimato (forfettarioService) vs effettivamente versato, senza scraping/OCR
// (vedi AI-Workspace/Plans/F24_STEP1_RICOGNIZIONE.md — fonti automatiche scartate).
import { readJson, writeJson } from '../lib/jsonStore.js';
import { randomUUID } from 'node:crypto';

const FILE = 'f24Versamenti.json';

export async function listVersamenti(anno) {
  const versamenti = await readJson(FILE, []);
  return anno ? versamenti.filter((v) => new Date(v.data).getFullYear() === anno) : versamenti;
}

export async function aggiungiVersamento({ data, tipo, importo }) {
  if (!data || !tipo || !(importo > 0)) throw new Error('Dati versamento non validi');
  const versamenti = await readJson(FILE, []);
  const versamento = { id: randomUUID(), data, tipo, importo: Number(importo) };
  versamenti.push(versamento);
  await writeJson(FILE, versamenti);
  return versamento;
}

export async function eliminaVersamento(id) {
  const versamenti = await readJson(FILE, []);
  const rimasti = versamenti.filter((v) => v.id !== id);
  await writeJson(FILE, rimasti);
}

// Riga tabella "Versamenti > Modello F24" del Cassetto Fiscale (agenziaentrate.gov.it), dopo
// copia-incolla (cmd+A/cmd+C) dell'intera pagina: "31/12/2025  1  645,83 €  -  -". Non riporta
// il codice tributo (serve "Ricerche tributi F24" per quello), solo data e saldo aggregato del
// versamento — importato come tipo generico "F24 (import Cassetto Fiscale)", l'utente corregge
// il tipo a mano se serve distinguere imposta/INPS. Regex, non un LLM: i dati sono numeri esatti,
// nessuna ambiguità da risolvere semanticamente, e zero rischio di importo "interpretato" male.
const RIGA_VERSAMENTO = /^(\d{1,2}\/\d{1,2}\/\d{4})\s+\d+\s+([\d.]+,\d{2})\s*€/;

export function estraiVersamentiDaTesto(testo) {
  const risultati = [];
  for (const riga of testo.split('\n')) {
    const m = riga.trim().match(RIGA_VERSAMENTO);
    if (!m) continue;
    const [giorno, mese, anno] = m[1].split('/');
    const data = `${anno}-${mese.padStart(2, '0')}-${giorno.padStart(2, '0')}`;
    const importo = Number(m[2].replace(/\./g, '').replace(',', '.'));
    risultati.push({ data, tipo: 'F24 (import Cassetto Fiscale)', importo });
  }
  return risultati;
}

// Salva i versamenti estratti in upsert su data+importo (stesso versamento della stessa
// pagina, incollata di nuovo o con la sua "quietanza" aggiornata): il nuovo sostituisce il
// vecchio invece di duplicarlo. Data+importo, non la sola data, perché nella stessa giornata
// possono legittimamente cadere più versamenti F24 distinti (es. due rate).
export function esportaVersamentiCsv(versamenti) {
  const righe = ['Data,Tipo,Importo'];
  for (const v of versamenti) {
    righe.push(`${v.data},${v.tipo},${v.importo.toFixed(2)}`);
  }
  return righe.join('\n');
}

export async function importaVersamenti(candidati) {
  const esistenti = await readJson(FILE, []);
  let aggiornati = 0;
  const risultato = [...esistenti];
  const importati = [];
  for (const c of candidati) {
    const indiceEsistente = risultato.findIndex((v) => v.data === c.data && v.importo === c.importo);
    const versamento = { id: indiceEsistente >= 0 ? risultato[indiceEsistente].id : randomUUID(), ...c };
    if (indiceEsistente >= 0) {
      risultato[indiceEsistente] = versamento;
      aggiornati++;
    } else {
      risultato.push(versamento);
    }
    importati.push(versamento);
  }
  await writeJson(FILE, risultato);
  return { importati, aggiornati };
}
