import { Router } from 'express';
import { getConfig, accettaTermini } from '../services/configService.js';
import { VERSIONE_TERMINI, TESTO_TERMINI, APPROVAZIONE_SPECIFICA, terminiAccettati } from '../lib/termini.js';

export const terminiRoutes = Router();

terminiRoutes.get('/', async (req, res) => {
  const config = await getConfig();
  res.json({
    versione: VERSIONE_TERMINI,
    testo: TESTO_TERMINI,
    approvazioneSpecifica: APPROVAZIONE_SPECIFICA,
    accettati: terminiAccettati(config),
    accettatoIl: config.termini?.accettatoIl || null,
  });
});

terminiRoutes.post('/accetta', async (req, res) => {
  if (req.body?.approvazioneSpecifica !== true) return res.status(400).json({ errore: 'Approvazione specifica della clausola 4 mancante' });
  res.json(await accettaTermini());
});
