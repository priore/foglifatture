// Gestione crediti fiscali compensabili in F24 (FP-016).
// Struttura credito: { id, sezione, codice, annoRiferimento, importo, utilizzabileDal, descrizione }.
// Il residuo si calcola dagli utilizzi nelle righe F24 (non salvato): un credito usato in un F24
// non si modifica né cancella (le righe F24 non tornerebbero più).
// La compensazione orizzontale >5.000€/anno richiede visto di conformità + dichiarazione
// presentata almeno 10 gg prima (DL 124/2019 art. 3 + Ris. 110/E/2019).
// La compensazione verticale (stesso codice tributo) è esente dal limite (Ris. 110/E/2019).
import { readJson, writeJson } from '../lib/jsonStore.js';
import { randomUUID } from 'node:crypto';

const FILE_CREDITI = 'crediti.json';
const FILE_F24 = 'f24.json';

export async function listCrediti() {
  return readJson(FILE_CREDITI, []);
}

export async function aggiungiCredito({ sezione, codice, annoRiferimento, importo, utilizzabileDal, descrizione }) {
  if (!sezione || !codice || !(importo > 0)) throw new Error('sezione, codice e importo obbligatori');
  const crediti = await readJson(FILE_CREDITI, []);
  const credito = {
    id: randomUUID(),
    sezione,
    codice,
    annoRiferimento: annoRiferimento ? Number(annoRiferimento) : null,
    importo: Number(importo),
    utilizzabileDal: utilizzabileDal ?? null,
    descrizione: descrizione ?? '',
  };
  crediti.push(credito);
  await writeJson(FILE_CREDITI, crediti);
  return credito;
}

// Un credito usato in un F24 non si cancella: restituisce errore se ha utilizzi.
export async function eliminaCredito(id) {
  const crediti = await readJson(FILE_CREDITI, []);
  const credito = crediti.find((c) => c.id === id);
  if (!credito) throw new Error(`Credito non trovato: ${id}`);
  const utilizzi = await _utilizziCredito(id);
  if (utilizzi.length) throw new Error(`Credito già usato in ${utilizzi.length} F24: non può essere eliminato. Aggiornare il saldo manualmente aggiungendo un credito con importo negativo.`);
  await writeJson(FILE_CREDITI, crediti.filter((c) => c.id !== id));
}

// Utilizzi di un credito: righe F24 non-annullati con campo .creditoId === id.
async function _utilizziCredito(id) {
  const lista = await readJson(FILE_F24, []);
  const utilizzi = [];
  for (const f24 of lista) {
    if (f24.stato === 'annullato') continue;
    for (const riga of f24.righe ?? []) {
      if (riga.creditoId === id) utilizzi.push({ f24Id: f24.id, importo: riga.importo });
    }
  }
  return utilizzi;
}

// Residuo disponibile per ciascun credito (importo - utilizzi in F24 non-annullati).
export async function creditiConResiduo(oggi = new Date().toISOString().slice(0, 10)) {
  const [crediti, lista] = await Promise.all([
    readJson(FILE_CREDITI, []),
    readJson(FILE_F24, []),
  ]);

  // Somma utilizzi per creditoId, escludendo F24 annullati.
  const utilizziPerId = {};
  for (const f24 of lista) {
    if (f24.stato === 'annullato') continue;
    for (const riga of f24.righe ?? []) {
      if (riga.creditoId) {
        utilizziPerId[riga.creditoId] = (utilizziPerId[riga.creditoId] ?? 0) + riga.importo;
      }
    }
  }

  return crediti.map((c) => {
    const usato = Number((utilizziPerId[c.id] ?? 0).toFixed(2));
    const residuo = Number((c.importo - usato).toFixed(2));
    const disponibile = residuo > 0 && (!c.utilizzabileDal || c.utilizzabileDal <= oggi);
    return { ...c, usato, residuo, disponibile };
  }).filter((c) => c.residuo > 0); // nasconde crediti esauriti
}

// Funzione pura: applica i crediti disponibili ai debiti di una scadenza F24.
// Ordine crediti: verticali prima (stesso codice tributo), poi orizzontali per data utilizzabileDal.
// Restituisce { righeDebito, righeCredito, avvisi, totaleNetto }.
// - righeCredito: righe con importo negativo da inserire nell'F24 (nella colonna "importi a credito")
// - Limita orizzontale al residuo entro 5.000€/anno (regole.compensazione.sogliaOrizzontale).
// - 🟡 Non verifica visto di conformità né presentazione dichiarazione: avviso in UI.
// La maggiorazione si applica sul totaleNetto (piano: "solo sulla differenza tra debiti e crediti").
export function compensaCrediti(righeDebito, creditiDisponibili, regole, oggiStr) {
  const soglia = regole?.compensazione?.sogliaOrizzontale ?? 5000;
  const avvisi = [];
  const righeCredito = [];
  let debiti = righeDebito.map((r) => ({ ...r })); // copia

  // Filtra crediti non ancora disponibili (utilizzabileDal nel futuro).
  const creditiUsabili = creditiDisponibili.filter((c) => c.disponibile !== false);

  // Verticali: stesso codice tributo — esenti dal limite.
  for (const credito of creditiUsabili) {
    for (const debito of debiti) {
      if (debito.importo <= 0) continue;
      if (debito.codice !== credito.codice) continue;
      const compensato = Math.min(debito.importo, credito._residuoDisp ?? credito.residuo ?? credito.importo);
      if (compensato < 0.01) continue;
      debito.importo = Number((debito.importo - compensato).toFixed(2));
      credito._residuoDisp = Number(((credito._residuoDisp ?? credito.residuo ?? credito.importo) - compensato).toFixed(2));
      righeCredito.push({
        sezione: credito.sezione,
        codice: credito.codice,
        annoRiferimento: credito.annoRiferimento,
        importo: compensato,
        descrizione: `Credito ${credito.descrizione || credito.codice}`,
        creditoId: credito.id,
        tipoCompensazione: 'verticale',
      });
    }
  }

  // Orizzontali: codice diverso — soggetti al limite e al visto.
  let usatoOrizzontaleAnno = 0;
  for (const credito of creditiUsabili) {
    const residuoCred = credito._residuoDisp ?? credito.residuo ?? credito.importo;
    if (residuoCred <= 0) continue;
    for (const debito of debiti) {
      if (debito.importo <= 0) continue;
      if (debito.codice === credito.codice) continue; // già fatto sopra
      const spazioDentroSoglia = Math.max(0, soglia - usatoOrizzontaleAnno);
      if (spazioDentroSoglia <= 0) {
        avvisi.push(`Credito ${credito.codice} (${credito.descrizione}): limite compensazione orizzontale ${soglia.toLocaleString('it-IT')} € raggiunto. Importo residuo non compensato richiede visto di conformità — gestire con il commercialista.`);
        break;
      }
      const compensato = Math.min(debito.importo, credito._residuoDisp ?? residuoCred, spazioDentroSoglia);
      if (compensato < 0.01) continue;
      debito.importo = Number((debito.importo - compensato).toFixed(2));
      credito._residuoDisp = Number(((credito._residuoDisp ?? residuoCred) - compensato).toFixed(2));
      usatoOrizzontaleAnno = Number((usatoOrizzontaleAnno + compensato).toFixed(2));
      righeCredito.push({
        sezione: credito.sezione,
        codice: credito.codice,
        annoRiferimento: credito.annoRiferimento,
        importo: compensato,
        descrizione: `Credito ${credito.descrizione || credito.codice}`,
        creditoId: credito.id,
        tipoCompensazione: 'orizzontale',
      });
    }
  }

  if (usatoOrizzontaleAnno > 0) {
    avvisi.push(`Compensazione orizzontale applicata: ${usatoOrizzontaleAnno.toLocaleString('it-IT', { minimumFractionDigits: 2 })} €. Verificare che la dichiarazione da cui emerge il credito sia stata presentata almeno 10 giorni prima dell'F24 (DL 124/2019 art. 3). Per importi > ${soglia.toLocaleString('it-IT')} € è richiesto il visto di conformità.`);
  }

  const righeDebitoFinali = debiti.filter((r) => r.importo >= 0.01);
  const totaleNetto = Number(righeDebitoFinali.reduce((t, r) => t + r.importo, 0).toFixed(2));
  const f24AZero = totaleNetto === 0 && righeCredito.length > 0;
  if (f24AZero) {
    avvisi.push('F24 a saldo zero: deve essere presentato esclusivamente per via telematica (Entratel o F24 web/online) — non presentabile allo sportello bancario o postale (D.L. 66/2014).');
  }

  return { righeDebito: righeDebitoFinali, righeCredito, totaleNetto, f24AZero, avvisi };
}

// G-AI C.9: prompt per il suggerimento d'ordine di utilizzo dei crediti.
// Funzione pura. Invia importi e codici tributo → richiede autorizzazione (vedi suggerisciOrdineCrediti).
export function costruisciPromptOrdineCrediti(crediti, scadenze, soglia = 5000) {
  const elCrediti = crediti.map((c, i) => `${i + 1}. codice ${c.codice} (${c.sezione}), anno ${c.annoRiferimento ?? 'n.d.'}, residuo ${c.residuo.toFixed(2)} €, utilizzabile dal ${c.utilizzabileDal ?? 'subito'}${c.disponibile ? '' : ' (non ancora disponibile)'}`).join('\n');
  const elDebiti = scadenze.map((s) => {
    const righe = (s.righe ?? []).map((r) => `${r.codice} ${Number(r.importo).toFixed(2)} €`).join(', ');
    return `- ${s.tipo} il ${s.data}: ${righe}`;
  }).join('\n') || '- nessuna scadenza stimata';
  return `Sei un consulente fiscale italiano. Un contribuente forfettario ha questi crediti fiscali compensabili in F24:
${elCrediti}

Prossime scadenze F24 con debiti:
${elDebiti}

Regole: compensazione verticale (stesso codice tributo del debito) esente dal limite; compensazione orizzontale (codice diverso) oltre ${soglia} € l'anno richiede visto di conformità e dichiarazione presentata almeno 10 giorni prima (DL 124/2019 art. 3, Ris. AdE 110/E/2019).
Suggerisci in italiano, massimo 6 righe, in che ordine usare i crediti (prima i verticali, poi gli orizzontali per data di disponibilità) con una motivazione breve per ciascuno. Segnala se qualche credito non è ancora utilizzabile o se si rischia di superare la soglia. Non inventare importi. In caso di dubbio consiglia di sentire il commercialista.`;
}

// Suggerisce l'ordine di utilizzo dei crediti via AI. I dati inviati (importi, codici tributo) sono
// fiscali personali: serve config.ai.autorizzaDatiFiscali oppure conferma esplicita per questa chiamata.
// `scadenze` arriva già calcolato dalla route (stimaVersamenti), per non accoppiare i due service.
export async function suggerisciOrdineCrediti({ config, scadenze, soglia, conferma = false }) {
  if (!config?.ai?.autorizzaDatiFiscali && conferma !== true) {
    const err = new Error('Invio dati fiscali all\'AI non autorizzato');
    err.codice = 'AUTORIZZAZIONE_RICHIESTA';
    throw err;
  }
  const crediti = await creditiConResiduo();
  if (!crediti.length) throw new Error('Nessun credito da ordinare');
  const { chiamaAI } = await import('./aiRouterService.js');
  const { testo } = await chiamaAI(costruisciPromptOrdineCrediti(crediti, scadenze, soglia));
  if (!testo) throw new Error('Risposta AI non valida');
  return { suggerimento: testo };
}
