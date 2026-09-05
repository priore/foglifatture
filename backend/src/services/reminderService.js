// Promemoria fine mese: se abilitato, avvisa solo l'ultimo giorno lavorativo del mese
// (non ogni giorno) elencando i giorni feriali senza ore registrate. Stesso pattern
// setInterval di sdiRicevuteService.js/backupService.js: rilegge la config ad ogni giro.
import { notificaMac } from '../lib/macNotifier.js';
import { getGiorniMancanti } from './timesheetService.js';
import { saveConfig } from './configService.js';
import { logger } from '../lib/logger.js';

function ultimoGiornoLavorativo(anno, mese) {
  const ultimoGiorno = new Date(anno, mese, 0).getDate();
  for (let giorno = ultimoGiorno; giorno >= 1; giorno--) {
    const dataSettimana = new Date(anno, mese - 1, giorno).getDay();
    if (dataSettimana !== 0 && dataSettimana !== 6) return giorno;
  }
  return ultimoGiorno;
}

function oggiChiave(data) {
  return data.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

let timerReminder = null;

export function avviaPromemoria(getConfig, intervalloMinuti = 60) {
  fermaPromemoria();
  const intervalloMs = Math.max(1, intervalloMinuti) * 60 * 1000;
  timerReminder = setInterval(async () => {
    const config = await getConfig();
    if (!config.reminder?.abilitato) return;

    const oggi = new Date();
    const anno = oggi.getFullYear();
    const mese = oggi.getMonth() + 1;
    if (oggi.getDate() !== ultimoGiornoLavorativo(anno, mese)) return;

    const chiaveOggi = oggiChiave(oggi);
    if (config.reminder.ultimaNotifica === chiaveOggi) return;

    try {
      const clientiAttivi = (config.clienti ?? []).filter((c) => c.attivo);
      const righe = [];
      for (const cliente of clientiAttivi) {
        const giorniMancanti = await getGiorniMancanti(anno, mese, cliente.id);
        if (giorniMancanti.length > 0) {
          righe.push(`${cliente.denominazione || 'Cliente'}: ${giorniMancanti.join(', ')}`);
        }
      }
      if (righe.length > 0) {
        notificaMac('Promemoria timesheet', `Giorni senza ore registrate questo mese —\n${righe.join('\n')}`);
      }
      await saveConfig({ reminder: { ...config.reminder, ultimaNotifica: chiaveOggi } });
    } catch (err) {
      logger.error('Errore promemoria timesheet', { errore: err.message });
    }
  }, intervalloMs);
}

export function fermaPromemoria() {
  if (timerReminder) clearInterval(timerReminder);
  timerReminder = null;
}
