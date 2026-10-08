import { Router } from 'express';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { access } from 'node:fs/promises';
import { isAuthConfigurato } from '../lib/auth.js';
import { leggiCredenzialiOAuth, salvaCredenzialiOAuth, leggiLlmLocaleUrl } from '../services/envService.js';

const execFileAsync = promisify(execFile);

// Il backend può girare con PATH minimale (launchd/nohup). Aggiunge le directory
// comuni dove risiedono agy e gh su macOS/Linux così i comandi vengono trovati.
const PATH_ARRICCHITO = [
  process.env.HOME ? `${process.env.HOME}/.local/bin` : null,
  '/opt/homebrew/bin',
  '/usr/local/bin',
  '/usr/bin',
  '/bin',
  process.env.PATH,
].filter(Boolean).join(':');

const ENV_CLI = { ...process.env, PATH: PATH_ARRICCHITO };

export const oauthConfigRoutes = Router();

oauthConfigRoutes.get('/', async (req, res) => {
  const credenziali = await leggiCredenzialiOAuth();
  res.json({ ...credenziali, autenticazioneAttiva: await isAuthConfigurato() });
});

oauthConfigRoutes.put('/', async (req, res) => {
  const { googleClientId, googleClientSecret, allowedEmail } = req.body;
  await salvaCredenzialiOAuth(req.body);
  // Le credenziali Google (passport) si applicano solo al riavvio; la Gemini API key
  // viene invece riletta da file ad ogni chiamata (vedi envService.leggiGeminiApiKey), quindi vale subito.
  const toccaGoogle = googleClientId !== undefined || googleClientSecret || allowedEmail !== undefined;
  const messaggio = toccaGoogle
    ? 'Salvato. Riavvia il servizio perché le nuove credenziali abbiano effetto (scripts/install.sh oppure launchctl kickstart -k gui/$UID/com.prioregroup.fatturazione).'
    : 'Salvato. La API key vale subito, senza bisogno di riavviare il servizio.';
  res.json({ ok: true, messaggio });
});

// ─── Stato router AI (provider CLI + LLM locale) ────────────────────────────

async function statoAgy() {
  try {
    await execFileAsync('agy', ['--version'], { timeout: 3000, env: ENV_CLI });
  } catch {
    return { installato: false, autenticato: false };
  }
  // Controlla auth leggendo ~/.gemini/oauth_creds.json — istantaneo, nessuna chiamata AI.
  const credsPath = `${process.env.HOME}/.gemini/oauth_creds.json`;
  try {
    await access(credsPath);
    return { installato: true, autenticato: true };
  } catch {
    return { installato: true, autenticato: false };
  }
}

async function statoCopilot() {
  try {
    await execFileAsync('gh', ['--version'], { timeout: 3000, env: ENV_CLI });
  } catch {
    return { installato: false, autenticato: false };
  }
  // Legge ~/.config/gh/hosts.yml — istantaneo, nessuna shell call.
  const hostsPath = `${process.env.HOME}/.config/gh/hosts.yml`;
  try {
    const { readFile } = await import('node:fs/promises');
    const contenuto = await readFile(hostsPath, 'utf-8');
    const autenticato = /github\.com:/i.test(contenuto) && /user:/i.test(contenuto);
    return { installato: true, autenticato };
  } catch {
    return { installato: true, autenticato: false };
  }
}

async function probeEndpoint(url) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2000);
    const r = await fetch(`${url}/v1/models`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!r.ok) return null;
    const dati = await r.json();
    return (dati.data || []).map((m) => m.id);
  } catch {
    return null;
  }
}

async function statoLocale() {
  const urlCustom = await leggiLlmLocaleUrl();
  if (urlCustom) {
    const modelli = await probeEndpoint(urlCustom);
    return { attivo: modelli !== null, nome: 'Custom', url: urlCustom, modelli: modelli || [], urlCustom };
  }
  const defaults = [
    { nome: 'Ollama', url: 'http://localhost:11434' },
    { nome: 'LM Studio', url: 'http://localhost:1234' },
  ];
  for (const { nome, url } of defaults) {
    const modelli = await probeEndpoint(url);
    if (modelli !== null) return { attivo: true, nome, url, modelli, urlCustom: '' };
  }
  return { attivo: false, nome: null, url: null, modelli: [], urlCustom: '' };
}

oauthConfigRoutes.get('/ai-router-stato', async (req, res) => {
  const [agy, copilot, locale] = await Promise.all([statoAgy(), statoCopilot(), statoLocale()]);
  res.json({ agy, copilot, locale });
});

// Avvia il login OAuth leggendo stdout per estrarre URL+codice OTP, poi apre il browser.
// gh auth login --web e agy sono interattivi: stampano un codice e una URL su stdout
// prima di aprire il browser — con stdio:ignore il browser non viene mai aperto.
// Soluzione: pipe stdout, estraiamo URL e codice, apriamo browser con `open`, restituiamo
// il codice OTP al frontend da mostrare all'utente.
function avviaLoginConBrowser(comando, args) {
  return new Promise((resolve) => {
    const proc = spawn(comando, args, { stdio: ['ignore', 'pipe', 'pipe'], env: ENV_CLI });
    let output = '';
    const onData = (chunk) => {
      output += chunk.toString();
      // gh: "Open this URL to continue in your web browser: https://..."
      // agy: cerca pattern simile
      const urlMatch = output.match(/https?:\/\/\S+/);
      const otpMatch = output.match(/one-time code[:\s]+([A-Z0-9]{4}-[A-Z0-9]{4})/i) ||
                       output.match(/copy your one-time code[:\s]+([A-Z0-9]{4}-[A-Z0-9]{4})/i);
      if (urlMatch) {
        const url = urlMatch[0].replace(/[^\w:/?.=&%-]/g, '');
        spawn('open', [url], { env: ENV_CLI }).unref();
        resolve({ url, otp: otpMatch ? otpMatch[1] : null });
        proc.stdout.off('data', onData);
        proc.stderr.off('data', onData);
      }
    };
    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);
    // Timeout: se entro 8s non arriva URL, risponde senza
    setTimeout(() => resolve({ url: null, otp: null }), 8000);
    proc.unref();
  });
}

oauthConfigRoutes.post('/ai-router-login', async (req, res) => {
  const { provider } = req.body;
  if (provider === 'agy') {
    // agy >= 1.2.6 supporta /login in modalità headless (-p): apre il browser OAuth
    // senza richiedere TTY. Se non autenticato stampa una URL su stdout/stderr.
    const { url, otp } = await avviaLoginConBrowser('agy', ['-p', '/login']);
    const codice = otp ? ` Codice: ${otp}` : '';
    res.json({ ok: true, messaggio: url
      ? `Browser aperto per il login Google.${codice} Completa il login e poi clicca "Verifica stato".`
      : 'Già autenticato oppure impossibile aprire il browser. Clicca "Verifica stato".' });
  } else if (provider === 'copilot') {
    const { url, otp } = await avviaLoginConBrowser('gh', ['auth', 'login', '--web', '--skip-ssh-key']);
    const codice = otp ? ` Codice: ${otp}` : '';
    res.json({ ok: true, messaggio: url
      ? `Browser aperto per il login GitHub.${codice} Torna qui e clicca "Verifica stato" quando completato.`
      : 'Impossibile aprire il browser automaticamente. Lancia "gh auth login --web" dal terminale.' });
  } else {
    res.status(400).json({ errore: 'Provider non valido. Usa "agy" o "copilot".' });
  }
});
