// Notifiche OS per eventi fiscali in background: F24, bollo, crediti, regole, Intrastat.
// OS.1–OS.5, OS.7 del piano FEATURES_GAP_ANALISI_ESTERNA.md.
// OS.6 (IMAP) è in sdiRicevuteService.js perché condivide lo stato del polling.
import { notificaConDedup } from '../lib/notifier.js';
import { listF24 } from './f24StateService.js';
import { scadenzeBollo } from './bolloTrimestrale.js';
import { creditiConResiduo } from './creditiService.js';
import { statoRegole } from './regoleFiscaliService.js';
import { scadenzeIntrastatAnno } from './scadenzeFiscaliService.js';
import { getConfig } from './configService.js';

const SOGLIA_IMMINENZA_GIORNI = 7;

// Data odierna in Europe/Rome come AAAA-MM-GG.
function oggiRoma() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Rome' });
}

function aggiungiGiorni(dataStr, n) {
  const d = new Date(dataStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// scadenzeBollo(anno) restituisce { anno, scadenze: [...] }: per le notifiche serve l'elenco piatto, con l'anno su ogni voce.
export function appiattisciBollo(bolli) {
  return bolli.flatMap((b) => (b?.scadenze ?? []).map((s) => ({ ...s, anno: b.anno })));
}

// Funzione pura: riceve lo stato aggregato e restituisce [{chiave, titolo, messaggio}].
// `oggi` come AAAA-MM-GG; `limite` come AAAA-MM-GG (oggi + 7 giorni).
export function calcolaNotifiche(oggi, limite, { f24List, scadenzeBollo: sb, crediti, stato, scadenzeIntrastat }) {
  const notifiche = [];

  // OS.1 — F24 imminente o scaduto
  for (const f of f24List) {
    if (f.stato !== 'da_pagare') continue;
    const data = f.dataPagamento?.slice(0, 10);
    if (!data) continue;
    if (data < oggi) {
      notifiche.push({ chiave: `f24-scaduto-${f.id}`, titolo: 'F24 scaduto', messaggio: `Scadenza ${data} non pagata — apri Timesheet` });
    } else if (data <= limite) {
      notifiche.push({ chiave: `f24-imminente-${f.id}`, titolo: 'F24 in scadenza', messaggio: `Scadenza il ${data} — apri Timesheet` });
    }
  }

  // OS.2 — F24 programmato: ultimo giorno per annullare
  for (const f of f24List) {
    if (f.stato !== 'programmato') continue;
    const annulla = f.annullabileEntro?.slice(0, 10);
    if (!annulla) continue;
    if (annulla >= oggi && annulla <= oggi) {
      notifiche.push({ chiave: `f24-annullabile-${f.id}`, titolo: 'F24 programmato', messaggio: `Ultimo giorno per annullare l\'addebito del ${f.dataPagamento?.slice(0, 10)} — apri Timesheet` });
    }
  }

  // OS.3 — Bollo trimestrale imminente
  for (const s of sb) {
    const data = s.data?.slice(0, 10);
    if (!data || !(s.importo > 0)) continue;
    if (data >= oggi && data <= limite) {
      notifiche.push({ chiave: `bollo-${s.anno}-Q${s.trimestre}`, titolo: 'Bollo trimestrale in scadenza', messaggio: `Bollo trimestre ${s.trimestre}/${s.anno} — apri Timesheet` });
    }
  }

  // OS.4 — Credito raggiunge utilizzabileDal oggi
  for (const c of crediti) {
    if (c.utilizzabileDal === oggi) {
      notifiche.push({ chiave: `credito-usabile-${c.id}`, titolo: 'Credito F24 disponibile', messaggio: 'Un credito è ora compensabile — apri Timesheet' });
    }
  }

  // OS.5 — Regole fiscali mancanti o aggiornamento disponibile
  if (stato.aggiornamentoDisponibile && stato.annoDisponibile) {
    if (!stato.annoAttivo) {
      notifiche.push({ chiave: `regole-mancanti-${stato.annoDisponibile}`, titolo: `Regole fiscali ${stato.annoDisponibile}`, messaggio: `Nessuna regola confermata per ${stato.annoDisponibile} — apri Impostazioni` });
    } else {
      notifiche.push({ chiave: `regole-update-${stato.annoDisponibile}`, titolo: 'Aggiornamento regole fiscali', messaggio: `Nuove regole ${stato.annoDisponibile} disponibili — apri Impostazioni` });
    }
  }

  // OS.7 — Intrastat imminente
  for (const s of scadenzeIntrastat) {
    const data = s.data?.slice(0, 10);
    if (!data) continue;
    if (data >= oggi && data <= limite) {
      const match = s.descrizione?.match(/([IV]+) trim\. (\d{4})/);
      const trim = match ? `${match[1]}/${match[2]}` : s.descrizione ?? '';
      notifiche.push({ chiave: `intrastat-${data}`, titolo: 'Intrastat in scadenza', messaggio: `Elenco servizi UE trimestre ${trim} — apri Timesheet` });
    }
  }

  return notifiche;
}

// Raccoglie i dati e invia le notifiche pendenti. Sequenziale per la dedup su file.
export async function controllaNotificheFiscali() {
  const oggi = oggiRoma();
  const limite = aggiungiGiorni(oggi, SOGLIA_IMMINENZA_GIORNI);
  const annoCorrente = parseInt(oggi.slice(0, 4), 10);

  // Dati per OS.7: Intrastat solo se VIES attivo e clienti UE presenti
  const config = await getConfig();
  const paesiUeSet = new Set(['AT','BE','BG','CY','CZ','DE','DK','EE','ES','FI','FR','GR','HR','HU','IE','LT','LU','LV','MT','NL','PL','PT','RO','SE','SI','SK']);
  const haClientiUe = (config.clienti ?? []).some(
    (c) => c.attivo && c.tipo === 'azienda' && paesiUeSet.has((c.paese ?? 'IT').toUpperCase()) && (c.paese ?? 'IT').toUpperCase() !== 'IT'
  );

  const [f24List, bolloCorrenti, bolloPrec, crediti, stato] = await Promise.all([
    listF24().catch(() => []),
    scadenzeBollo(annoCorrente).catch(() => null),
    scadenzeBollo(annoCorrente - 1).catch(() => null),
    creditiConResiduo(oggi).catch(() => []),
    statoRegole().catch(() => ({ aggiornamentoDisponibile: false, annoDisponibile: null, annoAttivo: null })),
  ]);

  const sb = appiattisciBollo([bolloCorrenti, bolloPrec]);

  const scadenzeIntrastat = (config.fornitore?.iscrittoVies && haClientiUe)
    ? [...scadenzeIntrastatAnno(annoCorrente), ...scadenzeIntrastatAnno(annoCorrente - 1)]
    : [];

  const pendenti = calcolaNotifiche(oggi, limite, { f24List, scadenzeBollo: sb, crediti, stato, scadenzeIntrastat });

  for (const { chiave, titolo, messaggio } of pendenti) {
    await notificaConDedup(chiave, titolo, messaggio);
  }
}

let timerNotifiche = null;

export function avviaNotificheFiscali() {
  if (timerNotifiche) return;
  // Prima esecuzione subito, poi ogni 6 ore; la dedup 24h evita duplicati.
  controllaNotificheFiscali().catch(() => {});
  timerNotifiche = setInterval(() => controllaNotificheFiscali().catch(() => {}), 6 * 60 * 60 * 1000);
}
