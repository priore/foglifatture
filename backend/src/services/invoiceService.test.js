import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

// clienteId realistico (non numerico) per evitare falsi positivi se qualcuno per errore
// facesse rientrare l'id nel calcolo Number(f.numero).
const CLI_A = 'a1b2c3d4-cliA';
const CLI_B = 'e5f6a7b8-cliB';
const CLI_C = 'c9d0e1f2-cliC';

mock.module('../lib/jsonStore.js', {
  exports: {
    readJson: async (relativePath) => {
      const chiave = relativePath.replace('invoices/', '').replace('.json', '');
      const store = {
        [`2026-01-${CLI_A}`]: { anno: 2026, mese: 1, clienteId: CLI_A, numero: '1' },
        [`2026-01-${CLI_B}`]: { anno: 2026, mese: 1, clienteId: CLI_B, numero: '2' },
        [`2026-02-${CLI_A}`]: { anno: 2026, mese: 2, clienteId: CLI_A, numero: '3' },
      };
      return store[chiave] ?? null;
    },
    writeJson: async () => {},
    listKeys: async () => [`2026-01-${CLI_A}`, `2026-01-${CLI_B}`, `2026-02-${CLI_A}`],
  },
});

const { verificaIntegritaNumerazione, prossimoProgressivoInvio } = await import('./invoiceService.js');

test('prossimo progressivo invio rispetta le regole di nomenclatura SDI (max 5 char, A-Z0-9), univoco ad ogni chiamata', () => {
  const a = prossimoProgressivoInvio();
  const b = prossimoProgressivoInvio();
  assert.match(a, /^[A-Z0-9]{5}$/);
  assert.notEqual(a, b);
});

test('numero sequenziale successivo è valido', async () => {
  const risultato = await verificaIntegritaNumerazione(2026, 3, CLI_A, '4');
  assert.equal(risultato.valido, true);
});

test('numero con salto viene rifiutato', async () => {
  const risultato = await verificaIntegritaNumerazione(2026, 3, CLI_A, '6');
  assert.equal(risultato.valido, false);
  assert.match(risultato.errore, /non sequenziale/);
});

test('numero duplicato viene rifiutato', async () => {
  const risultato = await verificaIntegritaNumerazione(2026, 3, CLI_A, '2');
  assert.equal(risultato.valido, false);
  assert.match(risultato.errore, /già usato/);
});

test('rigenerazione dello stesso mese/cliente riusa il proprio numero senza falso duplicato', async () => {
  const risultato = await verificaIntegritaNumerazione(2026, 2, CLI_A, '3');
  assert.equal(risultato.valido, true);
});

test('due clienti nello stesso mese devono avere numeri progressivi distinti: duplicato tra clienti viene rifiutato', async () => {
  // CLI_C prova a riusare il numero 2, già assegnato a CLI_B nello stesso mese 2026-01.
  const risultato = await verificaIntegritaNumerazione(2026, 1, CLI_C, '2');
  assert.equal(risultato.valido, false);
  assert.match(risultato.errore, /già usato/);
});

test('rigenerazione di una fattura non più ultima nella sequenza globale riusa comunque il proprio numero', async () => {
  // CLI_A/gennaio ha numero 1, ma CLI_B/gennaio (numero 2) è stato generato dopo:
  // rigenerare CLI_A non deve fallire solo perché non è più "l'ultimo" della sequenza.
  const risultato = await verificaIntegritaNumerazione(2026, 1, CLI_A, '1');
  assert.equal(risultato.valido, true);
});

test('un terzo cliente nello stesso mese di uno già fatturato prende il progressivo successivo, non un numero per-cliente', async () => {
  // CLI_C fattura a marzo (mese nuovo, dopo l'ultima fattura esistente CLI_A/febbraio=3):
  // il numero atteso è 4, cross-cliente — non riparte da 1 solo perché è il primo mese di CLI_C.
  const risultato = await verificaIntegritaNumerazione(2026, 3, CLI_C, '4');
  assert.equal(risultato.valido, true);
});

test('clienteId non entra mai nel calcolo del progressivo (nessuna alterazione da id non numerico)', async () => {
  // Se clienteId leakasse in Number(f.numero), il conteggio "prossimo numero" o la
  // sequenza attesa risulterebbero NaN/sballati. Qui verifichiamo che il numero atteso
  // resti 4 (dopo 1,2,3) nonostante i clienteId siano stringhe alfanumeriche con trattini.
  const risultato = await verificaIntegritaNumerazione(2026, 3, CLI_A, '4');
  assert.equal(risultato.valido, true);
});
