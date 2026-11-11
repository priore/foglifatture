// Flusso utente: timesheet mensile (compilazione, modifica, azzeramento, export) con casi normali,
// limite (febbraio bisestile, mese a 31 giorni) e imprevisti (orari incompleti/invertiti, stati strani).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { creaAmbiente } from './ambiente.js';
import { popolaModello, compilaTimesheet, CLI } from './datiModello.js';

let amb;
before(async () => { amb = await creaAmbiente(); await popolaModello(amb); });
after(async () => { await amb.chiudi(); });

const get = (a, m, c = CLI.it) => amb.api('GET', `/api/timesheet/${a}/${m}/${c}`);
const put = (a, m, c, giorni) => amb.api('PUT', `/api/timesheet/${a}/${m}/${c}`, { giorni });

test('mese mai aperto: griglia vuota con tanti giorni quanti ne ha il mese', async () => {
  const feb2028 = (await get(2028, 2)).corpo;       // bisestile
  assert.equal(feb2028.giorni.length, 29);
  assert.equal((await get(2027, 2)).corpo.giorni.length, 28);
  assert.equal((await get(2026, 12)).corpo.giorni.length, 31);
  assert.equal(feb2028.riepilogo.totaleOreDecimale, 0);
  // aprire un mese non lo salva su disco
  assert.ok(!(await amb.api('GET', '/api/timesheet')).corpo.some((t) => t.anno === 2028));
});

test('compilazione: 8 ore per giorno feriale, totale e conteggio giorni coerenti', async () => {
  const t = (await get(2026, 1)).corpo;
  const feriali = t.giorni.filter((g) => !['Sabato', 'Domenica'].includes(g.nomeGiorno)).length;
  assert.equal(t.riepilogo.totaleOreDecimale, feriali * 8);
  assert.equal(t.riepilogo.giorniLavorati, feriali);
});

test('stati di assenza: ferie e malattia non contano ore', async () => {
  const t = (await get(2026, 3)).corpo;
  assert.equal(t.giorni[9].stato, 'Ferie');
  assert.equal(t.riepilogo.oreGiornaliere[9].ore, 0);
  assert.ok(t.riepilogo.conteggioStati);
});

test('modifica: cambiare un giorno aggiorna il totale; riscrivere tutto sovrascrive', async () => {
  const t = (await get(2026, 5)).corpo;
  const giorni = t.giorni.map((g) => (g.giorno === 4 ? { ...g, inizioMattina: '08:00', fineMattina: '12:30', inizioPomeriggio: '', finePomeriggio: '' } : g));
  const r = await put(2026, 5, CLI.it, giorni);
  assert.equal(r.stato, 200);
  assert.equal(r.corpo.riepilogo.oreGiornaliere[3].ore, 4.5);
  const azzerato = await put(2026, 5, CLI.it, t.giorni);
  assert.equal(azzerato.corpo.riepilogo.totaleOreDecimale, 0);
});

test('timesheet separati per cliente e per mese', async () => {
  const a = (await get(2026, 1, CLI.it)).corpo.riepilogo.totaleOreDecimale;
  await compilaTimesheet(amb, 2026, 1, CLI.it, { ore: ['10:00', '12:00', '', ''] });
  const dopo = (await get(2026, 1, CLI.it)).corpo.riepilogo.totaleOreDecimale;
  assert.ok(dopo < a);
  assert.equal((await get(2026, 2, CLI.it)).corpo.riepilogo.totaleOreDecimale > 0, true);
  assert.equal((await get(2026, 1, CLI.btc)).corpo.riepilogo.totaleOreDecimale, a);
});

test('imprevisto: orari incompleti, invertiti o non validi non mandano in errore il server', async () => {
  const t = (await get(2026, 6)).corpo;
  const sporchi = t.giorni.map((g, i) => {
    if (i === 0) return { ...g, inizioMattina: '09:00' };                          // fine mancante
    if (i === 1) return { ...g, inizioMattina: '18:00', fineMattina: '09:00' };    // invertito
    if (i === 2) return { ...g, inizioMattina: 'xx', fineMattina: '99:99' };       // spazzatura
    if (i === 3) return { ...g, stato: 'StatoInventato', note: '<script>alert(1)</script>' };
    return g;
  });
  const r = await put(2026, 6, CLI.it, sporchi);
  assert.equal(r.stato, 200);
  assert.ok(Number.isFinite(r.corpo.riepilogo.totaleOreDecimale));
  assert.ok(r.corpo.riepilogo.oreGiornaliere.every((g) => Number.isFinite(g.ore) && g.ore >= 0));
});

test('imprevisto: PUT senza giorni o con tipo sbagliato è rifiutato o gestito senza corrompere il mese', async () => {
  const prima = (await get(2026, 1)).corpo;
  for (const corpo of [{}, { giorni: 'x' }, { giorni: null }, { giorni: [null] }, { giorni: [1, 2] }, { giorni: {} }]) {
    const r = await amb.api('PUT', '/api/timesheet/2026/1/' + CLI.it, corpo);
    assert.equal(r.stato, 400, JSON.stringify(corpo));
  }
  assert.deepEqual((await get(2026, 1)).corpo.giorni, prima.giorni);
});

test('export VMS: CSV scaricabile con una riga per giorno compilato', async () => {
  const r = await amb.api('GET', `/api/timesheet/2026/2/${CLI.it}/export-vms`);
  assert.equal(r.stato, 200);
  assert.match(r.intestazioni.get('content-disposition'), /timesheet-2026-02\.csv/);
  assert.ok(r.testo.split('\n').length > 5);
});

test('elenco mesi disponibili riflette i timesheet salvati', async () => {
  const lista = (await amb.api('GET', '/api/timesheet')).corpo;
  assert.ok(lista.some((t) => t.anno === 2026 && t.mese === 3 && t.clienteId === CLI.it));
  assert.deepEqual(lista.map((t) => t.chiave), [...lista.map((t) => t.chiave)].sort());
});
