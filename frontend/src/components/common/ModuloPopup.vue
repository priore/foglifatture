<script setup>
// Modulo di inserimento a popup centrato: titolo e pulsanti restano fissi, il contenuto scorre se non entra.
// Nelle shell compatte (data-popup-intero), se il contenuto non entra nello schermo, il popup diventa una vista a schermo intero (stessa struttura, X in alto a destra).
// Tap fuori / Esc / X equivalgono ad Annulla (`chiudi`); con `comeForm` il popup è un <form> e il submit emette `invia`.
import { ref, onMounted, onUnmounted } from 'vue';
defineProps({
  titolo: { type: String, required: true },
  descrizione: { type: String, default: '' },
  comeForm: { type: Boolean, default: false },
});
const emit = defineEmits(['chiudi', 'invia']);

const scatola = ref(null);
const sopra = ref(null);
const intero = ref(false);
const compatto = document.documentElement.dataset.popupIntero === '1';

// Con una lista o un calendario aperti sopra il modulo, Esc chiude solo quello (il suo overlay è l'ultimo nel body).
const alTasto = (e) => { if (e.key === 'Escape' && sopra.value === [...document.querySelectorAll('.cal-overlay')].pop()) emit('chiudi'); };
// Schermo intero solo se il foglio (altezza massima = finestra - 32px) dovrebbe scorrere. La tastiera restringe la finestra: l'altezza di riferimento è la maggiore vista finora, così aprirla non fa passare a schermo intero.
let altezzaMax = window.innerHeight;
const controllaAltezza = () => {
  altezzaMax = Math.max(altezzaMax, window.innerHeight);
  if (intero.value || !scatola.value) return;
  intero.value = scatola.value.scrollHeight > altezzaMax - 32;
};
let osservatore;
onMounted(() => {
  window.addEventListener('keydown', alTasto);
  if (compatto) {
    osservatore = new ResizeObserver(controllaAltezza);
    osservatore.observe(scatola.value);
    for (const figlio of scatola.value.children) osservatore.observe(figlio);
    controllaAltezza();
  }
});
onUnmounted(() => { window.removeEventListener('keydown', alTasto); osservatore?.disconnect(); });
</script>

<template>
  <Teleport to="body">
    <div ref="sopra" class="cal-overlay" @click.self="emit('chiudi')">
      <button v-if="compatto && intero" type="button" class="schermo-chiudi" aria-label="Chiudi" @click="emit('chiudi')">✕</button>
      <component :is="comeForm ? 'form' : 'div'" ref="scatola" class="cal-box modulo-box" :class="{ 'schermo-intero': intero }" role="dialog" aria-modal="true" :aria-label="titolo" @submit.prevent="emit('invia')">
        <h2 class="cal-titolo">{{ titolo }}</h2>
        <p v-if="descrizione" class="cal-descrizione">{{ descrizione }}</p>
        <div class="field modulo-corpo"><slot /></div>
        <div class="modal-actions"><slot name="azioni" /></div>
      </component>
    </div>
  </Teleport>
</template>
