import { Router } from 'express';
import { getConfig } from '../services/configService.js';
import { getTimesheet, calcolaRiepilogo } from '../services/timesheetService.js';
import { calcolaCompenso, calcolaBollo, getInvoice, saveInvoice, prossimoNumeroFattura, prossimoProgressivoInvio, verificaIntegritaNumerazione, listMesiFatturati, impostaScadenzaPagamento } from '../services/invoiceService.js';
import { generaXmlFatturaPA, generaNomeFileXml } from '../services/fatturaPaXmlGenerator.js';
import { validaDatiFatturaPA } from '../services/fatturaPaXmlValidator.js';
import { inviaFatturaViaPec } from '../services/pecService.js';
import { listaRicevutePerFattura, statoSdiFattura } from '../services/sdiRicevuteService.js';

export const invoiceRoutes = Router();

invoiceRoutes.get('/', async (req, res) => {
  res.json(await listMesiFatturati());
});

// Risolve il cliente dalla config (inclusi i disattivati: cancellazione è logica,
// una fattura storica di un cliente disattivato resta leggibile/rigenerabile).
function risolviCliente(config, clienteId) {
  return config.clienti.find((c) => c.id === clienteId) ?? null;
}

function clienteNonTrovato(res) {
  return res.status(404).json({ errore: 'Cliente non trovato in configurazione' });
}

// Calcola (senza salvare) la fattura pro-forma di un mese a partire dal timesheet.
invoiceRoutes.get('/:anno/:mese/:clienteId/anteprima', async (req, res) => {
  const { anno, mese, clienteId } = req.params;
  const config = await getConfig();
  const cliente = risolviCliente(config, clienteId);
  if (!cliente) return clienteNonTrovato(res);
  const timesheet = await getTimesheet(Number(anno), Number(mese), clienteId);
  const riepilogo = calcolaRiepilogo(timesheet);
  const compenso = calcolaCompenso({
    totaleOre: riepilogo.totaleOreDecimale,
    tariffaOraria: cliente.tariffaOraria,
    sogliaBolloVirtuale: config.fatturazione.sogliaBolloVirtuale,
    importoBollo: config.fatturazione.importoBollo,
  });
  res.json({ anno: Number(anno), mese: Number(mese), totaleOre: riepilogo.totaleOreDecimale, ...compenso });
});

// Calcola (senza salvare) bollo/netto per una fattura manuale a importo libero, senza timesheet.
invoiceRoutes.get('/:anno/:mese/:clienteId/anteprima-manuale', async (req, res) => {
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

invoiceRoutes.get('/:anno/:mese/:clienteId', async (req, res) => {
  const { anno, mese, clienteId } = req.params;
  const invoice = await getInvoice(Number(anno), Number(mese), clienteId);
  if (!invoice) return res.status(404).json({ errore: 'Fattura non ancora generata per questo mese' });
  res.json(invoice);
});

// Termine di pagamento pattuito col cliente: sempre modificabile, anche a fattura già
// accettata da SDI (dato commerciale, non fiscale — non passa da /genera).
invoiceRoutes.patch('/:anno/:mese/:clienteId/scadenza-pagamento', async (req, res) => {
  const { anno, mese, clienteId } = req.params;
  try {
    const invoice = await impostaScadenzaPagamento(Number(anno), Number(mese), clienteId, req.body.dataScadenzaPagamento);
    res.json(invoice);
  } catch (err) {
    res.status(404).json({ errore: err.message });
  }
});

// Genera e salva la fattura definitiva del mese (numero, data, importi congelati).
invoiceRoutes.post('/:anno/:mese/:clienteId/genera', async (req, res) => {
  const { anno, mese, clienteId } = req.params;
  const config = await getConfig();
  const cliente = risolviCliente(config, clienteId);
  if (!cliente) return clienteNonTrovato(res);

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
    const timesheet = await getTimesheet(Number(anno), Number(mese), clienteId);
    const riepilogo = calcolaRiepilogo(timesheet);
    compenso = calcolaCompenso({
      totaleOre: riepilogo.totaleOreDecimale,
      tariffaOraria: cliente.tariffaOraria,
      sogliaBolloVirtuale: config.fatturazione.sogliaBolloVirtuale,
      importoBollo: config.fatturazione.importoBollo,
    });
    oreTotali = riepilogo.totaleOreDecimale;
    tariffaOraria = cliente.tariffaOraria;
    descrizioneDefault = `Servizi di Informatica prestati per vs. Azienda conto terzi per un totale di ${riepilogo.totaleOreDecimale.toFixed(2)} ore mensili.`;
  }

  // Formato "Numero" a norma FatturaPA: progressivo numerico puro, senza barra/anno
  // (più compatibile con lo SDI secondo esperienza pregressa con formati misti).
  const numero = req.body.numero ?? await prossimoNumeroFattura(Number(anno), Number(mese), clienteId);

  const integrita = await verificaIntegritaNumerazione(Number(anno), Number(mese), clienteId, numero);
  if (!integrita.valido) {
    return res.status(409).json({ errore: integrita.errore });
  }

  const data = req.body.data ?? `${anno}-${String(mese).padStart(2, '0')}-28`;
  const descrizione = req.body.descrizione ?? descrizioneDefault;

  // Rigenerare una fattura (es. dopo modifica ore/importo) non deve perdere lo storico
  // degli invii/tentativi già fatti verso SDI: si riusa quello della fattura esistente.
  const esistente = await getInvoice(Number(anno), Number(mese), clienteId);

  // Una fattura accettata dallo SDI è emessa e non più modificabile per legge: eventuali
  // errori si correggono solo con nota di variazione, mai riscrivendo l'originale
  // (Circolare Agenzia Entrate 13/E/2018; principio di diritto n.17/2020).
  if (esistente) {
    const { stato } = await statoSdiFattura(esistente, config);
    if (stato === 'accettata') {
      return res.status(409).json({ errore: 'Fattura già accettata dallo SDI: non può essere rigenerata. Per correggere un errore, emetti una nota di variazione.' });
    }
  }

  const invoice = {
    anno: Number(anno), mese: Number(mese), clienteId, numero, data, descrizione,
    oreTotali, tariffaOraria,
    ...compenso,
    invii: esistente?.invii ?? [],
    dataPagamento: esistente?.dataPagamento ?? null,
  };
  await saveInvoice(Number(anno), Number(mese), clienteId, invoice);
  res.json(invoice);
});

// Progressivo dell'ultimo tentativo di invio, o del prossimo mai ancora fatto (fattura
// generata ma non ancora inviata): usato per nome file XML scaricabile "in anteprima".
function ultimoProgressivoONuovo(invoice) {
  const ultimo = invoice.invii?.at(-1)?.progressivoInvio;
  return ultimo ?? null;
}

// Genera l'XML FatturaPA della fattura già salvata e lo restituisce come download.
// Rispecchia l'ultimo tentativo di invio già effettuato (stesso ProgressivoInvio/nome
// file); se non è mai stata inviata, usa il progressivo che /invia-pec assegnerebbe.
invoiceRoutes.get('/:anno/:mese/:clienteId/xml', async (req, res) => {
  const { anno, mese, clienteId } = req.params;
  const config = await getConfig();
  const cliente = risolviCliente(config, clienteId);
  if (!cliente) return clienteNonTrovato(res);
  const invoice = await getInvoice(Number(anno), Number(mese), clienteId);
  if (!invoice) return res.status(404).json({ errore: 'Genera prima la fattura del mese' });

  const validazione = validaDatiFatturaPA({ fornitore: config.fornitore, cliente, fattura: invoice });
  if (!validazione.valido) {
    return res.status(422).json({ errore: 'Dati fattura non conformi a FatturaPA', dettagli: validazione.errori });
  }

  const progressivoInvio = ultimoProgressivoONuovo(invoice) ?? prossimoProgressivoInvio();
  const xml = generaXmlFatturaPA({
    fornitore: config.fornitore,
    cliente,
    fattura: { ...invoice, progressivoInvio },
  });
  const nomeFile = generaNomeFileXml(config.fornitore, progressivoInvio);

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${nomeFile}"`);
  res.send(xml);
});

// Invia l'XML alla PEC del Sistema di Interscambio. Ogni chiamata (primo invio o
// reinvio dopo scarto/mancata consegna) consuma un nuovo ProgressivoInvio: evita che
// SDI rifiuti il reinvio come duplicato (stesso identificativo trasmissione già visto).
invoiceRoutes.post('/:anno/:mese/:clienteId/invia-pec', async (req, res) => {
  const { anno, mese, clienteId } = req.params;
  const config = await getConfig();
  const cliente = risolviCliente(config, clienteId);
  if (!cliente) return clienteNonTrovato(res);
  const invoice = await getInvoice(Number(anno), Number(mese), clienteId);
  if (!invoice) return res.status(404).json({ errore: 'Genera prima la fattura del mese' });

  const validazione = validaDatiFatturaPA({ fornitore: config.fornitore, cliente, fattura: invoice });
  if (!validazione.valido) {
    return res.status(422).json({ errore: 'Dati fattura non conformi a FatturaPA', dettagli: validazione.errori });
  }

  const progressivoInvio = prossimoProgressivoInvio();
  const xml = generaXmlFatturaPA({ fornitore: config.fornitore, cliente, fattura: { ...invoice, progressivoInvio } });
  const nomeFile = generaNomeFileXml(config.fornitore, progressivoInvio);

  const risultato = await inviaFatturaViaPec(config.pec, { nomeFile, contenutoXml: xml });
  invoice.invii = [...(invoice.invii ?? []), {
    progressivoInvio,
    dataInvio: new Date().toISOString(),
    esito: risultato.inviato ? 'inviata' : 'errore-invio',
    errore: risultato.errore ?? null,
  }];
  await saveInvoice(Number(anno), Number(mese), clienteId, invoice);
  res.json(risultato);
});

// Timeline ricevute SDI già archiviate su disco per questa fattura (inviata/consegnata/scartata),
// cercate per ognuno dei ProgressivoInvio usati nei tentativi di invio (non solo l'ultimo:
// dopo uno scarto e reinvio, la ricevuta di scarto resta sul progressivo precedente).
invoiceRoutes.get('/:anno/:mese/:clienteId/ricevute-sdi', async (req, res) => {
  const { anno, mese, clienteId } = req.params;
  const config = await getConfig();
  const invoice = await getInvoice(Number(anno), Number(mese), clienteId);
  if (!invoice) return res.status(404).json({ errore: 'Genera prima la fattura del mese' });

  const progressivi = invoice.invii?.length ? invoice.invii.map((i) => i.progressivoInvio) : [];
  const risultati = await Promise.all(progressivi.map((progressivoInvio) => {
    const prefisso = generaNomeFileXml(config.fornitore, progressivoInvio).replace(/\.xml$/i, '');
    return listaRicevutePerFattura(config.sdi.percorsoArchivio, prefisso);
  }));
  res.json(risultati.flat().sort((a, b) => b.data.localeCompare(a.data)));
});
