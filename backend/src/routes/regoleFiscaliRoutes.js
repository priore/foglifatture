import { Router } from 'express';
import { elencoAnni, regoleAnno, differenze, conferma, statoRegole, spiegaDiff } from '../services/regoleFiscaliService.js';
import { logger } from '../lib/logger.js';

export const regoleFiscaliRoutes = Router();

regoleFiscaliRoutes.get('/stato', async (req, res) => {
  res.json(await statoRegole());
});

regoleFiscaliRoutes.get('/', async (req, res) => {
  res.json(await elencoAnni());
});

regoleFiscaliRoutes.get('/:anno', async (req, res) => {
  const anno = parseInt(req.params.anno, 10);
  if (isNaN(anno)) return res.status(400).json({ errore: 'Anno non valido' });
  try {
    res.json(await regoleAnno(anno));
  } catch (err) {
    res.status(404).json({ errore: err.message });
  }
});

regoleFiscaliRoutes.get('/:anno/differenze', async (req, res) => {
  const anno = parseInt(req.params.anno, 10);
  if (isNaN(anno)) return res.status(400).json({ errore: 'Anno non valido' });
  res.json(await differenze(anno));
});

regoleFiscaliRoutes.post('/:anno/spiega-diff', async (req, res) => {
  const anno = parseInt(req.params.anno, 10);
  if (isNaN(anno)) return res.status(400).json({ errore: 'Anno non valido' });
  try {
    res.json(await spiegaDiff(anno));
  } catch (err) {
    res.status(400).json({ errore: err.message });
  }
});

regoleFiscaliRoutes.post('/:anno/conferma', async (req, res) => {
  const anno = parseInt(req.params.anno, 10);
  if (isNaN(anno)) return res.status(400).json({ errore: 'Anno non valido' });
  try {
    const regole = await conferma(anno);
    logger.info(`Regole fiscali ${anno} confermate`);
    res.json(regole);
  } catch (err) {
    res.status(400).json({ errore: err.message });
  }
});
