import { Router } from 'express';
import { getConfigSicura, saveConfig, validaConfig } from '../services/configService.js';

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
