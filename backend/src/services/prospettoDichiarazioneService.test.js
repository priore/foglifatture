import { test } from 'node:test';
import assert from 'node:assert/strict';
import { costruisciProspetto } from './prospettoDichiarazioneService.js';

const base = { coefficiente: 78, codiceAteco: '62.01.00', ricavi: 40000, aliquota: 5, contributiVersati: 5000,
  accontiVersati: 900, gestioneSeparata: true, aliquotaGs: 26.07, massimale: 122295, inpsAccontiVersati: 6000 };

test('catena LM: lordo, contributi, netto, imposta, saldo', () => {
  const v = costruisciProspetto(base);
  assert.equal(v['LM34.3'], 31200);
  assert.equal(v['LM36'], 26200);
  assert.equal(v['LM39'], 1310);
  assert.equal(v['LM46.1'], 410);
  assert.equal(v['LM47.1'], 0);
  assert.equal(v['RX31.1'], 410);
});

test('acconti oltre imposta: credito in LM47 e RX31 colonna 2', () => {
  const v = costruisciProspetto({ ...base, accontiVersati: 2000 });
  assert.equal(v['LM46.1'], 0);
  assert.equal(v['LM47.1'], 690);
  assert.equal(v['RX31.2'], 690);
});

test('contributi oltre il reddito: eccedenza in LM49', () => {
  const v = costruisciProspetto({ ...base, ricavi: 1000, contributiVersati: 1000 });
  assert.equal(v['LM35.2'], 780);
  assert.equal(v['LM49'], 220);
  assert.equal(v['LM39'], 0);
});

test('RR: imponibile al massimale, aliquota C, debito', () => {
  const v = costruisciProspetto(base);
  assert.equal(v['RR5.11'], 31200);
  assert.equal(v['RR5.14'], 'C');
  assert.equal(v['RR5.15'], 8134);
  assert.equal(v['RR7'], 2134);
});

test('senza gestione separata niente righi RR', () => {
  const v = costruisciProspetto({ ...base, gestioneSeparata: false });
  assert.equal('RR5.15' in v, false);
});
