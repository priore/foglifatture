import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dedupScaduta, DEDUP_TTL_MS } from './notifier.js';

test('dedupScaduta — chiave assente: scaduta (prima notifica)', () => {
  assert.equal(dedupScaduta({}, 'k'), true);
});

test('dedupScaduta — chiave recente: non scaduta (non notificare)', () => {
  const ora = Date.now();
  const stato = { k: ora - 1000 }; // 1 secondo fa
  assert.equal(dedupScaduta(stato, 'k', ora), false);
});

test('dedupScaduta — chiave oltre TTL: scaduta (ri-notificare)', () => {
  const ora = Date.now();
  const stato = { k: ora - DEDUP_TTL_MS - 1 }; // oltre 24h fa
  assert.equal(dedupScaduta(stato, 'k', ora), true);
});

test('dedupScaduta — chiave esatta a TTL: scaduta (boundary inclusivo)', () => {
  const ora = Date.now();
  const stato = { k: ora - DEDUP_TTL_MS };
  assert.equal(dedupScaduta(stato, 'k', ora), true);
});

test('dedupScaduta — chiave diversa non tocca l\'altra', () => {
  const ora = Date.now();
  const stato = { a: ora - 1000 };
  assert.equal(dedupScaduta(stato, 'b', ora), true); // b non esiste → scaduta
  assert.equal(dedupScaduta(stato, 'a', ora), false); // a recente → non scaduta
});
