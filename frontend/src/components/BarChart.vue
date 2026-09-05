<script setup>
// Grafico a barre generico. Nessuna libreria: barre CSS bastano.
import { computed } from 'vue';

const props = defineProps({
  barre: { type: Array, required: true }, // [{ etichetta, valore }]
});

const massimo = computed(() => Math.max(...props.barre.map((b) => b.valore), 1));
</script>

<template>
  <div class="bar-chart">
    <div v-for="b in barre" :key="b.etichetta" class="bar-row">
      <span class="bar-label">{{ b.etichetta }}</span>
      <div class="bar-track">
        <div class="bar-fill" :style="{ width: `${(b.valore / massimo) * 100}%` }"></div>
      </div>
      <span class="bar-valore">{{ b.valoreTesto ?? b.valore }}</span>
    </div>
  </div>
</template>

<style scoped>
.bar-chart { display: flex; flex-direction: column; gap: var(--gap-sm); }
.bar-row { display: grid; grid-template-columns: 32px 1fr auto; align-items: center; gap: var(--gap-md); }
.bar-label { font-size: var(--font-size-xs); color: var(--muted); text-transform: uppercase; }
.bar-track { height: 10px; background: var(--line); border-radius: var(--radius-sm); overflow: hidden; }
.bar-fill { height: 100%; background: var(--accent); border-radius: var(--radius-sm); }
.bar-valore { font-family: 'IBM Plex Mono', monospace; font-size: .78rem; color: var(--ink-soft); min-width: 70px; text-align: right; }
</style>
