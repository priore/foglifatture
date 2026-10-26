// Provider cloud finti in memoria per i test: implementano il sottoinsieme delle API REST che usa cloudProviders.js,
// con la stessa semantica di rev / eTag / headRevisionId. Non è codice di produzione.
const json = (o, status = 200, headers = {}) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', ...headers } });
const binario = (dati, headers = {}) => new Response(dati, { status: 200, headers });
const letto = (init) => Buffer.from(init.body ?? '');

function autorizzato(init, finto) {
  return finto.token === null || (init.headers?.Authorization ?? '') === `Bearer ${finto.token}`;
}

function tokenOk(init) {
  const campi = new URLSearchParams(init.body);
  if (campi.get('grant_type') === 'refresh_token' && campi.get('refresh_token') !== 'refresh-valido') return json({ error: 'invalid_grant' }, 400);
  return json({ access_token: 'tok', refresh_token: 'refresh-valido', expires_in: 3600 });
}

function dropboxFinto(f) {
  return async (url, init = {}) => {
    if (url.endsWith('/oauth2/token')) return tokenOk(init);
    if (!autorizzato(init, f)) return new Response('', { status: 401 });
    f.richieste.push(url);
    if (url.endsWith('/files/list_folder')) {
      return json({ entries: [...f.file].map(([p, v]) => ({ '.tag': 'file', path_display: `/${p}`, rev: v.rev })), has_more: false });
    }
    const arg = JSON.parse(init.headers['Dropbox-API-Arg'] ?? '{}');
    const percorso = arg.path?.slice(1);
    if (url.endsWith('/files/download')) {
      const v = f.file.get(percorso);
      if (!v) return json({ error_summary: 'path/not_found/..' }, 409);
      f.dopoLettura?.(percorso);
      return binario(v.dati, { 'dropbox-api-result': JSON.stringify({ rev: v.rev }) });
    }
    if (url.endsWith('/files/upload')) {
      const v = f.file.get(percorso);
      const m = arg.mode;
      if ((m === 'add' && v) || (m['.tag'] === 'update' && (!v || v.rev !== m.update))) return json({ error_summary: 'path/conflict/file/..' }, 409);
      return json({ rev: f.scrivi(percorso, letto(init)) });
    }
    return new Response('', { status: 404 });
  };
}

function onedriveFinto(f) {
  const sessioni = new Map();
  const BASE = 'https://graph.microsoft.com/v1.0/me/drive/special/approot';
  return async (url, init = {}) => {
    if (url.endsWith('/token')) return tokenOk(init);
    if (url.startsWith('https://upload.fake/')) {
      if (init.headers?.Authorization) throw new Error('L\'URL di upload non va chiamato con il token');
      const percorso = sessioni.get(url);
      return json({ eTag: f.scrivi(percorso, letto(init)) }, 201);
    }
    if (!autorizzato(init, f)) return new Response('', { status: 401 });
    f.richieste.push(url);
    const resto = url.slice(BASE.length);
    const m = resto.match(/^(?::\/(.+?):?)?(\/children|\/content|\/createUploadSession)?$/);
    const percorso = m?.[1] && decodeURIComponent(m[1]).split('/').map((s) => s).join('/');
    const azione = m?.[2];
    if (azione === '/children' || (!azione && !percorso && resto === '/children')) {
      const prefisso = percorso ? `${percorso}/` : '';
      const voci = new Map();
      for (const [p, v] of f.file) {
        if (!p.startsWith(prefisso)) continue;
        const [nome, ...altro] = p.slice(prefisso.length).split('/');
        voci.set(nome, altro.length ? { name: nome, folder: {} } : { name: nome, file: {}, eTag: v.rev });
      }
      return json({ value: [...voci.values()] });
    }
    if (resto === '/children') return json({ value: [] });
    if (!azione) {
      const v = f.file.get(percorso);
      return v ? json({ eTag: v.rev }) : json({ error: 'itemNotFound' }, 404);
    }
    if (azione === '/content') return binario(f.file.get(percorso).dati);
    if (azione === '/createUploadSession') {
      const v = f.file.get(percorso);
      const comportamento = JSON.parse(init.body).item['@microsoft.graph.conflictBehavior'];
      const ifMatch = init.headers['If-Match'];
      if (comportamento === 'fail' && v) return json({ error: 'nameAlreadyExists' }, 409);
      if (ifMatch && (!v || v.rev !== ifMatch)) return json({ error: 'preconditionFailed' }, 412);
      const uploadUrl = `https://upload.fake/${sessioni.size}`;
      sessioni.set(uploadUrl, percorso);
      return json({ uploadUrl });
    }
    return new Response('', { status: 404 });
  };
}

function googleFinto(f) {
  const FOLDER = 'application/vnd.google-apps.folder';
  const voci = new Map(); // id -> { name, parent, mime, dati, rev }
  let n = 0;
  const nuovo = (v) => { const id = `id${++n}`; voci.set(id, v); return id; };
  const figli = (genitore) => [...voci].filter(([, v]) => v.parent === genitore);
  const meta = ([id, v]) => ({ id, name: v.name, mimeType: v.mime, headRevisionId: v.rev });
  // Percorso completo di un file di Drive sotto la cartella dell'app, per tenere `f.file` allineato.
  const percorsoDi = (id) => { const v = voci.get(id); return v.parent === 'root' ? null : (percorsoDi(v.parent) ? `${percorsoDi(v.parent)}/${v.name}` : v.name); };
  const aggiorna = (id) => { const p = percorsoDi(id); if (p) f.file.set(p, { dati: voci.get(id).dati, rev: voci.get(id).rev }); };
  const scrive = (id, dati) => { const v = voci.get(id); v.dati = dati; v.rev = f.nuovaRev(); aggiorna(id); return v.rev; };

  return async (url, init = {}) => {
    if (url.endsWith('/token')) return tokenOk(init);
    if (!autorizzato(init, f)) return new Response('', { status: 401 });
    f.richieste.push(url);
    const u = new URL(url);
    const id = u.pathname.split('/').at(-1);
    if (u.pathname.includes('/upload/drive/v3/files/') && init.method === 'PATCH') return json({ headRevisionId: scrive(id, letto(init)) });
    if (u.pathname.endsWith('/upload/drive/v3/files') && init.method === 'POST') {
      const testo = letto(init).toString('latin1');
      const confine = init.headers['Content-Type'].split('boundary=')[1];
      const parti = testo.split(`--${confine}`).filter((p) => p.trim() && p.trim() !== '--');
      const metadati = JSON.parse(parti[0].split('\r\n\r\n')[1].trim());
      const dati = Buffer.from(parti[1].split('\r\n\r\n')[1].replace(/\r\n$/, ''), 'latin1');
      const nuovoId = nuovo({ name: metadati.name, parent: metadati.parents[0], mime: 'application/json' });
      return json({ headRevisionId: scrive(nuovoId, dati) });
    }
    if (u.pathname.endsWith('/drive/v3/files') && (init.method ?? 'GET') === 'GET') {
      const q = u.searchParams.get('q');
      const nome = q.match(/^name='(.*?)' and '(.*?)' in parents/);
      let lista;
      if (nome) {
        const cartelleSolo = q.includes(`mimeType='${FOLDER}'`);
        lista = figli(nome[2]).filter(([, v]) => v.name === nome[1] && (v.mime === FOLDER) === cartelleSolo);
      } else {
        lista = figli(q.match(/^'(.*?)' in parents/)[1]);
      }
      return json({ files: lista.map(meta) });
    }
    if (u.pathname.endsWith('/drive/v3/files')) {
      const corpo = JSON.parse(init.body);
      return json({ id: nuovo({ name: corpo.name, parent: corpo.parents[0], mime: corpo.mimeType }) });
    }
    if (u.searchParams.get('alt') === 'media') return binario(voci.get(id).dati);
    return new Response('', { status: 404 });
  };
}

const FINTI = { dropbox: dropboxFinto, onedrive: onedriveFinto, google: googleFinto };

// { http, file: Map<percorso, {dati, rev}>, richieste, token, dopoLettura } — `file` è lo stato del provider.
export function creaFinto(nome) {
  let contatore = 0;
  const f = {
    file: new Map(), richieste: [], token: 'tok', dopoLettura: null,
    nuovaRev: () => `${nome}-rev${++contatore}`,
    scrivi(percorso, dati) { const rev = f.nuovaRev(); f.file.set(percorso, { dati, rev }); return rev; },
  };
  f.http = FINTI[nome](f);
  return f;
}
