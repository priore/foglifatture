import { test } from 'node:test';
import assert from 'node:assert/strict';
import { radiceXml, classificaFile } from './importZipService.js';

const xml = testo => Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>\n${testo}`);

test('radice con e senza prefisso namespace', () => {
  assert.equal(radiceXml(xml('<ns3:RicevutaConsegna xmlns:ns3="x"><a/></ns3:RicevutaConsegna>')), 'RicevutaConsegna');
  assert.equal(radiceXml(xml('<!-- c --><NotificaScarto versione="1.0"/>')), 'NotificaScarto');
});

test('ricevute riconosciute dal contenuto, non dal nome', () => {
  assert.deepEqual(classificaFile('qualsiasi.xml', xml('<RicevutaConsegna/>')), { tipo: 'ricevuta', codiceTipo: 'RC' });
  assert.equal(classificaFile('x.xml', xml('<NotificaScarto/>')).codiceTipo, 'NS');
  assert.equal(classificaFile('x.xml', xml('<NotificaMancataConsegna/>')).codiceTipo, 'MC');
});

test('fattura leggibile ⇒ anteprima; illeggibile o altro ⇒ ignorato con motivo', () => {
  const fattura = xml(`<p:FatturaElettronica><FatturaElettronicaHeader><DatiTrasmissione><ProgressivoInvio>A1</ProgressivoInvio></DatiTrasmissione></FatturaElettronicaHeader><FatturaElettronicaBody><DatiGenerali><DatiGeneraliDocumento>
    <Data>2025-03-10</Data><Numero>7</Numero><ImportoTotaleDocumento>100.00</ImportoTotaleDocumento>
    </DatiGeneraliDocumento></DatiGenerali><DatiBeniServizi><DettaglioLinee><Descrizione>x</Descrizione>
    <Quantita>1</Quantita><PrezzoUnitario>100</PrezzoUnitario><PrezzoTotale>100</PrezzoTotale></DettaglioLinee>
    </DatiBeniServizi></FatturaElettronicaBody></p:FatturaElettronica>`);
  const r = classificaFile('f.xml', fattura);
  assert.equal(r.tipo, 'fattura');
  assert.equal(r.anteprima.numero, '7');
  assert.equal(classificaFile('f.xml', xml('<FatturaElettronica/>')).tipo, 'ignorato');
  assert.match(classificaFile('a.xml', xml('<Altro/>')).motivo, /Altro/);
  assert.match(classificaFile('a.pdf', Buffer.from('%PDF')).motivo, /XML/);
});
