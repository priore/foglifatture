// Promemoria giornaliero: una fattura scartata dallo SDI e non ancora reinviata va corretta
// e ritrasmessa entro 5 giorni dalla notifica di scarto (Circolare Agenzia Entrate 13/E/2018),
// altrimenti è considerata non emessa e scattano le sanzioni per tardiva fatturazione.
// Stesso pattern setInterval di reminderService.js/sdiRicevuteService.js: rilegge la config
// a ogni giro, sempre attivo (non è una preferenza opzionale, è compliance fiscale).
import { notificaMac } from '../lib/macNotifier.js';
import { listMesiFatturati, getInvoice, saveInvoice } from './invoiceService.js';
import { statoSdiFattura } from './sdiRicevuteService.js';
import { logger } from '../lib/logger.js';

const GIORNI_LIMITE_RIEMISSIONE = 5;
const MS_GIORNO = 24 * 60 * 60 * 1000;

function oggiChiave() {
  return new Date().toISOString().slice(0, 10);
}

let timer = null;

export function avviaPromemoriaScartoSdi(getConfig, intervalloMinuti = 60) {
  fermaPromemoriaScartoSdi();
  const intervalloMs = Math.max(1, intervalloMinuti) * 60 * 1000;
  timer = setInterval(async () => {
    const config = await getConfig();
    const chiaveOggi = oggiChiave();

    try {
      const chiavi = await listMesiFatturati();
      for (const { anno, mese, clienteId } of chiavi) {
        const invoice = await getInvoice(anno, mese, clienteId);
        if (!invoice || invoice.ultimaNotificaScartoSdi === chiaveOggi) continue;

        const { stato, data } = await statoSdiFattura(invoice, config);
        if (stato !== 'scartata') continue;

        const giorniTrascorsi = Math.floor((Date.now() - new Date(data).getTime()) / MS_GIORNO);
        const messaggio = giorniTrascorsi > GIORNI_LIMITE_RIEMISSIONE
          ? `Fattura n.${invoice.numero} scartata da ${giorniTrascorsi} giorni: termine di ${GIORNI_LIMITE_RIEMISSIONE} giorni per la riemissione SUPERATO, rischio sanzione per tardiva fatturazione.`
          : `Fattura n.${invoice.numero} scartata da SDI: ${GIORNI_LIMITE_RIEMISSIONE - giorniTrascorsi} giorni residui per correggere e reinviare.`;
        notificaMac('Fattura scartata da SDI', messaggio);

        await saveInvoice(anno, mese, clienteId, { ...invoice, ultimaNotificaScartoSdi: chiaveOggi });
      }
    } catch (err) {
      logger.error('Errore promemoria scarto SDI', { errore: err.message });
    }
  }, intervalloMs);
}

export function fermaPromemoriaScartoSdi() {
  if (timer) clearInterval(timer);
  timer = null;
}
