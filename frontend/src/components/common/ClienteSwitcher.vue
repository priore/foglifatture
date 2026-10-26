<script setup>
// Selettore cliente attivo: il bottone mostra il nome andando a capo se lungo (cosa che un
// <select> nativo non permette); la scelta avviene nel popup ListaPopup.
import { ref, computed } from 'vue';
import ListaPopup from './ListaPopup.vue';

const props = defineProps({
  clienti: { type: Array, required: true }, // [{ id, denominazione }]
  modelValue: { type: String, default: null },
});
const emit = defineEmits(['update:modelValue']);

const aperto = ref(false);
const voci = computed(() => props.clienti.map((c) => ({ value: c.id, label: c.denominazione || 'Cliente senza nome' })));

function scegli(id) {
  emit('update:modelValue', id);
  aperto.value = false;
}
</script>

<template>
  <div class="cliente-switcher">
    <button type="button" class="btn btn-ghost cliente-switcher-bottone" @click="aperto = true">
      {{ clienti.find(c => c.id === modelValue)?.denominazione || 'Cliente senza nome' }}
    </button>
    <ListaPopup
      v-if="aperto" :voci="voci" :model-value="modelValue"
      titolo="Cliente attivo" descrizione="Scegli il cliente su cui lavorare"
      @conferma="scegli" @chiudi="aperto = false"
    />
  </div>
</template>
