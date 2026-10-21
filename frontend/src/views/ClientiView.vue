<script setup>
import { ref, onMounted } from 'vue';
import StepClienti from '../components/wizard/StepClienti.vue';
import { api } from '../services/api.js';
import { aggiornaGestioniClienti } from '../composables/useClienteAttivo.js';

const config = ref(null);
const messaggio = ref('');

onMounted(async () => {
  config.value = await api.getConfig();
});

async function salva() {
  messaggio.value = 'Salvataggio…';
  try {
    config.value = await api.saveConfig(config.value);
    aggiornaGestioniClienti(config.value.clienti);
    messaggio.value = 'Salvato';
  } catch (err) {
    messaggio.value = `Errore: ${err.message}`;
  } finally {
    setTimeout(() => (messaggio.value = ''), 2000);
  }
}
</script>

<template>
  <div v-if="config">
    <div class="page-head">
      <div><h1>Clienti</h1><p>Elenco clienti e tariffe orarie</p></div>
      <div style="display:flex;align-items:center;gap:12px">
        <span v-if="messaggio" class="badge-mono">{{ messaggio }}</span>
        <button class="btn btn-ok" @click="salva">Salva</button>
      </div>
    </div>
    <div class="card">
      <div class="card-body">
        <StepClienti v-model="config.clienti" @salva-subito="salva" />
      </div>
    </div>
  </div>
</template>
