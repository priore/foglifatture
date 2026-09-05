import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcolaOreGiorno, calcolaTotaleMensile, decimaleAHHmm } from './timeCalculator.js';

test('giorno con orari standard 9:30-13:00 14:00-18:30 = 8 ore, stato vuoto (lavoro implicito)', () => {
  const ore = calcolaOreGiorno({
    stato: '',
    inizioMattina: '09:30', fineMattina: '13:00',
    inizioPomeriggio: '14:00', finePomeriggio: '18:30',
  });
  assert.equal(ore, 8);
});

test('stato di assenza non azzera le ore: permette assenze parziali (es. mezza giornata)', () => {
  const ore = calcolaOreGiorno({
    stato: 'Malattia',
    inizioMattina: '09:30', fineMattina: '13:00',
  });
  assert.equal(ore, 3.5);
});

test('orari mancanti o incoerenti non generano ore negative', () => {
  const ore = calcolaOreGiorno({ stato: '', fineMattina: '13:00' });
  assert.equal(ore, 0);
});

test('totale mensile somma correttamente più giorni', () => {
  const giorni = [
    { stato: '', inizioMattina: '09:30', fineMattina: '13:00', inizioPomeriggio: '14:00', finePomeriggio: '18:30' },
    { stato: 'Malattia' },
    { stato: '', inizioMattina: '09:30', fineMattina: '13:00', inizioPomeriggio: '14:00', finePomeriggio: '18:30' },
  ];
  assert.equal(calcolaTotaleMensile(giorni), 16);
});

test('decimaleAHHmm converte correttamente', () => {
  assert.equal(decimaleAHHmm(8.5), '08:30');
  assert.equal(decimaleAHHmm(160), '160:00');
});
