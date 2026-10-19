// Registro lotti BTC: lotti in ingresso (rate BTC delle fatture + ingressi manuali), consumo LIFO
// dalle uscite, plusvalenze (art. 67 c. 1 lett. c-sexies TUIR) e IVCA 0,2% (quadro RW).
// Piano: AI-Workspace/Plans/REGISTRO_LOTTI_BTC.md §4-§6. Il nucleo di calcolo è puro (testabile
// senza I/O); in fondo le funzioni async che caricano fatture, movimenti e regole.
import { listMesiFatturati, getInvoice, arricchisciStatoPagamento } from './invoiceService.js';
import { leggiMovimenti, validaUscita } from './movimentiBtcService.js';
import { regoleAnno } from './regoleFiscaliService.js';
import { listVersamenti, accontiIvcaVersati } from './versamentiF24Service.js';

const SAT = 1e8;
// Le cessioni sono tassate dal registro solo dal 2026 (§4.1): prima valeva un altro regime (franchigia 2.000 EUR).
export const ANNO_INIZIO_CRIPTO = 2026;
const SOGLIA_VERSAMENTO_IVCA = 12; // Istruzioni PF 2026 Fasc. 2 p. 53

const arrotonda = (n) => Number(n.toFixed(2));
const giorniTra = (dal, al) => Math.round((Date.parse(al) - Date.parse(dal)) / 86400000);

// ── Nucleo puro ─────────────────────────────────────────────────────────────

// Un lotto per ogni rata BTC. `fatture` = [{ anno, mese, clienteId, pagamenti }] già arricchite.
export function lottiDaFatture(fatture) {
  const visti = new Map();
  const lotti = [];
  for (const f of fatture) {
    for (const p of f.pagamenti ?? []) {
      if (!p.btc) continue;
      const riferimento = `${f.anno}-${String(f.mese).padStart(2, '0')}-${f.clienteId}`;
      const base = `IN-${p.btc.txid.slice(0, 12)}-${riferimento}`;
      const n = (visti.get(base) ?? 0) + 1; // suffisso solo se la stessa fattura ripete il txid
      visti.set(base, n);
      lotti.push({
        id: n > 1 ? `${base}-${n}` : base,
        tipo: 'incasso',
        data: p.data,
        satoshi: p.btc.satoshi,
        costoEur: p.importo,
        costoPerBtc: p.btc.cambioEurBtc,
        txid: p.btc.txid,
        indirizzo: p.btc.indirizzoDestinatario,
        fonte: 'fattura',
        riferimento,
      });
    }
  }
  return lotti;
}

export function unisciLotti(lottiFatture, ingressi) {
  const manuali = ingressi.map((i) => ({ ...i, costoPerBtc: arrotonda(i.costoEur / (i.satoshi / SAT)) }));
  return [...lottiFatture, ...manuali].sort((a, b) => a.data.localeCompare(b.data));
}

// LIFO: ogni uscita (in ordine di data) consuma prima i lotti più recenti con data <= uscita.
// `lotti` già ordinati per data. I trasferimenti tra wallet propri non consumano nulla.
// Satoshi non coperti dai lotti noti: costo zero (nessun costo documentato) + `satoshiNonCoperti`.
// Le fee di rete (`feeSatoshi`) non entrano nel calcolo: trattamento fiscale da confermare (domanda 3).
export function calcolaLifo(lotti, uscite) {
  const stato = lotti.map((l) => ({ ...l, residui: l.satoshi, consumi: [] }));
  const cessioni = [];
  const ordinate = uscite.filter((u) => u.tipo !== 'trasferimento').sort((a, b) => a.data.localeCompare(b.data));
  for (const u of ordinate) {
    let daCoprire = u.satoshi;
    let costo = 0;
    for (let i = stato.length - 1; i >= 0 && daCoprire > 0; i--) {
      const l = stato[i];
      if (l.data > u.data || l.residui === 0) continue;
      const preso = Math.min(l.residui, daCoprire);
      const costoParte = (l.costoEur * preso) / l.satoshi;
      l.residui -= preso;
      daCoprire -= preso;
      costo += costoParte;
      l.consumi.push({ uscitaId: u.id, data: u.data, satoshi: preso, costoEur: costoParte, ricavoEur: (u.ricavoEur * preso) / u.satoshi });
    }
    cessioni.push({ uscita: u, costoEur: arrotonda(costo), plusvalenza: arrotonda(u.ricavoEur - costo), satoshiNonCoperti: daCoprire });
  }
  return { lotti: stato, cessioni };
}

export function saldoDaLotti(lottiLifo) {
  return {
    satoshi: lottiLifo.reduce((t, l) => t + l.residui, 0),
    costoTotaleEur: arrotonda(lottiLifo.reduce((t, l) => t + (l.costoEur * l.residui) / l.satoshi, 0)),
  };
}

// Risultato netto per anno (plusvalenze meno minusvalenze) delle sole cessioni dal 2026.
export function nettiPerAnno(cessioni) {
  const netti = {};
  for (const c of cessioni) {
    const anno = Number(c.uscita.data.slice(0, 4));
    if (anno >= ANNO_INIZIO_CRIPTO) netti[anno] = (netti[anno] ?? 0) + c.plusvalenza;
  }
  return netti;
}

// Minusvalenze di un anno compensano solo plusvalenze c-sexies dei 4 anni successivi, le più
// vecchie per prime. Il riporto è derivato dalla storia, mai salvato (§4e).
export function applicaRiporto(netti, anno, anniRiporto = 4) {
  const anni = Object.keys(netti).map(Number);
  const primo = Math.min(...anni, anno);
  let riporti = [];
  let esito = { netto: 0, compensate: 0, baseImponibile: 0 };
  for (let a = primo; a <= anno; a++) {
    riporti = riporti.filter((r) => a - r.anno <= anniRiporto);
    const netto = netti[a] ?? 0;
    let compensate = 0;
    if (netto > 0) {
      let da = netto;
      for (const r of riporti) {
        const usato = Math.min(r.residuo, da);
        r.residuo -= usato;
        da -= usato;
        compensate += usato;
      }
      riporti = riporti.filter((r) => r.residuo > 0.005);
    } else if (netto < 0) {
      riporti.push({ anno: a, residuo: -netto });
    }
    esito = { netto: arrotonda(netto), compensate: arrotonda(compensate), baseImponibile: arrotonda(netto > 0 ? netto - compensate : 0) };
  }
  return { ...esito, minusvalenzeRiportabili: riporti.map((r) => ({ anno: r.anno, residuo: arrotonda(r.residuo) })) };
}

// IVCA per periodo di possesso: ogni lotto (o sua parte) detenuto nell'anno vale
// valoreFinale × aliquota × giorni/365. Valore finale: prezzo al 31/12 × quantità se ancora
// detenuto, controvalore EUR della cessione se ceduto in corso d'anno (Circ. 30/E §3.7.3).
// `lottiLifo` = calcolaLifo con soli lotti e uscite fino al 31/12 dell'anno.
export function calcolaIvcaDaLotti(lottiLifo, anno, { prezzoFine = null, prezzoInizio = null, aliquota }) {
  const inizioAnno = `${anno}-01-01`;
  const fineAnno = `${anno}-12-31`;
  const fineAnnoPrec = `${anno - 1}-12-31`;
  const dettaglio = [];
  let mancaValoreMercato = false;
  let satoshiInizio = 0;
  for (const l of lottiLifo) {
    if (l.data > fineAnno) continue;
    if (l.data <= fineAnnoPrec) satoshiInizio += l.satoshi - l.consumi.filter((c) => c.data <= fineAnnoPrec).reduce((t, c) => t + c.satoshi, 0);
    const dal = l.data > inizioAnno ? l.data : inizioAnno;
    const periodi = l.consumi.filter((c) => c.data >= inizioAnno).map((c) => ({ satoshi: c.satoshi, al: c.data, valoreFinale: c.ricavoEur }));
    if (l.residui > 0) {
      periodi.push({ satoshi: l.residui, al: fineAnno, valoreFinale: prezzoFine == null ? null : (l.residui / SAT) * prezzoFine });
    }
    for (const p of periodi) {
      const giorni = Math.min(365, giorniTra(dal, p.al) + 1);
      if (p.valoreFinale == null) mancaValoreMercato = true;
      dettaglio.push({
        lottoId: l.id, satoshi: p.satoshi, dal, al: p.al, giorni,
        valoreFinale: p.valoreFinale == null ? null : arrotonda(p.valoreFinale),
        imposta: p.valoreFinale == null ? null : (p.valoreFinale * aliquota / 100 * giorni) / 365,
      });
    }
  }
  const valutati = dettaglio.filter((d) => d.valoreFinale != null);
  const valoreFine = arrotonda(valutati.reduce((t, d) => t + d.valoreFinale, 0));
  const impostaLorda = arrotonda(valutati.reduce((t, d) => t + d.imposta, 0));
  return {
    valoreMercato: prezzoFine,
    impostaLorda,
    dettaglioPerLotto: dettaglio.map((d) => ({ ...d, imposta: d.imposta == null ? null : arrotonda(d.imposta) })),
    giorniTotaliPonderati: valoreFine > 0 ? Math.round(valutati.reduce((t, d) => t + d.valoreFinale * d.giorni, 0) / valoreFine) : 0,
    valoreInizio: satoshiInizio === 0 ? 0 : (prezzoInizio == null ? null : arrotonda((satoshiInizio / SAT) * prezzoInizio)),
    valoreFine,
    impostaDaVersare: impostaLorda < SOGLIA_VERSAMENTO_IVCA ? 0 : impostaLorda,
    mancaValoreMercato,
  };
}

// ── Caricamento dati ────────────────────────────────────────────────────────

async function caricaDati() {
  const chiavi = await listMesiFatturati(); // tutti gli anni: il LIFO richiede lo storico completo
  const fatture = (await Promise.all(chiavi.map(async (c) => {
    const f = arricchisciStatoPagamento(await getInvoice(c.anno, c.mese, c.clienteId));
    return f && { anno: c.anno, mese: c.mese, clienteId: c.clienteId, pagamenti: f.pagamenti };
  }))).filter(Boolean);
  const { ingressi, uscite, valoriMercato } = await leggiMovimenti();
  return { lotti: unisciLotti(lottiDaFatture(fatture), ingressi), uscite, valoriMercato };
}

export async function costruisciLotti() {
  return (await caricaDati()).lotti;
}

// Lifo limitato a ciò che esiste fino a `data` (inclusa).
function lifoAllaData({ lotti, uscite }, data) {
  return calcolaLifo(lotti.filter((l) => l.data <= data), uscite.filter((u) => u.data <= data));
}

export async function saldoBtc(dataRiferimento) {
  return saldoDaLotti(lifoAllaData(await caricaDati(), dataRiferimento).lotti);
}

// Lotti con stato di consumo LIFO al 31/12 dell'anno (tutti i lotti fino a quella data).
export async function lottiConStato(anno) {
  const { lotti } = lifoAllaData(await caricaDati(), `${anno}-12-31`);
  return lotti.map(({ residui, consumi, ...l }) => ({
    ...l, residui, consumi,
    stato: residui === 0 ? 'consumato' : residui === l.satoshi ? 'intatto' : 'parziale',
  }));
}

// Simula un'uscita non salvata: LIFO come se fosse registrata, nessuna scrittura.
export async function anteprimaUscita(d) {
  validaUscita(d);
  const dati = await caricaDati();
  const uscita = { ...d, id: 'ANTEPRIMA', ricavoEur: d.ricavoEur ?? 0 };
  const { cessioni } = lifoAllaData({ ...dati, uscite: [...dati.uscite, uscita] }, d.data);
  const cessione = cessioni.find((c) => c.uscita.id === 'ANTEPRIMA') ?? null; // null = trasferimento
  const avvisi = [];
  if (cessione?.satoshiNonCoperti > 0) avvisi.push(`L'uscita eccede il saldo noto di ${cessione.satoshiNonCoperti} sat: costo zero per la parte non coperta.`);
  if (cessione && Number(d.data.slice(0, 4)) < ANNO_INIZIO_CRIPTO) avvisi.push(`Cessione ante-${ANNO_INIZIO_CRIPTO}: non tassata dal registro.`);
  return { cessione, avvisi };
}

function plusvalenzeSu(dati, anno, cripto) {
  const avvisi = [];
  const base = { anno, applicabile: false, aliquota: null, cessioni: [], plusvalenze: 0, minusvalenze: 0, netto: 0, compensate: 0, baseImponibile: 0, imposta: 0, minusvalenzeRiportabili: [], avvisi };
  const ante = dati.uscite.filter((u) => u.tipo !== 'trasferimento' && u.data.slice(0, 4) === String(anno) && anno < ANNO_INIZIO_CRIPTO);
  if (ante.length) avvisi.push(`${ante.length} uscite del ${anno} non tassate dal registro (calcolo dal 01/01/${ANNO_INIZIO_CRIPTO}); consumano comunque i lotti.`);
  if (anno < ANNO_INIZIO_CRIPTO) return base;
  if (!cripto) return { ...base, avvisi: [...avvisi, `Regole cripto assenti per il ${anno}: plusvalenze non calcolate.`] };

  const { cessioni } = lifoAllaData(dati, `${anno}-12-31`);
  const dellAnno = cessioni.filter((c) => c.uscita.data.slice(0, 4) === String(anno));
  for (const c of dellAnno) {
    if (c.satoshiNonCoperti > 0) avvisi.push(`Uscita ${c.uscita.id} eccede il saldo noto di ${c.satoshiNonCoperti} sat: costo zero per la parte non coperta.`);
  }
  const riporto = applicaRiporto(nettiPerAnno(cessioni), anno, cripto.riportoMinusvalenze);
  return {
    ...base,
    applicabile: true,
    aliquota: cripto.aliquotaPlusvalenze,
    cessioni: dellAnno,
    plusvalenze: arrotonda(dellAnno.filter((c) => c.plusvalenza > 0).reduce((t, c) => t + c.plusvalenza, 0)),
    minusvalenze: arrotonda(-dellAnno.filter((c) => c.plusvalenza < 0).reduce((t, c) => t + c.plusvalenza, 0)),
    ...riporto,
    imposta: arrotonda((riporto.baseImponibile * cripto.aliquotaPlusvalenze) / 100),
  };
}

function ivcaSu(dati, anno, cripto) {
  const lifo = lifoAllaData(dati, `${anno}-12-31`);
  return calcolaIvcaDaLotti(lifo.lotti, anno, {
    prezzoFine: dati.valoriMercato[anno] ?? null,
    prezzoInizio: dati.valoriMercato[anno - 1] ?? null,
    aliquota: cripto.aliquotaIvca,
  });
}

export async function calcolaPlusvalenze(anno) {
  const [dati, regole] = await Promise.all([caricaDati(), regoleAnno(anno)]);
  return plusvalenzeSu(dati, anno, regole.cripto);
}

export async function calcolaIvca(anno) {
  const [dati, regole] = await Promise.all([caricaDati(), regoleAnno(anno)]);
  if (!regole.cripto) return null;
  return ivcaSu(dati, anno, regole.cripto);
}

// Rigo RW8: acconti versati (1728+1729) da versamentiF24Service; eccedenza anno precedente e
// compensazioni F24 non sono tracciate e restano a zero.
export async function riepilogoAnnuale(anno) {
  const [dati, regole, versamenti] = await Promise.all([caricaDati(), regoleAnno(anno), listVersamenti(anno)]);
  const accontiVersati = accontiIvcaVersati(versamenti, anno) ?? 0;
  const { cripto } = regole;
  const plusvalenze = plusvalenzeSu(dati, anno, cripto);
  const saldo = saldoDaLotti(lifoAllaData(dati, `${anno}-12-31`).lotti);
  const prezzo = dati.valoriMercato[anno] ?? null;
  const ivca = cripto ? ivcaSu(dati, anno, cripto) : null;
  return {
    anno,
    plusvalenze,
    saldo: { ...saldo, valoreEur: prezzo == null ? null : arrotonda((saldo.satoshi / SAT) * prezzo) },
    ivca,
    codiciTributo: cripto?.codiciTributo ?? null,
    rw8: ivca && { totaleImposta: ivca.impostaDaVersare, eccedenzaAnnoPrec: 0, compensataF24: 0, accontiVersati, saldo: arrotonda(ivca.impostaDaVersare - accontiVersati) },
  };
}
