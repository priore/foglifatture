<script setup>
// Lista di scelta a popup centrato, condivisa da SelectField e ClienteSwitcher.
// Casella di ricerca automatica sopra `SOGLIA_RICERCA` voci; il valore cambia solo con OK,
// tap fuori / Esc / Annulla chiudono senza selezione.
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
const SOGLIA_RICERCA = 8;
const props = defineProps({
  // [{ value, label, disabled? }] oppure intestazione di gruppo [{ gruppo: true, label }]
  voci: { type: Array, required: true },
  modelValue: { default: null },
  titolo: { type: String, required: true },
  descrizione: { type: String, default: '' },
});
const emit = defineEmits(['conferma', 'chiudi']);

const bozza = ref(props.modelValue);
const ricerca = ref('');
const inputRicerca = ref(null);
const lista = ref(null);

const conRicerca = computed(() => props.voci.filter((v) => !v.gruppo && !v.disabled).length > SOGLIA_RICERCA);
const visibili = computed(() => {
  const q = ricerca.value.trim().toLowerCase();
  if (!q) return props.voci;
  return props.voci.filter((v) => !v.gruppo && !v.disabled && String(v.label).toLowerCase().includes(q));
});
const haSelezione = computed(() => props.voci.some((v) => !v.gruppo && v.value === bozza.value));

const alTasto = (e) => { if (e.key === 'Escape') emit('chiudi'); };
onMounted(() => {
  window.addEventListener('keydown', alTasto);
  nextTick(() => {
    // Al tocco la tastiera a schermo si aprirebbe subito e coprirebbe la lista: la ricerca si attiva con un tocco.
    if (conRicerca.value && !matchMedia('(pointer: coarse)').matches) inputRicerca.value?.focus();
    lista.value?.querySelector('.selezionata')?.scrollIntoView({ block: 'center' });
  });
});
onUnmounted(() => window.removeEventListener('keydown', alTasto));
</script>

<template>
  <Teleport to="body">
    <div class="cal-overlay" @click.self="emit('chiudi')">
      <div class="cal-box lista-box" role="dialog" aria-modal="true" :aria-label="titolo">
        <h2 class="cal-titolo">{{ titolo }}</h2>
        <p v-if="descrizione" class="cal-descrizione">{{ descrizione }}</p>
        <input v-if="conRicerca" ref="inputRicerca" v-model="ricerca" type="search" class="lista-ricerca" placeholder="Cerca…" aria-label="Cerca nella lista">
        <ul ref="lista" class="lista-voci" role="listbox">
          <template v-for="(v, i) in visibili" :key="i">
            <li v-if="v.gruppo" class="lista-gruppo">{{ v.label }}</li>
            <li v-else-if="v.disabled" class="lista-gruppo">{{ v.label }}</li>
            <li v-else>
              <button type="button" role="option" class="lista-voce" :class="{ selezionata: v.value === bozza }" :aria-selected="v.value === bozza" @click="bozza = v.value" @dblclick="emit('conferma', v.value)">{{ v.label || '—' }}</button>
            </li>
          </template>
          <li v-if="!visibili.length" class="lista-gruppo">Nessun risultato.</li>
        </ul>
        <div class="modal-actions">
          <button type="button" class="btn btn-ok" :disabled="!haSelezione" @click="emit('conferma', bozza)">OK</button>
          <button type="button" class="btn btn-warn" @click="emit('chiudi')">Annulla</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
