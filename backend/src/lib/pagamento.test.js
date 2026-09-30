import { test } from 'node:test';
import assert from 'node:assert/strict';
import { costruisciPagamento } from './pagamento.js';

const config = {
  fatturazione: { iban: 'it60 x054 2811 1010 0000 0123 456', intestatario: 'D', istitutoFinanziario: '', modalitaDefault: 'MP05', giorniScadenzaDefault: 30 },
  walletBtc: [{ etichetta: 'w', indirizzo: 'bc1qxyz' }],
};

test('default: bonifico con IBAN normalizzato, niente BTC', () => {
  const p = costruisciPagamento(config, { giorniScadenza: '' });
  assert.equal(p.iban, 'IT60X0542811101000000123456');
  assert.equal(p.giorniScadenza, 30);
  assert.equal(p.btcAddress, '');
});

test('modalità BTC o pagamentoBtc: indirizzo primo wallet; override giorni', () => {
  assert.equal(costruisciPagamento(config, { modalitaPagamento: 'BTC', giorniScadenza: 10 }).btcAddress, 'bc1qxyz');
  assert.equal(costruisciPagamento(config, { pagamentoBtc: true }).btcAddress, 'bc1qxyz');
  assert.equal(costruisciPagamento(config, { modalitaPagamento: 'BTC', giorniScadenza: 10 }).giorniScadenza, 10);
});

test('senza IBAN né indirizzo BTC: null', () => {
  assert.equal(costruisciPagamento({ ...config, fatturazione: { ...config.fatturazione, iban: '' } }, {}), null);
});
