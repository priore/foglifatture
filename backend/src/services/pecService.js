// Invio della fattura elettronica al Sistema di Interscambio (SDI) tramite PEC.
// Predisposto e funzionante lato codice, ma non testato con invio reale: richiede
// una casella PEC vera configurata in Impostazioni > PEC prima di poter essere usato.
import nodemailer from 'nodemailer';
import { pecLogger } from '../lib/logger.js';

const DESTINATARIO_SDI_UFFICIALE = 'sdi01@pec.fatturapa.it';

function creaTransporter(pecConfig) {
  return nodemailer.createTransport({
    host: pecConfig.smtpHost,
    port: pecConfig.smtpPort,
    secure: pecConfig.smtpSecure,
    auth: {
      user: pecConfig.casellaMittente,
      pass: pecConfig.passwordMittente,
    },
  });
}

/**
 * Invia il file XML della fattura elettronica alla PEC del Sistema di Interscambio.
 * @param {object} pecConfig - { smtpHost, smtpPort, smtpSecure, casellaMittente, passwordMittente, destinatarioSdi }
 * @param {object} allegato - { nomeFile, contenutoXml }
 * @returns {Promise<{ inviato: boolean, messageId?: string, errore?: string }>}
 */
export async function inviaFatturaViaPec(pecConfig, allegato) {
  const destinatario = pecConfig.destinatarioSdi || DESTINATARIO_SDI_UFFICIALE;

  if (!pecConfig.smtpHost || !pecConfig.casellaMittente || !pecConfig.passwordMittente) {
    const errore = 'Configurazione PEC incompleta: compila i dati in Impostazioni.';
    await pecLogger.error(`Tentativo di invio bloccato: ${errore}`, { nomeFile: allegato.nomeFile });
    return { inviato: false, errore };
  }

  await pecLogger.info(`Tentativo invio ${allegato.nomeFile}`, {
    destinatario, smtpHost: pecConfig.smtpHost, mittente: pecConfig.casellaMittente,
  });

  const transporter = creaTransporter(pecConfig);
  try {
    const info = await transporter.sendMail({
      from: pecConfig.casellaMittente,
      to: destinatario,
      subject: allegato.nomeFile,
      text: `In allegato la fattura elettronica ${allegato.nomeFile}.`,
      attachments: [
        {
          filename: allegato.nomeFile,
          content: Buffer.from(allegato.contenutoXml, 'utf-8'),
          contentType: 'application/xml',
        },
      ],
    });
    await pecLogger.info(`Fattura ${allegato.nomeFile} inviata con successo`, {
      destinatario, messageId: info.messageId,
    });
    return { inviato: true, messageId: info.messageId };
  } catch (err) {
    await pecLogger.error(`Errore invio ${allegato.nomeFile}`, {
      destinatario, smtpHost: pecConfig.smtpHost, errore: err.message, stack: err.stack,
    });
    return { inviato: false, errore: err.message };
  }
}
