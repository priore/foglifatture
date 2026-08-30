<script setup>
// Selettore cliente attivo: dropdown custom (non <select> nativo) perché il nome del
// bottone selezionato deve poter andare su più righe quando è lungo — un <select> non
// permette di far andare a capo il testo mostrato, solo la lista delle opzioni.
import { ref, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  clienti: { type: Array, required: true }, // [{ id, denominazione }]
  modelValue: { type: String, default: null },
});
const emit = defineEmits(['update:modelValue']);

const aperto = ref(false);
const radice = ref(null);

function scegli(id) {
  emit('update:modelValue', id);
  aperto.value = false;
}

function alClickFuori(evento) {
  if (radice.value && !radice.value.contains(evento.target)) aperto.value = false;
}
onMounted(() => document.addEventListener('click', alClickFuori));
onUnmounted(() => document.removeEventListener('click', alClickFuori));
</script>

<template>
  <div class="cliente-switcher" ref="radice">
    <button type="button" class="btn btn-ghost cliente-switcher-bottone" @click="aperto = !aperto">
      {{ clienti.find(c => c.id === modelValue)?.denominazione || 'Cliente senza nome' }}
    </button>
    <ul v-if="aperto" class="cliente-switcher-menu">
      <li v-for="c in clienti" :key="c.id">
        <button type="button" :class="{ attivo: c.id === modelValue }" @click="scegli(c.id)">
          {{ c.denominazione || 'Cliente senza nome' }}
        </button>
      </li>
    </ul>
  </div>
</template>
