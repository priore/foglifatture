import { test } from 'node:test';
import assert from 'node:assert/strict';
import { preparaDatiFattura } from './useTemplateData.js';

const base = {
  fornitore: { denominazione: 'Studio Prova' }, numero: '1', imponibile: 100, nettoAPagare: 100,
  pagamento: { modalita: 'MP05', iban: 'IT60X0542811101000000123456', intestatario: 'Mario Rossi', btcAddress: '', giorniScadenza: 30 },
};

test('anteprima di una fattura non ancora emessa (data vuota): nessuna eccezione, scadenza vuota', () => {
  for (const data of ['', undefined, 'non-una-data']) {
    const d = preparaDatiFattura({ ...base, data });
    assert.equal(typeof d.pagamento.scadenzaFormattata, 'string');
  }
});

test('con data valida la scadenza è la data più i giorni di scadenza', () => {
  const d = preparaDatiFattura({ ...base, data: '2026-01-31' });
  assert.match(d.pagamento.scadenzaFormattata, /02\/03\/2026|2 mar|2\/3\/2026/i);
});
