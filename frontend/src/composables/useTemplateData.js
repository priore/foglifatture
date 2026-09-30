// Appiattisce i dati di dominio (fattura/timesheet) nel formato piatto e già formattato
// che i template Handlebars si aspettano (niente logica dentro layout.html).
import qrcode from 'qrcode-generator';
import { STATI_ASSENZA, calcolaOreGiorno, calcolaTotaleMensile } from './useTimeCalculator.js';

function formattaEuro(numero) {
  return numero.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formattaData(isoDate) {
  const [anno, mese, giorno] = isoDate.split('-');
  return `${giorno}/${mese}/${anno}`;
}

const ETICHETTE_MODALITA = { MP01: 'Contanti', MP02: 'Assegno', MP05: 'Bonifico', MP08: 'Carta di pagamento', MP19: 'Addebito diretto SEPA', BTC: 'Bitcoin' };

// Stesso criterio di backend/src/lib/pagamento.js, per l'anteprima di una fattura non ancora generata.
export function pagamentoDaConfig(config, cliente) {
  const f = config.fatturazione;
  const modalita = cliente.modalitaPagamento || f.modalitaDefault;
  const btcAddress = (modalita === 'BTC' || cliente.pagamentoBtc) ? (config.walletBtc?.[0]?.indirizzo ?? '') : '';
  if (!f.iban && !btcAddress) return null;
  return {
    modalita, iban: f.iban, intestatario: f.intestatario, btcAddress,
    giorniScadenza: Number.isFinite(cliente.giorniScadenza) ? cliente.giorniScadenza : f.giorniScadenzaDefault,
  };
}

function aggiungiGiorni(isoDate, giorni) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + Number(giorni));
  return d.toISOString().slice(0, 10);
}

function qrSvg(testo) {
  const qr = qrcode(0, 'M');
  qr.addData(testo);
  qr.make();
  return qr.createSvgTag({ scalable: true, margin: 0 });
}

// Riquadro "Dati per il pagamento" del PDF: IBAN e/o indirizzo BTC, più un QR per la modalità scelta
// (BTC: URI bitcoin:; bonifico/SEPA: EPC QR standard europeo, letto dalle app bancarie).
function preparaPagamento(p, props) {
  if (!p) return null;
  const mostraIban = Boolean(p.iban) && ['MP05', 'MP19'].includes(p.modalita);
  const ibanPulito = String(p.iban ?? '').replace(/\s+/g, '').toUpperCase();
  let qr = '';
  let qrEtichetta = '';
  if (p.modalita === 'BTC' && p.btcAddress) {
    qr = qrSvg(`bitcoin:${p.btcAddress}`);
    qrEtichetta = 'Paga in Bitcoin';
  } else if (mostraIban) {
    const nome = (p.intestatario || props.fornitore.denominazione).slice(0, 70);
    qr = qrSvg(['BCD', '002', '1', 'SCT', '', nome, ibanPulito, `EUR${Number(props.nettoAPagare).toFixed(2)}`, '', '', `Fattura ${props.numero}`].join('\n'));
    qrEtichetta = 'Paga con bonifico';
  }
  const scadenza = props.dataScadenzaPagamento ?? aggiungiGiorni(props.data, p.giorniScadenza);
  return {
    modalitaEtichetta: ETICHETTE_MODALITA[p.modalita] ?? p.modalita,
    mostraIban, ibanFormattato: ibanPulito.replace(/(.{4})/g, '$1 ').trim(),
    intestatario: p.intestatario,
    btcAddress: p.btcAddress,
    scadenzaFormattata: formattaData(scadenza),
    qrSvg: qr, qrEtichetta,
  };
}

export function preparaDatiFattura(props) {
  return {
    ...props,
    pagamento: preparaPagamento(props.pagamento, props),
    dataFormattata: formattaData(props.data),
    imponibileFormattato: formattaEuro(props.imponibile),
    nettoAPagareFormattato: formattaEuro(props.nettoAPagare),
  };
}

const NOMI_MESI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

function isWeekend(nomeGiorno) {
  return nomeGiorno === 'Sabato' || nomeGiorno === 'Domenica';
}

function formattaOre(oreDecimali) {
  return oreDecimali.toFixed(2).replace('.', ',');
}

export function preparaDatiTimesheet(props) {
  const totaleOre = calcolaTotaleMensile(props.giorni);
  const giorniLavorati = props.giorni.filter((g) => calcolaOreGiorno(g) > 0).length;

  const conteggio = Object.fromEntries(STATI_ASSENZA.map((s) => [s, 0]));
  for (const g of props.giorni) if (g.stato in conteggio) conteggio[g.stato] += 1;
  const totaleAssenze = Object.values(conteggio).reduce((s, n) => s + n, 0);

  return {
    ...props,
    nomeMese: NOMI_MESI[props.mese - 1],
    giorni: props.giorni.map((g) => ({
      ...g,
      wknd: isWeekend(g.nomeGiorno),
      oreGiornoFormattate: calcolaOreGiorno(g) > 0 ? formattaOre(calcolaOreGiorno(g)) : '',
      assenzaVisibile: Boolean(g.stato) && !isWeekend(g.nomeGiorno),
    })),
    totaleOreFormattato: formattaOre(totaleOre),
    giorniLavorati,
    totaleAssenze,
    conteggioAssenze: STATI_ASSENZA.filter((s) => s !== 'Lavoro').map((stato) => ({ stato, conteggio: conteggio[stato] })),
  };
}
