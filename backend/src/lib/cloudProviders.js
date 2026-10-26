// Client REST di Dropbox, OneDrive (Microsoft Graph) e Google Drive: solo `fetch`, nessun SDK, lo stesso
// codice in Node e in core.js. Ogni provider espone la stessa interfaccia:
//   urlAutorizzazione / scambia / rinnova   login OAuth con PKCE
//   elenca()                                [{ percorso, rev }] di tutto l'archivio
//   leggi(percorso)                         { dati: Buffer, rev } oppure null se il file non esiste
//   scrivi(percorso, dati, { rev })         rev stringa: scrive solo se invariato; null: solo se non esiste;
//                                           undefined: sovrascrive. Rev non attuale: ConflittoRev.
// Le credenziali (clientId, clientSecret di Google) sono quelle dell'utente, registrate da lui presso il provider.
import { randomBytes, createHash } from 'node:crypto';

export class ConflittoRev extends Error {}
export class NonAutorizzato extends Error {}
export class ErroreCloud extends Error {
  constructor(messaggio, status) { super(messaggio); this.status = status; }
}

const base64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export function pkce() {
  const verifier = base64url(randomBytes(32));
  return { verifier, challenge: base64url(createHash('sha256').update(verifier).digest()) };
}

const form = (campi) => new URLSearchParams(Object.entries(campi).filter(([, v]) => v != null && v !== '')).toString();
const cartella = (p) => p.split('/').slice(0, -1);
const nomeFile = (p) => p.split('/').at(-1);
const percorsoUrl = (p) => p.split('/').map(encodeURIComponent).join('/');

// `http` e `token` si iniettano: nei test un fetch finto, in produzione il fetch globale e il rinnovo dei token.
async function chiama(http, token, url, init = {}, { ammessi = [] } = {}) {
  const headers = { ...(init.headers ?? {}) };
  if (token) headers.Authorization = `Bearer ${await token()}`;
  const res = await http(url, { ...init, headers });
  if (res.status === 401) throw new NonAutorizzato('Accesso al provider scaduto o revocato');
  if (!res.ok && !ammessi.includes(res.status)) {
    throw new ErroreCloud(`${init.method ?? 'GET'} ${url.split('?')[0]}: ${res.status} ${(await res.text()).slice(0, 200)}`, res.status);
  }
  return res;
}

async function scambioToken(http, url, campi) {
  const res = await http(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form(campi) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (json.error === 'invalid_grant') throw new NonAutorizzato('Autorizzazione revocata o scaduta');
    throw new ErroreCloud(`Token: ${json.error_description ?? json.error ?? res.status}`, res.status);
  }
  return { accessToken: json.access_token, refreshToken: json.refresh_token, scadenzaMs: Date.now() + (json.expires_in ?? 3600) * 1000 };
}

// ---- Dropbox: app «App folder», scrittura condizionale con `rev` ----
function dropbox({ clientId, http, token }) {
  const API = 'https://api.dropboxapi.com/2';
  const CONTENUTO = 'https://content.dropboxapi.com/2';
  const rpc = (voce, corpo, ammessi) => chiama(http, token, `${API}/${voce}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo),
  }, { ammessi });
  const èConflitto = (testo) => /path\/(conflict|not_found)/.test(testo);

  return {
    nome: 'dropbox',
    urlAutorizzazione: ({ redirectUri, challenge, state }) => `https://www.dropbox.com/oauth2/authorize?${form({
      client_id: clientId, response_type: 'code', code_challenge: challenge, code_challenge_method: 'S256',
      token_access_type: 'offline', state, redirect_uri: redirectUri,
    })}`,
    scambia: ({ codice, verifier, redirectUri }) => scambioToken(http, `${API.replace('/2', '')}/oauth2/token`, {
      grant_type: 'authorization_code', code: codice, client_id: clientId, code_verifier: verifier, redirect_uri: redirectUri,
    }),
    rinnova: (refreshToken) => scambioToken(http, `${API.replace('/2', '')}/oauth2/token`, {
      grant_type: 'refresh_token', refresh_token: refreshToken, client_id: clientId,
    }),
    async elenca() {
      const risultato = [];
      let res = await (await rpc('files/list_folder', { path: '', recursive: true }, [409])).json();
      for (;;) {
        for (const e of res.entries ?? []) if (e['.tag'] === 'file') risultato.push({ percorso: e.path_display.slice(1), rev: e.rev });
        if (!res.has_more) return risultato;
        res = await (await rpc('files/list_folder/continue', { cursor: res.cursor })).json();
      }
    },
    async leggi(percorso) {
      const res = await chiama(http, token, `${CONTENUTO}/files/download`, {
        method: 'POST', headers: { 'Dropbox-API-Arg': JSON.stringify({ path: `/${percorso}` }) },
      }, { ammessi: [409] });
      if (res.status === 409) return null;
      return { dati: Buffer.from(await res.arrayBuffer()), rev: JSON.parse(res.headers.get('dropbox-api-result')).rev };
    },
    async scrivi(percorso, dati, { rev } = {}) {
      const mode = rev === undefined ? 'overwrite' : rev === null ? 'add' : { '.tag': 'update', update: rev };
      const res = await chiama(http, token, `${CONTENUTO}/files/upload`, {
        method: 'POST', body: dati,
        headers: {
          'Content-Type': 'application/octet-stream',
          'Dropbox-API-Arg': JSON.stringify({ path: `/${percorso}`, mode, autorename: false, mute: true, strict_conflict: true }),
        },
      }, { ammessi: [409] });
      if (res.status === 409) {
        const testo = await res.text();
        if (èConflitto(testo)) throw new ConflittoRev(`Dropbox: ${percorso} è cambiato`);
        throw new ErroreCloud(`Dropbox upload: ${testo.slice(0, 200)}`, 409);
      }
      return (await res.json()).rev;
    },
  };
}

// ---- OneDrive (account personali): `approot` e `if-match` sulle sessioni di upload ----
function onedrive({ clientId, http, token }) {
  const BASE = 'https://graph.microsoft.com/v1.0/me/drive/special/approot';
  const AUTH = 'https://login.microsoftonline.com/consumers/oauth2/v2.0';
  const SCOPE = 'Files.ReadWrite.AppFolder offline_access';
  const di = (p) => `${BASE}:/${percorsoUrl(p)}`;
  const json = (res) => res.json();

  async function figli(url, prefisso, risultato) {
    while (url) {
      const pagina = await json(await chiama(http, token, url));
      for (const e of pagina.value ?? []) {
        const p = prefisso + e.name;
        if (e.folder) await figli(`${di(p)}:/children`, `${p}/`, risultato);
        else if (e.file) risultato.push({ percorso: p, rev: e.eTag });
      }
      url = pagina['@odata.nextLink'];
    }
  }

  return {
    nome: 'onedrive',
    urlAutorizzazione: ({ redirectUri, challenge, state }) => `${AUTH}/authorize?${form({
      client_id: clientId, response_type: 'code', redirect_uri: redirectUri, response_mode: 'query', scope: SCOPE,
      code_challenge: challenge, code_challenge_method: 'S256', state,
    })}`,
    scambia: ({ codice, verifier, redirectUri }) => scambioToken(http, `${AUTH}/token`, {
      grant_type: 'authorization_code', code: codice, client_id: clientId, scope: SCOPE, code_verifier: verifier, redirect_uri: redirectUri,
    }),
    rinnova: (refreshToken) => scambioToken(http, `${AUTH}/token`, {
      grant_type: 'refresh_token', refresh_token: refreshToken, client_id: clientId, scope: SCOPE,
    }),
    async elenca() {
      const risultato = [];
      await figli(`${BASE}/children`, '', risultato);
      return risultato;
    },
    async leggi(percorso) {
      const meta = await chiama(http, token, di(percorso), {}, { ammessi: [404] });
      if (meta.status === 404) return null;
      const { eTag } = await json(meta);
      const res = await chiama(http, token, `${di(percorso)}:/content`);
      return { dati: Buffer.from(await res.arrayBuffer()), rev: eTag };
    },
    async scrivi(percorso, dati, { rev } = {}) {
      const headers = { 'Content-Type': 'application/json' };
      if (typeof rev === 'string') headers['If-Match'] = rev;
      const sessione = await chiama(http, token, `${di(percorso)}:/createUploadSession`, {
        method: 'POST', headers,
        body: JSON.stringify({ item: { '@microsoft.graph.conflictBehavior': rev === null ? 'fail' : 'replace' } }),
      }, { ammessi: [409, 412] });
      if (sessione.status === 409 || sessione.status === 412) throw new ConflittoRev(`OneDrive: ${percorso} è cambiato`);
      const { uploadUrl } = await json(sessione);
      // L'URL della sessione è già autorizzato: senza token. File piccoli, un solo frammento.
      const carica = await chiama(http, null, uploadUrl, {
        method: 'PUT', body: dati, headers: { 'Content-Range': `bytes 0-${dati.length - 1}/${dati.length}` },
      }, { ammessi: [409, 412] });
      if (carica.status === 409 || carica.status === 412) throw new ConflittoRev(`OneDrive: ${percorso} è cambiato`);
      return (await json(carica)).eTag;
    },
  };
}

// ---- Google Drive: scope `drive.file`, cartella dell'app in Il mio Drive ----
// ponytail: Drive v3 non ha scrittura condizionale: confronto di `headRevisionId` PRIMA di scrivere (N1 ridotto).
// Resta una finestra tra confronto e scrittura; la copre la scansione della sequenza e lo scarto SDI 00404.
// Upgrade path: N2 (ID pre-generato) se lo spike S5 conferma che Drive rifiuta un ID già usato.
function gdrive({ clientId, clientSecret, http, token, nomeCartella = 'FogliFatture' }) {
  const API = 'https://www.googleapis.com/drive/v3';
  const UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
  const AUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
  const TOKEN = 'https://oauth2.googleapis.com/token';
  const SCOPE = 'https://www.googleapis.com/auth/drive.file';
  const CARTELLA = 'application/vnd.google-apps.folder';
  const ids = new Map(); // percorso cartella -> id
  const q = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  const json = (res) => res.json();

  async function cerca(genitore, nome, cartellaSolo) {
    const filtro = `name='${q(nome)}' and '${genitore}' in parents and trashed=false${cartellaSolo ? ` and mimeType='${CARTELLA}'` : ` and mimeType!='${CARTELLA}'`}`;
    const res = await json(await chiama(http, token, `${API}/files?${form({ q: filtro, orderBy: 'createdTime', fields: 'files(id,headRevisionId)' })}`));
    return res.files?.[0] ?? null;
  }
  async function creaCartella(genitore, nome) {
    return (await json(await chiama(http, token, `${API}/files?fields=id`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nome, mimeType: CARTELLA, parents: [genitore] }),
    }))).id;
  }
  async function idCartella(segmenti, crea) {
    let genitore = 'root';
    let chiave = '';
    for (const nome of [nomeCartella, ...segmenti]) {
      chiave += `/${nome}`;
      if (!ids.has(chiave)) {
        const esistente = await cerca(genitore, nome, true);
        const id = esistente?.id ?? (crea ? await creaCartella(genitore, nome) : null);
        if (!id) return null;
        ids.set(chiave, id);
      }
      genitore = ids.get(chiave);
    }
    return genitore;
  }
  async function scansiona(id, prefisso, risultato) {
    let pagina = null;
    do {
      const res = await json(await chiama(http, token, `${API}/files?${form({
        q: `'${id}' in parents and trashed=false`, fields: 'nextPageToken,files(id,name,mimeType,headRevisionId)', pageSize: 1000, pageToken: pagina,
      })}`));
      for (const f of res.files ?? []) {
        if (f.mimeType === CARTELLA) await scansiona(f.id, `${prefisso}${f.name}/`, risultato);
        else if (!risultato.some((r) => r.percorso === prefisso + f.name)) risultato.push({ percorso: prefisso + f.name, rev: f.headRevisionId });
      }
      pagina = res.nextPageToken;
    } while (pagina);
  }
  const trova = async (percorso, crea = false) => {
    const dir = await idCartella(cartella(percorso), crea);
    return { dir, file: dir ? await cerca(dir, nomeFile(percorso), false) : null };
  };

  return {
    nome: 'google',
    urlAutorizzazione: ({ redirectUri, challenge, state }) => `${AUTH}?${form({
      client_id: clientId, response_type: 'code', redirect_uri: redirectUri, scope: SCOPE, access_type: 'offline', prompt: 'consent',
      code_challenge: challenge, code_challenge_method: 'S256', state,
    })}`,
    scambia: ({ codice, verifier, redirectUri }) => scambioToken(http, TOKEN, {
      grant_type: 'authorization_code', code: codice, client_id: clientId, client_secret: clientSecret, code_verifier: verifier, redirect_uri: redirectUri,
    }),
    rinnova: (refreshToken) => scambioToken(http, TOKEN, {
      grant_type: 'refresh_token', refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret,
    }),
    async elenca() {
      const risultato = [];
      await scansiona(await idCartella([], true), '', risultato);
      return risultato;
    },
    async leggi(percorso) {
      const { file } = await trova(percorso);
      if (!file) return null;
      const res = await chiama(http, token, `${API}/files/${file.id}?alt=media`);
      return { dati: Buffer.from(await res.arrayBuffer()), rev: file.headRevisionId };
    },
    async scrivi(percorso, dati, { rev } = {}) {
      const { dir, file } = await trova(percorso, true);
      if (rev === null && file) throw new ConflittoRev(`Google Drive: ${percorso} esiste già`);
      if (typeof rev === 'string' && file?.headRevisionId !== rev) throw new ConflittoRev(`Google Drive: ${percorso} è cambiato`);
      if (file) {
        const res = await chiama(http, token, `${UPLOAD}/files/${file.id}?uploadType=media&fields=headRevisionId`, {
          method: 'PATCH', body: dati, headers: { 'Content-Type': 'application/json' },
        });
        return (await json(res)).headRevisionId;
      }
      const confine = `fogli${randomBytes(8).toString('hex')}`;
      const corpo = Buffer.concat([
        Buffer.from(`--${confine}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: nomeFile(percorso), parents: [dir] })}\r\n--${confine}\r\nContent-Type: application/json\r\n\r\n`),
        dati,
        Buffer.from(`\r\n--${confine}--`),
      ]);
      const res = await chiama(http, token, `${UPLOAD}/files?uploadType=multipart&fields=headRevisionId`, {
        method: 'POST', body: corpo, headers: { 'Content-Type': `multipart/related; boundary=${confine}` },
      });
      return (await json(res)).headRevisionId;
    },
  };
}

export const PROVIDER = { dropbox, onedrive, google: gdrive };

export function creaProvider(nome, opzioni) {
  const costruisci = PROVIDER[nome];
  if (!costruisci) throw new Error(`Provider cloud sconosciuto: ${nome}`);
  return costruisci({ http: globalThis.fetch, ...opzioni });
}
