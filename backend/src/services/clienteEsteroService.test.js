import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { trattamentoCliente, scadenzaEmissioneRinviata } from './clienteEsteroService.js';

const REGOLE = {
  clientiEsteri: {
    paesiUe: ['AT','BE','DE','FR','ES','IT','NL','PL','SE'],
    diciture: {
      azAziendaUe: 'Operazione non soggetta ad IVA ai sensi dell\'art. 7-ter del DPR 633/72. Inversione contabile.',
      azAziendaExtraUe: 'Operazione non soggetta ad IVA ai sensi dell\'art. 7-ter del DPR 633/72.',
      privExtraUeSepties: 'Operazione non soggetta ad IVA ai sensi dell\'art. 7-septies del DPR 633/72.',
    },
  },
  fatturaPa: { codiciNaturaIva: { forfettario: 'N2.2', invertContabile: 'N2.1', nonSoggetta: 'N2.1' } },
};

describe('trattamentoCliente', () => {
  test('cliente IT → estero false, N2.2, no intrastat', () => {
    const t = trattamentoCliente({ paese: 'IT', tipo: 'azienda' }, REGOLE);
    assert.equal(t.estero, false);
    assert.equal(t.natura, 'N2.2');
    assert.equal(t.intrastat, false);
  });

  test('azienda UE (DE) → N2.1, inversione contabile, intrastat true', () => {
    const t = trattamentoCliente({ paese: 'DE', tipo: 'azienda' }, REGOLE);
    assert.equal(t.estero, true);
    assert.equal(t.natura, 'N2.1');
    assert.equal(t.intrastat, true);
    assert.ok(t.causali[0].includes('7-ter'));
    assert.ok(t.causali[0].toLowerCase().includes('inversione'));
  });

  test('azienda extra-UE (US) → N2.1, no intrastat', () => {
    const t = trattamentoCliente({ paese: 'US', tipo: 'azienda' }, REGOLE);
    assert.equal(t.estero, true);
    assert.equal(t.natura, 'N2.1');
    assert.equal(t.intrastat, false);
    assert.ok(t.causali[0].includes('7-ter'));
    assert.ok(!t.causali[0].toLowerCase().includes('inversione'));
  });

  test('privato UE (FR) → N2.2, trattamento ordinario', () => {
    const t = trattamentoCliente({ paese: 'FR', tipo: 'privato' }, REGOLE);
    assert.equal(t.estero, true);
    assert.equal(t.natura, 'N2.2');
    assert.equal(t.intrastat, false);
    assert.equal(t.causali, null);
  });

  test('privato extra-UE con art.7-septies → N2.1', () => {
    const t = trattamentoCliente({ paese: 'US', tipo: 'privato', servizi7Septies: true }, REGOLE);
    assert.equal(t.natura, 'N2.1');
    assert.ok(t.causali[0].includes('7-septies'));
  });

  test('privato extra-UE senza art.7-septies → N2.2', () => {
    const t = trattamentoCliente({ paese: 'US', tipo: 'privato', servizi7Septies: false }, REGOLE);
    assert.equal(t.natura, 'N2.2');
    assert.equal(t.causali, null);
  });

  test('paese lowercase normalizzato', () => {
    const t = trattamentoCliente({ paese: 'de', tipo: 'azienda' }, REGOLE);
    assert.equal(t.natura, 'N2.1');
    assert.equal(t.intrastat, true);
  });

  test('paese mancante → trattato come IT', () => {
    const t = trattamentoCliente({ tipo: 'azienda' }, REGOLE);
    assert.equal(t.estero, false);
    assert.equal(t.natura, 'N2.2');
  });
});

describe('scadenzaEmissioneRinviata', () => {
  test('B2B UE → true', () => {
    const t = trattamentoCliente({ paese: 'DE', tipo: 'azienda' }, REGOLE);
    assert.equal(scadenzaEmissioneRinviata(t), true);
  });
  test('IT → false', () => {
    const t = trattamentoCliente({ paese: 'IT', tipo: 'azienda' }, REGOLE);
    assert.equal(scadenzaEmissioneRinviata(t), false);
  });
  test('privato UE → false', () => {
    const t = trattamentoCliente({ paese: 'FR', tipo: 'privato' }, REGOLE);
    assert.equal(scadenzaEmissioneRinviata(t), false);
  });
});
