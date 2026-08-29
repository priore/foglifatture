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

// Legge tutte le fatture esistenti (tutti i mesi), ordinate per numero progressivo.
async function tutteLeFatture() {
  const chiavi = await listMesiFatturati();
  const fatture = await Promise.all(
    chiavi.map((chiave) => {
      const [anno, mese] = chiave.split('-').map(Number);
      return getInvoice(anno, mese);
    })
  );
  return fatture.filter(Boolean).sort((a, b) => Number(a.numero) - Number(b.numero));
}

// Verifica che `numero` sia valido rispetto alle fatture già emesse: nessun duplicato,
// nessun salto nella sequenza (deve essere l'ultimo progressivo + 1), escludendo dal
// controllo la fattura del mese corrente (una rigenerazione riusa il proprio numero).
export async function verificaIntegritaNumerazione(anno, mese, numero) {
  const fatture = (await tutteLeFatture()).filter(
    (f) => !(f.anno === anno && f.mese === mese)
  );

  const duplicato = fatture.find((f) => String(f.numero) === String(numero));
  if (duplicato) {
    return {
      valido: false,
      errore: `Numero fattura ${numero} già usato per ${duplicato.anno}-${String(duplicato.mese).padStart(2, '0')}`,
    };
  }

  if (fatture.length === 0) {
    if (String(numero) !== '1') {
      return { valido: false, errore: `Prima fattura: il numero deve essere 1, non ${numero}` };
    }
    return { valido: true };
  }

  const ultimoNumero = Math.max(...fatture.map((f) => Number(f.numero)));
  const atteso = ultimoNumero + 1;
  if (Number(numero) !== atteso) {
    return { valido: false, errore: `Numero fattura non sequenziale: atteso ${atteso}, ricevuto ${numero}` };
  }

  return { valido: true };
}
