<script setup>
import { ref } from 'vue';
import { api } from '../../services/api.js';

const props = defineProps({
  modelValue: { type: Object, required: true }, // config.dati
});

const nuovoPercorso = ref(props.modelValue.percorso);
const messaggio = ref('');
const spostamentoInCorso = ref(false);

async function spostaPercorsoDati() {
  spostamentoInCorso.value = true;
  messaggio.value = 'Spostamento in corso…';
  try {
    const { percorso } = await api.spostaPercorsoDati(nuovoPercorso.value);
    props.modelValue.percorso = percorso;
    nuovoPercorso.value = percorso;
    messaggio.value = 'Spostato';
  } catch (err) {
    messaggio.value = `Errore: ${err.message}`;
  } finally {
    spostamentoInCorso.value = false;
    setTimeout(() => (messaggio.value = ''), 4000);
  }
}
</script>

<template>
  <div class="form-grid">
    <div class="field field-full full">
      <label>Cartella dati (timesheet, fatture, config)</label>
      <input v-model="nuovoPercorso" placeholder="/Users/tuonome/Dropbox/Timesheet Dati" :disabled="spostamentoInCorso">
    </div>
    <div class="field field-full full" style="flex-direction:row;align-items:center;gap:12px">
      <button
        class="btn btn-ghost"
        type="button"
        :disabled="spostamentoInCorso || !nuovoPercorso || nuovoPercorso === modelValue.percorso"
        @click="spostaPercorsoDati"
      >Sposta dati qui</button>
      <span class="badge-mono">{{ messaggio }}</span>
    </div>
  </div>
  <p class="note-legal" style="margin-top:16px">
    Vuoto = cartella di default (backend/data/ nel progetto). Cambiare il percorso sposta
    subito tutti i file esistenti nella nuova cartella (nessuna perdita dati); il server continua a
    usare la nuova cartella senza bisogno di riavvio. La cartella scelta deve essere vuota.
  </p>
</template>
