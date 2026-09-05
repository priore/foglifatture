// Calcolo e archiviazione della Fattura Pro-Forma: ore * tariffa oraria + bollo virtuale condizionale.
import { randomBytes } from 'node:crypto';
import { readJson, writeJson, listKeys } from '../lib/jsonStore.js';

function chiaveMese(anno, mese, clienteId) {
  return `${anno}-${String(mese).padStart(2, '0')}-${clienteId}`;
}

function percorsoFile(anno, mese, clienteId) {
  return `invoices/${chiaveMese(anno, mese, clienteId)}.json`;
}

// Spacca una chiave "anno-mese-clienteId" nelle sue parti. clienteId può contenere
// trattini (uuid), quindi si spacca solo sui primi due segmenti, il resto è l'id.
function parseChiave(chiave) {
  const [anno, mese, ...restoId] = chiave.split('-');
  return { chiave, anno: Number(anno), mese: Number(mese), clienteId: restoId.join('-') };
}

// Calcola bollo (dichiarato nell'XML FatturaPA se dovuto) e netto a pagare a partire
// da un imponibile già noto. Il bollo non va in tabella nella fattura pro-forma né
// sommato al netto richiesto al cliente: resta solo l'indicazione legale "assolta in
// modo virtuale" e il campo DatiBollo XML. Regime forfettario: nessuna rivalsa INPS,
// nessuna ritenuta d'acconto.
export function calcolaBollo(imponibile, sogliaBolloVirtuale, importoBollo) {
  const bolloApplicabile = imponibile > sogliaBolloVirtuale;
  const bollo = bolloApplicabile ? importoBollo : 0;
  return { imponibile, bolloApplicabile, bollo, nettoAPagare: imponibile };
}

// Imponibile da timesheet: ore * tariffa oraria.
export function calcolaCompenso({ totaleOre, tariffaOraria, sogliaBolloVirtuale, importoBollo }) {
  const imponibile = Number((totaleOre * tariffaOraria).toFixed(2));
  return calcolaBollo(imponibile, sogliaBolloVirtuale, importoBollo);
}

export async function getInvoice(anno, mese, clienteId) {
  return readJson(percorsoFile(anno, mese, clienteId), null);
}

export async function saveInvoice(anno, mese, clienteId, invoice) {
  await writeJson(percorsoFile(anno, mese, clienteId), invoice);
  return invoice;
}

// Termine di pagamento pattuito col cliente: dato commerciale, non fiscale (non entra
// nell'XML FatturaPA), quindi scrivibile anche a fattura già accettata da SDI — a
// differenza di importo/descrizione/numero, che passano da /genera e restano bloccati.
export async function impostaScadenzaPagamento(anno, mese, clienteId, dataScadenzaPagamento) {
  const invoice = await getInvoice(anno, mese, clienteId);
  if (!invoice) throw new Error('Fattura non trovata');
  invoice.dataScadenzaPagamento = dataScadenzaPagamento || null;
  await saveInvoice(anno, mese, clienteId, invoice);
  return invoice;
}

// Restituisce le chiavi già parsate ({ chiave, anno, mese, clienteId }), non stringhe
// grezze: evita che ogni consumatore debba rifare split('-') su un formato composito.
export async function listMesiFatturati() {
  const chiavi = await listKeys('invoices');
  return chiavi.map(parseChiave).sort((a, b) => a.chiave.localeCompare(b.chiave));
}

// Prossimo numero fattura (progressivo puro, senza barra/anno: formato più compatibile
// con lo SDI secondo esperienza pregressa). Se il mese ha già una fattura salvata per
// questo cliente ne riusa il numero (una rigenerazione non deve consumare un nuovo
// progressivo). Il progressivo è unico per fornitore/P.IVA, non per cliente: conta le
// fatture effettivamente scritte su disco (tutteLeFatture), non le entry di directory.
export async function prossimoNumeroFattura(anno, mese, clienteId) {
  const esistente = await getInvoice(anno, mese, clienteId);
  if (esistente) return esistente.numero;
  const fatture = await tutteLeFatture();
  return String(fatture.length + 1);
}

// Legge tutte le fatture esistenti (tutti i mesi, tutti i clienti), ordinate per numero
// progressivo. clienteId viene letto dal contenuto della fattura deserializzata (dove
// saveInvoice lo scrive esplicitamente), mai dalla chiave file: questo evita che il
// progressivo Number(f.numero) confonda il clienteId con parte del numero fattura.
async function tutteLeFatture() {
  const chiavi = await listMesiFatturati();
  const fatture = await Promise.all(
    chiavi.map(({ anno, mese, clienteId }) => getInvoice(anno, mese, clienteId))
  );
  return fatture.filter(Boolean).sort((a, b) => Number(a.numero) - Number(b.numero));
}

// ProgressivoInvio SDI: a differenza del numero fattura (che identifica il documento
// fiscale e non cambia mai), il progressivo identifica il singolo TENTATIVO di
// trasmissione — ogni invio o reinvio via PEC (anche dopo scarto) ne consuma uno nuovo.
// SDI rifiuta come "00002 nome file duplicato" qualunque nome già visto per lo stesso
// trasmittente, anche a distanza di mesi/anni e anche da gestionali precedenti (visto
// coi progressivi alfanumerici tipo "XEYon" nell'archivio storico) — un contatore
// sequenziale locale (1, 2, 3…) può quindi collidere con progressivi mai registrati nel
// nostro DB. Alfanumerico casuale rende la collisione trascurabile senza dover conoscere
// lo storico completo presso SDI — ma il PROGRESSIVO nel nome file (a differenza del tag
// <ProgressivoInvio> nell'XML, che può arrivare a 10 caratteri) è vincolato dalle regole
// di nomenclatura SDI a max 5 caratteri, solo A-Z maiuscole e 0-9 (scarto 00001 altrimenti).
const ALFABETO_PROGRESSIVO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
export function prossimoProgressivoInvio() {
  const byte = randomBytes(5);
  return Array.from(byte, (b) => ALFABETO_PROGRESSIVO[b % ALFABETO_PROGRESSIVO.length]).join('');
}

// Verifica che `numero` sia valido rispetto alle fatture già emesse: nessun duplicato,
// nessun salto nella sequenza (deve essere l'ultimo progressivo + 1) — la sequenza resta
// UNICA cross-cliente (obbligo legale: il progressivo è per P.IVA fornitore, non per
// cliente). Si esclude dal controllo solo la fattura dello stesso cliente/stesso mese
// (una rigenerazione riusa il proprio numero); la fattura di un altro cliente nello
// stesso mese civile resta nel controllo sequenza.
export async function verificaIntegritaNumerazione(anno, mese, clienteId, numero) {
  const tutte = await tutteLeFatture();
  const fatturaCorrente = tutte.find(
    (f) => f.anno === anno && f.mese === mese && f.clienteId === clienteId
  );
  // Rigenerare una fattura che riusa esattamente il proprio numero esistente è sempre
  // valido, anche se non è più l'ultima della sequenza globale (con più clienti, altre
  // fatture più recenti di altri clienti possono essere state generate nel frattempo —
  // a differenza del caso a singolo cliente, "riusare il proprio numero" non coincide
  // più sempre con "essere l'ultimo della sequenza").
  if (fatturaCorrente && String(fatturaCorrente.numero) === String(numero)) {
    return { valido: true };
  }

  const fatture = tutte.filter(
    (f) => !(f.anno === anno && f.mese === mese && f.clienteId === clienteId)
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
