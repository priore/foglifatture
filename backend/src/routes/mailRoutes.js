// Invio del PDF (timesheet/fattura) al cliente via client di posta OS predefinito.
import { Router } from 'express';
import multer from 'multer';
import { inviaPdfAlCliente } from '../services/mailService.js';
import { logger } from '../lib/logger.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

export const mailRoutes = Router();

mailRoutes.post('/invia', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ errore: 'Nessun PDF ricevuto' });
  const { email, oggetto, corpo } = req.body;
  const destinatari = String(email || '').split(',').map(e => e.trim()).filter(Boolean);
  if (!destinatari.length) return res.status(400).json({ errore: 'Nessun destinatario configurato per questo cliente' });

  try {
    const risultato = await inviaPdfAlCliente({
      bufferPdf: req.file.buffer,
      nomeFile: req.file.originalname,
      destinatari,
      oggetto,
      corpo,
    });
    res.json(risultato);
  } catch (err) {
    logger.error('Errore invio PDF al cliente', { errore: err.message });
    res.status(500).json({ errore: err.message });
  }
});
