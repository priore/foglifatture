import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generaXmlFatturaPA, generaNomeFileXml } from './fatturaPaXmlGenerator.js';

const fornitore = {
  denominazione: 'Danilo Priore', partitaIva: '11111111111', codiceFiscale: 'PRRDNL80A01H501X',
  indirizzo: 'Via Esempio', numeroCivico: '12', cap: '00100', comune: 'Roma', provincia: 'RM',
};
const cliente = {
  denominazione: 'Azienda Cliente Srl', partitaIva: '22222222222', codiceDestinatarioSdi: '0000000',
  indirizzo: 'Via Cliente', cap: '20100', comune: 'Milano', provincia: 'MI',
};

test('include DatiBollo quando imponibile supera la soglia', () => {
  const xml = generaXmlFatturaPA({
    fornitore, cliente,
    fattura: { numero: '08/2026', data: '2026-08-31', descrizione: 'Servizi IT', oreTotali: 160, tariffaOraria: 11.25, imponibile: 1800, bollo: 2, bolloApplicabile: true, progressivoInvio: 8 },
  });
  assert.match(xml, /<DatiBollo>/);
  assert.match(xml, /<ImportoBollo>2\.00<\/ImportoBollo>/);
  assert.match(xml, /<RegimeFiscale>RF19<\/RegimeFiscale>/);
  assert.match(xml, /<Natura>N2\.2<\/Natura>/);
  assert.match(xml, /<ImportoTotaleDocumento>1800\.00<\/ImportoTotaleDocumento>/);
});

test('omette DatiBollo quando non applicabile', () => {
  const xml = generaXmlFatturaPA({
    fornitore, cliente,
    fattura: { numero: '01/2026', data: '2026-01-15', descrizione: 'Servizi IT', oreTotali: 5, tariffaOraria: 10, imponibile: 50, bollo: 0, bolloApplicabile: false, progressivoInvio: 1 },
  });
  assert.doesNotMatch(xml, /<DatiBollo>/);
  assert.match(xml, /<ImportoTotaleDocumento>50\.00<\/ImportoTotaleDocumento>/);
});

test('escapa caratteri speciali XML nella denominazione', () => {
  const xml = generaXmlFatturaPA({
    fornitore: { ...fornitore, denominazione: 'A & B <Srl>' }, cliente,
    fattura: { numero: '1', data: '2026-01-01', descrizione: 'x', oreTotali: 1, tariffaOraria: 1, imponibile: 1, bollo: 0, bolloApplicabile: false, progressivoInvio: 1 },
  });
  assert.match(xml, /A &amp; B &lt;Srl&gt;/);
});

test('nome file conforme allo standard IT<CF>_<PROGRESSIVO>.xml', () => {
  assert.equal(generaNomeFileXml(fornitore, 8), 'IT11111111111_00008.xml');
});
