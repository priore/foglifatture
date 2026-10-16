import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TOOLS, gestisciRichiesta, proiettaRiepilogo, proiettaScadenze, proiettaF24,
  proiettaBollo, proiettaCrediti, proiettaFatture,
} from './mcpService.js';

// Guard allowlist: ogni fixture porta campi segreti/anagrafici noti; nessuno deve uscire.
const VELENO = {
  password: 'SEGRETO_TEST', apiKey: 'KEY_TEST', codiceFiscale: 'CF_TEST', iban: 'IBAN_TEST',
  email: 'EMAIL_TEST', token: 'TOKEN_TEST', note: 'NOTE_TEST', walletBtc: 'BTC_TEST',
};
const MARCATORI = ['SEGRETO_TEST', 'KEY_TEST', 'CF_TEST', 'IBAN_TEST', 'EMAIL_TEST', 'TOKEN_TEST', 'NOTE_TEST', 'BTC_TEST'];

function nessunSegreto(output) {
  const testo = JSON.stringify(output);
  for (const m of MARCATORI) assert.ok(!testo.includes(m), `campo non in allowlist uscito: ${m}`);
}

test('proiettaRiepilogo: campi attesi, nessun segreto', () => {
  const out = proiettaRiepilogo({
    ...VELENO, anno: 2026, ricaviCumulati: 50000, sogliaAnnua: 85000, aliquota: 5, sogliaUscitaImmediata: 100000,
    cassa: { ...VELENO, ricaviCumulati: 40000, percentualeSoglia: 47.1, statoSoglia: 'ok', impostaStimata: 1000,
      nonIncassateEmesseAnno: [{ residuo: 100.5, ...VELENO }, { residuo: 50, ...VELENO }] },
  });
  assert.equal(out.daIncassare, 150.5);
  assert.equal(out.percentualeSogliaUscita, 40);
  assert.equal(out.incassato, 40000);
  nessunSegreto(out);
});

test('proiettaScadenze / proiettaF24 / proiettaBollo / proiettaCrediti: nessun segreto', () => {
  nessunSegreto(proiettaScadenze([{ tipo: 'X', data: '2026-06-30', ...VELENO }]));

  const f24 = proiettaF24([{ id: 'a', stato: 'pagato', dataPagamento: '2026-06-30', ...VELENO,
    righe: [{ codice: '1792', importo: 100, annoRiferimento: 2025, ...VELENO }, { codice: '1790', importo: 50.25, ...VELENO }] }]);
  assert.equal(f24.f24[0].totale, 150.25);
  nessunSegreto(f24);

  const bollo = proiettaBollo({ anno: 2026, sogliaRinvio: 5000, scadenze: [
    { trimestre: 2, data: '2026-09-30', importo: 40, righe: [{ descrizione: 'Bollo I+II trim. (rinvio)', ...VELENO }], ...VELENO },
  ] });
  assert.equal(bollo.trimestri[0].rinviato, true);
  nessunSegreto(bollo);

  nessunSegreto(proiettaCrediti([{ sezione: 'erario', codice: '6099', residuo: 10, ...VELENO }]));
});

test('proiettaFatture: nome cliente sì, id/email/P.IVA cliente no', () => {
  const out = proiettaFatture(
    [{ anno: 2026, mese: 3, numero: '7', data: '2026-03-31', clienteId: 'uuid-cliente', nettoAPagare: 1000, residuo: 0, stato: 'pagata', ...VELENO }],
    [{ id: 'uuid-cliente', denominazione: 'Acme Srl', partitaIva: 'PIVA_TEST', ...VELENO }],
    { '2026-03-7': 'accettata' },
  );
  assert.equal(out.fatture[0].cliente, 'Acme Srl');
  assert.equal(out.fatture[0].statoSdi, 'accettata');
  nessunSegreto(out);
  assert.ok(!JSON.stringify(out).includes('PIVA_TEST'));
  assert.ok(!JSON.stringify(out).includes('uuid-cliente'));
});

test('tools/list restituisce i 7 tool con schema', async () => {
  const r = await gestisciRichiesta({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
  assert.equal(r.result.tools.length, 7);
  for (const t of TOOLS) assert.equal(t.inputSchema.type, 'object');
});

test('tools/call: disabilitato → errore; abilitato → JSON in content', async () => {
  const req = { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'riepilogo_anno', arguments: { anno: 2026 } } };
  const spento = await gestisciRichiesta(req, { abilitato: async () => false });
  assert.equal(spento.result.isError, true);

  const acceso = await gestisciRichiesta(req, { abilitato: async () => true, esegui: async () => ({ anno: 2026 }) });
  assert.deepEqual(JSON.parse(acceso.result.content[0].text), { anno: 2026 });

  const ignoto = await gestisciRichiesta({ ...req, params: { name: 'scrivi_config' } }, { abilitato: async () => true });
  assert.equal(ignoto.error.code, -32602);
});

test('notifiche senza risposta, metodo ignoto → -32601', async () => {
  assert.equal(await gestisciRichiesta({ jsonrpc: '2.0', method: 'notifications/initialized' }), null);
  const r = await gestisciRichiesta({ jsonrpc: '2.0', id: 3, method: 'resources/list' });
  assert.equal(r.error.code, -32601);
});
