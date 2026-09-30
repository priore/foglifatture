import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { leggiZip } from './zipReader.js';

// Costruisce uno ZIP valido (local header + central directory + EOCD) per i test.
function creaZip(voci) {
  const locali = [];
  const centrali = [];
  let offset = 0;
  for (const { nome, contenuto, metodo = 8 } of voci) {
    const dati = metodo === 8 ? deflateRawSync(contenuto) : contenuto;
    const nomeBuf = Buffer.from(nome);
    const locale = Buffer.alloc(30);
    locale.writeUInt32LE(0x04034b50, 0);
    locale.writeUInt16LE(metodo, 8);
    locale.writeUInt32LE(dati.length, 18);
    locale.writeUInt32LE(contenuto.length, 22);
    locale.writeUInt16LE(nomeBuf.length, 26);
    const centrale = Buffer.alloc(46);
    centrale.writeUInt32LE(0x02014b50, 0);
    centrale.writeUInt16LE(metodo, 10);
    centrale.writeUInt32LE(dati.length, 20);
    centrale.writeUInt32LE(contenuto.length, 24);
    centrale.writeUInt16LE(nomeBuf.length, 28);
    centrale.writeUInt32LE(offset, 42);
    locali.push(locale, nomeBuf, dati);
    centrali.push(centrale, nomeBuf);
    offset += 30 + nomeBuf.length + dati.length;
  }
  const dirCentrale = Buffer.concat(centrali);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(voci.length, 10);
  eocd.writeUInt32LE(dirCentrale.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locali, dirCentrale, eocd]);
}

test('legge file compressi e non compressi, salta cartelle', () => {
  const zip = creaZip([
    { nome: 'cartella/', contenuto: Buffer.alloc(0), metodo: 0 },
    { nome: 'a.xml', contenuto: Buffer.from('<a/>'.repeat(50)) },
    { nome: 'b.xml', contenuto: Buffer.from('<b/>'), metodo: 0 },
  ]);
  const file = leggiZip(zip);
  assert.deepEqual(file.map(f => f.nome), ['a.xml', 'b.xml']);
  assert.equal(file[0].contenuto.toString(), '<a/>'.repeat(50));
  assert.equal(file[1].contenuto.toString(), '<b/>');
});

test('rifiuta file oltre il limite e troppi file', () => {
  const zip = creaZip([{ nome: 'grande.xml', contenuto: Buffer.alloc(1000, 'x') }]);
  assert.throws(() => leggiZip(zip, { maxFile: 100, maxNumeroFile: 10, maxTotale: 1e6 }), /troppo grande/);
  const due = creaZip([{ nome: 'a', contenuto: Buffer.from('1') }, { nome: 'b', contenuto: Buffer.from('2') }]);
  assert.throws(() => leggiZip(due, { maxFile: 100, maxNumeroFile: 1, maxTotale: 1e6 }), /troppi file/);
});

test('rifiuta dimensione dichiarata falsa (zip bomb)', () => {
  const zip = creaZip([{ nome: 'bomba.xml', contenuto: Buffer.alloc(10000, 'x') }]);
  // dimensione non compressa dichiarata: 10 byte, reale 10000
  const i = zip.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  zip.writeUInt32LE(10, i + 24);
  assert.throws(() => leggiZip(zip, { maxFile: 100, maxNumeroFile: 10, maxTotale: 1e6 }), /decomprimibile|troppo grande/);
});

test('non-ZIP ⇒ errore', () => {
  assert.throws(() => leggiZip(Buffer.from('non uno zip, solo testo lungo abbastanza per il controllo')), /non valido/);
});
