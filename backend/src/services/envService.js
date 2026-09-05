// Lettura/scrittura mirata delle sole variabili OAuth nel file .env, per poterle
// gestire da Impostazioni invece di dover editare il file a mano. Le credenziali
// richiedono un riavvio del server per essere applicate (passport si configura all'avvio).
// I segreti veri (client secret OAuth, Gemini API key) non finiscono mai nel file .env:
// risiedono nel Keychain OS (keytar), stesso servizio già usato da configService per le
// password PEC/backup. GOOGLE_CLIENT_ID/ALLOWED_EMAIL/GEMINI_MODEL non sono segreti
// (identificatori, non credenziali) e restano in .env.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import keytar from 'keytar';

const ENV_PATH = path.join(import.meta.dirname, '..', '..', '.env');
const CHIAVI_GESTITE = ['GOOGLE_CLIENT_ID', 'ALLOWED_EMAIL', 'GEMINI_MODEL', 'GROQ_MODEL', 'CLAUDE_MODEL', 'CLAUDE_WORKSPACE_ID'];
const KEYTAR_SERVICE = 'Timesheet-Fatturazione';
const KEYTAR_ACCOUNT_GOOGLE_SECRET = 'oauth.googleClientSecret';
const KEYTAR_ACCOUNT_GEMINI_KEY = 'gemini.apiKey';
const KEYTAR_ACCOUNT_GROQ_KEY = 'groq.apiKey';
const KEYTAR_ACCOUNT_CLAUDE_KEY = 'claude.apiKey';

function parseEnv(contenuto) {
  const righe = contenuto.split('\n');
  const valori = {};
  for (const riga of righe) {
    const match = /^([A-Z_]+)=(.*)$/.exec(riga);
    if (match) valori[match[1]] = match[2];
  }
  return { righe, valori };
}

export async function leggiCredenzialiOAuth() {
  const contenuto = await readFile(ENV_PATH, 'utf-8').catch(() => '');
  const { valori } = parseEnv(contenuto);
  const [googleClientSecret, geminiApiKey, groqApiKey, claudeApiKey] = await Promise.all([
    keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_GOOGLE_SECRET),
    keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_GEMINI_KEY),
    keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_GROQ_KEY),
    keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_CLAUDE_KEY),
  ]);
  return {
    googleClientId: valori.GOOGLE_CLIENT_ID || '',
    // Il secret non viene mai restituito al frontend: solo se è impostato o meno.
    googleClientSecretImpostato: Boolean(googleClientSecret),
    allowedEmail: valori.ALLOWED_EMAIL || '',
    geminiApiKeyImpostata: Boolean(geminiApiKey),
    geminiModello: valori.GEMINI_MODEL || '',
    groqApiKeyImpostata: Boolean(groqApiKey),
    groqModello: valori.GROQ_MODEL || '',
    claudeApiKeyImpostata: Boolean(claudeApiKey),
    claudeModello: valori.CLAUDE_MODEL || '',
    claudeWorkspaceId: valori.CLAUDE_WORKSPACE_ID || '',
  };
}

// Aggiorna solo le righe delle chiavi gestite, preservando il resto del file (commenti, PORT, ecc.).
export async function salvaCredenzialiOAuth({ googleClientId, googleClientSecret, allowedEmail, geminiApiKey, groqApiKey, claudeApiKey, claudeWorkspaceId }) {
  const contenuto = await readFile(ENV_PATH, 'utf-8').catch(() => '');
  const { righe, valori } = parseEnv(contenuto);

  const nuoviValori = { ...valori };
  // Ogni chiamante (step Google, step Gemini, step Groq, step Claude) invia solo i propri campi:
  // si aggiorna solo quanto presente nel payload, il resto resta invariato.
  if (googleClientId !== undefined) nuoviValori.GOOGLE_CLIENT_ID = googleClientId;
  if (allowedEmail !== undefined) nuoviValori.ALLOWED_EMAIL = allowedEmail;
  if (claudeWorkspaceId !== undefined) nuoviValori.CLAUDE_WORKSPACE_ID = claudeWorkspaceId;
  // Il secret/la key si aggiornano solo se l'utente ne ha digitato uno nuovo (campo password vuoto = non toccare),
  // e vanno nel Keychain, mai nel file .env.
  if (googleClientSecret) await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_GOOGLE_SECRET, googleClientSecret);
  if (geminiApiKey) await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_GEMINI_KEY, geminiApiKey);
  if (groqApiKey) await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_GROQ_KEY, groqApiKey);
  if (claudeApiKey) await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_CLAUDE_KEY, claudeApiKey);

  const righeAggiornate = [];
  const chiaviScritte = new Set();
  for (const riga of righe) {
    const match = /^([A-Z_]+)=/.exec(riga);
    if (match && CHIAVI_GESTITE.includes(match[1])) {
      righeAggiornate.push(`${match[1]}=${nuoviValori[match[1]] ?? ''}`);
      chiaviScritte.add(match[1]);
    } else {
      righeAggiornate.push(riga);
    }
  }
  for (const chiave of CHIAVI_GESTITE) {
    if (!chiaviScritte.has(chiave)) righeAggiornate.push(`${chiave}=${nuoviValori[chiave] ?? ''}`);
  }

  await writeFile(ENV_PATH, righeAggiornate.join('\n'), 'utf-8');
}

// Letta dal Keychain (non da process.env) così la key vale subito dopo il salvataggio, senza riavviare il server.
export async function leggiGeminiApiKey() {
  return (await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_GEMINI_KEY)) || '';
}

// Usata da auth.js per configurare passport all'avvio (il secret non è mai in process.env).
export async function leggiGoogleClientSecret() {
  return (await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_GOOGLE_SECRET)) || '';
}

// Modello Gemini valido scoperto/verificato l'ultima volta (vedi geminiAtecoService):
// evita di rifare la ListModels ad ogni chiamata finché il modello continua a funzionare.
export async function leggiGeminiModello() {
  const contenuto = await readFile(ENV_PATH, 'utf-8').catch(() => '');
  return parseEnv(contenuto).valori.GEMINI_MODEL || '';
}

async function salvaChiaveEnv(chiave, valore) {
  const contenuto = await readFile(ENV_PATH, 'utf-8').catch(() => '');
  const { righe, valori } = parseEnv(contenuto);
  valori[chiave] = valore;
  const righeAggiornate = [];
  const chiaviScritte = new Set();
  for (const riga of righe) {
    const match = /^([A-Z_]+)=/.exec(riga);
    if (match && CHIAVI_GESTITE.includes(match[1])) {
      righeAggiornate.push(`${match[1]}=${valori[match[1]] ?? ''}`);
      chiaviScritte.add(match[1]);
    } else {
      righeAggiornate.push(riga);
    }
  }
  for (const c of CHIAVI_GESTITE) {
    if (!chiaviScritte.has(c)) righeAggiornate.push(`${c}=${valori[c] ?? ''}`);
  }
  await writeFile(ENV_PATH, righeAggiornate.join('\n'), 'utf-8');
}

export async function salvaGeminiModello(modello) {
  await salvaChiaveEnv('GEMINI_MODEL', modello);
}

// Fallback usato da pagamentiFattureService quando la quota Gemini free è esaurita (429).
export async function leggiGroqApiKey() {
  return (await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_GROQ_KEY)) || '';
}

export async function leggiGroqModello() {
  const contenuto = await readFile(ENV_PATH, 'utf-8').catch(() => '');
  return parseEnv(contenuto).valori.GROQ_MODEL || '';
}

export async function salvaGroqModello(modello) {
  await salvaChiaveEnv('GROQ_MODEL', modello);
}

// Fallback usato dopo Gemini (e prima di Groq) quando la quota Gemini free è esaurita.
export async function leggiClaudeApiKey() {
  return (await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT_CLAUDE_KEY)) || '';
}

export async function leggiClaudeModello() {
  const contenuto = await readFile(ENV_PATH, 'utf-8').catch(() => '');
  return parseEnv(contenuto).valori.CLAUDE_MODEL || '';
}

export async function salvaClaudeModello(modello) {
  await salvaChiaveEnv('CLAUDE_MODEL', modello);
}

// Alcune API key Claude (account collegati a più workspace) richiedono l'header
// anthropic-workspace-id su ogni richiesta, altrimenti l'API risponde 400. Non è un segreto
// (identificatore), resta in .env come GEMINI_MODEL/GROQ_MODEL.
export async function leggiClaudeWorkspaceId() {
  const contenuto = await readFile(ENV_PATH, 'utf-8').catch(() => '');
  return parseEnv(contenuto).valori.CLAUDE_WORKSPACE_ID || '';
}
