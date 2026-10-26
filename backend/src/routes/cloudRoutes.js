import { Router } from 'express';
import { logger } from '../lib/logger.js';
import { statoCloud, avviaLogin, completaLogin, scegliArchivio, sincronizza, disconnetti } from '../services/cloudSyncService.js';

export const cloudRoutes = Router();

// Gli errori del servizio sono messaggi per l'utente (client id mancante, archivio estraneo...): 400 con il testo.
const conErrore = (gestore) => async (req, res) => {
  try {
    await gestore(req, res);
  } catch (err) {
    res.status(400).json({ errore: err.message });
  }
};

cloudRoutes.get('/stato', conErrore(async (req, res) => res.json(await statoCloud())));

cloudRoutes.post('/login', conErrore(async (req, res) => res.json(await avviaLogin(req.body ?? {}))));

// Codice incollato dall'utente (Dropbox senza indirizzo di ritorno).
cloudRoutes.post('/codice', conErrore(async (req, res) => res.json(await completaLogin({ codice: req.body?.codice?.trim(), senzaState: true }))));

cloudRoutes.post('/archivio', conErrore(async (req, res) => res.json(await scegliArchivio(req.body?.azione))));

cloudRoutes.post('/sincronizza', conErrore(async (req, res) => res.json(await sincronizza())));

cloudRoutes.delete('/', conErrore(async (req, res) => res.json(await disconnetti())));

// Indirizzo di ritorno del browser dopo il login: montato a parte, fuori da richiedeAutenticazione (il browser di
// sistema può non avere la sessione dell'app). Vale il `state` casuale, monouso, generato da avviaLogin.
const pagina = (testo) => `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Collegamento cloud</title><body style="font-family:system-ui;max-width:32rem;margin:4rem auto;padding:0 1rem"><p>${testo}</p>`;

export async function cloudCallback(req, res) {
  const { code, state, error } = req.query;
  if (error) return res.status(400).type('html').send(pagina('Collegamento annullato dal provider. Chiudi questa scheda e riprova dall\'app.'));
  try {
    await completaLogin({ codice: code, state });
    res.type('html').send(pagina('Collegamento riuscito. Puoi chiudere questa scheda e tornare all\'app.'));
  } catch (err) {
    logger.warn('Collegamento cloud non riuscito', { errore: err.message });
    // Il testo può contenere ciò che risponde il provider: va escapato.
    const dettaglio = String(err.message).slice(0, 300).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
    res.status(400).type('html').send(pagina(`Collegamento non riuscito. Chiudi questa scheda e riprova dall'app.<br><small>${dettaglio}</small>`));
  }
}
