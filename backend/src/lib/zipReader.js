// Lettore ZIP minimale con la sola stdlib (zlib): legge la central directory e
// decomprime in memoria. Niente ZIP64, niente cifratura: per archivi del Cassetto Fiscale bastano.
// Limiti contro gli zip bomb: verificati sulle dimensioni dichiarate e poi sull'output reale.
import { inflateRawSync } from 'node:zlib';

export const LIMITI_ZIP = { maxFile: 5 * 1024 * 1024, maxNumeroFile: 2000, maxTotale: 200 * 1024 * 1024 };

const SIG_EOCD = 0x06054b50;
const SIG_CENTRALE = 0x02014b50;
const SIG_LOCALE = 0x04034b50;

/**
 * @returns {Array<{ nome: string, contenuto: Buffer }>} solo file veri (niente cartelle, niente __MACOSX)
 */
export function leggiZip(buffer, limiti = LIMITI_ZIP) {
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 22 - 0xffff); i--) {
    if (buffer.readUInt32LE(i) === SIG_EOCD) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Archivio ZIP non valido');

  const numeroVoci = buffer.readUInt16LE(eocd + 10);
  if (numeroVoci > limiti.maxNumeroFile) throw new Error(`Archivio con troppi file (massimo ${limiti.maxNumeroFile})`);

  const risultato = [];
  let totale = 0;
  let pos = buffer.readUInt32LE(eocd + 16);
  for (let n = 0; n < numeroVoci; n++) {
    if (buffer.readUInt32LE(pos) !== SIG_CENTRALE) throw new Error('Archivio ZIP danneggiato');
    const flag = buffer.readUInt16LE(pos + 8);
    const metodo = buffer.readUInt16LE(pos + 10);
    const compressa = buffer.readUInt32LE(pos + 20);
    const dichiarata = buffer.readUInt32LE(pos + 24);
    const lunNome = buffer.readUInt16LE(pos + 28);
    const lunExtra = buffer.readUInt16LE(pos + 30);
    const lunCommento = buffer.readUInt16LE(pos + 32);
    const offsetLocale = buffer.readUInt32LE(pos + 42);
    const nome = buffer.toString(flag & 0x800 ? 'utf8' : 'latin1', pos + 46, pos + 46 + lunNome);
    pos += 46 + lunNome + lunExtra + lunCommento;

    if (nome.endsWith('/') || nome.startsWith('__MACOSX/')) continue;
    if (flag & 1) throw new Error(`File cifrato non supportato: ${nome}`);
    if (compressa === 0xffffffff || dichiarata === 0xffffffff) throw new Error('ZIP64 non supportato');
    if (dichiarata > limiti.maxFile) throw new Error(`File troppo grande nell'archivio: ${nome}`);
    if (buffer.readUInt32LE(offsetLocale) !== SIG_LOCALE) throw new Error('Archivio ZIP danneggiato');

    const inizio = offsetLocale + 30 + buffer.readUInt16LE(offsetLocale + 26) + buffer.readUInt16LE(offsetLocale + 28);
    const dati = buffer.subarray(inizio, inizio + compressa);
    let contenuto;
    if (metodo === 0) contenuto = dati;
    else if (metodo === 8) {
      try { contenuto = inflateRawSync(dati, { maxOutputLength: limiti.maxFile }); }
      catch { throw new Error(`File non decomprimibile o troppo grande: ${nome}`); }
    } else throw new Error(`Compressione non supportata (${metodo}): ${nome}`);

    totale += contenuto.length;
    if (contenuto.length > limiti.maxFile || totale > limiti.maxTotale) throw new Error('Archivio troppo grande una volta estratto');
    risultato.push({ nome, contenuto });
  }
  return risultato;
}
