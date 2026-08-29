// Calcolo e archiviazione della Fattura Pro-Forma: ore * tariffa oraria + bollo virtuale condizionale.
import { readJson, writeJson, listKeys } from '../lib/jsonStore.js';

function chiaveMese(anno, mese) {
  return `${anno}-${String(mese).padStart(2, '0')}`;
}

function percorsoFile(anno, mese) {
  return `invoices/${chiaveMese(anno, mese)}.json`;
}

// Calcola imponibile, bollo (dichiarato nell'XML FatturaPA se dovuto) e netto a pagare.
// Il bollo non va in tabella nella fattura pro-forma né sommato al netto richiesto al
// cliente: resta solo l'indicazione legale "assolta in modo virtuale" e il campo DatiBollo XML.
// Regime forfettario: nessuna rivalsa INPS, nessuna ritenuta d'acconto.
export function calcolaCompenso({ totaleOre, tariffaOraria, sogliaBolloVirtuale, importoBollo }) {
  const imponibile = Number((totaleOre * tariffaOraria).toFixed(2));
  const bolloApplicabile = imponibile > sogliaBolloVirtuale;
  const bollo = bolloApplicabile ? importoBollo : 0;
  const nettoAPagare = imponibile;
  return { imponibile, bolloApplicabile, bollo, nettoAPagare };
}

export async function getInvoice(anno, mese) {
  return readJson(percorsoFile(anno, mese), null);
}

export async function saveInvoice(anno, mese, invoice) {
  await writeJson(percorsoFile(anno, mese), invoice);
  return invoice;
}

export async function listMesiFatturati() {
  const chiavi = await listKeys('invoices');
  return chiavi.sort();
}

// Prossimo numero fattura (progressivo puro, senza barra/anno: formato più compatibile
// con lo SDI secondo esperienza pregressa). Se il mese ha già una fattura salvata ne
// riusa il numero (una rigenerazione non deve consumare un nuovo progressivo).
export async function prossimoNumeroFattura(anno, mese) {
  const esistente = await getInvoice(anno, mese);
  if (esistente) return esistente.numero;
  const mesiFatturati = await listMesiFatturati();
  return String(mesiFatturati.length + 1);
}
