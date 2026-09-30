import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estraiErroriScarto, classificaAllegatoXml } from './sdiRicevuteService.js';

const NS_REALE = `<?xml version="1.0" encoding="UTF-8"?><ns3:RicevutaScarto>
    <ListaErrori>
        <Errore>
            <Codice>00200</Codice>
            <Descrizione>File non conforme al formato : The value '165' of element 'CAP' is not valid.
riga: 47 - colonna: 23</Descrizione>
            <Suggerimento>Verificare che i campi contenuti nel file inviato rispettino caratteristiche formali e ordine di rappresentazione previsti dal tracciato fattura</Suggerimento>
        </Errore>
    </ListaErrori>
</ns3:RicevutaScarto>`;

test('estrae codice/descrizione/suggerimento da una NS reale', () => {
  const [errore] = estraiErroriScarto(Buffer.from(NS_REALE, 'utf8'));
  assert.equal(errore.codice, '00200');
  assert.match(errore.descrizione, /CAP.*not valid/s);
  assert.match(errore.suggerimento, /caratteristiche formali/);
});

test('codice noto (00300) aggiunge un messaggio di dettaglio', () => {
  const xml = NS_REALE.replace('00200', '00300');
  const [errore] = estraiErroriScarto(Buffer.from(xml, 'utf8'));
  assert.match(errore.dettaglio, /IdTrasmittente/);
});

test('codice sconosciuto non ha dettaglio aggiuntivo', () => {
  const xml = NS_REALE.replace('00200', '99999');
  const [errore] = estraiErroriScarto(Buffer.from(xml, 'utf8'));
  assert.equal(errore.dettaglio, null);
});

test('NS senza ListaErrori restituisce array vuoto', () => {
  assert.deepEqual(estraiErroriScarto(Buffer.from('<x/>', 'utf8')), []);
});

test('entità XML nel testo (es. nomi di tag citati) vengono decodificate una sola volta', () => {
  const xml = NS_REALE.replace(
    'File non conforme al formato',
    '1.1.1.2 &lt;IdCodice&gt; non valido'
  );
  const [errore] = estraiErroriScarto(Buffer.from(xml, 'utf8'));
  assert.match(errore.descrizione, /1\.1\.1\.2 <IdCodice> non valido/);
});

// Test classificaAllegatoXml: radice SDI riconosciuta
test('Ricevuta (RC) riconosciuta da radice XML', () => {
  const rc = Buffer.from(`<?xml version="1.0"?><ns2:Ricevuta><IdentificativoSdI>123</IdentificativoSdI></ns2:Ricevuta>`, 'utf8');
  const result = classificaAllegatoXml('IT10149810581_L4WDB_RC_002.xml', rc);
  assert.equal(result.isValido, true);
  assert.equal(result.tipo, 'RC');
});

test('NotificaScarto (NS) riconosciuta da radice XML', () => {
  const ns = Buffer.from(`<?xml version="1.0"?><ns2:NotificaScarto><ListaErrori/></ns2:NotificaScarto>`, 'utf8');
  const result = classificaAllegatoXml('IT10149810581_L4WDB_NS_002.xml', ns);
  assert.equal(result.isValido, true);
  assert.equal(result.tipo, 'NS');
});

test('FileMetadati scartato (metadato di trasporto)', () => {
  const fm = Buffer.from(`<?xml version="1.0"?><ns3:FileMetadati><NomeFile>x.xml.p7m</NomeFile></ns3:FileMetadati>`, 'utf8');
  const result = classificaAllegatoXml('IT01879020517A2026_g0WMK_MT_001.xml', fm);
  assert.equal(result.isValido, false);
  assert.equal(result.motivo, 'metadato-trasporto');
});

test('XML malformato o non riconosciuto scartato', () => {
  const bad = Buffer.from(`<?xml version="1.0"?><x><unclosed>`, 'utf8');
  const result = classificaAllegatoXml('bad.xml', bad);
  assert.equal(result.isValido, false);
  // Motivo può essere 'non-riconosciuto' (regex trova il tag radice 'x')
  assert(result.motivo === 'non-riconosciuto' || result.motivo === 'xml-malformato');
});

test('daticert.xml scartato per filename', () => {
  const any = Buffer.from(`<x/>`, 'utf8');
  const result = classificaAllegatoXml('daticert.xml', any);
  assert.equal(result.isValido, false);
  assert.equal(result.motivo, 'metadato-trasporto');
});

test('XML con radice sconosciuta scartato', () => {
  const unknown = Buffer.from(`<?xml version="1.0"?><StrangeRoot/>`, 'utf8');
  const result = classificaAllegatoXml('strange.xml', unknown);
  assert.equal(result.isValido, false);
  assert.equal(result.motivo, 'non-riconosciuto');
});
