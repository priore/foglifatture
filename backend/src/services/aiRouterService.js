// Router AI a cascata: tenta i provider nell'ordine configurato, passa al successivo
// in caso di quota esaurita o provider non disponibile. Non solleva mai errore se almeno
// un provider risponde; solleva solo se tutti i provider tentati falliscono.
//
// Ordine di priorità (basato su AI-Workspace/Plans/AI_CLI_OAUTH_ANALISI.md):
//   1. Gemini API key (se configurata)
//   2. agy CLI (Gemini OAuth, se installato e autenticato)
//   3. GitHub Copilot CLI (gh copilot, se installato e autenticato)
//   4. Claude API key (se configurata)
//   5. Groq API key (se configurata)
//   6. LLM locale (Ollama su :11434 o LM Studio su :1234, se server in esecuzione)
//
// Nota: i provider CLI (agy, gh copilot) non supportano tool use (google_search, web_search).
// I service che richiedono ricerca web devono usare opzioni.soloApiKey = true.
import { spawn } from 'node:child_process';
import {
  leggiGeminiApiKey, leggiGeminiModello,
  leggiClaudeApiKey, leggiClaudeModello, leggiClaudeWorkspaceId,
  leggiGroqApiKey, leggiGroqModello,
  leggiLlmLocaleUrl, leggiProviderDisabilitati,
} from './envService.js';

const MODELLO_GEMINI_DEFAULT = 'gemini-2.0-flash';
const MODELLO_CLAUDE_DEFAULT = 'claude-haiku-4-5';
const MODELLO_GROQ_DEFAULT = 'openai/gpt-oss-20b';
const MODELLO_LOCALE_DEFAULT = 'llama3.2:3b';
const TIMEOUT_CLI_MS = 120_000;
const TIMEOUT_LOCALE_MS = 60_000;
const TIMEOUT_PROBE_MS = 2_000;

// Il backend può girare con PATH minimale (launchd/nohup): aggiunge le directory comuni.
const PATH_ARRICCHITO = [
  process.env.HOME ? `${process.env.HOME}/.local/bin` : null,
  '/opt/homebrew/bin',
  '/usr/local/bin',
  '/usr/bin',
  '/bin',
  process.env.PATH,
].filter(Boolean).join(':');
const ENV_CLI = { ...process.env, PATH: PATH_ARRICCHITO };

const ENDPOINT_OLLAMA = 'http://localhost:11434';
const ENDPOINT_LMSTUDIO = 'http://localhost:1234';

// Esegue un comando CLI con timeout, restituisce stdout come stringa.
// Solleva se exit code != 0 o timeout.
function eseguiCli(comando, args, timeoutMs = TIMEOUT_CLI_MS) {
  return new Promise((resolve, reject) => {
    const proc = spawn(comando, args, { stdio: ['ignore', 'pipe', 'pipe'], env: ENV_CLI });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d; });
    proc.stderr.on('data', (d) => { stderr += d; });

    const timer = setTimeout(() => {
      proc.kill();
      reject(new Error(`Timeout CLI ${comando} dopo ${timeoutMs / 1000}s`));
    }, timeoutMs);

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        const errMsg = stderr.trim() || stdout.trim();
        const err = new Error(`${comando} ha restituito exit code ${code}: ${errMsg}`);
        err.exitCode = code;
        err.output = stdout;
        reject(err);
      } else {
        resolve(stdout);
      }
    });
    proc.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
  });
}

function rilevaSegnaliQuota(testo) {
  return /quota|RESOURCE_EXHAUSTED|rate.?limit|429|too many|limit reached/i.test(testo);
}

function rilevaSegnaliAuth(testo) {
  return /auth|login|token expired|unauthorized|not logged/i.test(testo);
}

function classificaErroreCli(err) {
  const testo = `${err.message} ${err.output || ''}`;
  if (rilevaSegnaliQuota(testo)) return 'quota';
  if (rilevaSegnaliAuth(testo)) return 'auth';
  return 'altro';
}

// Controlla se un endpoint locale risponde in tempo.
async function probeLocale(url) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_PROBE_MS);
    const risposta = await fetch(`${url}/v1/models`, { signal: ctrl.signal });
    clearTimeout(timer);
    return risposta.ok;
  } catch {
    return false;
  }
}

// Prova URL custom (se configurato), poi Ollama, poi LM Studio.
async function trovaEndpointLocale() {
  const urlCustom = await leggiLlmLocaleUrl();
  if (urlCustom) {
    if (await probeLocale(urlCustom)) return urlCustom;
    return null; // URL custom configurato ma non raggiungibile: non fallback ai default
  }
  const [ollama, lmstudio] = await Promise.all([
    probeLocale(ENDPOINT_OLLAMA),
    probeLocale(ENDPOINT_LMSTUDIO),
  ]);
  if (ollama) return ENDPOINT_OLLAMA;
  if (lmstudio) return ENDPOINT_LMSTUDIO;
  return null;
}

// ─── Provider individuali ─────────────────────────────────────────────────────

async function chiamaGeminiApiKey(prompt, opzioni = {}) {
  const apiKey = await leggiGeminiApiKey();
  if (!apiKey) throw Object.assign(new Error('GEMINI_API_KEY non configurata'), { tipo: 'non_configurato' });
  const modello = (await leggiGeminiModello()) || MODELLO_GEMINI_DEFAULT;

  const body = { contents: [{ parts: [{ text: prompt }] }] };
  if (opzioni.strumenti) body.tools = opzioni.strumenti;

  const risposta = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modello}:generateContent?key=${apiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
  );
  if (!risposta.ok) {
    const testo = await risposta.text();
    if (risposta.status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(testo)) {
      throw Object.assign(new Error('Quota Gemini esaurita'), { tipo: 'quota' });
    }
    throw new Error(`Gemini API ${risposta.status}: ${testo}`);
  }
  const dati = await risposta.json();
  const testo = dati.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
  return { testo, fonte: 'gemini-api' };
}

async function chiamaAgyCli(prompt) {
  let output;
  try {
    output = await eseguiCli('agy', ['-p', prompt]);
  } catch (err) {
    const tipo = classificaErroreCli(err);
    throw Object.assign(err, { tipo });
  }
  // agy scrive AGY_ERROR: su stdout anche con exit code != 0; qui exit era 0 ma verifichiamo comunque.
  if (output.includes('AGY_ERROR:')) {
    if (rilevaSegnaliQuota(output)) throw Object.assign(new Error('Quota agy esaurita'), { tipo: 'quota' });
    throw Object.assign(new Error(`agy error: ${output.trim()}`), { tipo: 'altro' });
  }
  const testo = output.trim();
  if (!testo) throw Object.assign(new Error('agy: output vuoto'), { tipo: 'altro' });
  return { testo, fonte: 'agy-cli' };
}

async function chiamaGhCopilot(prompt) {
  let output;
  try {
    output = await eseguiCli('gh', ['copilot', '--', '-p', prompt]);
  } catch (err) {
    const tipo = classificaErroreCli(err);
    throw Object.assign(err, { tipo });
  }
  const testo = output.trim();
  if (!testo) throw Object.assign(new Error('gh copilot: output vuoto'), { tipo: 'altro' });
  return { testo, fonte: 'gh-copilot' };
}

async function chiamaClaudeApiKey(prompt, opzioni = {}) {
  const apiKey = await leggiClaudeApiKey();
  if (!apiKey) throw Object.assign(new Error('CLAUDE_API_KEY non configurata'), { tipo: 'non_configurato' });
  const modello = (await leggiClaudeModello()) || MODELLO_CLAUDE_DEFAULT;
  const workspaceId = await leggiClaudeWorkspaceId();

  const body = {
    model: modello,
    max_tokens: opzioni.maxToken ?? 4096,
    messages: [{ role: 'user', content: prompt }],
  };
  if (opzioni.strumenti) body.tools = opzioni.strumenti;

  const risposta = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      ...(workspaceId ? { 'anthropic-workspace-id': workspaceId } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!risposta.ok) {
    const testo = await risposta.text();
    if (risposta.status === 429 || /rate_limit|quota/i.test(testo)) {
      throw Object.assign(new Error('Rate limit Claude'), { tipo: 'quota' });
    }
    let msg = testo;
    try { msg = JSON.parse(testo).error?.message || testo; } catch { /* noop */ }
    throw new Error(`Claude API ${risposta.status}: ${msg}`);
  }
  const dati = await risposta.json();
  const testo = dati.content?.filter((b) => b.type === 'text').map((b) => b.text).join('') || '';
  return { testo, fonte: 'claude-api' };
}

async function chiamaGroqApiKey(prompt, opzioni = {}) {
  const apiKey = await leggiGroqApiKey();
  if (!apiKey) throw Object.assign(new Error('GROQ_API_KEY non configurata'), { tipo: 'non_configurato' });
  const modello = (await leggiGroqModello()) || MODELLO_GROQ_DEFAULT;

  const risposta = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: modello,
      ...(opzioni.reasoningEffort ? { reasoning_effort: opzioni.reasoningEffort } : {}),
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!risposta.ok) {
    const testo = await risposta.text();
    if (risposta.status === 429) throw Object.assign(new Error('Rate limit Groq'), { tipo: 'quota' });
    let msg = testo;
    try { msg = JSON.parse(testo).error?.message || testo; } catch { /* noop */ }
    throw new Error(`Groq API ${risposta.status}: ${msg}`);
  }
  const dati = await risposta.json();
  const testo = dati.choices?.[0]?.message?.content || '';
  return { testo, fonte: 'groq-api' };
}

async function chiamaLlmLocale(prompt) {
  const endpoint = await trovaEndpointLocale();
  if (!endpoint) throw Object.assign(new Error('Nessun server LLM locale attivo (Ollama/LM Studio)'), { tipo: 'non_configurato' });

  const risposta = await fetch(`${endpoint}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODELLO_LOCALE_DEFAULT,
      messages: [{ role: 'user', content: prompt }],
    }),
    signal: AbortSignal.timeout(TIMEOUT_LOCALE_MS),
  });
  if (!risposta.ok) throw new Error(`LLM locale ${risposta.status}`);
  const dati = await risposta.json();
  const testo = dati.choices?.[0]?.message?.content || '';
  return { testo, fonte: 'llm-locale' };
}

// ─── Router principale ────────────────────────────────────────────────────────

// Chiama l'AI con fallback automatico tra provider.
// Opzioni:
//   soloApiKey: boolean — salta i provider CLI (utile per prompt che richiedono tool use)
//   strumentiGemini: array — tools per Gemini API (es. [{google_search:{}}])
//   strumentiClaude: array — tools per Claude API (es. [{type:'web_search_20260209',...}])
//   maxTokenClaude: number — max_tokens per Claude (default 4096)
//   reasoningEffortGroq: string — reasoning_effort per Groq (default nessuno)
// Restituisce: { testo: string, fonte: string }
// Solleva Error con .erroriProvider (array) se tutti i provider falliscono.
export async function chiamaAI(prompt, opzioni = {}) {
  const errori = [];
  const disabilitati = await leggiProviderDisabilitati();

  async function tenta(nome, fn) {
    if (disabilitati.includes(nome)) return null;
    try {
      return await fn();
    } catch (err) {
      // non_configurato = skip silenzioso; quota/altro = log e prosegui
      if (err.tipo !== 'non_configurato') {
        errori.push({ provider: nome, errore: err.message });
      }
      return null;
    }
  }

  let risultato;

  risultato = await tenta('gemini-api', () =>
    chiamaGeminiApiKey(prompt, { strumenti: opzioni.strumentiGemini }),
  );
  if (risultato) return risultato;

  if (!opzioni.soloApiKey) {
    risultato = await tenta('agy-cli', () => chiamaAgyCli(prompt));
    if (risultato) return risultato;

    risultato = await tenta('gh-copilot', () => chiamaGhCopilot(prompt));
    if (risultato) return risultato;
  }

  risultato = await tenta('claude-api', () =>
    chiamaClaudeApiKey(prompt, {
      strumenti: opzioni.strumentiClaude,
      maxToken: opzioni.maxTokenClaude,
    }),
  );
  if (risultato) return risultato;

  risultato = await tenta('groq-api', () =>
    chiamaGroqApiKey(prompt, { reasoningEffort: opzioni.reasoningEffortGroq }),
  );
  if (risultato) return risultato;

  if (!opzioni.soloApiKey) {
    risultato = await tenta('llm-locale', () => chiamaLlmLocale(prompt));
    if (risultato) return risultato;
  }

  const err = new Error(
    errori.length
      ? `Tutti i provider AI hanno fallito: ${errori.map((e) => `${e.provider}: ${e.errore}`).join('; ')}`
      : 'Nessun provider AI configurato (configura almeno una API key o installa agy/gh copilot)',
  );
  err.erroriProvider = errori;
  throw err;
}
