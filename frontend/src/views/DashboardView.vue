<script setup>
// Dashboard regime forfettario: compenso cumulato annuo vs soglia, previsione imposta,
// grafico a torta stile Flat-Tax (netto / imposta / margine residuo alla soglia).
import { ref, computed, onMounted, watch } from 'vue';
import DonutChart from '../components/DonutChart.vue';
import BarChart from '../components/BarChart.vue';
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
const erroreScadenzeFiscali = ref('');

async function carica() {
  errore.value = '';
  try {
    dashboard.value = await api.dashboardForfettario(annoSelezionato.value);
  } catch (err) {
    errore.value = err.message;
  }
}

async function caricaFattureAperte() {
  fattureAperte.value = await api.fattureAperte().catch(() => []);
}

async function caricaScadenzeFiscali() {
  erroreScadenzeFiscali.value = '';
  try {
    const risposta = await api.scadenzeFiscali();
    scadenzeFiscali.value = risposta?.scadenze ?? [];
  } catch (err) {
    scadenzeFiscali.value = [];
    erroreScadenzeFiscali.value = err.message;
  }
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

function formattaEuro(valore) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(valore ?? 0);
}

function esportaCommercialista() {
  window.open(api.urlExportCommercialista(annoSelezionato.value), '_blank');
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

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
        <div class="card">
          <div class="card-head"><h2>Composizione compenso</h2></div>
          <div class="card-body">
            <DonutChart :fette="fetteComposizione" />
            <p class="note-legal" style="margin-top:20px">
              Settore coefficiente {{ dashboard.coefficenteRedditivita }}% · aliquota {{ dashboard.aliquota }}% ·
              {{ dashboard.mesiFatturati }} mesi fatturati nel {{ dashboard.anno }}.
            </p>
          </div>
        </div>

        <div class="card">
          <div class="card-head"><h2>Soglia forfettario</h2></div>
          <div class="card-body">
            <DonutChart :fette="fetteSoglia" :centro-valore="`${dashboard.percentualeSoglia}%`" centro-label="soglia" />
            <p class="note-legal" style="margin-top:20px">
              Soglia annua: {{ formattaEuro(dashboard.sogliaAnnua) }} · proiezione fine anno: {{ formattaEuro(dashboard.ricaviProiettati) }} ({{ dashboard.percentualeSogliaProiettata }}%).
              <span v-if="dashboard.superamentoSoglia" style="color:var(--warn);font-weight:600"> Soglia già superata.</span>
              <span v-else-if="dashboard.superamentoSogliaProiettato" style="color:var(--warn);font-weight:600"> Proiezione fine anno oltre soglia.</span>
            </p>
          </div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:20px">
        <div class="card">
          <div class="card-head"><h2>Andamento mensile ricavi</h2></div>
          <div class="card-body">
            <BarChart :barre="barreRicaviMensili" />
          </div>
        </div>

        <div class="card" style="display:flex;flex-direction:column">
          <div class="card-head"><h2>Fatture da incassare</h2></div>
          <div class="card-body" style="display:flex;flex-direction:column;flex:1">
            <p v-if="!fattureAperte.length" class="note-legal">Nessuna fattura in attesa di incasso.</p>
            <ul v-else class="lista-piatta lista-scroll">
              <li v-for="f in fattureAperte" :key="`${f.anno}-${f.mese}-${f.clienteId}-${f.numero}`">
                <span>
                  <span class="dot-scaduta" :class="{ visibile: fatturaScaduta(f) }" :title="fatturaScaduta(f) ? `Scaduta il ${formattaData(f.dataScadenzaPagamento)}` : ''"></span>
                  Fattura {{ f.numero }} — {{ formattaData(f.data) }}
                  <template v-if="f.dataScadenzaPagamento">· scadenza {{ formattaData(f.dataScadenzaPagamento) }}</template>
                </span>
                <strong>{{ formattaEuro(f.nettoAPagare) }}</strong>
              </li>
            </ul>
            <p class="nota-piede">Incasso rilevato solo da import CSV home banking (Importa storico → Pagamenti fatture): senza import risultano sempre non incassate.</p>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:20px">
        <div class="card-head"><h2>Prossime scadenze fiscali</h2></div>
        <div class="card-body">
          <p v-if="erroreScadenzeFiscali" class="note-legal">Impossibile recuperare le scadenze fiscali: {{ erroreScadenzeFiscali }}</p>
          <p v-else-if="!scadenzeFiscali.length" class="note-legal">Nessuna scadenza nota nei prossimi mesi.</p>
          <ul v-else class="lista-piatta">
            <li v-for="s in scadenzeFiscali" :key="`${s.data}-${s.tipo}`">
              <span>{{ formattaData(s.data) }} — {{ s.tipo }}<br><small class="note-legal">{{ s.descrizione }}</small></span>
            </li>
          </ul>
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
.lista-piatta li { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; font-size: .88rem; color: var(--ink-soft); }
.nota-piede { margin-top: 10px; font-size: .68rem; color: var(--muted); }
.dot-scaduta { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: transparent; margin-right: 6px; }
.dot-scaduta.visibile { background: var(--warn); }
.lista-scroll { max-height: 220px; overflow-y: auto; }
.nota-piede { margin-top: auto; position: sticky; bottom: 0; background: var(--card); padding-top: 6px; }
</style>
