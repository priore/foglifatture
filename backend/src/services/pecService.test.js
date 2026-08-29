import { test, mock } from 'node:test';
import assert from 'node:assert/strict';

const inviaMock = mock.fn(async () => ({ messageId: 'test-id-123' }));

mock.module('nodemailer', {
  exports: {
    default: {
      createTransport: () => ({ sendMail: inviaMock }),
    },
  },
});
mock.module('../lib/logger.js', {
  exports: { pecLogger: { info: async () => {}, error: async () => {} } },
});

const { inviaFatturaViaPec } = await import('./pecService.js');

const CONFIG_VALIDA = {
  smtpHost: 'smtps.postecert.it',
  smtpPort: 465,
  smtpSecure: true,
  casellaMittente: 'mittente@postecert.it',
  passwordMittente: 'segreta',
  destinatarioSdi: 'sdi01@pec.fatturapa.it',
};

const ALLEGATO = { nomeFile: 'IT12345678901_00001.xml', contenutoXml: '<xml/>' };

test('config PEC incompleta blocca invio senza chiamare SMTP', async () => {
  const risultato = await inviaFatturaViaPec({ smtpHost: '' }, ALLEGATO);
  assert.equal(risultato.inviato, false);
  assert.match(risultato.errore, /incompleta/);
});

test('invio riuscito ritorna messageId', async () => {
  inviaMock.mock.resetCalls();
  const risultato = await inviaFatturaViaPec(CONFIG_VALIDA, ALLEGATO);
  assert.equal(risultato.inviato, true);
  assert.equal(risultato.messageId, 'test-id-123');
  assert.equal(inviaMock.mock.calls[0].arguments[0].to, CONFIG_VALIDA.destinatarioSdi);
});

test('destinatario custom (test) viene usato al posto di quello SDI ufficiale', async () => {
  inviaMock.mock.resetCalls();
  const configTest = { ...CONFIG_VALIDA, destinatarioSdi: 'danilo.priore@gmail.com' };
  await inviaFatturaViaPec(configTest, ALLEGATO);
  assert.equal(inviaMock.mock.calls[0].arguments[0].to, 'danilo.priore@gmail.com');
});

test('errore SMTP viene propagato come inviato:false', async () => {
  inviaMock.mock.mockImplementationOnce(async () => { throw new Error('ECONNREFUSED'); });
  const risultato = await inviaFatturaViaPec(CONFIG_VALIDA, ALLEGATO);
  assert.equal(risultato.inviato, false);
  assert.match(risultato.errore, /ECONNREFUSED/);
});
