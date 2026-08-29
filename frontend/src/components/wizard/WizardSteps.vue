<script setup>
// Indicatore visivo di avanzamento del wizard di configurazione, cliccabile per saltare
// direttamente a un passo qualsiasi (senza dover avanzare/indietreggiare uno alla volta).
defineProps({
  passi: { type: Array, required: true }, // es. ['Fornitore', 'Cliente', 'Tariffa & fiscali', 'PEC']
  passoAttivo: { type: Number, required: true }, // indice 0-based
});
const emit = defineEmits(['vai']);
</script>

<template>
  <div class="wizard-steps">
    <div
      v-for="(passo, i) in passi" :key="passo" class="step"
      :class="{ active: i === passoAttivo, done: i < passoAttivo }"
      style="cursor:pointer" @click="emit('vai', i)"
    >
      <span class="num">{{ i < passoAttivo ? '✓' : i + 1 }}</span>{{ passo }}
    </div>
  </div>
</template>
