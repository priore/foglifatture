import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcolaNotifiche, appiattisciBollo } from './notificheFiscaliService.js';

const vuoto = { f24List: [], scadenzeBollo: [], crediti: [], stato: { aggiornamentoDisponibile: false, annoDisponibile: null, annoAttivo: null }, scadenzeIntrastat: [] };

test('nessun dato — nessuna notifica', () => {
  assert.deepEqual(calcolaNotifiche('2026-10-13', '2026-10-20', vuoto), []);
});

test('OS.1 — F24 da_pagare scaduto', () => {
  const input = { ...vuoto, f24List: [{ id: 'x1', stato: 'da_pagare', dataPagamento: '2026-10-10' }] };
  const r = calcolaNotifiche('2026-10-13', '2026-10-20', input);
  assert.equal(r.length, 1);
  assert.equal(r[0].chiave, 'f24-scaduto-x1');
});

test('OS.1 — F24 da_pagare imminente (nella finestra)', () => {
  const input = { ...vuoto, f24List: [{ id: 'x2', stato: 'da_pagare', dataPagamento: '2026-10-18' }] };
  const r = calcolaNotifiche('2026-10-13', '2026-10-20', input);
  assert.equal(r.length, 1);
  assert.equal(r[0].chiave, 'f24-imminente-x2');
});

test('OS.1 — F24 da_pagare fuori finestra — silenzioso', () => {
  const input = { ...vuoto, f24List: [{ id: 'x3', stato: 'da_pagare', dataPagamento: '2026-11-30' }] };
  assert.equal(calcolaNotifiche('2026-10-13', '2026-10-20', input).length, 0);
});

test('OS.1 — F24 pagato non notificato', () => {
  const input = { ...vuoto, f24List: [{ id: 'x4', stato: 'pagato', dataPagamento: '2026-10-10' }] };
  assert.equal(calcolaNotifiche('2026-10-13', '2026-10-20', input).length, 0);
});

test('OS.2 — F24 programmato: annullabileEntro oggi', () => {
  const input = { ...vuoto, f24List: [{ id: 'y1', stato: 'programmato', dataPagamento: '2026-10-16', annullabileEntro: '2026-10-13' }] };
  const r = calcolaNotifiche('2026-10-13', '2026-10-20', input);
  assert.equal(r.length, 1);
  assert.equal(r[0].chiave, 'f24-annullabile-y1');
});

test('OS.2 — annullabileEntro domani — silenzioso', () => {
  const input = { ...vuoto, f24List: [{ id: 'y2', stato: 'programmato', dataPagamento: '2026-10-17', annullabileEntro: '2026-10-14' }] };
  assert.equal(calcolaNotifiche('2026-10-13', '2026-10-20', input).length, 0);
});

test('OS.3 — bollo imminente con importo', () => {
  const input = { ...vuoto, scadenzeBollo: [{ data: '2026-10-15', importo: 12, anno: 2026, trimestre: 3 }] };
  const r = calcolaNotifiche('2026-10-13', '2026-10-20', input);
  assert.equal(r.length, 1);
  assert.equal(r[0].chiave, 'bollo-2026-Q3');
});

test('OS.3 — bollo importo 0 — silenzioso', () => {
  const input = { ...vuoto, scadenzeBollo: [{ data: '2026-10-15', importo: 0, anno: 2026, trimestre: 3 }] };
  assert.equal(calcolaNotifiche('2026-10-13', '2026-10-20', input).length, 0);
});

test('OS.4 — credito raggiunge utilizzabileDal oggi', () => {
  const input = { ...vuoto, crediti: [{ id: 'c1', utilizzabileDal: '2026-10-13', residuo: 500 }] };
  const r = calcolaNotifiche('2026-10-13', '2026-10-20', input);
  assert.equal(r.length, 1);
  assert.equal(r[0].chiave, 'credito-usabile-c1');
});

test('OS.4 — credito già usabile ieri — silenzioso', () => {
  const input = { ...vuoto, crediti: [{ id: 'c2', utilizzabileDal: '2026-10-12', residuo: 500 }] };
  assert.equal(calcolaNotifiche('2026-10-13', '2026-10-20', input).length, 0);
});

test('OS.5 — regole mancanti (nessuna attiva)', () => {
  const stato = { aggiornamentoDisponibile: true, annoDisponibile: 2026, annoAttivo: null };
  const r = calcolaNotifiche('2026-10-13', '2026-10-20', { ...vuoto, stato });
  assert.equal(r.length, 1);
  assert.equal(r[0].chiave, 'regole-mancanti-2026');
});

test('OS.5 — aggiornamento disponibile (già attive, nuove disponibili)', () => {
  const stato = { aggiornamentoDisponibile: true, annoDisponibile: 2026, annoAttivo: 2026 };
  const r = calcolaNotifiche('2026-10-13', '2026-10-20', { ...vuoto, stato });
  assert.equal(r.length, 1);
  assert.equal(r[0].chiave, 'regole-update-2026');
});

test('OS.5 — regole ok — silenzioso', () => {
  const stato = { aggiornamentoDisponibile: false, annoDisponibile: 2026, annoAttivo: 2026 };
  assert.equal(calcolaNotifiche('2026-10-13', '2026-10-20', { ...vuoto, stato }).length, 0);
});

test('OS.7 — intrastat imminente', () => {
  const scadenzeIntrastat = [{ data: '2026-10-14', tipo: 'Intrastat servizi resi', descrizione: 'III trim. 2026: elenco' }];
  const r = calcolaNotifiche('2026-10-13', '2026-10-20', { ...vuoto, scadenzeIntrastat });
  assert.equal(r.length, 1);
  assert.match(r[0].chiave, /^intrastat-/);
});

test('OS.7 — intrastat fuori finestra — silenzioso', () => {
  const scadenzeIntrastat = [{ data: '2026-11-25', tipo: 'Intrastat servizi resi', descrizione: 'III trim. 2026' }];
  assert.equal(calcolaNotifiche('2026-10-13', '2026-10-20', { ...vuoto, scadenzeIntrastat }).length, 0);
});

test('appiattisciBollo: scadenzeBollo restituisce un oggetto, le voci portano l\'anno; errori (null) ignorati', () => {
  const sb = appiattisciBollo([{ anno: 2026, scadenze: [{ trimestre: 3, data: '2026-10-15', importo: 12 }] }, null]);
  assert.deepEqual(sb, [{ trimestre: 3, data: '2026-10-15', importo: 12, anno: 2026 }]);
  const n = calcolaNotifiche('2026-10-10', '2026-10-17', { ...vuoto, scadenzeBollo: sb });
  assert.equal(n[0].chiave, 'bollo-2026-Q3');
});
