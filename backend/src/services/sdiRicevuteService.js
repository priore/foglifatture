// Recupero automatico via IMAP delle ricevute/notifiche del Sistema di Interscambio (SDI)
// dalla stessa casella PEC usata per l'invio, con archiviazione locale e notifica desktop.
//
// IMPORTANTE: legge in sola lettura (nessun delete/move/flag) e tocca SOLO i messaggi
// il cui mittente è il dominio ufficiale SDI (@pec.fatturapa.it) — ogni altra email nella
// casella resta intoccata e non viene nemmeno scaricata nel dettaglio.
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { sdiLogger } from '../lib/logger.js';
import { notificaMac } from '../lib/macNotifier.js';

const MITTENTE_SDI_DOMINIO = '@pec.fatturapa.it';

// Tipo di ricevuta riconosciuto dal prefisso standard del nome file XML allegato.
const PREFISSI_TIPO_RICEVUTA = {
  RC: 'Ricevuta di Consegna',
  NS: 'Notifica di Scarto',
  MC: 'Mancata Consegna',
  NE: 'Notifica Esito (accettazione/rifiuto committente)',
  EC: 'Notifica Esito Cedente',
  DT: 'Decorrenza Termini',
  AT: 'Attestazione di Trasmissione (mancato recapito)',
};

function riconosciTipo(nomeFile) {
  const prefisso = Object.keys(PREFISSI_TIPO_RICEVUTA).find(p => nomeFile.toUpperCase().includes(`_${p}_`));
  return prefisso ? { codice: prefisso, descrizione: PREFISSI_TIPO_RICEVUTA[prefisso] } : { codice: 'ALTRO', descrizione: 'Allegato SDI non classificato' };
}

function creaClientImap(pecConfig) {
  return new ImapFlow({
    host: pecConfig.imapHost,
    port: pecConfig.imapPort,
    secure: pecConfig.imapSecure,
    auth: { user: pecConfig.casellaMittente, pass: pecConfig.passwordMittente },
    logger: false,
  });
}

/**
 * Controlla la casella PEC per nuove email da SDI, scarica gli allegati XML,
 * li salva nella cartella archivio configurata e notifica l'utente.
 * @returns {Promise<{ nuove: number, errore?: string }>}
 */
export async function controllaRicevuteSdi(pecConfig, percorsoArchivio) {
  if (!pecConfig.imapHost || !pecConfig.casellaMittente || !pecConfig.passwordMittente) {
    const errore = 'Configurazione IMAP incompleta: compila i dati PEC in Impostazioni.';
    await sdiLogger.error(`Controllo ricevute bloccato: ${errore}`);
    return { nuove: 0, errore };
  }
  if (!percorsoArchivio) {
    const errore = 'Cartella archivio SDI non configurata.';
    await sdiLogger.error(`Controllo ricevute bloccato: ${errore}`);
    return { nuove: 0, errore };
  }

  const client = creaClientImap(pecConfig);
  let nuove = 0;
  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      // Solo messaggi non ancora letti dal dominio SDI ufficiale: non tocca il resto della casella.
      const messaggiTrovati = await client.search({ seen: false, from: MITTENTE_SDI_DOMINIO });
      for (const uid of messaggiTrovati || []) {
        const { content } = await client.download(uid, undefined, { uid: true });
        const email = await simpleParser(content);
        await sdiLogger.info(`Email SDI ricevuta: ${email.subject}`, { da: email.from?.text });

        for (const allegato of email.attachments || []) {
          if (!allegato.filename?.toLowerCase().endsWith('.xml')) continue;
          const tipo = riconosciTipo(allegato.filename);
          await mkdir(percorsoArchivio, { recursive: true });
          const destinazione = path.join(percorsoArchivio, allegato.filename);
          await writeFile(destinazione, allegato.content);
          nuove += 1;
          await sdiLogger.info(`Archiviato ${allegato.filename} (${tipo.descrizione})`, { destinazione });
          notificaMac('Ricevuta SDI', `${tipo.descrizione}: ${allegato.filename}`);
        }
        // Segna come letta la sola email SDI appena processata (nessun'altra email toccata).
        await client.messageFlagsAdd(uid, ['\\Seen'], { uid: true });
      }
    } finally {
      lock.release();
    }
  } catch (err) {
    await sdiLogger.error('Errore durante il controllo ricevute SDI', { errore: err.message, stack: err.stack });
    notificaMac('Errore ricezione SDI', err.message);
    return { nuove, errore: err.message };
  } finally {
    await client.logout().catch(() => {});
  }

  if (nuove > 0) notificaMac('Ricevute SDI', `${nuove} nuovo/i documento/i archiviato/i`);
  return { nuove };
}

let timerPolling = null;

// Avvia il controllo periodico in background; richiamato all'avvio del server.
// Ad ogni giro rilegge la config per rispettare il flag pollingAbilitato anche se
// cambiato a runtime dall'utente in Impostazioni, senza dover riavviare il servizio.
// Se la config IMAP non è compilata, il ping semplicemente non troverà nulla da fare
// e loggerà l'errore ad ogni giro (visibile in sdi.log) finché non viene configurata.
export function avviaPollingSdi(getConfig, minuti) {
  fermaPollingSdi();
  const intervalloMs = Math.max(1, minuti) * 60 * 1000;
  timerPolling = setInterval(async () => {
    const config = await getConfig();
    if (!config.sdi.pollingAbilitato) return;
    await controllaRicevuteSdi(config.pec, config.sdi.percorsoArchivio);
  }, intervalloMs);
}

export function fermaPollingSdi() {
  if (timerPolling) clearInterval(timerPolling);
  timerPolling = null;
}
