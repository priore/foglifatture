<script setup>
// Impostazioni regime forfettario: soglia fatturato, codice ATECO (coefficiente di
// redditività auto-compilato dalla selezione), data inizio attività per l'aliquota 5%/15%.
import { ref, onMounted, computed } from 'vue';
import { api } from '../../services/api.js';

const props = defineProps({
  modelValue: { type: Object, required: true }, // config.forfettario
});

const codici = ref([]);
const ricerca = ref('');

onMounted(async () => {
  codici.value = await api.settoriAteco();
  const attuale = codici.value.find((c) => c.codice === props.modelValue.codiceAteco);
  if (attuale) ricerca.value = `${attuale.codice} — ${attuale.descrizione}`;
});

const risultati = computed(() => {
  const termine = ricerca.value.trim().toLowerCase();
  if (!termine) return [];
  return codici.value
    .filter((c) => c.codice.toLowerCase().includes(termine)
      || c.descrizione.toLowerCase().includes(termine)
      || c.settore.toLowerCase().includes(termine))
    .slice(0, 20);
});

function selezionaCodice(c) {
  props.modelValue.codiceAteco = c.codice;
  props.modelValue.settoreAteco = c.settore;
  props.modelValue.coefficenteRedditivita = c.coefficente;
  ricerca.value = `${c.codice} — ${c.descrizione}`;
}
</script>

<template>
  <div class="form-grid">
    <div class="field"><label>Soglia fatturato annuo (€)</label><input type="number" step="1" min="1" v-model.number="modelValue.sogliaAnnua"></div>
    <div class="field"><label>Data inizio attività</label><input type="date" v-model="modelValue.dataInizioAttivita"></div>
    <div class="field field-full" style="position:relative">
      <label>Codice ATECO</label>
      <input type="text" v-model="ricerca" placeholder="Cerca per codice, descrizione o settore…" autocomplete="off">
      <ul v-if="risultati.length" class="ateco-risultati">
        <li v-for="c in risultati" :key="c.codice" @click="selezionaCodice(c)">
          <strong>{{ c.codice }}</strong> — {{ c.descrizione }}
          <span class="ateco-settore">{{ c.settore }} · {{ c.coefficente }}%</span>
        </li>
      </ul>
    </div>
    <div class="field"><label>Settore</label><input type="text" v-model="modelValue.settoreAteco" readonly></div>
    <div class="field"><label>Coefficiente di redditività (%)</label><input type="number" step="1" min="0" max="100" v-model.number="modelValue.coefficenteRedditivita"></div>
  </div>
  <p class="note-legal" style="margin-top:16px">
    Aliquota imposta sostitutiva: 5% nei primi 5 anni solari dall'inizio attività, 15% dal sesto anno.
    Il coefficiente si auto-compila selezionando il codice ATECO, ma resta modificabile.
  </p>
</template>

<style scoped>
.ateco-risultati {
  position: absolute; top: 100%; left: 0; right: 0; z-index: 10;
  background: var(--card); border: 1px solid var(--line); border-radius: 8px;
  max-height: 260px; overflow-y: auto; list-style: none; margin: 4px 0 0; padding: 4px;
  box-shadow: var(--shadow);
}
.ateco-risultati li { padding: 8px 10px; border-radius: 6px; cursor: pointer; font-size: .85rem; color: var(--ink); }
.ateco-risultati li:hover { background: var(--ground); }
.ateco-settore { display: block; font-size: .74rem; color: var(--muted); margin-top: 2px; }
</style>
