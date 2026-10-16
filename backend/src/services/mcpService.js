// FP-008: server MCP in sola lettura. JSON-RPC 2.0 scritto a mano (stdio e HTTP/SSE lo
// condividono tramite gestisciRichiesta): nessun SDK, nessuna dipendenza nuova.
//
// Confine: ogni tool restituisce SOLO i campi elencati nelle funzioni proietta* (allowlist,
// mai blacklist). Un campo aggiunto in futuro a un service non compare finché non viene
// aggiunto qui. Nessun tool scrive, invia o legge config/segreti.
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { getConfig, salvaMcp } from './configService.js';
import { calcolaDashboardForfettario, tutteLeFattureRisolte } from './forfettarioService.js';
import { scadenzeBaseAnno } from './scadenzeFiscaliService.js';
import { listF24 } from './f24StateService.js';
import { scadenzeBollo } from './bolloTrimestrale.js';
import { creditiConResiduo } from './creditiService.js';
import { regoleAnno } from './regoleFiscaliService.js';
import { arricchisciStatoPagamento } from './invoiceService.js';
import { statoSdiFattura } from './sdiRicevuteService.js';

const VERSIONE_PROTOCOLLO = '2024-11-05';

const SCHEMA_ANNO = {
  type: 'object',
  properties: { anno: { type: 'integer', description: 'Anno fiscale (default: anno corrente)' } },
};

export const TOOLS = [
  { name: 'riepilogo_anno', description: 'Riepilogo forfettario dell\'anno: fatturato, incassato, da incassare, percentuale di soglia 85.000 € e di uscita immediata 100.000 €, aliquota e imposta stimata.', inputSchema: SCHEMA_ANNO },
  { name: 'scadenze_fiscali', description: 'Scadenze fiscali ordinarie dell\'anno (imposta sostitutiva, INPS). Date base senza proroghe.', inputSchema: SCHEMA_ANNO },
  { name: 'versamenti_f24', description: 'F24 dell\'anno con stato (da pagare, programmato, pagato, annullato), data, totale e righe per codice tributo.', inputSchema: SCHEMA_ANNO },
  { name: 'bollo_trimestrale', description: 'Bollo virtuale sulle fatture: importo e scadenza di versamento per trimestre, con eventuale rinvio.', inputSchema: SCHEMA_ANNO },
  { name: 'crediti_f24', description: 'Crediti compensabili in F24 con residuo disponibile e data da cui sono utilizzabili.', inputSchema: { type: 'object', properties: {} } },
  {
    name: 'fatture_lista',
    description: 'Fatture emesse con importo, residuo da incassare, stato di pagamento e stato SDI. Filtrabili per anno e stato (aperta, parziale, pagata).',
    inputSchema: {
      type: 'object',
      properties: {
        anno: { type: 'integer' },
        stato: { type: 'string', enum: ['aperta', 'parziale', 'pagata'] },
      },
    },
  },
  { name: 'regole_anno', description: 'Regole fiscali dell\'anno in uso: soglie, coefficienti, aliquote, scadenze, codici tributo.', inputSchema: SCHEMA_ANNO },
];

const pick = (obj, chiavi) => Object.fromEntries(chiavi.filter((k) => obj?.[k] !== undefined).map((k) => [k, obj[k]]));
const round2 = (n) => Number(n.toFixed(2));

// --- Proiezioni (pure, testate con fixture avvelenate in mcpService.test.js) ---

export function proiettaRiepilogo(dash) {
  const cassa = dash.cassa ?? {};
  const daIncassare = round2((cassa.nonIncassateEmesseAnno ?? []).reduce((t, f) => t + (f.residuo ?? 0), 0));
  const sogliaUscita = dash.sogliaUscitaImmediata;
  return {
    anno: dash.anno,
    fatturato: dash.ricaviCumulati,
    incassato: cassa.ricaviCumulati,
    daIncassare,
    sogliaAnnua: dash.sogliaAnnua,
    percentualeSoglia: cassa.percentualeSoglia,
    sogliaUscitaImmediata: sogliaUscita,
    percentualeSogliaUscita: sogliaUscita > 0 ? Number((cassa.ricaviCumulati / sogliaUscita * 100).toFixed(1)) : 0,
    statoSoglia: cassa.statoSoglia,
    aliquotaImposta: dash.aliquota,
    impostaStimata: cassa.impostaStimata,
    inpsStimato: cassa.inpsStimato,
    nettoStimato: cassa.nettoStimato,
  };
}

export function proiettaScadenze(scadenze) {
  return { scadenze: scadenze.map((s) => pick(s, ['tipo', 'data', 'descrizione'])) };
}

export function proiettaF24(lista) {
  return {
    f24: lista.map((f) => ({
      ...pick(f, ['id', 'tipo', 'dataPagamento', 'stato', 'annullabileEntro', 'pagatoIl']),
      totale: round2((f.righe ?? []).reduce((t, r) => t + (r.importo ?? 0), 0)),
      righe: (f.righe ?? []).map((r) => pick(r, ['sezione', 'codice', 'annoRiferimento', 'importo'])),
    })),
  };
}

export function proiettaBollo(bollo) {
  return {
    anno: bollo.anno,
    sogliaRinvio: bollo.sogliaRinvio,
    trimestri: bollo.scadenze.map((s) => ({
      trim: s.trimestre,
      anno: bollo.anno,
      importo: s.importo,
      scadenza: s.data,
      rinviato: /rinvio/.test(s.righe?.[0]?.descrizione ?? ''),
    })),
  };
}

export function proiettaCrediti(crediti) {
  return { crediti: crediti.map((c) => pick(c, ['sezione', 'codice', 'annoRiferimento', 'residuo', 'utilizzabileDal', 'disponibile'])) };
}

// `clienti` serve solo per risolvere il nome: id, email e P.IVA del cliente non escono.
export function proiettaFatture(fatture, clienti, statiSdi = {}) {
  const nomi = new Map(clienti.map((c) => [c.id, c.denominazione]));
  return {
    fatture: fatture.map((f) => {
      const id = `${f.anno}-${String(f.mese).padStart(2, '0')}-${f.numero}`;
      return {
        id,
        anno: f.anno,
        mese: f.mese,
        data: f.data,
        numero: f.numero,
        cliente: nomi.get(f.clienteId) ?? '',
        importo: f.nettoAPagare,
        residuo: f.residuo,
        stato: f.stato,
        statoSdi: statiSdi[id] ?? 'sconosciuto',
      };
    }),
  };
}

// --- Esecuzione tool ---

function annoDa(args) {
  const anno = args?.anno ?? new Date().getFullYear();
  if (!Number.isInteger(anno) || anno < 2000 || anno > 2100) throw new Error('Anno non valido');
  return anno;
}

export async function callTool(name, args = {}) {
  switch (name) {
    case 'riepilogo_anno':
      return proiettaRiepilogo(await calcolaDashboardForfettario(await getConfig(), { anno: annoDa(args) }));
    case 'scadenze_fiscali':
      // ponytail: date base, non prossimeScadenzeFiscali() — quella può lanciare una ricerca AI
      // (quota + invio dati a terzi) e un server di sola lettura non deve avere effetti. Proroghe: aggiungere solo leggendo la cache.
      return proiettaScadenze(scadenzeBaseAnno(annoDa(args)));
    case 'versamenti_f24':
      return proiettaF24(await listF24(annoDa(args)));
    case 'bollo_trimestrale':
      return proiettaBollo(await scadenzeBollo(annoDa(args)));
    case 'crediti_f24':
      return proiettaCrediti(await creditiConResiduo());
    case 'fatture_lista': {
      const config = await getConfig();
      let fatture = (await tutteLeFattureRisolte()).map(arricchisciStatoPagamento);
      if (args?.anno !== undefined) fatture = fatture.filter((f) => f.anno === annoDa(args));
      if (args?.stato) fatture = fatture.filter((f) => f.stato === args.stato);
      const statiSdi = {};
      await Promise.all(fatture.map(async (f) => {
        const id = `${f.anno}-${String(f.mese).padStart(2, '0')}-${f.numero}`;
        try { statiSdi[id] = (await statoSdiFattura(f, config)).stato; } catch { /* resta 'sconosciuto' */ }
      }));
      return proiettaFatture(fatture, config.clienti, statiSdi);
    }
    case 'regole_anno':
      return regoleAnno(annoDa(args));
    default:
      throw new Error(`Tool sconosciuto: ${name}`);
  }
}

// --- Abilitazione e token ---

export async function mcpAbilitato() {
  return (await getConfig()).mcp.abilitato;
}

export async function statoMcp() {
  const { abilitato, token } = (await getConfig()).mcp;
  return { abilitato, token };
}

export async function impostaMcpAbilitato(abilitato) {
  const { token } = (await getConfig()).mcp;
  await salvaMcp({ abilitato: Boolean(abilitato), token: token || randomUUID() });
  return statoMcp();
}

export async function rigeneraTokenMcp() {
  const { abilitato } = (await getConfig()).mcp;
  await salvaMcp({ abilitato, token: randomUUID() });
  return statoMcp();
}

export async function tokenMcpValido(candidato) {
  const { abilitato, token } = await statoMcp();
  if (!abilitato || !token || typeof candidato !== 'string') return false;
  const a = Buffer.from(candidato);
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}

// --- JSON-RPC ---

const errore = (id, code, message) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });

// Restituisce la risposta JSON-RPC, o null per le notifiche (nessuna risposta).
export async function gestisciRichiesta(msg, { abilitato = mcpAbilitato, esegui = callTool } = {}) {
  if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return errore(msg?.id, -32600, 'Richiesta non valida');
  if (msg.id === undefined) return null;

  const ok = (result) => ({ jsonrpc: '2.0', id: msg.id, result });
  switch (msg.method) {
    case 'initialize':
      return ok({
        protocolVersion: msg.params?.protocolVersion ?? VERSIONE_PROTOCOLLO,
        capabilities: { tools: {} },
        serverInfo: { name: 'timesheet-fatturazione', version: '1.0.0' },
      });
    case 'ping':
      return ok({});
    case 'tools/list':
      return ok({ tools: TOOLS });
    case 'tools/call': {
      if (!(await abilitato())) return ok({ isError: true, content: [{ type: 'text', text: 'Server MCP non abilitato: attivalo in Impostazioni → AI.' }] });
      const { name, arguments: args } = msg.params ?? {};
      if (!TOOLS.some((t) => t.name === name)) return errore(msg.id, -32602, `Tool sconosciuto: ${name}`);
      try {
        return ok({ content: [{ type: 'text', text: JSON.stringify(await esegui(name, args)) }] });
      } catch (err) {
        return ok({ isError: true, content: [{ type: 'text', text: err.message }] });
      }
    }
    default:
      return errore(msg.id, -32601, `Metodo non supportato: ${msg.method}`);
  }
}
