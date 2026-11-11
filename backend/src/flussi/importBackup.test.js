// Flusso utente: import dello storico (fatture XML singole e a lotto, ZIP) e backup cifrato
// (esporta → modifica/cancella → ripristina), con password errata, file corrotti e doppi invii.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { creaAmbiente } from './ambiente.js';
import { popolaModello, configModello, CLI, ANNO } from './datiModello.js';

let amb;
before(async () => { amb = await creaAmbiente(); await popolaModello(amb); });
after(async () => { await amb.chiudi(); });

const file = (nome, contenuto) => { const fd = new FormData(); fd.append('file', new Blob([contenuto]), nome); return fd; };
const xmlDi = async (mese, cli) => (await amb.api('GET', `/api/invoice/${ANNO}/${mese}/${cli}/xml`)).testo;

// Esegue `fn` su un archivio vuoto (stesso fornitore, un solo cliente) servito dallo stesso server.
const suAmbienteVuoto = (fn) => amb.conDatiVuoti(async () => {
  const cfg = configModello(amb.radice);
  await amb.api('PUT', '/api/config', { fornitore: cfg.fornitore, sdi: cfg.sdi, clienti: [cfg.clienti[0]] });
  return fn(amb);
});

test('import fattura XML: round-trip di una fattura emessa, segnata come storica e non rigenerabile', async () => {
  const xml = await xmlDi(1, CLI.it);
  const nome = 'IT01234567890_STORI.xml';
  await suAmbienteVuoto(async (b) => {
    const r = await b.api('POST', '/api/import/fattura', file(nome, xml));
    assert.equal(r.stato, 200, r.testo.slice(0, 200));
    assert.equal(r.corpo.numero, '1');
    assert.equal(r.corpo.importataDaStorico, true);
    const f = await b.api('GET', `/api/invoice/${ANNO}/1/${r.corpo.clienteId}`);
    assert.equal(f.stato, 200);
    const rigenera = await b.api('POST', `/api/invoice/${ANNO}/1/${r.corpo.clienteId}/genera`, { confermaSoglia: true });
    assert.equal(rigenera.stato, 409, 'fattura storica = già accettata');
  });
});

test('import: cliente sconosciuto creato dall\'anagrafica XML (mai sovrascrivendo un cliente esistente)', async () => {
  const xml = await xmlDi(1, CLI.rivalsa);
  await suAmbienteVuoto(async (b) => {
    const prima = (await b.api('GET', '/api/config')).corpo.clienti.length;
    const r = await b.api('POST', '/api/import/fattura', file('IT01234567890_NUOVO.xml', xml));
    assert.equal(r.stato, 200);
    const dopo = (await b.api('GET', '/api/config')).corpo.clienti;
    assert.equal(dopo.length, prima + 1);
    assert.ok(dopo.some((c) => c.denominazione === 'Cliente Rivalsa S.r.l.'));
  });
});

test('import imprevisto: nessun file, file spazzatura, fattura ricevuta, doppio import', async () => {
  assert.equal((await amb.api('POST', '/api/import/fattura', new FormData())).stato, 400);
  assert.equal((await amb.api('POST', '/api/import/fattura', file('x.xml', 'non è xml'))).stato, 400);
  assert.equal((await amb.api('POST', '/api/import/fattura', file('x.xml', '<A/>'))).stato, 400);

  const xml = await xmlDi(1, CLI.it);
  const ricevuta = xml.replaceAll('01234567890', '99999999999');
  const r = await amb.api('POST', '/api/import/fattura', file('ricevuta.xml', ricevuta));
  assert.equal(r.stato, 400);

  await suAmbienteVuoto(async (b) => {
    const a = await b.api('POST', '/api/import/fattura', file('doppia.xml', xml));
    const c = await b.api('POST', '/api/import/fattura', file('doppia.xml', xml));
    assert.equal(a.stato, 200);
    assert.ok([200, 400, 409].includes(c.stato));
    assert.equal((await b.api('GET', '/api/config/clienti/con-dati')).corpo.length, 1, 'nessun cliente duplicato');
  });
});

test('import a lotto: i file buoni passano, quelli rotti sono segnalati uno per uno', async () => {
  const buono = await xmlDi(2, CLI.it);
  await suAmbienteVuoto(async (b) => {
    const fd = new FormData();
    fd.append('file', new Blob([buono]), 'ok.xml');
    fd.append('file', new Blob(['rotto']), 'rotto.xml');
    const r = await b.api('POST', '/api/import/fattura-batch', fd);
    assert.equal(r.stato, 200);
    assert.deepEqual(r.corpo.risultati.map((x) => x.ok), [true, false]);
  });
  assert.equal((await amb.api('POST', '/api/import/fattura-batch', new FormData())).stato, 400);
});

test('import ZIP: file non zip rifiutato, senza file rifiutato', async () => {
  assert.equal((await amb.api('POST', '/api/import/zip/anteprima', file('a.zip', 'non uno zip'))).stato, 400);
  assert.equal((await amb.api('POST', '/api/import/zip/anteprima', new FormData())).stato, 400);
  assert.equal((await amb.api('POST', '/api/import/zip', new FormData())).stato, 400);
});

// ── Backup ─────────────────────────────────────────────────────
const stato = async () => ({
  config: (await amb.api('GET', '/api/config')).corpo.clienti.map((c) => c.id),
  fattura: (await amb.api('GET', `/api/invoice/${ANNO}/1/${CLI.it}`)).corpo,
  pagamenti: (await amb.api('GET', `/api/invoice/${ANNO}/2/${CLI.it}`)).corpo.pagamenti,
});

test('backup: esporta, rovina i dati, ripristina e tutto torna com\'era', async () => {
  const prima = await stato();
  const esporta = await amb.api('POST', '/api/backup/esporta', { password: 'password-di-prova-1' });
  assert.equal(esporta.stato, 200);
  assert.match(esporta.intestazioni.get('content-disposition'), /\.tsbk/);
  assert.ok(esporta.buffer.length > 200);
  assert.ok(!esporta.testo.includes('Studio Prova'), 'il contenuto è cifrato');

  // modifiche e cancellazioni dopo il backup
  const clienti = (await amb.api('GET', '/api/config')).corpo.clienti.filter((c) => c.id !== CLI.disattivo);
  await amb.api('PUT', '/api/config', { clienti: clienti.map((c) => ({ ...c, tariffaOraria: 1 })) });
  await amb.api('DELETE', `/api/forfettario/pagamenti/${ANNO}/2/${CLI.it}/0`);
  await amb.api('POST', `/api/forfettario/versamenti`, { data: `${ANNO}-12-01`, tipo: 'INPS', importo: 1 });

  const fd = new FormData();
  fd.append('file', new Blob([esporta.buffer]), 'backup.tsbk');
  fd.append('password', 'password-di-prova-1');
  const rip = await amb.api('POST', '/api/backup/ripristina', fd);
  assert.equal(rip.stato, 200, rip.testo.slice(0, 200));
  assert.ok(rip.corpo.fileRipristinati > 5);

  assert.deepEqual(await stato(), prima);
  assert.ok(!(await amb.api('GET', '/api/forfettario/versamenti')).corpo.some((v) => v.importo === 1 && v.tipo === 'INPS'));
});

test('backup imprevisto: password mancante/errata, file corrotto, troncato, nessun file', async () => {
  assert.equal((await amb.api('POST', '/api/backup/esporta', {})).stato, 400);
  const bk = await amb.api('POST', '/api/backup/esporta', { password: 'giusta-giusta' });
  const prima = await stato();
  const prova = (buffer, password) => { const fd = new FormData(); fd.append('file', new Blob([buffer]), 'b.tsbk'); if (password) fd.append('password', password); return amb.api('POST', '/api/backup/ripristina', fd); };
  assert.equal((await prova(bk.buffer, 'sbagliata')).stato, 400);
  assert.equal((await prova(bk.buffer)).stato, 400);
  const corrotto = Buffer.from(bk.buffer); corrotto[corrotto.length - 40] ^= 0xff;
  assert.equal((await prova(corrotto, 'giusta-giusta')).stato, 400);
  assert.equal((await prova(bk.buffer.subarray(0, 50), 'giusta-giusta')).stato, 400);
  assert.equal((await prova(Buffer.from('niente'), 'giusta-giusta')).stato, 400);
  assert.equal((await amb.api('POST', '/api/backup/ripristina', new FormData())).stato, 400);
  assert.deepEqual(await stato(), prima, 'nessun rifiuto ha toccato i dati');
});

test('impostazioni backup automatico: attivazione e disattivazione', async () => {
  const on = await amb.api('PUT', '/api/backup/impostazioni', { abilitato: true, intervalloOreMinuti: 60 });
  assert.equal(on.stato, 200);
  assert.equal(on.corpo.abilitato, true);
  const off = await amb.api('PUT', '/api/backup/impostazioni', { abilitato: false });
  assert.equal(off.corpo.abilitato, false);
});
