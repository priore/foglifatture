import { Router } from 'express';
import { readFile } from 'node:fs/promises';
import { getConfig } from '../services/configService.js';
import { provaConnessionePec, inviaPecProvaSdi, leggiRisposteProvaSdi } from '../services/pecProvaService.js';

export const pecRoutes = Router();

const GESTORI = JSON.parse(await readFile(new URL('../data/gestoriPec.json', import.meta.url), 'utf-8'));

function pecCompleta(pec) {
  return pec.smtpHost && pec.imapHost && pec.casellaMittente && pec.passwordMittente;
}

pecRoutes.get('/gestori', (req, res) => res.json(GESTORI));

// Prova con la configurazione SALVATA (la password vive nel Keychain, non nel form).
pecRoutes.post('/prova', async (req, res) => {
  const { pec } = await getConfig();
  if (!pecCompleta(pec)) return res.status(400).json({ errore: 'Configurazione PEC incompleta: salva server, casella e password.' });
  res.json(await provaConnessionePec(pec));
});

pecRoutes.post('/prova-sdi', async (req, res) => {
  if (req.body?.conferma !== true) return res.status(400).json({ errore: 'Conferma esplicita richiesta.' });
  const { pec } = await getConfig();
  if (!pecCompleta(pec)) return res.status(400).json({ errore: 'Configurazione PEC incompleta.' });
  res.json(await inviaPecProvaSdi(pec));
});

pecRoutes.get('/prova-sdi/risposte', async (req, res) => {
  const { dal } = req.query;
  if (!dal || Number.isNaN(Date.parse(dal))) return res.status(400).json({ errore: 'Parametro dal non valido.' });
  const { pec } = await getConfig();
  if (!pecCompleta(pec)) return res.status(400).json({ errore: 'Configurazione PEC incompleta.' });
  res.json(await leggiRisposteProvaSdi(pec, dal));
});
