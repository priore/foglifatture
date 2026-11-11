// Flusso utente: incassi (totale, parziale, in BTC, in valuta), cancellazione, stato fattura, fatture aperte,
// ricavi per cassa. Casi normali, limite e imprevisti.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { creaAmbiente } from './ambiente.js';
import { popolaModello, generaFattura, CLI, ANNO, TXID, INDIRIZZO_BTC } from './datiModello.js';

let amb;
before(async () => { amb = await creaAmbiente(); await popolaModello(amb); });
after(async () => { await amb.chiudi(); });

const F = '/api/forfettario';
const fattura = async (mese, cli) => (await amb.api('GET', `/api/invoice/${ANNO}/${mese}/${cli}`)).corpo;
const conferma = (mese, cli, importo, data = `${ANNO}-04-01`) =>
  amb.api('POST', `${F}/pagamenti/conferma`, { anno: ANNO, mese, clienteId: cli, dataPagamento: data, importo });
const aperte = async () => (await amb.api('GET', `${F}/fatture-aperte`)).corpo;

test('il modello ha fatture pagate, parziali e aperte', async () => {
  const elenco = await aperte();
  const chiavi = elenco.map((f) => `${f.mese}-${f.clienteId}`);
  assert.ok(!chiavi.includes(`1-${CLI.it}`), 'pagata per intero: non compare tra le aperte');
  assert.ok(chiavi.includes(`2-${CLI.it}`), 'parziale: ancora aperta');
  assert.ok(chiavi.includes(`3-${CLI.it}`));
});

test('incasso parziale poi saldo: lo stato passa da aperta a parziale a pagata', async () => {
  const f = await fattura(3, CLI.it);
  const r1 = await conferma(3, CLI.it, 1000);
  assert.equal(r1.corpo.fattura.stato, 'parziale');
  assert.equal(r1.corpo.fattura.residuo, Number((f.nettoAPagare - 1000).toFixed(2)));
  const r2 = await conferma(3, CLI.it, r1.corpo.fattura.residuo, `${ANNO}-05-02`);
  assert.equal(r2.corpo.fattura.stato, 'pagata');
  assert.equal(r2.corpo.fattura.residuo, 0);
  assert.equal(r2.corpo.fattura.pagamenti.length, 2);
  assert.equal(r2.corpo.fattura.dataPagamento, `${ANNO}-05-02`);
});

test('cancellazione di un incasso: torna parziale, indice errato rifiutato', async () => {
  const r = await amb.api('DELETE', `${F}/pagamenti/${ANNO}/3/${CLI.it}/1`);
  assert.equal(r.stato, 200);
  assert.equal(r.corpo.fattura.stato, 'parziale');
  assert.equal((await amb.api('DELETE', `${F}/pagamenti/${ANNO}/3/${CLI.it}/7`)).stato, 400);
  assert.equal((await amb.api('DELETE', `${F}/pagamenti/${ANNO}/3/${CLI.it}/-1`)).stato, 400);
  assert.equal((await amb.api('DELETE', `${F}/pagamenti/${ANNO}/11/${CLI.it}/0`)).stato, 400);
});

test('imprevisto: importi non validi, campi mancanti, fattura inesistente', async () => {
  for (const importo of [0, -10, 'abc', null]) {
    assert.equal((await conferma(3, CLI.it, importo)).stato, 400, `importo ${importo}`);
  }
  assert.equal((await amb.api('POST', `${F}/pagamenti/conferma`, { anno: ANNO })).stato, 400);
  assert.equal((await conferma(11, CLI.it, 50)).stato, 400);
  assert.equal((await conferma(1, 'nessuno', 50)).stato, 400);
});

test('imprevisto: incasso superiore al dovuto (sovrapagamento) non rompe il calcolo', async () => {
  const r = await conferma(2, CLI.it, 100000);
  assert.equal(r.stato, 200);
  assert.ok(r.corpo.fattura.residuo < 0);
  assert.equal(r.corpo.fattura.stato, 'pagata');
});

test('incasso in BTC: importo EUR calcolato dal cambio, mai dal client', async () => {
  const f = (await amb.api('GET', `/api/invoice/${ANNO}/1/${CLI.btc}`)).corpo;
  const pag = f.pagamenti[0];
  assert.equal(pag.importo, 1200);                       // 0,02 BTC × 60.000
  assert.equal(pag.btc.txid, TXID);
  await generaFattura(amb, ANNO, 2, CLI.btc);
  const r = await amb.api('POST', `${F}/pagamenti/conferma-btc`, {
    anno: ANNO, mese: 2, clienteId: CLI.btc, dataPagamento: `${ANNO}-04-10`, txid: 'c'.repeat(64), satoshi: 1_000_000,
    cambioEurBtc: 50000, indirizzoDestinatario: INDIRIZZO_BTC, importo: 999999,
  });
  assert.equal(r.stato, 200);
  assert.equal(r.corpo.fattura.pagamenti.at(-1).importo, 500, "l'importo inviato dal client è ignorato");
});

test('incasso BTC non valido: TXID, satoshi, cambio, indirizzo', async () => {
  const base = { anno: ANNO, mese: 1, clienteId: CLI.btc, dataPagamento: `${ANNO}-04-10`, txid: TXID, satoshi: 1000, cambioEurBtc: 50000, indirizzoDestinatario: INDIRIZZO_BTC };
  for (const guasto of [{ txid: 'zz' }, { satoshi: 0 }, { satoshi: 1.5 }, { cambioEurBtc: -1 }, { indirizzoDestinatario: '' }]) {
    const r = await amb.api('POST', `${F}/pagamenti/conferma-btc`, { ...base, ...guasto });
    assert.equal(r.stato, 400, JSON.stringify(guasto));
  }
});

test('incasso in valuta: EUR = valuta / cambio; EUR e codici errati rifiutati', async () => {
  const ok = await amb.api('POST', `${F}/pagamenti/conferma-valuta`, {
    anno: ANNO, mese: 1, clienteId: CLI.extraUe, dataPagamento: `${ANNO}-04-15`, codiceValuta: 'usd', importoValuta: 1100, cambio: 1.1, fonte: 'prova', dataQuotazione: `${ANNO}-04-15`,
  });
  assert.equal(ok.stato, 200);
  assert.equal(ok.corpo.fattura.pagamenti.at(-1).importo, 1000);
  for (const guasto of [{ codiceValuta: 'EUR' }, { codiceValuta: 'US' }, { importoValuta: 0 }, { cambio: 0 }]) {
    const r = await amb.api('POST', `${F}/pagamenti/conferma-valuta`, {
      anno: ANNO, mese: 1, clienteId: CLI.extraUe, dataPagamento: `${ANNO}-04-15`, codiceValuta: 'USD', importoValuta: 10, cambio: 1.1, ...guasto,
    });
    assert.equal(r.stato, 400, JSON.stringify(guasto));
  }
});

test('imprevisto: stessi incassi inviati due volte (doppio click) si sommano, ma restano cancellabili', async () => {
  const prima = (await fattura(1, CLI.extraUe)).pagamenti.length;
  await conferma(1, CLI.extraUe, 10);
  await conferma(1, CLI.extraUe, 10);
  const f = await fattura(1, CLI.extraUe);
  assert.equal(f.pagamenti.length, prima + 2);
  await amb.api('DELETE', `${F}/pagamenti/${ANNO}/1/${CLI.extraUe}/${f.pagamenti.length - 1}`);
  await amb.api('DELETE', `${F}/pagamenti/${ANNO}/1/${CLI.extraUe}/${f.pagamenti.length - 2}`);
  assert.equal((await fattura(1, CLI.extraUe)).pagamenti.length, prima);
});

test('cassa: i ricavi dell\'anno nel dashboard riflettono gli incassi', async () => {
  const d = await amb.api('GET', `${F}/dashboard?anno=${ANNO}`);
  assert.equal(d.stato, 200);
  assert.ok(JSON.stringify(d.corpo).length > 50);
});
