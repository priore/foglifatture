import { Router } from 'express';
import { getConfig, saveConfig } from '../services/configService.js';

export const configRoutes = Router();

configRoutes.get('/', async (req, res) => {
  res.json(await getConfig());
});

configRoutes.put('/', async (req, res) => {
  res.json(await saveConfig(req.body));
});
