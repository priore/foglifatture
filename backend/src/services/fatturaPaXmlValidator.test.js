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
