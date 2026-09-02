import { Router } from 'express';
import { isAuthConfigurato } from '../lib/auth.js';
import { leggiCredenzialiOAuth, salvaCredenzialiOAuth } from '../services/envService.js';

export const oauthConfigRoutes = Router();

oauthConfigRoutes.get('/', async (req, res) => {
  const credenziali = await leggiCredenzialiOAuth();
  res.json({ ...credenziali, autenticazioneAttiva: await isAuthConfigurato() });
});

oauthConfigRoutes.put('/', async (req, res) => {
  const { googleClientId, googleClientSecret, allowedEmail } = req.body;
  await salvaCredenzialiOAuth(req.body);
  // Le credenziali Google (passport) si applicano solo al riavvio; la Gemini API key
  // viene invece riletta da file ad ogni chiamata (vedi envService.leggiGeminiApiKey), quindi vale subito.
  const toccaGoogle = googleClientId !== undefined || googleClientSecret || allowedEmail !== undefined;
  const messaggio = toccaGoogle
    ? 'Salvato. Riavvia il servizio perché le nuove credenziali abbiano effetto (scripts/install.sh oppure launchctl kickstart -k gui/$UID/com.prioregroup.fatturazione).'
    : 'Salvato. La API key vale subito, senza bisogno di riavviare il servizio.';
  res.json({ ok: true, messaggio });
});
