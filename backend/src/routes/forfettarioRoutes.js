import { Router } from 'express';
import multer from 'multer';
import { readFile } from 'node:fs/promises';
import { getConfig } from '../services/configService.js';
import { calcolaDashboardForfettario } from '../services/forfettarioService.js';
import { aggiornaAtecoSettoriDaGemini, elencaModelliGemini, verificaESalvaModelloGemini } from '../services/geminiAtecoService.js';
import { verificaESalvaModelloGroq, verificaESalvaModelloClaude } from '../services/pagamentiFattureService.js';
import { listVersamenti, aggiungiVersamento, eliminaVersamento, estraiVersamentiDaTesto, importaVersamenti, esportaVersamentiCsv } from '../services/versamentiF24Service.js';
import { esportaReportCommercialistaCsv } from '../services/exportService.js';
import { rilevaMappingColonne, estraiMovimentiDaCsv, proponiAbbinamenti, confermaPagamento, fattureAperte } from '../services/pagamentiFattureService.js';
import { prossimeScadenzeFiscali } from '../services/scadenzeFiscaliService.js';

export const forfettarioRoutes = Router();

const uploadCsv = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

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

// Verifica con una chiamata reale il modello Groq scelto dall'utente e lo salva se funziona
// (Impostazioni → AI → Groq AI). Nessuna ListModels: Groq non la espone, la select nel
// frontend elenca i modelli correnti noti (console.groq.com/docs/models).
forfettarioRoutes.post('/groq/modelli/verifica', async (req, res) => {
  const { modello } = req.body;
  if (!modello) return res.status(400).json({ errore: 'Modello mancante' });
  try {
    await verificaESalvaModelloGroq(modello);
    res.json({ ok: true, messaggio: `Modello "${modello}" verificato e salvato.` });
  } catch (err) {
    res.status(502).json({ ok: false, errore: err.message });
  }
});

// Verifica con una chiamata reale il modello Claude scelto dall'utente e lo salva se funziona
// (Impostazioni → AI → Claude AI).
forfettarioRoutes.post('/claude/modelli/verifica', async (req, res) => {
  const { modello } = req.body;
  if (!modello) return res.status(400).json({ errore: 'Modello mancante' });
  try {
    await verificaESalvaModelloClaude(modello);
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

// Fatture emesse non ancora incassate, per il widget "da incassare" in dashboard.
forfettarioRoutes.get('/fatture-aperte', async (req, res) => {
  res.json(await fattureAperte());
});

// Prossime scadenze fiscali (imposta sostitutiva, INPS) per il regime forfettario: date base
// calcolate (termini ordinari), arricchite se disponibile con proroghe/importi da Gemini/Claude
// (vedi scadenzeFiscaliService.js). Mai errore bloccante: fallback sono le date ordinarie.
forfettarioRoutes.get('/scadenze-fiscali', async (req, res) => {
  try {
    res.json(await prossimeScadenzeFiscali());
  } catch (err) {
    res.status(502).json({ errore: err.message, prossimoRetryIl: err.prossimoRetryIl ?? null });
  }
});

// Export CSV per il commercialista: fatture emesse nell'anno + riepilogo forfettario
// (vedi AI-Workspace/Plans/EXPORT_COMMERCIALISTA.md).
forfettarioRoutes.get('/export-commercialista', async (req, res) => {
  const anno = Number(req.query.anno) || new Date().getFullYear();
  const config = await getConfig();
  const csv = await esportaReportCommercialistaCsv(config, anno);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="report-commercialista-${anno}.csv"`);
  res.send(csv);
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

// Data di incasso fatture da CSV home banking: solo i nomi colonna vengono inviati a Gemini
// per il mapping (mai righe/importi/causali reali), vedi AI-Workspace/Plans/DATE_PAGAMENTO_FATTURE.md.
// Un unico endpoint: rileva mapping (cache o Gemini), estrae movimenti, propone abbinamenti.
forfettarioRoutes.post('/pagamenti/analizza-csv', uploadCsv.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ errore: 'Nessun file caricato' });
  try {
    const testoCsv = req.file.buffer.toString('utf-8');
    const [primaRiga] = testoCsv.split(/\r?\n/);
    const intestazioni = primaRiga.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    const mapping = await rilevaMappingColonne(intestazioni);
    const movimenti = estraiMovimentiDaCsv(testoCsv, mapping);
    if (!movimenti.length) return res.status(400).json({ errore: 'Nessun movimento riconosciuto nel file' });
    const proposte = await proponiAbbinamenti(movimenti);
    res.json({ proposte });
  } catch (err) {
    res.status(502).json({ errore: err.message });
  }
});

forfettarioRoutes.post('/pagamenti/conferma', async (req, res) => {
  const { anno, mese, clienteId, dataPagamento } = req.body;
  if (!anno || !mese || !clienteId || !dataPagamento) return res.status(400).json({ errore: 'Dati mancanti' });
  try {
    await confermaPagamento(Number(anno), Number(mese), clienteId, dataPagamento);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ errore: err.message });
  }
});
