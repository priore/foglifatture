import { Router } from 'express';
import { getConfig } from '../services/configService.js';
import { getTimesheet, calcolaRiepilogo } from '../services/timesheetService.js';
import { calcolaCompenso, calcolaBollo, getInvoice, saveInvoice, prossimoNumeroFattura, verificaIntegritaNumerazione } from '../services/invoiceService.js';
import { generaXmlFatturaPA, generaNomeFileXml } from '../services/fatturaPaXmlGenerator.js';
import { inviaFatturaViaPec } from '../services/pecService.js';
import { listaRicevutePerFattura } from '../services/sdiRicevuteService.js';

export const invoiceRoutes = Router();

// Calcola (senza salvare) la fattura pro-forma di un mese a partire dal timesheet.
invoiceRoutes.get('/:anno/:mese/anteprima', async (req, res) => {
  const { anno, mese } = req.params;
  const config = await getConfig();
  const timesheet = await getTimesheet(Number(anno), Number(mese));
  const riepilogo = calcolaRiepilogo(timesheet);
  const compenso = calcolaCompenso({
    totaleOre: riepilogo.totaleOreDecimale,
    tariffaOraria: config.fatturazione.tariffaOraria,
    sogliaBolloVirtuale: config.fatturazione.sogliaBolloVirtuale,
    importoBollo: config.fatturazione.importoBollo,
  });
  res.json({ anno: Number(anno), mese: Number(mese), totaleOre: riepilogo.totaleOreDecimale, ...compenso });
});

// Calcola (senza salvare) bollo/netto per una fattura manuale a importo libero, senza timesheet.
invoiceRoutes.get('/:anno/:mese/anteprima-manuale', async (req, res) => {
  const importo = Number(req.query.importo);
  if (!Number.isFinite(importo) || importo <= 0) {
    return res.status(400).json({ errore: 'Importo non valido' });
  }
  const config = await getConfig();
  const compenso = calcolaBollo(
    Number(importo.toFixed(2)),
    config.fatturazione.sogliaBolloVirtuale,
    config.fatturazione.importoBollo
  );
  res.json({ anno: Number(req.params.anno), mese: Number(req.params.mese), ...compenso });
});

invoiceRoutes.get('/:anno/:mese', async (req, res) => {
  const { anno, mese } = req.params;
  const invoice = await getInvoice(Number(anno), Number(mese));
  if (!invoice) return res.status(404).json({ errore: 'Fattura non ancora generata per questo mese' });
  res.json(invoice);
});

// Genera e salva la fattura definitiva del mese (numero, data, importi congelati).
invoiceRoutes.post('/:anno/:mese/genera', async (req, res) => {
  const { anno, mese } = req.params;
  const config = await getConfig();

  const manuale = req.body.importo != null;
  let compenso, oreTotali, tariffaOraria, descrizioneDefault;

  if (manuale) {
    const importo = Number(req.body.importo);
    if (!Number.isFinite(importo) || importo <= 0) {
      return res.status(400).json({ errore: 'Importo non valido' });
    }
    compenso = calcolaBollo(
      Number(importo.toFixed(2)),
      config.fatturazione.sogliaBolloVirtuale,
      config.fatturazione.importoBollo
    );
    oreTotali = null;
    tariffaOraria = null;
    descrizioneDefault = null;
    if (!req.body.descrizione) {
      return res.status(400).json({ errore: 'Descrizione obbligatoria per fattura manuale' });
    }
  } else {
    const timesheet = await getTimesheet(Number(anno), Number(mese));
    const riepilogo = calcolaRiepilogo(timesheet);
    compenso = calcolaCompenso({
      totaleOre: riepilogo.totaleOreDecimale,
      tariffaOraria: config.fatturazione.tariffaOraria,
      sogliaBolloVirtuale: config.fatturazione.sogliaBolloVirtuale,
      importoBollo: config.fatturazione.importoBollo,
    });
    oreTotali = riepilogo.totaleOreDecimale;
    tariffaOraria = config.fatturazione.tariffaOraria;
    descrizioneDefault = `Servizi di Informatica prestati per vs. Azienda conto terzi per un totale di ${riepilogo.totaleOreDecimale.toFixed(2)} ore mensili.`;
  }

  // Formato "Numero" a norma FatturaPA: progressivo numerico puro, senza barra/anno
  // (più compatibile con lo SDI secondo esperienza pregressa con formati misti).
  const numero = req.body.numero ?? await prossimoNumeroFattura(Number(anno), Number(mese));

  const integrita = await verificaIntegritaNumerazione(Number(anno), Number(mese), numero);
  if (!integrita.valido) {
    return res.status(409).json({ errore: integrita.errore });
  }

  const data = req.body.data ?? new Date(Number(anno), Number(mese) - 1, 28).toISOString().slice(0, 10);
  const descrizione = req.body.descrizione ?? descrizioneDefault;

  const invoice = {
    anno: Number(anno), mese: Number(mese), numero, data, descrizione,
    oreTotali, tariffaOraria,
    ...compenso,
    progressivoInvio: config.fatturazione.progressivoInvio,
  };
  await saveInvoice(Number(anno), Number(mese), invoice);
  res.json(invoice);
});

// Genera l'XML FatturaPA della fattura già salvata e lo restituisce come download.
invoiceRoutes.get('/:anno/:mese/xml', async (req, res) => {
  const { anno, mese } = req.params;
  const config = await getConfig();
  const invoice = await getInvoice(Number(anno), Number(mese));
  if (!invoice) return res.status(404).json({ errore: 'Genera prima la fattura del mese' });

  const xml = generaXmlFatturaPA({
    fornitore: config.fornitore,
    cliente: config.cliente,
    fattura: invoice,
  });
  const nomeFile = generaNomeFileXml(config.fornitore, invoice.progressivoInvio);

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${nomeFile}"`);
  res.send(xml);
});

// Invia l'XML già generato alla PEC del Sistema di Interscambio.
invoiceRoutes.post('/:anno/:mese/invia-pec', async (req, res) => {
  const { anno, mese } = req.params;
  const config = await getConfig();
  const invoice = await getInvoice(Number(anno), Number(mese));
  if (!invoice) return res.status(404).json({ errore: 'Genera prima la fattura del mese' });

  const xml = generaXmlFatturaPA({ fornitore: config.fornitore, cliente: config.cliente, fattura: invoice });
  const nomeFile = generaNomeFileXml(config.fornitore, invoice.progressivoInvio);

  const risultato = await inviaFatturaViaPec(config.pec, { nomeFile, contenutoXml: xml });
  res.json(risultato);
});

// Timeline ricevute SDI già archiviate su disco per questa fattura (inviata/consegnata/scartata).
invoiceRoutes.get('/:anno/:mese/ricevute-sdi', async (req, res) => {
  const { anno, mese } = req.params;
  const config = await getConfig();
  const invoice = await getInvoice(Number(anno), Number(mese));
  if (!invoice) return res.status(404).json({ errore: 'Genera prima la fattura del mese' });

  const nomeFile = generaNomeFileXml(config.fornitore, invoice.progressivoInvio);
  const prefisso = nomeFile.replace(/\.xml$/i, '');
  const ricevute = await listaRicevutePerFattura(config.sdi.percorsoArchivio, prefisso);
  res.json(ricevute);
});
