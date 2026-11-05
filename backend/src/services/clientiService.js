// Eliminazione definitiva di un cliente: consentita solo se nell'archivio non ha nulla di associato.
import { listKeys, readJson, eliminaJson } from '../lib/jsonStore.js';
import { getConfig, saveConfig } from './configService.js';

const FORMATO_CHIAVE = /^\d{4}-\d{2}-[A-Za-z0-9_-]+$/;

const giornoCompilato = (g) => Boolean(
  g.inizioMattina || g.fineMattina || g.inizioPomeriggio || g.finePomeriggio || g.stato || g.note,
);

const appartiene = (chiave, clienteId) => chiave.slice(8) === clienteId;

// Raccoglie ciò che nell'archivio punta al cliente: fatture e note di credito, numeri prenotati,
// timesheet con almeno un giorno compilato. Le griglie vuote (create solo aprendo il mese) non contano
// e si restituiscono a parte per essere rimosse con il cliente.
async function datiDelCliente(clienteId) {
  const fatture = (await listKeys('invoices', FORMATO_CHIAVE)).filter((k) => appartiene(k, clienteId));
  const registro = await readJson('numerazione.json', { numeri: {} });
  const numeri = Object.values(registro.numeri ?? {}).filter((n) => n.clienteId === clienteId);
  const timesheetVuoti = [];
  let timesheetConDati = 0;
  for (const k of (await listKeys('timesheets', FORMATO_CHIAVE)).filter((k) => appartiene(k, clienteId))) {
    const t = await readJson(`timesheets/${k}.json`, null);
    if (t?.giorni?.some(giornoCompilato)) timesheetConDati++;
    else timesheetVuoti.push(k);
  }
  return { haDati: fatture.length + numeri.length + timesheetConDati > 0, timesheetVuoti };
}

// Id dei clienti che hanno dati associati: la UI abilita «Elimina» solo per gli altri.
export async function clientiConDati() {
  const { clienti } = await getConfig();
  const conDati = [];
  for (const c of clienti) if ((await datiDelCliente(c.id)).haDati) conDati.push(c.id);
  return conDati;
}

export async function eliminaCliente(clienteId) {
  const { clienti } = await getConfig();
  const cliente = clienti.find((c) => c.id === clienteId);
  if (!cliente) return; // mai salvato (cliente appena aggiunto in UI): niente da eliminare su disco
  const { haDati, timesheetVuoti } = await datiDelCliente(clienteId);
  if (haDati) throw new Error('Il cliente ha fatture o timesheet associati: si può solo disattivare');
  const restanti = clienti.filter((c) => c.id !== clienteId);
  if (!restanti.some((c) => c.attivo)) throw new Error('Deve restare sempre almeno un cliente attivo');
  for (const k of timesheetVuoti) await eliminaJson(`timesheets/${k}.json`);
  await saveConfig({ clienti: restanti });
}
