// Import di storico pregresso: timesheet da xls originale, fatture da XML FatturaPA già emesse.
// Upload via multipart/form-data, file tenuto solo in memoria (nessun file temporaneo su disco).
import { Router } from 'express';
import multer from 'multer';
import { XMLParser } from 'fast-xml-parser';
import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { importaTimesheetDaXls } from '../services/xlsTimesheetImporter.js';
import { importaFatturaDaXml } from '../services/xmlInvoiceImporter.js';
import { saveTimesheet } from '../services/timesheetService.js';
import { saveInvoice } from '../services/invoiceService.js';
import { getConfig, saveConfig } from '../services/configService.js';
import { logger } from '../lib/logger.js';
import { randomUUID } from 'node:crypto';

const xmlParser = new XMLParser({ removeNSPrefix: true, ignoreAttributes: true });

// Normalizza una partita IVA per il confronto: alcuni XML storici la riportano con
// spazi o col prefisso IdPaese incollato (es. "IT01234567890"), altri come puro numero.
// La p.iva italiana è sempre 11 cifre: uno zero iniziale può andare perso in fogli/import
// storici (es. "8364111008" invece di "08364111008"), quindi si reintegra col padding
// prima di confrontare, senza scartare cifre significative.
function normalizzaPiva(valore) {
  const pulita = String(valore || '').trim().toUpperCase().replace(/^IT/, '');
  return /^\d{1,11}$/.test(pulita) ? pulita.padStart(11, '0') : pulita;
}

// Estrae dall'header XML l'intera anagrafica CessionarioCommittente (il "cliente" per
// questa app, che emette fatture: vedi CedentePrestatore = fornitore in fatturaPaXmlGenerator.js).
function estraiAnagraficaCessionario(contenutoXml) {
  try {
    const documento = xmlParser.parse(contenutoXml);
    const header = documento.FatturaElettronica?.FatturaElettronicaHeader;
    const cessionario = header?.CessionarioCommittente;
    const anagrafici = cessionario?.DatiAnagrafici;
    const idCodice = anagrafici?.IdFiscaleIVA?.IdCodice;
    if (!idCodice) return null;
    const sede = cessionario?.Sede || {};
    return {
      partitaIva: String(idCodice),
      denominazione: String(anagrafici?.Anagrafica?.Denominazione || ''),
      indirizzo: String(sede.Indirizzo || ''),
      cap: String(sede.CAP || ''),
      comune: String(sede.Comune || ''),
      provincia: String(sede.Provincia || ''),
      // Il codice destinatario SDI sta in DatiTrasmissione, non dentro CessionarioCommittente.
      codiceDestinatarioSdi: String(header?.DatiTrasmissione?.CodiceDestinatario || ''),
    };
  } catch {
    return null;
  }
}

// L'XML FatturaPA non porta un nostro clienteId interno, solo la partita IVA del
// CessionarioCommittente: per un import storico si risolve il cliente cercando una
// corrispondenza univoca in config.clienti (inclusi i disattivati, coerente con la
// cancellazione logica). Se più di un cliente hanno quella p.iva, nessuna scelta
// automatica sicura è possibile: il chiamante deve specificare clienteId esplicitamente.
function risolviClienteIdDaXml(contenutoXml, clienti) {
  const anagrafica = estraiAnagraficaCessionario(contenutoXml);
  if (!anagrafica) return null;
  const piva = normalizzaPiva(anagrafica.partitaIva);
  const match = clienti.filter((c) => normalizzaPiva(c.partitaIva) === piva);
  return match.length === 1 ? match[0].id : null;
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

export const importRoutes = Router();

// Importa un timesheet storico: richiede anno/mese espliciti perché il layout xls
// non li riporta in un formato univoco da estrarre in automatico.
importRoutes.post('/timesheet/:anno/:mese/:clienteId', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ errore: 'Nessun file caricato' });
  const { anno, mese, clienteId } = req.params;
  try {
    const timesheet = importaTimesheetDaXls(req.file.buffer, Number(anno), Number(mese));
    await saveTimesheet(Number(anno), Number(mese), clienteId, timesheet.giorni);
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
    const contenutoXml = req.file.buffer.toString('utf-8');
    const invoice = importaFatturaDaXml(contenutoXml);
    if (!invoice.anno || !invoice.mese) {
      return res.status(400).json({ errore: 'Impossibile determinare anno/mese dal campo Data della fattura' });
    }

    let config = await getConfig();
    let clienteId = req.body.clienteId || risolviClienteIdDaXml(contenutoXml, config.clienti);
    if (!clienteId) {
      const anagrafica = estraiAnagraficaCessionario(contenutoXml);
      const pivaXml = anagrafica ? normalizzaPiva(anagrafica.partitaIva) : null;
      const ambiguo = pivaXml && config.clienti.filter((c) => normalizzaPiva(c.partitaIva) === pivaXml).length > 1;
      if (!anagrafica || ambiguo) {
        return res.status(400).json({
          errore: 'Impossibile determinare il cliente automaticamente dalla partita IVA nell\'XML: specificare clienteId nel form',
        });
      }
      // Nessun cliente con questa p.iva: lo creiamo dall'anagrafica XML invece di
      // bloccare l'import. Se un cliente con questa p.iva esiste già (caso raro, race
      // con normalizzazione) non lo tocchiamo: mai sovrascrivere anagrafica esistente.
      const nuovoCliente = {
        id: randomUUID(),
        attivo: true,
        denominazione: anagrafica.denominazione,
        indirizzo: anagrafica.indirizzo,
        cap: anagrafica.cap,
        comune: anagrafica.comune,
        provincia: anagrafica.provincia,
        partitaIva: anagrafica.partitaIva,
        codiceDestinatarioSdi: anagrafica.codiceDestinatarioSdi,
        logoDataUrl: '',
        tariffaOraria: 0,
        email: '',
      };
      config = await saveConfig({ clienti: [...config.clienti, nuovoCliente] });
      clienteId = nuovoCliente.id;
      logger.info(`Creato nuovo cliente da import XML: ${nuovoCliente.denominazione} (p.iva ${nuovoCliente.partitaIva})`);
    }
    invoice.clienteId = clienteId;
    await saveInvoice(invoice.anno, invoice.mese, clienteId, invoice);

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
