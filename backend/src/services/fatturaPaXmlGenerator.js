// Generazione XML FatturaPA v1.2.2 per Regime Forfettario (Flat Tax).
// Segue esattamente lo schema del template Templates/IT11111111111_00008.xml:
// - RegimeFiscale RF19
// - Natura IVA N2.2 (ordinario forfettario) o N2.1 (clienti esteri B2B)
// - CessionarioCommittente adattato per clienti esteri (IdPaese/Nazione, CodiceDestinatario XXXXXXX, CAP 00000)
// - DatiBollo con BolloVirtuale/ImportoBollo se l'importo totale supera la soglia
// - DatiCassaPrevidenziale TC22 (rivalsa INPS 4%) se fattura.rivalsaInps > 0
// - Nessuna ritenuta d'acconto

// Escapa i caratteri speciali XML per evitare di produrre un documento non valido.
function escapeXml(testo) {
  return String(testo ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Modalità di pagamento (specifiche FatturaPA) che riportano l'IBAN nel DettaglioPagamento.
const MODALITA_CON_IBAN = new Set(['MP05', 'MP19']);

function aggiungiGiorni(dataIso, giorni) {
  const d = new Date(`${dataIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + Number(giorni));
  return d.toISOString().slice(0, 10);
}

// DatiPagamento solo se la fattura ha il blocco `pagamento` congelato alla generazione:
// fatture senza (config senza IBAN, o generate prima di questa funzione) restano identiche.
function datiPagamentoXml(fattura) {
  const p = fattura.pagamento;
  if (!p || p.modalita === 'BTC' || (MODALITA_CON_IBAN.has(p.modalita) && !p.iban)) return '';
  const scadenza = fattura.dataScadenzaPagamento ?? aggiungiGiorni(fattura.data, p.giorniScadenza);
  const righe = [
    p.intestatario ? `<Beneficiario>${escapeXml(p.intestatario)}</Beneficiario>` : '',
    `<ModalitaPagamento>${escapeXml(p.modalita)}</ModalitaPagamento>`,
    `<DataScadenzaPagamento>${escapeXml(scadenza)}</DataScadenzaPagamento>`,
    `<ImportoPagamento>${formattaImporto(fattura.imponibile)}</ImportoPagamento>`,
    MODALITA_CON_IBAN.has(p.modalita) && p.istitutoFinanziario ? `<IstitutoFinanziario>${escapeXml(p.istitutoFinanziario)}</IstitutoFinanziario>` : '',
    MODALITA_CON_IBAN.has(p.modalita) ? `<IBAN>${escapeXml(p.iban)}</IBAN>` : '',
  ].filter(Boolean).map((r) => `        ${r}`).join('\n');
  return `    <DatiPagamento>
      <CondizioniPagamento>TP02</CondizioniPagamento>
      <DettaglioPagamento>
${righe}
      </DettaglioPagamento>
    </DatiPagamento>\n`;
}

function formattaImporto(numero) {
  return Number(numero).toFixed(2);
}

/**
 * Genera l'XML FatturaPA come stringa UTF-8.
 * @param {object} dati - { fornitore, cliente, fattura: { numero, data, descrizione, oreTotali,
 *   tariffaOraria, imponibile, bollo, bolloApplicabile, progressivoInvio, trattamentoEstero } }
 *   trattamentoEstero: congelato al momento di "Genera fattura" da clienteEsteroService.trattamentoCliente()
 */
export function generaXmlFatturaPA(dati) {
  const { fornitore, cliente, fattura } = dati;

  // trattamentoEstero congelato nella fattura: determina Natura IVA, diciture e dati anagrafici esteri.
  // null/assente = cliente IT, trattamento ordinario forfettario.
  const trattamento = fattura.trattamentoEstero ?? null;
  const estero = trattamento?.estero ?? false;
  const natura = trattamento?.natura ?? 'N2.2';
  const causaliEstere = trattamento?.causali ?? null; // array di stringhe o null

  // Per clienti esteri: CodiceDestinatario XXXXXXX, CAP 00000, no Provincia, IdPaese del cliente
  const paeseCliente = estero ? (cliente.paese ?? 'IT').toUpperCase() : 'IT';
  const codiceDestinatario = estero ? 'XXXXXXX' : escapeXml(cliente.codiceDestinatarioSdi);
  const capCliente = estero ? '00000' : escapeXml(cliente.cap);
  const provinciaCliente = estero ? '' : `\n        <Provincia>${escapeXml(cliente.provincia)}</Provincia>`;

  // Aziende UE: AltriDatiGestionali INVCONT su ogni riga (guida AdE alla compilazione)
  const altriDatiInvCont = (estero && trattamento?.intrastat)
    ? `        <AltriDatiGestionali>
          <TipoDato>INVCONT</TipoDato>
          <RiferimentoTesto>Inversione contabile</RiferimentoTesto>
        </AltriDatiGestionali>\n`
    : '';

  // Letto da fattura (congelato al momento di "Genera fattura" in invoiceRoutes.js),
  // mai da cliente: la clausola BTC è pattuita all'emissione e non deve cambiare
  // retroattivamente se il flag cliente viene modificato dopo (vedi PAGAMENTI_BTC.md, F3).
  const causaleBtc = fattura.pagamentoBtc && fattura.causaleBtc
    ? `\n        <Causale>${escapeXml(fattura.causaleBtc)}</Causale>`
    : '';

  // Causali aggiuntive per clienti esteri (dicitura normativa), precedono la causale bollo e BTC
  const causaliEstereXml = causaliEstere?.length
    ? causaliEstere.map((c) => `\n        <Causale>${escapeXml(c)}</Causale>`).join('')
    : '';

  const datiBollo = fattura.bolloApplicabile
    ? `        <DatiBollo>
          <BolloVirtuale>SI</BolloVirtuale>
          <ImportoBollo>${formattaImporto(fattura.bollo)}</ImportoBollo>
        </DatiBollo>\n`
    : '';

  // La rivalsa INPS (se > 0) è addebitata al cliente (L. 662/96 c. 212) e va nel totale.
  // Il bollo resta a carico del professionista: non sommato al totale.
  const rivalsaInps = fattura.rivalsaInps ?? 0;
  const importoTotale = Number((fattura.imponibile + rivalsaInps).toFixed(2));

  const datiCassaPrevidenzialeXml = rivalsaInps > 0
    ? `        <DatiCassaPrevidenziale>
          <TipoCassa>TC22</TipoCassa>
          <AlCassa>4.00</AlCassa>
          <ImportoContributoCassa>${formattaImporto(rivalsaInps)}</ImportoContributoCassa>
          <ImponibileCassa>${formattaImporto(fattura.imponibile)}</ImponibileCassa>
          <AliquotaIVA>0.00</AliquotaIVA>
          <Natura>${escapeXml(natura)}</Natura>
        </DatiCassaPrevidenziale>\n`
    : '';

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
      <CodiceDestinatario>${codiceDestinatario}</CodiceDestinatario>
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
          <IdPaese>${escapeXml(paeseCliente)}</IdPaese>
          <IdCodice>${escapeXml(cliente.partitaIva)}</IdCodice>
        </IdFiscaleIVA>${estero ? '' : `
        <CodiceFiscale>${escapeXml(cliente.partitaIva)}</CodiceFiscale>`}
        <Anagrafica>
          <Denominazione>${escapeXml(cliente.denominazione)}</Denominazione>
        </Anagrafica>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>${escapeXml(cliente.indirizzo)}</Indirizzo>
        <CAP>${capCliente}</CAP>
        <Comune>${escapeXml(cliente.comune)}</Comune>${provinciaCliente}
        <Nazione>${escapeXml(paeseCliente)}</Nazione>
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
${datiBollo}${datiCassaPrevidenzialeXml}        <ImportoTotaleDocumento>${formattaImporto(importoTotale)}</ImportoTotaleDocumento>
        <Causale>Operazione senza applicazione dell'IVA ai sensi dell'art.1, comma 58, Legge 190/2014, regime forfetario.</Causale>
        <Causale>Operazione senza applicazione della ritenuta alla fonte a titolo di acconto ai sensi dell'art.1, comma 67, Legge 190/2014.</Causale>${fattura.bolloApplicabile ? `
        <Causale>Imposta di bollo assolta in modo virtuale ai sensi dell'articolo 15 del d.p.r. 642/1972 e del DM 17/06/2014.</Causale>` : ''}${causaliEstereXml}${causaleBtc}
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
        <Natura>${escapeXml(natura)}</Natura>
${altriDatiInvCont}      </DettaglioLinee>
      <DatiRiepilogo>
        <AliquotaIVA>0.00</AliquotaIVA>
        <Natura>${escapeXml(natura)}</Natura>
        <ImponibileImporto>${formattaImporto(fattura.imponibile)}</ImponibileImporto>
        <Imposta>0.00</Imposta>
      </DatiRiepilogo>
    </DatiBeniServizi>
${datiPagamentoXml(fattura)}  </FatturaElettronicaBody>
</ns2:FatturaElettronica>
`;
}

// Nome file conforme allo standard: IT<P.IVA>_<PROGRESSIVO>.xml. Il progressivo è
// alfanumerico libero (spec FatturaPA, max 10 caratteri) — non un numero a lunghezza fissa.
export function generaNomeFileXml(fornitore, progressivo) {
  return `IT${fornitore.partitaIva}_${progressivo}.xml`;
}
