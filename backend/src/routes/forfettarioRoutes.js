import { Router } from 'express';
import { readFile } from 'node:fs/promises';
import { getConfig } from '../services/configService.js';
import { calcolaDashboardForfettario } from '../services/forfettarioService.js';
import { aggiornaAtecoSettoriDaGemini, elencaModelliGemini, verificaESalvaModelloGemini } from '../services/geminiAtecoService.js';
import { listVersamenti, aggiungiVersamento, eliminaVersamento, estraiVersamentiDaTesto, importaVersamenti, esportaVersamentiCsv } from '../services/versamentiF24Service.js';

export const forfettarioRoutes = Router();

const percorsoAteco = new URL('../data/atecoSettori.json', import.meta.url);

// Elenco codici ATECO (codice, descrizione, settore, coefficiente di redditività) per la select in Impostazioni.
forfettarioRoutes.get('/settori-ateco', async (req, res) => {
  const json = await readFile(percorsoAteco, 'utf-8');
  res.type('application/json').send(json);
});

// Rigenera l'elenco via Gemini (icona "aggiorna" accanto alla ricerca ATECO in Impostazioni → Forfettario).
forfettarioRoutes.post('/settori-ateco/aggiorna', async (req, res) => {
  try {
    const numero = await aggiornaAtecoSettoriDaGemini();
    res.json({ ok: true, numero });
  } catch (err) {
    res.status(502).json({ ok: false, errore: err.message });
  }
});

// Elenco modelli Gemini disponibili per questa API key (Impostazioni → Google → Gemini).
forfettarioRoutes.get('/gemini/modelli', async (req, res) => {
  try {
    const modelli = await elencaModelliGemini();
    res.json({ modelli });
  } catch (err) {
    res.status(502).json({ errore: err.message });
  }
});

// Verifica con una chiamata reale il modello scelto dall'utente e lo salva se funziona.
forfettarioRoutes.post('/gemini/modelli/verifica', async (req, res) => {
  const { modello } = req.body;
  if (!modello) return res.status(400).json({ errore: 'Modello mancante' });
  try {
    await verificaESalvaModelloGemini(modello);
    res.json({ ok: true, messaggio: `Modello "${modello}" verificato e salvato.` });
  } catch (err) {
    res.status(502).json({ ok: false, errore: err.message });
  }
});

forfettarioRoutes.get('/dashboard', async (req, res) => {
  const config = await getConfig();
  const anno = req.query.anno ? Number(req.query.anno) : undefined;
  const dashboard = await calcolaDashboardForfettario(config, anno ? { anno } : {});
  res.json(dashboard);
});

// Versamenti F24 effettivi (imposta sostitutiva, INPS) inseriti a mano, per il confronto
// stimato/versato in dashboard (vedi AI-Workspace/Plans/F24_STEP1_RICOGNIZIONE.md).
forfettarioRoutes.get('/versamenti', async (req, res) => {
  const anno = req.query.anno ? Number(req.query.anno) : undefined;
  res.json(await listVersamenti(anno));
});

forfettarioRoutes.post('/versamenti', async (req, res) => {
  try {
    const versamento = await aggiungiVersamento(req.body);
    res.status(201).json(versamento);
  } catch (err) {
    res.status(400).json({ errore: err.message });
  }
});

forfettarioRoutes.delete('/versamenti/:id', async (req, res) => {
  await eliminaVersamento(req.params.id);
  res.status(204).end();
});

// Import da testo incollato dal Cassetto Fiscale (Versamenti > Modello F24, dopo cmd+A/cmd+C
// sulla pagina). /anteprima estrae senza salvare, per mostrare all'utente cosa verrà importato
// prima di confermare.
forfettarioRoutes.post('/versamenti/importa-testo/anteprima', async (req, res) => {
  const { testo } = req.body;
  if (!testo) return res.status(400).json({ errore: 'Testo mancante' });
  const versamenti = estraiVersamentiDaTesto(testo);
  if (!versamenti.length) return res.status(400).json({ errore: 'Nessun versamento riconosciuto nel testo incollato' });
  res.json({ versamenti });
});

forfettarioRoutes.get('/versamenti/export', async (req, res) => {
  const anno = req.query.anno ? Number(req.query.anno) : undefined;
  const csv = esportaVersamentiCsv(await listVersamenti(anno));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="versamenti-f24-${anno ?? 'tutti'}.csv"`);
  res.send(csv);
});

forfettarioRoutes.post('/versamenti/importa-testo', async (req, res) => {
  const { testo } = req.body;
  if (!testo) return res.status(400).json({ errore: 'Testo mancante' });
  const versamenti = estraiVersamentiDaTesto(testo);
  if (!versamenti.length) return res.status(400).json({ errore: 'Nessun versamento riconosciuto nel testo incollato' });
  res.json(await importaVersamenti(versamenti));
});
