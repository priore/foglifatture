import { Router } from 'express';
import { getConfig } from '../services/configService.js';
import { controllaRicevuteSdi, listaTutteRicevute } from '../services/sdiRicevuteService.js';
import { listMesiFatturati, getInvoice } from '../services/invoiceService.js';

export const sdiRoutes = Router();

// Ping manuale on-demand: controlla subito la PEC per nuove ricevute SDI.
// Rispetta lo stesso flag pollingAbilitato del controllo automatico: se l'utente
// ha disattivato il ping SDI in Impostazioni, blocchiamo anche quello manuale.
sdiRoutes.post('/controlla', async (req, res) => {
  const config = await getConfig();
  if (!config.sdi.pollingAbilitato) {
    return res.status(400).json({ nuove: 0, errore: 'Ping SDI disattivato in Impostazioni > PEC.' });
  }
  const risultato = await controllaRicevuteSdi(config.pec, config.sdi.percorsoArchivio);
  res.json(risultato);
});

// Cronologia PEC: invii SDI effettuati (letti dalle fatture salvate) + ricevute/notifiche
// SDI archiviate su disco, aggregati su tutte le fatture (non una sola come /ricevute-sdi).
sdiRoutes.get('/cronologia', async (req, res) => {
  const config = await getConfig();
  const mesi = await listMesiFatturati();
  const fatture = await Promise.all(mesi.map((m) => getInvoice(m.anno, m.mese, m.clienteId)));
  const invii = fatture.flatMap((f, i) => (f?.invii ?? []).map((invio) => ({
    ...invio, anno: mesi[i].anno, mese: mesi[i].mese, clienteId: mesi[i].clienteId,
  }))).sort((a, b) => b.dataInvio.localeCompare(a.dataInvio));
  const ricevute = await listaTutteRicevute(config.sdi.percorsoArchivio);
  res.json({ invii, ricevute });
});
