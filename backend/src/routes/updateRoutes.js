// Controllo/esecuzione aggiornamento app (tag Git semver). Route sottile, logica in updateService.js.
import { Router } from 'express';
import { statoAggiornamento, avviaAggiornamento } from '../services/updateService.js';
import { logger } from '../lib/logger.js';

export const updateRoutes = Router();

// err.message di execFile (git) include comando ed intero stderr: utile nei log,
// non presentabile in una UI utente. La route restituisce sempre un messaggio breve.
updateRoutes.get('/stato', async (req, res) => {
  try {
    res.json(await statoAggiornamento());
  } catch (err) {
    logger.error('Errore controllo aggiornamenti', { errore: err.message });
    res.status(500).json({ errore: 'Impossibile verificare la disponibilità di aggiornamenti' });
  }
});

updateRoutes.post('/esegui', async (req, res) => {
  try {
    const stato = await statoAggiornamento();
    if (!stato.disponibile) return res.status(400).json({ errore: 'Nessun aggiornamento disponibile' });
    res.json(avviaAggiornamento(stato.versioneRemota));
  } catch (err) {
    logger.error('Errore avvio aggiornamento', { errore: err.message });
    res.status(500).json({ errore: 'Impossibile avviare l\'aggiornamento' });
  }
});
