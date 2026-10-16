import { Router } from 'express';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { gestisciRichiesta, statoMcp, impostaMcpAbilitato, rigeneraTokenMcp, tokenMcpValido } from '../services/mcpService.js';

// Trasporto HTTP del server MCP: fuori dalla sessione Google (i client MCP non hanno cookie),
// protetto dal token statico generato in Impostazioni.
export const mcpRoutes = Router();

const sessioniSse = new Map();

async function richiedeToken(req, res, next) {
  const bearer = req.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (await tokenMcpValido(bearer ?? req.query.token)) return next();
  const { abilitato } = await statoMcp();
  return res.status(abilitato ? 401 : 503).json({ errore: abilitato ? 'Token MCP non valido' : 'MCP non abilitato' });
}

// Legacy HTTP+SSE: il client apre GET /mcp, riceve l'URL dove POSTare i messaggi
// e le risposte tornano sullo stesso stream.
mcpRoutes.get('/', richiedeToken, (req, res) => {
  const id = randomUUID();
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders();
  sessioniSse.set(id, res);
  res.on('close', () => sessioniSse.delete(id));
  // Se il client si è autenticato con ?token=, lo stesso token va ripetuto nell'URL dei messaggi.
  const token = req.query.token ? `&token=${encodeURIComponent(req.query.token)}` : '';
  res.write(`event: endpoint\ndata: ${req.baseUrl}/messages?sessionId=${id}${token}\n\n`);
});

mcpRoutes.post('/messages', richiedeToken, async (req, res) => {
  const stream = sessioniSse.get(req.query.sessionId);
  if (!stream) return res.status(404).json({ errore: 'Sessione SSE non trovata' });
  const risposta = await gestisciRichiesta(req.body);
  if (risposta) stream.write(`event: message\ndata: ${JSON.stringify(risposta)}\n\n`);
  res.status(202).end();
});

// Streamable HTTP (client recenti): POST /mcp con risposta JSON diretta.
mcpRoutes.post('/', richiedeToken, async (req, res) => {
  const risposta = await gestisciRichiesta(req.body);
  if (!risposta) return res.status(202).end();
  res.json(risposta);
});

// Gestione da Impostazioni (dietro autenticazione normale dell'app).
export const mcpConfigRoutes = Router();

const STDIO_ENTRY = path.join(import.meta.dirname, '..', 'mcpStdio.js');

async function statoPerUi(req) {
  const { abilitato, token } = await statoMcp();
  return {
    abilitato,
    token,
    urlHttp: token ? `${req.protocol}://${req.get('host')}/mcp?token=${token}` : '',
    comandoNode: process.execPath,
    percorsoStdio: STDIO_ENTRY,
  };
}

mcpConfigRoutes.get('/stato', async (req, res) => res.json(await statoPerUi(req)));

mcpConfigRoutes.put('/abilitato', async (req, res) => {
  await impostaMcpAbilitato(req.body?.abilitato);
  res.json(await statoPerUi(req));
});

mcpConfigRoutes.post('/rigenera-token', async (req, res) => {
  await rigeneraTokenMcp();
  res.json(await statoPerUi(req));
});
