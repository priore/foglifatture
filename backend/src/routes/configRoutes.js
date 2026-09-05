import { Router } from 'express';
import { getConfigSicura, saveConfig, validaConfig, spostaPercorsoDati } from '../services/configService.js';
import { logger } from '../lib/logger.js';

export const configRoutes = Router();

configRoutes.get('/', async (req, res) => {
  res.json(await getConfigSicura());
});

configRoutes.put('/', async (req, res) => {
  const errori = validaConfig(req.body);
  if (errori.length > 0) return res.status(400).json({ errore: errori.join('; ') });
  await saveConfig(req.body);
  res.json(await getConfigSicura());
});

// Sposta backend/data/ su una nuova cartella: muove fisicamente ogni file esistente,
// nessuna perdita dati. Vedi configService.spostaPercorsoDati per i dettagli.
configRoutes.put('/percorso-dati', async (req, res) => {
  const { percorso } = req.body;
  if (!percorso) return res.status(400).json({ errore: 'Percorso mancante' });
  try {
    const percorsoApplicato = await spostaPercorsoDati(percorso);
    res.json({ percorso: percorsoApplicato });
  } catch (err) {
    logger.error('Errore spostamento percorso dati', { errore: err.message });
    res.status(400).json({ errore: err.message });
  }
});
