import { Router } from 'express';
import { cartelleCloudLocali, esaminaRadice } from '../lib/cartelleCloudLocali.js';
import { scegliCartella } from '../lib/sceltaCartella.js';
import { situazioneMigrazione, migraClient } from '../services/migrazioneCloudService.js';

// Solo desktop Node: negli ambienti embedded non c'è accesso alle cartelle dei client dei provider (route non montata nel core).
export const cartelleCloudRoutes = Router();

cartelleCloudRoutes.get('/', (req, res) => {
  res.json(cartelleCloudLocali());
});

// Sottocartella FogliFatture dentro la cartella indicata e suo stato.
cartelleCloudRoutes.get('/esamina', (req, res) => {
  try {
    res.json(esaminaRadice(req.query.radice, req.query.provider));
  } catch (err) {
    res.status(400).json({ errore: err.message });
  }
});

// Archivio rimasto nella vecchia posizione `<client>/FogliFatture`: null se non c'è nulla da migrare.
cartelleCloudRoutes.get('/migrazione', (req, res) => {
  res.json(situazioneMigrazione());
});

// Dropbox e OneDrive: sposta i dati nella nuova cartella oppure apre l'archivio già presente (Google passa da /api/cloud).
cartelleCloudRoutes.post('/migrazione', async (req, res) => {
  try {
    res.json(await migraClient(req.body?.azione));
  } catch (err) {
    res.status(400).json({ errore: err.message });
  }
});

// Apre la finestra di sistema per scegliere la cartella del provider (se l'utente l'ha spostata).
cartelleCloudRoutes.post('/scegli', async (req, res) => {
  try {
    const radice = await scegliCartella({ iniziale: req.body?.iniziale });
    res.json(radice ? esaminaRadice(radice, req.body?.provider) : { annullato: true });
  } catch (err) {
    res.status(400).json({ errore: err.message });
  }
});
