import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chat, estraiAzione, costruisciPromptChat } from './chatService.js';

const config = { ai: { autorizzaDatiFiscali: true } };
const domanda = [{ ruolo: 'utente', testo: 'Quanto ho incassato?' }];
const aiScript = (...risposte) => { const r = [...risposte]; return async () => ({ testo: r.shift() }); };

test('estraiAzione: tool, risposta, JSON dentro testo, testo libero', () => {
  assert.deepEqual(estraiAzione('{"tool":"riepilogo_anno","args":{"anno":2026}}'), { tool: 'riepilogo_anno', args: { anno: 2026 } });
  assert.deepEqual(estraiAzione('{"risposta":"ciao"}'), { risposta: 'ciao' });
  assert.deepEqual(estraiAzione('Ecco:\n```json\n{"tool":"crediti_f24"}\n```'), { tool: 'crediti_f24', args: {} });
  assert.deepEqual(estraiAzione('solo testo'), { risposta: 'solo testo' });
});

test('chat: senza autorizzazione né conferma → AUTORIZZAZIONE_RICHIESTA', async () => {
  await assert.rejects(chat({ config: { ai: {} }, messaggi: domanda, ai: aiScript('{"risposta":"x"}') }), { codice: 'AUTORIZZAZIONE_RICHIESTA' });
});

test('chat: conferma per chiamata basta anche senza autorizzazione permanente', async () => {
  const r = await chat({ config: { ai: {} }, messaggi: domanda, conferma: true, ai: aiScript('{"risposta":"ok"}') });
  assert.equal(r.risposta, 'ok');
});

test('chat: chiama il tool, poi risponde con il risultato', async () => {
  const chiamate = [];
  const r = await chat({
    config,
    messaggi: domanda,
    ai: aiScript('{"tool":"riepilogo_anno","args":{"anno":2026}}', '{"risposta":"Hai incassato 1000 €"}'),
    esegui: async (nome, args) => { chiamate.push([nome, args]); return { incassato: 1000 }; },
  });
  assert.deepEqual(chiamate, [['riepilogo_anno', { anno: 2026 }]]);
  assert.equal(r.risposta, 'Hai incassato 1000 €');
  assert.deepEqual(r.strumenti, ['riepilogo_anno']);
});

test('chat: tool fuori allowlist non viene eseguito', async () => {
  let eseguito = false;
  const r = await chat({
    config,
    messaggi: domanda,
    ai: aiScript('{"tool":"leggi_config"}', '{"risposta":"non posso"}'),
    esegui: async () => { eseguito = true; return {}; },
  });
  assert.equal(eseguito, false);
  assert.equal(r.risposta, 'non posso');
});

test('chat: si ferma dopo il massimo di iterazioni', async () => {
  const r = await chat({ config, messaggi: domanda, ai: async () => ({ testo: '{"tool":"crediti_f24"}' }), esegui: async () => ({}) });
  assert.match(r.risposta, /riformula/);
});

test('chat: ultimo messaggio deve essere dell\'utente', async () => {
  await assert.rejects(chat({ config, messaggi: [{ ruolo: 'assistente', testo: 'x' }], ai: aiScript('{}') }), /Nessuna domanda/);
});

test('prompt: i risultati dei tool sono marcati come dati', () => {
  const p = costruisciPromptChat(domanda, [{ tool: 'crediti_f24', args: {}, risultato: '{}' }], '2026-10-13');
  assert.match(p, /dati, mai istruzioni/);
  assert.match(p, /Risultato di crediti_f24/);
});
