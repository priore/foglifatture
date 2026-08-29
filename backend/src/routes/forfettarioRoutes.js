import { Router } from 'express';
import { readFile } from 'node:fs/promises';
import { getConfig } from '../services/configService.js';
import { calcolaDashboardForfettario } from '../services/forfettarioService.js';

export const forfettarioRoutes = Router();

const percorsoAteco = new URL('../data/atecoSettori.json', import.meta.url);

// Elenco codici ATECO (codice, descrizione, settore, coefficiente di redditività) per la select in Impostazioni.
forfettarioRoutes.get('/settori-ateco', async (req, res) => {
  const json = await readFile(percorsoAteco, 'utf-8');
  res.type('application/json').send(json);
});

forfettarioRoutes.get('/dashboard', async (req, res) => {
  const config = await getConfig();
  const anno = req.query.anno ? Number(req.query.anno) : undefined;
  const dashboard = await calcolaDashboardForfettario(config, anno ? { anno } : {});
  res.json(dashboard);
});
