<script setup>
import { ref } from 'vue';
import { api } from '../../services/api.js';
import { chiediConferma } from '../../composables/useConferma.js';
import { registro } from '../../registroEstensioni.js';
import StepCartelleCloud from './StepCartelleCloud.vue';

// Negli ambienti embedded l'archivio cloud passa dall'API del provider; sul desktop dalla cartella del suo client.
const archivioCloud = registro.archivioCloud;
const cartelleRef = ref(null);

// Il Salva del wizard applica la cartella cloud scelta (se ce n'è una): false se l'utente rinuncia.
defineExpose({ salva: async () => (await cartelleRef.value?.salva?.()) ?? true });

function cartellaCambiata(percorso) {
  props.modelValue.percorso = percorso;
  nuovoPercorso.value = percorso;
}

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

async function apriArchivioEsistente() {
  const ok = await chiediConferma(
    'Apri l\'archivio trovato in questa cartella. I dati attuali non vengono toccati: restano nella cartella di prima.',
    { titolo: 'Apri archivio esistente', ok: 'Apri' }
  );
  if (!ok) return;
  spostamentoInCorso.value = true;
  try {
    const { percorso } = await api.apriArchivioEsistente(nuovoPercorso.value);
    props.modelValue.percorso = percorso;
    nuovoPercorso.value = percorso;
    messaggio.value = 'Archivio aperto';
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
      <button
        class="btn btn-ghost"
        type="button"
        :disabled="spostamentoInCorso || !nuovoPercorso || nuovoPercorso === modelValue.percorso"
        @click="apriArchivioEsistente"
      >Apri archivio esistente</button>
      <span class="badge-mono">{{ messaggio }}</span>
    </div>
  </div>
  <p class="note-legal" style="margin-top:16px">
    Vuoto = cartella di default (backend/data/ nel progetto). Cambiare il percorso sposta
    subito tutti i file esistenti nella nuova cartella (nessuna perdita dati); il server continua a
    usare la nuova cartella senza bisogno di riavvio. «Sposta dati qui» richiede una cartella vuota.
    «Apri archivio esistente» collega una cartella che contiene già un archivio (con config.json) senza
    spostare nulla: i dati attuali restano dove sono.
  </p>
  <component :is="archivioCloud" v-if="archivioCloud" />
  <StepCartelleCloud v-else ref="cartelleRef" :percorso-attuale="modelValue.percorso" @cambiata="cartellaCambiata" />
</template>
