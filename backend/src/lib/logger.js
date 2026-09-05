// Logger centralizzato: scrive sia su console (catturata da launchd in logs/out.log
// quando l'app gira come servizio) sia su un file dedicato per evento importante,
// così in caso di problemi (soprattutto invio PEC) si sa subito dove guardare.
import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const LOG_DIR = path.join(import.meta.dirname, '..', '..', 'logs');

async function scrivi(fileLog, livello, messaggio, dettagli) {
  await mkdir(LOG_DIR, { recursive: true });
  const riga = {
    timestamp: new Date().toISOString(),
    livello,
    messaggio,
    ...(dettagli ? { dettagli } : {}),
  };
  const linea = JSON.stringify(riga) + '\n';
  console[livello === 'error' ? 'error' : 'log'](`[${riga.timestamp}] [${livello.toUpperCase()}] ${messaggio}`, dettagli ?? '');
  await appendFile(path.join(LOG_DIR, fileLog), linea, 'utf-8').catch(() => {});
}

// Log generale dell'applicazione (avvio server, richieste, errori route).
export const logger = {
  info: (messaggio, dettagli) => scrivi('app.log', 'info', messaggio, dettagli),
  error: (messaggio, dettagli) => scrivi('app.log', 'error', messaggio, dettagli),
};

// Log dedicato all'invio PEC: separato perché è l'operazione più delicata
// (invio reale al Sistema di Interscambio) e va controllata per prima in caso di problemi.
export const pecLogger = {
  info: (messaggio, dettagli) => scrivi('pec.log', 'info', messaggio, dettagli),
  error: (messaggio, dettagli) => scrivi('pec.log', 'error', messaggio, dettagli),
};

// Log dedicato al recupero ricevute/notifiche SDI via IMAP e al loro archivio locale.
export const sdiLogger = {
  info: (messaggio, dettagli) => scrivi('sdi.log', 'info', messaggio, dettagli),
  error: (messaggio, dettagli) => scrivi('sdi.log', 'error', messaggio, dettagli),
};
