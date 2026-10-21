<script setup>
// Schermata Fattura Pro-Forma: calcolo automatico da timesheet, generazione XML FatturaPA,
// invio PEC. Il calcolo compenso è ricavato dal backend (unica fonte di verità sui totali).
import { ref, computed, watch, onMounted } from 'vue';
import { clienteAttivoId } from '../composables/useClienteAttivo.js';
import MonthSwitcher from '../components/common/MonthSwitcher.vue';
import ClienteSwitcher from '../components/common/ClienteSwitcher.vue';
import TemplateStampa from '../components/common/TemplateStampa.vue';
import { api } from '../services/api.js';
import { caricaQuota, daAccantonare } from '../composables/useAccantonamento.js';
import { esportaPdf, generaPdfBlob } from '../composables/usePdfExport.js';
import { inviaPdfEmail } from '../composables/useMailto.js';
import { preparaDatiFattura, pagamentoDaConfig } from '../composables/useTemplateData.js';

const oggi = new Date();
const anno = ref(oggi.getFullYear());
const mese = ref(oggi.getMonth() + 1);
const config = ref(null);
const valuteLista = ref([]);
const clienteId = ref(null);
const anteprima = ref(null);
const fatturaGenerata = ref(null);
const anteprimaRef = ref(null);
const inviandoPec = ref(false);
const esitoPec = ref('');
const importoNota = ref('');
// Il GET fattura non arricchisce lo stato pagamento: quanto già incassato oltre il dovuto dopo la nota.
const daRimborsareNota = computed(() => {
  const f = fatturaGenerata.value;
  if (!f?.notaCredito) return 0;
  const pagato = (f.pagamenti ?? []).reduce((t, p) => t + p.importo, 0);
  return Math.max(0, Number((pagato - (f.nettoAPagare - f.notaCredito.nettoAPagare)).toFixed(2)));
});
const lavorandoNota = ref(false);
const esitoNota = ref('');
const meseMinimo = ref(null);
const controllandoSdi = ref(false);
const esitoSdi = ref('');
const ricevuteSdi = ref([]);
const inviandoEmail = ref(false);
const esitoEmail = ref('');

// Fattura manuale: importo e dicitura liberi, nessun calcolo da timesheet.
const modoManuale = ref(false);
const importoManuale = ref(0);
const descrizioneManuale = ref('');
const previsioneManuale = ref(null);
let _previsioneDebounce = null;
const dataFattura = ref('');
const dataScadenzaPagamento = ref('');
const salvandoScadenza = ref(false);

const importoValido = computed(() => Number.isFinite(Number(importoManuale.value)) && Number(importoManuale.value) > 0);

function dataDefault() {
  return `${anno.value}-${String(mese.value).padStart(2, '0')}-28`;
}

const clientiAttivi = computed(() => config.value?.clienti.filter(c => c.attivo) ?? []);
const clienteCorrente = computed(() => clientiAttivi.value.find(c => c.id === clienteId.value) ?? null);
const soloFatture = computed(() => clienteCorrente.value?.gestione === 'fatture');
// Cliente "solo fatture": nessun calcolo da timesheet, importo sempre libero.
watch(soloFatture, (v) => { if (v) modoManuale.value = true; }, { immediate: true });

// Fatture storiche importate da XML possono avere una descrizione salvata senza il
// totale ore (fedele al documento originale emesso): a video, solo per leggibilità,
// si integra il dato ore preso da oreTotali se non già menzionato nel testo.
const descrizioneVisualizzata = computed(() => {
  if (modoManuale.value) return descrizioneManuale.value;
  const descrizioneSalvata = fatturaGenerata.value?.descrizione;
  const oreTotali = fatturaGenerata.value?.oreTotali ?? anteprima.value?.totaleOre;
  if (descrizioneSalvata) {
    if (/ore/i.test(descrizioneSalvata) || oreTotali == null) return descrizioneSalvata;
    return `${descrizioneSalvata} per un totale di ${oreTotali.toFixed(2)} ore mensili.`;
  }
  return `Servizi di Informatica prestati per vs. Azienda conto terzi per un totale di ${(anteprima.value?.totaleOre ?? 0).toFixed(2)} ore mensili.`;
});

const anteprimaEffettiva = computed(() => {
  // Fattura già salvata (generata o importata da XML): mostra i valori congelati,
  // non ricalcolare dal timesheet corrente — che per un mese storico può essere vuoto.
  if (fatturaGenerata.value) return fatturaGenerata.value;
  if (!modoManuale.value) return anteprima.value;
  if (!config.value) return null;
  const imponibile = Number((Number(importoManuale.value) || 0).toFixed(2));
  const bolloApplicabile = imponibile > config.value.fatturazione.sogliaBolloVirtuale;
  const bollo = bolloApplicabile ? config.value.fatturazione.importoBollo : 0;
  const rivalsaAttiva = clienteCorrente.value?.rivalsaInps !== null && clienteCorrente.value?.rivalsaInps !== undefined
    ? Boolean(clienteCorrente.value.rivalsaInps)
    : Boolean(config.value.forfettario?.rivalsaInps);
  const rivalsaInps = rivalsaAttiva ? Number((imponibile * 0.04).toFixed(2)) : 0;
  return { imponibile, bolloApplicabile, bollo, rivalsaInps, nettoAPagare: Number((imponibile + rivalsaInps).toFixed(2)) };
});

const templateIdFattura = computed(() => clienteCorrente.value?.templateFatturaId || 'fattura-default');
const datiFattura = computed(() => {
  if (!config.value || !clienteCorrente.value || !anteprimaEffettiva.value) return null;
  return preparaDatiFattura({
    fornitore: config.value.fornitore,
    cliente: clienteCorrente.value,
    numero: fatturaGenerata.value?.numero ?? '—',
    data: fatturaGenerata.value?.data ?? dataFattura.value,
    descrizione: descrizioneVisualizzata.value,
    imponibile: anteprimaEffettiva.value.imponibile,
    bollo: anteprimaEffettiva.value.bollo,
    rivalsaInps: anteprimaEffettiva.value.rivalsaInps ?? 0,
    bolloApplicabile: anteprimaEffettiva.value.bolloApplicabile,
    nettoAPagare: anteprimaEffettiva.value.nettoAPagare,
    // Se già generata, usa i valori congelati in fattura (immutabili dopo l'emissione,
    // vedi PAGAMENTI_BTC.md F3): altrimenti mostra un'anteprima dal cliente corrente.
    pagamentoBtc: fatturaGenerata.value?.pagamentoBtc ?? clienteCorrente.value.pagamentoBtc,
    causaleBtc: fatturaGenerata.value?.causaleBtc ?? clienteCorrente.value.causaleBtc,
    pagamento: fatturaGenerata.value ? (fatturaGenerata.value.pagamento ?? null) : pagamentoDaConfig(config.value, clienteCorrente.value),
    dataScadenzaPagamento: fatturaGenerata.value?.dataScadenzaPagamento ?? null,
  });
});

async function caricaAnteprima() {
  if (!clienteId.value) return;
  anteprima.value = await api.anteprimaFattura(anno.value, mese.value, clienteId.value);
  fatturaGenerata.value = await api.getFattura(anno.value, mese.value, clienteId.value);
  dataFattura.value = fatturaGenerata.value?.data ?? dataDefault();
  dataScadenzaPagamento.value = fatturaGenerata.value?.dataScadenzaPagamento ?? '';
  await caricaRicevuteSdi();
}

async function caricaRicevuteSdi() {
  ricevuteSdi.value = fatturaGenerata.value ? await api.ricevuteSdiFattura(anno.value, mese.value, clienteId.value) : [];
}

async function aggiornaMeseMinimo() {
  const [mesiTimesheet, mesiFatture] = await Promise.all([api.listMesiTimesheet(), api.listMesiFatturati()]);
  const chiavi = [...mesiTimesheet, ...mesiFatture]
    .filter(m => m.clienteId === clienteId.value)
    .map(m => m.chiave.slice(0, 7));
  meseMinimo.value = chiavi.length ? chiavi.sort()[0] : null;
}

// Valuta fattura: codice ISO (es. USD) e cambio Banca d'Italia da congelare alla generazione.
const valutaFatturaCodice = ref('');
const valutaFatturaCambio = ref(null);
const valutaFatturaFonte = ref('');
const valutaFatturaDataQuotazione = ref('');
const caricandoCambioFattura = ref(false);
const erroreCambioFattura = ref('');

async function recuperaCambioFattura() {
  const codice = valutaFatturaCodice.value.toUpperCase();
  if (!codice || codice === 'EUR') return;
  const data = dataFattura.value || new Date().toISOString().slice(0, 10);
  caricandoCambioFattura.value = true;
  erroreCambioFattura.value = '';
  try {
    const risultato = await api.cambioValuta(data, codice);
    valutaFatturaCambio.value = risultato.cambio;
    valutaFatturaFonte.value = risultato.fonte;
    valutaFatturaDataQuotazione.value = risultato.data;
  } catch (err) {
    erroreCambioFattura.value = err.message;
  } finally {
    caricandoCambioFattura.value = false;
  }
}

async function generaFattura(confermaSoglia = false) {
  const dati = modoManuale.value
    ? { importo: Number(importoManuale.value), descrizione: descrizioneManuale.value, data: dataFattura.value }
    : { data: dataFattura.value };
  if (confermaSoglia) dati.confermaSoglia = true;
  const codice = valutaFatturaCodice.value.toUpperCase();
  if (codice && codice !== 'EUR' && valutaFatturaCambio.value > 0) {
    dati.valutaCodice = codice;
    dati.valutaCambio = valutaFatturaCambio.value;
    dati.valutaFonte = valutaFatturaFonte.value;
    dati.valutaDataQuotazione = valutaFatturaDataQuotazione.value;
  }
  try {
    fatturaGenerata.value = await api.generaFattura(anno.value, mese.value, clienteId.value, dati);
    dataFattura.value = fatturaGenerata.value?.data ?? dataFattura.value;
    await caricaRicevuteSdi();
  } catch (err) {
    if (err.tipo === 'soglia100' || err.tipo === 'soglia85') {
      if (window.confirm(err.message)) await generaFattura(true);
    } else {
      throw err;
    }
  }
}

async function salvaScadenzaPagamento() {
  salvandoScadenza.value = true;
  try {
    fatturaGenerata.value = await api.impostaScadenzaPagamento(anno.value, mese.value, clienteId.value, dataScadenzaPagamento.value || null);
  } finally {
    salvandoScadenza.value = false;
  }
}

function formattaEuro(valore) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(valore ?? 0);
}

function formattaData(valore) {
  return new Date(valore).toLocaleDateString('it-IT');
}

async function eliminaPagamento(indice) {
  await api.eliminaPagamentoFattura(fatturaGenerata.value.anno, fatturaGenerata.value.mese, fatturaGenerata.value.clienteId, indice);
  fatturaGenerata.value = await api.getFattura(anno.value, mese.value, clienteId.value);
}

// Incasso in valuta estera (es. USD, GBP): importo EUR calcolato dal backend (importoValuta / cambio).
const mostraFormValuta = ref(false);
const valutaForm = ref({ codice: 'USD', importoValuta: null, cambio: null, fonte: '', dataQuotazione: '' });
const registrandoValuta = ref(false);
const erroreValuta = ref('');
const caricandoCambioValuta = ref(false);

function apriFormValuta() {
  if (motivoBtcDisabilitato.value) { avvisoModale.value = motivoBtcDisabilitato.value; return; }
  mostraFormValuta.value = true;
  valutaForm.value = { codice: 'USD', importoValuta: null, cambio: null, fonte: '', dataQuotazione: '' };
  erroreValuta.value = '';
}

async function recuperaCambioIncasso() {
  const codice = valutaForm.value.codice?.toUpperCase();
  if (!codice) return;
  const data = fatturaGenerata.value?.data || new Date().toISOString().slice(0, 10);
  caricandoCambioValuta.value = true;
  erroreValuta.value = '';
  try {
    const risultato = await api.cambioValuta(data, codice);
    valutaForm.value.cambio = risultato.cambio;
    valutaForm.value.fonte = risultato.fonte;
    valutaForm.value.dataQuotazione = risultato.data;
  } catch (err) {
    erroreValuta.value = err.message;
  } finally {
    caricandoCambioValuta.value = false;
  }
}

async function registraPagamentoValuta() {
  registrandoValuta.value = true;
  erroreValuta.value = '';
  try {
    const risultato = await api.confermaPagamentoValutaFattura(
      fatturaGenerata.value.anno, fatturaGenerata.value.mese, fatturaGenerata.value.clienteId,
      new Date().toISOString().slice(0, 10), {
        codiceValuta: valutaForm.value.codice?.toUpperCase(),
        importoValuta: valutaForm.value.importoValuta,
        cambio: valutaForm.value.cambio,
        fonte: valutaForm.value.fonte,
        dataQuotazione: valutaForm.value.dataQuotazione,
      },
    );
    fatturaGenerata.value = risultato.fattura;
    mostraFormValuta.value = false;
  } catch (err) {
    erroreValuta.value = err.message;
  } finally {
    registrandoValuta.value = false;
  }
}

// Incasso in BTC (AI-Workspace/Plans/PAGAMENTI_BTC.md, F1/F4/F5): l'EUR è calcolato dal
// backend, mai inviato dal client — qui solo i dati grezzi della transazione/cambio.
const mostraFormBtc = ref(false);
const avvisoModale = ref('');
const motivoBtcDisabilitato = computed(() => {
  if (!fatturaGenerata.value) return 'Genera prima la fattura per poter registrare un incasso.';
  if (fatturaGenerata.value.residuo <= 0) return 'Fattura già saldata: nessun residuo da incassare.';
  return '';
});
const btcForm = ref({ txid: '', satoshi: null, cambioEurBtc: null, fonteCambio: '', dataOraCambio: '', indirizzoDestinatario: '' });
const registrandoBtc = ref(false);
const erroreBtc = ref('');
const erroreBtcSuIndirizzo = ref(false); // true: mostra erroreBtc sotto Indirizzo; false: sotto TXID
const indirizzoLibero = ref(false); // true: mostra input libero invece della select dei wallet configurati
const caricandoTx = ref(false);
const caricandoCambio = ref(false);

function apriFormBtc() {
  if (motivoBtcDisabilitato.value) { avvisoModale.value = motivoBtcDisabilitato.value; return; }
  mostraFormBtc.value = true;
  resetFormBtc();
}

// Ultimo indirizzo di destinazione scelto, persistito come default per la fattura
// successiva (stesso pattern di clienteAttivoId in localStorage).
function indirizzoBtcDefault() {
  const ultimo = localStorage.getItem('indirizzoBtcUltimo');
  if (ultimo && config.value?.walletBtc?.some((w) => w.indirizzo === ultimo)) return ultimo;
  return config.value?.walletBtc?.[0]?.indirizzo || '';
}

function resetFormBtc() {
  btcForm.value = { txid: '', satoshi: null, cambioEurBtc: null, fonteCambio: '', dataOraCambio: '', indirizzoDestinatario: indirizzoBtcDefault() };
  erroreBtc.value = '';
  erroreBtcSuIndirizzo.value = false;
  indirizzoLibero.value = false;
}

function applicaTx(tx, indirizzo) {
  const output = tx.vout?.find((o) => !indirizzo || o.scriptpubkey_address === indirizzo);
  if (!output) { erroreBtc.value = 'Transazione trovata, ma nessun output verso questo indirizzo'; return; }
  if (tx.status?.block_time) btcForm.value.dataOraCambio = new Date(tx.status.block_time * 1000).toISOString();
  btcForm.value.satoshi = output.value;
  btcForm.value.txid = tx.txid;
  if (!btcForm.value.indirizzoDestinatario) btcForm.value.indirizzoDestinatario = output.scriptpubkey_address;
}

// F4: legge TXID/orario/satoshi dalla blockchain pubblica invece dell'inserimento manuale.
// Con TXID già inserito, legge quella transazione. Senza TXID ma con indirizzo compilato,
// cerca l'ultima transazione ricevuta su quell'indirizzo e la propone.
// bech32 (bc1...) esclude 1, b, i, o dal corpo per evitare ambiguità di lettura — un
// indirizzo con questi caratteri è quasi sempre un errore di trascrizione (es. "O" al
// posto di "0"). Controllo lato client per un errore immediato invece di un 400 remoto.
function indirizzoBech32NonValido(indirizzo) {
  if (!/^bc1/i.test(indirizzo)) return false;
  return /[1boi]/.test(indirizzo.slice(3));
}

async function leggiDaBlockchain() {
  if (!btcForm.value.txid && !btcForm.value.indirizzoDestinatario) return;
  erroreBtcSuIndirizzo.value = !btcForm.value.txid;
  if (!btcForm.value.txid && indirizzoBech32NonValido(btcForm.value.indirizzoDestinatario)) {
    erroreBtc.value = 'Indirizzo non valido: un indirizzo bc1... non contiene 1, b, i, o (probabile errore di trascrizione)';
    return;
  }
  caricandoTx.value = true;
  erroreBtc.value = '';
  try {
    if (btcForm.value.txid) {
      const tx = await api.txBlockchain(btcForm.value.txid);
      applicaTx(tx, btcForm.value.indirizzoDestinatario);
    } else {
      const txs = await api.txPerIndirizzo(btcForm.value.indirizzoDestinatario);
      if (!txs.length) { erroreBtc.value = 'Nessuna transazione trovata su questo indirizzo'; return; }
      applicaTx(txs[0], btcForm.value.indirizzoDestinatario);
    }
  } catch (err) {
    erroreBtc.value = err.message;
  } finally {
    caricandoTx.value = false;
  }
}

// F5: cambio storico EUR/BTC da CoinGecko alla data del pagamento (resta modificabile a mano).
async function recuperaCambio() {
  if (!dataFattura.value) return;
  caricandoCambio.value = true;
  erroreBtc.value = '';
  try {
    const dati = await api.cambioStoricoBtc(dataFattura.value);
    const eur = dati.market_data?.current_price?.eur;
    if (eur) {
      btcForm.value.cambioEurBtc = eur;
      btcForm.value.fonteCambio = 'CoinGecko';
      if (!btcForm.value.dataOraCambio) btcForm.value.dataOraCambio = dataFattura.value;
    } else {
      erroreBtc.value = 'CoinGecko: nessun dato di cambio per questa data';
    }
  } catch (err) {
    erroreBtc.value = err.message;
  } finally {
    caricandoCambio.value = false;
  }
}

async function registraPagamentoBtc() {
  registrandoBtc.value = true;
  erroreBtc.value = '';
  try {
    const risultato = await api.confermaPagamentoBtcFattura(
      fatturaGenerata.value.anno, fatturaGenerata.value.mese, fatturaGenerata.value.clienteId,
      new Date().toISOString().slice(0, 10), btcForm.value,
    );
    fatturaGenerata.value = risultato.fattura;
    if (btcForm.value.indirizzoDestinatario) localStorage.setItem('indirizzoBtcUltimo', btcForm.value.indirizzoDestinatario);
    mostraFormBtc.value = false;
    resetFormBtc();
  } catch (err) {
    erroreBtc.value = err.message;
  } finally {
    registrandoBtc.value = false;
  }
}

async function scaricaXml() {
  window.open(api.urlDownloadXml(anno.value, mese.value, clienteId.value), '_blank');
}

// L'ultima ricevuta (ricevuteSdi è ordinata più recente prima) è una notifica di
// scarto: un nuovo invio è un vero REinvio, non il primo. Chiede conferma esplicita
// perché consuma comunque un nuovo ProgressivoInvio SDI.
const ultimoScarto = computed(() => ricevuteSdi.value[0]?.tipo === 'NS' ? ricevuteSdi.value[0] : null);

// Fattura accettata dallo SDI: emessa e non più modificabile per legge (Circolare
// Agenzia Entrate 13/E/2018). Stesso criterio del backend in invoiceRoutes.js.
const TIPI_ACCETTAZIONE_SDI = new Set(['RC', 'DT', 'EC']);
const fatturaAccettataSdi = computed(() =>
  fatturaGenerata.value?.importataDaStorico || TIPI_ACCETTAZIONE_SDI.has(ricevuteSdi.value[0]?.tipo)
);

async function inviaPec() {
  if (ultimoScarto.value) {
    const motivo = ultimoScarto.value.errori?.[0]?.descrizione ?? 'motivo non disponibile';
    if (!window.confirm(`La fattura è stata scartata da SDI (${motivo}).\n\nReinviare con un nuovo progressivo di trasmissione?`)) return;
  }
  inviandoPec.value = true;
  esitoPec.value = '';
  try {
    const risultato = await api.inviaPec(anno.value, mese.value, clienteId.value);
    esitoPec.value = risultato.inviato ? 'Inviata con successo' : `Errore: ${risultato.errore}`;
    await caricaRicevuteSdi();
  } catch (err) {
    esitoPec.value = `Errore: ${err.message}`;
  } finally {
    inviandoPec.value = false;
  }
}

// Nota di credito TD04: azione fiscale, sempre con conferma esplicita dell'utente.
async function emettiNotaCredito() {
  const f = fatturaGenerata.value;
  const importo = importoNota.value === '' ? null : Number(importoNota.value);
  const quanto = importo == null ? 'per l\'intero importo' : `di ${importo.toFixed(2)} €`;
  if (!window.confirm(`Emettere una nota di credito ${quanto} a storno della fattura n. ${f.numero}?\n\nOccuperà il prossimo numero della sequenza e non si può annullare.`)) return;
  lavorandoNota.value = true;
  esitoNota.value = '';
  try {
    fatturaGenerata.value = await api.emettiNotaCredito(anno.value, mese.value, clienteId.value, { importo });
  } catch (err) {
    esitoNota.value = `Errore: ${err.message}`;
  } finally {
    lavorandoNota.value = false;
  }
}

async function inviaPecNotaCredito() {
  lavorandoNota.value = true;
  esitoNota.value = '';
  try {
    const risultato = await api.inviaPecNotaCredito(anno.value, mese.value, clienteId.value);
    esitoNota.value = risultato.inviato ? 'Inviata con successo' : `Errore: ${risultato.errore}`;
    fatturaGenerata.value = await api.getFattura(anno.value, mese.value, clienteId.value);
  } catch (err) {
    esitoNota.value = `Errore: ${err.message}`;
  } finally {
    lavorandoNota.value = false;
  }
}

function inizializzaClienteId() {
  const salvato = localStorage.getItem('clienteAttivoId');
  clienteId.value = clientiAttivi.value.some(c => c.id === salvato)
    ? salvato
    : clientiAttivi.value[0]?.id ?? null;
}
watch(clienteId, (id) => { if (id) { localStorage.setItem('clienteAttivoId', id); clienteAttivoId.value = id; } });

// Previsione soglia in modo manuale: aggiorna con debounce 400ms quando cambia l'importo.
watch(importoManuale, (val) => {
  clearTimeout(_previsioneDebounce);
  if (!modoManuale.value || !Number.isFinite(Number(val)) || Number(val) <= 0) {
    previsioneManuale.value = null;
    return;
  }
  _previsioneDebounce = setTimeout(async () => {
    try {
      const r = await api.anteprimaFatturaManuale(anno.value, mese.value, clienteId.value, Number(val));
      previsioneManuale.value = r.previsione ?? null;
    } catch { previsioneManuale.value = null; }
  }, 400);
});

const previsioneSogliaCorrente = computed(() =>
  modoManuale.value ? previsioneManuale.value : anteprima.value?.previsione ?? null
);

async function controllaSdi() {
  controllandoSdi.value = true;
  esitoSdi.value = '';
  try {
    const risultato = await api.controllaRicevuteSdi();
    esitoSdi.value = risultato.errore ? `Errore: ${risultato.errore}` : `${risultato.nuove} nuovo/i documento/i`;
    await caricaRicevuteSdi();
  } catch (err) {
    esitoSdi.value = `Errore: ${err.message}`;
  } finally {
    controllandoSdi.value = false;
  }
}

async function esporta() {
  await esportaPdf(anteprimaRef.value.contentDocument().body, `fattura-${anno.value}-${String(mese.value).padStart(2, '0')}.pdf`);
}

async function inviaEmail() {
  inviandoEmail.value = true;
  esitoEmail.value = '';
  try {
    const pdfBlob = await generaPdfBlob(anteprimaRef.value.contentDocument().body);
    const nomeFile = `fattura-${anno.value}-${String(mese.value).padStart(2, '0')}.pdf`;
    const oggetto = `Fattura ${fatturaGenerata.value?.numero ?? ''} — ${String(mese.value).padStart(2, '0')}/${anno.value}`;
    const corpo = `Buongiorno,\n\nin allegato la fattura relativa al mese di ${String(mese.value).padStart(2, '0')}/${anno.value}.\n\nCordiali saluti.`;
    const emailDest = clienteCorrente.value.emailFattura || clienteCorrente.value.email;
    const risultato = await inviaPdfEmail(pdfBlob, nomeFile, emailDest, oggetto, corpo);
    esitoEmail.value = risultato.modalita === 'mail-app-mac'
      ? 'Bozza aperta in Mail con allegato pronto'
      : 'PDF salvato e rivelato nel file manager: trascinalo nella mail appena aperta';
  } catch (err) {
    esitoEmail.value = `Errore: ${err.message}`;
  } finally {
    inviandoEmail.value = false;
  }
}

watch([anno, mese, clienteId], caricaAnteprima);
onMounted(async () => {
  [config.value, valuteLista.value] = await Promise.all([api.getConfig(), api.valuteSupportate()]);
  caricaQuota(new Date().getFullYear());
  inizializzaClienteId();
  await caricaAnteprima();
  await aggiornaMeseMinimo();
});
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <h1>Fattura Pro-Forma</h1>
        <p>{{ modoManuale ? 'Importo e dicitura liberi' : 'Generata da Timesheet · Tariffa oraria configurabile in Impostazioni' }}</p>
      </div>
    </div>
    <div class="cliente-row" v-if="clientiAttivi.length">
      <ClienteSwitcher v-model="clienteId" :clienti="clientiAttivi" />
    </div>
    <div class="actions" style="margin-bottom:16px">
      <MonthSwitcher v-model:anno="anno" v-model:mese="mese" :mese-minimo="meseMinimo" />
      <button class="btn btn-blue" @click="esporta">Scarica PDF</button>
    </div>

    <div class="two-col" style="display:grid;grid-template-columns:340px 1fr;gap:24px;align-items:start" v-if="anteprima && config && clienteCorrente">
      <div>
        <div class="card" v-if="!soloFatture">
          <div class="card-head"><h2>Tipo fattura</h2></div>
          <div class="card-body" style="display:flex;gap:16px">
            <label style="display:flex;align-items:center;gap:6px"><input type="radio" :value="false" v-model="modoManuale" /> Da timesheet</label>
            <label style="display:flex;align-items:center;gap:6px"><input type="radio" :value="true" v-model="modoManuale" /> Importo libero</label>
          </div>
        </div>

        <div class="card" v-if="modoManuale">
          <div class="card-head"><h2>Importo e dicitura</h2></div>
          <div class="card-body" style="display:flex;flex-direction:column;gap:14px">
            <div class="field">
              <label>Importo (€)</label>
              <input type="number" step="0.01" min="0" v-model="importoManuale" :class="{ 'campo-non-valido': !importoValido }" />
              <small v-if="!importoValido" class="nota-errore">Deve essere un numero maggiore di zero.</small>
            </div>
            <div class="field">
              <label>Descrizione</label>
              <textarea rows="3" v-model="descrizioneManuale" placeholder="Es. Consulenza informatica mese di..." style="resize:vertical;font-family:inherit"></textarea>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h2>Calcolo compenso</h2></div>
          <div class="card-body">
            <table class="data-table">
              <tr v-if="!modoManuale"><td>Ore totali mensili</td><td style="text-align:right">{{ (fatturaGenerata?.oreTotali ?? anteprima.totaleOre).toFixed(2) }}</td></tr>
              <tr v-if="!modoManuale"><td>Tariffa oraria</td><td style="text-align:right">€ {{ (fatturaGenerata?.tariffaOraria ?? clienteCorrente.tariffaOraria).toFixed(2) }}</td></tr>
              <tr><td>Imponibile</td><td style="text-align:right">€ {{ anteprimaEffettiva.imponibile.toFixed(2) }}</td></tr>
              <tr v-if="anteprimaEffettiva.rivalsaInps > 0"><td>Rivalsa INPS 4%</td><td style="text-align:right">€ {{ anteprimaEffettiva.rivalsaInps.toFixed(2) }}</td></tr>
              <tr v-else><td>Rivalsa INPS</td><td style="text-align:right">assente</td></tr>
              <tr v-if="anteprimaEffettiva.bolloApplicabile"><td>Bollo virtuale (&gt; {{ config.fatturazione.sogliaBolloVirtuale }}€)</td><td style="text-align:right">€ {{ anteprimaEffettiva.bollo.toFixed(2) }}</td></tr>
            </table>
            <div class="stat accent" style="margin-top:14px">
              <div class="label">Netto da pagare</div>
              <div class="value">€ {{ anteprimaEffettiva.nettoAPagare.toFixed(2) }}</div>
            </div>
          </div>
        </div>

        <div class="note-legal">
          Operazione ex art.1 commi 54–89 L.190/2014 (regime forfettario).
          <span v-if="anteprimaEffettiva.bolloApplicabile">Imposta di bollo assolta in modalità virtuale ai sensi DM 17/06/2014.</span>
        </div>

        <div class="card">
          <div class="card-head"><h2>Fattura definitiva</h2></div>
          <div class="card-body" style="display:flex;flex-direction:column;gap:10px">
            <div class="field">
              <label>Data fattura</label>
              <input type="date" v-model="dataFattura" :disabled="fatturaAccettataSdi" />
            </div>
            <div class="field" v-if="fatturaGenerata">
              <label>Scadenza pagamento</label>
              <input type="date" v-model="dataScadenzaPagamento" :disabled="salvandoScadenza" @change="salvaScadenzaPagamento" />
              <small class="note-legal">Termine commerciale, non fiscale: modificabile anche a fattura già emessa. Va in XML (DatiPagamento) se la fattura non è ancora stata inviata.</small>
            </div>
            <div class="field" v-if="fatturaGenerata?.pagamenti?.length">
              <label>Pagamenti registrati {{ fatturaGenerata.residuo > 0 ? `(residuo ${formattaEuro(fatturaGenerata.residuo)})` : '(saldata)' }}</label>
              <ul class="lista-piatta">
                <li v-for="(p, i) in fatturaGenerata.pagamenti" :key="i" class="pagamento">
                  <div class="pagamento-main">
                    <span class="pagamento-data">{{ formattaData(p.data) }}</span>
                    <strong class="pagamento-importo">{{ formattaEuro(p.importo) }}</strong>
                    <button type="button" class="btn-icon btn-icon-warn" title="Elimina pagamento" aria-label="Elimina pagamento" @click="eliminaPagamento(i)">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg>
                    </button>
                  </div>
                  <a v-if="p.btc" class="chip-tx" :href="`https://mempool.space/tx/${p.btc.txid}`" target="_blank" rel="noopener" :title="p.btc.txid">
                    <span class="chip-tx-icon">₿</span>
                    <span class="chip-tx-id">{{ p.btc.txid.slice(0, 8) }}…{{ p.btc.txid.slice(-8) }}</span>
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M8 7h9v9"/></svg>
                  </a>
                  <span v-if="p.valuta" class="badge-mono">{{ p.valuta.importoValuta }} {{ p.valuta.codice }} · cambio {{ p.valuta.cambio }} · {{ p.valuta.fonte }}</span>
                </li>
              </ul>
            </div>
            <div class="field">
              <button v-if="!mostraFormBtc" class="btn btn-ghost" :style="motivoBtcDisabilitato ? 'opacity:.5' : ''" :title="motivoBtcDisabilitato" @click="apriFormBtc">₿ Registra incasso in BTC</button>
              <small v-if="!mostraFormBtc && motivoBtcDisabilitato" class="note-legal">{{ motivoBtcDisabilitato }}</small>
              <div v-if="mostraFormBtc" style="display:flex;flex-direction:column;gap:8px;border:1px solid var(--border);border-radius:8px;padding:10px">
                <label>Indirizzo di destinazione</label>
                <div style="display:flex;gap:6px">
                  <select v-if="config.walletBtc?.length && !indirizzoLibero" v-model="btcForm.indirizzoDestinatario" style="flex:1" @change="btcForm.indirizzoDestinatario === '__altro__' && (indirizzoLibero = true, btcForm.indirizzoDestinatario = '')">
                    <option v-for="w in config.walletBtc" :key="w.indirizzo" :value="w.indirizzo">{{ w.etichetta || w.indirizzo }}</option>
                    <option value="__altro__">Altro indirizzo…</option>
                  </select>
                  <input v-else v-model="btcForm.indirizzoDestinatario" placeholder="il tuo indirizzo BTC che ha ricevuto il pagamento" style="flex:1" />
                  <button class="btn btn-ghost" :disabled="(!btcForm.txid && !btcForm.indirizzoDestinatario) || caricandoTx" :title="btcForm.txid ? 'Leggi da blockchain' : 'Trova ultima transazione ricevuta su questo indirizzo'" @click="leggiDaBlockchain">
                    <span v-if="caricandoTx">…</span>
                    <svg v-else viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  </button>
                </div>
                <small class="note-legal">Precompilato dal wallet di default (Impostazioni). Se vuoto, prendilo dal tuo wallet o da un block explorer.</small>
                <span v-if="erroreBtc && erroreBtcSuIndirizzo" class="note-legal" style="color:var(--warn)">{{ erroreBtc }}</span>

                <label>TXID</label>
                <div style="display:flex;gap:6px">
                  <input v-model="btcForm.txid" placeholder="64 caratteri esadecimali (lascia vuoto per cercarlo dall'indirizzo)" style="flex:1" />
                  <button class="btn btn-ghost" :disabled="(!btcForm.txid && !btcForm.indirizzoDestinatario) || caricandoTx" :title="btcForm.txid ? 'Leggi da blockchain' : 'Trova ultima transazione ricevuta su questo indirizzo'" @click="leggiDaBlockchain">
                    <span v-if="caricandoTx">…</span>
                    <svg v-else viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  </button>
                </div>
                <small class="note-legal">Con TXID: legge quella transazione. Senza TXID: cerca l'ultima ricevuta sull'indirizzo sopra. Invia dati a mempool.space (servizio esterno, vedi IP).</small>
                <span v-if="erroreBtc && !erroreBtcSuIndirizzo" class="note-legal" style="color:var(--warn)">{{ erroreBtc }}</span>

                <label>Satoshi ricevuti</label>
                <input v-model.number="btcForm.satoshi" type="number" min="1" step="1" />

                <label>Cambio EUR/BTC</label>
                <div style="display:flex;gap:6px">
                  <input v-model.number="btcForm.cambioEurBtc" type="number" min="0" step="0.01" style="flex:1" />
                  <button class="btn btn-ghost" :disabled="caricandoCambio" @click="recuperaCambio">{{ caricandoCambio ? '…' : 'Recupera cambio' }}</button>
                </div>
                <small class="note-legal">Invia solo la data al servizio esterno (CoinGecko). Il valore resta modificabile: prevale il criterio concordato col cliente.</small>

                <label>Fonte cambio</label>
                <input v-model="btcForm.fonteCambio" placeholder="es. Kraken, CoinGecko" />

                <label>Data/ora cambio</label>
                <input v-model="btcForm.dataOraCambio" placeholder="ISO 8601" />

                <span v-if="btcForm.satoshi && btcForm.cambioEurBtc" class="badge-mono">
                  ≈ {{ formattaEuro((btcForm.satoshi / 1e8) * btcForm.cambioEurBtc) }}
                </span>
                <small v-if="btcForm.satoshi && btcForm.cambioEurBtc && daAccantonare((btcForm.satoshi / 1e8) * btcForm.cambioEurBtc, new Date().getFullYear()) != null" class="note-legal">
                  Da accantonare per le tasse: {{ formattaEuro(daAccantonare((btcForm.satoshi / 1e8) * btcForm.cambioEurBtc, new Date().getFullYear())) }}
                </small>

                <div style="display:flex;gap:6px">
                  <button class="btn btn-ok" style="flex:1;white-space:nowrap;justify-content:center" :disabled="registrandoBtc" @click="registraPagamentoBtc">{{ registrandoBtc ? 'Registro…' : 'Registra' }}</button>
                  <button class="btn btn-ghost" style="flex:1;white-space:nowrap;justify-content:center" @click="mostraFormBtc = false">Annulla</button>
                </div>
              </div>
            </div>
            <div class="field">
              <button v-if="!mostraFormValuta" class="btn btn-ghost" :style="motivoBtcDisabilitato ? 'opacity:.5' : ''" :title="motivoBtcDisabilitato" @click="apriFormValuta">€ Registra incasso in valuta estera</button>
              <small v-if="!mostraFormValuta && motivoBtcDisabilitato" class="note-legal">{{ motivoBtcDisabilitato }}</small>
              <div v-if="mostraFormValuta" style="display:flex;flex-direction:column;gap:8px;border:1px solid var(--border);border-radius:8px;padding:10px">
                <label>Valuta</label>
                <select v-model="valutaForm.codice">
                  <option v-for="v in valuteLista" :key="v.codice" :value="v.codice">{{ v.codice }} — {{ v.nome }}</option>
                </select>

                <label>Importo ricevuto (nella valuta)</label>
                <input v-model.number="valutaForm.importoValuta" type="number" min="0" step="0.01" />

                <label>Cambio (quantità di valuta per 1 EUR)</label>
                <div style="display:flex;gap:6px">
                  <input v-model.number="valutaForm.cambio" type="number" min="0" step="0.0001" style="flex:1" />
                  <button class="btn btn-ghost" :disabled="!valutaForm.codice || caricandoCambioValuta" @click="recuperaCambioIncasso">{{ caricandoCambioValuta ? '…' : 'Recupera cambio' }}</button>
                </div>
                <small class="note-legal">Invia la data della fattura a Banca d'Italia. Il valore resta modificabile. Convenzione: quantità di {{ valutaForm.codice?.toUpperCase() || 'valuta' }} per 1 EUR.</small>

                <label>Fonte cambio</label>
                <input v-model="valutaForm.fonte" placeholder="es. Banca d'Italia" />

                <label>Data quotazione</label>
                <input v-model="valutaForm.dataQuotazione" type="date" />

                <span v-if="valutaForm.importoValuta && valutaForm.cambio && valutaForm.cambio > 0" class="badge-mono">
                  ≈ {{ formattaEuro(valutaForm.importoValuta / valutaForm.cambio) }}
                </span>
                <small v-if="valutaForm.importoValuta && valutaForm.cambio > 0 && daAccantonare(valutaForm.importoValuta / valutaForm.cambio, new Date().getFullYear()) != null" class="note-legal">
                  Da accantonare per le tasse: {{ formattaEuro(daAccantonare(valutaForm.importoValuta / valutaForm.cambio, new Date().getFullYear())) }}
                </small>
                <span v-if="erroreValuta" class="note-legal" style="color:var(--warn)">{{ erroreValuta }}</span>

                <div style="display:flex;gap:6px">
                  <button class="btn btn-ok" style="flex:1;white-space:nowrap;justify-content:center" :disabled="registrandoValuta" @click="registraPagamentoValuta">{{ registrandoValuta ? 'Registro…' : 'Registra' }}</button>
                  <button class="btn btn-ghost" style="flex:1;white-space:nowrap;justify-content:center" @click="mostraFormValuta = false">Annulla</button>
                </div>
              </div>
            </div>
            <div v-if="!fatturaAccettataSdi" class="field">
              <label>Valuta fattura</label>
              <div style="display:flex;gap:6px">
                <select v-model="valutaFatturaCodice" style="flex:1">
                  <option value="">EUR (default)</option>
                  <option v-for="v in valuteLista" :key="v.codice" :value="v.codice">{{ v.codice }} — {{ v.nome }}</option>
                </select>
                <button v-if="valutaFatturaCodice" class="btn btn-ghost" :disabled="caricandoCambioFattura" @click="recuperaCambioFattura">{{ caricandoCambioFattura ? '…' : 'Recupera cambio' }}</button>
              </div>
              <div v-if="valutaFatturaCambio && valutaFatturaCodice" style="display:flex;gap:6px;align-items:center;margin-top:4px">
                <input v-model.number="valutaFatturaCambio" type="number" min="0" step="0.0001" style="flex:1" />
                <small class="note-legal" style="flex:2">{{ valutaFatturaFonte }} del {{ valutaFatturaDataQuotazione }} — quantità di {{ valutaFatturaCodice }} per 1 EUR. Modificabile.</small>
              </div>
              <span v-if="erroreCambioFattura" class="note-legal" style="color:var(--warn)">{{ erroreCambioFattura }}</span>
              <small class="note-legal">Lascia EUR per fatture in euro. Il cambio viene incluso nell'XML (Causale) e congelato alla generazione. Invia la data a Banca d'Italia (servizio esterno).</small>
            </div>
            <button class="btn btn-primary" :disabled="fatturaAccettataSdi || (modoManuale && (!importoValido || !descrizioneManuale))" @click="generaFattura()">
              {{ fatturaGenerata ? 'Rigenera fattura' : 'Genera fattura' }} n. {{ fatturaGenerata?.numero ?? '' }}
            </button>
            <small v-if="!fatturaGenerata" class="note-legal">Verifica imponibile, rivalsa INPS e bollo prima di emettere: dopo l'invio allo SDI la fattura non si modifica.</small>
            <small v-if="fatturaAccettataSdi" class="note-legal">Fattura accettata dallo SDI: emessa e non più modificabile. Per correggere un errore, emetti una nota di credito (card sotto).</small>
            <small v-else-if="!fatturaGenerata && previsioneSogliaCorrente?.livelloUscita === 'uscitaImmediata'" class="note-legal" style="color:var(--warn)">⚠️ Con questa fattura supereresti i 100.000 €: se incassata nell'anno il regime cessa immediatamente. Sarà chiesta conferma.</small>
            <small v-else-if="!fatturaGenerata && (previsioneSogliaCorrente?.livelloSoglia === 'oltre' || previsioneSogliaCorrente?.livelloSoglia === 'vicino' || previsioneSogliaCorrente?.livelloLimitePersonale === 'vicino' || previsioneSogliaCorrente?.livelloLimitePersonale === 'oltre')" class="note-legal" style="color:var(--warn)">Attenzione: con questa fattura ti avvicini o superi la soglia forfettaria{{ previsioneSogliaCorrente?.livelloSoglia === 'oltre' ? ' — sarà chiesta conferma' : '' }}.</small>
            <button class="btn btn-blue" :disabled="!fatturaGenerata" @click="scaricaXml">Scarica XML FatturaPA</button>
            <button class="btn btn-ghost" :disabled="!fatturaGenerata || !(clienteCorrente.emailFattura || clienteCorrente.email) || inviandoEmail" @click="inviaEmail">
              {{ inviandoEmail ? 'Preparo…' : 'Invia email al cliente' }}
            </button>
            <small v-if="fatturaGenerata && !(clienteCorrente.emailFattura || clienteCorrente.email)" class="note-legal">Configura l'email del cliente in Impostazioni per abilitare l'invio.</small>
            <span v-if="esitoEmail" class="badge-mono">{{ esitoEmail }}</span>
            <button class="btn" :class="ultimoScarto ? 'btn-warn' : 'btn-ok'" :disabled="!fatturaGenerata || inviandoPec" @click="inviaPec">
              {{ inviandoPec ? 'Invio…' : (ultimoScarto ? 'Fattura scartata: reinvia a SDI' : 'Invia PEC a SDI') }}
            </button>
            <span v-if="esitoPec" class="badge-mono">{{ esitoPec }}</span>
          </div>
        </div>

        <div v-if="fatturaGenerata && fatturaAccettataSdi" class="card">
          <div class="card-head"><h2>Nota di credito</h2></div>
          <div class="card-body" style="display:flex;flex-direction:column;gap:10px">
            <template v-if="fatturaGenerata.notaCredito">
              <p class="note-legal">
                Nota n. {{ fatturaGenerata.notaCredito.numero }} del {{ fatturaGenerata.notaCredito.data }}:
                storno di {{ fatturaGenerata.notaCredito.nettoAPagare.toFixed(2) }} € sulla fattura n. {{ fatturaGenerata.numero }}.
              </p>
              <p v-if="daRimborsareNota > 0" class="note-legal" style="color:var(--warn)">
                Il cliente aveva già pagato: da rimborsare {{ daRimborsareNota.toFixed(2) }} €. I ricavi per cassa non cambiano finché il rimborso non incide sull'anno dell'incasso: verifica col commercialista.
              </p>
              <a class="btn btn-blue" :href="api.urlDownloadXmlNotaCredito(anno, mese, clienteId)" target="_blank">Scarica XML nota di credito</a>
              <button class="btn btn-ok" :disabled="lavorandoNota" @click="inviaPecNotaCredito">{{ lavorandoNota ? 'Invio…' : 'Invia PEC a SDI' }}</button>
              <small v-if="fatturaGenerata.notaCredito.invii.length" class="note-legal">Tentativi di invio: {{ fatturaGenerata.notaCredito.invii.length }}.</small>
            </template>
            <template v-else>
              <label for="importo-nota">Importo da stornare (vuoto = intera fattura)</label>
              <input id="importo-nota" v-model="importoNota" type="number" min="0.01" step="0.01" :max="fatturaGenerata.imponibile" :placeholder="fatturaGenerata.imponibile.toFixed(2)" />
              <button class="btn btn-warn" :disabled="lavorandoNota" @click="emettiNotaCredito">Emetti nota di credito</button>
              <small class="note-legal">Una sola nota per fattura. Prende il prossimo numero della sequenza.</small>
            </template>
            <span v-if="esitoNota" class="badge-mono">{{ esitoNota }}</span>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h2>Ricevute SDI</h2></div>
          <div class="card-body" style="display:flex;flex-direction:column;gap:10px">
            <p class="note-legal" v-if="config.sdi.pollingAbilitato">
              Controllo automatico periodico attivo in background. Usa questo bottone per un controllo immediato:
              scarica ricevute/notifiche/fattura firmata nella cartella archivio configurata in Impostazioni.
            </p>
            <p class="note-legal" v-else>
              Controllo ricevute SDI disattivato in Impostazioni &gt; PEC.
            </p>
            <button class="btn btn-ghost" :disabled="controllandoSdi || !config.sdi.pollingAbilitato" @click="controllaSdi">
              {{ controllandoSdi ? 'Controllo…' : 'Controlla ora' }}
            </button>
            <span v-if="esitoSdi" class="badge-mono">{{ esitoSdi }}</span>

            <ul v-if="fatturaGenerata && ricevuteSdi.length" style="list-style:none;padding:0;margin:8px 0 0;display:flex;flex-direction:column;gap:6px">
              <li v-for="r in ricevuteSdi" :key="r.nomeFile" style="display:flex;flex-direction:column;gap:4px;font-size:13px">
                <div style="display:flex;justify-content:space-between;gap:8px">
                  <span>{{ r.descrizione }}</span>
                  <span class="badge-mono">{{ new Date(r.data).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }}</span>
                </div>
                <div v-for="(e, i) in r.errori" :key="i" style="background:var(--warn-bg);border:1px solid var(--warn);border-radius:6px;padding:6px 8px;font-size:12px;display:flex;flex-direction:column;gap:4px;color:var(--ink)">
                  <span><strong>{{ e.codice }}</strong> — {{ e.descrizione }}</span>
                  <span v-if="e.dettaglio" style="opacity:.85">{{ e.dettaglio }}</span>
                  <span v-else-if="e.suggerimento" style="opacity:.75">{{ e.suggerimento }}</span>
                </div>
              </li>
            </ul>
            <p v-else class="note-legal" style="opacity:.5">
              {{ fatturaGenerata ? 'Nessuna ricevuta SDI archiviata per questa fattura.' : 'Genera prima la fattura per vedere la cronologia ricevute.' }}
            </p>
          </div>
        </div>
      </div>

      <div style="min-width:0">
        <TemplateStampa v-if="datiFattura" ref="anteprimaRef" :template-id="templateIdFattura" :dati="datiFattura" />
      </div>
    </div>

    <div v-if="avvisoModale" class="modal-overlay" @click.self="avvisoModale = ''">
      <div class="modal-box">
        <h2>₿ Incasso in BTC</h2>
        <p>{{ avvisoModale }}</p>
        <div class="modal-actions">
          <button type="button" class="btn btn-primary" @click="avvisoModale = ''">Ho capito</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lista-piatta { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
.pagamento { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; background: var(--ground); border: 1px solid var(--line); border-radius: var(--radius-md); padding: 10px 12px; }
.pagamento-main { display: flex; align-items: center; gap: var(--gap-md); width: 100%; }
.pagamento-data { color: var(--ink-soft); font-size: var(--font-size-sm); }
.pagamento-importo { flex: 1; font-size: var(--font-size-md); color: var(--ink); }
.btn-icon-warn { width: 28px; height: 28px; background: var(--btn-warn-bg); color: var(--btn-warn-ink); border-color: var(--btn-warn-line); }
.btn-icon-warn:hover:not(:disabled) { background: color-mix(in srgb, var(--btn-warn-bg) 85%, var(--btn-warn-ink)); }
.chip-tx { display: inline-flex; align-items: center; gap: 6px; max-width: 100%; padding: 3px 10px 3px 4px; border-radius: var(--radius-pill); background: var(--btn-primary-bg); border: 1px solid var(--btn-primary-line); color: var(--btn-primary-ink); font-size: var(--font-size-xs); text-decoration: none; }
.chip-tx:hover { filter: brightness(.96); }
.chip-tx-icon { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: var(--radius-circle); background: var(--btn-primary-ink); color: var(--btn-primary-bg); font-weight: 700; font-size: var(--font-size-xs); }
.chip-tx-id { font-family: 'IBM Plex Mono', monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
