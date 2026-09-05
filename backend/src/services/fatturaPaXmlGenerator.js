// Generazione XML FatturaPA v1.2.2 per Regime Forfettario (Flat Tax).
// Segue esattamente lo schema del template Templates/IT11111111111_00008.xml:
// - RegimeFiscale RF19
// - Natura IVA N2.2 (operazioni non soggette, regime forfettario)
// - DatiBollo con BolloVirtuale/ImportoBollo se l'importo totale supera la soglia
// - Nessuna rivalsa INPS, nessuna ritenuta d'acconto

// Escapa i caratteri speciali XML per evitare di produrre un documento non valido.
function escapeXml(testo) {
  return String(testo ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formattaImporto(numero) {
  return Number(numero).toFixed(2);
}

/**
 * Genera l'XML FatturaPA come stringa UTF-8.
 * @param {object} dati - { fornitore, cliente, fattura: { numero, data, descrizione, oreTotali,
 *   tariffaOraria, imponibile, bollo, bolloApplicabile, progressivoInvio } }
 */
export function generaXmlFatturaPA(dati) {
  const { fornitore, cliente, fattura } = dati;

  const datiBollo = fattura.bolloApplicabile
    ? `        <DatiBollo>
          <BolloVirtuale>SI</BolloVirtuale>
          <ImportoBollo>${formattaImporto(fattura.bollo)}</ImportoBollo>
        </DatiBollo>\n`
    : '';

  // Il bollo (se dovuto) è dichiarato in DatiBollo/Causale ma non sommato al totale
  // documento: resta a carico del professionista, non riaddebitato al cliente.
  const importoTotale = fattura.imponibile;

  // Fattura manuale (importo libero, senza timesheet): riga unica quantità 1.
  const quantita = fattura.oreTotali ?? 1;
  const prezzoUnitario = fattura.tariffaOraria ?? fattura.imponibile;

  return `<?xml version="1.0" encoding="UTF-8"?>
<ns2:FatturaElettronica xmlns:ns2="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2" versione="FPR12">
  <FatturaElettronicaHeader>
    <DatiTrasmissione>
      <IdTrasmittente>
        <IdPaese>IT</IdPaese>
        <IdCodice>${escapeXml(fornitore.codiceFiscale)}</IdCodice>
      </IdTrasmittente>
      <ProgressivoInvio>${escapeXml(fattura.progressivoInvio)}</ProgressivoInvio>
      <FormatoTrasmissione>FPR12</FormatoTrasmissione>
      <CodiceDestinatario>${escapeXml(cliente.codiceDestinatarioSdi)}</CodiceDestinatario>
    </DatiTrasmissione>
    <CedentePrestatore>
      <DatiAnagrafici>
        <IdFiscaleIVA>
          <IdPaese>IT</IdPaese>
          <IdCodice>${escapeXml(fornitore.partitaIva)}</IdCodice>
        </IdFiscaleIVA>
        <CodiceFiscale>${escapeXml(fornitore.codiceFiscale)}</CodiceFiscale>
        <Anagrafica>
          <Denominazione>${escapeXml(fornitore.denominazione)}</Denominazione>
        </Anagrafica>
        <RegimeFiscale>RF19</RegimeFiscale>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>${escapeXml(fornitore.indirizzo)}</Indirizzo>
        <NumeroCivico>${escapeXml(fornitore.numeroCivico)}</NumeroCivico>
        <CAP>${escapeXml(fornitore.cap)}</CAP>
        <Comune>${escapeXml(fornitore.comune)}</Comune>
        <Provincia>${escapeXml(fornitore.provincia)}</Provincia>
        <Nazione>IT</Nazione>
      </Sede>
    </CedentePrestatore>
    <CessionarioCommittente>
      <DatiAnagrafici>
        <IdFiscaleIVA>
          <IdPaese>IT</IdPaese>
          <IdCodice>${escapeXml(cliente.partitaIva)}</IdCodice>
        </IdFiscaleIVA>
        <CodiceFiscale>${escapeXml(cliente.partitaIva)}</CodiceFiscale>
        <Anagrafica>
          <Denominazione>${escapeXml(cliente.denominazione)}</Denominazione>
        </Anagrafica>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>${escapeXml(cliente.indirizzo)}</Indirizzo>
        <CAP>${escapeXml(cliente.cap)}</CAP>
        <Comune>${escapeXml(cliente.comune)}</Comune>
        <Provincia>${escapeXml(cliente.provincia)}</Provincia>
        <Nazione>IT</Nazione>
      </Sede>
    </CessionarioCommittente>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento>
        <TipoDocumento>TD01</TipoDocumento>
        <Divisa>EUR</Divisa>
        <Data>${escapeXml(fattura.data)}</Data>
        <Numero>${escapeXml(fattura.numero)}</Numero>
${datiBollo}        <ImportoTotaleDocumento>${formattaImporto(importoTotale)}</ImportoTotaleDocumento>
        <Causale>Operazione senza applicazione dell'IVA ai sensi dell'art.1, comma 58, Legge 190/2014, regime forfetario.</Causale>
        <Causale>Operazione senza applicazione della ritenuta alla fonte a titolo di acconto ai sensi dell'art.1, comma 67, Legge 190/2014.</Causale>${fattura.bolloApplicabile ? `
        <Causale>Imposta di bollo assolta in modo virtuale ai sensi dell'articolo 15 del d.p.r. 642/1972 e del DM 17/06/2014.</Causale>` : ''}
      </DatiGeneraliDocumento>
    </DatiGenerali>
    <DatiBeniServizi>
      <DettaglioLinee>
        <NumeroLinea>1</NumeroLinea>
        <Descrizione>${escapeXml(fattura.descrizione)}</Descrizione>
        <Quantita>${formattaImporto(quantita)}</Quantita>
        <PrezzoUnitario>${formattaImporto(prezzoUnitario)}</PrezzoUnitario>
        <PrezzoTotale>${formattaImporto(fattura.imponibile)}</PrezzoTotale>
        <AliquotaIVA>0.00</AliquotaIVA>
        <Natura>N2.2</Natura>
      </DettaglioLinee>
      <DatiRiepilogo>
        <AliquotaIVA>0.00</AliquotaIVA>
        <Natura>N2.2</Natura>
        <ImponibileImporto>${formattaImporto(fattura.imponibile)}</ImponibileImporto>
        <Imposta>0.00</Imposta>
      </DatiRiepilogo>
    </DatiBeniServizi>
  </FatturaElettronicaBody>
</ns2:FatturaElettronica>
`;
}

// Nome file conforme allo standard: IT<P.IVA>_<PROGRESSIVO>.xml. Il progressivo è
// alfanumerico libero (spec FatturaPA, max 10 caratteri) — non un numero a lunghezza fissa.
export function generaNomeFileXml(fornitore, progressivo) {
  return `IT${fornitore.partitaIva}_${progressivo}.xml`;
}
