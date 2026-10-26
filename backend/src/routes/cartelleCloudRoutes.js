import { Router } from 'express';
import { cartelleCloudLocali, esaminaRadice } from '../lib/cartelleCloudLocali.js';
import { scegliCartella } from '../lib/sceltaCartella.js';

// Solo desktop Node: negli ambienti embedded non c'è accesso alle cartelle dei client dei provider (route non montata nel core).
export const cartelleCloudRoutes = Router();

cartelleCloudRoutes.get('/', (req, res) => {
  res.json(cartelleCloudLocali());
});

// Sottocartella FogliFatture dentro la cartella indicata e suo stato.
cartelleCloudRoutes.get('/esamina', (req, res) => {
  try {
    res.json(esaminaRadice(req.query.radice));
  } catch (err) {
    res.status(400).json({ errore: err.message });
  }
});

// Apre la finestra di sistema per scegliere la cartella del provider (se l'utente l'ha spostata).
cartelleCloudRoutes.post('/scegli', async (req, res) => {
  try {
    const radice = await scegliCartella({ iniziale: req.body?.iniziale });
    res.json(radice ? esaminaRadice(radice) : { annullato: true });
  } catch (err) {
    res.status(400).json({ errore: err.message });
  }
});
