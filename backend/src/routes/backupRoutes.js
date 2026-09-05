// Esportazione/ripristino manuale del backup cifrato di backend/data/.
import { Router } from 'express';
import multer from 'multer';
import { creaBackup, ripristinaBackup, avviaBackupAutomatico, fermaBackupAutomatico } from '../services/backupService.js';
import { getConfig, saveConfig } from '../services/configService.js';
import { logger } from '../lib/logger.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } });

export const backupRoutes = Router();

backupRoutes.post('/esporta', async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ errore: 'Password mancante' });
  try {
    const buffer = await creaBackup(password);
    const nomeFile = `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.tsbk`;
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${nomeFile}"`);
    res.send(buffer);
  } catch (err) {
    logger.error('Errore esportazione backup', { errore: err.message });
    res.status(500).json({ errore: err.message });
  }
});

backupRoutes.post('/ripristina', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ errore: 'Nessun file caricato' });
  const { password } = req.body;
  if (!password) return res.status(400).json({ errore: 'Password mancante' });
  try {
    const risultato = await ripristinaBackup(req.file.buffer, password);
    logger.info(`Backup ripristinato: ${risultato.fileRipristinati} file`);
    res.json(risultato);
  } catch (err) {
    logger.error('Errore ripristino backup', { errore: err.message });
    res.status(400).json({ errore: err.message });
  }
});

// Salva le impostazioni di backup automatico e riavvia subito lo scheduler con i nuovi valori,
// stesso schema di sdiRoutes per il polling ricevute.
backupRoutes.put('/impostazioni', async (req, res) => {
  const config = await saveConfig({ backup: req.body });
  fermaBackupAutomatico();
  if (config.backup.abilitato) {
    avviaBackupAutomatico(getConfig, config.backup.intervalloOreMinuti);
  }
  res.json(config.backup);
});
