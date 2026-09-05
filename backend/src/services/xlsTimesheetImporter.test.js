import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estraiAnnoMeseDaNomeFile } from './xlsTimesheetImporter.js';

test('estraiAnnoMeseDaNomeFile riconosce nome mese italiano + anno', () => {
  assert.deepEqual(estraiAnnoMeseDaNomeFile('Agosto_2026_danilo_priore.xls'), { anno: 2026, mese: 8 });
});

test('estraiAnnoMeseDaNomeFile riconosce formato ISO anno-mese', () => {
  assert.deepEqual(estraiAnnoMeseDaNomeFile('2026-08_timesheet.xls'), { anno: 2026, mese: 8 });
});

test('estraiAnnoMeseDaNomeFile torna null se non riconoscibile', () => {
  assert.deepEqual(estraiAnnoMeseDaNomeFile('timesheet.xls'), { anno: null, mese: null });
});
