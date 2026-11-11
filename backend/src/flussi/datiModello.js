// Modello dati fittizio COMPLETO per i test di flusso (sandbox, mai dati reali): fornitore, clienti di
// ogni tipo (IT, rivalsa INPS, estero UE/extra-UE, pagamento BTC, disattivato), timesheet, fatture in
// tutti gli stati, versamenti F24, movimenti BTC, impostazioni di backup. Tutto fittizio: indirizzi
// example.com, P.IVA e CF di prova, indirizzo BTC = test vector BIP-173.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const CLI = {
  it: 'cli-it-0001',
  rivalsa: 'cli-rivalsa-0002',
  ue: 'cli-ue-0003',
  extraUe: 'cli-extraue-0004',
  btc: 'cli-btc-0005',
  disattivo: 'cli-off-0006',
};

export const INDIRIZZO_BTC = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
export const TXID = 'a'.repeat(64);
export const ANNO = 2026;

export function configModello(radice) {
  let progressivo = 0;
  const cliente = (id, extra) => ({
    id, attivo: true, denominazione: `Cliente ${id}`, indirizzo: 'Via Esempio', cap: '20100', comune: 'Milano',
    provincia: 'MI', partitaIva: `0987654321${progressivo++}`, codiceDestinatarioSdi: 'ABCDEFG', logoDataUrl: '',
    tariffaOraria: 40, email: `${id}@example.com`, figura: '', commessa: '', clientePdf: '', progetto: '',
    templateFatturaId: null, templateTimesheetId: null, ...extra,
  });
  return {
    fornitore: {
      denominazione: 'Studio Prova di Mario Rossi', indirizzo: 'Via Roma', numeroCivico: '1', cap: '00100',
      comune: 'Roma', provincia: 'RM', partitaIva: '01234567890', codiceFiscale: 'RSSMRA80A01H501Z',
      regimeFiscale: 'RF19', logoDataUrl: '', iscrittoVies: true,
    },
    clienti: [
      cliente(CLI.it, { denominazione: 'Cliente Italia S.r.l.', tariffaOraria: 40 }),
      cliente(CLI.rivalsa, { denominazione: 'Cliente Rivalsa S.r.l.', tariffaOraria: 55, rivalsaInps: true }),
      cliente(CLI.ue, { denominazione: 'Kunde GmbH', paese: 'DE', tipo: 'azienda', partitaIva: '', codiceDestinatarioSdi: 'XXXXXXX', tariffaOraria: 60 }),
      cliente(CLI.extraUe, { denominazione: 'Client Ltd', paese: 'US', tipo: 'azienda', partitaIva: '', codiceDestinatarioSdi: 'XXXXXXX', tariffaOraria: 70 }),
      cliente(CLI.btc, { denominazione: 'Cliente Bitcoin S.r.l.', pagamentoBtc: true, causaleBtc: 'Pagamento in BTC (art. 1197 c.c.)', tariffaOraria: 50 }),
      cliente(CLI.disattivo, { denominazione: 'Cliente Chiuso S.r.l.', attivo: false }),
    ],
    fatturazione: {
      sogliaBolloVirtuale: 77.47, importoBollo: 2, iban: 'IT60X0542811101000000123456',
      intestatario: 'Mario Rossi', istitutoFinanziario: 'Banca Prova', modalitaDefault: 'MP05', giorniScadenzaDefault: 30,
    },
    sdi: { percorsoArchivio: path.join(radice, 'archivio-sdi'), intervalloPollingMinuti: 15, pollingAbilitato: false },
    backup: { abilitato: false, percorsoDestinazione: path.join(radice, 'backup'), intervalloOreMinuti: 1440 },
    reminder: { abilitato: false },
    forfettario: {
      sogliaAnnua: 85000, codiceAteco: '62.02.00', settoreAteco: 'Informatica e Web', coefficenteRedditivita: 67,
      dataInizioAttivita: '2022-01-01', soggettoIsa: true, codiceSedeInps: '', gestionePrevidenziale: 'gestioneSeparata',
      rateSaldo: 1,
    },
    notifiche: { abilitate: false },
  };
}

// Giorni feriali (lun-ven) con 8 ore; `giorniStato` forza uno stato (es. { 15: 'Ferie' }) senza ore.
export function oreFeriali(giorni, { giorniStato = {}, ore = ['09:00', '13:00', '14:00', '18:00'] } = {}) {
  return giorni.map((g) => {
    const feriale = !['Sabato', 'Domenica'].includes(g.nomeGiorno);
    if (giorniStato[g.giorno]) return { ...g, stato: giorniStato[g.giorno] };
    if (!feriale) return g;
    return { ...g, inizioMattina: ore[0], fineMattina: ore[1], inizioPomeriggio: ore[2], finePomeriggio: ore[3] };
  });
}

export async function compilaTimesheet(amb, anno, mese, clienteId, opzioni) {
  const t = await amb.api('GET', `/api/timesheet/${anno}/${mese}/${clienteId}`);
  const r = await amb.api('PUT', `/api/timesheet/${anno}/${mese}/${clienteId}`, { giorni: oreFeriali(t.corpo.giorni, opzioni) });
  if (r.stato !== 200) throw new Error(`timesheet ${anno}-${mese}-${clienteId}: ${r.stato} ${r.testo}`);
  return r.corpo;
}

export async function generaFattura(amb, anno, mese, clienteId, corpo = {}) {
  return amb.api('POST', `/api/invoice/${anno}/${mese}/${clienteId}/genera`, { confermaSoglia: true, ...corpo });
}

// Simula l'invio a SDI e la ricevuta di consegna: registra il tentativo di invio sulla fattura e
// deposita la ricevuta RC nell'archivio (come farebbe il polling PEC). Esito 'NS' = scarto.
export async function simulaEsitoSdi(amb, anno, mese, clienteId, progressivo = 'AAAAA', tipo = 'RC') {
  const { readJson, writeJson } = await import('../lib/jsonStore.js');
  const chiave = `invoices/${anno}-${String(mese).padStart(2, '0')}-${clienteId}.json`;
  const f = await readJson(chiave);
  f.invii = [...(f.invii ?? []), { progressivoInvio: progressivo, dataInvio: new Date().toISOString(), esito: 'inviata', errore: null }];
  await writeJson(chiave, f);
  const cfg = await amb.api('GET', '/api/config');
  const archivio = cfg.corpo.sdi.percorsoArchivio;
  await mkdir(archivio, { recursive: true });
  const contenuto = tipo === 'NS'
    ? '<ListaErrori><Errore><Codice>00300</Codice><Descrizione>IdCodice non valido</Descrizione></Errore></ListaErrori>'
    : '<RicevutaConsegna/>';
  await writeFile(path.join(archivio, `IT${cfg.corpo.fornitore.partitaIva}_${progressivo}_${tipo}_001.xml`), contenuto);
}

// Popola l'intero modello. Ritorna un riepilogo con i riferimenti utili ai test.
export async function popolaModello(amb) {
  const salva = await amb.api('PUT', '/api/config', configModello(amb.radice));
  if (salva.stato !== 200) throw new Error(`config: ${salva.stato} ${salva.testo}`);

  // Timesheet: 3 mesi per cliente attivo; il mese 3 del cliente IT ha ferie e malattia.
  for (const mese of [1, 2, 3]) {
    for (const id of [CLI.it, CLI.rivalsa, CLI.ue, CLI.extraUe, CLI.btc]) {
      await compilaTimesheet(amb, ANNO, mese, id, mese === 3 && id === CLI.it ? { giorniStato: { 10: 'Ferie', 11: 'Malattia' } } : {});
    }
  }

  // Fatture in stati diversi.
  const fatture = {};
  fatture.itGen = await generaFattura(amb, ANNO, 1, CLI.it);          // pagata per intero
  fatture.itFeb = await generaFattura(amb, ANNO, 2, CLI.it);          // pagata parzialmente
  fatture.itMar = await generaFattura(amb, ANNO, 3, CLI.it);          // aperta, non inviata
  fatture.rivalsa = await generaFattura(amb, ANNO, 1, CLI.rivalsa);   // accettata SDI
  fatture.ue = await generaFattura(amb, ANNO, 1, CLI.ue);             // scartata SDI
  fatture.extraUe = await generaFattura(amb, ANNO, 1, CLI.extraUe);   // aperta
  fatture.btc = await generaFattura(amb, ANNO, 1, CLI.btc);           // pagata in BTC
  fatture.manuale = await generaFattura(amb, ANNO, 4, CLI.it, { importo: 1500, descrizione: 'Consulenza una tantum' });

  await simulaEsitoSdi(amb, ANNO, 1, CLI.rivalsa, 'BBBBB', 'RC');
  await simulaEsitoSdi(amb, ANNO, 1, CLI.ue, 'CCCCC', 'NS');

  const pag = (corpo) => amb.api('POST', '/api/forfettario/pagamenti/conferma', corpo);
  const netto = (f) => f.corpo.nettoAPagare;
  await pag({ anno: ANNO, mese: 1, clienteId: CLI.it, dataPagamento: `${ANNO}-02-10`, importo: netto(fatture.itGen) });
  await pag({ anno: ANNO, mese: 2, clienteId: CLI.it, dataPagamento: `${ANNO}-03-10`, importo: 100 });
  await amb.api('POST', '/api/forfettario/pagamenti/conferma-btc', {
    anno: ANNO, mese: 1, clienteId: CLI.btc, dataPagamento: `${ANNO}-02-20`, txid: TXID, satoshi: 2_000_000,
    cambioEurBtc: 60000, fonteCambio: 'prova', dataOraCambio: `${ANNO}-02-20T10:00:00Z`, indirizzoDestinatario: INDIRIZZO_BTC,
  });

  // Versamenti F24 e movimenti BTC.
  await amb.api('POST', '/api/forfettario/versamenti', { data: `${ANNO}-06-30`, tipo: 'imposta', importo: 500, codice: '1790' });
  await amb.api('POST', '/api/forfettario/versamenti', { data: `${ANNO}-06-30`, tipo: 'INPS', importo: 300 });
  await amb.api('POST', '/api/forfettario/btc/movimenti/ingresso', {
    tipo: 'acquisto', data: `${ANNO - 1}-05-01`, satoshi: 10_000_000, costoEur: 5000, txid: 'b'.repeat(64),
  });

  return { fatture, cliente: CLI };
}
