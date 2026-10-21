import { Router } from 'express';
import multer from 'multer';
import { readFile } from 'node:fs/promises';
import { getConfig, saveConfig } from '../services/configService.js';
import { calcolaDashboardForfettario } from '../services/forfettarioService.js';
import { aggiornaAtecoSettoriDaGemini, elencaModelliGemini, verificaESalvaModelloGemini } from '../services/geminiAtecoService.js';
import { verificaESalvaModelloGroq, verificaESalvaModelloClaude } from '../services/pagamentiFattureService.js';
import { listVersamenti, aggiungiVersamento, eliminaVersamento, estraiVersamentiDaTesto, importaVersamenti, esportaVersamentiCsv } from '../services/versamentiF24Service.js';
import { esportaReportCommercialistaCsv } from '../services/exportService.js';
import { rilevaMappingColonne, estraiMovimentiDaCsv, proponiAbbinamenti, confermaPagamento, confermaPagamentoBtc, confermaPagamentoValuta, eliminaPagamento, fattureAperte } from '../services/pagamentiFattureService.js';
import { cambioPer, valuteSupportate } from '../services/cambiValutaService.js';
import { prossimeScadenzeFiscali, scadenzeIntrastatAnno } from '../services/scadenzeFiscaliService.js';
import { stimaVersamenti, accantonamentoAnno } from '../services/stimaVersamentiService.js';
import { prospettoDichiarazione } from '../services/prospettoDichiarazioneService.js';
import { generaProspettoPdf } from '../services/prospettoDichiarazionePdfService.js';
import { generaF24Pdf } from '../services/f24PdfService.js';
import { listF24, creaF24DaPiano, creaF24DaPianoConCompensazione, aggiornaStatoF24, eliminaF24, filtraGiaPresentiInF24 } from '../services/f24StateService.js';
import { listCrediti, aggiungiCredito, eliminaCredito, creditiConResiduo, suggerisciOrdineCrediti } from '../services/creditiService.js';
import { leggiMovimenti, aggiungiIngresso, aggiungiUscita, eliminaIngresso, eliminaUscita, impostaValoreMercato } from '../services/movimentiBtcService.js';
import { lottiConStato, calcolaPlusvalenze, riepilogoAnnuale, anteprimaUscita } from '../services/lottiBtcService.js';
import { importaDaFile } from '../services/importFileBtcService.js';
import { leggiProposte, confermaProposta, scartaProposta, ripristinaProposta, controllaOra } from '../services/importBtcService.js';
import { scadenzeBollo } from '../services/bolloTrimestrale.js';

export const forfettarioRoutes = Router();

const uploadCsv = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const percorsoAteco = new URL('../data/atecoSettori.json', import.meta.url);
const percorsoSediInps = new URL('../data/sediInps.json', import.meta.url);

// Elenco codici ATECO (codice, descrizione, settore, coefficiente di redditività) per la select in Impostazioni.
forfettarioRoutes.get('/settori-ateco', async (req, res) => {
  const json = await readFile(percorsoAteco, 'utf-8');
  res.type('application/json').send(json);
});

// Elenco ufficiale codici sede INPS (tabella AdE) per il popup di ricerca in Impostazioni.
forfettarioRoutes.get('/sedi-inps', async (req, res) => {
  const json = await readFile(percorsoSediInps, 'utf-8');
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
    const risultato = await prossimeScadenzeFiscali();
    // Aggiunge scadenze Intrastat se il fornitore è iscritto al VIES e ha clienti UE attivi
    try {
      const config = await getConfig();
      const anno = new Date().getFullYear();
      const paesiUeSet = new Set([
        'AT','BE','BG','CY','CZ','DE','DK','EE','ES','FI','FR','GR','HR','HU',
        'IE','LT','LU','LV','MT','NL','PL','PT','RO','SE','SI','SK',
      ]);
      const haClientiUe = config.clienti.some(
        (c) => c.attivo && c.tipo === 'azienda' && paesiUeSet.has((c.paese ?? 'IT').toUpperCase()) && (c.paese ?? 'IT').toUpperCase() !== 'IT'
      );
      if (config.fornitore.iscrittoVies && haClientiUe) {
        risultato.scadenze = [...risultato.scadenze, ...scadenzeIntrastatAnno(anno)]
          .sort((a, b) => a.data.localeCompare(b.data));
      }
    } catch { /* non bloccare se i clienti non si leggono */ }
    res.json(risultato);
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
  let versamenti = estraiVersamentiDaTesto(testo);
  if (!versamenti.length) return res.status(400).json({ errore: 'Nessun versamento riconosciuto nel testo incollato' });
  versamenti = await filtraGiaPresentiInF24(versamenti);
  res.json(await importaVersamenti(versamenti));
});

// Salva il numero di rate per saldo + I acconto (Step 7 F24_STEP3).
forfettarioRoutes.put('/versamenti-stimati/rate-saldo', async (req, res) => {
  try {
    const nRate = Number(req.body.rateSaldo);
    if (!Number.isInteger(nRate) || nRate < 1 || nRate > 7) {
      return res.status(400).json({ errore: 'rateSaldo deve essere un intero da 1 a 7' });
    }
    const config = await getConfig();
    config.forfettario = { ...(config.forfettario ?? {}), rateSaldo: nRate };
    await saveConfig(config);
    res.json({ rateSaldo: nRate });
  } catch (err) {
    res.status(500).json({ errore: err.message });
  }
});

// Stima versamenti F24 per l'anno fiscale (imposta sostitutiva + INPS gestione separata).
forfettarioRoutes.get('/versamenti-stimati', async (req, res) => {
  try {
    const anno = req.query.anno ? Number(req.query.anno) : new Date().getFullYear();
    const config = await getConfig();
    res.json(await stimaVersamenti(config, anno));
  } catch (err) {
    res.status(500).json({ errore: err.message });
  }
});

// K1: quota da accantonare e piano di cassa contro le uscite F24.
forfettarioRoutes.get('/accantonamento', async (req, res) => {
  try {
    const anno = req.query.anno ? Number(req.query.anno) : new Date().getFullYear();
    res.json(await accantonamentoAnno(await getConfig(), anno));
  } catch (err) {
    res.status(500).json({ errore: err.message });
  }
});

// K3: prospetto rigo per rigo per la dichiarazione Redditi PF (LM, RR, RX31).
forfettarioRoutes.get('/dichiarazione', async (req, res) => {
  try {
    const anno = req.query.anno ? Number(req.query.anno) : new Date().getFullYear() - 1;
    res.json(await prospettoDichiarazione(await getConfig(), anno));
  } catch (err) {
    res.status(500).json({ errore: err.message });
  }
});

forfettarioRoutes.get('/dichiarazione/pdf', async (req, res) => {
  try {
    const anno = req.query.anno ? Number(req.query.anno) : new Date().getFullYear() - 1;
    const config = await getConfig();
    const pdf = await generaProspettoPdf(await prospettoDichiarazione(config, anno), config);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Redditi-PF-quadro-LM-${anno}.pdf"`);
    res.send(pdf);
  } catch (err) {
    res.status(500).json({ errore: err.message });
  }
});

// PDF F24 precompilato per una scadenza del piano versamenti stimati.
// FP-023: stesura F24 sul modello ufficiale AdE.
// :anno = anno fiscale, :indice = indice della scadenza nell'array (0 = giugno, 1 = novembre).
forfettarioRoutes.get('/versamenti-stimati/:anno/f24/:indice/pdf', async (req, res) => {
  try {
    const anno   = Number(req.params.anno);
    const indice = Number(req.params.indice);
    const config = await getConfig();
    const piano  = await stimaVersamenti(config, anno);
    const sc = piano.scadenze?.[indice];
    if (!sc) return res.status(404).json({ errore: `Nessuna scadenza all\'indice ${indice} per l\'anno ${anno}.` });
    const pdf = await generaF24Pdf(sc, config, { provvisorie: piano.regole?.provvisorie, annoRegole: piano.regole?.anno });
    const nomeFile = `F24-${anno}-scad${indice + 1}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nomeFile}"`);
    res.send(pdf);
  } catch (err) {
    res.status(500).json({ errore: err.message });
  }
});

// Stato F24: lista, creazione da piano, cambio stato, eliminazione.
// FP-024 · FEATURES_GAP_ANALISI_ESTERNA.md voce 8.
forfettarioRoutes.get('/f24', async (req, res) => {
  try {
    const anno = req.query.anno ? Number(req.query.anno) : undefined;
    res.json(await listF24(anno));
  } catch (err) {
    res.status(500).json({ errore: err.message });
  }
});

forfettarioRoutes.post('/f24', async (req, res) => {
  try {
    const config = await getConfig();
    const { anno, indice } = req.body;
    if (anno == null || indice == null) return res.status(400).json({ errore: 'anno e indice obbligatori' });
    const piano = await stimaVersamenti(config, Number(anno));
    const sc = piano.scadenze?.[Number(indice)];
    if (!sc) return res.status(404).json({ errore: `Nessuna scadenza all'indice ${indice} per l'anno ${anno}.` });
    const f24 = await creaF24DaPiano(sc, sc.tipo ?? `F24 ${anno}`);
    res.status(201).json(f24);
  } catch (err) {
    res.status(500).json({ errore: err.message });
  }
});

forfettarioRoutes.patch('/f24/:id/stato', async (req, res) => {
  try {
    const { stato } = req.body;
    if (!stato) return res.status(400).json({ errore: 'stato obbligatorio' });
    const f24 = await aggiornaStatoF24(req.params.id, stato);
    res.json(f24);
  } catch (err) {
    const status = err.message.includes('non trovato') ? 404 : err.message.includes('non valido') ? 400 : 500;
    res.status(status).json({ errore: err.message });
  }
});

forfettarioRoutes.delete('/f24/:id', async (req, res) => {
  try {
    await eliminaF24(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(err.message.includes('non trovato') ? 404 : 500).json({ errore: err.message });
  }
});

// Crediti fiscali compensabili (FP-016).
forfettarioRoutes.get('/crediti', async (req, res) => {
  try { res.json(await listCrediti()); } catch (err) { res.status(500).json({ errore: err.message }); }
});

forfettarioRoutes.get('/crediti/residui', async (req, res) => {
  try { res.json(await creditiConResiduo()); } catch (err) { res.status(500).json({ errore: err.message }); }
});

// G-AI C.9 — body: { anno?, conferma?: boolean, ricorda?: boolean }. 403 se l'utente non ha autorizzato l'invio dati.
forfettarioRoutes.post('/crediti/suggerisci-ordine', async (req, res) => {
  try {
    const { conferma, ricorda } = req.body ?? {};
    let config = await getConfig();
    if (ricorda === true && conferma === true) config = await saveConfig({ ai: { autorizzaDatiFiscali: true } });
    const piano = await stimaVersamenti(config, Number(req.body?.anno) || new Date().getFullYear()).catch(() => ({ scadenze: [] }));
    const oggi = new Date().toISOString().slice(0, 10);
    const scadenze = (piano.scadenze ?? []).filter((s) => !s.data || s.data >= oggi);
    res.json(await suggerisciOrdineCrediti({ config, scadenze, soglia: piano.regole?.compensazione?.sogliaOrizzontale, conferma }));
  } catch (err) {
    res.status(err.codice === 'AUTORIZZAZIONE_RICHIESTA' ? 403 : 400).json({ errore: err.message, codice: err.codice });
  }
});

forfettarioRoutes.post('/crediti', async (req, res) => {
  try {
    const credito = await aggiungiCredito(req.body);
    res.status(201).json(credito);
  } catch (err) {
    res.status(400).json({ errore: err.message });
  }
});

forfettarioRoutes.delete('/crediti/:id', async (req, res) => {
  try {
    await eliminaCredito(req.params.id);
    res.status(204).end();
  } catch (err) {
    const status = err.message.includes('non trovato') ? 404 : err.message.includes('già usato') ? 409 : 500;
    res.status(status).json({ errore: err.message });
  }
});

// Crea F24 con compensazione crediti applicata.
// POST /forfettario/f24/con-compensazione — body: { anno, indice }
forfettarioRoutes.post('/f24/con-compensazione', async (req, res) => {
  try {
    const config = await getConfig();
    const { anno, indice } = req.body;
    if (anno == null || indice == null) return res.status(400).json({ errore: 'anno e indice obbligatori' });
    const piano = await stimaVersamenti(config, Number(anno));
    const sc = piano.scadenze?.[Number(indice)];
    if (!sc) return res.status(404).json({ errore: `Nessuna scadenza all'indice ${indice} per l'anno ${anno}.` });
    const f24 = await creaF24DaPianoConCompensazione(sc, sc.tipo ?? `F24 ${anno}`, Number(anno));
    res.status(201).json(f24);
  } catch (err) {
    res.status(500).json({ errore: err.message });
  }
});

// Bollo trimestrale: scadenze e importi per anno.
// FP-025 · FEATURES_GAP_ANALISI_ESTERNA.md voce 10.
forfettarioRoutes.get('/bollo/:anno', async (req, res) => {
  try {
    const anno = Number(req.params.anno);
    res.json(await scadenzeBollo(anno));
  } catch (err) {
    res.status(500).json({ errore: err.message });
  }
});

// PDF F24 bollo per un trimestre specifico.
// :anno = anno fiscale, :trim = numero trimestre (1-4).
forfettarioRoutes.get('/bollo/:anno/trim/:trim/f24/pdf', async (req, res) => {
  try {
    const anno = Number(req.params.anno);
    const trim = Number(req.params.trim);
    const config = await getConfig();
    const dati = await scadenzeBollo(anno);
    const sc = dati.scadenze.find((s) => s.trimestre === trim);
    if (!sc) return res.status(404).json({ errore: `Nessuna scadenza bollo per il trimestre ${trim} dell'anno ${anno}.` });
    const pdf = await generaF24Pdf(sc, config);
    const nomeFile = `F24-bollo-${anno}-Q${trim}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nomeFile}"`);
    res.send(pdf);
  } catch (err) {
    res.status(500).json({ errore: err.message });
  }
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
  const { anno, mese, clienteId, dataPagamento, importo } = req.body;
  if (!anno || !mese || !clienteId || !dataPagamento || !importo) return res.status(400).json({ errore: 'Dati mancanti' });
  try {
    const fattura = await confermaPagamento(Number(anno), Number(mese), clienteId, dataPagamento, Number(importo));
    res.json({ ok: true, fattura });
  } catch (err) {
    res.status(400).json({ errore: err.message });
  }
});

forfettarioRoutes.post('/pagamenti/conferma-btc', async (req, res) => {
  const { anno, mese, clienteId, dataPagamento, txid, satoshi, cambioEurBtc, fonteCambio, dataOraCambio, indirizzoDestinatario } = req.body;
  if (!anno || !mese || !clienteId || !dataPagamento) return res.status(400).json({ errore: 'Dati mancanti' });
  try {
    const fattura = await confermaPagamentoBtc(Number(anno), Number(mese), clienteId, dataPagamento, {
      txid, satoshi: Number(satoshi), cambioEurBtc: Number(cambioEurBtc), fonteCambio, dataOraCambio, indirizzoDestinatario,
    });
    res.json({ ok: true, fattura });
  } catch (err) {
    res.status(400).json({ errore: err.message });
  }
});

forfettarioRoutes.post('/pagamenti/conferma-valuta', async (req, res) => {
  const { anno, mese, clienteId, dataPagamento, codiceValuta, importoValuta, cambio, fonte, dataQuotazione } = req.body;
  if (!anno || !mese || !clienteId || !dataPagamento) return res.status(400).json({ errore: 'Dati mancanti' });
  try {
    const fattura = await confermaPagamentoValuta(Number(anno), Number(mese), clienteId, dataPagamento, {
      codiceValuta, importoValuta: Number(importoValuta), cambio: Number(cambio), fonte, dataQuotazione,
    });
    res.json({ ok: true, fattura });
  } catch (err) {
    res.status(400).json({ errore: err.message });
  }
});

forfettarioRoutes.get('/cambi/:data/:valuta', async (req, res) => {
  const { data, valuta } = req.params;
  try {
    const risultato = await cambioPer(valuta.toUpperCase(), data);
    res.json(risultato);
  } catch (err) {
    res.status(502).json({ errore: err.message });
  }
});

forfettarioRoutes.get('/cambi/valute', async (_req, res) => {
  res.json(valuteSupportate());
});

forfettarioRoutes.delete('/pagamenti/:anno/:mese/:clienteId/:indice', async (req, res) => {
  const { anno, mese, clienteId, indice } = req.params;
  try {
    const fattura = await eliminaPagamento(Number(anno), Number(mese), clienteId, Number(indice));
    res.json({ ok: true, fattura });
  } catch (err) {
    res.status(400).json({ errore: err.message });
  }
});

// ── Registro lotti BTC (FP-012/013, piano REGISTRO_LOTTI_BTC.md Step 5) ─────
const annoQuery = (req) => (req.query.anno ? Number(req.query.anno) : new Date().getFullYear());

forfettarioRoutes.get('/btc/movimenti', async (_req, res) => {
  const { ingressi, uscite } = await leggiMovimenti();
  res.json({ ingressi, uscite });
});

forfettarioRoutes.post('/btc/movimenti/ingresso', async (req, res) => {
  try {
    res.status(201).json(await aggiungiIngresso(req.body));
  } catch (err) {
    res.status(400).json({ errore: err.message });
  }
});

forfettarioRoutes.post('/btc/movimenti/uscita', async (req, res) => {
  try {
    res.status(201).json(await aggiungiUscita(req.body));
  } catch (err) {
    res.status(400).json({ errore: err.message });
  }
});

// L'id distingue il tipo (IN-MAN-… / OUT-…).
forfettarioRoutes.delete('/btc/movimenti/:id', async (req, res) => {
  try {
    const { id } = req.params;
    res.json(await (id.startsWith('OUT-') ? eliminaUscita(id) : eliminaIngresso(id)));
  } catch (err) {
    res.status(404).json({ errore: err.message });
  }
});

forfettarioRoutes.get('/btc/lotti', async (req, res) => {
  res.json(await lottiConStato(annoQuery(req)));
});

forfettarioRoutes.get('/btc/plusvalenze', async (req, res) => {
  res.json(await calcolaPlusvalenze(annoQuery(req)));
});

forfettarioRoutes.get('/btc/rw', async (req, res) => {
  res.json(await riepilogoAnnuale(annoQuery(req)));
});

forfettarioRoutes.post('/btc/plusvalenze/anteprima', async (req, res) => {
  try {
    res.json(await anteprimaUscita(req.body));
  } catch (err) {
    res.status(400).json({ errore: err.message });
  }
});

forfettarioRoutes.put('/btc/rw/valore-mercato', async (req, res) => {
  try {
    const valoriMercato = await impostaValoreMercato(Number(req.body.anno), req.body.prezzoEurBtc);
    res.json({ valoriMercato });
  } catch (err) {
    res.status(400).json({ errore: err.message });
  }
});

// Import da file CSV/JSON (wallet/exchange): multipart come /pagamenti/analizza-csv. Crea solo proposte.
// Formato CSV sconosciuto: la prima chiamata restituisce il mapping proposto dall'AI, che l'utente
// conferma rinviando lo stesso file con `mapping` (JSON). `conferma=true` autorizza l'invio all'AI.
forfettarioRoutes.post('/btc/import/file', uploadCsv.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ errore: 'Nessun file caricato' });
  try {
    res.json(await importaDaFile(req.file.buffer.toString('utf-8'), {
      formato: req.body.formato || 'auto',
      mapping: req.body.mapping ? JSON.parse(req.body.mapping) : undefined,
      conferma: req.body.conferma === 'true',
      config: await getConfig(),
    }));
  } catch (err) {
    res.status(err.codice === 'AUTORIZZAZIONE_RICHIESTA' ? 403 : 400).json({ errore: err.message, codice: err.codice });
  }
});

// Proposte di import (polling blockchain + file) e stato del polling: la UI le conferma o le scarta.
forfettarioRoutes.get('/btc/import', async (_req, res) => {
  const { importBtc, walletBtc } = await getConfig();
  const { proposte, ultimoControllo, ultimoErrore } = await leggiProposte();
  res.json({
    proposte, ultimoControllo, ultimoErrore,
    impostazioni: { abilitato: importBtc.abilitato, avvisoPrivacyAccettato: importBtc.avvisoPrivacyAccettato, intervalloMinuti: importBtc.intervalloMinuti, walletConfigurati: walletBtc.length > 0 },
  });
});

forfettarioRoutes.post('/btc/import/controlla', async (_req, res) => {
  const config = await getConfig();
  if (!config.importBtc.avvisoPrivacyAccettato) return res.status(400).json({ errore: 'Accetta prima l\'avviso privacy in Impostazioni → Fornitore' });
  if (!config.walletBtc.length) return res.status(400).json({ errore: 'Nessun indirizzo wallet configurato' });
  try {
    res.json(await controllaOra(config));
  } catch (err) {
    res.status(502).json({ errore: err.message });
  }
});

for (const [azione, fn] of [['conferma', confermaProposta], ['scarta', scartaProposta], ['ripristina', ripristinaProposta]]) {
  forfettarioRoutes.post(`/btc/import/proposte/:id/${azione}`, async (req, res) => {
    try {
      res.json(await fn(req.params.id, req.body));
    } catch (err) {
      res.status(400).json({ errore: err.message });
    }
  });
}
