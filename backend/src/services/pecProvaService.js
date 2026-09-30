// Aiuti alla configurazione PEC: prova passo-passo (nessun invio) e PEC di prova allo SDI.
import nodemailer from 'nodemailer';
import { ImapFlow } from 'imapflow';
import { pecLogger } from '../lib/logger.js';

export const DESTINATARIO_SDI_UFFICIALE = 'sdi01@pec.fatturapa.it';
const MITTENTE_SDI_DOMINIO = '@pec.fatturapa.it';
const TIMEOUT_MS = 15000;

// Messaggio italiano per gli errori tipici di SMTP/IMAP (funzione pura, testata).
export function traduciErrorePec(err) {
  const msg = String(err?.message ?? err ?? '');
  const code = err?.code;
  if (err?.authenticationFailed || code === 'EAUTH' || err?.responseCode === 535 || /auth|credentials|login/i.test(msg)) {
    return 'Accesso rifiutato: controlla indirizzo e password. Alcuni gestori richiedono una password dedicata per i programmi di posta.';
  }
  if (code === 'ENOTFOUND' || code === 'EDNS') return 'Server non trovato: controlla il nome del server.';
  if (code === 'ECONNREFUSED') return 'Connessione rifiutata: controlla la porta.';
  if (['ETIMEDOUT', 'ETIMEOUT', 'ECONNECTION'].includes(code) || /timed? ?out/i.test(msg)) {
    return 'Il server non risponde (timeout): controlla server, porta e connessione.';
  }
  if (/certificate|cert_|self.signed|tls|ssl/i.test(msg) || /CERT/.test(code ?? '')) {
    return 'Errore di certificato o TLS: controlla server e porta (con TLS implicito: 465 invio, 993 ricezione).';
  }
  return msg || 'Errore sconosciuto.';
}

async function passo(id, etichetta, fn) {
  try {
    await fn();
    return { id, etichetta, ok: true };
  } catch (err) {
    await pecLogger.error(`Prova PEC: passo ${id} fallito`, { errore: err.message });
    return { id, etichetta, ok: false, errore: traduciErrorePec(err) };
  }
}

function creaTransporter(pec) {
  return nodemailer.createTransport({
    host: pec.smtpHost, port: pec.smtpPort, secure: pec.smtpSecure,
    auth: { user: pec.casellaMittente, pass: pec.passwordMittente },
    connectionTimeout: TIMEOUT_MS, greetingTimeout: TIMEOUT_MS, socketTimeout: TIMEOUT_MS,
  });
}

function creaImap(pec) {
  return new ImapFlow({
    host: pec.imapHost, port: pec.imapPort, secure: pec.imapSecure,
    auth: { user: pec.casellaMittente, pass: pec.passwordMittente },
    logger: false, connectionTimeout: TIMEOUT_MS, greetingTimeout: TIMEOUT_MS,
  });
}

/** Prova senza inviare nulla: connessione e accesso, prima SMTP poi IMAP. */
export async function provaConnessionePec(pec) {
  const passi = [];
  // nodemailer.verify() fa connessione + login insieme: il passo "login" riusa l'esito
  // se la connessione è riuscita; se fallisce per rete, l'accesso non è verificabile.
  const t = creaTransporter(pec);
  const smtp = await passo('SMTP', 'Invio (SMTP): collegamento e accesso', () => t.verify());
  passi.push(smtp);
  const imap = creaImap(pec);
  passi.push(await passo('IMAP', 'Ricezione (IMAP): collegamento e accesso', async () => {
    await imap.connect();
    await imap.logout();
  }));
  return { ok: passi.every((p) => p.ok), passi };
}

/** PEC vuota (senza allegato) allo SDI: risponde con un messaggio di cortesia. */
export async function inviaPecProvaSdi(pec) {
  const a = pec.destinatarioSdi || DESTINATARIO_SDI_UFFICIALE;
  try {
    const info = await creaTransporter(pec).sendMail({
      from: pec.casellaMittente, to: a, subject: 'Prova del canale PEC', text: 'Prova del canale PEC.',
    });
    await pecLogger.info('PEC di prova inviata allo SDI', { destinatario: a, messageId: info.messageId });
    return { inviato: true, inviataIl: new Date().toISOString() };
  } catch (err) {
    await pecLogger.error('Errore PEC di prova allo SDI', { errore: err.message });
    return { inviato: false, errore: traduciErrorePec(err) };
  }
}

/** Legge (sola lettura, nessun flag) i messaggi SDI arrivati dopo `dal`. Non archivia nulla. */
export async function leggiRisposteProvaSdi(pec, dal) {
  const client = creaImap(pec);
  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX', { readOnly: true });
    try {
      const uids = await client.search({ from: MITTENTE_SDI_DOMINIO, since: new Date(dal) }, { uid: true });
      const risposte = [];
      for await (const m of client.fetch(uids || [], { envelope: true }, { uid: true })) {
        if (new Date(m.envelope.date) >= new Date(dal)) {
          risposte.push({ oggetto: m.envelope.subject, data: m.envelope.date });
        }
      }
      return { risposte };
    } finally {
      lock.release();
    }
  } catch (err) {
    return { risposte: [], errore: traduciErrorePec(err) };
  } finally {
    await client.logout().catch(() => {});
  }
}
