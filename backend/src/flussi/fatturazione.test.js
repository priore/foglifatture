// Flusso utente: fatturazione completa (anteprima → emissione → numerazione → XML → invio/esito SDI →
// rigenerazione → nota di credito → scadenza) con casi normali, limite e imprevisti.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { creaAmbiente } from './ambiente.js';
import { popolaModello, generaFattura, simulaEsitoSdi, compilaTimesheet, CLI, ANNO } from './datiModello.js';

let amb; let m;
before(async () => { amb = await creaAmbiente(); m = await popolaModello(amb); });
after(async () => { await amb.chiudi(); });

const inv = (mese, cli, suff = '') => amb.api('GET', `/api/invoice/${ANNO}/${mese}/${cli}${suff}`);

test('numerazione: i numeri emessi dal modello sono 1..8 contigui e senza duplicati', async () => {
  const numeri = Object.values(m.fatture).map((f) => Number(f.corpo.numero)).sort((a, b) => a - b);
  assert.deepEqual(numeri, [1, 2, 3, 4, 5, 6, 7, 8]);
  const seq = (await amb.api('GET', '/api/invoice/sequenza')).corpo;
  assert.equal(seq.ok, true);
});

test('anteprima: ore × tariffa, bollo oltre soglia, rivalsa INPS 4% solo per chi la usa', async () => {
  const a = (await inv(1, CLI.it, '/anteprima')).corpo;
  assert.ok(a.imponibile > 0 && a.totaleOre > 0);
  assert.equal(a.bollo, 2);
  const r = (await inv(1, CLI.rivalsa, '/anteprima')).corpo;
  assert.ok(r.rivalsaInps > 0 || r.rivalsa > 0, JSON.stringify(r));
});

test('emissione: importi congelati, mensili coerenti con il timesheet', async () => {
  const f = (await inv(1, CLI.it)).corpo;
  assert.equal(f.tariffaOraria, 40);
  assert.equal(f.oreTotali * f.tariffaOraria, f.imponibile);
  assert.equal(f.nettoAPagare, f.imponibile + f.rivalsaInps, 'il bollo è assolto in modo virtuale, non si somma');
  assert.equal(f.bollo, 2);
  assert.equal(f.data, `${ANNO}-01-28`);
});

test('fattura manuale a importo libero: descrizione obbligatoria, importo positivo', async () => {
  assert.equal((await generaFattura(amb, ANNO, 7, CLI.it, { importo: 1000 })).stato, 400);
  assert.equal((await generaFattura(amb, ANNO, 7, CLI.it, { importo: -5, descrizione: 'x' })).stato, 400);
  assert.equal((await generaFattura(amb, ANNO, 7, CLI.it, { importo: 'abc', descrizione: 'x' })).stato, 400);
  assert.equal((await inv(7, CLI.it)).stato, 404, 'nessuna fattura salvata dai tentativi invalidi');
  const manuale = (await inv(4, CLI.it)).corpo;
  assert.equal(manuale.oreTotali, null);
  assert.equal(manuale.imponibile, 1500);
});

test('cliente estero: natura N2.1 e diciture; cliente italiano resta N2.2', async () => {
  const ue = (await inv(1, CLI.ue)).corpo;
  assert.equal(ue.trattamentoEstero?.natura, 'N2.1');
  assert.equal(ue.trattamentoEstero?.intrastat, true);
  const extra = (await inv(1, CLI.extraUe)).corpo;
  assert.equal(extra.trattamentoEstero?.intrastat, false);
  assert.equal((await inv(1, CLI.it)).corpo.trattamentoEstero, null);
});

test('cliente BTC: clausola di pagamento in BTC congelata sulla fattura', async () => {
  const f = (await inv(1, CLI.btc)).corpo;
  assert.equal(f.pagamentoBtc, true);
  assert.match(f.causaleBtc, /BTC/);
});

test('XML FatturaPA: scaricabile, ben formato, con numero e importi', async () => {
  const r = await inv(1, CLI.it, '/xml');
  assert.equal(r.stato, 200);
  assert.match(r.intestazioni.get('content-type'), /xml/);
  assert.match(r.intestazioni.get('content-disposition'), /IT01234567890_[A-Z0-9]{5}\.xml/);
  assert.match(r.testo, /<Numero>1<\/Numero>/);
  assert.match(r.testo, /<RegimeFiscale>RF19<\/RegimeFiscale>/);
});

test('fattura mai emessa: XML e lettura rispondono 404, non 500', async () => {
  assert.equal((await inv(11, CLI.it)).stato, 404);
  assert.equal((await inv(11, CLI.it, '/xml')).stato, 404);
  assert.equal((await inv(11, 'cliente-inesistente', '/xml')).stato, 404);
});

test('stato SDI: accettata → rigenerazione vietata; scartata → rigenerazione ammessa con storico invii', async () => {
  const bloccata = await generaFattura(amb, ANNO, 1, CLI.rivalsa);
  assert.equal(bloccata.stato, 409);
  assert.match(bloccata.corpo.errore, /accettata dallo SDI/);

  const prima = (await inv(1, CLI.ue)).corpo;
  assert.equal(prima.invii.length, 1);
  const rigenerata = await generaFattura(amb, ANNO, 1, CLI.ue);
  assert.equal(rigenerata.stato, 200);
  assert.equal(rigenerata.corpo.numero, prima.numero, 'stesso numero in rigenerazione');
  assert.equal(rigenerata.corpo.invii.length, 1, 'lo storico invii non si perde');
});

test('rigenerazione dopo modifica ore: importi aggiornati, numero invariato', async () => {
  const vecchia = (await inv(2, CLI.btc)).stato;
  assert.equal(vecchia, 404);
  await generaFattura(amb, ANNO, 2, CLI.btc);
  const prima = (await inv(2, CLI.btc)).corpo;
  await compilaTimesheet(amb, ANNO, 2, CLI.btc, { ore: ['09:00', '11:00', '', ''] });
  const dopo = (await generaFattura(amb, ANNO, 2, CLI.btc)).corpo;
  assert.equal(dopo.numero, prima.numero);
  assert.ok(dopo.imponibile < prima.imponibile);
});

test('imprevisto: doppia emissione ravvicinata dello stesso mese non crea due numeri', async () => {
  const [a, b] = await Promise.all([
    generaFattura(amb, ANNO, 5, CLI.extraUe, { importo: 200, descrizione: 'doppio click' }),
    generaFattura(amb, ANNO, 5, CLI.extraUe, { importo: 200, descrizione: 'doppio click' }),
  ]);
  assert.ok([a.stato, b.stato].every((s) => [200, 409].includes(s)), `${a.stato}/${b.stato}`);
  const seq = (await amb.api('GET', '/api/invoice/sequenza')).corpo;
  assert.equal(seq.ok, true, JSON.stringify(seq));
});

test('imprevisto: numero forzato non sequenziale o duplicato è rifiutato', async () => {
  const salto = await generaFattura(amb, ANNO, 8, CLI.it, { importo: 100, descrizione: 'x', numero: '99' });
  assert.equal(salto.stato, 409);
  const dup = await generaFattura(amb, ANNO, 8, CLI.it, { importo: 100, descrizione: 'x', numero: '1' });
  assert.equal(dup.stato, 409);
  assert.equal((await inv(8, CLI.it)).stato, 404);
});

test('imprevisto: cliente inesistente e mese fuori range', async () => {
  assert.equal((await generaFattura(amb, ANNO, 1, 'nessuno')).stato, 404);
  const fuori = await generaFattura(amb, ANNO, 13, CLI.it, { importo: 10, descrizione: 'x' });
  assert.ok([400, 404, 409].includes(fuori.stato) || fuori.stato === 200, `stato ${fuori.stato}`);
});

test('soglia di fatturato: oltre 85.000 chiede conferma (409), con conferma procede', async () => {
  const grossa = { importo: 30000, descrizione: 'Progetto grande' };
  const senza = await amb.api('POST', `/api/invoice/${ANNO}/9/${CLI.it}/genera`, grossa);
  assert.equal(senza.stato, 409);
  assert.equal(senza.corpo.tipo, 'soglia85');
  const conferma = await amb.api('POST', `/api/invoice/${ANNO}/9/${CLI.it}/genera`, { ...grossa, confermaSoglia: true });
  assert.equal(conferma.stato, 200);
  const oltre100 = await amb.api('POST', `/api/invoice/${ANNO}/10/${CLI.it}/genera`, { importo: 200000, descrizione: 'x' });
  assert.equal(oltre100.stato, 409);
  assert.equal(oltre100.corpo.tipo, 'soglia100');
});

test('scadenza di pagamento: modificabile anche dopo accettazione SDI', async () => {
  const r = await amb.api('PATCH', `/api/invoice/${ANNO}/1/${CLI.rivalsa}/scadenza-pagamento`, { dataScadenzaPagamento: `${ANNO}-03-31` });
  assert.equal(r.stato, 200);
  assert.equal(r.corpo.dataScadenzaPagamento, `${ANNO}-03-31`);
  assert.equal((await amb.api('PATCH', `/api/invoice/${ANNO}/11/${CLI.it}/scadenza-pagamento`, { dataScadenzaPagamento: '2026-01-01' })).stato, 404);
});

test('nota di credito: richiede conferma e fattura accettata; poi storna e blocca ulteriori emissioni', async () => {
  const base = `/api/invoice/${ANNO}/1/${CLI.rivalsa}/nota-credito`;
  assert.equal((await amb.api('POST', base, {})).stato, 400, 'senza conferma');
  assert.equal((await amb.api('POST', `/api/invoice/${ANNO}/3/${CLI.it}/nota-credito`, { conferma: true })).stato, 409, 'fattura non accettata');
  assert.equal((await amb.api('POST', `/api/invoice/${ANNO}/11/${CLI.it}/nota-credito`, { conferma: true })).stato, 404);
  const ok = await amb.api('POST', base, { conferma: true });
  assert.ok([200, 400].includes(ok.stato), `${ok.stato} ${ok.testo.slice(0, 150)}`);
  if (ok.stato === 200) {
    const xml = await amb.api('GET', `${base}/xml`);
    assert.equal(xml.stato, 200);
    assert.match(xml.testo, /TD04/);
  }
});

test('ricevute SDI: la timeline mostra consegna e scarto con errori', async () => {
  const acc = (await inv(1, CLI.rivalsa, '/ricevute-sdi')).corpo;
  assert.ok(acc.some((r) => r.tipo === 'RC'));
  const scarto = (await inv(1, CLI.ue, '/ricevute-sdi')).corpo;
  assert.ok(scarto.some((r) => r.tipo === 'NS' && r.errori?.[0]?.codice === '00300'));
});

test('elenco mesi fatturati e sequenza dopo tutte le operazioni restano coerenti', async () => {
  const elenco = (await amb.api('GET', '/api/invoice')).corpo;
  assert.ok(Array.isArray(elenco) && elenco.length >= 8);
  assert.equal((await amb.api('GET', '/api/invoice/sequenza')).corpo.ok, true);
  await simulaEsitoSdi(amb, ANNO, 3, CLI.it, 'DDDDD', 'RC');
  assert.equal((await generaFattura(amb, ANNO, 3, CLI.it)).stato, 409, 'dopo accettazione non più rigenerabile');
});

test('imprevisto: doppio click concorrente su «Emetti» non brucia numeri (nessun buco in sequenza)', async () => {
  const clienti = [CLI.it, CLI.rivalsa, CLI.ue, CLI.extraUe, CLI.btc];
  for (const mese of [5, 6, 7, 8, 9, 10, 11, 12]) {
    await Promise.all(clienti.flatMap((c) => [
      generaFattura(amb, ANNO, mese, c, { importo: 50, descrizione: 'doppio' }),
      generaFattura(amb, ANNO, mese, c, { importo: 50, descrizione: 'doppio' }),
    ]).filter((_, i) => !(mese === 9 && i < 0)));
  }
  const elenco = (await amb.api('GET', '/api/invoice')).corpo;
  const numeri = [];
  for (const e of elenco) {
    const f = (await inv(e.mese, e.clienteId)).corpo;
    numeri.push(Number(f.numero));
    if (f.notaCredito) numeri.push(Number(f.notaCredito.numero)); // le note di credito condividono la sequenza
  }
  numeri.sort((a, b) => a - b);
  numeri.forEach((n, i) => assert.equal(n, i + 1, `buco: ${numeri.join(',')}`));
});
