import { Router } from 'express';
import { isAuthConfigurato } from '../lib/auth.js';
import { leggiCredenzialiOAuth, salvaCredenzialiOAuth } from '../services/envService.js';

export const oauthConfigRoutes = Router();

oauthConfigRoutes.get('/', async (req, res) => {
  const credenziali = await leggiCredenzialiOAuth();
  res.json({ ...credenziali, autenticazioneAttiva: isAuthConfigurato() });
});

oauthConfigRoutes.put('/', async (req, res) => {
  await salvaCredenzialiOAuth(req.body);
  res.json({
    ok: true,
    messaggio: 'Salvato. Riavvia il servizio perché le nuove credenziali abbiano effetto (scripts/install.sh oppure launchctl kickstart -k gui/$UID/com.prioregroup.fatturazione).',
  });
});
