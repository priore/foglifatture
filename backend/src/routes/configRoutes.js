import { Router } from 'express';
import { getConfigSicura, saveConfig, validaConfig, spostaPercorsoDati, apriArchivioEsistente } from '../services/configService.js';
import { clientiConDati, eliminaCliente } from '../services/clientiService.js';
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

// Apre un archivio già presente nella cartella indicata, senza spostare i dati attuali.
configRoutes.put('/percorso-dati/apri', async (req, res) => {
  const { percorso } = req.body;
  if (!percorso) return res.status(400).json({ errore: 'Percorso mancante' });
  try {
    res.json({ percorso: await apriArchivioEsistente(percorso) });
  } catch (err) {
    logger.error('Errore apertura archivio esistente', { errore: err.message });
    res.status(400).json({ errore: err.message });
  }
});

// Clienti con fatture, numeri o timesheet compilati: per questi esiste solo la disattivazione.
configRoutes.get('/clienti/con-dati', async (req, res) => {
  res.json(await clientiConDati());
});

configRoutes.delete('/clienti/:id', async (req, res) => {
  try {
    await eliminaCliente(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ errore: err.message });
  }
});
