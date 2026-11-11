<script setup>
import { ref, watch, nextTick } from 'vue';

// Tabbar superiore delle sezioni (stesso stile di quella della Dashboard), scorrevole in orizzontale
// quando le schede non entrano; indice della scheda attiva in `modelValue`.
const props = defineProps({ passi: { type: Array, required: true }, modelValue: { type: Number, default: 0 } });
defineEmits(['update:modelValue']);

const barra = ref(null);
// Tiene visibile la scheda attiva anche quando si arriva da un link diretto.
watch(() => props.modelValue, async () => {
  await nextTick();
  barra.value?.querySelector('.btn-primary')?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
}, { immediate: true });
</script>

<template>
  <div ref="barra" class="tabbar-passi" role="tablist">
    <button
      v-for="(p, i) in passi"
      :key="p"
      type="button"
      role="tab"
      :class="i === modelValue ? 'btn btn-primary' : 'btn btn-ghost'"
      :aria-selected="i === modelValue"
      @click="$emit('update:modelValue', i)"
    >{{ p }}</button>
  </div>
</template>

<style scoped>
/* `display` separato: il selettore scoped batte `.solo-compatto { display: none }` e mostrerebbe la barra anche su desktop. */
.tabbar-passi:not(.solo-compatto) { display: flex; }
.tabbar-passi { gap: 8px; overflow-x: auto; margin-bottom: 20px; padding-bottom: 4px; scrollbar-width: none; -webkit-overflow-scrolling: touch; }
.tabbar-passi::-webkit-scrollbar { display: none; }
.tabbar-passi .btn { flex: 0 0 auto; white-space: nowrap; }
</style>
