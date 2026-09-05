<script setup>
// Selettore cliente attivo: dropdown custom (non <select> nativo) perché il nome del
// bottone selezionato deve poter andare su più righe quando è lungo — un <select> non
// permette di far andare a capo il testo mostrato, solo la lista delle opzioni.
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';

const props = defineProps({
  clienti: { type: Array, required: true }, // [{ id, denominazione }]
  modelValue: { type: String, default: null },
});
const emit = defineEmits(['update:modelValue']);

const aperto = ref(false);
const radice = ref(null);
const ricerca = ref('');
const inputRicerca = ref(null);

const clientiFiltrati = computed(() => {
  const q = ricerca.value.trim().toLowerCase();
  if (!q) return props.clienti;
  return props.clienti.filter((c) => (c.denominazione || '').toLowerCase().includes(q));
});

function apri() {
  aperto.value = !aperto.value;
  if (aperto.value) {
    ricerca.value = '';
    nextTick(() => inputRicerca.value?.focus());
  }
}

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
    <button type="button" class="btn btn-ghost cliente-switcher-bottone" @click="apri">
      {{ clienti.find(c => c.id === modelValue)?.denominazione || 'Cliente senza nome' }}
    </button>
    <div v-if="aperto" class="cliente-switcher-menu">
      <input
        v-if="clienti.length > 5" ref="inputRicerca"
        type="search" v-model="ricerca" placeholder="Cerca cliente…"
        class="cliente-switcher-ricerca"
      >
      <p v-if="!clientiFiltrati.length" class="cliente-switcher-vuoto">Nessun cliente trovato.</p>
      <ul>
        <li v-for="c in clientiFiltrati" :key="c.id">
          <button type="button" :class="{ attivo: c.id === modelValue }" @click="scegli(c.id)">
            {{ c.denominazione || 'Cliente senza nome' }}
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>
