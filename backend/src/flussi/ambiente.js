// Ambiente sandbox per i test di flusso: cartella dati temporanea, puntatori e stato cloud
// temporanei, app Express con le route reali (senza login) su porta casuale.
// Mai la cartella dati reale, mai la porta 1969, mai il Keychain dell'utente per password nuove.
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const MODULI = {
  config: ['configRoutes', '../routes/configRoutes.js'],
  timesheet: ['timesheetRoutes', '../routes/timesheetRoutes.js'],
  invoice: ['invoiceRoutes', '../routes/invoiceRoutes.js'],
  forfettario: ['forfettarioRoutes', '../routes/forfettarioRoutes.js'],
  backup: ['backupRoutes', '../routes/backupRoutes.js'],
  import: ['importRoutes', '../routes/importRoutes.js'],
  reminder: ['reminderRoutes', '../routes/reminderRoutes.js'],
  termini: ['terminiRoutes', '../routes/terminiRoutes.js'],
  sdi: ['sdiRoutes', '../routes/sdiRoutes.js'],
  templates: ['templateRoutes', '../routes/templateRoutes.js'],
  sistema: ['sistemaRoutes', '../routes/sistemaRoutes.js'],
  cartelleCloud: ['cartelleCloudRoutes', '../routes/cartelleCloudRoutes.js'],
};
const API = { cartelleCloud: 'cartelle-cloud' };

// `statico: true` serve anche il frontend buildato (frontend/dist) e le route usate dalla UI, per i test
// di simulazione utente nel browser. Le chiamate a route non montate (rete esterna, AI, aggiornamenti)
// ricevono 404 JSON: in sandbox non esce mai nulla verso servizi reali.
export async function creaAmbiente({ route = ['config', 'timesheet', 'invoice', 'forfettario', 'backup', 'import', 'reminder', 'termini'], statico = false } = {}) {
  if (statico) route = [...new Set([...route, 'sdi', 'templates', 'sistema'])];
  const radice = await mkdtemp(path.join(os.tmpdir(), 'flusso-'));
  const dati = path.join(radice, 'dati');
  await mkdir(dati, { recursive: true });
  process.env.FOGLIFATTURE_PUNTATORE_DATI = path.join(radice, 'puntatore.json');
  process.env.FOGLIFATTURE_CLOUD_DIR = path.join(radice, 'cloud');
  process.env.FOGLIFATTURE_ENV_PATH = path.join(radice, 'ambiente.env');
  process.env.FOGLIFATTURE_ID_DISPOSITIVO = path.join(radice, 'dispositivo.json');

  const store = await import('../lib/jsonStore.js');
  store.setDataDir(dati);
  const { default: express } = await import('express');
  const app = express();
  app.use(express.json());
  for (const nome of route) {
    const [esportato, file] = MODULI[nome];
    app.use(`/api/${API[nome] ?? nome}`, (await import(file))[esportato]);
  }
  if (statico) {
    const { authRoutes } = await import('../routes/authRoutes.js');
    app.use('/auth', authRoutes);
    app.use('/api', (_req, res) => res.status(404).json({ errore: 'Non montata nell\'ambiente di prova' }));
    const dist = path.join(import.meta.dirname, '..', '..', '..', 'frontend', 'dist');
    app.use(express.static(dist));
    app.get('/{*splat}', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }
  app.use((err, _req, res, _next) => res.status(500).json({ errore: err.message }));

  const server = await new Promise((ok) => { const s = app.listen(0, '127.0.0.1', () => ok(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;

  // Chiama l'API come farebbe il frontend. Ritorna { stato, corpo, testo, buffer, intestazioni }.
  async function api(metodo, percorso, corpo) {
    const init = { method: metodo, headers: {} };
    if (corpo instanceof FormData) init.body = corpo;
    else if (corpo !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(corpo);
    }
    const r = await fetch(base + percorso, init);
    const buffer = Buffer.from(await r.arrayBuffer());
    const testo = buffer.toString('utf-8');
    let json = null;
    try { json = JSON.parse(testo); } catch { /* non JSON */ }
    return { stato: r.status, corpo: json, testo, buffer, intestazioni: r.headers };
  }

  // Esegue `fn` su un archivio dati vuoto (altra cartella temporanea) servito dallo stesso server,
  // poi ripristina quello originale. Serve a simulare "installazione nuova" o import in un archivio pulito.
  async function conDatiVuoti(fn) {
    const alt = await mkdtemp(path.join(radice, 'alt-'));
    store.setDataDir(alt);
    try { return await fn(); } finally { store.setDataDir(dati); }
  }

  return {
    api, base, radice, dati, conDatiVuoti,
    async chiudi() {
      server.closeAllConnections?.();
      await new Promise((ok) => server.close(ok));
      await rm(radice, { recursive: true, force: true });
    },
  };
}
