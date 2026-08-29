import { Router } from 'express';
import { getConfig } from '../services/configService.js';
import { controllaRicevuteSdi } from '../services/sdiRicevuteService.js';

export const sdiRoutes = Router();

// Ping manuale on-demand: controlla subito la PEC per nuove ricevute SDI.
// Rispetta lo stesso flag pollingAbilitato del controllo automatico: se l'utente
// ha disattivato il ping SDI in Impostazioni, blocchiamo anche quello manuale.
sdiRoutes.post('/controlla', async (req, res) => {
  const config = await getConfig();
  if (!config.sdi.pollingAbilitato) {
    return res.status(400).json({ nuove: 0, errore: 'Ping SDI disattivato in Impostazioni > PEC.' });
  }
  const risultato = await controllaRicevuteSdi(config.pec, config.sdi.percorsoArchivio);
  res.json(risultato);
});
