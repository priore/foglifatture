<script setup>
// Dashboard regime forfettario: compenso cumulato annuo vs soglia, previsione imposta,
// grafico a torta stile Flat-Tax (netto / imposta / margine residuo alla soglia).
import { ref, computed, onMounted, watch } from 'vue';
import DonutChart from '../components/DonutChart.vue';
import BarChart from '../components/BarChart.vue';
import LineChart from '../components/LineChart.vue';
import UpdateModal from '../components/UpdateModal.vue';
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

onMounted(() => {
  carica();
  caricaFattureAperte();
  caricaScadenzeFiscali();
});
watch(annoSelezionato, carica);

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

// Card riordinabili via drag & drop nativo (HTML5) + CSS order. Persistenza per-browser,
// non è un dato di dominio: nessuna sincronizzazione col backend.
// Due viste (Dashboard/Bitcoin), ognuna col proprio ordine e la propria chiave localStorage.
const ORDINE_DEFAULT = ['soglia-cassa', 'soglia-competenza', 'composizione', 'andamento', 'fatture-da-incassare', 'scadenze-fiscali'];
const ORDINE_DEFAULT_BTC = ['btc-riepilogo', 'btc-rate', 'btc-rw', 'btc-valore-attuale'];
const CHIAVE_ORDINE = 'dashboardOrdineCard';
const CHIAVE_ORDINE_BTC = 'dashboardOrdineCardBtc';
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
    return salvato === 'Bitcoin' ? 'Bitcoin' : 'Dashboard';
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
const trascinata = ref(null);

function salvaOrdine() {
  try {
    localStorage.setItem(CHIAVE_ORDINE, JSON.stringify(ordineCard.value));
    localStorage.setItem(CHIAVE_ORDINE_BTC, JSON.stringify(ordineCardBtc.value));
  } catch {
    // storage non disponibile (privato/pieno): ordine resta solo in memoria per questa sessione.
  }
}

function ordinePer(id) {
  return (ORDINE_DEFAULT.includes(id) ? ordineCard.value : ordineCardBtc.value).indexOf(id);
}

function dragStart(id) {
  trascinata.value = id;
}

function drop(idTarget) {
  if (!trascinata.value || trascinata.value === idTarget) return;
  const target = ORDINE_DEFAULT.includes(idTarget) ? ordineCard : ordineCardBtc;
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
  const target = ORDINE_DEFAULT.includes(id) ? ordineCard : ordineCardBtc;
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
  const ordineAttuale = tabAttivo.value === 'Bitcoin' ? ordineCardBtc.value : ordineCard.value;
  const ordineDefault = tabAttivo.value === 'Bitcoin' ? ORDINE_DEFAULT_BTC : ORDINE_DEFAULT;
  return ordineAttuale.some((id, i) => id !== ordineDefault[i]);
});

function ripristinaLayout() {
  if (tabAttivo.value === 'Bitcoin') {
    ordineCardBtc.value = [...ORDINE_DEFAULT_BTC];
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

      <div class="tab-toggle">
        <button type="button" :class="tabAttivo === 'Dashboard' ? 'btn btn-primary' : 'btn btn-ghost'" @click="cambiaTab('Dashboard')">Dashboard</button>
        <button type="button" :class="tabAttivo === 'Bitcoin' ? 'btn btn-primary' : 'btn btn-ghost'" @click="cambiaTab('Bitcoin')">Bitcoin</button>
      </div>

      <div v-if="tabAttivo === 'Dashboard'" class="griglia-card">
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
            <p v-if="dashboard.cassa.superamentoSoglia" class="avviso-riga avviso-warn">Soglia già superata (per cassa).</p>
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
              <span v-if="dashboard.superamentoSoglia" style="color:var(--warn);font-weight:600"> Soglia già superata.</span>
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

      <div v-else class="griglia-card">
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

.tab-toggle { display: flex; gap: 8px; margin-bottom: 20px; }
.griglia-card { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 20px; }
.card-head-titolo { display: flex; align-items: center; gap: 8px; }
.maniglia-card { cursor: grab; color: var(--muted); font-size: .9rem; line-height: 1; user-select: none; }
.maniglia-card:active { cursor: grabbing; }
.card-head:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
</style>
