// Import di storico pregresso: timesheet da xls originale, fatture da XML FatturaPA già emesse.
// Upload via multipart/form-data, file tenuto solo in memoria (nessun file temporaneo su disco).
import { Router } from 'express';
import multer from 'multer';
import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { importaTimesheetDaXls } from '../services/xlsTimesheetImporter.js';
import { importaFatturaDaXml } from '../services/xmlInvoiceImporter.js';
import { saveTimesheet } from '../services/timesheetService.js';
import { saveInvoice } from '../services/invoiceService.js';
import { getConfig } from '../services/configService.js';
import { logger } from '../lib/logger.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

export const importRoutes = Router();

// Importa un timesheet storico: richiede anno/mese espliciti perché il layout xls
// non li riporta in un formato univoco da estrarre in automatico.
importRoutes.post('/timesheet/:anno/:mese', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ errore: 'Nessun file caricato' });
  const { anno, mese } = req.params;
  try {
    const timesheet = importaTimesheetDaXls(req.file.buffer, Number(anno), Number(mese));
    await saveTimesheet(Number(anno), Number(mese), timesheet.giorni);
    logger.info(`Importato timesheet storico ${anno}-${mese} da ${req.file.originalname}`);
    res.json(timesheet);
  } catch (err) {
    logger.error(`Errore import timesheet ${anno}-${mese}`, { errore: err.message });
    res.status(400).json({ errore: `File non riconosciuto: ${err.message}` });
  }
});

async function fileEsiste(percorso) {
  try {
    await access(percorso);
    return true;
  } catch {
    return false;
  }
}

// Importa una fattura storica da XML FatturaPA: anno/mese/numero vengono letti dal file stesso.
// Se il file XML non è già presente nella cartella archivio (config.sdi.percorsoArchivio) lo
// copia lì; se esiste già non viene MAI sovrascritto, si importano solo i dati nell'app.
importRoutes.post('/fattura', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ errore: 'Nessun file caricato' });
  try {
    const invoice = importaFatturaDaXml(req.file.buffer.toString('utf-8'));
    if (!invoice.anno || !invoice.mese) {
      return res.status(400).json({ errore: 'Impossibile determinare anno/mese dal campo Data della fattura' });
    }
    await saveInvoice(invoice.anno, invoice.mese, invoice);

    const config = await getConfig();
    const percorsoArchivio = config.sdi.percorsoArchivio;
    let archiviato = null;
    if (percorsoArchivio) {
      const destinazione = path.join(percorsoArchivio, req.file.originalname);
      if (await fileEsiste(destinazione)) {
        logger.info(`File XML già presente in archivio, non sovrascritto: ${destinazione}`);
      } else {
        await mkdir(percorsoArchivio, { recursive: true });
        await writeFile(destinazione, req.file.buffer);
        archiviato = destinazione;
        logger.info(`XML copiato in archivio: ${destinazione}`);
      }
    }

    logger.info(`Importata fattura storica ${invoice.anno}-${invoice.mese} n.${invoice.numero} da ${req.file.originalname}`);
    res.json({ ...invoice, archiviato });
  } catch (err) {
    logger.error('Errore import fattura XML', { errore: err.message });
    res.status(400).json({ errore: `File non riconosciuto: ${err.message}` });
  }
});
