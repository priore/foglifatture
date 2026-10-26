<script setup>
// Popup unico per conferme e avvisi (vedi composables/useConferma.js), montato in App.vue.
import { onMounted, onUnmounted } from 'vue';
import { richiesta, chiudiRichiesta } from '../../composables/useConferma.js';

const alTasto = (e) => { if (e.key === 'Escape' && richiesta.value) chiudiRichiesta(false); };
onMounted(() => window.addEventListener('keydown', alTasto));
onUnmounted(() => window.removeEventListener('keydown', alTasto));
</script>

<template>
  <Teleport to="body">
    <div v-if="richiesta" class="cal-overlay" @click.self="chiudiRichiesta(false)">
      <div class="cal-box conferma-box" role="alertdialog" aria-modal="true" :aria-label="richiesta.titolo">
        <h2 class="cal-titolo">{{ richiesta.titolo }}</h2>
        <p class="conferma-messaggio">{{ richiesta.messaggio }}</p>
        <div class="modal-actions">
          <button type="button" class="btn btn-ok" @click="chiudiRichiesta(true)">{{ richiesta.ok }}</button>
          <button v-if="richiesta.annulla" type="button" class="btn btn-warn" @click="chiudiRichiesta(false)">{{ richiesta.annulla }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
