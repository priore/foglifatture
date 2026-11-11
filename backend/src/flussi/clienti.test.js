// Flusso utente: anagrafica clienti (inserimento, modifica, disattivazione, eliminazione) con casi
// normali, limite e comportamenti imprevisti. Sandbox: cartella dati temporanea.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { creaAmbiente } from './ambiente.js';
import { popolaModello, CLI } from './datiModello.js';

let amb;
before(async () => { amb = await creaAmbiente(); await popolaModello(amb); });
after(async () => { await amb.chiudi(); });

const leggi = async () => (await amb.api('GET', '/api/config')).corpo;
const salvaClienti = async (clienti) => amb.api('PUT', '/api/config', { clienti });
const nuovo = (id, extra = {}) => ({
  id, attivo: true, denominazione: `Nuovo ${id}`, indirizzo: 'Via Prova', cap: '10100', comune: 'Torino', provincia: 'TO',
  partitaIva: '11223344556', codiceDestinatarioSdi: 'ABCDEFG', tariffaOraria: 30, email: 'nuovo@example.com', ...extra,
});

test('il modello contiene tutti i tipi di cliente', async () => {
  const c = await leggi();
  assert.equal(c.clienti.length, 6);
  assert.ok(c.clienti.some((x) => !x.attivo));
  assert.ok(c.clienti.some((x) => x.paese === 'DE') && c.clienti.some((x) => x.rivalsaInps) && c.clienti.some((x) => x.pagamentoBtc));
});

test('inserimento: nuovo cliente persistito; senza id la validazione lo rifiuta', async () => {
  const prima = (await leggi()).clienti;
  const r = await salvaClienti([...prima, nuovo('cli-nuovo-1')]);
  assert.equal(r.stato, 200);
  assert.equal((await leggi()).clienti.length, prima.length + 1);
  const senzaId = await salvaClienti([...prima, { ...nuovo(''), id: '' }]);
  assert.equal(senzaId.stato, 400);
  assert.match(senzaId.corpo.errore, /id univoco/);
});

test('inserimento non valido: P.IVA, codice SDI, email, id duplicato, IBAN', async () => {
  const base = (await leggi()).clienti;
  const casi = [
    [{ ...nuovo('x1'), partitaIva: '123' }, /Partita IVA/],
    [{ ...nuovo('x2'), codiceDestinatarioSdi: 'AB' }, /SDI/],
    [{ ...nuovo('x3'), email: 'non-una-email' }, /email/i],
    [{ ...nuovo(CLI.it) }, /id univoco/],
  ];
  for (const [cliente, atteso] of casi) {
    const r = await salvaClienti([...base, cliente]);
    assert.equal(r.stato, 400, JSON.stringify(cliente));
    assert.match(r.corpo.errore, atteso);
  }
  const r = await amb.api('PUT', '/api/config', { fatturazione: { iban: 'IT00X0000000000000000000000' } });
  assert.equal(r.stato, 400);
  // niente è stato salvato per effetto dei rifiuti
  assert.equal((await leggi()).clienti.length, base.length);
});

test('modifica: tariffa, rivalsa e dati anagrafici si aggiornano senza toccare gli altri clienti', async () => {
  const clienti = (await leggi()).clienti;
  const modificati = clienti.map((c) => (c.id === CLI.it ? { ...c, tariffaOraria: 45, denominazione: 'Italia Modificata', rivalsaInps: true } : c));
  assert.equal((await salvaClienti(modificati)).stato, 200);
  const dopo = (await leggi()).clienti;
  const it = dopo.find((c) => c.id === CLI.it);
  assert.equal(it.tariffaOraria, 45);
  assert.equal(it.denominazione, 'Italia Modificata');
  assert.deepEqual(dopo.find((c) => c.id === CLI.btc), clienti.find((c) => c.id === CLI.btc));
});

test('la modifica della tariffa non cambia le fatture già emesse (importi congelati)', async () => {
  const f = (await amb.api('GET', `/api/invoice/2026/1/${CLI.it}`)).corpo;
  assert.equal(f.tariffaOraria, 40);
});

test('disattivazione: il cliente resta risolvibile per le fatture storiche', async () => {
  const clienti = (await leggi()).clienti.map((c) => (c.id === CLI.rivalsa ? { ...c, attivo: false } : c));
  assert.equal((await salvaClienti(clienti)).stato, 200);
  const r = await amb.api('GET', `/api/invoice/2026/1/${CLI.rivalsa}/xml`);
  assert.equal(r.stato, 200);
  assert.match(r.testo, /<FatturaElettronica/);
});

test('eliminazione: rifiutata se il cliente ha fatture/timesheet, ammessa se vuoto', async () => {
  const conDati = (await amb.api('GET', '/api/config/clienti/con-dati')).corpo;
  assert.ok(conDati.includes(CLI.it) && conDati.includes(CLI.btc));
  assert.ok(!conDati.includes(CLI.disattivo) && !conDati.includes('cli-nuovo-1'));

  const no = await amb.api('DELETE', `/api/config/clienti/${CLI.it}`);
  assert.equal(no.stato, 400);
  assert.match(no.corpo.errore, /solo disattivare/);

  const ok = await amb.api('DELETE', '/api/config/clienti/cli-nuovo-1');
  assert.equal(ok.stato, 200);
  assert.ok(!(await leggi()).clienti.some((c) => c.id === 'cli-nuovo-1'));

  // idempotente: eliminare di nuovo un cliente inesistente non rompe nulla
  assert.equal((await amb.api('DELETE', '/api/config/clienti/cli-nuovo-1')).stato, 200);
});

test("imprevisto: non si può eliminare l'ultimo cliente attivo", async () => {
  const clienti = (await leggi()).clienti.map((c) => ({ ...c, attivo: false }));
  assert.equal((await salvaClienti([...clienti, nuovo('cli-ultimo')])).stato, 200);
  const r = await amb.api('DELETE', '/api/config/clienti/cli-ultimo');
  assert.equal(r.stato, 400);
  assert.match(r.corpo.errore, /almeno un cliente attivo/);
  assert.ok((await leggi()).clienti.some((c) => c.id === 'cli-ultimo'));
});

test('imprevisto: payload malformato non corrompe la configurazione', async () => {
  const prima = await leggi();
  for (const corpo of [{ clienti: 'testo' }, { clienti: [null] }, { fornitore: { partitaIva: 'abc' } }]) {
    const r = await amb.api('PUT', '/api/config', corpo);
    assert.ok([400, 500].includes(r.stato), `stato ${r.stato}`);
  }
  assert.deepEqual((await leggi()).clienti, prima.clienti);
});
