// Script E2E riusabile: invia una PEC REALE di prova tramite inviaFatturaViaPec(),
// senza mai toccare backend/data/config.json (config passata inline, non letta da disco).
// Non fa parte della suite `npm test` (nessuna estensione .test.js) — va lanciato a mano
// solo quando serve validare l'integrazione SMTP reale con un provider PEC.
//
// Uso:
//   PEC_TEST_HOST=smtps.postecert.it \
//   PEC_TEST_PORT=465 \
//   PEC_TEST_USER=mittente@postecert.it \
//   PEC_TEST_PASS='...' \
//   PEC_TEST_DEST=danilo.priore@gmail.com \
//   node backend/src/services/pecService.e2e.js
//
// Tutti i parametri sono da env: nessuna credenziale hardcoded o committata.

import { inviaFatturaViaPec } from './pecService.js';

const richiesti = ['PEC_TEST_HOST', 'PEC_TEST_USER', 'PEC_TEST_PASS', 'PEC_TEST_DEST'];
const mancanti = richiesti.filter((nome) => !process.env[nome]);
if (mancanti.length > 0) {
  console.error(`Variabili d'ambiente mancanti: ${mancanti.join(', ')}`);
  console.error('Vedi intestazione file per uso completo.');
  process.exit(1);
}

const pecConfig = {
  smtpHost: process.env.PEC_TEST_HOST,
  smtpPort: Number(process.env.PEC_TEST_PORT || 465),
  smtpSecure: process.env.PEC_TEST_SECURE !== 'false',
  casellaMittente: process.env.PEC_TEST_USER,
  passwordMittente: process.env.PEC_TEST_PASS,
  destinatarioSdi: process.env.PEC_TEST_DEST,
};

const allegato = {
  nomeFile: `TEST_${Date.now()}.xml`,
  contenutoXml: '<?xml version="1.0"?><Test>Invio di prova pecService E2E - nessun valore fiscale</Test>',
};

console.log(`Invio PEC di test a ${pecConfig.destinatarioSdi} via ${pecConfig.smtpHost}...`);
const risultato = await inviaFatturaViaPec(pecConfig, allegato);
console.log(risultato);
process.exit(risultato.inviato ? 0 : 1);
