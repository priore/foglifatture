import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estraiErroriScarto } from './sdiRicevuteService.js';

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
