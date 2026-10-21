<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../../services/api.js';

// Modale bloccante: finché i termini correnti non sono accettati. Non copre /privacy,
// dove i termini si possono leggere per intero.
const route = useRoute();
const termini = ref(null);
const spuntato = ref(false);
const spuntatoSpecifica = ref(false);
const errore = ref('');

onMounted(async () => {
  termini.value = await api.getTermini().catch(() => null);
});

async function accetta() {
  errore.value = '';
  try {
    await api.accettaTermini();
    termini.value = { ...termini.value, accettati: true };
  } catch (e) {
    errore.value = e.message;
  }
}
</script>

<template>
  <div v-if="termini && !termini.accettati && route.path !== '/privacy'" class="modal-overlay">
    <div class="modal-box termini-box">
      <h2>Termini d'uso</h2>
      <div class="termini-testo">
        <p v-for="(p, i) in termini.testo.split('\n\n')" :key="i">{{ p }}</p>
      </div>
      <div class="termini-check">
        <input id="termini-accetto" v-model="spuntato" type="checkbox" class="checkbox-app" />
        <label for="termini-accetto">Ho letto e accetto</label>
      </div>
      <div class="termini-check">
        <input id="termini-specifica" v-model="spuntatoSpecifica" type="checkbox" class="checkbox-app" />
        <label for="termini-specifica">{{ termini.approvazioneSpecifica }}</label>
      </div>
      <p v-if="!spuntato || !spuntatoSpecifica" class="note-legal">Per proseguire spunta entrambe le caselle.</p>
      <p v-if="errore" class="note-legal">{{ errore }}</p>
      <div class="modal-actions">
        <router-link to="/privacy" class="btn btn-ghost">Privacy</router-link>
        <button type="button" class="btn btn-ok" :disabled="!spuntato || !spuntatoSpecifica" :title="spuntato && spuntatoSpecifica ? '' : 'Spunta entrambe le caselle per accettare'" @click="accetta">Accetta</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.termini-box { max-width: 720px; max-height: 90vh; overflow-y: auto; }
.termini-testo { margin: 12px 0; }
.termini-check { display: flex; align-items: center; gap: var(--gap-sm); margin-top: 16px; }
</style>
