import { Router } from 'express';
import { getConfig, saveConfig } from '../services/configService.js';
import { chat } from '../services/chatService.js';

export const chatRoutes = Router();

// FP-009 — body: { messaggi: [{ruolo, testo}], conferma?, ricorda? }. 403 se l'invio dati all'AI non è autorizzato.
chatRoutes.post('/', async (req, res) => {
  try {
    const { messaggi, conferma, ricorda } = req.body ?? {};
    let config = await getConfig();
    if (ricorda === true && conferma === true) config = await saveConfig({ ai: { autorizzaDatiFiscali: true } });
    res.json(await chat({ config, messaggi, conferma }));
  } catch (err) {
    res.status(err.codice === 'AUTORIZZAZIONE_RICHIESTA' ? 403 : 400).json({ errore: err.message, codice: err.codice });
  }
});
