<script setup>
// Dashboard regime forfettario: compenso cumulato annuo vs soglia, previsione imposta,
// grafico a torta stile Flat-Tax (netto / imposta / margine residuo alla soglia).
import { ref, computed, onMounted, watch } from 'vue';
import DonutChart from '../components/DonutChart.vue';
import BarChart from '../components/BarChart.vue';
import LineChart from '../components/LineChart.vue';
import UpdateModal from '../components/UpdateModal.vue';
import StepRegoleFiscali from '../components/wizard/StepRegoleFiscali.vue';
import { api, updateApi } from '../services/api.js';
import { useUpdateCheck } from '../composables/useUpdateCheck.js';

const MESI_BREVI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

const anni = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);
const annoSelezionato = ref(new Date().getFullYear());
const dashboard = ref(null);
const errore = ref('');

const { stato: statoAggiornamento } = useUpdateCheck();
const mostraPopupAggiornamento = ref(false);
const aggiornamentoInCorso = ref(false);

async function eseguiAggiornamento() {
  aggiornamentoInCorso.value = true;
  try {
    await updateApi.esegui();
    // Il backend termina a fine script: polling finché non torna a rispondere, poi reload.
    const attendiRipristino = setInterval(async () => {
      const ok = await fetch('/api/update/stato').then(r => r.ok).catch(() => false);
      if (ok) { clearInterval(attendiRipristino); window.location.reload(); }
    }, 3000);
  } catch (err) {
    aggiornamentoInCorso.value = false;
    errore.value = `Aggiornamento non riuscito: ${err.message}`;
  }
}

const fattureAperte = ref([]);
const scadenzeFiscali = ref([]);
const fonteScadenzeFiscali = ref('base');
const statoRegoleFiscali = ref(null);
const versamentiStimati = ref(null);
const rateSaldoSelezionato = ref(1);
const salvatoreRate = ref(false);
const bolloTrimestrale = ref(null);
const creditiResidui = ref([]);
const nuovoCredito = ref({ sezione: 'erario', codice: '', annoRiferimento: new Date().getFullYear() - 1, importo: null, utilizzabileDal: '', descrizione: '' });
const erroreCrediti = ref('');
const eliminandoCredito = ref(null);

async function carica() {
  errore.value = '';
  try {
    dashboard.value = await api.dashboardForfettario(annoSelezionato.value);
    caricaValoreAttualeBtc();
  } catch (err) {
    errore.value = err.message;
  }
}

async function caricaFattureAperte() {
  fattureAperte.value = await api.fattureAperte().catch(() => []);
}

const salvandoIncasso = ref(null);
const importiIncasso = ref({});
async function salvaDataIncasso(f, dataPagamento, importo) {
  if (!dataPagamento || !importo) return;
  salvandoIncasso.value = `${f.anno}-${f.mese}-${f.clienteId}`;
  try {
    await api.confermaPagamentoFattura(f.anno, f.mese, f.clienteId, dataPagamento, importo);
    await caricaFattureAperte();
    await carica();
  } catch (err) {
    errore.value = err.message;
  } finally {
    salvandoIncasso.value = null;
  }
}

async function caricaScadenzeFiscali() {
  const risposta = await api.scadenzeFiscali().catch(() => null);
  scadenzeFiscali.value = risposta?.scadenze ?? [];
  fonteScadenzeFiscali.value = risposta?.fonte ?? 'base';
}

async function caricaStatoRegole() {
  statoRegoleFiscali.value = await api.statoRegoleFiscali().catch(() => null);
}

async function caricaVersamentiStimati() {
  versamentiStimati.value = await api.versamentiStimati(annoSelezionato.value).catch(() => null);
  if (versamentiStimati.value?._dettagli?.nRate != null) {
    rateSaldoSelezionato.value = versamentiStimati.value._dettagli.nRate;
  }
}

async function cambiaRateSaldo(n) {
  rateSaldoSelezionato.value = n;
  salvatoreRate.value = true;
  try {
    await api.salvaRateSaldo(n);
    await caricaVersamentiStimati();
  } finally {
    salvatoreRate.value = false;
  }
}

async function caricaBolloTrimestrale() {
  bolloTrimestrale.value = await api.bolloTrimestrale(annoSelezionato.value).catch(() => null);
}

async function caricaCreditiResidui() {
  creditiResidui.value = await api.creditiResiduiF24().catch(() => []);
}

async function aggiungiCreditoF24() {
  erroreCrediti.value = '';
  try {
    await api.aggiungiCreditoF24(nuovoCredito.value);
    nuovoCredito.value = { sezione: 'erario', codice: '', annoRiferimento: new Date().getFullYear() - 1, importo: null, utilizzabileDal: '', descrizione: '' };
    await caricaCreditiResidui();
  } catch (err) {
    erroreCrediti.value = err.message;
  }
}

async function eliminaCreditoF24(id) {
  erroreCrediti.value = '';
  eliminandoCredito.value = id;
  try {
    await api.eliminaCreditoF24(id);
    await caricaCreditiResidui();
  } catch (err) {
    erroreCrediti.value = err.message;
  } finally {
    eliminandoCredito.value = null;
  }
}

onMounted(() => {
  carica();
  caricaFattureAperte();
  caricaScadenzeFiscali();
  caricaMercatoBtc();
  caricaStatoRegole();
  caricaVersamentiStimati();
  caricaBolloTrimestrale();
  caricaCreditiResidui();
});
watch(annoSelezionato, () => { carica(); caricaVersamentiStimati(); caricaBolloTrimestrale(); });

const barreRicaviMensili = computed(() => {
  if (!dashboard.value) return [];
  return dashboard.value.ricaviMensili.map((m) => ({
    etichetta: MESI_BREVI[m.mese - 1],
    valore: m.ricavi,
    valoreTesto: formattaEuro(m.ricavi),
  }));
});

function formattaData(valore) {
  return new Date(valore).toLocaleDateString('it-IT');
}

function formattaGiorno(valoreIso) {
  return Number(valoreIso.slice(8, 10));
}

function formattaMeseBreve(valoreIso) {
  return MESI_BREVI[Number(valoreIso.slice(5, 7)) - 1];
}

function scadenzaPassata(valoreIso) {
  return valoreIso < oggiIso;
}

const scadenzeOrdinate = computed(() => [...scadenzeFiscali.value].sort((a, b) => b.data.localeCompare(a.data)));

const prossimaScadenzaData = computed(() => {
  const future = scadenzeFiscali.value.map((s) => s.data).filter((d) => d >= oggiIso);
  return future.length ? future.reduce((min, d) => (d < min ? d : min)) : null;
});

const oggiIso = new Date().toISOString().slice(0, 10);
function fatturaScaduta(f) {
  return Boolean(f.dataScadenzaPagamento) && f.dataScadenzaPagamento < oggiIso;
}

// Composizione del compenso: ricavi/reddito fiscale/imposta, proporzionati tra loro.
const fetteComposizione = computed(() => {
  if (!dashboard.value) return [];
  const { ricaviCumulati, redditoImponibile, impostaStimata } = dashboard.value;
  return [
    { etichetta: 'Ricavi/compensi', valore: ricaviCumulati, colore: 'var(--ok)', valoreTesto: formattaEuro(ricaviCumulati) },
    { etichetta: 'Reddito fiscale', valore: redditoImponibile, colore: 'var(--accent)', valoreTesto: formattaEuro(redditoImponibile) },
    { etichetta: 'Imposta stimata', valore: impostaStimata, colore: 'var(--warn)', valoreTesto: formattaEuro(impostaStimata) },
  ];
});

// Soglia forfettario: quota di fatturato già raggiunta vs margine residuo agli 85.000€.
const fetteSoglia = computed(() => {
  if (!dashboard.value) return [];
  const { sogliaAnnua, ricaviCumulati } = dashboard.value;
  const margineResiduo = Math.max(sogliaAnnua - ricaviCumulati, 0);
  return [
    { etichetta: 'Ricavi cumulati', valore: ricaviCumulati, colore: dashboard.value.superamentoSoglia ? 'var(--warn)' : 'var(--accent)', valoreTesto: formattaEuro(ricaviCumulati) },
    { etichetta: 'Margine alla soglia', valore: margineResiduo, colore: 'var(--line)', valoreTesto: formattaEuro(margineResiduo) },
  ];
});

// Soglia per cassa: come fetteSoglia ma sui ricavi effettivamente incassati nell'anno
// (dataPagamento), non su quelli emessi — è il calcolo rilevante ai fini fiscali reali.
const fetteSogliaCassa = computed(() => {
  if (!dashboard.value) return [];
  const { sogliaAnnua } = dashboard.value;
  const { ricaviCumulati } = dashboard.value.cassa;
  const margineResiduo = Math.max(sogliaAnnua - ricaviCumulati, 0);
  return [
    { etichetta: 'Incassato', valore: ricaviCumulati, colore: dashboard.value.cassa.superamentoSoglia ? 'var(--warn)' : 'var(--accent)', valoreTesto: formattaEuro(ricaviCumulati) },
    { etichetta: 'Margine alla soglia', valore: margineResiduo, colore: 'var(--line)', valoreTesto: formattaEuro(margineResiduo) },
  ];
});

function formattaEuro(valore) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(valore ?? 0);
}

function esportaCommercialista() {
  window.open(api.urlExportCommercialista(annoSelezionato.value), '_blank');
}

// Card BTC (FP-011, riepilogo dashboard): TXID abbreviato per la tabella rate.
function abbreviaTxid(txid) {
  return `${txid.slice(0, 4)}…${txid.slice(-4)}`;
}

// Valore attuale controvalore BTC: fetch automatica ad ogni cambio anno (deroga
// esplicita al pattern privacy-IP-solo-su-click, approvata dall'utente per questa card),
// solo se ci sono BTC incassati nell'anno.
const valoreAttualeBtc = ref(null);
const erroreValoreAttualeBtc = ref('');
const caricandoValoreAttualeBtc = ref(false);
async function caricaValoreAttualeBtc() {
  valoreAttualeBtc.value = null;
  erroreValoreAttualeBtc.value = '';
  if (!dashboard.value.cassa.btc.rate) return;
  caricandoValoreAttualeBtc.value = true;
  try {
    const risposta = await api.cambioAttualeBtc();
    const cambioOggi = risposta?.bitcoin?.eur;
    if (!cambioOggi) throw new Error('Cambio non disponibile');
    const btc = dashboard.value.cassa.btc;
    const controvaloreOggi = Number((btc.satoshi / 1e8 * cambioOggi).toFixed(2));
    valoreAttualeBtc.value = { cambioOggi, controvaloreOggi, differenza: Number((controvaloreOggi - btc.eur).toFixed(2)) };
  } catch (err) {
    erroreValoreAttualeBtc.value = err.message;
  } finally {
    caricandoValoreAttualeBtc.value = false;
  }
}

// Andamento cambio EUR/BTC storico delle rate dell'anno, per il grafico lineare della card.
const andamentoCambioBtc = computed(() => {
  if (!dashboard.value) return [];
  return [...dashboard.value.cassa.btc.elenco]
    .sort((a, b) => a.data.localeCompare(b.data))
    .map((r) => ({ etichetta: formattaData(r.data), valore: r.cambioEurBtc, valoreTesto: formattaEuro(r.cambioEurBtc) }));
});

// Card "Valore BTC di mercato": prezzo attuale + variazione 24h + storico 30gg, indipendente
// dagli incassi (utile anche in anni senza rate BTC). Fetch al mount della pagina, non per anno.
const prezzoMercatoBtc = ref(null);
const storicoMercatoBtc = ref([]);
const erroreMercatoBtc = ref('');
const caricandoMercatoBtc = ref(false);
async function caricaMercatoBtc() {
  caricandoMercatoBtc.value = true;
  erroreMercatoBtc.value = '';
  try {
    // Due chiamate CoinGecko separate e non critiche a vicenda: se lo storico fallisce
    // (es. rate limit) il prezzo attuale resta comunque visibile, solo senza sparkline.
    const [rispPrezzo, rispStorico] = await Promise.allSettled([api.prezzoMercatoBtc(), api.storicoPrezzoMercatoBtc()]);
    if (rispPrezzo.status === 'rejected') throw new Error(`Prezzo non disponibile (${rispPrezzo.reason?.message ?? 'errore rete'})`);
    const eur = rispPrezzo.value?.bitcoin?.eur;
    if (!eur) throw new Error('Prezzo non disponibile');
    prezzoMercatoBtc.value = { eur, variazione24h: rispPrezzo.value.bitcoin.eur_24h_change };

    if (rispStorico.status === 'fulfilled') {
      // CoinGecko restituisce granularità oraria (~720 punti su 30gg): un punto al giorno
      // (l'ultimo rilevato di ogni giorno) basta per il trend e disegna una linea leggibile.
      const perGiorno = new Map();
      for (const [ts, valore] of rispStorico.value?.prices ?? []) {
        const giorno = new Date(ts).toISOString().slice(0, 10);
        perGiorno.set(giorno, valore); // sovrascrive: resta l'ultimo rilevamento del giorno
      }
      storicoMercatoBtc.value = [...perGiorno].map(([giorno, valore]) => ({
        etichetta: new Date(giorno).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }),
        valore,
        valoreTesto: formattaEuro(valore),
      }));
    }
  } catch (err) {
    erroreMercatoBtc.value = err.message;
  } finally {
    caricandoMercatoBtc.value = false;
  }
}

// Card riordinabili via drag & drop nativo (HTML5) + CSS order. Persistenza per-browser,
// non è un dato di dominio: nessuna sincronizzazione col backend.
// Tre viste (Dashboard/Bitcoin/F24), ognuna col proprio ordine e la propria chiave localStorage.
const ORDINE_DEFAULT = ['soglia-cassa', 'soglia-competenza', 'composizione', 'andamento', 'fatture-da-incassare', 'scadenze-fiscali'];
const ORDINE_DEFAULT_BTC = ['btc-riepilogo', 'btc-rate', 'btc-rw', 'btc-valore-attuale', 'btc-mercato'];
const ORDINE_DEFAULT_F24 = ['versamenti-stimati', 'bollo-trimestrale', 'crediti-f24'];
const CHIAVE_ORDINE = 'dashboardOrdineCard';
const CHIAVE_ORDINE_BTC = 'dashboardOrdineCardBtc';
const CHIAVE_ORDINE_F24 = 'dashboardOrdineCardF24';
const CHIAVE_TAB = 'dashboardTabAttivo';

function caricaOrdineSalvato(chiave, ordineDefault) {
  try {
    const salvato = JSON.parse(localStorage.getItem(chiave));
    if (!Array.isArray(salvato)) return [...ordineDefault];
    // Tieni solo id noti, poi aggiungi in coda quelli mancanti (card nuove non spariscono).
    const noti = salvato.filter((id) => ordineDefault.includes(id));
    const mancanti = ordineDefault.filter((id) => !noti.includes(id));
    return [...noti, ...mancanti];
  } catch {
    return [...ordineDefault];
  }
}

function caricaTabSalvato() {
  try {
    const salvato = localStorage.getItem(CHIAVE_TAB);
    if (salvato === 'Bitcoin') return 'Bitcoin';
    if (salvato === 'F24') return 'F24';
    if (salvato === 'Regole fiscali') return 'Regole fiscali';
    return 'Dashboard';
  } catch {
    return 'Dashboard';
  }
}

const tabAttivo = ref(caricaTabSalvato());
function cambiaTab(tab) {
  tabAttivo.value = tab;
  try {
    localStorage.setItem(CHIAVE_TAB, tab);
  } catch {
    // storage non disponibile: preferenza resta solo in memoria per questa sessione.
  }
}

const ordineCard = ref(caricaOrdineSalvato(CHIAVE_ORDINE, ORDINE_DEFAULT));
const ordineCardBtc = ref(caricaOrdineSalvato(CHIAVE_ORDINE_BTC, ORDINE_DEFAULT_BTC));
const ordineCardF24 = ref(caricaOrdineSalvato(CHIAVE_ORDINE_F24, ORDINE_DEFAULT_F24));
const trascinata = ref(null);

function salvaOrdine() {
  try {
    localStorage.setItem(CHIAVE_ORDINE, JSON.stringify(ordineCard.value));
    localStorage.setItem(CHIAVE_ORDINE_BTC, JSON.stringify(ordineCardBtc.value));
    localStorage.setItem(CHIAVE_ORDINE_F24, JSON.stringify(ordineCardF24.value));
  } catch {
    // storage non disponibile (privato/pieno): ordine resta solo in memoria per questa sessione.
  }
}

function ordinePer(id) {
  if (ORDINE_DEFAULT.includes(id)) return ordineCard.value.indexOf(id);
  if (ORDINE_DEFAULT_F24.includes(id)) return ordineCardF24.value.indexOf(id);
  return ordineCardBtc.value.indexOf(id);
}

function dragStart(id) {
  trascinata.value = id;
}

function refPerId(id) {
  if (ORDINE_DEFAULT.includes(id)) return ordineCard;
  if (ORDINE_DEFAULT_F24.includes(id)) return ordineCardF24;
  return ordineCardBtc;
}

function drop(idTarget) {
  if (!trascinata.value || trascinata.value === idTarget) return;
  const target = refPerId(idTarget);
  const lista = [...target.value];
  const daIndex = lista.indexOf(trascinata.value);
  const aIndex = lista.indexOf(idTarget);
  if (daIndex === -1 || aIndex === -1) return; // trascinata e target appartengono a viste diverse
  lista.splice(daIndex, 1);
  lista.splice(aIndex, 0, trascinata.value);
  target.value = lista;
  trascinata.value = null;
  salvaOrdine();
}

function spostaConTastiera(id, delta) {
  const target = refPerId(id);
  const lista = [...target.value];
  const daIndex = lista.indexOf(id);
  const aIndex = daIndex + delta;
  if (aIndex < 0 || aIndex >= lista.length) return;
  lista.splice(daIndex, 1);
  lista.splice(aIndex, 0, id);
  target.value = lista;
  salvaOrdine();
}

const layoutModificato = computed(() => {
  if (tabAttivo.value === 'Bitcoin') return ordineCardBtc.value.some((id, i) => id !== ORDINE_DEFAULT_BTC[i]);
  if (tabAttivo.value === 'F24') return ordineCardF24.value.some((id, i) => id !== ORDINE_DEFAULT_F24[i]);
  return ordineCard.value.some((id, i) => id !== ORDINE_DEFAULT[i]);
});

function ripristinaLayout() {
  if (tabAttivo.value === 'Bitcoin') {
    ordineCardBtc.value = [...ORDINE_DEFAULT_BTC];
  } else if (tabAttivo.value === 'F24') {
    ordineCardF24.value = [...ORDINE_DEFAULT_F24];
  } else {
    ordineCard.value = [...ORDINE_DEFAULT];
  }
  salvaOrdine();
}
</script>

<template>
  <div>
    <div class="page-head">
      <div><h1>Dashboard forfettario</h1><p>Compenso cumulato vs soglia, previsione imposta sostitutiva</p></div>
      <div class="page-head-actions">
        <button
          v-if="statoAggiornamento.disponibile" type="button" class="btn btn-blue"
          @click="mostraPopupAggiornamento = true"
        >Aggiornamento disponibile</button>
        <button type="button" class="btn btn-ghost" @click="esportaCommercialista">Esporta per commercialista</button>
        <button
          type="button" class="btn btn-ghost" :disabled="!layoutModificato"
          :title="layoutModificato ? '' : 'Layout già di default'"
          @click="ripristinaLayout"
        >Ripristina layout</button>
        <select v-model.number="annoSelezionato" class="status">
          <option v-for="a in anni" :key="a" :value="a">{{ a }}</option>
        </select>
      </div>
    </div>

    <p v-if="errore" class="note-legal">Errore: {{ errore }}</p>

    <template v-if="dashboard">
      <div class="summary-row">
        <div class="stat"><div class="label">Ricavi cumulati</div><div class="value">{{ formattaEuro(dashboard.ricaviCumulati) }}</div></div>
        <div class="stat"><div class="label">Reddito imponibile</div><div class="value">{{ formattaEuro(dashboard.redditoImponibile) }}</div></div>
        <div class="stat accent"><div class="label">Proiezione fine anno</div><div class="value">{{ formattaEuro(dashboard.ricaviProiettati) }}</div></div>
      </div>

      <div class="stat-gruppo-stima">
        <div class="stat-gruppo-riga">
          <div class="stat" :class="dashboard.superamentoSoglia ? 'warn' : 'ok'">
            <div class="label">Imposta stimata ({{ dashboard.aliquota }}%)</div>
            <div class="value">{{ formattaEuro(dashboard.impostaStimata) }}</div>
          </div>
          <div class="stat">
            <div class="label">Acconto {{ dashboard.anno + 1 }} suggerito</div>
            <div class="value">{{ formattaEuro(dashboard.accontoStimato) }}</div>
          </div>
        </div>
        <div class="nota-stima">Stime, metodo storico (100% imposta su reddito proiettato fine anno) — verificare sempre con il commercialista.</div>
      </div>

      <div
        v-if="statoRegoleFiscali?.aggiornamentoDisponibile"
        class="banner-regole"
      >
        Regole fiscali {{ statoRegoleFiscali.annoDisponibile }} disponibili e non ancora confermate.
        <button class="banner-link-btn" @click="cambiaTab('Regole fiscali')">Vai a Regole fiscali</button>
      </div>

      <div class="tab-toggle">
        <button type="button" :class="tabAttivo === 'Dashboard' ? 'btn btn-primary' : 'btn btn-ghost'" @click="cambiaTab('Dashboard')">Dashboard</button>
        <button type="button" :class="tabAttivo === 'Bitcoin' ? 'btn btn-primary' : 'btn btn-ghost'" @click="cambiaTab('Bitcoin')">Bitcoin</button>
        <button type="button" :class="tabAttivo === 'F24' ? 'btn btn-primary' : 'btn btn-ghost'" @click="cambiaTab('F24')">F24</button>
        <button type="button" :class="tabAttivo === 'Regole fiscali' ? 'btn btn-primary' : 'btn btn-ghost'" @click="cambiaTab('Regole fiscali')">Regole fiscali</button>
      </div>

      <div v-if="tabAttivo === 'Regole fiscali'" class="regole-fiscali-wrapper">
        <StepRegoleFiscali @confermata="caricaStatoRegole" />
      </div>

      <div v-else-if="tabAttivo === 'Dashboard'" class="griglia-card">
        <div class="card" :style="{ order: ordinePer('soglia-cassa') }">
          <div
            class="card-head" draggable="true" tabindex="0" aria-label="Sposta card"
            @dragstart="dragStart('soglia-cassa')" @dragover.prevent @drop="drop('soglia-cassa')"
            @keydown.alt.up.prevent="spostaConTastiera('soglia-cassa', -1)" @keydown.alt.down.prevent="spostaConTastiera('soglia-cassa', 1)"
          >
            <span class="card-head-titolo"><span class="maniglia-card">⋮⋮</span><h2>Soglia forfettario (cassa)</h2></span>
            <span class="badge-fonte" title="Fatturato/imposta calcolati sulla data di incasso, non di emissione: è il criterio che vale davvero per il regime forfettario">fa fede per le tasse</span>
          </div>
          <div class="card-body">
            <DonutChart :fette="fetteSogliaCassa" :centro-valore="`${dashboard.cassa.percentualeSoglia}%`" centro-label="soglia" />
            <div class="mini-stat-row">
              <div class="mini-stat"><span class="mini-stat-label">Incassato</span><span class="mini-stat-value">{{ formattaEuro(dashboard.cassa.ricaviCumulati) }}</span></div>
              <div class="mini-stat"><span class="mini-stat-label">Imposta stimata</span><span class="mini-stat-value">{{ formattaEuro(dashboard.cassa.impostaStimata) }}</span></div>
            </div>
            <p v-if="dashboard.cassa.statoSoglia === 'uscitaImmediata'" class="avviso-riga avviso-warn">⚠️ Soglia 100.000 € superata — se incassato nell'anno, il regime forfettario cessa immediatamente e l'IVA è dovuta già da questa fattura. Verificare subito con il commercialista.</p>
            <p v-else-if="dashboard.cassa.superamentoSoglia || dashboard.cassa.statoSoglia === 'uscitaAnnoSuccessivo'" class="avviso-riga avviso-warn">Soglia già superata (per cassa) — uscita dal regime l'anno prossimo.</p>
            <p v-if="dashboard.cassa.fattureACavalloAnno.length" class="avviso-riga avviso-warn">
              {{ dashboard.cassa.fattureACavalloAnno.length }} fattura/e a cavallo d'anno — emesse in un anno, incassate in un altro.
            </p>
            <p v-if="dashboard.cassa.nonIncassateEmesseAnno.length" class="avviso-riga avviso-info">
              {{ dashboard.cassa.nonIncassateEmesseAnno.length }} fattura/e {{ dashboard.anno }} non ancora incassate — se incassate dopo il 31/12 pesano sulla soglia {{ dashboard.anno + 1 }}.
            </p>
            <p class="note-legal" style="margin-top:12px">
              Il regime forfettario applica il principio di cassa: fatturato e imposta rilevanti ai fini fiscali sono quelli di questa card, non quelli per competenza — verificare sempre con il commercialista.
            </p>
          </div>
        </div>

        <div class="card" :style="{ order: ordinePer('soglia-competenza') }">
          <div
            class="card-head" draggable="true" tabindex="0" aria-label="Sposta card"
            @dragstart="dragStart('soglia-competenza')" @dragover.prevent @drop="drop('soglia-competenza')"
            @keydown.alt.up.prevent="spostaConTastiera('soglia-competenza', -1)" @keydown.alt.down.prevent="spostaConTastiera('soglia-competenza', 1)"
          >
            <span class="card-head-titolo"><span class="maniglia-card">⋮⋮</span><h2>Soglia forfettario (competenza)</h2></span>
          </div>
          <div class="card-body">
            <DonutChart :fette="fetteSoglia" :centro-valore="`${dashboard.percentualeSoglia}%`" centro-label="soglia" />
            <p class="note-legal" style="margin-top:20px">
              Soglia annua: {{ formattaEuro(dashboard.sogliaAnnua) }} · proiezione fine anno: {{ formattaEuro(dashboard.ricaviProiettati) }} ({{ dashboard.percentualeSogliaProiettata }}%).
              <span v-if="dashboard.statoSoglia === 'uscitaImmediata'" style="color:var(--warn);font-weight:600"> Soglia 100.000 € superata — regime cessa immediatamente!</span>
              <span v-else-if="dashboard.superamentoSoglia" style="color:var(--warn);font-weight:600"> Soglia già superata — uscita dal regime l'anno prossimo.</span>
              <span v-else-if="dashboard.superamentoSogliaProiettato" style="color:var(--warn);font-weight:600"> Proiezione fine anno oltre soglia.</span>
            </p>
          </div>
        </div>

        <div class="card" :style="{ order: ordinePer('composizione') }">
          <div
            class="card-head" draggable="true" tabindex="0" aria-label="Sposta card"
            @dragstart="dragStart('composizione')" @dragover.prevent @drop="drop('composizione')"
            @keydown.alt.up.prevent="spostaConTastiera('composizione', -1)" @keydown.alt.down.prevent="spostaConTastiera('composizione', 1)"
          >
            <span class="card-head-titolo"><span class="maniglia-card">⋮⋮</span><h2>Composizione compenso</h2></span>
          </div>
          <div class="card-body">
            <DonutChart :fette="fetteComposizione" />
            <p class="note-legal" style="margin-top:20px">
              Settore coefficiente {{ dashboard.coefficenteRedditivita }}% · aliquota {{ dashboard.aliquota }}% ·
              {{ dashboard.mesiFatturati }} mesi fatturati nel {{ dashboard.anno }}.
            </p>
          </div>
        </div>

        <div class="card" :style="{ order: ordinePer('andamento') }">
          <div
            class="card-head" draggable="true" tabindex="0" aria-label="Sposta card"
            @dragstart="dragStart('andamento')" @dragover.prevent @drop="drop('andamento')"
            @keydown.alt.up.prevent="spostaConTastiera('andamento', -1)" @keydown.alt.down.prevent="spostaConTastiera('andamento', 1)"
          >
            <span class="card-head-titolo"><span class="maniglia-card">⋮⋮</span><h2>Andamento mensile ricavi</h2></span>
          </div>
          <div class="card-body">
            <BarChart :barre="barreRicaviMensili" />
          </div>
        </div>

        <div class="card" :style="{ display: 'flex', flexDirection: 'column', order: ordinePer('fatture-da-incassare') }">
          <div
            class="card-head" style="display:flex;justify-content:space-between;align-items:center" draggable="true" tabindex="0" aria-label="Sposta card"
            @dragstart="dragStart('fatture-da-incassare')" @dragover.prevent @drop="drop('fatture-da-incassare')"
            @keydown.alt.up.prevent="spostaConTastiera('fatture-da-incassare', -1)" @keydown.alt.down.prevent="spostaConTastiera('fatture-da-incassare', 1)"
          >
            <span class="card-head-titolo"><span class="maniglia-card">⋮⋮</span><h2>Fatture da incassare</h2></span>
            <router-link to="/importa-storico?passo=2" class="btn btn-ghost">Importa CSV pagamenti</router-link>
          </div>
          <div class="card-body" style="display:flex;flex-direction:column;flex:1">
            <p v-if="!fattureAperte.length" class="note-legal">Nessuna fattura in attesa di incasso.</p>
            <table v-else class="data-table tabella-incasso lista-scroll">
              <thead>
                <tr><th>Fattura</th><th>Importo da incassare</th><th>Data incasso</th></tr>
              </thead>
              <tbody>
                <tr v-for="f in fattureAperte" :key="`${f.anno}-${f.mese}-${f.clienteId}-${f.numero}`">
                  <td>
                    <span class="riga-fattura-aperta">
                      <span>
                        <span class="dot-scaduta" :class="{ visibile: fatturaScaduta(f) }" :title="fatturaScaduta(f) ? `Scaduta il ${formattaData(f.dataScadenzaPagamento)}` : ''"></span>
                        Fattura {{ f.numero }}
                        <span v-if="f.stato === 'parziale'" class="badge-parziale">parziale, residuo {{ formattaEuro(f.residuo) }}</span>
                      </span>
                      <span class="scadenza-sotto">emissione {{ formattaData(f.data) }}</span>
                      <span v-if="f.dataScadenzaPagamento" class="scadenza-sotto">scadenza {{ formattaData(f.dataScadenzaPagamento) }}</span>
                    </span>
                  </td>
                  <td>
                    <input
                      type="number" step="0.01" class="input-importo-incasso" title="Importo incassato"
                      :value="f.residuo"
                      @input="importiIncasso[`${f.anno}-${f.mese}-${f.clienteId}`] = $event.target.value"
                      :disabled="salvandoIncasso === `${f.anno}-${f.mese}-${f.clienteId}`"
                    />
                  </td>
                  <td>
                    <input
                      type="date" class="input-incasso" title="Segna come incassata il..."
                      :disabled="salvandoIncasso === `${f.anno}-${f.mese}-${f.clienteId}`"
                      @change="salvaDataIncasso(f, $event.target.value, Number(importiIncasso[`${f.anno}-${f.mese}-${f.clienteId}`] ?? f.residuo))"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
            <p class="nota-piede">Incasso rilevato da import CSV home banking (Importa storico → Pagamenti fatture), o inserito a mano qui sopra. L'importo è precompilato col residuo: confermalo così com'è per un incasso totale, oppure modificalo per registrare un acconto — la fattura resta "da incassare" finché il residuo non arriva a zero.</p>
          </div>
        </div>

        <div class="card" :style="{ display: 'flex', flexDirection: 'column', order: ordinePer('scadenze-fiscali') }">
          <div
            class="card-head" draggable="true" tabindex="0" aria-label="Sposta card"
            @dragstart="dragStart('scadenze-fiscali')" @dragover.prevent @drop="drop('scadenze-fiscali')"
            @keydown.alt.up.prevent="spostaConTastiera('scadenze-fiscali', -1)" @keydown.alt.down.prevent="spostaConTastiera('scadenze-fiscali', 1)"
          >
            <span class="card-head-titolo"><span class="maniglia-card">⋮⋮</span><h2>Scadenze fiscali</h2></span>
            <span v-if="fonteScadenzeFiscali !== 'base'" class="badge-fonte" :title="`Proroghe/importi verificati via ${fonteScadenzeFiscali === 'claude' ? 'Claude' : 'Gemini'} con ricerca web`">verificato via {{ fonteScadenzeFiscali === 'claude' ? 'Claude' : 'Gemini' }}</span>
          </div>
          <div class="card-body" style="display:flex;flex-direction:column;flex:1">
            <p v-if="!scadenzeFiscali.length" class="note-legal">Nessuna scadenza nota.</p>
            <ul v-else class="lista-scadenze">
              <li
                v-for="s in scadenzeOrdinate" :key="`${s.data}-${s.tipo}`"
                :class="{ passata: scadenzaPassata(s.data), prossima: s.data === prossimaScadenzaData }"
              >
                <div class="data-badge">
                  <span class="data-badge-giorno">{{ formattaGiorno(s.data) }}</span>
                  <span class="data-badge-mese">{{ formattaMeseBreve(s.data) }}</span>
                </div>
                <div class="scadenza-testo">
                  <span class="scadenza-tipo">{{ s.tipo }}<span v-if="s.prorogata" class="badge-fonte" style="margin-left:6px">prorogata</span></span>
                  <span class="scadenza-descrizione">{{ s.descrizione }}</span>
                </div>
                <strong v-if="s.importo != null">{{ formattaEuro(s.importo) }}</strong>
                <span v-if="s.data === prossimaScadenzaData" class="badge-prossima">prossima</span>
              </li>
            </ul>
            <p v-if="fonteScadenzeFiscali === 'base'" class="nota-piede">Date ordinarie standard; eventuali proroghe non ancora verificate (Gemini/Claude non configurati o quota esaurita).</p>
          </div>
        </div>

      </div>

      <div v-else-if="tabAttivo === 'Bitcoin'" class="griglia-card">
        <div class="card" :style="{ order: ordinePer('btc-riepilogo') }">
          <div
            class="card-head" draggable="true" tabindex="0" aria-label="Sposta card"
            @dragstart="dragStart('btc-riepilogo')" @dragover.prevent @drop="drop('btc-riepilogo')"
            @keydown.alt.up.prevent="spostaConTastiera('btc-riepilogo', -1)" @keydown.alt.down.prevent="spostaConTastiera('btc-riepilogo', 1)"
          >
            <span class="card-head-titolo"><span class="maniglia-card">⋮⋮</span><h2>Riepilogo Bitcoin</h2></span>
          </div>
          <div class="card-body">
            <template v-if="dashboard.cassa.btc.rate > 0">
              <div class="mini-stat-row">
                <div class="mini-stat"><span class="mini-stat-label">Incassato in BTC</span><span class="mini-stat-value">{{ formattaEuro(dashboard.cassa.btc.eur) }}</span></div>
                <div class="mini-stat"><span class="mini-stat-label">BTC totali</span><span class="mini-stat-value">{{ (dashboard.cassa.btc.satoshi / 1e8).toFixed(8) }}</span></div>
                <div class="mini-stat"><span class="mini-stat-label">Rate</span><span class="mini-stat-value">{{ dashboard.cassa.btc.rate }}</span></div>
                <div class="mini-stat"><span class="mini-stat-label">Cambio medio</span><span class="mini-stat-value">{{ formattaEuro(dashboard.cassa.btc.cambioMedio) }}</span></div>
              </div>
              <p class="note-legal" style="margin-top:12px">{{ dashboard.cassa.btc.percentualeSuIncassato }}% dell'incassato per cassa.</p>
            </template>
            <template v-else>
              <p class="note-legal">Nessun incasso BTC nel {{ dashboard.anno }}.</p>
              <p class="nota-piede">
                <router-link v-if="!dashboard.cassa.btc.walletConfigurati" to="/impostazioni">Configura un wallet BTC in Impostazioni</router-link>
                <span v-else>Registra un incasso BTC dalla pagina fattura.</span>
              </p>
            </template>
          </div>
        </div>

        <div class="card" :style="{ display: 'flex', flexDirection: 'column', order: ordinePer('btc-rate') }">
          <div
            class="card-head" draggable="true" tabindex="0" aria-label="Sposta card"
            @dragstart="dragStart('btc-rate')" @dragover.prevent @drop="drop('btc-rate')"
            @keydown.alt.up.prevent="spostaConTastiera('btc-rate', -1)" @keydown.alt.down.prevent="spostaConTastiera('btc-rate', 1)"
          >
            <span class="card-head-titolo"><span class="maniglia-card">⋮⋮</span><h2>Rate incassate in BTC</h2></span>
          </div>
          <div class="card-body" style="display:flex;flex-direction:column;flex:1">
            <p v-if="!dashboard.cassa.btc.elenco.length" class="note-legal">Nessuna rata BTC nel {{ dashboard.anno }}.</p>
            <table v-else class="data-table lista-scroll">
              <thead>
                <tr><th>Fattura</th><th>Data</th><th>BTC</th><th>Cambio</th><th>EUR</th><th>TXID</th></tr>
              </thead>
              <tbody>
                <tr v-for="r in dashboard.cassa.btc.elenco" :key="`${r.anno}-${r.mese}-${r.clienteId}-${r.numero}-${r.txid}`">
                  <td>Fattura {{ r.numero }}</td>
                  <td>{{ formattaData(r.data) }}</td>
                  <td>{{ (r.satoshi / 1e8).toFixed(8) }}</td>
                  <td>{{ formattaEuro(r.cambioEurBtc) }}</td>
                  <td>{{ formattaEuro(r.eur) }}</td>
                  <td><a :href="`https://mempool.space/tx/${r.txid}`" target="_blank" rel="noopener">{{ abbreviaTxid(r.txid) }}</a></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="card" :style="{ order: ordinePer('btc-rw') }">
          <div
            class="card-head" draggable="true" tabindex="0" aria-label="Sposta card"
            @dragstart="dragStart('btc-rw')" @dragover.prevent @drop="drop('btc-rw')"
            @keydown.alt.up.prevent="spostaConTastiera('btc-rw', -1)" @keydown.alt.down.prevent="spostaConTastiera('btc-rw', 1)"
          >
            <span class="card-head-titolo"><span class="maniglia-card">⋮⋮</span><h2>Quadro RW</h2></span>
          </div>
          <div class="card-body">
            <p v-if="dashboard.cassa.btc.rate > 0" class="avviso-riga avviso-info">
              BTC incassati nel {{ dashboard.anno }}: se detenuti al 31/12 vanno indicati nel quadro RW (imposta IC 0,2%) — verificare col commercialista.
            </p>
            <p v-else class="note-legal">Nessun incasso BTC nel {{ dashboard.anno }}: nessun obbligo RW da questa fonte.</p>
          </div>
        </div>

        <div class="card" :style="{ order: ordinePer('btc-valore-attuale') }">
          <div
            class="card-head" draggable="true" tabindex="0" aria-label="Sposta card"
            @dragstart="dragStart('btc-valore-attuale')" @dragover.prevent @drop="drop('btc-valore-attuale')"
            @keydown.alt.up.prevent="spostaConTastiera('btc-valore-attuale', -1)" @keydown.alt.down.prevent="spostaConTastiera('btc-valore-attuale', 1)"
          >
            <span class="card-head-titolo"><span class="maniglia-card">⋮⋮</span><h2>Valore attuale</h2></span>
          </div>
          <div class="card-body">
            <p v-if="dashboard.cassa.btc.rate === 0" class="note-legal">Nessun BTC incassato nel {{ dashboard.anno }}.</p>
            <p v-else-if="caricandoValoreAttualeBtc" class="note-legal">Verifico cambio attuale…</p>
            <p v-else-if="erroreValoreAttualeBtc" class="note-legal">Errore: {{ erroreValoreAttualeBtc }}</p>
            <template v-else-if="valoreAttualeBtc">
              <div class="mini-stat-row">
                <div class="mini-stat"><span class="mini-stat-label">Cambio oggi</span><span class="mini-stat-value">{{ formattaEuro(valoreAttualeBtc.cambioOggi) }}</span></div>
                <div class="mini-stat"><span class="mini-stat-label">Controvalore oggi</span><span class="mini-stat-value">{{ formattaEuro(valoreAttualeBtc.controvaloreOggi) }}</span></div>
                <div
                  class="mini-stat" :title="'Informativo: non è plusvalenza realizzata, BTC eventualmente già spesi non tracciati (FP-012)'"
                ><span class="mini-stat-label">Differenza vs registrato</span><span class="mini-stat-value" :style="{ color: valoreAttualeBtc.differenza >= 0 ? 'var(--ok)' : 'var(--warn)' }">{{ formattaEuro(valoreAttualeBtc.differenza) }}</span></div>
              </div>
              <p class="note-legal" style="margin-top:12px">Andamento cambio EUR/BTC delle rate incassate nel {{ dashboard.anno }}:</p>
              <LineChart v-if="andamentoCambioBtc.length > 1" :punti="andamentoCambioBtc" />
            </template>
          </div>
        </div>

        <div class="card" :style="{ order: ordinePer('btc-mercato') }">
          <div
            class="card-head" draggable="true" tabindex="0" aria-label="Sposta card"
            @dragstart="dragStart('btc-mercato')" @dragover.prevent @drop="drop('btc-mercato')"
            @keydown.alt.up.prevent="spostaConTastiera('btc-mercato', -1)" @keydown.alt.down.prevent="spostaConTastiera('btc-mercato', 1)"
          >
            <span class="card-head-titolo"><span class="maniglia-card">⋮⋮</span><h2>Valore BTC di mercato</h2></span>
          </div>
          <div class="card-body">
            <p v-if="caricandoMercatoBtc" class="note-legal">Verifico prezzo di mercato…</p>
            <p v-else-if="erroreMercatoBtc" class="note-legal">Errore: {{ erroreMercatoBtc }}</p>
            <template v-else-if="prezzoMercatoBtc">
              <div class="mercato-btc-hero">
                <span class="mercato-btc-prezzo">{{ formattaEuro(prezzoMercatoBtc.eur) }}</span>
                <span
                  v-if="prezzoMercatoBtc.variazione24h != null" class="badge-variazione"
                  :class="prezzoMercatoBtc.variazione24h >= 0 ? 'positiva' : 'negativa'"
                >{{ prezzoMercatoBtc.variazione24h >= 0 ? '+' : '' }}{{ prezzoMercatoBtc.variazione24h.toFixed(2) }}% 24h</span>
              </div>
              <LineChart v-if="storicoMercatoBtc.length > 1" :punti="storicoMercatoBtc" scala-relativa sparkline />
              <p class="note-legal" style="margin-top:12px">Prezzo di mercato BTC/EUR, indipendente dagli incassi registrati — fonte CoinGecko.</p>
            </template>
          </div>
        </div>
      </div>

      <div v-else class="griglia-card">
        <!-- Card versamenti stimati F24 (FP-015) -->
        <div class="card" :style="{ order: ordinePer('versamenti-stimati') }">
          <div
            class="card-head" draggable="true" tabindex="0" aria-label="Sposta card"
            @dragstart="dragStart('versamenti-stimati')" @dragover.prevent @drop="drop('versamenti-stimati')"
            @keydown.alt.up.prevent="spostaConTastiera('versamenti-stimati', -1)" @keydown.alt.down.prevent="spostaConTastiera('versamenti-stimati', 1)"
          >
            <span class="card-head-titolo"><span class="maniglia-card">⋮⋮</span><h2>Versamenti stimati F24</h2></span>
            <span v-if="versamentiStimati?.regole?.aggiornate === false" class="badge-fonte" style="color:var(--warn)" title="Regole non confermate per quest'anno">regole non confermate</span>
          </div>
          <div class="card-body">
            <div v-if="!versamentiStimati" class="note-legal">Caricamento…</div>
            <template v-else>
              <!-- Selettore rate -->
              <div class="f24-rate-row">
                <label for="rate-saldo" class="f24-rate-label">Rateizza saldo + I acconto:</label>
                <select
                  id="rate-saldo"
                  class="input-incasso"
                  :value="rateSaldoSelezionato"
                  :disabled="(versamentiStimati._dettagli?.maxRate ?? 1) <= 1 || salvatoreRate"
                  :title="(versamentiStimati._dettagli?.maxRate ?? 1) <= 1 ? 'Rateizzazione non disponibile con questa scadenza' : ''"
                  @change="cambiaRateSaldo(Number($event.target.value))"
                >
                  <option v-for="n in (versamentiStimati._dettagli?.maxRate ?? 1)" :key="n" :value="n">
                    {{ n === 1 ? '1 rata (unica soluzione)' : n + ' rate' }}
                  </option>
                </select>
                <span v-if="salvatoreRate" class="f24-saving">Salvataggio…</span>
              </div>

              <div v-if="!versamentiStimati.scadenze?.length" class="note-legal">Nessuna scadenza calcolata.</div>

              <!-- Timeline -->
              <div v-else class="f24-timeline">
                <div
                  v-for="(sc, scIdx) in versamentiStimati.scadenze"
                  :key="sc.data"
                  class="f24-tl-item"
                >
                  <div class="f24-tl-dot" :class="{ nov: sc.isNovembre }"></div>
                  <div class="f24-tl-card" :class="{ open: scIdx === 0 }">
                    <!-- Intestazione cliccabile -->
                    <div
                      class="f24-tl-head"
                      role="button"
                      tabindex="0"
                      @click="$event.currentTarget.closest('.f24-tl-card').classList.toggle('open')"
                      @keydown.enter.prevent="$event.currentTarget.closest('.f24-tl-card').classList.toggle('open')"
                      @keydown.space.prevent="$event.currentTarget.closest('.f24-tl-card').classList.toggle('open')"
                    >
                      <span class="f24-tl-data">{{ formattaData(sc.data) }}</span>
                      <span v-if="sc.rateazione" class="f24-tl-badge f24-badge-saldo">
                        Rata {{ parseInt(sc.rateazione.slice(0,2)) }}/{{ parseInt(sc.rateazione.slice(2,4)) }}
                      </span>
                      <span v-if="sc.isNovembre" class="f24-tl-badge f24-badge-nov">II acconto</span>
                      <span class="f24-tl-totale">{{ formattaEuro(sc.totale) }}</span>
                      <span v-if="Math.abs(sc.totaleConMaggiorazione - sc.totale) >= 0.01" class="f24-tl-magg">
                        +0,40% {{ formattaEuro(sc.totaleConMaggiorazione) }}
                      </span>
                      <span class="f24-tl-caret" aria-hidden="true">▶</span>
                    </div>
                    <!-- Corpo espandibile -->
                    <div class="f24-tl-body">
                      <div style="overflow-x:auto">
                        <table class="data-table f24-table">
                          <thead>
                            <tr>
                              <th>Sezione</th><th>Codice</th><th>Anno</th>
                              <th style="text-align:right">Importo</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr
                              v-for="r in sc.righe"
                              :key="`${r.sezione}-${r.codice}-${r.annoRiferimento}`"
                              :class="{ 'f24-riga-interessi': r.codice === '1668' }"
                            >
                              <td>{{ r.sezione }}</td>
                              <td class="f24-mono">{{ r.codice }}</td>
                              <td>{{ r.annoRiferimento }}</td>
                              <td style="text-align:right;font-variant-numeric:tabular-nums">{{ formattaEuro(r.importo) }}</td>
                            </tr>
                          </tbody>
                          <tfoot>
                            <tr>
                              <td colspan="3" style="font-weight:600">Totale</td>
                              <td style="text-align:right;font-weight:700;font-variant-numeric:tabular-nums">{{ formattaEuro(sc.totale) }}</td>
                            </tr>
                            <tr v-if="Math.abs(sc.totaleConMaggiorazione - sc.totale) >= 0.01" class="f24-magg-row">
                              <td colspan="3">Con maggiorazione +0,40%</td>
                              <td style="text-align:right;font-variant-numeric:tabular-nums">{{ formattaEuro(sc.totaleConMaggiorazione) }}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                      <a :href="api.urlF24Pdf(annoSelezionato, scIdx)" target="_blank" class="btn btn-primary f24-dl-btn">
                        Scarica F24 (precompilato)
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Crediti -->
              <div v-if="versamentiStimati.crediti?.length" style="margin-top:10px">
                <div style="font-weight:600;margin-bottom:4px">Crediti</div>
                <div v-for="c in versamentiStimati.crediti" :key="`${c.sezione}-${c.descrizione}`" class="note-legal">
                  {{ c.descrizione }}: {{ formattaEuro(c.importo) }}
                </div>
              </div>

              <!-- Avvisi -->
              <p v-if="versamentiStimati.avvisi?.length" class="note-legal" style="margin-top:12px">
                <span v-for="a in versamentiStimati.avvisi" :key="a" style="display:block">⚠ {{ a }}</span>
              </p>

              <p class="nota-piede">
                Stima basata su regole{{ versamentiStimati.regole?.verificatoIl ? ' verificate il ' + versamentiStimati.regole.verificatoIl.slice(0,10) : '' }}.
                Importi calcolati automaticamente — <u>verificare con il commercialista prima di pagare</u>.
              </p>
            </template>
          </div>
        </div>

        <!-- Card bollo trimestrale (FP-025) -->
        <div class="card" :style="{ order: ordinePer('bollo-trimestrale') }">
          <div
            class="card-head" draggable="true" tabindex="0" aria-label="Sposta card"
            @dragstart="dragStart('bollo-trimestrale')" @dragover.prevent @drop="drop('bollo-trimestrale')"
            @keydown.alt.up.prevent="spostaConTastiera('bollo-trimestrale', -1)" @keydown.alt.down.prevent="spostaConTastiera('bollo-trimestrale', 1)"
          >
            <span class="card-head-titolo"><span class="maniglia-card">⋮⋮</span><h2>Bollo trimestrale</h2></span>
          </div>
          <div class="card-body">
            <div v-if="!bolloTrimestrale" class="note-legal">Caricamento…</div>
            <template v-else>
              <div v-if="!bolloTrimestrale.scadenze?.length" class="note-legal">Nessun bollo da versare nell'anno {{ annoSelezionato }}.</div>
              <template v-else>
                <div v-for="sc in bolloTrimestrale.scadenze" :key="sc.trimestre" style="margin-bottom:14px">
                  <div style="font-weight:600;margin-bottom:4px">{{ formattaData(sc.data) }} — {{ sc.righe[0]?.descrizione }}</div>
                  <div style="display:flex;align-items:center;gap:12px">
                    <span style="font-size:1.1rem;font-weight:700">{{ formattaEuro(sc.importo) }}</span>
                    <span class="badge-fonte">cod. {{ sc.righe[0]?.codice }}</span>
                    <a :href="api.urlBolloF24Pdf(annoSelezionato, sc.trimestre)" target="_blank" class="btn btn-primary" style="font-size:.82rem;padding:3px 10px">F24</a>
                  </div>
                </div>
                <p v-if="bolloTrimestrale.scadenze.some(s => s.righe[0]?.descrizione?.includes('rinvio'))" class="note-legal" style="margin-top:6px">
                  ⓘ Importi sotto 5.000 € rinviati al trimestre successivo (guida AdE bollo FE, giugno 2026).
                </p>
              </template>
              <p class="nota-piede">{{ bolloTrimestrale.nota }}</p>
            </template>
          </div>
        </div>

        <!-- Card crediti fiscali compensabili (FP-016) -->
        <div class="card" :style="{ order: ordinePer('crediti-f24') }">
          <div
            class="card-head" draggable="true" tabindex="0" aria-label="Sposta card"
            @dragstart="dragStart('crediti-f24')" @dragover.prevent @drop="drop('crediti-f24')"
            @keydown.alt.up.prevent="spostaConTastiera('crediti-f24', -1)" @keydown.alt.down.prevent="spostaConTastiera('crediti-f24', 1)"
          >
            <span class="card-head-titolo"><span class="maniglia-card">⋮⋮</span><h2>Crediti compensabili F24</h2></span>
          </div>
          <div class="card-body">
            <p class="note-legal" style="margin-bottom:10px">
              Crediti fiscali da usare in compensazione nell'F24 (es. imposta sostitutiva pagata in eccesso).
              La compensazione si applica al momento di creare l'F24 — non modifica la stima.
            </p>

            <p v-if="erroreCrediti" class="note-legal" style="color:var(--danger);margin-bottom:8px">{{ erroreCrediti }}</p>

            <template v-if="creditiResidui.length">
              <table class="data-table" style="margin-bottom:14px">
                <thead><tr><th>Codice</th><th>Anno rif.</th><th>Importo orig.</th><th>Usato</th><th>Residuo</th><th>Disponibile dal</th><th></th></tr></thead>
                <tbody>
                  <tr v-for="c in creditiResidui" :key="c.id" :style="{ opacity: c.disponibile ? 1 : 0.6 }">
                    <td>{{ c.codice }}<span v-if="c.tipoCompensazione === 'verticale'" class="badge-fonte" style="margin-left:4px" title="Compensazione verticale — esente dal limite 5.000 €">vert.</span></td>
                    <td>{{ c.annoRiferimento ?? '—' }}</td>
                    <td>{{ formattaEuro(c.importo) }}</td>
                    <td>{{ formattaEuro(c.usato) }}</td>
                    <td style="font-weight:600">{{ formattaEuro(c.residuo) }}</td>
                    <td>{{ c.utilizzabileDal ?? 'subito' }}<span v-if="!c.disponibile" class="badge-fonte" style="margin-left:4px;color:var(--warn)">in attesa</span></td>
                    <td>
                      <button
                        class="btn-icon" title="Elimina credito" aria-label="Elimina credito"
                        :disabled="eliminandoCredito === c.id"
                        @click="eliminaCreditoF24(c.id)"
                      >✕</button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </template>
            <p v-else class="note-legal" style="margin-bottom:14px">Nessun credito registrato.</p>

            <details style="margin-top:4px">
              <summary style="cursor:pointer;font-size:.82rem;color:var(--accent)">Aggiungi credito</summary>
              <form @submit.prevent="aggiungiCreditoF24" style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;margin-top:10px">
                <div class="field">
                  <label>Sezione</label>
                  <select v-model="nuovoCredito.sezione">
                    <option value="erario">Erario</option>
                    <option value="inps">INPS</option>
                  </select>
                </div>
                <div class="field"><label>Codice tributo</label><input type="text" v-model="nuovoCredito.codice" placeholder="es. 1792" required style="width:90px"></div>
                <div class="field"><label>Anno rif.</label><input type="number" v-model.number="nuovoCredito.annoRiferimento" style="width:75px"></div>
                <div class="field"><label>Importo (€)</label><input type="number" step="0.01" min="0.01" v-model.number="nuovoCredito.importo" required style="width:100px"></div>
                <div class="field"><label>Disponibile dal</label><input type="date" v-model="nuovoCredito.utilizzabileDal"></div>
                <div class="field"><label>Descrizione</label><input type="text" v-model="nuovoCredito.descrizione" placeholder="es. Saldo 2024 a credito" style="width:180px"></div>
                <button type="submit" class="btn btn-ok">Aggiungi</button>
              </form>
            </details>

            <p class="nota-piede" style="margin-top:12px">
              Compensazione orizzontale &gt; 5.000 € richiede visto di conformità (DL 124/2019 art. 3).
              Compensazione verticale (stesso codice tributo) esente dal limite (Ris. AdE 110/E/2019).
              F24 a saldo zero: solo via telematica (Entratel/F24 web).
            </p>
          </div>
        </div>
      </div>
    </template>

    <UpdateModal
      v-if="mostraPopupAggiornamento"
      :versione-locale="statoAggiornamento.versioneLocale"
      :versione-remota="statoAggiornamento.versioneRemota"
      :changelog="statoAggiornamento.changelog"
      :in-corso="aggiornamentoInCorso"
      @aggiorna="eseguiAggiornamento"
      @annulla="mostraPopupAggiornamento = false"
    />
  </div>
</template>

<style scoped>
.summary-row { grid-template-columns: repeat(3, 1fr); }
.stat-gruppo-stima { background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 16px 18px; box-shadow: var(--shadow); margin-bottom: 22px; }
.stat-gruppo-riga { display: flex; gap: 32px; }
.stat-gruppo-riga .stat { background: none; border: none; box-shadow: none; padding: 0; }
.nota-stima { font-size: .68rem; color: var(--muted); margin-top: 14px; line-height: 1.3; border-top: 1px solid var(--line); padding-top: 10px; }
.lista-piatta { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 12px; }
.lista-piatta li { display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: .88rem; color: var(--ink-soft); }
.riga-fattura-aperta { display: flex; flex-direction: column; gap: 2px; }
.scadenza-sotto { padding-left: 14px; font-size: .74rem; color: var(--muted); }
.nota-piede { margin-top: auto; padding-top: 10px; font-size: .68rem; color: var(--muted); }
.input-incasso { border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 4px 8px; font-size: .78rem; background: var(--ground); color: var(--ink); font-family: inherit; }
.input-importo-incasso { width: 90px; border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 4px 8px; font-size: .78rem; background: var(--ground); color: var(--ink); font-family: inherit; }
.tabella-incasso td:first-child { white-space: normal; }
.badge-parziale { margin-left: 8px; font-size: .68rem; font-weight: 600; color: var(--warn); background: var(--warn-bg); border-radius: var(--radius-pill); padding: 2px 8px; }

.mini-stat-row { display: flex; gap: 12px; margin-top: 16px; }
.mini-stat { flex: 1; background: var(--ground); border: 1px solid var(--line); border-radius: var(--radius-md); padding: 8px 12px; display: flex; flex-direction: column; gap: 2px; }
.mini-stat-label { font-size: .66rem; color: var(--muted); text-transform: uppercase; letter-spacing: .03em; }
.mini-stat-value { font-size: .92rem; font-weight: 700; color: var(--ink); }
.avviso-riga { margin-top: 8px; font-size: .74rem; padding: 6px 10px; border-radius: var(--radius-sm); }
.avviso-warn { background: var(--warn-bg); color: var(--warn); font-weight: 600; }
.avviso-info { background: var(--ground); border: 1px solid var(--line); color: var(--ink-soft); }

.lista-scadenze { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
.lista-scadenze li { display: flex; align-items: center; gap: 14px; padding: 10px 12px; border-radius: 10px; background: var(--ground); border: 1px solid var(--line); transition: border-color .15s; }
.lista-scadenze li:hover { border-color: var(--accent); }
.lista-scadenze li.passata { opacity: .55; }
.lista-scadenze li.prossima { border-color: var(--accent); background: color-mix(in srgb, var(--accent) 8%, var(--ground)); }
.data-badge { flex: none; width: 46px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 6px 0; border-radius: 8px; background: var(--card); border: 1px solid var(--line); line-height: 1.1; }
.lista-scadenze li.prossima .data-badge { background: var(--accent); border-color: var(--accent); }
.lista-scadenze li.prossima .data-badge-giorno { color: var(--card); }
.lista-scadenze li.prossima .data-badge-mese { color: var(--card); opacity: .85; }
.data-badge-giorno { font-size: 1.05rem; font-weight: 700; color: var(--ink); }
.data-badge-mese { font-size: .62rem; font-weight: 600; color: var(--accent); text-transform: uppercase; letter-spacing: .04em; }
.scadenza-testo { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.scadenza-tipo { font-size: .86rem; font-weight: 600; color: var(--ink); }
.scadenza-descrizione { font-size: .76rem; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.badge-prossima { flex: none; font-size: .64rem; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--accent); background: var(--card); border: 1px solid var(--accent); border-radius: var(--radius-pill); padding: 3px 9px; }
.badge-fonte { font-size: .62rem; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); background: var(--ground); border: 1px solid var(--line); border-radius: var(--radius-pill); padding: 3px 9px; cursor: help; }
.dot-scaduta { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: transparent; margin-right: 6px; }
.dot-scaduta.visibile { background: var(--warn); }
.lista-scroll { max-height: 220px; overflow-y: auto; }

.mercato-btc-hero { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.mercato-btc-prezzo { font-size: 1.6rem; font-weight: 700; color: var(--ink); }
.badge-variazione { font-size: .72rem; font-weight: 700; border-radius: var(--radius-pill); padding: 3px 10px; }
.badge-variazione.positiva { color: var(--ok); background: var(--ok-bg); }
.badge-variazione.negativa { color: var(--warn); background: var(--warn-bg); }

.tab-toggle { display: flex; gap: 8px; margin-bottom: 20px; }
.griglia-card { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 20px; }
.card-head-titolo { display: flex; align-items: center; gap: 8px; }
.maniglia-card { cursor: grab; color: var(--muted); font-size: .9rem; line-height: 1; user-select: none; }
.maniglia-card:active { cursor: grabbing; }
.card-head:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }

.banner-regole {
  background: var(--warn-bg);
  color: var(--warn);
  padding: 10px 16px;
  border-radius: var(--radius-md);
  margin-bottom: 16px;
  font-size: var(--font-size-sm);
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
}
.banner-link-btn {
  background: none; border: none; padding: 0;
  color: inherit; font-weight: 600; font-size: inherit;
  text-decoration: underline; cursor: pointer;
}
.regole-fiscali-wrapper { padding: 4px 0; }

/* F24 timeline (card versamenti stimati) */
.f24-rate-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 20px; }
.f24-rate-label { font-size: .8rem; color: var(--ink-soft); }
.f24-saving { font-size: .78rem; color: var(--muted); }

.f24-timeline { position: relative; }
.f24-timeline::before {
  content: '';
  position: absolute;
  left: 11px;
  top: 12px;
  bottom: 12px;
  width: 2px;
  background: var(--line);
  border-radius: 1px;
}
.f24-tl-item { position: relative; padding-left: 36px; margin-bottom: 14px; }
.f24-tl-item:last-child { margin-bottom: 0; }

.f24-tl-dot {
  position: absolute;
  left: 4px;
  top: 11px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2.5px solid var(--card);
  background: var(--accent);
  z-index: 1;
}
.f24-tl-dot.nov { background: var(--info, #0ea5e9); }

.f24-tl-card {
  background: var(--ground);
  border: 1px solid var(--line);
  border-radius: 10px;
  overflow: hidden;
}
.f24-tl-head {
  padding: 10px 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
  flex-wrap: wrap;
}
.f24-tl-head:hover { background: color-mix(in srgb, var(--accent) 5%, var(--ground)); }
.f24-tl-head:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; border-radius: 10px; }

.f24-tl-data { font-weight: 600; font-size: .85rem; flex: 1; min-width: 120px; }
.f24-tl-totale { font-size: .88rem; font-weight: 700; font-variant-numeric: tabular-nums; }
.f24-tl-magg { font-size: .72rem; color: var(--ink-faint); font-variant-numeric: tabular-nums; }
.f24-tl-caret { font-size: .72rem; color: var(--ink-faint); transition: transform .2s; flex-shrink: 0; }
.f24-tl-card.open .f24-tl-caret { transform: rotate(90deg); }

.f24-tl-badge {
  font-size: .68rem;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  letter-spacing: .02em;
  flex-shrink: 0;
}
.f24-badge-saldo { background: color-mix(in srgb, var(--accent) 15%, transparent); color: var(--accent); }
.f24-badge-nov { background: color-mix(in srgb, var(--info, #0ea5e9) 15%, transparent); color: var(--info, #0ea5e9); }

.f24-tl-body { display: none; padding: 0 14px 12px; }
.f24-tl-card.open .f24-tl-body { display: block; }

.f24-table { font-size: .81rem; }
.f24-table th { font-size: .7rem; font-weight: 600; letter-spacing: .05em; text-transform: uppercase; color: var(--ink-faint); padding: 3px 4px 6px; border-bottom: 1px solid var(--line); }
.f24-table td { padding: 5px 4px; color: var(--ink-soft); border-bottom: 1px solid color-mix(in srgb, var(--line) 50%, transparent); font-variant-numeric: tabular-nums; }
.f24-table tr:last-child td { border-bottom: none; }
.f24-mono { font-family: var(--font-mono, monospace); font-size: .77rem; color: var(--ink); }
.f24-riga-interessi td { color: var(--ink-faint); font-style: italic; }
.f24-table tfoot td { padding-top: 7px; border-top: 2px solid var(--line); }
.f24-magg-row td { font-size: .77rem; color: var(--ink-faint); }

.f24-dl-btn { margin-top: 10px; font-size: .8rem; }
</style>
