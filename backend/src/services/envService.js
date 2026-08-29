// Lettura/scrittura mirata delle sole variabili OAuth nel file .env, per poterle
// gestire da Impostazioni invece di dover editare il file a mano. Le credenziali
// richiedono un riavvio del server per essere applicate (passport si configura all'avvio).
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ENV_PATH = path.join(import.meta.dirname, '..', '..', '.env');
const CHIAVI_GESTITE = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'ALLOWED_EMAIL'];

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
  return {
    googleClientId: valori.GOOGLE_CLIENT_ID || '',
    // Il secret non viene mai restituito al frontend: solo se è impostato o meno.
    googleClientSecretImpostato: Boolean(valori.GOOGLE_CLIENT_SECRET),
    allowedEmail: valori.ALLOWED_EMAIL || '',
  };
}

// Aggiorna solo le righe delle chiavi gestite, preservando il resto del file (commenti, PORT, ecc.).
export async function salvaCredenzialiOAuth({ googleClientId, googleClientSecret, allowedEmail }) {
  const contenuto = await readFile(ENV_PATH, 'utf-8').catch(() => '');
  const { righe, valori } = parseEnv(contenuto);

  const nuoviValori = { ...valori, GOOGLE_CLIENT_ID: googleClientId, ALLOWED_EMAIL: allowedEmail };
  // Il secret si aggiorna solo se l'utente ne ha digitato uno nuovo (campo password vuoto = non toccare).
  if (googleClientSecret) nuoviValori.GOOGLE_CLIENT_SECRET = googleClientSecret;

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
