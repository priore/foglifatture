// Salva l'impostazione del promemoria fine mese e riavvia subito lo scheduler,
// stesso schema di backupRoutes.js.
import { Router } from 'express';
import { avviaPromemoria, fermaPromemoria } from '../services/reminderService.js';
import { getConfig, saveConfig } from '../services/configService.js';

export const reminderRoutes = Router();

reminderRoutes.put('/impostazioni', async (req, res) => {
  const config = await saveConfig({ reminder: req.body });
  fermaPromemoria();
  if (config.reminder.abilitato) {
    avviaPromemoria(getConfig);
  }
  res.json(config.reminder);
});
