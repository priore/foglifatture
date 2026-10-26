// Archivio su Dropbox, OneDrive o Google Drive: copia locale + sincronizzazione (CLOUD_STORAGE_ANALISI §6.3).
// `jsonStore` continua a leggere e scrivere file locali (DATA_DIR punta alla copia); qui si allinea la copia al
// provider. Un solo servizio, eseguito da Node sul desktop e da core.js negli ambienti embedded.
//   - Pull: ogni file con rev diversa dal provider si scarica; se era stato modificato anche qui, vince il provider e
//     la versione locale resta in `conflitti/` (mai persa in silenzio).
//   - Push: solo i file scritti da jsonStore (hook `setDopoScrittura`), «l'ultima scrittura vince».
//   - `numerazione.json` NON passa dal push: lo scrive registraNumero direttamente sul provider con la
//     precondizione sulla rev, così due dispositivi non ottengono lo stesso numero.
// Il refresh token sta nel Keychain; provider e stato di sincronizzazione in un file
// locale del dispositivo, FUORI dall'archivio (backend/.cloud/, in .gitignore).
import { randomBytes } from 'node:crypto';
import { readFile, writeFile, mkdir, readdir, rename, stat } from 'node:fs/promises';
import path from 'node:path';
import keytar from 'keytar';
import { setDataDir, setDopoScrittura, DATA_DIR } from '../lib/jsonStore.js';
import { creaProvider, pkce, ConflittoRev, NonAutorizzato } from '../lib/cloudProviders.js';
import { apriArchivioEsistente } from './configService.js';
import { clientCloud } from '../lib/cloudClients.js';
import { impostaCloud } from '../lib/cloudHook.js';
import { logger } from '../lib/logger.js';

const KEYTAR_SERVICE = 'Timesheet-Fatturazione';
export const PROVIDER_CLOUD = ['dropbox', 'onedrive', 'google'];
export const FILE_NUMERAZIONE = 'numerazione.json';
const INTERVALLO_MS = 60_000;
const ATTESA_PUSH_MS = 5_000;
const REDIRECT_AMMESSO = /^http:\/\/(127\.0\.0\.1|localhost):\d+\/api\/cloud\/callback$/;

// Sostituibili: i test usano un fetch finto e un Keychain in memoria; gli ambienti embedded spostano il puntatore ai dati.
export const dipendenze = {
  http: (...a) => globalThis.fetch(...a),
  segreti: keytar,
  puntaDati: (dir) => apriArchivioEsistente(dir),
  clienti: clientCloud,
};

const disponibili = () => Object.fromEntries(PROVIDER_CLOUD.map((p) => [p, Boolean(dipendenze.clienti(p).clientId)]));

function cartellaBase() {
  return process.env.FOGLIFATTURE_CLOUD_DIR || globalThis.__cloudBase
    || path.join(import.meta.dirname, '..', '..', '.cloud');
}
const fileStato = () => path.join(cartellaBase(), 'stato.json');
const cartellaCopia = () => path.join(cartellaBase(), 'copia');

let stato = null; // { provider, archivio: bool, revs: {}, sporchi: [], conflitti: [], ultimaSync, errore, connesso }
let login = null; // login in corso: { provider, verifier, state, redirectUri, ts }
let accesso = null; // { token, scadenzaMs }
let remotoCache = null;
let timer = null;
let attesa = null;
let codaSync = Promise.resolve();

// ---- stato locale ----
async function caricaStato() {
  if (stato) return stato;
  try {
    stato = JSON.parse(await readFile(fileStato(), 'utf-8'));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  return stato;
}

let codaScrittura = Promise.resolve();
function salvaStato() {
  const scrivi = async () => {
    if (!stato) return;
    await mkdir(cartellaBase(), { recursive: true });
    await writeFile(fileStato(), JSON.stringify(stato, null, 2), 'utf-8');
  };
  codaScrittura = codaScrittura.then(scrivi, scrivi);
  return codaScrittura;
}

// Solo per i test: scarta il token d'accesso in cache, il prossimo uso rinnova col refresh token.
export function _dimenticaAccesso() { accesso = null; }

// Solo per i test: attende i lavori in corso e dimentica lo stato in memoria (il file si rilegge).
export async function _azzera() {
  await Promise.all([codaSync, codaScrittura]);
  stato = null; login = null; accesso = null; remotoCache = null; codaSync = Promise.resolve();
  clearInterval(timer); clearTimeout(attesa); timer = null; attesa = null;
  setDopoScrittura(null);
}

const account = (provider, nome) => `cloud.${provider}.${nome}`;
const segreto = (provider, nome) => dipendenze.segreti.getPassword(KEYTAR_SERVICE, account(provider, nome));
const salvaSegreto = (provider, nome, valore) => dipendenze.segreti.setPassword(KEYTAR_SERVICE, account(provider, nome), valore);

// Il token d'accesso dura poco: si rinnova col refresh token quando manca un minuto alla scadenza.
async function tokenAccesso() {
  if (accesso && accesso.scadenzaMs - Date.now() > 60_000) return accesso.token;
  const refresh = await segreto(stato.provider, 'refreshToken');
  if (!refresh) throw new NonAutorizzato('Refresh token assente');
  try {
    const t = await (await providerAuth()).rinnova(refresh);
    if (t.refreshToken && t.refreshToken !== refresh) await salvaSegreto(stato.provider, 'refreshToken', t.refreshToken);
    accesso = { token: t.accessToken, scadenzaMs: t.scadenzaMs };
    return accesso.token;
  } catch (err) {
    if (err instanceof NonAutorizzato) { stato.connesso = false; await salvaStato(); }
    throw err;
  }
}

async function providerAuth() {
  return creaProvider(stato.provider, {
    ...dipendenze.clienti(stato.provider),
    http: (...a) => dipendenze.http(...a), token: tokenAccesso,
  });
}
async function provider() {
  return remotoCache ??= await providerAuth();
}

// ---- login OAuth (PKCE) ----
// `redirectUri` assente: flusso a codice senza redirect (Dropbox mostra il codice, l'utente lo incolla).
// Il client ID è quello dell'app dello sviluppatore (cloudClients.js): l'utente fa solo il login al suo account.
export async function avviaLogin({ provider: nome, redirectUri }) {
  if (!PROVIDER_CLOUD.includes(nome)) throw new Error('Provider non valido');
  const cliente = dipendenze.clienti(nome);
  if (!cliente.clientId) throw new Error('Questo provider non è ancora disponibile in questa versione dell\'app');
  if (redirectUri && !REDIRECT_AMMESSO.test(redirectUri)) throw new Error('Indirizzo di ritorno non ammesso');
  if (!redirectUri && nome !== 'dropbox') throw new Error('Questo provider richiede l\'indirizzo di ritorno');
  const { verifier, challenge } = pkce();
  const state = randomBytes(16).toString('hex');
  login = { provider: nome, verifier, state, redirectUri, ts: Date.now() };
  const p = creaProvider(nome, { ...cliente, http: (...a) => dipendenze.http(...a) });
  return { url: p.urlAutorizzazione({ redirectUri, challenge, state }), state };
}

// Dal browser (redirect) il `state` è obbligatorio e deve coincidere. `senzaState` è solo del codice incollato
// dall'utente (route autenticata) e vale solo per un login avviato senza indirizzo di ritorno.
export async function completaLogin({ codice, state, senzaState = false }) {
  if (!login || Date.now() - login.ts > 10 * 60_000) throw new Error('Nessun collegamento in corso, riparti dal pulsante Collega');
  if (senzaState ? login.redirectUri : (!state || state !== login.state)) throw new Error('Risposta del provider non valida (state)');
  if (!codice) throw new Error('Codice mancante');
  const { provider: nome, verifier, redirectUri } = login;
  const p = creaProvider(nome, { ...dipendenze.clienti(nome), http: (...a) => dipendenze.http(...a) });
  const t = await p.scambia({ codice, verifier, redirectUri });
  if (!t.refreshToken) throw new Error('Il provider non ha rilasciato un refresh token');
  login = null;
  await salvaSegreto(nome, 'refreshToken', t.refreshToken);
  // Ricollegare lo stesso provider (token revocato) mantiene l'archivio e le modifiche in coda.
  const prec = await caricaStato();
  const stesso = prec?.provider === nome && prec.archivio;
  stato = { provider: nome, connesso: true, errore: null, archivio: Boolean(stesso), copia: Boolean(prec?.copia || stesso),
    revs: stesso ? prec.revs : {}, sporchi: stesso ? prec.sporchi : [], conflitti: stesso ? prec.conflitti : [], ultimaSync: stesso ? prec.ultimaSync : null };
  accesso = { token: t.accessToken, scadenzaMs: t.scadenzaMs };
  remotoCache = null;
  await salvaStato();
  if (stato.archivio) await avviaSincronizzazione();
  return statoCloud();
}

// ---- stato e scelta dell'archivio ----
async function classificaRemoto() {
  const elenco = await (await provider()).elenca();
  if (!elenco.length) return { tipo: 'vuoto', elenco };
  return { tipo: elenco.some((f) => f.percorso === 'config.json') ? 'archivio' : 'estraneo', elenco };
}

export async function statoCloud() {
  await caricaStato();
  if (!stato?.provider) return { collegato: false, disponibili: disponibili() };
  const risposta = {
    collegato: true, disponibili: disponibili(), provider: stato.provider, connesso: stato.connesso !== false,
    archivio: Boolean(stato.archivio), ultimaSync: stato.ultimaSync ?? null, errore: stato.errore ?? null,
    inAttesa: stato.sporchi?.length ?? 0, conflitti: stato.conflitti ?? [],
  };
  if (!stato.archivio && risposta.connesso) {
    try { risposta.remoto = (await classificaRemoto()).tipo; } catch (err) { risposta.errore = err.message; }
  }
  return risposta;
}

async function elencaLocali(dir, prefisso = '') {
  const risultato = [];
  for (const voce of await readdir(dir).catch((e) => (e.code === 'ENOENT' ? [] : Promise.reject(e)))) {
    const p = path.join(dir, voce);
    if ((await stat(p)).isDirectory()) risultato.push(...await elencaLocali(p, `${prefisso}${voce}/`));
    else risultato.push(`${prefisso}${voce}`);
  }
  return risultato;
}

async function scriviLocale(base, percorso, dati) {
  const file = path.join(base, ...percorso.split('/'));
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, dati);
}

// La copia nuova si costruisce in una cartella a fianco e prende il posto della vecchia solo a lavoro riuscito:
// un errore a metà non tocca mai i dati in uso. La vecchia si mette da parte, mai si cancella.
async function nuovaCopiaInCostruzione() {
  const staging = `${cartellaCopia()}-nuova`;
  if ((await readdir(staging).catch(() => [])).length) await rename(staging, `${staging}-scartata-${Date.now()}`);
  await mkdir(staging, { recursive: true });
  return staging;
}
async function sostituisciCopia(staging) {
  const copia = cartellaCopia();
  if ((await readdir(copia).catch(() => [])).length) await rename(copia, `${copia}-prec-${Date.now()}`);
  await rename(staging, copia);
}

// 'apri': l'archivio trovato sul provider diventa la copia locale; i dati locali attuali restano dove sono, intatti.
// 'carica': il provider è vuoto, vi si copiano i dati locali attuali (copia, non spostamento).
export async function scegliArchivio(azione) {
  await caricaStato();
  if (!stato?.connesso) throw new Error('Provider non collegato');
  if (azione !== 'apri' && azione !== 'carica') throw new Error('Azione non valida');
  const p = await provider();
  const { tipo, elenco } = await classificaRemoto();
  const origine = DATA_DIR; // letta prima di spostare qualunque cosa: dopo uno scollegamento è la copia stessa
  const revs = {};
  let staging;
  if (azione === 'apri') {
    if (tipo !== 'archivio') throw new Error(tipo === 'vuoto' ? 'Sul provider non c\'è nessun archivio da aprire' : 'La cartella sul provider contiene file estranei a un archivio');
    staging = await nuovaCopiaInCostruzione();
    for (const { percorso, rev } of elenco) {
      const letto = await p.leggi(percorso);
      if (!letto) continue;
      await scriviLocale(staging, percorso, letto.dati);
      revs[percorso] = letto.rev;
    }
  } else {
    if (tipo !== 'vuoto') throw new Error('Sul provider c\'è già qualcosa: aprilo invece di caricare');
    const tutti = await elencaLocali(origine);
    if (!tutti.includes('config.json')) throw new Error('Nessun archivio locale da caricare');
    staging = await nuovaCopiaInCostruzione();
    // Tutta la cartella si copia (ricevute SDI comprese, la cartella dati cambia); sul provider vanno solo i JSON.
    for (const percorso of tutti) {
      const dati = await readFile(path.join(origine, ...percorso.split('/')));
      await scriviLocale(staging, percorso, dati);
      if (percorso.endsWith('.json')) revs[percorso] = await p.scrivi(percorso, dati, { rev: null });
    }
    // Verifica prima di cambiare archivio: il provider deve elencare tutti i file caricati.
    const caricati = new Set((await p.elenca()).map((f) => f.percorso));
    const mancanti = Object.keys(revs).filter((l) => !caricati.has(l));
    if (mancanti.length) throw new Error(`Caricamento incompleto, mancano: ${mancanti.join(', ')}`);
  }
  await sostituisciCopia(staging);
  Object.assign(stato, { revs, sporchi: [], conflitti: [], archivio: true, copia: true, errore: null, ultimaSync: new Date().toISOString() });
  await salvaStato();
  if (path.resolve(DATA_DIR) !== path.resolve(cartellaCopia())) await dipendenze.puntaDati(cartellaCopia()); // dopo uno scollegamento i dati sono già la copia
  await avviaSincronizzazione();
  return statoCloud();
}

// ---- sincronizzazione ----
function sporca(rel) {
  if (!stato?.archivio || rel === FILE_NUMERAZIONE) return;
  if (!stato.sporchi.includes(rel)) stato.sporchi.push(rel);
  salvaStato();
  clearTimeout(attesa);
  attesa = setTimeout(() => sincronizza().catch(() => {}), ATTESA_PUSH_MS);
}

async function salvaConflitto(percorso) {
  const dati = await readFile(path.join(cartellaCopia(), ...percorso.split('/'))).catch(() => null);
  if (!dati) return;
  const nome = `conflitti/${percorso.replace(/\.json$/, '')}-${Date.now()}.json`;
  await scriviLocale(cartellaCopia(), nome, dati);
  stato.conflitti.push(nome);
}

async function giroSincronizzazione() {
  const p = await provider();
  const copia = cartellaCopia();
  for (const { percorso, rev } of await p.elenca()) {
    if (stato.revs[percorso] === rev) continue;
    if (stato.sporchi.includes(percorso)) {
      await salvaConflitto(percorso);
      stato.sporchi = stato.sporchi.filter((s) => s !== percorso);
    }
    const letto = await p.leggi(percorso);
    if (!letto) continue;
    await scriviLocale(copia, percorso, letto.dati);
    stato.revs[percorso] = letto.rev;
  }
  for (const percorso of [...stato.sporchi]) {
    const dati = await readFile(path.join(copia, ...percorso.split('/'))).catch(() => null);
    if (dati) {
      try {
        stato.revs[percorso] = await p.scrivi(percorso, dati, { rev: stato.revs[percorso] ?? null });
      } catch (err) {
        if (!(err instanceof ConflittoRev)) throw err;
        // Rev non più valida: se il file remoto non c'è più si ricrea al prossimo giro, altrimenti decide il pull.
        if (!await p.leggi(percorso)) delete stato.revs[percorso];
        continue;
      }
    }
    stato.sporchi = stato.sporchi.filter((s) => s !== percorso);
  }
}

// Un giro: pull poi push. I giri si mettono in coda (mai due insieme): chi chiama dopo una scrittura vede
// pubblicata anche quella. Gli errori di rete restano nello stato (lettura locale sempre possibile, scritture in coda).
export function sincronizza() {
  const giro = async () => {
    await caricaStato();
    if (!stato?.archivio || stato.connesso === false) return statoCloud();
    try {
      await giroSincronizzazione();
      stato.errore = null; stato.ultimaSync = new Date().toISOString();
    } catch (err) {
      stato.errore = err instanceof NonAutorizzato ? 'Accesso al provider scaduto o revocato: ricollega' : `Sincronizzazione non riuscita: ${err.message}`;
      if (err instanceof NonAutorizzato) stato.connesso = false;
      logger.warn('Sincronizzazione cloud', { errore: err.message });
    }
    await salvaStato();
    return statoCloud();
  };
  const risultato = codaSync.then(giro);
  codaSync = risultato.catch(() => {});
  return risultato;
}

// Un archivio cloud collegato ma non sincronizzabile blocca l'emissione: il registro non si può aggiornare con
// la precondizione e due dispositivi potrebbero scegliere lo stesso numero.
export async function sincronizzaPrimaDiEmettere() {
  await caricaStato();
  if (!stato?.archivio) return;
  const s = await sincronizza();
  if (!s.connesso || s.errore) throw new Error(`Emissione bloccata: archivio cloud non sincronizzato (${s.errore ?? 'non connesso'})`);
}

// Accesso diretto al provider per il registro di numerazione (scrittura condizionale). null senza archivio cloud.
export async function remotoPerNumerazione() {
  await caricaStato();
  if (!stato?.archivio) return null;
  if (stato.connesso === false) throw new Error('Archivio cloud disconnesso: ricollega il provider per emettere');
  const p = await provider();
  return {
    leggi: (percorso) => p.leggi(percorso),
    scrivi: (percorso, dati, opzioni) => p.scrivi(percorso, dati, opzioni),
    // Dopo la scrittura sul provider la copia locale si allinea e il file non risulta da caricare.
    async registraLocale(percorso, dati, rev) {
      await scriviLocale(DATA_DIR, percorso, dati);
      stato.revs[percorso] = rev;
      await salvaStato();
    },
  };
}

export async function disconnetti() {
  await caricaStato();
  if (!stato?.provider) return statoCloud();
  // Prima si ferma tutto e si lascia finire un giro in corso: non deve trovare lo stato cambiato sotto i piedi.
  clearInterval(timer); clearTimeout(attesa);
  setDopoScrittura(null);
  await codaSync;
  const nome = stato.provider;
  await dipendenze.segreti.deletePassword(KEYTAR_SERVICE, account(nome, 'refreshToken'));
  // Nessuna cancellazione di dati: la copia locale resta la cartella dati (`copia`), ma non si sincronizza più.
  stato = { copia: true };
  await salvaStato();
  await _azzera();
  return statoCloud();
}

export async function avviaSincronizzazione() {
  await caricaStato();
  if (!stato?.archivio) return;
  setDopoScrittura(sporca);
  clearInterval(timer);
  timer = setInterval(() => sincronizza().catch(() => {}), INTERVALLO_MS);
  sincronizza().catch(() => {});
}

// Da chiamare all'avvio, dopo applicaPercorsoDatiAllAvvio: rimette DATA_DIR sulla copia e riprende i giri.
// Restituisce la cartella della copia (gli ambienti embedded la usano per backup e stato), null senza archivio cloud.
export async function riprendiCloud() {
  await caricaStato();
  if (!stato?.archivio && !stato?.copia) return null;
  setDataDir(cartellaCopia());
  if (stato.archivio) await avviaSincronizzazione();
  return cartellaCopia();
}

impostaCloud({ remotoPerNumerazione, sincronizzaPrimaDiEmettere });
