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
  const rc = Buffer.from(`<?xml version="1.0"?><ns2:RicevutaConsegna><IdentificativoSdI>123</IdentificativoSdI></ns2:RicevutaConsegna>`, 'utf8');
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

test('MetadatiInvioFile scartato (metadato di trasporto)', () => {
  const fm = Buffer.from(`<?xml version="1.0"?><ns3:MetadatiInvioFile><NomeFile>x.xml.p7m</NomeFile></ns3:MetadatiInvioFile>`, 'utf8');
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

test('RicevutaScarto (NS reale) riconosciuta da radice', () => {
  const result = classificaAllegatoXml('x.xml', Buffer.from(NS_REALE, 'utf8'));
  assert.equal(result.tipo, 'NS');
});

test('FatturaElettronica ricevuta non è una ricevuta SDI', () => {
  const f = Buffer.from('<?xml version="1.0"?><p:FatturaElettronica versione="FPR12"/>', 'utf8');
  assert.equal(classificaAllegatoXml('f.xml', f).motivo, 'fattura-ricevuta');
});

test('raggruppaCronologia lega le ricevute all\'invio e ne deduce lo stato', async () => {
  const { raggruppaCronologia } = await import('./sdiRicevuteService.js');
  const fornitore = { partitaIva: '01234567890' };
  const invii = [
    { anno: 2026, mese: 1, clienteId: 'c1', progressivoInvio: '00001', dataInvio: '2026-01-01T10:00:00Z', esito: 'inviata' },
    { anno: 2026, mese: 2, clienteId: 'c1', progressivoInvio: '00002', dataInvio: '2026-02-01T10:00:00Z', esito: 'inviata' },
    { anno: 2026, mese: 3, clienteId: 'c1', progressivoInvio: '00003', dataInvio: '2026-03-01T10:00:00Z', esito: 'inviata' },
    { anno: 2026, mese: 4, clienteId: 'c1', progressivoInvio: '00004', dataInvio: '2026-04-01T10:00:00Z', esito: 'errore-invio' },
  ];
  const r = (nomeFile, tipo, data) => ({ nomeFile, tipo, data });
  const ricevute = [
    r('IT01234567890_00001_RC_001.xml', 'RC', '2026-01-01T11:00:00Z'),
    r('IT01234567890_00002_NS_001.xml', 'NS', '2026-02-01T11:00:00Z'),
  ];
  const [quattro, tre, due, uno] = raggruppaCronologia(invii, ricevute, fornitore);
  assert.equal(quattro.stato, 'errore-invio');
  assert.equal(tre.stato, 'in-attesa');
  assert.equal(due.stato, 'scartata');
  assert.equal(uno.stato, 'accettata');
  assert.equal(uno.ricevute.length, 1);
});

test('raggruppaCronologia: un rinvio accettato risolve la fattura e archivia i tentativi precedenti', async () => {
  const { raggruppaCronologia } = await import('./sdiRicevuteService.js');
  const f = { partitaIva: '01234567890' };
  const base = { anno: 2026, mese: 8, clienteId: 'c1', esito: 'inviata' };
  const invii = [
    { ...base, progressivoInvio: '1', dataInvio: '2026-08-31T14:05:00Z' },
    { ...base, progressivoInvio: '2', dataInvio: '2026-08-31T14:15:00Z' },
    { ...base, progressivoInvio: '3', dataInvio: '2026-08-31T14:32:00Z' },
    { ...base, progressivoInvio: '4', dataInvio: '2026-08-31T14:46:00Z' },
  ];
  const ricevute = [
    { nomeFile: 'IT01234567890_3_NS_001.xml', tipo: 'NS', data: '2026-08-31T14:40:00Z' },
    { nomeFile: 'IT01234567890_4_RC_001.xml', tipo: 'RC', data: '2026-08-31T15:00:00Z' },
  ];
  const schede = raggruppaCronologia(invii, ricevute, f);
  assert.equal(schede.length, 1);
  assert.equal(schede[0].stato, 'accettata');
  assert.equal(schede[0].tentativiPrecedenti.length, 3);
});
