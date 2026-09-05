// Riavvio del processo: il servizio gira sotto launchd con KeepAlive, quindi
// uscire basta perché venga rilanciato subito in automatico (vedi scripts/install.sh).
import { Router } from 'express';
import { logger } from '../lib/logger.js';

export const sistemaRoutes = Router();

sistemaRoutes.post('/riavvia', (req, res) => {
  logger.info('Riavvio richiesto da UI');
  res.json({ ok: true });
  setTimeout(() => process.exit(0), 200);
});
