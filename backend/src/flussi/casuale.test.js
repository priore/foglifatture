// Utente "casuale": sequenza pseudo-casuale (con seme riproducibile) di inserimenti, modifiche,
// cancellazioni, doppi click e input sbagliati su tutte le aree. Dopo ogni passo gli invarianti devono tenere:
// nessun errore 5xx, numerazione senza buchi né duplicati, incassi coerenti con lo stato, file leggibili.
// Riproduzione di un fallimento: SEME=<numero> npm test.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { creaAmbiente } from './ambiente.js';
import { popolaModello, oreFeriali, CLI, ANNO, INDIRIZZO_BTC } from './datiModello.js';

const SEME = Number(process.env.SEME) || 20261109;
const PASSI = Number(process.env.PASSI) || 250;

function prng(seme) {
  let s = seme >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}

let amb;
before(async () => { amb = await creaAmbiente(); await popolaModello(amb); });
after(async () => { await amb.chiudi(); });

test(`sequenza casuale di ${PASSI} azioni utente (seme ${SEME})`, async () => {
  const rnd = prng(SEME);
  const scegli = (v) => v[Math.floor(rnd() * v.length)];
  const attivi = [CLI.it, CLI.rivalsa, CLI.ue, CLI.extraUe, CLI.btc];
  const traccia = [];
  const chiama = async (metodo, percorso, corpo) => {
    const r = await amb.api(metodo, percorso, corpo);
    traccia.push(`${metodo} ${percorso} → ${r.stato}`);
    assert.ok(r.stato < 500, `5xx (seme ${SEME}) su ${metodo} ${percorso}: ${r.testo.slice(0, 200)}\nUltimi passi:\n${traccia.slice(-6).join('\n')}`);
    return r;
  };

  const azioni = [
    async () => { // timesheet valido, mese a caso
      const m = 1 + Math.floor(rnd() * 12); const c = scegli(attivi);
      const t = (await chiama('GET', `/api/timesheet/${ANNO}/${m}/${c}`)).corpo;
      const giorni = rnd() < 0.2 ? t.giorni : oreFeriali(t.giorni, { giorniStato: rnd() < 0.5 ? { 5: 'Ferie' } : {} });
      await chiama('PUT', `/api/timesheet/${ANNO}/${m}/${c}`, { giorni });
    },
    async () => { // emissione (anche doppia) o manuale
      const m = 1 + Math.floor(rnd() * 12); const c = scegli(attivi);
      const corpo = rnd() < 0.4 ? { importo: Math.round(rnd() * 900) + 10, descrizione: 'casuale' } : {};
      const chiamate = [chiama('POST', `/api/invoice/${ANNO}/${m}/${c}/genera`, { confermaSoglia: true, ...corpo })];
      if (rnd() < 0.3) chiamate.push(chiama('POST', `/api/invoice/${ANNO}/${m}/${c}/genera`, { confermaSoglia: true, ...corpo }));
      await Promise.all(chiamate);
    },
    async () => { // incasso
      const m = 1 + Math.floor(rnd() * 12); const c = scegli(attivi);
      await chiama('POST', '/api/forfettario/pagamenti/conferma', { anno: ANNO, mese: m, clienteId: c, dataPagamento: `${ANNO}-0${1 + Math.floor(rnd() * 9)}-15`, importo: Math.round(rnd() * 500) - 20 });
    },
    async () => { // cancellazione incasso (indice anche sbagliato)
      const m = 1 + Math.floor(rnd() * 12); const c = scegli(attivi);
      await chiama('DELETE', `/api/forfettario/pagamenti/${ANNO}/${m}/${c}/${Math.floor(rnd() * 4) - 1}`);
    },
    async () => { // versamento F24 valido/non valido, poi cancellazione
      const r = await chiama('POST', '/api/forfettario/versamenti', { data: `${ANNO}-06-30`, tipo: scegli(['imposta', 'INPS']), importo: Math.round(rnd() * 400) - 50 });
      if (r.stato === 201 && rnd() < 0.5) await chiama('DELETE', `/api/forfettario/versamenti/${r.corpo.id}`);
    },
    async () => { // movimenti BTC
      const sat = Math.floor(rnd() * 2_000_000) - 100;
      const r = await chiama('POST', '/api/forfettario/btc/movimenti/ingresso', { tipo: scegli(['acquisto', 'mining', 'boh']), data: `${ANNO}-0${1 + Math.floor(rnd() * 8)}-10`, satoshi: sat, costoEur: Math.round(rnd() * 1000) });
      if (r.stato === 201) {
        if (rnd() < 0.5) await chiama('POST', '/api/forfettario/btc/movimenti/uscita', { tipo: 'vendita', data: `${ANNO}-10-10`, satoshi: Math.max(1, Math.floor(sat / 2)), ricavoEur: 100 });
        if (rnd() < 0.4) await chiama('DELETE', `/api/forfettario/btc/movimenti/${r.corpo.movimento.id}`);
      }
    },
    async () => { // incasso BTC
      const m = 1 + Math.floor(rnd() * 12);
      await chiama('POST', '/api/forfettario/pagamenti/conferma-btc', { anno: ANNO, mese: m, clienteId: CLI.btc, dataPagamento: `${ANNO}-05-05`, txid: scegli(['e'.repeat(64), 'zz']), satoshi: 100000, cambioEurBtc: 60000, indirizzoDestinatario: INDIRIZZO_BTC });
    },
    async () => { // modifica anagrafica: tariffa e attivazione di un cliente
      const cfg = (await chiama('GET', '/api/config')).corpo;
      const c = scegli(cfg.clienti);
      const clienti = cfg.clienti.map((x) => (x.id === c.id ? { ...x, tariffaOraria: 20 + Math.floor(rnd() * 80), attivo: x.id === CLI.it ? true : rnd() < 0.8 } : x));
      await chiama('PUT', '/api/config', { clienti });
    },
    async () => { // eliminazione cliente (ammessa solo senza dati) e riaggiunta
      const r = await chiama('DELETE', `/api/config/clienti/${scegli([CLI.it, CLI.disattivo, 'inesistente'])}`);
      assert.ok([200, 400].includes(r.stato));
    },
    async () => { // anteprime, XML, ricevute, dashboard (sola lettura)
      const m = 1 + Math.floor(rnd() * 12); const c = scegli(attivi);
      const p = scegli([`/api/invoice/${ANNO}/${m}/${c}/anteprima`, `/api/invoice/${ANNO}/${m}/${c}/xml`, `/api/invoice/${ANNO}/${m}/${c}/ricevute-sdi`, `/api/forfettario/dashboard?anno=${ANNO}`, '/api/forfettario/fatture-aperte', `/api/forfettario/btc/plusvalenze?anno=${ANNO}`]);
      await chiama('GET', p);
    },
    async () => { // backup e ripristino
      const bk = await chiama('POST', '/api/backup/esporta', { password: 'seme-casuale' });
      if (rnd() < 0.3) {
        const fd = new FormData(); fd.append('file', new Blob([bk.buffer]), 'b.tsbk'); fd.append('password', 'seme-casuale');
        await chiama('POST', '/api/backup/ripristina', fd);
      }
    },
  ];

  for (let i = 0; i < PASSI; i++) {
    await scegli(azioni)();
    if (i % (Number(process.env.OGNI) || 10) === 0) await controllaInvarianti(i);
  }
  await controllaInvarianti(PASSI);

  async function controllaInvarianti(passo) {
    const ctx = `seme ${SEME}, passo ${passo}\n${traccia.slice(-6).join('\n')}`;
    const seq = (await amb.api('GET', '/api/invoice/sequenza')).corpo;
    assert.equal(seq.ok, true, `sequenza rotta: ${JSON.stringify(seq)}\n${ctx}`);
    const elenco = (await amb.api('GET', '/api/invoice')).corpo;
    const viste = new Set(); const numeri = [];
    for (const { anno, mese, clienteId } of elenco) {
      const f = (await amb.api('GET', `/api/invoice/${anno}/${mese}/${clienteId}`)).corpo;
      assert.ok(!viste.has(f.numero), `numero duplicato ${f.numero}\n${ctx}`);
      viste.add(f.numero); numeri.push(Number(f.numero));
    }
    numeri.sort((a, b) => a - b);
    numeri.forEach((n, i) => assert.equal(n, i + 1, `buco nella numerazione: ${numeri.join(',')}\n${ctx}`));
    for (const f of (await amb.api('GET', '/api/forfettario/fatture-aperte')).corpo) {
      assert.ok(Number.isFinite(f.residuo), `residuo non numerico\n${ctx}`);
    }
    for (const nome of await leggiTuttiJson(amb.dati)) JSON.parse(await readFile(nome, 'utf-8')); // nessun file corrotto
  }
});

async function leggiTuttiJson(dir) {
  const voci = await readdir(dir, { withFileTypes: true });
  const out = [];
  for (const v of voci) {
    const p = path.join(dir, v.name);
    if (v.isDirectory()) out.push(...await leggiTuttiJson(p));
    else if (v.name.endsWith('.json')) out.push(p);
  }
  return out;
}
