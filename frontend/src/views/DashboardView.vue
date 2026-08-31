<script setup>
// Dashboard regime forfettario: compenso cumulato annuo vs soglia, previsione imposta,
// grafico a torta stile Flat-Tax (netto / imposta / margine residuo alla soglia).
import { ref, computed, onMounted, watch } from 'vue';
import DonutChart from '../components/DonutChart.vue';
import { api } from '../services/api.js';

const anni = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);
const annoSelezionato = ref(new Date().getFullYear());
const dashboard = ref(null);
const errore = ref('');

async function carica() {
  errore.value = '';
  try {
    dashboard.value = await api.dashboardForfettario(annoSelezionato.value);
  } catch (err) {
    errore.value = err.message;
  }
}

onMounted(carica);
watch(annoSelezionato, carica);

// Composizione del compenso: ricavi/reddito fiscale/imposta, proporzionati tra loro.
const fetteComposizione = computed(() => {
  if (!dashboard.value) return [];
  const { ricaviCumulati, redditoImponibile, impostaStimata } = dashboard.value;
  return [
    { etichetta: 'Ricavi/compensi', valore: ricaviCumulati, colore: 'var(--ok)' },
    { etichetta: 'Reddito fiscale', valore: redditoImponibile, colore: 'var(--accent)' },
    { etichetta: 'Imposta stimata', valore: impostaStimata, colore: 'var(--warn)' },
  ];
});

// Soglia forfettario: quota di fatturato già raggiunta vs margine residuo agli 85.000€.
const fetteSoglia = computed(() => {
  if (!dashboard.value) return [];
  const { sogliaAnnua, ricaviCumulati } = dashboard.value;
  const margineResiduo = Math.max(sogliaAnnua - ricaviCumulati, 0);
  return [
    { etichetta: 'Ricavi cumulati', valore: ricaviCumulati, colore: dashboard.value.superamentoSoglia ? 'var(--warn)' : 'var(--accent)' },
    { etichetta: 'Margine alla soglia', valore: margineResiduo, colore: 'var(--line)' },
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
        <div class="stat" :class="dashboard.superamentoSoglia ? 'warn' : 'ok'"><div class="label">Imposta stimata ({{ dashboard.aliquota }}%)</div><div class="value">{{ formattaEuro(dashboard.impostaStimata) }}</div></div>
        <div class="stat accent"><div class="label">Proiezione fine anno</div><div class="value">{{ formattaEuro(dashboard.ricaviProiettati) }}</div></div>
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
    </template>
  </div>
</template>
