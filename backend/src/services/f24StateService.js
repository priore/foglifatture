// Stato degli F24 generati dal piano versamenti + versamenti automatici al pagamento.
// FP-024 · FEATURES_GAP_ANALISI_ESTERNA.md voce 8 / sezione G 17°.
//
// Flusso stati: da_pagare → programmato → pagato (o annullato da qualsiasi stato).
// Al passaggio a 'pagato': crea record in f24Versamenti.json con codice tributo corretto.
// Tornare da 'pagato': cancella i record con quell'origine (idempotente).
// annullabileEntro = 3 giorni lavorativi prima di dataPagamento (per F24 programmati via i24).
import { readJson, writeJson } from '../lib/jsonStore.js';
import { randomUUID } from 'node:crypto';
import { primoGiornoLavorativo } from './scadenzeFiscaliService.js';

const FILE_F24 = 'f24.json';
const FILE_VERSAMENTI = 'f24Versamenti.json';

const STATI_VALIDI = ['da_pagare', 'programmato', 'pagato', 'annullato'];

// 3 giorni lavorativi prima di dataPagamento (per i24 — Provv. AdE 313945/2024 §5.3).
// Sottrae giorni lavorativi a ritroso: incrementa di 1 giorno verso il passato finché non
// raggiunge 3 giorni "veri" (non festivi, non weekend).
export function annullabileEntro(dataPagamento) {
  const [anno, mese, giorno] = dataPagamento.split('-').map(Number);
  let d = new Date(anno, mese - 1, giorno);
  let lavorativi = 0;
  while (lavorativi < 3) {
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1);
    // Giorno lavorativo: non weekend E coincide con primoGiornoLavorativo di sé stesso
    const dow = d.getDay();
    if (dow === 0 || dow === 6) continue;
    const candidato = primoGiornoLavorativo(d.getFullYear(), d.getMonth() + 1, d.getDate());
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (candidato === iso) lavorativi++;
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function listF24(anno) {
  const lista = await readJson(FILE_F24, []);
  return anno ? lista.filter((f) => f.dataPagamento?.startsWith(String(anno))) : lista;
}

// Salva un nuovo F24 generato dal piano versamenti.
// `scadenza` è un elemento di stimaVersamenti().scadenze (ha .data, .righe[]).
// `tipo` = etichetta leggibile (es. "Saldo + I acconto 2025").
export async function creaF24DaPiano(scadenza, tipo) {
  const lista = await readJson(FILE_F24, []);
  const f24 = {
    id: randomUUID(),
    tipo: tipo ?? scadenza.tipo ?? '',
    dataPagamento: scadenza.data,
    stato: 'da_pagare',
    righe: scadenza.righe ?? [],
    annullabileEntro: null, // impostato solo al passaggio a 'programmato'
    pagatoIl: null,
  };
  lista.push(f24);
  await writeJson(FILE_F24, lista);
  return f24;
}

// Aggiorna lo stato di un F24. Effetti collaterali:
//   da_pagare/annullato → programmato: calcola annullabileEntro
//   qualsiasi → pagato: crea versamenti automatici
//   pagato → altro: cancella versamenti con origine questo id
export async function aggiornaStatoF24(id, nuovoStato) {
  if (!STATI_VALIDI.includes(nuovoStato)) throw new Error(`Stato non valido: ${nuovoStato}`);

  const lista = await readJson(FILE_F24, []);
  const idx = lista.findIndex((f) => f.id === id);
  if (idx < 0) throw new Error(`F24 non trovato: ${id}`);

  const f24 = lista[idx];
  const statoPrecedente = f24.stato;

  if (nuovoStato === 'programmato') {
    f24.annullabileEntro = annullabileEntro(f24.dataPagamento);
  }

  if (nuovoStato === 'pagato' && statoPrecedente !== 'pagato') {
    f24.pagatoIl = new Date().toISOString().slice(0, 10);
    await creaVersamentiAutomatici(f24);
  }

  if (statoPrecedente === 'pagato' && nuovoStato !== 'pagato') {
    f24.pagatoIl = null;
    await rimuoviVersamentiAutomatici(id);
  }

  f24.stato = nuovoStato;
  lista[idx] = f24;
  await writeJson(FILE_F24, lista);
  return f24;
}

export async function eliminaF24(id) {
  const lista = await readJson(FILE_F24, []);
  const f24 = lista.find((f) => f.id === id);
  if (!f24) throw new Error(`F24 non trovato: ${id}`);
  if (f24.stato === 'pagato') await rimuoviVersamentiAutomatici(id);
  await writeJson(FILE_F24, lista.filter((f) => f.id !== id));
}

// Funzione pura: mappa le righe di un F24 in record per f24Versamenti.json.
// Esportata per i test (senza I/O).
export function creaVersamentiDaF24(f24) {
  return (f24.righe ?? []).map((riga) => ({
    id: randomUUID(),
    data: f24.pagatoIl,
    tipo: riga.sezione === 'inps' ? 'INPS' : 'imposta',
    importo: riga.importo,
    ...(riga.codice ? { codice: riga.codice } : {}),
    ...(riga.annoRiferimento ? { annoRiferimento: riga.annoRiferimento } : {}),
    ...(riga.maggiorazione ? { maggiorazione: riga.maggiorazione } : {}),
    origine: f24.id,
  }));
}

async function creaVersamentiAutomatici(f24) {
  const versamenti = await readJson(FILE_VERSAMENTI, []);
  versamenti.push(...creaVersamentiDaF24(f24));
  await writeJson(FILE_VERSAMENTI, versamenti);
}

async function rimuoviVersamentiAutomatici(f24Id) {
  const versamenti = await readJson(FILE_VERSAMENTI, []);
  await writeJson(FILE_VERSAMENTI, versamenti.filter((v) => v.origine !== f24Id));
}

// Rimuove dai candidati (da Cassetto Fiscale) quelli già coperti da un F24 pagato
// con stessa data e stesso totale righe. Evita doppioni nell'import.
export async function filtraGiaPresentiInF24(candidati) {
  const lista = await readJson(FILE_F24, []);
  const pagati = lista.filter((f) => f.stato === 'pagato');
  return candidati.filter((c) => {
    return !pagati.some((f) => {
      const totale = Number(((f.righe ?? []).reduce((s, r) => s + r.importo, 0)).toFixed(2));
      return f.dataPagamento === c.data && totale === c.importo;
    });
  });
}
