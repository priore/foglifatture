import { Router } from 'express';
import { elencoAnni, regoleAnno, differenze, conferma, confermaProposte, scartaProposte, statoRegole, spiegaDiff, spiegaRequisitiAliquotaRidotta, spiegaSepties } from '../services/regoleFiscaliService.js';
import { estratto, voceRegistro } from '../services/fontiNormativeService.js';
import { controllaFonti, statoMonitoraggio } from '../services/monitoraggioFontiService.js';
import { logger } from '../lib/logger.js';

export const regoleFiscaliRoutes = Router();

regoleFiscaliRoutes.get('/stato', async (req, res) => {
  res.json(await statoRegole());
});

regoleFiscaliRoutes.get('/', async (req, res) => {
  res.json(await elencoAnni());
});

regoleFiscaliRoutes.get('/fonti/:id/estratto', async (req, res) => {
  const { citazione } = req.query;
  if (!citazione) return res.status(400).json({ errore: 'Parametro citazione mancante' });
  const voce = await voceRegistro(req.params.id);
  if (!voce) return res.status(404).json({ errore: 'Fonte non trovata' });
  const risultato = await estratto(req.params.id, citazione);
  res.json({ voce, estratto: risultato });
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

regoleFiscaliRoutes.post('/ai/spiega-requisiti', async (req, res) => {
  try {
    res.json(await spiegaRequisitiAliquotaRidotta());
  } catch (err) {
    res.status(400).json({ errore: err.message });
  }
});

regoleFiscaliRoutes.post('/ai/spiega-7-septies', async (req, res) => {
  const { descrizioneAttivita } = req.body ?? {};
  try {
    res.json(await spiegaSepties(descrizioneAttivita));
  } catch (err) {
    res.status(400).json({ errore: err.message });
  }
});

regoleFiscaliRoutes.get('/monitoraggio/stato', async (req, res) => {
  res.json(await statoMonitoraggio());
});

regoleFiscaliRoutes.post('/monitoraggio/controlla-ora', async (req, res) => {
  try {
    const risultato = await controllaFonti();
    res.json(risultato);
  } catch (err) {
    logger.error('Controllo fonti manuale fallito', { errore: err.message });
    res.status(500).json({ errore: err.message });
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

regoleFiscaliRoutes.post('/:anno/conferma-proposte', async (req, res) => {
  const anno = parseInt(req.params.anno, 10);
  if (isNaN(anno)) return res.status(400).json({ errore: 'Anno non valido' });
  try {
    const risultato = await confermaProposte(anno);
    logger.info(`Proposte AI ${anno} applicate`, risultato);
    res.json(risultato);
  } catch (err) {
    res.status(400).json({ errore: err.message });
  }
});

regoleFiscaliRoutes.post('/:anno/scarta-proposte', async (req, res) => {
  const anno = parseInt(req.params.anno, 10);
  if (isNaN(anno)) return res.status(400).json({ errore: 'Anno non valido' });
  const risultato = await scartaProposte(anno);
  res.json(risultato);
});
