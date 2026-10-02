// Trattamento IVA per clienti esteri (UE e extra-UE).
// Fonti: DPR 633/72 art. 7-ter (prestazioni B2B), art. 7-septies (prestazioni a privati extra-UE),
// art. 21 c. 4 (termine emissione entro il 15 del mese successivo).
//
// Regole applicate (regime forfettario, libero professionista):
//   - B2B UE (azienda UE):       N2.1 + dicitura inversione contabile + Intrastat trimestrale
//   - B2B extra-UE (azienda):    N2.1 + dicitura non soggetta
//   - B2C UE (privato UE):       N2.2 (come IT, trattamento ordinario forfettario)
//   - B2C extra-UE + art.7sep.:  N2.1 + dicitura non soggetta (solo se servizi7Septies = true)
//   - B2C extra-UE senza 7sep.:  N2.2 (ordinario forfettario)
//   - IT:                        N2.2 (invariato)
//
// Fuori scope: servizi elettronici a privati UE (OSS, art. 7-octies).

/**
 * @param {object} cliente - dati cliente da config (paese, tipo, servizi7Septies)
 * @param {object} regole  - pacchetto regole anno da regoleFiscaliService.regoleAnno()
 * @returns {{ estero: boolean, natura: string, causali: string[], intrastat: boolean }}
 */
export function trattamentoCliente(cliente, regole) {
  const paese = (cliente.paese ?? 'IT').toUpperCase();
  const tipo = cliente.tipo ?? 'azienda';
  const servizi7Septies = cliente.servizi7Septies ?? false;

  const paesiUe = regole.clientiEsteri?.paesiUe ?? [];
  const diciture = regole.clientiEsteri?.diciture ?? {};
  const causulaForFettario = regole.fatturaPa?.causulaForFettario;

  // Cliente italiano: trattamento standard forfettario, nessuna modifica
  if (paese === 'IT') {
    return { estero: false, natura: 'N2.2', causali: null, intrastat: false };
  }

  const isUe = paesiUe.includes(paese);
  const isAzienda = tipo === 'azienda';

  if (isAzienda) {
    // B2B UE: inversione contabile (art. 7-ter), Intrastat obbligatorio
    if (isUe) {
      return {
        estero: true,
        natura: 'N2.1',
        causali: [diciture.azAziendaUe],
        intrastat: true,
      };
    }
    // B2B extra-UE: non soggetta (art. 7-ter)
    return {
      estero: true,
      natura: 'N2.1',
      causali: [diciture.azAziendaExtraUe],
      intrastat: false,
    };
  }

  // B2C UE: trattamento ordinario forfettario (art. 7-ter non si applica ai privati)
  if (isUe) {
    return { estero: true, natura: 'N2.2', causali: null, intrastat: false };
  }

  // B2C extra-UE con servizi art. 7-septies (consulenza, elaborazione dati, ecc.)
  if (servizi7Septies) {
    return {
      estero: true,
      natura: 'N2.1',
      causali: [diciture.privExtraUeSepties],
      intrastat: false,
    };
  }

  // B2C extra-UE senza art. 7-septies: trattamento ordinario forfettario
  return { estero: true, natura: 'N2.2', causali: null, intrastat: false };
}

/**
 * Restituisce true se la fattura al cliente estero deve essere emessa entro il 15
 * del mese successivo (DPR 633/72 art. 21 c. 4 lett. b): si applica a B2B UE e B2B extra-UE.
 */
export function scadenzaEmissioneRinviata(trattamento) {
  return trattamento.estero && trattamento.natura === 'N2.1';
}
