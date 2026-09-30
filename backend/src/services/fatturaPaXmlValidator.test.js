import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validaDatiFatturaPA } from './fatturaPaXmlValidator.js';

const fornitore = {
  denominazione: 'Danilo Priore', partitaIva: '11111111111', codiceFiscale: 'PRRDNL80A01H501X',
  indirizzo: 'Via Esempio', cap: '00100', comune: 'Roma', provincia: 'RM',
};
const cliente = {
  denominazione: 'Azienda Cliente Srl', partitaIva: '22222222222', codiceDestinatarioSdi: '0000000',
  indirizzo: 'Via Cliente', cap: '20100', comune: 'Milano', provincia: 'MI',
};
const fattura = {
  numero: '1', data: '2026-08-31', descrizione: 'Servizi IT', imponibile: 100, progressivoInvio: 1,
};

test('dati conformi: nessun errore', () => {
  const r = validaDatiFatturaPA({ fornitore, cliente, fattura });
  assert.equal(r.valido, true);
  assert.deepEqual(r.errori, []);
});

test('partita IVA troncata (bug reale: 165 invece di 00165) viene rilevata', () => {
  const r = validaDatiFatturaPA({ fornitore, cliente: { ...cliente, codiceDestinatarioSdi: '165' }, fattura });
  assert.equal(r.valido, false);
  assert.match(r.errori.join(';'), /Codice Destinatario SDI cliente/);
});

test('campi mancanti riportati singolarmente', () => {
  const r = validaDatiFatturaPA({ fornitore: { ...fornitore, cap: '' }, cliente, fattura: { ...fattura, numero: '' } });
  assert.equal(r.valido, false);
  assert.match(r.errori.join(';'), /CAP fornitore/);
  assert.match(r.errori.join(';'), /Numero fattura/);
});

test('data fattura nel futuro (fuso Europe/Rome) rifiutata, oggi e passato ok', () => {
  const adesso = new Date('2026-08-31T22:30:00Z'); // 1/9 00:30 a Roma
  const esito = (data) => validaDatiFatturaPA({ fornitore, cliente, fattura: { ...fattura, data } }, adesso);
  assert.equal(esito('2026-09-01').valido, true);
  assert.equal(esito('2026-08-31').valido, true);
  const futura = esito('2026-09-02');
  assert.equal(futura.valido, false);
  assert.match(futura.errori.join(';'), /00403/);
});

test('IBAN in fattura non valido rifiutato per bonifico, ignorato per contanti', () => {
  const pagamento = { modalita: 'MP05', iban: 'IT61X0542811101000000123456' };
  assert.match(validaDatiFatturaPA({ fornitore, cliente, fattura: { ...fattura, pagamento } }).errori.join(';'), /IBAN/);
  assert.equal(validaDatiFatturaPA({ fornitore, cliente, fattura: { ...fattura, pagamento: { ...pagamento, modalita: 'MP01' } } }).valido, true);
});
